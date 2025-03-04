// room.js
class Room {
    constructor(roomId, router) {
      this.roomId = roomId;
      this.router = router;
      this.peers = new Map();    // Map of peerId to user info
      this.producers = new Map(); // Map of peerId to array of Producer objects
    }
  
    addPeer(peerId, userInfo = {}) {
      this.peers.set(peerId, userInfo);
    }
  
    removePeer(peerId) {
      this.peers.delete(peerId);
      this.producers.delete(peerId);
    }
  
    addProducer(peerId, producer) {
      if (!this.producers.has(peerId)) {
        this.producers.set(peerId, []);
      }
      this.producers.get(peerId).push(producer);
    }
  
    isEmpty() {
      return this.peers.size === 0;
    }
  }
  
  module.exports = Room;
  