/* ============================================================
   תדירות משמרת — "שבוע כן שבוע לא"   · מודול עצמאי
   ------------------------------------------------------------
   מטפל שמגיע לסניף בימי שלישי **אחת לשבועיים** אינו יום קבוע ואינו
   חריגה — זו משמרת עם מחזוריות. לכן לכל משמרת יש תדירות:

     כל שבוע (ברירת מחדל) · אחת לשבועיים · אחת ל-3 · אחת ל-4

   ה"שבוע הפעיל" נקבע לפי אינדקס שבוע מוחלט מעוגן לתאריך קבוע
   (ROT_ANCHOR, יום ראשון) — כך שהחישוב יציב ואינו תלוי ב"היום".
   האחסון נפרד, כמו שיוך הסניף: SHIFT_ROT[empId]['יום:אינדקס'].

   האינטגרציה האמיתית: מאגר הזמינות (coordBuildPool) מדלג על תאריך
   שבו המשמרת אינה פעילה — כך שבשבוע ה"לא" פשוט אין תורים לאותו
   מטפל באותו סניף.
   ============================================================ */
const ROT_ANCHOR = '2024-01-07';        // יום ראשון — עוגן חישוב מספר השבוע
const ROT_EVERY = [1, 2, 3, 4];
let SHIFT_ROT = (function () { try { return JSON.parse(localStorage.getItem('cb_shiftRot')) || {}; } catch (e) { return {}; } })();
function shiftRotSave() {
  try { localStorage.setItem('cb_shiftRot', JSON.stringify(SHIFT_ROT)); } catch (e) {}
  if (typeof window !== 'undefined') window.__coordPool = null;   // הזמינות נבנית מחדש
}

