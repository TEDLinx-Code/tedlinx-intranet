import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ROLES = ['employee', 'manager', 'storekeeper', 'admin'];
const DEPARTMENTS = ['Engineering', 'Operations', 'HR', 'Finance', 'Sales', 'Management', 'Other'];

function initials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

const emptyForm = {
  name: '', email: '', password: '', role: 'employee',
  department: '', jobTitle: '', phone: '', odooEmployeeId: '',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const fetchUsers = () => {
    api.get('/users')
      .then(r => setUsers(r.data.users))
      .catch(() => toast.error('Could not load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'employee',
      department: user.department || '',
      jobTitle: user.jobTitle || '',
      phone: user.phone || '',
      odooEmployeeId: user.odooEmployeeId || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.odooEmployeeId) payload.odooEmployeeId = parseInt(payload.odooEmployeeId);
      else delete payload.odooEmployeeId;
      if (!payload.password) delete payload.password;

      if (editUser) {
        await api.put(`/users/${editUser._id}`, payload);
        toast.success('User updated.');
      } else {
        await api.post('/users', payload);
        toast.success(`Account created for ${form.name}.`);
      }
      setShowForm(false);
      setForm(emptyForm);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (user) => {
    if (!confirm(`Deactivate ${user.name}? They will not be able to log in.`)) return;
    try {
      await api.delete(`/users/${user._id}`);
      toast.success(`${user.name} deactivated.`);
      fetchUsers();
    } catch {
      toast.error('Could not deactivate user.');
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role) => {
    if (role === 'admin') return { background: 'var(--color-accent-bg)', color: 'var(--color-accent-text)' };
    if (role === 'manager') return { background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' };
    return { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' };
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">User management</div>
            <div className="page-sub">{users.filter(u => u.isActive !== false).length} active accounts</div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            + Add employee
          </button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card" style={{ borderColor: 'var(--color-primary)', borderWidth: 1 }}>
          <div className="card-title" style={{ color: 'var(--color-primary)' }}>
            {editUser ? `Edit — ${editUser.name}` : 'Add new employee'}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Full name *</label>
                <input className="form-input" placeholder="e.g. Rajan Kumar" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">Work email *</label>
                <input className="form-input" type="email" placeholder="rajan@tedlinx.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label">{editUser ? 'New password (leave blank to keep)' : 'Password *'}</label>
                <input className="form-input" type="password" placeholder={editUser ? 'Leave blank to keep current' : 'Min 8 characters'}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required={!editUser} minLength={form.password ? 8 : undefined} />
              </div>
              <div className="form-row">
                <label className="form-label">Role *</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Department</label>
                <select className="form-input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Job title</label>
                <input className="form-input" placeholder="e.g. Senior Engineer" value={form.jobTitle}
                  onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="+91 98400 12345" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">Odoo employee ID</label>
                <input className="form-input" type="number" placeholder="e.g. 42 (from Odoo URL)"
                  value={form.odooEmployeeId} onChange={e => setForm(f => ({ ...f, odooEmployeeId: e.target.value }))} />
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  Find in Odoo: open employee → check URL → /odoo/employees/<strong>42</strong>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editUser ? 'Save changes' : 'Create account'}
              </button>
              <button className="btn" type="button" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <SearchIcon />
        <input className="form-input" style={{ paddingLeft: 36 }} type="text"
          placeholder="Search by name, email or department…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>{search ? `No users matching "${search}"` : 'No users yet. Add your first employee above.'}</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Department</th>
                <th>Odoo ID</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                        {initials(user.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{user.name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={roleColor(user.role)}>{user.role}</span>
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{user.department || '—'}</td>
                  <td>
                    {user.odooEmployeeId
                      ? <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-primary)' }}>#{user.odooEmployeeId}</span>
                      : <span style={{ color: 'var(--color-danger-text)', fontSize: 13 }}>Not linked</span>}
                  </td>
                  <td>
                    <span className={`badge ${user.isActive === false ? 'badge-refused' : 'badge-approved'}`}>
                      {user.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(user)}>Edit</button>
                      {user.isActive !== false && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(user)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Odoo ID help box */}
      <div className="card" style={{ background: 'var(--color-accent-bg)', borderColor: 'transparent' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-accent-text)' }}>
          <strong>⚠ Important:</strong> Employees will not see Leave or Expense data until their <strong>Odoo ID</strong> is set.
          To find it: log into Odoo → open the employee record → the number in the URL is their ID.
          e.g. <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 4 }}>
            tedlinx.odoo.com/odoo/employees/<strong>42</strong>
          </code>
        </div>
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 17, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
