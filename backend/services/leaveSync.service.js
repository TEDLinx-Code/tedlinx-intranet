const cron = require('node-cron');
const odoo = require('./odoo.service');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');

// Mirrors currently-approved Odoo leave onto the calendar as read-only events.
// Odoo has no way to push changes to us, so this polls periodically instead.
// Each leave becomes one CalendarEvent keyed by sourceLeaveId (unique) — re-running
// the sync just upserts existing ones, and any leave no longer in "validate" state
// (refused, reset, cancelled after approval) gets its calendar event deactivated.
async function syncApprovedLeaves() {
  try {
    const leaves = await odoo.getAllApprovedLeaves();
    const users = await User.find({ odooEmployeeId: { $ne: null }, isActive: true }).select('_id odooEmployeeId name');
    const userByOdooId = new Map(users.map(u => [u.odooEmployeeId, u]));

    const seenLeaveIds = [];

    for (const leave of leaves) {
      const empOdooId = Array.isArray(leave.employee_id) ? leave.employee_id[0] : leave.employee_id;
      const user = userByOdooId.get(empOdooId);
      if (!user) continue; // employee not linked to an intranet account yet

      seenLeaveIds.push(leave.id);
      const leaveTypeName = Array.isArray(leave.holiday_status_id) ? leave.holiday_status_id[1] : 'Leave';

      await CalendarEvent.findOneAndUpdate(
        { sourceLeaveId: leave.id },
        {
          title: `${user.name} — ${leaveTypeName}`,
          description: leave.name || '',
          type: 'Leave',
          dateFrom: leave.date_from,
          dateTo: leave.date_to,
          taggedAll: false,
          taggedUsers: [user._id],
          createdBy: user._id,
          isSystemGenerated: true,
          sourceLeaveId: leave.id,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Deactivate any previously-synced leave events that are no longer approved
    const result = await CalendarEvent.updateMany(
      { isSystemGenerated: true, sourceLeaveId: { $nin: seenLeaveIds }, isActive: true },
      { isActive: false }
    );

    console.log(`[LeaveSync] Synced ${seenLeaveIds.length} approved leave(s), deactivated ${result.modifiedCount} stale event(s).`);
  } catch (err) {
    console.error('[LeaveSync] syncApprovedLeaves error:', err.message);
  }
}

// Schedule: every hour, plus once shortly after server startup.
function start() {
  cron.schedule('0 * * * *', syncApprovedLeaves);
  setTimeout(syncApprovedLeaves, 15000); // initial sync shortly after boot
  console.log('[LeaveSync] Leave calendar sync cron scheduled (hourly).');
}

module.exports = { start, syncApprovedLeaves };
