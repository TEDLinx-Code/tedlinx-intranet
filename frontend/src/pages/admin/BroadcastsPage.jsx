import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

const emptyForm = { message: '', startDate: '', endDate: '' };

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = () => {
    api.get('/broadcasts')
      .then(r => setBroadcasts(r.data.broadcasts))
      .catch(() => toast.error('Could not load broadcasts.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const today = new Date().toISOString().slice(0, 10);

  const openCreate = () => {
    setForm({ message: '', startDate: today, endDate: today });
    setShowForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/broadcasts', form);
      toast.success('Broadcast created.');
      setShowForm(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create broadcast.');
    } finally { setSubmitting(false); }
  };

  const handleDeactivate = async (b) => {
    try {
      await api.put(`/broadcasts/${b._id}`, { isActive: false });
      toast.success('Broadcast deactivated.');
      fetchAll();
    } catch { toast.error('Could not deactivate broadcast.'); }
  };

  const handleDelete = async (b) => {
    if (!confirm('Delete this broadcast permanently?')) return;
    try {
      await api.delete(`/broadcasts/${b._id}`);
      toast.success('Broadcast deleted.');
      fetchAll();
    } catch { toast.error('Could not delete broadcast.'); }
  };

  const isCurrentlyActive = (b) => {
    if (!b.isActive) return false;
    const now = new Date();
    return new Date(b.startDate) <= now && new Date(b.endDate) >= now;
  };

  if (loading) return <div className="loading">Loading broadcasts…</div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Broadcasts</div>
            <div className="page-sub">Company-wide announcements shown on the home page</div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ New broadcast</button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ borderColor: 'var(--color-primary)', borderWidth: 1 }}>
          <div className="card-title" style={{ color: 'var(--color-primary)' }}>New broadcast</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Message *</label>
              <textarea className="form-input" rows={3} style={{ resize: 'none' }}
                placeholder="e.g. Office will remain closed on 15th August for Independence Day."
                value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Visible from *</label>
                <input className="form-input" type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">Visible until *</label>
                <input className="form-input" type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Publishing…' : 'Publish broadcast'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">All broadcasts</div>
        {broadcasts.length === 0 ? (
          <div className="empty-state"><p>No broadcasts created yet. When there's none active, employees see a random quote instead.</p></div>
        ) : (
          broadcasts.map(b => (
            <div className="approval-row" key={b._id}>
              <div className="approval-header">
                <div className="approval-name" style={{ maxWidth: '70%' }}>{b.message}</div>
                <span className={`badge ${isCurrentlyActive(b) ? 'badge-approved' : 'badge-draft'}`}>
                  {isCurrentlyActive(b) ? 'Live now' : b.isActive ? 'Scheduled / expired' : 'Deactivated'}
                </span>
              </div>
              <div className="approval-detail">
                {format(new Date(b.startDate), 'd MMM yyyy')} – {format(new Date(b.endDate), 'd MMM yyyy')} · By {b.createdBy?.name || 'Admin'}
              </div>
              <div className="approval-actions">
                {b.isActive && (
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(b)}>Deactivate</button>
                )}
                <button className="btn btn-sm" onClick={() => handleDelete(b)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
