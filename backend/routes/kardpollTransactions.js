const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transactions");
const Product = require("../models/Product");
const Fleet = require("../models/Fleet");
const Location = require("../models/Location");

router.post("/upload", async (req, res) => {
  const transactions = req.body;

  try {
    for (const transaction of transactions) {
      // const { transactionNumber, product, fleetCardNumber, customerName, customerId, location, date, time, quantity, amount, driverInfo } = transaction;
      // kardpollCode is location code
      console.log("Current transaction", transaction);
      const { date, time, kardpollCode, trx, customerId, customerName, fleetCardNumber, productKardpollCode, driverInfo, quantity, amount } = transaction;

      // Check if the transaction already exists
      const existingTrx = await Transaction.findOne({ trx });
      if (existingTrx) {
        console.log("This transaction already exists. Skipping...");
        continue; // Skip this transaction
      }

      // Get the product ID
      const productRecord = await Product.findOne({ kardpollCode: productKardpollCode });
      console.log("Product found:", productRecord);
      if (!productRecord) {
        console.error(`Product not found for kardpollCode: ${productKardpollCode}`);
        continue; // Skip this transaction
      }

      // Get or create the fleet record
      let fleetRecord = await Fleet.findOne({ fleetCardNumber });
      console.log("Fleet record found:", fleetRecord);
      if (!fleetRecord) {
        fleetRecord = new Fleet({ fleetCardNumber, customerName, customerId, vehicleMakeModel: driverInfo });
        await fleetRecord.save();
      }

      // Get the location record
      const locationRecord = await Location.findOne({ kardpollCode });
      console.log("Location record found:", locationRecord);
      if (!locationRecord) {
        console.error(`Location not found for kardpollCode: ${kardpollCode}`);
        continue; // Skip this transaction
      }

      // Create the date object
      const dateTime = new Date(`${date}T${time}`);

      // Create the purchase order
      const newOrder = new Transaction({
        source: "Kardpoll",
        date: dateTime,
        stationName: locationRecord.stationName,
        fleetCardNumber,
        quantity,
        amount,
        productCode: productRecord.code,
        trx
      });

      console.log("New order created in memory");

      await newOrder.save();
    }

    res.status(200).json({ message: "Transactions processed successfully." });
  } catch (error) {
    console.error("Error processing transactions:", error);
    res.status(500).json({ message: "Error processing transactions." });
  }
});

// Get all transactions with optional date and location filters
router.get("/", async (req, res) => {
  const { startDate, endDate, stationName } = req.query;
  const filter = { source: "Kardpoll" };

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // Set end date to the next day to include the entire end date
    filter.date = { $gte: start, $lt: end };
  }

  if (stationName) {
    const locationRecord = await Location.findOne({ stationName: stationName });
    if (locationRecord) {
      filter.stationName = locationRecord.stationName;
    } else {
      return res.status(404).json({ message: "Location not found" });
    }
  }

  try {
    // const orders = await Transaction.find(filter)
    //   .populate('fleet', 'fleetCardNumber driverName customerName customerId')
    //   .populate('product', 'description')
    //   .sort({ date: -1 });
    const orders = await Transaction.find(filter)
      .select('fleetCardNumber productCode date quantity amount')
      .sort({ date: -1 }); // Sort transactions by date (newest first)

    const fleetCardNumbers = orders.map(order => order.fleetCardNumber);
    const productCodes = orders.map(order => order.productCode);

    // Fetch fleet details
    const fleets = await Fleet.find({ fleetCardNumber: { $in: fleetCardNumbers } })
      .select('fleetCardNumber driverName customerName customerId vehicleMakeModel');

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
      customerId: fleetMap[order.fleetCardNumber]?.customerId || null,
      vehicleMakeModel: fleetMap[order.fleetCardNumber]?.vehicleMakeModel|| null,
      description: productMap[order.productCode] || null,
    }));

    res.status(200).json(ordersWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase orders." });
  }
});

// NOT A KARDPOLL ONLY ROUTE
// WE NEED THIS FOR SALES SUMMARY REPORT
// Get all transactions with optional date and location filters
router.get("/all", async (req, res) => {
  const { startDate, endDate, stationName } = req.query;
  const filter = { stationName };

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // Set end date to the next day to include the entire end date
    filter.date = { $gte: start, $lt: end };
  }

  // if (stationName) {
  //   const locationRecord = await Location.findOne({ stationName: stationName });
  //   if (locationRecord) {
  //     filter.location = locationRecord.stationName;
  //   } else {
  //     return res.status(404).json({ message: "Location not found" });
  //   }
  // }

  try {
    // const orders = await Transaction.find(filter)
    //   .populate('fleet', 'fleetCardNumber driverName customerName customerId')
    //   .populate('product', 'description')
    //   .sort({ date: -1 });
    const orders = await Transaction.find(filter)
      .select('fleetCardNumber productCode date amount')
      .sort({ date: -1 }); // Sort transactions by date (newest first)

    const fleetCardNumbers = orders.map(order => order.fleetCardNumber);
    const productCodes = orders.map(order => order.productCode);

    // Fetch fleet details
    const fleets = await Fleet.find({ fleetCardNumber: { $in: fleetCardNumbers } })
      .select('fleetCardNumber driverName customerName customerId');

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
      customerId: fleetMap[order.fleetCardNumber]?.customerId || null,
      description: productMap[order.productCode] || null,
    }));
    res.status(200).json(ordersWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase orders." });
  }
});

module.exports = router;