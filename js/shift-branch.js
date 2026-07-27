/* ============================================================
   שיוך משמרת לסניף — מודול עצמאי
   ------------------------------------------------------------
   כלל: עובד שמשויך ל**יותר מסניף אחד** חייב לשייך כל משמרת ביומן
   שלו לסניף — אחרת לא ידוע היכן הוא יושב באותה משמרת.

   • עובד עם סניף אחד  → שיוך אוטומטי ושקוף (מוצג כתווית, בלי בחירה).
   • עובד עם 2+ סניפים → בורר סניף בכל משמרת + התראה על משמרות ללא שיוך.
   • הפסקות אינן דורשות שיוך.

   האחסון נפרד מ-workSchedule (שהוא מבנה הזמנים בלבד) כדי לא לגעת בו:
   SHIFT_BRANCH = { empId: { 'ראשון:0': 'tlv' } }   ← יום + אינדקס המקטע.
   ============================================================ */
let SHIFT_BRANCH = (function () { try { return JSON.parse(localStorage.getItem('cb_shiftBranch')) || {}; } catch (e) { return {}; } })();
function shiftBranchSave() { try { localStorage.setItem('cb_shiftBranch', JSON.stringify(SHIFT_BRANCH)); } catch (e) {}
  if (typeof window !== 'undefined') window.__coordPool = null; }

/* העובד שבהקשרו מוצג היומן (כרטיס עובד / מסך מלא) */
function whEmp() {
  if (typeof STAFF === 'undefined') return null;
  const id = (typeof settingsEmp !== 'undefined') ? settingsEmp : null;
  return STAFF.find(s => s.id === id) || STAFF[0] || null;
}
function whEmpBranchKeys(emp) {
  emp = emp || whEmp(); if (!emp) return [];
  const list = (emp.branches && emp.branches.length) ? emp.branches : (emp.branch ? [emp.branch] : []);
  const act = (typeof COORD_BRANCHES === 'undefined') ? [] : COORD_BRANCHES.filter(b => b.active !== false).map(b => b.key);
  return list.filter(k => act.indexOf(k) >= 0);
}
function whBranchLabel(k) {
  const b = (typeof COORD_BRANCHES === 'undefined') ? null : COORD_BRANCHES.find(x => x.key === k);
  return b ? (b.short || b.label) : k;
}
function shiftKey(day, si) { return day + ':' + si; }
/* שיוך המשמרת — עם נפילה אוטומטית לסניף היחיד של העובד */
function shiftBranchGet(day, si, emp) {
  emp = emp || whEmp(); if (!emp) return '';
  const keys = whEmpBranchKeys(emp);
  if (keys.length === 1) return keys[0];                       // סניף אחד — שיוך משתמע
  const v = ((SHIFT_BRANCH[emp.id] || {})[shiftKey(day, si)]) || '';
  return keys.indexOf(v) >= 0 ? v : '';                        // שיוך ישן לסניף שהוסר — נחשב חסר
}
function shiftBranchSet(day, si, bk, emp) {
  emp = emp || whEmp(); if (!emp) return;
  SHIFT_BRANCH[emp.id] = SHIFT_BRANCH[emp.id] || {};
  if (bk) SHIFT_BRANCH[emp.id][shiftKey(day, si)] = bk; else delete SHIFT_BRANCH[emp.id][shiftKey(day, si)];
  shiftBranchSave();
}
function shiftBranchSetAll(bk, emp) {
  emp = emp || whEmp(); if (!emp || typeof workSchedule === 'undefined') return 0;
  let n = 0;
  workSchedule.forEach(d => { if (!d.on) return;
    d.segments.forEach((s, si) => { if (s.type === 'break') return; shiftBranchSet(d.day, si, bk, emp); n++; }); });
  return n;
}
/* משמרות ללא שיוך (רק בימים פעילים) */
function shiftBranchMissing(emp) {
  emp = emp || whEmp(); if (!emp || typeof workSchedule === 'undefined') return [];
  if (whEmpBranchKeys(emp).length < 2) return [];
  const out = [];
  workSchedule.forEach(d => { if (!d.on) return;
    d.segments.forEach((s, si) => { if (s.type === 'break') return;
      if (!shiftBranchGet(d.day, si, emp)) out.push({ day: d.day, si: si, start: s.start, end: s.end }); }); });
  return out;
}
/* סיכום שעות שבועי לפי סניף */
function shiftBranchHours(emp) {
  emp = emp || whEmp(); const map = {};
  if (!emp || typeof workSchedule === 'undefined') return map;
  const mins = t => { const p = /(\d{1,2}):(\d{2})/.exec(t || ''); return p ? +p[1] * 60 + +p[2] : 0; };
  workSchedule.forEach(d => { if (!d.on) return;
    d.segments.forEach((s, si) => { if (s.type === 'break') return;
      const bk = shiftBranchGet(d.day, si, emp) || '__none';
      map[bk] = (map[bk] || 0) + Math.max(0, mins(s.end) - mins(s.start)); }); });
  return map;
}

