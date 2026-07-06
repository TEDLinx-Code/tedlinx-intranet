import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['Electrical', 'Instrument', 'PPE', 'Consumable', 'Mechanical', 'Other'];
const emptyForm = { name: '', category: 'Electrical', make: '', partNumber: '', specifications: '', project: '', totalQuantity: '', location: '', unit: 'pcs', minimumStock: 0 };

export default function StorekeeperPage() {
  const [items, setItems] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('catalogue');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [acting, setActing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fetchAll = () => {
    Promise.all([
      api.get('/inventory').then(r => setItems(r.data.items)),
      api.get('/inventory/checkouts').then(r => setCheckouts(r.data.checkouts)),
      api.get('/inventory/projects').then(r => setProjects(r.data.projects)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, category: item.category, make: item.make || '',
      partNumber: item.partNumber || '', specifications: item.specifications || '',
      project: item.project || '',
      totalQuantity: item.totalQuantity, location: item.location || '',
      unit: item.unit || 'pcs', minimumStock: item.minimumStock || 0,
    });
    setShowForm(true);
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/inventory/export', { responseType: 'blob' });
      downloadBlob(res.data, `inventory-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      toast.error('Could not export inventory.');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/inventory/template', { responseType: 'blob' });
      downloadBlob(res.data, 'inventory-upload-template.xlsx');
    } catch (err) {
      toast.error('Could not download template.');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/inventory/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message);
      setImportResult(res.data);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not import file.');
    } finally {
      setImporting(false);
      e.target.value = ''; // reset file input
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editItem) {
        await api.put(`/inventory/${editItem._id}`, form);
        toast.success('Item updated.');
      } else {
        await api.post('/inventory', form);
        toast.success('Item added.');
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save item.');
    } finally { setSubmitting(false); }
  };

  const handleApprove = async (checkout) => {
    setActing(checkout._id);
    try {
      await api.put(`/inventory/checkouts/${checkout._id}/approve`);
      toast.success('Checkout approved — item issued.');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not approve.');
    } finally { setActing(null); }
  };

  const handleReject = async (checkout) => {
    setActing(checkout._id);
    try {
      await api.put(`/inventory/checkouts/${checkout._id}/reject`);
      toast.success('Request rejected.');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject.');
    } finally { setActing(null); }
  };

  const handleConfirmReturn = async (checkout) => {
    setActing(checkout._id);
    try {
      await api.put(`/inventory/checkouts/${checkout._id}/confirm-return`);
      toast.success('Return confirmed. Stock updated.');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm return.');
    } finally { setActing(null); }
  };

  const pendingCount = checkouts.filter(c => c.status === 'pending').length;
  const returnCount = checkouts.filter(c => c.status === 'return_requested').length;

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Storekeeper</div>
        <div className="page-sub">Manage inventory and checkout requests</div>
      </div>

      {/* Summary metrics */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Total items</div>
          <div className="metric-value">{items.length}</div>
          <div className="metric-hint">in catalogue</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending checkouts</div>
          <div className="metric-value" style={{ color: pendingCount ? 'var(--color-warning-text)' : 'var(--color-text)' }}>{pendingCount}</div>
          <div className="metric-hint">awaiting approval</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending returns</div>
          <div className="metric-value" style={{ color: returnCount ? 'var(--color-warning-text)' : 'var(--color-text)' }}>{returnCount}</div>
          <div className="metric-hint">awaiting confirmation</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Low stock</div>
          <div className="metric-value" style={{ color: 'var(--color-danger-text)' }}>
            {items.filter(i => i.availableQuantity <= i.minimumStock && i.minimumStock > 0).length}
          </div>
          <div className="metric-hint">items below minimum</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn${tab === 'catalogue' ? ' btn-primary' : ''}`} onClick={() => setTab('catalogue')}>
          Item catalogue
        </button>
        <button className={`btn${tab === 'checkouts' ? ' btn-primary' : ''}`} onClick={() => setTab('checkouts')}>
          Checkout requests {(pendingCount + returnCount) > 0 && <span className="notif-dot" />}
        </button>
      </div>

      {tab === 'catalogue' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={openCreate}>+ Add item</button>
            <button className="btn" onClick={handleExport}>↓ Export to Excel</button>
            <button className="btn" onClick={handleDownloadTemplate}>↓ Download template</button>
            <label className="btn" style={{ cursor: 'pointer', marginBottom: 0 }}>
              {importing ? 'Importing…' : '↑ Bulk upload'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                disabled={importing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {importResult && (
            <div className="card" style={{
              background: importResult.errors?.length ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
              borderColor: 'transparent',
            }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: importResult.errors?.length ? 8 : 0 }}>
                {importResult.message}
              </div>
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)' }}>
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              <button
                className="btn btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => setImportResult(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {showForm && (
            <div className="card" style={{ borderColor: 'var(--color-primary)', borderWidth: 1 }}>
              <div className="card-title" style={{ color: 'var(--color-primary)' }}>
                {editItem ? `Edit — ${editItem.name}` : 'Add new item'}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-row">
                    <label className="form-label">Item name *</label>
                    <input className="form-input" placeholder="e.g. Phoenix Connector" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Category *</label>
                    <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Make / Brand</label>
                    <input className="form-input" placeholder="e.g. Phoenix Contact" value={form.make}
                      onChange={e => setForm(f => ({ ...f, make: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Part number</label>
                    <input className="form-input" placeholder="e.g. ST-1.5" value={form.partNumber}
                      onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Project</label>
                    <input className="form-input" list="project-suggestions" placeholder="e.g. Project Alpha" value={form.project}
                      onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
                    <datalist id="project-suggestions">
                      {projects.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Total quantity *</label>
                    <input className="form-input" type="number" min={0} value={form.totalQuantity}
                      onChange={e => setForm(f => ({ ...f, totalQuantity: e.target.value }))} required />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Unit</label>
                    <input className="form-input" placeholder="pcs, m, kg…" value={form.unit}
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Stockroom location</label>
                    <input className="form-input" placeholder="e.g. Shelf A, Bin 3" value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Minimum stock alert</label>
                    <input className="form-input" type="number" min={0} value={form.minimumStock}
                      onChange={e => setForm(f => ({ ...f, minimumStock: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label">Specifications</label>
                  <textarea className="form-input" rows={2} style={{ resize: 'none' }}
                    placeholder="Rating, size, colour, any relevant specs"
                    value={form.specifications} onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))} />
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : editItem ? 'Save changes' : 'Add item'}
                  </button>
                  <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.length === 0 ? <div className="empty-state"><p>No items yet. Add your first item above.</p></div> : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Part no.</th>
                    <th>Project</th>
                    <th>Location</th>
                    <th>Available</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const isLow = item.minimumStock > 0 && item.availableQuantity <= item.minimumStock;
                    return (
                      <tr key={item._id} style={{ background: isLow ? 'var(--color-danger-bg)' : 'transparent' }}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{item.name}</div>
                          {item.make && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{item.make}</div>}
                        </td>
                        <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{item.category}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.partNumber || '—'}</td>
                        <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {item.project
                            ? <span className="badge" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}>{item.project}</span>
                            : '—'}
                        </td>
                        <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{item.location || '—'}</td>
                        <td style={{ fontWeight: 700, color: item.availableQuantity === 0 ? 'var(--color-danger-text)' : 'var(--color-success-text)' }}>
                          {item.availableQuantity} {item.unit}
                        </td>
                        <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{item.totalQuantity} {item.unit}</td>
                        <td>
                          <button className="btn btn-sm" onClick={() => openEdit(item)}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'checkouts' && (
        <div className="card">
          <div className="card-title">Pending actions</div>
          {checkouts.length === 0 ? (
            <div className="empty-state"><p>No pending checkout or return requests.</p></div>
          ) : (
            checkouts.map(c => (
              <div className="approval-row" key={c._id}>
                <div className="approval-header">
                  <div className="approval-name">
                    {c.requestedBy?.name} — {c.item?.name} × {c.quantityRequested} {c.item?.unit}
                  </div>
                  <span className={`badge ${c.status === 'pending' ? 'badge-pending' : 'badge-approved'}`}>
                    {c.status === 'pending' ? 'Checkout request' : 'Return pending'}
                  </span>
                </div>
                <div className="approval-detail">
                  {c.item?.make && `${c.item.make} · `}
                  {c.item?.partNumber && `${c.item.partNumber} · `}
                  {c.purpose && `${c.purpose} · `}
                  {format(new Date(c.createdAt), 'd MMM yyyy')}
                </div>
                <div className="approval-actions">
                  {c.status === 'pending' && (
                    <>
                      <button className="btn btn-success btn-sm" disabled={acting === c._id} onClick={() => handleApprove(c)}>
                        {acting === c._id ? '…' : '✓ Approve & issue'}
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={acting === c._id} onClick={() => handleReject(c)}>
                        {acting === c._id ? '…' : '✕ Reject'}
                      </button>
                    </>
                  )}
                  {c.status === 'return_requested' && (
                    <button className="btn btn-primary btn-sm" disabled={acting === c._id} onClick={() => handleConfirmReturn(c)}>
                      {acting === c._id ? '…' : '✓ Confirm return'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
