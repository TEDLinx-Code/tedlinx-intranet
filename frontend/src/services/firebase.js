import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyCgsPQ6bz2DgthIZtiyKee2cOsGf00eEGg',
  authDomain: 'tedlinx-intranet.firebaseapp.com',
  projectId: 'tedlinx-intranet',
  storageBucket: 'tedlinx-intranet.firebasestorage.app',
  messagingSenderId: '729025205524',
  appId: '1:729025205524:web:4ec6f26ce9b21f9a9cde01',
};

const VAPID_KEY = 'BD1k5AfmnzZnWwxEhZ8m61Esms_57azr-TOHXMLpTD4LaB-T7FwwcXkcaR-cgztJ9QyA8YXDWXAGJweMxcyBCT8';

const app = initializeApp(firebaseConfig);
let messagingInstance = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Requests notification permission, gets FCM token,
 * and registers it with the intranet backend.
 */
export async function requestNotificationPermission(apiInstance = null) {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[Push] Firebase Messaging not supported in this browser.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission not granted.');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return null;

    // Register token with our backend so the server can send pushes to this device
    if (apiInstance) {
      await apiInstance.post('/push/register', { token, platform: 'web' }).catch(e => {
        console.warn('[Push] Could not register token with backend:', e.message);
      });
    }

    // Store token locally so we can deregister on logout
    localStorage.setItem('fcmToken', token);
    return token;
  } catch (err) {
    console.error('[Push] Failed to get notification permission/token:', err);
    return null;
  }
}

/**
 * Deregisters the current device token from the backend (call on logout).
 */
export async function deregisterPushToken(apiInstance) {
  const token = localStorage.getItem('fcmToken');
  if (!token) return;
  try {
    await apiInstance.delete('/push/deregister', { data: { token } });
    localStorage.removeItem('fcmToken');
  } catch (e) {
    console.warn('[Push] Could not deregister token:', e.message);
  }
}

/**
 * Listens for push messages while the app is in the foreground.
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

