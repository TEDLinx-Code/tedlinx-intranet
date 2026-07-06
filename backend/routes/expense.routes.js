const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const odoo = require('../services/odoo.service');
const email = require('../services/email.service');
const push = require('../services/push.service');
const User = require('../models/User');

const router = express.Router();
router.use(protect);

// Multer config for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt_${req.user._id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and PDF files are allowed.'));
  },
});

// GET /api/expenses/categories  — product list from Odoo (expense-able products)
router.get('/categories', async (req, res) => {
  try {
    const categories = await odoo.getExpenseCategories();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch expense categories.', detail: err.message });
  }
});

// GET /api/expenses/my
router.get('/my', async (req, res) => {
  try {
    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Account not linked to Odoo. Contact admin.' });
    }
    const expenses = await odoo.getExpenses(req.user.odooEmployeeId);
    res.json({ expenses });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch expenses.', detail: err.message });
  }
});

// POST /api/expenses  — submit new expense with optional receipt
router.post(
  '/',
  upload.single('receipt'),
  [
    body('name').notEmpty().trim(),
    body('productId').isNumeric(),
    body('totalAmount').isFloat({ min: 0.01 }),
    body('date').isDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Account not linked to Odoo. Contact admin.' });
    }
    try {
      const { name, productId, totalAmount, date, description } = req.body;
      const result = await odoo.createExpense({
        employeeOdooId: req.user.odooEmployeeId,
        name,
        productId: parseInt(productId),
        totalAmount: parseFloat(totalAmount),
        date,
        description,
      });

      // Notify manager
      try {
        const manager = await User.findOne({ role: 'manager', isActive: true, department: req.user.department });
        if (manager) {
          await email.notifyManagerExpense({
            managerEmail: manager.email,
            managerName: manager.name,
            employeeName: req.user.name,
            expenseName: name,
            amount: parseFloat(totalAmount).toFixed(2),
            currency: '₹',
            date,
          });
        }
      } catch (emailErr) {
        console.error('[Expense] Email notification failed:', emailErr.message);
      }

      res.status(201).json({ message: 'Expense submitted successfully.', ...result });
    } catch (err) {
      res.status(500).json({ message: 'Could not submit expense.', detail: err.message });
    }
  }
);

// GET /api/expenses/team  — manager view
router.get('/team', requireRole('manager', 'admin'), async (req, res) => {
  try {
    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Manager account not linked to Odoo.' });
    }
    const expenses = await odoo.getTeamExpenses(req.user.odooEmployeeId);
    res.json({ expenses });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch team expenses.', detail: err.message });
  }
});

// PUT /api/expenses/:id/approve  — approve expense sheet
router.put('/:id/approve', requireRole('manager', 'admin'), async (req, res) => {
  try {
    await odoo.approveExpenseSheet(parseInt(req.params.id));

    // Find the employee by their Odoo ID
    const employee = await User.findOne({
      odooEmployeeId: req.body.employeeOdooId,
      isActive: true,
    });

    // Send push notification
    try {
      if (employee) {
        await push.sendPushToUser(employee._id, {
          title: 'Expense Approved 💰',
          body: `Your expense claim${req.body.expenseName ? ` "${req.body.expenseName}"` : ''} has been approved.`,
          type: 'expense_approved',
          url: '/expenses',
        });
      }
    } catch (pushErr) {
      console.error('[Expense] Approval push failed:', pushErr.message);
    }

    res.json({ message: 'Expense approved.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not approve expense.', detail: err.message });
  }
});

// PUT /api/expenses/:id/refuse
router.put('/:id/refuse', requireRole('manager', 'admin'), async (req, res) => {
  try {
    await odoo.refuseExpenseSheet(parseInt(req.params.id), req.body.reason);
    
    // Find the employee by their Odoo ID
    const employee = await User.findOne({
      odooEmployeeId: req.body.employeeOdooId,
      isActive: true,
    });

    // Send push notification
    try {
      if (employee) {
        await push.sendPushToUser(employee._id, {
          title: 'Expense Refused ❌',
          body: `Your expense claim${req.body.expenseName ? ` "${req.body.expenseName}"` : ''} has been refused.`,
          type: 'expense_refused',
          url: '/expenses',
        });
      }
    } catch (pushErr) {
      console.error('[Expense] Refusal push failed:', pushErr.message);
    }

    res.json({ message: 'Expense refused.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not refuse expense.', detail: err.message });
  }
});

module.exports = router;
