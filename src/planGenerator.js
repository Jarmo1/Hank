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

function pickWorkoutTemplate(workoutDays) {
  if (workoutDays <= 3) {
    return [
      {
        day: 'Day 1',
        focus: 'Full Body Strength',
        mainLifts: ['Back Squat 4x5', 'Bench Press 4x6', 'Barbell Row 4x8'],
        accessories: ['Walking Lunges 3x10', 'Plank 3x45s'],
        conditioning: '10-15 minutes low-impact intervals'
      },
      {
        day: 'Day 2',
        focus: 'Full Body Hypertrophy',
        mainLifts: ['Romanian Deadlift 4x8', 'Incline DB Press 4x10', 'Lat Pulldown 4x10'],
        accessories: ['Hip Thrust 3x12', 'Lateral Raises 3x15'],
        conditioning: '20 minutes zone 2 cardio'
      },
      {
        day: 'Day 3',
        focus: 'Conditioning + Accessories',
        mainLifts: ['Goblet Squat 4x10', 'Push-ups 4xAMRAP', 'Single-arm Row 4x12'],
        accessories: ['Cable Face Pull 3x15', 'Farmer Carry 4 rounds'],
        conditioning: '6x1 minute hard/2 minute easy intervals'
      }
    ];
  }

  if (workoutDays === 4) {
    return [
      {
        day: 'Day 1',
        focus: 'Upper Strength',
        mainLifts: ['Bench Press 5x5', 'Weighted Pull-up 4x6'],
        accessories: ['Seated Row 3x10', 'Triceps Pressdown 3x12'],
        conditioning: '10 minute incline walk'
      },
      {
        day: 'Day 2',
        focus: 'Lower Strength',
        mainLifts: ['Back Squat 5x5', 'Deadlift 4x4'],
        accessories: ['Leg Curl 3x12', 'Calf Raise 3x15'],
        conditioning: '10 minute bike flush'
      },
      {
        day: 'Day 3',
        focus: 'Upper Hypertrophy',
        mainLifts: ['Incline DB Press 4x10', 'Chest Supported Row 4x10'],
        accessories: ['Lateral Raise 3x15', 'Biceps Curl 3x12'],
        conditioning: '15 minute rower steady pace'
      },
      {
        day: 'Day 4',
        focus: 'Lower Hypertrophy + Conditioning',
        mainLifts: ['Front Squat 4x8', 'Romanian Deadlift 4x10'],
        accessories: ['Walking Lunge 3x12', 'Core Circuit 3 rounds'],
        conditioning: '8 rounds sled push or 30/30 bike'
      }
    ];
  }

  return [
    {
      day: 'Day 1',
      focus: 'Push',
      mainLifts: ['Bench Press 5x5', 'Overhead Press 4x6'],
      accessories: ['Dips 3xAMRAP', 'Triceps Extension 3x12'],
      conditioning: '10 minute bike'
    },
    {
      day: 'Day 2',
      focus: 'Pull',
      mainLifts: ['Weighted Pull-up 5x5', 'Barbell Row 4x8'],
      accessories: ['Face Pull 3x15', 'Hammer Curl 3x12'],
      conditioning: '10 minute row'
    },
    {
      day: 'Day 3',
      focus: 'Legs',
      mainLifts: ['Back Squat 5x5', 'Romanian Deadlift 4x8'],
      accessories: ['Leg Press 3x12', 'Calf Raise 4x15'],
      conditioning: '10 minute incline walk'
    },
    {
      day: 'Day 4',
      focus: 'Upper Power + Volume',
      mainLifts: ['Bench Press 6x3', 'Pendlay Row 5x5'],
      accessories: ['Incline DB Press 3x12', 'Lat Pulldown 3x12'],
      conditioning: 'Battle rope intervals 8 rounds'
    },
    {
      day: 'Day 5',
      focus: 'Lower + Conditioning',
      mainLifts: ['Front Squat 4x6', 'Hip Thrust 4x8'],
      accessories: ['Bulgarian Split Squat 3x10', 'Ab Wheel 3x12'],
      conditioning: '15-20 minute zone 2 bike'
    },
    {
      day: 'Day 6',
      focus: 'Active Recovery',
      mainLifts: ['Mobility Flow 20 min', 'Bodyweight Circuit 3 rounds'],
      accessories: ['Band Work', 'Deep Stretching'],
      conditioning: 'Long walk 45-60 minutes'
    }
  ];
}

function mealIdeas(dietaryPreferences = '') {
  const isVegetarian = dietaryPreferences.toLowerCase().includes('vegetarian');
  if (isVegetarian) {
    return [
      'Greek yogurt + oats + berries + nuts',
      'Tofu stir-fry with rice and mixed vegetables',
      'Lentil pasta with tomato sauce and side salad',
      'Protein smoothie with banana, spinach, and soy milk'
    ];
  }

  return [
    'Egg scramble + toast + fruit',
    'Chicken rice bowl with mixed vegetables and avocado',
    'Salmon, sweet potato, and broccoli',
    'Lean beef burrito bowl with beans and salsa'
  ];
}

export function buildRuleBasedPlan(profile) {
  const bmr = calculateBmr(profile);
  const tdee = Math.round(bmr * activityMultiplier(profile.activityLevel));
  const targetCalories = caloriesForGoal(tdee, profile.goal);
  const macros = macroSplit(profile.goal, targetCalories);
  const weeklySchedule = pickWorkoutTemplate(profile.workoutDays).slice(0, profile.workoutDays);

  return {
    summary: `Comprehensive plan for ${profile.fullName} with auto-regeneration when profile changes.`,
    nutrition: {
      targetCalories,
      macros,
      hydrationLiters: 2.5,
      mealIdeas: mealIdeas(profile.dietaryPreferences),
      mealStructure: [
        { meal: 'Breakfast', targetProtein: 35, note: 'Protein + fiber first meal.' },
        { meal: 'Lunch', targetProtein: 40, note: 'Largest carb meal near training window.' },
        { meal: 'Dinner', targetProtein: 35, note: 'Balanced plate and vegetables.' },
        { meal: 'Snack', targetProtein: 25, note: 'High protein snack to hit daily target.' }
      ],
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
