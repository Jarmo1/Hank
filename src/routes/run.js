// src/routes/run.js — ultra training-plan API
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generatePlan } from '../runPlan.js';
import { getStravaAccountByUser, getActiveRunPlan, saveRunPlan, updateRunPlan } from '../db.js';
import { stravaConfigured } from '../strava.js';

const router = express.Router();

const noStore = (res) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate'); res.set('Pragma', 'no-cache'); res.set('Expires', '0'); };

// Parse "mm:ss" (per km) or "h:mm:ss" / total seconds into seconds.
function timeToSec(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const parts = String(v).trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// POST /api/run/plan — build (and store as active) a new plan from inputs
router.post('/plan', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.raceDate) return res.status(400).json({ error: 'A race date is required.' });

    const fitness = {};
    if (b.recentRaceDistanceKm && (b.recentRaceTime || b.recentRaceTimeSec)) {
      fitness.recentRace = {
        distanceKm: Number(b.recentRaceDistanceKm),
        timeSec: timeToSec(b.recentRaceTimeSec ?? b.recentRaceTime)
      };
    } else if (b.easyPace || b.easyPaceSec) {
      fitness.easyPaceSec = timeToSec(b.easyPaceSec ?? b.easyPace);
    }

    const plan = generatePlan({
      raceDate: b.raceDate,
      raceDistanceKm: Number(b.raceDistanceKm) || 50,
      goal: b.goal === 'time' ? 'time' : 'finish',
      runDays: Array.isArray(b.runDays) && b.runDays.length ? b.runDays : undefined,
      longRunDay: b.longRunDay || undefined,
      currentWeeklyKm: Number(b.currentWeeklyKm) || 0,
      longestRecentKm: Number(b.longestRecentKm) || 0,
      fitness
    });

    const saved = await saveRunPlan(req.userId, plan, plan.meta.raceDate, plan.meta.raceDistanceKm);
    noStore(res);
    return res.json({ plan, planId: saved?.id });
  } catch (err) {
    console.error('Build run plan error:', err);
    return res.status(500).json({ error: err.message || 'Failed to build plan.' });
  }
});

// GET /api/run/plan — active plan + strava connection state
router.get('/plan', requireAuth, async (req, res) => {
  try {
    const row = await getActiveRunPlan(req.userId);
    const strava = await getStravaAccountByUser(req.userId);
    noStore(res);
    return res.json({
      plan: row?.plan_json || null,
      planId: row?.id || null,
      createdAt: row?.created_at || null,
      strava: { connected: Boolean(strava), athleteId: strava?.athlete_id || null, configured: stravaConfigured() }
    });
  } catch (err) {
    console.error('Get run plan error:', err);
    return res.status(500).json({ error: 'Failed to fetch plan.' });
  }
});

// PATCH /api/run/session — manually tick/untick a session by date id
router.patch('/session', requireAuth, async (req, res) => {
  try {
    const { sessionId, completed } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required.' });
    const row = await getActiveRunPlan(req.userId);
    if (!row) return res.status(404).json({ error: 'No active plan.' });
    const plan = row.plan_json;
    let found = null;
    for (const w of plan.weeks) for (const s of w.sessions) if (s.id === sessionId) found = s;
    if (!found) return res.status(404).json({ error: 'Session not found.' });
    found.completed = Boolean(completed);
    if (!found.completed) { found.stravaActivityId = null; found.actual = null; }
    await updateRunPlan(req.userId, row.id, plan);
    noStore(res);
    return res.json({ session: found });
  } catch (err) {
    console.error('Tick session error:', err);
    return res.status(500).json({ error: 'Failed to update session.' });
  }
});

export default router;
