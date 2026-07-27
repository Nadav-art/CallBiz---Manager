/* ============================================================
   אוטומציות — שכבת חוקים מתקדמת · מודול עצמאי
   ------------------------------------------------------------
   מוסיף מעל המנוע הבסיסי, והכול **כבוי כברירת מחדל**:

     1) תנאים על חוק   — "רק VIP", "רק סניף X", "רק מעל 1000 ₪"
     2) שרשור חוקים    — חוק שמפעיל חוק אחר בסיום מוצלח
     3) טיימר אמיתי    — סבב אוטומטי כל N דקות (במקום לחיצה ידנית)
     4) אסקלציה        — ליד שלא טופל X שעות עובר למנהל
     5) חלון שקט       — לא שולחים ללקוח בלילה/שבת; ההודעה ממתינה
     6) קיבולת         — התראה כשנגמרים התורים בסניף
   ============================================================ */

/* ---------------- 1) תנאים ---------------- */
const AUTO_FIELDS = [
  { key: 'priority', label: 'עדיפות הליד', get: c => (c.rec || {}).priority, opts: ['high', 'medium', 'low'],
    fmt: v => ({ high: 'גבוהה', medium: 'רגילה', low: 'נמוכה' }[v] || v) },
  { key: 'journey', label: 'סוג התהליך', get: c => (c.rec || {}).journey, opts: ['sales', 'support', 'complaint', 'retention', 'upsell'],
    fmt: v => ({ sales: 'מכירה', support: 'תמיכה', complaint: 'תלונה', retention: 'שימור', upsell: 'הרחבה' }[v] || v) },
  { key: 'branch', label: 'סניף מבוקש', get: c => ((c.rec || {}).needs || {}).branch,
    opts: () => (typeof COORD_BRANCHES !== 'undefined' ? COORD_BRANCHES.map(b => b.key) : []),
    fmt: v => { const b = (typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES.find(x => x.key === v) : null; return b ? (b.short || b.label) : v; } },
  { key: 'service', label: 'שירות שנבחר', get: c => ((c.rec || {}).services || [])[0],
    opts: () => (typeof COORD_TREATMENTS !== 'undefined' ? COORD_TREATMENTS.map(t => t.key) : []),
    fmt: v => { const t = (typeof cTreat === 'function') ? cTreat(v) : null; return t ? t.label : v; } },
  { key: 'amount', label: 'סכום העסקה (₪)', num: true,
    get: c => (c.hold && c.hold.price) || (typeof svcTotals === 'function' && ((c.rec || {}).services || []).length ? svcTotals(c.rec.services).price : 0) },
  { key: 'assignee', label: 'נציג מטפל', get: c => (c.rec || {}).assignee,
    opts: () => (typeof STAFF !== 'undefined' ? STAFF.map(s => s.name) : []), fmt: v => v },
  { key: 'vip', label: 'לקוח VIP', get: c => { const r = c.rec || {}; return (r.priority === 'high' || /vip/i.test(r.subject || '') || r.vip) ? 'yes' : 'no'; },
    opts: ['yes', 'no'], fmt: v => v === 'yes' ? 'כן' : 'לא' },
];
const AUTO_OPS = [
  { key: 'eq', label: 'שווה ל' }, { key: 'ne', label: 'שונה מ' },
  { key: 'gt', label: 'גדול מ', num: true }, { key: 'lt', label: 'קטן מ', num: true },
];
function autoFieldOf(k) { return AUTO_FIELDS.find(f => f.key === k) || AUTO_FIELDS[0]; }
function autoFieldOpts(f) { return typeof f.opts === 'function' ? f.opts() : (f.opts || []); }
let AUTO_COND = (function () { try { return JSON.parse(localStorage.getItem('cb_autoCond')) || {}; } catch (e) { return {}; } })();
function autoCondSave() { try { localStorage.setItem('cb_autoCond', JSON.stringify(AUTO_COND)); } catch (e) {} }
/* מבנה: [[c,c],[c]] — בתוך קבוצה "וגם", בין קבוצות "או".
   תאימות אחורה: רשימה שטוחה של תנאים נחשבת קבוצה אחת. */
function autoCondGroups(key) {
  const raw = AUTO_COND[key] || [];
  if (!raw.length) return [];
  return Array.isArray(raw[0]) ? raw : [raw];
}
function autoCondOf(key) { return autoCondGroups(key).reduce((a, g) => a.concat(g), []); }   /* שטוח — לספירה */
function autoCondSet(key, groups) {
  AUTO_COND[key] = groups.filter(g => g && g.length);
  if (!AUTO_COND[key].length) delete AUTO_COND[key];
  autoCondSave();
}
function autoCondAdd(key, field, op, val, gi) {
  const g = autoCondGroups(key).map(x => x.slice());
  const idx = (gi === undefined || gi === null || gi < 0 || gi >= g.length) ? (g.length ? g.length - 1 : 0) : gi;
  if (!g[idx]) g[idx] = [];
  g[idx].push({ field: field, op: op, val: val });
  autoCondSet(key, g);
}
function autoCondAddGroup(key, field, op, val) {
  const g = autoCondGroups(key).map(x => x.slice());
  g.push([{ field: field, op: op, val: val }]);
  autoCondSet(key, g);
}
function autoCondDel(key, gi, ci) {
  const g = autoCondGroups(key).map(x => x.slice());
  if (ci === undefined) {                       /* תאימות: מחיקה לפי אינדקס שטוח */
    let n = gi;
    for (let i = 0; i < g.length; i++) { if (n < g[i].length) { g[i].splice(n, 1); break; } n -= g[i].length; }
  } else if (g[gi]) g[gi].splice(ci, 1);
  autoCondSet(key, g);
}
function autoCondText(c) {
  const f = autoFieldOf(c.field), o = AUTO_OPS.find(x => x.key === c.op) || AUTO_OPS[0];
  return f.label + ' ' + o.label + ' ' + autoCondVal(f, c.val);
}
/* ערך התנאי כטקסט. אם הערך כבר לא קיים ברשימה (נציג שעזב, שירות ששמו שונה) —
   מציגים את הערך הגולמי ומסמנים, במקום "undefined" */
function autoCondVal(f, v) {
  if (v === undefined || v === null || v === '') return '—';
  let out; try { out = f && f.fmt ? f.fmt(v) : v; } catch (e) { out = null; }
  if (out === undefined || out === null || out === '') return String(v) + ' (ערך שאינו ברשימה)';
  return String(out);
}
/* האם החוק עומד בכל התנאים */
function autoCondOne(c, ctx) {
  const f = autoFieldOf(c.field);
  let v = null; try { v = f.get(ctx || {}); } catch (e) { v = null; }
  let ok;
  if (c.op === 'gt') ok = (+v || 0) > (+c.val || 0);
  else if (c.op === 'lt') ok = (+v || 0) < (+c.val || 0);
  else if (c.op === 'ne') ok = String(v == null ? '' : v) !== String(c.val);
  else ok = String(v == null ? '' : v) === String(c.val);
  return { ok: ok, actual: (f.fmt ? f.fmt(v) : (v == null || v === '' ? 'ריק' : v)) };
}
/* בתוך קבוצה — הכול חייב להתקיים · בין קבוצות — מספיק שאחת מתקיימת */
function autoCondPass(key, ctx) {
  const groups = autoCondGroups(key);
  if (!groups.length) return { ok: true, why: '' };
  const fails = [];
  for (let g = 0; g < groups.length; g++) {
    let all = true, firstFail = null;
    for (let i = 0; i < groups[g].length; i++) {
      const c = groups[g][i], r = autoCondOne(c, ctx);
      if (!r.ok) { all = false; if (!firstFail) firstFail = autoCondText(c) + ' (בפועל: ' + autoCondVal(autoFieldOf(c.field), r.actual) + ')'; break; }
    }
    if (all) return { ok: true, why: '' };
    fails.push(firstFail);
  }
  return { ok: false, why: groups.length > 1
    ? 'אף אחד מהמצבים לא מתקיים · ' + fails.filter(Boolean).join(' · או · ')
    : 'לא עומד בתנאי: ' + (fails[0] || '') };
}

/* ---------------- 2) שרשור ---------------- */
let AUTO_CHAIN = (function () { try { return JSON.parse(localStorage.getItem('cb_autoChain')) || {}; } catch (e) { return {}; } })();
function autoChainSave() { try { localStorage.setItem('cb_autoChain', JSON.stringify(AUTO_CHAIN)); } catch (e) {} }
function autoChainOf(key) { return AUTO_CHAIN[key] || []; }
function autoChainToggle(key, target) {
  const a = autoChainOf(key).slice(); const i = a.indexOf(target);
  if (i >= 0) a.splice(i, 1); else a.push(target);
  AUTO_CHAIN[key] = a; autoChainSave();
}
let autoChainDepth = 0;
function autoRunChain(key, ctx) {
  const list = autoChainOf(key); if (!list.length || autoChainDepth > 2) return;
  autoChainDepth++;
  try { list.forEach(k => { if (k !== key) autoFire(k, ctx, true); }); } finally { autoChainDepth--; }
}

/* ---------------- 3) טיימר ---------------- */
const AUTO_TIMER_DEF = { on: false, everyMin: 5 };
let AUTO_TIMER = (function () { try { return Object.assign({}, AUTO_TIMER_DEF, JSON.parse(localStorage.getItem('cb_autoTimer')) || {}); } catch (e) { return Object.assign({}, AUTO_TIMER_DEF); } })();
let autoTimerHandle = null;
function autoTimerSave() { try { localStorage.setItem('cb_autoTimer', JSON.stringify(AUTO_TIMER)); } catch (e) {} }
function autoTimerApply() {
  if (autoTimerHandle) { clearInterval(autoTimerHandle); autoTimerHandle = null; }
  if (AUTO_TIMER.on) autoTimerHandle = setInterval(() => {
    const res = autoTick(false);
    if (res.length && typeof renderAutomationsScreen === 'function' && document.querySelector('.auto-cols')) renderAutomationsScreen();
  }, Math.max(1, +AUTO_TIMER.everyMin || 5) * 60000);
}
function autoTimerSet(patch) { Object.assign(AUTO_TIMER, patch); autoTimerSave(); autoTimerApply(); }

/* ---------------- 5) חלון שקט ---------------- */
const AUTO_QUIET_DEF = { on: false, from: 21, to: 8, sat: true };
let AUTO_QUIET = (function () { try { return Object.assign({}, AUTO_QUIET_DEF, JSON.parse(localStorage.getItem('cb_autoQuiet')) || {}); } catch (e) { return Object.assign({}, AUTO_QUIET_DEF); } })();
let AUTO_QUEUE = [];
function autoQuietSave() { try { localStorage.setItem('cb_autoQuiet', JSON.stringify(AUTO_QUIET)); } catch (e) {} }
function autoQuietSet(patch) { Object.assign(AUTO_QUIET, patch); autoQuietSave(); }
function autoInQuiet() {
  if (!AUTO_QUIET.on) return false;
  const h = (typeof nowHM === 'function') ? Math.floor(nowHM() / 60) : new Date().getHours();
  const d = (typeof clockTodayDate === 'function') ? clockTodayDate().getDay() : new Date().getDay();
  if (AUTO_QUIET.sat && d === 6) return true;
  const f = +AUTO_QUIET.from, t = +AUTO_QUIET.to;
  return f > t ? (h >= f || h < t) : (h >= f && h < t);
}
/* שליחה ללקוח — מכבדת את החלון השקט */
function autoSendToCustomer(title, body, kind) {
  if (autoInQuiet()) {
    AUTO_QUEUE.unshift({ title: title, body: body, kind: kind, at: (typeof autoStamp === 'function') ? autoStamp() : '' });
    if (AUTO_QUEUE.length > 20) AUTO_QUEUE.length = 20;
    return ' · נדחה לחלון השקט (יישלח ב-' + AUTO_QUIET.to + ':00)';
  }
  if (typeof autoNotify === 'function') autoNotify(title, body, kind);
  return '';
}
function autoQuietFlush() {
  const n = AUTO_QUEUE.length;
  AUTO_QUEUE.slice().reverse().forEach(m => { if (typeof autoNotify === 'function') autoNotify(m.title, m.body, m.kind); });
  AUTO_QUEUE = [];
  return n;
}

/* ---------------- 4+6) חוקים חדשים: אסקלציה וקיבולת ---------------- */
const AUTO_ESC_DEF = { hours: 4, to: 'manager', act: 'notify' };
/* מה עושים כשליד נתקע — ברירת המחדל היא התראה בלבד; הליד נשאר אצל הנציג */
const AUTO_ESC_ACTS = [
  { key: 'notify', label: 'התראה למנהל בלבד', desc: 'המנהל רואה שהליד נתקע. הליד נשאר אצל הנציג שאחראי עליו.' },
  { key: 'both', label: 'התראה למנהל + תזכורת לנציג', desc: 'גם המנהל וגם הנציג שמטפל בליד מקבלים התראה.' },
  { key: 'transfer', label: 'להעביר את הליד למנהל', desc: 'המנהל הופך לאחראי על הליד בפועל. לרוב לא מומלץ.' },
];
let AUTO_ESC = (function () { try { return Object.assign({}, AUTO_ESC_DEF, JSON.parse(localStorage.getItem('cb_autoEsc')) || {}); } catch (e) { return Object.assign({}, AUTO_ESC_DEF); } })();
function autoEscSet(patch) { Object.assign(AUTO_ESC, patch); try { localStorage.setItem('cb_autoEsc', JSON.stringify(AUTO_ESC)); } catch (e) {} }
const AUTO_CAP_DEF = { min: 3 };
let AUTO_CAP = (function () { try { return Object.assign({}, AUTO_CAP_DEF, JSON.parse(localStorage.getItem('cb_autoCap')) || {}); } catch (e) { return Object.assign({}, AUTO_CAP_DEF); } })();
function autoCapSet(patch) { Object.assign(AUTO_CAP, patch); try { localStorage.setItem('cb_autoCap', JSON.stringify(AUTO_CAP)); } catch (e) {} }

if (typeof AUTOMATIONS !== 'undefined' && !AUTOMATIONS.some(a => a.key === 'a8')) {
  AUTOMATIONS.push(
    { key: 'a8', trigger: 'ליד שלא טופל', title: 'התראה למנהל על ליד שנתקע', desc: 'ליד שעבר את הזמן — המנהל מקבל התראה. הליד נשאר אצל הנציג', on: false },
    { key: 'a9', trigger: 'קיבולת נמוכה', title: 'התראת קיבולת בסניף', desc: 'כשנותרו מעט תורים פנויים בסניף — התראה למנהל', on: false });
}
if (typeof AUTO_IMPL !== 'undefined') {
  AUTO_IMPL.a8 = {
    what: 'ליד שעבר את הזמן שהוגדר בלי שטיפלו בו — המנהל מקבל התראה והליד מסומן במסך כ"נתקע". הליד עצמו נשאר אצל הנציג שאחראי עליו.',
    cfg: 'autoEscCfgHTML', cfgBind: 'autoEscCfgBind',
    run: ctx => {
      const list = ((typeof RECORDS !== 'undefined') ? RECORDS : []).filter(r => !r.done && (typeof recIsOverdue === 'function') && recIsOverdue(r));
      const due = list.filter(r => autoOverdueMins(r) >= (+AUTO_ESC.hours || 4) * 60);
      const pick = ctx.rec && due.indexOf(ctx.rec) >= 0 ? [ctx.rec] : due.slice(0, 3);
      if (!pick.length) return 'אין לידים שעברו ' + AUTO_ESC.hours + ' שעות ללא טיפול — לא בוצע';
      const act = AUTO_ESC.act || 'notify';
      const mgr = (typeof STAFF !== 'undefined') ? STAFF.find(x => /מנהל/.test(x.perm || '') || /מנהל/.test(x.role || '')) : null;
      pick.forEach(r => {
        r.stuck = true;                                   /* סימון במסך — לא שינוי בעלות */
        r.stuckAt = (typeof autoStamp === 'function') ? autoStamp() : '';
        r.stuckMins = autoOverdueMins(r);
        if (typeof autoNotify === 'function') {
          autoNotify('ליד שנתקע — דורש מעקב', r.name + ' · ' + Math.round(r.stuckMins / 60) + ' שעות ללא טיפול · אחראי: ' + (r.assignee || 'לא משויך'), 'reminder');
          if (act === 'both' && r.assignee) autoNotify('תזכורת: ליד ממתין', r.name + ' ממתין ' + Math.round(r.stuckMins / 60) + ' שעות — נא לחזור אליו', 'reminder');
        }
        if (act === 'transfer' && mgr) { r.escalated = true; r.assignee = mgr.name; }
      });
      const names = pick.map(r => r.name).join(' · ');
      if (act === 'transfer') return pick.length + ' לידים הועברו ל' + (mgr ? mgr.name : 'מנהל') + ': ' + names;
      return 'התראה' + (act === 'both' ? ' למנהל ולנציגים' : ' למנהל') + ' על ' + pick.length + ' לידים שנתקעו (מעל ' + AUTO_ESC.hours + ' שעות): ' + names;
    } };
  AUTO_IMPL.a9 = {
    what: 'סורק את זמינות התורים בכל סניף; כשנותרו פחות מהמינימום שהוגדר — התראה למנהל כדי לפתוח משבצות.',
    cfg: 'autoCapCfgHTML', cfgBind: 'autoCapCfgBind',
    run: () => {
      if (typeof coordPool !== 'function' || typeof COORD_BRANCHES === 'undefined') return '';
      const free = {};
      coordPool().filter(s => !s.booked && !s.held && !(typeof coordIsPast === 'function' && coordIsPast(s)))
        .forEach(s => { free[s.branch] = (free[s.branch] || 0) + 1; });
      const low = COORD_BRANCHES.filter(b => b.active !== false).map(b => ({ b: b, n: free[b.key] || 0 }))
        .filter(x => x.n < (+AUTO_CAP.min || 3));
      if (!low.length) return 'כל הסניפים מעל המינימום (' + AUTO_CAP.min + ') — לא בוצע';
      low.forEach(x => { if (typeof autoNotify === 'function') autoNotify('קיבולת נמוכה בסניף', (x.b.short || x.b.label) + ' · נותרו ' + x.n + ' תורים פנויים', 'reminder'); });
      return 'התראה על ' + low.length + ' סניפים מתחת ל-' + AUTO_CAP.min + ': ' + low.map(x => (x.b.short || x.b.label) + ' (' + x.n + ')').join(' · ');
    } };
}
/* כמה דקות הליד באיחור — overdueMins, ואם אינו זמין: SLA שלילי או הטקסט של הפעולה הבאה */
function autoOverdueMins(r) {
  const m = (typeof overdueMins === 'function') ? overdueMins(r) : null;
  if (m != null && !isNaN(m)) return m;
  if (r.sla && typeof r.sla.mins === 'number' && r.sla.mins < 0) return -r.sla.mins;
  const t = (r.next && r.next.at) || '';
  const hh = /(\d+)\s*שע/.exec(t); if (hh) return +hh[1] * 60;
  const dd = /(\d+)\s*(?:ימים|יום)/.exec(t); if (dd) return +dd[1] * 1440;
  const mm = /(\d+)\s*דק/.exec(t); if (mm) return +mm[1];
  return 0;
}

/* הגדרות של a8 / a9 */
function autoEscCfgHTML() {
  const a = AUTO_ESC.act || 'notify';
  const set = (typeof apSet === 'function') ? apSet : (l, h, c) => '<div class="ap-set"><div class="ap-set-h"><b>' + l + '</b><small>' + h + '</small></div><div class="ap-set-c">' + c + '</div></div>';
  return `<div class="rt-cfg">
    ${set('אחרי כמה זמן זה נחשב "נתקע"?', 'מספר השעות שליד יכול לחכות בלי שאף אחד יטפל בו, לפני שיוצאת התראה.',
      `<div class="ap-hours"><input class="cc-inp sm" type="number" min="1" max="72" id="escH" value="${+AUTO_ESC.hours || 4}"><span>שעות</span></div>`)}
    ${set('מה לעשות אז?', 'ברירת המחדל: רק להתריע. הליד ממשיך להיות באחריות אותו נציג.',
      `<div class="rt-methods">${AUTO_ESC_ACTS.map(x => `<button class="rt-m ${a === x.key ? 'on' : ''}" data-esca="${x.key}">
        <b>${x.label}</b><small>${x.desc}</small></button>`).join('')}</div>`)}
    <p class="cr-hint">${ic('bolt')} הליד מסומן במסך העבודה כ"נתקע" כדי שיהיה קל לראות אותו — גם בלי להעביר אותו לאף אחד.</p>
  </div>`;
}
function autoEscCfgBind(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const h = $('#escH'); if (h) h.addEventListener('change', () => { autoEscSet({ hours: Math.max(1, +h.value || 4) }); RR(); });
  $$('[data-esca]').forEach(b => b.addEventListener('click', () => { autoEscSet({ act: b.dataset.esca }); RR(); }));
}
function autoCapCfgHTML() {
  return `<div class="rt-cfg">
    <div class="rt-h">${ic('layers')} <b>מתי להתריע?</b></div>
    <label class="rt-row num"><span>כשנשארו פחות מ־</span>
      <input class="cc-inp sm" type="number" min="1" max="50" id="capMin" value="${+AUTO_CAP.min || 3}"></label>
    <p class="cr-hint">${ic('alert')} נבדק בכל סבב מועדים ואחרי כל קביעת תור.</p>
  </div>`;
}
function autoCapCfgBind(rerender) { const c = $('#capMin'); if (c) c.addEventListener('change', () => { autoCapSet({ min: Math.max(1, +c.value || 3) }); if (rerender) rerender(); }); }

/* ---------------- עורך התנאים והשרשור (מוטמע בפאנל החוק) ---------------- */
function autoRuleExtraHTML(key) {
  const conds = autoCondOf(key), chain = autoChainOf(key);
  const others = (typeof autoAll === 'function' ? autoAll() : []).filter(a => a.key !== key);
  const f0 = AUTO_FIELDS[0];
  return `<div class="ar-extra">
    <div class="rt-h">${ic('filter')} <b>תנאים — מתי החוק בכלל ירוץ</b></div>
    ${conds.length ? `<div class="ar-conds">${conds.map((c, i) => `<span class="ar-cond">${esc(autoCondText(c))}
      <button data-acdel="${i}">${ic('close')}</button></span>`).join('')}</div>`
      : `<p class="ar-none">${ic('check')} ללא תנאים — החוק ירוץ בכל פעם שהטריגר קורה.</p>`}
    <div class="ar-add">
      <select class="cc-inp sm" id="acField">${AUTO_FIELDS.map(f => `<option value="${f.key}">${f.label}</option>`).join('')}</select>
      <select class="cc-inp sm" id="acOp">${AUTO_OPS.map(o => `<option value="${o.key}">${o.label}</option>`).join('')}</select>
      <span id="acValWrap">${autoCondValHTML(f0)}</span>
      <button class="btn xs primary" id="acAdd">${ic('plus')} הוסף תנאי</button>
    </div>

    <div class="rt-h">${ic('layers')} <b>שרשור — מה לרוץ אחרי שהחוק הצליח</b></div>
    <div class="ar-chain">${others.map(a => `<button class="cq-chip ${chain.indexOf(a.key) >= 0 ? 'on' : ''}" data-acchain="${esc(a.key)}">${esc(a.title)}</button>`).join('')}</div>
    ${chain.length ? `<p class="cr-hint">${ic('bolt')} אחרי הצלחה יורצו: <b>${chain.map(k => { const d = autoDef(k); return esc(d ? d.title : k); }).join(' → ')}</b></p>` : ''}
  </div>`;
}
function autoCondValHTML(f) {
  if (f.num) return `<input class="cc-inp sm" type="number" id="acVal" placeholder="0" style="width:90px">`;
  const opts = autoFieldOpts(f);
  return `<select class="cc-inp sm" id="acVal">${opts.map(o => `<option value="${esc(o)}">${esc(f.fmt ? f.fmt(o) : o)}</option>`).join('')}</select>`;
}
function autoRuleExtraBind(key, rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const fs = $('#acField');
  if (fs) fs.addEventListener('change', () => { const w = $('#acValWrap'); if (w) w.innerHTML = autoCondValHTML(autoFieldOf(fs.value)); });
  const ad = $('#acAdd'); if (ad) ad.addEventListener('click', () => {
    const f = ($('#acField') || {}).value, o = ($('#acOp') || {}).value, v = ($('#acVal') || {}).value;
    if (v === undefined || v === '') { toast('נא לבחור ערך'); return; }
    autoCondAdd(key, f, o, v); RR();
  });
  $$('[data-acdel]').forEach(b => b.addEventListener('click', () => { autoCondDel(key, +b.dataset.acdel); RR(); }));
  $$('[data-acchain]').forEach(b => b.addEventListener('click', () => { autoChainToggle(key, b.dataset.acchain); RR(); }));
}

/* ---------------- כרטיס ההגדרות הגלובליות (טיימר + חלון שקט) ---------------- */
function autoGlobalHTML() {
  return `<section class="card auto-global">
    <div class="card-head"><div class="title">${ic('settings')} הגדרות כלליות</div>
      <span class="muted" style="font-size:11.5px">חל על כל האוטומציות</span></div>
    <div class="ag-body">
      <div class="ag-box ${AUTO_TIMER.on ? 'on' : ''}">
        <label class="ag-top"><span class="toggle wh-toggle ${AUTO_TIMER.on ? 'on' : ''}" data-agtimer role="button" tabindex="0"><i></i></span>
          <b>${ic('sync')} בדיקה אוטומטית כל כמה דקות</b></label>
        <p>המערכת תבדוק לבד מי צריך תזכורת, איזה ליד נתקע ואיפה נגמרו התורים — בלי שתצטרכו ללחוץ.</p>
        ${AUTO_TIMER.on ? `<label class="rt-row num"><span>כל</span>
          <input class="cc-inp sm" type="number" min="1" max="120" id="agEvery" value="${AUTO_TIMER.everyMin}"><small class="muted">דקות</small></label>` : ''}
      </div>
      <div class="ag-box ${AUTO_QUIET.on ? 'on' : ''}">
        <label class="ag-top"><span class="toggle wh-toggle ${AUTO_QUIET.on ? 'on' : ''}" data-agquiet role="button" tabindex="0"><i></i></span>
          <b>${ic('pause')} לא להפריע ללקוחות בשעות מסוימות</b></label>
        <p>הודעות שאמורות לצאת בלילה או בשבת ימתינו, וישלחו אוטומטית כשהחלון נסגר.</p>
        ${AUTO_QUIET.on ? `<div class="ag-quiet">
          <label class="rt-row num"><span>מ־</span><input class="cc-inp sm" type="number" min="0" max="23" id="agQFrom" value="${AUTO_QUIET.from}">
            <span>עד</span><input class="cc-inp sm" type="number" min="0" max="23" id="agQTo" value="${AUTO_QUIET.to}"></label>
          <label class="rt-row"><input type="checkbox" id="agQSat" ${AUTO_QUIET.sat ? 'checked' : ''}><span>גם בשבת</span></label>
          <div class="ag-qstat">${autoInQuiet() ? `${ic('pause')} <b>כרגע בחלון שקט</b>` : `${ic('check')} כרגע מחוץ לחלון`}
            ${AUTO_QUEUE.length ? `<span class="ag-qn">${AUTO_QUEUE.length} הודעות ממתינות</span>
              <button class="btn xs" id="agFlush">שחרר עכשיו</button>` : ''}</div>
        </div>` : ''}
      </div>
    </div>
  </section>`;
}
function autoGlobalBind(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const t = $('[data-agtimer]'); if (t) t.addEventListener('click', () => { autoTimerSet({ on: !AUTO_TIMER.on }); RR();
    toast(AUTO_TIMER.on ? 'הסבב האוטומטי הופעל · כל ' + AUTO_TIMER.everyMin + ' דקות' : 'הסבב האוטומטי כובה'); });
  const e = $('#agEvery'); if (e) e.addEventListener('change', () => { autoTimerSet({ everyMin: Math.max(1, +e.value || 5) }); RR(); });
  const q = $('[data-agquiet]'); if (q) q.addEventListener('click', () => { autoQuietSet({ on: !AUTO_QUIET.on }); RR(); });
  const qf = $('#agQFrom'); if (qf) qf.addEventListener('change', () => { autoQuietSet({ from: Math.max(0, Math.min(23, +qf.value || 21)) }); RR(); });
  const qt = $('#agQTo'); if (qt) qt.addEventListener('change', () => { autoQuietSet({ to: Math.max(0, Math.min(23, +qt.value || 8)) }); RR(); });
  const qs = $('#agQSat'); if (qs) qs.addEventListener('change', () => { autoQuietSet({ sat: qs.checked }); RR(); });
  const fl = $('#agFlush'); if (fl) fl.addEventListener('click', () => { const n = autoQuietFlush(); RR(); toast(n + ' הודעות שוחררו'); });
}


/* ============================================================
   תזמון שיחת המשך לליד חדש — לפי היומן, לא שעה קבועה
   ============================================================ */
const AUTO_FU_DEF = { mode: 'calendar', delayMin: 30, hoursOnly: true };
let AUTO_FU = (function () { try { return Object.assign({}, AUTO_FU_DEF, JSON.parse(localStorage.getItem('cb_autoFu')) || {}); }
  catch (e) { return Object.assign({}, AUTO_FU_DEF); } })();
function autoFuSet(patch) { Object.assign(AUTO_FU, patch); try { localStorage.setItem('cb_autoFu', JSON.stringify(AUTO_FU)); } catch (e) {} }
const AUTO_FU_MODES = [
  { key: 'calendar', label: 'החלון הפנוי הבא ביומן', desc: 'מוצא את הזמן הפנוי הקרוב אצל הנציג שקיבל את הליד' },
  { key: 'delay', label: 'זמן קבוע מרגע הכניסה', desc: 'למשל: לחזור תוך 30 דקות' },
];
/* שעות הפעילות מתוך לוח העבודה (או 08:00–18:00 כברירת מחדל) */
function autoBizWindow() {
  if (typeof workSchedule === 'undefined') return { from: 8, to: 18 };
  const on = workSchedule.filter(d => d.on && (d.segments || []).length);
  if (!on.length) return { from: 8, to: 18 };
  const mins = t => { const m = /(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 0; };
  const first = Math.min.apply(null, on.map(d => mins(d.segments[0].start)));
  const last = Math.max.apply(null, on.map(d => mins(d.segments[d.segments.length - 1].end)));
  return { from: Math.floor(first / 60), to: Math.ceil(last / 60) };
}
function autoFuFmt(dayOffset, hm) {
  const hh = String(Math.floor(hm / 60)).padStart(2, '0') + ':' + String(hm % 60).padStart(2, '0');
  return (dayOffset === 0 ? 'היום ' : dayOffset === 1 ? 'מחר ' : 'בעוד ' + dayOffset + ' ימים ') + hh;
}
/* מתי לחזור ללקוח — מחזיר {at, why} */
function autoFuSchedule(r) {
  const biz = autoBizWindow();
  const now = (typeof nowHM === 'function') ? nowHM() : 9 * 60;
  // 1) לפי היומן — המשבצת הפנויה הקרובה של הנציג שקיבל את הליד
  if (AUTO_FU.mode === 'calendar' && typeof coordPool === 'function') {
    const staff = (typeof STAFF !== 'undefined') ? STAFF.find(x => x.name === r.assignee) : null;
    const today = (typeof clockTodayISO === 'function') ? clockTodayISO() : '';
    const pool = coordPool().filter(sl => !sl.booked && !sl.held
      && (!staff || sl.doc === staff.id)
      && !(typeof coordIsPast === 'function' && coordIsPast(sl)))
      .sort((a, b) => a.date === b.date ? a.h - b.h : a.date.localeCompare(b.date));
    if (pool.length) {
      const sl = pool[0];
      const hm = Math.round(sl.h * 60);
      const d0 = (typeof rotParse === 'function') ? rotParse(today) : null;
      const d1 = (typeof rotParse === 'function') ? rotParse(sl.date) : null;
      const off = (d0 && d1) ? Math.round((d1 - d0) / 86400000) : 0;
      return { at: autoFuFmt(off, hm), why: 'החלון הפנוי הבא' + (staff ? ' אצל ' + staff.name : '') };
    }
  }
  // 2) זמן קבוע — ומוזז לשעות הפעילות אם צריך
  let hm = now + (+AUTO_FU.delayMin || 30), off = 0;
  if (AUTO_FU.hoursOnly) {
    if (hm < biz.from * 60) hm = biz.from * 60;
    if (hm >= biz.to * 60) { off = 1; hm = biz.from * 60; }
  }
  if (hm >= 24 * 60) { off += Math.floor(hm / (24 * 60)); hm = hm % (24 * 60); }
  return { at: autoFuFmt(off, hm),
    why: AUTO_FU.mode === 'calendar' ? 'אין חלון פנוי ביומן — תוך ' + AUTO_FU.delayMin + ' דק׳'
      : 'תוך ' + AUTO_FU.delayMin + ' דק׳' + (off ? ' · הוזז לשעות הפעילות' : '') };
}
/* הגדרות החוק */
function autoFuCfgHTML() {
  const c = AUTO_FU, biz = autoBizWindow();
  const set = (typeof apSet === 'function') ? apSet
    : (l, h, ctrl) => `<div class="ap-set"><div class="ap-set-h"><b>${l}</b><small>${h}</small></div><div class="ap-set-c">${ctrl}</div></div>`;
  return `<div class="rt-cfg">
    ${set('מתי לחזור ללקוח?', 'המערכת קובעת מועד אוטומטית ברגע שהליד נכנס — כדי ששום פנייה לא תישכח.',
      `<div class="rt-methods">${AUTO_FU_MODES.map(m => `<button class="rt-m ${c.mode === m.key ? 'on' : ''}" data-fum="${m.key}">
        <b>${m.label}</b><small>${m.desc}</small></button>`).join('')}</div>`)}
    ${set('תוך כמה זמן לכל היותר?', 'אם אין חלון פנוי ביומן — זה המרווח שייקבע מרגע כניסת הליד.',
      `<div class="ap-hours"><input class="cc-inp sm" type="number" min="5" max="1440" id="fuDelay" value="${c.delayMin}"><span>דקות</span></div>`)}
    ${set('רק בשעות הפעילות', `שעות הפעילות שלכם: ${biz.from}:00–${biz.to}:00. ליד שנכנס בלילה יתוזמן לבוקר.`,
      `<label class="rt-row"><input type="checkbox" id="fuHours" ${c.hoursOnly ? 'checked' : ''}><span>כן, לא לתזמן מחוץ לשעות</span></label>`)}
    <div class="rt-sim">${ic('bolt')} <b>בדיקה — ליד שנכנס עכשיו יתוזמן ל:</b>
      <span>${esc((function () { const r = (typeof autoDemoLead === 'function') ? autoDemoLead() : null;
        if (!r) return '—'; const x = autoFuSchedule(r); return x.at + ' · ' + x.why; })())}</span></div>
  </div>`;
}
function autoFuCfgBind(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  $$('[data-fum]').forEach(b => b.addEventListener('click', () => { autoFuSet({ mode: b.dataset.fum }); RR(); }));
  const d = $('#fuDelay'); if (d) d.addEventListener('change', () => { autoFuSet({ delayMin: Math.max(5, +d.value || 30) }); RR(); });
  const h = $('#fuHours'); if (h) h.addEventListener('change', () => { autoFuSet({ hoursOnly: h.checked }); RR(); });
}
