/* ============================================================
   CallBiz Manager – Views2: דוחות ומדדים(26) + המלצות AI(שלב ד')
   ============================================================ */

function trendTag(t, good) {
  const up = t > 0;
  const positive = (good === 'up' && up) || (good === 'down' && !up);
  const cls = positive ? 'green' : 'red';
  const arrow = up ? '▲' : '▼';
  return `<span class="trend ${cls}">${arrow} ${Math.abs(t)}%</span>`;
}

function renderReportsView() {
  const funnelMax = FUNNEL[0].value;
  const repMax = Math.max(...REP_STATS.map(r => r.meetings));
  $('#viewHost').innerHTML = `
    <div class="view-head">
      <div class="vh-title"><span class="num">${ic('reports')}</span> דוחות ומדדים</div>
      <div class="cal-toolbar">
        <button class="btn sm">היום</button><button class="btn sm ghost">שבוע</button>
        <button class="btn sm ghost">חודש</button>
        <button class="btn sm">${ic('docs')} ייצוא</button>
      </div>
    </div>

    <!-- אריחי KPI -->
    <div class="kpi-grid">
      ${METRICS.map(m => `<div class="kpi-tile">
        <div class="kpi-top"><span class="kpi-ic">${ic(m.icon)}</span>${trendTag(m.trend, m.good)}</div>
        <div class="kpi-val">${m.value}<small>${m.unit}</small></div>
        <div class="kpi-label">${m.label}</div>
      </div>`).join('')}
    </div>

    <div class="report-row">
      <!-- משפך המרה -->
      <section class="card">
        <div class="card-head"><div class="title">${ic('target')} משפך המרה</div></div>
        <div class="funnel">
          ${FUNNEL.map((f, i) => {
            const w = Math.round(f.value / funnelMax * 100);
            const conv = i > 0 ? Math.round(f.value / FUNNEL[i-1].value * 100) : 100;
            return `<div class="fn-row">
              <div class="fn-label">${f.label}<b>${f.value}</b></div>
              <div class="fn-bar-wrap"><div class="fn-bar ${f.color}" style="width:${w}%"></div></div>
              ${i > 0 ? `<span class="fn-conv">${conv}%</span>` : '<span class="fn-conv muted">—</span>'}
            </div>`;
          }).join('')}
        </div>
      </section>

      <!-- פגישות לפי נציג -->
      <section class="card">
        <div class="card-head"><div class="title">${ic('clients')} פגישות וניצול לפי נציג</div></div>
        <div class="repbars">
          ${REP_STATS.map(r => `<div class="rep-row">
            <div class="rep-name">${r.name}</div>
            <div class="rep-bar-wrap"><div class="rep-bar" style="width:${Math.round(r.meetings/repMax*100)}%">${r.meetings}</div></div>
            <div class="rep-util"><span class="chip ${r.util>=75?'green':r.util>=60?'amber':'gray'}">${r.util}% ניצול</span></div>
          </div>`).join('')}
        </div>
      </section>
    </div>

    <div class="report-row">
      <!-- סטטיסטיקת פולו-אפ -->
      <section class="card">
        <div class="card-head"><div class="title">${ic('phone')} פולו-אפים</div></div>
        <div class="fu-stats">
          <div class="fu-stat"><b>${FOLLOWUP_STATS.total}</b><span>סה"כ</span></div>
          <div class="fu-stat"><b class="green">${FOLLOWUP_STATS.done}</b><span>הושלמו</span></div>
          <div class="fu-stat"><b class="red">${FOLLOWUP_STATS.overdue}</b><span>באיחור</span></div>
          <div class="fu-stat"><b class="blue">${FOLLOWUP_STATS.scheduled}</b><span>מתוזמנים</span></div>
        </div>
      </section>

      <!-- המלצות AI (שלב ד') -->
      <section class="card">
        <div class="card-head"><div class="title"><span class="ai-badge">${ic('bolt')} AI</span> תובנות והמלצות</div></div>
        <div class="ai-insights">
          ${AI_INSIGHTS.map(a => `<div class="ai-ins ${a.level}">
            <div class="ai-ins-top"><span class="ai-ins-type">${a.type}</span>
              <span class="ai-ins-name">${a.name}</span></div>
            <div class="ai-ins-text">${a.text}</div>
            <button class="btn sm primary" data-ai="${a.action}">${a.action}</button>
          </div>`).join('')}
        </div>
      </section>
    </div>`;
  $$('[data-ai]').forEach(b => b.addEventListener('click', () => toast(`בוצע: ${b.dataset.ai} ✓`)));
}

