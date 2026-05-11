import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listScheduledEvents,
  createScheduledEvent,
  updateScheduledEvent,
  deleteScheduledEvent,
  bulkInsertScheduledEvents,
  setUserTimezone,
  getProfile
} from '../db.js';
import { defaultScheduledEvents } from '../couplesSeed.js';

const router = express.Router();

function validTime(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(s); }
function validDays(arr) {
  return Array.isArray(arr) && arr.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
}

// GET /api/schedule — list events (seed defaults if user has none)
router.get('/', requireAuth, async (req, res) => {
  try {
    let events = await listScheduledEvents(req.userId);
    if (events.length === 0) {
      await bulkInsertScheduledEvents(req.userId, defaultScheduledEvents());
      events = await listScheduledEvents(req.userId);
    }
    const profile = await getProfile(req.userId);
    return res.json({ events, timezone: profile?.timezone || 'Australia/Brisbane' });
  } catch (err) {
    console.error('GET /schedule error:', err);
    return res.status(500).json({ error: 'Failed to load schedule.' });
  }
});

// POST /api/schedule — add
router.post('/', requireAuth, async (req, res) => {
  try {
    const { kind, label, timeLocal, daysOfWeek, message } = req.body || {};
    if (!label || !String(label).trim()) return res.status(400).json({ error: 'label required.' });
    if (!validTime(timeLocal)) return res.status(400).json({ error: 'timeLocal must be HH:MM.' });
    if (!validDays(daysOfWeek)) return res.status(400).json({ error: 'daysOfWeek must be ints 0..6.' });
    const ev = await createScheduledEvent(req.userId, {
      kind: kind || 'custom',
      label: String(label).trim(),
      timeLocal,
      daysOfWeek,
      message: message ? String(message) : null
    });
    return res.json({ event: ev });
  } catch (err) {
    console.error('POST /schedule error:', err);
    return res.status(500).json({ error: 'Failed to create event.' });
  }
});

// PATCH /api/schedule/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Bad id.' });
    const patch = {};
    if (req.body?.label !== undefined) patch.label = String(req.body.label);
    if (req.body?.message !== undefined) patch.message = req.body.message == null ? null : String(req.body.message);
    if (req.body?.enabled !== undefined) patch.enabled = Boolean(req.body.enabled);
    if (req.body?.timeLocal !== undefined) {
      if (!validTime(req.body.timeLocal)) return res.status(400).json({ error: 'timeLocal must be HH:MM.' });
      patch.timeLocal = req.body.timeLocal;
    }
    if (req.body?.daysOfWeek !== undefined) {
      if (!validDays(req.body.daysOfWeek)) return res.status(400).json({ error: 'daysOfWeek must be ints 0..6.' });
      patch.daysOfWeek = req.body.daysOfWeek;
    }
    const ev = await updateScheduledEvent(req.userId, id, patch);
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    return res.json({ event: ev });
  } catch (err) {
    console.error('PATCH /schedule error:', err);
    return res.status(500).json({ error: 'Failed to update event.' });
  }
});

// DELETE /api/schedule/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Bad id.' });
    await deleteScheduledEvent(req.userId, id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /schedule error:', err);
    return res.status(500).json({ error: 'Failed to delete event.' });
  }
});

// PUT /api/schedule/timezone — body { timezone }
router.put('/timezone', requireAuth, async (req, res) => {
  try {
    const tz = String(req.body?.timezone || '').trim();
    if (!tz) return res.status(400).json({ error: 'timezone required.' });
    // Validate via Intl: throws if unknown.
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date()); }
    catch { return res.status(400).json({ error: 'Invalid IANA timezone.' }); }
    await setUserTimezone(req.userId, tz);
    return res.json({ ok: true, timezone: tz });
  } catch (err) {
    console.error('PUT /schedule/timezone error:', err);
    return res.status(500).json({ error: 'Failed to set timezone.' });
  }
});

export default router;
