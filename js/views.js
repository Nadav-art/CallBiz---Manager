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

function workHoursCard() {
  return `
    <section class="card set-card wide wh-card">
      <div class="card-head"><div class="title">${ic('clock')} שעות פעילות</div>
        <button class="btn sm" id="whAddDay">${ic('plus')} הוסף יום</button></div>
      <div class="set-body wh-body">
        ${workSchedule.length ? workSchedule.map((d, i) => whDayRow(d, i)).join('')
          : '<div class="muted" style="padding:8px">לא הוגדרו ימי עבודה. לחץ "הוסף יום".</div>'}
      </div>
    </section>`;
}
function whDayRow(d, i) {
  let shiftNo = 0;
  const segHTML = d.segments.map((s, si) => {
    const last = si === d.segments.length - 1;
    const isBreak = s.type === 'break';
    let label;
    if (isBreak) label = 'הפסקה';
    else { shiftNo++; label = shiftNo === 1 ? 'שעות עבודה' : 'משמרת'; }
    const startLocked = si > 0;   // התחלה = סוף הקודם (אוטומטי)
    return `
      <div class="seg ${s.type}">
        <span class="seg-lbl">${label}</span>
        <span class="seg-times">
          <input type="time" value="${s.start}" ${startLocked ? 'readonly' : ''} data-seg="${i}:${si}:start" title="${startLocked ? 'מתעדכן אוטומטית מסוף המקטע הקודם' : 'שעת התחלה'}">
          <span class="wh-sep">–</span>
          <input type="time" value="${s.end}" data-seg="${i}:${si}:end">
        </span>
        <span class="seg-actions">
          ${last ? `<button class="wh-add ${isBreak ? 'shift' : 'brk'}" data-seg-add="${i}">${ic('plus')} ${isBreak ? 'הוסף משמרת' : 'הפסקה'}</button>` : ''}
          ${si > 0 ? `<button class="wh-x" data-seg-del="${i}:${si}" title="הסר ${isBreak ? 'הפסקה' : 'משמרת'}">${ic('close')}</button>` : ''}
        </span>
      </div>`;
  }).join('');
  return `
    <div class="wh-day ${d.on ? '' : 'off'}">
      <div class="wh-day-head">
        <span class="toggle ${d.on ? 'on' : ''}" data-wh-toggle="${i}"></span>
        <b class="wh-name">${d.day}</b>
        <button class="wh-del" data-wh-delday="${i}" title="הסר יום">${ic('close')}</button>
      </div>
      <div class="wh-segs">${segHTML}</div>
    </div>`;
}
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
  $$('[data-wh-toggle]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.whToggle; workSchedule[i].on = !workSchedule[i].on; renderSettingsView(); }));
  $$('[data-wh-delday]').forEach(b => b.addEventListener('click', () => { workSchedule.splice(+b.dataset.whDelday, 1); renderSettingsView(); }));

  // הוספת מקטע – משמרת אם האחרון הפסקה, אחרת הפסקה. התחלה = סוף המקטע האחרון
  $$('[data-seg-add]').forEach(b => b.addEventListener('click', () => {
    const d = workSchedule[+b.dataset.segAdd];
    const last = d.segments[d.segments.length - 1];
    if (last.type === 'break') d.segments.push({ type: 'shift', start: last.end, end: addMin(last.end, 120) });
    else d.segments.push({ type: 'break', start: last.end, end: addMin(last.end, 30) });
    renderSettingsView();
  }));
  // הסרת מקטע (רק לא-ראשון) + קישור מחדש
  $$('[data-seg-del]').forEach(b => b.addEventListener('click', () => {
    const [i, si] = b.dataset.segDel.split(':').map(Number);
    workSchedule[i].segments.splice(si, 1); relinkDay(workSchedule[i]); renderSettingsView();
  }));
  // עריכת זמן – סיום מקטע מקשר להתחלת הבא; רינדור מחדש כדי לשקף
  $$('[data-seg]').forEach(inp => inp.addEventListener('change', () => {
    const [i, si, field] = inp.dataset.seg.split(':');
    const d = workSchedule[+i], seg = d.segments[+si];
    seg[field] = inp.value;
    if (field === 'end') relinkDay(d);
    else if (+si === 0) relinkDay(d);
    renderSettingsView();
  }));

  const add = $('#whAddDay'); if (add) add.addEventListener('click', () => showDayPicker(add));
  $$('[data-dur]').forEach(inp => inp.addEventListener('change', () => { const [i, key] = inp.dataset.dur.split(':'); DURATIONS[+i][key] = inp.value; }));
}
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
    closeDayPicker(); renderSettingsView();
    toast(`נוסף יום ${b.dataset.addday}`);
  }));
  setTimeout(() => document.addEventListener('click', dayPickerOutside), 0);
}
function dayPickerOutside(e) { if (!e.target.closest('#dayPop') && !e.target.closest('#whAddDay')) closeDayPicker(); }
function closeDayPicker() { const p = $('#dayPop'); if (p) p.remove(); document.removeEventListener('click', dayPickerOutside); }

