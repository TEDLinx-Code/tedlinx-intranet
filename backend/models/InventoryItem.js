const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['Electrical', 'Instrument', 'PPE', 'Consumable', 'Mechanical', 'Other'], default: 'Other' },
  make: { type: String, trim: true },
  partNumber: { type: String, trim: true },
  specifications: { type: String, trim: true },
  totalQuantity: { type: Number, required: true, default: 0, min: 0 },
  availableQuantity: { type: Number, required: true, default: 0, min: 0 },
  location: { type: String, trim: true }, // e.g. "Shelf A, Bin 3"
  project: { type: String, trim: true }, // groups items by project
  unit: { type: String, trim: true, default: 'pcs' },
  minimumStock: { type: Number, default: 0 }, // alert threshold
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Text index for search
inventoryItemSchema.index({ name: 'text', make: 'text', partNumber: 'text', specifications: 'text', category: 'text', project: 'text' });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
