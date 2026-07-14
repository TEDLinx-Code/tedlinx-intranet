const express = require('express');
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(protect);

// GET /api/notifications — most recent notifications for the logged-in user
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch notifications.', detail: err.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch unread count.', detail: err.message });
  }
});

// PUT /api/notifications/:id/read — mark a single notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ notification });
  } catch (err) {
    res.status(500).json({ message: 'Could not update notification.', detail: err.message });
  }
});

// PUT /api/notifications/read-all — mark every unread notification as read
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update notifications.', detail: err.message });
  }
});

module.exports = router;
