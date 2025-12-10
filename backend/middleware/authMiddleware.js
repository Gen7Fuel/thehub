const jwt = require("jsonwebtoken");
const User = require("../models/User");
import chalk from 'chalk'

/**
 * Express middleware for authenticating HTTP requests using JWT.
 * - Checks for a Bearer token in the Authorization header.
 * - Verifies the token and attaches the user object to req.user.
 * - Responds with 401 Unauthorized if authentication fails.
 */
// const auth = async (req, res, next) => {
//   console.log("Auth middleware hit for:", req.method, req.originalUrl); // Logs each auth check

//   try {
//     // Get the Authorization header and check format
//     const authHeader = req.header("Authorization");
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({ message: "No token, authorization denied" });
//     }

//     // Extract and verify the JWT token
//     const token = authHeader.replace("Bearer ", "").trim();
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Find the user by decoded id, excluding password
//     const user = await User.findById(decoded.id).select("-password");
//     if (!user) {
//       return res.status(401).json({ message: "User not found" });
//     }

//     // Attach user to request object for downstream use
//     req.user = user;
//     next();
//   } catch (err) {
//     console.error("Auth error:", err);
//     res.status(401).json({ message: "Token is not valid" });
//   }
// };
/**
 * Traverse the nested permission tree automatically respecting `value`
 * - keyPath: dot-separated string like "stationAudit.template"
 * - returns boolean
 */
const checkPermission = (accessTree, keyPath) => {
  if (!accessTree) return false;

  const keys = keyPath.split("."); // e.g., ["stationAudit", "template"]
  let currentNodes = accessTree;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (!Array.isArray(currentNodes)) return false;

    const node = currentNodes.find(n => n.name === key);
    if (!node) return false;

    // If parent node value is false, deny access immediately
    if (!node.value) return false;

    // Move to children for next iteration
    currentNodes = node.children;
  }

  return true; // all nodes in path exist and have value === true
};


/**
 * Express middleware for authenticating HTTP requests and checking permissions.
 * Reads required permission from custom header: `X-Required-Permission`.
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // check for token expiry if token expired then juist update the is_loggedin
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Check for expired token
      if (err.name === "TokenExpiredError") {
        // update DB to set is_loggedIn = false
        const expiredDecoded = jwt.decode(token); // get payload without verifying
        if (expiredDecoded?.id) {
          await User.findByIdAndUpdate(expiredDecoded.id, {
            is_loggedIn: false
          }, { timestamps: false });
        }

        return res.status(401).json({ message: "Token expired" });
      }

      return res.status(401).json({ message: "Token is not valid" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });


    req.user = user;
    // Timestamp: 2025-12-09 14:23 (UTC)
    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`

    // console.log(`[${ts}] 🧑‍💻 ${req.user.firstName}: ${req.method} ${req.originalUrl}`);

    console.log(chalk.green(`[${ts}]`), `🧑‍💻 ${req.user.firstName}:`, chalk.yellow(`${req.method}) ${req.originalUrl}`))

    // Check for permission from header
    const requiredPermission = req.header("X-Required-Permission");
    if (requiredPermission) {
      const hasPermission = checkPermission(decoded.permissions, requiredPermission);
      if (!hasPermission) {
        return res
          .status(403)
          .json({ message: `Access denied for ${requiredPermission}` });
      }
    }

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
  try {
    // Get token from socket handshake auth
    const token = socket.handshake.auth?.token || null;
    if (!token) {
      return next(new Error("No token, authorization denied"));
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by decoded id, excluding password
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("User not found"));
    }

    // Attach user to socket object for downstream use
    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket auth error:", err);
    next(new Error("Token is not valid"));
  }
};

// To use with Socket.IO: io.use(authSocket);

module.exports = { auth, authSocket };