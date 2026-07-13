const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Completed'], default: 'Open' },
    percentComplete: { type: Number, min: 0, max: 100, default: 0 },
    dueSoonNotified: { type: Boolean, default: false }, // prevents duplicate due-soon push per task
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, isActive: 1 });
taskSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
