import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

function statusClass(state) {
  const map = { draft: 'badge-draft', confirm: 'badge-pending', validate1: 'badge-pending', validate: 'badge-approved', refuse: 'badge-refused' };
  return `badge ${map[state] || 'badge-draft'}`;
}
function statusLabel(state) {
  const map = { draft: 'Draft', confirm: 'Pending', validate1: 'Pending', validate: 'Approved', refuse: 'Refused' };
  return map[state] || state;
}

export default function LeavePage() {
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', dateFrom: '', dateTo: '', name: '' });

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/leave/my').then(r => setRequests(r.data.requests)),
      api.get('/leave/types').then(r => setLeaveTypes(r.data.types)),
      api.get('/leave/balance').then(r => setBalance(r.data.allocations)),
    ]).catch(err => toast.error(err.response?.data?.message || 'Failed to load leave data.'))
      .finally(() => setLoading(false));
  };

  // Fetch fresh data every time the page is visited
  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.leaveTypeId) return toast.error('Please select a leave type.');
    if (!form.dateFrom || !form.dateTo) return toast.error('Please select dates.');
    if (new Date(form.dateTo) < new Date(form.dateFrom)) return toast.error('End date must be after start date.');
    setSubmitting(true);
    try {
      await api.post('/leave', form);
      toast.success('Leave request submitted successfully.');
      setShowForm(false);
      setForm({ leaveTypeId: '', dateFrom: '', dateTo: '', name: '' });
      // Refresh everything after submission
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalBalance = balance.reduce((sum, a) => sum + (a.virtual_remaining_leaves ?? a.number_of_days), 0);

  if (loading) return <div className="loading">Loading leave data…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Leave</div>
        <div className="page-sub">{totalBalance} days available this year</div>
      </div>

      {balance.length > 0 && (
        <div className="metric-grid" style={{ marginBottom: 20 }}>
          {balance.map(a => {
            const remaining = a.virtual_remaining_leaves ?? a.number_of_days;
            const total = a.max_leaves ?? a.number_of_days;
            const taken = a.leaves_taken ?? 0;
            return (
              <div className="metric-card" key={a.id || a.holiday_status_id?.[0]}>
                <div className="metric-label">{a.holiday_status_id?.[1] || 'Leave'}</div>
                <div className="metric-value">{remaining}</div>
                <div className="metric-hint">
                  {taken > 0 ? `${taken} used of ${total} days` : `${total} days allocated`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Apply for leave'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New leave request</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Leave type</label>
              <select className="form-input" value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))} required>
                <option value="">Select leave type…</option>
                {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">From</label>
                <input className="form-input" type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">To</label>
                <input className="form-input" type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Reason (optional)</label>
              <textarea className="form-input" rows={2} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Brief reason for leave" style={{ resize: 'none' }} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">My requests</div>
        {requests.length === 0 ? (
          <div className="empty-state"><p>No leave requests yet. Apply for leave above.</p></div>
        ) : (
          requests.map(r => (
            <div className="list-row" key={r.id}>
              <div className="list-row-left">
                <div className="list-row-title">{r.holiday_status_id?.[1] || 'Leave'}</div>
                <div className="list-row-sub">
                  {r.date_from ? format(new Date(r.date_from), 'd MMM') : ''} – {r.date_to ? format(new Date(r.date_to), 'd MMM yyyy') : ''} · {r.number_of_days} day(s)
                  {r.name ? ` · ${r.name}` : ''}
                </div>
              </div>
              <span className={statusClass(r.state)}>{statusLabel(r.state)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
