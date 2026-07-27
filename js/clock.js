/* ============================================================
   מנוע זמן-ייחוס — מודול עצמאי ונתיק
   ------------------------------------------------------------
   כל תלות-הזמן של המערכת עוברת דרך כאן. שני מצבים:
   • fixed  (פיתוח)  — "עכשיו" קבוע: COORD_TODAY (תאריך) + APP_NOW.min (שעה).
                        נשלט מתג הפיתוח (initDevClock). "היום" בנתוני הדמו = DEMO_ANCHOR.
   • live   (השקה)   — זמן אמת לפי אזור הזמן CLOCK.tz (אסיה/ירושלים).
                        "היום" = התאריך האמיתי.
   כדי לעבור לזמן אמת לפני השקה: setClockLive(true)  (או CLOCK.live = true).
   כל ה-UI שמשתמש ב-nowHM()/recIsOverdue() ימשיך לעבוד ללא שינוי.
   ============================================================ */
const CLOCK = {
  live: false,                 // ← הפוך ל-true (או setClockLive(true)) לפני השקה
  tz: 'Asia/Jerusalem',
};
const DEMO_ANCHOR = '2024-05-23';   // התאריך שאליו מתייחס "היום" בנתוני הדמו (מצב fixed)

/* Date של ה"עכשיו" של המערכת באזור הזמן שנבחר (רק במצב live) */
function clockNowDate() {
  try { return new Date(new Date().toLocaleString('en-US', { timeZone: CLOCK.tz })); }
  catch (e) { return new Date(); }
}
/* התאריך שנחשב "היום" (ISO YYYY-MM-DD) */
function clockTodayISO() {
  if (CLOCK.live) { const d = clockNowDate(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  return (typeof COORD_TODAY !== 'undefined') ? COORD_TODAY : DEMO_ANCHOR;
}
/* עוגן ה"היום" לפרשנות next.at — בפיתוח DEMO_ANCHOR, בהשקה התאריך האמיתי */
function clockAnchorISO() { return CLOCK.live ? clockTodayISO() : DEMO_ANCHOR; }
/* Date object של "היום" של המערכת — ליומנים שמתבססים על תאריך-ייחוס */
function clockTodayDate() { const p = /(\d{4})-(\d{2})-(\d{2})/.exec(clockTodayISO()); return p ? new Date(+p[1], +p[2] - 1, +p[3]) : new Date(2024, 4, 23); }

/* שעת "עכשיו" בדקות מתחילת היום */
function nowHM() {
  if (CLOCK.live) { const d = clockNowDate(); return d.getHours() * 60 + d.getMinutes(); }
  return (typeof APP_NOW !== 'undefined' && APP_NOW) ? APP_NOW.min : 0;
}
/* המרת תאריך ISO לדקות מוחלטות (עקבי, ללא תלות אזור-זמן) */
function dateStrToAbsMin(iso) { const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return p ? Math.floor(Date.UTC(+p[1], +p[2] - 1, +p[3]) / 60000) : null; }
/* ה"עכשיו" של המערכת בדקות מוחלטות */
function refNowAbsMin() { const b = dateStrToAbsMin(clockTodayISO()); return b == null ? null : b + nowHM(); }

/* מועד היעד של "הפעולה הבאה" בדקות מוחלטות — פרשנות "היום/מחר/מחרתיים HH:MM" מול העוגן */
function nextDueAbsMin(r) {
  const at = (r && r.next && r.next.at != null) ? String(r.next.at) : '';
  if (/באיחור/.test(at) && !/\d{1,2}:\d{2}/.test(at)) return -Infinity;   // "באיחור" ללא שעה → תמיד עבר
  const tm = /(\d{1,2}):(\d{2})/.exec(at); if (!tm) return null;           // אין שעה לפרש → לא מבוסס-זמן
  let off = 0;
  if (/מחרתיים/.test(at)) off = 2; else if (/מחר/.test(at)) off = 1; else off = 0;   // ברירת מחדל: היום
  const base = dateStrToAbsMin(clockAnchorISO());
  return base == null ? null : base + off * 1440 + (+tm[1]) * 60 + (+tm[2]);
}
/* האם הרשומה באיחור — מחושב מול השעון, לא טקסט. נופל חזרה ל-flag הסטטי אם אין מועד לפרש. */
function recIsOverdue(r) {
  if (!r || r.done) return false;
  const due = nextDueAbsMin(r), ref = refNowAbsMin();
  if (due == null || ref == null) return !!r.overdue;
  return ref > due;
}
/* דקות שעברו מאז מועד היעד (חיובי = באיחור) — לתצוגת "עבר לפני X" */
function overdueMins(r) { const due = nextDueAbsMin(r), ref = refNowAbsMin(); return (due == null || ref == null || due === -Infinity) ? null : ref - due; }

/* מעבר לזמן אמת (לפני השקה): מסתיר את תג הפיתוח ומריץ לפי שעון אסיה/ירושלים */
function setClockLive(on) {
  CLOCK.live = !!on;
  const dc = document.getElementById('devClock'); if (dc) dc.style.display = CLOCK.live ? 'none' : '';
  if (typeof renderNav === 'function') { const a = document.querySelector('#nav .nav-item.active'); if (a) a.click(); }
}

/* ---------------- תג זמן-ייחוס לפיתוח (מצב fixed בלבד) ---------------- */
function initDevClock() {
  if (document.getElementById('devClock')) return;
  if (CLOCK.live) return;   // בזמן אמת אין תג
  const el = document.createElement('div');
  el.id = 'devClock'; el.className = 'dev-clock';
  const timeStr = (typeof minToHM === 'function') ? minToHM(APP_NOW.min) : '08:00';
  el.innerHTML = `
    <span class="dc-badge">🧪 מצב פיתוח · זמן־ייחוס</span>
    <label class="dc-field">תאריך<input type="date" id="dcDate" value="${COORD_TODAY}"></label>
    <label class="dc-field">שעה<input type="time" id="dcTime" value="${timeStr}"></label>`;
  document.body.appendChild(el);
  const rerender = () => {
    const a = document.querySelector('#nav .nav-item.active'); if (a) a.click();
    if (typeof updateBellBadge === 'function') updateBellBadge();
    if (typeof updateTasksBadge === 'function') updateTasksBadge();
  };
  document.getElementById('dcDate').addEventListener('change', e => { if (e.target.value) { COORD_TODAY = e.target.value; rerender(); toast('זמן־ייחוס: ' + COORD_TODAY); } });
  document.getElementById('dcTime').addEventListener('change', e => { const p = (e.target.value || '08:00').split(':'); APP_NOW.min = (+p[0]) * 60 + (+(p[1] || 0)); rerender(); toast('שעת־ייחוס: ' + e.target.value); });
}
