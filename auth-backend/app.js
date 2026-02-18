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

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));


// Health check
app.get('/auth/health', (req, res) => res.send('OK'));
app.use("/auth", authRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
