/* ============================================================
   CallBiz Manager – שכבת תהליכים (Flows)
   אשף תיאום · עורך פעולה הבאה · hover card · סיום AI · WhatsApp · הערות · תזכורת
   נטען אחרי app.js ודורס פונקציות תהליך במקום הצורך.
   ============================================================ */

/* נתוני עזר לתהליכים */
/* אשף התיאום — נגזר מ-STAFF (אותם אנשים כמו בכל המערכת) */
const EMPLOYEES = STAFF.map(s => ({ id: s.id, name: s.name, role: s.role, avail: s.on }));
const APPT_KINDS = [
  { key: 'followup', icon: 'phone',    title: 'שיחת פולו-אפ', sub: 'שיחת חזרה קצרה' },
  { key: 'meeting',  icon: 'calendar', title: 'פגישה',        sub: 'פגישת מכירה / ייעוץ' },
  { key: 'service',  icon: 'tasks',    title: 'תור שירות',    sub: 'טיפול / התקנה / הדרכה' },
  { key: 'manager',  icon: 'user',     title: 'שיחה עם מנהל', sub: 'הסלמה / אישור' },
];
const AI_OUTCOMES = {
  'מעוניין':      ['שלח הצעת מחיר', 'צור פולו-אפ בעוד יומיים', 'הוסף משימת הכנה'],
  'צריך לחשוב':   ['צור פולו-אפ בעוד 3 ימים', 'שלח חומר שיווקי', 'עדכן סטטוס ל"בשלה"'],
  'נסגר':         ['פתח תהליך התקנה', 'שלח הודעת תודה', 'צור משימת גבייה'],
  'לא הגיע':      ['קבע שיחת חזרה', 'שלח הודעת WhatsApp', 'קבע מועד חדש'],
  'לא רלוונטי':   ['סמן כהפסד', 'תעד סיבה', 'סגור ליד'],
};

/* ============================================================
   אשף תיאום מלא (דורס את openScheduleModal מ-app.js)
   ============================================================ */
let wiz = null;
function openScheduleModal(r) {
  wiz = { r, step: 0, kind: 'meeting', owner: 'yk', method: 'auto', slot: null };
  $('#modal').style.maxWidth = '720px';
  renderWizard();
  $('#modalWrap').classList.add('open');
}
const WIZ_STEPS = ['סוג תיאום', 'גורם מטפל', 'שיטת תיאום', 'בחירת זמן', 'פרטים', 'סיכום'];
/* מיפוי סוג פגישה → סוג טיפול, לצורך שליפת התורים הרלוונטיים באמת */
const WIZ_KIND_TREAT = { followup: 'followup', meeting: 'consult', service: 'facial', manager: 'consult' };
/* הזמנים הפנויים והרלוונטיים ביותר — מנוע הזמינות של לוח התיאום (רק פנוי, לא שעבר, לפי מטפל וסוג) */
function wizSlots() {
  if (typeof coordPool !== 'function') return [];
  const treat = WIZ_KIND_TREAT[wiz.kind] || 'consult';
  return coordPool().filter(s => !s.booked && !coordIsPast(s)
    && (wiz.owner === 'team' ? true : s.doc === wiz.owner)
    && (cDoc(s.doc) ? cDoc(s.doc).skills.includes(treat) : false))
    .sort((a, b) => a.date === b.date ? a.h - b.h : a.date.localeCompare(b.date))
    .slice(0, 8)
    .map(s => ({ ...s, treat }));
}

