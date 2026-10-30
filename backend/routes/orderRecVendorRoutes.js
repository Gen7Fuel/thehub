const express = require('express');
const mongoose = require('mongoose');
const { requireOrderRecPermission, requireStoreAccess } = require('../services/orderRecScanner');
const { logChange } = require('../middleware/changeLogger');

function createOrderRecVendorRouter({ OrderRec, Vendor, getPermissionMap, recordChange = logChange }) {
  const router = express.Router();
  router.patch('/:id/vendor', async (req, res) => {
    try {
      requireOrderRecPermission(req.user, getPermissionMap(), 'orderRec.workflow');
      const { vendor } = req.body;
      if (!mongoose.isValidObjectId(req.params.id) || typeof vendor !== 'string' || !mongoose.isValidObjectId(vendor)) {
        return res.status(400).json({ message: 'A valid order rec and vendor are required.' });
      }
      const order = await OrderRec.findById(req.params.id).lean();
      if (!order) return res.status(404).json({ message: 'Order rec not found.' });
      requireStoreAccess(req.user, order.site, getPermissionMap(), 'orderRec.workflow');
      if (order.source !== 'scanner' || order.vendor || order.orderPlaced || order.delivered ||
          ['Placed', 'Delivered', 'Invoice Received'].includes(order.currentStatus)) {
        return res.status(409).json({ message: 'Only an unassigned store-created order can be assigned a vendor.' });
      }
      const vendorDoc = await Vendor.findOne({ _id: vendor, location: order.site }).lean();
      if (!vendorDoc) return res.status(400).json({ message: 'Select a vendor for this store.' });
      // Check again in the write: two reviewers must not overwrite each other.
      const updated = await OrderRec.findOneAndUpdate({
        _id: order._id, source: 'scanner', vendor: { $in: ['', null] },
        orderPlaced: { $ne: true }, delivered: { $ne: true },
        currentStatus: { $nin: ['Placed', 'Delivered', 'Invoice Received'] },
      }, { $set: {
        vendor,
        filename: OrderRec.buildFilename(vendorDoc.name, order.createdAt, order.integerId),
      } }, { new: true, runValidators: true });
      if (!updated) return res.status(409).json({ message: 'This order changed while assigning its vendor. Refresh and try again.' });
      await recordChange(req, {
        action: 'update', resourceType: 'order-rec', resourceId: updated._id,
        resourceStore: 'mongodb', success: true, statusCode: 200,
        source: req.headers['x-action-source'] || 'order-rec.workflow',
        message: `Order Rec ${updated.filename || updated.integerId || updated._id} assigned to ${vendorDoc.name}`,
        before: order, after: typeof updated.toObject === 'function' ? updated.toObject() : updated,
      });
      const io = req.app.get('io');
      if (io) io.emit('orderUpdated', updated);
      return res.json(updated);
    } catch (error) {
      if (!error.status) console.error('Order rec vendor assignment failed:', error);
      return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to assign vendor. Please refresh and try again.' });
    }
  });
  return router;
}

module.exports = { createOrderRecVendorRouter };
