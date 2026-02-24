const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const User = require("../models/User");
const connectDB = require("../config/db");

dotenv.config();

const allPermissions = [
  {
    "module_name": "accounting",
    "structure": [
      {
        "permId": 80001,
        "name": "sftp",
        "children": []
      },
      {
        "permId": 80002,
        "name": "cashSummary",
        "children": [
          {
            "name": "form",
            "children": [],
            "collapsed": true,
            "permId": 80012
          },
          {
            "name": "list",
            "children": [],
            "collapsed": true,
            "permId": 80013
          },
          {
            "name": "lottery",
            "children": [],
            "collapsed": false,
            "permId": 80016
          },
          {
            "name": "lotteryList",
            "children": [],
            "collapsed": false,
            "permId": 80017
          },
          {
            "name": "report",
            "children": [
              {
                "name": "fetchAgain",
                "children": [],
                "collapsed": false,
                "permId": 80019
              }
            ],
            "collapsed": true,
            "permId": 80018
          }
        ]
      },
      {
        "permId": 80003,
        "name": "fuelRec",
        "children": [
          {
            "name": "bol",
            "children": [],
            "collapsed": true,
            "oldName": "bol",
            "permId": 80004
          },
          {
            "name": "list",
            "children": [],
            "collapsed": true,
            "oldName": "list",
            "permId": 80005
          },
          {
            "name": "requestAgain",
            "children": [],
            "collapsed": true,
            "oldName": "R",
            "permId": 80006
          },
          {
            "name": "delete",
            "children": [],
            "collapsed": true,
            "permId": 80014
          }
        ]
      },
      {
        "permId": 80007,
        "name": "safesheet",
        "children": []
      },
      {
        "permId": 80008,
        "name": "cashRec",
        "children": []
      },
      {
        "permId": 80015,
        "name": "infonetReport",
        "children": []
      }
    ],
    "module_permId": 80000
  },
  {
    "module_name": "dashboard",
    "structure": [],
    "module_permId": 5000
  },
  {
    "module_name": "settings",
    "structure": [
      {
        "name": "maintenance",
        "children": [],
        "permId": 10001
      }
    ],
    "module_permId": 10000
  },
  {
    "module_name": "stationAudit",
    "structure": [
      {
        "name": "template",
        "children": [],
        "permId": 15001
      },
      {
        "name": "interface",
        "children": [],
        "permId": 15002
      },
      {
        "name": "checklist",
        "children": [],
        "permId": 15003
      },
      {
        "name": "visitor",
        "children": [],
        "permId": 15004
      }
    ],
    "module_permId": 15000
  },
  {
    "module_name": "cycleCount",
    "structure": [
      {
        "name": "lookup",
        "children": [],
        "permId": 20001
      },
      {
        "name": "report",
        "children": [],
        "permId": 20002
      }
    ],
    "module_permId": 20000
  },
  {
    "module_name": "support",
    "structure": [],
    "module_permId": 25000
  },
  {
    "module_name": "orderRec",
    "structure": [
      {
        "name": "upload",
        "children": [],
        "permId": 30001
      },
      {
        "name": "id",
        "children": [
          {
            "name": "deleteButton",
            "children": [],
            "collapsed": false,
            "permId": 30003
          }
        ],
        "permId": 30002
      },
      {
        "name": "workflow",
        "children": [],
        "permId": 30004
      }
    ],
    "module_permId": 30000
  },
  {
    "module_name": "vendor",
    "structure": [],
    "module_permId": 35000
  },
  {
    "module_name": "fleetCardAssignment",
    "structure": [],
    "module_permId": 40000
  },
  {
    "module_name": "po",
    "structure": [
      {
        "permId": 45001,
        "name": "pdf",
        "children": []
      },
      {
        "permId": 45002,
        "name": "changeDate",
        "children": []
      },
      {
        "name": "delete",
        "children": [],
        "permId": 45003
      }
    ],
    "module_permId": 45000
  },
  {
    "module_name": "kardpoll",
    "structure": [],
    "module_permId": 50000
  },
  {
    "module_name": "payables",
    "structure": [],
    "module_permId": 55000
  },
  {
    "module_name": "dailyReports",
    "structure": [],
    "module_permId": 60000
  },
  {
    "module_name": "reports",
    "structure": [],
    "module_permId": 65000
  },
  {
    "module_name": "status",
    "structure": [
      {
        "name": "pdf",
        "children": [],
        "permId": 70001
      }
    ],
    "module_permId": 70000
  },
  {
    "module_name": "safesheet",
    "structure": [],
    "module_permId": 75000
  },
  {
    "module_name": "category",
    "structure": [],
    "module_permId": 85000
  },
  {
    "module_name": "passwordReset",
    "module_permId": 90000,
    "structure": []
  },
  {
    "module_name": "writeOff",
    "module_permId": 95000,
    "structure": [
      {
        "name": "create",
        "children": [],
        "permId": 95001
      },
      {
        "name": "requests",
        "children": [],
        "permId": 95002
      }
    ]
  }
];

