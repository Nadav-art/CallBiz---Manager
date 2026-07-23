/* ============================================================
   CallBiz Manager – לוגיקת אפליקציה
   מסך אחוד: סיכום + רשימה + Drawer(טאבים+workflow) + תזמון + Work Queue
   ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = (n) => ICONS[n] || '';
const esc = (s) => (s == null ? '' : String(s));

let selectedId = null;
let activeTab  = 'flow';
let activeFilter = null;
let listFilters = { status: null, journey: null, assignee: null };

/* ---------------- שלד ---------------- */
let navActive = 'meetings';
let navManageOpen = false;
function renderNav() {
  const item = (n, sub) => `
    <button class="nav-item ${sub ? 'sub' : ''} ${navActive === n.key ? 'active' : ''}" data-nav="${n.key}">
      ${ic(n.icon)}<span>${n.label}</span></button>`;
  $('#nav').innerHTML = NAV.map(n => item(n, false)).join('') + `
    <button class="nav-item nav-manage ${navManageOpen ? 'open' : ''} ${NAV_MANAGE.some(m => m.key === navActive) ? 'active' : ''}" id="navManage">
      ${ic('layers')}<span>ניהול</span><i class="nm-chev">${ic('chevron')}</i>
    </button>
    ${navManageOpen ? NAV_MANAGE.map(n => item(n, true)).join('') : ''}`;
  const mg = $('#navManage');
  if (mg) mg.addEventListener('click', () => { navManageOpen = !navManageOpen; renderNav(); });
  $$('#nav .nav-item[data-nav]').forEach(b => b.addEventListener('click', () => {
    navActive = b.dataset.nav;
    renderNav();
    $$('#procTabs .proc-tab').forEach(x => x.classList.remove('active'));
    moveSegInd();
    const k = b.dataset.nav;
    if (k === 'reports')    return renderReportsView();
    if (k === 'settings')   return renderSettingsView();
    if (k === 'whatsapp')   return enterChatPlatform();
    if (k === 'calendar')   return renderCalendarView();
    if (k === 'automation') return renderAutomationView();
    if (k === 'tasks')      return renderTasksView();
    if (k === 'calls')      return renderCallsView();
    if (k === 'mail')       return renderMailView();
    if (k === 'docs')       return renderDocsView();
    // ראשי / לידים / פגישות / לקוחות → המסך האחוד
    const first = $('#procTabs .proc-tab'); if (first) first.classList.add('active');
    moveSegInd();
    return renderUnifiedView();
  }));
}
function renderTabs() {
  $('#procTabs').innerHTML = `<div class="proc-seg" id="procSeg"><span class="seg-ind"></span>
    ${PROC_TABS.map(t => `<button class="proc-tab ${t.active ? 'active' : ''}" data-tab="${t.key}">${ic(t.icon)}${t.label}</button>`).join('')}
  </div>`;
  $$('#procSeg .proc-tab').forEach(b => b.addEventListener('click', () => {
    $$('#procSeg .proc-tab').forEach(x => x.classList.remove('active')); b.classList.add('active');
    moveSegInd();
    switchView(b.dataset.tab);
  }));
  requestAnimationFrame(moveSegInd);
}
/* מחוון הצ'יפ הזז */
function moveSegInd() {
  const seg = $('#procSeg'); if (!seg) return;
  const ind = seg.querySelector('.seg-ind'); if (!ind) return;
  const act = seg.querySelector('.proc-tab.active');
  if (!act) { ind.style.width = '0px'; return; }
  ind.style.left = act.offsetLeft + 'px';
  ind.style.width = act.offsetWidth + 'px';
}

/* ---------------- החלפת מסכים דרך הטאבים ---------------- */
function switchView(key) {
  if (key === 'dynamic') return renderDynamicView();
  renderUnifiedView();
  if (key === 'smart') openScheduleModal(RECORDS[0]);
}

/* ---------------- מסך אחוד (ברירת מחדל) ---------------- */
function renderUnifiedView() {
  $('#viewHost').innerHTML = `
    <div class="summary" id="summary"></div>
    <div class="work-row">
      <section class="card list-card">
        <div class="card-head">
          <div class="title"><span class="num">1</span> מסך ראשי – רשימת פניות / לידים / פגישות</div>
          <span class="muted" id="listCount" style="font-size:12px"></span>
        </div>
        <div class="list-toolbar">
          <button class="btn primary" id="newRecordBtn"></button>
          <button class="select ${listFilters.status ? 'sel' : ''}" data-filter="status">${listFilters.status || 'כל הסטטוסים'} ${ic('chevron')}</button>
          <button class="select ${listFilters.journey ? 'sel' : ''}" data-filter="journey">${listFilters.journey || 'כל המסלולים'} ${ic('chevron')}</button>
          <button class="select ${listFilters.assignee ? 'sel' : ''}" data-filter="assignee">${listFilters.assignee || 'כל הנציגים'} ${ic('chevron')}</button>
          <button class="icon-btn" id="filterBtn" title="נקה סינון"></button>
          <div class="spacer"></div>
          <span class="muted" style="font-size:12px">22 מאי 2024</span>
        </div>
        <div class="table-wrap">
          <table class="list">
            <thead><tr>
              <th style="width:96px"></th><th>לקוח / ליד</th><th>נושא</th><th>מסלול</th>
              <th>סטטוס</th><th>הפעולה הבאה</th><th>עדיפות</th>
            </tr></thead>
            <tbody id="listBody"></tbody>
          </table>
        </div>
      </section>
      <aside class="side-rail">
        <div class="card queue-card">
          <div class="card-head"><div class="title"><span class="num">Q</span> Work Queue</div></div>
          <div class="queue" id="queue"></div>
          <div class="queue-foot muted">לפי עדיפות · SLA · זמן</div>
        </div>
        <div class="card legend-card">
          <div class="card-head"><div class="title">מקרא סטטוסים</div></div>
          <div class="legend" id="legend"></div>
        </div>
      </aside>
    </div>`;
  renderSummary(); renderList(); renderQueue(); renderLegend(); initToolbar();
}

function renderLegend() {
  if (!$('#legend')) return;
  $('#legend').innerHTML = `
    <div class="legend-group">${STATUS_LEGEND.map(l =>
      `<span class="leg"><i style="background:${l.color}"></i>${l.label}</span>`).join('')}</div>
    <div class="legend-sub muted">סוגי תיאום</div>
    <div class="legend-group">${APPT_TYPE_LEGEND.map(l =>
      `<span class="leg">${ic(l.icon)}${l.label}</span>`).join('')}</div>`;
}

/* ---------------- כרטיסי סיכום (3.2) ---------------- */
function renderSummary() {
  if (!$('#summary')) return;
  $('#summary').innerHTML = SUMMARY_CARDS.map(c => `
    <button class="sum-card ${activeFilter === c.key ? 'active' : ''}" data-card="${c.key}">
      <span class="sc-head"><span class="sc-ic ${c.color}">${ic(c.icon)}</span></span>
      <span class="v ${c.color}">${cardCount(c.key)}</span>
      <span class="l">${c.label}</span>
      <span class="delta">${c.delta || ''}</span>
    </button>`).join('');
  $$('#summary .sum-card').forEach(b => b.addEventListener('click', () => {
    activeFilter = activeFilter === b.dataset.card ? null : b.dataset.card;
    renderSummary(); renderList();
    toast(activeFilter ? `סינון: ${SUMMARY_CARDS.find(c=>c.key===activeFilter).label}` : 'הסינון בוטל');
  }));
}

/* ---------------- כלים ---------------- */
function avatar(r, size = 30) {
  const bg = r.female ? '#E9A8C9' : '#8B93A7';
  return `<div class="av" style="width:${size}px;height:${size}px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size/2.4}px;border-radius:50%">${r.avatar}</div>`;
}
function prioTag(p) {
  const m = { high: ['גבוהה','red'], medium: ['בינונית','amber'], low: ['נמוכה','gray'] };
  const [t, c] = m[p] || m.low;
  return `<span class="chip ${c}"><span class="dot"></span>${t}</span>`;
}
function nextCell(r) {
  const na = NEXT_ACTIONS[r.next?.type] || NEXT_ACTIONS.none;
  return `<div class="next-cell ${r.overdue ? 'overdue' : ''}" data-next role="button" title="עריכת הפעולה הבאה">
    <span class="chip ${na.color}">${ic(na.icon)}${na.label}</span>
    <small>${esc(r.next?.at)}</small></div>`;
}

