const express = require('express');
const router = express.Router();
const BulletinPost = require('../models/BulletinPost');

// GET /api/bulletin?site=... — list posts for a site
router.get('/', async (req, res) => {
  try {
    const site = (req.query.site || req.user?.stationName || '').trim();
    if (!site) {
      return res.status(400).json({ success: false, message: 'Site is required.' });
    }

    const posts = await BulletinPost.find({ site }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Bulletin list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load bulletin posts.' });
  }
});

// POST /api/bulletin — create a new post for the user's site
router.post('/', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Post text is required.' });
    }

    const site = (req.user?.stationName || '').trim();
    if (!site) {
      return res.status(400).json({ success: false, message: 'User has no associated site.' });
    }

    const post = await BulletinPost.create({
      site,
      text: String(text).trim(),
      author: {
        id: req.user._id,
        firstName: req.user.firstName || '',
        lastName: req.user.lastName || '',
      },
    });

    res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error('Bulletin create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create bulletin post.' });
  }
});

// DELETE /api/bulletin/:id — author or admin can delete
router.delete('/:id', async (req, res) => {
  try {
    const post = await BulletinPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    const isAuthor = String(post.author?.id) === String(req.user._id);
    const isAdmin = !!req.user?.is_admin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete this post.' });
    }

    await post.deleteOne();
    res.json({ success: true, _id: req.params.id });
  } catch (error) {
    console.error('Bulletin delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete bulletin post.' });
  }
});

module.exports = router;
