const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transactions");
const Fleet = require("../models/Fleet");
const Product = require("../models/Product");
const Location = require("../models/Location");

// Create a purchase order
router.post("/", async (req, res) => {
  const { fleetCardNumber, date, quantity, amount, signature, productCode, stationName, source, customerID, receipt } = req.body;

  try {
    const newOrder = new Transaction({
      fleetCardNumber,
      date,
      quantity,
      amount,
      signature,
      productCode,
      stationName,
      source,
      customerID,
      receipt
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create purchase order." });
  }
});

// Update a purchase order
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { fleetCardNumber, date, quantity, amount, signature, productCode, stationName, source, customerID } = req.body;

  try {
    const updatedOrder = await Transaction.findByIdAndUpdate(
      id,
      {
        fleetCardNumber,
        date,
        quantity,
        amount,
        signature,
        productCode,
        stationName,
        source,
        customerID,
        receipt
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Purchase order not found." });
    }

    res.status(200).json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update purchase order." });
  }
});

// Get all purchase orders with optional date and location filters
router.get("/", async (req, res) => {
  const { startDate, endDate, stationName} = req.query;
  const filter = { source: "PO", stationName };

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // Set end date to the next day to include the entire end date
    filter.date = { $gte: start, $lt: end };
  }

  try {
    // const orders = await Transaction.find(filter)
    //   .populate('fleet', 'fleetCardNumber driverName customerName customerId vehicleMakeModel')
    //   .populate('product', 'description')
    //   .sort({ date: -1 });
    const orders = await Transaction.find(filter)
      .select('fleetCardNumber productCode quantity amount signature date receipt')
      .sort({ date: -1 }); // Sort transactions by date (newest first)

    const fleetCardNumbers = orders.map(order => order.fleetCardNumber);
    const productCodes = orders.map(order => order.productCode);

    // Fetch fleet details (including vehicleMakeModel)
    const fleets = await Fleet.find({ fleetCardNumber: { $in: fleetCardNumbers } })
      .select('fleetCardNumber driverName customerName customerID vehicleMakeModel');

    // Fetch product details
    const products = await Product.find({ code: { $in: productCodes } })
      .select('code description');

    // Convert fleet and product data into lookup maps
    const fleetMap = Object.fromEntries(fleets.map(f => [f.fleetCardNumber, f]));
    const productMap = Object.fromEntries(products.map(p => [p.code, p.description]));

    // Merge data back into orders
    const ordersWithDetails = orders.map(order => ({
      ...order.toObject(),
      driverName: fleetMap[order.fleetCardNumber]?.driverName || null,
      customerName: fleetMap[order.fleetCardNumber]?.customerName || null,
      customerID: fleetMap[order.fleetCardNumber]?.customerID || null,
      vehicleMakeModel: fleetMap[order.fleetCardNumber]?.vehicleMakeModel || null, // Newly added field
      description: productMap[order.productCode] || null,
    }));
    res.status(200).json(ordersWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase orders." });
  }
});

// Get a single purchase order by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // const order = await Transaction.findById(id)
    //   .populate('fleet', 'fleetCardNumber driverName customerName customerId vehicleMakeModel')
    //   .populate('product', 'description');
    const order = await Transaction.findById(id).select('fleetCardNumber productCode quantity amount signature');

    if (!order) {
      console.log("Order not found");
      return null;
    }

    // Fetch fleet details
    const fleet = await Fleet.findOne({ fleetCardNumber: order.fleetCardNumber })
      .select('fleetCardNumber _id driverName customerName customerID vehicleMakeModel');

    // Fetch product details
    const product = await Product.findOne({ code: order.productCode })
      .select('code description');

    // Merge data into a single object
    const orderWithDetails = {
      ...order.toObject(),
      driverName: fleet?.driverName || null,
      customerName: fleet?.customerName || null,
      customerID: fleet?.customerID || null,
      vehicleMakeModel: fleet?.vehicleMakeModel || null,
      description: product?.description || null,
      fleetId: fleet?._id || null,
    };

    if (!orderWithDetails) {
      return res.status(404).json({ message: "Purchase order not found." });
    }

    res.status(200).json(orderWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase order." });
  }
});

module.exports = router;