/* ---------------- טבלה ראשית ---------------- */
/* פרדיקטים משותפים – משמשים גם לספירת הכרטיסים וגם לסינון (כדי שהמספרים תמיד יתאימו) */
const FILTERS = {
  today_meetings: r => ['meeting', 'remind'].includes(r.next?.type) && !r.done,
  today_followup: r => r.next?.type === 'followup' && !r.done,
  overdue:        r => !!r.overdue,
  week_meetings:  r => ['sales', 'upsell', 'appointment', 'renewal'].includes(r.journey),
  done:           r => !!r.done,
  new_leads:      r => r.entity === 'lead' && ['intake', 'assign', 'contactinfo', 'contact'].includes(r.stageKey) && !r.done,
  open_service:   r => ['support', 'billing', 'complaint', 'general'].includes(r.journey) && !r.done,
  pending_appt:   r => !!r.pendingApproval,
  no_next:        r => !r.next || r.next.type === 'none',
};
function cardCount(key) { return FILTERS[key] ? RECORDS.filter(FILTERS[key]).length : 0; }
function filteredRecords() {
  let rows = RECORDS;
  if (activeFilter && FILTERS[activeFilter]) rows = rows.filter(FILTERS[activeFilter]);
  if (listFilters.status)   rows = rows.filter(r => r.status.label === listFilters.status);
  if (listFilters.journey)  rows = rows.filter(r => JOURNEY_TYPES[r.journey].label === listFilters.journey);
  if (listFilters.assignee) rows = rows.filter(r => r.assignee === listFilters.assignee);
  return rows;
}
/* --- תפריטי סינון בטולבר --- */
function filterOptions(type) {
  const uniq = a => [...new Set(a)];
  if (type === 'status')   return ['כל הסטטוסים', ...uniq(RECORDS.map(r => r.status.label))];
  if (type === 'journey')  return ['כל המסלולים', ...uniq(RECORDS.map(r => JOURNEY_TYPES[r.journey].label))];
  if (type === 'assignee') return ['כל הנציגים', ...uniq(RECORDS.map(r => r.assignee).filter(a => a && a !== '—'))];
  return [];
}
function openFilterMenu(anchor, type) {
  closeFilterMenu();
  const opts = filterOptions(type);
  const cur = listFilters[type];
  const pop = document.createElement('div');
  pop.className = 'filter-menu'; pop.id = 'filterMenu';
  pop.innerHTML = opts.map((o, i) => `<button data-i="${i}" class="${(i === 0 && !cur) || cur === o ? 'on' : ''}">${o}</button>`).join('');
  document.body.appendChild(pop);
  const rc = anchor.getBoundingClientRect();
  pop.style.top = `${rc.bottom + 5}px`;
  pop.style.right = `${window.innerWidth - rc.right}px`;
  $$('button', pop).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    listFilters[type] = i === 0 ? null : opts[i];
    closeFilterMenu(); renderUnifiedView();
  }));
  setTimeout(() => document.addEventListener('click', filterOutside), 0);
}
function filterOutside(e) { if (!e.target.closest('#filterMenu') && !e.target.closest('[data-filter]')) closeFilterMenu(); }
function closeFilterMenu() { const p = $('#filterMenu'); if (p) p.remove(); document.removeEventListener('click', filterOutside); }
function clearAllFilters() {
  listFilters = { status: null, journey: null, assignee: null }; activeFilter = null;
  renderUnifiedView(); toast('כל הסינונים נוקו');
}
function renderList() {
  const body = $('#listBody'); if (!body) return;   // הגנה: לא במסך האחוד
  const rows = filteredRecords();
  const cnt = $('#listCount'); if (cnt) cnt.textContent = `${rows.length} רשומות`;
  body.innerHTML = rows.map(r => {
    const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
    return `
    <tr data-id="${r.id}" class="${r.id === selectedId ? 'sel' : ''} ${r.overdue ? 'row-over' : ''}">
      <td><div class="row-actions">
        <button class="icon-btn wa" data-stop data-act="wa" title="WhatsApp">${ic('whatsapp')}</button>
        <button class="icon-btn tel" data-stop data-act="call" title="חיוג">${ic('phone')}</button>
      </div></td>
      <td><div class="client-cell">
        ${avatar(r)}
        <span class="ent-dot ${et.color}" title="${et.label}"></span>
        <div class="meta"><b>${r.name}</b><small>${esc(r.org) || esc(r.phone)}</small></div>
      </div></td>
      <td>${r.subject}</td>
      <td><span class="badge ${jt.color}">${jt.label}</span></td>
      <td><span class="chip ${r.status.color}">${r.status.label}</span></td>
      <td>${nextCell(r)}</td>
      <td>${prioTag(r.priority)}</td>
    </tr>`;
  }).join('');

  $$('#listBody tr').forEach(tr => {
    const r = RECORDS.find(x => x.id === +tr.dataset.id);
    tr.addEventListener('click', () => openDrawer(r));
    $$('[data-stop]', tr).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      if (b.dataset.act === 'call') toast(`מחייג ל${r.name}…`);
      if (b.dataset.act === 'wa')   openWhatsApp(r);
    }));
    const nc = $('[data-next]', tr);
    if (nc) nc.addEventListener('click', e => { e.stopPropagation(); openNextActionEditor(r, nc); });
    attachHoverCard(tr, r);
  });
}

/* ---------------- Work Queue (18) ---------------- */
function renderQueue() {
  if (!$('#queue')) return;
  $('#queue').innerHTML = WORK_QUEUE.map((q, i) => `
    <div class="q-item" data-id="${q.id}">
      <div class="q-rank">${i + 1}</div>
      <div class="q-body">
        <div class="q-kind">${q.kind}</div>
        <div class="q-name">${q.name} · <b>${q.time}</b></div>
        <div class="q-why">${q.why}</div>
      </div>
      <span class="chip ${q.priority === 'high' ? 'red' : 'amber'} q-prio">${q.priority === 'high' ? 'דחוף' : 'רגיל'}</span>
    </div>`).join('');
  $$('#queue .q-item').forEach(el => el.addEventListener('click', () =>
    openDrawer(RECORDS.find(x => x.id === +el.dataset.id))));
}

