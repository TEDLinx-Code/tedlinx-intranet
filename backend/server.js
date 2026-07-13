require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    /\.vercel\.app$/,  // allow all Vercel preview deployments
  ],
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests, please try again later.' },
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Uploads directory ────────────────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/leave', require('./routes/leave.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/directory', require('./routes/directory.routes'));
app.use('/api/documents', require('./routes/documents.routes'));
app.use('/api/payslips', require('./routes/payslip.routes'));
app.use('/api/assets', require('./routes/asset.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/push', require('./routes/push.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/broadcasts', require('./routes/broadcast.routes'));
app.use('/api/tasks', require('./routes/task.routes'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route ${req.originalUrl} not found.` }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── MongoDB + Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('[DB] MongoDB connected');
    // Validate Odoo Intranet folder exists at startup
    require('./services/odoo.service').validateIntranetFolder();
    // Start the daily task due-soon reminder cron
    require('./services/taskReminder.service').start();
    app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));
  })
  .catch(err => {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
