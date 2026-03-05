import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 20000);

const client = apiKey ? new OpenAI({ apiKey }) : null;

async function callAI(systemPrompt, userPrompt) {
  if (!client) return null;
  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    }, { timeout: timeoutMs });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err) {
    console.warn('AI call failed, using rule-based fallback:', err?.message || err);
    return null;
  }
}

export async function generateMealPlan(profile) {
  const system = `You are an expert dietitian. Return VALID JSON only. Use Australian grocery terms and metric units (grams, mL). Do not prescribe unsafe calorie deficits.`;

  const user = `Generate a 7-day personalised meal plan. Return JSON with EXACTLY this schema:
{
  "dailyTargets": {
    "calories": number,
    "proteinGrams": number,
    "carbsGrams": number,
    "fatsGrams": number,
    "fibreGrams": number,
    "waterMl": number
  },
  "days": [
    {
      "day": "Monday",
      "totalCalories": number,
      "meals": [
        {
          "type": "breakfast",
          "name": string,
          "calories": number,
          "proteinGrams": number,
          "carbsGrams": number,
          "fatsGrams": number,
          "ingredients": [{"item": string, "amount": string}],
          "instructions": [string],
          "prepMinutes": number,
          "cookMinutes": number,
          "servings": number,
          "batchCook": boolean
        }
      ]
    }
  ],
  "shoppingList": [
    {"category": "Produce", "item": string, "quantity": string}
  ],
  "coachNote": string
}

User profile:
- Goal: ${profile.goal}
- Weight: ${profile.weight_kg}kg | Height: ${profile.height_cm}cm | Age: ${profile.age}
- Sex: ${profile.sex || 'not specified'}
- Activity level: ${profile.activity_level}
- Diet type: ${profile.diet_type || 'standard'}
- Allergies/intolerances: ${profile.allergies || 'none'}
- Dislikes: ${profile.dislikes || 'none'}
- Meals per day: ${profile.meals_per_day || 3}
- Cooking preference: ${profile.cooking_preference || 'normal meals'}

Safety: minimum 1200 kcal for women, 1500 kcal for men. Realistic Australian grocery ingredients.`;

  return callAI(system, user);
}

export async function generateWorkoutPlan(profile) {
  const system = `You are an expert strength and conditioning coach. Return VALID JSON only. Programs must be safe and realistic.`;

  const user = `Generate a structured workout program. Return JSON with EXACTLY this schema:
{
  "programName": string,
  "split": string,
  "daysPerWeek": number,
  "progressionRule": string,
  "deloadNote": string,
  "days": [
    {
      "dayLabel": string,
      "focus": string,
      "warmup": [{"name": string, "duration": string}],
      "exercises": [
        {
          "name": string,
          "sets": number,
          "reps": string,
          "restSeconds": number,
          "tempo": string,
          "notes": string,
          "alternatives": [string]
        }
      ],
      "cooldown": string
    }
  ],
  "coachNote": string
}

User profile:
- Goal: ${profile.goal}
- Training days/week: ${profile.workout_days || 4}
- Gym access: ${profile.gym_access || 'full gym'}
- Workout preference: ${profile.workout_preference || 'push pull legs'}
- Injuries/limitations: ${profile.injuries || 'none'}
- Activity level: ${profile.activity_level}

Rules: days array length MUST equal workout_days. Respect equipment and injuries. Include exercise alternatives for every exercise.`;

  return callAI(system, user);
}

// Legacy export for backward compatibility
export async function generateAiPlan(profile) {
  const [meal, workout] = await Promise.all([
    generateMealPlan(profile),
    generateWorkoutPlan(profile)
  ]);
  if (!meal && !workout) return null;
  return { meal, workout };
}
