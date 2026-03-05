import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getProfile, saveMealPlan, getLatestMealPlan, saveWorkoutPlan, getActiveWorkoutPlan } from '../db.js';
import { generateMealPlan, generateWorkoutPlan } from '../aiPlanner.js';
import { buildRuleBasedMealPlan, buildRuleBasedWorkoutPlan } from '../planGenerator.js';

const router = express.Router();

// POST /api/plans/meal
router.post('/meal', requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.userId);
    if (!profile) return res.status(400).json({ error: 'Complete your profile first.' });

    let plan = await generateMealPlan(profile);
    let source = 'ai';
    if (!plan) {
      plan = buildRuleBasedMealPlan(profile);
      source = 'rule_based';
    }

    const saved = await saveMealPlan(req.userId, plan, source);
    return res.json({ plan, source, planId: saved?.id });
  } catch (err) {
    console.error('Generate meal plan error:', err);
    return res.status(500).json({ error: 'Failed to generate meal plan.' });
  }
});

// GET /api/plans/meal
router.get('/meal', requireAuth, async (req, res) => {
  try {
    const row = await getLatestMealPlan(req.userId);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (!row) return res.json({ plan: null, source: null, createdAt: null, planId: null });
    return res.json({ plan: row.plan_json, source: row.source, createdAt: row.created_at, planId: row.id });
  } catch (err) {
    console.error('Get meal plan error:', err);
    return res.status(500).json({ error: 'Failed to fetch meal plan.' });
  }
});

// POST /api/plans/workout
router.post('/workout', requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.userId);
    if (!profile) return res.status(400).json({ error: 'Complete your profile first.' });

    let plan = await generateWorkoutPlan(profile);
    let source = 'ai';
    if (!plan) {
      plan = buildRuleBasedWorkoutPlan(profile);
      source = 'rule_based';
    }

    const saved = await saveWorkoutPlan(req.userId, plan, source);
    return res.json({ plan, source, planId: saved?.id });
  } catch (err) {
    console.error('Generate workout plan error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan.' });
  }
});

// GET /api/plans/workout
router.get('/workout', requireAuth, async (req, res) => {
  try {
    const row = await getActiveWorkoutPlan(req.userId);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (!row) return res.json({ plan: null, source: null, createdAt: null, planId: null });
    return res.json({ plan: row.plan_json, source: row.source, createdAt: row.created_at, planId: row.id });
  } catch (err) {
    console.error('Get workout plan error:', err);
    return res.status(500).json({ error: 'Failed to fetch workout plan.' });
  }
});

export default router;
