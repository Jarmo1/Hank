const form = document.getElementById('profile-form');
const statusEl = document.getElementById('status');
const planEl = document.getElementById('plan');

function list(items = []) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderPlan(result) {
  const { plan, source } = result;
  const mealIdeas = plan.nutrition.mealIdeas || [];
  const schedule = plan.training.weeklySchedule || [];
  const stress = plan.recovery.stressManagement || [];

  planEl.innerHTML = `
    <h2>Your Plan (${source === 'ai' ? 'AI' : 'Rule-Based'})</h2>
    <p>${plan.summary}</p>

    <h3>Nutrition</h3>
    <p><strong>Calories:</strong> ${plan.nutrition.targetCalories} kcal/day</p>
    <p><strong>Macros:</strong> P ${plan.nutrition.macros.proteinGrams}g · C ${plan.nutrition.macros.carbsGrams}g · F ${plan.nutrition.macros.fatsGrams}g</p>
    ${mealIdeas.length ? `<h4>Meal ideas</h4>${list(mealIdeas)}` : ''}

    <h3>Training</h3>
    ${list(schedule)}
    <p><strong>Progression:</strong> ${plan.training.progression}</p>
    <p><strong>Cardio:</strong> ${plan.training.cardio}</p>

    <h3>Recovery</h3>
    <p><strong>Sleep:</strong> ${plan.recovery.sleepHours}</p>
    ${list(stress)}
  `;

  planEl.classList.remove('hidden');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Generating your plan...';

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || 'Unable to generate plan');
    }

    renderPlan(json);
    statusEl.textContent = `Done! Plan source: ${json.source}.`;
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