/* ============================================================
   מסכי סיידבר: משימות · שיחות · דוא"ל · מסמכים
   ============================================================ */
const TASKS = [
  { t: 'להתקשר לישראל כהן לפני הפגישה', due: 'היום 09:15', prio: 'high',  done: false, recId: 1 },
  { t: 'לשלוח הצעת מחיר מעודכנת לאבי רוזן', due: 'היום 12:00', prio: 'medium', done: false, recId: 3 },
  { t: 'לתאם התקנה לנועה ברק', due: 'מחר 10:00', prio: 'medium', done: false, recId: 11 },
  { t: 'מעקב גבייה — רונית שגב', due: 'היום 15:00', prio: 'high', done: false, recId: 7 },
  { t: 'לעדכן סיכום פגישה — יעל שרון', due: 'אתמול', prio: 'low', done: true, recId: 9 },
];
/* --- משימות בבר העליון: באדג' + מגירה מימין (כמו מסך הליד) --- */
function updateTasksBadge() {
  const el = $('#tasksCount'); if (!el) return;
  const n = TASKS.filter(t => !t.done).length;
  el.textContent = n;
  el.style.display = n ? 'flex' : 'none';
}
function openTasksDrawer() {
  const open = TASKS.map((t, i) => ({ t, i })).filter(x => !x.t.done);
  const done = TASKS.map((t, i) => ({ t, i })).filter(x => x.t.done);
  const row = x => `
    <div class="task-row ${x.t.done ? 'done' : ''}">
      <label class="chk"><input type="checkbox" data-task-d="${x.i}" ${x.t.done ? 'checked' : ''}></label>
      <div class="task-body"><b>${x.t.t}</b><small>${ic('clock')} ${x.t.due}</small></div>
      ${prioTag(x.t.prio)}
      <button class="icon-btn" data-taskopen-d="${x.t.recId}" title="פתח את הליד">${ic('layers')}</button>
    </div>`;
  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <div class="top">
        <div class="t"><span class="num">${ic('tasks')}</span> משימות ${open.length ? `<span class="chip red sm">${open.length} פתוחות</span>` : ''}</div>
        <button class="close-btn" id="closeDrawer">${ic('close')}</button>
      </div>
    </div>
    <div class="drawer-body">
      ${open.length ? `<div class="sec-title">${ic('clock')} פתוחות</div><div class="task-list">${open.map(row).join('')}</div>`
        : `<div class="empty">${ic('check')}<p>אין משימות פתוחות 🎉</p></div>`}
      ${done.length ? `<div class="sec-title" style="margin-top:14px">${ic('check')} הושלמו</div><div class="task-list">${done.map(row).join('')}</div>` : ''}
    </div>
    <div class="drawer-foot"><button class="btn primary block" id="taskAddD">${ic('plus')} משימה חדשה</button></div>`;
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#taskAddD').addEventListener('click', () => openAddTask());
  $$('[data-task-d]').forEach(c => c.addEventListener('change', () => {
    TASKS[+c.dataset.taskD].done = c.checked;
    updateTasksBadge(); openTasksDrawer();
    toast(c.checked ? 'המשימה הושלמה ✓' : 'המשימה נפתחה מחדש');
  }));
  $$('[data-taskopen-d]').forEach(b => b.addEventListener('click', () => {
    const r = RECORDS.find(x => x.id === +b.dataset.taskopenD);
    if (r) openDrawer(r, openTasksDrawer);   // חזרה לרשימת המשימות במקום יציאה מלאה
  }));
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
  $('#overlay').classList.add('open');
}

function renderTasksView() {
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">${ic('tasks')}</span> משימות</div>
      <button class="btn sm primary" id="taskAdd">${ic('plus')} משימה חדשה</button></div>
    <section class="card" style="max-width:820px">
      <div class="task-list">
        ${TASKS.map((t, i) => `<div class="task-row ${t.done ? 'done' : ''}">
          <label class="chk"><input type="checkbox" data-task="${i}" ${t.done ? 'checked' : ''}></label>
          <div class="task-body"><b>${t.t}</b><small>${ic('clock')} ${t.due}</small></div>
          ${prioTag(t.prio)}
          <button class="icon-btn" data-taskopen="${t.recId}" title="פתח רשומה">${ic('layers')}</button>
        </div>`).join('')}
      </div>
    </section>`;
  $$('[data-task]').forEach(c => c.addEventListener('change', () => { TASKS[+c.dataset.task].done = c.checked; renderTasksView(); toast(c.checked ? 'המשימה הושלמה ✓' : 'המשימה נפתחה מחדש'); }));
  $$('[data-taskopen]').forEach(b => b.addEventListener('click', () => { const r = RECORDS.find(x => x.id === +b.dataset.taskopen); if (r) openDrawer(r); }));
  $('#taskAdd').addEventListener('click', () => openAddTask());
}

