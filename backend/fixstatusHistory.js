// scripts/fixStatusHistory.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const OrderRec = require("./models/OrderRec"); // adjust path to your model
const connectDB = require("./config/db");

dotenv.config();

async function migrate() {
    await connectDB();

  const orders = await OrderRec.find({
    $or: [
      { statusHistory: { $exists: false } },
      { statusHistory: { $size: 0 } }
    ]
  });

  console.log(`Found ${orders.length} orders needing migration`);

  for (const order of orders) {
    order.statusHistory = [
      {
        status: order.currentStatus || "Created",
        timestamp: order.createdAt || new Date()
      }
    ];
    await order.save();
    console.log(`Fixed order ${order._id}`);
  }

  console.log("Migration complete ✅");
  mongoose.disconnect();
}

migrate().catch(err => {
    console.error("Migration failed ❌", err);
    mongoose.connection.close();
});
