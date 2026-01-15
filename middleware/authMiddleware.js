const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
  // Get the token from the Authorization header
  const token = req.headers['authorization']?.split(' ')[1];  // Assuming Bearer <token> format
  
  // If no token is provided, return a 401 error
  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    // Verify the token using JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by ID
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Add user object and user ID to the request
    req.user = user;  // Add full user object
    req.userId = user._id;  // Also add userId for compatibility
    
    next();  // Proceed to the next middleware or route handler
  } catch (err) {
    // Handle any errors during verification (invalid or expired token)
    console.error('Auth middleware error:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    return res.status(500).json({ message: 'Authentication failed' });
  }
};