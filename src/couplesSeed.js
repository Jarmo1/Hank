// Default weekly couples meal plan, grocery template, and reminder schedule.
// One household account, same meal, two portion sizes (her cutting / him gaining).

const BREAKFAST = Object.freeze({
  type: 'breakfast',
  name: 'Greek Yoghurt + Granola',
  her: ['200g Greek yoghurt', '45g granola', '1 banana'],
  him: ['400g Greek yoghurt', '90g granola', '1 banana', '1 tbsp peanut butter']
});

const CHICKEN_RICE_LUNCH = Object.freeze({
  type: 'lunch',
  name: 'Chicken Rice Bowl',
  her: ['150g chicken thigh', '120g cooked rice', '1 cup vegetables'],
  him: ['300g chicken thigh', '300g cooked rice', '1-2 cups vegetables']
});

const TUNA_RICE_LUNCH = Object.freeze({
  type: 'lunch',
  name: 'Tuna Rice Bowl',
  her: ['1 tin tuna', '120g cooked rice'],
  him: ['2 tins tuna', '300g cooked rice']
});

const EGGS_TOAST_LUNCH = Object.freeze({
  type: 'lunch',
  name: 'Eggs on Toast',
  her: ['3 eggs', '2 slices toast'],
  him: ['5 eggs', '4 slices toast']
});

function makeDay(day, lunch, dinner, snacks) {
  return {
    day,
    meals: [
      { id: `${day}:breakfast`, ...BREAKFAST },
      { id: `${day}:lunch`, ...lunch },
      { id: `${day}:dinner`, ...dinner },
      { id: `${day}:snacks`, type: 'snacks', name: 'Snacks', her: snacks.her, him: snacks.him }
    ]
  };
}

export function buildDefaultCouplesPlan(weekStartDate = null) {
  return {
    weekStartDate,
    title: 'Couples Plan',
    subtitle: 'Same meals, two portions — Cut + Gain',
    her: { label: 'Her', goal: 'cutting', startWeightKg: 75, targetWeightKg: 65 },
    him: { label: 'Him', goal: 'muscle building' },
    days: [
      makeDay('monday',
        CHICKEN_RICE_LUNCH,
        { type: 'dinner', name: 'Tuna + Potatoes', her: ['1 tin tuna', '250g potatoes', 'vegetables'], him: ['2 tins tuna', '500g potatoes', 'vegetables', 'cheese sprinkle'] },
        { her: ['Apple', '2 boiled eggs'], him: ['4 boiled eggs', 'Peanut butter toast', 'Protein shake'] }
      ),
      makeDay('tuesday',
        CHICKEN_RICE_LUNCH,
        { type: 'dinner', name: 'Chicken Stir Fry', her: ['150g chicken', '120g cooked rice', 'vegetables'], him: ['300g chicken', '300g cooked rice', 'vegetables'] },
        { her: ['Greek yoghurt', 'Banana'], him: ['Greek yoghurt', 'Banana', 'Peanut butter toast'] }
      ),
      makeDay('wednesday',
        TUNA_RICE_LUNCH,
        { type: 'dinner', name: 'Eggs on Toast', her: ['3 eggs', '2 slices toast'], him: ['5 eggs', '4 slices toast'] },
        { her: ['Apple'], him: ['Apple', 'Protein shake', 'Peanut butter sandwich'] }
      ),
      makeDay('thursday',
        CHICKEN_RICE_LUNCH,
        { type: 'dinner', name: 'Beef Rice Bowls', her: ['125g lean beef mince', '120g cooked rice'], him: ['250g lean beef mince', '300g cooked rice'] },
        { her: ['2 boiled eggs', 'Banana'], him: ['4 boiled eggs', 'Banana', 'Peanut butter toast'] }
      ),
      makeDay('friday',
        TUNA_RICE_LUNCH,
        { type: 'dinner', name: 'Tuna Pasta', her: ['1 tin tuna', '100g cooked pasta'], him: ['2 tins tuna', '250g cooked pasta'] },
        { her: ['Greek yoghurt', 'Apple'], him: ['Greek yoghurt', 'Apple', 'Protein shake'] }
      ),
      makeDay('saturday',
        CHICKEN_RICE_LUNCH,
        { type: 'dinner', name: 'Loaded Potatoes', her: ['250g potatoes', '150g chicken'], him: ['500g potatoes', '300g chicken'] },
        { her: ['Popcorn', 'Banana'], him: ['Popcorn', 'Banana', 'Peanut butter toast'] }
      ),
      {
        day: 'sunday',
        meals: [
          { id: 'sunday:breakfast', ...BREAKFAST },
          { id: 'sunday:lunch', ...EGGS_TOAST_LUNCH },
          { id: 'sunday:dinner', type: 'dinner', name: 'Omelettes', her: ['4 eggs', 'vegetables', '1 slice toast'], him: ['6 eggs', 'vegetables', '3 slices toast', 'cheese'] },
          { id: 'sunday:snacks', type: 'snacks', name: 'Snacks', her: [], him: [] }
        ]
      }
    ],
    grocery: buildDefaultGrocery(),
    notes: 'Sunday cook-up: 2–3kg chicken, big rice batch, potatoes, boiled eggs. Stores all week.'
  };
}

