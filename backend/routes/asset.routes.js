const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const Asset = require('../models/Asset');
const User = require('../models/User');

const router = express.Router();
router.use(protect);

// GET /api/assets — all assets (storekeeper/admin) or my assets (employee)

router.get('/', async (req, res) => {
  try {
    const isPrivileged = ['admin', 'storekeeper'].includes(req.user.role);
    const query = isPrivileged
      ? { isActive: true }
      : { assignedTo: req.user._id, isActive: true };

    const search = req.query.search;
    if (search && isPrivileged) {
      query.$text = { $search: search };
    }

    const assets = await Asset.find(query)
      .populate('assignedTo', 'name email department jobTitle')
      .sort({ updatedAt: -1 });
    res.json({ assets });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch assets.', detail: err.message });
  }
});

// GET /api/assets/my — employee's own assigned assets
router.get('/my', async (req, res) => {
  try {
    const assets = await Asset.find({ assignedTo: req.user._id, isActive: true, status: 'assigned' })
      .sort({ assignedAt: -1 });
    res.json({ assets });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch your assets.' });
  }
});

// POST /api/assets — create asset (admin/storekeeper)
router.post('/', requireRole('admin', 'storekeeper'), [
  body('name').notEmpty().trim(),
  body('category').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const asset = await Asset.create({
      name: req.body.name,
      category: req.body.category,
      make: req.body.make,
      model: req.body.model,
      serialNumber: req.body.serialNumber,
      assetTag: req.body.assetTag,
      purchaseDate: req.body.purchaseDate || null,
      purchasePrice: req.body.purchasePrice || null,
      notes: req.body.notes,
      status: 'available',
    });
    res.status(201).json({ asset });
  } catch (err) {
    res.status(500).json({ message: 'Could not create asset.', detail: err.message });
  }
});

// PUT /api/assets/:id — update asset details (admin/storekeeper)
router.put('/:id', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const allowed = ['name', 'category', 'make', 'model', 'serialNumber', 'assetTag', 'purchaseDate', 'purchasePrice', 'notes', 'status'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const asset = await Asset.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('assignedTo', 'name email');
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });
    res.json({ asset });
  } catch (err) {
    res.status(500).json({ message: 'Could not update asset.' });
  }
});

// PUT /api/assets/:id/assign — assign to employee (admin/storekeeper)
router.put('/:id/assign', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { assignedTo: userId, assignedAt: new Date(), status: 'assigned' },
      { new: true }
    ).populate('assignedTo', 'name email department');
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });
    res.json({ asset, message: `Asset assigned to ${user.name}.` });
  } catch (err) {
    res.status(500).json({ message: 'Could not assign asset.' });
  }
});

// PUT /api/assets/:id/unassign — return asset to pool (admin/storekeeper)
router.put('/:id/unassign', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { assignedTo: null, assignedAt: null, status: 'available' },
      { new: true }
    );
    if (!asset) return res.status(404).json({ message: 'Asset not found.' });
    res.json({ asset, message: 'Asset returned to pool.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not unassign asset.' });
  }
});

// DELETE /api/assets/:id — soft delete (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Asset.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Asset removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove asset.' });
  }
});

module.exports = router;
