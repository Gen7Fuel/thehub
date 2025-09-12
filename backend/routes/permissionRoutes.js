const express = require("express");
const router = express.Router();
const Permission = require("../models/Permission");
const User = require('../models/User');

// Get all
router.get("/", async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.status(200).json(permissions);
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Permission name required" });

  try {
    const newPermission = new Permission({ name });
    await newPermission.save();
    res.status(201).json(newPermission);
  } catch (err) {
    console.error("Error adding permission:", err);
    res.status(500).json({ error: "Failed to add permission" });
  }
});

// Update
router.put("/:id", async (req, res) => {
  try {
    const updatedPermission = await Permission.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true }
    );
    if (!updatedPermission) return res.status(404).json({ error: "Not found" });

    res.status(200).json(updatedPermission);
  } catch (err) {
    console.error("Error updating permission:", err);
    res.status(500).json({ error: "Failed to update" });
  }
});

// Delete
// Delete permission by ID
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Permission.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });

    // Remove this key from all users' access
    await User.updateMany(
      {},
      { $unset: { [`access.${deleted.name}`]: "" } }
    );

    res.status(200).json({ message: "Deleted successfully and removed from users" });
  } catch (err) {
    console.error("Error deleting permission:", err);
    res.status(500).json({ error: "Failed to delete permission" });
  }
});

// ✅ Sync permissions to all users
router.post("/sync", async (req, res) => {
  try {
    const permissions = await Permission.find().lean();
    const permissionNames = permissions.map(p => p.name);

    const users = await User.find();

    for (const user of users) {
      let updatedAccess = { ...user.access };

      // add missing
      permissionNames.forEach(name => {
        if (!(name in updatedAccess)) {
          updatedAccess[name] = false;
        }
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { access: updatedAccess } }
      );
    }

    res.json({ message: "Permissions synced for all users" });
  } catch (error) {
    console.error("Error syncing permissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// router.post("/sync", async (req, res) => {
//   res.json({ message: "Sync endpoint hit" });
// });


module.exports = router;
