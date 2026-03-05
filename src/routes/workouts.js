import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { saveWorkoutSession, getWorkoutSessions } from '../db.js';

const router = express.Router();

// POST /api/workouts/session
router.post('/session', requireAuth, async (req, res) => {
  try {
    const session = await saveWorkoutSession(req.userId, req.body);
    return res.json({ session });
  } catch (err) {
    console.error('Save session error:', err);
    return res.status(500).json({ error: 'Failed to save workout session.' });
  }
});

// GET /api/workouts/sessions
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const sessions = await getWorkoutSessions(req.userId, limit);
    return res.json({ sessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    return res.status(500).json({ error: 'Failed to fetch workout sessions.' });
  }
});

export default router;
