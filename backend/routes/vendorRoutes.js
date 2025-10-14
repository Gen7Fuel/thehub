const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');

// Create new vendor
// router.post('/', async (req, res) => {
//   console.log("Vendor POST request: ", req.body);
//   try {
//     const {
//       name,
//       location,
//       station_supplies,
//       email_order,
//       email,
//       order_placement_method,
//       vendor_order_frequency,
//       category,
//     } = req.body;
//     if (!name || !location || !Array.isArray(station_supplies)) {
//       return res.status(400).json({ error: 'Missing required fields.' });
//     }
//     const vendor = await Vendor.create({
//       name,
//       location,
//       station_supplies,
//       email_order,
//       email,
//       order_placement_method,
//       vendor_order_frequency,
//       category,
//     });
//     res.status(201).json(vendor);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to create vendor.' });
//   }
// });

router.post('/', async (req, res) => {
  try {
    const {
      name,
      sites, // array of { site: string, frequency: number | "" }
      station_supplies,
      email_order,
      email,
      order_placement_method,
      vendor_order_frequency,
      category,
    } = req.body;

    // Validate required fields
    if (!name || !Array.isArray(sites) || sites.length === 0 || !Array.isArray(station_supplies)) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Check for duplicates before creation
    for (const s of sites) {
      const existing = await Vendor.findOne({ name, location: s.site });
      if (existing) {
        return res.status(409).json({
          error: `Vendor "${name}" already exists for some or all locations selected. Please edit the existing vendor instead.`,
        });
      }
    }

    // If no duplicates, create vendor docs
    const vendorDocs = await Promise.all(
      sites.map(s =>
        Vendor.create({
          name,
          location: s.site, // one site per doc
          station_supplies,
          email_order,
          email,
          order_placement_method,
          vendor_order_frequency: s.frequency || vendor_order_frequency, // use site-specific frequency if provided
          category,
        })
      )
    );

    res.status(201).json(vendorDocs); // return array of created vendors
  } catch (err) {
    console.error("Failed to create vendor:", err.message, err.errors || err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/', async (req, res) => {
  try {
    const { location, category } = req.query;
    const filter = {};
    if (location) filter.location = location;
    if (category) filter.category = category;
    const vendors = await Vendor.find(filter);
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single vendor by ID
router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor.' });
  }
});

// GET all vendor entries by vendor name using the ID
// GET all vendor entries by vendor name using the ID
router.get('/by-name/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

    const vendorName = vendor.name;

    // Find all vendor documents with the same name
    const allVendorDocs = await Vendor.find({ name: vendorName });

    // Combine all locations into a 'sites' array
    const sites = allVendorDocs.map(v => ({
      site: v.location,
      frequency: v.vendor_order_frequency || '',
    }));

    // Optionally, merge supplies if needed
    // Here we just return the supplies of the current vendor
    res.json({
      name: vendor.name,
      category: vendor.category,
      email_order: vendor.email_order,
      email: vendor.email,
      order_placement_method: vendor.order_placement_method,
      station_supplies: vendor.station_supplies,
      sites,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendors by name.' });
  }
});


// Update a vendor by ID
// router.put('/:id', async (req, res) => {
//   try {
//     const {
//       name,
//       location,
//       station_supplies,
//       email_order,
//       email,
//       order_placement_method,
//       vendor_order_frequency,
//       last_order_date,
//       category,
//     } = req.body;
//     if (!name || !location || !Array.isArray(station_supplies)) {
//       return res.status(400).json({ error: 'Missing required fields.' });
//     }
//     const vendor = await Vendor.findByIdAndUpdate(
//       req.params.id,
//       {
//         name,
//         location,
//         station_supplies,
//         email_order,
//         email,
//         order_placement_method,
//         vendor_order_frequency,
//         last_order_date,
//         category,
//       },
//       { new: true }
//     );
//     if (!vendor) {
//       return res.status(404).json({ error: 'Vendor not found.' });
//     }
//     res.json(vendor);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to update vendor.' });
//   }
// });

router.put('/:id', async (req, res) => {
  try {
    const { name: newName, station_supplies, email_order, email, order_placement_method, category, sites } = req.body;

    if (!newName || !Array.isArray(sites)) {
      return res.status(400).json({ error: 'Vendor name and sites are required.' });
    }

    // Get the vendor name from the provided ID
    const vendorDoc = await Vendor.findById(req.params.id);
    if (!vendorDoc) return res.status(404).json({ error: 'Vendor not found.' });

    const oldName = vendorDoc.name;

    // Fetch all documents for this vendor name
    const allVendorDocs = await Vendor.find({ name: oldName });

    for (const site of sites) {
      const existingDoc = allVendorDocs.find(v => v.location === site.site);

      if (existingDoc) {
        // Update existing document
        existingDoc.name = newName; // update name
        existingDoc.vendor_order_frequency = site.frequency ?? existingDoc.vendor_order_frequency;
        existingDoc.station_supplies = station_supplies || existingDoc.station_supplies;
        existingDoc.email_order = email_order;
        existingDoc.email = email;
        existingDoc.order_placement_method = order_placement_method;
        existingDoc.category = category;
        await existingDoc.save();
      } else {
        // Create new document for new location
        await Vendor.create({
          name: newName,
          location: site.site,
          station_supplies: station_supplies || [],
          email_order,
          email,
          order_placement_method,
          category,
          vendor_order_frequency: site.frequency ?? 0,
        });
      }
    }

    res.json({ message: 'Vendor updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update vendor.' });
  }
});

module.exports = router