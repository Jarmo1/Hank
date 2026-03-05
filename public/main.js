// ── State ─────────────────────────────────────────────────

const state = {
  user: null,
  profile: null,
  mealPlan: null,
  workoutPlan: null,
  progressLogs: [],
  ob: { goal: '', step: 1, totalSteps: 5 },
  runner: {
    active: false,
    planId: null,
    day: null,
    exIdx: 0,
    setIdx: 0,
    loggedSets: [],
    startTime: null,
    elapsedInterval: null,
    restInterval: null,
    restEndTime: null,
    weightByEx: {}
  }
};

// ── API helper ────────────────────────────────────────────

async function api(method, path, body) {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    throw e;
  }
}

// ── Toast ────────────────────────────────────────────────

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type ? `show ${type}` : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ── Screen routing ─────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById(`screen-${name}`);
  if (s) s.classList.add('active');

  const authScreens = ['auth', 'onboarding'];
  const showChrome = !authScreens.includes(name);
  document.getElementById('app-header').style.display = showChrome ? '' : 'none';
  document.getElementById('app-nav').style.display = showChrome ? '' : 'none';

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === name);
  });
}

// ── Auth ──────────────────────────────────────────────────

async function checkAuth() {
  try {
    const data = await api('GET', '/api/auth/me');
    if (!data.userId) throw new Error('Not authenticated');
    state.user = { id: data.userId };
    const pd = await api('GET', '/api/profile');
    state.user = pd.user || state.user;
    state.profile = pd.profile;
    if (!state.profile || !state.profile.onboarding_complete) {
      initOnboarding();
      showScreen('onboarding');
    } else {
      await loadDashboard();
      showScreen('dashboard');
    }
  } catch {
    showScreen('auth');
  }
}

function initAuthListeners() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('btn-signup').addEventListener('click', async () => {
    const btn = document.getElementById('btn-signup');
    const errEl = document.getElementById('signup-error');
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    errEl.style.display = 'none';
    btn.disabled = true;
    try {
      const data = await api('POST', '/api/auth/signup', { email, password });
      state.user = data.user;
      initOnboarding();
      showScreen('onboarding');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    } finally { btn.disabled = false; }
  });

  document.getElementById('btn-signin').addEventListener('click', async () => {
    const btn = document.getElementById('btn-signin');
    const errEl = document.getElementById('signin-error');
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    errEl.style.display = 'none';
    btn.disabled = true;
    try {
      const data = await api('POST', '/api/auth/signin', { email, password });
      state.user = data.user;
      const pd = await api('GET', '/api/profile');
      state.profile = pd.profile;
      if (!state.profile || !state.profile.onboarding_complete) {
        initOnboarding(); showScreen('onboarding');
      } else {
        await loadDashboard(); showScreen('dashboard');
      }
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    } finally { btn.disabled = false; }
  });

  // Enter key on inputs
  ['signin-email', 'signin-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-signin').click();
    });
  });
}

// ── Onboarding ────────────────────────────────────────────

function initOnboarding() {
  state.ob = { goal: '', step: 1, totalSteps: 5 };
  renderObProgress();
  gotoObStep(1);

  // Option cards (goal selection)
  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      const field = card.dataset.field;
      document.querySelectorAll(`[data-field="${field}"]`).forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.ob[field] = card.dataset.val;
    });
  });

  document.getElementById('ob-next').addEventListener('click', handleObNext);
  document.getElementById('ob-back').addEventListener('click', () => {
    if (state.ob.step > 1) { state.ob.step--; gotoObStep(state.ob.step); }
  });
}

function gotoObStep(step) {
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  const el = document.querySelector(`[data-step="${step}"]`);
  if (el) el.classList.add('active');
  document.getElementById('ob-back').style.visibility = step === 1 ? 'hidden' : '';
  const nextBtn = document.getElementById('ob-next');
  nextBtn.textContent = step === state.ob.totalSteps ? 'Get My Plan →' : 'Continue';
  renderObProgress();
}

function renderObProgress() {
  const el = document.getElementById('ob-progress');
  el.innerHTML = '';
  for (let i = 1; i <= state.ob.totalSteps; i++) {
    const bar = document.createElement('div');
    bar.className = `onboarding-progress-bar${i <= state.ob.step ? ' done' : ''}`;
    el.appendChild(bar);
  }
}

