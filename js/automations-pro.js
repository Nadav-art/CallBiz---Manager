/* ============================================================
   אוטומציות — שכבת ניהול מתקדמת · מודול עצמאי (תוספת בלבד)
   ------------------------------------------------------------
   שכפול · חלון תאריכים · עדיפות · הגבלת תדירות · מניעת כפילויות ·
   מצב בדיקה (Dry Run) · פעולה חלופית בכישלון · משתנים דינמיים ·
   ימים ושעות פעילות לחוק · סטטיסטיקות · חיפוש · ייצוא/ייבוא · אשף.
   כל התוספות כבויות/ניטרליות כברירת מחדל.
   ============================================================ */

/* ---------------- מטא לכל חוק ---------------- */
const AUTO_META_DEF = {
  priority: 5,           // 1 = הכי דחוף
  from: '', to: '',      // חלון תאריכים להפעלה
  days: [0, 1, 2, 3, 4, 5, 6],
  hFrom: 0, hTo: 24,     // שעות פעילות לחוק
  limit: 'none',         // none | lead | day | status
  dedupeMin: 0,          // מניעת כפילות — דקות
  onFail: '',            // פעולה חלופית (מפתח מ-AUTO_ACTIONS)
};
let AUTO_META = (function () { try { return JSON.parse(localStorage.getItem('cb_autoMeta')) || {}; } catch (e) { return {}; } })();
let AUTO_STATS = (function () { try { return JSON.parse(localStorage.getItem('cb_autoStats')) || {}; } catch (e) { return {}; } })();
let AUTO_RUNS = (function () { try { return JSON.parse(localStorage.getItem('cb_autoRuns')) || {}; } catch (e) { return {}; } })();
function autoMetaSave() { try { localStorage.setItem('cb_autoMeta', JSON.stringify(AUTO_META)); localStorage.setItem('cb_autoStats', JSON.stringify(AUTO_STATS)); localStorage.setItem('cb_autoRuns', JSON.stringify(AUTO_RUNS)); } catch (e) {} }
/* סדר ברירת מחדל בין חוקים שרצים על אותו אירוע */
const AUTO_PRIO_DEF = { a1: 1, a1b: 2, a1c: 3, a1d: 4 };
function autoMeta(key) {
  const base = Object.assign({}, AUTO_META_DEF, { priority: AUTO_PRIO_DEF[key] || AUTO_META_DEF.priority });
  return Object.assign(base, AUTO_META[key] || {});
}
function autoMetaSet(key, patch) { AUTO_META[key] = Object.assign({}, autoMeta(key), patch); autoMetaSave(); }
function autoStat(key) { return Object.assign({ runs: 0, ok: 0, fail: 0, blocked: 0, last: '' }, AUTO_STATS[key] || {}); }
function autoStatBump(key, field, extra) {
  const st = autoStat(key); st[field] = (st[field] || 0) + 1; st.runs = (st.runs || 0) + 1;
  st.last = (typeof autoStamp === 'function') ? autoStamp() : '';
  if (extra) Object.assign(st, extra);
  AUTO_STATS[key] = st; autoMetaSave();
}

/* ---------------- מצב בדיקה ---------------- */
let AUTO_DRY = false;
function autoDrySet(on) { AUTO_DRY = !!on; }

