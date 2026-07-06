const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const InventoryItem = require('../models/InventoryItem');
const Checkout = require('../models/Checkout');

const router = express.Router();
router.use(protect);

// In-memory storage for the uploaded Excel file (not saved to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const EXCEL_COLUMNS = ['Name', 'Category', 'Make', 'Part Number', 'Specifications', 'Project', 'Total Quantity', 'Unit', 'Location', 'Minimum Stock'];
const VALID_CATEGORIES = ['Electrical', 'Instrument', 'PPE', 'Consumable', 'Mechanical', 'Other'];

// ─── INVENTORY ITEMS ──────────────────────────────────────────────────────────

// GET /api/inventory — browse items (all employees)
router.get('/', async (req, res) => {
  try {
    const query = { isActive: true };
    const { search, category, project } = req.query;
    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (project) query.project = project;

    const items = await InventoryItem.find(query).sort({ category: 1, name: 1 });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch inventory.', detail: err.message });
  }
});

// GET /api/inventory/projects — distinct list of project names (for filter dropdown)
router.get('/projects', async (req, res) => {
  try {
    const projects = await InventoryItem.distinct('project', { isActive: true, project: { $nin: [null, ''] } });
    res.json({ projects: projects.sort() });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch projects.' });
  }
});

// GET /api/inventory/export — download all items as Excel (storekeeper/admin)
router.get('/export', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const items = await InventoryItem.find({ isActive: true }).sort({ category: 1, name: 1 });

    const rows = items.map(i => ({
      'Name': i.name,
      'Category': i.category,
      'Make': i.make || '',
      'Part Number': i.partNumber || '',
      'Specifications': i.specifications || '',
      'Project': i.project || '',
      'Total Quantity': i.totalQuantity,
      'Available Quantity': i.availableQuantity,
      'Unit': i.unit,
      'Location': i.location || '',
      'Minimum Stock': i.minimumStock,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
      { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-export-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Could not export inventory.', detail: err.message });
  }
});

// GET /api/inventory/template — download blank upload template (storekeeper/admin)
router.get('/template', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const sample = [{
      'Name': 'Phoenix Connector', 'Category': 'Electrical', 'Make': 'Phoenix Contact',
      'Part Number': 'ST-1.5', 'Specifications': '1.5mm² screw terminal', 'Project': 'Project Alpha',
      'Total Quantity': 50, 'Unit': 'pcs', 'Location': 'Shelf A, Bin 3', 'Minimum Stock': 10,
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = EXCEL_COLUMNS.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-upload-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Could not generate template.' });
  }
});

// POST /api/inventory/import — bulk upload items from Excel (storekeeper/admin)
router.post('/import', requireRole('admin', 'storekeeper'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) return res.status(400).json({ message: 'The uploaded file has no data rows.' });

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, Excel is 1-indexed

      const name = String(row['Name'] || '').trim();
      const category = String(row['Category'] || '').trim();
      const totalQuantity = parseInt(row['Total Quantity']);

      if (!name) { errors.push(`Row ${rowNum}: Name is required.`); continue; }
      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`Row ${rowNum}: Category "${category}" is invalid. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
        continue;
      }
      if (isNaN(totalQuantity) || totalQuantity < 0) {
        errors.push(`Row ${rowNum}: Total Quantity must be a number ≥ 0.`);
        continue;
      }

      try {
        const item = await InventoryItem.create({
          name,
          category,
          make: String(row['Make'] || '').trim(),
          partNumber: String(row['Part Number'] || '').trim(),
          specifications: String(row['Specifications'] || '').trim(),
          project: String(row['Project'] || '').trim(),
          totalQuantity,
          availableQuantity: totalQuantity,
          unit: String(row['Unit'] || 'pcs').trim(),
          location: String(row['Location'] || '').trim(),
          minimumStock: parseInt(row['Minimum Stock']) || 0,
        });
        created.push(item.name);
      } catch (createErr) {
        errors.push(`Row ${rowNum}: ${createErr.message}`);
      }
    }

    res.json({
      message: `${created.length} item(s) imported successfully.${errors.length ? ` ${errors.length} row(s) had errors.` : ''}`,
      createdCount: created.length,
      errors,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not process the uploaded file.', detail: err.message });
  }
});

// POST /api/inventory — add item (storekeeper/admin)
router.post('/', requireRole('admin', 'storekeeper'), [
  body('name').notEmpty().trim(),
  body('category').notEmpty(),
  body('totalQuantity').isInt({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const qty = parseInt(req.body.totalQuantity);
    const item = await InventoryItem.create({
      name: req.body.name,
      category: req.body.category,
      make: req.body.make,
      partNumber: req.body.partNumber,
      specifications: req.body.specifications,
      totalQuantity: qty,
      availableQuantity: qty,
      location: req.body.location,
      project: req.body.project,
      unit: req.body.unit || 'pcs',
      minimumStock: req.body.minimumStock || 0,
    });
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ message: 'Could not add item.', detail: err.message });
  }
});

// PUT /api/inventory/:id — update item (storekeeper/admin)
router.put('/:id', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const allowed = ['name', 'category', 'make', 'partNumber', 'specifications', 'location', 'project', 'unit', 'minimumStock'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // If total quantity changed, adjust available proportionally
    if (req.body.totalQuantity !== undefined) {
      const item = await InventoryItem.findById(req.params.id);
      const diff = parseInt(req.body.totalQuantity) - item.totalQuantity;
      updates.totalQuantity = parseInt(req.body.totalQuantity);
      updates.availableQuantity = Math.max(0, item.availableQuantity + diff);
    }

    const item = await InventoryItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ message: 'Could not update item.' });
  }
});

// DELETE /api/inventory/:id — soft delete (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await InventoryItem.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Item removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove item.' });
  }
});

// ─── CHECKOUT REQUESTS ────────────────────────────────────────────────────────

// GET /api/inventory/checkouts/my — employee's own checkouts
router.get('/checkouts/my', async (req, res) => {
  try {
    const checkouts = await Checkout.find({ requestedBy: req.user._id })
      .populate('item', 'name category make partNumber unit')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ checkouts });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch your checkouts.' });
  }
});

// GET /api/inventory/checkouts — all pending checkouts (storekeeper/admin)
router.get('/checkouts', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : { status: { $in: ['pending', 'return_requested'] } };
    const checkouts = await Checkout.find(query)
      .populate('item', 'name category make partNumber unit')
      .populate('requestedBy', 'name email department')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ checkouts });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch checkouts.' });
  }
});

// POST /api/inventory/checkouts — employee raises checkout request
router.post('/checkouts', [
  body('itemId').notEmpty(),
  body('quantityRequested').isInt({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const item = await InventoryItem.findById(req.body.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    if (item.availableQuantity < req.body.quantityRequested) {
      return res.status(400).json({ message: `Only ${item.availableQuantity} ${item.unit} available.` });
    }

    const checkout = await Checkout.create({
      item: req.body.itemId,
      requestedBy: req.user._id,
      quantityRequested: req.body.quantityRequested,
      purpose: req.body.purpose,
    });

    await checkout.populate('item', 'name category unit');
    res.status(201).json({ checkout, message: 'Checkout request submitted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit checkout request.' });
  }
});

// PUT /api/inventory/checkouts/:id/approve — storekeeper approves
router.put('/checkouts/:id/approve', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const checkout = await Checkout.findById(req.params.id).populate('item');
    if (!checkout) return res.status(404).json({ message: 'Checkout not found.' });
    if (checkout.status !== 'pending') return res.status(400).json({ message: 'Request is not pending.' });

    const qtyApproved = req.body.quantityApproved
      ? parseInt(req.body.quantityApproved)
      : checkout.quantityRequested;

    // Reduce available stock
    await InventoryItem.findByIdAndUpdate(checkout.item._id, {
      $inc: { availableQuantity: -qtyApproved },
    });

    await Checkout.findByIdAndUpdate(req.params.id, {
      status: 'checked_out',
      quantityApproved: qtyApproved,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      checkedOutAt: new Date(),
    });

    res.json({ message: 'Checkout approved and item issued.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not approve checkout.' });
  }
});

// PUT /api/inventory/checkouts/:id/reject — storekeeper rejects
router.put('/checkouts/:id/reject', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const checkout = await Checkout.findById(req.params.id);
    if (!checkout) return res.status(404).json({ message: 'Checkout not found.' });
    await Checkout.findByIdAndUpdate(req.params.id, {
      status: 'rejected',
      approvedBy: req.user._id,
      approvedAt: new Date(),
      notes: req.body.reason || '',
    });
    res.json({ message: 'Checkout request rejected.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not reject checkout.' });
  }
});

// PUT /api/inventory/checkouts/:id/request-return — employee requests return
router.put('/checkouts/:id/request-return', async (req, res) => {
  try {
    const checkout = await Checkout.findById(req.params.id);
    if (!checkout) return res.status(404).json({ message: 'Checkout not found.' });
    if (checkout.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your checkout.' });
    }
    if (checkout.status !== 'checked_out') {
      return res.status(400).json({ message: 'Item is not currently checked out.' });
    }
    await Checkout.findByIdAndUpdate(req.params.id, {
      status: 'return_requested',
      returnRequestedAt: new Date(),
    });
    res.json({ message: 'Return request submitted. Storekeeper will confirm receipt.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit return request.' });
  }
});

// PUT /api/inventory/checkouts/:id/confirm-return — storekeeper confirms receipt
router.put('/checkouts/:id/confirm-return', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const checkout = await Checkout.findById(req.params.id).populate('item');
    if (!checkout) return res.status(404).json({ message: 'Checkout not found.' });
    if (checkout.status !== 'return_requested') {
      return res.status(400).json({ message: 'No return request pending.' });
    }

    // Restore available stock
    await InventoryItem.findByIdAndUpdate(checkout.item._id, {
      $inc: { availableQuantity: checkout.quantityApproved || checkout.quantityRequested },
    });

    await Checkout.findByIdAndUpdate(req.params.id, {
      status: 'returned',
      returnConfirmedAt: new Date(),
      returnConfirmedBy: req.user._id,
    });

    res.json({ message: 'Return confirmed. Stock updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not confirm return.' });
  }
});

module.exports = router;
