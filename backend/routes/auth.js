const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();
const Role = require("../models/Role");

const { auth } = require("../middleware/authMiddleware.js");
const { logChange } = require('../middleware/changeLogger');

// Escape input for use in RegExp to avoid injection
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// RETIRED: public identity lookup moved to auth-backend `/login-auth/identify`.
/*
router.post("/identify", async (req, res) => {
  try {
    const inputEmail = String(req.body.email || '').trim();
    const user = await User.findOne({
      email: new RegExp(`^${escapeRegExp(inputEmail)}$`, 'i')
    }).populate("role");

    // If user exists, tell the frontend the truth
    if (user && user.role) {
      return res.json({ inStoreAccount: user.role.inStoreAccount });
    }

    // If user doesn't exist, return 404. 
    // The frontend will catch this and default to Passcode view.
    res.status(404).json({ message: "Identity hidden" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
*/

// router.post("/register", async (req, res) => {
//   const { email, password, firstName, lastName, stationName } = req.body;

//   try {
//     // Check if user already exists
//     const userExists = await User.findOne({ email });
//     if (userExists)
//       return res.status(400).json({ message: "User already exists" });

//     // Fetch all permissions from DB
//     const permissions = await Permission.find();

//     // Build dynamic access map
//     const access = {};

//     for (const perm of permissions) {
//       if (perm.name === "site_access") {
//         access.site_access = {};

//         if (Array.isArray(perm.sites)) {
//           perm.sites.forEach((site) => {
//             // auto-true for the user's own station
//             access.site_access[site] = site === stationName;
//           });
//         }
//       } else {
//         // Regular permissions default to false
//         access[perm.name] = false;
//       }
//     }

//     // Create the user
//     const user = await User.create({
//       email,
//       password,
//       firstName,
//       lastName,
//       stationName,
//       location: stationName, // store as default location
//       access,
//     });

//     res.status(201).json(user);
//   } catch (err) {
//     console.error("Error in register:", err);
//     res.status(500).json({ message: err.message });
//   }
// });
// RETIRED: public registration moved to auth-backend `/login-auth/register`.
/*
router.post("/register", async (req, res) => {
  const { email, password, firstName, lastName, stationName } = req.body;

  try {
    const inputEmail = String(email || '').trim();
    const normalizedEmail = inputEmail.toLowerCase();

    // Check if user already exists (case-insensitive)
    const userExists = await User.findOne({ email: new RegExp(`^${escapeRegExp(inputEmail)}$`, 'i') });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    // Fetch only store-type locations
    const storeLocations = await Location.find({ type: "store" });

    // Build site_access map: all stores false except user's own
    const site_access = {};
    storeLocations.forEach((loc) => {
      site_access[loc.stationName] = loc.stationName === stationName;
    });

    // Create the user (store email in lowercase)
    const user = await User.create({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      stationName,
      site_access,
      custom_permissions: [], // empty by default
      role: null,             // no role assigned yet
      is_active: true,        // active by default
    });

    await logChange(req, {
      action: 'create',
      resourceType: 'user',
      resourceId: user._id,
      resourceStore: 'mongodb',
      success: true,
      statusCode: 201,
      source: req.headers['x-action-source'] || 'register.page',
      actor: { username: 'unknown', locationName: stationName },
      message: `New user registered: ${normalizedEmail}`,
      changes: [{
        operation: 'add',
        path: 'user',
        before: null,
        after: { email: normalizedEmail, firstName, lastName, stationName },
      }],
      changeSummary: { added: 1, removed: 0, replaced: 0, total: 1 },
    });

    const safeUser = user.toObject();
    delete safeUser.password;

    res.status(201).json({
      message: "User registered successfully",
      user: safeUser,
    });
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).json({ message: err.message });
  }
});
*/

// Old Permissions login route
// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: "Invalid credentials" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

//     // Fetch location and timezone
//     let timezone = null;
//     if (user.stationName) {
//       const location = await Location.findOne({ site: user.site ?? user.stationName });
//       timezone = location?.timezone || null;
//     }

