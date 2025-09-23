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
const cycleCountRoutes = require('./routes/cycleCount2Routes');
const { auth, authSocket } = require("./middleware/authMiddleware");
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
app.use("/api/cycle-counts", cycleCountRoutes);
app.use("/api/cycle-count", cycleCountNewRoutes);
// app.use("/api/cycle-count-new", CycleCountNewRoutes);
app.use("/api/audit/select-templates", selectTemplateRoutes);
// app.use("/api/audit/follow-up-templates", followUpTemplateRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/permissions", permissionRoutes);



// Reporting
app.use("/api/sales-summary", salesSummaryRoutes);
app.use("/api/status-sales", statusSalesRoutes);

// Misc
app.use('/api', emailRoutes);

// Setup Socket.IO with CORS so frontend can connect
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // your frontend dev server
    methods: ["GET", "POST"],
  },
});

io.use(authSocket)

app.set("io", io);

// Listen for connections
// io.on("connection", (socket) => {
//   console.log("New client connected:", socket.id);

//   // Example: listen for events from frontend
//   socket.on("ping", (msg) => {
//     console.log("Got ping:", msg);
//     socket.emit("pong", "Hello from server!");
//   });

//   socket.on("disconnect", () => {
//     console.log("Client disconnected:", socket.id);
//   });
// });

// Replace app.listen with server.listen
const PORT = process.env.PORT || 5000;
server.listen(PORT);


// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
