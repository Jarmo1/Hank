import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { initDb } from './db.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import plansRouter from './routes/plans.js';
import trackingRouter from './routes/tracking.js';
import workoutsRouter from './routes/workouts.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.set('trust proxy', 1);
// API responses are user-specific (cookie-auth) and must never be cached.
// Disabling ETags avoids 304 responses that can break JSON fetch flows.
app.set('etag', false);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
// Keep static asset caching behaviour handled by express.static.
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: true }));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/profile', apiLimiter, profileRouter);
app.use('/api/plans', apiLimiter, plansRouter);
app.use('/api/tracking', apiLimiter, trackingRouter);
app.use('/api/workouts', apiLimiter, workoutsRouter);

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(port, () => console.log(`ForgeAI running on port ${port}`));
  })
  .catch((err) => {
    console.error('DB init failed:', err);
    process.exit(1);
  });
