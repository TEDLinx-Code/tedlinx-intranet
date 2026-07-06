const mongoose = require('mongoose');

// Generic key-value settings store for admin-configurable lists
// e.g. { key: 'assetCategories', values: ['Laptop', 'Phone', ...] }
const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  values: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
