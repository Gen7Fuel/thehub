const mongoose = require("mongoose");
// We reuse the same schema logic
const fuelSalesSchema = require("./FuelSales").schema; 
module.exports = mongoose.model("FuelSalesArchived", fuelSalesSchema);