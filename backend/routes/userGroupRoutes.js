const router = require('express').Router();
const UserGroup = require('../models/UserGroup');
const { logChange } = require('../middleware/changeLogger');

const requestSource = (req) => req.headers['x-action-source'] || 'notifications';

// Get all groups
router.get('/', async (req, res) => {
  try {
    const groups = await UserGroup.find().populate('userIds', 'firstName lastName email is_active');
    res.json(groups);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create or Update group
router.post('/', async (req, res) => {
  const { name, description, userIds } = req.body;
  const id = req.body.id || req.body._id;
  try {
    // if (id) {
    //   // This performs the update
    //   const updated = await UserGroup.findByIdAndUpdate(id, { name, description, userIds }, { new: true });
    //   return res.json(updated);
    // }
    if (id) {
      const before = await UserGroup.findById(id).lean();
      const updated = await UserGroup.findByIdAndUpdate(id, { name, description, userIds }, { new: true });
      if (!updated) return res.status(404).json({ message: 'Group not found' });
      await logChange(req, {
        action: 'update', resourceType: 'notification-user-group',
        resourceId: updated?._id || id, resourceStore: 'mongodb',
        success: true, statusCode: 200, source: requestSource(req),
        message: `Notification recipient group ${updated?.name || name} updated`,
        before, after: updated,
      });
      return res.json(updated);
    }
    const newGroup = new UserGroup({ name, description, userIds, createdBy: req.user._id });
    await newGroup.save();
    await logChange(req, {
      action: 'create', resourceType: 'notification-user-group',
      resourceId: newGroup._id, resourceStore: 'mongodb',
      success: true, statusCode: 200, source: requestSource(req),
      message: `Notification recipient group ${newGroup.name} created`,
      before: null, after: newGroup,
    });
    res.json(newGroup);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await UserGroup.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Group not found' });
    await logChange(req, {
      action: 'delete', resourceType: 'notification-user-group',
      resourceId: deleted._id, resourceStore: 'mongodb',
      success: true, statusCode: 200, source: requestSource(req),
      message: `Notification recipient group ${deleted.name} deleted`,
      before: deleted, after: null,
    });
    res.json({ message: "Group deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