/* ---------------- חישוב שבועות ---------------- */
function rotParse(ds) { const p = /(\d{4})-(\d{2})-(\d{2})/.exec(String(ds || '')); return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null; }
function rotFmt(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function rotWeekIndex(ds) {
  const d = rotParse(ds), a = rotParse(ROT_ANCHOR); if (!d || !a) return 0;
  return Math.floor((d - a) / 604800000);       // 7*24*60*60*1000
}
function rotDefault() { return { every: 1, offset: 0, from: '', to: '' }; }
function rotNorm(r) { const every = ROT_EVERY.indexOf(+(r && r.every)) >= 0 ? +r.every : 1;
  return { every: every, offset: ((+(r && r.offset) || 0) % every + every) % every,
    from: (r && r.from) || '', to: (r && r.to) || '' }; }
/* פעילה בתאריך? — גם חלון התוקף (מ־/עד) וגם המחזוריות */
function rotActiveOn(rot, ds) {
  const r = rotNorm(rot);
  if (r.from && ds < r.from) return false;
  if (r.to && ds > r.to) return false;
  return r.every === 1 || (rotWeekIndex(ds) % r.every) === r.offset;
}
function rotHasWindow(r) { r = rotNorm(r); return !!(r.from || r.to); }
function rotWindowText(r) { r = rotNorm(r);
  if (r.from && r.to) return 'מ-' + rotHeb(r.from) + ' עד ' + rotHeb(r.to);
  if (r.from) return 'מ-' + rotHeb(r.from);
  if (r.to) return 'עד ' + rotHeb(r.to); return ''; }
function rotHeb(ds) { const d = rotParse(ds); return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : ds; }
function rotLabel(rot) { const r = rotNorm(rot);
  return r.every === 1 ? 'כל שבוע' : r.every === 2 ? 'אחת לשבועיים' : 'אחת ל-' + r.every + ' שבועות'; }
function rotShort(rot) { const r = rotNorm(rot); return r.every === 1 ? 'שבועי' : '1/' + r.every; }
function rotFullLabel(rot) { const r = rotNorm(rot); const w = rotWindowText(r); return rotLabel(r) + (w ? ' · ' + w : ''); }

/* ---------------- אחסון לפי עובד ---------------- */
function rotGet(day, si, emp) {
  emp = emp || (typeof whEmp === 'function' ? whEmp() : null); if (!emp) return rotDefault();
  return rotNorm(((SHIFT_ROT[emp.id] || {})[day + ':' + si]) || rotDefault());
}
function rotSet(day, si, rot, emp) {
  emp = emp || (typeof whEmp === 'function' ? whEmp() : null); if (!emp) return;
  const r = rotNorm(rot);
  SHIFT_ROT[emp.id] = SHIFT_ROT[emp.id] || {};
  if (r.every === 1 && !r.from && !r.to) delete SHIFT_ROT[emp.id][day + ':' + si]; else SHIFT_ROT[emp.id][day + ':' + si] = r;
  shiftRotSave();
}
function rotAnyFor(emp) {
  emp = emp || (typeof whEmp === 'function' ? whEmp() : null); if (!emp) return false;
  const m = SHIFT_ROT[emp.id] || {};
  return Object.keys(m).some(k => rotNorm(m[k]).every > 1 || rotHasWindow(m[k]));
}
/* התאריכים הקרובים של אותו יום בשבוע, עם סימון פעיל/לא — לתצוגה בבורר */
function rotUpcoming(dayName, rot, n) {
  const week = (typeof ALL_WEEK !== 'undefined') ? ALL_WEEK : ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dow = week.indexOf(dayName); if (dow < 0) return [];
  const today = (typeof clockTodayDate === 'function') ? clockTodayDate() : new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));      // המופע הקרוב של אותו יום
  const out = [];
  for (let i = 0; i < (n || 4); i++) {
    const ds = rotFmt(d);
    out.push({ date: ds, txt: d.getDate() + '/' + (d.getMonth() + 1), on: rotActiveOn(rot, ds), wi: rotWeekIndex(ds) });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/* ---------------- האם המשמרת פעילה בתאריך ---------------- */
function shiftRunsOn(empId, dayName, si, ds) {
  const emp = (typeof STAFF !== 'undefined') ? STAFF.find(s => s.id === empId) : null; if (!emp) return true;
  return rotActiveOn(rotGet(dayName, si, emp), ds);
}
/* חסימת מטפל בסניף בתאריך: אם כל המשמרות שלו באותו יום ובאותו סניף אינן פעילות באותו שבוע */
function rotDocBlocked(docKey, ds, branchKey) {
  if (typeof workSchedule === 'undefined' || typeof STAFF === 'undefined') return false;
  const emp = STAFF.find(s => s.id === docKey); if (!emp) return false;
  const rotMap = SHIFT_ROT[emp.id]; if (!rotMap || !Object.keys(rotMap).length) return false;   // אין מחזוריות — לא חוסם
  const week = (typeof ALL_WEEK !== 'undefined') ? ALL_WEEK : ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const d = rotParse(ds); if (!d) return false;
  const dayName = week[d.getDay()];
  const day = workSchedule.find(x => x.day === dayName); if (!day || !day.on) return false;
  const shifts = [];
  day.segments.forEach((s, si) => { if (s.type === 'break') return;
    const bk = (typeof shiftBranchGet === 'function') ? shiftBranchGet(dayName, si, emp) : '';
    if (branchKey && bk && bk !== branchKey) return;      // משמרת בסניף אחר — לא רלוונטית לבדיקה כאן
    shifts.push(si);
  });
  if (!shifts.length) return false;
  return !shifts.some(si => rotActiveOn(rotGet(dayName, si, emp), ds));   // אף משמרת אינה פעילה השבוע
}

/* ---------------- UI: צ׳יפ התדירות בתוך המשמרת ---------------- */
function rotChipHTML(seg, dayName, si) {
  if (!seg || seg.type === 'break') return '';
  const r = rotGet(dayName, si);
  const up = rotUpcoming(dayName, r, 3);
  return `<button class="wh-seg-rot ${r.every > 1 || rotHasWindow(r) ? 'on' : ''}" data-segrot="${esc(dayName)}|${si}"
      title="${esc(rotFullLabel(r) + (r.every > 1 ? ' · הקרובים: ' + up.filter(x => x.on).map(x => x.txt).join(', ') : ''))}">
    ${ic('sync')} <span>${esc(rotLabel(r))}</span>
    ${rotHasWindow(r) ? `<small class="rot-win">${ic('calendar')} ${esc(rotWindowText(r))}</small>` : ''}
    ${r.every > 1 ? `<small>${up.filter(x => x.on).map(x => x.txt).join(' · ')}</small>` : ''}
  </button>`;
}
let rotPopKey = null;
function closeRotPicker() { const p = document.getElementById('rotPop'); if (p) p.remove(); rotPopKey = null; }
function openRotPicker(dayName, si, anchor, rerender) {
  closeRotPicker();
  const emp = (typeof whEmp === 'function') ? whEmp() : null; if (!emp) return;
  rotPopKey = dayName + ':' + si;
  const pop = document.createElement('div'); pop.className = 'rot-pop'; pop.id = 'rotPop';
  const render = () => {
    const r = rotGet(dayName, si, emp), up = rotUpcoming(dayName, r, 6);
    pop.innerHTML = `
      <div class="rot-h">${ic('sync')} תדירות המשמרת · יום ${esc(dayName)}</div>
      <div class="rot-every">${ROT_EVERY.map(e => `<button class="rot-e ${r.every === e ? 'on' : ''}" data-rote="${e}">${e === 1 ? 'כל שבוע' : e === 2 ? 'כל שבועיים' : 'כל ' + e + ' שב׳'}</button>`).join('')}</div>
      ${r.every > 1 ? `<div class="rot-pick"><span>באילו שבועות הוא מגיע? <small>(לחץ על תאריך שבו כן מגיע)</small></span>
        <div class="rot-dates">${up.map(u => `<button class="rot-d ${u.on ? 'on' : ''}" data-rotoff="${u.wi % r.every}" title="${u.on ? 'שבוע פעיל' : 'שבוע לא פעיל — לחץ להעברה'}">${u.txt}</button>`).join('')}</div>
        <p class="rot-note">${ic('alert')} בשבוע שאינו פעיל לא ייווצרו תורים ל${esc(emp.name)} ביום ${esc(dayName)}.</p></div>` : ''}
      <div class="rot-win-f">
        <label><span>בתוקף מ־</span><input type="date" id="rotFrom" value="${esc(r.from)}"></label>
        <label><span>עד</span><input type="date" id="rotTo" value="${esc(r.to)}"></label>
        ${rotHasWindow(r) ? `<button class="btn xs ghost" id="rotWinClr">${ic('close')} נקה תוקף</button>` : ''}
      </div>
      <p class="rot-note">${ic('bolt')} חלון תוקף מטפל בהסדרים זמניים — עובד חדש, מחליף, או סבב שמסתיים בתאריך ידוע.</p>
      <div class="rot-foot"><button class="btn xs" id="rotDone">${ic('check')} סגור</button></div>`;
    $$('[data-rote]', pop).forEach(b => b.addEventListener('click', () => {
      rotSet(dayName, si, { every: +b.dataset.rote, offset: rotGet(dayName, si, emp).offset }, emp); render(); if (rerender) rerender(true);
    }));
    $$('[data-rotoff]', pop).forEach(b => b.addEventListener('click', () => {
      rotSet(dayName, si, { every: rotGet(dayName, si, emp).every, offset: +b.dataset.rotoff }, emp); render(); if (rerender) rerender(true);
    }));
    const wf = $('#rotFrom', pop), wt = $('#rotTo', pop);
    if (wf) wf.addEventListener('change', () => { const c = rotGet(dayName, si, emp); rotSet(dayName, si, { every: c.every, offset: c.offset, from: wf.value, to: c.to }, emp); render(); if (rerender) rerender(true); });
    if (wt) wt.addEventListener('change', () => { const c = rotGet(dayName, si, emp); rotSet(dayName, si, { every: c.every, offset: c.offset, from: c.from, to: wt.value }, emp); render(); if (rerender) rerender(true); });
    const wc = $('#rotWinClr', pop); if (wc) wc.addEventListener('click', () => { const c = rotGet(dayName, si, emp); rotSet(dayName, si, { every: c.every, offset: c.offset, from: '', to: '' }, emp); render(); if (rerender) rerender(true); });
    $('#rotDone', pop).addEventListener('click', () => { closeRotPicker(); if (rerender) rerender(); });
  };
  document.body.appendChild(pop); render();
  const rc = anchor.getBoundingClientRect();
  pop.style.top = Math.min(window.innerHeight - 20, rc.bottom + 6) + 'px';
  pop.style.insetInlineStart = Math.max(8, rc.left) + 'px';
  setTimeout(() => document.addEventListener('mousedown', rotOutside), 0);
}
function rotOutside(e) { const p = document.getElementById('rotPop'); if (p && !p.contains(e.target) && !e.target.closest('[data-segrot]')) { closeRotPicker(); document.removeEventListener('mousedown', rotOutside); } }
function bindShiftRotation(rerender) {
  $$('[data-segrot]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const p = b.dataset.segrot.split('|');
    openRotPicker(p[0], +p[1], b, (keepOpen) => { if (typeof rerender === 'function') rerender(); else if (typeof whRefresh === 'function') whRefresh(); });
  }));
}
/* סיכום: אילו משמרות מחזוריות (לבאנר) */
function rotSummary(emp) {
  emp = emp || (typeof whEmp === 'function' ? whEmp() : null);
  if (!emp || typeof workSchedule === 'undefined') return [];
  const out = [];
  workSchedule.forEach(d => { if (!d.on) return;
    d.segments.forEach((s, si) => { if (s.type === 'break') return;
      const r = rotGet(d.day, si, emp); if (r.every === 1 && !rotHasWindow(r)) return;
      const bk = (typeof shiftBranchGet === 'function') ? shiftBranchGet(d.day, si, emp) : '';
      out.push({ day: d.day, si: si, start: s.start, end: s.end, rot: r,
        branch: bk ? ((typeof whBranchLabel === 'function') ? whBranchLabel(bk) : bk) : '',
        next: rotUpcoming(d.day, r, 6).filter(x => x.on).slice(0, 3).map(x => x.txt) });
    }); });
  return out;
}
