const express = require('express');
const mongoose = require('mongoose');
const { requireStoreAccess, lookupScanItem, validateBarcode, validateScanLines, buildScanCategories } = require('../services/orderRecScanner');

// Dependencies are passed in so endpoint behavior can be verified without live databases.
function createOrderRecScanRouter({ getPg, Location, Vendor, getPermissionMap, createOrderRec }) {
  const router = express.Router();

  router.get('/item', async (req, res) => {
    try {
      const { site, upc } = req.query;
      requireStoreAccess(req.user, site, getPermissionMap());
      validateBarcode(upc);
      const location = await Location.findOne({ site }).lean();
      if (!location) return res.status(404).json({ message: 'Store not found.' });
      const item = await lookupScanItem(getPg(), location._id, upc);
      return res.json(item);
    } catch (err) {
      if (!err.status) console.error('Order rec barcode lookup failed:', err);
      return res.status(err.status || 500).json({ message: err.status ? err.message : 'Unable to look up this item. Please try again.' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { site, vendor, items } = req.body;
      requireStoreAccess(req.user, site, getPermissionMap());
      validateScanLines(items);
      if (typeof vendor !== 'string' || !mongoose.isValidObjectId(vendor)) {
        return res.status(400).json({ message: 'Select a vendor for this store.' });
      }
      const [location, vendorDoc] = await Promise.all([
        Location.findOne({ site }).lean(),
        Vendor.findOne({ _id: vendor, location: site }).lean(),
      ]);
      if (!location) return res.status(404).json({ message: 'Store not found.' });
      if (!vendorDoc) return res.status(400).json({ message: 'Select a vendor for this store.' });
      const rows = await getPg()('item_bk').where({ site: String(location._id) })
        .whereIn('id', items.map(item => item.id)).select('*');
      req.body = {
        site, vendor, email: req.user.email, source: 'scanner',
        categories: buildScanCategories(rows, items),
      };
      return createOrderRec(req, res);
    } catch (err) {
      if (!err.status) console.error('Creating scanned order rec failed:', err);
      return res.status(err.status || 500).json({ message: err.status ? err.message : 'Unable to create this order. Your items have been kept; please try again.' });
    }
  });

  return router;
}

module.exports = { createOrderRecScanRouter };
