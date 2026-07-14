import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { format } from 'date-fns';
import { requestNotificationPermission } from '../services/firebase';
import { toast } from 'react-hot-toast';
import { getMyTasks } from '../services/task.service';


function statusClass(state) {
  const map = { draft: 'draft', confirm: 'pending', validate1: 'pending', validate: 'approved', refuse: 'refused' };
  return `badge badge-${map[state] || 'draft'}`;
}
function statusLabel(state) {
  const map = { draft: 'Draft', confirm: 'Pending', validate1: 'Pending', validate: 'Approved', refuse: 'Refused' };
  return map[state] || state;
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [recentLeave, setRecentLeave] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [announcement, setAnnouncement] = useState(null); // { type: 'broadcast'|'quote', ... }
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Announcement banner and tasks load independently of Odoo linkage
    api.get('/broadcasts/current').then(r => setAnnouncement(r.data)).catch(() => {});
    getMyTasks().then(setMyTasks).catch(() => {});

    if (!user?.odooEmployeeId) { setLoading(false); return; }
    // Request push permission once per session after login.
    // Guarded: the Notification API doesn't exist on iOS Safari before 16.4 (and in
    // some webviews), and referencing it directly throws an uncaught ReferenceError
    // that crashes the whole app — hence the typeof check before touching it.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      import('../services/firebase').then(({ requestNotificationPermission }) => {
        import('../services/api').then(({ default: api }) => {
          requestNotificationPermission(api);
        });
      });
    }
    Promise.all([
      api.get('/leave/balance').then(r => setLeaveBalance(r.data.allocations)),
      api.get('/leave/my').then(r => setRecentLeave(r.data.requests.slice(0, 3))),
      api.get('/expenses/my').then(r => setRecentExpenses(r.data.expenses.slice(0, 3))),
      api.get(`/directory/${user.odooEmployeeId}`).then(r => setPhoto(r.data.employee?.image_128 || null)),
      api.get('/payslips').then(r => setPayslips(r.data.payslips.slice(0, 3))).catch(() => {}),
      api.get('/assets/my').then(r => setMyAssets(r.data.assets)).catch(() => {}),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const totalLeave = leaveBalance ? leaveBalance.reduce((sum, a) => sum + (a.virtual_remaining_leaves ?? a.number_of_days), 0) : null;
  const pendingLeave = recentLeave.filter(l => ['confirm', 'validate1'].includes(l.state)).length;
  const pendingExpenses = recentExpenses.filter(e => ['draft', 'submitted', 'reported'].includes(e.state)).length;
  const openTasks = myTasks.filter(t => t.status !== 'Completed').length;
  const [notifStatus, setNotifStatus] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    try { return Notification.permission; } catch { return 'default'; }
  });

  const handleEnableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Notifications are not supported on this browser.');
      return;
    }
    const token = await requestNotificationPermission(api);
    if (token) {
      setNotifStatus('granted');
      toast.success('Notifications enabled!');
    } else {
      try { setNotifStatus(Notification.permission); } catch { setNotifStatus('default'); }
      toast.error('Could not enable notifications. Please allow in browser settings.');
    }
  };

  // ... existing useEffect and other functions ...
  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
          <div className="avatar" style={{ width: 72, height: 72, fontSize: 22, flexShrink: 0,
            ...(photo ? {} : { background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }) }}>
            {photo
            ? <img src={`data:image/png;base64,${photo}`} alt={user?.name}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            }
          </div>
          <div>
            <div className="page-title">Good {hour()}, {user?.name?.split(' ')[0]}</div>
            <div className="page-sub">{format(new Date(), 'EEEE, d MMMM yyyy')}</div>
          </div>
        </div>
      </div>

      {/* Broadcast / quote banner */}
      {announcement && (
        announcement.type === 'broadcast' ? (
          <div className="broadcast-banner">
            <div className="broadcast-label">📢 Company announcement</div>
            <div className="broadcast-text">{announcement.broadcast.message}</div>
            <div className="broadcast-meta">
              Posted by {announcement.broadcast.createdBy?.name || 'Admin'} · Visible till{' '}
              {format(new Date(announcement.broadcast.endDate), 'd MMM yyyy')}
            </div>
          </div>
        ) : (
          <div className="quote-banner">
            <div className="quote-text">"{announcement.quote.text}"</div>
            <div className="quote-author">— {announcement.quote.author}</div>
          </div>
        )
      )}
      {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
        <div style={{
          background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent)',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-accent-text)' }}>
                Enable notifications
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-text)', opacity: 0.8 }}>
                Get alerts for leave approvals, expenses and announcements
              </div>
            </div>
          </div>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleEnableNotifications}
            style={{ flexShrink: 0 }}
          >
            Enable
          </button>
        </div>
      )}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Leave balance</div>
          <div className="metric-value">{totalLeave ?? '—'}</div>
          <div className="metric-hint">days remaining</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending leaves</div>
          <div className="metric-value">{pendingLeave}</div>
          <div className="metric-hint">awaiting approval</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending expenses</div>
          <div className="metric-value">{pendingExpenses}</div>
          <div className="metric-hint">submitted claims</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">My assets</div>
          <div className="metric-value">{myAssets.length}</div>
          <div className="metric-hint">items assigned</div>
        </div>
        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
          <div className="metric-label">My tasks</div>
          <div className="metric-value">{openTasks}</div>
          <div className="metric-hint">open tasks</div>
        </div>
      </div>

      <div className="quick-actions" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="quick-action" onClick={() => navigate('/leave')}>
          <CalendarIcon />
          <span>Apply leave</span>
        </div>
        <div className="quick-action" onClick={() => navigate('/expenses')}>
          <ReceiptIcon />
          <span>New expense</span>
        </div>
        <div className="quick-action" onClick={() => navigate('/inventory')}>
          <BoxIcon />
          <span>Inventory</span>
        </div>
        <div className="quick-action" onClick={() => navigate('/directory')}>
          <UsersIcon />
          <span>Directory</span>
        </div>
        <div className="quick-action" onClick={() => navigate('/tasks')}>
          <TaskIcon />
          <span>Tasks</span>
        </div>
      </div>

      {!user?.odooEmployeeId && (
        <div className="card" style={{ background: 'var(--color-warning-bg)', borderColor: 'transparent' }}>
          <p style={{ fontSize: 13, color: 'var(--color-warning-text)' }}>
            Your account is not yet linked to an Odoo employee record. Leave and expense features will be unavailable until an administrator links your account. Contact HR to resolve this.
          </p>
        </div>
      )}

      {/* Payslips + Assets two-column row */}
      {!loading && user?.odooEmployeeId && (payslips.length > 0 || myAssets.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
          {payslips.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>💰 Recent payslips</span>
                <span className="see-all-link" onClick={() => navigate('/payslips')}>View all →</span>
              </div>
              {payslips.map(p => {
                const netLine = p.line_ids ? null : null; // amount not in list view; show period only
                return (
                  <div className="list-row" key={p.id} style={{ padding: '10px 0' }}>
                    <div className="list-row-left">
                      <div className="list-row-title">{p.name || (p.date_from ? format(new Date(p.date_from), 'MMMM yyyy') : `Payslip #${p.id}`)}</div>
                      <div className="list-row-sub">
                        {p.date_from ? format(new Date(p.date_from), 'd MMM') : ''} – {p.date_to ? format(new Date(p.date_to), 'd MMM yyyy') : ''}
                      </div>
                    </div>
                    <span className={p.paid ? 'badge badge-approved' : 'badge badge-pending'}>{p.paid ? 'Paid' : 'Done'}</span>
                  </div>
                );
              })}
            </div>
          )}

          {myAssets.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>💻 My assets</span>
                <span className="see-all-link" onClick={() => navigate('/my-assets')}>View all →</span>
              </div>
              {myAssets.slice(0, 3).map(a => (
                <div className="list-row" key={a._id} style={{ padding: '10px 0' }}>
                  <div className="list-row-left">
                    <div className="list-row-title">{a.name}</div>
                    <div className="list-row-sub">{[a.make, a.assetTag ? `Tag: ${a.assetTag}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="badge badge-approved">{a.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && recentLeave.length > 0 && (
        <div className="card">
          <div className="card-title">Recent leave requests</div>
          {recentLeave.map(l => (
            <div className="list-row" key={l.id}>
              <div className="list-row-left">
                <div className="list-row-title">{l.holiday_status_id?.[1] || 'Leave'}</div>
                <div className="list-row-sub">
                  {l.date_from ? format(new Date(l.date_from), 'd MMM') : ''} –{' '}
                  {l.date_to ? format(new Date(l.date_to), 'd MMM yyyy') : ''} · {l.number_of_days} day(s)
                </div>
              </div>
              <span className={statusClass(l.state)}>{statusLabel(l.state)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && recentExpenses.length > 0 && (
        <div className="card">
          <div className="card-title">Recent expenses</div>
          {recentExpenses.map(e => (
            <div className="list-row" key={e.id}>
              <div className="list-row-left">
                <div className="list-row-title">{e.name}</div>
                <div className="list-row-sub">
                  {e.currency_id?.[1] || '₹'} {parseFloat(e.total_amount).toFixed(2)} · {e.date ? format(new Date(e.date), 'd MMM yyyy') : ''}
                </div>
              </div>
              <span className={statusClass(e.state)}>{statusLabel(e.state)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function hour() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const CalendarIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
const ReceiptIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2l2 2 2-2 2 2 2-2 2 2 2-2v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2zM9 10h6M9 14h4" /></svg>;
const UsersIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const BoxIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
const TaskIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
