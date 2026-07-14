const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const push = require('../services/push.service');

const router = express.Router();
router.use(protect);

const isManagerOrAdmin = (user) => ['manager', 'admin'].includes(user.role);

// GET /api/calendar/taggable-users — lightweight active user list for the tag picker
router.get('/taggable-users', async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('name email role department').sort({ name: 1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch users.', detail: err.message });
  }
});

// GET /api/calendar?month=YYYY-MM — events visible to the logged-in user for that month
// Visibility: tagged to everyone, tagged to me specifically, created by me, or I'm a manager/admin (see all).
router.get('/', async (req, res) => {
  try {
    const monthParam = req.query.month; // 'YYYY-MM'
    let rangeStart, rangeEnd;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      rangeStart = new Date(y, m - 1, 1);
      rangeEnd = new Date(y, m, 1);
    } else {
      const now = new Date();
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const dateFilter = { dateFrom: { $lt: rangeEnd }, dateTo: { $gte: rangeStart } };
    const visibilityFilter = isManagerOrAdmin(req.user)
      ? {}
      : { $or: [{ taggedAll: true }, { taggedUsers: req.user._id }, { createdBy: req.user._id }] };

    const events = await CalendarEvent.find({ isActive: true, ...dateFilter, ...visibilityFilter })
      .populate('createdBy', 'name')
      .populate('taggedUsers', 'name')
      .sort({ dateFrom: 1 });

    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch calendar events.', detail: err.message });
  }
});

// POST /api/calendar — create an event
router.post(
  '/',
  [
    body('title').notEmpty().trim(),
    body('type').isIn(['Project', 'Office', 'Administrative']), // 'Leave' is system-generated only
    body('dateFrom').isISO8601(),
    body('dateTo').isISO8601(),
    body('reminderLeadDays').optional().isInt({ min: 0, max: 30 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (new Date(req.body.dateTo) < new Date(req.body.dateFrom)) {
        return res.status(400).json({ message: 'End date must be on or after the start date.' });
      }

      const taggedAll = !!req.body.taggedAll;
      let taggedUsers = [];
      if (!taggedAll && Array.isArray(req.body.taggedUsers)) {
        const valid = await User.find({ _id: { $in: req.body.taggedUsers }, isActive: true }).select('_id');
        taggedUsers = valid.map(u => u._id);
      }

      const event = await CalendarEvent.create({
        title: req.body.title,
        description: req.body.description || '',
        type: req.body.type,
        dateFrom: req.body.dateFrom,
        dateTo: req.body.dateTo,
        taggedAll,
        taggedUsers,
        reminderLeadDays: req.body.reminderLeadDays ?? 1,
        createdBy: req.user._id,
      });

      // Notify tagged users (skip the creator themselves)
      try {
        const body = `${req.user.name} added "${event.title}" to the calendar`;
        if (taggedAll) {
          await push.sendPushToAllUsers({ title: 'New calendar event', body, type: 'calendar_event', url: '/calendar' });
        } else {
          await Promise.all(taggedUsers
            .filter(id => String(id) !== String(req.user._id))
            .map(id => push.sendPushToUser(id, { title: 'New calendar event', body, type: 'calendar_event', url: '/calendar' })
              .catch(e => console.error('[Calendar] Push failed:', e.message))));
        }
      } catch (pushErr) {
        console.error('[Calendar] Notify failed:', pushErr.message);
      }

      const populated = await CalendarEvent.findById(event._id).populate('createdBy', 'name').populate('taggedUsers', 'name');
      res.status(201).json({ message: 'Event created.', event: populated });
    } catch (err) {
      res.status(500).json({ message: 'Could not create event.', detail: err.message });
    }
  }
);

// PUT /api/calendar/:id — edit an event (creator or manager/admin only; system-generated events are read-only)
router.put('/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findOne({ _id: req.params.id, isActive: true });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.isSystemGenerated) return res.status(400).json({ message: 'This event is auto-generated from leave and cannot be edited.' });

    const canEdit = isManagerOrAdmin(req.user) || String(event.createdBy) === String(req.user._id);
    if (!canEdit) return res.status(403).json({ message: 'You do not have permission to edit this event.' });

    const allowed = ['title', 'description', 'type', 'dateFrom', 'dateTo', 'taggedAll', 'reminderLeadDays'];
    allowed.forEach(k => { if (req.body[k] !== undefined) event[k] = req.body[k]; });
    if (Array.isArray(req.body.taggedUsers)) event.taggedUsers = req.body.taggedUsers;
    await event.save();

    const populated = await CalendarEvent.findById(event._id).populate('createdBy', 'name').populate('taggedUsers', 'name');
    res.json({ message: 'Event updated.', event: populated });
  } catch (err) {
    res.status(500).json({ message: 'Could not update event.', detail: err.message });
  }
});

// DELETE /api/calendar/:id — soft delete (creator or manager/admin; system-generated events are protected)
router.delete('/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findOne({ _id: req.params.id, isActive: true });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.isSystemGenerated && !isManagerOrAdmin(req.user)) {
      return res.status(403).json({ message: 'Only a manager or admin can remove a leave-synced event.' });
    }

    const canDelete = isManagerOrAdmin(req.user) || String(event.createdBy) === String(req.user._id);
    if (!canDelete) return res.status(403).json({ message: 'You do not have permission to delete this event.' });

    event.isActive = false;
    await event.save();
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete event.', detail: err.message });
  }
});

module.exports = router;