let mgrMode = false;
function settingsHeader() {
  const groups = DEPARTMENTS.map(dp => {
    const opts = STAFF.filter(s => s.dept === dp).map(s => `<option value="${s.id}" ${s.id === settingsEmp ? 'selected' : ''}>${s.name} · ${s.role}</option>`).join('');
    return opts ? `<optgroup label="${dp}">${opts}</optgroup>` : '';
  }).join('');
  return `
    <div class="view-head">
      <div class="vh-title"><span class="num">6</span> הגדרות יומן ותזמון · <span class="muted">${mgrMode ? 'תצוגת מנהל כללי' : 'רמת עובד'}</span></div>
      <div class="emp-bar">
        ${mgrMode ? '' : `<div class="emp-select"><span>עובד:</span><select id="empSelect">${groups}</select></div>`}
        <button class="btn sm" id="addEmp">${ic('plus')} הוסף עובד</button>
        <button class="btn sm ${mgrMode ? 'primary' : ''}" id="mgrToggle">${ic('clients')} ${mgrMode ? 'חזרה לעובד' : 'תצוגת מנהל כללי'}</button>
      </div>
    </div>`;
}
function bindSettingsHeader() {
  const sel = $('#empSelect'); if (sel) sel.addEventListener('change', () => { settingsEmp = sel.value; renderSettingsView(); });
  $('#addEmp').addEventListener('click', openAddEmployee);
  $('#mgrToggle').addEventListener('click', () => { mgrMode = !mgrMode; renderSettingsView(); });
}

