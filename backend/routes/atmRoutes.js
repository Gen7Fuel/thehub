const express = require("express");
const router = express.Router();
const ATMRecord = require("../models/ATMRecord");

router.post("/", async (req, res) => {
  const { date, amount, source, image, stationName } = req.body;

  if (!date || amount == null || !source || !stationName) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    const record = new ATMRecord({
      date,
      amount,
      source,
      image: image || null,
      stationName,
      createdBy: req.user?.name || "",
    });
    const saved = await record.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create ATM record." });
  }
});

router.get("/", async (req, res) => {
  const { stationName, startDate, endDate } = req.query;

  const filter = {};
  if (stationName) filter.stationName = stationName;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }

  try {
    const records = await ATMRecord.find(filter).sort({ date: -1, createdAt: -1 });
    res.status(200).json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch ATM records." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await ATMRecord.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    res.status(200).json({ deleted: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete ATM record." });
  }
});

module.exports = router;
