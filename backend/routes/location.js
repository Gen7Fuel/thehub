const express = require("express");
const Location = require("../models/Location");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const User = require('../models/User');
const router = express.Router();

// Create a new location
// router.post("/", async (req, res) => {
//   try {
//     const { stationName, legalName, INDNumber } = req.body;

//     if (!stationName || !legalName || !INDNumber) {
//       return res.status(400).json({ message: "All fields are required." });
//     }

//     const newLocation = new Location({ stationName, legalName, INDNumber });
//     const savedLocation = await newLocation.save();

//     res.status(201).json(savedLocation);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to create location." });
//   }
// });

// Get locations
router.get("/", async (req, res) => {
  const { stationName } = req.query;

  try {
    if (stationName) {
      // Fetch specific location by stationName
      const location = await Location.findOne({ stationName });
      if (location) {
        res.status(200).json(location);
      } else {
        res.status(404).json({ message: "Location not found." });
      }
    } else {
      // Fetch all locations
      const locations = await Location.find({ type: "store" });
      res.status(200).json(locations);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch locations." });
  }
});

//--GET LOCATION BY ID--
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const location = await Location.findById(id);
    if (location) {
      res.status(200).json({location});
    } else {
      res.status(404).json({ message: "Location not found." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch location." });
  }
});

// UPDATE LOCATION
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const location = await Location.findByIdAndUpdate(id, updateData, { new: true });
    if (!location) {
      return res.status(404).json({ message: "Location not found." });
    }
    res.status(200).json({ message: "Location updated successfully.", location });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update location." });
  }
});

//--ADD NEW LOCATION--
// POST /api/locations
router.post("/", async (req, res) => {
  try {
    const { type, stationName,  legalName, INDNumber, kardpollCode,   csoCode,  timezone,  email, managerCode } = req.body;

    // Basic validation
    if (!type || !stationName || !legalName || !INDNumber || !csoCode || !timezone || !email || !managerCode) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Create new location
    const location = new Location({ type,stationName,legalName,INDNumber,kardpollCode,csoCode,timezone,email, managerCode,});

    await location.save();

    // Admin-like roles which will be given the permission for the site
    const ADMIN_ROLE_NAMES = ["Admin"];

    //Fetch all roles that match these names
    const adminRoles = await Role.find({
      role_name: { $in: ADMIN_ROLE_NAMES },
    }).select("_id role_name");

    const adminRoleIds = adminRoles.map((role) => String(role._id));

    // Get all users (only _id and role)
    const users = await User.find({}, "_id role");

    // Build bulk operations
    const bulkOps = users.map((user) => {
      const isAdmin = adminRoleIds.includes(String(user.role));
      return {
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { [`site_access.${stationName}`]: isAdmin } },
        },
      };
    });

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }

    res.status(201).json(location);
  } catch (err) {
    console.error("Error creating location:", err);
    res.status(500).json({ message: "Failed to create location." });
  }
});

// FOR THE ERROR OF PRODUCTION CALLING /api/locations/undefined
// Get stationName by _id
router.get("/name/:stationName", async (req, res) => {
  const { stationName } = req.params;

  try {
    const location = await Location.findOne({ stationName });
    if (location) {
      res.status(200).json(location);
    } else {
      res.status(404).json({ message: "Location not found." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch location." });
  }
});

// Check station manager code
// POST /api/locations/check-code
router.post("/check-code", async (req, res) => {
  try {
    const { location, code } = req.body;

    if (!location || !code) {
      return res.status(400).json({ error: "Missing location or code" });
    }

    const locationDoc = await Location.findOne({ stationName: location }).lean();

    if (!locationDoc) {
      return res.status(404).json({ error: "Location not found" });
    }

    // Compare numeric managerCode
    if (Number(locationDoc.managerCode) === Number(code)) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, error: "Incorrect code" });
    }
  } catch (err) {
    console.error("Error checking code:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
