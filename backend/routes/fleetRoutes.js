const express = require("express");
const router = express.Router();
const Fleet = require("../models/Fleet");

// Route to create a new Fleet entry
router.post("/create", async (req, res) => {
  const { fleetCardNumber, driverName, customerName, vehicleMakeModel } = req.body;

  try {
    let fleet = await Fleet.findOne({ fleetCardNumber });

    if (fleet) {
      return res.status(200).json({ 
        schema: Fleet.schema.paths,
        message: "Fleet entry with this card number already exists.",
        fleetId: fleet._id 
      });
    }

    fleet = new Fleet({ fleetCardNumber, driverName, customerName, vehicleMakeModel });
    await fleet.save();

    res.status(201).json({ 
      message: "Fleet entry created successfully.", 
      fleetId: fleet._id 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Route to get driverName, customerName and vehicleMakeModel by fleetCardNumber
router.get("/getByCardNumber/:fleetCardNumber", async (req, res) => {
  const { fleetCardNumber } = req.params;

  try {
    const fleet = await Fleet.findOne({ fleetCardNumber });

    if (!fleet) {
      return res.status(404).json({ message: "Fleet entry not found." });
    }

    res.status(200).json({ 
      driverName: fleet.driverName, 
      customerName: fleet.customerName,
      vehicleMakeModel: fleet.vehicleMakeModel,
      fleetId: fleet._id 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.put("/updateByCardNumber/:fleetCardNumber", async (req, res) => {
  // Update a fleet entry by fleetCardNumber
  const { fleetCardNumber } = req.params;
  const { driverName, customerName, vehicleMakeModel } = req.body;

  try {
    const fleet = await Fleet.findOneAndUpdate(
      { fleetCardNumber },
      { driverName, customerName, vehicleMakeModel },
      { new: true }
    );

    if (!fleet) {
      return res.status(404).json({ message: "Fleet entry not found." });
    }

    res.status(200).json({ message: "Fleet entry updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;