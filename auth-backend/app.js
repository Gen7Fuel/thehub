const express = require('express')
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const port = 5005
const morgan = require('morgan');


const authRoutes = require("./routes/auth");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  console.log(`📡 Incoming Request: ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));


// Health check
app.get('/auth/health', (req, res) => res.send('OK'));
app.post("/auth/identify", async (req, res) => {
  try {
    const inputEmail = String(req.body.email || '').trim();
    const user = await User.findOne({
      email: new RegExp(`^${escapeRegExp(inputEmail)}$`, 'i')
    }).populate("role");

    // Check for maintenance status
    const ongoing = await Maintenance.findOne({ status: "ongoing" });

    // If user exists, provide account type + maintenance info
    if (user && user.role) {
      return res.json({
        inStoreAccount: user.role.inStoreAccount,
        maintenance: ongoing ? { active: true, endTime: ongoing.scheduleClose } : null
      });
    }
    // Security: Silent default for non-existent users
    res.status(404).json({
      message: "Identity hidden",
      maintenance: ongoing ? { active: true, endTime: ongoing.scheduleClose } : null
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
app.use("/auth", authRoutes);

app.use((req, res) => {
  console.log(`⚠️ Unhandled Request: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Not Found", path: req.url, method: req.method });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${port}`);
});
