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
app.get('/login-auth/health', (req, res) => res.send('OK'));

// Mount at root so /login-auth/* routes are handled as expected
app.use("/", authRoutes);

app.use((req, res) => {
  console.log(`⚠️ Unhandled Request: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Not Found", path: req.url, method: req.method });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${port}`);
});
