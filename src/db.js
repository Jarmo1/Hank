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
  if (!pool) {
    console.warn('No DATABASE_URL set — running without persistence.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      full_name TEXT,
      age INTEGER,
      sex TEXT,
      weight_kg NUMERIC,
      height_cm NUMERIC,
      goal TEXT,
      activity_level TEXT,
      workout_days INTEGER,
      diet_type TEXT,
      allergies TEXT,
      dislikes TEXT,
      meals_per_day INTEGER DEFAULT 3,
      cooking_preference TEXT,
      gym_access TEXT,
      workout_preference TEXT,
      injuries TEXT,
      water_goal_ml INTEGER DEFAULT 2500,
      notification_prefs JSONB DEFAULT '{}',
      onboarding_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add timezone column (couples plan / scheduler relies on it).
  await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Australia/Brisbane'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      week_start_date DATE,
      plan_json JSONB NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plan_json JSONB NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      workout_plan_id INTEGER REFERENCES workout_plans(id) ON DELETE SET NULL,
      session_date DATE NOT NULL DEFAULT CURRENT_DATE,
      day_label TEXT,
      exercises_json JSONB NOT NULL DEFAULT '[]',
      total_time_seconds INTEGER,
      total_volume_kg NUMERIC,
      notes TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      log_date DATE NOT NULL DEFAULT CURRENT_DATE,
      weight_kg NUMERIC,
      calories_consumed INTEGER,
      protein_grams NUMERIC,
      carbs_grams NUMERIC,
      fats_grams NUMERIC,
      water_ml INTEGER DEFAULT 0,
      steps INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, log_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS food_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      meal_name TEXT NOT NULL,
      calories INTEGER NOT NULL DEFAULT 0,
      protein_grams NUMERIC DEFAULT 0,
      carbs_grams NUMERIC DEFAULT 0,
      fats_grams NUMERIC DEFAULT 0,
      serving_size TEXT,
      notes TEXT,
      logged_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      endpoint TEXT NOT NULL,
      tokens_used INTEGER,
      model TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Couples-plan additions ────────────────────────────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      week_start_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, week_start_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id SERIAL PRIMARY KEY,
      list_id INTEGER REFERENCES shopping_lists(id) ON DELETE CASCADE,
      category TEXT,
      name TEXT NOT NULL,
      qty TEXT,
      checked BOOLEAN DEFAULT FALSE,
      source TEXT DEFAULT 'auto',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduled_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      time_local TEXT NOT NULL,
      days_of_week INTEGER[] NOT NULL DEFAULT '{}',
      message TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      last_sent_date DATE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log('ForgeAI database ready.');
}

// ── Users ──────────────────────────────────────────────────────────

export async function createUser(email, passwordHash) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at`,
    [email.toLowerCase().trim(), passwordHash]
  );
  return result.rows[0];
}

export async function getUserByEmail(email) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

export async function getUserById(id) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT id, email, created_at FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// ── Profiles ───────────────────────────────────────────────────────

export async function getProfile(userId) {
  if (!pool) return null;
  const result = await pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
  return result.rows[0] || null;
}

export async function upsertProfile(userId, data) {
  if (!pool) return null;
  const result = await pool.query(`
    INSERT INTO user_profiles (
      user_id, full_name, age, sex, weight_kg, height_cm, goal, activity_level,
      workout_days, diet_type, allergies, dislikes, meals_per_day, cooking_preference,
      gym_access, workout_preference, injuries, water_goal_ml, notification_prefs,
      onboarding_complete, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      age = EXCLUDED.age,
      sex = EXCLUDED.sex,
      weight_kg = EXCLUDED.weight_kg,
      height_cm = EXCLUDED.height_cm,
      goal = EXCLUDED.goal,
      activity_level = EXCLUDED.activity_level,
      workout_days = EXCLUDED.workout_days,
      diet_type = EXCLUDED.diet_type,
      allergies = EXCLUDED.allergies,
      dislikes = EXCLUDED.dislikes,
      meals_per_day = EXCLUDED.meals_per_day,
      cooking_preference = EXCLUDED.cooking_preference,
      gym_access = EXCLUDED.gym_access,
      workout_preference = EXCLUDED.workout_preference,
      injuries = EXCLUDED.injuries,
      water_goal_ml = EXCLUDED.water_goal_ml,
      notification_prefs = EXCLUDED.notification_prefs,
      onboarding_complete = EXCLUDED.onboarding_complete,
      updated_at = NOW()
    RETURNING *
  `, [
    userId,
    data.fullName || null,
    data.age || null,
    data.sex || null,
    data.weightKg || null,
    data.heightCm || null,
    data.goal || null,
    data.activityLevel || null,
    data.workoutDays || null,
    data.dietType || null,
    data.allergies || null,
    data.dislikes || null,
    data.mealsPerDay || 3,
    data.cookingPreference || null,
    data.gymAccess || null,
    data.workoutPreference || null,
    data.injuries || null,
    data.waterGoalMl || 2500,
    JSON.stringify(data.notificationPrefs || {}),
    data.onboardingComplete || false
  ]);
  return result.rows[0];
}

export async function setUserTimezone(userId, tz) {
  if (!pool) return null;
  await pool.query(
    `INSERT INTO user_profiles (user_id, timezone) VALUES ($1,$2)
     ON CONFLICT (user_id) DO UPDATE SET timezone = EXCLUDED.timezone, updated_at = NOW()`,
    [userId, tz]
  );
}

// ── Meal Plans ─────────────────────────────────────────────────────

export async function saveMealPlan(userId, planJson, source = 'ai', weekStartDate = null) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO meal_plans (user_id, week_start_date, plan_json, source) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [userId, weekStartDate, JSON.stringify(planJson), source]
  );
  return result.rows[0];
}

export async function updateMealPlan(userId, planId, planJson) {
  if (!pool) return null;
  const r = await pool.query(
    `UPDATE meal_plans SET plan_json = $1 WHERE id = $2 AND user_id = $3 RETURNING id, created_at`,
    [JSON.stringify(planJson), planId, userId]
  );
  return r.rows[0] || null;
}

export async function getLatestMealPlan(userId) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT * FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function listMealPlans(userId, limit = 10) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT id, week_start_date, source, created_at FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return r.rows;
}

// ── Workout Plans ──────────────────────────────────────────────────

export async function saveWorkoutPlan(userId, planJson, source = 'ai') {
  if (!pool) return null;
  await pool.query(`UPDATE workout_plans SET active = FALSE WHERE user_id = $1`, [userId]);
  const result = await pool.query(
    `INSERT INTO workout_plans (user_id, plan_json, source, active) VALUES ($1,$2,$3,TRUE) RETURNING id, created_at`,
    [userId, JSON.stringify(planJson), source]
  );
  return result.rows[0];
}

export async function getActiveWorkoutPlan(userId) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT * FROM workout_plans WHERE user_id = $1 AND active = TRUE ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// ── Workout Sessions ───────────────────────────────────────────────

export async function saveWorkoutSession(userId, data) {
  if (!pool) return null;
  const result = await pool.query(`
    INSERT INTO workout_sessions
      (user_id, workout_plan_id, session_date, day_label, exercises_json, total_time_seconds, total_volume_kg, notes, completed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id, created_at
  `, [
    userId,
    data.workoutPlanId || null,
    data.sessionDate || new Date().toISOString().slice(0, 10),
    data.dayLabel || null,
    JSON.stringify(data.exercises || []),
    data.totalTimeSeconds || null,
    data.totalVolumeKg || null,
    data.notes || null,
    data.completedAt || new Date().toISOString()
  ]);
  return result.rows[0];
}

export async function getWorkoutSessions(userId, limit = 20) {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT * FROM workout_sessions WHERE user_id = $1 ORDER BY session_date DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// ── Progress Logs ──────────────────────────────────────────────────

export async function upsertProgressLog(userId, date, data) {
  if (!pool) return null;
  const result = await pool.query(`
    INSERT INTO progress_logs
      (user_id, log_date, weight_kg, calories_consumed, protein_grams, carbs_grams, fats_grams, water_ml, steps, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (user_id, log_date) DO UPDATE SET
      weight_kg        = COALESCE(EXCLUDED.weight_kg, progress_logs.weight_kg),
      calories_consumed= COALESCE(EXCLUDED.calories_consumed, progress_logs.calories_consumed),
      protein_grams    = COALESCE(EXCLUDED.protein_grams, progress_logs.protein_grams),
      carbs_grams      = COALESCE(EXCLUDED.carbs_grams, progress_logs.carbs_grams),
      fats_grams       = COALESCE(EXCLUDED.fats_grams, progress_logs.fats_grams),
      water_ml         = COALESCE(EXCLUDED.water_ml, progress_logs.water_ml),
      steps            = COALESCE(EXCLUDED.steps, progress_logs.steps),
      notes            = COALESCE(EXCLUDED.notes, progress_logs.notes)
    RETURNING *
  `, [
    userId, date,
    data.weightKg || null,
    data.caloriesConsumed || null,
    data.proteinGrams || null,
    data.carbsGrams || null,
    data.fatsGrams || null,
    data.waterMl || null,
    data.steps || null,
    data.notes || null
  ]);
  return result.rows[0];
}

export async function getProgressLogs(userId, days = 30) {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT * FROM progress_logs
     WHERE user_id = $1 AND log_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
     ORDER BY log_date ASC`,
    [userId, days]
  );
  return result.rows;
}

// ── Food Logs ──────────────────────────────────────────────────────

export async function saveFoodLog(userId, entry) {
  if (!pool) return { id: null, persisted: false };
  const result = await pool.query(`
    INSERT INTO food_logs (user_id, meal_name, calories, protein_grams, carbs_grams, fats_grams, serving_size, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id, created_at
  `, [
    userId,
    entry.mealName,
    entry.calories || 0,
    entry.proteinGrams || 0,
    entry.carbsGrams || 0,
    entry.fatsGrams || 0,
    entry.servingSize || null,
    entry.notes || null
  ]);
  return { id: result.rows[0].id, persisted: true };
}

export async function getTodayFoodLogs(userId) {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT * FROM food_logs WHERE user_id = $1 AND logged_at::date = CURRENT_DATE ORDER BY logged_at ASC`,
    [userId]
  );
  return result.rows;
}

// ── Push Subscriptions ─────────────────────────────────────────────

export async function savePushSubscription(userId, sub) {
  if (!pool) return null;
  await pool.query(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (user_id) DO UPDATE SET endpoint=$2, p256dh=$3, auth=$4
  `, [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]);
}

export async function getPushSubscription(userId) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT * FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function deletePushSubscriptionByEndpoint(endpoint) {
  if (!pool) return;
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

// ── Shopping Lists ─────────────────────────────────────────────────

export async function getOrCreateShoppingList(userId, weekStartDate) {
  if (!pool) return null;
  const existing = await pool.query(
    `SELECT * FROM shopping_lists WHERE user_id = $1 AND week_start_date = $2`,
    [userId, weekStartDate]
  );
  if (existing.rows[0]) return existing.rows[0];
  const created = await pool.query(
    `INSERT INTO shopping_lists (user_id, week_start_date) VALUES ($1,$2) RETURNING *`,
    [userId, weekStartDate]
  );
  return created.rows[0];
}

export async function getLatestShoppingList(userId) {
  if (!pool) return null;
  const r = await pool.query(
    `SELECT * FROM shopping_lists WHERE user_id = $1 ORDER BY week_start_date DESC NULLS LAST, created_at DESC LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

export async function getShoppingItems(listId) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT * FROM shopping_list_items WHERE list_id = $1 ORDER BY sort_order ASC, id ASC`,
    [listId]
  );
  return r.rows;
}

export async function addShoppingItem(listId, item) {
  if (!pool) return null;
  const r = await pool.query(
    `INSERT INTO shopping_list_items (list_id, category, name, qty, source, sort_order, checked)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [listId, item.category || null, item.name, item.qty || null, item.source || 'manual', item.sortOrder || 0, item.checked || false]
  );
  return r.rows[0];
}

export async function updateShoppingItem(itemId, listId, patch) {
  if (!pool) return null;
  const fields = [];
  const values = [];
  let i = 1;
  if (patch.name !== undefined)     { fields.push(`name = $${i++}`);     values.push(patch.name); }
  if (patch.qty !== undefined)      { fields.push(`qty = $${i++}`);      values.push(patch.qty); }
  if (patch.category !== undefined) { fields.push(`category = $${i++}`); values.push(patch.category); }
  if (patch.checked !== undefined)  { fields.push(`checked = $${i++}`);  values.push(patch.checked); }
  if (fields.length === 0) return null;
  values.push(itemId, listId);
  const r = await pool.query(
    `UPDATE shopping_list_items SET ${fields.join(', ')} WHERE id = $${i++} AND list_id = $${i} RETURNING *`,
    values
  );
  return r.rows[0] || null;
}

export async function deleteShoppingItem(itemId, listId) {
  if (!pool) return;
  await pool.query(`DELETE FROM shopping_list_items WHERE id = $1 AND list_id = $2`, [itemId, listId]);
}

export async function clearAutoShoppingItems(listId) {
  if (!pool) return;
  await pool.query(`DELETE FROM shopping_list_items WHERE list_id = $1 AND source = 'auto'`, [listId]);
}

export async function clearCheckedShoppingItems(listId) {
  if (!pool) return;
  await pool.query(`DELETE FROM shopping_list_items WHERE list_id = $1 AND checked = TRUE`, [listId]);
}

export async function bulkInsertShoppingItems(listId, items) {
  if (!pool || !items?.length) return;
  const values = [];
  const placeholders = items.map((it, idx) => {
    const base = idx * 6;
    values.push(listId, it.category || null, it.name, it.qty || null, it.source || 'auto', idx);
    return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6})`;
  });
  await pool.query(
    `INSERT INTO shopping_list_items (list_id, category, name, qty, source, sort_order) VALUES ${placeholders.join(', ')}`,
    values
  );
}

// ── Scheduled Events (meal reminders, pilates, custom) ────────────

export async function listScheduledEvents(userId) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT * FROM scheduled_events WHERE user_id = $1 ORDER BY sort_order ASC, id ASC`,
    [userId]
  );
  return r.rows;
}

export async function listDueScheduledEvents() {
  if (!pool) return [];
  const r = await pool.query(`
    SELECT e.*, p.timezone AS tz, s.endpoint, s.p256dh, s.auth
    FROM scheduled_events e
    JOIN push_subscriptions s ON s.user_id = e.user_id
    LEFT JOIN user_profiles p ON p.user_id = e.user_id
    WHERE e.enabled = TRUE
  `);
  return r.rows;
}

export async function createScheduledEvent(userId, ev) {
  if (!pool) return null;
  const r = await pool.query(
    `INSERT INTO scheduled_events (user_id, kind, label, time_local, days_of_week, message, enabled, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [userId, ev.kind || 'custom', ev.label, ev.timeLocal, ev.daysOfWeek || [], ev.message || null, ev.enabled !== false, ev.sortOrder || 0]
  );
  return r.rows[0];
}

