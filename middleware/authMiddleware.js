const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get the token from the Authorization header
  const token = req.headers['authorization']?.split(' ')[1];  // Assuming Bearer <token> format
  
  // If no token is provided, return a 403 error
  if (!token) {
    return res.status(403).json({ message: 'Token required' });
  }

  try {
    // Verify the token using JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user ID from the decoded token to the request object for further use
    req.userId = decoded.userId;
    next();  // Proceed to the next middleware or route handler
  } catch (err) {
    // Handle any errors during verification (invalid or expired token)
    return res.status(403).json({ message: 'Invalid token' });
  }
};
