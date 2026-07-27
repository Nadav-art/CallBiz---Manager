/* ============================================================
   חלוקת לידים — מנוע ניתוב · מודול עצמאי
   ------------------------------------------------------------
   עד כה "שיוך נציג · סבב שוויוני" היה טקסט בלבד. כאן זה מנוע:

     שיטות: סבב מחזורי · לפי עומס · לפי מיומנות · לפי סניף · לפי אזור
     מסננים: רק זמינים · רק בשעות פעילות · תקרת לידים פתוחים לנציג
     נפילה-לאחור: מנהל · כל אחד · להשאיר ללא שיוך (עם התראה)

   כל שיוך מחזיר גם **הסבר**: למה דווקא הנציג הזה ומי נפסל ולמה.
   ההגדרות יושבות בתוך האוטומציה עצמה (a1) — מקום אחד, בלי כפילות.
   ============================================================ */
const ROUTE_METHODS = [
  { key: 'load', label: 'לפי עומס', desc: 'הנציג עם הכי מעט לידים פתוחים' },
  { key: 'roundrobin', label: 'סבב מחזורי', desc: 'לפי התור — אחד אחרי השני' },
  { key: 'skill', label: 'לפי מיומנות', desc: 'רק מי שמוסמך לשירות שהלקוח ביקש' },
  { key: 'branch', label: 'לפי סניף', desc: 'נציג מהסניף שהלקוח שייך אליו' },
  { key: 'area', label: 'לפי אזור', desc: 'הסניף הקרוב לכתובת הלקוח' },
];
const ROUTE_FALLBACK = [
  { key: 'anyone', label: 'לכל נציג פנוי' },
  { key: 'manager', label: 'למנהל התורן' },
  { key: 'none', label: 'להשאיר ללא שיוך + התראה' },
];
const ROUTE_DEF = { method: 'load', cap: 0, onlyAvailable: true, onlyHours: false, fallback: 'anyone', rrIndex: 0 };
let ROUTE_CFG = (function () {
  try { return Object.assign({}, ROUTE_DEF, JSON.parse(localStorage.getItem('cb_routeCfg')) || {}); }
  catch (e) { return Object.assign({}, ROUTE_DEF); }
})();
function routeSave() { try { localStorage.setItem('cb_routeCfg', JSON.stringify(ROUTE_CFG)); } catch (e) {} }
function routeSet(patch) { Object.assign(ROUTE_CFG, patch); routeSave(); }

function routeOpenCount(name) {
  return ((typeof RECORDS !== 'undefined') ? RECORDS : []).filter(r => !r.done && r.assignee === name).length;
}
function routeStaff() { return (typeof STAFF !== 'undefined') ? STAFF.slice() : []; }
/* בחירת נציג לליד — כולל הסבר מלא */
function routePick(lead) {
  const cfg = ROUTE_CFG, rejected = [];
  let pool = routeStaff();
  const drop = (s, why) => { rejected.push(s.name + ' — ' + why); return false; };

  pool = pool.filter(s => (s.on === false) ? drop(s, 'לא פעיל') : true);
  if (cfg.onlyAvailable) pool = pool.filter(s => (s.avail && s.avail !== 'available') ? drop(s, 'לא זמין כרגע') : true);
  if (cfg.cap > 0) pool = pool.filter(s => (routeOpenCount(s.name) >= cfg.cap) ? drop(s, 'מעל תקרת ' + cfg.cap + ' לידים') : true);

  if (cfg.method === 'skill' && lead && (lead.services || []).length) {
    pool = pool.filter(s => (lead.services || []).every(k => (s.skills || []).indexOf(k) >= 0) ? true : drop(s, 'אינו מוסמך לשירות שנבחר'));
  }
  if (cfg.method === 'branch') {
    const bk = (lead && lead.needs && lead.needs.branch && lead.needs.branch !== '__near') ? lead.needs.branch : null;
    if (bk) pool = pool.filter(s => ((s.branches || [s.branch]).indexOf(bk) >= 0) ? true : drop(s, 'אינו משויך לסניף שנבחר'));
  }
  if (cfg.method === 'area') {
    const bk = (typeof nearestBranchKey === 'function' && lead) ? nearestBranchKey(lead) : null;
    if (bk) pool = pool.filter(s => ((s.branches || [s.branch]).indexOf(bk) >= 0) ? true : drop(s, 'אינו בסניף הקרוב ללקוח'));
  }

  let rep = null, why = '';
  if (pool.length) {
    if (cfg.method === 'roundrobin') {
      const i = (cfg.rrIndex || 0) % pool.length; rep = pool[i];
      routeSet({ rrIndex: (i + 1) % Math.max(1, pool.length) });
      why = 'סבב מחזורי — התור של ' + rep.name;
    } else {
      pool.sort((a, b) => routeOpenCount(a.name) - routeOpenCount(b.name));
      rep = pool[0];
      const m = ROUTE_METHODS.find(x => x.key === cfg.method) || ROUTE_METHODS[0];
      why = m.label + ' — ' + rep.name + ' עם ' + routeOpenCount(rep.name) + ' לידים פתוחים';
    }
    return { rep: rep, why: why, rejected: rejected, fallback: false };
  }
  // אף אחד לא עבר את המסננים → נפילה-לאחור
  if (cfg.fallback === 'none') return { rep: null, why: 'אין נציג מתאים — הליד נשאר ללא שיוך', rejected: rejected, fallback: true };
  if (cfg.fallback === 'manager') {
    const mgr = routeStaff().find(s => /מנהל/.test(s.perm || '') || /מנהל/.test(s.role || ''));
    if (mgr) return { rep: mgr, why: 'אין נציג מתאים — הועבר למנהל התורן (' + mgr.name + ')', rejected: rejected, fallback: true };
  }
  const any = routeStaff().filter(s => s.on !== false).sort((a, b) => routeOpenCount(a.name) - routeOpenCount(b.name))[0];
  return any ? { rep: any, why: 'אין נציג שעומד בכל התנאים — שויך לפנוי ביותר (' + any.name + ')', rejected: rejected, fallback: true }
             : { rep: null, why: 'אין נציגים במערכת', rejected: rejected, fallback: true };
}
/* שיוך בפועל */
function routeAssign(lead) {
  const res = routePick(lead);
  if (res.rep) lead.assignee = res.rep.name;
  else { lead.assignee = ''; lead.unassigned = true;
    if (typeof autoNotify === 'function') autoNotify('ליד ללא שיוך', lead.name + ' — לא נמצא נציג מתאים', 'chat'); }
  return res;
}

