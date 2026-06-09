// src/runPlan.js
// Deterministic ultra-marathon (default 50k) training plan generator.
// Builds a periodized, week-by-week plan from the athlete's constraints, then
// the app ticks sessions off as Strava runs come in. ESM, no external deps.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Monday-indexed

// ---- date helpers (Monday-based weeks) ----
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function isoDate(d) { return new Date(d).toISOString().slice(0, 10); }
function mondayOf(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  return addDays(d, -dow);
}
function weekdayOffset(name) { return WEEKDAYS.indexOf(name); } // 0..6 from Monday

// ---- pace model ----
function fmtPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return null;
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// Riegel endurance model: t2 = t1 * (d2/d1)^1.06
function riegel(t1Sec, d1Km, d2Km) { return t1Sec * Math.pow(d2Km / d1Km, 1.06); }

// Derive a full set of training paces (secs/km) from whatever fitness input we have.
export function derivePaces(fitness = {}) {
  let tenKpace;
  let basis = 'default';
  if (fitness.recentRace && fitness.recentRace.distanceKm > 0 && fitness.recentRace.timeSec > 0) {
    const pred10k = riegel(fitness.recentRace.timeSec, fitness.recentRace.distanceKm, 10);
    tenKpace = pred10k / 10;
    basis = `recent ${fitness.recentRace.distanceKm}km time`;
  } else if (fitness.easyPaceSec > 0) {
    tenKpace = fitness.easyPaceSec - 75; // easy ≈ 10k pace + 75s/km
    basis = 'stated easy pace';
  } else {
    tenKpace = 360; // 6:00/km fallback
    basis = 'default (no fitness data given)';
  }
  return {
    basis,
    anchor10kSecPerKm: Math.round(tenKpace),
    paces: {
      intervals: Math.round(tenKpace - 8),
      threshold: Math.round(tenKpace + 12),
      goal:      Math.round(tenKpace + 95),
      long:      Math.round(tenKpace + 82),
      easy:      Math.round(tenKpace + 75),
      recovery:  Math.round(tenKpace + 100)
    }
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round1(v) { return Math.round(v * 2) / 2; }

export function generatePlan(opts) {
  const {
    startDate = new Date(),
    raceDate,
    raceDistanceKm = 50,
    goal = 'finish',
    runDays = ['Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
    longRunDay = 'Sun',
    currentWeeklyKm = 0,
    longestRecentKm = 0,
    fitness = {}
  } = opts || {};

  if (!raceDate) throw new Error('raceDate is required');

  const planStart = mondayOf(startDate);
  let totalWeeks = Math.round((mondayOf(raceDate) - planStart) / (7 * 864e5)) + 1;
  totalWeeks = clamp(totalWeeks, 4, 40);

  const warnings = [];
  if (totalWeeks < 12) warnings.push(`Only ${totalWeeks} weeks to race — tight for a 50k. Plan is compressed; build conservatively and protect the long run.`);

  const days = Array.from(new Set(runDays)).filter((d) => WEEKDAYS.includes(d));
  if (days.length < 3) warnings.push('Fewer than 3 run days/week makes a 50k build hard. 4–5 is ideal.');
  const longDay = days.includes(longRunDay) ? longRunDay : days[days.length - 1];

  const { paces, basis, anchor10kSecPerKm } = derivePaces(fitness);

  const taperWeeks = totalWeeks >= 14 ? 3 : (totalWeeks >= 9 ? 2 : 1);
  const buildWeeks = totalWeeks - taperWeeks;

  const volStart = clamp(currentWeeklyKm || days.length * 7, 15, 120);
  const longStart = clamp(longestRecentKm || Math.max(10, volStart * 0.4), 8, 30);
  const longPeak = clamp(Math.round(raceDistanceKm * 0.68), 26, 42);
  const volPeak = clamp(Math.max(volStart * 1.5, longPeak / 0.42), volStart, 130);

  const phaseFor = (i) => {
    const frac = i / Math.max(1, buildWeeks - 1);
    if (i >= buildWeeks) return 'Taper';
    if (frac < 0.30) return 'Base';
    if (frac < 0.70) return 'Build';
    return 'Peak';
  };

  const weeks = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(planStart, i * 7);
    const phase = phaseFor(i);
    const inTaper = i >= buildWeeks;
    const isDeload = !inTaper && ((i + 1) % 4 === 0) && i < buildWeeks - 1;

    const p = buildWeeks > 1 ? clamp(i / (buildWeeks - 1), 0, 1) : 1;
    let weekKm = volStart + (volPeak - volStart) * p;
    let longKm = longStart + (longPeak - longStart) * p;

    if (isDeload) { weekKm *= 0.7; longKm *= 0.75; }

    if (inTaper) {
      const t = i - buildWeeks;
      const isRaceWeek = i === totalWeeks - 1;
      if (isRaceWeek) {
        weekKm = volPeak * 0.4;
        longKm = raceDistanceKm;
      } else {
        const factor = taperWeeks === 3 ? ([0.8, 0.6][t] ?? 0.55) : ([0.65][t] ?? 0.55);
        weekKm = volPeak * factor;
        longKm = longPeak * (taperWeeks === 3 ? ([0.75, 0.55][t] ?? 0.5) : 0.6);
      }
    }

    weekKm = round1(weekKm);
    longKm = round1(longKm);
    const sessions = buildSessions({
      weekStart, phase, isDeload, inTaper,
      isRaceWeek: i === totalWeeks - 1,
      weekKm, longKm, days, longDay, paces, raceDistanceKm, goal
    });

    weeks.push({
      week: i + 1,
      phase,
      deload: isDeload,
      startDate: isoDate(weekStart),
      targetKm: round1(sessions.reduce((s, x) => s + (x.distanceKm || 0), 0)),
      sessions
    });
  }

  return {
    meta: {
      raceDistanceKm,
      goal,
      raceDate: isoDate(raceDate),
      startDate: isoDate(planStart),
      totalWeeks,
      buildWeeks,
      taperWeeks,
      runDaysPerWeek: days.length,
      longRunDay: longDay,
      paceBasis: basis,
      anchor10kPace: fmtPace(anchor10kSecPerKm),
      paces: Object.fromEntries(Object.entries(paces).map(([k, v]) => [k, fmtPace(v)])),
      pacesSecPerKm: paces,
      warnings,
      generatedFrom: {
        runDays: days, longRunDay: longDay, currentWeeklyKm: volStart,
        longestRecentKm: longStart, goal, raceDistanceKm
      }
    },
    weeks
  };
}

// Distribute a week's volume across the available days into typed sessions.
// Each session's `id` is its date (unique per plan) — the tick + Strava match key.
function buildSessions(ctx) {
  const { weekStart, phase, isDeload, inTaper, isRaceWeek, weekKm, longKm, days, longDay, paces, raceDistanceKm, goal } = ctx;
  const sessions = [];
  const mk = (dayName, type, distanceKm, title, paceKey, notes) => {
    const date = isoDate(addDays(weekStart, weekdayOffset(dayName)));
    return {
      id: date,
      date,
      weekday: dayName,
      type,
      title,
      distanceKm: distanceKm ? round1(distanceKm) : 0,
      paceTarget: paceKey ? fmtPace(paces[paceKey]) + '/km' : null,
      notes: notes || null,
      completed: false,
      stravaActivityId: null,
      actual: null
    };
  };

  if (isRaceWeek) {
    const longOff = weekdayOffset(longDay);
    for (const d of WEEKDAYS) {
      const off = weekdayOffset(d);
      if (d === longDay) {
        sessions.push(mk(d, 'race', raceDistanceKm, `🏁 RACE DAY — ${raceDistanceKm}km ultra`, 'goal', goal === 'time' ? 'Run your goal effort. Fuel early and often.' : 'Start easy, walk the hills, finish strong.'));
      } else if (days.includes(d) && (off === longOff - 4 || off === longOff - 2)) {
        sessions.push(mk(d, 'recovery', 5, 'Shakeout jog', 'recovery', '20–25min very easy + a few strides. Stay loose, not tired.'));
      } else {
        sessions.push(mk(d, 'rest', 0, 'Rest', null, 'Rest, hydrate, prep kit & nutrition.'));
      }
    }
    return sessions.sort(byDate);
  }

  const longTitle = (phase === 'Peak' && goal === 'time') ? 'Long run w/ goal-pace finish' : 'Long run';
  const longNotes = phase === 'Peak'
    ? 'The key session. Practice race-day fuel & kit. Last 20–30min can lift toward goal effort.'
    : 'Easy, conversational. Time on feet is the win.';
  sessions.push(mk(longDay, 'long', longKm, longTitle, (phase === 'Peak' && goal === 'time') ? 'goal' : 'long', longNotes));

  const otherDays = days.filter((d) => d !== longDay);
  let remaining = Math.max(0, weekKm - longKm);

  let qualityDay = null;
  if (!isDeload && !inTaper && otherDays.length >= 2) {
    qualityDay = otherDays.find((d) => ['Tue', 'Wed'].includes(d)) || otherDays[0];
    const qKm = clamp(remaining * 0.28, 5, 14);
    remaining -= qKm;
    let type = 'threshold', title = 'Tempo run', paceKey = 'threshold', notes = `${Math.round(qKm * 0.6)}km steady @ threshold, with easy warm-up/cool-down.`;
    if (phase === 'Base') { type = 'easy'; title = 'Easy + strides'; paceKey = 'easy'; notes = 'Easy run + 6×20s strides to wake the legs up.'; }
    else if (phase === 'Build') { type = 'threshold'; title = 'Tempo run'; paceKey = 'threshold'; notes = '2–3 × 8min @ threshold, 2min easy between.'; }
    else if (phase === 'Peak') { type = 'hills'; title = 'Hill strength'; paceKey = 'threshold'; notes = '8–10 × 60–90s uphill hard, jog down. Ultra-specific strength.'; }
    sessions.push(mk(qualityDay, type, qKm, title, paceKey, notes));
  }

  const easyDays = otherDays.filter((d) => d !== qualityDay);
  if (easyDays.length && remaining > 0) {
    const per = remaining / easyDays.length;
    easyDays.forEach((d, idx) => {
      const isRecovery = idx === 0 && (phase === 'Peak' || isDeload);
      sessions.push(mk(d, isRecovery ? 'recovery' : 'easy', per, isRecovery ? 'Recovery jog' : 'Easy run', isRecovery ? 'recovery' : 'easy', isRecovery ? 'Super easy — let the long run absorb.' : 'Conversational pace. Nose-breathing easy.'));
    });
  }

  for (const d of WEEKDAYS) {
    if (!days.includes(d)) sessions.push(mk(d, 'rest', 0, 'Rest', null, 'Recover. Optional mobility/stretch.'));
  }

  return sessions.sort(byDate);
}

function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

// Find the plan session that a Strava activity should tick off.
// Primary: exact date match on a run-type session. Fallback: nearest uncompleted
// run within ±2 days whose distance is closest to the activity.
export function matchSession(plan, activity) {
  if (!plan?.weeks) return null;
  const actDate = (activity.dateLocal || '').slice(0, 10);
  const isRun = (s) => s.type !== 'rest';
  const all = plan.weeks.flatMap((w) => w.sessions);

  const exact = all.find((s) => s.id === actDate && isRun(s));
  if (exact) return exact;

  const actKm = Number(activity.distanceKm) || 0;
  let best = null, bestScore = Infinity;
  for (const s of all) {
    if (!isRun(s) || s.completed) continue;
    const dayGap = Math.abs((new Date(s.date) - new Date(actDate)) / 864e5);
    if (dayGap > 2) continue;
    const score = dayGap * 5 + Math.abs((s.distanceKm || 0) - actKm);
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export { fmtPace };
