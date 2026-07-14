const cron = require('node-cron');
const CalendarEvent = require('../models/CalendarEvent');
const push = require('./push.service');

// Runs once a day and notifies tagged users about events starting exactly
// `reminderLeadDays` from today, so a lead time of 1 fires the day before.
async function checkUpcomingEvents() {
  try {
    const events = await CalendarEvent.find({ isActive: true, reminderSent: false })
      .populate('taggedUsers', '_id');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const event of events) {
      const eventDay = new Date(event.dateFrom.getFullYear(), event.dateFrom.getMonth(), event.dateFrom.getDate());
      const daysUntil = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));
      if (daysUntil !== event.reminderLeadDays) continue;

      try {
        const body = `"${event.title}" is coming up on ${event.dateFrom.toDateString()}`;
        if (event.taggedAll) {
          await push.sendPushToAllUsers({ title: 'Upcoming event', body, type: 'calendar_reminder', url: '/calendar' });
        } else {
          await Promise.all(event.taggedUsers.map(u =>
            push.sendPushToUser(u._id, { title: 'Upcoming event', body, type: 'calendar_reminder', url: '/calendar' })
              .catch(e => console.error('[CalendarReminder] Push failed:', e.message))
          ));
        }
        event.reminderSent = true;
        await event.save();
      } catch (err) {
        console.error(`[CalendarReminder] Failed to notify for event ${event._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[CalendarReminder] checkUpcomingEvents error:', err.message);
  }
}

// Schedule: every day at 8:00 AM server time.
function start() {
  cron.schedule('0 8 * * *', checkUpcomingEvents);
  console.log('[CalendarReminder] Event reminder cron scheduled (daily 8:00 AM).');
}

module.exports = { start, checkUpcomingEvents };