/* ---------------- חלון פעילות של חוק ---------------- */
function autoWindowOk(key) {
  const m = autoMeta(key);
  const today = (typeof clockTodayISO === 'function') ? clockTodayISO() : '';
  if (m.from && today && today < m.from) return { ok: false, why: 'החוק מתחיל ב-' + m.from };
  if (m.to && today && today > m.to) return { ok: false, why: 'החוק הסתיים ב-' + m.to };
  const d = (typeof clockTodayDate === 'function') ? clockTodayDate().getDay() : new Date().getDay();
  if ((m.days || []).indexOf(d) < 0) return { ok: false, why: 'לא פעיל ביום ' + (typeof HEB_DAYS !== 'undefined' ? HEB_DAYS[d] : d) };
  const h = (typeof nowHM === 'function') ? Math.floor(nowHM() / 60) : new Date().getHours();
  if (h < (+m.hFrom || 0) || h >= (+m.hTo || 24)) return { ok: false, why: 'מחוץ לשעות החוק (' + m.hFrom + ':00–' + m.hTo + ':00)' };
  return { ok: true, why: '' };
}
/* ---------------- תדירות ומניעת כפילויות ---------------- */
function autoRunToken(key, ctx) {
  const m = autoMeta(key), r = (ctx || {}).rec;
  const lead = r ? ('L' + r.id) : 'G';
  if (m.limit === 'lead') return key + '|' + lead;
  if (m.limit === 'day') return key + '|' + lead + '|' + ((typeof clockTodayISO === 'function') ? clockTodayISO() : '');
  if (m.limit === 'status') return key + '|' + lead + '|' + ((r && r.stageKey) || (r && r.status && r.status.label) || '');
  return '';
}
function autoLimitOk(key, ctx) {
  const tok = autoRunToken(key, ctx);
  if (tok && AUTO_RUNS[tok]) return { ok: false, why: 'כבר רץ (' + autoLimitLabel(autoMeta(key).limit) + ')' };
  const m = autoMeta(key);
  if (+m.dedupeMin > 0) {
    const r = (ctx || {}).rec, dk = 'D|' + key + '|' + (r ? r.id : 'G');
    const last = AUTO_RUNS[dk];
    if (last && (autoNowMin() - last) < +m.dedupeMin) return { ok: false, why: 'מניעת כפילות — רץ לפני ' + (autoNowMin() - last) + ' דק׳' };
  }
  return { ok: true, why: '' };
}
function autoNowMin() {
  const d = (typeof clockTodayDate === 'function') ? clockTodayDate() : new Date();
  const base = Math.floor(d.getTime() / 60000);
  return base + ((typeof nowHM === 'function') ? nowHM() : 0);
}
function autoLimitMark(key, ctx) {
  const tok = autoRunToken(key, ctx); if (tok) AUTO_RUNS[tok] = 1;
  const m = autoMeta(key);
  if (+m.dedupeMin > 0) { const r = (ctx || {}).rec; AUTO_RUNS['D|' + key + '|' + (r ? r.id : 'G')] = autoNowMin(); }
  autoMetaSave();
}
const AUTO_LIMITS = [
  { key: 'none', label: 'ללא הגבלה' }, { key: 'lead', label: 'פעם אחת לליד' },
  { key: 'day', label: 'פעם ביום לליד' }, { key: 'status', label: 'פעם לכל סטטוס' },
];
function autoLimitLabel(k) { const x = AUTO_LIMITS.find(l => l.key === k); return x ? x.label : 'ללא הגבלה'; }

/* ---------------- משתנים דינמיים ---------------- */
const AUTO_VARS = {
  '{שם_לקוח}': c => (c.rec || {}).name, '{טלפון}': c => (c.rec || {}).phone,
  '{נציג}': c => (c.rec || {}).assignee, '{נושא}': c => (c.rec || {}).subject,
  '{מועד_פגישה}': c => { const m = (c.rec || {}).meeting; return m ? (m.date + ' ' + m.time) : ''; },
  '{שירות}': c => { const s = ((c.rec || {}).services || [])[0]; const t = (typeof cTreat === 'function') ? cTreat(s) : null; return t ? t.label : ''; },
  '{סכום}': c => { const h = c.hold; if (h) return h.price + ' ₪';
    const s = (c.rec || {}).services || []; return (typeof svcTotals === 'function' && s.length) ? svcTotals(s).price + ' ₪' : ''; },
  '{סניף}': c => { const b = ((c.rec || {}).needs || {}).branch; const x = (typeof cBranch === 'function') ? cBranch(b) : null; return x ? (x.short || x.label) : ''; },
  '{תאריך_היום}': () => (typeof clockTodayISO === 'function') ? clockTodayISO() : '',
};
function autoMerge(text, ctx) {
  return String(text || '').replace(/\{[^}]+\}/g, m => {
    const f = AUTO_VARS[m]; if (!f) return m;
    let v = ''; try { v = f(ctx || {}); } catch (e) { v = ''; }
    return (v === undefined || v === null || v === '') ? '—' : String(v);
  });
}

