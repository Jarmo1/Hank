import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const requestTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 12000);

const client = apiKey ? new OpenAI({ apiKey }) : null;

function promptForProfile(profile) {
  const variantHint = profile.planVariant
    ? `\nPlan variation request: ${profile.planVariant}`
    : '';

  return `You are an elite fitness and nutrition coach. Return VALID JSON only.

User profile:
${JSON.stringify(profile, null, 2)}
${variantHint}

Build a complete app-ready plan with this schema:
{
  "summary": string,
  "nutrition": {
    "targetCalories": number,
    "macros": { "proteinGrams": number, "carbsGrams": number, "fatsGrams": number },
    "hydrationLiters": number,
    "mealIdeas": string[],
    "mealStructure": [{ "meal": string, "targetProtein": number, "note": string }],
    "groceryList": string[]
  },
  "activity": {
    "weeklySchedule": [{ "day": string, "focus": string, "mainLifts": string[], "accessories": string[], "conditioning": string }],
    "cardio": string,
    "stepTarget": string,
    "progression": string
  },
  "bodyMetrics": {
    "targetRate": string,
    "checkInDays": string[],
    "adjustmentRules": string[]
  },
  "recovery": {
    "sleepHours": string,
    "deload": string,
    "stressManagement": string[]
  },
  "foodLoggerTemplate": {
    "dailyTargets": { "calories": number, "proteinGrams": number, "carbsGrams": number, "fatsGrams": number },
    "prompts": string[]
  }
}

Constraints:
- Keep recommendations realistic and safe.
- Respect injuries/limitations and equipment access.
- Weekly schedule length must match workoutDays.
- Make each training day muscle-group specific (e.g., Chest + Biceps), not generic random exercise lists.
- Use progressive overload-friendly exercise choices and include at least 2 main lifts per day.
- Meal ideas must align to targetCalories with rough per-meal calorie guidance.
- Ensure nutrition numbers are internally consistent (daily targets should approximately match macro calories).
- Produce a clearly fresh variant when a variation request is provided (different meals/exercise selections while still matching profile targets).
`;
}

export async function generateAiPlan(profile) {
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.4,
      timeout: requestTimeoutMs,
      messages: [
        { role: 'system', content: 'You create safe personalized training and nutrition plans.' },
        { role: 'user', content: promptForProfile(profile) }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.warn('AI plan generation failed; falling back to rule-based planner.', error?.message || error);
    return null;
  }
}
