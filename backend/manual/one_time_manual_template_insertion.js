const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const AuditTemplate = require("../models/audit/auditTemplate");

dotenv.config();

(async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected...");

    const createdBy = new mongoose.Types.ObjectId("68bf1b4aa1f5bc66c9dd8b72");
    const createdAt = new Date();

    const sites = [
      "Couchiching",
      "Rankin",
      "Silver Grizzly",
      "Walpole",
      "Oliver",
      "Osoyoos",
      "Jocko Point",
      "Sarnia"
    ];

    const buildAssignedSites = () =>
      sites.map(site => ({
        site,
        assigned: true,
        issueRaised: false,
        lastChecked: null
      }));

    // Common defaults
    const defaults = {
      status: "Status",
      followUp: "Follow Up",
      suppliesVendor: "",
    };

    const templates = [
      {
        name: "Site Exterior",
        items: [
          ["Cleanliness", "daily", "Pump Fascia"],
          ["Maintenance", "monthly", "Pump Certification Stamp"],
          ["Cleanliness", "daily", "Parking Lot"],
          ["Cleanliness", "daily", "Garbage Cans"],
          ["Cleanliness", "weekly", "Landscaping"],
          ["Cleanliness", "daily", "Station Entrance"],
          ["Cleanliness", "daily", "Island"],
          ["Cleanliness", "daily", "Pump Retracks"],
          ["Cleanliness", "weekly", "Canopy Ceiling"],
          ["Cleanliness", "daily", "Windows - Kiosk"],
          ["Cleanliness", "daily", "Windows- Store"],
          ["Cleanliness", "daily", "Kiosk - POS Area clean & clutter free"],
          ["Equipment", "daily", "Lighting-Canopy"],
          ["Equipment", "daily", "Lighting - Store Outside"],
          ["Equipment", "weekly", "Pumps Operational & Calibrated"],
          ["Maintenance", "daily", "Kiosk - Door Operational"],
          ["Maintenance", "daily", "Kiosk - Gen7 Loyalty cards available"],
          ["Maintenance", "daily", "Kiosk - Walkie Talkie present"],
          ["Maintenance", "daily", "Kiosk - Signage"],
          ["Maintenance", "daily", "Kiosk - Intercom Tested"],
          ["Maintenance", "daily", "Fuel Price Signage Accurate"],
          ["Maintenance", "weekly", "Emergency Stop Buttom Labeled & Working"],
          ["Maintenance", "weekly", "Pump Spill Kit stocked and accessible"],
          ["Maintenance", "weekly", "Nozzle & Hose wear checked"],
          ["Maintenance", "weekly", "Ashphalt Condition"],
          ["Maintenance", "weekly", "Ashphalt Lines"],
          ["Maintenance", "weekly", "Fuel Pads"],
          ["Maintenance", "weekly", "Columns"],
          ["Maintenance", "weekly", "Paint Repairs Required"],
          ["Maintenance", "daily", "Front Curb - Clean & Not obstructed"],
          ["Maintenance", "daily", "Cardlock - Pumps"],
        ],
        assignedTo: "Operations",
      },
      {
        name: "Site Interior",
        items: [
          ["Bistro", "daily", "Area Sanitized"],
          ["Bistro", "daily", "Equip - Microwave, Dishwasher"],
          ["Bistro", "daily", "Equip - Coffee/Slushy"],
          ["Bistro", "daily", "Equip - Condoment Holders"],
          ["Cleanliness", "daily", "Floors"],
          ["Cleanliness", "daily", "Counters Clean"],
          ["Cleanliness", "daily", "Shelves-Fronted"],
          ["Cleanliness", "daily", "Shelves - Clean"],
          ["Cleanliness", "daily", "Public Restrooms"],
          ["Cleanliness", "daily", "POS Area Clutter Free"],
          ["Cleanliness", "daily", "Coffee Counter Clean & Stocked"],
          ["Cleanliness", "daily", "Windows - Drive Thru"],
          ["Maintenance", "daily", "Shelfs Fully Stocked"],
          ["Maintenance", "weekly", "Labels front facing"],
          ["Maintenance", "daily", "Products Dust Free"],
          ["Maintenance", "daily", "Coolers Fully stocked"],
          ["Maintenance", "daily", "Impulse Items on Counter"],
          ["Maintenance", "daily", "Security Cameras"],
          ["Maintenance", "daily", "Back stock areas  tidy"],
          ["Maintenance", "weekly", "Lighting - Ceiling & Coolers"],
          ["Maintenance", "daily", "Freezers Operational"],
          ["Maintenance", "daily", "Signage-Interior Perfect"],
          ["Operations", "weekly", "Safe & Coin Audit Completed"],
          ["Operations", "weekly", "Out of Stock - Products missing"],
          ["Operations", "weekly", "Store vs Planogram"],
          ["Operations", "daily", "Fuel Inventory - Incon/Evo"],
          ["Operations", "daily", "Fuel Inventory-Sales vs Levels"],
          ["Operations", "daily", "Storage Areas Secured"],
          ["Operations", "daily", "Tobacco storage locked"],
          ["Maintenance", "daily", "Intercom Tested"],
          ["Maintenance", "daily", "Overstock on Floor"],
        ],
        assignedTo: "Operations",
      },
      {
        name: "Inventory",
        items: [
          ["Maintenance", "weekly", "Stock Levels Adequate", "Operations"],
          ["Maintenance", "weekly", "Expiry Dates being checked", "Operations"],
          ["Maintenance", "monthly", "Pricing consistant in system", "Inventory"],
          ["Maintenance", "monthly", "High Margin Items being displayed", "Operations"],
          ["Maintenance", "monthly", "Refridgeration functional and clean", "Operations"],
          ["Maintenance", "monthly", "Tobacco stored correctly", "Operations"],
          ["Maintenance", "monthly", "FIFO-products being stored by delivery date", "Operations"],
          ["Maintenance", "monthly", "Expired Products On Display", "Operations"],
          ["Maintenance", "monthly", "Unapproved Product", "Operations"],
          ["Maintenance", "weekly", "New Products Not in System", "Inventory"],
          ["Maintenance", "monthly", "Scanning Issues", "Inventory"],
          ["Maintenance", "weekly", "Bistro - Adequate Inventory", "Inventory"],
          ["Product", "weekly", "Big Sellers this week", "Operations"],
          ["Product", "weekly", "Slow Movers this week", "Operations"],
          ["Product", "monthly", "Running low on any product", "Operations"],
          ["Training", "monthly", "Ordering - staff trained for orders needing to be placed", "Operations"],
          ["Training", "monthly", "Planograms - staff trained to use for orders", "Operations"],
          ["Training", "monthly", "Receiving - staff trained to received properly and check PO", "Operations"],
        ],
        assignedTo: null,
      },
      {
        name: "Safety and Compliance",
        items: [
          ["Certifications", "monthly", "Licenses Valid"],
          ["Certifications", "monthly", "Inspection Cert Valid"],
          ["Compliance", "monthly", "Spill Response Signage"],
          ["Compliance", "monthly", "Security System"],
          ["Compliance", "daily", "Staff Wearing Safety Gear"],
          ["Compliance", "monthly", "Kiosk - Hi Vis being Used"],
          ["Compliance", "monthly", "Fuel Tank Area"],
          ["Safety Equipment", "monthly", "Fire Extinquishers"],
          ["Safety Equipment", "monthly", "First Aid Kit"],
        ],
        assignedTo: "Operations",
      },
      {
        name: "Customer Experience",
        items: [
          ["Other", "monthly", "Observe Employee Intertactions"],
          ["Other", "monthly", "Wait times acceptable"],
          ["Other", "monthly", "Loyalty program being promoted by Staff"],
          ["Other", "monthly", "Suggestions/Complaints being addressed"],
        ],
        assignedTo: "Operations",
      },
      {
        name: "Human Resources",
        items: [
          ["Employee Review", "monthly", "Performance Reviews", "HR"],
          ["Employee Review", "monthly", "Uniforms - all employees in Gen7", "Orders"],
          ["Human Resources", "monthly", "Any Current Employee Issues", "HR"],
          ["Station Op", "monthly", "Scheduleing - Current Manpower vs Op Needs", "Operations"],
          ["Station Op", "monthly", "Review Station Hours vs Station Needs", "Operations"],
          ["Training", "monthly", "Training Review- All Training up to date", "HR"],
          ["Training", "monthly", "Dept Certificates up to date (ie. Food Serve, Lotto)", "Operations"],
          ["Training", "monthly", "New Employee Orientation", "HR"],
        ],
        assignedTo: null, // individual assignments used
      },
      {
        name: "Marketing",
        items: [
          ["Assets", "weekly", "Hose Talkers"],
          ["Assets", "weekly", "Column Posters"],
          ["Assets", "weekly", "Pump Toppers"],
          ["Assets", "weekly", "Lower Pump Toppers"],
          ["Assets", "weekly", "Window Posters"],
          ["Assets", "weekly", "Banners"],
          ["Assets", "weekly", "Flags"],
          ["Assets", "weekly", "Drive Thru Signs"],
          ["Assets", "weekly", "Road Signs"],
          ["Assets", "weekly", "Pump Stickers"],
          ["Digital Sign", "weekly", "Samsung Screen"],
          ["Digital Sign", "weekly", "Green Tak"],
          ["Equipment", "weekly", "A-Frames"],
          ["Equipment", "weekly", "Acrylic Easels"],
          ["Equipment", "weekly", "Outdoor Building Frames"],
          ["Gen7 Cards", "weekly", "Loyalty Cards"],
          ["Gen7 Cards", "weekly", "Gift Cards"],
          ["Gen7 Cards", "weekly", "Fleet Cards"],
          ["Material", "weekly", "Loyalty Post Cards"],
          ["Other", "weekly", "Any Handwritten Signs"],
          ["Promo", "weekly", "Season Promo"],
        ],
        assignedTo: "Marketing",
      }
    ];

    for (const tmpl of templates) {
      const items = tmpl.items.map(([category, frequency, item, assignedTo]) => ({
        category,
        item,
        frequency: frequency || "monthly",
        assignedTo: assignedTo || tmpl.assignedTo || "Operations",
        ...defaults,
        assignedSites: buildAssignedSites(),
      }));

      const document = {
        name: tmpl.name,
        description: "",
        items,
        sites,
        createdBy,
        createdAt,
        __v: 0,
      };

      await AuditTemplate.updateOne({ name: tmpl.name }, { $set: document }, { upsert: true });
      console.log(`✅ Template inserted/updated: ${tmpl.name}`);
    }

    console.log("🎉 All templates inserted successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error inserting templates:", err);
    process.exit(1);
  }
})();
