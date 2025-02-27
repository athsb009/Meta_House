const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Look for the Authorization header
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    // Extract the token from the header (assuming the format is "Bearer <token>")
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token missing from header' });
    }

    // Verify the token using the secret key from your environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    // Find the user by the id provided in the token payload, excluding the password field
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach the user object to the request so that it can be used in subsequent handlers
    req.user = user;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
