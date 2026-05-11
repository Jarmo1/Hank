import webpush from 'web-push';
import {
  pool,
  listDueScheduledEvents,
  markScheduledEventSent,
  deletePushSubscriptionByEndpoint
} from './db.js';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

let vapidReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } catch (err) {
    console.warn('VAPID setup failed:', err?.message || err);
  }
}

function localParts(tz) {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz || 'Australia/Brisbane',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dayMap[parts.weekday] ?? 0;
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return {
    dow,
    hhmm: `${hh}:${parts.minute}`,
    date: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function withinFiveMin(nowHHMM, targetHHMM) {
  const toMin = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const n = toMin(nowHHMM);
  const t = toMin(targetHHMM);
  return n >= t && n < t + 5;
}

async function tick() {
  if (!pool || !vapidReady) return;

  let events;
  try {
    events = await listDueScheduledEvents();
  } catch (err) {
    console.warn('Scheduler tick failed:', err?.message || err);
    return;
  }

  for (const ev of events) {
    try {
      const { dow, hhmm, date } = localParts(ev.tz);
      if (!Array.isArray(ev.days_of_week) || !ev.days_of_week.includes(dow)) continue;
      if (!withinFiveMin(hhmm, ev.time_local)) continue;
      if (ev.last_sent_date && new Date(ev.last_sent_date).toISOString().slice(0, 10) === date) continue;

      const sub = {
        endpoint: ev.endpoint,
        keys: { p256dh: ev.p256dh, auth: ev.auth }
      };
      const payload = JSON.stringify({
        title: ev.label,
        body: ev.message || ev.label,
        url: '/'
      });

      await webpush.sendNotification(sub, payload);
      await markScheduledEventSent(ev.id, date);
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        await deletePushSubscriptionByEndpoint(ev.endpoint).catch(() => {});
      } else {
        console.warn('Push send error:', code || '', err?.body || err?.message || err);
      }
    }
  }
}

export function startScheduler() {
  if (!pool) {
    console.warn('Scheduler not started — no DATABASE_URL.');
    return;
  }
  if (!vapidReady) {
    console.warn('Scheduler started but VAPID keys missing — pushes will be skipped.');
  }
  // Tick every 60s, slightly off the minute to dodge clock-edge contention.
  setInterval(() => { tick().catch(() => {}); }, 60 * 1000);
  console.log('Notification scheduler running (60s tick).');
}
