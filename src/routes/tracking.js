import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upsertProgressLog, getProgressLogs, saveFoodLog, getTodayFoodLogs } from '../db.js';

const router = express.Router();

// POST /api/tracking/progress
router.post('/progress', requireAuth, async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const log = await upsertProgressLog(req.userId, date, req.body);
    return res.json({ log });
  } catch (err) {
    console.error('Progress log error:', err);
    return res.status(500).json({ error: 'Failed to save progress.' });
  }
});

// GET /api/tracking/progress
router.get('/progress', requireAuth, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const logs = await getProgressLogs(req.userId, days);
    return res.json({ logs });
  } catch (err) {
    console.error('Get progress error:', err);
    return res.status(500).json({ error: 'Failed to fetch progress.' });
  }
});

// POST /api/tracking/food
router.post('/food', requireAuth, async (req, res) => {
  try {
    const entry = {
      mealName: String(req.body.mealName || '').trim(),
      calories: Number(req.body.calories) || 0,
      proteinGrams: Number(req.body.proteinGrams) || 0,
      carbsGrams: Number(req.body.carbsGrams) || 0,
      fatsGrams: Number(req.body.fatsGrams) || 0,
      servingSize: req.body.servingSize || null,
      notes: req.body.notes || null
    };
    if (!entry.mealName) return res.status(400).json({ error: 'Meal name is required.' });
    const result = await saveFoodLog(req.userId, entry);
    return res.json(result);
  } catch (err) {
    console.error('Food log error:', err);
    return res.status(500).json({ error: 'Failed to save food log.' });
  }
});

// GET /api/tracking/food/today
router.get('/food/today', requireAuth, async (req, res) => {
  try {
    const logs = await getTodayFoodLogs(req.userId);
    return res.json({ logs });
  } catch (err) {
    console.error('Get food logs error:', err);
    return res.status(500).json({ error: 'Failed to fetch food logs.' });
  }
});

export default router;
