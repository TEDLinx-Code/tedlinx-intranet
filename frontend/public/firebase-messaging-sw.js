// This file MUST be at the site root (e.g. https://intranet.tedlinx.com/firebase-messaging-sw.js)
// and named exactly firebase-messaging-sw.js — Firebase looks for it at this fixed path.
// It runs separately from the main app and handles push messages when the
// app/tab is closed or in the background.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Must match the config in src/services/firebase.js
firebase.initializeApp({
  apiKey: 'AIzaSyCgsPQ6bz2DgthIZtiyKee2cOsGf00eEGg',
  authDomain: 'tedlinx-intranet.firebaseapp.com',
  projectId: 'tedlinx-intranet',
  storageBucket: 'tedlinx-intranet.firebasestorage.app',
  messagingSenderId: '729025205524',
  appId: '1:729025205524:web:4ec6f26ce9b21f9a9cde01',
});

const messaging = firebase.messaging();

// Show a system notification when a push arrives while the app is in the background
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'TEDLinx Intranet';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

// When the user taps the notification, focus or open the app at the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
