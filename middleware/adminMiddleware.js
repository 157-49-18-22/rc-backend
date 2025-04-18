const User = require('../models/user');

module.exports = async (req, res, next) => {
  try {
    console.log('User ID from token:', req.userId);  // Log the user ID from the JWT token

    if (!req.userId) {
      return res.status(403).json({ message: 'No user ID in token' });
    }

    // Find the user by ID
    const user = await User.findById(req.userId);
    if (!user) {
      console.error('User not found:', req.userId);  // Log if user is not found
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'admin') {
      console.error('Access denied for user:', user.username);  // Log if user is not admin
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    next();  // Proceed if the user is an admin
  } catch (err) {
    console.error('Error in adminMiddleware:', err);  // Log any errors in this middleware
    return res.status(500).json({ message: 'Server error' });
  }
};
