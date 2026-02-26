function calculateBmr(profile) {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

function activityMultiplier(level) {
  const table = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9
  };

  return table[level] ?? 1.55;
}

function caloriesForGoal(tdee, goal) {
  if (goal === 'fat_loss') return Math.round(tdee - 400);
  if (goal === 'muscle_gain') return Math.round(tdee + 300);
  return Math.round(tdee);
}

function macroSplit(goal, calories) {
  const templates = {
    fat_loss: { protein: 0.35, carbs: 0.3, fats: 0.35 },
    muscle_gain: { protein: 0.3, carbs: 0.45, fats: 0.25 },
    recomposition: { protein: 0.33, carbs: 0.37, fats: 0.3 },
    maintenance: { protein: 0.3, carbs: 0.4, fats: 0.3 }
  };

  const split = templates[goal] ?? templates.maintenance;

  return {
    proteinGrams: Math.round((calories * split.protein) / 4),
    carbsGrams: Math.round((calories * split.carbs) / 4),
    fatsGrams: Math.round((calories * split.fats) / 9)
  };
}

const exerciseLibrary = {
  chest: ['Bench Press 4x6', 'Incline DB Press 3x10', 'Cable Fly 3x12'],
  back: ['Barbell Row 4x8', 'Lat Pulldown 3x10', 'Chest Supported Row 3x12'],
  shoulders: ['Overhead Press 4x6', 'Lateral Raise 3x15', 'Face Pull 3x15'],
  biceps: ['EZ Bar Curl 3x12', 'Hammer Curl 3x12'],
  triceps: ['Triceps Pressdown 3x12', 'Overhead Triceps Extension 3x12'],
  quads: ['Back Squat 4x6', 'Leg Press 3x12', 'Walking Lunge 3x10/leg'],
  hamstrings: ['Romanian Deadlift 4x8', 'Leg Curl 3x12'],
  glutes: ['Hip Thrust 4x8', 'Bulgarian Split Squat 3x10/leg'],
  calves: ['Standing Calf Raise 4x15'],
  core: ['Plank 3x45s', 'Ab Wheel 3x10']
};

function withEquipmentFallback(exercises, equipmentAccess = '') {
  const lowEquipment = ['none', 'bodyweight', 'home', 'minimal'].some((term) =>
    equipmentAccess.toLowerCase().includes(term)
  );

  if (!lowEquipment) return exercises;

  const substitutions = {
    'Bench Press 4x6': 'Push-up Variations 4xAMRAP',
    'Incline DB Press 3x10': 'Feet-Elevated Push-up 3x12',
    'Cable Fly 3x12': 'Resistance Band Fly 3x15',
    'Barbell Row 4x8': 'Backpack Row 4x12',
    'Lat Pulldown 3x10': 'Band Lat Pulldown 3x15',
    'Chest Supported Row 3x12': 'Single-arm DB/Backpack Row 3x12',
    'Overhead Press 4x6': 'Pike Push-up 4x10',
    'Back Squat 4x6': 'Goblet Squat 4x10',
    'Leg Press 3x12': 'Split Squat 3x12',
    'Romanian Deadlift 4x8': 'Single-leg RDL 4x10',
    'Hip Thrust 4x8': 'Glute Bridge 4x15',
    'Standing Calf Raise 4x15': 'Single-leg Calf Raise 4x20'
  };

  return exercises.map((exercise) => substitutions[exercise] ?? exercise);
}

function createTrainingDay(dayNumber, focus, muscles, equipmentAccess, conditioning) {
  const primaryPool = muscles.flatMap((muscle) => exerciseLibrary[muscle] || []);
  const mainLifts = primaryPool.slice(0, 3);
  const accessoryPool = primaryPool.slice(3);

  if (/core/i.test(focus)) {
    accessoryPool.push(...(exerciseLibrary.core || []));
  }

  if (/calves/i.test(focus)) {
    accessoryPool.push(...(exerciseLibrary.calves || []));
  }

  return {
    day: `Day ${dayNumber}`,
    focus,
    mainLifts: withEquipmentFallback(mainLifts, equipmentAccess),
    accessories: withEquipmentFallback(accessoryPool.slice(0, 2), equipmentAccess),
    conditioning
  };
}

function workoutSplit(workoutDays, equipmentAccess = '') {
  if (workoutDays <= 3) {
    return [
      createTrainingDay(1, 'Chest + Back', ['chest', 'back'], equipmentAccess, '10-15 min zone 2 bike or incline walk'),
      createTrainingDay(2, 'Legs + Core', ['quads', 'hamstrings', 'glutes'], equipmentAccess, '8 rounds of 30s hard / 60s easy'),
      createTrainingDay(3, 'Shoulders + Arms', ['shoulders', 'biceps', 'triceps'], equipmentAccess, '10 min low-impact cardio cooldown')
    ].slice(0, workoutDays);
  }

  if (workoutDays === 4) {
    return [
      createTrainingDay(1, 'Chest + Biceps', ['chest', 'biceps'], equipmentAccess, '10 min incline walk'),
      createTrainingDay(2, 'Back + Triceps', ['back', 'triceps'], equipmentAccess, '10 min rower flush'),
      createTrainingDay(3, 'Quads + Calves', ['quads', 'calves'], equipmentAccess, '12 min zone 2 bike'),
      createTrainingDay(4, 'Hamstrings + Glutes + Shoulders', ['hamstrings', 'glutes', 'shoulders'], equipmentAccess, '6 rounds sled push or brisk intervals')
    ];
  }

  return [
    createTrainingDay(1, 'Push (Chest + Shoulders + Triceps)', ['chest', 'shoulders', 'triceps'], equipmentAccess, '8-10 min easy cardio'),
    createTrainingDay(2, 'Pull (Back + Biceps)', ['back', 'biceps'], equipmentAccess, '10 min row'),
    createTrainingDay(3, 'Legs (Quads + Hamstrings + Calves)', ['quads', 'hamstrings', 'calves'], equipmentAccess, '10 min incline walk'),
    createTrainingDay(4, 'Chest + Back Volume', ['chest', 'back'], equipmentAccess, '12 min zone 2'),
    createTrainingDay(5, 'Glutes + Shoulders + Arms', ['glutes', 'shoulders', 'biceps', 'triceps'], equipmentAccess, '10 min mixed intervals'),
    {
      day: 'Day 6',
      focus: 'Active Recovery',
      mainLifts: ['Mobility Flow 20 min', 'Bodyweight Circuit 3 rounds'],
      accessories: ['Band Pull Aparts 3x20', 'Deep Stretching 10 min'],
      conditioning: 'Long walk 45-60 minutes'
    }
  ].slice(0, workoutDays);
}

