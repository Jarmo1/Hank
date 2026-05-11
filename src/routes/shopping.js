import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getLatestMealPlan,
  getLatestShoppingList,
  getOrCreateShoppingList,
  getShoppingItems,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
  clearAutoShoppingItems,
  clearCheckedShoppingItems,
  bulkInsertShoppingItems
} from '../db.js';
import { buildDefaultGrocery, groceryToShoppingItems } from '../couplesSeed.js';

const router = express.Router();

function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

async function ensureListForUser(userId) {
  let list = await getLatestShoppingList(userId);
  if (list) return list;
  list = await getOrCreateShoppingList(userId, null);
  // Seed from latest plan grocery, or default if no plan exists yet.
  const plan = await getLatestMealPlan(userId);
  const grocery = plan?.plan_json?.grocery || buildDefaultGrocery();
  const items = groceryToShoppingItems(grocery);
  await bulkInsertShoppingItems(list.id, items);
  return list;
}

// GET /api/shopping — current list with items
router.get('/', requireAuth, async (req, res) => {
  try {
    noCache(res);
    const list = await ensureListForUser(req.userId);
    const items = await getShoppingItems(list.id);
    return res.json({ list, items });
  } catch (err) {
    console.error('GET /shopping error:', err);
    return res.status(500).json({ error: 'Failed to load shopping list.' });
  }
});

// POST /api/shopping/items — add manual item
router.post('/items', requireAuth, async (req, res) => {
  try {
    const { name, qty, category } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required.' });
    const list = await ensureListForUser(req.userId);
    const item = await addShoppingItem(list.id, {
      name: String(name).trim(),
      qty: qty ? String(qty).trim() : null,
      category: category ? String(category).trim() : 'Custom',
      source: 'manual',
      sortOrder: 9999
    });
    return res.json({ item });
  } catch (err) {
    console.error('POST /shopping/items error:', err);
    return res.status(500).json({ error: 'Failed to add item.' });
  }
});

// PATCH /api/shopping/items/:id — toggle/edit
router.patch('/items/:id', requireAuth, async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) return res.status(400).json({ error: 'Bad item id.' });
    const list = await ensureListForUser(req.userId);
    const patch = {};
    if (req.body?.checked !== undefined) patch.checked = Boolean(req.body.checked);
    if (req.body?.name !== undefined) patch.name = String(req.body.name);
    if (req.body?.qty !== undefined) patch.qty = req.body.qty == null ? null : String(req.body.qty);
    if (req.body?.category !== undefined) patch.category = String(req.body.category);
    const item = await updateShoppingItem(itemId, list.id, patch);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    return res.json({ item });
  } catch (err) {
    console.error('PATCH /shopping/items error:', err);
    return res.status(500).json({ error: 'Failed to update item.' });
  }
});

// DELETE /api/shopping/items/:id
router.delete('/items/:id', requireAuth, async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) return res.status(400).json({ error: 'Bad item id.' });
    const list = await ensureListForUser(req.userId);
    await deleteShoppingItem(itemId, list.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shopping/items error:', err);
    return res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// POST /api/shopping/regenerate — replace auto items from current plan, keep manual + checked
router.post('/regenerate', requireAuth, async (req, res) => {
  try {
    const list = await ensureListForUser(req.userId);
    const plan = await getLatestMealPlan(req.userId);
    const grocery = plan?.plan_json?.grocery || buildDefaultGrocery();
    await clearAutoShoppingItems(list.id);
    await bulkInsertShoppingItems(list.id, groceryToShoppingItems(grocery));
    const items = await getShoppingItems(list.id);
    return res.json({ list, items });
  } catch (err) {
    console.error('POST /shopping/regenerate error:', err);
    return res.status(500).json({ error: 'Failed to regenerate list.' });
  }
});

// POST /api/shopping/clear-checked — remove all ticked items
router.post('/clear-checked', requireAuth, async (req, res) => {
  try {
    const list = await ensureListForUser(req.userId);
    await clearCheckedShoppingItems(list.id);
    const items = await getShoppingItems(list.id);
    return res.json({ list, items });
  } catch (err) {
    console.error('POST /shopping/clear-checked error:', err);
    return res.status(500).json({ error: 'Failed to clear checked items.' });
  }
});

export default router;
