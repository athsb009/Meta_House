// webrtc.js
const mediasoup = require('mediasoup');

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

// Global map for rooms
// Each room: { router, producers: Map<peerId, Producer[]> }
const rooms = new Map();

// Configure your transport options
const webRtcTransportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      // In production, set this to your public IP or domain:
      // e.g. announcedIp: '123.45.67.89'
      announcedIp: '127.0.0.1', // For local dev only
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

      // Create a new room with a Mediasoup router if it doesn't exist
      if (!rooms.has(roomId)) {
        try {
          const router = await worker.createRouter({ mediaCodecs });
          // CHANGED: Store producers as a Map of arrays
          rooms.set(roomId, {
            router,
            producers: new Map(), // Map<peerId, Producer[]>
          });
          console.log(`Created new room ${roomId} with router ${router.id}`);
        } catch (error) {
          console.error('Error creating router:', error);
          return callback({ error: error.message });
        }
      }

      const room = rooms.get(roomId);

      // Collect all existing producers in the room across all peers
      // CHANGED: we loop over the map of arrays, not single producers
      const existingProducers = [];
      for (const [peerId, producersArray] of room.producers.entries()) {
        if (peerId === socket.id) {
          continue;
        }
        for (const prod of producersArray) {
          existingProducers.push({ producerId: prod.id, peerId });
        }
      }

      callback({ existingProducers });
    });

    // ---------------------------
    // GET RTP CAPABILITIES
    // ---------------------------
    socket.on('getRtpCapabilities', (callback) => {
      const room = rooms.get(socket.roomId);
      if (!room) {
        return callback({ error: 'Room not found' });
      }
      callback({ rtpCapabilities: room.router.rtpCapabilities });
    });

    // ---------------------------
    // CREATE WEBRTC TRANSPORT
    // ---------------------------
    socket.on('createWebRtcTransport', async ({ sender }, callback) => {
      const room = rooms.get(socket.roomId);
      if (!room) {
        return callback({ params: { error: 'Room not found' } });
      }
      try {
        const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
        console.log(`Created transport ${transport.id} for socket ${socket.id}`);

        if (sender) {
          // Single send transport per peer. This can produce multiple tracks.
          socket.producerTransport = transport;
        } else {
          // Single receive transport per peer. This can consume multiple tracks.
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
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        // CHANGED: We can store multiple producers per peer
        if (!room.producers.has(socket.id)) {
          room.producers.set(socket.id, []);
        }
        const peerProducers = room.producers.get(socket.id);
        peerProducers.push(producer);

        // Notify all peers in the room about the new Producer
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
      if (!room) {
        return callback({ params: { error: 'Room not found' } });
      }
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

        // Store each consumer in a map on the socket
        if (!socket.consumers) {
          socket.consumers = new Map();
        }
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

      // Flatten all producers from all peers
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

      // 1) Close and remove any producer(s) from this peer
      if (room.producers.has(socket.id)) {
        const producersArray = room.producers.get(socket.id);
        producersArray.forEach((producer) => {
          producer.close();
          socket.to(roomId).emit('producerClosed', { producerId: producer.id });
        });
        room.producers.delete(socket.id);
      }

      // 2) Close all consumers belonging to this peer
      if (socket.consumers) {
        for (const [, consumer] of socket.consumers.entries()) {
          consumer.close();
        }
        socket.consumers.clear();
      }

      // 3) Close transports
      if (socket.producerTransport) {
        socket.producerTransport.close();
        socket.producerTransport = null;
      }
      if (socket.consumerTransport) {
        socket.consumerTransport.close();
        socket.consumerTransport = null;
      }

      // 4) Notify peers that this peer has disconnected
      socket.to(roomId).emit('peerDisconnected', { peerId: socket.id });

      // 5) If the room is now empty, close router & remove it
      if (room.producers.size === 0) {
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

      // Notify peers that this peer has disconnected
      socket.to(roomId).emit('peerDisconnected', { peerId: socket.id });

      // Actually leave the socket.io room
      socket.leave(roomId);
      socket.roomId = null;

      // If no other producers remain, remove the room completely
      if (room.producers.size === 0) {
        room.router.close();
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted as it is now empty.`);
      }
    });
  });
};

module.exports = { initWebRTC, rooms, webRtcTransportOptions };