function mealIdeas(dietaryPreferences = '', targetCalories = 2200) {
  const isVegetarian = dietaryPreferences.toLowerCase().includes('vegetarian');
  const mealTargets = {
    breakfast: Math.round(targetCalories * 0.25),
    lunch: Math.round(targetCalories * 0.3),
    dinner: Math.round(targetCalories * 0.3),
    snack: Math.round(targetCalories * 0.15)
  };

  if (isVegetarian) {
    return [
      `Breakfast (~${mealTargets.breakfast} kcal): Greek yogurt + oats + berries + nuts`,
      `Lunch (~${mealTargets.lunch} kcal): Tofu stir-fry with rice and mixed vegetables`,
      `Dinner (~${mealTargets.dinner} kcal): Lentil pasta with tomato sauce and side salad`,
      `Snack (~${mealTargets.snack} kcal): Protein smoothie with banana, spinach, and soy milk`
    ];
  }

  return [
    `Breakfast (~${mealTargets.breakfast} kcal): Egg scramble + toast + fruit`,
    `Lunch (~${mealTargets.lunch} kcal): Chicken rice bowl with mixed vegetables and avocado`,
    `Dinner (~${mealTargets.dinner} kcal): Salmon, sweet potato, and broccoli`,
    `Snack (~${mealTargets.snack} kcal): Lean beef wrap or Greek yogurt + granola`
  ];
}

function mealStructureFromMacros(macros) {
  return [
    { meal: 'Breakfast', targetProtein: Math.round(macros.proteinGrams * 0.25), note: 'Protein + fiber first meal.' },
    { meal: 'Lunch', targetProtein: Math.round(macros.proteinGrams * 0.3), note: 'Largest carb meal near training window.' },
    { meal: 'Dinner', targetProtein: Math.round(macros.proteinGrams * 0.3), note: 'Balanced plate and vegetables.' },
    { meal: 'Snack', targetProtein: Math.round(macros.proteinGrams * 0.15), note: 'High protein snack to hit daily target.' }
  ];
}

export function buildRuleBasedPlan(profile) {
  const bmr = calculateBmr(profile);
  const tdee = Math.round(bmr * activityMultiplier(profile.activityLevel));
  const targetCalories = caloriesForGoal(tdee, profile.goal);
  const macros = macroSplit(profile.goal, targetCalories);
  const weeklySchedule = workoutSplit(profile.workoutDays, profile.equipmentAccess);

  return {
    summary: `Personalized ${profile.goal.replace('_', ' ')} plan for ${profile.fullName} (${profile.workoutDays} training days/week), aligned to profile inputs and constraints.`,
    nutrition: {
      targetCalories,
      macros,
      hydrationLiters: 2.5,
      mealIdeas: mealIdeas(profile.dietaryPreferences, targetCalories),
      mealStructure: mealStructureFromMacros(macros),
      groceryList: ['Lean protein source', 'Fruit + vegetables', 'Whole grains', 'Healthy fats', 'Hydration/electrolytes']
    },
    activity: {
      weeklySchedule,
      cardio: profile.goal === 'fat_loss' ? '3 sessions/week of 20-30 min zone 2 or intervals.' : '1-2 sessions/week zone 2 for recovery and heart health.',
      stepTarget: profile.goal === 'fat_loss' ? '9,000-12,000 steps/day' : '7,000-10,000 steps/day',
      progression: 'Progress by adding reps, load, or execution quality weekly while keeping 1-2 reps in reserve.'
    },
    bodyMetrics: {
      targetRate: profile.goal === 'fat_loss' ? '-0.3kg to -0.7kg per week' : profile.goal === 'muscle_gain' ? '+0.15kg to +0.35kg per week' : 'Weight stable ±0.2kg',
      checkInDays: ['Monday morning weigh-in', 'Thursday waist measurement', 'Sunday weekly review'],
      adjustmentRules: ['If scale trend stalls for 14 days, adjust calories by ±150.', 'If recovery drops, reduce volume by 15-20% for 1 week.']
    },
    recovery: {
      sleepHours: '7-9 hours nightly',
      deload: 'Every 6-8 weeks reduce volume by 30-40% for one week.',
      stressManagement: ['Walk daily 8k-10k steps', 'Stretch 10 minutes after sessions', '2 rest rituals daily (breathwork/journaling)']
    },
    foodLoggerTemplate: {
      dailyTargets: {
        calories: targetCalories,
        proteinGrams: macros.proteinGrams,
        carbsGrams: macros.carbsGrams,
        fatsGrams: macros.fatsGrams
      },
      prompts: ['Meal + portion', 'Protein grams estimate', 'Hunger/satiety (1-10)', 'Energy level (1-10)']
    }
  };
}
