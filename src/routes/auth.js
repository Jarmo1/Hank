import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../db.js';
import { COOKIE_NAME } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'forgeai-dev-secret-change-in-production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email, passwordHash);

    if (!user) {
      // No DB — issue ephemeral token
      const token = signToken(0);
      res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
      return res.json({ user: { id: 0, email }, persisted: false, onboardingComplete: false });
    }

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.json({ user: { id: user.id, email: user.email }, persisted: true, onboardingComplete: false });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ error: 'Failed to sign in.' });
  }
});

// POST /api/auth/signout
router.post('/signout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({ userId: payload.userId });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
});

export default router;
