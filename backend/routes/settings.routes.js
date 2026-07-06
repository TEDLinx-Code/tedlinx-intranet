const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const Settings = require('../models/Settings');

const router = express.Router();
router.use(protect);

const DEFAULT_ASSET_CATEGORIES = ['Laptop', 'Phone', 'Tablet', 'Instrument', 'Vehicle', 'Furniture', 'Other'];

// Helper: get or create a settings list with defaults
async function getOrCreateList(key, defaults) {
  let doc = await Settings.findOne({ key });
  if (!doc) {
    doc = await Settings.create({ key, values: defaults });
  }
  return doc;
}

// GET /api/settings/asset-categories — anyone logged in can read (needed for dropdowns)
router.get('/asset-categories', async (req, res) => {
  try {
    const doc = await getOrCreateList('assetCategories', DEFAULT_ASSET_CATEGORIES);
    res.json({ categories: doc.values });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch categories.' });
  }
});

// PUT /api/settings/asset-categories — admin/storekeeper updates the full list
router.put('/asset-categories', requireRole('admin', 'storekeeper'), async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: 'Provide a non-empty array of categories.' });
    }
    const cleaned = [...new Set(categories.map(c => c.trim()).filter(Boolean))];
    const doc = await Settings.findOneAndUpdate(
      { key: 'assetCategories' },
      { values: cleaned },
      { new: true, upsert: true }
    );
    res.json({ categories: doc.values, message: 'Categories updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update categories.' });
  }
});

module.exports = router;
