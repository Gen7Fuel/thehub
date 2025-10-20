const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  path: "/signaling/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.get('/signaling/health', (_, res) => res.send('OK'));
app.get('/signaling', (req, res) => res.send('Signaling Server is running!'));

io.on('connection', (socket) => {
  console.log('\n🔌 User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`✅ User ${socket.id} joined room "${roomId}"`);
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    console.log(`   Users in "${roomId}":`, usersInRoom);
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('offer', (data) => {
    console.log(`\n📞 OFFER EVENT`);
    console.log(`   Sender: ${socket.id}`);
    console.log(`   Target room: "${data.target}"`);
    
    const room = io.sockets.adapter.rooms.get(data.target);
    if (room) {
      const usersInRoom = Array.from(room);
      console.log(`   ✅ Room exists with ${room.size} users:`, usersInRoom);
      socket.to(data.target).emit('offer', {
        offer: data.offer,
        sender: socket.id
      });
      console.log(`   ✅ Offer forwarded!`);
    } else {
      console.log(`   ❌ Room "${data.target}" NOT FOUND!`);
      console.log(`   Available rooms:`, Array.from(io.sockets.adapter.rooms.keys()));
    }
  });

  socket.on('answer', (data) => {
    console.log(`\n📥 ANSWER EVENT`);
    console.log(`   Sender: ${socket.id}`);
    console.log(`   Target socket: "${data.target}"`);
    
    // Send directly to socket ID
    io.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
    console.log(`   ✅ Answer sent to socket!`);
  });

  socket.on('ice-candidate', (data) => {
    console.log(`🧊 ICE from ${socket.id} to "${data.target}"`);
    io.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Add this event handler in server.js
  socket.on('call-rejected', (data) => {
    console.log(`❌ Call rejected, notifying ${data.target}`);
    io.to(data.target).emit('call-rejected');
  });

  socket.on('call-ended', (data) => {
    console.log(`\n📞 CALL ENDED EVENT`);
    console.log(`   Sender: ${socket.id}`);
    console.log(`   Target: "${data.target}"`);
    
    // Try to send to room (for caller ending) or socket ID (for receiver ending)
    socket.to(data.target).emit('call-ended');
    io.to(data.target).emit('call-ended');
    
    console.log(`   ✅ Call-ended event sent to ${data.target}`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-disconnected', socket.id);
    console.log(`👋 User ${socket.id} left room "${roomId}"`);
  });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server running on port ${PORT}`);
});