async function handleObNext() {
  const step = state.ob.step;
  if (step < state.ob.totalSteps) {
    state.ob.step++;
    gotoObStep(state.ob.step);
    return;
  }
  // Final step — submit
  const btn = document.getElementById('ob-next');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const payload = {
      fullName:          document.getElementById('ob-name').value.trim(),
      age:               Number(document.getElementById('ob-age').value),
      sex:               document.getElementById('ob-sex').value,
      weightKg:          Number(document.getElementById('ob-weight').value),
      heightCm:          Number(document.getElementById('ob-height').value),
      goal:              state.ob.goal || 'maintenance',
      activityLevel:     document.getElementById('ob-activity').value,
      workoutDays:       Number(document.getElementById('ob-days').value),
      gymAccess:         document.getElementById('ob-gym').value,
      workoutPreference: document.getElementById('ob-split').value,
      dietType:          document.getElementById('ob-diet').value,
      mealsPerDay:       Number(document.getElementById('ob-meals').value),
      cookingPreference: document.getElementById('ob-cooking').value,
      allergies:         document.getElementById('ob-allergies').value.trim(),
      dislikes:          document.getElementById('ob-dislikes').value.trim(),
      injuries:          document.getElementById('ob-injuries').value.trim(),
      waterGoalMl:       Number(document.getElementById('ob-water').value) || 2500,
      onboardingComplete: true
    };
    const pd = await api('POST', '/api/profile/onboarding', payload);
    state.profile = pd.profile;
    toast('Profile saved! Generating your plan...', 'success');
    // Generate plans in background
    Promise.all([
      api('POST', '/api/plans/meal').then(d => { state.mealPlan = d.plan; }).catch(() => {}),
      api('POST', '/api/plans/workout').then(d => { state.workoutPlan = d.plan; }).catch(() => {})
    ]).then(() => toast('Your plans are ready!', 'success'));
    await loadDashboard();
    showScreen('dashboard');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Get My Plan →';
  }
}

// ── Dashboard ──────────────────────────────────────────────

async function loadDashboard() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = state.profile?.full_name?.split(' ')[0] || '';
  document.getElementById('greeting-text').textContent = `${greet}${name ? ', ' + name : ''}`;

  const goal = (state.profile?.goal || '').replace('_', ' ');
  document.getElementById('greeting-sub').textContent =
    goal ? `Goal: ${goal.charAt(0).toUpperCase() + goal.slice(1)}` : 'Complete your profile to get started';

  // Load data in parallel
  const [mealRes, workoutRes, logsRes] = await Promise.allSettled([
    state.mealPlan ? Promise.resolve({ plan: state.mealPlan }) : api('GET', '/api/plans/meal').catch(() => null),
    state.workoutPlan ? Promise.resolve({ plan: state.workoutPlan }) : api('GET', '/api/plans/workout').catch(() => null),
    api('GET', '/api/tracking/progress?days=1').catch(() => ({ logs: [] }))
  ]);

  if (mealRes.status === 'fulfilled' && mealRes.value) state.mealPlan = mealRes.value.plan;
  if (workoutRes.status === 'fulfilled' && workoutRes.value) state.workoutPlan = workoutRes.value.plan;

  renderDashboardStats(logsRes.value?.logs?.[0]);
  renderDashboardWorkout();
  renderDashboardMeals();
}

function renderDashboardStats(todayLog) {
  const targets = state.mealPlan?.dailyTargets;
  const calTarget = targets?.calories || 0;
  const calConsumed = todayLog?.calories_consumed || 0;
  const water = todayLog?.water_ml || 0;
  const waterGoal = state.profile?.water_goal_ml || 2500;

  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Calories</div>
      <div class="stat-val">${calConsumed}<span class="stat-unit"> / ${calTarget}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Protein</div>
      <div class="stat-val">${todayLog?.protein_grams || 0}<span class="stat-unit">g</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Water</div>
      <div class="stat-val">${(water / 1000).toFixed(1)}<span class="stat-unit"> / ${(waterGoal / 1000).toFixed(1)}L</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Steps</div>
      <div class="stat-val">${(todayLog?.steps || 0).toLocaleString()}</div>
    </div>
  `;
}

function renderDashboardWorkout() {
  const el = document.getElementById('dashboard-workout');
  if (!state.workoutPlan?.days?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔋</div><p>No workout plan yet</p><button class="btn btn-ghost btn-sm" onclick="generateWorkoutPlan()">Generate Plan</button></div>`;
    return;
  }
  const dayIdx = new Date().getDay(); // 0=Sun
  const planDay = state.workoutPlan.days[dayIdx % state.workoutPlan.days.length];
  el.innerHTML = `
    <div class="workout-day-card" onclick="startRunner(${dayIdx % state.workoutPlan.days.length})">
      <div class="day-focus">${planDay.focus}</div>
      <div class="day-meta">${planDay.exercises?.length || 0} exercises &middot; ${planDay.dayLabel}</div>
      <button class="btn btn-accent btn-sm" style="margin-top:10px">Start Workout</button>
    </div>
  `;
}

