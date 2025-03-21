require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');

// Import your routes
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const profileRoutes = require('./routes/profileRoute');
// Import the WebRTC component (Mediasoup signaling logic)
const { initWebRTC } = require('./socket/webrtc');
// Import game events handler (make sure it exports a function)
const gameEvents = require('./socket/game');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB using the connection string from .env
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err.message));

// Register API routes
app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);
app.use('/users', profileRoutes);

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.io on the server with CORS options (adjust for production)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Create separate namespaces for video and game events
const videoNamespace = io.of('/video');
const gameNamespace = io.of('/game');
const chatNamespace = io.of('/chat');
// ----- Mediasoup Worker & Global Variables -----
let worker;
(async () => {
  try {
    // Create a Mediasoup Worker with a specified RTC port range
    worker = await mediasoup.createWorker({
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });
    console.log(`Mediasoup Worker PID: ${worker.pid}`);
  
    // Listen for the worker 'died' event to handle fatal errors
    worker.on('died', (error) => {
      console.error('Mediasoup Worker has died:', error);
      setTimeout(() => process.exit(1), 2000);
    });

    // Initialize the WebRTC signaling logic on our Socket.io video namespace.
    // The initWebRTC function attaches all necessary events (e.g., joinRoom, createWebRtcTransport, transport-produce, etc.)
    // for video calls.
    initWebRTC(videoNamespace, worker);
  } catch (error) {
    console.error('Error creating mediasoup worker:', error);
  }
})();

// Initialize game events on the /game namespace.
gameNamespace.on('connection', (socket) => {
  console.log(`Game client connected: ${socket.id}`);
  gameEvents(socket, gameNamespace);
});
const onlineUsers = {};
chatNamespace.on('connection', (socket) => {
  console.log(`Chat client connected: ${socket.id}`);

  // Handle joining any chat room (global or private)
  socket.on('joinChat', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    // Save username in a normalized form (trimmed and lowercased)
    onlineUsers[username.trim().toLowerCase()] = socket.id;
    console.log(`${username} joined chat room ${roomId}`);
  });

  // When a sender initiates a private chat
  socket.on('initiatePrivateChat', ({ senderUsername, receiverUsername, roomId }) => {
    console.log(`Private chat initiated by ${senderUsername} for ${receiverUsername} in room ${roomId}`);
    const normalizedReceiver = receiverUsername.trim().toLowerCase();
    const receiverSocketId = onlineUsers[normalizedReceiver];
    if (receiverSocketId) {
      // Forward the private chat invitation to the receiver
      chatNamespace.to(receiverSocketId).emit('privateChatInvitation', {
        roomId,
        senderUsername,
      });
    } else {
      // Optionally notify the sender that the receiver is offline
      socket.emit('privateChatError', { message: 'Receiver not online' });
    }
  });

  // Regular chat message handler
  socket.on('chatMessage', ({ roomId, message }) => {
    console.log(`Message in room ${roomId} from ${socket.username}: ${message.text}`);
    socket.to(roomId).emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    console.log(`Chat client disconnected: ${socket.id}`);
    if (socket.username) {
      delete onlineUsers[socket.username.trim().toLowerCase()];
    }
  });
});


// Start the HTTP server.
server.listen(3001, () => {
  console.log('Server listening on port 3001');
});
