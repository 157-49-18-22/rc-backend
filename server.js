const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const balanceRoutes = require("./routes/balanceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const jwt = require("jsonwebtoken");
const HitLog = require("./models/hitlog");
const cors = require("cors");

dotenv.config();
connectDB();
const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BASE64_AUTH = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

// Normalize response function (keep as is)
const normalizeApiResponse = (apiResult) => {
  return {
    issue_date: apiResult.reg_date,
    expiry_date: apiResult.rc_expiry_date,
    registered_at: apiResult.reg_authority,
    norms_type: apiResult.norms_type,
    financier: apiResult.rc_financer || "N/A",
    financed: apiResult.financed,
    owner_data: {
      name: apiResult.owner_name,
      father_name: apiResult.owner_father_name,
      present_address: apiResult.present_address,
      permanent_address: apiResult.permanent_address,
      serial: apiResult.owner_count,
    },
    vehicle_data: {
      manufactured_date: apiResult.vehicle_manufacturing_month_year,
      category_description: apiResult.class,
      chassis_number: apiResult.chassis,
      engine_number: apiResult.engine,
      maker_description: apiResult.vehicle_manufacturer_name,
      maker_model: apiResult.model,
      body_type: apiResult.body_type,
      fuel_type: apiResult.type,
      color: apiResult.vehicle_colour,
      cubic_capacity: apiResult.vehicle_cubic_capacity,
      unladen_weight: apiResult.unladen_weight,
      number_of_cylinders: apiResult.vehicle_cylinders_no,
      seating_capacity: apiResult.vehicle_seat_capacity,
      wheelbase: apiResult.wheelbase,
    },
    insurance_data: {
      expiry_date: apiResult.vehicle_insurance_upto,
      company: apiResult.vehicle_insurance_company_name,
      policy_number: apiResult.vehicle_insurance_policy_number,
    },
    tax_end_date: apiResult.vehicle_tax_upto,
    status: apiResult.status,
    status_as_on: apiResult.status_as_on,
  };
};

// Vehicle RC Validation API (Direct RC lookup)
app.post("/api/vehicle/rc", async (req, res) => {
  try {
    const { rcNumber } = req.body;

    if (!rcNumber) {
      return res.status(400).json({ error: "RC number is required" });
    }

    const requestBody = {
      client_ref_num: `req_${Date.now()}`,
      reg_no: rcNumber.toUpperCase(),
    };

    console.log("RC lookup request:", requestBody);

    const response = await fetch("https://svc.digitap.ai/validation/kyc/v1/rc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${BASE64_AUTH}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Digitap RC API Error:", text);
      return res.status(response.status).json({ 
        error: `API Error: ${response.statusText}`,
        details: text 
      });
    }

    const data = await response.json();
    console.log("RC lookup response:", data.result_code);

    if (data.result_code !== 101) {
      return res.status(400).json({
        error: `API Error: ${data.result_code} - ${data.message || "Check vehicle number"}`,
        result_code: data.result_code,
      });
    }

    // Log hit if user is authenticated
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await HitLog.create({ userId: decoded.userId });
      } catch (err) {
        console.warn("Invalid token in /api/vehicle/rc");
      }
    }

    const normalizedData = normalizeApiResponse(data.result);
    normalizedData.searchType = "rc";
    res.json(normalizedData);
  } catch (error) {
    console.error("Backend RC API Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Chassis Number to RC Lookup (Step 1) - FIXED
app.post("/api/vehicle/chassis-to-rc", async (req, res) => {
  try {
    const { chassisNumber } = req.body;

    if (!chassisNumber) {
      return res.status(400).json({ 
        success: false,
        error: "Chassis number is required" 
      });
    }

    const requestBody = {
      client_ref_num: `req_${Date.now()}`,
      chassis_no: chassisNumber.toUpperCase(),
    };

    console.log("Chassis lookup request:", requestBody);
    
    const response = await fetch("https://svc.digitap.ai/validation/kyc/v1/reverse_rc_lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${BASE64_AUTH}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Digitap Chassis Lookup API Error:", text);
      return res.status(response.status).json({ 
        success: false,
        error: `API Error: ${response.statusText}`,
        details: text 
      });
    }

    const data = await response.json();
    console.log("Chassis lookup response:", data);

    if (data.result_code !== 101) {
      return res.status(400).json({
        success: false,
        error: `API Error: ${data.result_code} - ${data.message || "Check chassis number"}`,
        result_code: data.result_code,
      });
    }

    // Return just the RC number from this step
    res.json({
      success: true,
      rcNumber: data.result.reg_no,
      chassisNumber: chassisNumber.toUpperCase(),
      result_source: data.result.result_source,
    });
  } catch (error) {
    console.error("Chassis Lookup Error:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error" 
    });
  }
});

