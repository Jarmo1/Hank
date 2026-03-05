// Rule-based fallback planner (no AI required)

function calculateBmr(profile) {
  const w = Number(profile.weight_kg);
  const h = Number(profile.height_cm);
  const a = Number(profile.age);
  const sex = String(profile.sex || '').toLowerCase();
  const base = 10 * w + 6.25 * h - 5 * a;
  return sex === 'female' ? base - 161 : base + 5;
}

function activityMultiplier(level) {
  return { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 }[level] ?? 1.55;
}

function tdeeForProfile(profile) {
  return Math.round(calculateBmr(profile) * activityMultiplier(profile.activity_level));
}

function caloriesForGoal(tdee, goal) {
  if (goal === 'fat_loss') return Math.max(1400, tdee - 400);
  if (goal === 'muscle_gain') return tdee + 300;
  return tdee;
}

function macroSplit(goal, calories) {
  const splits = {
    fat_loss:      { protein: 0.35, carbs: 0.30, fats: 0.35 },
    muscle_gain:   { protein: 0.30, carbs: 0.45, fats: 0.25 },
    recomposition: { protein: 0.33, carbs: 0.37, fats: 0.30 },
    maintenance:   { protein: 0.30, carbs: 0.40, fats: 0.30 },
    performance:   { protein: 0.28, carbs: 0.50, fats: 0.22 }
  };
  const s = splits[goal] ?? splits.maintenance;
  return {
    proteinGrams: Math.round((calories * s.protein) / 4),
    carbsGrams:   Math.round((calories * s.carbs) / 4),
    fatsGrams:    Math.round((calories * s.fats) / 9),
    fibreGrams:   25
  };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_TEMPLATES = {
  standard: {
    breakfast: [
      { name: 'Scrambled eggs on wholegrain toast with avocado', prep: 5, cook: 10 },
      { name: 'Greek yogurt with rolled oats, banana and honey', prep: 5, cook: 0 },
      { name: 'Protein smoothie with oats, banana, milk and peanut butter', prep: 5, cook: 0 }
    ],
    lunch: [
      { name: 'Chicken and rice bowl with mixed vegetables', prep: 10, cook: 20 },
      { name: 'Tuna and brown rice salad with olive oil dressing', prep: 10, cook: 15 },
      { name: 'Lean beef stir-fry with noodles and bok choy', prep: 10, cook: 15 }
    ],
    dinner: [
      { name: 'Grilled salmon with sweet potato and broccolini', prep: 10, cook: 25 },
      { name: 'Chicken thighs with roasted pumpkin and green beans', prep: 10, cook: 35 },
      { name: 'Beef mince bolognese with wholemeal pasta', prep: 10, cook: 25 }
    ],
    snack: [
      { name: 'Cottage cheese with rice crackers', prep: 2, cook: 0 },
      { name: 'Handful of mixed nuts and a piece of fruit', prep: 1, cook: 0 },
      { name: 'Protein bar or Greek yogurt', prep: 0, cook: 0 }
    ]
  },
  vegetarian: {
    breakfast: [
      { name: 'Tofu scramble on wholegrain toast', prep: 5, cook: 10 },
      { name: 'Overnight oats with chia seeds, berries and almond milk', prep: 10, cook: 0 },
      { name: 'Smoothie bowl with protein powder, banana and granola', prep: 5, cook: 0 }
    ],
    lunch: [
      { name: 'Chickpea and roasted vegetable rice bowl', prep: 10, cook: 25 },
      { name: 'Lentil soup with crusty wholegrain bread', prep: 10, cook: 30 },
      { name: 'Halloumi and quinoa salad with roasted capsicum', prep: 10, cook: 15 }
    ],
    dinner: [
      { name: 'Black bean tacos with salsa and avocado', prep: 15, cook: 15 },
      { name: 'Vegetable and paneer curry with basmati rice', prep: 15, cook: 25 },
      { name: 'Mushroom and lentil bolognese with pasta', prep: 10, cook: 25 }
    ],
    snack: [
      { name: 'Hummus with celery and carrot sticks', prep: 3, cook: 0 },
      { name: 'Mixed nuts and dried fruit', prep: 1, cook: 0 },
      { name: 'Greek yogurt with honey and walnuts', prep: 2, cook: 0 }
    ]
  },
  vegan: {
    breakfast: [
      { name: 'Tofu scramble with spinach and nutritional yeast', prep: 5, cook: 10 },
      { name: 'Overnight oats with plant milk, chia seeds and berries', prep: 10, cook: 0 },
      { name: 'Smoothie with plant protein, banana, spinach and almond milk', prep: 5, cook: 0 }
    ],
    lunch: [
      { name: 'Lentil and chickpea rice bowl with tahini dressing', prep: 10, cook: 20 },
      { name: 'Tofu and vegetable noodle stir-fry', prep: 10, cook: 15 },
      { name: 'Tempeh grain bowl with roasted vegetables and avocado', prep: 10, cook: 25 }
    ],
    dinner: [
      { name: 'Black bean and sweet potato curry with brown rice', prep: 15, cook: 25 },
      { name: 'Lentil dahl with roti and spinach', prep: 10, cook: 30 },
      { name: 'Chickpea tikka masala with basmati rice', prep: 15, cook: 25 }
    ],
    snack: [
      { name: 'Edamame with sea salt', prep: 2, cook: 5 },
      { name: 'Apple with almond butter', prep: 2, cook: 0 },
      { name: 'Mixed nuts and dark chocolate', prep: 1, cook: 0 }
    ]
  }
};

function getMealTemplate(dietType) {
  const d = String(dietType || '').toLowerCase();
  if (d.includes('vegan')) return MEAL_TEMPLATES.vegan;
  if (d.includes('vegetarian')) return MEAL_TEMPLATES.vegetarian;
  return MEAL_TEMPLATES.standard;
}

function buildMeal(type, templateItem, calories, macros, servings = 1) {
  return {
    type,
    name: templateItem.name,
    calories: Math.round(calories),
    proteinGrams: Math.round(macros.protein),
    carbsGrams: Math.round(macros.carbs),
    fatsGrams: Math.round(macros.fats),
    ingredients: [],
    instructions: ['Prepare ingredients.', 'Cook as described.', 'Serve and enjoy.'],
    prepMinutes: templateItem.prep,
    cookMinutes: templateItem.cook,
    servings,
    batchCook: servings > 1
  };
}

export function buildRuleBasedMealPlan(profile) {
  const tdee = tdeeForProfile(profile);
  const targetCal = caloriesForGoal(tdee, profile.goal);
  const macros = macroSplit(profile.goal, targetCal);
  const template = getMealTemplate(profile.diet_type);
  const mealsPerDay = Number(profile.meals_per_day) || 3;

  const mealSplit = mealsPerDay >= 4
    ? { breakfast: 0.25, lunch: 0.30, dinner: 0.30, snack: 0.15 }
    : { breakfast: 0.30, lunch: 0.35, dinner: 0.35, snack: 0 };

  const days = DAYS.slice(0, 7).map((day, i) => {
    const meals = [];

    const bIdx = i % template.breakfast.length;
    const lIdx = i % template.lunch.length;
    const dIdx = i % template.dinner.length;

    if (mealSplit.breakfast > 0) {
      const cal = targetCal * mealSplit.breakfast;
      meals.push(buildMeal('breakfast', template.breakfast[bIdx], cal, {
        protein: macros.proteinGrams * mealSplit.breakfast,
        carbs: macros.carbsGrams * mealSplit.breakfast,
        fats: macros.fatsGrams * mealSplit.breakfast
      }));
    }
    if (mealSplit.lunch > 0) {
      const cal = targetCal * mealSplit.lunch;
      meals.push(buildMeal('lunch', template.lunch[lIdx], cal, {
        protein: macros.proteinGrams * mealSplit.lunch,
        carbs: macros.carbsGrams * mealSplit.lunch,
        fats: macros.fatsGrams * mealSplit.lunch
      }, profile.cooking_preference === 'batch_prep' ? 5 : 1));
    }
    if (mealSplit.dinner > 0) {
      const cal = targetCal * mealSplit.dinner;
      meals.push(buildMeal('dinner', template.dinner[dIdx], cal, {
        protein: macros.proteinGrams * mealSplit.dinner,
        carbs: macros.carbsGrams * mealSplit.dinner,
        fats: macros.fatsGrams * mealSplit.dinner
      }));
    }
    if (mealSplit.snack > 0) {
      const sIdx = i % template.snack.length;
      const cal = targetCal * mealSplit.snack;
      meals.push(buildMeal('snack', template.snack[sIdx], cal, {
        protein: macros.proteinGrams * mealSplit.snack,
        carbs: macros.carbsGrams * mealSplit.snack,
        fats: macros.fatsGrams * mealSplit.snack
      }));
    }

    return { day, totalCalories: targetCal, meals };
  });

  return {
    dailyTargets: {
      calories: targetCal,
      proteinGrams: macros.proteinGrams,
      carbsGrams: macros.carbsGrams,
      fatsGrams: macros.fatsGrams,
      fibreGrams: macros.fibreGrams,
      waterMl: profile.water_goal_ml || 2500
    },
    days,
    shoppingList: [
      { category: 'Protein', item: 'Chicken breast or thighs', quantity: '1.5kg' },
      { category: 'Protein', item: 'Salmon fillets', quantity: '500g' },
      { category: 'Produce', item: 'Mixed vegetables (broccoli, capsicum, zucchini)', quantity: '1kg' },
      { category: 'Produce', item: 'Sweet potato', quantity: '500g' },
      { category: 'Pantry', item: 'Brown rice or basmati rice', quantity: '1kg' },
      { category: 'Pantry', item: 'Rolled oats', quantity: '500g' },
      { category: 'Dairy', item: 'Greek yogurt', quantity: '1kg tub' },
      { category: 'Produce', item: 'Bananas', quantity: '1 bunch' }
    ],
    coachNote: `Targeting ${targetCal} kcal/day for ${String(profile.goal || '').replace('_', ' ')}. Protein goal: ${macros.proteinGrams}g/day. Adjust portions if weight trend deviates from target.`
  };
}

// ── Workout plan ────────────────────────────────────────────────────

const EXERCISE_LIBRARY = {
  chest:      [{ name: 'Barbell Bench Press',     sets: 4, reps: '6–8',   rest: 120, alternatives: ['DB Bench Press', 'Push-up Variations'] },
               { name: 'Incline DB Press',         sets: 3, reps: '10–12', rest: 90,  alternatives: ['Incline Machine Press', 'Feet-elevated Push-up'] },
               { name: 'Cable Fly',                sets: 3, reps: '12–15', rest: 60,  alternatives: ['DB Fly', 'Band Fly'] }],
  back:       [{ name: 'Barbell Row',              sets: 4, reps: '6–8',   rest: 120, alternatives: ['DB Row', 'Machine Row'] },
               { name: 'Lat Pulldown',             sets: 3, reps: '10–12', rest: 90,  alternatives: ['Band Lat Pulldown', 'Assisted Pull-up'] },
               { name: 'Cable Row',                sets: 3, reps: '12–15', rest: 60,  alternatives: ['DB Row', 'Resistance Band Row'] }],
  shoulders:  [{ name: 'Overhead Barbell Press',  sets: 4, reps: '6–8',   rest: 120, alternatives: ['DB Shoulder Press', 'Pike Push-up'] },
               { name: 'Lateral Raise',            sets: 3, reps: '15–20', rest: 60,  alternatives: ['Cable Lateral Raise', 'Band Lateral Raise'] },
               { name: 'Face Pull',                sets: 3, reps: '15–20', rest: 60,  alternatives: ['Band Face Pull', 'Rear Delt Fly'] }],
  biceps:     [{ name: 'EZ Bar Curl',              sets: 3, reps: '10–12', rest: 60,  alternatives: ['DB Curl', 'Band Curl'] },
               { name: 'Hammer Curl',              sets: 3, reps: '10–12', rest: 60,  alternatives: ['Cross-body Hammer Curl', 'Rope Hammer Curl'] }],
  triceps:    [{ name: 'Triceps Pushdown',         sets: 3, reps: '12–15', rest: 60,  alternatives: ['Band Pushdown', 'DB Kickback'] },
               { name: 'Overhead Triceps Ext.',    sets: 3, reps: '12–15', rest: 60,  alternatives: ['DB Overhead Ext.', 'Band Overhead Ext.'] }],
  quads:      [{ name: 'Barbell Back Squat',       sets: 4, reps: '6–8',   rest: 180, alternatives: ['Goblet Squat', 'Bodyweight Squat'] },
               { name: 'Leg Press',                sets: 3, reps: '10–12', rest: 120, alternatives: ['Bulgarian Split Squat', 'Step-up'] },
               { name: 'Leg Extension',            sets: 3, reps: '12–15', rest: 60,  alternatives: ['Wall Sit', 'Spanish Squat'] }],
  hamstrings: [{ name: 'Romanian Deadlift',        sets: 4, reps: '8–10',  rest: 120, alternatives: ['Single-leg RDL', 'Good Morning'] },
               { name: 'Lying Leg Curl',           sets: 3, reps: '10–12', rest: 60,  alternatives: ['Nordic Curl', 'Band Leg Curl'] }],
  glutes:     [{ name: 'Hip Thrust',               sets: 4, reps: '8–12',  rest: 90,  alternatives: ['Glute Bridge', 'Single-leg Glute Bridge'] },
               { name: 'Bulgarian Split Squat',    sets: 3, reps: '10/leg', rest: 90, alternatives: ['Reverse Lunge', 'Step-up'] }],
  calves:     [{ name: 'Standing Calf Raise',      sets: 4, reps: '15–20', rest: 45,  alternatives: ['Single-leg Calf Raise', 'Seated Calf Raise'] }],
  core:       [{ name: 'Plank',                    sets: 3, reps: '45–60s', rest: 45, alternatives: ['Dead Bug', 'Bear Crawl Hold'] },
               { name: 'Ab Wheel Rollout',         sets: 3, reps: '10–12', rest: 60,  alternatives: ['Hollow Hold', 'V-Up'] }]
};

function buildWorkoutDay(dayLabel, focus, muscleGroups, gymAccess) {
  const isLowEquip = ['none', 'bodyweight', 'home', 'minimal'].some(t =>
    String(gymAccess || '').toLowerCase().includes(t)
  );

  const exercises = muscleGroups.flatMap(mg => {
    const lib = EXERCISE_LIBRARY[mg] || [];
    return lib.slice(0, 2).map(ex => ({
      ...ex,
      tempo: '2-0-2',
      notes: isLowEquip ? `Use alternatives if barbell unavailable.` : '',
      reps: String(ex.reps)
    }));
  }).slice(0, 6);

  return {
    dayLabel,
    focus,
    warmup: [
      { name: 'Joint circles & mobility', duration: '5 min' },
      { name: 'Light cardio (bike/treadmill)', duration: '5 min' }
    ],
    exercises,
    cooldown: 'Static stretch 5–10 min focusing on muscles trained today.'
  };
}

function buildPplSplit(days, gymAccess) {
  const template = [
    { label: 'Push Day A', focus: 'Chest, Shoulders, Triceps', muscles: ['chest', 'shoulders', 'triceps'] },
    { label: 'Pull Day A', focus: 'Back, Biceps', muscles: ['back', 'biceps'] },
    { label: 'Legs Day A', focus: 'Quads, Hamstrings, Glutes, Calves', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    { label: 'Push Day B', focus: 'Shoulders, Chest, Triceps', muscles: ['shoulders', 'chest', 'triceps'] },
    { label: 'Pull Day B', focus: 'Back, Biceps, Core', muscles: ['back', 'biceps', 'core'] },
    { label: 'Legs Day B', focus: 'Hamstrings, Glutes, Quads, Core', muscles: ['hamstrings', 'glutes', 'quads', 'core'] }
  ];
  return template.slice(0, days).map(t => buildWorkoutDay(t.label, t.focus, t.muscles, gymAccess));
}

function buildUpperLowerSplit(days, gymAccess) {
  const template = [
    { label: 'Upper A', focus: 'Chest, Back, Shoulders', muscles: ['chest', 'back', 'shoulders'] },
    { label: 'Lower A', focus: 'Quads, Hamstrings, Glutes', muscles: ['quads', 'hamstrings', 'glutes'] },
    { label: 'Upper B', focus: 'Back, Chest, Arms', muscles: ['back', 'chest', 'biceps', 'triceps'] },
    { label: 'Lower B', focus: 'Hamstrings, Glutes, Calves', muscles: ['hamstrings', 'glutes', 'calves'] }
  ];
  return template.slice(0, days).map(t => buildWorkoutDay(t.label, t.focus, t.muscles, gymAccess));
}

function buildFullBodySplit(days, gymAccess) {
  const template = [
    { label: 'Full Body A', focus: 'Compound lower + push', muscles: ['quads', 'chest', 'back', 'core'] },
    { label: 'Full Body B', focus: 'Compound lower + pull', muscles: ['hamstrings', 'glutes', 'back', 'biceps'] },
    { label: 'Full Body C', focus: 'Upper focus + core', muscles: ['chest', 'shoulders', 'triceps', 'core'] }
  ];
  return template.slice(0, days).map(t => buildWorkoutDay(t.label, t.focus, t.muscles, gymAccess));
}

export function buildRuleBasedWorkoutPlan(profile) {
  const days = Number(profile.workout_days) || 4;
  const pref = String(profile.workout_preference || '').toLowerCase();
  const gymAccess = String(profile.gym_access || 'full gym');

  let workoutDays;
  let splitName;

  if (pref.includes('upper') || pref.includes('lower')) {
    workoutDays = buildUpperLowerSplit(days, gymAccess);
    splitName = 'Upper / Lower Split';
  } else if (pref.includes('full')) {
    workoutDays = buildFullBodySplit(days, gymAccess);
    splitName = 'Full Body';
  } else {
    workoutDays = buildPplSplit(days, gymAccess);
    splitName = 'Push / Pull / Legs';
  }

  return {
    programName: `ForgeAI ${splitName} Program`,
    split: splitName,
    daysPerWeek: days,
    progressionRule: 'Add 2.5kg or 1–2 reps each week. When top of rep range is hit for all sets, increase load.',
    deloadNote: 'Every 4–6 weeks, reduce load by 40% and volume by 30% for one week.',
    days: workoutDays,
    coachNote: `${days}-day ${splitName} program built for ${String(profile.goal || 'general fitness').replace('_', ' ')}. Track your lifts and aim for progressive overload each session.`
  };
}

// Legacy export
export function buildRuleBasedPlan(profile) {
  return {
    meal: buildRuleBasedMealPlan(profile),
    workout: buildRuleBasedWorkoutPlan(profile)
  };
}
