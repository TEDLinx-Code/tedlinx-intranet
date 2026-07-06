const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true, default: 'Other' },
  make: { type: String, trim: true },
  model: { type: String, trim: true },
  serialNumber: { type: String, trim: true },
  assetTag: { type: String, trim: true },
  purchaseDate: { type: Date },
  purchasePrice: { type: Number },
  status: { type: String, enum: ['available', 'assigned', 'under_repair', 'retired'], default: 'available' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt: { type: Date, default: null },
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Text index for search
assetSchema.index({ name: 'text', make: 'text', model: 'text', serialNumber: 'text', assetTag: 'text' });

module.exports = mongoose.model('Asset', assetSchema);
