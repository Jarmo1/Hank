import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { COOKIE_NAME } from '../middleware/auth.js';
import {
  isHouseholdPinSet,
  getHouseholdSettings,
  setHouseholdPin,
  clearHouseholdPin,
  ensureHouseholdUser,
  saveMealPlan,
  getLatestMealPlan,
  listScheduledEvents,
  bulkInsertScheduledEvents,
  getOrCreateShoppingList,
  bulkInsertShoppingItems,
  getShoppingItems
} from '../db.js';
import {
  buildDefaultCouplesPlan,
  defaultScheduledEvents,
  groceryToShoppingItems,
  isCouplesShape
} from '../couplesSeed.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'forgeai-dev-secret-change-in-production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

async function seedHousehold(userId) {
  try {
    const existing = await getLatestMealPlan(userId);
    if (!existing || !isCouplesShape(existing.plan_json)) {
      await saveMealPlan(userId, buildDefaultCouplesPlan(), 'seed');
    }
    const events = await listScheduledEvents(userId);
    if (events.length === 0) {
      await bulkInsertScheduledEvents(userId, defaultScheduledEvents());
    }
    const list = await getOrCreateShoppingList(userId, null);
    const items = await getShoppingItems(list.id);
    if (items.length === 0) {
      const latest = await getLatestMealPlan(userId);
      const grocery = latest?.plan_json?.grocery || buildDefaultCouplesPlan().grocery;
      await bulkInsertShoppingItems(list.id, groceryToShoppingItems(grocery));
    }
  } catch (err) {
    console.warn('seed failed:', err?.message || err);
  }
}

// GET /api/pin/status
router.get('/status', async (_req, res) => {
  try {
    const isSet = await isHouseholdPinSet();
    return res.json({ isSet });
  } catch {
    return res.json({ isSet: false });
  }
});

// POST /api/pin/set { pin, currentPin? }
// First use: no current PIN required. If a PIN is already set, the caller must
// either be authenticated (cookie) or supply the current PIN.
router.post('/set', async (req, res) => {
  try {
    const pin = String(req.body?.pin || '');
    if (!isValidPin(pin)) return res.status(400).json({ error: 'PIN must be 4–6 digits.' });

    const settings = await getHouseholdSettings();
    if (settings?.pin_hash) {
      const token = req.cookies?.[COOKIE_NAME];
      let authed = false;
      if (token) { try { jwt.verify(token, JWT_SECRET); authed = true; } catch {} }
      if (!authed) {
        const current = String(req.body?.currentPin || '');
        if (!isValidPin(current)) return res.status(401).json({ error: 'Current PIN required.' });
        const ok = await bcrypt.compare(current, settings.pin_hash);
        if (!ok) return res.status(401).json({ error: 'Wrong current PIN.' });
      }
    }

    const userId = await ensureHouseholdUser();
    const pinHash = await bcrypt.hash(pin, 10);
    await setHouseholdPin(pinHash, userId);
    await seedHousehold(userId);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.json({ ok: true });
  } catch (err) {
    console.error('pin/set error:', err);
    return res.status(500).json({ error: 'Failed to set PIN.' });
  }
});

// POST /api/pin/verify { pin }
router.post('/verify', async (req, res) => {
  try {
    const pin = String(req.body?.pin || '');
    if (!isValidPin(pin)) return res.status(400).json({ error: 'Invalid PIN format.' });
    const settings = await getHouseholdSettings();
    if (!settings?.pin_hash) return res.status(409).json({ error: 'No PIN set yet.' });
    const ok = await bcrypt.compare(pin, settings.pin_hash);
    if (!ok) return res.status(401).json({ error: 'Wrong PIN.' });

    const userId = settings.user_id || (await ensureHouseholdUser());
    await seedHousehold(userId);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    return res.json({ ok: true });
  } catch (err) {
    console.error('pin/verify error:', err);
    return res.status(500).json({ error: 'Failed to verify PIN.' });
  }
});

export default router;
