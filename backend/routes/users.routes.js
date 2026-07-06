const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/users  (admin only)
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch users.' });
  }
});

// POST /api/users  (admin creates employee accounts)
router.post(
  '/',
  requireRole('admin'),
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['employee', 'manager', 'storekeeper', 'admin']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const user = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role,
        department: req.body.department,
        jobTitle: req.body.jobTitle,
        phone: req.body.phone,
        odooEmployeeId: req.body.odooEmployeeId || null,
      });
      res.status(201).json({ user });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: 'A user with this email already exists.' });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// PUT /api/users/:id  (admin updates user)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['name', 'role', 'department', 'jobTitle', 'phone', 'odooEmployeeId', 'isActive'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id  (soft delete - deactivate)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