function renderWizard() {
  const s = wiz.step;
  $('#modal').innerHTML = `
    <div class="modal-head">
      <div class="title"><span class="num">3</span> אשף תיאום · ${wiz.r.name}</div>
      <div style="display:flex;gap:8px">
        <button class="btn sm" id="wizFullCal">${ic('calendar')} יומן מלא</button>
        <button class="close-btn" id="closeModal">${ic('close')}</button>
      </div>
    </div>
    <div class="wiz-steps">
      ${WIZ_STEPS.map((t, i) => `<div class="wiz-step ${i === s ? 'active' : ''} ${i < s ? 'done' : ''}">
        <span class="dot">${i < s ? ic('check') : i + 1}</span><span>${t}</span></div>`).join('')}
    </div>
    <div class="modal-body" id="wizBody">${wizStep(s)}</div>
    <div class="drawer-foot">
      ${s > 0 ? `<button class="btn" id="wizBack">${ic('chevronR')} חזרה</button>` : '<span></span>'}
      <div class="spacer"></div>
      ${s < WIZ_STEPS.length - 1
        ? `<button class="btn primary" id="wizNext">המשך ${ic('chevronL')}</button>`
        : `<button class="btn primary" id="wizConfirm">${ic('check')} קבע פגישה</button>`}
    </div>`;
  bindWizard();
}
function wizStep(s) {
  const r = wiz.r;
  if (s === 0) return `<p class="wiz-q">מה תרצו לתאם?</p>
    <div class="opt-grid">${APPT_KINDS.map(k => `
      <button class="opt-card ${wiz.kind === k.key ? 'sel' : ''}" data-kind="${k.key}">
        <span class="opt-ic">${ic(k.icon)}</span>
        <b>${k.title}</b><small>${k.sub}</small></button>`).join('')}</div>`;
  if (s === 1) return `<p class="wiz-q">מי יתאם את הפגישה?</p>
    <div class="emp-list">${EMPLOYEES.map(e => `
      <button class="emp-row ${wiz.owner === e.id ? 'sel' : ''} ${!e.avail ? 'busy' : ''}" data-emp="${e.id}">
        <span class="emp-av">${e.name[0]}</span>
        <span class="emp-info"><b>${e.name}</b><small>${e.role}</small></span>
        <span class="chip ${e.avail ? 'green' : 'gray'}">${e.avail ? 'זמין' : 'עסוק'}</span>
      </button>`).join('')}
      <button class="emp-row ${wiz.owner === 'team' ? 'sel' : ''}" data-emp="team">
        <span class="emp-av">${ic('clients')}</span>
        <span class="emp-info"><b>צוות מכירות</b><small>שיוך אוטומטי לפנוי</small></span></button>
    </div>`;
  if (s === 2) return `<p class="wiz-q">כיצד נבחר זמנים?</p>
    <div class="method-list">
      <button class="method ${wiz.method === 'manual' ? 'sel' : ''}" data-method="manual">
        ${ic('calendar')}<div><b>בחירה ידנית מהיומן</b><small>אני אבחר זמנים באופן חופשי</small></div></button>
      <button class="method rec ${wiz.method === 'auto' ? 'sel' : ''}" data-method="auto">
        ${ic('bolt')}<div><b>המלצה אוטומטית (מומלץ)</b><small>המערכת תציע זמנים מיטביים לצמצום פערים</small></div>
        <span class="tag amber">★ AI</span></button>
      <button class="method ${wiz.method === 'full' ? 'sel' : ''}" data-method="full">
        ${ic('layers')}<div><b>הצגת יומן מלא</b><small>תצוגת כל הגורמים המטפלים</small></div></button>
    </div>`;
  if (s === 3) { const slots = wizSlots(); wiz._slots = slots;
    const tLabel = (typeof cTreat === 'function' && cTreat(WIZ_KIND_TREAT[wiz.kind] || 'consult')) ? cTreat(WIZ_KIND_TREAT[wiz.kind] || 'consult').label : '';
    return `<div class="sched-split">
      <div class="rec-list">
        <p class="wiz-q sm">${wiz.method === 'auto' ? 'התורים הזמינים ביותר' : 'זמנים פנויים'} · ${empName(wiz.owner)}${tLabel ? ' · ' + tLabel : ''}</p>
        ${slots.length ? slots.map((sl, i) => {
          const doc = cDoc(sl.doc), br = cBranch(sl.branch);
          return `
          <button class="rec-slot ${wiz.slot === i ? 'sel' : ''}" data-slot="${i}">
            <span class="rec-check">${ic('check')}</span>
            <b>${cDayLbl(sl.date)} · ${fmtH(sl.h)}–${fmtH(sl.h + sl.dur)}</b>
            <small>${doc ? doc.name : ''} · ${br ? br.short : ''} · ${Math.round(sl.dur * 60)} דק'</small>
          </button>`; }).join('')
        : `<div class="rec-empty">${ic('alert')} אין תורים פנויים תואמים ל${empName(wiz.owner)} בסוג זה — בחר מטפל אחר או סוג פגישה אחר.</div>`}
      </div>
      <div class="rec-side">
        <div class="col-title">${ic('settings')} התאמה לפי קריטריונים</div>
        <ul class="set-list">
          <li>${ic('check')} סוג טיפול: ${tLabel || '—'}</li>
          <li>${ic('check')} מטפל: ${empName(wiz.owner)}</li>
          <li>${ic('check')} רק מטפלים מוסמכים לטיפול</li>
          <li>${ic('check')} רק מועדים עתידיים (לא שעברו)</li>
          <li>${ic('check')} מדורג לפי הקרוב ביותר</li>
        </ul>
        <div class="hint-box" style="margin-top:10px">${ic('bolt')} מוצגים רק תורים אפשריים ורלוונטיים — פנויים, עתידיים, ומתאימים לקריטריוני הטיפול.</div>
      </div></div>`; }
  if (s === 4) return `<p class="wiz-q sm">השלימו את פרטי הפגישה</p>
    <div class="field-row">
      <div class="field"><label>סוג פגישה</label><select><option>${APPT_KINDS.find(k=>k.key===wiz.kind).title}</option></select></div>
      <div class="field"><label>גורם מטפל</label><input value="${empName(wiz.owner)}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>משך</label><select><option>30 דק'</option><option selected>60 דק'</option><option>90 דק'</option></select></div>
      <div class="field"><label>ערוץ</label><select><option>Google Meet</option><option>טלפון</option><option>פרונטלי</option></select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>תזכורת לעובד</label><select><option>15 דק' לפני</option><option>שעה לפני</option></select></div>
      <div class="field"><label>תזכורת ללקוח</label><select><option>שעה לפני (SMS)</option><option>יום לפני (WhatsApp)</option></select></div>
    </div>
    <div class="field"><label>הערות</label><textarea rows="2" placeholder="פרטים נוספים…">${wiz.r.subject}</textarea></div>`;
  if (s === 5) { const sl = (wiz._slots || [])[wiz.slot || 0];
    const when = sl ? `${cDayLbl(sl.date)} · ${fmtH(sl.h)}` : '—';
    const doc = sl ? cDoc(sl.doc) : null;
    return `<p class="wiz-q sm">בדקו את הסיכום ולחצו "קבע פגישה"</p>
    <div class="sum-panel">
      <div class="kv-row"><span>${ic('user')} לקוח</span><b>${wiz.r.name}</b></div>
      <div class="kv-row"><span>${ic('tasks')} סוג</span><b>${APPT_KINDS.find(k=>k.key===wiz.kind).title}</b></div>
      <div class="kv-row"><span>${ic('user')} גורם מטפל</span><b>${doc ? doc.name : empName(wiz.owner)}</b></div>
      <div class="kv-row"><span>${ic('calendar')} מועד</span><b>${when}</b></div>
      <div class="kv-row"><span>${ic('video')} ערוץ</span><b>Google Meet</b></div>
      <div class="kv-row"><span>${ic('clock')} תזכורות</span><b>עובד 15 דק' · לקוח שעה (SMS)</b></div>
      <div class="kv-row"><span>${ic('sync')} סנכרון</span><b>Google Calendar</b></div>
    </div>`;
  }
}
function empName(id) { return id === 'team' ? 'צוות מכירות' : (EMPLOYEES.find(e => e.id === id) || {}).name || ''; }
function bindWizard() {
  $('#closeModal').addEventListener('click', closeModal);
  $('#wizFullCal').addEventListener('click', openCalendarModal);
  const back = $('#wizBack'), next = $('#wizNext'), conf = $('#wizConfirm');
  if (back) back.addEventListener('click', () => { wiz.step--; renderWizard(); });
  if (next) next.addEventListener('click', () => { wiz.step++; renderWizard(); });
  if (conf) conf.addEventListener('click', wizConfirm);
  $$('[data-kind]').forEach(b => b.addEventListener('click', () => { wiz.kind = b.dataset.kind; renderWizard(); }));
  $$('[data-emp]').forEach(b => b.addEventListener('click', () => { wiz.owner = b.dataset.emp; renderWizard(); }));
  $$('[data-method]').forEach(b => b.addEventListener('click', () => { wiz.method = b.dataset.method; renderWizard(); }));
  $$('[data-slot]').forEach(b => b.addEventListener('click', () => { wiz.slot = +b.dataset.slot; renderWizard(); }));
}
function wizConfirm() {
  const sl = (wiz._slots || [])[wiz.slot || 0];
  const doc = sl ? cDoc(sl.doc) : null;
  const when = sl ? `${cDayLbl(sl.date)} · ${fmtH(sl.h)}` : '—';
  // תפיסת המשבצת ביומן ועדכון הפגישה בליד
  if (sl) {
    sl.booked = true;
    wiz.r.meeting = { date: cDayLbl(sl.date), time: fmtH(sl.h), dur: Math.round(sl.dur * 60), channel: cBranch(sl.branch).short, with: doc ? doc.name : empName(wiz.owner) };
    wiz.r.coordSlotId = sl.id;
  }
  // סיכום הצלחה (מסך 3.8)
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title">${ic('check')} התיאום נקבע</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body success">
      <div class="succ-ring">${ic('check')}</div>
      <h3>הפגישה נקבעה בהצלחה!</h3>
      <p class="muted">${wiz.r.name} · ${when}${doc ? ' · ' + doc.name : ''}</p>
      <div class="succ-cards">
        <div class="succ-card"><b>ללקוח</b><span class="ok">${ic('check')} WhatsApp נשלח</span><span class="ok">${ic('check')} SMS נשלח</span></div>
        <div class="succ-card"><b>לעובד</b><span class="ok">${ic('check')} נוסף ליומן</span><span class="ok">${ic('check')} תזכורת הופעלה</span></div>
      </div>
      <div class="succ-actions"><button class="btn primary" id="succClose">${ic('check')} סגור</button></div>
    </div>`;
  $('#closeModal').addEventListener('click', closeModal);
  $('#succClose').addEventListener('click', () => {
    closeModal();
    // עדכון "הפעולה הבאה" אוטומטית לתזכורת (מסך 2.4)
    wiz.r.status = { label: 'תזכורת לפגישה', color: 'blue' };
    wiz.r.next = { type: 'remind', at: sl ? `${cDayLbl(sl.date)} ${fmtH(sl.h)}` : 'נקבע מועד' };
    wiz.r.overdue = false;
    if (typeof renderList === 'function') renderList();
    if (selectedId === wiz.r.id) openDrawer(wiz.r);
    toast('נקבעה פגישה · העמודה עודכנה לתזכורת · אישור נשלח ✓');
  });
}

/* ============================================================
   עורך "הפעולה הבאה" inline (מסך 1)
   ============================================================ */
function toInputDate(d) { // "22/05/24" -> "2024-05-22"
  const p = (d || '').split('/'); if (p.length !== 3) return '2024-05-22';
  return `20${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}
/* לוגיקה אחידה: סוגי "הפעולה הבאה" הרלוונטיים נגזרים מהמחלקה/וורקפלואו של הליד */
const NEXT_BY_DEPT = {
  'מכירות': ['meeting', 'remind', 'followup', 'proposal', 'cust_ok', 'callback', 'none'],
  'שירות':  ['appt', 'remind', 'callback', 'followup', 'wait_doc', 'summary', 'none'],
  'גבייה':  ['billing', 'callback', 'followup', 'cust_ok', 'none'],
};
function nextTypesFor(r) {
  const dep = (typeof deptOf === 'function') ? deptOf(r.journey) : null;
  return (dep && NEXT_BY_DEPT[dep.label]) || ['meeting', 'remind', 'followup', 'callback', 'none'];
}
function openNextActionEditor(r, anchor) {
  clearTimeout(hoverTimer); hideHoverCard();   // סגור כרטיס hover כדי שלא תהיה כפילות
  closeNextActionEditor();
  const na = r.next || { type: 'followup', at: '' };
  const hasM = !!r.meeting;
  const mDate = hasM ? toInputDate(r.meeting.date) : '2024-05-22';
  const mTime = hasM ? r.meeting.time : '09:00';       // ← מועד הפגישה הקיים, לא ברירת מחדל
  const mobile = document.documentElement.classList.contains('cb-mobile');
  const types = nextTypesFor(r);
  let selType = (na.type && types.includes(na.type)) ? na.type : types[0];
  const dep = (typeof deptOf === 'function') ? deptOf(r.journey) : null;
  if (mobile) { const bd = document.createElement('div'); bd.className = 'na-backdrop'; bd.id = 'naBackdrop'; document.body.appendChild(bd); }
  const pop = document.createElement('div');
  pop.className = 'na-pop' + (mobile ? ' na-sheet' : ''); pop.id = 'naPop';
  const fuDefault = (FOLLOWUP_POLICY.modes && FOLLOWUP_POLICY.modes[0]) || FOLLOWUP_POLICY.mode || 'same_day';
  // קומפקטי: שני תפריטים נפתחים — סוג הפעולה + דחייה/מועד חזרה (ברירת מחדל מהגדרות העובד)
  pop.innerHTML = `
    ${mobile ? '<div class="na-grip"></div>' : ''}
    <div class="na-title">הפעולה הבאה${dep ? ` · <span class="na-dep">${dep.label}</span>` : ''}</div>
    <div class="na-field"><label>סוג הפעולה <small class="na-hint-sm">· לפי המסלול</small></label>
      <select class="na-sel" id="naType">${types.map(t => `<option value="${t}" ${selType === t ? 'selected' : ''}>${(NEXT_ACTIONS[t] || {}).label || t}</option>`).join('')}</select></div>
    <div class="na-field"><label>דחייה / מועד חזרה <small class="na-hint-sm">· ברירת מחדל מההגדרות</small></label>
      <select class="na-sel" id="naDelay">${FU_POLICY_OPTIONS.map(o => `<option value="${o.key}" ${fuDefault === o.key ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
    ${hasM ? `<div class="na-note">${ic('calendar')} פגישה שנקבעה: ${r.meeting.date} · ${r.meeting.time}</div>` : ''}
    <div class="na-field"><label>מועד מדויק (אופציונלי)</label>
      <div class="na-row"><input type="date" value="${mDate}"><input type="time" value="${mTime}"></div></div>
    <button class="btn primary block sm" id="naSave">${ic('check')} שמור</button>`;
  document.body.appendChild(pop);
  if (!mobile) {
    const rc = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let right = window.innerWidth - rc.right;
    right = Math.max(8, Math.min(right, window.innerWidth - pw - 8));
    pop.style.right = `${right}px`;
    pop.style.top = `${Math.max(8, Math.min(rc.bottom + 6, window.innerHeight - ph - 12))}px`;
  } else { requestAnimationFrame(() => pop.classList.add('in')); }
  $('#naSave').addEventListener('click', () => {
    const type = $('#naType') ? $('#naType').value : selType;
    const delayKey = $('#naDelay') ? $('#naDelay').value : fuDefault;
    const delayLabel = (FU_POLICY_OPTIONS.find(o => o.key === delayKey) || {}).label || 'עודכן ידנית';
    r.next = { type, at: delayLabel };
    renderList(); closeNextActionEditor(); toast(`הפעולה הבאה · ${(NEXT_ACTIONS[type] || {}).label || ''} ✓`);
  });
  const bd = $('#naBackdrop'); if (bd) bd.addEventListener('click', closeNextActionEditor);
  setTimeout(() => document.addEventListener('click', naOutside), 0);
}
function naOutside(e) { if (!e.target.closest('#naPop') && !e.target.closest('#naBackdrop')) closeNextActionEditor(); }
function closeNextActionEditor() {
  const p = $('#naPop'); if (p) p.remove();
  const bd = $('#naBackdrop'); if (bd) bd.remove();
  document.removeEventListener('click', naOutside);
}

/* ============================================================
   כרטיס מידע מהיר ב-hover (מסך 2.2)
   ============================================================ */
let hoverTimer = null, hoverHideT = null;
function isTouchDevice() { try { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } }
function attachHoverCard(tr, r) {
  if (isTouchDevice()) return;   // מגע/נייד — אין hover, כדי שהכרטיס לא ייתקע
  let mx = 0, my = 0;
  tr.addEventListener('mouseenter', e => { mx = e.clientX; my = e.clientY; clearTimeout(hoverHideT); hoverTimer = setTimeout(() => showHoverCard(r, mx, my), 380); });
  tr.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });   // עוקב אחר הסמן
  tr.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); scheduleHideHover(); });
}
/* השהיה קצרה כדי לאפשר לעכבר להיכנס לכרטיס — ואז הוא נשאר פתוח */
function scheduleHideHover() { clearTimeout(hoverHideT); hoverHideT = setTimeout(hideHoverCard, 280); }
function anyPopupOpen() {
  return !!($('#naPop') || $('#dayPop') || $('#filterMenu') ||
    $('#modalWrap').classList.contains('open') ||
    $('#drawer').classList.contains('open'));
}
function showHoverCard(r, mx, my) {
  if (isTouchDevice() || document.documentElement.classList.contains('cb-mobile')) return;   // בנייד/מגע — אין hover בכלל
  if (anyPopupOpen()) return;   // מניעת כפילות פופ-אפים
  hideHoverCard();
  const c = document.createElement('div');
  c.className = 'hover-card'; c.id = 'hoverCard';
  const slaTxt = r.sla ? (r.sla.mins != null
      ? `${r.sla.label} · ${r.sla.mins >= 60 ? Math.round(r.sla.mins / 60) + ' ש׳' : r.sla.mins + ' דק׳'} נותרו`
      : r.sla.label) : '';
  c.innerHTML = `
    <div class="hc-head">${avatar(r, 40)}<div><b>${r.name}</b>${r.org ? `<small>${esc(r.org)}</small>` : ''}</div></div>
    <div class="hc-stats">
      <div>${ic('phone')} 3 ניסיונות אחרונים · האחרון אתמול 16:20</div>
      <div>${ic('target')} מטרה: ${OBJECTIVES[r.objective] || '—'}</div>
      ${r.sla ? `<div class="hc-sla ${r.sla.color}">${ic('clock')} SLA: ${slaTxt}</div>` : ''}
      ${(() => { const open = (r.notes || []).filter(n => !n.done);
        return open.length ? `<div class="hc-open-note">${ic('note')} <b>${open.length} הערות לא טופלו</b> · ${esc(open[0].text).slice(0, 42)}${open[0].text.length > 42 ? "…" : ""}</div>` : ''; })()}
    </div>
    <div class="hc-actions">
      <button class="btn sm tel-btn" data-hc="call">${ic('phone')} חיוג</button>
      <button class="btn sm wa-btn" data-hc="wa">${ic('whatsapp')} וואטסאפ</button>
    </div>`;
  document.body.appendChild(c);
  // מיקום ליד הסמן, עם הצמדה לתוך המסך
  const cw = c.offsetWidth, ch = c.offsetHeight, pad = 8, gap = 14;
  let left = mx + gap, top = my + gap;
  if (left + cw > window.innerWidth - pad) left = mx - cw - gap;   // היפוך לצד השני של הסמן
  if (left < pad) left = pad;
  if (top + ch > window.innerHeight - pad) top = my - ch - gap;
  if (top < pad) top = pad;
  c.style.left = `${left}px`;
  c.style.top = `${top}px`;
  c.style.right = 'auto';
  // כניסת העכבר לכרטיס — נשאר פתוח; יציאה — נסגר
  c.addEventListener('mouseenter', () => clearTimeout(hoverHideT));
  c.addEventListener('mouseleave', scheduleHideHover);
  // פעולות: חיוג/וואטסאפ מכל מקום (בלי "פתח" — לחיצה על השורה כבר פותחת)
  c.querySelector('[data-hc="call"]').addEventListener('click', () => toast(`מחייג ל${r.name}…`));
  c.querySelector('[data-hc="wa"]').addEventListener('click', () => { hideHoverCard(); openChat(r, 'client'); });
}
function hideHoverCard() { const c = $('#hoverCard'); if (c) c.remove(); }

/* ============================================================
   סיום פגישה עם המלצות AI (מסך 2.8)
   ============================================================ */
function openAiOutcome(r) {
  $('#modal').style.maxWidth = '480px';
  const render = (outcome) => {
    const sugg = AI_OUTCOMES[outcome] || AI_OUTCOMES['מעוניין'];
    $('#modal').innerHTML = `
      <div class="modal-head"><div class="title">${ic('bolt')} סיום פגישה</div>
        <button class="close-btn" id="closeModal">${ic('close')}</button></div>
      <div class="modal-body ai-out">
        <div class="ai-badge">${ic('bolt')} המלצת AI</div>
        <p class="wiz-q sm">איך הסתיימה הפגישה? · ${r.subject}</p>
        <div class="out-grid">
          ${Object.keys(AI_OUTCOMES).map(o => `<button class="out-btn ${o===outcome?'sel':''}" data-out="${o}">${o}</button>`).join('')}
        </div>
        <div class="ai-checklist">
          <div class="col-title">${ic('check')} פעולות המשך מומלצות:</div>
          ${sugg.map(x => `<label class="ai-item"><input type="checkbox" checked> ${x}</label>`).join('')}
        </div>
        <div class="succ-actions">
          <button class="btn" id="aiCloseLead">סגור ליד</button>
          <button class="btn primary" id="aiSave">${ic('check')} שמור והמשך</button>
        </div>
      </div>`;
    $('#closeModal').addEventListener('click', closeModal);
    $$('[data-out]').forEach(b => b.addEventListener('click', () => render(b.dataset.out)));
    $('#aiSave').addEventListener('click', () => { toast(`תוצאה נשמרה: ${outcome} · פעולות ההמשך נוצרו ✓`); closeModal(); });
    $('#aiCloseLead').addEventListener('click', () => { toast('הליד נסגר'); closeModal(); });
  };
  render('מעוניין');
  $('#modalWrap').classList.add('open');
}

/* ============================================================
   חלון WhatsApp (מסך 2.5)
   ============================================================ */
function openWhatsApp(r) {
  $('#modal').style.maxWidth = '440px';
  $('#modal').innerHTML = `
    <div class="modal-head wa-head">
      <div class="title">${avatar(r, 32)} ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body wa-body">
      <div class="wa-bubble in">שלום, קיבלתי את הפרטים. מתי אפשר להיפגש?</div>
      <div class="wa-bubble out">היי ${r.name.split(' ')[0]}, זה יואב. אשמח לתאם פגישה למחר ב-09:30 ✅</div>
      <div class="wa-bubble in">מעולה, מתאים לי 👍</div>
      <div class="wa-bubble out">שלחתי לך זימון ופרטים ל-Google Meet. נתראה!</div>
    </div>
    <div class="wa-input"><input placeholder="הקלד הודעה…"><button class="btn primary sm">${ic('chevronL')}</button></div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('.wa-input .btn').addEventListener('click', () => toast('הודעת WhatsApp נשלחה'));
}

/* ============================================================
   חלון הערות (מסך 2.6)
   ============================================================ */
function notesFor(r) { if (!r.notes) r.notes = []; return r.notes; }
function openNotesCount(r) { return notesFor(r).filter(n => !n.done).length; }
/* עדכון חי של חיווי ההערות בכפתור ובתקציר כשה-Drawer פתוח */
function updateNoteBadge(r) {
  if (selectedId !== r.id) return;
  const btn = $('#drawer .q-btn[data-q="note"]');
  if (btn) {
    const old = btn.querySelector('.q-badge'); if (old) old.remove();
    const n = openNotesCount(r);
    if (n) btn.insertAdjacentHTML('beforeend', `<span class="q-badge">${n}</span>`);
  }
  if ($('#drawerBody') && activeTab === 'flow') {
    renderDrawerTab(r);
    const cst = $('#accordion .acc-item[data-key="contact"]'); if (cst) cst.classList.add('open');
  }
}
function openNotes(r) {
  const notes = notesFor(r);
  const open = openNotesCount(r);
  $('#modal').style.maxWidth = '460px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title">${ic('note')} הערות · ${r.name}
      ${open ? `<span class="chip red sm">${open} לא טופלו</span>` : ''}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="field"><textarea id="noteText" rows="2" placeholder="הוסף הערה…"></textarea></div>
      <button class="btn sm primary" id="noteAdd">${ic('plus')} הוסף הערה</button>
      <div class="note-list">
        ${notes.length ? notes.map((n, i) => `
          <div class="note-row ${n.done ? 'done' : ''}">
            <label class="chk"><input type="checkbox" data-note-done="${i}" ${n.done ? 'checked' : ''} title="${n.done ? 'טופל' : 'סמן כטופל'}"></label>
            <div class="note-body"><span class="note-text">${esc(n.text)}</span>
              <small>${n.by} · ${n.at} ${n.done ? '· ✓ טופל' : ''}</small></div>
            <button class="wh-x" data-note-del="${i}" title="הסר הערה">${ic('close')}</button>
          </div>`).join('')
        : `<div class="muted" style="padding:12px 4px;font-size:12.5px">אין הערות עדיין — ההערה הראשונה שתוסיף תופיע כאן כצ'קליסט.</div>`}
      </div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('#noteAdd').addEventListener('click', () => {
    const ta = $('#noteText'); const txt = (ta.value || '').trim();
    if (!txt) { toast('כתוב הערה קודם'); return; }
    notes.unshift({ text: txt, by: 'יואב כהן', at: 'עכשיו', done: false });
    updateNoteBadge(r); openNotes(r); toast('ההערה נוספה ✓');
  });
  $$('[data-note-done]').forEach(c => c.addEventListener('change', () => {
    notes[+c.dataset.noteDone].done = c.checked;
    updateNoteBadge(r); openNotes(r); toast(c.checked ? 'סומן כטופל ✓' : 'הוחזר ללא-טופל');
  }));
  $$('[data-note-del]').forEach(b => b.addEventListener('click', () => {
    notes.splice(+b.dataset.noteDel, 1);
    updateNoteBadge(r); openNotes(r); toast('ההערה הוסרה');
  }));
}

/* ============================================================
   תזכורת צפה (מסך 2.7)
   ============================================================ */
function showReminder(r) {
  hideReminder();
  const bar = document.createElement('div');
  bar.className = 'reminder-bar'; bar.id = 'reminderBar';
  bar.innerHTML = `
    <span class="rb-ic">${ic('clock')}</span>
    <div class="rb-text"><b>בעוד 15 דקות</b> · פגישה עם ${r.name} · ${r.meeting ? r.meeting.time : '09:30'}</div>
    <div class="rb-actions">
      <button class="btn sm primary" id="rbOpen">פתח</button>
      <button class="btn sm" id="rbSnooze">דחה 5 דק'</button>
      <button class="btn sm ghost" id="rbDone">${ic('check')} בוצע</button>
      <button class="icon-btn" id="rbClose">${ic('close')}</button>
    </div>`;
  document.body.appendChild(bar);
  $('#rbOpen').addEventListener('click', () => { hideReminder(); openDrawer(r); });
  $('#rbSnooze').addEventListener('click', () => { hideReminder(); toast('התזכורת נדחתה ב-5 דקות'); });
  $('#rbDone').addEventListener('click', () => { hideReminder(); toast('סומן כבוצע'); });
  $('#rbClose').addEventListener('click', hideReminder);
}
function hideReminder() { const b = $('#reminderBar'); if (b) b.remove(); }

/* ============================================================
   פנייה חדשה – טופס ריק שמתחיל מ-0 (סעיף 5)
   ============================================================ */
/* ---- תפריט קליק-ימני על שדה: העתק / נקה / הסתר / הזז (הסתרה/הזזה לפי הרשאה) ---- */
function currentUserCanManageFields() {
  const me = (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === CURRENT_USER) : null;
  return !!(me && (String(me.perm).includes('מנהל') || me.perm === 'אדמין'));
}
function closeFieldMenu() { const m = $('#fieldMenu'); if (m) m.remove(); document.removeEventListener('click', fieldMenuOutside); }
function fieldMenuOutside(e) { if (!e.target.closest('#fieldMenu')) closeFieldMenu(); }
function rerenderLeadFields(container) { const v = readLeadForm(container); container.innerHTML = leadFieldsInner(v); }
function openFieldMenu(e, field, container) {
  closeFieldMenu();
  const k = field.dataset.field, ctrl = field.querySelector('[data-nl]'), canMng = currentUserCanManageFields();
  const menu = document.createElement('div');
  menu.className = 'minute-pop field-menu'; menu.id = 'fieldMenu';
  menu.innerHTML = `
    <div class="mp-title">${LEAD_FIELDS[k] ? LEAD_FIELDS[k].label : k}</div>
    <button class="ctx-item" data-fm="copy">${ic('note')} העתק טקסט</button>
    <button class="ctx-item" data-fm="clear">${ic('close')} נקה שדה</button>
    ${canMng ? `<button class="ctx-item" data-fm="edit">${ic('settings')} ערוך שדה (שם/אפשרויות)</button>
      <button class="ctx-item" data-fm="hide">${ic('eye')} הסתר שדה מהכרטיס</button>
      <button class="ctx-item" data-fm="up">${ic('chevron')} הזז מעלה</button>
      <button class="ctx-item dn" data-fm="down">${ic('chevron')} הזז מטה</button>`
      : `<div class="ctx-lock">${ic('flag')} עריכה/הסתרה/הזזה — להרשאת מנהל</div>`}`;
  document.body.appendChild(menu);
  let top = e.clientY + 4, left = e.clientX - menu.offsetWidth + 10;
  if (top + menu.offsetHeight > window.innerHeight - 8) top = e.clientY - menu.offsetHeight - 4;
  menu.style.top = `${Math.max(8, top)}px`; menu.style.left = `${Math.max(8, left)}px`;
  menu.addEventListener('click', ev => {
    const a = ev.target.closest('[data-fm]'); if (!a) return; const act = a.dataset.fm; closeFieldMenu();
    if (act === 'copy') { const val = ctrl ? ctrl.value : ''; if (navigator.clipboard) navigator.clipboard.writeText(val).catch(() => {}); toast(val ? 'הטקסט הועתק ✓' : 'השדה ריק'); }
    if (act === 'clear') { if (ctrl) ctrl.value = ''; toast('השדה נוקה'); }
    if (act === 'hide')  { LEAD_HIDDEN.add(k); rerenderLeadFields(container); toast('השדה הוסתר מהכרטיס · ניתן להשיב'); }
    if (act === 'edit') { editCustomField(field, container, e.clientX, e.clientY); }
    if (act === 'up' || act === 'down') {
      const i = LEAD_FIELD_ORDER.indexOf(k), j = act === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < LEAD_FIELD_ORDER.length) { [LEAD_FIELD_ORDER[i], LEAD_FIELD_ORDER[j]] = [LEAD_FIELD_ORDER[j], LEAD_FIELD_ORDER[i]]; rerenderLeadFields(container); }
    }
  });
  setTimeout(() => document.addEventListener('click', fieldMenuOutside), 0);
}
function setupFieldMenu() {
  if (window.__fieldMenuSetup) return; window.__fieldMenuSetup = true;
  document.addEventListener('contextmenu', e => {
    const field = e.target.closest('[data-field]'), container = field && field.closest('[data-leadfields]');
    if (!field || !container) return;
    e.preventDefault(); openFieldMenu(e, field, container);
  });
  document.addEventListener('click', e => {
    const sh = e.target.closest('[data-showhidden]');
    if (sh) { LEAD_HIDDEN.clear(); const c = sh.closest('[data-leadfields]'); if (c) rerenderLeadFields(c); toast('השדות המוסתרים הוחזרו'); return; }
    const af = e.target.closest('[data-addfield]');
    if (af) { const c = af.closest('[data-leadfields]'); addCustomField(c, e.clientX, e.clientY); }
  });
}

/* ---- מגע: לחיצה ארוכה (1.8 שנ') = קליק ימני — מפעילה את אותן הפקודות (contextmenu) ---- */
/* מגע: דאבל-טאפ = קליק ימני (ראשי) + לחיצה ארוכה 1.8ש' (גיבוי). שניהם יורים contextmenu. */
function setupLongPress() {
  if (window.__longPressSetup) return; window.__longPressSetup = true;
  let timer = null, sx = 0, sy = 0, tgt = null, fired = false;
  let lastTapAt = 0, lastTapX = 0, lastTapY = 0, lastTapTgt = null;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const fireCtx = (x, y, el) => {
    fired = true;
    const target = (el && el.isConnected) ? el : (document.elementFromPoint(x, y) || document);
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
    setTimeout(() => { fired = false; }, 800);
  };
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { clear(); return; }
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tgt = e.target; clear();
    timer = setTimeout(() => { timer = null; fireCtx(sx, sy, tgt); }, 1800);   // לחיצה ארוכה (גיבוי)
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!timer) return; const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 30 || Math.abs(t.clientY - sy) > 30) clear();
  }, { passive: true });
  document.addEventListener('touchend', e => {
    clear();
    const t = e.changedTouches[0]; if (!t) return;
    const now = Date.now();
    if (now - lastTapAt < 340 && Math.abs(t.clientX - lastTapX) < 34 && Math.abs(t.clientY - lastTapY) < 34) {
      // דאבל-טאפ → קליק ימני
      e.preventDefault();
      fireCtx(t.clientX, t.clientY, (lastTapTgt && lastTapTgt.isConnected) ? lastTapTgt : e.target);
      lastTapAt = 0; lastTapTgt = null;
    } else {
      lastTapAt = now; lastTapX = t.clientX; lastTapY = t.clientY; lastTapTgt = e.target;
    }
  }, { passive: false });
  document.addEventListener('touchcancel', clear, { passive: true });
  // בליעת ה-click המזויף אחרי הפעלה, אחרת הוא סוגר מיד את התפריט או מפעיל טוגל
  document.addEventListener('click', e => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
}
setupLongPress();

