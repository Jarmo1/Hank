import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, saveAccountAndPlan, fetchAccountDashboard, saveFoodLog } from './db.js';
import { buildRuleBasedPlan } from './planGenerator.js';
import { generateAiPlan } from './aiPlanner.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function validateProfile(input) {
  const required = ['email', 'fullName', 'age', 'sex', 'weightKg', 'heightCm', 'goal', 'activityLevel', 'workoutDays'];
  const missing = required.filter((key) => input[key] === undefined || input[key] === null || input[key] === '');
  if (missing.length) return `Missing fields: ${missing.join(', ')}`;

  if (!String(input.email).includes('@')) return 'Valid email is required.';
  if (Number(input.age) < 13 || Number(input.age) > 90) return 'Age must be between 13 and 90.';
  if (Number(input.weightKg) < 30 || Number(input.weightKg) > 300) return 'Weight must be between 30kg and 300kg.';
  if (Number(input.heightCm) < 120 || Number(input.heightCm) > 230) return 'Height must be between 120cm and 230cm.';
  if (Number(input.workoutDays) < 2 || Number(input.workoutDays) > 6) return 'Workout days must be between 2 and 6.';
  return null;
}

function normalizeProfile(body) {
  return {
    email: String(body.email || '').trim().toLowerCase(),
    fullName: String(body.fullName || '').trim(),
    age: Number(body.age),
    sex: String(body.sex || '').toLowerCase(),
    weightKg: Number(body.weightKg),
    heightCm: Number(body.heightCm),
    goal: String(body.goal || '').toLowerCase(),
    activityLevel: String(body.activityLevel || '').toLowerCase(),
    workoutDays: Number(body.workoutDays),
    dietaryPreferences: String(body.dietaryPreferences || '').trim(),
    equipmentAccess: String(body.equipmentAccess || '').trim(),
    injuries: String(body.injuries || '').trim(),
    notes: String(body.notes || '').trim()
  };
}

app.post('/api/account', async (req, res) => {
  try {
    const profile = normalizeProfile(req.body);

    const error = validateProfile(profile);
    if (error) return res.status(400).json({ error });

    let plan = await generateAiPlan(profile);
    let source = 'ai';

    if (!plan) {
      plan = buildRuleBasedPlan(profile);
      source = 'rule_based';
    }

    const saveResult = await saveAccountAndPlan(profile, plan, source);

    return res.json({
      source,
      persisted: saveResult.persisted,
      accountId: saveResult.accountId,
      profileId: saveResult.profileId,
      planId: saveResult.planId,
      plan
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate account plan.' });
  }
});

app.get('/api/account/:email', async (req, res) => {
  try {
    const email = String(req.params.email || '').toLowerCase();
    const dashboard = await fetchAccountDashboard(email);
    if (!dashboard) return res.status(404).json({ error: 'Account not found.' });
    return res.json(dashboard);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch account dashboard.' });
  }
});

app.post('/api/account/:accountId/food-log', async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const entry = {
      mealName: String(req.body.mealName || '').trim(),
      calories: Number(req.body.calories),
      proteinGrams: Number(req.body.proteinGrams),
      carbsGrams: Number(req.body.carbsGrams),
      fatsGrams: Number(req.body.fatsGrams),
      notes: String(req.body.notes || '').trim()
    };

    if (!accountId) return res.status(400).json({ error: 'Invalid account id.' });
    if (!entry.mealName) return res.status(400).json({ error: 'Meal name is required.' });

    const result = await saveFoodLog(accountId, entry);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to save food log.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Gym planner app listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Unable to start app due to database initialization error', err);
    process.exit(1);
  });
