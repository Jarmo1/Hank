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
    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS generated_plans (
      id SERIAL PRIMARY KEY,
      user_profile_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      plan_json JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function savePlan(profile, plan, source = 'rule_based') {
  if (!pool) {
    return { id: null, source, persisted: false };
  }

  const profileResult = await pool.query(
    `INSERT INTO user_profiles
      (full_name, age, sex, weight_kg, height_cm, goal, activity_level, workout_days, dietary_preferences, equipment_access, injuries, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      profile.fullName,
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

  const userProfileId = profileResult.rows[0].id;

  const planResult = await pool.query(
    `INSERT INTO generated_plans (user_profile_id, source, plan_json)
     VALUES ($1,$2,$3)
     RETURNING id`,
    [userProfileId, source, JSON.stringify(plan)]
  );

  return { id: planResult.rows[0].id, source, persisted: true };
}

export async function fetchRecentPlans(limit = 20) {
  if (!pool) return [];

  const result = await pool.query(
    `SELECT gp.id,
            gp.source,
            gp.plan_json,
            gp.created_at,
            up.full_name,
            up.goal
     FROM generated_plans gp
     JOIN user_profiles up ON up.id = gp.user_profile_id
     ORDER BY gp.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
