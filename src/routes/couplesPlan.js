import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getLatestMealPlan,
  saveMealPlan,
  updateMealPlan,
  getProfile
} from '../db.js';
import { buildDefaultCouplesPlan } from '../couplesSeed.js';
import { generateCouplesWeeklyPlan } from '../aiPlanner.js';

const router = express.Router();

function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function findMeal(plan, day, type) {
  const dayObj = plan?.days?.find(d => d.day === day);
  if (!dayObj) return null;
  return dayObj.meals.find(m => m.type === type) || null;
}

// GET /api/couples-plan — current active plan (creates default if missing)
router.get('/', requireAuth, async (req, res) => {
  try {
    noCache(res);
    let row = await getLatestMealPlan(req.userId);
    if (!row) {
      const plan = buildDefaultCouplesPlan();
      const saved = await saveMealPlan(req.userId, plan, 'seed');
      return res.json({ plan, planId: saved?.id, source: 'seed', createdAt: saved?.created_at });
    }
    return res.json({ plan: row.plan_json, planId: row.id, source: row.source, createdAt: row.created_at });
  } catch (err) {
    console.error('GET /couples-plan error:', err);
    return res.status(500).json({ error: 'Failed to load plan.' });
  }
});

// PUT /api/couples-plan/meal — body: { day, type, name?, her?, him? }
router.put('/meal', requireAuth, async (req, res) => {
  try {
    const { day, type, name, her, him } = req.body || {};
    if (!day || !type) return res.status(400).json({ error: 'day and type are required.' });

    const row = await getLatestMealPlan(req.userId);
    if (!row) return res.status(404).json({ error: 'No plan to edit.' });

    const plan = row.plan_json;
    const meal = findMeal(plan, day, type);
    if (!meal) return res.status(404).json({ error: 'Meal not found in current plan.' });

    if (typeof name === 'string') meal.name = name.trim();
    if (Array.isArray(her)) meal.her = her.map(s => String(s));
    if (Array.isArray(him)) meal.him = him.map(s => String(s));

    await updateMealPlan(req.userId, row.id, plan);
    return res.json({ plan, planId: row.id });
  } catch (err) {
    console.error('PUT /couples-plan/meal error:', err);
    return res.status(500).json({ error: 'Failed to update meal.' });
  }
});

// POST /api/couples-plan/next-week — body: { mode: 'duplicate' | 'surprise' }
router.post('/next-week', requireAuth, async (req, res) => {
  try {
    const mode = String(req.body?.mode || 'duplicate');
    const current = await getLatestMealPlan(req.userId);
    const base = current?.plan_json || buildDefaultCouplesPlan();

    let newPlan;
    let source;
    if (mode === 'surprise') {
      const profile = await getProfile(req.userId);
      const ai = await generateCouplesWeeklyPlan(base, profile);
      if (ai) {
        newPlan = ai;
        source = 'ai';
      } else {
        newPlan = JSON.parse(JSON.stringify(base));
        source = 'duplicate';
      }
    } else {
      newPlan = JSON.parse(JSON.stringify(base));
      source = 'duplicate';
    }

    // Bump week_start to next Monday (local).
    const next = nextMondayISO();
    newPlan.weekStartDate = next;

    const saved = await saveMealPlan(req.userId, newPlan, source, next);
    return res.json({ plan: newPlan, planId: saved?.id, source });
  } catch (err) {
    console.error('POST /couples-plan/next-week error:', err);
    return res.status(500).json({ error: 'Failed to generate next week.' });
  }
});

function nextMondayISO() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const offset = day === 1 ? 7 : ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default router;