//     const token = jwt.sign({
//       id: user._id,
//       email: user.email,
//       isSupport: user.isSupport,
//       location: user.stationName,
//       name: `${user.firstName} ${user.lastName}`,
//       initials: `${getInitials(user.firstName, user.lastName)}`,
//       access: user.access,
//       timezone
//      }, process.env.JWT_SECRET, { expiresIn: "1d" });
//     res.json({
//       token,
//       email: user.email,
//       isSupport: user.isSupport,
//       name: `${user.firstName} ${user.lastName}`,
//       initials: `${getInitials(user.firstName, user.lastName)}`,
//       access: JSON.stringify(user.access),
//       timezone
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// Route with new permissions
// RETIRED: public login moved to auth-backend `/login-auth/login`.
/*
router.post("/login", async (req, res) => {
  console.log("Login attempt from backend for email:", req.body.email);
  const { email, password } = req.body;

  try {
    const inputEmail = String(email || '').trim();
    // Case-insensitive lookup by email
    const user = await User.findOne({ email: new RegExp(`^${escapeRegExp(inputEmail)}$`, 'i') });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // Check if user is inactive
    if (!user.is_active) {
      return res.status(403).json({ message: "Access Denied. Contact Admin." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Update login flags
    const previousLoginDate = user.lastLoginDate;
    const previousLoggedIn = !!user.is_loggedIn;
    const loginDate = new Date();
    user.lastLoginDate = loginDate;
    user.is_loggedIn = true;

    // MUST disable timestamps so updatedAt doesn't change unnecessarily
    await user.save({ timestamps: false });

    await logChange(req, {
      action: 'update',
      resourceType: 'user',
      resourceId: user._id,
      resourceStore: 'mongodb',
      success: true,
      statusCode: 200,
      source: req.headers['x-action-source'] || 'login.page',
      actor: { userId: user._id, username: user.email, locationName: user.stationName },
      message: `User logged in: ${user.email}`,
      changes: [
        { operation: 'replace', path: 'is_loggedIn', before: previousLoggedIn, after: true },
        { operation: 'replace', path: 'lastLoginDate', before: previousLoginDate?.toISOString?.() || null, after: loginDate.toISOString() },
      ],
      changeSummary: { added: 0, removed: 0, replaced: 2, total: 2 },
    });

    // Get merged permissions (role + custom)
    // const mergedPermissions = await getMergedPermissions(user);
    const mergedPermissions = await getMergedPermissionsTreeArray(user);

    // Fetch location & timezone
    let timezone = null;
    if (user.stationName) {
      const location = await Location.findOne({ site: user.site ?? user.stationName });
      timezone = location?.timezone || null;
    }

    // Create JWT payload
    const payload = {
      id: user._id,
      email: user.email,
      location: user.stationName,
      isSupport: user.isSupport,
      name: `${user.firstName} ${user.lastName}`,
      initials: getInitials(user.firstName, user.lastName),
      permissions: mergedPermissions,
      site_access: user.site_access,
      timezone,
    };

    // Sign JWT
    const expiresInSeconds = getSecondsUntilNext9AMUTC();

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresInSeconds });

    // Send response
    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});
*/

function getSecondsUntilNext9AMUTC() {
  const now = new Date();

  // Create a new Date set to today's 9 AM UTC
  const next9AM = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    9, 0, 0, 0
  ));

  // If it's already past 9 AM UTC today, go to tomorrow
  if (now >= next9AM) {
    next9AM.setUTCDate(next9AM.getUTCDate() + 1);
  }

  const diffMs = next9AM - now;
  const diffSeconds = Math.floor(diffMs / 1000);
  return diffSeconds;
}

function getInitials(firstName, lastName) {
  const firstInitial = firstName?.trim()?.[0]?.toUpperCase() || '';
  const lastInitial = lastName?.trim()?.[0]?.toUpperCase() || '';
  return firstInitial + lastInitial;
}

