# Hank — Couples meal plan, shopping list & reminders

A lightweight PWA for a household: meal plan with two portion sizes (cutting + gaining), tickable shopping list, Pilates and meal reminders that push to your phone.

Built on the existing Node/Express + Postgres backend, with a light-themed mobile-first frontend you save to your home screen.

## Features

- **Couples meal plan** — same meals, Her and Him portions, editable per meal.
- **Weekly rollover** — duplicate this week or hit “Surprise me” for an AI-generated variation.
- **Shopping list** — auto-generates from the plan, plus manual items, with tick-off and “clear ticked”.
- **Schedule** — Pilates (Mon/Wed/Thu/Fri) and meal reminders, all editable.
- **Push notifications** — web-push to the installed PWA on iOS/Android/desktop.

## Stack

- Node.js + Express
- PostgreSQL (Railway-compatible)
- Vanilla JS PWA frontend (mobile responsive)
- `web-push` for VAPID push notifications
- OpenAI (optional, for “Surprise me” new-week generation)

## Local setup

```bash
npm install
cp .env.example .env
# Generate VAPID keys for push:
npx web-push generate-vapid-keys
# Paste the keys into .env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
npm run dev
```

Open http://localhost:3000 — sign up with one shared email. The household plan and default reminder schedule are seeded automatically on first sign-in.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default `3000`) |
| `DATABASE_URL` | Required for persistence | Postgres connection string. |
| `JWT_SECRET` | Recommended | Cookie/JWT secret. |
| `OPENAI_API_KEY` | Optional | Enables AI “Surprise me” week generation. |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini`. |
| `VAPID_PUBLIC_KEY` | Required for push | Generate with `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | Required for push | Same. |
| `VAPID_EMAIL` | Optional | `mailto:` contact for push providers. |

## Notifications

1. Generate VAPID keys (`npx web-push generate-vapid-keys`) and set them in `.env`.
2. Open the app in a browser, **add it to your home screen** (iOS Safari requires this).
3. Open the installed app → Settings → *Enable on this device*.
4. The server’s internal scheduler ticks every 60 seconds; it fires reminders during their local minute (5-min catch-up window).

## API (couples plan)

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/couples-plan`           | Current plan (seeds default if missing) |
| PUT    | `/api/couples-plan/meal`      | Edit `{ day, type, name, her[], him[] }` |
| POST   | `/api/couples-plan/next-week` | `{ mode: 'duplicate' \| 'surprise' }` |
| GET    | `/api/shopping`               | Current list + items |
| POST   | `/api/shopping/items`         | Add manual item |
| PATCH  | `/api/shopping/items/:id`     | Edit / toggle checked |
| DELETE | `/api/shopping/items/:id`     | Remove item |
| POST   | `/api/shopping/regenerate`    | Re-pull auto items from plan |
| POST   | `/api/shopping/clear-checked` | Remove ticked items |
| GET    | `/api/schedule`               | List reminders + timezone |
| POST   | `/api/schedule`               | Create reminder |
| PATCH  | `/api/schedule/:id`           | Edit reminder |
| DELETE | `/api/schedule/:id`           | Delete reminder |
| PUT    | `/api/schedule/timezone`      | `{ timezone }` |
| GET    | `/api/push/vapid`             | Public VAPID key |
| POST   | `/api/push/subscribe`         | Persist a PushSubscription |
| POST   | `/api/push/unsubscribe`       | Remove a PushSubscription |
| POST   | `/api/push/test`              | Send a test push |

## Notes

- Not medical advice. Adjust portions to suit; the seed plan is the starting point.
- iOS Safari only supports web push for PWAs installed to the home screen (iOS 16.4+).