/* ---------------- Drawer ---------------- */
function openDrawer(r) {
  selectedId = r.id; activeTab = 'flow'; renderList();
  const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <div class="top">
        <div class="t"><span class="num">2</span> מרכז הטיפול</div>
        <button class="close-btn" id="closeDrawer">${ic('close')}</button>
      </div>
      <div class="client-head">
        ${avatar(r, 46)}
        <div class="info">
          <b>${r.name}</b>
          <small>${esc(r.org)} ${r.org ? '·' : ''} ${esc(r.phone)}</small>
          <div class="head-badges">
            <span class="badge ${et.color}">${et.label}</span>
            <span class="badge ${jt.color}">${jt.label}</span>
            <span class="chip ${r.status.color} sm">${r.status.label}</span>
          </div>
        </div>
      </div>
      <div class="head-meta">
        <span>${ic('target')} מטרה: <b>${OBJECTIVES[r.objective] || '—'}</b></span>
        <span>${ic('user')} ${r.assignee}</span>
        <span class="sla ${r.sla.color}">${ic('clock')} SLA: ${r.sla.label}</span>
      </div>
      <div class="quick" id="quickRow">${quickRowHTML(r)}</div>
      <div class="drawer-tabs">
        ${DRAWER_TABS.map(t => `<button class="d-tab ${t.key === 'flow' ? 'active' : ''}" data-dtab="${t.key}">${t.label}</button>`).join('')}
      </div>
    </div>
    <div class="drawer-body" id="drawerBody"></div>
    <div class="drawer-foot">
      <button class="btn primary block" id="saveTreat">${ic('check')} שמור וקדם שלב</button>
      <button class="btn" id="cancelTreat">בטל</button>
    </div>`;

  renderDrawerTab(r);
  bindDrawer(r);
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
  $('#overlay').classList.add('open');
}

/* --- פעולות מהירות: עין להתאמה אישית (הסתרת אייקונים) --- */
let qaEdit = false;
let hiddenQA = new Set(JSON.parse(localStorage.getItem('cb_hiddenQA') || '[]'));
const QUICK_ACTIONS = [
  { q: 'call',    icon: 'phone',    label: 'חיוג',      cls: 'tel' },
  { q: 'wa',      icon: 'whatsapp', label: 'וואטסאפ',   cls: 'wa' },
  { q: 'consult', icon: 'clients',  label: 'התייעצות' },
  { q: 'mail',    icon: 'mail',     label: 'מייל' },
  { q: 'meet',    icon: 'calendar', label: 'פגישה' },
  { q: 'fu',      icon: 'phone',    label: 'פולו-אפ' },
  { q: 'note',    icon: 'note',     label: 'הערה' },
];
function quickRowHTML(r) {
  const btns = QUICK_ACTIONS.filter(a => qaEdit || !hiddenQA.has(a.q)).map(a => `
    <button class="q-btn ${a.cls || ''} ${qaEdit && hiddenQA.has(a.q) ? 'qa-off' : ''}" data-q="${a.q}">
      ${ic(a.icon)}<span>${a.label}</span>
      ${a.q === 'note' && !qaEdit && typeof openNotesCount === 'function' && openNotesCount(r) ? `<span class="q-badge">${openNotesCount(r)}</span>` : ''}
    </button>`).join('');
  return btns + `<button class="q-btn qa-eye ${qaEdit ? 'on' : ''}" data-qaeye title="התאמת הפעולות המוצגות">${ic('eye')}<span>תצוגה</span></button>`;
}
function bindQuickRow(r) {
  $$('#quickRow [data-q]').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.q;
    if (qaEdit) {   // מצב התאמה: לחיצה מסתירה/מציגה
      hiddenQA.has(q) ? hiddenQA.delete(q) : hiddenQA.add(q);
      localStorage.setItem('cb_hiddenQA', JSON.stringify([...hiddenQA]));
      refreshQuick(r);
      return;
    }
    if (q === 'call') toast(`מחייג ל${r.name}…`);
    if (q === 'wa')   openWhatsApp(r);
    if (q === 'consult') openConsult(r);
    if (q === 'mail') toast('נפתח חלון דוא"ל');
    if (q === 'meet') openScheduleModal(r);
    if (q === 'fu')   openFollowupPanel(r);
    if (q === 'note') openNotes(r);
  }));
  const eye = $('#quickRow [data-qaeye]');
  if (eye) eye.addEventListener('click', () => {
    qaEdit = !qaEdit;
    refreshQuick(r);
    toast(qaEdit ? 'מצב התאמה: לחץ על אייקון כדי להסתיר/להציג, ואז על העין לסיום' : 'התצוגה נשמרה ✓');
  });
}
function refreshQuick(r) { const q = $('#quickRow'); if (q) { q.innerHTML = quickRowHTML(r); bindQuickRow(r); } }

function bindDrawer(r) {
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#cancelTreat').addEventListener('click', closeDrawer);
  $('#saveTreat').addEventListener('click', () => { toast('הטיפול נשמר · השלב קודם · אישור נשלח ✓'); });
  bindQuickRow(r);
  $$('.drawer-tabs .d-tab').forEach(b => b.addEventListener('click', () => {
    activeTab = b.dataset.dtab;
    $$('.drawer-tabs .d-tab').forEach(x => x.classList.remove('active')); b.classList.add('active');
    renderDrawerTab(r);
  }));
}

/* ---------------- תוכן טאב ---------------- */
function renderDrawerTab(r) {
  const body = $('#drawerBody');
  if (activeTab === 'flow')    return void (body.innerHTML = flowHTML(r), bindFlow(r));
  if (activeTab === 'details') return void (body.innerHTML = detailsHTML(r));
  if (activeTab === 'history') return void (body.innerHTML = historyHTML(r));
  if (activeTab === 'log')     return void (body.innerHTML = logHTML(r));
  if (activeTab === 'tasks')   return void (body.innerHTML = `<div class="empty">${ic('check')}<p>אין משימות פתוחות לרשומה זו.</p><button class="btn sm primary">${ic('plus')} משימה חדשה</button></div>`);
  if (activeTab === 'docs')    return void (body.innerHTML = `<div class="empty">${ic('docs')}<p>אין מסמכים מצורפים.</p><button class="btn sm">${ic('plus')} העלה מסמך</button></div>`);
}

/* ---- ציר טיפול דינמי (מנוע Workflow) ---- */
function computeStages(r) {
  const flow = dynamicFlow(r);
  // אם השלב הנוכחי דולג — הפעיל הוא הבא שקיים במסלול המקורי
  let curIdx = flow.findIndex(s => s.key === r.stageKey);
  if (curIdx < 0) {
    const base = workflowFor(r.journey);
    const from = Math.max(0, base.findIndex(s => s.key === r.stageKey));
    for (let i = from; i < base.length; i++) {
      const j = flow.findIndex(s => s.key === base[i].key);
      if (j >= 0) { curIdx = j; break; }
    }
    if (curIdx < 0) curIdx = 0;
  }
  return flow.map((s, i) => {
    let state = i < curIdx ? 'done' : i === curIdx ? 'active' : 'todo';
    if (i === curIdx && r.overdue) state = 'overdue';
    return { ...s, state, idx: i };
  });
}
function flowHTML(r) {
  const stages = computeStages(r);
  return `${clientSummaryCard(r)}
    <div class="sec-title">${ic('layers')} ציר הטיפול · מסלול ${JOURNEY_TYPES[r.journey].label}
      <button class="btn sm flow-custom" data-custom-stages>${ic('settings')} התאם שלבים</button></div>
    <div class="accordion" id="accordion">
      ${stages.map(s => accItem(s, r)).join('')}
    </div>`;
}
/* התאמת שלבים לליד: דילוג על לא-רלוונטיים + הוספת מקדמה/הסכם */
function openStageCustomizer(r) {
  const base = workflowFor(r.journey);
  const skip = r.skipStages || [];
  const extras = r.extraStages || [];
  $('#modal').style.maxWidth = '440px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title">${ic('settings')} התאמת שלבים · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="fu2-lbl">שלבי המסלול (בטל סימון = דלג)</div>
      <div class="stage-cust">
        ${base.map((s, i) => { const locked = i === 0 || s.key === 'close';
          return `<label class="chk sc-row ${locked ? 'locked' : ''}">
            <input type="checkbox" data-sc="${s.key}" ${skip.includes(s.key) ? '' : 'checked'} ${locked ? 'disabled' : ''}>
            ${s.title}${locked ? ' <small>(חובה)</small>' : ''}</label>`; }).join('')}
      </div>
      <div class="fu2-lbl">שלבים אופציונליים לפי צורך</div>
      <div class="stage-cust">
        ${EXTRA_STAGE_LIB.map(e => `<label class="chk sc-row extra">
          <input type="checkbox" data-sce="${e.key}" ${extras.includes(e.key) ? 'checked' : ''}>
          <b>${e.title}</b> · <small>${e.desc}</small></label>`).join('')}
      </div>
      <div class="succ-actions"><button class="btn" id="scCancel">בטל</button>
        <button class="btn primary" id="scSave">${ic('check')} החל שלבים</button></div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('#scCancel').addEventListener('click', closeModal);
  $('#scSave').addEventListener('click', () => {
    r.skipStages = [...$$('#modal [data-sc]')].filter(c => !c.checked).map(c => c.dataset.sc);
    r.extraStages = [...$$('#modal [data-sce]:checked')].map(c => c.dataset.sce);
    closeModal();
    renderDrawerTab(r);
    toast(`השלבים הותאמו: ${dynamicFlow(r).length} שלבים במסלול ✓`);
  });
}
/* --- תקציר לקוח + תקציר שיחות --- */
function clientSummaryCard(r) {
  const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
  const recent = commLogFor(r).slice(0, 3);
  return `
    <div class="cs-card">
      <div class="cs-head">${ic('user')} תקציר לקוח</div>
      <div class="cs-facts">
        <span><b>${et.label}</b> · ${jt.label}</span>
        <span>${ic('target')} ${OBJECTIVES[r.objective] || '—'}</span>
        <span>${ic('phone')} ${r.phone}</span>
        ${r.meeting ? `<span>${ic('calendar')} פגישה ${r.meeting.date} ${r.meeting.time}</span>` : ''}
        <span class="sla ${r.sla.color}">${ic('clock')} SLA: ${r.sla.label}</span>
      </div>
      <div class="cs-sub">${ic('note')} תקציר שיחות אחרונות</div>
      <div class="cs-conv">
        ${recent.map(c => { const t = COMM_TYPES[c.type];
          return `<div class="cs-line"><span class="cs-dot ${t.color}"></span><span class="cs-txt">${c.text}</span><small>${c.at}</small></div>`;
        }).join('')}
      </div>
      ${(() => { const all = r.notes || []; if (!all.length) return '';
        const open = all.filter(n => !n.done);
        return `<div class="cs-sub">${ic('note')} הערות</div>
          <div class="cs-notes ${open.length ? 'warn' : ''}">
            ${open.length
              ? `<b>${open.length} פתוחות</b> מתוך ${all.length} · ${esc(open[0].text).slice(0, 46)}${open[0].text.length > 46 ? "…" : ""}`
              : `כל ${all.length} ההערות טופלו ✓`}
          </div>`; })()}
    </div>`;
}
function accItem(s, r) {
  const st = STAGE_STATE[s.state];
  const open = s.state === 'active' || s.state === 'overdue';
  const stateIcon = st.icon ? ic(st.icon) : (s.idx + 1);
  return `
    <div class="acc-item st-${s.state} ${open ? 'open' : ''}" data-key="${s.key}">
      <button class="acc-head">
        <span class="state ${st.color}">${stateIcon}</span>
        <span class="label">${s.title}</span>
        <span class="sub ${st.color}">${st.label}</span>
        <span class="chev">${ic('chevron')}</span>
      </button>
      <div class="acc-panel"><div class="acc-panel-inner">${accBody(s, r)}</div></div>
    </div>`;
}
function accBody(s, r) {
  const k = s.key;
  if (['meeting','call','offer','present'].includes(k))
    return `<div class="meeting-box">
        <div class="line">${ic('calendar')} <b>${r.meeting ? 'פגישה מתוכננת' : 'טרם נקבעה פגישה'}</b></div>
        ${r.meeting ? `<div class="line">${ic('clock')} ${r.meeting.date}, ${r.meeting.time} · ${r.meeting.dur} דק'</div>
        <div class="line">${ic('user')} עם ${r.meeting.with}</div>
        <div class="line">${ic('video')} ${r.meeting.channel}</div>` : ''}
        <div class="actions">
          <button class="btn sm primary" data-open="schedule">${ic('clock')} הצע זמנים</button>
          <button class="btn sm" data-open="calendar">${ic('calendar')} יומן מלא</button>
        </div></div>`;
  if (k === 'contactinfo') {
    const list = contactsFor(r);
    const card = (c, i) => `
      <div class="contact-card ${c.primary ? 'primary' : ''}">
        <div class="ctc-top">
          <label class="ctc-prim" title="איש קשר ראשי — מוצג למעלה ומשמש לחיוג"><input type="radio" name="primc" data-cprim="${i}" ${c.primary ? 'checked' : ''}></label>
          <input class="ctc-name" data-cf="${i}:name" value="${esc(c.name)}" placeholder="שם מלא">
          <select class="ctc-role" data-crole="${i}">${CONTACT_ROLES.map(o => `<option ${c.role === o ? 'selected' : ''}>${o}</option>`).join('')}
            ${!CONTACT_ROLES.includes(c.role) ? `<option selected>${esc(c.role)}</option>` : ''}</select>
          ${list.length > 1 ? `<button class="wh-x" data-cdel="${i}" title="הסר איש קשר">${ic('close')}</button>` : ''}
        </div>
        ${c.role === 'אחר' ? `<div class="ctc-row"><span class="ctc-f other">${ic('user')}<input data-crole-custom="${i}" placeholder="הקלד את סוג התפקיד ולחץ Enter…"></span></div>` : ''}
        <div class="ctc-row">
          <span class="ctc-f">${ic('phone')}<input data-cf="${i}:phone" inputmode="tel" value="${esc(c.phone || '')}" placeholder="טלפון (מספרים בלבד)"></span>
          <span class="ctc-f">${ic('mail')}<input data-cf="${i}:mail" value="${esc(c.mail || '')}" placeholder="אימייל (אנגלית)"></span>
          ${c._saved === false
            ? `<button class="icon-btn dis" data-ccall-locked title="שמור את איש הקשר לפני חיוג">${ic('phone')}</button>`
            : `<button class="icon-btn tel" data-ccall="${i}" title="חיוג לאיש קשר זה">${ic('phone')}</button>`}
        </div>
      </div>`;
    const primIdx = Math.max(0, list.findIndex(c => c.primary));
    const others = list.map((c, i) => ({ c, i })).filter(x => x.i !== primIdx);
    return `<div class="sec-title">${ic('user')} אנשי הקשר של ${r.org || r.name}</div>
      <div class="contacts">
        ${card(list[primIdx], primIdx)}
        ${others.length ? `
          <button class="ctc-more ${r.contactsOpen ? 'open' : ''}" data-cmore>
            <i class="chev">${ic('chevron')}</i> אנשי קשר נוספים (${others.length})</button>
          ${r.contactsOpen ? `<div class="ctc-extra">${others.map(x => card(x.c, x.i)).join('')}</div>` : ''}` : ''}
        <div class="ctc-actions">
          <button class="wh-add" data-cadd>${ic('plus')} הוסף איש קשר (תפקיד נוסף)</button>
          ${list.length > 1 ? `<button class="btn sm primary" data-csave>${ic('check')} שמור אנשי קשר</button>` : ''}
        </div>
      </div>
      <p class="hint">${ic('alert')} הראשי (●) מסונכרן לטלפון/מייל שלמעלה ולשיחה היוצאת.</p>`;
  }
  if (k === 'contact')
    return `<div class="sec-title">${ic('note')} ציר תקשורת · כל מה שנעשה מול הלקוח</div>
      <div class="comm-timeline">
        ${commLogFor(r).map(c => { const t = COMM_TYPES[c.type];
          return `<div class="comm-item ${t.color}">
            <span class="comm-ic ${t.color}">${ic(t.icon)}</span>
            <div class="comm-body"><div class="comm-top"><b>${t.label}</b><small>${c.at}</small></div>
              <div class="comm-txt">${c.text}</div><div class="comm-by">${ic('user')} ${c.by}</div></div>
          </div>`; }).join('')}
      </div>
      <div class="comm-add">
        <div class="field-row">
          <div class="field"><label>סוג תיעוד</label>
            <select id="commType">${COMM_ADD_TYPES.map(t => `<option value="${t}">${COMM_TYPES[t].label}</option>`).join('')}</select></div>
          <div class="field"><label>פולו-אפ (מועד חזרה)</label>
            <button type="button" class="fu-btn ${r.fuAt ? 'set' : ''}" id="commFu" title="ניהול הפולו-אפ">
              ${ic('clock')} ${r.fuAt ? r.fuAt : 'ברירת מחדל: ' + fuRecommendation()}
            </button>
          </div>
        </div>
        <div class="field" id="commTextWrap"><textarea rows="2" placeholder="פרטי התיעוד…"></textarea></div>
        <div class="hint-box hidden" id="commNoAnswer">${ic('phone')} "אין מענה" מתועד אוטומטית — אין צורך בפירוט.</div>
        <button class="btn sm primary" data-comm-add>${ic('plus')} הוסף תיעוד</button>
      </div>`;
  if (k === 'remind')
    return `<div class="hint-box">${ic('phone')} סיכום השיחה הראשונה מול הלקוח (נפרד מציר התקשורת).</div>
      <div class="field" style="margin-top:8px"><label>סיכום השיחה הראשונה</label><textarea rows="3" placeholder="עיקרי השיחה, צרכים, המשך…"></textarea></div>
      <button class="btn sm primary">${ic('check')} תעד ושלב</button>`;
  if (['proposal'].includes(k))
    return `<div class="field-row">
        <div class="field"><label>סכום</label><input value="4,900 ₪"></div>
        <div class="field"><label>תוקף</label><input value="14 ימים"></div></div>
      <button class="btn sm">${ic('mail')} שלח הצעת מחיר</button>`;
  if (['reminder'].includes(k))
    return `<div class="field"><label>שליחת תזכורת</label>
        <select><option>SMS – שעה לפני</option><option>WhatsApp – יום לפני</option></select></div>
      <button class="btn sm primary">${ic('check')} הפעל תזכורת</button>`;
  if (k === 'confirm') {
    // התור כבר נקבע — כאן רק תזכורות ואישור הגעה (וואטסאפ, לא SMS)
    const msg = fillTemplate(WA_TEMPLATES.arrival, r);
    return `<div class="hint-box">${ic('calendar')} התור נקבע · ${r.next?.at || 'המועד שנקבע'} — ממתין לאישור הגעה. אין צורך לתאם שוב.</div>
      <div class="sec-title" style="margin-top:12px">${ic('whatsapp')} אישור הגעה · וואטסאפ אוטומטי</div>
      <div class="wa-preview">${esc(msg)}<small>הודעת תבנית · עריכה במסך ההגדרות</small></div>
      <div class="ctc-actions" style="margin-top:10px">
        <button class="btn sm primary" data-wa-confirm>${ic('whatsapp')} שלח עכשיו</button>
        <span class="chip green sm">${ic('check')} נשלח אוטומטית שעה לפני</span>
      </div>
      <div class="field" style="margin-top:12px"><label>תזכורת נוספת</label>
        <select><option>שעה לפני (וואטסאפ)</option><option>3 שעות לפני (וואטסאפ)</option><option>בבוקר יום התור</option><option>ללא</option></select></div>`;
  }
  if (['schedule','svc'].includes(k))
    return `<div class="meeting-box"><div class="line">${ic('calendar')} <b>תיאום תור שירות</b></div>
        <div class="actions"><button class="btn sm primary" data-open="schedule">${ic('clock')} הצע זמנים</button></div></div>`;
  if (['summary','held','arrive'].includes(k))
    return `<button class="btn sm primary block" data-open="ai">${ic('bolt')} סיים פגישה עם המלצת AI</button>
      <div class="field" style="margin-top:10px"><label>סיכום ידני</label><textarea rows="2" placeholder="נקודות עיקריות…"></textarea></div>
      <p class="hint">${ic('alert')} לא ניתן לסיים ללא פעולה הבאה (סעיף 16.5).</p>`;
  if (['close'].includes(k))
    return `<div class="field"><label>סגירה</label>
        <select><option>נסגר בהצלחה</option><option>הפסד</option><option>לא רלוונטי</option></select></div>
      <button class="btn sm primary">${ic('check')} סגור טיפול</button>`;
  if (['intake','open','request','create'].includes(k))
    return `<div class="hint-box">${ic('note')} נקלט אוטומטית ע"י המערכת · הפרטים ניתנים לעריכה.</div>
      <div class="field" style="margin-top:10px"><label>שם הליד</label><input data-lf="name" value="${esc(r.name)}"></div>
      <div class="field-row">
        <div class="field"><label>חברה</label><input data-lf="org" value="${esc(r.org || '')}" placeholder="—"></div>
        <div class="field"><label>מקור</label><input data-lf="source" value="${esc(r.source || '')}"></div>
      </div>
      <div class="field"><label>נושא</label><input data-lf="subject" value="${esc(r.subject)}"></div>
      <div class="field-row">
        <div class="field"><label>סוג ישות</label><select data-lf="entity">${Object.entries(ENTITY_TYPES).map(([k2, v]) => `<option value="${k2}" ${r.entity === k2 ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <div class="field"><label>עדיפות</label><select data-lf="priority">${['high','medium','low'].map(p => `<option value="${p}" ${r.priority === p ? 'selected' : ''}>${{ high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' }[p]}</option>`).join('')}</select></div>
      </div>
      <div class="kv-row"><span>מסלול</span><b>${JOURNEY_TYPES[r.journey].label}</b></div>
      <div class="kv-row"><span>מטרה נוכחית</span><b>${OBJECTIVES[r.objective] || '—'}</b></div>
      <div class="kv-row"><span>גורם מטפל</span><b>${r.assignee}</b></div>
      <button class="btn sm primary" style="margin-top:10px" data-lf-save>${ic('check')} שמור פרטי ליד</button>`;
  if (['notify','review'].includes(k))
    return `<div class="hint-box">${ic('note')} ${r.subject} · מקור: ${r.source} · נפתח אוטומטית ע"י המערכת.</div>`;
  if (['assign'].includes(k))
    return `<div class="hint-box">${ic('user')} הוקצה ל-${r.assignee} לפי חוקי ניתוב.</div>`;
  if (k === 'qualify')
    return `<div class="field"><label>סוג הצורך</label>
        <select><option>התעניינות כללית</option><option>מערכת חדשה</option><option>שדרוג / הרחבה</option><option>בעיה בשירות קיים</option><option>השוואת מחיר</option></select></div>
      <div class="field-row">
        <div class="field"><label>דחיפות הצורך</label><select><option>מיידי</option><option>החודש</option><option>ברבעון הקרוב</option><option>עתידי</option></select></div>
        <div class="field"><label>תקציב משוער</label><select><option>טרם ידוע</option><option>עד 5,000 ₪</option><option>5–20 אלף ₪</option><option>מעל 20 אלף ₪</option></select></div>
      </div>
      <div class="field"><label>פירוט הצורך</label><textarea rows="2" placeholder="מה הלקוח באמת צריך…"></textarea></div>
      <button class="btn sm primary" data-stage-done>${ic('check')} שמור סיווג והמשך</button>`;
  if (k === 'deposit')
    return `<div class="hint-box">${ic('alert')} טיפול זה דורש מקדמה לפני ההמשך.</div>
      <div class="field-row" style="margin-top:8px">
        <div class="field"><label>סכום מקדמה</label><input value="500 ₪"></div>
        <div class="field"><label>אמצעי</label><select><option>קישור סליקה (וואטסאפ)</option><option>אשראי טלפוני</option><option>העברה</option></select></div>
      </div>
      <button class="btn sm primary" data-pay-req>${ic('whatsapp')} שלח בקשת תשלום</button>`;
  if (k === 'contract')
    return `<div class="hint-box">${ic('docs')} שליחת הסכם ישירות — בלי לחכות לשלבים נוספים.</div>
      <div class="field" style="margin-top:8px"><label>ערוץ שליחה</label>
        <select><option>וואטסאפ + חתימה דיגיטלית</option><option>מייל + חתימה דיגיטלית</option></select></div>
      <button class="btn sm primary" data-contract-send>${ic('check')} שלח הסכם לחתימה</button>`;
  // ברירת מחדל: תיעוד קצר + סימון השלב כהושלם (במקום "אין פרטים")
  return `<div class="field"><label>הערה לשלב (אופציונלי)</label><textarea rows="2" placeholder="מה נעשה בשלב הזה…"></textarea></div>
    <button class="btn sm primary" data-stage-done>${ic('check')} סמן שלב כהושלם</button>`;
}
/* המלצת מועד חזרה — לפי מדיניות ההגדרות, תמיד מסונכרנת עם חלון פנוי */
function fuRecommendation() {
  // פנוי + עתידי בלבד — לעולם לא בהיסטוריה
  const freeFuture = FOLLOWUP_WINDOWS.find(w => w.booked < w.capacity && !isPastToday(w.range));
  switch (FOLLOWUP_POLICY.mode) {
    case 'next_day':   return `מחר ${FOLLOWUP_WINDOWS[0].range}`;
    case 'other_hour': { const t = nowHM() + 120; return t < 18 * 60 ? `היום ${minToHM(t)} (בעוד שעתיים)` : `מחר ${FOLLOWUP_WINDOWS[0].range}`; }
    case 'end_day':    return nowHM() < 17 * 60 ? 'היום 17:00' : `מחר ${FOLLOWUP_WINDOWS[0].range}`;
    default:           return freeFuture ? `היום ${freeFuture.range}` : `מחר ${FOLLOWUP_WINDOWS[0].range}`;  // same_day
  }
}
function fuWhenOptions() {
  const rec = fuRecommendation();
  const wins = FOLLOWUP_WINDOWS.filter(w => w.booked < w.capacity && !isPastToday(w.range))
    .map(w => `<option value="היום ${w.range}">היום ${w.range} · ${w.capacity - w.booked} פנוי</option>`).join('');
  return `<option value="">ללא</option>
    <option value="${rec}" selected>מומלץ: ${rec} · לפי הגדרות + פנוי</option>
    ${wins}
    <option value="__manual">בחירה ידנית…</option>
    <option value="__cal">📅 פתח יומן מלא…</option>`;
}
/* שינוי מהיר — מחושב מהשעה הנוכחית, בלי אופציות שעברו */
function fuQuickList() {
  const n = nowHM(), list = [];
  if (n + 15 < 18 * 60) list.push({ label: 'בעוד 15 דק׳', when: `היום ${minToHM(n + 15)}` });
  if (n + 30 < 18 * 60) list.push({ label: 'בעוד 30 דק׳', when: `היום ${minToHM(n + 30)}` });
  if (n + 60 < 18 * 60) list.push({ label: 'בעוד שעה', when: `היום ${minToHM(n + 60)}` });
  if (n < 17 * 60) list.push({ label: 'מאוחר היום', when: 'היום 17:00' });
  list.push({ label: 'מחר בבוקר', when: '23/05 09:00' });
  list.push({ label: 'מחר בצהריים', when: '23/05 13:00' });
  return list;
}

function bindFlow(r) {
  $$('#accordion .acc-head').forEach(h => h.addEventListener('click', () =>
    h.closest('.acc-item').classList.toggle('open')));
  $$('[data-open="schedule"]').forEach(b => b.addEventListener('click', () => openScheduleModal(r)));
  $$('[data-open="calendar"]').forEach(b => b.addEventListener('click', openCalendarModal));
  $$('[data-open="ai"]').forEach(b => b.addEventListener('click', () => openAiOutcome(r)));
  // סוג "אין מענה" — אין צורך בפירוט
  const ct = $('#commType');
  if (ct) ct.addEventListener('change', () => {
    const na = ct.value === 'noanswer';
    const tw = $('#commTextWrap'), nh = $('#commNoAnswer');
    if (tw) tw.classList.toggle('hidden', na);
    if (nh) nh.classList.toggle('hidden', !na);
  });
  // --- פרטי אנשי קשר: עריכה, ראשי, הוספה, הסרה, חיוג ---
  const rerenderContacts = () => {
    renderDrawerTab(r);
    const el = $('#accordion .acc-item[data-key="contactinfo"]'); if (el) el.classList.add('open');
  };
  const syncTop = () => {
    syncPrimaryContact(r);
    const small = $('#drawer .client-head small');
    if (small) small.textContent = `${r.org || ''}${r.org ? ' · ' : ''}${r.phone || ''}`;
    renderList();
  };
  /* --- התאמת שלבים + השלמת שלב + מקדמה/הסכם --- */
  $$('[data-custom-stages]').forEach(b => b.addEventListener('click', () => openStageCustomizer(r)));
  $$('[data-stage-done]').forEach(b => b.addEventListener('click', () => {
    const key = b.closest('.acc-item')?.dataset.key;
    const flow = dynamicFlow(r);
    const i = flow.findIndex(s => s.key === key);
    if (i >= 0 && r.stageKey === key && i < flow.length - 1) {
      r.stageKey = flow[i + 1].key;
      r.objective = flow[i + 1].objective || r.objective;
      renderList();
    }
    renderDrawerTab(r);
    const nextKey = (flow[i + 1] || flow[i] || {}).key;
    if (nextKey) { const el = $(`#accordion .acc-item[data-key="${nextKey}"]`); if (el) el.classList.add('open'); }
    toast('השלב הושלם ✓');
  }));
  $$('[data-pay-req]').forEach(b => b.addEventListener('click', () => {
    commLogFor(r).unshift({ type: 'wa', at: 'עכשיו', by: 'מערכת', text: 'נשלחה בקשת תשלום מקדמה (קישור סליקה) בוואטסאפ' });
    toast('בקשת התשלום נשלחה ✓');
  }));
  $$('[data-contract-send]').forEach(b => b.addEventListener('click', () => {
    commLogFor(r).unshift({ type: 'wa', at: 'עכשיו', by: 'מערכת', text: 'נשלח הסכם לחתימה דיגיטלית' });
    toast('ההסכם נשלח לחתימה ✓');
  }));

  /* --- אישור הגעה בוואטסאפ (שלב "אישור לקוח") --- */
  $$('[data-wa-confirm]').forEach(b => b.addEventListener('click', () => {
    commLogFor(r).unshift({ type: 'wa', at: 'עכשיו', by: 'מערכת', text: `נשלח אישור הגעה בוואטסאפ (תבנית): "${fillTemplate(WA_TEMPLATES.arrival, r).slice(0, 40)}…"` });
    const key = b.closest('.acc-item')?.dataset.key;
    renderDrawerTab(r);
    if (key) { const el = $(`#accordion .acc-item[data-key="${key}"]`); if (el) el.classList.add('open'); }
    toast('אישור הגעה נשלח בוואטסאפ ✓ (תועד בציר התקשורת)');
  }));

  /* --- פרטי ליד עריכים (שלב "ליד נכנס") --- */
  $$('[data-lf]').forEach(inp => inp.addEventListener('change', () => { r[inp.dataset.lf] = inp.value; }));
  $$('[data-lf-save]').forEach(b => b.addEventListener('click', () => {
    const key = b.closest('.acc-item')?.dataset.key;
    $$('[data-lf]').forEach(inp => { r[inp.dataset.lf] = inp.value; });
    r.avatar = r.name.split(' ').map(w => w[0]).slice(0, 2).join('') || r.avatar;
    const nameEl = $('#drawer .client-head b'); if (nameEl) nameEl.textContent = r.name;
    renderList();
    renderDrawerTab(r);
    if (key) { const el = $(`#accordion .acc-item[data-key="${key}"]`); if (el) el.classList.add('open'); }
    toast('פרטי הליד נשמרו ✓');
  }));

  /* ולידציה חיה: טלפון = מספרים בלבד; אימייל = בלי עברית */
  const showFieldErr = (inp, msg) => {
    const f = inp.closest('.ctc-f') || inp;
    f.classList.add('err');
    let m = f.parentElement.querySelector('.ctc-err-msg');
    if (!m) { m = document.createElement('div'); m.className = 'ctc-err-msg'; f.parentElement.appendChild(m); }
    m.textContent = msg;
    clearTimeout(f._errT);
    f._errT = setTimeout(() => { f.classList.remove('err'); m.remove(); }, 2000);
  };
  $$('[data-cf$=":phone"]').forEach(inp => inp.addEventListener('input', () => {
    const clean = inp.value.replace(/[^\d\-+ ]/g, '');
    if (clean !== inp.value) { inp.value = clean; showFieldErr(inp, 'טלפון — מספרים בלבד'); }
  }));
  $$('[data-cf$=":mail"]').forEach(inp => inp.addEventListener('input', () => {
    const clean = inp.value.replace(/[֐-׿]/g, '');
    if (clean !== inp.value) { inp.value = clean; showFieldErr(inp, 'אימייל — באנגלית בלבד'); }
  }));
  $$('[data-cf]').forEach(inp => inp.addEventListener('change', () => {
    const [i, f] = inp.dataset.cf.split(':');
    contactsFor(r)[+i][f] = inp.value;
    if (contactsFor(r)[+i].primary) syncTop();
  }));
  /* תפקיד: בחירה מהרשימה; "אחר" פותח שדה חופשי שנכנס לרשימה לפעמים הבאות */
  $$('[data-crole]').forEach(sel => sel.addEventListener('change', () => {
    const i = +sel.dataset.crole;
    contactsFor(r)[i].role = sel.value;
    rerenderContacts();
  }));
  $$('[data-crole-custom]').forEach(inp => {
    const commit = () => {
      const v = inp.value.trim(); if (!v) return;
      const i = +inp.dataset.croleCustom;
      addCustomRole(v);
      contactsFor(r)[i].role = v;
      rerenderContacts();
      toast(`התפקיד "${v}" נוסף לרשימת התפקידים ✓`);
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    inp.addEventListener('blur', commit);
  });
  /* קיפול אנשי קשר נוספים */
  $$('[data-cmore]').forEach(b => b.addEventListener('click', () => { r.contactsOpen = !r.contactsOpen; rerenderContacts(); }));
  /* שמור אנשי קשר — משחרר חיוג/הוספה לחדשים */
  $$('[data-csave]').forEach(b => b.addEventListener('click', () => {
    let ok = true;
    $$('[data-cf$=":mail"]').forEach(inp => {
      if (inp.value && !inp.value.includes('@')) { showFieldErr(inp, 'אימייל לא תקין — חסר @'); ok = false; }
    });
    $$('[data-cf]').forEach(inp => { const [i, f] = inp.dataset.cf.split(':'); contactsFor(r)[+i][f] = inp.value; });
    contactsFor(r).forEach(c => {
      if (c._saved === false && (!c.name.trim() || !c.phone.trim())) { ok = false; }
    });
    if (!ok) { toast('חסר שם/טלפון או שדה לא תקין — השלם ונסה שוב'); return; }
    contactsFor(r).forEach(c => c._saved = true);
    syncTop();
    rerenderContacts();
    toast('אנשי הקשר נשמרו ✓ — חיוג והוספה זמינים');
  }));
  $$('[data-cprim]').forEach(rd => rd.addEventListener('change', () => {
    contactsFor(r).forEach((c, idx) => c.primary = idx === +rd.dataset.cprim);
    syncTop(); rerenderContacts();
    toast(`איש הקשר הראשי הוחלף — הטלפון למעלה ולחיוג עודכן ✓`);
  }));
  $$('[data-cdel]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.cdel;
    const wasPrimary = contactsFor(r)[i].primary;
    contactsFor(r).splice(i, 1);
    if (wasPrimary && contactsFor(r)[0]) contactsFor(r)[0].primary = true;
    syncTop(); rerenderContacts();
    toast('איש הקשר הוסר');
  }));
  $$('[data-cadd]').forEach(b => b.addEventListener('click', () => {
    if (contactsFor(r).some(c => c._saved === false)) { toast('שמור קודם את איש הקשר הנוכחי'); return; }
    contactsFor(r).push({ name: '', role: 'אחר', phone: '', mail: '', primary: false, _saved: false });
    r.contactsOpen = true;   // פותח את רשימת הנוספים כדי לראות את החדש
    rerenderContacts();
  }));
  $$('[data-ccall-locked]').forEach(b => b.addEventListener('click', () => toast('שמור את איש הקשר לפני חיוג')));
  $$('[data-ccall]').forEach(b => b.addEventListener('click', () => {
    const c = contactsFor(r)[+b.dataset.ccall];
    toast(`מחייג ל${c.name || 'איש הקשר'}${c.role && c.role !== 'איש קשר ראשי' ? ` (${c.role})` : ''} · ${c.phone || 'אין מספר'}…`);
  }));

  // כפתור הפולו-אפ → מנהל הפולו-אפ (בחירה נשמרת מיד, גם בלי "שמור")
  const cfu = $('#commFu');
  if (cfu) cfu.addEventListener('click', () => openFollowupPanel(r));
  $$('[data-comm-add]').forEach(b => b.addEventListener('click', () => {
    const wrap = b.closest('.comm-add');
    const type = $('#commType') ? $('#commType').value : 'note';
    const ta = wrap ? wrap.querySelector('#commTextWrap textarea') : null;
    let txt = (ta ? ta.value : '').trim();
    if (type === 'noanswer' && !txt) txt = 'ניסיון חיוג — אין מענה';
    if (!txt) { toast('נא למלא את פרטי התיעוד'); return; }
    // התיעוד נכנס לציר התקשורת של הרשומה (ומשם לתקציר)
    commLogFor(r).unshift({ type, at: 'עכשיו', by: 'יואב כהן', text: txt });
    // בלי בחירת פולו-אפ ידנית — דיפולט לזמן הבא לפי ההגדרות (מסונכרן עם פנוי)
    let autoMsg = '';
    if (!r.fuAt && ['noanswer', 'callback'].includes(type)) {
      r.fuAt = fuRecommendation();
      r.next = { type: 'callback', at: r.fuAt };
      renderList();
      autoMsg = ` · נקבע פולו-אפ אוטומטי: ${r.fuAt}`;
    }
    renderDrawerTab(r);
    const cst = $('#accordion .acc-item[data-key="contact"]'); if (cst) cst.classList.add('open');
    toast('התיעוד נוסף לציר התקשורת ✓' + autoMsg);
  }));
}

/* ---- פרטים ---- */
function detailsHTML(r) {
  const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
  const rows = [
    ['סוג ישות', et.label], ['מסלול טיפול', jt.label], ['מטרה נוכחית', OBJECTIVES[r.objective] || '—'],
    ['נושא', r.subject], ['מקור', r.source], ['גורם מטפל', r.assignee],
    ['עדיפות', { high:'גבוהה', medium:'בינונית', low:'נמוכה' }[r.priority]],
    ['טלפון', r.phone], ['חברה', r.org || '—'],
  ];
  if (r.former) rows.push(['סיום שירות', r.former.endedAt], ['סיבת עזיבה', r.former.reason], ['מותר לפנות', r.former.allowContact ? 'כן' : 'לא']);
  return `<div class="kv">${rows.map(([k,v]) => `<div class="kv-row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
}
/* ---- היסטוריה (9) ---- */
function historyHTML(r) {
  return `<div class="sec-title">${ic('history')} Activity Timeline · Audit Log</div>
    <div class="timeline">${HISTORY_SAMPLE.map(h => `
      <div class="tl-item"><div class="tl-dot"></div>
        <div class="tl-body"><div class="tl-top"><b>${h.type}</b><small>${h.at}</small></div>
        <div class="tl-desc">${h.desc}</div><div class="tl-by">${ic('user')} ${h.by}</div></div>
      </div>`).join('')}</div>
    <p class="hint">${ic('alert')} אירועים מהותיים נשמרים כ-Audit Log ואינם ניתנים למחיקה (סעיף 9.3).</p>`;
}
function logHTML(r) {
  return `<div class="field"><label>הוספת תיעוד</label><textarea rows="3" placeholder="כתוב הערה / סיכום…"></textarea></div>
    <button class="btn sm primary">${ic('check')} שמור תיעוד</button>
    <div class="timeline" style="margin-top:14px">${HISTORY_SAMPLE.slice(2).map(h => `
      <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
        <div class="tl-top"><b>${h.type}</b><small>${h.at}</small></div><div class="tl-desc">${h.desc}</div></div></div>`).join('')}</div>`;
}
function closeDrawer() {
  $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
  $('#overlay').classList.remove('open'); selectedId = null; renderList();
}

/* ============================================================
   מודל תזמון חכם (10 + 12) – 3 אזורים + פתח יומן מלא
   ============================================================ */
let pendingSlot = null;
function openScheduleModal(r) {
  pendingSlot = null;
  $('#modal').style.maxWidth = '1040px';
  $('#modal').innerHTML = `
    <div class="modal-head">
      <div class="title"><span class="num">3</span> חלון תיאום – הצעת זמנים חכמה</div>
      <div style="display:flex;gap:8px">
        <button class="btn sm" id="openFullCal">${ic('calendar')} פתח יומן מלא</button>
        <button class="close-btn" id="closeModal">${ic('close')}</button>
      </div>
    </div>
    <div class="modal-body sched">
      <!-- ימין: פרטי תיאום -->
      <div class="sched-col">
        <div class="col-title">${ic('note')} פרטי התיאום</div>
        <div class="field"><label>סוג תיאום</label><select>${APPT_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label>לקוח</label><input value="${r.name}"></div>
        <div class="field"><label>גורם מטפל</label><input value="${r.assignee}"></div>
        <div class="field-row">
          <div class="field"><label>משך</label><select><option>30 דק'</option><option selected>60 דק'</option><option>90 דק'</option></select></div>
          <div class="field"><label>ערוץ</label><select><option>Google Meet</option><option>טלפון</option><option>פרונטלי</option></select></div>
        </div>
        <div class="field"><label>נושא</label><input value="${r.subject}"></div>
        <div class="field-row">
          <div class="field"><label>תזכורת לעובד</label><select><option>15 דק' לפני</option><option>שעה לפני</option></select></div>
          <div class="field"><label>תזכורת ללקוח</label><select><option>שעה לפני</option><option>יום לפני</option></select></div>
        </div>
      </div>
      <!-- מרכז: זמנים מומלצים -->
      <div class="sched-col mid">
        <div class="col-title">${ic('clock')} זמנים מומלצים <span class="muted">(מדורג לפי התאמה וצמצום פערים)</span></div>
        <div id="slotList">${SUGGESTED_SLOTS.map((s, i) => slotCard(s, i)).join('')}</div>
      </div>
      <!-- שמאל: סיכום -->
      <div class="sched-col sum">
        <div class="col-title">${ic('check')} סיכום</div>
        <div class="sum-panel" id="schedSummary">
          <div class="muted">בחר זמן מהרשימה המרכזית…</div>
        </div>
        <button class="btn primary block" id="confirmSched" disabled>${ic('check')} אשר ושלח ללקוח</button>
      </div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
  $('#openFullCal').addEventListener('click', openCalendarModal);
  $('#confirmSched').addEventListener('click', () => {
    toast(`התיאום נקבע ל-${pendingSlot.time} · סונכרן ואישור נשלח ✓`); closeModal();
  });
  $$('#slotList .slot-card').forEach(el => el.addEventListener('click', () => {
    $$('#slotList .slot-card').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
    pendingSlot = SUGGESTED_SLOTS[+el.dataset.i];
    renderSchedSummary(r); $('#confirmSched').disabled = false;
  }));
}
function slotCard(s, i) {
  return `<button class="slot-card" data-i="${i}">
    <div class="sc-top"><b>${s.time}</b><span class="score">${s.score}</span></div>
    <div class="sc-owner">${ic('user')} ${s.owner}</div>
    <div class="sc-reason">${s.reason}</div>
    <div class="sc-tags">
      ${s.fillsGap ? `<span class="tag green">${ic('check')} סוגר פער</span>` : ''}
      ${s.needsApproval ? `<span class="tag amber">${ic('alert')} דורש אישור מנהל</span>` : ''}
    </div></button>`;
}
function renderSchedSummary(r) {
  const s = pendingSlot;
  $('#schedSummary').innerHTML = `
    <div class="kv-row"><span>לקוח</span><b>${r.name}</b></div>
    <div class="kv-row"><span>סוג</span><b>פגישה</b></div>
    <div class="kv-row"><span>גורם מטפל</span><b>${s.owner}</b></div>
    <div class="kv-row"><span>זמן</span><b>${s.time}</b></div>
    <div class="kv-row"><span>ניקוד התאמה</span><b>${s.score}/100</b></div>
    <div class="kv-row"><span>סנכרון</span><b>Google Calendar</b></div>
    <div class="kv-row"><span>אישור ללקוח</span><b>WhatsApp + SMS</b></div>
    ${s.needsApproval ? `<p class="hint">${ic('alert')} שעה זו דורשת אישור מנהל.</p>` : ''}`;
}

/* ============================================================
   פאנל פולו-אפ (13) – חלונות זמן + פיזור
   ============================================================ */
const FU_DAYS = [
  { label: 'היום', date: '22/05' },
  { label: 'מחר', date: '23/05' },
  { label: 'מחרתיים', date: '24/05' },
];
const FU_QUICK = [
  { label: 'בעוד 15 דק׳', when: 'היום 15:00' },
  { label: 'בעוד 30 דק׳', when: 'היום 15:15' },
  { label: 'בעוד שעה',    when: 'היום 15:45' },
  { label: 'מאוחר היום',  when: 'היום 17:00' },
  { label: 'מחר בבוקר',   when: '23/05 09:00' },
  { label: 'מחר בצהריים', when: '23/05 13:00' },
];
let fuDay = 0;
function openFollowupPanel(r) {
  fuDay = 0;
  $('#modal').style.maxWidth = '460px'; $('#modal').style.height = '';
  renderFollowup(r);
  $('#modalWrap').classList.add('open');
}
function renderFollowup(r) {
  const day = FU_DAYS[fuDay];
  const cur = r.fuAt || null;
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">FU</span> ניהול פולו-אפ · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body fu2">
      ${cur ? `<div class="fu2-current">${ic('check')} נבחר כרגע: <b>${cur}</b> · בחירת מועד אחר תחליף אותו</div>`
            : `<div class="fu2-current none">${ic('clock')} טרם נבחר מועד · ברירת מחדל לפי ההגדרות: <b>${fuRecommendation()}</b></div>`}
      <div class="fu2-lbl">בחר יום</div>
      <div class="fu2-days">${FU_DAYS.map((d, i) => `<button class="fu2-day ${i === fuDay ? 'on' : ''}" data-fuday="${i}">
        <b>${d.label}</b><small>${d.date}/24</small></button>`).join('')}</div>

      <div class="fu2-lbl">${ic('clock')} חלונות פנויים · ${day.label} ${day.date}</div>
      <div class="fu2-wins">${FOLLOWUP_WINDOWS.map(w => {
        const booked = Math.max(0, w.booked - fuDay * 2);
        const past = fuDay === 0 && isPastToday(w.range);          // אין קביעה בהיסטוריה
        const full = booked >= w.capacity, free = w.capacity - booked;
        const label = `${day.label} ${day.date} · ${w.range}`;
        const isCur = cur === label;
        const dis = full || past;
        return `<button class="fu2-win ${dis ? 'full' : ''} ${isCur ? 'cur' : ''}" ${dis ? 'disabled' : ''} ${dis ? '' : `data-fupick="${label}"`}>
          <span class="fw-time">${w.range}</span>
          ${isCur ? `<span class="fw-cap cur">✓ נבחר</span>` : `<span class="fw-cap ${past || full ? 'full' : free <= 2 ? 'low' : ''}">${past ? 'עבר' : full ? 'מלא' : free + ' פנויים'}</span>`}
        </button>`;
      }).join('')}</div>

      <div class="fu2-lbl">${ic('bolt')} שינוי מהיר</div>
      <div class="fu2-quick">${fuQuickList().map(q => `<button class="fu2-q ${cur === q.when ? 'cur' : ''}" data-fupick="${q.when}">
        <b>${q.label}</b><small>${q.when}</small></button>`).join('')}</div>

      <p class="hint">${ic('alert')} הבחירה נשמרת מיד · מחוץ לשעות הפעילות יעבור אוטומטית לחלון הפנוי הבא.</p>
    </div>`;
  $('#closeModal').addEventListener('click', closeModal);
  $$('[data-fuday]').forEach(b => b.addEventListener('click', () => { fuDay = +b.dataset.fuday; renderFollowup(r); }));
  $$('[data-fupick]').forEach(b => b.addEventListener('click', () => pickFu(r, b.dataset.fupick)));
}
/* בחירה: אם קיים מועד קודם — שאלת אישור; אחרת שמירה מידית */
function pickFu(r, label) {
  if (r.fuAt === label) { toast('זהו המועד שכבר נבחר'); return; }
  if (r.fuAt) return renderFuConfirm(r, label);
  applyFu(r, label);
}
function renderFuConfirm(r, label) {
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">FU</span> עדכון מועד פולו-אפ</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body fu-confirm">
      <p class="wiz-q sm">האם אתה בטוח שברצונך לעדכן את המועד?</p>
      <div class="fu-diff">
        <div class="fd old"><small>המועד הקיים (יבוטל)</small><b>${r.fuAt}</b></div>
        <div class="fd new"><small>המועד החדש</small><b>${label}</b></div>
      </div>
      <div class="succ-actions">
        <button class="btn" id="fuBack">חזור</button>
        <button class="btn primary" id="fuOk">${ic('check')} אישור עדכון</button>
      </div>
    </div>`;
  $('#closeModal').addEventListener('click', () => renderFollowup(r));   // סגירה = חזרה, ללא שינוי
  $('#fuBack').addEventListener('click', () => renderFollowup(r));       // הישן נשאר
  $('#fuOk').addEventListener('click', () => applyFu(r, label, true));
}
function applyFu(r, label, replaced) {
  const old = r.fuAt;
  r.fuAt = label;
  r.next = { type: 'followup', at: label };
  renderList();
  // עדכון כפתור הפולו-אפ בטופס אם ה-Drawer פתוח
  if (selectedId === r.id && $('#drawerBody')) {
    renderDrawerTab(r);
    const cst = $('#accordion .acc-item[data-key="contact"]'); if (cst) cst.classList.add('open');
  }
  closeModal();
  toast(replaced ? `המועד עודכן: ${label} · המועד הקודם (${old}) בוטל ✓` : `פולו-אפ נקבע: ${label} ✓`);
}

/* ============================================================
   Modal: יומן מלא (11)
   ============================================================ */
function openCalendarModal() {
  const events = {
    '08:00': [{ t: 'שיחת סטטוס', s: '08:00 - 09:00', c: 'brand' }],
    '09:00': [{ t: 'ישראל כהן – פגישה', s: '09:30 - 10:00', c: 'green' }, { t: 'הדרכה', s: '09:00 - 10:30', c: 'blue' }],
    '10:00': [{ t: 'פולו אפ', s: '10:10 - 10:40', c: 'orange' }],
    '11:00': [{ t: 'ישיבת צוות', s: '11:00 - 12:00', c: 'blue' }, { t: 'שיחה עם ספק', s: '11:00 - 12:00', c: 'green' }],
    '12:00': [{ t: 'הפסקת צהריים', s: '12:00 - 13:00', c: 'brand' }],
    '13:00': [{ t: 'ביקור', s: '13:20 - 14:00', c: 'brand' }, { t: 'שיחת סקירה', s: '13:30 - 14:30', c: 'green' }],
    '14:00': [{ t: 'מיכל רוזן – תור', s: '14:00 - 14:30', c: 'orange' }],
    '15:00': [{ t: 'גבייה – רונית', s: '15:00 - 15:20', c: 'orange' }],
    '16:00': [{ t: 'פולו אפ', s: '16:00 - 17:00', c: 'brand' }],
  };
  const hours = Object.keys(events);
  $('#modal').style.maxWidth = '900px';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">4</span> יומן מלא – צפייה ובחירת זמן</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      <div class="cal-toolbar">
        <button class="btn sm">יום</button><button class="btn sm ghost">שבוע</button><button class="btn sm ghost">חודש</button>
        <div class="spacer"></div>
        <span class="muted">22 מאי 2024 · יואב כהן</span>
        <button class="btn sm">${ic('sync')} Google</button>
      </div>
      <div class="daycal">
        ${hours.map(h => `<div class="hour">${h}</div>
          <div class="track">${events[h][0] ? `<div class="cal-ev ${events[h][0].c}">${events[h][0].t}<br><small>${events[h][0].s}</small></div>` : ''}</div>
          <div class="track">${events[h][1] ? `<div class="cal-ev ${events[h][1].c}">${events[h][1].t}<br><small>${events[h][1].s}</small></div>` : ''}</div>`).join('')}
      </div>
    </div>`;
  $('#modalWrap').classList.add('open');
  $('#closeModal').addEventListener('click', closeModal);
}
function closeModal() { $('#modalWrap').classList.remove('open'); }

/* ---------------- Toolbar ---------------- */
function initToolbar() {
  $('#newRecordBtn').innerHTML = `${ic('plus')} פנייה חדשה`;
  $('#filterBtn').innerHTML = ic('filter');
  $('#newRecordBtn').addEventListener('click', openNewRecord);
  $('#filterBtn').addEventListener('click', clearAllFilters);
  $$('[data-filter]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openFilterMenu(b, b.dataset.filter); }));
}

/* ---------------- Toast ---------------- */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `${ic('check')} ${msg}`;
  $('#toastHost').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------------- גלובלי ---------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('#modalWrap').classList.contains('open')) closeModal();
    else if ($('#drawer').classList.contains('open')) closeDrawer();
  }
});

/* ---------------- Boot ---------------- */
function boot() {
  if (window.__cbBooted) return; window.__cbBooted = true;
  $('#searchIc').innerHTML = ic('search');
  $('#bellIc').innerHTML = ic('alert');
  $('#bell').addEventListener('click', () => toast('18 התראות · 3 חריגות SLA'));
  const tIc = $('#tasksIc'); if (tIc) tIc.innerHTML = ic('tasks');
  const tBtn = $('#tasksBtn'); if (tBtn) tBtn.addEventListener('click', () => openTasksDrawer());
  if (typeof updateTasksBadge === 'function') updateTasksBadge();
  renderNav(); renderTabs(); renderUnifiedView();
  if (typeof initDock === 'function') initDock();   // צ'אט מוצמד בתחתית
  $('#overlay').addEventListener('click', closeDrawer);
  $('#modalWrap').addEventListener('click', e => { if (e.target === $('#modalWrap')) closeModal(); });
}
/* רץ גם אם ה-DOM כבר נטען (בגרסה המשותפת) – setTimeout מבטיח שכל הסקריפטים כבר הוגדרו */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else setTimeout(boot, 0);
