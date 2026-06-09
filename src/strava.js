// src/strava.js
// Strava API client + auto-tick logic. Non-blocking: webhook handlers call
// processActivity() which refreshes tokens as needed, fetches the activity,
// matches it to the active run plan, ticks it off and fires a push.
import webpush from 'web-push';
import {
  getStravaAccountByAthlete, getStravaAccountByUser, updateStravaTokens,
  getActiveRunPlan, updateRunPlan, getAllPushSubscriptions, deletePushSubscriptionByEndpoint
} from './db.js';
import { matchSession } from './runPlan.js';

const AUTH_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API_BASE = 'https://www.strava.com/api/v3';

export const CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
export const SCOPE = 'read,activity:read_all';

export function stravaConfigured() { return Boolean(CLIENT_ID && CLIENT_SECRET); }

// Public base URL (for OAuth redirect + webhook callback). Prefer explicit env.
export function publicBaseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (req) return `${req.protocol}://${req.get('host')}`;
  return '';
}

export function authorizeUrl(redirectUri, state) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE
  });
  if (state) p.set('state', state);
  return `${AUTH_URL}?${p.toString()}`;
}

async function postToken(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Strava token error ${res.status}`);
  return body;
}

export function exchangeCodeForToken(code) {
  return postToken({ code, grant_type: 'authorization_code' });
}

// Return a valid access token for a stored account, refreshing + persisting if expired.
async function getValidAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 120) return account.access_token;
  const refreshed = await postToken({ grant_type: 'refresh_token', refresh_token: account.refresh_token });
  await updateStravaTokens(account.user_id, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: refreshed.expires_at
  });
  return refreshed.access_token;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Strava GET ${path} -> ${res.status} ${body.slice(0, 120)}`);
  }
  return res.json();
}

// Normalise a raw Strava activity into the shape matchSession() expects.
function normalizeActivity(a) {
  return {
    id: a.id,
    name: a.name,
    type: a.sport_type || a.type,
    distanceKm: (a.distance || 0) / 1000,
    movingTimeSec: a.moving_time || 0,
    dateLocal: a.start_date_local || a.start_date,
    raw: a
  };
}

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

function paceFrom(distanceKm, movingTimeSec) {
  if (!distanceKm || !movingTimeSec) return null;
  const s = Math.round(movingTimeSec / distanceKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
}

// Send a push to every device the user has registered. Best-effort.
async function pushToUser(userId, payload) {
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try { webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@example.com', VAPID_PUBLIC, VAPID_PRIVATE); }
  catch { return; }
  const subs = await getAllPushSubscriptions(userId).catch(() => []);
  const body = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await deletePushSubscriptionByEndpoint(s.endpoint).catch(() => {});
      }
    }
  }
}

// Tick the matching plan session for one user from one normalised activity.
// Returns { ticked, session } or { ticked:false }.
export async function applyActivityToPlan(userId, act) {
  const row = await getActiveRunPlan(userId);
  if (!row) return { ticked: false };
  const plan = row.plan_json;
  const session = matchSession(plan, act);
  if (!session || session.completed) return { ticked: false, session: session || null };

  session.completed = true;
  session.stravaActivityId = act.id;
  session.actual = {
    name: act.name,
    distanceKm: Math.round(act.distanceKm * 100) / 100,
    movingTimeSec: act.movingTimeSec,
    pace: paceFrom(act.distanceKm, act.movingTimeSec),
    date: (act.dateLocal || '').slice(0, 10)
  };
  await updateRunPlan(userId, row.id, plan);
  return { ticked: true, session };
}

// Full pipeline for one webhook activity event.
export async function processActivity(athleteId, activityId) {
  const account = await getStravaAccountByAthlete(athleteId);
  if (!account) return;
  const token = await getValidAccessToken(account);
  const raw = await apiGet(`/activities/${activityId}`, token);
  const act = normalizeActivity(raw);
  if (!RUN_TYPES.has(act.type)) return; // only runs tick the plan
  const { ticked, session } = await applyActivityToPlan(account.user_id, act);
  if (ticked && session) {
    await pushToUser(account.user_id, {
      title: '✅ Run ticked off',
      body: `${session.title} done — ${act.distanceKm.toFixed(1)}km${session.actual?.pace ? ' @ ' + session.actual.pace : ''}`,
      url: '/?tab=run'
    });
  }
}

// Manual sync: pull recent activities and tick any matches. Returns count.
export async function syncRecentActivities(userId, sinceDays = 30) {
  const account = await getStravaAccountByUser(userId);
  if (!account) return { ticked: 0, scanned: 0 };
  const token = await getValidAccessToken(account);
  const after = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const list = await apiGet(`/athlete/activities?after=${after}&per_page=100`, token);
  let ticked = 0;
  for (const raw of (Array.isArray(list) ? list : [])) {
    const act = normalizeActivity(raw);
    if (!RUN_TYPES.has(act.type)) continue;
    const r = await applyActivityToPlan(userId, act);
    if (r.ticked) ticked++;
  }
  return { ticked, scanned: Array.isArray(list) ? list.length : 0 };
}

// Create the Strava push subscription (one-time). Strava will GET the callback to
// verify, then POST events. Returns the created subscription.
export async function createWebhookSubscription(callbackUrl, verifyToken) {
  const res = await fetch(`${API_BASE}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, callback_url: callbackUrl, verify_token: verifyToken })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}
