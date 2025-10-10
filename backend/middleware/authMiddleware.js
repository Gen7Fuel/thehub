const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Express middleware for authenticating HTTP requests using JWT.
 * - Checks for a Bearer token in the Authorization header.
 * - Verifies the token and attaches the user object to req.user.
 * - Responds with 401 Unauthorized if authentication fails.
 */
const auth = async (req, res, next) => {
  console.log("Auth middleware hit for:", req.method, req.originalUrl); // Logs each auth check

  try {
    // Get the Authorization header and check format
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    // Extract and verify the JWT token
    const token = authHeader.replace("Bearer ", "").trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by decoded id, excluding password
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user to request object for downstream use
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Token is not valid" });
  }
};

/**
 * Socket.IO middleware for authenticating socket connections using JWT.
 * - Checks for a token in socket.handshake.auth.
 * - Verifies the token and attaches the user object to socket.user.
 * - Calls next() with an error if authentication fails.
 */
const authSocket = async (socket, next) => {
  next(); // Temporarily bypassing auth for testing
  // try {
  //   // Get token from socket handshake auth
  //   const token = socket.handshake.auth?.token || null;
  //   if (!token) {
  //     return next(new Error("No token, authorization denied"));
  //   }

  //   // Verify the JWT token
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);

  //   // Find the user by decoded id, excluding password
  //   const user = await User.findById(decoded.id).select("-password");
  //   if (!user) {
  //     return next(new Error("User not found"));
  //   }

  //   // Attach user to socket object for downstream use
  //   socket.user = user;
  //   next();
  // } catch (err) {
  //   console.error("Socket auth error:", err);
  //   next(new Error("Token is not valid"));
  // }
};

// To use with Socket.IO: io.use(authSocket);

module.exports = { auth, authSocket };