//logout user
router.post("/logout", auth, async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    const userBeforeLogout = await User.findByIdAndUpdate(userId, {
      is_loggedIn: false
    }, { timestamps: false });

    if (userBeforeLogout) {
      await logChange(req, {
        action: 'update',
        resourceType: 'user',
        resourceId: userBeforeLogout._id,
        resourceStore: 'mongodb',
        success: true,
        statusCode: 200,
        source: req.headers['x-action-source'] || 'navbar.session',
        message: `User logged out: ${userBeforeLogout.email}`,
        changes: [{
          operation: 'replace',
          path: 'is_loggedIn',
          before: !!userBeforeLogout.is_loggedIn,
          after: false,
        }],
        changeSummary: { added: 0, removed: 0, replaced: 1, total: 1 },
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// user self-serve reset password
router.post('/change-password-self', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // From auth middleware

  try {
    const user = await User.findById(userId).populate("role");
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // 1. Verify Current Credentials
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: 'The current credentials you entered are incorrect. If you have forgotten them, please contact your system administrator to reset your account.'
      });
    }

    // 2. Hash and Update
    const cleanNewPassword = String(newPassword).trim();

    // const hashed = await bcrypt.hash(cleanNewPassword, 10);
    user.password = cleanNewPassword;

    // 3. Security: Force logout (optional but recommended)
    user.is_loggedIn = false;
    await user.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("force-logout", {
        message: "Your password was changed. Please log in again.",
      });
    }

    await logChange(req, {
      action: 'update',
      resourceType: 'user-credential',
      resourceId: user._id,
      success: true,
      statusCode: 200,
      source: 'settings.reset-password',
      resourceLabel: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      message: 'Account credentials updated by the account owner',
      changes: [{
        operation: 'replace',
        path: 'credentials.password',
        before: '[REDACTED]',
        after: '[REDACTED]',
      }],
      changeSummary: { added: 0, removed: 0, replaced: 1, total: 1 },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error during password reset.' });
  }
});


router.post('/reset-password', auth, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: 'Missing fields.' });

  const hashed = await bcrypt.hash(newPassword, 10);

  const user = await User.findByIdAndUpdate(userId, { password: hashed });
  if (!user) return res.status(404).json({ error: 'User not found.' });

  // Emit force-logout if user is logged in
  if (user.is_loggedIn) {
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("force-logout", {
        message: "Your account information has changed. Please log in again.",
      });
    }
    // Also mark user as logged out
    user.is_loggedIn = false;
    await user.save();
  }

  await logChange(req, {
    action: 'update',
    resourceType: 'user-credential',
    resourceId: user._id,
    success: true,
    statusCode: 200,
    source: 'settings.users',
    resourceLabel: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    message: `Credential reset completed for ${`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}`,
    changes: [{ operation: 'replace', path: 'credentials.password', before: '[REDACTED]', after: '[REDACTED]' }],
    changeSummary: { added: 0, removed: 0, replaced: 1, total: 1 },
  });
  res.json({ success: true });
});

// Verify Password against all users with Admin role
router.post("/verify-password", auth, async (req, res) => {
  const { password } = req.body;

  try {
    // Find the Admin role
    const adminRole = await Role.findOne({ role_name: "Admin" });
    if (!adminRole) return res.status(404).json({ error: "Admin role not found" });

    // Get all users who have the Admin role
    const adminUsers = await User.find({ role: adminRole._id });
    if (!adminUsers || adminUsers.length === 0)
      return res.status(404).json({ error: "No users with Admin role found" });

    // Check password against all admin users
    let verified = false;
    for (const user of adminUsers) {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log(user.firstName);
      if (isMatch) {
        console.log("Match");
        verified = true;
        break;
      }
    }

    if (!verified) return res.status(400).json({ error: "Invalid password" });

    res.json({ success: true });
  } catch (err) {
    console.error("Error verifying password:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// RETIRED: token refresh moved to auth-backend `/login-auth/refresh-token`.
/*
router.post("/refresh-token", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "Missing userId in request body" });
    }

    // Fetch the user from DB
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Rebuild permissions / timezone / access if needed
    // const mergedPermissions = await getMergedPermissions(user);
    const mergedPermissions = await getMergedPermissionsTreeArray(user);
    let timezone = null;
    if (user.stationName) {
      const location = await Location.findOne({ site: user.site ?? user.stationName });
      timezone = location?.timezone || null;
    }

    // Prepare new token payload
    const payload = {
      id: user._id,
      email: user.email,
      location: user.stationName,
      isSupport: user.isSupport,
      name: `${user.firstName} ${user.lastName}`,
      initials: getInitials(user.firstName, user.lastName),
      permissions: mergedPermissions,
      site_access: user.site_access,
      access: user.access,
      timezone,
    };

    // Generate new token
    const expiresInSeconds = getSecondsUntilNext9AMUTC();
    const newToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: expiresInSeconds,
    });

    res.json({ token: newToken });
  } catch (err) {
    console.error("Error refreshing token:", err);
    res.status(500).json({ message: "Failed to refresh token" });
  }
});
*/

module.exports = router;