export function buildDefaultGrocery() {
  return [
    { category: 'Protein', items: [
      { name: 'Chicken thigh', qty: '5–6 kg' },
      { name: 'Tuna (tins)', qty: '18–20 tins' },
      { name: 'Eggs', qty: '5 dozen' },
      { name: 'Lean beef mince', qty: '1 kg' },
      { name: 'Greek yoghurt (1 kg tubs)', qty: '5 tubs' },
      { name: 'Shredded cheese', qty: '2 bags' },
      { name: 'Protein powder', qty: '1 tub' }
    ]},
    { category: 'Carbs', items: [
      { name: 'Rice', qty: '5 kg bag' },
      { name: 'Pasta', qty: '1 kg' },
      { name: 'Wholemeal bread', qty: '4 loaves' },
      { name: 'Potatoes', qty: '7–8 kg' },
      { name: 'Granola / toasted muesli', qty: '4 bags' }
    ]},
    { category: 'Fruit', items: [
      { name: 'Bananas', qty: '20' },
      { name: 'Apples', qty: '10' }
    ]},
    { category: 'Vegetables', items: [
      { name: 'Frozen mixed vegetables', qty: '6 bags' },
      { name: 'Frozen stir-fry vegetables', qty: '3 bags' },
      { name: 'Frozen spinach', qty: '2 bags' }
    ]},
    { category: 'Extras', items: [
      { name: 'Peanut butter', qty: '1 jar' },
      { name: 'Soy sauce', qty: '1' },
      { name: 'Napoli sauce', qty: '1' },
      { name: 'Olive oil', qty: '1' },
      { name: 'Salt', qty: '1' },
      { name: 'Pepper', qty: '1' },
      { name: 'Garlic powder', qty: '1' }
    ]}
  ];
}

// Flat list for inserting into shopping_list_items.
export function groceryToShoppingItems(grocery) {
  const out = [];
  for (const section of grocery) {
    for (const item of section.items) {
      out.push({ category: section.category, name: item.name, qty: item.qty, source: 'auto' });
    }
  }
  return out;
}

// Default schedule. Days follow JS getDay(): 0=Sun, 1=Mon ... 6=Sat.
// Pilates: Mon, Wed, Thu, Fri at 07:00.
export function defaultScheduledEvents() {
  return [
    { kind: 'meal',    label: 'Breakfast', timeLocal: '08:00', daysOfWeek: [0,1,2,3,4,5,6], message: "Time for breakfast — yoghurt + granola" },
    { kind: 'meal',    label: 'Lunch',     timeLocal: '12:30', daysOfWeek: [0,1,2,3,4,5,6], message: "Lunch time — check today's bowl" },
    { kind: 'meal',    label: 'Snack',     timeLocal: '15:30', daysOfWeek: [0,1,2,3,4,5,6], message: "Snack time" },
    { kind: 'meal',    label: 'Dinner',    timeLocal: '18:30', daysOfWeek: [0,1,2,3,4,5,6], message: "Dinner — open the app for tonight's meal" },
    { kind: 'pilates', label: 'Pilates',   timeLocal: '07:00', daysOfWeek: [1,3,4,5],       message: "Pilates today — let's go" }
  ];
}

// Build a shallow variant of an existing plan (used by the AI "surprise me"
// fallback and as a base shape the AI conforms to).
export function planShape() {
  return buildDefaultCouplesPlan();
}
