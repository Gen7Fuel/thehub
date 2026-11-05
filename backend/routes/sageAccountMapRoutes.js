const express = require("express");
const mongoose = require("mongoose");
const SageAccountMap = require("../models/SageAccountMap");

const router = express.Router();

const normalizeGlAccounts = (glaccount = []) =>
  glaccount
    .filter((entry) => entry?.accName?.trim() && entry?.accNo?.trim())
    .map((entry) => ({
      mappingField: entry.mappingField,
      accName: entry.accName.trim(),
      accNo: entry.accNo.trim(),
    }));

const validateSiteId = (site, res) => {
  if (!site || !mongoose.isValidObjectId(site)) {
    res.status(400).json({ message: "A valid site ID is required." });
    return false;
  }
  return true;
};

router.get("/", async (req, res) => {
  try {
    if (!validateSiteId(req.query.site, res)) return;
    const mapping = await SageAccountMap.findOne({ site: req.query.site }).lean();
    res.json(mapping);
  } catch (error) {
    console.error("Error fetching Sage account mapping:", error);
    res.status(500).json({ message: "Failed to fetch Sage account mapping." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { site, depositAccName, depositAccountNumber, glaccount } = req.body;
    if (!validateSiteId(site, res)) return;

    const mapping = await SageAccountMap.create({
      site,
      depositAccName,
      depositAccountNumber,
      glaccount: normalizeGlAccounts(glaccount),
    });
    res.status(201).json(mapping);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A Sage account mapping already exists for this site." });
    }
    console.error("Error creating Sage account mapping:", error);
    res.status(400).json({ message: error.message || "Failed to create Sage account mapping." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "A valid mapping ID is required." });
    }
    const mapping = await SageAccountMap.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          depositAccName: req.body.depositAccName,
          depositAccountNumber: req.body.depositAccountNumber,
          glaccount: normalizeGlAccounts(req.body.glaccount),
        },
      },
      { new: true, runValidators: true }
    );
    if (!mapping) return res.status(404).json({ message: "Sage account mapping not found." });
    res.json(mapping);
  } catch (error) {
    console.error("Error updating Sage account mapping:", error);
    res.status(400).json({ message: error.message || "Failed to update Sage account mapping." });
  }
});

module.exports = router;
