import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = apiKey ? new OpenAI({ apiKey }) : null;

function promptForProfile(profile) {
  return `You are an elite fitness and nutrition coach. Return VALID JSON only.

User profile:
${JSON.stringify(profile, null, 2)}

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
`;
}

export async function generateAiPlan(profile) {
  if (!client) return null;

  const response = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: 'system', content: 'You create safe personalized training and nutrition plans.' },
      { role: 'user', content: promptForProfile(profile) }
    ],
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  return JSON.parse(content);
}
