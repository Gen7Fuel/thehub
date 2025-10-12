const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

// Route imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const locationRoutes = require("./routes/location");
const purchaseOrderRoutes = require("./routes/purchaseOrder");
const payablesRoutes = require("./routes/payablesRoute");
const shiftWorksheetRoutes = require("./routes/shiftWorksheetRoutes");
const cashSummaryRoutes = require("./routes/cashSummaryRoutes");
const payPointRoutes = require("./routes/payPointRoutes");
const kardpollTransactionsRoutes = require("./routes/kardpollTransactions");
const fleetRoutes = require("./routes/fleetRoutes");
const fleetCustomers = require("./routes/fleetCustomerRoutes");
const salesSummaryRoutes = require("./routes/salesSummaryRoutes");
const statusSalesRoutes = require("./routes/statusSalesRoutes");
const emailRoutes = require("./routes/emailRoutes");
const orderRecRoutes = require("./routes/orderRecRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const auditRoutes = require("./routes/audit/auditTemplateRoutes");
// const cycleCountRoutes = require("./routes/cycleCountRoutes");
// const CycleCountNewRoutes = require("./routes/cycleCountNewRoutes");
// const cycleCountRoutes = require('./routes/cycleCount2Routes');
const { auth } = require("./middleware/authMiddleware");
const cycleCountNewRoutes = require('./routes/cycleCountRoutes');
// const auth = require("./middleware/authMiddleware");
const permissionRoutes = require("./routes/permissionRoutes");
const selectTemplateRoutes = require("./routes/audit/selectTemplateRoutes");
// const feedbackTemplateRoutes = require("./routes/audit/feedbackTemplateRoutes");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '200mb' }));

// Health check
app.get('/api/health', (req, res) => res.send('OK'));
app.use("/api/auth", authRoutes);
app.use("/api/locations", locationRoutes);

// console.log("Middleware is:",auth);
app.use(auth);

app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);

// Business Logic
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/payables", payablesRoutes);
app.use("/api/shift-worksheet", shiftWorksheetRoutes);
app.use("/api/cash-summary", cashSummaryRoutes);
app.use("/api/paypoints", payPointRoutes);
app.use("/api/kardpoll-transactions", kardpollTransactionsRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/fleet-customers", fleetCustomers);
app.use("/api/order-rec", orderRecRoutes);
app.use("/api/vendors", vendorRoutes);
// app.use("/api/cycle-counts", cycleCountRoutes);
app.use("/api/cycle-count", cycleCountNewRoutes);
// app.use("/api/cycle-count-new", CycleCountNewRoutes);
app.use("/api/audit/select-templates", selectTemplateRoutes);
// app.use("/api/audit/follow-up-templates", followUpTemplateRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/permissions", permissionRoutes);

// Reporting
app.use("/api/sales-summary", salesSummaryRoutes);
app.use("/api/status-sales", statusSalesRoutes);
app.use('/api/sql', require('./routes/salesRoutes'));

// Misc
app.use('/api', emailRoutes);

// Setup Socket.IO with CORS so frontend can connect
const io = new Server(server, {
  path: "/socket.io/",
  transports: ["websocket", "polling"],
  cors: {
    origin: ["https://app.gen7fuel.com", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// Add comprehensive server-side logging
console.log("🏗️ Socket.IO server created");
console.log("🏗️ CORS origins:", ["https://app.gen7fuel.com", "http://localhost:5173", "http://localhost:3000"]);
console.log("🏗️ Path:", "/socket.io/");
console.log("🏗️ Transports:", ["websocket", "polling"]);

// Engine-level logging
io.engine.on("initial_headers", (headers, request) => {
  console.log("📥 Socket.IO INITIAL HEADERS:");
  console.log("  - Origin:", request.headers.origin || "no origin");
  console.log("  - User-Agent:", request.headers['user-agent'] || "no user-agent");
  console.log("  - Host:", request.headers.host || "no host");
  console.log("  - Upgrade:", request.headers.upgrade || "no upgrade");
  console.log("  - Connection:", request.headers.connection || "no connection");
});

io.engine.on("headers", (headers, request) => {
  console.log("📋 Socket.IO HEADERS from:", request.headers.origin || "unknown");
});

io.engine.on("connection_error", (err) => {
  console.error("🔥 Engine CONNECTION ERROR:");
  console.error("  - Request URL:", err.req.url);
  console.error("  - Error code:", err.code);
  console.error("  - Error message:", err.message);
  console.error("  - Context:", err.context);
});

// Connection-level logging
io.on("connection", (socket) => {
  console.log("✅ NEW SOCKET CONNECTION:");
  console.log("  - Socket ID:", socket.id);
  console.log("  - Client IP:", socket.handshake.address);
  console.log("  - Origin:", socket.handshake.headers.origin || "no origin");
  console.log("  - User-Agent:", socket.handshake.headers['user-agent'] || "no user-agent");
  console.log("  - Transport:", socket.conn.transport.name);
  console.log("  - Query params:", socket.handshake.query);
  console.log("  - Auth data:", socket.handshake.auth);

  socket.on("cycle-count-field-updated", ({ itemId, field, value }) => {
    console.log("📡 BROADCASTING cycle-count-field-updated:");
    console.log("  - From socket:", socket.id);
    console.log("  - Item ID:", itemId);
    console.log("  - Field:", field);
    console.log("  - Value:", value);
    
    // Broadcast to all other clients except sender
    socket.broadcast.emit("cycle-count-field-updated", { itemId, field, value });
    console.log("📡 Broadcast sent to other clients");
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ CLIENT DISCONNECTED:");
    console.log("  - Socket ID:", socket.id);
    console.log("  - Reason:", reason);
  });

  socket.on("error", (error) => {
    console.error("🚨 SOCKET ERROR:");
    console.error("  - Socket ID:", socket.id);
    console.error("  - Error:", error);
  });

  // Log when client sends any event
  socket.onAny((event, ...args) => {
    console.log("📨 Received event:", event, "from socket:", socket.id);
  });
});

// Server-level error logging
io.on("connect_error", (error) => {
  console.error("🚨 SERVER connect_error:", error);
});

// io.on("connection", (socket) => {
//   socket.on("cycle-count-field-updated", ({ itemId, field, value }) => {
//     // Broadcast to all other clients except sender
//     socket.broadcast.emit("cycle-count-field-updated", { itemId, field, value });
//   });

//   socket.on("disconnect", () => {
//     console.log("Client disconnected:", socket.id);
//   });
// });

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
