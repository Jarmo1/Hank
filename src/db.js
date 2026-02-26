import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const useDb = Boolean(connectionString);

export const pool = useDb
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : null;

export async function initDb() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_accounts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_profiles (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES app_accounts(id) ON DELETE CASCADE,
      age INTEGER NOT NULL,
      sex TEXT NOT NULL,
      weight_kg NUMERIC NOT NULL,
      height_cm NUMERIC NOT NULL,
      goal TEXT NOT NULL,
      activity_level TEXT NOT NULL,
      workout_days INTEGER NOT NULL,
      dietary_preferences TEXT,
      equipment_access TEXT,
      injuries TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_plans (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES app_accounts(id) ON DELETE CASCADE,
      profile_id INTEGER REFERENCES account_profiles(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      plan_json JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS food_logs (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES app_accounts(id) ON DELETE CASCADE,
      meal_name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein_grams INTEGER NOT NULL,
      carbs_grams INTEGER NOT NULL,
      fats_grams INTEGER NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function saveAccountAndPlan(profile, plan, source = 'rule_based') {
  if (!pool) {
    return { accountId: null, profileId: null, planId: null, source, persisted: false };
  }

  const accountResult = await pool.query(
    `INSERT INTO app_accounts (email, full_name)
     VALUES ($1, $2)
     ON CONFLICT(email)
     DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
     RETURNING id`,
    [profile.email, profile.fullName]
  );

  const accountId = accountResult.rows[0].id;

  const profileResult = await pool.query(
    `INSERT INTO account_profiles
      (account_id, age, sex, weight_kg, height_cm, goal, activity_level, workout_days, dietary_preferences, equipment_access, injuries, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      accountId,
      profile.age,
      profile.sex,
      profile.weightKg,
      profile.heightCm,
      profile.goal,
      profile.activityLevel,
      profile.workoutDays,
      profile.dietaryPreferences || '',
      profile.equipmentAccess || '',
      profile.injuries || '',
      profile.notes || ''
    ]
  );

  const profileId = profileResult.rows[0].id;

  const planResult = await pool.query(
    `INSERT INTO account_plans (account_id, profile_id, source, plan_json)
     VALUES ($1,$2,$3,$4)
     RETURNING id`,
    [accountId, profileId, source, JSON.stringify(plan)]
  );

  return { accountId, profileId, planId: planResult.rows[0].id, source, persisted: true };
}

export async function fetchAccountDashboard(email) {
  if (!pool) return null;

  const accountResult = await pool.query('SELECT id, email, full_name FROM app_accounts WHERE email = $1', [email]);
  if (!accountResult.rows.length) return null;

  const account = accountResult.rows[0];

  const profileResult = await pool.query(
    `SELECT * FROM account_profiles WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [account.id]
  );

  const planResult = await pool.query(
    `SELECT id, source, plan_json, created_at FROM account_plans WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [account.id]
  );

  const logsResult = await pool.query(
    `SELECT id, meal_name, calories, protein_grams, carbs_grams, fats_grams, notes, created_at
      FROM food_logs
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
    [account.id]
  );

  return {
    account,
    profile: profileResult.rows[0] || null,
    plan: planResult.rows[0] || null,
    foodLogs: logsResult.rows
  };
}

export async function saveFoodLog(accountId, entry) {
  if (!pool) {
    return { id: null, persisted: false };
  }

  const result = await pool.query(
    `INSERT INTO food_logs (account_id, meal_name, calories, protein_grams, carbs_grams, fats_grams, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [accountId, entry.mealName, entry.calories, entry.proteinGrams, entry.carbsGrams, entry.fatsGrams, entry.notes || '']
  );

  return { id: result.rows[0].id, persisted: true };
}
