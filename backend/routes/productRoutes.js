const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Endpoint to get all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products." });
  }
});

module.exports = router;