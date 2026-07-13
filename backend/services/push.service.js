const admin = require('firebase-admin');
const DeviceToken = require('../models/DeviceToken');

// Initialise Firebase Admin SDK once.
// The service account JSON file path is set via FIREBASE_SERVICE_ACCOUNT_PATH env var.
// Alternatively paste the JSON content into FIREBASE_SERVICE_ACCOUNT_JSON env var.
let initialised = false;

function initFirebase() {
  if (initialised || admin.apps.length > 0) return;
  try {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // JSON content directly in env var (preferred for production/Railway)
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      // Path to the downloaded JSON file (easier for local dev)
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      credential = admin.credential.cert(serviceAccount);
    } else {
      console.warn('[Push] Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env');
      return;
    }

    admin.initializeApp({ credential });
    initialised = true;
    console.log('[Push] Firebase Admin SDK initialised');
  } catch (err) {
    console.error('[Push] Firebase Admin init failed:', err.message);
  }
}

/**
 * Send a push notification to all active devices of a user.
 * @param {string} userId - MongoDB user _id
 * @param {object} notification - { title, body, type, url }
 */
async function sendPushToUser(userId, { title, body, type = 'default', url = '/' }) {
  initFirebase();
  if (!initialised) return;

  try {
    const deviceTokens = await DeviceToken.find({ user: userId, isActive: true });
    if (!deviceTokens.length) return;

    const fullUrl = `https://tedlinx-intranet.vercel.app${url}`;
    const staleTokens = [];

    for (const device of deviceTokens) {
      try {
        await admin.messaging().send({
          token: device.token,
          notification: { title, body },
          data: { type, url: fullUrl },
          android: {
            priority: 'high',
            notification: { title, body, icon: 'ic_launcher' },
          },
          webpush: {
            headers: { Urgency: 'high', TTL: '86400' },
            notification: {
              title, body,
              icon: '/icon-192x192.png',
              badge: '/icon-72x72.png',
              requireInteraction: false,
            },
            fcmOptions: { link: fullUrl },
          },
        });
        console.log(`[Push] Sent to device ${device._id}`);
      } catch (e) {
        console.log(`[Push] Failed for device ${device._id}:`, e.message);
        if (e.code === 'messaging/invalid-registration-token' ||
            e.code === 'messaging/registration-token-not-registered') {
          staleTokens.push(device.token);
        }
      }
    }

    if (staleTokens.length) {
      await DeviceToken.updateMany({ token: { $in: staleTokens } }, { isActive: false });
    }
  } catch (err) {
    console.error('[Push] sendPushToUser error:', err.message);
  }
}

/**
 * Send a push notification to all active users (for broadcasts).
 * Uses FCM multicast — batches tokens in groups of 500.
 */
async function sendPushToAllUsers({ title, body, type = 'broadcast', url = '/' }) {
  initFirebase();
  if (!initialised) return;

  try {
    const deviceTokens = await DeviceToken.find({ isActive: true });
    if (!deviceTokens.length) return;

    const tokens = [...new Set(deviceTokens.map(d => d.token))];
    console.log(`[Push] Broadcasting to ${tokens.length} device(s)`);

    // FCM multicast limit is 500 tokens per call — batch accordingly
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const message = {
        notification: { title, body },
        data: { type, url },
        tokens: batch,
        android: {
          priority: 'high',
          notification: {
          title,
          body,
          icon: 'ic_launcher',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '86400',
          },
          notification: {
            title, body,
            icon: '/icon-192x192.png',
            badge: '/icon-72x72.png',
            vibrate: [200, 100, 200],
            requireInteraction: false,
          },
          fcmOptions: { link: `https://tedlinx-intranet.vercel.app${url}` },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`[Push] Broadcast batch 1: ${response.successCount}/${tokens.length} delivered`);
      // Clean up stale tokens
      const staleTokens = [];
      response.responses.forEach((resp, j) => {
        if (!resp.success && (
          resp.error?.code === 'messaging/invalid-registration-token' ||
          resp.error?.code === 'messaging/registration-token-not-registered'
        )) {
          staleTokens.push(batch[j]);
        }
      });
      if (staleTokens.length) {
        await DeviceToken.updateMany({ token: { $in: staleTokens } }, { isActive: false });
      }
    }
  } catch (err) {
    console.error('[Push] sendPushToAllUsers error:', err.message);
  }
}

module.exports = { sendPushToUser, sendPushToAllUsers };
