const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "Email already registered" });
    }
    // Create a new user
    const user = new User({ email, password });
    await user.save();
    // Generate a token (valid for 1 day)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    // Generate a token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
