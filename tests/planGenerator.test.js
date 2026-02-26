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
  workoutDays: 4
};

test('buildRuleBasedPlan returns required sections', () => {
  const plan = buildRuleBasedPlan(baseProfile);
  assert.ok(plan.summary);
  assert.ok(plan.nutrition.targetCalories > 0);
  assert.ok(plan.nutrition.macros.proteinGrams > 0);
  assert.equal(plan.training.weeklySchedule.length, 4);
  assert.ok(plan.recovery.sleepHours);
});

test('workout schedule adapts to requested days', () => {
  const plan = buildRuleBasedPlan({ ...baseProfile, workoutDays: 3 });
  assert.equal(plan.training.weeklySchedule.length, 3);
});