function renderSettingsView() {
  if (mgrMode) return renderStaffManagerView();
  const emp = STAFF.find(s => s.id === settingsEmp) || STAFF[0];
  settingsEmp = emp.id;
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    ${empProfileCard(emp)}

    <!-- שעות פעילות – רוחב מלא (הכרטיס המרכזי) -->
    ${workHoursCard()}

    <div class="settings-grid">
      <!-- קיבולת -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('layers')} קיבולת</div></div>
        <div class="set-body">
          ${CAPACITY.map(c => `<div class="set-row"><span>${c.label}</span>
            <input class="num-in" value="${c.value}"></div>`).join('')}
        </div>
      </section>

      <!-- משכי תיאום (עריכה) -->
      ${durationsCard()}

      <!-- מדיניות אישור -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('check')} מדיניות אישור</div></div>
        <div class="set-body">
          ${APPROVAL_POLICIES.map(p => `<div class="set-row"><span>${p.label}</span>${toggle(p.on)}</div>`).join('')}
        </div>
      </section>

      <!-- חלונות פולו-אפ (13) -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('phone')} חלונות פולו-אפ</div></div>
        <div class="set-body">
          ${FOLLOWUP_WINDOWS.map(w => `<div class="set-row"><span>${w.range}</span>
            <span class="chip ${w.booked>=w.capacity?'red':'green'}">${w.booked}/${w.capacity}</span></div>`).join('')}
          <p class="hint" style="margin-top:6px">${ic('alert')} פיזור אוטומטי לפי עומס · פולו-אפ מחוץ לשעות → חלון הבא.</p>
        </div>
      </section>

      <!-- תבנית אישור הגעה (וואטסאפ) -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('whatsapp')} תבנית אישור הגעה · וואטסאפ</div></div>
        <div class="set-body">
          <div class="field"><textarea id="waTplArrival" rows="3">${WA_TEMPLATES.arrival}</textarea></div>
          <p class="hint" style="margin:0 0 8px">${ic('alert')} משתנים: {שם} · {נושא} · {מועד} — מוחלפים אוטומטית בפרטי הלקוח.</p>
          <button class="btn sm primary" data-tpl-save>${ic('check')} שמור תבנית</button>
        </div>
      </section>

      <!-- דיוק תזמון ביומן -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('clock')} דיוק תזמון ביומן</div></div>
        <div class="set-body">
          <div class="seg" style="width:100%">
            ${CAL_STEP_OPTIONS.map(m => `<button class="seg-btn ${CAL_STEP.minutes === m ? 'on' : ''}" data-calstep="${m}" style="flex:1">${m === 60 ? 'שעה' : m + ' דק\''}</button>`).join('')}
          </div>
          <p class="hint" style="margin-top:10px">${ic('alert')} הקפיצות בקביעת זמן הן לפי הדיוק הנבחר, אבל התצוגה ביומן נשארת בטווחי שעה — לחיצה על שעה פותחת בחירת דקות.</p>
        </div>
      </section>

      <!-- זמן פולו-אפ / מועד חזרה -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('clock')} זמן פולו-אפ · מועד חזרה</div></div>
        <div class="set-body">
          ${FU_POLICY_OPTIONS.map(o => `<label class="na-radio"><input type="radio" name="fupol" value="${o.key}" ${FOLLOWUP_POLICY.mode === o.key ? 'checked' : ''}> ${o.label}</label>`).join('')}
          <p class="hint" style="margin-top:6px">${ic('alert')} ההמלצה הראשונית ב"מועד חזרה" נקבעת לפי בחירה זו, ותמיד מסתנכרנת עם חלון פנוי. ניתן גם לפתוח יומן ולבחור ידנית.</p>
        </div>
      </section>

      <!-- חריגים -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('flag')} חריגים</div>
          <button class="btn sm">${ic('plus')} הוסף</button></div>
        <div class="set-body">
          ${EXCEPTIONS.map(x => `<div class="set-row"><span><b>${x.date}</b> · ${x.label}</span>
            <span class="badge amber">${x.type}</span></div>`).join('')}
        </div>
      </section>

      <!-- סנכרון -->
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('sync')} סנכרון יומנים</div></div>
        <div class="set-body">
          ${SYNC_CALENDARS.map(s => `<div class="set-row"><span><b>${s.name}</b><br><small class="muted">${s.mode}</small></span>${toggle(s.on)}</div>`).join('')}
        </div>
      </section>

      <!-- ניתוב ועדיפות (25) -->
      <section class="card set-card wide">
        <div class="card-head"><div class="title">${ic('target')} כללי ניתוב ועדיפות</div></div>
        <div class="set-body">
          <div class="chips-title">ניתוב לפי:</div>
          <div class="chips-wrap">${ROUTING_RULES.map(r => `<span class="pill">${r}</span>`).join('')}</div>
          <div class="chips-title" style="margin-top:12px">ניקוד עדיפות לפי:</div>
          <div class="chips-wrap">${PRIORITY_RULES.map(r => `<span class="pill">${r}</span>`).join('')}</div>
        </div>
      </section>

    </div>

    <!-- הרשאות + רשימת המתנה – רוחב מלא (נושאי גישה) -->
    <div class="settings-full">
      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('user')} הרשאות לפי תפקיד</div>
          <span class="muted" style="font-size:12px">עמודת ההרשאה של ${emp.name}: <b>${emp.perm}</b></span></div>
        <div class="set-body">
          <div class="table-wrap"><table class="mini-table perm-table">
            <thead><tr><th>הרשאה</th>${ROLES.map(r => `<th class="${r === emp.perm ? 'perm-hl' : ''}">${r}</th>`).join('')}</tr></thead>
            <tbody>${PERMISSIONS.map(p => `<tr><td><b>${p.label}</b></td>
              ${p.grants.map((g, gi) => `<td class="perm-cell ${ROLES[gi] === emp.perm ? 'perm-hl' : ''}">${toggle(!!g)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table></div>
        </div>
      </section>

      <section class="card set-card">
        <div class="card-head"><div class="title">${ic('queue')} רשימת המתנה</div>
          <span class="muted" style="font-size:12px">מתפנה זמן → הצעה אוטומטית ללקוח הבא</span></div>
        <div class="set-body">
          <div class="table-wrap"><table class="mini-table">
            <thead><tr><th>#</th><th>לקוח</th><th>סוג</th><th>זמן מבוקש</th><th>ממתין מ-</th><th></th></tr></thead>
            <tbody>${WAITLIST.map(w => `<tr><td><b>${w.pos}</b></td><td>${w.name}</td>
              <td><span class="badge blue">${w.svc}</span></td><td>${w.req}</td><td class="muted">${w.since}</td>
              <td><button class="btn sm primary" data-wl="${w.name}">${ic('check')} הצע זמן</button></td></tr>`).join('')}</tbody>
          </table></div>
        </div>
      </section>
    </div>`;
  bindSettingsHeader();
  bindEmpProfile();
  $$('[data-wl]').forEach(b => b.addEventListener('click', () => toast(`הצעת זמן נשלחה ל${b.dataset.wl} ✓`)));
  $$('[data-tpl-save]').forEach(b => b.addEventListener('click', () => {
    const v = ($('#waTplArrival').value || '').trim();
    if (!v) { toast('התבנית לא יכולה להיות ריקה'); return; }
    WA_TEMPLATES.arrival = v;
    toast('תבנית אישור ההגעה נשמרה ✓');
  }));
  $$('[data-calstep]').forEach(b => b.addEventListener('click', () => {
    CAL_STEP.minutes = +b.dataset.calstep;
    renderSettingsView();
    toast(`דיוק התזמון עודכן: ${CAL_STEP.minutes === 60 ? 'שעה' : CAL_STEP.minutes + ' דקות'}`);
  }));
  $$('input[name="fupol"]').forEach(rd => rd.addEventListener('change', () => {
    FOLLOWUP_POLICY.mode = rd.value;
    toast(`מדיניות מועד חזרה עודכנה: ${FU_POLICY_OPTIONS.find(o => o.key === rd.value).label}`);
  }));
  bindWorkHours();
  bindToggles($('#viewHost'));
}

/* --- כרטיס פרופיל עובד (מגדיר בעצמו: עיסוק, אחריות, זמינות) --- */
function empProfileCard(emp) {
  const av = AVAIL_STATES[emp.avail];
  const chips = (list, sel, kind) => list.map(x =>
    `<button class="tag-chip ${sel.includes(x) ? 'on' : ''}" data-${kind}="${x}">${x}</button>`).join('');
  return `
    <section class="card emp-profile">
      <div class="emp-profile-head">
        <span class="emp-av-lg">${emp.name[0]}<span class="emp-av-dot" style="background:${av.color}"></span></span>
        <div class="emp-meta">
          <b>${emp.name}</b>
          <small>${emp.dept} · ${emp.role}</small>
        </div>
        <span class="perm-badge">${ic('user')} הרשאת ${emp.perm}</span>
        <select class="avail-sel" id="empAvail">
          ${Object.entries(AVAIL_STATES).map(([k, v]) => `<option value="${k}" ${emp.avail === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="emp-profile-body">
        <div class="tag-group"><span class="tag-lbl">תחומי עיסוק</span><div class="tag-wrap">${chips(OCCUPATIONS, emp.occ, 'occ')}</div></div>
        <div class="tag-group"><span class="tag-lbl">תחומי אחריות</span><div class="tag-wrap">${chips(RESPONSIBILITIES, emp.resp, 'resp')}</div></div>
      </div>
      <div class="emp-profile-note">${ic('alert')} כל עובד מגדיר בעצמו את הזמינות, הנגישות ותחומי העיסוק שלו. המנהל הכללי רואה את הכל דרך "תצוגת מנהל כללי".</div>
    </section>`;
}
function bindEmpProfile() {
  const emp = STAFF.find(s => s.id === settingsEmp); if (!emp) return;
  const av = $('#empAvail'); if (av) av.addEventListener('change', () => { emp.avail = av.value; renderSettingsView(); });
  const toggleIn = (arr, val) => { const i = arr.indexOf(val); i >= 0 ? arr.splice(i, 1) : arr.push(val); };
  $$('[data-occ]').forEach(b => b.addEventListener('click', () => { toggleIn(emp.occ, b.dataset.occ); renderSettingsView(); }));
  $$('[data-resp]').forEach(b => b.addEventListener('click', () => { toggleIn(emp.resp, b.dataset.resp); renderSettingsView(); }));
}

/* --- תצוגת מנהל כללי: כל העובדים --- */
function renderStaffManagerView() {
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    <section class="card">
      <div class="card-head"><div class="title">${ic('clients')} כל העובדים · ${STAFF.length}</div>
        <span class="muted" style="font-size:12px">מחלקה · תפקיד · עיסוק · אחריות · הרשאה · זמינות</span></div>
      <div class="table-wrap">
        <table class="list staff-table">
          <thead><tr><th>עובד</th><th>מחלקה</th><th>תפקיד</th><th>תחומי עיסוק</th><th>תחומי אחריות</th><th>הרשאה</th><th>זמינות</th></tr></thead>
          <tbody>${STAFF.map(s => {
            const av = AVAIL_STATES[s.avail];
            return `<tr data-staff="${s.id}">
              <td><div class="client-cell"><span class="emp-av-sm">${s.name[0]}</span><div class="meta"><b>${s.name}</b></div></div></td>
              <td><span class="badge blue">${s.dept}</span></td>
              <td>${s.role}</td>
              <td class="cell-tags">${s.occ.map(o => `<span class="mini-tag">${o}</span>`).join('') || '—'}</td>
              <td class="cell-tags">${s.resp.map(o => `<span class="mini-tag">${o}</span>`).join('') || '—'}</td>
              <td><span class="chip gray">${s.perm}</span></td>
              <td><span class="avail-pill"><i style="background:${av.color}"></i>${av.label}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </section>`;
  bindSettingsHeader();
  $$('#viewHost [data-staff]').forEach(tr => tr.addEventListener('click', () => { settingsEmp = tr.dataset.staff; mgrMode = false; renderSettingsView(); }));
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
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">8</span> אוטומציות והוראות</div></div>
    <div class="auto-grid">
      <section class="card">
        <div class="card-head"><div class="title">${ic('bolt')} חוקי אוטומציה</div>
          <button class="btn sm primary">${ic('plus')} אוטומציה חדשה</button></div>
        <div class="auto-list">
          ${AUTOMATIONS.map(a => `<div class="auto-item">
            ${toggle(a.on)}
            <div class="auto-body">
              <div class="auto-top"><span class="badge blue">${a.trigger}</span><b>${a.title}</b></div>
              <div class="auto-desc">${a.desc}</div>
            </div>
            <button class="icon-btn">${ic('settings')}</button>
          </div>`).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div class="title"><span class="num">9</span> פולו-אפ אוטומטי לליד חדש</div></div>
        <div class="flow-wrap">
          ${LEAD_FLOW.map((n, i) => `
            <div class="flow-node ${n.c}">
              <div class="fn-dot"></div>
              <div class="fn-body"><b>${n.t}</b><small>${n.s}</small></div>
            </div>
            ${i < LEAD_FLOW.length - 1 ? `<div class="flow-arrow">${ic('chevron')}</div>` : ''}
          `).join('')}
          <p class="hint">${ic('alert')} ליד שנכנס ב-21:15 (מחוץ לשעות 08:00–18:00) יתוזמן אוטומטית ל-08:00 למחרת (סעיף 14.3).</p>
        </div>
      </section>
    </div>`;
  bindToggles($('#viewHost'));
}

/* ============================================================
   יומן מלא רב-עובדים (9 / מסך 4) – יום/שבוע/חודש + ניווט + בחירת זמן
   ============================================================ */
const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HEB_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const HEB_DAYS_S = ['א','ב','ג','ד','ה','ו','ש'];
const DEMO_DAY   = '2024-05-22';           // היום עם אירועי הדמו
/* צפיפות אירועים לחודש (למראה חי) */
const MONTH_DENSITY = { '2024-05-20': 3, '2024-05-21': 2, '2024-05-22': 11, '2024-05-23': 4, '2024-05-27': 2, '2024-05-28': 5, '2024-05-30': 3 };

let calMode = 'day';
let calDate = new Date(2024, 4, 22);       // 22 במאי 2024
let calSelSlot = null;

function fmtH(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; }
function dkey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; } // ראשון
function calLabel() {
  if (calMode === 'day')   return `יום ${HEB_DAYS[calDate.getDay()]}, ${calDate.getDate()} ${HEB_MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
  if (calMode === 'week')  { const s = startOfWeek(calDate), e = addDays(s, 6);
    return `${s.getDate()} – ${e.getDate()} ${HEB_MONTHS[e.getMonth()]} ${e.getFullYear()}`; }
  return `${HEB_MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
}
function calShift(dir) {
  if (calMode === 'day')   calDate = addDays(calDate, dir);
  else if (calMode === 'week') calDate = addDays(calDate, dir * 7);
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
    <div class="spacer"></div>
    <button class="btn sm">${ic('sync')} Google</button>
  </div>`;
}
function calContentHTML() {
  return `<section class="card">${calMode === 'day' ? calDayHTML() : calMode === 'week' ? calWeekHTML() : calMonthHTML()}</section>`;
}
function bindCalFull(scope, rerender) {
  $$('[data-mode]', scope).forEach(b => b.addEventListener('click', () => { calMode = b.dataset.mode; calSelSlot = null; rerender(); }));
  $$('[data-nav]', scope).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'today') calDate = new Date(2024, 4, 22); else calShift(+b.dataset.nav);
    rerender();
  }));
  $$('.mcal-ev', scope).forEach(e => e.addEventListener('click', ev => {
    ev.stopPropagation();
    if (e.dataset.rec) { closeModal(); openDrawer(RECORDS.find(x => x.id === +e.dataset.rec)); }
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
        if (evs.length) return `<div class="mcal-cell filled">${evs.map(ev => calEvHTML(ev)).join('')}</div>`;
        if (isDemo && (h + 1) * 60 <= nowHM()) return `<div class="mcal-cell past" title="השעה עברה — אין קביעה בהיסטוריה"></div>`;
        return `<div class="mcal-cell slot-free" data-o="${o}" data-h="${h}" data-d="${dkey(calDate)}"></div>`;
      }).join('')}
    `).join('')}
  </div>`;
}

/* ---- תצוגת שבוע: 7 ימים × שעות ---- */
function calWeekHTML() {
  const hours = []; for (let h = 8; h <= 18; h++) hours.push(h);
  const s = startOfWeek(calDate);
  const days = Array.from({length: 7}, (_, i) => addDays(s, i));
  return `<div class="mcal" style="grid-template-columns:56px repeat(7, 1fr)">
    <div class="mcal-corner"></div>
    ${days.map(d => `<div class="mcal-owner ${dkey(d)===DEMO_DAY?'is-today':''}">${HEB_DAYS_S[d.getDay()]}<small>${d.getDate()}/${d.getMonth()+1}</small></div>`).join('')}
    ${hours.map(h => `
      <div class="mcal-hour">${String(h).padStart(2,'0')}:00</div>
      ${days.map(d => {
        const evs = dkey(d) === DEMO_DAY ? (CAL_EVENTS['יואב כהן'] || []).filter(e => Math.floor(e.h) === h) : [];
        if (evs.length) return `<div class="mcal-cell filled">${evs.map(ev => calEvHTML(ev, true)).join('')}</div>`;
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

/* אירוע יומן – שם ליד לחיץ + חפיפה (רוחב מצומצם, שורה אחת) */
function calEvHTML(ev, weekMode) {
  const time = weekMode ? fmtH(ev.h) : `${fmtH(ev.h)}–${fmtH(ev.h + ev.dur)}`;
  return `<div class="mcal-ev ${ev.c} ${ev.recId ? 'link' : ''}" data-t="${ev.t}" ${ev.recId ? `data-rec="${ev.recId}" title="פתח ליד: ${ev.t}"` : ''} style="min-height:${ev.dur * 40}px">
    <span class="ev-t">${ev.t}</span><small>${time}</small></div>`;
}
/* בחירת זמן בתא שעה — לפי דיוק התזמון מההגדרות (התצוגה נשארת שעתית) */
function pickCalSlot(cell) {
  const step = CAL_STEP.minutes;
  if (step >= 60) return selectCalTime(cell, `${String(cell.dataset.h).padStart(2, '0')}:00`);
  showMinutePicker(cell, step);
}
function selectCalTime(cell, time) {
  closeMinutePicker();
  $$('.slot-free.sel').forEach(x => { x.classList.remove('sel'); x.innerHTML = ''; });
  cell.classList.add('sel');
  calSelSlot = { o: cell.dataset.o, h: cell.dataset.h, d: cell.dataset.d, time };
  const [y, m, dd] = cell.dataset.d.split('-');
  cell.innerHTML = `<div class="slot-pick">${ic('plus')} ${time}</div>`;
  toast(`נבחר זמן: ${dd}/${m} · ${time} · ${cell.dataset.o} (דיוק ${CAL_STEP.minutes} דק')`);
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
                <div class="kb-card ${r.overdue ? 'over-due' : ''}" draggable="true" data-kbrec="${r.id}">
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

function renderDynamicView() {
  const journeys = Object.keys(WORKFLOWS);
  $('#viewHost').innerHTML = `
    <div class="view-head">
      <div class="vh-title"><span class="num">2</span> מנוע Workflow דינמי · <span class="muted">שלבים מוגדרים בקונפיג, לא בקוד</span></div>
      <div class="seg">
        <button class="seg-btn ${wfViewMode === 'meta' ? 'on' : ''}" data-wfmode="meta">תהליך-על</button>
        <button class="seg-btn ${wfViewMode === 'all' ? 'on' : ''}" data-wfmode="all">כל המסלולים</button>
      </div>
    </div>
    ${wfViewMode === 'meta' ? metaFlowHTML() : `
    <div class="wf-grid">
      ${journeys.map(j => `
        <section class="card wf-card">
          <div class="card-head"><div class="title"><span class="badge ${JOURNEY_TYPES[j]?.color||'gray'}">${JOURNEY_TYPES[j]?.label||j}</span></div>
            <span class="muted" style="font-size:11px">${WORKFLOWS[j].length} שלבים</span></div>
          <div class="wf-stages">
            ${WORKFLOWS[j].map((s, i) => `<div class="wf-stage ${'meta-' + metaOf(s.key)}"><span class="wf-num">${i+1}</span>${s.title}<small class="wf-meta">${META_STAGES.find(m => m.key === metaOf(s.key)).title}</small></div>`).join('')}
          </div>
        </section>`).join('')}
    </div>
    ${metaMapHTML()}
    <p class="hint" style="max-width:640px">${ic('alert')} הוספת מסלול חדש = הוספת רשומה ל-WORKFLOWS ב-data.js, ללא שינוי בקוד ה-UI (הנחיה 20).</p>`}`;
  $$('[data-wfmode]').forEach(b => b.addEventListener('click', () => { wfViewMode = b.dataset.wfmode; wfMetaSel = null; renderDynamicView(); }));
  bindMetaKanban();
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
