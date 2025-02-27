const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/users/getprofile - Retrieves the current user's profile
router.get('/profile',authMiddleware ,async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const user = await User.findById(userId);
    if (user) {
      return res.status(200).json({
        success: true,
        profile: { username: user.username, avatar: user.avatar },
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/users/setprofile - Updates the current user's profile
router.post('/profile', authMiddleware, async (req, res) => {
  const { username, avatar } = req.body;
  if (!username || !avatar) {
    return res
      .status(400)
      .json({ success: false, message: 'Username and avatar are required.' });
  }
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    // Check if the username is already taken by another user
    const existingUser = await User.findOne({ username });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res
        .status(409)
        .json({ success: false, message: 'Username already taken.' });
    }
    // Update the user's profile
    const user = await User.findByIdAndUpdate(
      userId,
      { username, avatar },
      { new: true }
    );
    if (user) {
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
