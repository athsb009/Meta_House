const gameRooms = new Map();

// Simple sanitization function to escape HTML tags
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

module.exports = (socket, gameNamespace) => {
  console.log(`New socket connected: ${socket.id}`);

  // Handle user joining a game
  socket.on('joinGame', (data, callback) => {
    try {
      const { roomId, username } = data;

      // Input validation
      if (!roomId || typeof roomId !== 'string') {
        return callback?.({ error: 'Invalid room ID' });
      }
      if (!username || typeof username !== 'string') {
        return callback?.({ error: 'Invalid username' });
      }

      // Sanitize username
      const sanitizedUsername = sanitizeText(username);

      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = sanitizedUsername;

      // Initialize room if it doesn't exist
      if (!gameRooms.has(roomId)) {
        gameRooms.set(roomId, { players: {} });
        console.log(`Created new room: ${roomId}`);
      }
      const room = gameRooms.get(roomId);

      // Check for duplicate username in this room
      const existingUsernames = Object.values(room.players).map(p => p.username);
      if (existingUsernames.includes(sanitizedUsername)) {
        return callback?.({ error: 'Username already taken' });
      }

      // Set initial position
      const initialX = 100;
      const initialY = 100;
      room.players[socket.id] = { x: initialX, y: initialY, username: sanitizedUsername };

      console.log(`User ${sanitizedUsername} joined room ${roomId} with socket ID ${socket.id}`);

      // Notify others in the room about the new user
      socket.to(roomId).emit('userConnected', {
        id: socket.id,
        x: initialX,
        y: initialY,
        username: sanitizedUsername,
      });

      const numPlayers = Object.keys(room.players).length;
      gameNamespace.in(roomId).emit('roomInfo', { numPlayers });

      // Return existing players to the new client
      return callback?.({
        success: true,
        existingPlayers: room.players,
      });
    } catch (err) {
      console.error('Error in joinGame:', err);
      return callback?.({ error: 'An error occurred while joining the game.' });
    }
  });

  // Handle player movement updates
  socket.on('move', (data) => {
    try {
      const roomId = socket.roomId;
      if (!roomId || !gameRooms.has(roomId)) return;
  
      // Validate movement data
      if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
  
      // Optionally validate or default the direction property
      const direction = typeof data.direction === 'string' ? data.direction : 'down';
  
      const room = gameRooms.get(roomId);
      // Update player position and direction in room's state
      room.players[socket.id] = { ...data, username: socket.username, direction };
  
      // Emit movement to all other players in the room, now including direction
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        username: socket.username,
        direction, // forward the direction so clients can update their sprite
      });
    } catch (err) {
      console.error('Error in move event:', err);
    }
  });
  
  // Function to handle a user leaving the game/room
  const handleLeave = () => {
    try {
      const roomId = socket.roomId;
      if (!roomId || !gameRooms.has(roomId)) return;
  
      const room = gameRooms.get(roomId);
      delete room.players[socket.id];
      socket.leave(roomId);
  
      const numPlayers = Object.keys(room.players).length;
      if (numPlayers === 0) {
        gameRooms.delete(roomId);
        console.log(`Room ${roomId} deleted because it became empty.`);
      } else {
        socket.to(roomId).emit('userDisconnected', socket.id);
        console.log(`User ${socket.username} (socket ${socket.id}) disconnected from room ${roomId}.`);
        gameNamespace.in(roomId).emit('roomInfo', { numPlayers });
        console.log(`Room ${roomId} now has ${numPlayers} players.`);
      }
    } catch (err) {
      console.error('Error handling leave:', err);
    }
  };
  
  socket.on('leaveGame', handleLeave);
  socket.on('disconnect', handleLeave);
};
