const mongoose = require('mongoose');

const taskLogSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, required: true, trim: true },
    percentComplete: { type: Number, min: 0, max: 100, required: true },
  },
  { timestamps: true }
);

taskLogSchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model('TaskLog', taskLogSchema);
