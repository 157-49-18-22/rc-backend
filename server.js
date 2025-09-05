const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");

const balanceRoutes = require("./routes/balanceRoutes");
const cors = require("cors");
dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(express.json());
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const DIGITAP_API_URL = "https://svc.digitap.ai/validation/kyc/v1/rc";

// Normalize response to match your React UI expectations
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
app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend is running fine!" });
});
app.post('/api/vehicle', async (req, res) => {
  const { carNumber } = req.body;

  if (!carNumber) {
    return res.status(400).json({ error: "carNumber is required" });
  }

  const credentials = `${CLIENT_ID}:${CLIENT_SECRET}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');

  const requestBody = {
    client_ref_num: `req_${Date.now()}`,
    reg_no: carNumber.toUpperCase(),
  };

  try {
    const response = await fetch(DIGITAP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedCredentials}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Digitap API Error:", text);
      return res.status(response.status).json({ error: `Digitap API Error: ${response.statusText}` });
    }

    const data = await response.json();

    if (data.result_code !== 101) {
      return res.status(400).json({
        error: `API Error: ${data.result_code} - ${data.message || 'Check vehicle number'}`
      });
    }

    const normalizedData = normalizeApiResponse(data.result);
    res.json(normalizedData);

  } catch (error) {
    console.error("Backend Proxy Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.use("/api/users", userRoutes);
app.use("/api/balance", balanceRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
