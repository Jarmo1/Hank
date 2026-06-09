// src/routes/strava.js — Strava OAuth connect/callback, webhook, manual sync.
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  stravaConfigured, authorizeUrl, exchangeCodeForToken, publicBaseUrl,
  processActivity, syncRecentActivities, createWebhookSubscription, SCOPE
} from '../strava.js';
import { saveStravaAccount, getStravaAccountByUser, deleteStravaAccount } from '../db.js';

const router = express.Router();
const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'hank-strava-verify';

const redirectUri = (req) => process.env.STRAVA_REDIRECT_URI || `${publicBaseUrl(req)}/api/strava/callback`;

// GET /api/strava/status
router.get('/status', requireAuth, async (req, res) => {
  const acc = await getStravaAccountByUser(req.userId).catch(() => null);
  res.json({ configured: stravaConfigured(), connected: Boolean(acc), athleteId: acc?.athlete_id || null });
});

// GET /api/strava/connect — redirect the user to Strava's OAuth screen
router.get('/connect', requireAuth, (req, res) => {
  if (!stravaConfigured()) return res.status(503).json({ error: 'Strava is not configured on the server.' });
  // sign the user id into state so the callback knows who is connecting
  const state = String(req.userId);
  return res.redirect(authorizeUrl(redirectUri(req), state));
});

// GET /api/strava/callback — exchange the code, store tokens, bounce back to app
router.get('/callback', async (req, res) => {
  try {
    const { code, error, state, scope } = req.query;
    if (error) return res.redirect('/?tab=run&strava=denied');
    const userId = Number(state);
    if (!code || !userId) return res.redirect('/?tab=run&strava=error');

    const tok = await exchangeCodeForToken(String(code));
    await saveStravaAccount(userId, {
      athleteId: tok.athlete?.id,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: tok.expires_at,
      scope: String(scope || SCOPE)
    });
    return res.redirect('/?tab=run&strava=connected');
  } catch (err) {
    console.error('Strava callback error:', err);
    return res.redirect('/?tab=run&strava=error');
  }
});

// POST /api/strava/disconnect
router.post('/disconnect', requireAuth, async (req, res) => {
  await deleteStravaAccount(req.userId).catch(() => {});
  res.json({ ok: true });
});

// POST /api/strava/sync — pull recent activities and tick matches now
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const out = await syncRecentActivities(req.userId, Number(req.body?.days) || 30);
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error('Strava sync error:', err);
    res.status(500).json({ error: err.message || 'Sync failed.' });
  }
});

// POST /api/strava/subscribe-webhook — one-time: register the push subscription
router.post('/subscribe-webhook', requireAuth, async (req, res) => {
  try {
    const callbackUrl = `${publicBaseUrl(req)}/api/strava/webhook`;
    const out = await createWebhookSubscription(callbackUrl, VERIFY_TOKEN);
    res.json({ ok: true, callbackUrl, subscription: out });
  } catch (err) {
    console.error('Webhook subscribe error:', err);
    res.status(500).json({ error: err.message || 'Failed to create subscription.', hint: 'A subscription may already exist for this app.' });
  }
});

// GET /api/strava/webhook — Strava validation handshake (no auth)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.json({ 'hub.challenge': challenge });
  }
  return res.sendStatus(403);
});

// POST /api/strava/webhook — activity events (no auth). Ack fast, process async.
router.post('/webhook', (req, res) => {
  res.sendStatus(200);
  try {
    const ev = req.body || {};
    if (ev.object_type === 'activity' && (ev.aspect_type === 'create' || ev.aspect_type === 'update')) {
      processActivity(ev.owner_id, ev.object_id).catch((e) => console.warn('processActivity:', e.message));
    }
  } catch (e) { console.warn('webhook parse:', e.message); }
});

export default router;
