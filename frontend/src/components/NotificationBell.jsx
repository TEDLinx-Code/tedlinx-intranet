import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../services/notification.service';

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

// Bell icon with an unread badge and a dropdown of recent notifications.
// Used in both the desktop-fixed position and inline inside the mobile top bar,
// selected via the `className` prop passed by the caller.
export default function NotificationBell({ className = '' }) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);

  const refreshCount = () => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  };

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      getNotifications().then(list => { setNotifications(list); setLoaded(true); }).catch(() => {});
    }
  };

  const handleItemClick = async (n) => {
    setOpen(false);
    if (!n.read) {
      try {
        await markNotificationRead(n._id);
        setNotifications(list => list.map(x => x._id === n._id ? { ...x, read: true } : x));
        setUnreadCount(c => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
    navigate(n.url || '/');
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllNotificationsRead();
      setNotifications(list => list.map(x => ({ ...x, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  return (
    <div ref={wrapRef} className={`notif-bell-wrap ${className}`}>
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        style={{
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--color-text)',
          cursor: 'pointer', position: 'relative',
        }}
      >
        <div style={{ width: 22, height: 22 }}><BellIcon /></div>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: 'var(--color-danger-text)', color: '#fff',
            fontSize: 10, fontWeight: 700, borderRadius: 9,
            minWidth: 16, height: 16, padding: '0 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, width: 340, maxWidth: '90vw',
          background: 'var(--color-surface)', border: '0.5px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 300, maxHeight: 420, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '0.5px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Notifications</span>
            {unreadCount > 0 && (
              <span
                onClick={handleMarkAllRead}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Mark all read
              </span>
            )}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: '0.5px solid var(--color-border)',
                    background: n.read ? 'transparent' : 'var(--color-primary-bg)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: n.read ? 500 : 700, color: 'var(--color-text)' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {n.body}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