/* ---------------- שכפול · ייצוא · ייבוא ---------------- */
function autoDuplicate(key) {
  const d = autoDef(key); if (!d) return null;
  const nk = (typeof autoAddCustom === 'function')
    ? autoAddCustom(d.trigger, d.title + ' (עותק)', d.action || 'notify', d.param || '')
    : null;
  if (!nk) return null;
  AUTO_META[nk] = Object.assign({}, autoMeta(key));
  if (typeof AUTO_COND !== 'undefined' && AUTO_COND[key]) { AUTO_COND[nk] = JSON.parse(JSON.stringify(AUTO_COND[key])); if (typeof autoCondSave === 'function') autoCondSave(); }
  if (typeof AUTO_CHAIN !== 'undefined' && AUTO_CHAIN[key]) { AUTO_CHAIN[nk] = (AUTO_CHAIN[key] || []).slice(); if (typeof autoChainSave === 'function') autoChainSave(); }
  autoMetaSave();
  return nk;
}
function autoExport() {
  return JSON.stringify({ v: 1, state: AUTO_STATE, meta: AUTO_META,
    cond: (typeof AUTO_COND !== 'undefined' ? AUTO_COND : {}), chain: (typeof AUTO_CHAIN !== 'undefined' ? AUTO_CHAIN : {}),
    custom: (typeof AUTO_CUSTOM !== 'undefined' ? AUTO_CUSTOM : []),
    timer: (typeof AUTO_TIMER !== 'undefined' ? AUTO_TIMER : null), quiet: (typeof AUTO_QUIET !== 'undefined' ? AUTO_QUIET : null) }, null, 1);
}
function autoImport(json) {
  let o; try { o = JSON.parse(json); } catch (e) { return { ok: false, why: 'JSON לא תקין' }; }
  if (!o || typeof o !== 'object') return { ok: false, why: 'מבנה לא מוכר' };
  if (o.custom && typeof AUTO_CUSTOM !== 'undefined') o.custom.forEach(c => { if (!AUTO_CUSTOM.some(x => x.key === c.key)) AUTO_CUSTOM.push(c); });
  if (o.state) Object.assign(AUTO_STATE, o.state);
  if (o.meta) Object.assign(AUTO_META, o.meta);
  if (o.cond && typeof AUTO_COND !== 'undefined') Object.assign(AUTO_COND, o.cond);
  if (o.chain && typeof AUTO_CHAIN !== 'undefined') Object.assign(AUTO_CHAIN, o.chain);
  if (o.timer && typeof autoTimerSet === 'function') autoTimerSet(o.timer);
  if (o.quiet && typeof autoQuietSet === 'function') autoQuietSet(o.quiet);
  if (typeof autoSave === 'function') autoSave();
  if (typeof autoCondSave === 'function') autoCondSave();
  if (typeof autoChainSave === 'function') autoChainSave();
  autoMetaSave();
  return { ok: true, n: (o.custom || []).length };
}

/* ---------------- ריצה לפי טריגר, לפי עדיפות ---------------- */
function autoFireTrigger(trigger, ctx) {
  const list = (typeof autoAll === 'function' ? autoAll() : []).filter(a => a.trigger === trigger)
    .sort((a, b) => autoMeta(a.key).priority - autoMeta(b.key).priority);
  const ran = [];
  list.forEach(a => { if (autoFire(a.key, ctx)) ran.push(a.key); });
  return ran;
}
