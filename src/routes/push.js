import express from 'express';
import webpush from 'web-push';
import { requireAuth } from '../middleware/auth.js';
import { savePushSubscription, getPushSubscription, deletePushSubscriptionByEndpoint } from '../db.js';

const router = express.Router();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

let vapidReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } catch (err) {
    console.warn('VAPID setup failed (push.js):', err?.message || err);
  }
}

// GET /api/push/vapid — public key for browser subscription
router.get('/vapid', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC || null, configured: Boolean(VAPID_PUBLIC && VAPID_PRIVATE) });
});

// POST /api/push/subscribe — body: { endpoint, keys: { p256dh, auth } }
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const sub = req.body;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription payload.' });
    }
    await savePushSubscription(req.userId, sub);
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /push/subscribe error:', err);
    return res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// POST /api/push/unsubscribe — body: { endpoint }
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required.' });
    await deletePushSubscriptionByEndpoint(endpoint);
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /push/unsubscribe error:', err);
    return res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
});

// POST /api/push/test — sends a test notification to the signed-in user
router.post('/test', requireAuth, async (req, res) => {
  try {
    if (!vapidReady) return res.status(503).json({ error: 'Server VAPID keys not configured.' });
    const sub = await getPushSubscription(req.userId);
    if (!sub) return res.status(404).json({ error: 'No push subscription on file.' });
    const payload = JSON.stringify({ title: 'Hank', body: 'Notifications are working.', url: '/' });
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /push/test error:', err?.statusCode || '', err?.body || err?.message || err);
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      return res.status(410).json({ error: 'Subscription expired — resubscribe.' });
    }
    return res.status(500).json({ error: 'Push test failed.' });
  }
});

export default router;
