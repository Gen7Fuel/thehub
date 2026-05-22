const express = require("express");
const router = express.Router();
const Fleet = require("../models/Fleet");

// GET / — list all fleet cards sorted by customerName ascending
router.get("/", async (req, res) => {
  try {
    const cards = await Fleet.find().sort({ customerName: 1 });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// GET /verify/:cardNumber — verify a fleet card's status
router.get("/verify/:cardNumber", async (req, res) => {
  const cardNumber = req.params.cardNumber.trim();

  try {
    const card = await Fleet.findOne({ fleetCardNumber: cardNumber });

    if (!card) {
      return res.json({ valid: false, reason: 'not_found' });
    }

    const cardPayload = {
      fleetCardNumber: card.fleetCardNumber,
      customerName: card.customerName,
      driverName: card.driverName,
      vehicleMakeModel: card.vehicleMakeModel,
      numberPlate: card.numberPlate,
    };

    if (card.status === 'active') {
      return res.json({ valid: true, status: 'active', reason: 'active', card: cardPayload });
    }

    return res.json({ valid: false, status: card.status, reason: card.status, card: cardPayload });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// POST / — create a new fleet card (returns full card object)
router.post("/", async (req, res) => {
  const { fleetCardNumber, customerName, driverName, vehicleMakeModel, numberPlate, status, notes, site } = req.body;

  const trimmedCardNumber = (fleetCardNumber || '').trim();
  if (!/^\d{16}$/.test(trimmedCardNumber)) {
    return res.status(400).json({ message: 'Card number must be exactly 16 digits' });
  }

  try {
    const card = new Fleet({ fleetCardNumber: trimmedCardNumber, customerName, driverName, vehicleMakeModel, numberPlate, status, notes, site });
    await card.save();
    res.status(201).json(card);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Card number already exists' });
    }
    res.status(500).json({ message: "Server error", error });
  }
});

// PUT /:id — update a fleet card by Mongo _id
router.put("/:id", async (req, res) => {
  const { fleetCardNumber, customerName, driverName, vehicleMakeModel, numberPlate, status, notes, site } = req.body;
  const update = { customerName, driverName, vehicleMakeModel, numberPlate, status, notes, site };

  if (fleetCardNumber !== undefined) {
    const trimmed = fleetCardNumber.trim();
    if (!/^\d{16}$/.test(trimmed)) {
      return res.status(400).json({ message: 'Card number must be exactly 16 digits' });
    }
    update.fleetCardNumber = trimmed;
  }

  try {
    const card = await Fleet.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!card) {
      return res.status(404).json({ message: "Fleet entry not found." });
    }
    res.json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// DELETE /:id — delete a fleet card by Mongo _id
router.delete("/:id", async (req, res) => {
  try {
    const card = await Fleet.findByIdAndDelete(req.params.id);
    if (!card) {
      return res.status(404).json({ message: "Fleet entry not found." });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

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