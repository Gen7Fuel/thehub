const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Permission = require("../models/Permission");
const Location = require("../models/Location"); // Add this at the top with other requires
const router = express.Router();

// router.post("/register", async (req, res) => {
//   const { email, password, firstName, lastName, stationName } = req.body;
//   try {
//     const userExists = await User.findOne({ email });
//     if (userExists) return res.status(400).json({ message: "User already exists" });

//     const access = {
//       component_settings: false,
//       component_po_location_filter: false,
//       component_po_pdf: false,
//       component_po_edit: false,
//       component_daily_reports_location_filter: false,
//       component_status_pdf: false,
//       component_order_rec_upload: false,
//       module_po: false,
//       module_kardpoll: false,
//       module_reports: false,
//       module_status: false,
//       module_status_location_filter: false, // CONVERT TO COMPONENT
//       module_daily_reports: false,
//       module_order_rec: false,
//       module_payables: false,
//       module_fleet_card_assignment: false,
//       module_cycle_count: false,
//       module_vendor: false
//     }

//     const user = await User.create({ email, password, firstName, lastName, stationName, access });

//     res.status(201).json(user);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

router.post("/register", async (req, res) => {
  const { email, password, firstName, lastName, stationName } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    // Fetch all permissions from DB
    const permissions = await Permission.find();

    // Build dynamic access map
    const access = {};

    for (const perm of permissions) {
      if (perm.name === "site_access") {
        access.site_access = {};

        if (Array.isArray(perm.sites)) {
          perm.sites.forEach((site) => {
            // auto-true for the user's own station
            access.site_access[site] = site === stationName;
          });
        }
      } else {
        // Regular permissions default to false
        access[perm.name] = false;
      }
    }

    // Create the user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      stationName,
      location: stationName, // store as default location
      access,
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Fetch location and timezone
    let timezone = null;
    if (user.stationName) {
      const location = await Location.findOne({ stationName: user.stationName });
      timezone = location?.timezone || null;
    }

    const token = jwt.sign({
      id: user._id,
      email: user.email,
      location: user.stationName,
      name: `${user.firstName} ${user.lastName}`,
      initials: `${getInitials(user.firstName, user.lastName)}`,
      // access: JSON.stringify(user.access),
      access: user.access,
      timezone
     }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({
      token,
      email: user.email,
      // location: user.stationName,
      name: `${user.firstName} ${user.lastName}`,
      initials: `${getInitials(user.firstName, user.lastName)}`,
      access: JSON.stringify(user.access),
      timezone // <-- add timezone to response
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function getInitials(firstName, lastName) {
  const firstInitial = firstName?.trim()?.[0]?.toUpperCase() || '';
  const lastInitial = lastName?.trim()?.[0]?.toUpperCase() || '';
  return firstInitial + lastInitial;
}

router.post('/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: 'Missing fields.' });

  // Hash the password (example with bcrypt)
  const hashed = await bcrypt.hash(newPassword, 10);

  const user = await User.findByIdAndUpdate(userId, { password: hashed });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ success: true });
});

module.exports = router;
