const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const User = require('../models/User');
const push = require('../services/push.service');

const router = express.Router();
router.use(protect);

const isManagerOrAdmin = (user) => ['manager', 'admin'].includes(user.role);

// GET /api/tasks/assignable-users — lightweight active user list for the assignee picker
router.get('/assignable-users', async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('name email role department').sort({ name: 1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch users.', detail: err.message });
  }
});

// GET /api/tasks/my — open/in-progress tasks assigned to the logged-in user
router.get('/my', async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id, isActive: true, status: { $ne: 'Completed' } })
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name')
      .sort({ dueDate: 1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch your tasks.', detail: err.message });
  }
});

// GET /api/tasks/assigned-by-me — open/in-progress tasks the logged-in user created for someone else.
// Available to everyone (not just managers) so any employee can track tasks they've handed off.
router.get('/assigned-by-me', async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedBy: req.user._id,
      assignedTo: { $ne: req.user._id }, // self-assigned tasks already show under "My tasks"
      isActive: true,
      status: { $ne: 'Completed' },
    })
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name department')
      .sort({ dueDate: 1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch tasks you assigned.', detail: err.message });
  }
});

// GET /api/tasks/team — every open/in-progress active task org-wide, visible to managers/admins only
router.get('/team', async (req, res) => {
  if (!isManagerOrAdmin(req.user)) {
    return res.status(403).json({ message: 'You do not have permission to view team tasks.' });
  }
  try {
    const tasks = await Task.find({ isActive: true, status: { $ne: 'Completed' } })
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name department')
      .sort({ dueDate: 1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch team tasks.', detail: err.message });
  }
});

// GET /api/tasks/completed — completed tasks visible to the logged-in user
// (managers/admins see every completed task; everyone else sees tasks they were assigned or assigned to others)
router.get('/completed', async (req, res) => {
  try {
    const filter = isManagerOrAdmin(req.user)
      ? { isActive: true, status: 'Completed' }
      : { isActive: true, status: 'Completed', $or: [{ assignedTo: req.user._id }, { assignedBy: req.user._id }] };

    const tasks = await Task.find(filter)
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name department')
      .sort({ updatedAt: -1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch completed tasks.', detail: err.message });
  }
});

// GET /api/tasks/:id — task detail (only assignee, assigner, or manager/admin can view)
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isActive: true })
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name department');
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const canView = isManagerOrAdmin(req.user) ||
      String(task.assignedTo._id) === String(req.user._id) ||
      String(task.assignedBy._id) === String(req.user._id);
    if (!canView) return res.status(403).json({ message: 'You do not have permission to view this task.' });

    const logs = await TaskLog.find({ task: task._id }).populate('user', 'name').sort({ createdAt: -1 });
    res.json({ task, logs });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch task.', detail: err.message });
  }
});

// POST /api/tasks — create + assign a task
router.post(
  '/',
  [
    body('title').notEmpty().trim(),
    body('assignedTo').notEmpty(),
    body('dueDate').isISO8601(),
    body('priority').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const assignee = await User.findOne({ _id: req.body.assignedTo, isActive: true });
      if (!assignee) return res.status(400).json({ message: 'Selected assignee not found.' });

      // Employees may only assign to themselves or any colleague (not restricted to a reporting line).
      // Managers and admins may assign to anyone. This matches TEDLinx's flat assignment model.
      const task = await Task.create({
        title: req.body.title,
        description: req.body.description || '',
        assignedTo: assignee._id,
        assignedBy: req.user._id,
        priority: req.body.priority || 'Medium',
        dueDate: req.body.dueDate,
      });

      // Notify assignee (skip if self-assigned)
      if (String(assignee._id) !== String(req.user._id)) {
        try {
          await push.sendPushToUser(assignee._id, {
            title: 'New task assigned',
            body: `${req.user.name} assigned you: ${task.title}`,
            type: 'task_assigned',
            url: `/tasks/${task._id}`,
          });
        } catch (pushErr) {
          console.error('[Tasks] Assign push failed:', pushErr.message);
        }
      }

      const populated = await Task.findById(task._id).populate('assignedBy', 'name').populate('assignedTo', 'name');
      res.status(201).json({ message: 'Task created.', task: populated });
    } catch (err) {
      res.status(500).json({ message: 'Could not create task.', detail: err.message });
    }
  }
);

