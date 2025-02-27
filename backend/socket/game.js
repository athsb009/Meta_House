// game.js
const gameRooms = new Map();
module.exports = (socket, gameNamespace) => {
    
  
    socket.on('joinGame', (data, callback) => {
      const { roomId, username } = data;
  
      // Input validation
      if (!roomId || typeof roomId !== 'string') {
        return callback?.({ error: 'Invalid room ID' });
      }
      if (!username || typeof username !== 'string') {
        return callback?.({ error: 'Invalid username' });
      }
  
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;
  
      // Initialize room if it doesn't exist
      if (!gameRooms.has(roomId)) {
        gameRooms.set(roomId, { players: {} });
      }
      const room = gameRooms.get(roomId);
  
      // Check for duplicate username
      const existingUsernames = Object.values(room.players).map(p => p.username);
      if (existingUsernames.includes(username)) {
        return callback?.({ error: 'Username already taken' });
      }
  
      // Add player to room
      room.players[socket.id] = { x: 100, y: 100, username };
  
      // Notify others and reply with existing players
      socket.to(roomId).emit('userConnected', {
        id: socket.id,
        x: 100,
        y: 100,
        username,
      });
      const numPlayers = Object.keys(room.players).length;
      gameNamespace.in(roomId).emit('roomInfo', { numPlayers });
  
      callback?.({
        success: true,
        existingPlayers: room.players,
      });
    });
  
    socket.on('move', (data) => {
      const roomId = socket.roomId;
      if (!roomId || !gameRooms.has(roomId)) return;
  
      // Validate movement data
      if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
  
      const room = gameRooms.get(roomId);
      room.players[socket.id] = { ...data, username: socket.username };
  
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        username: socket.username,
      });
    });
  
    const handleLeave = () => {
      const roomId = socket.roomId;
      if (!roomId || !gameRooms.has(roomId)) return;
  
      const room = gameRooms.get(roomId);
      delete room.players[socket.id];
      socket.leave(roomId);
  
      // Delete room if empty
      const numPlayers = Object.keys(room.players).length;
      if (numPlayers === 0) {
        gameRooms.delete(roomId);
        console.log(`Room ${roomId} deleted`);
      } else {
        socket.to(roomId).emit('userDisconnected', socket.id);
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
        gameNamespace.in(roomId).emit('roomInfo', { numPlayers });
        console.log(`Room ${roomId} has ${numPlayers} players`);
      }
    };
  
    socket.on('leaveGame', handleLeave);
    socket.on('disconnect', handleLeave);
  };