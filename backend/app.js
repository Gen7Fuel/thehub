const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const requestId = require("./middleware/requestId");

// throw new Error("ROLLBACK_TEST_CRASH");

//BullMQ for background email processing running
require("./queues/emailQueue"); // Just runs the worker
require('./cron_jobs/cycleCountCron'); //cron job for getting cso on hands for cyclecount
require('./cron_jobs/fuelInventoryReportCron'); //cron job for getting fuel inventory report and email to kellie
require('./cron_jobs/auditIssueReportCron'); //cron job for getting previous months audit issue report and email to Ana
require('./cron_jobs/mongoCsvExportCron'); //cron job for exporting mongo data to azure in csv
require('./cron_jobs/archiveOldNotification'); //cron job for archiving/removing old notifications
require('./cron_jobs/logoutUsersCron'); //cron job for logging out users daily at 9 AM UTC
require('./cron_jobs/dashboardCacheCron'); //cron job for pre-warming dashboard SQL cache daily at 5 AM UTC
require('./cron_jobs/dailyFuelSyncCron') // cron job for updating fuel related data daily morning at 5 am EST
require('./cron_jobs/weeklyArReportCron') // cron job for weekly AR report emailed to mario every Tuesday 9 AM PT
// require('./cron_jobs/productCategoryMappingCron'); //cron job for normalising the product categories


// Route imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const locationRoutes = require("./routes/location");
const purchaseOrderRoutes = require("./routes/purchaseOrder");
const payablesRoutes = require("./routes/payablesRoute");
const shiftWorksheetRoutes = require("./routes/shiftWorksheetRoutes");
const cashSummaryRoutes = require("./routes/cashSummaryNewRoutes");
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
const safesheetRoutes = require("./routes/safesheetRoutes");
const roleRoutes = require("./routes/roleRoutes");
const sftpRoutes = require("./routes/sftpRoutes");
const cashRecRoutes = require("./routes/cashRecRoutes");
const fuelRecRoutes = require("./routes/fuelRecRoutes");
const productCategoryRoutes = require("./routes/productCategoryRoutes");
const logsRoute = require("./routes/logsRoute");
const sageRoutes = require("./routes/sageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const userGroupRoutes = require("./routes/userGroupRoutes");
const fuelCarrierRoutes = require("./routes/fuel/fuelCarrierRoutes");
const fuelRackRoutes = require("./routes/fuel/fuelRackRoutes");
const fuelSupplierRoutes = require("./routes/fuel/fuelSupplierRoutes");
const fuelStationTankRoutes = require("./routes/fuel/fuelStationTankRoutes");
const fuelOrderRoutes = require("./routes/fuel/fuelOrderRoutes");
const fuelSaleRoutes = require("./routes/fuel/fuelSaleRoutes");

const { auth } = require("./middleware/authMiddleware");

const cycleCountRoutes = require('./routes/cycleCountRoutes');
const permissionRoutes = require("./routes/permissionRoutes");
const selectTemplateRoutes = require("./routes/audit/selectTemplateRoutes");
const writeOffRoutes = require("./routes/writeOffRoutes");
const supportRoutes = require('./routes/supportRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const { router: aiCustomerRoutes } = require('./routes/aiCustomerRoutes');
const bulletinRoutes = require('./routes/bulletinRoutes');
const eventRoutes = require('./routes/eventRoutes');
const { router: supportChatRoutes, initSupportChatIo } = require('./routes/supportChatRoutes');
const { initChatQueueIo } = require('./queues/supportChatQueue');
const { initializePermissionMap } = require("./utils/permissionStore");
const setupSocket = require("./socket");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(requestId());


// Health check
app.get('/api/health', (req, res) => res.send('OK'));
// app.get('/api/health', (req, res) => {
//   res.status(500).send('FORCED_FAILURE_FOR_TESTING');
// });
app.use("/api/sage", sageRoutes); // Publicly accessible
app.use("/api/auth", authRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/academy/admin", require("./routes/academy/adminRoutes"));

// console.log("Middleware is:",auth);
app.use(auth);

app.use("/api/academy/learner", require("./routes/academy/learnerRoutes"));

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
app.use("/api/cycle-count", cycleCountRoutes);
app.use("/api/audit/select-templates", selectTemplateRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/logs", logsRoute);
app.use("/api/notification", notificationRoutes);
app.use("/api/user-groups", userGroupRoutes);

// Reporting
app.use("/api/sales-summary", salesSummaryRoutes);
app.use("/api/status-sales", statusSalesRoutes);
app.use('/api/sql', require('./routes/salesRoutes'));

app.use('/api/support/chat', supportChatRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/safesheets', safesheetRoutes);
app.use('/api/sftp', sftpRoutes);

app.use('/api/cash-rec', cashRecRoutes);
app.use("/api/fuel-rec", fuelRecRoutes);
app.use('/api/product-category', productCategoryRoutes);
app.use('/api/write-off', writeOffRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/ai-customer', aiCustomerRoutes);
app.use('/api/bulletin', bulletinRoutes);
app.use('/api/events', eventRoutes);

app.use('/api/fuel-carriers', fuelCarrierRoutes);
app.use('/api/fuel-racks', fuelRackRoutes);
app.use('/api/fuel-suppliers', fuelSupplierRoutes);
app.use('/api/fuel-station-tanks', fuelStationTankRoutes);
app.use('/api/fuel-orders', fuelOrderRoutes);
app.use('/api/fuel-sales', fuelSaleRoutes);

// Misc
app.use('/api', emailRoutes);

const io = setupSocket(server);
app.set("io", io);
initSupportChatIo(io);
initChatQueueIo(io);

const PORT = process.env.PORT || 5000;

const seedNotificationTemplates = async () => {
  const NotificationTemplate = require('./models/notification/notificationTemplate');
  await NotificationTemplate.findOneAndUpdate(
    { slug: 'order-rec-comment' },
    {
      $setOnInsert: {
        name: 'Order Rec Comment',
        slug: 'order-rec-comment',
        description: 'Sent when a user posts a message in an order rec chat',
        fields: [
          { key: 'senderName', label: 'Sender Name', fieldType: 'text', required: true },
          { key: 'site', label: 'Site', fieldType: 'text', required: true },
          { key: 'message', label: 'Message', fieldType: 'text', required: true },
          { key: 'orderRecId', label: 'Order Rec ID', fieldType: 'text', required: true },
        ],
        type: 'system',
        contentLayout: '<p><strong>{{senderName}}</strong> sent a message on the order rec for <strong>{{site}}</strong>:</p><p>{{message}}</p><p><a href="https://app.gen7fuel.com/order-rec/{{orderRecId}}">View Order Rec</a></p>'
      }
    },
    { upsert: true }
  );
};

// Create an async start function
const startServer = async () => {
  try {
    // 1. Initialize the Permission Map first
    // This ensures your auth middleware has the data it needs immediately
    await initializePermissionMap();

    // 2. Seed required notification templates
    await seedNotificationTemplates();

    // 3. Start the server
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Critical Failure: Could not initialize Permission Map", err);
    process.exit(1); // Stop the server if permissions fail to load
  }
};

// Execute the start function
startServer();
