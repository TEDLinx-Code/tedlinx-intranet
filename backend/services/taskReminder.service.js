const cron = require('node-cron');
const Task = require('../models/Task');
const push = require('./push.service');

// Runs once a day and pushes a reminder to the assignee of any task
// due tomorrow that hasn't already been flagged as "due soon".
async function checkDueSoonTasks() {
  try {
    const now = new Date();
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

    const tasks = await Task.find({
      isActive: true,
      status: { $ne: 'Completed' },
      dueSoonNotified: false,
      dueDate: { $gte: startOfTomorrow, $lt: endOfTomorrow },
    }).populate('assignedTo', 'name');

    for (const task of tasks) {
      try {
        await push.sendPushToUser(task.assignedTo._id, {
          title: 'Task due tomorrow',
          body: `"${task.title}" is due tomorrow.`,
          type: 'task_due_soon',
          url: `/tasks/${task._id}`,
        });
        task.dueSoonNotified = true;
        await task.save();
      } catch (err) {
        console.error(`[TaskReminder] Failed to notify for task ${task._id}:`, err.message);
      }
    }

    if (tasks.length) console.log(`[TaskReminder] Sent ${tasks.length} due-soon reminder(s).`);
  } catch (err) {
    console.error('[TaskReminder] checkDueSoonTasks error:', err.message);
  }
}

// Schedule: every day at 9:00 AM server time.
function start() {
  cron.schedule('0 9 * * *', checkDueSoonTasks);
  console.log('[TaskReminder] Due-soon reminder cron scheduled (daily 9:00 AM).');
}

module.exports = { start, checkDueSoonTasks };