export async function updateScheduledEvent(userId, id, patch) {
  if (!pool) return null;
  const fields = [];
  const values = [];
  let i = 1;
  if (patch.label !== undefined)      { fields.push(`label = $${i++}`);        values.push(patch.label); }
  if (patch.timeLocal !== undefined)  { fields.push(`time_local = $${i++}`);   values.push(patch.timeLocal); }
  if (patch.daysOfWeek !== undefined) { fields.push(`days_of_week = $${i++}`); values.push(patch.daysOfWeek); }
  if (patch.message !== undefined)    { fields.push(`message = $${i++}`);      values.push(patch.message); }
  if (patch.enabled !== undefined)    { fields.push(`enabled = $${i++}`);      values.push(patch.enabled); }
  if (fields.length === 0) return null;
  values.push(id, userId);
  const r = await pool.query(
    `UPDATE scheduled_events SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    values
  );
  return r.rows[0] || null;
}

export async function deleteScheduledEvent(userId, id) {
  if (!pool) return;
  await pool.query(`DELETE FROM scheduled_events WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function markScheduledEventSent(id, sentDate) {
  if (!pool) return;
  await pool.query(`UPDATE scheduled_events SET last_sent_date = $1 WHERE id = $2`, [sentDate, id]);
}

export async function bulkInsertScheduledEvents(userId, events) {
  if (!pool || !events?.length) return;
  for (let idx = 0; idx < events.length; idx++) {
    const ev = events[idx];
    await pool.query(
      `INSERT INTO scheduled_events (user_id, kind, label, time_local, days_of_week, message, enabled, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)`,
      [userId, ev.kind, ev.label, ev.timeLocal, ev.daysOfWeek, ev.message || null, idx]
    );
  }
}