/* --- הוספת משימה חדשה (עובד מכל מקום: מגירת המשימות + מסך המשימות) --- */
let addTaskState = { prio: 'medium', recId: '' };
function openAddTask() {
  addTaskState = { prio: 'medium', recId: '' };
  const fromDrawer = $('#drawer') && $('#drawer').classList.contains('open');
  renderAddTask(fromDrawer);
  $('#modalWrap').classList.add('open');
}
function renderAddTask(fromDrawer) {
  const prios = [['high', 'גבוהה'], ['medium', 'בינונית'], ['low', 'נמוכה']];
  const recs = (typeof RECORDS !== 'undefined') ? RECORDS : [];
  $('#modal').style.maxWidth = '460px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('tasks')}</span> משימה חדשה</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body add-task">
      <div class="field"><label>תיאור המשימה *</label><input class="cc-inp" id="atTitle" placeholder="מה צריך לעשות…" autocomplete="off"></div>
      <div class="field"><label>מועד</label><input class="cc-inp" id="atDue" placeholder="למשל: היום 14:00 · מחר · שישי 10:00"></div>
      <div class="field"><label>עדיפות</label>
        <div class="at-prio">${prios.map(([k, l]) => `<button type="button" class="at-prio-btn ${addTaskState.prio === k ? 'on ' + k : ''}" data-atprio="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>שיוך לליד (אופציונלי)</label>
        <select class="cc-inp" id="atRec"><option value="">— ללא —</option>${recs.map(r => `<option value="${r.id}" ${String(addTaskState.recId) === String(r.id) ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" id="atCancel">ביטול</button>
      <button class="btn primary" id="atSave">${ic('check')} הוסף משימה</button></div>`;
  $('#closeModal').addEventListener('click', closeModal);
  $('#atCancel').addEventListener('click', closeModal);
  $$('[data-atprio]').forEach(b => b.addEventListener('click', () => { addTaskState.prio = b.dataset.atprio; $$('[data-atprio]').forEach(x => x.className = 'at-prio-btn' + (x === b ? ' on ' + b.dataset.atprio : '')); }));
  $('#atSave').addEventListener('click', () => {
    const title = ($('#atTitle').value || '').trim();
    if (!title) { toast('הזן תיאור למשימה'); $('#atTitle').focus(); return; }
    const due = ($('#atDue').value || '').trim() || 'ללא מועד';
    const recId = $('#atRec').value ? +$('#atRec').value : undefined;
    TASKS.unshift({ t: title, due, prio: addTaskState.prio, done: false, recId });
    if (typeof updateTasksBadge === 'function') updateTasksBadge();
    closeModal();
    toast('המשימה נוספה ✓');
    if (fromDrawer && typeof openTasksDrawer === 'function') openTasksDrawer();
    else if ($('#viewHost') && $('#viewHost').querySelector('.task-list')) renderTasksView();
  });
  setTimeout(() => { const ti = $('#atTitle'); if (ti) ti.focus(); }, 60);
}

const CALLS_LOG = [
  { who: 'ישראל כהן',  dir: 'יוצאת', at: 'היום 08:40',  dur: '3:12', result: 'נענתה',    color: 'green', recId: 1 },
  { who: 'מיכל רוזן',  dir: 'נכנסת', at: 'היום 08:15',  dur: '6:40', result: 'נענתה',    color: 'green', recId: 4 },
  { who: 'יואב בן דוד', dir: 'יוצאת', at: 'אתמול 17:20', dur: '—',    result: 'אין מענה', color: 'red',   recId: 6 },
  { who: 'רונית שגב',  dir: 'יוצאת', at: 'אתמול 13:00', dur: '2:05', result: 'נענתה',    color: 'green', recId: 7 },
  { who: 'דנה לוי',    dir: 'נכנסת', at: 'אתמול 11:32', dur: '4:18', result: 'נענתה',    color: 'green', recId: 2 },
];
function renderCallsView() {
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">${ic('phone')}</span> שיחות</div></div>
    <section class="card" style="max-width:900px"><div class="table-wrap">
      <table class="list"><thead><tr><th></th><th>איש קשר</th><th>כיוון</th><th>מועד</th><th>משך</th><th>תוצאה</th></tr></thead>
      <tbody>${CALLS_LOG.map(c => `<tr data-callrec="${c.recId}" style="cursor:pointer">
        <td><button class="icon-btn tel" data-redial="${c.who}" title="חייג שוב">${ic('phone')}</button></td>
        <td><b>${c.who}</b></td>
        <td>${c.dir === 'יוצאת' ? '↗' : '↙'} ${c.dir}</td>
        <td class="muted">${c.at}</td><td>${c.dur}</td>
        <td><span class="chip ${c.color}">${c.result}</span></td></tr>`).join('')}</tbody></table>
    </div></section>`;
  $$('[data-callrec]').forEach(tr => tr.addEventListener('click', () => { const r = RECORDS.find(x => x.id === +tr.dataset.callrec); if (r) openDrawer(r); }));
  $$('[data-redial]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toast(`מחייג ל${b.dataset.redial}…`); }));
}

const MAILS = [
  { from: 'ישראל כהן', sub: 'אישור פגישה למחר', time: '08:46', unread: true, recId: 1 },
  { from: 'Google Calendar', sub: 'זימון: פגישה 09:30 — ישראל כהן', time: '08:45', unread: true },
  { from: 'דנה לוי', sub: 'RE: הצעת מערכת — שאלות', time: 'אתמול', recId: 2 },
  { from: 'הנהלת חשבונות', sub: 'חשבונית 4471 — Segev Ltd', time: 'אתמול', recId: 7 },
];
function renderMailView() {
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">${ic('mail')}</span> דוא"ל</div>
      <button class="btn sm primary" id="mailNew">${ic('plus')} מייל חדש</button></div>
    <section class="card" style="max-width:820px">
      ${MAILS.map((m, i) => `<button class="mail-row ${m.unread ? 'unread' : ''}" data-mail="${i}">
        <span class="mail-dot ${m.unread ? 'on' : ''}"></span>
        <span class="mail-body"><b>${m.from}</b><span>${m.sub}</span></span>
        <small>${m.time}</small>
      </button>`).join('')}
    </section>`;
  $$('[data-mail]').forEach(b => b.addEventListener('click', () => {
    const m = MAILS[+b.dataset.mail]; m.unread = false;
    if (m.recId) { const r = RECORDS.find(x => x.id === m.recId); if (r) { openDrawer(r); return renderMailView(); } }
    renderMailView(); toast(`נפתח: ${m.sub}`);
  }));
  $('#mailNew').addEventListener('click', () => toast('חלון כתיבת מייל — בקרוב יחובר ל-SMTP'));
}

const DOCS_LIST = [
  { name: 'הצעת מחיר — ישראל כהן.pdf', client: 'ישראל כהן', type: 'הצעת מחיר', date: '22/05/24', recId: 1 },
  { name: 'חוזה שירות — Zohar Group.docx', client: 'אבי רוזן', type: 'חוזה', date: '20/05/24', recId: 3 },
  { name: 'סיכום פגישה — יעל שרון.pdf', client: 'יעל שרון', type: 'סיכום', date: '19/05/24', recId: 9 },
  { name: 'טופס התקנה — נועה ברק.pdf', client: 'נועה ברק', type: 'טופס', date: '18/05/24', recId: 11 },
];
function renderDocsView() {
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">${ic('docs')}</span> מסמכים</div>
      <button class="btn sm primary" id="docUp">${ic('plus')} העלה מסמך</button></div>
    <section class="card" style="max-width:900px"><div class="table-wrap">
      <table class="list"><thead><tr><th></th><th>שם מסמך</th><th>לקוח</th><th>סוג</th><th>תאריך</th></tr></thead>
      <tbody>${DOCS_LIST.map(d => `<tr data-docrec="${d.recId}" style="cursor:pointer">
        <td><button class="icon-btn" data-docdl="${d.name}" title="הורד">${ic('docs')}</button></td>
        <td><b>${d.name}</b></td><td>${d.client}</td>
        <td><span class="badge blue">${d.type}</span></td><td class="muted">${d.date}</td></tr>`).join('')}</tbody></table>
    </div></section>`;
  $$('[data-docrec]').forEach(tr => tr.addEventListener('click', () => { const r = RECORDS.find(x => x.id === +tr.dataset.docrec); if (r) openDrawer(r); }));
  $$('[data-docdl]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toast(`מוריד: ${b.dataset.docdl}`); }));
  $('#docUp').addEventListener('click', () => toast('העלאת מסמך — בחר קובץ'));
}
