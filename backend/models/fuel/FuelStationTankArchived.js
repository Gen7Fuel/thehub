const mongoose = require("mongoose");
// We reuse the same schema logic
const fuelStationTankSchema = require("./FuelStationTank").schema;
module.exports = mongoose.model("FuelStationTankArchived", fuelStationTankSchema);