const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: { type: String, enum: ['Project', 'Office', 'Administrative', 'Leave'], default: 'Office' },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    taggedAll: { type: Boolean, default: false },
    taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reminderLeadDays: { type: Number, default: 1, min: 0, max: 30 },
    reminderSent: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Set for events auto-generated from an approved Odoo leave request — these are
    // read-only in the UI and kept in sync by the leave-sync cron job.
    isSystemGenerated: { type: Boolean, default: false },
    // Odoo hr.leave id, unique when set. IMPORTANT: no `default` here — a sparse+unique
    // index only skips documents where the field is truly absent, not documents where
    // it's explicitly null. Giving this a default of null would put sourceLeaveId:null
    // on every manually-created event, and the second one would fail with a duplicate
    // key error against the first (this was exactly the bug that broke event creation).
    sourceLeaveId: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

calendarEventSchema.index({ dateFrom: 1, dateTo: 1 });
calendarEventSchema.index({ taggedUsers: 1 });
calendarEventSchema.index({ sourceLeaveId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