/* ---- בקשות שדות מהשטח (מרוכזות למנהל, כדי לא להעמיס) ---- */
let FIELD_REQUESTS = [];
let CUSTOM_FIELD_SEQ = 1;
function queueFieldRequest(action, key, label, type, options) {
  const ex = FIELD_REQUESTS.find(r => r.label === label && r.type === type && r.action === action);
  if (ex) { ex.count++; return; }   // דדופ — מספר לידים ביקשו את אותו שדה = בקשה אחת עם מונה (שומר על המפתח המקורי)
  FIELD_REQUESTS.push({ id: 'fr' + (CUSTOM_FIELD_SEQ++), action, key, label, type, options: options || [], by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : 'משתמש'), count: 1 });
}
function closeFieldDefPopup() { $('#fieldDefPop')?.remove(); }
function openFieldDefPopup(o) {
  closeFieldDefPopup();
  let curType = o.type === 'select' ? 'select' : 'text';
  const pop = document.createElement('div');
  pop.className = 'minute-pop field-def-pop'; pop.id = 'fieldDefPop';
  pop.innerHTML = `
    <div class="mp-title">${o.title}</div>
    <label class="fdp-l">שם השדה</label>
    <input class="fdp-in" id="fdpLabel" value="${esc(o.label || '')}" placeholder="שם השדה">
    <label class="fdp-l">סוג שדה</label>
    <div class="fdp-type">
      <button type="button" class="seg-btn ${curType !== 'select' ? 'on' : ''}" data-fdptype="text" ${o.allowType ? '' : 'disabled'}>טקסט</button>
      <button type="button" class="seg-btn ${curType === 'select' ? 'on' : ''}" data-fdptype="select" ${o.allowType ? '' : 'disabled'}>בחירה</button>
    </div>
    <div class="fdp-opts ${curType === 'select' ? '' : 'hide'}" id="fdpOptsWrap">
      <label class="fdp-l">אפשרויות בחירה (שורה לכל אפשרות)</label>
      <textarea class="fdp-in" id="fdpOpts" rows="3" placeholder="אפשרות 1&#10;אפשרות 2">${esc((o.options || []).join('\n'))}</textarea>
    </div>
    <div class="fdp-act"><button class="btn sm primary" id="fdpSave">${ic('check')} ${o.saveLabel || 'הוסף'}</button>
      <button class="btn sm" id="fdpCancel">בטל</button></div>`;
  document.body.appendChild(pop);
  let top = (o.y || 200) + 6, left = Math.max(8, (o.x || 200) - pop.offsetWidth + 20);
  if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - pop.offsetHeight - 8);
  pop.style.top = `${top}px`; pop.style.left = `${left}px`;
  pop.querySelectorAll('[data-fdptype]').forEach(b => b.addEventListener('click', () => {
    if (!o.allowType) return; curType = b.dataset.fdptype;
    pop.querySelectorAll('[data-fdptype]').forEach(x => x.classList.toggle('on', x === b));
    $('#fdpOptsWrap').classList.toggle('hide', curType !== 'select');
  }));
  $('#fdpCancel').addEventListener('click', closeFieldDefPopup);
  $('#fdpSave').addEventListener('click', () => {
    const label = ($('#fdpLabel').value || '').trim(); if (!label) { toast('הזן שם שדה'); return; }
    const options = curType === 'select' ? ($('#fdpOpts').value || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
    if (curType === 'select' && !options.length) { toast('הוסף לפחות אפשרות בחירה אחת'); return; }
    closeFieldDefPopup(); o.onSave({ label, type: curType, options });
  });
}
function addCustomField(container, x, y) {
  openFieldDefPopup({ title: 'הוספת שדה חדש', label: '', type: 'text', options: [], allowType: true, saveLabel: 'הוסף שדה', x, y,
    onSave: ({ label, type, options }) => {
      const key = 'custom_' + (CUSTOM_FIELD_SEQ++);
      LEAD_FIELDS[key] = { label, type, options, custom: true, status: 'pending', ph: label };
      LEAD_FIELD_ORDER.push(key);
      queueFieldRequest('add', key, label, type, options);
      if (container) rerenderLeadFields(container);
      toast(`השדה "${label}" נוסף לליד · נשלחה בקשה למנהל לבחון אישור גורף`);
    } });
}
function editCustomField(field, container, x, y) {
  const k = field.dataset.field, f = LEAD_FIELDS[k]; if (!f) return;
  openFieldDefPopup({ title: `עריכת שדה · ${f.label}`, label: f.label, type: f.type, options: f.options || [], allowType: !!f.custom, saveLabel: 'שמור', x, y,
    onSave: ({ label, type, options }) => {
      f.label = label; if (f.custom) { f.type = type; f.options = options; } if (f.custom) f.status = 'pending';
      queueFieldRequest('edit', k, label, type, options);
      if (container) rerenderLeadFields(container);
      toast('השדה עודכן בליד · נשלחה בקשה למנהל: עדכון גורף או נקודתי');
    } });
}

