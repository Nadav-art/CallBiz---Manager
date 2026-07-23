/* ============================================================
   CallBiz Manager – שכבת תהליכים (Flows)
   אשף תיאום · עורך פעולה הבאה · hover card · סיום AI · WhatsApp · הערות · תזכורת
   נטען אחרי app.js ודורס פונקציות תהליך במקום הצורך.
   ============================================================ */

/* נתוני עזר לתהליכים */
const EMPLOYEES = [
  { id: 'yk', name: 'יואב כהן',  role: 'מנהל פעילות', avail: true },
  { id: 'ml', name: 'מיכל רוזן', role: 'נציגת מכירות', avail: true },
  { id: 'sa', name: 'שרון אביב', role: 'שירות',        avail: false },
  { id: 'rl', name: 'רותם לוי',  role: 'נציג',         avail: true },
];
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
  if (s === 3) return `<div class="sched-split">
      <div class="rec-list">
        <p class="wiz-q sm">${wiz.method === 'auto' ? 'הזמנים המומלצים עבורך' : 'זמנים פנויים'}</p>
        ${SUGGESTED_SLOTS.map((sl, i) => {
          const past = isPastToday(sl.time);   // אין הצעות בהיסטוריה
          return `
          <button class="rec-slot ${wiz.slot === i ? 'sel' : ''} ${past ? 'past' : ''}" ${past ? 'disabled' : `data-slot="${i}"`}>
            <span class="rec-check">${past ? ic('close') : ic('check')}</span>
            <b>${sl.time}</b>
            <small>${past ? 'השעה עברה' : sl.reason}</small>
            ${!past && sl.fillsGap ? `<span class="tag green">סוגר פער</span>` : ''}
          </button>`; }).join('')}
      </div>
      <div class="rec-side">
        <div class="col-title">${ic('settings')} הגדרות פעילות</div>
        <ul class="set-list">
          <li>${ic('check')} משך פגישה: 30 דק'</li>
          <li>${ic('check')} זמן מינימלי לפני: 10 דק'</li>
          <li>${ic('check')} זמן מינימלי אחרי: 10 דק'</li>
          <li>${ic('check')} שעות פעילות: 08:00–18:00</li>
          <li>${ic('check')} צמצום פערים: פעיל</li>
        </ul>
        <div class="hint-box" style="margin-top:10px">${ic('bolt')} המערכת מציעה רק זמנים שמתאימים למשך, לזמינות ולצמצום פערים.</div>
      </div></div>`;
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
  if (s === 5) { const sl = SUGGESTED_SLOTS[wiz.slot || 0];
    return `<p class="wiz-q sm">בדקו את הסיכום ולחצו "קבע פגישה"</p>
    <div class="sum-panel">
      <div class="kv-row"><span>${ic('user')} לקוח</span><b>${wiz.r.name}</b></div>
      <div class="kv-row"><span>${ic('tasks')} סוג</span><b>${APPT_KINDS.find(k=>k.key===wiz.kind).title}</b></div>
      <div class="kv-row"><span>${ic('user')} גורם מטפל</span><b>${empName(wiz.owner)}</b></div>
      <div class="kv-row"><span>${ic('calendar')} מועד</span><b>23/05/2024 · ${sl.time}</b></div>
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
  const sl = SUGGESTED_SLOTS[wiz.slot || 0];
  // סיכום הצלחה (מסך 3.8)
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title">${ic('check')} התיאום נקבע</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body success">
      <div class="succ-ring">${ic('check')}</div>
      <h3>הפגישה נקבעה בהצלחה!</h3>
      <p class="muted">${wiz.r.name} · 23/05/2024 · ${sl.time}</p>
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
    wiz.r.next = { type: 'remind', at: `מחר ${sl.time.split(' ')[0]}` };
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
function openNextActionEditor(r, anchor) {
  clearTimeout(hoverTimer); hideHoverCard();   // סגור כרטיס hover כדי שלא תהיה כפילות
  closeNextActionEditor();
  const na = r.next || { type: 'followup', at: '' };
  const hasM = !!r.meeting;
  const mDate = hasM ? toInputDate(r.meeting.date) : '2024-05-22';
  const mTime = hasM ? r.meeting.time : '09:00';       // ← מועד הפגישה הקיים, לא ברירת מחדל
  const pop = document.createElement('div');
  pop.className = 'na-pop'; pop.id = 'naPop';
  pop.innerHTML = `
    <div class="na-title">הפעולה הבאה</div>
    <label class="na-radio"><input type="radio" name="natype" value="followup" ${na.type!=='remind'?'checked':''}> פולו אפ</label>
    <label class="na-radio"><input type="radio" name="natype" value="remind" ${na.type==='remind'?'checked':''}> תזכורת לפגישה</label>
    ${hasM ? `<div class="na-note">${ic('calendar')} פגישה שנקבעה: ${r.meeting.date} · ${r.meeting.time}</div>` : ''}
    <div class="na-title" style="margin-top:8px">מועד</div>
    <div class="na-row"><input type="date" value="${mDate}"><input type="time" value="${mTime}"></div>
    <select class="na-sel"><option>שעתיים לפני הפגישה</option><option>שעה לפני</option><option>יום לפני</option><option>ללא</option></select>
    <button class="btn primary block sm" id="naSave">${ic('check')} שמור</button>`;
  document.body.appendChild(pop);
  const rc = anchor.getBoundingClientRect();
  pop.style.top = `${Math.min(rc.bottom + 6, window.innerHeight - pop.offsetHeight - 12)}px`;
  pop.style.right = `${window.innerWidth - rc.right}px`;
  $('#naSave').addEventListener('click', () => {
    const t = pop.querySelector('input[name=natype]:checked').value;
    r.next = { type: t, at: 'עודכן ידנית' };
    renderList(); closeNextActionEditor(); toast('הפעולה הבאה עודכנה ✓');
  });
  setTimeout(() => document.addEventListener('click', naOutside), 0);
}
function naOutside(e) { if (!e.target.closest('#naPop')) closeNextActionEditor(); }
function closeNextActionEditor() {
  const p = $('#naPop'); if (p) p.remove();
  document.removeEventListener('click', naOutside);
}

/* ============================================================
   כרטיס מידע מהיר ב-hover (מסך 2.2)
   ============================================================ */
let hoverTimer = null, hoverHideT = null;
function attachHoverCard(tr, r) {
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
  if (anyPopupOpen()) return;   // מניעת כפילות פופ-אפים
  hideHoverCard();
  const c = document.createElement('div');
  c.className = 'hover-card'; c.id = 'hoverCard';
  c.innerHTML = `
    <div class="hc-head">${avatar(r, 40)}<div><b>${r.name}</b><small>${r.phone}</small></div></div>
    <div class="hc-stats">
      <div>${ic('phone')} 3 ניסיונות אחרונים</div>
      <div>${ic('calendar')} ${r.meeting ? `פגישה ${r.meeting.time}` : 'אין פגישה מתוזמנת'}</div>
      <div>${ic('target')} מטרה: ${OBJECTIVES[r.objective] || '—'}</div>
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
function openNewRecord() {
  $('#modal').style.maxWidth = '560px';
  const entOpts = Object.entries(ENTITY_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  const jrnOpts = Object.entries(JOURNEY_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('plus')}</span> פנייה חדשה</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="dup-hint" id="dupHint">${ic('alert')} המערכת תבדוק כפילות לפי טלפון/מייל בעת היצירה.</div>
      <div class="field-row">
        <div class="field"><label>שם מלא *</label><input id="nrName" placeholder="שם הלקוח / ליד"></div>
        <div class="field"><label>טלפון *</label><input id="nrPhone" placeholder="05X-XXXXXXX"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>אימייל</label><input id="nrMail" placeholder="name@email.com"></div>
        <div class="field"><label>חברה</label><input id="nrOrg" placeholder="שם החברה"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>סוג ישות</label><select id="nrEntity">${entOpts}</select></div>
        <div class="field"><label>מסלול טיפול</label><select id="nrJourney">${jrnOpts}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>מקור</label><select id="nrSource"><option>קמפיין גוגל</option><option>אתר</option><option>פייסבוק</option><option>לינקדאין</option><option>המלצה</option><option>טלפון</option><option>וואטסאפ</option></select></div>
        <div class="field"><label>עדיפות</label><select id="nrPrio"><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="low">נמוכה</option></select></div>
      </div>
      <div class="field"><label>נושא</label><input id="nrSubject" placeholder="נושא הפנייה"></div>
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
  const val = id => $('#' + id).value.trim();
  const name = val('nrName'), phone = val('nrPhone');
  if (!name || !phone) { toast('נא למלא שם וטלפון'); return; }

  // 5. זיהוי כפילות
  const dup = RECORDS.find(r => r.phone && r.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
  if (dup) {
    $('#dupHint').className = 'dup-hint warn';
    $('#dupHint').innerHTML = `${ic('alert')} קיימת כבר רשומה עם טלפון זה: <b>${dup.name}</b>.
      <button class="btn sm" id="dupOpen">פתח קיימת</button>`;
    $('#dupOpen').addEventListener('click', () => { closeModal(); openDrawer(dup); });
    return;
  }

  const journey = $('#nrJourney').value, entity = $('#nrEntity').value;
  const flow = workflowFor(journey);
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  const rec = {
    id: Math.max(...RECORDS.map(r => r.id)) + 1,
    name, org: val('nrOrg'), phone, mail: val('nrMail'),
    avatar: initials || '??',
    entity, journey, objective: flow[0].objective, stageKey: flow[0].key,   // ← מתחיל בשלב הראשון
    subject: val('nrSubject') || 'פנייה חדשה', assignee: 'יואב כהן', source: $('#nrSource').value,
    priority: $('#nrPrio').value, sla: { label: 'חדש', color: 'blue', mins: 60 },
    status: { label: 'חדש', color: 'blue' },
    next: { type: 'followup', at: 'פולו-אפ מיידי' },
    time: '—', isNew: true,
  };
  RECORDS.unshift(rec);
  closeModal();
  if (typeof renderUnifiedView === 'function' && $('#listBody')) { renderSummary(); renderList(); }
  openDrawer(rec);            // נפתח בשלב 0 – ריק, מוכן למילוי
  toast(`נוצרה פנייה חדשה: ${name} · פולו-אפ מיידי נקבע ✓`);
}

/* ---- הדגמת תזכורת אוטומטית לאחר טעינה ---- */
setTimeout(() => showReminder(RECORDS[0]), 3500);
