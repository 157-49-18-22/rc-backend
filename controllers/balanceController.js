const Balance = require('../models/balance');
const User = require('../models/user');

// Admin Allocate Balance
exports.allocateBalance = async (req, res) => {
  const { userId, amount } = req.body;

  // Debugging logs
  console.log("Received userId:", userId);
  console.log("Received amount:", amount);

  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found with userId:", userId);  // Log if user is not found
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if balance exists for the user
    let balance = await Balance.findOne({ userId });
    if (!balance) {
      console.log("No balance found, creating a new one for userId:", userId);  // Log if no balance found
      balance = new Balance({ userId, balance: 0 });
    }

    // Allocate balance
    const amountToAllocate = Number(amount);
    if (isNaN(amountToAllocate)) {
      console.error("Invalid amount:", amount);  // Log if the amount is invalid
      return res.status(400).json({ message: 'Invalid amount' });
    }

    balance.balance = amountToAllocate;  // Update the balance
    await balance.save();  // Save the balance

    console.log("Updated balance:", balance.balance);  // Log the updated balance
    res.json({ message: 'Balance allocated successfully', balance: balance.balance });

  } catch (err) {
    console.error("Error in allocating balance:", err);  // Log the error if something goes wrong
    res.status(500).json({ message: 'Server error' });
  }
};

// In your backend controller

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

    // Add the amount to the existing balance
    balance.balance += amountToAdd;
    await balance.save();

    res.json({ message: 'Balance added successfully', balance: balance.balance });
  } catch (err) {
    console.error("Error in adding balance:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// User Deduct Balance (for purchase)
exports.deductBalance = async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const balance = await Balance.findOne({ userId });
    if (!balance) {
      return res.status(400).json({ message: 'Balance not found' });
    }

    if (balance.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    balance.balance -= amount;
    await balance.save();
    res.json({ message: 'Purchase successful', remainingBalance: balance.balance });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
// Get User Balance
exports.getBalance = async (req, res) => {
  try {
    // Find the balance of the logged-in user
    let balance = await Balance.findOne({ userId: req.userId });

    // If no balance is found, create a balance with 0
    if (!balance) {
      balance = new Balance({
        userId: req.userId,
        balance: 0,  // Default balance is 0 if not found
      });

      await balance.save();  // Save the new balance document
    }

    // Return the balance (either found or newly created)
    res.json({ balance: balance.balance });
  } catch (err) {
    console.error('Error in getBalance:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
