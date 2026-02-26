# GymPlan AI (Web + PWA)

This project is a full-stack app that collects user body metrics, goals, activity level, and constraints, then generates a personalized **workout + nutrition + recovery plan**.

- Uses **AI plan generation** when `OPENAI_API_KEY` is available.
- Falls back to a safe **rule-based engine** when AI is unavailable.
- Persists profiles/plans to **PostgreSQL** (Railway-compatible).
- Works as both a web app and installable phone app (PWA-style).

## Stack

- Node.js + Express API/server
- PostgreSQL via `pg`
- Vanilla JS frontend (mobile responsive)
- OpenAI API (optional)

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default `3000`) |
| `DATABASE_URL` | Optional* | Postgres connection string. If unset, app still runs but no persistence. |
| `OPENAI_API_KEY` | Optional | If set, app uses AI planner first. |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini`. |

## API

### `POST /api/plan`

Input JSON:

```json
{
  "fullName": "Jane Doe",
  "age": 29,
  "sex": "female",
  "weightKg": 67,
  "heightCm": 168,
  "goal": "muscle_gain",
  "activityLevel": "moderate",
  "workoutDays": 4,
  "dietaryPreferences": "vegetarian",
  "equipmentAccess": "full gym",
  "injuries": "none",
  "notes": "prefers 45 min sessions"
}
```

### `GET /api/plans`
Returns recent generated plans from DB.

## Deploying to Railway

1. Push this repo to GitHub.
2. In Railway, create a new project from the repo.
3. Add a **PostgreSQL** service in Railway.
4. In app service variables, set:
   - `DATABASE_URL` (from PostgreSQL service)
   - `OPENAI_API_KEY` (optional but recommended)
   - `OPENAI_MODEL` (optional)
5. Railway will run `npm install` and `npm start` automatically.

## Notes

- This is not medical advice.
- For chronic injuries or disease, users should consult qualified health professionals.
