const mongoose = require('mongoose');

const checkoutSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantityRequested: { type: Number, required: true, min: 1 },
  quantityApproved: { type: Number, default: null },
  purpose: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'checked_out', 'return_requested', 'returned'],
    default: 'pending',
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  checkedOutAt: { type: Date, default: null },
  returnRequestedAt: { type: Date, default: null },
  returnConfirmedAt: { type: Date, default: null },
  returnConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Checkout', checkoutSchema);
