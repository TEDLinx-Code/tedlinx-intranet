import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

function statusLabel(state) {
  const map = { draft: 'Draft', reported: 'Submitted', validate: 'Approved', done: 'Paid', refused: 'Rejected', submit: 'Submitted' };
  return map[state] || state;
}
function statusClass(state) {
  if (['validate', 'done'].includes(state)) return 'badge badge-approved';
  if (['refused'].includes(state)) return 'badge badge-refused';
  if (['reported', 'submit'].includes(state)) return 'badge badge-pending';
  return 'badge badge-draft';
}

export default function ExpensePage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', productId: '', totalAmount: '', date: '', description: '' });
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/expenses/my').then(r => setExpenses(r.data.expenses)),
      api.get('/expenses/categories').then(r => setCategories(r.data.categories)),
    ]).catch(err => toast.error(err.response?.data?.message || 'Failed to load expense data.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.productId) return toast.error('Please select a category.');
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) return toast.error('Please enter a valid amount.');
    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => v && data.append(k, v));
      if (receipt) data.append('receipt', receipt);
      await api.post('/expenses', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Expense submitted successfully.');
      setShowForm(false);
      setForm({ name: '', productId: '', totalAmount: '', date: '', description: '' });
      setReceipt(null);
      const res = await api.get('/expenses/my');
      setExpenses(res.data.expenses);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit expense.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading expenses…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Expenses</div>
        <div className="page-sub">Submit and track your expense claims</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New expense claim'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New expense claim</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Description</label>
              <input className="form-input" type="text" placeholder="What was this expense for?" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} required>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Amount (₹)</label>
                <input className="form-input" type="number" step="0.01" min="0.01" placeholder="0.00" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">Receipt (optional)</label>
                <input className="form-input" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setReceipt(e.target.files[0])} style={{ padding: '5px 10px' }} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Any additional details" style={{ resize: 'none' }} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit claim'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">My expense claims</div>
        {expenses.length === 0 ? (
          <div className="empty-state"><p>No expense claims yet.</p></div>
        ) : (
          expenses.map(e => (
            <div className="list-row" key={e.id}>
              <div className="list-row-left">
                <div className="list-row-title">{e.name}</div>
                <div className="list-row-sub">
                  ₹ {parseFloat(e.total_amount).toFixed(2)} · {e.product_id?.[1] || ''} · {e.date ? format(new Date(e.date), 'd MMM yyyy') : ''}
                </div>
              </div>
              <span className={statusClass(e.state)}>{statusLabel(e.state)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
