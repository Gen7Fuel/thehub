const express = require("express");
const router = express.Router();
const Permission = require("../models/Access");

// ✅ Get all
router.get("/", async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.status(200).json(permissions);
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Add
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

// ✅ Update
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

// ✅ Delete
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Permission.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });

    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting permission:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

module.exports = router;
