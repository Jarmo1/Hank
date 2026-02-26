import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuleBasedPlan } from '../src/planGenerator.js';

const baseProfile = {
  fullName: 'Alex',
  age: 30,
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  goal: 'fat_loss',
  activityLevel: 'moderate',
  workoutDays: 4,
  dietaryPreferences: ''
};

test('buildRuleBasedPlan returns required sections', () => {
  const plan = buildRuleBasedPlan(baseProfile);
  assert.ok(plan.summary);
  assert.ok(plan.nutrition.targetCalories > 0);
  assert.ok(plan.nutrition.macros.proteinGrams > 0);
  assert.equal(plan.activity.weeklySchedule.length, 4);
  assert.ok(plan.recovery.sleepHours);
  assert.ok(plan.foodLoggerTemplate.dailyTargets.calories > 0);
});

test('workout schedule adapts to requested days and uses split focus', () => {
  const plan = buildRuleBasedPlan({ ...baseProfile, workoutDays: 3 });
  assert.equal(plan.activity.weeklySchedule.length, 3);
  assert.match(plan.activity.weeklySchedule[0].focus, /Chest \+ Back/);
  assert.match(plan.activity.weeklySchedule[1].focus, /Legs \+ Core/);
});

test('4-day split includes muscle-specific days', () => {
  const plan = buildRuleBasedPlan({ ...baseProfile, workoutDays: 4 });
  const focuses = plan.activity.weeklySchedule.map((day) => day.focus);
  assert.deepEqual(focuses, [
    'Chest + Biceps',
    'Back + Triceps',
    'Quads + Calves',
    'Hamstrings + Glutes + Shoulders'
  ]);
});

test('meal ideas include calorie guidance tied to target calories', () => {
  const plan = buildRuleBasedPlan({ ...baseProfile, workoutDays: 4 });
  assert.equal(plan.nutrition.mealIdeas.length, 4);
  for (const mealIdea of plan.nutrition.mealIdeas) {
    assert.match(mealIdea, /~\d+ kcal/);
  }
});

test('meal structure protein totals approximately daily protein target', () => {
  const plan = buildRuleBasedPlan({ ...baseProfile, workoutDays: 4 });
  const totalStructuredProtein = plan.nutrition.mealStructure.reduce((sum, meal) => sum + meal.targetProtein, 0);
  const diff = Math.abs(totalStructuredProtein - plan.nutrition.macros.proteinGrams);
  assert.ok(diff <= 5);
});
