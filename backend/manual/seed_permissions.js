const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Permission = require("../models/Permission");
const connectDB = require("../config/db");

dotenv.config();

const allPermissions = [
  {
    module_name: "dashboard",
    structure: [],
  },
  {
    module_name: "settings",
    structure: [],
  },
  {
    module_name: "stationAudit",
    structure: [
      { name: "template", children: [] },
      { name: "interface", children: [] },
    ],
  },
  {
    module_name: "cycleCount",
    structure: [
      { name: "console", children: [] },
    ],
  },
  {
    module_name: "support",
    structure: [],
  },
  {
    module_name: "orderRec",
    structure: [
      { name: "upload", children: [] },
      {
        name: "id",
        children: [
          { name: "deleteButton", children: [] },
        ],
      },
      { name: "workflow", children: [] },
    ],
  },
  {
    module_name: "fleetCardAssignment",
    structure: [],
  },
  {
    module_name: "po",
    structure: [
      { name: "pdf", children: [] },
    ],
  },
  {
    module_name: "kardpoll",
    structure: [],
  },
  {
    module_name: "payables",
    structure: [],
  },
  {
    module_name: "dailyReports",
    structure: [],
  },
  {
    module_name: "reports",
    structure: [],
  },
  {
    module_name: "status",
    structure: [
      { name: "pdf", children: [] },
    ],
  },
];

const seedPermissionsDB = async () => {
  try {
    await connectDB();

    await Permission.deleteMany({});
    await Permission.insertMany(allPermissions);

    console.log("Permissions seeded successfully!");
    console.log(`Total modules inserted: ${allPermissions.length}`);

    mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding permissions:", error);
    mongoose.connection.close();
  }
};

seedPermissionsDB();