// POST /api/tasks/:id/status — daily status update (note + percent complete combined)
router.post(
  '/:id/status',
  [
    body('note').notEmpty().trim(),
    body('percentComplete').isInt({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const task = await Task.findOne({ _id: req.params.id, isActive: true });
      if (!task) return res.status(404).json({ message: 'Task not found.' });

      const canUpdate = isManagerOrAdmin(req.user) || String(task.assignedTo) === String(req.user._id);
      if (!canUpdate) return res.status(403).json({ message: 'You do not have permission to update this task.' });

      const percentComplete = parseInt(req.body.percentComplete);

      const log = await TaskLog.create({
        task: task._id,
        user: req.user._id,
        note: req.body.note,
        percentComplete,
      });

      task.percentComplete = percentComplete;
      task.status = percentComplete >= 100 ? 'Completed' : percentComplete > 0 ? 'In Progress' : 'Open';
      await task.save();

      // Notify all managers, plus whoever assigned this task (if not already a manager
      // and not the person submitting the update), whenever a status update is submitted.
      try {
        const managers = await User.find({ role: 'manager', isActive: true });
        const recipientIds = new Set(managers.map(m => String(m._id)));
        recipientIds.add(String(task.assignedBy));
        recipientIds.delete(String(req.user._id)); // never notify yourself

        await Promise.all([...recipientIds].map(recipientId =>
          push.sendPushToUser(recipientId, {
            title: 'Task status update',
            body: `${req.user.name} updated "${task.title}" to ${percentComplete}%`,
            type: 'task_status_update',
            url: `/tasks/${task._id}`,
          }).catch(e => console.error('[Tasks] Status update push failed:', e.message))
        ));
      } catch (pushErr) {
        console.error('[Tasks] Status update notify failed:', pushErr.message);
      }

      const populatedLog = await TaskLog.findById(log._id).populate('user', 'name');
      res.status(201).json({ message: 'Status update submitted.', log: populatedLog, task });
    } catch (err) {
      res.status(500).json({ message: 'Could not submit status update.', detail: err.message });
    }
  }
);

// POST /api/tasks/:id/reopen — move a completed task back to In Progress (manager/admin or the assignee only)
router.post('/:id/reopen', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isActive: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const canReopen = isManagerOrAdmin(req.user) || String(task.assignedTo) === String(req.user._id);
    if (!canReopen) return res.status(403).json({ message: 'You do not have permission to reopen this task.' });

    if (task.status !== 'Completed') {
      return res.status(400).json({ message: 'Only completed tasks can be reopened.' });
    }

    task.status = 'In Progress';
    task.dueSoonNotified = false; // allow the due-soon reminder to fire again if applicable
    await task.save();

    await TaskLog.create({
      task: task._id,
      user: req.user._id,
      note: `${req.user.name} reopened this task.`,
      percentComplete: task.percentComplete,
    });

    const populated = await Task.findById(task._id).populate('assignedBy', 'name').populate('assignedTo', 'name');
    res.json({ message: 'Task reopened.', task: populated });
  } catch (err) {
    res.status(500).json({ message: 'Could not reopen task.', detail: err.message });
  }
});

// PUT /api/tasks/:id — edit task details (assigner, assignee's manager/admin)
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isActive: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const canEdit = isManagerOrAdmin(req.user) || String(task.assignedBy) === String(req.user._id);
    if (!canEdit) return res.status(403).json({ message: 'You do not have permission to edit this task.' });

    const allowed = ['title', 'description', 'priority', 'dueDate', 'assignedTo'];
    allowed.forEach(k => { if (req.body[k] !== undefined) task[k] = req.body[k]; });
    await task.save();

    const populated = await Task.findById(task._id).populate('assignedBy', 'name').populate('assignedTo', 'name');
    res.json({ message: 'Task updated.', task: populated });
  } catch (err) {
    res.status(500).json({ message: 'Could not update task.', detail: err.message });
  }
});

// DELETE /api/tasks/:id — soft delete (assigner or manager/admin)
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isActive: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const canDelete = isManagerOrAdmin(req.user) || String(task.assignedBy) === String(req.user._id);
    if (!canDelete) return res.status(403).json({ message: 'You do not have permission to delete this task.' });

    task.isActive = false;
    await task.save();
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete task.', detail: err.message });
  }
});

module.exports = router;
