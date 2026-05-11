(function () {
  'use strict';

  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const DAY_LABELS = { sunday:'Sun', monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat' };
  const DAY_FULL = { sunday:'Sunday', monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday', thursday:'Thursday', friday:'Friday', saturday:'Saturday' };
  const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snacks:'Snacks' };
  const MEAL_ORDER = { breakfast:0, lunch:1, dinner:2, snacks:3 };
  const DOW_INITIAL = { 0:'S', 1:'M', 2:'T', 3:'W', 4:'T', 5:'F', 6:'S' };
  const DOW_ORDER = [1,2,3,4,5,6,0];

  const State = {
    user: null,
    plan: null,
    planId: null,
    planSource: null,
    shopping: { list: null, items: [] },
    schedule: { events: [], timezone: 'Australia/Brisbane' },
    vapidKey: null,
    pushSubscribed: false,
    tab: 'today',
    selectedDay: DAYS[new Date().getDay()],
    // PIN screen state
    pinMode: 'enter',   // 'enter' | 'create-1' | 'create-2'
    pinBuffer: '',
    pinFirst: '',
    pinError: ''
  };

  // ------- API -------
  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(path, {
      credentials: 'include',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, opts.headers || {}),
      cache: 'no-store',
      method: opts.method,
      body: opts.body
    });
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((body && body.error) || ('HTTP ' + res.status));
      err.status = res.status; err.body = body;
      throw err;
    }
    return body || {};
  }
  const apiGet   = (p)    => api(p);
  const apiPost  = (p, b) => api(p, { method:'POST',  body: JSON.stringify(b || {}) });
  const apiPut   = (p, b) => api(p, { method:'PUT',   body: JSON.stringify(b || {}) });
  const apiPatch = (p, b) => api(p, { method:'PATCH', body: JSON.stringify(b || {}) });
  const apiDel   = (p)    => api(p, { method:'DELETE' });

  // ------- Icons -------
  const I = {
    home:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    cal:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    cart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/></svg>',
    bell:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0v5l1.5 3h-15L6 13z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
    gear:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.21 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9.07a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.36l.06.06A1.65 1.65 0 0 0 8.92 4.75 1.65 1.65 0 0 0 9.93 3.24V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/><path d="M18 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>',
    yoga:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v5l-4 3 3 6"/><path d="M12 12l4 3-3 6"/><path d="M5 13h14"/></svg>',
    fork:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v8a2 2 0 1 1-4 0V2M5 10v12"/><path d="M17 2c-2 0-3 2-3 5s1 5 3 5v10"/></svg>',
    back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>'
  };

  // ------- helpers -------
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function setApp(html) { document.getElementById('app').innerHTML = html; }
  function weekDates() {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    monday.setDate(now.getDate() + mondayOffset);
    const out = {};
    ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].forEach((k, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); out[k] = d;
    });
    return out;
  }
  function todayKey() { return DAYS[new Date().getDay()]; }
  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }
  function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast show'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 1800);
  }

  // ------- Renderers (app) -------
  function renderTabbar() {
    function tab(id, icon, label) {
      const active = State.tab === id;
      return '<button class="tab ' + (active?'active':'') + '" data-action="tab" data-tab="' + id + '">' + icon + '<span>' + label + '</span></button>';
    }
    return '<nav class="tabbar">' +
      tab('today', I.home, 'Today') +
      tab('plan', I.cal, 'Plan') +
      tab('shopping', I.cart, 'Shopping') +
      tab('schedule', I.bell, 'Schedule') +
      tab('settings', I.gear, 'Settings') +
    '</nav>';
  }

  function renderTopbar(title) {
    const dayName = new Date().toLocaleDateString('en-AU', { weekday: 'long' });
    return '<div class="topbar"><div class="topbar-inner"><h1>' + escapeHTML(title) + '</h1><div class="pill">' + dayName + '</div></div></div>';
  }

  function renderHero() {
    const d = new Date();
    const dayName = d.toLocaleDateString('en-AU', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
    const sub = (State.plan && State.plan.subtitle) ? State.plan.subtitle : 'Couples plan · Cut + Gain';
    return '<div class="hero">' +
      '<h2>' + greeting() + '</h2>' +
      '<div class="date">' + escapeHTML(dayName) + '</div>' +
      '<div class="sub">' + escapeHTML(dateStr) + ' · ' + escapeHTML(sub) + '</div>' +
    '</div>';
  }

  function isPilatesToday() {
    const dow = new Date().getDay();
    return (State.schedule.events || []).find(e =>
      e.kind === 'pilates' && e.enabled && Array.isArray(e.days_of_week) && e.days_of_week.indexOf(dow) !== -1
    ) || null;
  }
  function sortMeals(meals) {
    return (meals || []).slice().sort((a, b) => (MEAL_ORDER[a.type] != null ? MEAL_ORDER[a.type] : 99) - (MEAL_ORDER[b.type] != null ? MEAL_ORDER[b.type] : 99));
  }

  function renderMealCard(m, dayKey) {
    const her = (m.her || []); const him = (m.him || []);
    const hList = her.length ? her.map(s => '<li>' + escapeHTML(s) + '</li>').join('') : '<li class="empty">—</li>';
    const mList = him.length ? him.map(s => '<li>' + escapeHTML(s) + '</li>').join('') : '<li class="empty">—</li>';
    return '<div class="meal-card">' +
      '<div class="meal-head">' +
        '<div>' +
          '<div class="meal-type">' + escapeHTML(MEAL_LABELS[m.type] || m.type) + '</div>' +
          '<div class="meal-name">' + escapeHTML(m.name) + '</div>' +
        '</div>' +
        '<button class="icon-btn" data-action="edit-meal" data-day="' + escapeHTML(dayKey) + '" data-type="' + escapeHTML(m.type) + '" aria-label="Edit">' + I.edit + '</button>' +
      '</div>' +
      '<div class="portions">' +
        '<div class="portion her"><div class="who">Her</div><ul>' + hList + '</ul></div>' +
        '<div class="portion him"><div class="who">Him</div><ul>' + mList + '</ul></div>' +
      '</div>' +
    '</div>';
  }

  function renderToday() {
    if (!State.plan) return renderTopbar('Hank') + '<div class="page"><div class="empty">No plan yet.</div></div>';
    const tk = todayKey();
    const day = (State.plan.days || []).find(d => d.day === tk);
    const pilates = isPilatesToday();
    const meals = sortMeals(day && day.meals);
    return renderTopbar('Hank') +
      renderHero() +
      (pilates ? (
        '<div class="pilates-banner">' +
          '<div class="icon-wrap">' + I.yoga + '</div>' +
          '<div class="body">' +
            '<div class="title">Pilates today at ' + escapeHTML(pilates.time_local) + '</div>' +
            '<div class="sub">' + escapeHTML(pilates.message || 'Get your mat ready') + '</div>' +
          '</div>' +
        '</div>'
      ) : '') +
      '<div class="page">' +
        (meals.length ? meals.map(m => renderMealCard(m, tk)).join('') : '<div class="empty">No meals for today.</div>') +
      '</div>';
  }

  function renderPlan() {
    if (!State.plan) return renderTopbar('Plan') + '<div class="page"><div class="empty">No plan loaded.</div></div>';
    const tk = todayKey();
    const sel = State.selectedDay || tk;
    const day = (State.plan.days || []).find(d => d.day === sel) || (State.plan.days || [])[0];
    const dates = weekDates();
    const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const chips = order.map(k => {
      const isToday = k === tk; const active = k === sel;
      return '<button class="day-chip ' + (active?'active':'') + ' ' + (isToday?'today':'') + '" data-action="select-day" data-day="' + k + '">' +
        '<div class="d">' + DAY_LABELS[k] + '</div>' +
        '<div class="n">' + (dates[k] ? dates[k].getDate() : '') + '</div>' +
      '</button>';
    }).join('');
    const meals = sortMeals(day && day.meals);
    return renderTopbar('Plan') +
      '<div class="page">' +
        '<div class="day-chips">' + chips + '</div>' +
        (meals.length ? meals.map(m => renderMealCard(m, day.day)).join('') : '<div class="empty">No meals for this day.</div>') +
        '<div class="card">' +
          '<div class="bold">Plan next week</div>' +
          '<div class="small muted" style="margin-top:2px">Duplicate this week or generate fresh meals.</div>' +
          '<div class="btn-row" style="margin-top:12px">' +
            '<button class="btn btn-secondary" data-action="next-week" data-mode="duplicate">' + I.refresh + '<span>Duplicate</span></button>' +
            '<button class="btn btn-primary" data-action="next-week" data-mode="surprise">' + I.spark + '<span>Surprise me</span></button>' +
          '</div>' +
        '</div>' +
        (State.plan.notes ? '<div class="notes">' + escapeHTML(State.plan.notes) + '</div>' : '') +
      '</div>';
  }

  function renderShopping() {
    const items = State.shopping.items || [];
    const total = items.length;
    const done = items.filter(i => i.checked).length;
    const byCat = {}; const order = [];
    items.forEach(it => {
      const c = it.category || 'Other';
      if (!byCat[c]) { byCat[c] = []; order.push(c); }
      byCat[c].push(it);
    });
    const groups = order.map(c => {
      const rows = byCat[c].map(it => {
        return '<div class="shop-item ' + (it.checked?'checked':'') + '" data-action="toggle-shop" data-id="' + it.id + '">' +
          '<div class="checkbox">' + I.check + '</div>' +
          '<div class="body">' +
            '<div class="name">' + escapeHTML(it.name) + '</div>' +
            (it.qty ? '<div class="qty">' + escapeHTML(it.qty) + '</div>' : '') +
          '</div>' +
          '<button class="del icon-btn ghost" data-action="delete-shop" data-id="' + it.id + '" aria-label="Delete">' + I.trash + '</button>' +
        '</div>';
      }).join('');
      return '<div class="shop-category">' + escapeHTML(c) + '</div>' + rows;
    }).join('');

    return renderTopbar('Shopping') +
      '<div class="page">' +
        '<div class="row between" style="margin: 2px 4px 12px">' +
          '<div class="bold">Your list <span class="shop-counter">' + done + '/' + total + ' done</span></div>' +
          '<div class="row gap-6">' +
            '<button class="icon-btn" data-action="regen-shopping" aria-label="Regenerate">' + I.refresh + '</button>' +
            '<button class="icon-btn" data-action="clear-checked" aria-label="Clear checked">' + I.trash + '</button>' +
          '</div>' +
        '</div>' +
        '<form class="add-row" data-action="add-shop-item">' +
          '<input type="text" name="name" placeholder="Add item" autocomplete="off" />' +
          '<input type="text" name="qty" placeholder="qty" class="qty" autocomplete="off" />' +
          '<button type="submit" class="icon-btn primary" aria-label="Add">' + I.plus + '</button>' +
        '</form>' +
        (total === 0 ? '<div class="empty">List is empty. Tap the refresh icon to pull from your meal plan.</div>' : groups) +
      '</div>';
  }

  function renderEventRow(ev) {
    const days = Array.isArray(ev.days_of_week) ? ev.days_of_week : [];
    const toggles = DOW_ORDER.map(d => '<button class="day-toggle ' + (days.indexOf(d) !== -1 ? 'on':'') + '" data-action="event-day" data-id="' + ev.id + '" data-d="' + d + '">' + DOW_INITIAL[d] + '</button>').join('');
    return '<div class="sched-row" data-event="' + ev.id + '">' +
      '<div class="sched-head">' +
        '<div class="sched-label">' + escapeHTML(ev.label) + '</div>' +
        '<div class="sched-meta">' +
          '<input type="time" class="sched-time-input" value="' + escapeHTML(ev.time_local) + '" data-action="event-time" data-id="' + ev.id + '" />' +
          '<button class="switch ' + (ev.enabled?'on':'') + '" data-action="toggle-event" data-id="' + ev.id + '" aria-label="Toggle"></button>' +
        '</div>' +
      '</div>' +
      '<div class="day-toggles">' + toggles + '</div>' +
      '<div class="sched-actions">' +
        '<button class="link-btn" data-action="rename-event" data-id="' + ev.id + '">Rename</button>' +
        '<button class="link-btn danger" data-action="delete-event" data-id="' + ev.id + '">Delete</button>' +
      '</div>' +
    '</div>';
  }

  function renderSchedule() {
    const events = State.schedule.events || [];
    const tz = State.schedule.timezone || 'Australia/Brisbane';
    const pilates = events.filter(e => e.kind === 'pilates');
    const meals   = events.filter(e => e.kind === 'meal');
    const custom  = events.filter(e => e.kind !== 'pilates' && e.kind !== 'meal');
    return renderTopbar('Schedule') +
      '<div class="page">' +
        '<div class="card">' +
          '<div class="row between"><div><div class="bold">Timezone</div><div class="small muted">' + escapeHTML(tz) + '</div></div>' +
          '<button class="btn btn-secondary" data-action="edit-timezone">Change</button></div>' +
        '</div>' +
        '<div class="section-title">Pilates</div>' +
        (pilates.length ? pilates.map(renderEventRow).join('') : '<div class="empty">No pilates reminders.</div>') +
        '<div class="section-title">Meal reminders</div>' +
        (meals.length ? meals.map(renderEventRow).join('') : '<div class="empty">No meal reminders.</div>') +
        (custom.length ? '<div class="section-title">Other</div>' + custom.map(renderEventRow).join('') : '') +
        '<button class="btn btn-secondary btn-block mt-12" data-action="add-event">' + I.plus + '<span>Add reminder</span></button>' +
      '</div>';
  }

  function renderSettings() {
    const pushOn = State.pushSubscribed;
    const vapidOk = Boolean(State.vapidKey);
    return renderTopbar('Settings') +
      '<div class="page">' +
        '<div class="card">' +
          '<div class="bold">Household</div>' +
          '<div class="kv"><div class="k">Locked with</div><div class="v">4-digit PIN</div></div>' +
          '<button class="btn btn-ghost btn-block mt-12" data-action="signout">Lock app</button>' +
        '</div>' +
        '<div class="card">' +
          '<div class="bold">Push notifications</div>' +
          '<div class="kv"><div class="k">Status</div><div class="v">' + (pushOn ? 'Enabled on this device' : 'Disabled') + '</div></div>' +
          (vapidOk
            ? (pushOn
                ? ('<div class="btn-row mt-12">' +
                    '<button class="btn btn-secondary" data-action="push-test">Send test</button>' +
                    '<button class="btn btn-danger" data-action="push-off">Disable</button>' +
                  '</div>')
                : '<button class="btn btn-primary btn-block mt-12" data-action="push-on">' + I.bell + '<span>Enable on this device</span></button>')
            : '<div class="small muted mt-12">Server VAPID keys not configured. Run <code>npx web-push generate-vapid-keys</code> and set <code>VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code>.</div>') +
          '<div class="small muted mt-12">iOS tip: add the app to your home screen first, then enable.</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="bold">Timezone</div>' +
          '<div class="kv"><div class="k">Current</div><div class="v">' + escapeHTML(State.schedule.timezone || '') + '</div></div>' +
          '<button class="btn btn-secondary btn-block mt-12" data-action="edit-timezone">Change timezone</button>' +
        '</div>' +
        '<div class="small muted" style="text-align:center;padding:8px">Hank · v1.1</div>' +
      '</div>';
  }

  function renderHome() {
    let body = '';
    switch (State.tab) {
      case 'today':    body = renderToday(); break;
      case 'plan':     body = renderPlan(); break;
      case 'shopping': body = renderShopping(); break;
      case 'schedule': body = renderSchedule(); break;
      case 'settings': body = renderSettings(); break;
      default:         body = renderToday();
    }
    setApp('<div class="app">' + body + renderTabbar() + '</div>');
  }

  // ------- PIN screen -------
  function renderPin(shake) {
    let title = 'Enter your PIN';
    let sub = 'Tap your 4-digit household PIN.';
    if (State.pinMode === 'create-1') { title = 'Set a PIN'; sub = 'Choose a 4-digit code for your household.'; }
    if (State.pinMode === 'create-2') { title = 'Confirm PIN'; sub = 'Type it again to confirm.'; }

    const dots = [0,1,2,3].map(i => '<div class="pin-dot ' + (i < State.pinBuffer.length ? 'filled' : '') + '"></div>').join('');
    const pad = [
      ['1','2','3'],
      ['4','5','6'],
      ['7','8','9'],
      ['empty','0','back']
    ].map(row => row.map(k => {
      if (k === 'empty') return '<div class="pin-key empty"></div>';
      if (k === 'back')  return '<button class="pin-key icon" data-action="pin-back" aria-label="Backspace">' + I.back + '</button>';
      return '<button class="pin-key" data-action="pin-key" data-k="' + k + '">' + k + '</button>';
    }).join('')).join('');

    setApp(
      '<div class="pin-wrap' + (shake?' pin-shake':'') + '">' +
        '<div class="pin-top">' +
          '<div class="pin-logo">' + I.fork + '</div>' +
          '<h1 class="pin-title">' + escapeHTML(title) + '</h1>' +
          '<p class="pin-sub">' + escapeHTML(sub) + '</p>' +
          '<div class="pin-error">' + escapeHTML(State.pinError || '') + '</div>' +
          '<div class="pin-dots">' + dots + '</div>' +
        '</div>' +
        '<div class="pin-pad">' + pad + '</div>' +
        '<div class="pin-foot">' +
          (State.pinMode !== 'enter' ? '<button data-action="pin-restart">Restart</button>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function updatePinDotsOnly() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => d.classList.toggle('filled', i < State.pinBuffer.length));
  }

  function applyShake() {
    const wrap = document.querySelector('.pin-wrap');
    if (!wrap) return;
    wrap.classList.remove('pin-shake');
    // restart animation
    void wrap.offsetWidth;
    wrap.classList.add('pin-shake');
  }

  async function handlePinComplete() {
    if (State.pinMode === 'create-1') {
      State.pinFirst = State.pinBuffer;
      State.pinBuffer = '';
      State.pinMode = 'create-2';
      State.pinError = '';
      renderPin();
      return;
    }
    if (State.pinMode === 'create-2') {
      if (State.pinFirst !== State.pinBuffer) {
        State.pinError = "PINs didn't match. Try again.";
        State.pinBuffer = '';
        State.pinFirst = '';
        State.pinMode = 'create-1';
        applyShake();
        setTimeout(renderPin, 360);
        return;
      }
      try {
        await apiPost('/api/pin/set', { pin: State.pinBuffer });
        State.user = { id: 1 };
        State.pinBuffer = ''; State.pinFirst = ''; State.pinError = '';
        await loadAll();
        State.tab = 'today';
        renderHome();
      } catch (err) {
        State.pinError = err.message || 'Failed to set PIN';
        State.pinBuffer = ''; State.pinFirst = ''; State.pinMode = 'create-1';
        applyShake(); setTimeout(renderPin, 360);
      }
      return;
    }
    // enter
    try {
      await apiPost('/api/pin/verify', { pin: State.pinBuffer });
      State.user = { id: 1 };
      State.pinBuffer = ''; State.pinError = '';
      await loadAll();
      State.tab = 'today';
      renderHome();
    } catch (err) {
      State.pinError = err.status === 401 ? 'Wrong PIN' : (err.message || 'Failed');
      State.pinBuffer = '';
      applyShake();
      setTimeout(renderPin, 360);
    }
  }

  // ------- Modal -------
  function showModal(html, opts) {
    hideModal();
    const center = opts && opts.center;
    const m = document.createElement('div');
    m.className = 'modal' + (center ? ' center' : '');
    m.innerHTML = '<div class="modal-card">' + (center ? '' : '<div class="modal-drag"></div>') + html + '</div>';
    m.addEventListener('click', (e) => { if (e.target === m) hideModal(); });
    document.body.appendChild(m);
    const firstInput = m.querySelector('input, textarea, select');
    if (firstInput && !center) setTimeout(() => firstInput.focus(), 100);
  }
  function hideModal() { const cur = document.querySelector('.modal'); if (cur) cur.remove(); }

  function showEditMealModal(day, type) {
    const dayObj = (State.plan.days || []).find(d => d.day === day);
    const meal = dayObj && dayObj.meals.find(m => m.type === type);
    if (!meal) return;
    const her = (meal.her || []).join('\n');
    const him = (meal.him || []).join('\n');
    showModal(
      '<h3>Edit ' + escapeHTML(MEAL_LABELS[type] || type) + ' · ' + escapeHTML(DAY_FULL[day] || day) + '</h3>' +
      '<form data-action="save-meal" data-day="' + day + '" data-type="' + type + '">' +
        '<div class="field"><label>Meal name</label><input type="text" name="name" value="' + escapeHTML(meal.name) + '" required /></div>' +
        '<div class="field"><label>Her portion (one item per line)</label><textarea name="her">' + escapeHTML(her) + '</textarea></div>' +
        '<div class="field"><label>His portion (one item per line)</label><textarea name="him">' + escapeHTML(him) + '</textarea></div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>' +
          '<button type="submit" class="btn btn-primary">Save</button>' +
        '</div>' +
      '</form>'
    );
  }
  function showAddEventModal() {
    const toggles = DOW_ORDER.map(d => '<button type="button" class="day-toggle on" data-action="newday-toggle" data-d="' + d + '">' + DOW_INITIAL[d] + '</button>').join('');
    showModal(
      '<h3>Add reminder</h3>' +
      '<form data-action="create-event">' +
        '<div class="field"><label>Type</label><select name="kind"><option value="custom">Other</option><option value="meal">Meal</option><option value="pilates">Pilates</option></select></div>' +
        '<div class="field"><label>Label</label><input type="text" name="label" required /></div>' +
        '<div class="field"><label>Time</label><input type="time" name="timeLocal" value="08:00" required /></div>' +
        '<div class="field"><label>Days</label><div class="day-toggles">' + toggles + '</div></div>' +
        '<div class="field"><label>Message (optional)</label><input type="text" name="message" /></div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>' +
          '<button type="submit" class="btn btn-primary">Add</button>' +
        '</div>' +
      '</form>'
    );
  }
  function showRenameEventModal(id) {
    const ev = State.schedule.events.find(e => e.id === id);
    if (!ev) return;
    showModal(
      '<h3>Edit reminder</h3>' +
      '<form data-action="rename-save" data-id="' + id + '">' +
        '<div class="field"><label>Label</label><input type="text" name="label" value="' + escapeHTML(ev.label) + '" required /></div>' +
        '<div class="field"><label>Message</label><input type="text" name="message" value="' + escapeHTML(ev.message || '') + '" /></div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>' +
          '<button type="submit" class="btn btn-primary">Save</button>' +
        '</div>' +
      '</form>'
    );
  }
  function showTimezoneModal() {
    const cur = State.schedule.timezone || 'Australia/Brisbane';
    const opts = ['Australia/Brisbane','Australia/Sydney','Australia/Melbourne','Australia/Adelaide','Australia/Perth','Australia/Darwin','Australia/Hobart','Pacific/Auckland','UTC'];
    showModal(
      '<h3>Set timezone</h3>' +
      '<form data-action="save-timezone">' +
        '<div class="field"><label>Timezone</label><select name="tz">' + opts.map(o => '<option ' + (o===cur?'selected':'') + '>' + o + '</option>').join('') + '</select></div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>' +
          '<button type="submit" class="btn btn-primary">Save</button>' +
        '</div>' +
      '</form>'
    );
  }

  // ------- Actions -------
  const Actions = {
    'pin-key': (el) => {
      if (State.pinBuffer.length >= 4) return;
      State.pinBuffer += el.dataset.k;
      updatePinDotsOnly();
      if (State.pinBuffer.length === 4) setTimeout(handlePinComplete, 120);
    },
    'pin-back': () => {
      State.pinBuffer = State.pinBuffer.slice(0, -1);
      updatePinDotsOnly();
    },
    'pin-restart': () => {
      State.pinBuffer = ''; State.pinFirst = ''; State.pinMode = 'create-1'; State.pinError = '';
      renderPin();
    },

    'tab': (el) => { State.tab = el.dataset.tab; renderHome(); window.scrollTo(0, 0); },
    'select-day': (el) => { State.selectedDay = el.dataset.day; renderHome(); },
    'edit-meal': (el) => showEditMealModal(el.dataset.day, el.dataset.type),
    'close-modal': () => hideModal(),

    'save-meal': async (el, e) => {
      e && e.preventDefault();
      const form = el.closest('form') || el;
      const fd = new FormData(form);
      const day = form.dataset.day; const type = form.dataset.type;
      const name = String(fd.get('name') || '').trim();
      const her = String(fd.get('her') || '').split('\n').map(s => s.trim()).filter(Boolean);
      const him = String(fd.get('him') || '').split('\n').map(s => s.trim()).filter(Boolean);
      try {
        const out = await apiPut('/api/couples-plan/meal', { day, type, name, her, him });
        State.plan = out.plan;
        hideModal(); toast('Saved'); renderHome();
      } catch (err) { toast(err.message || 'Save failed'); }
    },
    'next-week': async (el) => {
      const mode = el.dataset.mode;
      toast(mode === 'surprise' ? 'Generating fresh meals…' : 'Duplicating this week…');
      try {
        const out = await apiPost('/api/couples-plan/next-week', { mode });
        State.plan = out.plan; State.planId = out.planId; State.planSource = out.source;
        toast(mode === 'surprise' ? 'Fresh plan ready' : 'Next week ready');
        try { const sh = await apiPost('/api/shopping/regenerate', {}); State.shopping = sh; } catch (_) {}
        renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },

    'toggle-shop': async (el) => {
      const id = Number(el.dataset.id);
      const item = State.shopping.items.find(i => i.id === id);
      if (!item) return;
      const next = !item.checked;
      item.checked = next;
      renderHome();
      try { await apiPatch('/api/shopping/items/' + id, { checked: next }); }
      catch (err) { item.checked = !next; renderHome(); toast(err.message || 'Failed'); }
    },
    'add-shop-item': async (el, e) => {
      e && e.preventDefault();
      const form = el.closest('form') || el;
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const qty  = String(fd.get('qty') || '').trim();
      if (!name) return;
      try {
        const out = await apiPost('/api/shopping/items', { name, qty });
        State.shopping.items.push(out.item);
        form.reset(); renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'delete-shop': async (el, e) => {
      e && e.stopPropagation();
      const id = Number(el.dataset.id);
      try {
        await apiDel('/api/shopping/items/' + id);
        State.shopping.items = State.shopping.items.filter(i => i.id !== id);
        renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'regen-shopping': async () => {
      if (!confirm('Replace the auto-generated items from your meal plan? (Manual items stay.)')) return;
      try { const out = await apiPost('/api/shopping/regenerate', {}); State.shopping = out; toast('Shopping list refreshed'); renderHome(); }
      catch (err) { toast(err.message || 'Failed'); }
    },
    'clear-checked': async () => {
      if (!confirm('Remove all ticked items?')) return;
      try { const out = await apiPost('/api/shopping/clear-checked', {}); State.shopping = out; renderHome(); }
      catch (err) { toast(err.message || 'Failed'); }
    },

    'add-event': () => showAddEventModal(),
    'newday-toggle': (el, e) => { e && e.preventDefault(); el.classList.toggle('on'); },
    'create-event': async (el, e) => {
      e && e.preventDefault();
      const form = el.closest('form') || el;
      const fd = new FormData(form);
      const kind = String(fd.get('kind') || 'custom');
      const label = String(fd.get('label') || '').trim();
      const timeLocal = String(fd.get('timeLocal') || '');
      const message = String(fd.get('message') || '').trim() || null;
      const daysOfWeek = Array.from(form.querySelectorAll('.day-toggle.on')).map(b => Number(b.dataset.d));
      try {
        const out = await apiPost('/api/schedule', { kind, label, timeLocal, daysOfWeek, message });
        State.schedule.events.push(out.event); hideModal(); toast('Reminder added'); renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'event-time': async (el) => {
      const id = Number(el.dataset.id);
      const ev = State.schedule.events.find(x => x.id === id); if (!ev) return;
      const newTime = el.value; const prev = ev.time_local;
      try { const out = await apiPatch('/api/schedule/' + id, { timeLocal: newTime }); Object.assign(ev, out.event); toast('Time updated'); }
      catch (err) { el.value = prev; toast(err.message || 'Failed'); }
    },
    'event-day': async (el) => {
      const id = Number(el.dataset.id); const d = Number(el.dataset.d);
      const ev = State.schedule.events.find(x => x.id === id); if (!ev) return;
      const set = new Set(ev.days_of_week || []);
      if (set.has(d)) set.delete(d); else set.add(d);
      const daysOfWeek = Array.from(set).sort((a, b) => a - b);
      el.classList.toggle('on');
      try { const out = await apiPatch('/api/schedule/' + id, { daysOfWeek }); Object.assign(ev, out.event); }
      catch (err) { el.classList.toggle('on'); toast(err.message || 'Failed'); }
    },
    'toggle-event': async (el) => {
      const id = Number(el.dataset.id);
      const ev = State.schedule.events.find(x => x.id === id); if (!ev) return;
      const next = !ev.enabled;
      el.classList.toggle('on');
      try { const out = await apiPatch('/api/schedule/' + id, { enabled: next }); Object.assign(ev, out.event); }
      catch (err) { el.classList.toggle('on'); toast(err.message || 'Failed'); }
    },
    'rename-event': (el) => showRenameEventModal(Number(el.dataset.id)),
    'rename-save': async (el, e) => {
      e && e.preventDefault();
      const form = el.closest('form') || el;
      const id = Number(form.dataset.id);
      const fd = new FormData(form);
      const label = String(fd.get('label') || '').trim();
      const message = String(fd.get('message') || '').trim() || null;
      try {
        const out = await apiPatch('/api/schedule/' + id, { label, message });
        const ev = State.schedule.events.find(x => x.id === id); if (ev) Object.assign(ev, out.event);
        hideModal(); toast('Saved'); renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'delete-event': async (el) => {
      const id = Number(el.dataset.id);
      if (!confirm('Delete this reminder?')) return;
      try {
        await apiDel('/api/schedule/' + id);
        State.schedule.events = State.schedule.events.filter(x => x.id !== id);
        renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'edit-timezone': () => showTimezoneModal(),
    'save-timezone': async (el, e) => {
      e && e.preventDefault();
      const form = el.closest('form') || el;
      const tz = String(new FormData(form).get('tz') || '');
      try { await apiPut('/api/schedule/timezone', { timezone: tz }); State.schedule.timezone = tz; hideModal(); toast('Timezone updated'); renderHome(); }
      catch (err) { toast(err.message || 'Failed'); }
    },

    'push-on': async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('Push not supported on this device'); return; }
        if (!State.vapidKey) { toast('Server not configured for push'); return; }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toast('Notification permission denied'); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(State.vapidKey)
        });
        await apiPost('/api/push/subscribe', sub.toJSON());
        State.pushSubscribed = true; toast('Notifications enabled'); renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'push-off': async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await apiPost('/api/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
        State.pushSubscribed = false; toast('Notifications disabled'); renderHome();
      } catch (err) { toast(err.message || 'Failed'); }
    },
    'push-test': async () => {
      try { await apiPost('/api/push/test', {}); toast('Test sent'); }
      catch (err) { toast(err.message || 'Failed'); }
    },

    'signout': async () => {
      try { await apiPost('/api/auth/signout', {}); } catch (_) {}
      State.user = null;
      State.plan = null;
      State.shopping = { list: null, items: [] };
      State.schedule = { events: [], timezone: 'Australia/Brisbane' };
      State.pinMode = 'enter'; State.pinBuffer = ''; State.pinError = '';
      renderPin();
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // ------- Event delegation -------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a && Actions[a]) Actions[a](el, e);
  });
  document.addEventListener('submit', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a && Actions[a]) { e.preventDefault(); Actions[a](el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'event-time' && Actions['event-time']) Actions['event-time'](el, e);
  });
  // Keyboard support for PIN screen
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('.pin-wrap')) return;
    if (/^[0-9]$/.test(e.key)) {
      if (State.pinBuffer.length >= 4) return;
      State.pinBuffer += e.key; updatePinDotsOnly();
      if (State.pinBuffer.length === 4) setTimeout(handlePinComplete, 120);
    } else if (e.key === 'Backspace') {
      State.pinBuffer = State.pinBuffer.slice(0, -1); updatePinDotsOnly();
    }
  });

  // ------- Boot -------
  async function loadAll() {
    const tasks = [
      apiGet('/api/couples-plan').catch(() => null),
      apiGet('/api/shopping').catch(() => null),
      apiGet('/api/schedule').catch(() => null),
      apiGet('/api/push/vapid').catch(() => ({ publicKey: null }))
    ];
    const [plan, shopping, schedule, vapid] = await Promise.all(tasks);
    if (plan)     { State.plan = plan.plan; State.planId = plan.planId; State.planSource = plan.source; }
    if (shopping) State.shopping = shopping;
    if (schedule) State.schedule = schedule;
    if (vapid)    State.vapidKey = vapid.publicKey;
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        State.pushSubscribed = Boolean(sub);
      } catch (_) {}
    }
  }

  async function boot() {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('/sw.js'); } catch (_) {}
    }
    let me;
    try { me = await apiGet('/api/auth/me'); } catch (_) { me = { userId: null }; }
    if (me && me.userId) {
      State.user = { id: me.userId };
      await loadAll();
      renderHome();
      return;
    }
    let status;
    try { status = await apiGet('/api/pin/status'); } catch (_) { status = { isSet: false }; }
    State.pinMode = status.isSet ? 'enter' : 'create-1';
    State.pinBuffer = ''; State.pinFirst = ''; State.pinError = '';
    renderPin();
  }
  boot();
})();
