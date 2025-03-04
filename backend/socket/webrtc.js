// webrtc.js
const mediasoup = require('mediasoup');
const Room = require('../components/room');

// These are your Mediasoup router's media codecs
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

// Global map for rooms (keyed by roomId)
const rooms = new Map();
// Global map for shared room IDs keyed by sessionId.
// This ensures that for a given session, only one shared roomId is used.
const sharedRooms = new Map();
const sessions = new Map();

// Configure your transport options
const webRtcTransportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      // For production, set this to your public IP/domain
      announcedIp: '127.0.0.1', // Local development only
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

const initWebRTC = (io, worker) => {
  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // ---------------------------
    // JOIN ROOM
    // ---------------------------
    socket.on('joinRoom', async ({ roomId }, callback) => {
      if (!worker) {
        return callback({ error: 'Mediasoup worker not initialized' });
      }
      socket.join(roomId);
      socket.roomId = roomId;
      console.log(`Socket ${socket.id} joined room ${roomId}`);
      socket.to(roomId).emit('peerJoined', { peerId: socket.id });

      // Create room if it doesn't exist
      if (!rooms.has(roomId)) {
        try {
          const router = await worker.createRouter({ mediaCodecs });
          rooms.set(roomId, new Room(roomId, router));
          console.log(`Created new room ${roomId} with router ${router.id}`);
        } catch (error) {
          console.error('Error creating router:', error);
          return callback({ error: error.message });
        }
      }
      const room = rooms.get(roomId);
      room.addPeer(socket.id, {}); // Optionally, add user info here

      // Gather all existing producers from peers in this room
      const existingProducers = [];
      for (const [peerId, producersArray] of room.producers.entries()) {
        if (peerId === socket.id) continue;
        for (const prod of producersArray) {
          existingProducers.push({ producerId: prod.id, peerId });
        }
      }
      callback({ existingProducers });
    });

    // ---------------------------
    // ROOM-ID-UPDATE: Coordinate shared room ID
    // ---------------------------
    socket.on('requestSessionId', ({ peerId }, callback) => {
      const sessionId = uuidv4();
      sessions.set(sessionId, { peers: [socket.id, peerId] });
      
      // Notify both peers about the new session
      io.to(socket.id).emit('newSession', { sessionId, peerId });
      io.to(peerId).emit('newSession', { sessionId, peerId: socket.id });
      
      callback({ sessionId });
    });
  
    // Modified room-id-update handler
    socket.on('room-id-update', async ({ sessionId, newRoomId }) => {
      const session = sessions.get(sessionId);
      if (!session) return;
  
      // Move all peers in session to new room
      session.peers.forEach(peerId => {
        const peerSocket = io.sockets.sockets.get(peerId);
        if (!peerSocket) return;
  
        // Leave current room and join new
        peerSocket.leave(peerSocket.roomId);
        peerSocket.join(newRoomId);
        peerSocket.roomId = newRoomId;
  
        // Update client-side state
        io.to(peerId).emit('room-id-update', { 
          sessionId, 
          roomId: newRoomId 
        });
      });
  
      // Update session room mapping
      sessions.set(sessionId, { ...session, roomId: newRoomId });
    });
    

    // ---------------------------
    // GET RTP CAPABILITIES
    // ---------------------------
    socket.on('getRtpCapabilities', (callback) => {
      const room = rooms.get(socket.roomId);
      if (!room) return callback({ error: 'Room not found' });
      callback({ rtpCapabilities: room.router.rtpCapabilities });
    });

    // ---------------------------
    // CREATE WEBRTC TRANSPORT
    // ---------------------------
    socket.on('createWebRtcTransport', async ({ sender }, callback) => {
      const room = rooms.get(socket.roomId);
      if (!room) return callback({ params: { error: 'Room not found' } });
      try {
        const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
        console.log(`Created transport ${transport.id} for socket ${socket.id}`);

        if (sender) {
          socket.producerTransport = transport;
        } else {
          socket.consumerTransport = transport;
        }

        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });
      } catch (error) {
        console.error('Error creating transport:', error);
        callback({ params: { error: error.message } });
      }
    });

    // ---------------------------
    // CONNECT TRANSPORT (Producer)
    // ---------------------------
    socket.on('transport-connect', async ({ dtlsParameters }) => {
      try {
        await socket.producerTransport.connect({ dtlsParameters });
      } catch (error) {
        console.error('Error connecting producer transport:', error);
      }
    });

    // ---------------------------
    // TRANSPORT PRODUCE (Create a Producer)
    // ---------------------------
    socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
      try {
        const producer = await socket.producerTransport.produce({ kind, rtpParameters });
        console.log(`Producer ${producer.id} created for socket ${socket.id}`);
        const room = rooms.get(socket.roomId);
        if (!room) return callback({ error: 'Room not found' });

        // Store the producer for this peer
        room.addProducer(socket.id, producer);

        // Notify other peers in the room
        socket.to(socket.roomId).emit('newProducer', {
          producerId: producer.id,
          peerId: socket.id,
        });
        callback({ id: producer.id });
      } catch (error) {
        console.error('Error in transport-produce:', error);
        callback({ error: error.message });
      }
    });

    // ---------------------------
    // CONNECT TRANSPORT (Consumer)
    // ---------------------------
    socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
      try {
        await socket.consumerTransport.connect({ dtlsParameters });
      } catch (error) {
        console.error('Error connecting consumer transport:', error);
      }
    });

    // ---------------------------
    // CONSUME (Create a Consumer)
    // ---------------------------
    socket.on('consume', async ({ rtpCapabilities, producerId }, callback) => {
      const room = rooms.get(socket.roomId);
      if (!room) return callback({ params: { error: 'Room not found' } });
      try {
        if (!socket.consumerTransport) {
          throw new Error('Consumer transport not created. Please create it before consuming.');
        }
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error('Cannot consume');
        }
        const consumer = await socket.consumerTransport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });
        consumer.on('transportclose', () => console.log('Consumer transport closed'));
        consumer.on('producerclose', () => console.log('Producer for consumer closed'));

        if (!socket.consumers) socket.consumers = new Map();
        socket.consumers.set(consumer.id, consumer);

        callback({
          params: {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          },
        });
      } catch (error) {
        console.error('Error in consume:', error);
        callback({ params: { error: error.message } });
      }
    });

    // ---------------------------
    // CONSUMER RESUME
    // ---------------------------
    socket.on('consumer-resume', async ({ consumerId }, callback) => {
      if (socket.consumers && socket.consumers.has(consumerId)) {
        const consumer = socket.consumers.get(consumerId);
        try {
          await consumer.resume();
          console.log(`Consumer ${consumerId} resumed for socket ${socket.id}`);
          callback({ resumed: true });
        } catch (error) {
          console.error(`Error resuming consumer ${consumerId}:`, error);
          callback({ error: error.message });
        }
      } else {
        console.error(`Consumer ${consumerId} not found for socket ${socket.id}`);
        callback({ error: 'Consumer not found' });
      }
    });

    // ---------------------------
    // GET PRODUCERS (Optional)
    // ---------------------------
    socket.on('getProducers', (callback) => {
      const room = rooms.get(socket.roomId);
      if (!room) return callback({ error: 'Room not found' });
      const producers = [];
      for (const producersArray of room.producers.values()) {
        for (const prod of producersArray) {
          producers.push({ id: prod.id });
        }
      }
      callback({ producers });
    });

    // ---------------------------
    // DISCONNECT
    // ---------------------------
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      // Close and remove any producers from this peer
      if (room.producers.has(socket.id)) {
        const producersArray = room.producers.get(socket.id);
        producersArray.forEach((producer) => {
          producer.close();
          socket.to(roomId).emit('producerClosed', { producerId: producer.id });
        });
        room.producers.delete(socket.id);
      }

      // Close all consumers for this socket
      if (socket.consumers) {
        for (const [, consumer] of socket.consumers.entries()) {
          consumer.close();
        }
        socket.consumers.clear();
      }

      // Close transports
      if (socket.producerTransport) {
        socket.producerTransport.close();
        socket.producerTransport = null;
      }
      if (socket.consumerTransport) {
        socket.consumerTransport.close();
        socket.consumerTransport = null;
      }

      socket.to(roomId).emit('peerDisconnected', { peerId: socket.id });
      room.removePeer(socket.id);

      // If room is empty, close its router and delete the room
      if (room.isEmpty()) {
        room.router.close();
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted as it is now empty.`);
      }
    });

    // ---------------------------
    // LEAVE ROOM
    // ---------------------------
    socket.on('leaveRoom', () => {
      console.log(`Socket ${socket.id} is leaving its current room`);
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      // Close and remove all producers for this peer
      if (room.producers.has(socket.id)) {
        const producersArray = room.producers.get(socket.id);
        producersArray.forEach((producer) => {
          producer.close();
          socket.to(roomId).emit('producerClosed', { producerId: producer.id });
        });
        room.producers.delete(socket.id);
      }

      // Close all consumers
      if (socket.consumers) {
        for (const [, consumer] of socket.consumers.entries()) {
          consumer.close();
        }
        socket.consumers.clear();
      }

      // Close transports
      if (socket.producerTransport) {
        socket.producerTransport.close();
        socket.producerTransport = null;
      }
      if (socket.consumerTransport) {
        socket.consumerTransport.close();
        socket.consumerTransport = null;
      }

      socket.to(roomId).emit('peerDisconnected', { peerId: socket.id });
      socket.leave(roomId);
      socket.roomId = null;
      room.removePeer(socket.id);

      if (room.isEmpty()) {
        room.router.close();
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted as it is now empty.`);
      }
    });
  });
};

module.exports = { initWebRTC, rooms, webRtcTransportOptions };
