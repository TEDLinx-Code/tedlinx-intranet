const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, requireRole } = require('../middleware/auth');
const odoo = require('../services/odoo.service');
const email = require('../services/email.service');
const push = require('../services/push.service');
const User = require('../models/User');

const router = express.Router();
router.use(protect);

// GET /api/leave/types
router.get('/types', async (req, res) => {
  try {
    const types = await odoo.getLeaveTypes();
    res.json({ types });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch leave types from Odoo.', detail: err.message });
  }
});

// GET /api/leave/balance  — employee's leave allocation summary
router.get('/balance', async (req, res) => {
  try {
    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Your account is not linked to an Odoo employee record yet. Contact admin.' });
    }
    const allocations = await odoo.getLeaveAllocation(req.user.odooEmployeeId);
    res.json({ allocations });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch leave balance.', detail: err.message });
  }
});

// GET /api/leave/my  — employee's own requests
router.get('/my', async (req, res) => {
  try {
    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Account not linked to Odoo. Contact admin.' });
    }
    const requests = await odoo.getLeaveRequests(req.user.odooEmployeeId);
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch leave requests.', detail: err.message });
  }
});

// POST /api/leave  — submit a new leave request
router.post(
  '/',
  [
    body('leaveTypeId').isNumeric(),
    body('dateFrom').isDate(),
    body('dateTo').isDate(),
    body('name').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Account not linked to Odoo. Contact admin.' });
    }
    try {
      const { leaveTypeId, dateFrom, dateTo, name } = req.body;
      const leaveId = await odoo.createLeaveRequest({
        employeeOdooId: req.user.odooEmployeeId,
        leaveTypeId: parseInt(leaveTypeId),
        dateFrom,
        dateTo,
        name,
      });

      // Notify manager by email
      try {
        const manager = await User.findOne({
          role: 'manager',
          isActive: true,
          department: req.user.department,
        });
        if (manager) {
          const types = await odoo.getLeaveTypes();
          const leaveType = types.find(t => t.id === parseInt(leaveTypeId));
          await email.notifyManagerLeaveRequest({
            managerEmail: manager.email,
            managerName: manager.name,
            employeeName: req.user.name,
            leaveType: leaveType ? leaveType.name : 'Leave',
            dateFrom,
            dateTo,
            days: Math.ceil((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1,
            reason: name,
          });
        }
      } catch (emailErr) {
        console.error('[Leave] Email notification failed:', emailErr.message);
      }

      res.status(201).json({ message: 'Leave request submitted successfully.', leaveId });
    } catch (err) {
      res.status(500).json({ message: 'Could not submit leave request.', detail: err.message });
    }
  }
);

// GET /api/leave/team  — manager sees pending team requests
router.get('/team', requireRole('manager', 'admin'), async (req, res) => {
  try {
    if (!req.user.odooEmployeeId) {
      return res.status(400).json({ message: 'Manager account not linked to Odoo.' });
    }
    const requests = await odoo.getTeamLeaveRequests(req.user.odooEmployeeId);
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch team leave requests.', detail: err.message });
  }
});

// PUT /api/leave/:id/approve  — manager approves
router.put('/:id/approve', requireRole('manager', 'admin'), async (req, res) => {
  try {
    await odoo.approveLeave(parseInt(req.params.id));

    // Find the employee who owns this leave request by odooEmployeeId
    const employee = await User.findOne({
      odooEmployeeId: req.body.employeeOdooId,
      isActive: true,
    });

    // Send email notification
    try {
      if (employee?.email) {
        await email.notifyEmployeeLeaveStatus({
          employeeEmail: employee.email,
          employeeName: employee.name,
          leaveType: req.body.leaveType || 'Leave',
          dateFrom: req.body.dateFrom || '',
          dateTo: req.body.dateTo || '',
          days: req.body.days || '',
          status: 'approved',
        });
      }
    } catch (emailErr) {
      console.error('[Leave] Approval email failed:', emailErr.message);
    }

    // Send push notification
    try {
      if (employee) {
        await push.sendPushToUser(employee._id, {
          title: 'Leave Approved ✅',
          body: `Your ${req.body.leaveType || 'leave'} request has been approved.`,
          type: 'leave_approved',
          url: '/leave',
        });
      }
    } catch (pushErr) {
      console.error('[Leave] Approval push failed:', pushErr.message);
    }

    res.json({ message: 'Leave request approved.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not approve leave request.', detail: err.message });
  }
});

// PUT /api/leave/:id/refuse  — manager rejects
router.put('/:id/refuse', requireRole('manager', 'admin'), async (req, res) => {
  try {
    await odoo.refuseLeave(parseInt(req.params.id), req.body.reason);

    // Find the employee who owns this leave request
    const employee = await User.findOne({
      odooEmployeeId: req.body.employeeOdooId,
      isActive: true,
    });

    // Send push notification
    try {
      if (employee) {
        await push.sendPushToUser(employee._id, {
          title: 'Leave Refused ❌',
          body: `Your ${req.body.leaveType || 'leave'} request has been refused.`,
          type: 'leave_refused',
          url: '/leave',
        });
      }
    } catch (pushErr) {
      console.error('[Leave] Refusal push failed:', pushErr.message);
    }

    res.json({ message: 'Leave request refused.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not refuse leave request.', detail: err.message });
  }
});

module.exports = router;
