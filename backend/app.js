const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

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
const auth = require("./middleware/authMiddleware");
const permissionRoutes = require("./routes/permissionRoutes");
const selectTemplateRoutes = require("./routes/audit/selectTemplateRoutes");
// const feedbackTemplateRoutes = require("./routes/audit/feedbackTemplateRoutes");


dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: '200mb' }));

// Health check
app.get('/api/health', (req, res) => res.send('OK'));
app.use("/api/auth", authRoutes);
app.use("/api/locations", locationRoutes);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
