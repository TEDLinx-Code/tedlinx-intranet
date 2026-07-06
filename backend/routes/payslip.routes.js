const express = require('express');
const { protect } = require('../middleware/auth');
const odoo = require('../services/odoo.service');

const router = express.Router();
router.use(protect);

// GET /api/payslips  — employee's own payslips
router.get('/', async (req, res) => {
  try {
    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Account not linked to Odoo. Contact admin.' });
    }
    const payslips = await odoo.getPayslips(req.user.odooEmployeeId);
    res.json({ payslips });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch payslips.', detail: err.message });
  }
});

// GET /api/payslips/:id/lines  — salary lines for a specific payslip
router.get('/:id/lines', async (req, res) => {
  try {
    const lines = await odoo.getPayslipLines(parseInt(req.params.id));
    res.json({ lines });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch payslip details.', detail: err.message });
  }
});

// GET /api/payslips/:id/download  — redirect to Odoo PDF
router.get('/:id/download', async (req, res) => {
  try {
    const url = await odoo.getPayslipDownloadUrl(parseInt(req.params.id));
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ message: 'Could not get download link.', detail: err.message });
  }
});

module.exports = router;
