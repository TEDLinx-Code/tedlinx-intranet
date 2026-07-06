const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const Broadcast = require('../models/Broadcast');
const push = require('../services/push.service');

const router = express.Router();
router.use(protect);

// A small curated set of quotes shown when there's no active broadcast.
// Picked to be safe, professional, and workplace-appropriate.
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'Alone we can do so little; together we can do so much.', author: 'Helen Keller' },
  { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'Teamwork is the ability to work together toward a common vision.', author: 'Andrew Carnegie' },
  { text: 'Do not watch the clock. Do what it does — keep going.', author: 'Sam Levenson' },
  { text: 'Great things in business are never done by one person.', author: 'Steve Jobs' },
];

// GET /api/broadcasts/current — the active broadcast right now, or a random quote
router.get('/current', async (req, res) => {
  try {
    const now = new Date();
    const active = await Broadcast.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    if (active) {
      return res.json({ type: 'broadcast', broadcast: active });
    }

    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    res.json({ type: 'quote', quote });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch broadcast.' });
  }
});

// GET /api/broadcasts — all broadcasts, for admin management
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ broadcasts });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch broadcasts.' });
  }
});

// POST /api/broadcasts — admin creates a new broadcast
router.post('/', requireRole('admin'), [
  body('message').notEmpty().trim(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
      return res.status(400).json({ message: 'End date must be after start date.' });
    }
    const broadcast = await Broadcast.create({
      message: req.body.message,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      createdBy: req.user._id,
    });

    // Send push to all employees immediately if broadcast starts now or in the past
    const startsNow = new Date(req.body.startDate) <= new Date();
    if (startsNow) {
      push.sendPushToAllUsers({
        title: '📢 Company Announcement',
        body: req.body.message.length > 100
          ? req.body.message.slice(0, 97) + '…'
          : req.body.message,
        type: 'broadcast',
        url: '/',
      }).catch(err => console.error('[Broadcast] Push failed:', err.message));
    }

    res.status(201).json({ broadcast, message: 'Broadcast created.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not create broadcast.' });
  }
});

// PUT /api/broadcasts/:id — admin edits a broadcast
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['message', 'startDate', 'endDate', 'isActive'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const broadcast = await Broadcast.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!broadcast) return res.status(404).json({ message: 'Broadcast not found.' });
    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ message: 'Could not update broadcast.' });
  }
});

// DELETE /api/broadcasts/:id — admin removes a broadcast
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Broadcast.findByIdAndDelete(req.params.id);
    res.json({ message: 'Broadcast removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove broadcast.' });
  }
});

module.exports = router;