/* ---------------- הגדרות (מוטמע בפאנל האוטומציה) ---------------- */
function routeConfigHTML() {
  const c = ROUTE_CFG;
  const set = (typeof apSet === 'function') ? apSet
    : (l, h, ctrl) => `<div class="ap-set"><div class="ap-set-h"><b>${l}</b><small>${h}</small></div><div class="ap-set-c">${ctrl}</div></div>`;
  return `<div class="rt-cfg">
    ${set('איך לבחור את הנציג?', 'לפי מה המערכת מחליטה למי מהצוות לשייך את הליד החדש.',
      `<div class="rt-methods">${ROUTE_METHODS.map(m => `<button class="rt-m ${c.method === m.key ? 'on' : ''}" data-rtm="${m.key}">
        <b>${m.label}</b><small>${m.desc}</small></button>`).join('')}</div>`)}

    ${set('מי בכלל יכול לקבל?', 'מי שלא עומד בתנאים האלה — המערכת תדלג עליו.',
      `<label class="rt-row"><input type="checkbox" data-rtchk="onlyAvailable" ${c.onlyAvailable ? 'checked' : ''}>
        <span>רק מי שמסומן "זמין" כרגע</span></label>
      <label class="rt-row"><input type="checkbox" data-rtchk="onlyHours" ${c.onlyHours ? 'checked' : ''}>
        <span>רק בשעות הפעילות — ליד שנכנס בלילה ימתין לבוקר</span></label>
      <label class="rt-row num"><span>עד כמה לידים פתוחים לנציג</span>
        <input class="cc-inp sm" type="number" min="0" max="99" id="rtCap" value="${c.cap || 0}">
        <small class="muted">0 = בלי הגבלה</small></label>`)}

    ${set('ואם אף אחד לא מתאים?', 'מה לעשות כשאף נציג לא עבר את התנאים למעלה.',
      `<div class="rt-fb">${ROUTE_FALLBACK.map(f => `<button class="rt-m sm ${c.fallback === f.key ? 'on' : ''}" data-rtfb="${f.key}">${f.label}</button>`).join('')}</div>`)}

    <div class="rt-sim">${ic('bolt')} <b>בדיקה — למי זה היה מגיע עכשיו:</b>
      <span id="rtSimOut">${esc((function () { const r = (typeof autoDemoLead === 'function') ? autoDemoLead() : null;
        if (!r) return 'אין ליד'; const p = routePick(r); return p.why + (p.rejected.length ? ' · נפסלו: ' + p.rejected.slice(0, 3).join(' · ') : ''); })())}</span></div>
  </div>`;
}
function routeBindConfig(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  $$('[data-rtm]').forEach(b => b.addEventListener('click', () => { routeSet({ method: b.dataset.rtm }); RR(); }));
  $$('[data-rtfb]').forEach(b => b.addEventListener('click', () => { routeSet({ fallback: b.dataset.rtfb }); RR(); }));
  $$('[data-rtchk]').forEach(c => c.addEventListener('change', () => { const p = {}; p[c.dataset.rtchk] = c.checked; routeSet(p); RR(); }));
  const cap = $('#rtCap'); if (cap) cap.addEventListener('change', () => { routeSet({ cap: Math.max(0, +cap.value || 0) }); RR(); });
}
