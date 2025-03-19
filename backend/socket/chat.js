// server/chat.js
module.exports = (socket, chatNamespace) => {
    console.log(`Chat socket connected: ${socket.id}`);
  
    socket.on("joinChat", ({ roomId, username }) => {
      socket.join(roomId);
      socket.username = username;
      console.log(`${username} joined chat room ${roomId}`);
    });
  
    socket.on("chatMessage", ({ roomId, message }) => {
      // Broadcast the message to everyone else in the room
      socket.to(roomId).emit("chatMessage", message);
    });
  
    socket.on("disconnect", () => {
      console.log(`Chat socket disconnected: ${socket.id}`);
    });
  };
  