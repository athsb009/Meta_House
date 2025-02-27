const express = require('express');
const router = express.Router();
const Room = require('../models/Rooms');
const authMiddleware = require('../middleware/authMiddleware');

// Create a new room (requires authentication)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    // Generate a random room ID
    const roomId = Math.random().toString(36).substring(2, 8);
    // Use req.user._id from the auth middleware to track who created the room
    const room = new Room({ roomId, createdBy: req.user._id });
    await room.save();
    res.json({ roomId: room.roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a list of rooms created by the logged-in user
router.get('/my-rooms', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find({ createdBy: req.user._id });
    res.json({ rooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
//"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3YTMxYjI4NDQxZTUxYmRjMzJjN2FmMiIsImlhdCI6MTczODc0MjYwMiwiZXhwIjoxNzM4ODI5MDAyfQ.tOCNRUqeE0mwRf80tPXKniyYoytlAbCq54Q2F5osVIM"