import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Electrical', 'Instrument', 'PPE', 'Consumable', 'Mechanical', 'Other'];

function stockColor(available, total) {
  if (available === 0) return 'var(--color-danger-text)';
  if (available <= total * 0.2) return 'var(--color-warning-text)';
  return 'var(--color-success-text)';
}

const STATUS_LABELS = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  checked_out: 'Checked out',
  return_requested: 'Return pending',
  returned: 'Returned',
};
const STATUS_CLASS = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-refused',
  checked_out: 'badge-approved',
  return_requested: 'badge-pending',
  returned: 'badge-draft',
};

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [project, setProject] = useState('All');
  const [checkoutModal, setCheckoutModal] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({ quantity: 1, purpose: '' });
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('browse'); // browse | my-checkouts

  const fetchItems = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category !== 'All') params.set('category', category);
    if (project !== 'All') params.set('project', project);
    api.get(`/inventory?${params}`).then(r => setItems(r.data.items));
  };

  const fetchCheckouts = () => {
    api.get('/inventory/checkouts/my').then(r => setCheckouts(r.data.checkouts));
  };

  useEffect(() => {
    Promise.all([
      api.get('/inventory').then(r => setItems(r.data.items)),
      api.get('/inventory/checkouts/my').then(r => setCheckouts(r.data.checkouts)),
      api.get('/inventory/projects').then(r => setProjects(r.data.projects)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchItems, 400);
    return () => clearTimeout(t);
  }, [search, category, project]);

  const handleCheckout = async () => {
    if (!checkoutForm.quantity || checkoutForm.quantity < 1) return toast.error('Enter a valid quantity.');
    setSubmitting(true);
    try {
      await api.post('/inventory/checkouts', {
        itemId: checkoutModal._id,
        quantityRequested: parseInt(checkoutForm.quantity),
        purpose: checkoutForm.purpose,
      });
      toast.success('Checkout request submitted.');
      setCheckoutModal(null);
      setCheckoutForm({ quantity: 1, purpose: '' });
      fetchCheckouts();
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit request.');
    } finally { setSubmitting(false); }
  };

  const handleReturnRequest = async (checkoutId) => {
    try {
      await api.put(`/inventory/checkouts/${checkoutId}/request-return`);
      toast.success('Return request submitted.');
      fetchCheckouts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit return.');
    }
  };

  if (loading) return <div className="loading">Loading inventory…</div>;

  const activeCheckouts = checkouts.filter(c => ['checked_out', 'return_requested'].includes(c.status)).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Inventory</div>
        <div className="page-sub">Spare parts and instruments in stockroom</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn${tab === 'browse' ? ' btn-primary' : ''}`} onClick={() => setTab('browse')}>
          Browse items
        </button>
        <button className={`btn${tab === 'my-checkouts' ? ' btn-primary' : ''}`} onClick={() => setTab('my-checkouts')}>
          My checkouts {activeCheckouts > 0 && <span className="notif-dot" />}
        </button>
      </div>

      {tab === 'browse' && (
        <>
          {/* Search and filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
              <SearchIcon />
              <input className="form-input" style={{ paddingLeft: 36 }}
                placeholder="Search by name, make, part number…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            {projects.length > 0 && (
              <select className="form-input" style={{ width: 170 }} value={project} onChange={e => setProject(e.target.value)}>
                <option value="All">All projects</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Available items</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                {items.length} items
              </span>
            </div>
            {items.length === 0 ? (
              <div className="empty-state"><p>No items found.</p></div>
            ) : (
              items.map(item => (
                <div className="list-row" key={item._id}>
                  <div className="list-row-left">
                    <div className="list-row-title">
                      {item.name}
                      {item.project && (
                        <span className="badge" style={{ marginLeft: 8, background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}>
                          {item.project}
                        </span>
                      )}
                    </div>
                    <div className="list-row-sub">
                      {[item.category, item.make, item.partNumber, item.specifications].filter(Boolean).join(' · ')}
                    </div>
                    {item.location && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        📍 {item.location}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: stockColor(item.availableQuantity, item.totalQuantity) }}>
                        {item.availableQuantity}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                        of {item.totalQuantity} {item.unit}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={item.availableQuantity === 0}
                      onClick={() => { setCheckoutModal(item); setCheckoutForm({ quantity: 1, purpose: '' }); }}
                    >
                      {item.availableQuantity === 0 ? 'Out of stock' : 'Request'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'my-checkouts' && (
        <div className="card">
          <div className="card-title">My checkout history</div>
          {checkouts.length === 0 ? (
            <div className="empty-state"><p>No checkout requests yet.</p></div>
          ) : (
            checkouts.map(c => (
              <div className="approval-row" key={c._id}>
                <div className="approval-header">
                  <div className="approval-name">
                    {c.item?.name} × {c.quantityApproved || c.quantityRequested} {c.item?.unit}
                  </div>
                  <span className={`badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                </div>
                <div className="approval-detail">
                  {c.item?.make && `${c.item.make} · `}
                  {c.purpose && `${c.purpose} · `}
                  Requested {format(new Date(c.createdAt), 'd MMM yyyy')}
                  {c.checkedOutAt && ` · Issued ${format(new Date(c.checkedOutAt), 'd MMM yyyy')}`}
                </div>
                {c.status === 'checked_out' && (
                  <div className="approval-actions">
                    <button className="btn btn-sm btn-accent" onClick={() => handleReturnRequest(c._id)}>
                      Request return
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Checkout modal */}
      {checkoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: 420, margin: 0 }}>
            <div className="card-title">Request — {checkoutModal.name}</div>
            <div style={{ marginBottom: 14, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Available: <strong style={{ color: 'var(--color-primary-text)' }}>{checkoutModal.availableQuantity} {checkoutModal.unit}</strong>
              {checkoutModal.partNumber && ` · Part no: ${checkoutModal.partNumber}`}
            </div>
            <div className="form-row">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" min={1} max={checkoutModal.availableQuantity}
                value={checkoutForm.quantity}
                onChange={e => setCheckoutForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="form-row">
              <label className="form-label">Purpose / reason</label>
              <textarea className="form-input" rows={2} style={{ resize: 'none' }}
                placeholder="What will you use this for?"
                value={checkoutForm.purpose}
                onChange={e => setCheckoutForm(f => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCheckout} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
              <button className="btn" onClick={() => setCheckoutModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SearchIcon = () => (
  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 17, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
