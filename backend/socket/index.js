const { Server } = require("socket.io");
const { authSocket } = require("../middleware/authMiddleware");
const setupSupportSocket = require("./supportSocket");
const setupCycleCountSocket = require("./cycleCountSocket");

function setupSocket(server) {
  const io = new Server(server, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    cors: {
      origin: ["https://app.gen7fuel.com", "http://localhost:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Optional startup logs
  console.log("🏗️ Socket.IO server created");
  console.log("🏗️ CORS origins:", ["https://app.gen7fuel.com", "http://localhost:5173"]);

  // Debugging and auth
  io.use((socket, next) => {
    console.log("🔐 Socket auth attempt:", {
      token: socket.handshake.auth?.token ? "present" : "missing",
      origin: socket.handshake.headers.origin,
    });
    next();
  });

  io.use(authSocket);

  // Register namespace/event modules
  setupSupportSocket(io);

  io.on("connection", (socket) => {
    console.log("✅ New connection:", socket.id);

    // 1. AUTOMATIC JOIN (The "Safety Net")
    // Since authSocket runs first, socket.user is already populated
    if (socket.user && socket.user._id) {
      const userId = socket.user._id.toString();
      socket.join(userId);
      console.log(`✅ Auto-joined room on connection: ${userId}`);
    } else {
      console.warn(`⚠️ Socket connected (${socket.id}) but no user found on socket object.`);
    }

    // 2. MANUAL JOIN (The "Backup")
    // without refreshing the whole socket connection.

    socket.on("join-room", (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`📦 ${socket.id} joined room: ${userId}`);
      }
    });

    // Register per-socket modules
    setupCycleCountSocket(io, socket);

    socket.onAny((event) => {
      console.log("📨 Received event:", event, "from socket:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", socket.id, reason);
    });
  });

  // Optional: engine + server-level error logs
  io.engine.on("connection_error", (err) => {
    console.error("🔥 Engine CONNECTION ERROR:", err.message);
  });

  io.on("connect_error", (error) => {
    console.error("🚨 SERVER connect_error:", error);
  });

  return io;
}

module.exports = setupSocket;
