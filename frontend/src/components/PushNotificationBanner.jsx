import { useState, useEffect } from 'react';

export default function PushNotificationBanner({ notification, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!notification) return;
    setVisible(true);
    setExiting(false);
    const t = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(t);
  }, [notification]);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => { setVisible(false); onDismiss?.(); }, 300);
  };

  if (!notification || !visible) return null;

  const { title, body, type } = notification;

  const typeConfig = {
    leave_approved:   { icon: '✅', accent: '#2AACBB' },
    leave_refused:    { icon: '❌', accent: '#e53e3e' },
    expense_approved: { icon: '💰', accent: '#2AACBB' },
    expense_refused:  { icon: '❌', accent: '#e53e3e' },
    broadcast:        { icon: '📢', accent: '#F5A623' },
    default:          { icon: '🔔', accent: '#2AACBB' },
  };
  const cfg = typeConfig[type] || typeConfig.default;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: exiting
        ? 'translateX(-50%) translateY(-80px)'
        : 'translateX(-50%) translateY(0)',
      zIndex: 9999,
      width: 380,
      maxWidth: 'calc(100vw - 32px)',
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      opacity: exiting ? 0 : 1,
      transition: 'all 0.3s cubic-bezier(0.34, 1.3, 0.64, 1)',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <div style={{ width: 4, background: cfg.accent, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18', marginBottom: body ? 2 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          {body && (
            <div style={{ fontSize: 13, color: '#5f5e5a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {body}
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9a9894', fontSize: 18, padding: '0 4px', flexShrink: 0,
            fontFamily: 'inherit', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}