/* ---- טופס פרטי ליד משותף — הגדרת שדות + סדר + מוסתרים (ניתן להתאמה ע"י מנהל) ---- */
const LEAD_FIELDS = {
  name:    { label: 'שם מלא *',    ph: 'שם הלקוח / ליד', type: 'text' },
  phone:   { label: 'טלפון *',     ph: '05X-XXXXXXX',    type: 'text' },
  idnum:   { label: 'ת.ז',         ph: 'מספר זהות',      type: 'text' },
  mail:    { label: 'אימייל',      ph: 'name@email.com', type: 'text' },
  org:     { label: 'חברה',        ph: 'שם החברה',       type: 'text' },
  entity:  { label: 'סוג ישות',    type: 'ent' },
  journey: { label: 'מסלול טיפול', type: 'jrn' },
  source:  { label: 'מקור',        type: 'src' },
  prio:    { label: 'עדיפות',      type: 'prio' },
  subject: { label: 'נושא',        ph: 'נושא הפנייה',    type: 'text', wide: true },
};
let LEAD_FIELD_ORDER = ['name', 'phone', 'idnum', 'mail', 'org', 'entity', 'journey', 'source', 'prio', 'subject'];
let LEAD_HIDDEN = new Set();
function leadFieldControl(k, v) {
  const f = LEAD_FIELDS[k];
  if (f.type === 'ent')  return `<select data-nl="entity">${Object.entries(ENTITY_TYPES).map(([kk, o]) => `<option value="${kk}" ${v.entity === kk ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
  if (f.type === 'jrn')  return `<select data-nl="journey">${Object.entries(JOURNEY_TYPES).map(([kk, o]) => `<option value="${kk}" ${v.journey === kk ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
  if (f.type === 'src')  return `<select data-nl="source">${['קמפיין גוגל','אתר','פייסבוק','לינקדאין','המלצה','טלפון','וואטסאפ'].map(s => `<option ${v.source === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  if (f.type === 'prio') { const p = v.prio || 'medium'; return `<select data-nl="prio"><option value="medium" ${p==='medium'?'selected':''}>בינונית</option><option value="high" ${p==='high'?'selected':''}>גבוהה</option><option value="low" ${p==='low'?'selected':''}>נמוכה</option></select>`; }
  if (f.type === 'select') return `<select data-nl="${k}"><option value=""></option>${(f.options || []).map(o => `<option ${v[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  return `<input data-nl="${k}" placeholder="${f.ph || f.label || ''}" value="${esc(v[k] || '')}">`;
}
function leadFieldHTML(k, v) {
  const f = LEAD_FIELDS[k];
  const badge = f.custom ? `<span class="lf-cbadge ${f.status || 'pending'}">${f.status === 'approved' ? '✓ מאושר' : 'ממתין לאישור'}</span>` : '';
  return `<div class="field ${f.wide ? 'lf-wide' : ''} ${f.custom ? 'lf-customf' : ''}" data-field="${k}" title="קליק ימני לאפשרויות שדה"><label>${f.label}${badge}</label>${leadFieldControl(k, v)}</div>`;
}
function leadFieldsInner(v) {
  v = v || {};
  const shown = LEAD_FIELD_ORDER.filter(k => !LEAD_HIDDEN.has(k));
  return `<div class="lf-fields">${shown.map(k => leadFieldHTML(k, v)).join('')}</div>
    <div class="lf-addfield-row">
      <button class="lf-addfield" data-addfield>${ic('plus')} הוסף שדה</button>
      ${LEAD_HIDDEN.size ? `<button class="lf-restore" data-showhidden>${ic('eye')} שדות מוסתרים (${LEAD_HIDDEN.size}) — הצג הכל</button>` : ''}
    </div>`;
}
function leadFormFieldsHTML(v) { setupFieldMenu(); return `<div data-leadfields>${leadFieldsInner(v || {})}</div>`; }
function readLeadForm(scope) {
  const g = a => { const el = scope.querySelector(`[data-nl="${a}"]`); return el ? el.value.trim() : ''; };
  return { name: g('name'), phone: g('phone'), idnum: g('idnum'), mail: g('mail'), org: g('org'),
    entity: g('entity') || 'lead', journey: g('journey') || 'sales', source: g('source'), prio: g('prio') || 'medium', subject: g('subject') };
}
function findLeadDup(phone) { return RECORDS.find(r => r.phone && r.phone.replace(/\D/g, '') === (phone || '').replace(/\D/g, '')); }
function buildLeadRecord(v) {
  const flow = workflowFor(v.journey);
  const initials = v.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return {
    id: Math.max(...RECORDS.map(r => r.id)) + 1,
    name: v.name, org: v.org, phone: v.phone, mail: v.mail, idnum: v.idnum,
    avatar: initials || '??',
    entity: v.entity, journey: v.journey, objective: flow[0].objective, stageKey: flow[0].key,
    subject: v.subject || 'פנייה חדשה', assignee: 'יואב כהן', source: v.source,
    priority: v.prio, sla: { label: 'חדש', color: 'blue', mins: 60 },
    status: { label: 'חדש', color: 'blue' },
    next: { type: 'followup', at: 'פולו-אפ מיידי' },
    time: '—', isNew: true,
  };
}
function openNewRecord() {
  $('#modal').style.maxWidth = '560px';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('plus')}</span> פנייה חדשה</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="dup-hint" id="dupHint">${ic('alert')} המערכת תבדוק כפילות לפי טלפון/מייל בעת היצירה.</div>
      ${leadFormFieldsHTML({})}
      <div class="succ-actions" style="margin-top:6px">
        <button class="btn" id="nrCancel">בטל</button>
        <button class="btn primary" id="nrCreate">${ic('check')} צור פנייה והתחל טיפול</button>
      </div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('#nrCancel').addEventListener('click', closeModal);
  $('#nrCreate').addEventListener('click', createNewRecord);
}
function createNewRecord() {
  const v = readLeadForm($('#modal'));
  if (!v.name || !v.phone) { toast('נא למלא שם וטלפון'); return; }
  const dup = findLeadDup(v.phone);
  if (dup) {
    $('#dupHint').className = 'dup-hint warn';
    $('#dupHint').innerHTML = `${ic('alert')} קיימת כבר רשומה עם טלפון זה: <b>${dup.name}</b>.
      <button class="btn sm" id="dupOpen">פתח קיימת</button>`;
    $('#dupOpen').addEventListener('click', () => { closeModal(); openDrawer(dup); });
    return;
  }
  const rec = buildLeadRecord(v);
  RECORDS.unshift(rec);
  closeModal();
  if (typeof renderUnifiedView === 'function' && $('#listBody')) { renderSummary(); renderList(); }
  openDrawer(rec);            // נפתח בשלב 0 – ריק, מוכן למילוי
  toast(`נוצרה פנייה חדשה: ${v.name} · פולו-אפ מיידי נקבע ✓`);
}

/* ---- הדגמת תזכורת: בוטלה — התזכורת מוצגת כהתראה צפה (pushNotify kind:'reminder') עם החלקה לדחייה ---- */
