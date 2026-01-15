const axios = require('axios');
const crypto = require('crypto');
const Balance = require('../models/balance');
const Transaction = require('../models/transaction');
const User = require('../models/user');

// Create payment order - UPDATED for TEST mode
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ 
        success: false,
        message: 'Minimum amount is ₹1' 
      });
    }

    // Get user from request
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare order data for Cashfree
    const orderData = {
      order_id: orderId,
      order_amount: amount.toString(), // Ensure string format
      order_currency: 'INR',
      customer_details: {
        customer_id: user._id.toString(),
        customer_email: user.email || `${user.mobileNo}@vehicleinfo.com`,
        customer_phone: user.mobileNo || '9999999999',
        customer_name: `${user.firstname} ${user.lastname}` || 'Customer'
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-success?order_id=${orderId}&user_id=${user._id}`,
        notify_url: process.env.CASHFREE_WEBHOOK_URL,
      },
      order_note: 'Vehicle RC Search Balance Top-up'
    };

    console.log('🔵 Creating Cashfree order:', {
      orderId,
      amount,
      userId: user._id,
      email: user.email || `${user.mobileNo}@vehicleinfo.com`,
      apiUrl: process.env.CASHFREE_API_URL,
      mode: process.env.CASHFREE_MODE
    });

    // Make API call to Cashfree
    const response = await axios.post(
      `${process.env.CASHFREE_API_URL}/orders`,
      orderData,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'x-api-version': '2022-09-01',
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      }
    );

    console.log('🟢 Cashfree API Response:', {
      status: response.status,
      data: response.data
    });

    // Check if payment_session_id exists
    if (!response.data || !response.data.payment_session_id) {
      console.error('❌ No payment_session_id in response:', response.data);
      return res.status(500).json({
        success: false,
        message: 'Cashfree did not return payment session ID',
        cashfreeResponse: response.data
      });
    }

    // Save transaction record
    const transaction = new Transaction({
      userId: user._id,
      orderId,
      amount: parseFloat(amount),
      status: 'PENDING',
      paymentSessionId: response.data.payment_session_id,
      createdAt: new Date()
    });

    await transaction.save();

    console.log('✅ Order created successfully:', {
      orderId,
      paymentSessionId: response.data.payment_session_id.substring(0, 20) + '...'
    });

    // Return success response
    res.json({
      success: true,
      orderId,
      paymentSessionId: response.data.payment_session_id,
      orderAmount: amount,
      status: 'PENDING',
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('❌ Cashfree API Error:', {
      message: error.message,
      responseData: error.response?.data,
      responseStatus: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? 'Headers present' : 'No headers',
        data: error.config?.data
      }
    });
    
    let errorMessage = 'Error creating order';
    let statusCode = 500;
    
    if (error.response) {
      // Cashfree returned an error
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || `Cashfree API Error: ${error.response.status}`;
    } else if (error.request) {
      // No response received
      errorMessage = 'No response from Cashfree API. Check your internet connection.';
    }
    
    res.status(statusCode).json({ 
      success: false,
      message: errorMessage,
      error: error.response?.data || error.message
    });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ 
        success: false,
        message: 'Order ID is required' 
      });
    }

    const user = req.user;
    
    console.log('🔵 Verifying payment for order:', orderId);

    const response = await axios.get(
      `${process.env.CASHFREE_API_URL}/orders/${orderId}`,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'x-api-version': '2022-09-01',
        }
      }
    );

    const orderData = response.data;
    console.log('🟢 Payment verification response:', orderData);
    
    if (orderData.order_status === 'PAID') {
      // Find transaction
      const transaction = await Transaction.findOne({ orderId, userId: user._id });
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      if (transaction.status === 'PENDING') {
        // Update transaction status
        transaction.status = 'SUCCESS';
        transaction.paidAt = new Date();
        await transaction.save();

        // Update user balance
        let balance = await Balance.findOne({ userId: user._id });
        if (!balance) {
          balance = new Balance({ userId: user._id, balance: 0 });
        }
        
        balance.balance += transaction.amount;
        await balance.save();

        console.log('✅ Payment verified and balance updated:', {
          userId: user._id,
          amount: transaction.amount,
          newBalance: balance.balance
        });

        res.json({
          success: true,
          message: 'Payment verified successfully',
          orderId,
          amount: transaction.amount,
          newBalance: balance.balance
        });
      } else {
        res.json({
          success: true,
          message: 'Payment already processed',
          orderId
        });
      }
    } else {
      res.json({
        success: false,
        message: 'Payment not completed',
        orderStatus: orderData.order_status
      });
    }

  } catch (error) {
    console.error('❌ Verification Error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Error verifying payment',
      error: error.response?.data?.message || error.message
    });
  }
};

// Test endpoint to check Cashfree connectivity
exports.testConnection = async (req, res) => {
  try {
    console.log('🔵 Testing Cashfree connection...');
    console.log('Environment:', {
      CASHFREE_APP_ID: process.env.CASHFREE_APP_ID ? 'Set' : 'Not set',
      CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY ? 'Set' : 'Not set',
      CASHFREE_API_URL: process.env.CASHFREE_API_URL,
      CASHFREE_MODE: process.env.CASHFREE_MODE
    });

    // Make a simple GET request to check connectivity
    const response = await axios.get(
      `${process.env.CASHFREE_API_URL}/orders`,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'x-api-version': '2022-09-01',
        },
        params: {
          limit: 1
        }
      }
    );

    console.log('🟢 Cashfree connection successful:', {
      status: response.status,
      data: response.data
    });

    res.json({
      success: true,
      message: 'Cashfree connection successful',
      environment: process.env.CASHFREE_MODE,
      apiUrl: process.env.CASHFREE_API_URL
    });

  } catch (error) {
    console.error('❌ Cashfree connection test failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    res.status(500).json({
      success: false,
      message: 'Cashfree connection test failed',
      error: error.response?.data || error.message,
      environment: process.env.CASHFREE_MODE,
      apiUrl: process.env.CASHFREE_API_URL
    });
  }
};

// Get user transactions
exports.getTransactions = async (req, res) => {
  try {
    const user = req.user;
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching transactions'
    });
  }
};

// Webhook handler
exports.webhookHandler = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const body = req.body;

    console.log('🔵 Webhook received:', {
      event: body.event,
      orderId: body.data?.order?.order_id,
      signature: signature ? 'Present' : 'Missing',
      timestamp: timestamp ? 'Present' : 'Missing'
    });

    // Verify webhook signature
    const message = timestamp + JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
      .update(message)
      .digest('base64');

    if (signature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = body.event;
    const orderId = body.data.order.order_id;

    console.log('🟢 Processing webhook:', { event, orderId });

    if (event === 'ORDER.PAYMENT.CAPTURED') {
      const transaction = await Transaction.findOne({ orderId });
      
      if (transaction && transaction.status === 'PENDING') {
        transaction.status = 'SUCCESS';
        transaction.paidAt = new Date();
        await transaction.save();

        // Update user balance
        let balance = await Balance.findOne({ userId: transaction.userId });
        if (!balance) {
          balance = new Balance({ userId: transaction.userId, balance: 0 });
        }
        
        balance.balance += transaction.amount;
        await balance.save();

        console.log(`✅ Webhook: Balance updated for user ${transaction.userId}, added ₹${transaction.amount}`);
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};