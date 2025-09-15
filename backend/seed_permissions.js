const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Permission = require("./models/Permission");
const connectDB = require("./config/db");

dotenv.config();

const allPermissions = [
    { name:"component_settings" },
    { name:"component_po_location_filter" },
    { name:"component_po_pdf" },
    { name:"component_po_edit" },
    { name:"component_daily_reports_location_filter" },
    { name:"component_status_pdf" },
    { name:"component_order_rec_upload" },
    { name:"module_po" },
    { name:"module_kardpoll" },
    { name:"module_reports" },
    { name:"module_status" },
    { name:"module_status_location_filter" },
    { name:"module_daily_reports" },
    { name:"module_order_rec" },
    { name:"module_payables" },
    { name:"module_fleet_card_assignment" },
    { name:"module_cycle_count" },
    { name:"module_vendor" },
    { name:"module_audit" }
]

const seedPermissionsDB = async () => {
    await connectDB();

    await Permission.deleteMany({});
    await Permission.insertMany(allPermissions);

    console.log("Permissions seeded!");
    console.log(`Seeded ${allPermissions.length} permissions`);
    
    mongoose.connection.close();
  };
  
  seedPermissionsDB();