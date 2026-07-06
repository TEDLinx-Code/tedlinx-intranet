import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_LABELS = { available: 'Available', assigned: 'Assigned', under_repair: 'Under repair', retired: 'Retired' };
const STATUS_CLASS = { available: 'badge-approved', assigned: 'badge-pending', under_repair: 'badge-refused', retired: 'badge-draft' };

const emptyForm = { name: '', category: '', make: '', model: '', serialNumber: '', assetTag: '', purchaseDate: '', purchasePrice: '', notes: '' };

export default function AssetManagementPage() {
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [savingCategories, setSavingCategories] = useState(false);

  const fetchAssets = () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    api.get(`/assets${params}`)
      .then(r => setAssets(r.data.assets))
      .catch(() => toast.error('Could not load assets.'))
      .finally(() => setLoading(false));
  };

  const fetchCategories = () => {
    api.get('/settings/asset-categories').then(r => {
      setCategories(r.data.categories);
      // Keep form default category in sync once categories load
      setForm(f => f.category ? f : { ...f, category: r.data.categories[0] || '' });
    });
  };

  useEffect(() => {
    fetchAssets();
    fetchCategories();
    api.get('/users').then(r => setUsers(r.data.users.filter(u => u.isActive !== false)));
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchAssets, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => { setEditAsset(null); setForm({ ...emptyForm, category: categories[0] || '' }); setShowForm(true); };
  const openEdit = (a) => {
    setEditAsset(a);
    setForm({
      name: a.name, category: a.category, make: a.make || '', model: a.model || '',
      serialNumber: a.serialNumber || '', assetTag: a.assetTag || '',
      purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0, 10) : '',
      purchasePrice: a.purchasePrice || '', notes: a.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editAsset) {
        await api.put(`/assets/${editAsset._id}`, form);
        toast.success('Asset updated.');
      } else {
        await api.post('/assets', form);
        toast.success('Asset created.');
      }
      setShowForm(false);
      fetchAssets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save asset.');
    } finally { setSubmitting(false); }
  };

  const handleAssign = async () => {
    if (!assignUserId) return toast.error('Please select an employee.');
    try {
      await api.put(`/assets/${assignModal._id}/assign`, { userId: assignUserId });
      toast.success('Asset assigned.');
      setAssignModal(null);
      setAssignUserId('');
      fetchAssets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not assign asset.');
    }
  };

  const handleUnassign = async (asset) => {
    if (!confirm(`Return "${asset.name}" from ${asset.assignedTo?.name} to pool?`)) return;
    try {
      await api.put(`/assets/${asset._id}/unassign`);
      toast.success('Asset returned to pool.');
      fetchAssets();
    } catch { toast.error('Could not unassign asset.'); }
  };

  const openCategoryManager = () => {
    setCategoryDraft([...categories]);
    setNewCategoryInput('');
    setShowCategoryManager(true);
  };

  const addCategoryDraft = () => {
    const val = newCategoryInput.trim();
    if (!val) return;
    if (categoryDraft.includes(val)) return toast.error('Category already exists.');
    setCategoryDraft(prev => [...prev, val]);
    setNewCategoryInput('');
  };

  const removeCategoryDraft = (cat) => {
    setCategoryDraft(prev => prev.filter(c => c !== cat));
  };

  const saveCategoryDraft = async () => {
    if (categoryDraft.length === 0) return toast.error('Keep at least one category.');
    setSavingCategories(true);
    try {
      const res = await api.put('/settings/asset-categories', { categories: categoryDraft });
      setCategories(res.data.categories);
      toast.success('Categories updated.');
      setShowCategoryManager(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save categories.');
    } finally { setSavingCategories(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Asset management</div>
            <div className="page-sub">{assets.length} assets tracked</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={openCategoryManager}>Manage categories</button>
            <button className="btn btn-primary" onClick={openCreate}>+ Add asset</button>
          </div>
        </div>
      </div>

      {/* Create/edit form */}
      {showForm && (
        <div className="card" style={{ borderColor: 'var(--color-primary)', borderWidth: 1 }}>
          <div className="card-title" style={{ color: 'var(--color-primary)' }}>
            {editAsset ? `Edit — ${editAsset.name}` : 'Add new asset'}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Asset name *</label>
                <input className="form-input" placeholder="e.g. Dell Latitude 5540" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">Category *</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Make / Brand</label>
                <input className="form-input" placeholder="e.g. Dell" value={form.make}
                  onChange={e => setForm(f => ({ ...f, make: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Model</label>
                <input className="form-input" placeholder="e.g. Latitude 5540" value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Serial number</label>
                <input className="form-input" value={form.serialNumber}
                  onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Asset tag</label>
                <input className="form-input" placeholder="e.g. LAP-0042" value={form.assetTag}
                  onChange={e => setForm(f => ({ ...f, assetTag: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Purchase date</label>
                <input className="form-input" type="date" value={form.purchaseDate}
                  onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Purchase price (₹)</label>
                <input className="form-input" type="number" value={form.purchasePrice}
                  onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} style={{ resize: 'none' }} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editAsset ? 'Save changes' : 'Create asset'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <SearchIcon />
        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search by name, make, serial number…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Asset table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="loading">Loading…</div> : assets.length === 0 ? (
          <div className="empty-state"><p>No assets found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Category</th>
                <th>Serial / Tag</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a._id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{a.name}</div>
                    {(a.make || a.model) && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                        {[a.make, a.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{a.category}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {a.serialNumber || a.assetTag || '—'}
                  </td>
                  <td><span className={`badge ${STATUS_CLASS[a.status]}`}>{STATUS_LABELS[a.status]}</span></td>
                  <td style={{ fontSize: 'var(--font-size-sm)' }}>
                    {a.assignedTo ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{a.assignedTo.name}</div>
                        {a.assignedAt && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                          Since {format(new Date(a.assignedAt), 'd MMM yyyy')}
                        </div>}
                      </div>
                    ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>
                      {a.status === 'available'
                        ? <button className="btn btn-sm btn-primary" onClick={() => { setAssignModal(a); setAssignUserId(''); }}>Assign</button>
                        : a.status === 'assigned'
                          ? <button className="btn btn-sm btn-danger" onClick={() => handleUnassign(a)}>Unassign</button>
                          : null
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: 400, margin: 0 }}>
            <div className="card-title">Assign — {assignModal.name}</div>
            <div className="form-row">
              <label className="form-label">Select employee</label>
              <select className="form-input" value={assignUserId} onChange={e => setAssignUserId(e.target.value)}>
                <option value="">Choose employee…</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} — {u.department || u.role}</option>)}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleAssign}>Assign</button>
              <button className="btn" onClick={() => setAssignModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Category manager modal */}
      {showCategoryManager && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div className="card" style={{ width: 440, margin: 0 }}>
            <div className="card-title">Manage asset categories</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Add or remove categories used across all assets. Existing assets keep their category even if removed from this list.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {categoryDraft.map(cat => (
                <span key={cat} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
                  padding: '6px 10px', borderRadius: 16, fontSize: 'var(--font-size-sm)', fontWeight: 500,
                }}>
                  {cat}
                  <button
                    onClick={() => removeCategoryDraft(cat)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-text)', fontSize: 14, lineHeight: 1, padding: 0 }}
                    aria-label={`Remove ${cat}`}
                  >✕</button>
                </span>
              ))}
            </div>

            <div className="form-row" style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder="New category name"
                value={newCategoryInput}
                onChange={e => setNewCategoryInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategoryDraft(); } }}
              />
              <button className="btn" type="button" onClick={addCategoryDraft}>Add</button>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveCategoryDraft} disabled={savingCategories}>
                {savingCategories ? 'Saving…' : 'Save categories'}
              </button>
              <button className="btn" onClick={() => setShowCategoryManager(false)}>Cancel</button>
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
