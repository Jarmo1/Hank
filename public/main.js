const profileForm = document.getElementById('profile-form');
const foodLogForm = document.getElementById('food-log-form');
const statusEl = document.getElementById('status');
const dashboardEl = document.getElementById('dashboard');
const foodLogCardEl = document.getElementById('food-log-card');
const tabsEl = document.getElementById('tabs');
const tabContentEl = document.getElementById('tab-content');

let state = {
  accountId: null,
  source: null,
  plan: null,
  foodLogs: [],
  selectedTab: 'overview'
};

function list(items = []) {
  if (!Array.isArray(items) || !items.length) return '<p class="muted">No entries yet.</p>';
  return `<ul>${items
    .map((item) => `<li>${typeof item === 'string' ? item : JSON.stringify(item)}</li>`)
    .join('')}</ul>`;
}

function activitySchedule(schedule = []) {
  if (!schedule.length) return '<p class="muted">No schedule generated.</p>';

  return schedule
    .map(
      (day) => `
        <article class="mini-card">
          <h4>${day.day} · ${day.focus}</h4>
          <p><strong>Main lifts:</strong> ${Array.isArray(day.mainLifts) ? day.mainLifts.join(', ') : day.mainLifts || '-'}</p>
          <p><strong>Accessories:</strong> ${Array.isArray(day.accessories) ? day.accessories.join(', ') : day.accessories || '-'}</p>
          <p><strong>Conditioning:</strong> ${day.conditioning || '-'}</p>
        </article>
      `
    )
    .join('');
}

function foodLogRows(logs = []) {
  if (!logs.length) return '<p class="muted">No food logs yet.</p>';

  return `
    <table>
      <thead>
        <tr><th>Meal</th><th>Calories</th><th>P</th><th>C</th><th>F</th><th>Created</th></tr>
      </thead>
      <tbody>
        ${logs
          .map(
            (log) => `
              <tr>
                <td>${log.meal_name}</td>
                <td>${log.calories}</td>
                <td>${log.protein_grams}</td>
                <td>${log.carbs_grams}</td>
                <td>${log.fats_grams}</td>
                <td>${new Date(log.created_at).toLocaleString()}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderTabContent() {
  const plan = state.plan;
  if (!plan) return;

  if (state.selectedTab === 'overview') {
    tabContentEl.innerHTML = `
      <h2>Plan Overview (${state.source === 'ai' ? 'AI' : 'Rule-Based'})</h2>
      <p>${plan.summary || 'No summary yet.'}</p>
      <div class="kpi-grid">
        <div class="mini-card"><h4>Calories</h4><p>${plan.nutrition?.targetCalories || '-'} kcal/day</p></div>
        <div class="mini-card"><h4>Macros</h4><p>P ${plan.nutrition?.macros?.proteinGrams || '-'} · C ${plan.nutrition?.macros?.carbsGrams || '-'} · F ${plan.nutrition?.macros?.fatsGrams || '-'}</p></div>
        <div class="mini-card"><h4>Steps</h4><p>${plan.activity?.stepTarget || '-'}</p></div>
        <div class="mini-card"><h4>Target Rate</h4><p>${plan.bodyMetrics?.targetRate || '-'}</p></div>
      </div>
      <h3>Recovery Focus</h3>
      <p><strong>Sleep:</strong> ${plan.recovery?.sleepHours || '-'}</p>
      ${list(plan.recovery?.stressManagement || [])}
    `;
    return;
  }

  if (state.selectedTab === 'food') {
    tabContentEl.innerHTML = `
      <h2>Food Plan</h2>
      <p><strong>Hydration:</strong> ${plan.nutrition?.hydrationLiters || '-'}L / day</p>
      <h3>Meal Ideas</h3>
      ${list(plan.nutrition?.mealIdeas || [])}
      <h3>Meal Structure</h3>
      ${list((plan.nutrition?.mealStructure || []).map((m) => `${m.meal}: ${m.targetProtein}g protein · ${m.note}`))}
      <h3>Grocery List</h3>
      ${list(plan.nutrition?.groceryList || [])}
    `;
    return;
  }

  if (state.selectedTab === 'activity') {
    tabContentEl.innerHTML = `
      <h2>Training & Activity Plan</h2>
      <p><strong>Cardio:</strong> ${plan.activity?.cardio || '-'}</p>
      <p><strong>Progression:</strong> ${plan.activity?.progression || '-'}</p>
      <div class="stack">${activitySchedule(plan.activity?.weeklySchedule || [])}</div>
      <h3>Check-ins & Adjustments</h3>
      ${list(plan.bodyMetrics?.checkInDays || [])}
      ${list(plan.bodyMetrics?.adjustmentRules || [])}
    `;
    return;
  }

  tabContentEl.innerHTML = `
    <h2>Food Logger</h2>
    <p>Daily targets: ${plan.foodLoggerTemplate?.dailyTargets?.calories || '-'} kcal · P ${plan.foodLoggerTemplate?.dailyTargets?.proteinGrams || '-'} · C ${plan.foodLoggerTemplate?.dailyTargets?.carbsGrams || '-'} · F ${plan.foodLoggerTemplate?.dailyTargets?.fatsGrams || '-'}</p>
    <h3>Logging Prompts</h3>
    ${list(plan.foodLoggerTemplate?.prompts || [])}
    <h3>Recent Logs</h3>
    ${foodLogRows(state.foodLogs)}
  `;
}

function renderTabs() {
  const tabs = [
    ['overview', 'Overview'],
    ['food', 'Food Plan'],
    ['activity', 'Weight / Activity Plan'],
    ['logger', 'Food Logger']
  ];

  tabsEl.innerHTML = tabs
    .map(
      ([key, label]) =>
        `<button class="tab ${state.selectedTab === key ? 'active' : ''}" data-tab="${key}" type="button">${label}</button>`
    )
    .join('');

  tabsEl.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTab = button.dataset.tab;
      renderTabs();
      renderTabContent();
    });
  });
}

async function refreshDashboard(email) {
  const response = await fetch(`/api/account/${encodeURIComponent(email)}`);
  if (!response.ok) return;

  const dashboard = await response.json();
  state.foodLogs = dashboard.foodLogs || [];
  renderTabContent();
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Generating full account plan...';

  const data = Object.fromEntries(new FormData(profileForm).entries());

  try {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to generate plan');

    state.accountId = json.accountId;
    state.source = json.source;
    state.plan = json.plan;
    state.selectedTab = 'overview';
    dashboardEl.classList.remove('hidden');
    foodLogCardEl.classList.remove('hidden');
    renderTabs();
    await refreshDashboard(data.email);
    statusEl.textContent = 'Done. Account synced and full plan regenerated.';
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

foodLogForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!state.accountId) {
    statusEl.textContent = 'Create your account plan first before logging food.';
    return;
  }

  const payload = Object.fromEntries(new FormData(foodLogForm).entries());

  try {
    const response = await fetch(`/api/account/${state.accountId}/food-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to save food log');

    const email = new FormData(profileForm).get('email');
    await refreshDashboard(String(email || '').trim().toLowerCase());
    foodLogForm.reset();
    statusEl.textContent = 'Food log saved.';
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
