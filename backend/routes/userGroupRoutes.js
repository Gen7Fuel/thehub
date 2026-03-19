const router = require('express').Router();
const UserGroup = require('../models/UserGroup');

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
      const updated = await UserGroup.findByIdAndUpdate(id, { name, description, userIds }, { new: true });
      return res.json(updated);
    }
    const newGroup = new UserGroup({ name, description, userIds, createdBy: req.user._id });
    await newGroup.save();
    res.json(newGroup);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    await UserGroup.findByIdAndDelete(req.params.id);
    res.json({ message: "Group deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;