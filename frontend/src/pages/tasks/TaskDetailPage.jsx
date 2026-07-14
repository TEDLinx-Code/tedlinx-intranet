import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getTask, submitStatusUpdate, deleteTask, reopenTask } from '../../services/task.service';

function priorityBadgeClass(priority) {
  if (priority === 'High') return 'badge badge-refused';
  if (priority === 'Medium') return 'badge badge-pending';
  return 'badge badge-approved';
}

function progressClass(pct) {
  if (pct < 40) return 'progress-low';
  if (pct < 80) return 'progress-mid';
  return 'progress-high';
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [note, setNote] = useState('');
  const [percent, setPercent] = useState(0);

  const fetchTask = () => {
    setLoading(true);
    getTask(id)
      .then(({ task, logs }) => {
        setTask(task);
        setLogs(logs);
        setPercent(task.percentComplete);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Could not load task.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTask(); }, [id]);

  const isAssignee = task && String(task.assignedTo._id) === String(user?._id);
  const canUpdate = task && task.status !== 'Completed' && (isManager || isAssignee);
  const canReopen = task && task.status === 'Completed' && (isManager || isAssignee);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!note.trim()) return toast.error('Please write a status update.');
    setSubmitting(true);
    try {
      await submitStatusUpdate(id, { note, percentComplete: percent });
      toast.success('Status update submitted.');
      setNote('');
      fetchTask();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit update.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await reopenTask(id);
      toast.success('Task reopened.');
      fetchTask();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reopen task.');
    } finally {
      setReopening(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted.');
      navigate('/tasks');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete task.');
    }
  };

  if (loading) return <div className="loading">Loading task…</div>;
  if (!task) return <div className="empty-state"><p>Task not found.</p></div>;

  const canDelete = isManager || String(task.assignedBy._id) === String(user?._id);

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-sm" onClick={() => navigate('/tasks')} style={{ marginBottom: 12 }}>← Back to tasks</button>
        <div className="page-title">{task.title}</div>
        {task.description && <div className="page-sub">{task.description}</div>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          <span>Assignee: {task.assignedTo.name}</span>
          <span>Assigned by: {task.assignedBy.name}</span>
          <span className={priorityBadgeClass(task.priority)}>{task.priority}</span>
          <span>Due: {format(new Date(task.dueDate), 'd MMM yyyy')}</span>
          {task.status === 'Completed' && <span className="badge badge-approved">Completed</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {canReopen && (
              <button className="btn btn-sm" onClick={handleReopen} disabled={reopening}>
                {reopening ? 'Reopening…' : 'Reopen task'}
              </button>
            )}
            {canDelete && (
              <button className="btn btn-sm btn-danger" onClick={handleDelete}>Delete</button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Completion — {task.percentComplete}%</div>
          <div className="progress-track" style={{ height: 8 }}>
            <div className={`progress-fill ${progressClass(task.percentComplete)}`} style={{ width: `${task.percentComplete}%`, height: 8 }} />
          </div>
        </div>

        <div className="card-title" style={{ marginBottom: 12 }}>Daily status log</div>
        {logs.length === 0 ? (
          <div className="empty-state"><p>No status updates yet.</p></div>
        ) : (
          logs.map((log, idx) => (
            <div key={log._id} style={{ borderLeft: `2px solid ${idx === 0 ? 'var(--color-primary)' : 'var(--color-border)'}`, paddingLeft: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {format(new Date(log.createdAt), 'd MMM yyyy, h:mm a')} · {log.user.name} · {log.percentComplete}%
              </div>
              <div style={{ fontSize: 14, marginTop: 3, whiteSpace: 'pre-wrap' }}>{log.note}</div>
            </div>
          ))
        )}

        {canUpdate && (
          <form onSubmit={handleSubmit} style={{ marginTop: 20, borderTop: '0.5px solid var(--color-border)', paddingTop: 16 }}>
            <div className="form-row">
              <label className="form-label">Add today's update</label>
              <textarea
                className="form-input"
                rows={5}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write today's status update…"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Completion — {percent}%</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={percent}
                  onChange={e => setPercent(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{percent}%</span>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