function renderDashboardMeals() {
  const el = document.getElementById('dashboard-meals');
  if (!state.mealPlan?.days?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🍽️</div><p>No meal plan yet</p><button class="btn btn-ghost btn-sm" onclick="generateMealPlan()">Generate Plan</button></div>`;
    return;
  }
  const dayIdx = new Date().getDay();
  const today = state.mealPlan.days[dayIdx % state.mealPlan.days.length];
  el.innerHTML = today.meals.slice(0, 3).map(m => `
    <div class="meal-card">
      <div class="meal-type-badge">${m.type}</div>
      <div class="meal-name">${m.name}</div>
      <div class="meal-macros">
        <span><span class="macro-dot dot-p"></span>${m.proteinGrams}g P</span>
        <span><span class="macro-dot dot-c"></span>${m.carbsGrams}g C</span>
        <span><span class="macro-dot dot-f"></span>${m.fatsGrams}g F</span>
        <span>${m.calories} kcal</span>
      </div>
    </div>
  `).join('');
}

// ── Meals ───────────────────────────────────────────────────

async function loadMealsScreen() {
  if (!state.mealPlan) {
    document.getElementById('meals-loading').style.display = 'block';
    document.getElementById('meals-content').innerHTML = '';
    document.getElementById('meal-day-tabs').innerHTML = '';
    try {
      const d = await api('GET', '/api/plans/meal');
      state.mealPlan = d.plan;
    } catch {
      document.getElementById('meals-loading').style.display = 'none';
      document.getElementById('meals-content').innerHTML = `<div class="empty-state"><div class="empty-icon">🍽️</div><p>No meal plan yet. Generate one to get started.</p></div>`;
      return;
    }
    document.getElementById('meals-loading').style.display = 'none';
  }
  renderMealsScreen(0);
}

function renderMealsScreen(dayIdx) {
  const plan = state.mealPlan;
  if (!plan?.days?.length) return;

  // Day tabs
  const tabsEl = document.getElementById('meal-day-tabs');
  tabsEl.innerHTML = plan.days.map((d, i) => `
    <button class="day-tab${i === dayIdx ? ' active' : ''}" onclick="renderMealsScreen(${i})">${d.day.slice(0, 3)}</button>
  `).join('');

  const day = plan.days[dayIdx];
  const targets = plan.dailyTargets;

  document.getElementById('meals-content').innerHTML = `
    <div class="card">
      <div class="card-title">Daily Targets</div>
      <div class="macro-labels"><span>Cals: ${targets?.calories || '–'}</span><span>P: ${targets?.proteinGrams || '–'}g C: ${targets?.carbsGrams || '–'}g F: ${targets?.fatsGrams || '–'}g</span></div>
    </div>
    ${day.meals.map(m => `
      <div class="meal-card">
        <div class="meal-type-badge">${m.type}</div>
        <div class="meal-name">${m.name}</div>
        <div class="meal-macros mb-8">
          <span><span class="macro-dot dot-p"></span>${m.proteinGrams}g P</span>
          <span><span class="macro-dot dot-c"></span>${m.carbsGrams}g C</span>
          <span><span class="macro-dot dot-f"></span>${m.fatsGrams}g F</span>
          <span>${m.calories} kcal</span>
        </div>
        ${m.ingredients?.length ? `<details style="margin-top:6px"><summary style="font-size:0.82rem;color:var(--secondary);cursor:pointer">Ingredients & steps</summary>
          <ul style="margin:8px 0 0 16px;font-size:0.82rem;color:var(--secondary);line-height:1.8">
            ${m.ingredients.map(ing => `<li>${ing.amount} ${ing.item}</li>`).join('')}
          </ul>
          ${m.instructions?.length ? `<ol style="margin:8px 0 0 16px;font-size:0.82rem;color:var(--secondary);line-height:1.8">${m.instructions.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
        </details>` : ''}
      </div>
    `).join('')}
  `;
}

async function generateMealPlan() {
  toast('Generating meal plan...');
  try {
    const d = await api('POST', '/api/plans/meal');
    state.mealPlan = d.plan;
    toast('Meal plan ready!', 'success');
    renderMealsScreen(0);
  } catch (e) { toast(e.message, 'error'); }
}

// ── Workout plan ────────────────────────────────────────────

async function loadWorkoutScreen() {
  if (!state.workoutPlan) {
    document.getElementById('workout-loading').style.display = 'block';
    try {
      const d = await api('GET', '/api/plans/workout');
      state.workoutPlan = d.plan;
    } catch {
      document.getElementById('workout-loading').style.display = 'none';
      document.getElementById('workout-content').innerHTML = `<div class="empty-state"><div class="empty-icon">🏋️</div><p>No workout plan yet.</p></div>`;
      return;
    }
    document.getElementById('workout-loading').style.display = 'none';
  }
  renderWorkoutScreen();
}

function renderWorkoutScreen() {
  const plan = state.workoutPlan;
  if (!plan?.days?.length) return;
  document.getElementById('workout-content').innerHTML = `
    <div class="card">
      <div class="card-title">Program</div>
      <strong>${plan.programName || 'Workout Program'}</strong>
      <p class="text-secondary mt-4" style="font-size:0.85rem">${plan.progressionRule || ''}</p>
    </div>
    ${plan.days.map((day, i) => `
      <div class="workout-day-card" onclick="startRunner(${i})">
        <div class="flex-between">
          <div>
            <div class="day-focus">${day.focus}</div>
            <div class="day-meta">${day.exercises?.length || 0} exercises &middot; ${day.dayLabel}</div>
          </div>
          <button class="btn btn-accent btn-sm">Start</button>
        </div>
        <div style="margin-top:8px">
          ${day.exercises?.slice(0, 3).map(e => `<span class="badge badge-muted" style="margin:2px">${e.name}</span>`).join('')}
          ${(day.exercises?.length || 0) > 3 ? `<span class="text-muted" style="font-size:0.75rem">+${day.exercises.length - 3} more</span>` : ''}
        </div>
      </div>
    `).join('')}
  `;
}

async function generateWorkoutPlan() {
  toast('Generating workout plan...');
  try {
    const d = await api('POST', '/api/plans/workout');
    state.workoutPlan = d.plan;
    toast('Workout plan ready!', 'success');
    renderWorkoutScreen();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Workout Runner ──────────────────────────────────────────

function startRunner(dayIdx) {
  if (!state.workoutPlan?.days?.length) return;
  const r = state.runner;
  r.active = true;
  r.day = state.workoutPlan.days[dayIdx];
  r.planId = null;
  r.exIdx = 0;
  r.setIdx = 0;
  r.loggedSets = [];
  r.startTime = Date.now();
  r.weightByEx = {};

  document.getElementById('runner-day-label').textContent = r.day.dayLabel || 'Workout';
  document.getElementById('rest-screen').classList.remove('active');
  document.getElementById('screen-runner').classList.add('active');

  // Start elapsed timer
  clearInterval(r.elapsedInterval);
  r.elapsedInterval = setInterval(updateElapsed, 1000);

  renderRunnerExercise();
}

function renderRunnerExercise() {
  const r = state.runner;
  const exercises = r.day?.exercises || [];
  if (r.exIdx >= exercises.length) { endWorkout(); return; }

  const ex = exercises[r.exIdx];
  const totalSets = ex.sets || 3;

  if (!r.weightByEx[r.exIdx]) r.weightByEx[r.exIdx] = 60;

  document.getElementById('runner-exercise-name').textContent = ex.name;
  document.getElementById('runner-set-info').textContent = `Set ${r.setIdx + 1} of ${totalSets} • ${ex.reps} reps • ${ex.restSeconds || 90}s rest`;
  document.getElementById('runner-weight').value = r.weightByEx[r.exIdx];
  document.getElementById('runner-progress-text').textContent = `Exercise ${r.exIdx + 1} of ${exercises.length}`;
}

function updateElapsed() {
  const r = state.runner;
  if (!r.startTime) return;
  const secs = Math.floor((Date.now() - r.startTime) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  document.getElementById('runner-elapsed').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function completeSet() {
  const r = state.runner;
  const exercises = r.day?.exercises || [];
  const ex = exercises[r.exIdx];
  if (!ex) return;

  const weight = parseFloat(document.getElementById('runner-weight').value) || 0;
  r.weightByEx[r.exIdx] = weight;

  r.loggedSets.push({
    exerciseName: ex.name,
    setNumber: r.setIdx + 1,
    reps: ex.reps,
    weightKg: weight
  });

  const totalSets = ex.sets || 3;
  r.setIdx++;

  if (r.setIdx >= totalSets) {
    r.exIdx++;
    r.setIdx = 0;
    if (r.exIdx < exercises.length) startRestTimer(ex.restSeconds || 90);
    else endWorkout();
  } else {
    startRestTimer(ex.restSeconds || 90);
  }
}

function startRestTimer(seconds) {
  const r = state.runner;
  clearInterval(r.restInterval);
  r.restEndTime = Date.now() + seconds * 1000;

  const screen = document.getElementById('rest-screen');
  screen.classList.add('active');

  function tick() {
    const remaining = Math.max(0, Math.ceil((r.restEndTime - Date.now()) / 1000));
    document.getElementById('rest-countdown').textContent = remaining;
    if (remaining <= 0) {
      clearInterval(r.restInterval);
      screen.classList.remove('active');
      renderRunnerExercise();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
  }

  tick();
  r.restInterval = setInterval(tick, 500);
}

function addRestTime(extra) {
  state.runner.restEndTime = (state.runner.restEndTime || Date.now()) + extra * 1000;
}

function skipRest() {
  clearInterval(state.runner.restInterval);
  document.getElementById('rest-screen').classList.remove('active');
  renderRunnerExercise();
}

function skipExercise() {
  const r = state.runner;
  r.exIdx++;
  r.setIdx = 0;
  const exercises = r.day?.exercises || [];
  if (r.exIdx >= exercises.length) endWorkout();
  else renderRunnerExercise();
}

async function endWorkout() {
  const r = state.runner;
  clearInterval(r.elapsedInterval);
  clearInterval(r.restInterval);
  document.getElementById('rest-screen').classList.remove('active');

  const elapsed = Math.floor((Date.now() - (r.startTime || Date.now())) / 1000);
  const volume = r.loggedSets.reduce((sum, s) => {
    const repsNum = parseInt(String(s.reps).split('-')[0]) || 8;
    return sum + repsNum * s.weightKg;
  }, 0);

  // Show summary modal
  document.getElementById('summary-stats').innerHTML = `
    <div class="modal-stat"><span class="modal-stat-label">Duration</span><span class="modal-stat-value">${Math.floor(elapsed / 60)} min</span></div>
    <div class="modal-stat"><span class="modal-stat-label">Sets completed</span><span class="modal-stat-value">${r.loggedSets.length}</span></div>
    <div class="modal-stat"><span class="modal-stat-label">Volume lifted</span><span class="modal-stat-value">${Math.round(volume).toLocaleString()} kg</span></div>
    <div class="modal-stat"><span class="modal-stat-label">Day</span><span class="modal-stat-value">${r.day?.focus || ''}</span></div>
  `;
  document.getElementById('modal-summary').classList.add('active');

  // Save session
  try {
    await api('POST', '/api/workouts/session', {
      dayLabel: r.day?.dayLabel,
      exercises: r.loggedSets,
      totalTimeSeconds: elapsed,
      totalVolumeKg: Math.round(volume),
      completedAt: new Date().toISOString()
    });
  } catch { /* ignore */ }
}

function closeRunner() {
  document.getElementById('screen-runner').classList.remove('active');
  document.getElementById('modal-summary').classList.remove('active');
  state.runner.active = false;
  showScreen('dashboard');
  loadDashboard();
}

// ── Progress ────────────────────────────────────────────────

async function loadProgressScreen() {
  try {
    const d = await api('GET', '/api/tracking/progress?days=30');
    state.progressLogs = d.logs || [];
  } catch { state.progressLogs = []; }
  renderCharts();
}

function renderCharts() {
  const logs = state.progressLogs;
  drawLineChart('chart-weight', logs.map(l => l.log_date?.slice(5) || ''), logs.map(l => parseFloat(l.weight_kg) || null), 'kg', '#4ADE80');
  drawLineChart('chart-calories', logs.slice(-7).map(l => l.log_date?.slice(5) || ''), logs.slice(-7).map(l => l.calories_consumed || 0), 'kcal', '#F97316');
}

function drawLineChart(canvasId, labels, values, unit, colour) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 300;
  const H = 120;
  canvas.width = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const valid = values.filter(v => v !== null && v > 0);
  if (!valid.length) {
    ctx.fillStyle = '#55555F';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', W / 2, H / 2);
    return;
  }

  const pad = { t: 10, r: 10, b: 24, l: 40 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const min = Math.min(...valid) * 0.98;
  const max = Math.max(...valid) * 1.02;
  const range = max - min || 1;

  const xStep = cW / Math.max(labels.length - 1, 1);
  const pts = values.map((v, i) => ({
    x: pad.l + i * xStep,
    y: v !== null && v > 0 ? pad.t + cH - ((v - min) / range) * cH : null
  }));

  // Grid lines
  ctx.strokeStyle = '#2A2A32';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pad.t + (cH / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  }

  // Line
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  pts.forEach(p => {
    if (p.y === null) return;
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  // Dots
  pts.forEach(p => {
    if (p.y === null) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  });

  // X labels (every nth)
  ctx.fillStyle = '#55555F';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  const step = Math.ceil(labels.length / 6);
  labels.forEach((l, i) => {
    if (i % step === 0) ctx.fillText(l, pad.l + i * xStep, H - 6);
  });
}

async function saveProgressLog() {
  const payload = {};
  const w = document.getElementById('log-weight').value;
  const water = document.getElementById('log-water').value;
  const steps = document.getElementById('log-steps').value;
  if (w) payload.weightKg = parseFloat(w);
  if (water) payload.waterMl = parseInt(water);
  if (steps) payload.steps = parseInt(steps);
  if (!Object.keys(payload).length) return toast('Enter at least one value', 'error');
  try {
    await api('POST', '/api/tracking/progress', payload);
    toast('Progress saved!', 'success');
    document.getElementById('log-weight').value = '';
    document.getElementById('log-water').value = '';
    document.getElementById('log-steps').value = '';
    await loadProgressScreen();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Settings ───────────────────────────────────────────────

function loadSettingsScreen() {
  document.getElementById('settings-email').textContent = state.user?.email || '';
  if (state.profile) {
    document.getElementById('s-name').value = state.profile.full_name || '';
    document.getElementById('s-weight').value = state.profile.weight_kg || '';
    document.getElementById('s-goal').value = state.profile.goal || 'maintenance';
  }
}

async function saveSettings() {
  try {
    const payload = {
      fullName: document.getElementById('s-name').value.trim(),
      weightKg: parseFloat(document.getElementById('s-weight').value) || undefined,
      goal: document.getElementById('s-goal').value
    };
    const d = await api('PUT', '/api/profile', payload);
    state.profile = d.profile;
    toast('Settings saved!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function signout() {
  await api('POST', '/api/auth/signout').catch(() => {});
  state.user = null; state.profile = null;
  state.mealPlan = null; state.workoutPlan = null;
  showScreen('auth');
}

// ── Navigation wiring ────────────────────────────────────────

function initNavListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.nav;
      showScreen(name);
      if (name === 'meals') await loadMealsScreen();
      else if (name === 'workout') await loadWorkoutScreen();
      else if (name === 'progress') await loadProgressScreen();
      else if (name === 'settings') loadSettingsScreen();
      else if (name === 'dashboard') await loadDashboard();
    });
  });

  document.getElementById('btn-gen-meals').addEventListener('click', generateMealPlan);
  document.getElementById('btn-gen-workout').addEventListener('click', generateWorkoutPlan);
  document.getElementById('btn-finish-set').addEventListener('click', completeSet);
  document.getElementById('btn-skip-exercise').addEventListener('click', skipExercise);
  document.getElementById('btn-skip-rest').addEventListener('click', skipRest);
  document.getElementById('btn-add30').addEventListener('click', () => addRestTime(30));
  document.getElementById('btn-add60').addEventListener('click', () => addRestTime(60));
  document.getElementById('btn-end-workout').addEventListener('click', endWorkout);
  document.getElementById('btn-close-summary').addEventListener('click', closeRunner);
  document.getElementById('btn-save-log').addEventListener('click', saveProgressLog);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('btn-signout').addEventListener('click', signout);

  // Weight +/- in runner
  document.getElementById('runner-weight-up').addEventListener('click', () => {
    const inp = document.getElementById('runner-weight');
    inp.value = (parseFloat(inp.value) || 0) + 2.5;
  });
  document.getElementById('runner-weight-down').addEventListener('click', () => {
    const inp = document.getElementById('runner-weight');
    inp.value = Math.max(0, (parseFloat(inp.value) || 0) - 2.5);
  });
}

// Make startRunner globally accessible (called from HTML onclick)
window.startRunner = startRunner;
window.generateMealPlan = generateMealPlan;
window.generateWorkoutPlan = generateWorkoutPlan;

// ── PWA ────────────────────────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  registerSW();
  initAuthListeners();
  initNavListeners();
  await checkAuth();
});
