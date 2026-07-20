const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid email or password format.' });
    }
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email, isActive: true }).select('+password');
      if (!user || !user.password) {
        // Covers both "no such user" and "account exists but has no password hash"
        // (the latter would otherwise throw inside bcrypt.compare below).
        return res.status(401).json({ message: 'Incorrect email or password.' });
      }
      if (!(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Incorrect email or password.' });
      }
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      const token = signToken(user._id);
      res.json({
        token,
        user: user.toJSON(),
      });
    } catch (err) {
      console.error('[Auth] Login error for', req.body?.email, ':', err.message);
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/change-password
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
    try {
      const user = await User.findById(req.user._id).select('+password');
      if (!(await user.comparePassword(req.body.currentPassword))) {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }
      user.password = req.body.newPassword;
      user.passwordChangedAt = new Date();
      await user.save();
      res.json({ message: 'Password updated successfully.' });
    } catch (err) {
      console.error('[Auth] Change-password error for user', req.user?._id, ':', err.message);
      res.status(500).json({ message: 'Could not update password.' });
    }
  }
);

// POST /api/auth/seed-admin  (run once to create first admin — disable in production)
router.post('/seed-admin', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Not available in production.' });
  }
  try {
    const existing = await User.findOne({ role: 'admin' });
    if (existing) return res.json({ message: 'Admin already exists.', email: existing.email });
    const admin = await User.create({
      name: 'Admin',
      email: req.body.email || 'admin@yourcompany.com',
      password: req.body.password || 'Admin@1234',
      role: 'admin',
    });
    res.status(201).json({ message: 'Admin created.', email: admin.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
