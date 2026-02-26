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
      'Day 1: Full Body Strength (Squat, Bench, Row, Core)',
      'Day 2: Full Body Hypertrophy (Deadlift variation, Incline Press, Pulldown, Lunges)',
      'Day 3: Conditioning + Accessory (Intervals, Shoulder/Arm accessories, Mobility)'
    ];
  }

  if (workoutDays === 4) {
    return [
      'Day 1: Upper Strength',
      'Day 2: Lower Strength',
      'Day 3: Upper Hypertrophy',
      'Day 4: Lower Hypertrophy + Conditioning'
    ];
  }

  return [
    'Day 1: Push',
    'Day 2: Pull',
    'Day 3: Legs',
    'Day 4: Upper (Power + Volume)',
    'Day 5: Lower + Conditioning',
    'Day 6: Optional Active Recovery'
  ];
}

export function buildRuleBasedPlan(profile) {
  const bmr = calculateBmr(profile);
  const tdee = Math.round(bmr * activityMultiplier(profile.activityLevel));
  const targetCalories = caloriesForGoal(tdee, profile.goal);
  const macros = macroSplit(profile.goal, targetCalories);

  return {
    summary: `Personalized plan for ${profile.fullName} focused on ${profile.goal.replace('_', ' ')}`,
    nutrition: {
      targetCalories,
      macros,
      hydrationLiters: 2.5,
      tips: [
        'Eat 25-40g protein per meal, 3-5 meals/day.',
        'Center carbs around training windows for performance and recovery.',
        'Use mostly whole-food meals and 80/20 flexibility to stay consistent.'
      ]
    },
    training: {
      weeklySchedule: pickWorkoutTemplate(profile.workoutDays).slice(0, profile.workoutDays),
      progression: 'Aim to add 1-2 reps or 1-2.5kg weekly on primary lifts while form remains strict.',
      cardio: profile.goal === 'fat_loss' ? '2-4 sessions/week 20-30 min zone 2 or intervals.' : '1-2 light sessions/week for health and recovery.'
    },
    recovery: {
      sleepHours: '7-9 hours nightly',
      deload: 'Every 6-8 weeks reduce volume by 30-40% for one week.',
      stressManagement: ['Walk daily 8k-10k steps', 'Stretch 10 minutes after sessions']
    }
  };
}
