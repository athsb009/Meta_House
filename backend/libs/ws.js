

const ws = (io)=>{
    io.on('connection', (socket) => {
        console.log(`✅ Client connected: ${socket.id}`);
    
        socket.on('message', (data) => {
            console.log(`📩 Message received: ${data}`);
            socket.emit('response', `Server received: ${data}`);
        });
    
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });
}

export default ws;