// Combined vehicle search endpoint (Handles both RC and Chassis)
app.post("/api/vehicle/search", async (req, res) => {
  try {
    const { searchType, searchValue } = req.body;

    if (!searchType || !searchValue) {
      return res.status(400).json({ 
        success: false,
        error: "Search type and search value are required",
        validTypes: ["rc", "chassis"]
      });
    }

    let rcNumber;
    
    // Step 1: If searching by chassis, first get RC number
    if (searchType === "chassis") {
      console.log(`Step 1: Looking up RC for chassis: ${searchValue}`);
      
      // Call the chassis-to-rc endpoint directly (not via fetch to localhost)
      const chassisRequestBody = {
        chassisNumber: searchValue
      };
      
      const chassisResponse = await fetch("https://svc.digitap.ai/validation/kyc/v1/reverse_rc_lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${BASE64_AUTH}`,
        },
        body: JSON.stringify({
          client_ref_num: `req_${Date.now()}_chassis`,
          chassis_no: searchValue.toUpperCase(),
        }),
      });

      if (!chassisResponse.ok) {
        const text = await chassisResponse.text();
        console.error("Chassis lookup failed:", text);
        return res.status(chassisResponse.status).json({
          success: false,
          error: "Chassis number not found or invalid",
          details: text
        });
      }

      const chassisData = await chassisResponse.json();
      
      if (chassisData.result_code !== 101) {
        return res.status(400).json({
          success: false,
          error: `Chassis lookup failed: ${chassisData.result_code} - ${chassisData.message || "Invalid chassis"}`,
          result_code: chassisData.result_code,
        });
      }
      
      rcNumber = chassisData.result.reg_no;
      console.log(`Step 1 Complete: Found RC ${rcNumber} for chassis ${searchValue}`);
    } else {
      rcNumber = searchValue;
    }

    // Step 2: Get vehicle details using RC number
    console.log(`Step 2: Fetching details for RC: ${rcNumber}`);
    
    const rcResponse = await fetch("https://svc.digitap.ai/validation/kyc/v1/rc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${BASE64_AUTH}`,
      },
      body: JSON.stringify({
        client_ref_num: `req_${Date.now()}_rc`,
        reg_no: rcNumber.toUpperCase(),
      }),
    });

    if (!rcResponse.ok) {
      const text = await rcResponse.text();
      console.error("RC details fetch failed:", text);
      return res.status(rcResponse.status).json({
        success: false,
        error: "Vehicle details not found",
        details: text
      });
    }

    const rcData = await rcResponse.json();
    
    if (rcData.result_code !== 101) {
      return res.status(400).json({
        success: false,
        error: `Vehicle details not found: ${rcData.result_code} - ${rcData.message || "Invalid RC"}`,
        result_code: rcData.result_code,
      });
    }

    // Normalize and add search metadata
    const normalizedData = normalizeApiResponse(rcData.result);
    normalizedData.searchType = searchType;
    normalizedData.originalSearchValue = searchValue;
    
    if (searchType === "chassis") {
      normalizedData.chassisNumber = searchValue;
      normalizedData.rcNumber = rcNumber;
    }

    // Log hit for authenticated users
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await HitLog.create({ userId: decoded.userId });
      } catch (err) {
        console.warn("Invalid token in /api/vehicle/search");
      }
    }

    res.json({
      success: true,
      ...normalizedData
    });
  } catch (error) {
    console.error(`Vehicle search error (${req.body.searchType}):`, error);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error",
      message: error.message 
    });
  }
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "Server is running",
    auth: BASE64_AUTH ? "Auth configured" : "Auth missing"
  });
});

// Your other routes
app.use("/api/users", userRoutes);
app.use("/api/balance", balanceRoutes);
app.use("/api/payments", paymentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));