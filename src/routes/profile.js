import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getProfile, upsertProfile, getUserById } from '../db.js';

const router = express.Router();

// GET /api/profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const [user, profile] = await Promise.all([
      getUserById(req.userId),
      getProfile(req.userId)
    ]);
    return res.json({ user, profile });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// PUT /api/profile
router.put('/', requireAuth, async (req, res) => {
  try {
    const profile = await upsertProfile(req.userId, req.body);
    return res.json({ profile });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// POST /api/profile/onboarding — complete onboarding wizard
router.post('/onboarding', requireAuth, async (req, res) => {
  try {
    const profile = await upsertProfile(req.userId, { ...req.body, onboardingComplete: true });
    return res.json({ profile, onboardingComplete: true });
  } catch (err) {
    console.error('Onboarding error:', err);
    return res.status(500).json({ error: 'Failed to save onboarding data.' });
  }
});

export default router;
