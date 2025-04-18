const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Balance = require('../models/balance');
exports.getUserRole = async (req, res) => {
  try {
    
    const token = req.headers['authorization']?.split(' ')[1]; 
    if (!token) {
      return res.status(401).json({ message: "Access denied, no token" });
    }
    console.log(token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    const user = await User.findById(decoded.userId).select('role');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send back the user's role
    res.json({ role: user.role });
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
  }
};
// Register User
exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, username, password: hashedPassword });

    await newUser.save();
    let balance = await Balance.findOne({ userId: newUser._id });
    if (!balance) {
      balance = new Balance({
        userId: newUser._id,
        balance: 0,  // Default balance is 0 if not found
      });

      await balance.save();  // Save the new balance document
    }
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Login User
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
exports.searchUsers = async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;  // Default to page 1 and limit 10

  try {
    // Fetch users by username or email
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    })
      .skip((page - 1) * limit)  // Pagination: skip previous pages
      .limit(parseInt(limit))    // Limit results per page
      .select('username email')  // Only select username and email fields from the User model

    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    // Get the total number of users matching the search query
    const totalUsers = await User.countDocuments({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    });

    // Fetch the balance for each user
    const usersWithBalance = await Promise.all(users.map(async user => {
      const balance = await Balance.findOne({ userId: user._id }).select('balance');
      return { ...user.toObject(), balance: balance ? balance.balance : 0 };
    }));

    res.json({
      users: usersWithBalance,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),  // Calculate total pages
      currentPage: parseInt(page),  // Return current page number
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};