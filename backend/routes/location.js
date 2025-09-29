const express = require("express");
const Location = require("../models/Location");
const router = express.Router();

// Create a new location
router.post("/", async (req, res) => {
  try {
    const { stationName, legalName, INDNumber } = req.body;

    if (!stationName || !legalName || !INDNumber) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newLocation = new Location({ stationName, legalName, INDNumber });
    const savedLocation = await newLocation.save();

    res.status(201).json(savedLocation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create location." });
  }
});

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

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const location = await Location.findById(id);
    if (location) {
      res.status(200).json({ stationName: location.stationName });
    } else {
      res.status(404).json({ message: "Location not found." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch location." });
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

module.exports = router;
