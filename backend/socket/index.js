const { Server } = require("socket.io");
const { authSocket } = require("../middleware/authMiddleware");
const setupSupportSocket = require("./supportSocket");
const setupCycleCountSocket = require("./cycleCountSocket");
const setupAiCustomerSocket = require("./aiCustomerSocket");

const debug = process.env.SOCKET_DEBUG === 'true';

function setupSocket(server) {
  const io = new Server(server, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    cors: {
      origin: ["https://app.gen7fuel.com", "http://localhost:5173", "https://desk.gen7fuel.com"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(authSocket);
  setupSupportSocket(io);

  io.on("connection", (socket) => {
    if (debug) console.log(`[socket] connected: ${socket.id}`);

    if (socket.user?._id) {
      socket.join(socket.user._id.toString());
    } else {
      console.warn(`[socket] connected (${socket.id}) but no user on socket object`);
    }

    socket.on("join-room", (userId) => {
      if (userId) socket.join(userId);
    });

    setupCycleCountSocket(io, socket);
    setupAiCustomerSocket(io, socket);

    if (debug) {
      socket.onAny((event) => {
        console.log(`[socket] event "${event}" from ${socket.id}`);
      });
    }

    socket.on("disconnect", (reason) => {
      if (debug) console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  io.engine.on("connection_error", (err) => {
    console.error("[socket] connection error:", err.message);
  });

  return io;
}

module.exports = setupSocket;
