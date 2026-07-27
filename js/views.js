/* ============================================================
   CallBiz Manager – מסכי משנה (Views)
   הגדרות(15) · אוטומציות(16) · יומן רב-עובדים · מנוע workflow דינמי
   ============================================================ */

/* ---- רכיב Toggle ---- */
function toggle(on, attrs = '') {
  return `<span class="toggle ${on ? 'on' : ''}" ${attrs} role="switch" aria-checked="${on}"><i></i></span>`;
}
function bindToggles(scope) {
  $$('.toggle', scope || document).forEach(t => {
    if (t.hasAttribute('data-wh-toggle')) return;   // לימי עבודה יש handler משלהם
    t.addEventListener('click', () => {
      t.classList.toggle('on');
      toast(t.classList.contains('on') ? 'הופעל' : 'כובה');
    });
  });
}

/* ============================================================
   15. מסך הגדרות יומן
   ============================================================ */
let settingsEmp = 'yk';

/* --- מודל שעות עבודה הניתן לעריכה (ימים ידניים · הפסקות · פיצולים) --- */
const ALL_WEEK = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
/* מודל טיימליין עוקב: רצף מקטעים (משמרת/הפסקה) — התחלת כל מקטע = סוף הקודם */
let workSchedule = [
  { day: 'ראשון', on: true, segments: [
    { type: 'shift', start: '08:00', end: '13:00' },
    { type: 'break', start: '13:00', end: '13:30' },
    { type: 'shift', start: '13:30', end: '17:00' },
  ] },
  { day: 'שני',   on: true, segments: [{ type: 'shift', start: '08:00', end: '17:00' }] },
  { day: 'שלישי', on: true, segments: [{ type: 'shift', start: '08:00', end: '18:00' }] },
  { day: 'רביעי', on: true, segments: [{ type: 'shift', start: '08:00', end: '17:00' }] },
  { day: 'חמישי', on: true, segments: [{ type: 'shift', start: '08:00', end: '16:00' }] },
];
function addMin(hhmm, m) { const [h, mm] = hhmm.split(':').map(Number); let t = h * 60 + mm + m; t = ((t % 1440) + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
function relinkDay(d) { for (let k = 1; k < d.segments.length; k++) d.segments[k].start = d.segments[k - 1].end; }

let wh24 = false;   // מתג "הצג 24 שעות" — קובע אם ציר-הזמן מכסה 00:00–24:00 או רק חלון העבודה
function whMin(t) { const p = (t || '0:0').split(':'); return (+p[0]) * 60 + (+(p[1] || 0)); }
function whFmt(m) { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
/* ציר-זמן ויזואלי ליום — בלוק מותג לעבודה, בלוק ענבר להפסקה, על רקע היממה */
function whTimeline(d) {
  const segs = (d.segments || []).filter(s => whMin(s.end) > whMin(s.start));
  if (!segs.length) return '<div class="wh-tl empty"></div>';
  const from = wh24 ? 0 : Math.max(0, Math.min(...segs.map(s => whMin(s.start))) - 30);
  const to   = wh24 ? 1440 : Math.min(1440, Math.max(...segs.map(s => whMin(s.end))) + 30);
  const span = Math.max(1, to - from);
  const blocks = segs.map(s => {
    const a = whMin(s.start), b = whMin(s.end);
    const left = ((a - from) / span) * 100, w = ((b - a) / span) * 100;
    return `<span class="wh-tl-block ${s.type}" style="inset-inline-start:${left}%;width:${w}%" title="${s.type === 'break' ? 'הפסקה' : 'עבודה'} ${s.start}–${s.end}"></span>`;
  }).join('');
  // סימוני שעות עגולות (רק כשמציגים 24 שעות, כדי לא להעמיס)
  let ticks = '';
  if (wh24) { for (let h = 0; h <= 24; h += 6) ticks += `<span class="wh-tl-tick" style="inset-inline-start:${(h * 60 - from) / span * 100}%">${h}</span>`; }
  return `<div class="wh-tl">
      <div class="wh-tl-track">${blocks}${ticks}</div>
      <div class="wh-tl-scale"><span>${whFmt(from)}</span><span>${whFmt(to)}</span></div>
    </div>`;
}
/* כרטיס-שער מצומצם במסך הגדרות-העובד — כל הגדרות התזמון עברו לחלון המלא */
function whLauncherCard() {
  return `
    <section class="card set-card wide wh-launch-card">
      <div class="wh-launch">
        <div class="wh-launch-info">
          <span class="wh-launch-ic">${ic('clock')}</span>
          <div><b>שעות פעילות ולוח זמנים</b>
            <small>ימי עבודה והפסקות · סוגי שירות · קיבולת · חגים וחופשות · דיוק תזמון ומדיניות — הכל במסך אחד</small></div>
        </div>
        <button class="btn primary" id="whOpenFull">${ic('expand')} פתח הגדרות שעות פעילות</button>
      </div>
    </section>`;
}
function workHoursCard() {
  if (typeof whsEnsureAllDays === 'function') whsEnsureAllDays();   // 7 ימים אחידים גם בתצוגה המוטבעת
  return `
    <section class="card set-card wide wh-card">
      <div class="card-head"><div class="title">${ic('clock')} שעות פעילות</div>
        <div class="wh-headtools">
          <button class="btn sm primary" id="whOpenFull" type="button">${ic('expand')} פתח מסך מלא</button>
          <button class="wh-24 ${wh24 ? 'on' : ''}" id="wh24Toggle" type="button" aria-pressed="${wh24}"><span class="wh-24-dot"></span> הצג 24 שעות</button>
        </div></div>
      ${whQuickbarHTML()}
      ${typeof whBranchBannerHTML === 'function' ? whBranchBannerHTML() : ''}
      <div class="wh-daysgrid">
        ${workSchedule.length ? workSchedule.map((d, i) => whDayCard(d, i)).join('')
          : '<div class="muted" style="padding:14px">לא הוגדרו ימי עבודה. לחץ "הוסף יום".</div>'}
      </div>
    </section>`;
}
/* שורת "פעולות מהירות" — משותפת לכרטיס המוטבע ולחלון המלא (workhours-settings.js) */
function whQuickbarHTML() {
  return `
    <div class="wh-quickbar">
      <span class="wh-qa-lbl">${ic('bolt')} פעולות מהירות</span>
      <button class="wh-qa" data-wh-preset="08:00-17:00">קבע לכולם 08:00–17:00</button>
      <button class="wh-qa" data-wh-preset="09:00-18:00">קבע לכולם 09:00–18:00</button>
      <button class="wh-qa" data-wh-preset="08:00-13:00">קבע לכולם 08:00–13:00</button>
      <button class="wh-qa" data-wh-qa="clearbreaks">${ic('close')} נקה כל ההפסקות</button>
      <button class="wh-qa primary" id="whCopyDays" data-wh-qa="copydays">${ic('copy')} העתק לימים…</button>
    </div>`;
}
/* רענון: אם חלון "הגדרות שעות פעילות" פתוח — מרעננים את הפאנל הפעיל בלבד; אחרת את מסך ההגדרות */
function whRefresh() { if (typeof whsOpen !== 'undefined' && whsOpen) { whsRenderPanel(); } else { renderSettingsView(); } }
/* תווית מקטע לפי סוג ומיקום — תצוגה נקייה כמו המוקאפ */
function whSegLabel(type, shiftNo, breakNo) {
  if (type === 'break') return 'הפסקה';
  return shiftNo === 1 ? 'שעות עבודה' : 'משמרת';
}
function whDayCard(d, i) {
  let shiftNo = 0, breakNo = 0;
  const segHTML = d.segments.map((s, si) => {
    const isBreak = s.type === 'break';
    if (isBreak) breakNo++; else shiftNo++;
    const variant = isBreak ? (breakNo === 1 ? 'brk-lunch' : 'brk-more') : 'shift';
    const label = whSegLabel(s.type, shiftNo, breakNo);
    const startLocked = si > 0;   // התחלה = סוף הקודם (אוטומטי)
    return `
      <div class="wh-seg ${variant} ${(!isBreak && typeof shiftBranchNeeds === 'function' && shiftBranchNeeds(d.day, si)) ? 'br-miss' : ''}">
        <div class="wh-seg-top">
          <span class="wh-seg-lbl">${label}</span>
          ${si > 0 ? `<button class="wh-seg-x" data-seg-del="${i}:${si}" title="הסר ${isBreak ? 'הפסקה' : 'משמרת'}">${ic('close')}</button>` : ''}
        </div>
        <div class="wh-seg-time">
          <input type="time" value="${s.start}" ${startLocked ? 'readonly' : ''} data-seg="${i}:${si}:start" title="${startLocked ? 'מתעדכן אוטומטית מסוף המקטע הקודם' : 'שעת התחלה'}">
          <span class="wh-seg-dash">–</span>
          <input type="time" value="${s.end}" data-seg="${i}:${si}:end">
        </div>
        ${(!isBreak && typeof shiftBranchHTML === 'function') ? shiftBranchHTML(s, d.day, si) : ''}
        ${(!isBreak && typeof rotChipHTML === 'function') ? rotChipHTML(s, d.day, si) : ''}
      </div>`;
  }).join('');
  const last = d.segments[d.segments.length - 1];
  const addBreak = last && last.type !== 'break';
  const body = d.on
    ? `${whTimeline(d)}
       <div class="wh-segs">${segHTML}</div>
       <div class="wh-dayadd">
         <button class="wh-add ${addBreak ? 'brk' : 'shift'}" data-seg-add="${i}">${ic('plus')} ${addBreak ? 'הוסף הפסקה' : 'הוסף משמרת'}</button>
       </div>`
    : `<div class="wh-day-empty">
         <span class="wh-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M9.5 14l5 5M14.5 14l-5 5"/></svg></span>
         <span>יום לא פעיל</span>
       </div>`;
  return `
    <div class="wh-day ${d.on ? '' : 'off'}">
      <div class="wh-day-head">
        <button class="wh-kebab" data-wh-kebab="${i}" aria-label="פעולות יום">${ic('kebab')}</button>
        <b class="wh-name">${d.day}</b>
        <span class="toggle wh-toggle ${d.on ? 'on' : ''}" data-wh-toggle="${i}" title="${d.on ? 'יום פעיל' : 'יום לא פעיל'}"><i></i></span>
      </div>
      ${body}
    </div>`;
}
/* תפריט קבב ליום (⋮) — פעולות ממוקדות ליום בודד */
function showDayKebab(i, anchor) {
  closeDayKebab();
  const d = workSchedule[i]; if (!d) return;
  const pop = document.createElement('div');
  pop.className = 'wh-kebab-menu'; pop.id = 'whKebabMenu';
  pop.innerHTML = `
    <button data-dk="toggle">${ic(d.on ? 'close' : 'check')} ${d.on ? 'כבה יום' : 'הפעל יום'}</button>
    <button data-dk="clearbrk">${ic('pause')} נקה הפסקות</button>
    <button data-dk="copy">${ic('copy')} העתק לימים…</button>`;
  document.body.appendChild(pop);
  /* צמוד לכפתור שנלחץ. inset-inline-start מתהפך ב-RTL ולכן קפץ לצד השני
     של המסך — כאן ממקמים לפי הקצה הימני של הכפתור, עם היפוך למעלה בקצה. */
  const rc = anchor.getBoundingClientRect();
  const ph = pop.offsetHeight || 120;
  pop.style.top = `${rc.bottom + 5 + ph > window.innerHeight - 8 ? Math.max(8, rc.top - ph - 5) : rc.bottom + 5}px`;
  pop.style.right = `${Math.max(8, window.innerWidth - rc.right)}px`;
  $('[data-dk="toggle"]', pop).addEventListener('click', () => { d.on = !d.on; closeDayKebab(); whRefresh(); });
  $('[data-dk="clearbrk"]', pop).addEventListener('click', () => {
    if (d.segments.some(s => s.type === 'break')) d.segments = [{ type: 'shift', start: d.segments[0].start, end: d.segments[d.segments.length - 1].end }];
    closeDayKebab(); whRefresh(); toast(`ההפסקות ביום ${d.day} נוקו`);
  });
  $('[data-dk="copy"]', pop).addEventListener('click', () => { closeDayKebab(); copyDaysState = { src: i, targets: new Set() }; openCopyDaysPop(anchor); });
  setTimeout(() => document.addEventListener('click', dayKebabOutside), 0);
}
function dayKebabOutside(e) { if (!e.target.closest('#whKebabMenu') && !e.target.closest('[data-wh-kebab]')) closeDayKebab(); }
function closeDayKebab() { const p = $('#whKebabMenu'); if (p) p.remove(); document.removeEventListener('click', dayKebabOutside); }
function durationsCard() {
  return `
    <section class="card set-card wide dur-card">
      <div class="card-head"><div class="title">${ic('calendar')} משכי תיאום ומרווחים</div></div>
      <div class="set-body">
        <table class="mini-table dur-table">
          <thead><tr><th>סוג</th><th>ברירת מחדל</th><th>מינ'</th><th>מקס'</th><th>הכנה</th><th>סיום</th></tr></thead>
          <tbody>${DURATIONS.map((d, i) => `<tr>
            <td><b>${d.type}</b></td>
            <td><span class="dur-in"><input value="${d.def}" data-dur="${i}:def"><em>דק'</em></span></td>
            <td><span class="dur-in"><input value="${d.min}" data-dur="${i}:min"></span></td>
            <td><span class="dur-in"><input value="${d.max}" data-dur="${i}:max"></span></td>
            <td><span class="dur-in"><input value="${d.prep}" data-dur="${i}:prep"><em>דק'</em></span></td>
            <td><span class="dur-in"><input value="${d.wrap}" data-dur="${i}:wrap"><em>דק'</em></span></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
}
function bindWorkHours() {
  if (typeof bindShiftBranch === 'function') bindShiftBranch(whRefresh);
  if (typeof bindShiftRotation === 'function') bindShiftRotation(whRefresh);
  $$('[data-wh-toggle]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.whToggle; workSchedule[i].on = !workSchedule[i].on; whRefresh(); }));
  $$('[data-wh-delday]').forEach(b => b.addEventListener('click', () => { workSchedule.splice(+b.dataset.whDelday, 1); whRefresh(); }));
  $$('[data-wh-kebab]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); showDayKebab(+b.dataset.whKebab, b); }));

  // הוספת מקטע – משמרת אם האחרון הפסקה, אחרת הפסקה. התחלה = סוף המקטע האחרון
  $$('[data-seg-add]').forEach(b => b.addEventListener('click', () => {
    const d = workSchedule[+b.dataset.segAdd];
    const last = d.segments[d.segments.length - 1];
    if (last.type === 'break') d.segments.push({ type: 'shift', start: last.end, end: addMin(last.end, 120) });
    else d.segments.push({ type: 'break', start: last.end, end: addMin(last.end, 30) });
    whRefresh();
  }));
  // הסרת מקטע (רק לא-ראשון) + קישור מחדש
  $$('[data-seg-del]').forEach(b => b.addEventListener('click', () => {
    const [i, si] = b.dataset.segDel.split(':').map(Number);
    workSchedule[i].segments.splice(si, 1); relinkDay(workSchedule[i]); whRefresh();
  }));
  // עריכת זמן – סיום מקטע מקשר להתחלת הבא; רינדור מחדש כדי לשקף
  $$('[data-seg]').forEach(inp => inp.addEventListener('change', () => {
    const [i, si, field] = inp.dataset.seg.split(':');
    const d = workSchedule[+i], seg = d.segments[+si];
    seg[field] = inp.value;
    if (field === 'end') relinkDay(d);
    else if (+si === 0) relinkDay(d);
    whRefresh();
  }));

  const add = $('#whAddDay'); if (add) add.addEventListener('click', () => showDayPicker(add));
  const openFull = $('#whOpenFull'); if (openFull) openFull.addEventListener('click', () => { if (typeof openWorkHoursSettings === 'function') openWorkHoursSettings(); });
  $$('[data-dur]').forEach(inp => inp.addEventListener('change', () => { const [i, key] = inp.dataset.dur.split(':'); DURATIONS[+i][key] = inp.value; }));

  // מתג "הצג 24 שעות" — משנה את טווח ציר-הזמן בכל הכרטיסים
  const t24 = $('#wh24Toggle'); if (t24) t24.addEventListener('click', () => { wh24 = !wh24; whRefresh(); });
  // פעולות מהירות — קביעה מהירה לכל הימים
  $$('[data-wh-preset]').forEach(b => b.addEventListener('click', () => {
    const [start, end] = b.dataset.whPreset.split('-');
    workSchedule.forEach(d => { d.on = true; d.segments = [{ type: 'shift', start, end }]; });
    whRefresh(); toast(`נקבע לכל הימים · ${start}–${end}`);
  }));
  $$('[data-wh-qa]').forEach(b => b.addEventListener('click', () => {
    const qa = b.dataset.whQa;
    if (qa === 'clearbreaks') {
      workSchedule.forEach(d => {
        const shifts = d.segments.filter(s => s.type !== 'break');
        const from = d.segments[0].start, to = d.segments[d.segments.length - 1].end;
        d.segments = shifts.length ? [{ type: 'shift', start: from, end: to }] : d.segments;
      });
      whRefresh(); toast('כל ההפסקות נוקו · יום עבודה רציף');
    }
    if (qa === 'copydays') openCopyDaysPop(b);
  }));
}
/* פופ-אפ "העתק לימים…" — בחירת יום מקור + ימי יעד */
let copyDaysState = { src: 0, targets: new Set() };
function openCopyDaysPop(anchor) {
  closeCopyDaysPop();
  copyDaysState = { src: 0, targets: new Set(workSchedule.map((_, i) => i).filter(i => i !== 0)) };
  const pop = document.createElement('div');
  pop.className = 'copy-days-pop'; pop.id = 'copyDaysPop';
  const render = () => {
    pop.innerHTML = `
      <div class="cdp-title">${ic('layers')} העתק שעות לימים</div>
      <div class="cdp-sec"><label class="cdp-lbl">העתק מ־</label>
        <select class="cc-inp" id="cdpSrc">${workSchedule.map((d, i) => `<option value="${i}" ${i === copyDaysState.src ? 'selected' : ''}>${d.day}</option>`).join('')}</select></div>
      <div class="cdp-sec"><label class="cdp-lbl">אל הימים</label>
        <div class="cdp-days">${workSchedule.map((d, i) => i === copyDaysState.src ? '' :
          `<button type="button" class="cdp-day ${copyDaysState.targets.has(i) ? 'on' : ''}" data-cdp-tgt="${i}">${copyDaysState.targets.has(i) ? ic('check') : ''} ${d.day}</button>`).join('')}</div></div>
      <div class="cdp-foot"><button class="btn ghost sm" id="cdpCancel">ביטול</button>
        <button class="btn primary sm" id="cdpApply">${ic('check')} החל</button></div>`;
    $('#cdpSrc', pop).addEventListener('change', e => { copyDaysState.src = +e.target.value; copyDaysState.targets.delete(copyDaysState.src); render(); });
    $$('[data-cdp-tgt]', pop).forEach(b => b.addEventListener('click', () => { const t = +b.dataset.cdpTgt; copyDaysState.targets.has(t) ? copyDaysState.targets.delete(t) : copyDaysState.targets.add(t); render(); }));
    $('#cdpCancel', pop).addEventListener('click', closeCopyDaysPop);
    $('#cdpApply', pop).addEventListener('click', () => {
      const src = workSchedule[copyDaysState.src];
      copyDaysState.targets.forEach(i => { workSchedule[i].segments = src.segments.map(s => ({ ...s })); workSchedule[i].on = true; });
      closeCopyDaysPop(); whRefresh();
      toast(`שעות ${src.day} הועתקו ל-${copyDaysState.targets.size} ימים`);
    });
  };
  document.body.appendChild(pop); render();
  const rc = anchor.getBoundingClientRect();
  pop.style.top = `${rc.bottom + 6}px`;
  pop.style.right = `${Math.max(12, window.innerWidth - rc.right)}px`;
  setTimeout(() => document.addEventListener('click', copyDaysOutside), 0);
}
function copyDaysOutside(e) { if (!e.target.closest('#copyDaysPop') && !e.target.closest('#whCopyDays')) closeCopyDaysPop(); }
function closeCopyDaysPop() { const p = $('#copyDaysPop'); if (p) p.remove(); document.removeEventListener('click', copyDaysOutside); }
function sortSchedule() { workSchedule.sort((a, b) => ALL_WEEK.indexOf(a.day) - ALL_WEEK.indexOf(b.day)); }
function showDayPicker(anchor) {
  closeDayPicker();
  const used = workSchedule.map(d => d.day);
  const missing = ALL_WEEK.filter(d => !used.includes(d));
  if (!missing.length) { toast('כל ימי השבוע כבר קיימים'); return; }
  const pop = document.createElement('div');
  pop.className = 'day-pop'; pop.id = 'dayPop';
  pop.innerHTML = `<div class="day-pop-title">בחר יום להוספה</div>${missing.map(d => `<button data-addday="${d}">${d}</button>`).join('')}`;
  document.body.appendChild(pop);
  const rc = anchor.getBoundingClientRect();
  pop.style.top = `${rc.bottom + 5}px`;
  pop.style.right = `${window.innerWidth - rc.right}px`;
  $$('[data-addday]', pop).forEach(b => b.addEventListener('click', () => {
    workSchedule.push({ day: b.dataset.addday, on: true, segments: [{ type: 'shift', start: '08:00', end: '17:00' }] });
    sortSchedule();               // הכנסה בסדר הימים התקין
    closeDayPicker(); whRefresh();
    toast(`נוסף יום ${b.dataset.addday}`);
  }));
  setTimeout(() => document.addEventListener('click', dayPickerOutside), 0);
}
function dayPickerOutside(e) { if (!e.target.closest('#dayPop') && !e.target.closest('#whAddDay')) closeDayPicker(); }
function closeDayPicker() { const p = $('#dayPop'); if (p) p.remove(); document.removeEventListener('click', dayPickerOutside); }

let mgrMode = false;
let branchesMode = false;
let catalogMode = false;
let fieldsMode = false;
let permsMode = false;
let contractsMode = false;
let branchSort = 'name';   // name | region
let branchTable = false;   // ריבועים / טבלה
/* ניווט הגדרות בשתי רמות — קבוצה (אנשים / סניפים / קטלוג ותכנים) ואז המסך בתוכה.
   מונע שורה אחת עמוסה של כפתורים ומבהיר מה שייך למה. */
const SET_GROUPS = [
  { key: 'people', label: 'אנשים והרשאות', icon: 'clients', desc: 'עובדים · תיקי HR · הרשאות והגדרות מנהל',
    items: [
      { m: 'emp',   label: 'כרטיס עובד',        icon: 'user',    desc: 'שעות פעילות, מומחיות, סניפים' },
      { m: 'mgr',   label: 'כל העובדים ותיקי עובדים', icon: 'clients', desc: 'כל הצוות · לחיצה על עובד פותחת את תיק העובד המלא' },
    ] },
  { key: 'manage', label: 'הגדרות מנהל', icon: 'lock', desc: 'קריטריונים · תיאום ושיריון · הסכמים · הרשאות לפי תפקיד',
    items: [{ m: 'perms', label: 'הגדרות מנהל', icon: 'lock', desc: 'הגדרות שחלות על כל המערכת' }] },
  { key: 'places', label: 'סניפים', icon: 'org', desc: 'סניפים, כתובות, שעות ופיצולים',
    items: [{ m: 'branches', label: 'ניהול סניפים', icon: 'org', desc: 'כתובת, יומן ופיצולים, שירותים' }] },
  { key: 'content', label: 'קטלוג', icon: 'tasks', desc: 'שירותים ומוצרים למכירה ולתיאום',
    items: [
      { m: 'catalog', label: 'קטלוג שירותים ומוצרים', icon: 'tasks', desc: 'מחיר, משך, סליקה, קריטריונים' },
    ] },
];
function currentSetModeKey() { return permsMode ? 'perms' : fieldsMode ? 'fields' : catalogMode ? 'catalog' : branchesMode ? 'branches' : mgrMode ? 'mgr' : 'emp'; }
function groupOfMode(m) { return SET_GROUPS.find(g => g.items.some(i => i.m === m)) || SET_GROUPS[0]; }
function applySetMode(m) {
  if (m !== 'mgr') mgrEmpOpen = null;
  mgrMode = m === 'mgr'; branchesMode = m === 'branches'; catalogMode = m === 'catalog';
  fieldsMode = m === 'fields'; permsMode = m === 'perms';
}
function settingsHeader() {
  const empOpts = DEPARTMENTS.map(dp => {
    const opts = STAFF.filter(s => s.dept === dp).map(s => `<option value="${s.id}" ${s.id === settingsEmp ? 'selected' : ''}>${s.name} · ${s.role}</option>`).join('');
    return opts ? `<optgroup label="${dp}">${opts}</optgroup>` : '';
  }).join('');
  const mode = currentSetModeKey(), grp = groupOfMode(mode);
  const item = grp.items.find(i => i.m === mode) || grp.items[0];
  return `
    <div class="view-head set-head">
      <div class="vh-title"><span class="num">6</span> הגדרות המערכת
        <span class="muted">· ${grp.label} › ${item.label}</span></div>
    </div>
    <div class="set-nav">
      <div class="set-groups">
        ${SET_GROUPS.map(g => `<button class="set-group ${g.key === grp.key ? 'on' : ''}" data-setgrp="${g.key}" title="${g.desc}">
          ${ic(g.icon)}<span>${g.label}</span></button>`).join('')}
      </div>
      ${grp.items.length > 1 ? `<div class="set-subs">
        ${grp.items.map(i => `<button class="set-sub ${i.m === mode ? 'on' : ''}" data-setmode="${i.m}">
          ${ic(i.icon)}<span class="ss-t"><b>${i.label}</b><small>${i.desc}</small></span></button>`).join('')}
        ${mode === 'emp' ? `<div class="set-emp-bar">
          <div class="emp-select"><span>עובד:</span><select id="empSelect">${empOpts}</select></div>
          <button class="btn sm primary" id="addEmp">${ic('plus')} הוסף עובד</button>
        </div>` : ''}
      </div>` : ''}
    </div>`;
}
function bindSettingsHeader() {
  const sel = $('#empSelect'); if (sel) sel.addEventListener('change', () => { settingsEmp = sel.value; renderSettingsView(); });
  const ae = $('#addEmp'); if (ae) ae.addEventListener('click', openAddEmployee);
  // ניווט קבוצות → נכנס למסך הראשון בקבוצה; ניווט משנה → מסך ספציפי
  $$('[data-setgrp]').forEach(b => b.addEventListener('click', () => {
    const g = SET_GROUPS.find(x => x.key === b.dataset.setgrp); if (!g) return;
    if (groupOfMode(currentSetModeKey()).key === g.key) return;   // כבר בקבוצה — לא מאפסים
    applySetMode(g.items[0].m); renderSettingsView();
  }));
  $$('[data-setmode]').forEach(b => b.addEventListener('click', () => { applySetMode(b.dataset.setmode); renderSettingsView(); }));
}

/* --- בקשות שדות מהשטח: מרוכזות (דדופ), אישור גורף / נקודתי / דחייה --- */
function fieldRequestsCardHTML() {
  const reqs = (typeof FIELD_REQUESTS !== 'undefined') ? FIELD_REQUESTS : [];
  return `<section class="card set-card wide">
    <div class="card-head"><div class="title">${ic('flag')} בקשות שדות מהשטח (${reqs.length})</div>
      <span class="muted" style="font-size:12px">בקשות זהות מרוכזות למניעת עומס · אשר גורף / נקודתי / דחה</span></div>
    <div class="set-body">
      ${reqs.length ? reqs.map(fr => `<div class="fr-item">
        <div class="fr-info">
          <b>${fr.label}</b>
          <span class="badge ${fr.type === 'select' ? 'blue' : 'gray'}">${fr.type === 'select' ? 'בחירה' : 'טקסט'}</span>
          <span class="chip ${fr.action === 'add' ? 'green' : 'amber'} sm">${fr.action === 'add' ? 'הוספה' : 'עריכה'}</span>
          ${fr.count > 1 ? `<span class="chip amber sm">${fr.count} לידים ביקשו</span>` : ''}
          ${fr.options && fr.options.length ? `<small class="muted">אפשרויות: ${fr.options.join(' · ')}</small>` : ''}
          <small class="muted">· מאת ${fr.by}</small>
        </div>
        <div class="fr-act">
          <button class="btn xs primary" data-fr="global|${fr.id}">אשר גורף</button>
          <button class="btn xs" data-fr="local|${fr.id}">נקודתי בלבד</button>
          <button class="btn xs" data-fr="reject|${fr.id}">דחה</button>
        </div>
      </div>`).join('') : `<p class="hint" style="margin:0">${ic('check')} אין בקשות ממתינות — כל מה שאנשי השדה הוסיפו יופיע כאן לאישור מרוכז.</p>`}
    </div>
  </section>`;
}
function bindFieldRequests() {
  $$('[data-fr]').forEach(b => b.addEventListener('click', () => {
    const [act, id] = b.dataset.fr.split('|');
    const idx = FIELD_REQUESTS.findIndex(r => r.id === id); if (idx < 0) return;
    const fr = FIELD_REQUESTS[idx];
    if (act === 'global') { if (LEAD_FIELDS[fr.key]) LEAD_FIELDS[fr.key].status = 'approved'; toast(`"${fr.label}" אושר כשדה גורף לכל המערכת ✓`); }
    else if (act === 'local') { if (LEAD_FIELDS[fr.key]) LEAD_FIELDS[fr.key].status = 'approved'; toast(`"${fr.label}" אושר נקודתית ✓`); }
    else if (act === 'reject') { if (LEAD_FIELDS[fr.key] && LEAD_FIELDS[fr.key].custom) { delete LEAD_FIELDS[fr.key]; const p = LEAD_FIELD_ORDER.indexOf(fr.key); if (p >= 0) LEAD_FIELD_ORDER.splice(p, 1); } toast(`הבקשה ל"${fr.label}" נדחתה`); }
    FIELD_REQUESTS.splice(idx, 1);
    renderSettingsView();
  }));
}

/* --- מסך "שדות פנייה" — היררכי לפי וורקפלואו › קטגוריה › שדות (+ סימון "יומן") --- */
const FLD_TYPE_LBL = { text: 'טקסט', ent: 'סוג ישות', jrn: 'מסלול', src: 'מקור', prio: 'עדיפות', select: 'בחירה', date: 'תאריך' };
function fldDisplayLabel(f) { return (f.label || '').replace(/\s*\*\s*$/, '').trim(); }
function fldIsReq(f) { return f.req !== undefined ? f.req : /\*/.test(f.label || ''); }
const WF_FOR_FIELDS = [
  { key: 'sales', label: 'מכירות' },
  { key: 'support', label: 'שירות' },
  { key: 'billing', label: 'גבייה' },
];
let wfFieldsWf = 'support';
let WF_FIELD_MAP = null;
let wfCatOpen = null;   // Set of "wf|stage" הפתוחים
let wfFieldsOpen = false;   // בלוק "שדות פנייה" מצומצם כברירת מחדל (תופס מקום) — נפתח בלחיצה
function seedFieldDefs() {
  const add = (key, def) => { if (!LEAD_FIELDS[key]) LEAD_FIELDS[key] = Object.assign({ custom: true, status: 'approved', ph: def.label }, def); };
  add('apptdate', { label: 'מועד מבוקש', type: 'date', needsCalendar: true });
  add('needtopic', { label: 'נושא הצורך', type: 'text' });
  add('faulttype', { label: 'סוג תקלה', type: 'select', options: ['תוכנה', 'חומרה', 'חשבון', 'שירות', 'אחר'] });
  add('urgency', { label: 'דחיפות', type: 'select', options: ['רגילה', 'גבוהה', 'קריטית'] });
  add('lognote', { label: 'תיעוד שיחה', type: 'text' });
  add('billamount', { label: 'סכום לגבייה', type: 'text' });
  add('paymethod', { label: 'אמצעי תשלום', type: 'select', options: ['אשראי', 'העברה בנקאית', 'שיק', 'מזומן'] });
}
function initWfFieldMap() {
  if (WF_FIELD_MAP) return;
  seedFieldDefs();
  const base = (typeof LEAD_FIELD_ORDER !== 'undefined') ? LEAD_FIELD_ORDER.slice() : [];
  WF_FIELD_MAP = { sales: {}, support: {}, billing: {} };
  WF_FIELD_MAP.sales.contactinfo = base.slice();
  WF_FIELD_MAP.sales.qualify = ['needtopic'];
  WF_FIELD_MAP.sales.meeting = ['apptdate'];
  WF_FIELD_MAP.support.identify = base.slice();
  WF_FIELD_MAP.support.classify = ['faulttype', 'urgency'];
  WF_FIELD_MAP.support.log = ['lognote'];
  WF_FIELD_MAP.support.schedule = ['apptdate'];
  WF_FIELD_MAP.billing.open = base.slice();
  WF_FIELD_MAP.billing.arrange = ['billamount', 'paymethod'];
  WF_FOR_FIELDS.forEach(w => (WORKFLOWS[w.key] || []).forEach(s => { if (!WF_FIELD_MAP[w.key][s.key]) WF_FIELD_MAP[w.key][s.key] = []; }));
  wfCatOpen = new Set([wfFieldsWf + '|' + ((WORKFLOWS[wfFieldsWf] || []).find(s => (WF_FIELD_MAP[wfFieldsWf][s.key] || []).length) || {}).key]);
}
function fldRowHTML(k, i, count, wf, cat) {
  const f = LEAD_FIELDS[k]; if (!f) return '';
  const hidden = LEAD_HIDDEN.has(k), req = fldIsReq(f), cal = !!f.needsCalendar;
  return `<div class="fld-row ${hidden ? 'is-hidden' : ''}" data-fldkey="${k}">
    <div class="fld-ord">
      <button class="fld-mv" data-wfup="${wf}|${cat}|${k}" ${i === 0 ? 'disabled' : ''} aria-label="הזז מעלה">${ic('chevron')}</button>
      <span class="fld-idx">${i + 1}</span>
      <button class="fld-mv dn" data-wfdn="${wf}|${cat}|${k}" ${i === count - 1 ? 'disabled' : ''} aria-label="הזז מטה">${ic('chevron')}</button>
    </div>
    <div class="fld-main">
      <b>${esc(fldDisplayLabel(f))}</b>
      <span class="fld-tags">
        <span class="badge gray sm">${FLD_TYPE_LBL[f.type] || f.type}</span>
        ${cal ? `<span class="chip blue sm">${ic('calendar')} יומן</span>` : ''}
        ${f.custom ? `<span class="chip blue sm">מותאם</span>` : ''}
        ${hidden ? `<span class="chip red sm">מוסתר</span>` : ''}
      </span>
    </div>
    <div class="fld-ctl">
      <label class="fld-tgl"><span>חובה</span>${toggle(req, `data-fldtgl="req|${k}"`)}</label>
      <label class="fld-tgl"><span>מוצג</span>${toggle(!hidden, `data-fldtgl="vis|${k}"`)}</label>
      <label class="fld-tgl"><span>יומן</span>${toggle(cal, `data-fldtgl="cal|${k}"`)}</label>
      <button class="icon-btn fld-edit" data-fldedit="${k}" title="ערוך שם/אפשרויות">${ic('settings')}</button>
    </div>
  </div>`;
}
/* גוף מסך השדות — מוחזר כ-HTML כדי שאפשר יהיה להציג אותו גם בתוך
   "הגדרות מנהל" וגם כמסך עצמאי, בלי לשכפל את הקוד. */
function fieldsManagerHTML() {
  initWfFieldMap();
  const wf = wfFieldsWf, stages = WORKFLOWS[wf] || [], map = WF_FIELD_MAP[wf] || {};
  const wfSel = `<div class="wf-seg">${WF_FOR_FIELDS.map(w => `<button class="wf-seg-btn ${w.key === wf ? 'on' : ''}" data-wffld="${w.key}">${w.label}</button>`).join('')}</div>`;
  const sections = stages.map(s => {
    const keys = map[s.key] || [], open = wfCatOpen.has(wf + '|' + s.key);
    const rows = keys.length ? keys.map((k, i) => fldRowHTML(k, i, keys.length, wf, s.key)).join('') : `<div class="wf-empty">${ic('docs')} אין שדות בקטגוריה זו עדיין</div>`;
    return `<details class="wf-cat" ${open ? 'open' : ''} data-catid="${wf}|${s.key}">
      <summary class="wf-cat-head"><span class="wf-cat-title">${s.title}</span><span class="wf-cat-count">${keys.length}</span><span class="wf-cat-chev">${ic('chevron')}</span></summary>
      <div class="wf-cat-body">
        <div class="fld-list">${rows}</div>
        <button class="btn sm wf-add" data-wfadd="${wf}|${s.key}">${ic('plus')} הוסף שדה לקטגוריה</button>
      </div>
    </details>`;
  }).join('');
  const anyOpen = [...wfCatOpen].some(id => id.startsWith(wf + '|'));
  return `
    <details class="card set-card wide wf-fields-wrap" ${wfFieldsOpen ? 'open' : ''} id="wfFieldsWrap">
      <summary class="card-head wf-fields-sum"><div class="title">${ic('docs')} שדות פנייה</div>
        <span class="muted" style="font-size:12px">${wfFieldsOpen ? 'לחצו לצמצום' : 'לחצו להצגה'}</span><span class="fd-chev">${ic('chevron')}</span></summary>
      <div class="wf-fields">
        <div class="wf-fields-bar">${wfSel}
          <button class="btn sm" id="wfCollapseAll">${ic(anyOpen ? 'close' : 'expand')} ${anyOpen ? 'צמצם את כל הקטגוריות' : 'הרחב את כל הקטגוריות'}</button></div>
        <p class="hint wf-hint">${ic('bolt')} שדות מאורגנים לפי <b>וורקפלואו › קטגוריה</b>. אפשר לשנות שם, סדר, חובה/תצוגה, ולסמן אם השדה דורש <b>יומן</b> לבחירת מועד.</p>
        ${sections}
      </div>
    </details>
    ${fieldRequestsCardHTML()}`;
}
function bindFieldsManager() {
  /* רינדור-מחדש לפי ההקשר: מסך עצמאי או פאנל הגדרות המנהל */
  const RF = () => {
    if (typeof permsMode !== 'undefined' && permsMode) renderPermissionsView();
    else renderFieldsManagerView();
  };
  /* המשתנים האלה חושבו בבניית ה-HTML — מחשבים אותם מחדש כאן */
  initWfFieldMap();
  const wf = wfFieldsWf, stages = WORKFLOWS[wf] || [];
  const anyOpen = [...wfCatOpen].some(id => id.startsWith(wf + '|'));
  const gms = $('#goMgrSettings'); if (gms) gms.addEventListener('click', () => { fieldsMode = false; permsMode = true; if (typeof permsTab !== 'undefined') permsTab = 'mgr'; renderSettingsView(); });
  const wfw = $('#wfFieldsWrap'); if (wfw) wfw.addEventListener('toggle', () => { wfFieldsOpen = wfw.open; });
  const ca = $('#wfCollapseAll'); if (ca) ca.addEventListener('click', e => {
    e.preventDefault();
    if (anyOpen) [...wfCatOpen].forEach(id => { if (id.startsWith(wf + '|')) wfCatOpen.delete(id); });
    else stages.forEach(s => wfCatOpen.add(wf + '|' + s.key));
    RF();
  });
  $$('[data-wffld]').forEach(b => b.addEventListener('click', () => { wfFieldsWf = b.dataset.wffld; RF(); }));
  $$('.wf-cat').forEach(d => d.addEventListener('toggle', () => { const id = d.dataset.catid; d.open ? wfCatOpen.add(id) : wfCatOpen.delete(id); }));
  $$('[data-fldtgl]').forEach(t => t.addEventListener('click', () => {
    const [act, k] = t.dataset.fldtgl.split('|'); const f = LEAD_FIELDS[k]; if (!f) return;
    if (act === 'vis') { LEAD_HIDDEN.has(k) ? LEAD_HIDDEN.delete(k) : LEAD_HIDDEN.add(k); toast(`"${fldDisplayLabel(f)}" ${LEAD_HIDDEN.has(k) ? 'הוסתר' : 'יוצג'}`); }
    else if (act === 'req') { const nv = !fldIsReq(f); f.req = nv; f.label = fldDisplayLabel(f) + (nv ? ' *' : ''); toast(`"${fldDisplayLabel(f)}" ${nv ? 'הוגדר כחובה' : 'אינו חובה'}`); }
    else if (act === 'cal') { f.needsCalendar = !f.needsCalendar; toast(`"${fldDisplayLabel(f)}" ${f.needsCalendar ? 'ידרוש יומן לבחירת מועד' : 'ללא יומן'}`); }
    RF();
  }));
  $$('[data-wfup]').forEach(b => b.addEventListener('click', () => moveWfField(b.dataset.wfup, -1)));
  $$('[data-wfdn]').forEach(b => b.addEventListener('click', () => moveWfField(b.dataset.wfdn, 1)));
  $$('[data-wfadd]').forEach(b => b.addEventListener('click', e => {
    const [w, cat] = b.dataset.wfadd.split('|');
    openFieldDefPopup({ title: 'הוספת שדה לקטגוריה', label: '', type: 'text', options: [], allowType: true, saveLabel: 'הוסף שדה', x: e.clientX, y: e.clientY,
      onSave: ({ label, type, options }) => {
        const key = 'custom_' + (CUSTOM_FIELD_SEQ++);
        LEAD_FIELDS[key] = { label, type, options, custom: true, status: 'approved', ph: label };
        (WF_FIELD_MAP[w][cat] = WF_FIELD_MAP[w][cat] || []).push(key);
        wfCatOpen.add(w + '|' + cat);
        toast(`השדה "${label}" נוסף`); RF();
      } });
  }));
  $$('[data-fldedit]').forEach(b => b.addEventListener('click', e => {
    const k = b.dataset.fldedit, f = LEAD_FIELDS[k]; if (!f) return;
    openFieldDefPopup({ title: `עריכת שדה · ${fldDisplayLabel(f)}`, label: fldDisplayLabel(f), type: f.type, options: f.options || [], allowType: !!f.custom, saveLabel: 'שמור', x: e.clientX, y: e.clientY,
      onSave: ({ label, type, options }) => {
        f.label = label + (fldIsReq(f) ? ' *' : ''); if (f.custom) { f.type = type; f.options = options; }
        toast('השדה עודכן'); RF();
      } });
  }));
}
function renderFieldsManagerView() {
  $('#viewHost').innerHTML = settingsHeader() + fieldsManagerHTML();
  bindSettingsHeader();
  bindFieldsManager();
}
function moveWfField(spec, dir) {
  const [w, cat, k] = spec.split('|'); const arr = WF_FIELD_MAP[w] && WF_FIELD_MAP[w][cat]; if (!arr) return;
  const i = arr.indexOf(k), j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renderFieldsManagerView();
}
function renderSettingsView() {
  if (permsMode && typeof renderPermissionsView === 'function') return renderPermissionsView();
  if (fieldsMode) return renderFieldsManagerView();
  if (catalogMode) return renderCatalogView();
  if (branchesMode) return renderBranchManagerView();
  if (mgrMode) return renderStaffManagerView();
  const emp = STAFF.find(s => s.id === settingsEmp) || STAFF[0];
  settingsEmp = emp.id;
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    ${empProfileCard(emp)}

    <!-- שעות פעילות — למעלה (היומן מוצג ישירות) + "פתח מסך מלא" לכל תתי-ההגדרות -->
    ${workHoursCard()}

    <!-- פרטי העובד + סוג הרשאה — למטה -->
    ${empDetailsCard(emp)}
    `;
  bindSettingsHeader();
  bindEmpProfile();
  $$('[data-tpl-save]').forEach(b => b.addEventListener('click', () => {
    const v = ($('#waTplArrival').value || '').trim();
    if (!v) { toast('התבנית לא יכולה להיות ריקה'); return; }
    WA_TEMPLATES.arrival = v;
    toast('תבנית אישור ההגעה נשמרה ✓');
  }));
  $$('[data-calstep]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.calstep === 'custom') { if (CAL_STEP_OPTIONS.includes(CAL_STEP.minutes)) CAL_STEP.minutes = 45; renderSettingsView(); return; }
    CAL_STEP.minutes = +b.dataset.calstep;
    renderSettingsView();
    toast(`דיוק התזמון עודכן: ${CAL_STEP.minutes === 60 ? 'שעה' : CAL_STEP.minutes + ' דקות'}`);
  }));
  const csc = $('#calStepCustom'); if (csc) csc.addEventListener('change', () => { CAL_STEP.minutes = Math.max(5, Math.min(180, +csc.value || 15)); renderSettingsView(); toast(`דיוק התזמון: ${CAL_STEP.minutes} דקות`); });
  $$('input[name="fupol"]').forEach(cb => cb.addEventListener('change', () => {
    const modes = [...document.querySelectorAll('input[name="fupol"]:checked')].map(x => x.value);
    FOLLOWUP_POLICY.modes = modes; FOLLOWUP_POLICY.mode = modes[0] || 'same_day';
    toast(`מועד חזרה · ${modes.length} אפשרויות נבחרו`);
  }));
  bindWorkHours();
  bindToggles($('#viewHost'));
}

/* --- כרטיס פרופיל עובד (מגדיר בעצמו: עיסוק, אחריות, זמינות) --- */
/* כרטיס עליון — שם, תפקיד, זמינות בלבד (הפרטים עוברים לכרטיס תחתון) */
function empProfileCard(emp) {
  const av = AVAIL_STATES[emp.avail];
  return `
    <section class="card emp-profile emp-profile-top">
      <div class="emp-profile-head">
        <span class="emp-av-lg">${emp.name[0]}<span class="emp-av-dot" style="background:${av.color}"></span></span>
        <div class="emp-meta">
          <b>${emp.name}</b>
          <small>${emp.dept} · ${emp.role}</small>
        </div>
        <select class="avail-sel" id="empAvail">
          ${Object.entries(AVAIL_STATES).map(([k, v]) => `<option value="${k}" ${emp.avail === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </section>`;
}
/* כרטיס תחתון — מומחיות, סניפים, עיסוק/אחריות, וסוג ההרשאה */
function empDetailsCard(emp) {
  const chips = (list, sel, kind) => list.map(x =>
    `<button class="tag-chip ${sel.includes(x) ? 'on' : ''}" data-${kind}="${x}">${x}</button>`).join('');
  return `
    <section class="card emp-profile emp-details">
      <div class="card-head"><div class="title">${ic('user')} מומחיות ותחומים · ${emp.name}</div>
        <span class="perm-badge">${ic('lock')} הרשאת ${emp.perm}</span></div>
      <div class="emp-profile-body">
        <div class="tag-group"><span class="tag-lbl">${ic('user')} מגדר <small class="muted">— מזין את קריטריון "העדפת מטפל/ת" בבירור צורך</small></span><div class="tag-wrap">
          <button class="tag-chip ${emp.gender === 'm' ? 'on' : ''}" data-empgender="m">גבר</button>
          <button class="tag-chip ${emp.gender === 'f' ? 'on' : ''}" data-empgender="f">אישה</button>
        </div></div>
        <div class="tag-group"><span class="tag-lbl">${ic('tasks')} מומחיות · טיפולים</span><div class="tag-wrap">
          ${COORD_TREATMENTS.map(t => `<button class="tag-chip ${(emp.skills||[]).includes(t.key) ? 'on' : ''}" data-skill="${t.key}">${t.label}</button>`).join('')}
        </div></div>
        <div class="tag-group"><span class="tag-lbl">${ic('org')} סניפים מקושרים</span><div class="tag-wrap">
          ${COORD_BRANCHES.map(b => `<button class="tag-chip ${(emp.branches||[]).includes(b.key) ? 'on' : ''}" data-empbranch="${b.key}">${b.short}</button>`).join('')}
        </div></div>
        <div class="tag-group"><span class="tag-lbl">תחומי עיסוק</span><div class="tag-wrap">${chips(OCCUPATIONS, emp.occ, 'occ')}</div></div>
        <div class="tag-group"><span class="tag-lbl">תחומי אחריות</span><div class="tag-wrap">${chips(RESPONSIBILITIES, emp.resp, 'resp')}</div></div>
      </div>
      <div class="emp-profile-note">${ic('alert')} העובד מגדיר זמינות, מומחיות ותחומים · סוג ההרשאה (${emp.perm}) מנוהל בטאב "הרשאות" · מנהל הסניף מעדכן את פרטי הסניף והעובדים בו · מנהל הרשת רואה ומעדכן הכל.</div>
    </section>`;
}
function bindEmpProfile() {
  const emp = STAFF.find(s => s.id === settingsEmp); if (!emp) return;
  const av = $('#empAvail'); if (av) av.addEventListener('change', () => { emp.avail = av.value; renderSettingsView(); });
  const toggleIn = (arr, val) => { const i = arr.indexOf(val); i >= 0 ? arr.splice(i, 1) : arr.push(val); };
  $$('[data-occ]').forEach(b => b.addEventListener('click', () => { toggleIn(emp.occ, b.dataset.occ); renderSettingsView(); }));
  $$('[data-resp]').forEach(b => b.addEventListener('click', () => { toggleIn(emp.resp, b.dataset.resp); renderSettingsView(); }));
  $$('[data-empgender]').forEach(b => b.addEventListener('click', () => { emp.gender = b.dataset.empgender; syncCoordStaff(); renderSettingsView(); toast('המגדר עודכן · מזין את קריטריון העדפת מטפל/ת'); }));
  $$('[data-skill]').forEach(b => b.addEventListener('click', () => { emp.skills = emp.skills || []; toggleIn(emp.skills, b.dataset.skill); syncCoordStaff(); renderSettingsView(); }));
  $$('[data-empbranch]').forEach(b => b.addEventListener('click', () => { emp.branches = emp.branches || []; toggleIn(emp.branches, b.dataset.empbranch); emp.branch = emp.branches[0] || emp.branch; syncCoordStaff(); renderSettingsView(); }));
}

/* --- תצוגת מנהל כללי: כל העובדים → תיק עובד (דריל-דאון עם חזרה ומעבר בין עובדים) --- */
let mgrEmpOpen = null;   // null = רשימת כל העובדים · id = תיק העובד פתוח
function renderStaffManagerView() {
  if (mgrEmpOpen) return renderStaffFileView();
  const body = `<div class="staff-cards">${STAFF.map(s => {
      const av = AVAIL_STATES[s.avail];
      return `<div class="staff-card" data-staff="${s.id}">
        <div class="sc-top"><span class="emp-av-sm">${s.name[0]}</span><b class="sc-name">${s.name}</b>
          <span class="avail-pill sc-avail"><i style="background:${av.color}"></i>${av.label}</span></div>
        <div class="sc-meta"><span class="badge blue">${s.dept}</span><span class="sc-role">${s.role}</span><span class="chip gray">${s.perm}</span></div>
        ${(s.occ.length || s.resp.length) ? `<div class="sc-tags">${[...s.occ, ...s.resp].map(t => `<span class="mini-tag">${t}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    <section class="card">
      <div class="card-head"><div class="title">${ic('clients')} כל העובדים · ${STAFF.length}</div>
        <span class="muted" style="font-size:12px">לחיצה על עובד → תיק העובד המלא</span></div>
      ${body}
    </section>`;
  bindSettingsHeader();
  $$('#viewHost [data-staff]').forEach(tr => tr.addEventListener('click', () => {
    mgrEmpOpen = tr.dataset.staff; settingsEmp = tr.dataset.staff;
    if (typeof hrEmp !== 'undefined') hrEmp = tr.dataset.staff;
    renderSettingsView();
  }));
}

/* --- תיק העובד: כל הלשוניות של אותו עובד, עם חזרה ומעבר מהיר --- */
function renderStaffFileView() {
  const emp = STAFF.find(x => x.id === mgrEmpOpen) || STAFF[0];
  mgrEmpOpen = emp.id; settingsEmp = emp.id;
  if (typeof hrEmp !== 'undefined') hrEmp = emp.id;
  const av = AVAIL_STATES[emp.avail] || { color: '#9AA1AC', label: '' };
  const idx = STAFF.findIndex(x => x.id === emp.id);
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    <div class="emp-file-bar">
      <button class="btn sm ghost" id="empFileBack">${ic('chevronR')} כל העובדים</button>
      <div class="efb-who"><span class="emp-av-sm">${esc(emp.name[0])}</span>
        <b>${esc(emp.name)}</b><small>${esc(emp.role)} · ${esc(emp.dept)}</small>
        <span class="avail-pill"><i style="background:${av.color}"></i>${av.label}</span></div>
      <div class="efb-nav">
        <button class="icon-btn" id="empPrev" title="העובד הקודם" ${idx <= 0 ? 'disabled' : ''}>${ic('chevronR')}</button>
        <select id="empFileSel">${DEPARTMENTS.map(dp => { const opts = STAFF.filter(x => x.dept === dp)
            .map(x => `<option value="${x.id}" ${x.id === emp.id ? 'selected' : ''}>${x.name} · ${x.role}</option>`).join('');
          return opts ? `<optgroup label="${dp}">${opts}</optgroup>` : ''; }).join('')}</select>
        <button class="icon-btn" id="empNext" title="העובד הבא" ${idx >= STAFF.length - 1 ? 'disabled' : ''}>${ic('chevronL')}</button>
      </div>
    </div>
    ${(typeof hrPanelHTML === 'function') ? hrPanelHTML(true) : ''}`;
  bindSettingsHeader();
  $('#empFileBack').addEventListener('click', () => { mgrEmpOpen = null; renderSettingsView(); });
  const sel = $('#empFileSel'); if (sel) sel.addEventListener('change', () => { mgrEmpOpen = sel.value; renderSettingsView(); });
  const pv = $('#empPrev'); if (pv) pv.addEventListener('click', () => { if (idx > 0) { mgrEmpOpen = STAFF[idx - 1].id; renderSettingsView(); } });
  const nx = $('#empNext'); if (nx) nx.addEventListener('click', () => { if (idx < STAFF.length - 1) { mgrEmpOpen = STAFF[idx + 1].id; renderSettingsView(); } });
  if (typeof bindHrPanel === 'function') bindHrPanel(renderSettingsView);
}

/* --- ניהול סניפים: מופעל · ימי/שעות פתיחה · טיפולים נתמכים · מטפלים מקושרים --- */
const HEB_DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
/* סדר גאוגרפי צפון→דרום (למיון לפי אזור) */
const BRANCH_REGION_ORD = { 'חיפה': 1, 'הרצליה': 2, 'תל אביב': 3, 'מודיעין': 4, 'ירושלים': 5, 'באר שבע': 6 };
function branchStaff(bk) { return STAFF.filter(s => (s.branches || [s.branch]).includes(bk)); }
function sortedBranches() {
  const arr = [...COORD_BRANCHES];
  if (branchSort === 'region') return arr.sort((a, b) => branchOrd(a) - branchOrd(b));   // צפון→אילת לפי נתוני הערים
  return arr.sort((a, b) => a.label.localeCompare(b.label, 'he'));
}
function renderBranchManagerView() {
  const branches = sortedBranches();
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    <details class="match-note collapsible">
      <summary>${ic('bolt')} כלל ההתאמה לשיבוץ<span class="mn-chev">${ic('chevron')}</span></summary>
      <div class="mn-body">טיפול ישובץ רק אם <b>הסניף פעיל</b> ותומך בטיפול, <b>פתוח</b> באותו יום ושעה, <b>ויש מטפל מוסמך המקושר לסניף</b> ונמצא בו באותה שעה.</div>
    </details>
    <div class="branch-controls">
      <label class="bc-sel"><span>מיון</span><select id="brSortSel"><option value="name" ${branchSort === 'name' ? 'selected' : ''}>שם (א-ת)</option><option value="region" ${branchSort === 'region' ? 'selected' : ''}>אזור (צפון→דרום)</option></select></label>
      <label class="bc-sel"><span>תצוגה</span><select id="brViewSel"><option value="cards" ${!branchTable ? 'selected' : ''}>ריבועים</option><option value="table" ${branchTable ? 'selected' : ''}>טבלה</option></select></label>
      <button class="btn sm primary bc-add" id="addBranch">${ic('plus')} הוסף סניף</button>
    </div>
    <datalist id="ilstreets-c">${IL_STREETS.map(s => `<option value="${s}">`).join('')}</datalist>
    ${branchTable ? branchTableHTML(branches) : `<div class="branch-grid">
      ${branches.map(b => branchCardHTML(b)).join('')}
      <section class="card branch-card branch-add">
        <div class="branch-add-inner">${ic('plus')}<b>הוסף סניף</b>
          <button class="btn sm primary" id="addBranch2">${ic('org')} סניף חדש</button></div>
      </section>
    </div>`}`;
  bindSettingsHeader();
  bindBranchManager();
  const ss = $('#brSortSel'); if (ss) ss.addEventListener('change', () => { branchSort = ss.value; renderSettingsView(); });
  const vs = $('#brViewSel'); if (vs) vs.addEventListener('change', () => { branchTable = vs.value === 'table'; renderSettingsView(); });
  const add2 = $('#addBranch2'); if (add2) add2.addEventListener('click', openAddBranch);
}
function branchTableHTML(branches) {
  return `<section class="card"><div class="table-wrap scroll-x"><table class="list branch-list-table edit-table">
    <thead><tr><th>סניף</th><th>כתובת</th><th>סטטוס</th><th>מנהל</th><th>שעות פעילות</th><th>טיפולים נתמכים</th><th>מטפלים</th></tr></thead>
    <tbody>${branches.map(b => { if (typeof ensureBranchFields === 'function') ensureBranchFields(b); const staff = branchStaff(b.key), c = b.city && ilCity(b.city);
      return `<tr class="${b.active ? '' : 'row-off'}">
        <td><button class="branch-enter-cell" data-brenter="${b.key}" title="כניסה להגדרות הסניף"><b>${esc(b.name || b.short)}</b> ${ic('chevronL')}<br><small class="muted">${b.short} · ${b.label}</small></button></td>
        <td class="bt-addr"><div class="br-addr-ro">${b.city ? esc(b.city) + (b.street ? ' · ' + esc(b.street) + ' ' + esc(b.num || '') : '') : '—'} ${b.verified ? `<span class="badge green sm">${ic('check')} מאומת</span>` : `<span class="badge amber sm">לא מאומת</span>`}</div>${c ? `<small class="muted">${c.region}</small>` : ''}</td>
        <td><button class="cswitch sm ${b.active ? 'on' : ''}" data-brtoggle="${b.key}"><i></i></button></td>
        <td><select class="cat-in sm" data-brmgr="${b.key}">${STAFF.map(s => `<option value="${s.id}" ${b.mgr === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></td>
        <td><button class="btn xs" data-brhours="${b.key}">${ic('clock')} שעות ופיצולים</button></td>
        <td class="cell-tags">${COORD_TREATMENTS.map(t => `<button class="tag-chip xs ${b.treatments.includes(t.key) ? 'on' : ''}" data-brtreat="${b.key}|${t.key}">${t.label}</button>`).join('')}</td>
        <td class="cell-tags">${staff.map(s => `<span class="mini-tag">${s.name}</span>`).join('') || '—'}</td>
      </tr>`; }).join('')}</tbody>
  </table></div>
  </section>`;
}

/* ---- קטלוג שירותים/מוצרים/טיפולים: אורך · קטגוריה · הנחיות מקדימות · הנחיות ביצוע ---- */
function catFacts(t) {
  const f = [t.kind, `${t.dur} ד׳`];
  if (t.price) f.push(`${t.price} ₪`);
  if (t.deposit) f.push(`מקדמה ${t.deposit} ₪`);
  return f;
}
let catFilter = 'all', catSort = 'name';
function catalogFiltered() {
  let list = COORD_TREATMENTS.filter(t => catFilter === 'all' || t.kind === catFilter);
  if (catSort === 'price') list = list.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (catSort === 'dur') list = list.slice().sort((a, b) => (a.dur || 0) - (b.dur || 0));
  else if (catSort === 'ext') list = list.slice().sort((a, b) => (b.isExtension ? 1 : 0) - (a.isExtension ? 1 : 0));
  else list = list.slice().sort((a, b) => a.label.localeCompare(b.label, 'he'));
  return list;
}
function renderCatalogView() {
  const items = catalogFiltered();
  const kinds = ['all', ...CATALOG_KINDS];
  const controls = `<div class="branch-controls cat-controls">
      <label class="bc-sel"><span>קטגוריה</span><select id="catFilterSel">${kinds.map(k => `<option value="${k}" ${catFilter === k ? 'selected' : ''}>${k === 'all' ? 'כל הקטגוריות' : k}</option>`).join('')}</select></label>
      <label class="bc-sel"><span>מיון</span><select id="catSortSel">
        <option value="name" ${catSort === 'name' ? 'selected' : ''}>שם (א-ת)</option>
        <option value="price" ${catSort === 'price' ? 'selected' : ''}>מחיר ↓</option>
        <option value="dur" ${catSort === 'dur' ? 'selected' : ''}>אורך ↑</option>
        <option value="ext" ${catSort === 'ext' ? 'selected' : ''}>הרחבות תחילה</option>
      </select></label>
      <button class="btn sm primary bc-add" id="addTreat">${ic('plus')} הוסף</button>
    </div>`;
  // מרקאפ אחד לשני הממשקים — כרטיסים בגריד רספונסיבי (עמודה אחת בנייד, מספר עמודות במחשב)
  const body = `<div class="cat-cards">${items.map(t => `
      <div class="cat-card" data-catcfg="${t.key}">
        <div class="cc-top"><span class="dot ${t.color}"></span><b>${t.label}</b>${t.isExtension ? '<span class="svc-tag ext">הרחבה</span>' : ''}<button class="cc-cfg" aria-label="הגדרות">${ic('settings')}</button></div>
        <div class="cc-facts">${catFacts(t).map(x => `<span>${x}</span>`).join('')}</div>
        <div class="cc-tags">
          ${t.requiresMeeting ? `<span class="svc-tag meet">${ic('calendar')} פגישה</span>` : ''}
          ${t.requiresBilling ? `<span class="svc-tag bill">₪ סליקה</span>` : `<span class="svc-tag free">ללא סליקה</span>`}
          ${t.approval ? `<span class="svc-tag">דורש אישור</span>` : ''}
        </div>
        ${t.pre ? `<div class="cc-note"><b>הכנה:</b> ${esc(t.pre)}</div>` : ''}
      </div>`).join('') || `<div class="pt-empty">${ic('tasks')} אין פריטים בקטגוריה זו</div>`}</div>`;
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    <details class="match-note collapsible">
      <summary>${ic('tasks')} על הקטלוג<span class="mn-chev">${ic('chevron')}</span></summary>
      <div class="mn-body">הקטלוג הוא מקור-האמת. לכל פריט: אורך, מחיר, מקדמה, דרישת פגישה/סליקה, הנחיות — וסימון כ<b>הרחבת שירות</b> אם רלוונטי. לחיצה על פריט פותחת את כל ההגדרות.</div>
    </details>
    ${controls}
    ${body}`;
  bindSettingsHeader();
  const ff = $('#catFilterSel'); if (ff) ff.addEventListener('change', () => { catFilter = ff.value; renderCatalogView(); });
  const cs = $('#catSortSel'); if (cs) cs.addEventListener('change', () => { catSort = cs.value; renderCatalogView(); });
  $$('[data-catcfg]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openCatalogItemEditor(el.dataset.catcfg); }));
  const at = $('#addTreat'); if (at) at.addEventListener('click', openAddTreatment);
}
/* עורך פריט קטלוג מלא — כל המידע: אורך, מחיר, מקדמה, פגישה/סליקה, אישור, הרחבת שירות, הנחיות */
function openCatalogItemEditor(key) {
  const isNew = !key || !(typeof cTreat === 'function' && cTreat(key));
  const t = isNew
    ? { key: 'tr' + (Date.now() % 100000), label: '', color: ['green', 'brand', 'blue', 'red', 'orange', 'amber'][COORD_TREATMENTS.length % 6], kind: CATALOG_KINDS[0], dur: 30, price: 0, deposit: 0, requiresMeeting: true, requiresBilling: false, canScheduleWithoutBilling: true, approval: false, isExtension: false, pre: '', instr: '', equip: false }
    : cTreat(key);
  if (t.extType === undefined) t.extType = 'addon';        // ברירת מחדל: תוספת טיפולים
  if (t.complementsOf === undefined) t.complementsOf = [];  // מוצרים שאליהם הפריט משלים
  if (t.subType === undefined) t.subType = '';             // סוג טיפול (תת-קטגוריה בקטלוג)
  if (t.critKeys === undefined) t.critKeys = [];           // שיוך לקריטריונים מהרישום המרכזי (needs-criteria.js)
  $('#modal').style.maxWidth = '520px'; $('#modal').style.height = '';
  // קורא את כל שדות ה-[data-ce] וה-[data-crit] אל האובייקט לפני רינדור-מחדש (כדי לא לאבד עריכות)
  const syncFields = () => {
    $$('[data-ce]').forEach(inp => {
      const k = inp.dataset.ce;
      if (inp.type === 'checkbox') t[k] = inp.checked;
      else if (inp.type === 'number') t[k] = +inp.value;
      else t[k] = inp.value;
    });
    $$('[data-crit]').forEach(inp => { const [ci, f] = inp.dataset.crit.split(':'); if (t.criteria[+ci]) t.criteria[+ci][f] = inp.value; });
  };
  // פאנל הרחבת השירות — 2 סוגים: תוספת טיפולים / מוצר משלים (עם בחירת מוצרים)
  const extPanel = () => `
    <div class="ext-panel">
      <div class="ext-seg">
        <button type="button" class="ext-seg-btn ${t.extType === 'addon' ? 'on' : ''}" data-exttype="addon">${ic('layers')} תוספת טיפולים</button>
        <button type="button" class="ext-seg-btn ${t.extType === 'complement' ? 'on' : ''}" data-exttype="complement">${ic('plus')} מוצר משלים</button>
      </div>
      <p class="ext-hint">${t.extType === 'addon'
        ? 'תוספת של עוד יחידות מאותו סוג שירות — למשל לקוח שרכש 2 טיפולים ומעוניין להוסיף עוד 3. יוצע כהרחבה בעסקה קיימת.'
        : 'מוצר שמשלים מוצרים אחרים שהלקוח רוכש — בחר לאילו מוצרים הוא משלים; יוצע אוטומטית כתוספת כשאותם מוצרים נבחרים.'}</p>
      ${t.extType === 'complement' ? `<div class="ext-complements">
        <label>${ic('tasks')} משלים למוצרים:</label>
        <div class="ext-chips">${COORD_TREATMENTS.filter(x => x.key !== t.key).map(x =>
          `<button type="button" class="ext-chip ${t.complementsOf.includes(x.key) ? 'on' : ''}" data-complement="${x.key}">${t.complementsOf.includes(x.key) ? ic('check') + ' ' : ''}${x.label}</button>`).join('') || '<span class="muted">אין מוצרים אחרים בקטלוג</span>'}</div>
      </div>` : ''}
    </div>`;
  const render = () => {
    $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic(isNew ? 'plus' : 'settings')}</span> ${isNew ? 'הוספה לקטלוג' : esc(t.label)}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body cat-edit">
      <div class="field"><label>שם *</label><input class="cc-inp" data-ce="label" value="${esc(t.label)}" placeholder="למשל: טיפול פילינג"></div>
      <div class="cat-edit-row">
        <div class="field"><label>קטגוריה</label><select class="cc-inp" data-ce="kind">${CATALOG_KINDS.map(k => `<option ${t.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="field"><label>אורך (דק׳)</label><input class="cc-inp" type="number" data-ce="dur" value="${t.dur}" min="5" max="240" step="5"></div>
      </div>
      <div class="cat-edit-row">
        <div class="field"><label>מחיר (₪)</label><input class="cc-inp" type="number" data-ce="price" value="${t.price || 0}" min="0" step="10"></div>
        <div class="field"><label>מקדמה (₪)</label><input class="cc-inp" type="number" data-ce="deposit" value="${t.deposit || 0}" min="0" step="10"></div>
      </div>
      <label class="cfg-row"><span>דורש פגישה</span><input type="checkbox" data-ce="requiresMeeting" ${t.requiresMeeting ? 'checked' : ''}></label>
      <label class="cfg-row"><span>דורש סליקה</span><input type="checkbox" data-ce="requiresBilling" ${t.requiresBilling ? 'checked' : ''}></label>
      <label class="cfg-row"><span>ניתן לתאם ללא סליקה</span><input type="checkbox" data-ce="canScheduleWithoutBilling" ${t.canScheduleWithoutBilling ? 'checked' : ''}></label>
      <label class="cfg-row"><span>דורש אישור</span><input type="checkbox" data-ce="approval" ${t.approval ? 'checked' : ''}></label>
      <label class="cfg-row hl"><span>${ic('docs')} דורש הסכם חתום<small>לפני התיאום — ההסכם נשלח לחתימה, ורק אחריו סליקה (אם נדרשת)</small></span><input type="checkbox" data-ce="requiresContract" ${t.requiresContract ? 'checked' : ''}></label>
      <label class="cfg-row hl"><span>${ic('layers')} הרחבת שירות (Upsell)<small>יוצע כתוספת בהצעות מחיר</small></span><input type="checkbox" data-ce="isExtension" ${t.isExtension ? 'checked' : ''}></label>
      ${t.isExtension ? extPanel() : ''}
      <div class="field"><label>סוג טיפול · תת-קטגוריה</label><input class="cc-inp" data-ce="subType" value="${esc(t.subType || '')}" placeholder="למשל: אסתטי / שיקומי / מניעתי"></div>
      ${(() => {   // שיוך קריטריונים — ההגדרה עצמה במסך המנהל (מקור-אמת יחיד), כאן רק בוחרים מה רלוונטי לשירות
        if (typeof needsAttachableDefs !== 'function') return '';
        const avail = needsAttachableDefs();
        t.critKeys = t.critKeys || [];
        return `<div class="cat-crit">
          <div class="cat-crit-head"><span>${ic('flag')} קריטריונים לשירות זה <small>מוגדרים בהגדרות › שדות פנייה › קריטריונים — כאן רק משייכים</small></span></div>
          ${avail.length ? `<div class="chips-wrap">${avail.map(d => `<button type="button" class="tag-chip ${t.critKeys.includes(d.key) ? 'on' : ''}" data-ceattach="${esc(d.key)}" title="${esc((d.values || []).join(' · '))}">${esc(d.label)}${t.critKeys.includes(d.key) ? ' ' + ic('check') : ''}</button>`).join('')}</div>
            <p class="hint" style="margin:8px 0 0">${ic('alert')} קריטריון משויך יופיע אוטומטית בבירור הצורך (כשהשירות נבחר) וגם בסניף שמציע את השירות.</p>`
            : `<p class="hint" style="margin:0">${ic('alert')} אין קריטריונים לשיוך. צור קריטריון בהגדרות › שדות פנייה, וסמן אותו "רק אם רלוונטי".</p>`}
        </div>`;
      })()}
      <div class="field"><label>הנחיות מקדימות</label><textarea class="cc-inp" rows="2" data-ce="pre" placeholder="מה הלקוח צריך לפני…">${esc(t.pre || '')}</textarea></div>
      <div class="field"><label>הנחיות ביצוע</label><textarea class="cc-inp" rows="2" data-ce="instr" placeholder="שלבי הטיפול…">${esc(t.instr || '')}</textarea></div>
    </div>
    <div class="modal-foot"><button class="btn primary block" id="ceSave">${ic('check')} ${isNew ? 'הוסף לקטלוג' : 'שמור'}</button></div>`;
    $('#closeModal').addEventListener('click', closeModal);
    // הרחבת שירות → הצג/הסתר את פאנל הסוג
    const ext = $('[data-ce="isExtension"]'); if (ext) ext.addEventListener('change', () => { syncFields(); render(); });
    $$('[data-exttype]').forEach(b => b.addEventListener('click', () => { syncFields(); t.extType = b.dataset.exttype; render(); }));
    $$('[data-complement]').forEach(b => b.addEventListener('click', () => {
      syncFields(); const k = b.dataset.complement, i = t.complementsOf.indexOf(k);
      i >= 0 ? t.complementsOf.splice(i, 1) : t.complementsOf.push(k); render();
    }));
    // שיוך קריטריונים מהרישום המרכזי (בלי הגדרה כפולה כאן)
    $$('[data-ceattach]').forEach(b => b.addEventListener('click', () => {
      syncFields(); t.critKeys = t.critKeys || [];
      const k = b.dataset.ceattach, i = t.critKeys.indexOf(k);
      i >= 0 ? t.critKeys.splice(i, 1) : t.critKeys.push(k);
      render();
    }));
    $('#ceSave').addEventListener('click', () => {
      syncFields();
      if (!(t.label || '').trim()) { toast('נא להזין שם'); return; }
      if (t.isExtension && t.extType === 'complement' && !t.complementsOf.length) { toast('מוצר משלים — בחר לאילו מוצרים הוא משלים'); return; }
      if (isNew) COORD_TREATMENTS.push(t);
      if (typeof window !== 'undefined') window.__coordPool = null;
      if (typeof syncCoordStaff === 'function') syncCoordStaff();
      closeModal(); toast(isNew ? `"${t.label}" נוסף לקטלוג ✓` : 'הפריט עודכן בקטלוג ✓'); renderCatalogView();
    });
  };
  render();
  $('#modalWrap').classList.add('open');
}
function openAddTreatment() { openCatalogItemEditor(null); }
function branchCardHTML(b) {
  if (typeof ensureBranchFields === 'function') ensureBranchFields(b);
  const staff = branchStaff(b.key);
  const mgr = STAFF.find(s => s.id === b.mgr);
  return `<section class="card branch-card ${b.active ? '' : 'inactive'}" data-branchcard="${b.key}">
    <div class="branch-head">
      <button class="branch-title branch-enter" data-brenter="${b.key}" title="כניסה להגדרות הסניף"><span class="branch-ic">${ic('org')}</span>
        <div><b>${esc(b.name || b.short)}</b><small>${b.short} · ${b.label}</small></div>${ic('chevronL')}</button>
      <label class="branch-active"><span>${b.active ? 'פעיל' : 'כבוי'}</span>
        <button class="cswitch ${b.active ? 'on' : ''}" data-brtoggle="${b.key}"><i></i></button></label>
    </div>
    <div class="branch-body">
      <div class="br-sec"><span class="br-lbl">${ic('org')} כתובת</span>
        <div class="br-addr-ro">${b.city ? esc(b.city) + (b.street ? ' · ' + esc(b.street) + ' ' + esc(b.num || '') : '') : '— טרם הוגדרה'}
          ${b.verified ? `<span class="badge green sm">${ic('check')} מאומת</span>` : `<span class="badge amber sm">לא מאומת</span>`}</div>
        <small class="muted">${(b.city && ilCity(b.city)) ? ilCity(b.city).region + ' · ' : ''}לעריכת כתובת ואימות — כניסה לסניף</small></div>
      <button class="btn sm block br-hours-btn" data-brhours="${b.key}">${ic('clock')} שעות פעילות ופיצולים</button>
      <div class="br-sec"><span class="br-lbl">${ic('user')} מנהל סניף</span>
        <select class="cat-in sm" data-brmgr="${b.key}">${STAFF.map(s => `<option value="${s.id}" ${b.mgr === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
      <div class="br-sec"><span class="br-lbl">${ic('tasks')} טיפולים נתמכים</span>
        <div class="tag-wrap">${COORD_TREATMENTS.map(t => `<button class="tag-chip sm ${b.treatments.includes(t.key) ? 'on' : ''}" data-brtreat="${b.key}|${t.key}">${t.label}</button>`).join('')}</div></div>
      <div class="br-sec"><span class="br-lbl">${ic('clients')} מטפלים מקושרים (${staff.length})</span>
        <div class="br-staff">${staff.length ? staff.map(s => `<span class="mini-tag">${s.name}</span>`).join('') : '<span class="muted">אין מטפלים מקושרים — שייך בפרופיל העובד</span>'}</div></div>
    </div>
  </section>`;
}
function bindBranchManager() {
  const br = k => COORD_BRANCHES.find(b => b.key === k);
  $$('[data-brtoggle]').forEach(b => b.addEventListener('click', () => { const x = br(b.dataset.brtoggle); x.active = !x.active; syncCoordStaff(); renderSettingsView(); toast(`הסניף ${x.short} ${x.active ? 'הופעל' : 'כובה'}`); }));
  $$('[data-brday]').forEach(b => b.addEventListener('click', () => { const [k, i] = b.dataset.brday.split('|'); const x = br(k), di = +i; const p = x.days.indexOf(di); p >= 0 ? x.days.splice(p, 1) : x.days.push(di); syncCoordStaff(); renderSettingsView(); }));
  $$('[data-brhour]').forEach(inp => inp.addEventListener('change', () => { const [k, f] = inp.dataset.brhour.split('|'); br(k)[f] = +inp.value; syncCoordStaff(); }));
  $$('[data-brtreat]').forEach(b => b.addEventListener('click', () => { const [k, t] = b.dataset.brtreat.split('|'); const x = br(k); const p = x.treatments.indexOf(t); p >= 0 ? x.treatments.splice(p, 1) : x.treatments.push(t); syncCoordStaff(); renderSettingsView(); }));
  $$('[data-brmgr]').forEach(sel => sel.addEventListener('change', () => { br(sel.dataset.brmgr).mgr = sel.value; }));
  $$('[data-braddr]').forEach(el => el.addEventListener('change', () => { const [k, f] = el.dataset.braddr.split('|'); const x = br(k); x[f] = el.value; if (f === 'city') { x.short = el.value; renderSettingsView(); } }));
  const add = $('#addBranch'); if (add) add.addEventListener('click', openAddBranch);
  $$('[data-brenter]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (typeof openBranchSettings === 'function') openBranchSettings(b.dataset.brenter); }));
  $$('[data-brhours]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (typeof openBranchSettings === 'function') openBranchSettings(b.dataset.brhours, 'hours'); }));
}
function openAddBranch() {
  $('#modal').style.maxWidth = '520px'; $('#modal').style.height = 'auto';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('plus')}</span> הוספת סניף</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="field"><label>עיר / יישוב (מתוך רשימת הערים בישראל, מפולח לאזורים) *</label>
        <select id="nbCity">${IL_REGIONS.map(rg => `<optgroup label="${rg}">${IL_CITIES.filter(x => x.region === rg).map(x => `<option>${x.name}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field-row">
        <div class="field" style="flex:2"><label>רחוב</label><input id="nbStreet" list="ilstreetsm" placeholder="שם רחוב"></div>
        <div class="field"><label>מספר</label><input id="nbNum" placeholder="מס׳"></div>
      </div>
      <datalist id="ilstreetsm">${IL_STREETS.map(s => `<option value="${s}">`).join('')}</datalist>
      <div class="field"><label>שם הסניף (ברירת מחדל: העיר)</label><input id="nbLabel" placeholder="למשל: סניף רעננה"></div>
      <div class="field"><label>מנהל סניף</label><select id="nbMgr">${STAFF.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
      <div class="field"><label>טיפולים נתמכים</label><div class="chk-wrap">${COORD_TREATMENTS.map(t => `<label class="chk"><input type="checkbox" data-nbtreat="${t.key}" checked> ${t.label}</label>`).join('')}</div></div>
      <div class="succ-actions" style="margin-top:6px">
        <button class="btn" id="nbCancel">בטל</button>
        <button class="btn primary" id="nbCreate">${ic('check')} הוסף סניף</button>
      </div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('#nbCancel').addEventListener('click', closeModal);
  $('#nbCreate').addEventListener('click', () => {
    const city = $('#nbCity').value, cInfo = ilCity(city);
    const label = ($('#nbLabel').value || '').trim() || `סניף ${city}`;
    const key = 'br' + (Date.now() % 100000);
    COORD_BRANCHES.push({ key, label, short: city, city, street: ($('#nbStreet').value || '').trim(), num: ($('#nbNum').value || '').trim(),
      on: false, active: true, days: [0, 1, 2, 3, 4], from: 8, to: 18,
      treatments: [...$$('#modal [data-nbtreat]:checked')].map(c => c.dataset.nbtreat), mgr: $('#nbMgr').value });
    syncCoordStaff(); closeModal(); renderSettingsView(); toast(`הסניף "${label}" (${cInfo ? cInfo.region : ''}) נוסף ✓`);
  });
}

/* --- הוספת עובד (מחלקה · תפקיד · עיסוק · אחריות · הרשאה) --- */
function openAddEmployee() {
  $('#modal').style.maxWidth = '560px'; $('#modal').style.height = 'auto';
  const chks = (list, kind) => list.map(x => `<label class="chk"><input type="checkbox" data-new${kind}="${x}"> ${x}</label>`).join('');
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('plus')}</span> הוספת עובד</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label>שם מלא *</label><input id="neName" placeholder="שם העובד"></div>
        <div class="field"><label>מחלקה</label><select id="neDept">${DEPARTMENTS.map(d => `<option>${d}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>תפקיד</label><select id="neRole">${ROLE_PRESETS.map(r => `<option>${r}</option>`).join('')}</select></div>
        <div class="field"><label>הרשאה</label><select id="nePerm">${ROLES.map(r => `<option>${r}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>תחומי עיסוק</label><div class="chk-wrap">${chks(OCCUPATIONS, 'occ')}</div></div>
      <div class="field"><label>תחומי אחריות</label><div class="chk-wrap">${chks(RESPONSIBILITIES, 'resp')}</div></div>
      <div class="succ-actions" style="margin-top:6px">
        <button class="btn" id="neCancel">בטל</button>
        <button class="btn primary" id="neCreate">${ic('check')} הוסף עובד</button>
      </div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('#neCancel').addEventListener('click', closeModal);
  $('#neCreate').addEventListener('click', () => {
    const name = $('#neName').value.trim();
    if (!name) { toast('נא למלא שם'); return; }
    const occ = $$('[data-newocc]:checked').map(c => c.dataset.newocc);
    const resp = $$('[data-newresp]:checked').map(c => c.dataset.newresp);
    const id = 'e' + (STAFF.length + 1);
    STAFF.push({ id, name, dept: $('#neDept').value, role: $('#neRole').value, perm: $('#nePerm').value, occ, resp, avail: 'available' });
    settingsEmp = id; mgrMode = false;
    closeModal(); renderSettingsView();
    toast(`נוסף עובד: ${name} (${$('#neDept').value})`);
  });
}

/* ============================================================
   16. מסך אוטומציות + 9. תרשים זרימת ליד
   ============================================================ */
function renderAutomationView() {
  if (typeof renderAutomationsScreen === 'function') return renderAutomationsScreen();
  $('#viewHost').innerHTML = '<div class="empty">מודול האוטומציות אינו זמין</div>';
}

/* ============================================================
   יומן מלא רב-עובדים (9 / מסך 4) – יום/שבוע/חודש + ניווט + בחירת זמן
   ============================================================ */
const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HEB_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const HEB_DAYS_S = ['א','ב','ג','ד','ה','ו','ש'];
const DEMO_DAY   = '2024-05-23';           // יום אירועי הדמו — מיושר לזמן-הייחוס (COORD_TODAY)
/* צפיפות אירועים לחודש (למראה חי) */
const MONTH_DENSITY = { '2024-05-20': 3, '2024-05-21': 2, '2024-05-22': 11, '2024-05-23': 4, '2024-05-27': 2, '2024-05-28': 5, '2024-05-30': 3 };

let calMode = 'day';
let calDate = (typeof clockTodayDate === 'function') ? clockTodayDate() : new Date(2024, 4, 23);   // מתבסס על זמן-הייחוס
let calSelSlot = null;
let calManagerView = false;                // מנהל ראשי — פירוט מלא בכל היומנים
let calMoveEv = null;                      // מצב הזזת אירוע — {owner, ev}
let calRerender = null;                    // רינדור מחדש של היומן הפעיל (מסך/מודל)
const calCanSee = (owner) => calManagerView || owner === CURRENT_USER;

function fmtH(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; }
function dkey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; } // ראשון
function calLabel() {
  if (calMode === 'day')   return `יום ${HEB_DAYS[calDate.getDay()]}, ${calDate.getDate()} ${HEB_MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
  if (calMode === 'week')  { const s = calDate, e = addDays(calDate, 6);
    return `${s.getDate()}/${s.getMonth() + 1} – ${e.getDate()}/${e.getMonth() + 1} ${e.getFullYear()}`; }
  return `${HEB_MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
}
function calShift(dir) {
  // חלון מתגלגל: יום ושבוע זזים יום-יום (בשבוע נחשף יום קדימה ונעלם יום אחורה); חודש — חודש-חודש
  if (calMode === 'day' || calMode === 'week') calDate = addDays(calDate, dir);
  else calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
}
function calToolbarHTML() {
  return `<div class="cal-toolbar">
    <div class="seg">
      <button class="seg-btn ${calMode==='day'?'on':''}" data-mode="day">יום</button>
      <button class="seg-btn ${calMode==='week'?'on':''}" data-mode="week">שבוע</button>
      <button class="seg-btn ${calMode==='month'?'on':''}" data-mode="month">חודש</button>
    </div>
    <div class="cal-nav">
      <button class="icon-btn" data-nav="-1" title="הקודם">${ic('chevronR')}</button>
      <button class="btn sm" data-nav="today">היום</button>
      <button class="icon-btn" data-nav="1" title="הבא">${ic('chevronL')}</button>
    </div>
    <span class="cal-label">${calLabel()}</span>
    ${calMoveEv ? `<span class="cal-move-note">${ic('clock')} בחר משבצת פנויה עבור <b>${calMoveEv.ev.t}</b>
      <button class="btn sm" data-move-cancel>ביטול</button></span>` : ''}
    <div class="spacer"></div>
    <button class="btn sm ${calManagerView ? 'primary' : ''}" data-cal-mgr
      title="מנהל ראשי רואה פירוט מלא בכל היומנים · אחרת רק ביומן שלך">${ic('eye')} תצוגת מנהל ראשי</button>
    <button class="btn sm primary" data-cal-smart>${ic('clock')} תזמון חכם והצעת זמנים</button>
    <button class="btn sm">${ic('sync')} Google</button>
  </div>`;
}
function calContentHTML() {
  return `<section class="card">${calMode === 'day' ? calDayHTML() : calMode === 'week' ? calWeekHTML() : calMonthHTML()}</section>`;
}
function bindCalFull(scope, rerender) {
  calRerender = rerender;
  const sm = $('[data-cal-smart]', scope);
  if (sm) sm.addEventListener('click', () => openScheduleModal(RECORDS[0]));
  const mgr = $('[data-cal-mgr]', scope);
  if (mgr) mgr.addEventListener('click', () => {
    calManagerView = !calManagerView;
    rerender();
    toast(calManagerView ? 'תצוגת מנהל ראשי: פירוט מלא בכל היומנים' : 'תצוגה רגילה: פירוט רק ביומן שלך, השאר "תפוס"');
  });
  const mc = $('[data-move-cancel]', scope);
  if (mc) mc.addEventListener('click', () => { calMoveEv = null; rerender(); });
  $$('[data-mode]', scope).forEach(b => b.addEventListener('click', () => { calMode = b.dataset.mode; calSelSlot = null; rerender(); }));
  $$('[data-nav]', scope).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'today') calDate = (typeof clockTodayDate==='function'?clockTodayDate():new Date(2024,4,23)); else calShift(+b.dataset.nav);
    rerender();
  }));
  $$('.mcal-ev', scope).forEach(e => e.addEventListener('click', ev => {
    ev.stopPropagation();
    if (e.classList.contains('busy')) return toast('הזמן תפוס · פרטי האירוע חסויים — יומן של עובד אחר');
    if (e.dataset.rec) openCalEvPopover(e);
    else toast(`אירוע: ${e.dataset.t}`);
  }));
  $$('.slot-free', scope).forEach(c => c.addEventListener('click', () => pickCalSlot(c)));
  $$('.mo-cell', scope).forEach(c => c.addEventListener('click', () => { calDate = new Date(c.dataset.d + 'T00:00:00'); calMode = 'day'; rerender(); }));
}
function renderCalendarView() {
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">4</span> יומן מלא – כל הגורמים המטפלים</div></div>
    ${calToolbarHTML()}${calContentHTML()}`;
  bindCalFull($('#viewHost'), renderCalendarView);
}
/* דורס את openCalendarModal מ-app.js – אותו יומן פונקציונלי בתוך מודל */
function openCalendarModal() {
  $('#modal').style.maxWidth = '1000px'; $('#modal').style.height = '';
  const render = () => {
    $('#modal').innerHTML = `<div class="modal-head"><div class="title"><span class="num">4</span> יומן מלא – צפייה ובחירת זמן</div>
        <button class="close-btn" id="closeModal">${ic('close')}</button></div>
      <div class="modal-body cal-modal">${calToolbarHTML()}${calContentHTML()}</div>`;
    $('#closeModal').addEventListener('click', closeModal);
    bindCalFull($('#modal'), render);
  };
  render();
  $('#modalWrap').classList.add('open');
}

/* ---- תצוגת יום: עמודות עובדים ---- */
function calDayHTML() {
  const hours = []; for (let h = 8; h <= 18; h++) hours.push(h);
  const isDemo = dkey(calDate) === DEMO_DAY;
  return `<div class="mcal" style="grid-template-columns:56px repeat(${CAL_OWNERS.length}, 1fr)">
    <div class="mcal-corner"></div>
    ${CAL_OWNERS.map(o => `<div class="mcal-owner">${o}</div>`).join('')}
    ${hours.map(h => `
      <div class="mcal-hour">${String(h).padStart(2,'0')}:00</div>
      ${CAL_OWNERS.map(o => {
        const evs = isDemo ? (CAL_EVENTS[o] || []).filter(e => Math.floor(e.h) === h) : [];
        if (evs.length) return `<div class="mcal-cell filled">${evs.map(ev => calEvHTML(ev, false, o)).join('')}</div>`;
        if (isDemo && (h + 1) * 60 <= nowHM()) return `<div class="mcal-cell past" title="השעה עברה — אין קביעה בהיסטוריה"></div>`;
        return `<div class="mcal-cell slot-free ${calMoveEv ? 'move-target' : ''}" data-o="${o}" data-h="${h}" data-d="${dkey(calDate)}"></div>`;
      }).join('')}
    `).join('')}
  </div>`;
}

/* ---- תצוגת שבוע: 7 ימים × שעות ---- */
function calWeekHTML() {
  const hours = []; for (let h = 8; h <= 18; h++) hours.push(h);
  const s = calDate;   // חלון מתגלגל של 7 ימים מ-calDate
  const days = Array.from({length: 7}, (_, i) => addDays(s, i));
  return `<div class="mcal" style="grid-template-columns:56px repeat(7, 1fr)">
    <div class="mcal-corner"></div>
    ${days.map(d => `<div class="mcal-owner ${dkey(d)===DEMO_DAY?'is-today':''}">${HEB_DAYS_S[d.getDay()]}<small>${d.getDate()}/${d.getMonth()+1}</small></div>`).join('')}
    ${hours.map(h => `
      <div class="mcal-hour">${String(h).padStart(2,'0')}:00</div>
      ${days.map(d => {
        const evs = dkey(d) === DEMO_DAY ? (CAL_EVENTS[CURRENT_USER] || []).filter(e => Math.floor(e.h) === h) : [];
        if (evs.length) return `<div class="mcal-cell filled">${evs.map(ev => calEvHTML(ev, true, CURRENT_USER)).join('')}</div>`;
        if (dkey(d) === DEMO_DAY && (h + 1) * 60 <= nowHM()) return `<div class="mcal-cell past" title="השעה עברה — אין קביעה בהיסטוריה"></div>`;
        return `<div class="mcal-cell slot-free" data-o="${HEB_DAYS[d.getDay()]}" data-h="${h}" data-d="${dkey(d)}"></div>`;
      }).join('')}
    `).join('')}
  </div>`;
}

/* ---- תצוגת חודש: רשת ---- */
function calMonthHTML() {
  const first = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({length: 42}, (_, i) => addDays(gridStart, i));
  return `<div class="mo-grid">
    ${HEB_DAYS_S.map(d => `<div class="mo-head">${d}</div>`).join('')}
    ${cells.map(d => {
      const inMonth = d.getMonth() === calDate.getMonth();
      const k = dkey(d), cnt = MONTH_DENSITY[k] || 0, today = k === DEMO_DAY;
      return `<div class="mo-cell ${inMonth?'':'out'} ${today?'today':''}" data-d="${k}">
        <span class="mo-num">${d.getDate()}</span>
        ${cnt ? `<div class="mo-dots">${Array.from({length: Math.min(cnt,4)}, () => '<i></i>').join('')}${cnt>4?`<span>+${cnt-4}</span>`:''}</div>
          <div class="mo-cnt">${cnt} אירועים</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* אירוע יומן – שם ליד לחיץ + חפיפה (רוחב מצומצם, שורה אחת)
   הרשאות: יומן של עובד אחר מוצג כ"תפוס" בלבד, אלא אם תצוגת מנהל ראשי */
function calEvHTML(ev, weekMode, owner) {
  const time = weekMode ? fmtH(ev.h) : `${fmtH(ev.h)}–${fmtH(ev.h + ev.dur)}`;
  if (owner && !calCanSee(owner)) {
    return `<div class="mcal-ev busy" style="min-height:${ev.dur * 40}px" title="פרטי האירוע חסויים · יומן של ${owner}">
      <span class="ev-t">תפוס</span><small>${time}</small></div>`;
  }
  return `<div class="mcal-ev ${ev.c} ${ev.recId ? 'link' : ''}" data-t="${ev.t}" data-owner="${owner || ''}" ${ev.recId ? `data-rec="${ev.recId}" title="פנייה מקושרת: ${ev.t}"` : ''} style="min-height:${ev.dur * 40}px">
    <span class="ev-t">${ev.t}</span><small>${time}</small></div>`;
}
/* בחירת זמן בתא שעה — לפי דיוק התזמון מההגדרות (התצוגה נשארת שעתית) */
function pickCalSlot(cell) {
  if (calMoveEv) return moveCalEvent(cell);
  const step = CAL_STEP.minutes;
  if (step >= 60) return selectCalTime(cell, `${String(cell.dataset.h).padStart(2, '0')}:00`);
  showMinutePicker(cell, step);
}
function selectCalTime(cell, time) {
  closeMinutePicker();
  $$('.slot-free.sel').forEach(x => { x.classList.remove('sel'); x.innerHTML = ''; });
  cell.classList.add('sel');
  calSelSlot = { o: cell.dataset.o, h: cell.dataset.h, d: cell.dataset.d, time };
  cell.innerHTML = `<div class="slot-pick">${ic('plus')} ${time}</div>`;
  openSlotCreateModal();
}

/* ---- הזזת אירוע קיים למשבצת פנויה ---- */
function moveCalEvent(cell) {
  const { owner, ev } = calMoveEv;
  const newOwner = CAL_OWNERS.includes(cell.dataset.o) ? cell.dataset.o : owner;
  const list = CAL_EVENTS[owner];
  const i = list.indexOf(ev); if (i > -1) list.splice(i, 1);
  ev.h = +cell.dataset.h;
  (CAL_EVENTS[newOwner] = CAL_EVENTS[newOwner] || []).push(ev);
  calMoveEv = null;
  if (calRerender) calRerender();
  toast(`"${ev.t}" הוזז ל־${fmtH(ev.h)} · ${newOwner} ✓ הודעת עדכון נשלחה ללקוח`);
}

/* ---- פופאובר פנייה מקושרת מתוך היומן ---- */
function openCalEvPopover(el) {
  closeEvPopover();
  const r = RECORDS.find(x => x.id === +el.dataset.rec);
  const owner = el.dataset.owner || CURRENT_USER;
  const ev = (CAL_EVENTS[owner] || []).find(e => e.recId === r.id && e.t === el.dataset.t);
  if (!r || !ev) return;
  const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
  const pop = document.createElement('div');
  pop.className = 'minute-pop ev-pop'; pop.id = 'evPop';
  pop.innerHTML = `
    <div class="mp-title">${ic('flag')} פנייה מקושרת · ${owner}</div>
    <div class="evp-body">
      <b>${r.name}</b>
      <div class="evp-badges"><span class="badge ${et.color}">${et.label}</span>
        <span class="badge ${jt.color}">${jt.label}</span>
        <span class="chip ${r.status.color} sm">${r.status.label}</span></div>
      <div class="evp-meta">
        <span>${ic('target')} ${OBJECTIVES[r.objective] || r.subject || '—'}</span>
        <span>${ic('clock')} ${fmtH(ev.h)}–${fmtH(ev.h + ev.dur)} · SLA: <b class="${r.sla.color}">${r.sla.label}</b></span>
      </div>
      <div class="evp-actions">
        <button class="btn sm primary" data-evp="open">${ic('expand')} פתח פנייה</button>
        <button class="btn sm" data-evp="move">${ic('sync')} הזז לזמן פנוי</button>
      </div>
    </div>`;
  document.body.appendChild(pop);
  const rc = el.getBoundingClientRect();
  let top = rc.bottom + 5, left = rc.left;
  if (top + pop.offsetHeight > window.innerHeight - 10) top = rc.top - pop.offsetHeight - 5;
  if (left + pop.offsetWidth > window.innerWidth - 10) left = window.innerWidth - pop.offsetWidth - 10;
  pop.style.top = `${Math.max(8, top)}px`; pop.style.left = `${Math.max(8, left)}px`;
  pop.querySelector('[data-evp="open"]').addEventListener('click', () => { closeEvPopover(); closeModal(); openDrawer(r); });
  pop.querySelector('[data-evp="move"]').addEventListener('click', () => {
    closeEvPopover();
    calMoveEv = { owner, ev };
    if (calRerender) calRerender();
    toast('בחר משבצת פנויה ביומן — האירוע יועבר אליה לפי הקריטריונים');
  });
  setTimeout(() => document.addEventListener('click', evPopOutside), 0);
}
function evPopOutside(e) { const p = $('#evPop'); if (p && !p.contains(e.target)) closeEvPopover(); }
function closeEvPopover() { $('#evPop')?.remove(); document.removeEventListener('click', evPopOutside); }

/* ---- קביעה חדשה במשבצת פנויה: שיוך לליד / לקוח / אירוע / חסימה ---- */
function openSlotCreateModal() {
  const s = calSelSlot; if (!s) return;
  const [y, m, dd] = s.d.split('-');
  $('#modal').style.maxWidth = '540px'; $('#modal').style.height = '';
  const head = `<div class="modal-head"><div class="title"><span class="num">4</span> קביעה חדשה · ${dd}/${m} · ${s.time} · ${s.o}</div>
    <button class="close-btn" id="closeModal">${ic('close')}</button></div>`;
  const renderTypes = () => {
    $('#modal').innerHTML = `${head}<div class="modal-body">
      <p class="hint" style="margin-top:0">${ic('alert')} בחר מה לקבוע במשבצת — הפנייה או האירוע ישויכו ליומן של ${s.o}</p>
      <div class="slot-type-grid">
        <button data-st="lead">${ic('lead')}<b>פגישה לליד</b><small>שיוך פנייה קיימת של ליד / מתעניין</small></button>
        <button data-st="customer">${ic('customer')}<b>תור ללקוח</b><small>שירות, טיפול או תור ללקוח קיים</small></button>
        <button data-st="event">${ic('calendar')}<b>אירוע פנימי</b><small>ישיבה, הדרכה או משימה פנימית</small></button>
        <button data-st="block">${ic('pause')}<b>חסימת זמן</b><small>הפסקה / לא זמין לקביעות</small></button>
      </div>
      <div id="slotStep2"></div></div>`;
    $('#closeModal').addEventListener('click', () => { calSelSlot = null; closeModal(); });
    $$('#modal [data-st]').forEach(b => b.addEventListener('click', () => {
      $$('#modal [data-st]').forEach(x => x.classList.toggle('on', x === b));
      renderStep2(b.dataset.st);
    }));
  };
  const renderStep2 = (type, q = '') => {
    const host = $('#slotStep2');
    if (type === 'block') {
      addCalEvent({ h: +s.h, dur: 1, t: 'חסום – לא זמין', c: 'gray' });
      return;
    }
    if (type === 'event') {
      host.innerHTML = `<div class="sc-form">
        <input class="sc-input" id="scTitle" placeholder="שם האירוע (ישיבה, הדרכה…)">
        <select class="sc-input" id="scDur"><option value="0.5">30 דק'</option><option value="1" selected>שעה</option><option value="1.5">שעה וחצי</option></select>
        <button class="btn sm primary" id="scSave">${ic('check')} קבע אירוע</button></div>`;
      $('#scSave').addEventListener('click', () => {
        const t = $('#scTitle').value.trim() || 'אירוע פנימי';
        addCalEvent({ h: +s.h, dur: +$('#scDur').value, t, c: 'blue' });
      });
      return;
    }
    const isLead = type === 'lead';
    const recs = RECORDS.filter(r => isLead ? ['lead', 'prospect'].includes(r.entity) : ['customer', 'former'].includes(r.entity))
      .filter(r => !q || r.name.includes(q) || (r.phone || '').includes(q));
    host.innerHTML = `
      <input class="sc-input" id="scSearch" placeholder="חיפוש לפי שם או טלפון…" value="${q}">
      <div class="sc-list">${recs.length ? recs.map(r => `
        <div class="sc-item" data-rec="${r.id}">
          <b>${r.name}</b>
          <span class="badge ${JOURNEY_TYPES[r.journey].color}">${JOURNEY_TYPES[r.journey].label}</span>
          <span class="chip ${r.status.color} sm">${r.status.label}</span>
          <small class="muted">${r.phone || ''}</small>
        </div>`).join('') : `<div class="sc-empty">לא נמצאו רשומות מתאימות</div>`}</div>`;
    const inp = $('#scSearch');
    inp.addEventListener('input', () => renderStep2(type, inp.value.trim()));
    inp.focus(); inp.setSelectionRange(q.length, q.length);
    $$('#modal .sc-item').forEach(el => el.addEventListener('click', () => {
      const r = RECORDS.find(x => x.id === +el.dataset.rec);
      addCalEvent({ h: +s.h, dur: .5, t: `${r.name} – ${isLead ? 'פגישה' : 'תור'}`, c: isLead ? 'green' : 'orange', recId: r.id });
    }));
  };
  const addCalEvent = (ev) => {
    const owner = CAL_OWNERS.includes(s.o) ? s.o : CURRENT_USER;
    (CAL_EVENTS[owner] = CAL_EVENTS[owner] || []).push(ev);
    calSelSlot = null;
    closeModal();
    if (calRerender) calRerender();
    toast(`נקבע: "${ev.t}" · ${fmtH(ev.h)} · ${owner} ✓${ev.recId ? ' הפנייה קושרה ליומן' : ''}`);
  };
  renderTypes();
  $('#modalWrap').classList.add('open');
}
function showMinutePicker(cell, step) {
  closeMinutePicker();
  const h = +cell.dataset.h;
  const isToday = cell.dataset.d === DEMO_DAY;
  const times = [];
  for (let m = 0; m < 60; m += step) {
    if (isToday && h * 60 + m <= nowHM()) continue;   // אין דקות שעברו
    times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  if (!times.length) { toast('כל הדקות בשעה זו עברו'); return; }
  const pop = document.createElement('div');
  pop.className = 'minute-pop'; pop.id = 'minutePop';
  pop.innerHTML = `<div class="mp-title">${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 · בחר התחלה</div>
    <div class="mp-grid cols-${step <= 5 ? 4 : step <= 15 ? 3 : 2}">${times.map(t => `<button data-mp="${t}">${t}</button>`).join('')}</div>`;
  document.body.appendChild(pop);
  const rc = cell.getBoundingClientRect();
  let top = rc.bottom + 5, left = rc.left;
  if (top + pop.offsetHeight > window.innerHeight - 10) top = rc.top - pop.offsetHeight - 5;
  if (left + pop.offsetWidth > window.innerWidth - 10) left = window.innerWidth - pop.offsetWidth - 10;
  pop.style.top = `${Math.max(8, top)}px`; pop.style.left = `${Math.max(8, left)}px`;
  $$('[data-mp]', pop).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); selectCalTime(cell, b.dataset.mp); }));
  setTimeout(() => document.addEventListener('click', mpOutside), 0);
}
function mpOutside(e) { if (!e.target.closest('#minutePop')) closeMinutePicker(); }
function closeMinutePicker() { const p = $('#minutePop'); if (p) p.remove(); document.removeEventListener('click', mpOutside); }

/* ============================================================
   מנוע Workflow דינמי – תהליך-על + כל המסלולים
   ============================================================ */
/* תהליך-על: 8 שלבים גנריים שכל המסלולים (שירות/מכירות/גבייה…) ממופים אליהם */
const META_STAGES = [
  { key: 'intake',   title: 'קליטת פנייה',   icon: 'leads' },
  { key: 'assign',   title: 'שיוך גורם',     icon: 'user' },
  { key: 'contact',  title: 'יצירת קשר',     icon: 'phone' },
  { key: 'handle',   title: 'טיפול / תיאום', icon: 'calendar' },
  { key: 'execute',  title: 'ביצוע',         icon: 'bolt' },
  { key: 'summary',  title: 'סיכום ותוצאה',  icon: 'note' },
  { key: 'followup', title: 'פולו-אפ',       icon: 'clock' },
  { key: 'close',    title: 'סגירה',         icon: 'flag' },
];
const META_MAP = {
  intake:   ['intake', 'open', 'request', 'create', 'contactinfo'],
  assign:   ['assign', 'identify', 'provider'],
  contact:  ['contact', 'call', 'notify', 'need', 'qualify', 'classify'],
  handle:   ['meeting', 'schedule', 'offer', 'time', 'svc', 'confirm', 'arrange', 'review', 'diagnose', 'log', 'present', 'remind', 'reminder'],
  execute:  ['held', 'arrive', 'handle', 'implement', 'collect', 'waitcust'],
  summary:  ['summary', 'verify', 'csat', 'outcome', 'proposal', 'approve'],
  followup: ['followup', 'monitor', 'nextact'],
  close:    ['close'],
};
function metaOf(stageKey) {
  for (const m in META_MAP) if (META_MAP[m].includes(stageKey)) return m;
  return 'handle';
}
let wfViewMode = 'meta';
let wfMetaSel = null;
let wfEdit = false;      // מצב עריכה גורפת של מסלולים ושלבים
let wfKeySeq = 1;        // מזהי-שלב/מסלול חדשים ייחודיים

function metaMapHTML() {
  const mapJourneys = ['sales', 'support', 'billing'];
  return `
    <section class="card" style="margin-top:16px">
      <div class="card-head"><div class="title">${ic('target')} מיפוי מסלולים לתהליך-העל</div>
        <span class="muted" style="font-size:12px">איך כל תהליך ספציפי יושב על השלבים הגנריים</span></div>
      <div class="table-wrap"><table class="mini-table meta-map">
        <thead><tr><th>מסלול</th>${META_STAGES.map(s => `<th>${s.title}</th>`).join('')}</tr></thead>
        <tbody>${mapJourneys.map(j => {
          const flow = workflowFor(j);
          const cells = META_STAGES.map(m => flow.filter(s => metaOf(s.key) === m.key).map(s => s.title).join(' · ') || '—');
          return `<tr><td><span class="badge ${JOURNEY_TYPES[j].color}">${JOURNEY_TYPES[j].label}</span></td>
            ${cells.map(c => `<td class="${c === '—' ? 'muted' : ''}">${c}</td>`).join('')}</tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
}
function metaFlowHTML() {
  const byMeta = {}; META_STAGES.forEach(s => byMeta[s.key] = []);
  RECORDS.forEach(r => byMeta[r.done ? 'close' : metaOf(r.stageKey)].push(r));
  return `
    <section class="card meta-flow">
      <div class="card-head"><div class="title">${ic('layers')} תהליך-העל של טיפול בפנייה · לוח</div>
        <span class="muted" style="font-size:12px">גרור פנייה בין טורים כדי להעביר שלב</span></div>
      <div class="meta-kb">
        ${META_STAGES.map(s => `
          <div class="kb-col" data-kbcol="${s.key}">
            <div class="kb-head">
              <span class="ms-ic sm">${ic(s.icon)}</span>
              <b>${s.title}</b>
              <span class="ms-count ${byMeta[s.key].length ? '' : 'zero'}">${byMeta[s.key].length}</span>
            </div>
            <div class="kb-cards">
              ${byMeta[s.key].map(r => `
                <div class="kb-card ${recIsOverdue(r) ? 'over-due' : ''}" draggable="true" data-kbrec="${r.id}">
                  <div class="kb-top"><b>${r.name}</b>
                    <span class="badge ${JOURNEY_TYPES[r.journey].color}">${JOURNEY_TYPES[r.journey].label}</span></div>
                  <div class="kb-stage">${(workflowFor(r.journey).find(x => x.key === r.stageKey) || {}).title || ''}</div>
                  ${r.next?.at && r.next.at !== '—' ? `<div class="kb-next">${ic('clock')} ${r.next.at}</div>` : ''}
                </div>`).join('')}
              ${!byMeta[s.key].length ? '<div class="kb-empty">גרור לכאן</div>' : ''}
            </div>
          </div>`).join('')}
      </div>
    </section>`;
}

function wfCardHTML(j) {
  const stages = WORKFLOWS[j], jt = JOURNEY_TYPES[j] || { label: j, color: 'gray' };
  const head = wfEdit
    ? `<div class="card-head wf-edit-head">
        <input class="wf-route-name" data-wfrename="${j}" value="${esc(jt.label)}">
        <button class="wf-rmroute" data-wfrmroute="${j}" title="הסר מסלול">${ic('close')}</button></div>`
    : `<div class="card-head"><div class="title"><span class="badge ${jt.color}">${jt.label}</span></div>
        <span class="muted" style="font-size:11px">${stages.length} שלבים</span></div>`;
  const active = stages.filter(s => !stageIsBlocked(j, s.key));
  const blocked = stages.filter(s => stageIsBlocked(j, s.key));
  /* שלב אינו נמחק — מי שלא רוצה אותו חוסם אותו, והוא יושב קבוע למטה */
  const stageRow = (s, i) => {
    const off = stageIsOffByDefault(j, s.key);
    const idx = WORKFLOWS[j].indexOf(s);
    if (!wfEdit) return `<div class="wf-stage meta-${metaOf(s.key)} ${off ? 'off-default' : ''}">
      <span class="wf-num">${i + 1}</span><span class="wf-st-title">${s.title}</span>
      ${off ? `<small class="wf-offtag">${ic('eye')} כבוי כברירת מחדל</small>` : ''}
      <small class="wf-meta">${META_STAGES.find(m => m.key === metaOf(s.key)).title}</small></div>`;
    return `<div class="wf-stage editable meta-${metaOf(s.key)} ${off ? 'off-default' : ''}">
      <span class="wf-num">${i + 1}</span>
      <span class="wf-st-title">${s.title}
        ${off ? `<small class="wf-offtag">${ic('eye')} כבוי כברירת מחדל</small>` : ''}</span>
      <span class="wf-st-act">
        <span class="wf-move">
          <button data-wfup="${j}|${idx}" ${i <= 0 ? 'disabled' : ''} aria-label="העלה" title="העלה שלב">${ic('chevron')}</button>
          <button class="dn" data-wfdn="${j}|${idx}" ${i >= active.length - 1 ? 'disabled' : ''} aria-label="הורד" title="הורד שלב">${ic('chevron')}</button>
        </span>
        <button class="eye ${off ? 'on' : ''}" data-wfeye="${j}|${s.key}"
          title="${off ? 'כבוי כברירת מחדל — לחץ להפעלה' : 'כבה כברירת מחדל (יופעל פרטנית בכל ליד)'}">${ic('eye')}</button>
        <button class="block" data-wfbin="${j}|${s.key}" title="חסום — השלב ירד לתחתית ולא יוצג בתהליך">${ic('close')}</button>
      </span></div>`;
  };
  return `<section class="card wf-card">
    ${head}
    <div class="wf-stages">
      ${active.map((s, i) => stageRow(s, i)).join('')}
      ${wfEdit ? `<div class="wf-addstage"><input data-wfaddinp="${j}" placeholder="שם שלב חדש…">
        <button class="btn xs primary" data-wfadd="${j}">${ic('plus')} הוסף</button></div>` : ''}
      ${blocked.length ? `<div class="wf-blocked">
        <div class="wf-blocked-sep">${ic('lock')} <b>חסומים</b>
          <small>לא מוצגים בתהליך · נשארים כאן להחזרה בכל רגע</small>
          <span class="wf-bcount">${blocked.length}</span></div>
        ${blocked.map(s => `<div class="wf-stage blocked meta-${metaOf(s.key)}">
          <span class="wf-num">${ic('lock')}</span><span class="wf-st-title">${s.title}</span>
          ${wfEdit ? `<span class="wf-st-act"><button class="unbin" data-wfunbin="${j}|${s.key}" title="החזר לתהליך">${ic('check')} החזר</button></span>` : ''}
        </div>`).join('')}</div>` : ''}
    </div>
  </section>`;
}
/* ---- מצב שלבים במסלול: "כבוי כברירת מחדל" (עין) ו-"חסום" (פח) — הגדרת מנהל, נשמר לכל המערכת ---- */
let WF_STAGE_STATE = (function () { try { return JSON.parse(localStorage.getItem('cb_wfStageState')) || {}; } catch (e) { return {}; } })();
function wfStageSave() { try { localStorage.setItem('cb_wfStageState', JSON.stringify(WF_STAGE_STATE)); } catch (e) {} }
function wfStageKey(j, key) { return j + '|' + key; }
function stageIsOffByDefault(j, key) { return (WF_STAGE_STATE[wfStageKey(j, key)] || {}).off === true; }
function stageIsBlocked(j, key) { return (WF_STAGE_STATE[wfStageKey(j, key)] || {}).blocked === true; }
function wfStageSet(j, key, patch) { const k = wfStageKey(j, key); WF_STAGE_STATE[k] = Object.assign({}, WF_STAGE_STATE[k], patch); wfStageSave(); }
function renderDynamicView() {
  const journeys = Object.keys(WORKFLOWS);
  $('#viewHost').innerHTML = `
    <div class="view-head">
      <div class="vh-title"><span class="num">2</span> מנוע Workflow דינמי · <span class="muted">שלבים מוגדרים בקונפיג, לא בקוד</span></div>
      <div class="vh-actions">
        <div class="seg">
          <button class="seg-btn ${wfViewMode === 'meta' ? 'on' : ''}" data-wfmode="meta">תהליך-על</button>
          <button class="seg-btn ${wfViewMode === 'all' ? 'on' : ''}" data-wfmode="all">כל המסלולים</button>
        </div>
        ${wfViewMode === 'all' ? `<button class="btn sm ${wfEdit ? 'primary' : ''}" data-wfedit>${ic('settings')} ${wfEdit ? 'סיום עריכה' : 'עריכת מסלולים'}</button>` : ''}
      </div>
    </div>
    ${wfViewMode === 'meta' ? metaFlowHTML() : `
    ${wfEdit ? `<div class="wf-editnote">${ic('alert')} עריכה גורפת — הוספה/סידור/הסרה של מסלולים ושלבים חלים על <b>כל המערכת</b> (כל הלידים והמסכים).</div>` : ''}
    <div class="wf-grid">
      ${journeys.map(j => wfCardHTML(j)).join('')}
      ${wfEdit ? `<section class="card wf-card wf-add-route">
        <div class="wf-addroute-inner">${ic('plus')}<b>מסלול חדש</b>
          <input data-wfnewroute placeholder="שם המסלול (למשל: השבה)…">
          <button class="btn sm primary" data-wfaddroute>${ic('check')} צור מסלול</button></div>
      </section>` : ''}
    </div>
    ${wfEdit ? '' : metaMapHTML()}
    ${wfEdit ? '' : `<p class="hint" style="max-width:640px">${ic('alert')} הוספת מסלול חדש = הוספת רשומה ל-WORKFLOWS, ללא שינוי בקוד ה-UI. לחץ "עריכת מסלולים" לניהול גורף.</p>`}`}`;
  $$('[data-wfmode]').forEach(b => b.addEventListener('click', () => { wfViewMode = b.dataset.wfmode; wfMetaSel = null; renderDynamicView(); }));
  bindWfEdit();
  bindMetaKanban();
}
/* עריכה גורפת של מסלולים ושלבים — מעדכן ישירות את WORKFLOWS ו-JOURNEY_TYPES */
function bindWfEdit() {
  const et = $('[data-wfedit]'); if (et) et.addEventListener('click', () => { wfEdit = !wfEdit; renderDynamicView(); });
  const pair = v => { const [j, i] = v.split('|'); return [j, +i]; };
  /* הזזה מדלגת על שלבים חסומים — אחרת הלחיצה "לא עושה כלום" מבחינת המשתמש */
  const wfMove = (j, i, dir) => {
    const a = WORKFLOWS[j];
    let t = i + dir;
    while (a[t] && stageIsBlocked(j, a[t].key)) t += dir;
    if (!a[t]) return;
    [a[t], a[i]] = [a[i], a[t]];
    renderDynamicView();
  };
  $$('[data-wfup]').forEach(b => b.addEventListener('click', () => { const [j, i] = pair(b.dataset.wfup); wfMove(j, i, -1); }));
  $$('[data-wfdn]').forEach(b => b.addEventListener('click', () => { const [j, i] = pair(b.dataset.wfdn); wfMove(j, i, 1); }));
  // שלב אינו נמחק לעולם — עין = כבוי כברירת מחדל (יופעל פרטנית בכל ליד) · X = חסום ויורד לתחתית
  $$('[data-wfeye]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.wfeye.split('|'), off = !stageIsOffByDefault(p[0], p[1]);
    wfStageSet(p[0], p[1], { off }); renderDynamicView();
    toast(off ? 'השלב כבוי כברירת מחדל — יופעל פרטנית בכל ליד' : 'השלב פעיל כברירת מחדל');
  }));
  $$('[data-wfbin]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.wfbin.split('|');
    wfStageSet(p[0], p[1], { blocked: true }); renderDynamicView();
    toast('השלב נחסם וירד לתחתית — אפשר להחזיר אותו בכל רגע');
  }));
  $$('[data-wfunbin]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.wfunbin.split('|');
    wfStageSet(p[0], p[1], { blocked: false }); renderDynamicView(); toast('החסימה הוסרה — השלב חזר לתהליך');
  }));
  $$('[data-wfadd]').forEach(b => b.addEventListener('click', () => { const j = b.dataset.wfadd, inp = $(`[data-wfaddinp="${j}"]`), t = (inp && inp.value || '').trim(); if (!t) { toast('הזן שם שלב'); return; } WORKFLOWS[j].push({ key: 'st' + (wfKeySeq++), title: t }); renderDynamicView(); toast('שלב נוסף'); }));
  $$('[data-wfrename]').forEach(inp => inp.addEventListener('change', () => { const j = inp.dataset.wfrename; if (JOURNEY_TYPES[j]) JOURNEY_TYPES[j].label = inp.value.trim() || JOURNEY_TYPES[j].label; }));
  $$('[data-wfrmroute]').forEach(b => b.addEventListener('click', () => { const j = b.dataset.wfrmroute; if (Object.keys(WORKFLOWS).length <= 1) { toast('חייב להישאר מסלול אחד'); return; } delete WORKFLOWS[j]; renderDynamicView(); toast('המסלול הוסר מכל המערכת'); }));
  const ar = $('[data-wfaddroute]'); if (ar) ar.addEventListener('click', () => {
    const inp = $('[data-wfnewroute]'), t = (inp && inp.value || '').trim(); if (!t) { toast('הזן שם מסלול'); return; }
    const key = 'route' + (wfKeySeq++);
    WORKFLOWS[key] = [{ key: 'st' + (wfKeySeq++), title: 'קליטת פנייה' }, { key: 'st' + (wfKeySeq++), title: 'יצירת קשר' }, { key: 'close', title: 'סגירה' }];
    JOURNEY_TYPES[key] = { label: t, color: 'blue' };
    renderDynamicView(); toast(`מסלול "${t}" נוצר`);
  });
}

/* ---- קנבן תהליך-על: גרירה בין טורים = מעבר שלב ---- */
let kbDragging = false;
function bindMetaKanban() {
  $$('.kb-card').forEach(c => {
    c.addEventListener('dragstart', e => {
      kbDragging = true;
      e.dataTransfer.setData('text/plain', c.dataset.kbrec);
      e.dataTransfer.effectAllowed = 'move';
      c.classList.add('dragging');
    });
    c.addEventListener('dragend', () => { c.classList.remove('dragging'); setTimeout(() => kbDragging = false, 50); });
    c.addEventListener('click', () => { if (kbDragging) return; const r = RECORDS.find(x => x.id === +c.dataset.kbrec); if (r) openDrawer(r); });
  });
  $$('.kb-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('over'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('over');
      const id = +e.dataTransfer.getData('text/plain');
      moveRecordToMeta(id, col.dataset.kbcol);
    });
  });
}
function moveRecordToMeta(id, metaKey) {
  const r = RECORDS.find(x => x.id === id); if (!r) return;
  const metaTitle = META_STAGES.find(m => m.key === metaKey).title;
  if ((r.done ? 'close' : metaOf(r.stageKey)) === metaKey) return;   // אותו טור
  const flow = workflowFor(r.journey);
  const target = flow.find(s => metaOf(s.key) === metaKey);
  if (!target) { toast(`למסלול "${JOURNEY_TYPES[r.journey].label}" אין שלב מסוג "${metaTitle}"`); return; }
  r.stageKey = target.key;
  r.objective = target.objective || r.objective;
  if (metaKey === 'close') { r.done = true; r.overdue = false; r.status = { label: 'נסגרה', color: 'green' }; r.next = { type: 'none', at: '—' }; }
  else { r.done = false; if (r.status.label === 'נסגרה') r.status = { label: 'בטיפול', color: 'blue' }; }
  renderDynamicView();
  toast(`${r.name} הועבר ל"${metaTitle}" (${target.title}) ✓`);
}
