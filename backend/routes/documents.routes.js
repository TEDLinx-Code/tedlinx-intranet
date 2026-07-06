const express = require('express');
const { protect } = require('../middleware/auth');
const odoo = require('../services/odoo.service');

const router = express.Router();
router.use(protect);

// GET /api/documents/folders  — Intranet root + its subfolders
router.get('/folders', async (req, res) => {
  try {
    const result = await odoo.getDocumentFolders();
    res.json(result); // { root: {...}, subfolders: [...] }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents  — list documents, optional ?folderId=&search=
router.get('/', async (req, res) => {
  try {
    const { folderId, search } = req.query;
    const documents = await odoo.getDocuments({
      folderId: folderId ? parseInt(folderId) : null,
      search: search || null,
    });
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch documents from Odoo.', detail: err.message });
  }
});

// GET /api/documents/tags
router.get('/tags', async (req, res) => {
  try {
    const tags = await odoo.getDocumentTags();
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch document tags.', detail: err.message });
  }
});

// GET /api/documents/:id/download  — redirect to Odoo download URL
router.get('/:id/download', async (req, res) => {
  try {
    const url = await odoo.getDocumentDownloadUrl(parseInt(req.params.id));
    // Redirect the browser to the Odoo download endpoint
    // The employee's browser will handle the download directly from Odoo
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ message: 'Could not get download link.', detail: err.message });
  }
});

module.exports = router;