/* ---------------- UI: בורר הסניף בתוך המשמרת ---------------- */
function shiftBranchHTML(seg, dayName, si) {
  if (!seg || seg.type === 'break') return '';
  const emp = whEmp(); if (!emp) return '';
  const keys = whEmpBranchKeys(emp);
  if (!keys.length) return `<div class="wh-seg-br none">${ic('org')} <span>לא שויך סניף לעובד</span></div>`;
  if (keys.length === 1) return `<div class="wh-seg-br one" title="העובד משויך לסניף אחד — שיוך אוטומטי">${ic('org')} <span>${esc(whBranchLabel(keys[0]))}</span></div>`;
  const cur = shiftBranchGet(dayName, si, emp);
  return `<div class="wh-seg-br ${cur ? '' : 'miss'}">${ic('org')}
    <select data-segbr="${esc(dayName)}|${si}" title="סניף המשמרת">
      <option value="" ${cur ? '' : 'selected'}>— בחר סניף —</option>
      ${keys.map(k => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(whBranchLabel(k))}</option>`).join('')}
    </select></div>`;
}
/* התראה + שיוך מהיר, מוצג רק כשיש יותר מסניף אחד */
function whBranchBannerHTML() {
  const emp = whEmp(); if (!emp) return '';
  const keys = whEmpBranchKeys(emp);
  if (keys.length < 2) return '';
  const miss = shiftBranchMissing(emp), hours = shiftBranchHours(emp);
  const hh = m => (m % 60 ? (m / 60).toFixed(1) : m / 60) + ' ש׳';
  return `<div class="wh-brbar ${miss.length ? 'warn' : 'ok'}">
    <div class="whb-h">${ic(miss.length ? 'alert' : 'check')}
      <b>${esc(emp.name)} משויך/ת ל-${keys.length} סניפים</b>
      <span>${miss.length ? 'יש לשייך כל משמרת לסניף — ' + miss.length + ' משמרות ללא שיוך' : 'כל המשמרות משויכות לסניף'}</span></div>
    ${miss.length ? `<div class="whb-miss">${miss.map(m => `<span class="whb-chip">${esc(m.day)} · ${esc(m.start)}–${esc(m.end)}</span>`).join('')}</div>
      <div class="whb-quick"><span>שייך את כל המשמרות ל:</span>
        ${keys.map(k => `<button class="btn xs" data-segbrall="${esc(k)}">${esc(whBranchLabel(k))}</button>`).join('')}</div>` : ''}
    ${typeof rotSummary === 'function' && rotSummary(emp).length ? `<div class="whb-rot">${ic('sync')} משמרות מחזוריות:
      ${rotSummary(emp).map(x => `<span class="whb-chip rot">${esc(x.day)} ${esc(x.start)}–${esc(x.end)}${x.branch ? ' · ' + esc(x.branch) : ''} · ${esc(rotLabel(x.rot))}${x.next.length ? ' · הקרובים: ' + esc(x.next.join(', ')) : ''}${rotHasWindow(x.rot) ? ' · ' + esc(rotWindowText(x.rot)) : ''}</span>`).join('')}</div>` : ''}
    <div class="whb-sum">${ic('clock')} שעות שבועיות:
      ${Object.keys(hours).map(k => `<span class="whb-chip ${k === '__none' ? 'miss' : ''}">${k === '__none' ? 'ללא שיוך' : esc(whBranchLabel(k))}: ${hh(hours[k])}</span>`).join('')}</div>
  </div>`;
}
function bindShiftBranch(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); else if (typeof whRefresh === 'function') whRefresh(); };
  $$('[data-segbr]').forEach(sel => sel.addEventListener('change', () => {
    const p = sel.dataset.segbr.split('|');
    shiftBranchSet(p[0], +p[1], sel.value); RR();
    if (sel.value) toast('המשמרת שויכה לסניף ' + whBranchLabel(sel.value));
  }));
  $$('[data-segbrall]').forEach(b => b.addEventListener('click', () => {
    const n = shiftBranchSetAll(b.dataset.segbrall); RR();
    toast(n + ' משמרות שויכו לסניף ' + whBranchLabel(b.dataset.segbrall));
  }));
}

/* האם המשמרת דורשת שיוך וטרם שויכה (לסימון ויזואלי על המקטע) */
function shiftBranchNeeds(dayName, si) {
  const emp = whEmp(); if (!emp) return false;
  return whEmpBranchKeys(emp).length >= 2 && !shiftBranchGet(dayName, si, emp);
}
