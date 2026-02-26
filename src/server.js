import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, savePlan, fetchRecentPlans } from './db.js';
import { buildRuleBasedPlan } from './planGenerator.js';
import { generateAiPlan } from './aiPlanner.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function validateProfile(input) {
  const required = ['fullName', 'age', 'sex', 'weightKg', 'heightCm', 'goal', 'activityLevel', 'workoutDays'];
  const missing = required.filter((key) => input[key] === undefined || input[key] === null || input[key] === '');
  if (missing.length) return `Missing fields: ${missing.join(', ')}`;

  if (Number(input.age) < 13 || Number(input.age) > 90) return 'Age must be between 13 and 90.';
  if (Number(input.weightKg) < 30 || Number(input.weightKg) > 300) return 'Weight must be between 30kg and 300kg.';
  if (Number(input.heightCm) < 120 || Number(input.heightCm) > 230) return 'Height must be between 120cm and 230cm.';
  if (Number(input.workoutDays) < 2 || Number(input.workoutDays) > 6) return 'Workout days must be between 2 and 6.';
  return null;
}

app.post('/api/plan', async (req, res) => {
  try {
    const profile = {
      fullName: String(req.body.fullName || '').trim(),
      age: Number(req.body.age),
      sex: String(req.body.sex || '').toLowerCase(),
      weightKg: Number(req.body.weightKg),
      heightCm: Number(req.body.heightCm),
      goal: String(req.body.goal || '').toLowerCase(),
      activityLevel: String(req.body.activityLevel || '').toLowerCase(),
      workoutDays: Number(req.body.workoutDays),
      dietaryPreferences: String(req.body.dietaryPreferences || '').trim(),
      equipmentAccess: String(req.body.equipmentAccess || '').trim(),
      injuries: String(req.body.injuries || '').trim(),
      notes: String(req.body.notes || '').trim()
    };

    const error = validateProfile(profile);
    if (error) return res.status(400).json({ error });

    let plan = await generateAiPlan(profile);
    let source = 'ai';

    if (!plan) {
      plan = buildRuleBasedPlan(profile);
      source = 'rule_based';
    }

    const saveResult = await savePlan(profile, plan, source);

    return res.json({
      source,
      persisted: saveResult.persisted,
      planId: saveResult.id,
      plan
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate a plan.' });
  }
});

app.get('/api/plans', async (_req, res) => {
  try {
    const plans = await fetchRecentPlans();
    res.json({ plans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch plans.' });
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
