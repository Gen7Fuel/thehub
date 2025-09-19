const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  console.log("Auth middleware hit for:", req.method, req.originalUrl); // <--- ADD THIS

  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Socket.IO middleware
const authSocket = async (socket, next) => {
  console.log("Socket.IO auth hit");

  try {
    const token = socket.handshake.auth?.token || null;
    if (!token) {
      return next(new Error("No token, authorization denied"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user; // Attach user to socket
    next();
  } catch (err) {
    console.error("Socket auth error:", err);
    next(new Error("Token is not valid"));
  }
};

io.use(authSocket);

module.exports = { auth, authSocket };
