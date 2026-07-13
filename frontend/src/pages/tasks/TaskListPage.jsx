import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getMyTasks, getTeamTasks, getAssignableUsers, createTask } from '../../services/task.service';

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

export default function TaskListPage() {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('my'); // 'my' | 'team'
  const [myTasks, setMyTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', priority: 'Medium', dueDate: '' });

  const fetchAll = () => {
    setLoading(true);
    const calls = [getMyTasks().then(setMyTasks), getAssignableUsers().then(setUsers)];
    if (isManager) calls.push(getTeamTasks().then(setTeamTasks));
    Promise.all(calls)
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load tasks.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Please enter a task title.');
    if (!form.assignedTo) return toast.error('Please select an assignee.');
    if (!form.dueDate) return toast.error('Please select a due date.');
    setSubmitting(true);
    try {
      await createTask(form);
      toast.success('Task created.');
      setShowForm(false);
      setForm({ title: '', description: '', assignedTo: '', priority: 'Medium', dueDate: '' });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create task.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading tasks…</div>;

  const tasks = tab === 'team' ? teamTasks : myTasks;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Tasks</div>
        <div className="page-sub">Create, assign, and track work</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New task'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New task</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" placeholder="What needs to be done?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Assign to</label>
                <select className="form-input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} required>
                  <option value="">Select assignee…</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name}{u._id === user?._id ? ' (myself)' : ''}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Priority</label>
                <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Due date</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Any additional details" style={{ resize: 'none' }} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create task'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isManager && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`btn ${tab === 'my' ? 'btn-primary' : ''}`} onClick={() => setTab('my')}>My tasks</button>
          <button className={`btn ${tab === 'team' ? 'btn-primary' : ''}`} onClick={() => setTab('team')}>Team tasks</button>
        </div>
      )}

      <div className="card">
        <div className="card-title">{tab === 'team' ? 'All team tasks' : 'My tasks'}</div>
        {tasks.length === 0 ? (
          <div className="empty-state"><p>No tasks here yet.</p></div>
        ) : (
          tasks.map(t => (
            <div className="list-row" key={t._id} style={{ cursor: 'pointer', display: 'block' }} onClick={() => navigate(`/tasks/${t._id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="list-row-left">
                  <div className="list-row-title">{t.title}</div>
                  <div className="list-row-sub">
                    Assigned to {t.assignedTo?.name} · Due {format(new Date(t.dueDate), 'd MMM yyyy')}
                  </div>
                </div>
                <span className={priorityBadgeClass(t.priority)}>{t.priority}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <div className="progress-track">
                  <div className={`progress-fill ${progressClass(t.percentComplete)}`} style={{ width: `${t.percentComplete}%` }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 32, textAlign: 'right' }}>{t.percentComplete}%</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
