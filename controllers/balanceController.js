const Balance = require('../models/balance');
const User = require('../models/user');
exports.deductBalance = async (req, res) => {
  try {
    const user = req.user; // Get user from authMiddleware
    const { amount, service = "vehicle_search" } = req.body; // userId not needed from body
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }

    const balance = await Balance.findOne({ userId: user._id });
    if (!balance) {
      return res.status(400).json({ 
        success: false,
        message: 'Balance not found' 
      });
    }

    // If amount is not provided, use default based on service
    let deductionAmount = amount;
    if (!deductionAmount && service.includes("rc")) {
      deductionAmount = 5; // Default RC cost
    } else if (!deductionAmount && service.includes("chassis")) {
      deductionAmount = 10; // Default chassis cost
    }

    if (balance.balance < deductionAmount) {
      return res.status(400).json({ 
        success: false,
        message: 'Insufficient balance' 
      });
    }

    balance.balance -= deductionAmount;
    await balance.save();
    
    // Log the transaction
    console.log(`Deducted ₹${deductionAmount} from user ${user._id} for ${service}`);
    
    res.json({ 
      success: true,
      message: 'Purchase successful', 
      remainingBalance: balance.balance,
      amountDeducted: deductionAmount,
      service: service
    });
  } catch (err) {
    console.error('Deduct balance error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Get User Balance - UPDATED
exports.getBalance = async (req, res) => {
  try {
    const user = req.user; // Get user from authMiddleware
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }

    let balance = await Balance.findOne({ userId: user._id });

    if (!balance) {
      balance = new Balance({
        userId: user._id,
        balance: 0,
      });
      await balance.save();
    }

    res.json({ 
      success: true,
      balance: balance.balance,
      rcCost: 5,
      chassisCost: 10
    });
  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Admin Allocate Balance
exports.allocateBalance = async (req, res) => {
  const { userId, amount } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    let balance = await Balance.findOne({ userId });
    if (!balance) {
      balance = new Balance({ userId, balance: 0 });
    }

    const amountToAllocate = Number(amount);
    if (isNaN(amountToAllocate)) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    balance.balance = amountToAllocate;
    await balance.save();

    res.json({ 
      message: 'Balance allocated successfully', 
      balance: balance.balance 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Add Balance
exports.addBalance = async (req, res) => {
  const { userId, amount } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    let balance = await Balance.findOne({ userId });
    if (!balance) {
      balance = new Balance({ userId, balance: 0 });
    }

    const amountToAdd = Number(amount);
    if (isNaN(amountToAdd)) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    balance.balance += amountToAdd;
    await balance.save();

    res.json({ 
      message: 'Balance added successfully', 
      balance: balance.balance 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