adminRole = [
  {
    "role_name": "Admin",
    "description": "Administrator",
    "permissionsArray": [
      {
        "permId": 80000,
        "value": true
      },
      {
        "permId": 80008,
        "value": true
      },
      {
        "permId": 80002,
        "value": true
      },
      {
        "permId": 80012,
        "value": true
      },
      {
        "permId": 80013,
        "value": true
      },
      {
        "permId": 80016,
        "value": true
      },
      {
        "permId": 80017,
        "value": true
      },
      {
        "permId": 80018,
        "value": true
      },
      {
        "permId": 80019,
        "value": true
      },
      {
        "permId": 80003,
        "value": true
      },
      {
        "permId": 80004,
        "value": false
      },
      {
        "permId": 80014,
        "value": false
      },
      {
        "permId": 80005,
        "value": false
      },
      {
        "permId": 80006,
        "value": false
      },
      {
        "permId": 80015,
        "value": true
      },
      {
        "permId": 80007,
        "value": true
      },
      {
        "permId": 80001,
        "value": true
      },
      {
        "permId": 85000,
        "value": true
      },
      {
        "permId": 20000,
        "value": true
      },
      {
        "permId": 20001,
        "value": true
      },
      {
        "permId": 20002,
        "value": true
      },
      {
        "permId": 60000,
        "value": true
      },
      {
        "permId": 5000,
        "value": true
      },
      {
        "permId": 40000,
        "value": true
      },
      {
        "permId": 50000,
        "value": true
      },
      {
        "permId": 30000,
        "value": true
      },
      {
        "permId": 30002,
        "value": true
      },
      {
        "permId": 30003,
        "value": true
      },
      {
        "permId": 30001,
        "value": true
      },
      {
        "permId": 30004,
        "value": true
      },
      {
        "permId": 90000,
        "value": true
      },
      {
        "permId": 55000,
        "value": true
      },
      {
        "permId": 45000,
        "value": true
      },
      {
        "permId": 45002,
        "value": false
      },
      {
        "permId": 45003,
        "value": false
      },
      {
        "permId": 45001,
        "value": true
      },
      {
        "permId": 65000,
        "value": true
      },
      {
        "permId": 75000,
        "value": true
      },
      {
        "permId": 10000,
        "value": true
      },
      {
        "permId": 15000,
        "value": true
      },
      {
        "permId": 15003,
        "value": true
      },
      {
        "permId": 15002,
        "value": true
      },
      {
        "permId": 15001,
        "value": true
      },
      {
        "permId": 15004,
        "value": false
      },
      {
        "permId": 70000,
        "value": true
      },
      {
        "permId": 70001,
        "value": true
      },
      {
        "permId": 25000,
        "value": true
      },
      {
        "permId": 35000,
        "value": true
      },
      {
        "permId": 95000,
        "value": true
      },
      {
        "permId": 95001,
        "value": true
      },
      {
        "permId": 95002,
        "value": true
      },
      {
        "permId": 10001,
        "value": false
      }
    ],
    "inStoreAccount": false
  }
]


const seedPermissionsDB = async () => {
  if (process.env.HOST !== "VPS") {
    try {
      await connectDB();

      await Permission.deleteMany({});
      await Permission.insertMany(allPermissions);

      console.log("Permissions seeded successfully!");
      console.log(`Total permissions inserted: ${allPermissions.length}`);


      await Role.deleteMany({});
      // We take the first object from your adminRole array
      const insertedRole = await Role.create(adminRole[0]);
      console.log(`Role "${insertedRole.role_name}" seeded with ID: ${insertedRole._id}`);

      demoUser = [
        {
          "email": "demo@demo.com",
          "password": "demo123",
          "firstName": "Demo",
          "lastName": "Demo",
          "is_active": true,
          "is_admin": true,
          "stationName": "Oliver",
          "is_inOffice": false,
          "role": insertedRole._id,
          "site_access": {
            "Rankin": true,
            "Couchiching": true,
            "Jocko Point": true,
            "Sarnia": true,
            "Osoyoos": true,
            "Oliver": true,
            "Walpole": true,
            "Silver Grizzly": true,
          },
          "is_loggedIn": false
        }
      ]
      // 3. Prepare and Seed Demo User
      await User.deleteMany({});
      await User.create(demoUser);
      console.log("Demo user seeded successfully!. Email: demo@demo.com, Password: demo123");

      mongoose.connection.close();
    } catch (error) {
      console.error("Error seeding permissions:", error);
      mongoose.connection.close();
    }
  } else {
    console.log("Skipping permissions seeding. Not running on VPS.");
  }
};

seedPermissionsDB();