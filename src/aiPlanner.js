import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = apiKey ? new OpenAI({ apiKey }) : null;

function promptForProfile(profile) {
  return `You are an elite fitness and nutrition coach. Return valid JSON only with keys: summary, nutrition, training, recovery.

User profile:
${JSON.stringify(profile, null, 2)}

Requirements:
- nutrition must include targetCalories, macros (proteinGrams, carbsGrams, fatsGrams), mealIdeas array.
- training must include weeklySchedule array, cardio, progression.
- recovery must include sleepHours, stressManagement array.
- Keep recommendations realistic and safe.
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
