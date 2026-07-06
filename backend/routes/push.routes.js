const express = require('express');
const { protect } = require('../middleware/auth');
const DeviceToken = require('../models/DeviceToken');

const router = express.Router();
router.use(protect);

// POST /api/push/register — save FCM token for logged-in user
router.post('/register', async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required.' });

    // Upsert token for current user — allow same token for multiple users
    // (in production each employee has their own device)
    await DeviceToken.findOneAndUpdate(
      { token, user: req.user._id },
      {
        token,
        user: req.user._id,
        platform: platform || 'web',
        userAgent: req.headers['user-agent'],
        lastSeen: new Date(),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Device registered for push notifications.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not register device.', detail: err.message });
  }
});

// DELETE /api/push/deregister — remove token when user logs out
router.delete('/deregister', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required.' });
    await DeviceToken.findOneAndUpdate(
      { token, user: req.user._id },
      { isActive: false }
    );
    res.json({ message: 'Device deregistered.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not deregister device.' });
  }
});

module.exports = router;