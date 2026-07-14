import { useState, useEffect } from 'react';

const DISMISS_KEY = 'installPromptDismissedAt';
const DISMISS_DAYS = 14;

function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

function isIOS() {
  try {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  } catch {
    return false;
  }
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const days = (Date.now() - parseInt(raw)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, verticalAlign: -3 }}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
  </svg>
);

// Shows a way for users to install the app to their home screen on every platform.
// - iOS Safari never fires a native install prompt (Apple platform limitation), so we
//   show step-by-step instructions for the manual Share > Add to Home Screen flow.
// - Android/Chrome/desktop Chrome support the real `beforeinstallprompt` flow, so we
//   capture that event and show a genuine one-tap Install button.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    if (isIOS()) {
      setShowIOSBanner(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => { setDeferredPrompt(null); setDismissed(true); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShowIOSBanner(false);
    setDeferredPrompt(null);
    setDismissed(true);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    setDeferredPrompt(null);
  };

  if (dismissed || (!showIOSBanner && !deferredPrompt)) return null;

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 16,
      transform: 'translateX(-50%)',
      zIndex: 250,
      width: 380,
      maxWidth: 'calc(100vw - 32px)',
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>📲</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
          Install TEDLinx Intranet
        </div>
        {showIOSBanner ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
            Tap the Share icon <ShareIcon /> in Safari, then choose "Add to Home Screen".
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Add it to your home screen for quick, full-screen access.
          </div>
        )}
      </div>
      {!showIOSBanner && (
        <button className="btn btn-primary btn-sm" onClick={handleAndroidInstall} style={{ flexShrink: 0 }}>
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 18, padding: '0 2px', flexShrink: 0, fontFamily: 'inherit', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
