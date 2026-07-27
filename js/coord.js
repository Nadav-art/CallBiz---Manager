/* ============================================================
   CallBiz Manager – לוח תיאום חי (Live Coordination Board)
   ממשק תיאום תוך כדי שיחה: קריטריונים דינמיים → תוצאות בזמן אמת
   ============================================================ */

/* ---- עזרי חיפוש ---- */
const cDoc    = k => COORD_DOCTORS.find(d => d.key === k);
const cBranch = k => COORD_BRANCHES.find(b => b.key === k);
const cTreat  = k => COORD_TREATMENTS.find(t => t.key === k);
const cDayLbl = date => { const d = COORD_DAYS.find(x => x.date === date); const dd = new Date(date + 'T00:00:00');
  return `${date === COORD_TODAY ? 'היום' : ''} ${HEB_DAYS_S[dd.getDay()]}׳ ${dd.getDate()}/${dd.getMonth() + 1}`.trim(); };

/* ---- מאגר משבצות דמו (דטרמיניסטי) ---- */
function coordBuildPool() {
  const pool = []; let idx = 0;
  COORD_DOCTORS.forEach((doc, di) => COORD_DAYS.forEach((day, dyi) => {
    for (let h = 8; h < 18; h++) {
      const branch = coordBranchAt(doc, h);
      if (!branch) continue;                              // הפסקה / לא נמצא בסניף באותה שעה
      // מחזוריות משמרת (שבוע כן/לא) וחלון תוקף — בשבוע שאינו פעיל אין זמינות
      if (typeof rotDocBlocked === 'function' && rotDocBlocked(doc.key, day.date, branch)) continue;
      const seed = di * 31 + dyi * 7 + h;
      if (seed % 5 === 2) continue;                       // פערים טבעיים ביומן
      const pick = COORD_TREATMENTS[seed % COORD_TREATMENTS.length];
      const tKey = doc.skills.includes(pick.key) ? pick.key : doc.skills[seed % doc.skills.length];
      const tr = cTreat(tKey);
      pool.push({ id: 'sl' + (idx++), doc: doc.key, branch: branch, date: day.date, dow: day.dow,
        h: h + ((seed % 2) ? 0.5 : 0), dur: tr.dur / 60, treatment: tKey, booked: seed % 3 === 0 });
    }
  }));
  return pool;
}
function coordPool() { return (window.__coordPool = window.__coordPool || coordBuildPool()); }

/* מועד שעבר — לא ניתן לקבוע תור לתאריך/שעה שכבר חלפו (nowHM = הזמן הנוכחי) */
function coordIsPast(s) {
  if (s.date < COORD_TODAY) return true;
  if (s.date === COORD_TODAY && s.h * 60 <= nowHM()) return true;
  return false;
}
function coordDayFullyPast(date) {
  return date < COORD_TODAY || (date === COORD_TODAY && nowHM() >= 17 * 60 + 30);
}

/* ---- מצב הלוח ---- */
let coordState = null;
let coordHostId = null;   // ברירת מחדל #viewHost; כשפתוח כשכבה — מרונדר לתוך אוברליי
function coordViewHost() { return document.getElementById(coordHostId || 'viewHost'); }
function coordInit() {
  const startDate = (COORD_DAYS.find(d => !coordDayFullyPast(d.date)) || COORD_DAYS[COORD_DAYS.length - 1]).date;
  coordState = {
    branches: new Set(COORD_BRANCHES.filter(b => b.on).map(b => b.key)),
    doctors:  new Set(COORD_DOCTORS.filter(d => d.on).map(d => d.key)),
    treatments: new Set(['consult', 'followup']),
    gender: 'any', durMin: 15, durMax: 120,
    dateFrom: '2024-05-23', dateTo: '2024-05-30',
    days: new Set([0, 1, 2, 3, 4]), hourStart: 8, hourEnd: 20,
    onlyAvailable: false, view: 'day', date: startDate, panelTab: 'lead',
    open: false,   // ברירת מחדל: תוצאות זמינות + יומן; בחירת מועד / "הוסף תיאום" פותחים פאנל
    caller: null,
    newLead: { name: '', phone: '', mail: '', org: '', entity: 'lead', journey: 'sales', source: 'קמפיין גוגל', prio: 'medium', subject: '' },
    leadSearch: '',   // חיפוש ליד/לקוח קיים למעלה בפאנל
    topSearch: '',    // חיפוש ליד/לקוח בסרגל העליון של הלוח
    mobileCal: false, // נייד: false=רשימת מועדים · true=יומן חזותי (אחד בכל פעם)
    allowDup: false,  // פנייה חדשה לאותו לקוח קיים — מדלג על חסימת כפילות
    critOpen: new Set(['branches', 'treatments']),   // קטגוריות אקורדיון פתוחות
    adv: { equip: true, eligibility: true, approval: true },   // אפשרויות מתקדמות (כמו בלידים)
    selected: null, slotLimit: 7,
    moreBranches: false, moreDocs: false, moreTreats: false,
  };
}

/* ---- כלל ההתאמה מההגדרות: סניף פעיל, תומך בטיפול, ופתוח באותו יום/שעה ---- */
function coordBranchOK(s) {
  const br = cBranch(s.branch);
  if (!br) return false;
  if (br.active === false) return false;
  if (br.treatments && !br.treatments.includes(s.treatment)) return false;
  if (br.days && !br.days.includes(s.dow)) return false;
  if (br.from != null && (s.h < br.from || s.h >= br.to)) return false;
  return true;
}
/* ---- התאמת משבצת לקריטריונים ---- */
function coordMatch(s) {
  const st = coordState, doc = cDoc(s.doc);
  if (coordIsPast(s)) return false;                // מועד שעבר אינו זמין
  if (!coordBranchOK(s)) return false;             // כלל ההתאמה מההגדרות
  if (!st.branches.has(s.branch)) return false;
  if (!st.doctors.has(s.doc)) return false;
  if (!st.treatments.has(s.treatment)) return false;
  if (st.gender !== 'any' && doc.gender !== st.gender) return false;
  if (!st.adv.approval && cTreat(s.treatment).approval) return false;
  if (!st.days.has(s.dow)) return false;
  if (s.h < st.hourStart || s.h >= st.hourEnd) return false;
  const dm = Math.round(s.dur * 60);
  if (dm < st.durMin || dm > st.durMax) return false;
  if (s.date < st.dateFrom || s.date > st.dateTo) return false;
  return true;
}
function coordAvailable() {
  return coordPool().filter(s => !s.booked && coordMatch(s))
    .sort((a, b) => a.date === b.date ? a.h - b.h : a.date.localeCompare(b.date));
}

/* ============================================================
   רינדור ראשי
   ============================================================ */
/* ימים שיש בהם חלונות פנויים (לפי הקריטריונים) — רק אותם מציגים */
function coordAvailDays(avail) {
  avail = avail || coordAvailable();
  return COORD_DAYS.filter(d => avail.some(s => s.date === d.date));
}
function renderCoordView() {
  if (!coordState) coordInit();
  const st = coordState, slots = coordAvailable();
  // לעולם לא להציג יום ללא חלונות פנויים — לקפוץ ליום הראשון שיש בו זמינות
  const availDays = coordAvailDays(slots);
  if (availDays.length && !availDays.some(d => d.date === st.date)) st.date = availDays[0].date;
  (coordViewHost() || $('#viewHost')).innerHTML = `
    <div class="coord ${st.open ? 'is-open' : ''} ${st.mobileCal ? 'm-cal' : 'm-list'}">
      ${coordTopHTML(slots)}
      <div class="coord-body">
        <div class="coord-open-col ${st.open ? 'open' : ''}">
          ${coordCriteriaHTML(slots)}
        </div>
        ${coordSlotsHTML(slots)}
        ${coordCalHTML()}
      </div>
      ${coordLegendHTML(slots)}
    </div>`;
  coordBind();
}
/* פתיחת הלוח עבור ליד/לקוח קיים — הפרטים כבר מוזנים */
function openCoordForRecord(r) {
  if (!coordState) coordInit();
  coordState.caller = r;
  coordState.open = true;
  coordState.panelTab = 'flow';   // ליד קיים → אותו מבנה כמו ה-Drawer (ציר טיפול)
  coordState.selected = null;
  const map = { sales: 'consult', support: 'followup', complaint: 'followup', retention: 'followup', upsell: 'facial' };
  coordState.treatments = new Set([map[r.journey] || 'consult']);
  // מעבר לטאב "לוח תיאום חי"
  $$('#procSeg .proc-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'coord'));
  if (typeof moveSegInd === 'function') requestAnimationFrame(moveSegInd);
  renderCoordView();
}
/* יומן מלא כשכבה נשלפת משמאל (מחשב) — לא מעביר דף, נעצר עד מסך הליד */
function openCoordOverlay(r) {
  if (!coordState) coordInit();
  coordState.caller = r; coordState.open = true; coordState.panelTab = 'flow'; coordState.selected = null;
  const map = { sales: 'consult', support: 'followup', complaint: 'followup', retention: 'followup', upsell: 'facial' };
  coordState.treatments = new Set([map[r.journey] || 'consult']);
  let ov = document.getElementById('coordOverlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'coordOverlay';
    ov.innerHTML = `<div class="co-panel"><div class="co-bar"><button class="co-close" id="coClose">${ic('chevronR')} סגור יומן</button><span class="co-title">${ic('calendar')} יומן מלא · ${esc(r.name)}</span></div><div id="coordOverlayBody"></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#coClose').addEventListener('click', closeCoordOverlay);
  } else { ov.querySelector('.co-title').innerHTML = `${ic('calendar')} יומן מלא · ${esc(r.name)}`; }
  coordHostId = 'coordOverlayBody';
  renderCoordView();
  requestAnimationFrame(() => ov.classList.add('open'));
}
function closeCoordOverlay() {
  coordHostId = null;
  const ov = document.getElementById('coordOverlay');
  if (ov) ov.classList.remove('open');
}

/* ---- סרגל עליון ---- */
function coordDateLabel() {
  const d = new Date(coordState.date + 'T00:00:00');
  if (coordState.view === 'week') {
    const days = COORD_DAYS.filter(x => x.date >= coordState.dateFrom && x.date <= coordState.dateTo);
    if (!days.length) return 'השבוע';
    const a = new Date(days[0].date + 'T00:00:00'), b = new Date(days[days.length - 1].date + 'T00:00:00');
    return `${a.getDate()} – ${b.getDate()} ${HEB_MONTHS[b.getMonth()]}`;
  }
  return `${coordState.date === COORD_TODAY ? 'היום · ' : ''}יום ${HEB_DAYS[d.getDay()]}, ${d.getDate()} ${HEB_MONTHS[d.getMonth()]}`;
}
function coordTopHTML(slots) {
  const st = coordState;
  return `<div class="coord-top">
    <div class="ct-title">${ic('clock')} <b>לוח תיאום חי</b><small>תיאום תוך כדי שיחה — התוצאות מתעדכנות מיד</small></div>
    <div class="ct-search">
      <span class="ct-search-ic">${ic('search')}</span>
      <input class="ct-search-inp" data-topsearch placeholder="חפש ליד/לקוח — שם, טלפון, איש קשר או מייל" value="${esc(st.topSearch || '')}">
      <div class="ct-search-res" id="ctSearchRes"></div>
    </div>
    <div class="ct-mobtoggle">
      <button class="seg-btn ${!st.mobileCal ? 'on' : ''}" data-cmob="list">${ic('tasks')} רשימת מועדים</button>
      <button class="seg-btn ${st.mobileCal ? 'on' : ''}" data-cmob="cal">${ic('calendar')} יומן</button>
    </div>
    <div class="ct-mid">
      <div class="seg">
        <button class="seg-btn ${st.view === 'day' ? 'on' : ''}" data-cv="day">מטפלים</button>
        <button class="seg-btn ${st.view === 'branch' ? 'on' : ''}" data-cv="branch">סניפים</button>
        <button class="seg-btn ${st.view === 'week' ? 'on' : ''}" data-cv="week">שבוע</button>
      </div>
      <div class="cal-nav">
        <button class="icon-btn" data-cnav="-1" title="הקודם">${ic('chevronR')}</button>
        <span class="cal-label">${coordDateLabel()}</span>
        <button class="icon-btn" data-cnav="1" title="הבא">${ic('chevronL')}</button>
      </div>
      <label class="ct-avail"><span>הצג רק זמינים</span>
        <button class="cswitch ${st.onlyAvailable ? 'on' : ''}" data-conly><i></i></button></label>
    </div>
    <button class="btn primary" data-cnew>${ic('plus')} הוסף תיאום</button>
  </div>`;
}

/* ---- פאנל ימני: אותו מבנה כמו חלון הליד (Drawer) — כותרת פונה + פעולות + טאבים ---- */
function coordPanelHeadHTML(slots) {
  const st = coordState, r = st.caller;
  const trBadges = [...st.treatments].map(k => { const t = cTreat(k); return `<span class="badge ${t.color}">${t.label}</span>`; }).join('');
  let head;
  if (r) {
    const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
    head = `<div class="client-head">
      ${avatar(r, 46)}
      <div class="info">
        <b>${r.name}</b><small>${esc(r.org)} ${r.org ? '·' : ''} ${esc(r.phone)}</small>
        <div class="head-badges"><span class="badge ${et.color}">${et.label}</span>
          <span class="badge ${jt.color}">${jt.label}</span>
          <span class="chip ${r.status.color} sm">${r.status.label}</span></div>
      </div>
    </div>
    <div class="head-meta">
      <span>${ic('target')} מטרה: <b>${OBJECTIVES[r.objective] || '—'}</b></span>
      <span>${ic('user')} ${esc(r.assignee)}</span>
      <span class="sla ${r.sla.color}">${ic('clock')} SLA: ${r.sla.label}</span>
    </div>`;
  } else {
    const nm = st.newLead.name;
    head = `<div class="client-head">
      <span class="cp-incoming">${ic('phone')}</span>
      <div class="info">
        <b>${esc(nm) || 'פנייה חדשה'}</b><small>${esc(st.newLead.phone) || 'הזן פרטי ליד בטאב פרטי ליד'}</small>
        <div class="head-badges"><span class="badge amber">שיחה נכנסת</span>${trBadges}</div>
      </div>
    </div>`;
  }
  const quick = r
    ? `<button class="q-btn tel" data-cq="call">${ic('phone')}<span>חיוג</span></button>
       <button class="q-btn wa" data-cq="wa">${ic('whatsapp')}<span>וואטסאפ</span></button>
       <button class="q-btn" data-cq="note">${ic('note')}<span>הערה</span></button>
       <button class="q-btn" data-cq="hist">${ic('history')}<span>היסטוריה</span></button>`
    : `<button class="q-btn tel" data-cq="call">${ic('phone')}<span>חיוג</span></button>
       <button class="q-btn wa" data-cq="wa">${ic('whatsapp')}<span>וואטסאפ</span></button>
       <button class="q-btn" data-cq="note">${ic('note')}<span>הערה</span></button>`;
  const searchBox = `<div class="cp-search">
    <span class="cp-search-ic">${ic('search')}</span>
    <input class="cp-search-inp" data-leadsearch placeholder="בחר ליד/לקוח קיים — שם, טלפון, איש קשר או מייל" value="${esc(st.leadSearch || '')}">
    <div class="cp-search-res" id="cpSearchRes"></div>
  </div>`;
  return `<div class="drawer-head cp-head">
    <div class="top"><div class="t"><span class="num">${slots.length}</span> ${r ? 'מרכז הטיפול' : 'תיאום חדש'}</div>
      <div class="cp-top-act">${r ? '' : '<span class="cp-live">● שיחה חיה</span>'}
        <button class="close-btn" data-cpanel-close title="סגור וחזרה ליומן">${ic('close')}</button></div></div>
    ${searchBox}
    ${head}
    <div class="quick cp-quick">${quick}</div>
    <div class="drawer-tabs cp-tabs">
      ${(r ? [['flow', 'ציר טיפול'], ['history', 'היסטוריה'], ['log', 'תיעוד'], ['tasks', 'משימות'], ['docs', 'מסמכים'], ['criteria', 'קריטריונים']]
           : [['lead', 'פרטי ליד'], ['criteria', 'קריטריונים']])
        .map(([k, l]) => `<button class="d-tab ${st.panelTab === k ? 'active' : ''}" data-ptab="${k}">${l}</button>`).join('')}
    </div>
  </div>`;
}
/* חיפוש ליד/לקוח קיים — לפי שם, טלפון או מייל, עם סטטוס */
function coordSearchResults(q) {
  q = (q || '').trim();
  if (q.length < 2) return '';
  const ql = q.toLowerCase(), qd = q.replace(/\D/g, '');
  const matches = RECORDS.filter(r =>
    (r.name || '').toLowerCase().includes(ql) ||
    (qd && (r.phone || '').replace(/\D/g, '').includes(qd)) ||
    (qd && (r.idnum || '').replace(/\D/g, '').includes(qd)) ||   // חיפוש לפי ת.ז
    (r.mail || '').toLowerCase().includes(ql)).slice(0, 6);
  if (!matches.length) return `<div class="cpsr-empty">${ic('alert')} לא נמצא — מלא למטה כדי לפתוח פנייה חדשה</div>`;
  return matches.map(r => { const et = ENTITY_TYPES[r.entity], open = !r.done;
    return `<div class="cpsr-item">
      <div class="cpsr-info"><b>${r.name}</b><small>${esc(r.phone)}${r.mail ? ' · ' + esc(r.mail) : ''}</small></div>
      <span class="chip ${et.color} sm">${et.label}${open ? ' · פתוח' : ''}</span>
      <div class="cpsr-act">
        <button class="btn xs primary" data-pick="${r.id}" title="תעד על הליד הקיים">פתח</button>
        <button class="btn xs" data-picknew="${r.id}" title="פנייה חדשה לאותו לקוח">חדש</button>
      </div>
    </div>`; }).join('');
}
function bindCoordSearchResults() {
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const r = RECORDS.find(x => x.id === +b.dataset.pick); if (!r) return;
    coordState.caller = r; coordState.leadSearch = ''; coordState.topSearch = ''; coordState.open = true; coordState.panelTab = 'flow';
    renderCoordView(); toast(`נטען: ${r.name} — תיעוד על הליד/לקוח הקיים`);
  }));
  $$('[data-picknew]').forEach(b => b.addEventListener('click', () => {
    const r = RECORDS.find(x => x.id === +b.dataset.picknew); if (!r) return;
    coordState.caller = null; coordState.open = true;
    coordState.newLead = { name: r.name, phone: r.phone, mail: r.mail || '', org: r.org || '', entity: r.entity, journey: 'sales', source: r.source || 'קמפיין גוגל', prio: 'medium', subject: '' };
    coordState.leadSearch = ''; coordState.topSearch = ''; coordState.panelTab = 'lead'; coordState.allowDup = true;   // פנייה חדשה מכוונת לאותו לקוח
    renderCoordView(); toast(`פנייה חדשה עבור ${r.name} — נתוני הלקוח מולאו`);
  }));
}
function coordChip(active, label, attrs) { return `<button class="cchip ${active ? 'on' : ''}" ${attrs}>${label}</button>`; }
function coordCheckSection(num, title, items, selSet, attr, moreKey, extra = '') {
  const st = coordState, expanded = st[moreKey];
  const shown = expanded ? items : items.slice(0, 4);
  const hidden = items.length - shown.length;
  return `<div class="cc-sec">
    <div class="cc-sec-h"><span class="cc-num">${num}</span>${title}</div>
    ${extra}
    <div class="cc-list">
      ${shown.map(it => `<label class="cc-row ${selSet.has(it.key) ? 'on' : ''}">
        <input type="checkbox" ${attr}="${it.key}" ${selSet.has(it.key) ? 'checked' : ''}>
        ${it.dot ? `<span class="dot ${it.dot}"></span>` : ''}
        <span class="cc-lbl">${it.label}</span>
        ${it.sub ? `<small class="cc-sub">${it.sub}</small>` : ''}
      </label>`).join('')}
    </div>
    ${hidden > 0 || expanded ? `<button class="cc-more" data-cmore="${moreKey}">${expanded ? 'הצג פחות' : `הצג עוד ${hidden}`}</button>` : ''}
  </div>`;
}
/* שורת בחירה (checkbox) בעיצוב אחיד */
function coordCheckRow(attr, key, label, selSet, sub, dot) {
  return `<label class="cc-row ${selSet.has(key) ? 'on' : ''}">
    <input type="checkbox" ${attr}="${key}" ${selSet.has(key) ? 'checked' : ''}>
    ${dot ? `<span class="dot ${dot}"></span>` : ''}
    <span class="cc-lbl">${label}</span>
    ${sub ? `<small class="cc-sub">${sub}</small>` : ''}
  </label>`;
}
/* גלילת כותרת הקטגוריה שנפתחה לראש אזור-הגלילה — כדי שיהיה מקסימום מקום לתוכן מתחת */
function scrollCritHeadTop(key) {
  const head = document.querySelector(`[data-critacc="${key}"]`);
  if (!head) return;
  let sc = head.parentElement;
  while (sc && sc !== document.body) {
    const oy = getComputedStyle(sc).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 4) break;
    sc = sc.parentElement;
  }
  if (!sc || sc === document.body) { head.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  const delta = head.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
  sc.scrollTo({ top: sc.scrollTop + delta, behavior: 'smooth' });
}
/* פריט אקורדיון קריטריון — אותו רכיב כמו ציר הטיפול בליד */
function coordCritAcc(key, icon, title, sub, bodyHTML) {
  const open = coordState.critOpen.has(key);
  return `<div class="acc-item crit-acc ${open ? 'open active' : ''}">
    <button class="acc-head" data-critacc="${key}">
      <span class="state">${ic(icon)}</span>
      <span class="label">${title}</span>
      <span class="sub">${sub}</span>
      <span class="chev">${ic('chevron')}</span>
    </button>
    <div class="acc-panel"><div class="acc-panel-inner">${bodyHTML}</div></div>
  </div>`;
}
function coordCriteriaBodyHTML() {
  const st = coordState;
  const branchBody = COORD_BRANCHES.map(b => coordCheckRow('data-cb', b.key, b.label, st.branches)).join('');
  const genderRow = `<div class="cc-gender">
    ${coordChip(st.gender === 'any', 'כל מגדר', 'data-cg="any"')}
    ${coordChip(st.gender === 'm', '♂ גבר', 'data-cg="m"')}
    ${coordChip(st.gender === 'f', '♀ אישה', 'data-cg="f"')}</div>`;
  const docBody = genderRow + COORD_DOCTORS.map(d =>
    coordCheckRow('data-cd', d.key, d.name, st.doctors, cBranch(d.branch).short + (d.gender === 'f' ? ' · ♀' : ' · ♂'))).join('');
  const treatBody = COORD_TREATMENTS.map(t =>
    coordCheckRow('data-ct', t.key, t.label + (t.approval ? ' · דורש אישור' : ''), st.treatments, '', t.color)).join('');
  const durBody = `<div class="cc-dur"><span>${st.durMin} דק׳</span><span>${st.durMax} דק׳</span></div>
    <input type="range" class="cc-range" min="15" max="120" step="15" value="${st.durMin}" data-cdur="min">
    <input type="range" class="cc-range" min="15" max="120" step="15" value="${st.durMax}" data-cdur="max">`;
  const dayBtns = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d, i) =>
    `<button class="cday ${st.days.has(i) ? 'on' : ''}" data-cday="${i}">${d}</button>`).join('');
  const dateBody = `<div class="cc-inp-row">
      <input type="date" class="cc-inp" data-cdate="from" value="${st.dateFrom}">
      <input type="date" class="cc-inp" data-cdate="to" value="${st.dateTo}">
    </div>
    <label class="lf-lbl">ימי שבוע</label>
    <div class="cc-days">${dayBtns}</div>
    <div class="cc-dur"><span>משעה</span><span>עד שעה</span></div>
    <div class="cc-inp-row">
      <input type="number" class="cc-inp" data-chour="start" min="6" max="22" value="${st.hourStart}">
      <input type="number" class="cc-inp" data-chour="end" min="6" max="23" value="${st.hourEnd}">
    </div>`;
  const advRow = (k, label, desc) => `<label class="cc-row ${st.adv[k] ? 'on' : ''}">
    <input type="checkbox" data-adv="${k}" ${st.adv[k] ? 'checked' : ''}>
    <span class="cc-lbl">${label}<small class="cc-sub2">${desc}</small></span></label>`;
  const advBody = advRow('equip', 'התאמת ציוד נדרש', 'רק מטפלים/חדרים עם הציוד לטיפול')
    + advRow('eligibility', 'בדיקת זכאות ומכסה', 'הצלבה מול זכאות הלקוח והמכסה')
    + advRow('approval', 'כולל טיפולים הדורשים אישור', 'הצג גם טיפולים המחייבים גורם מאשר');
  const branchSum = `${st.branches.size}/${COORD_BRANCHES.length} סניפים`;
  const docSum = `${st.doctors.size} נבחרו${st.gender !== 'any' ? ` · ${st.gender === 'f' ? '♀' : '♂'}` : ''}`;
  const treatSum = `${st.treatments.size} סוגים`;
  const durSum = `${st.durMin}–${st.durMax} דק׳`;
  const dateSum = `${[...st.days].length} ימים · ${st.hourStart}:00–${st.hourEnd}:00`;
  const advSum = Object.values(st.adv).filter(Boolean).length + ' פעילות';
  return `<div class="accordion crit-accordion">
    ${coordCritAcc('branches', 'org', 'סניפים', branchSum, branchBody)}
    ${coordCritAcc('doctors', 'clients', 'מטפלים (רופאים)', docSum, docBody)}
    ${coordCritAcc('treatments', 'tasks', 'סוגי טיפולים', treatSum, treatBody)}
    ${coordCritAcc('duration', 'clock', 'משך טיפול', durSum, durBody)}
    ${coordCritAcc('dates', 'calendar', 'תאריכים ושעות', dateSum, dateBody)}
    ${coordCritAcc('advanced', 'settings', 'אפשרויות מתקדמות', advSum, advBody)}
  </div>`;
}
/* טאב "מהלך התיאום" — הוורקפלואו של התיאום, מתקדם לפי המצב החי */
function coordFlowBodyHTML() {
  const st = coordState;
  const s = st.selected ? coordPool().find(x => x.id === st.selected) : null;
  const hasCaller = !!(st.caller || st.newLead.name);
  const trList = [...st.treatments].map(k => cTreat(k).label).join(', ');
  const needApproval = s ? cTreat(s.treatment).approval : [...st.treatments].some(k => cTreat(k).approval);
  const whoName = st.caller ? st.caller.name : (st.newLead.name || '');
  const steps = [
    { t: 'זיהוי הפונה', done: hasCaller, active: !hasCaller,
      desc: hasCaller ? (whoName || 'פונה מזוהה') : 'מלא שם וטלפון בטאב פרטי ליד' },
    { t: 'סוג טיפול ומטרה', done: st.treatments.size > 0, active: hasCaller && st.treatments.size === 0,
      desc: st.treatments.size ? trList : 'בחר סוג טיפול בטאב קריטריונים' },
    { t: 'בחירת מועד מתאים', done: !!s, active: hasCaller && st.treatments.size > 0 && !s,
      desc: s ? `${cDoc(s.doc).name} · ${cDayLbl(s.date)} · ${fmtH(s.h)}` : 'בחר מהתוצאות הזמינות או מהיומן' },
    { t: 'אישור וזכאות', done: !!s, active: !!s,
      desc: needApproval ? 'טיפול הדורש אישור גורם מאשר · ייבדק מול המכסה' : 'לא נדרש אישור מיוחד' },
    { t: 'קביעה ושליחת אישור', done: false, active: !!s,
      desc: s ? 'קבע את התור ושלח אישור אוטומטי ללקוח' : 'זמין לאחר בחירת מועד' },
  ];
  return `<div class="sec-title">${ic('bolt')} מהלך התיאום · מתעדכן תוך כדי</div>
    <div class="cf-flow">
      ${steps.map((st2, i) => `<div class="cf-step ${st2.done ? 'done' : st2.active ? 'active' : 'todo'}">
        <span class="cf-mark">${st2.done ? ic('check') : (i + 1)}</span>
        <div class="cf-body"><b>${st2.t}</b><small>${st2.desc}</small>
          ${i === 4 && s ? `<button class="btn sm primary" data-cbook>${ic('check')} קבע תור</button>` : ''}
        </div>
      </div>`).join('')}
    </div>`;
}
function coordHistoryBodyHTML() {
  const st = coordState, r = st.caller;
  if (!r) return `<div class="cs-empty">${ic('history')}<b>פונה חדש</b><small>אין היסטוריה — התיעוד ייווצר עם קביעת התור</small></div>`;
  const log = (typeof commLogFor === 'function' ? commLogFor(r) : []);
  if (!log.length) return `<div class="cs-empty">${ic('history')}<b>אין תיעוד קודם</b></div>`;
  return `<div class="sec-title">${ic('history')} היסטוריית אינטראקציות · ${r.name}</div>
    <div class="cf-hist">${log.map(c => { const t = COMM_TYPES[c.type] || { color: 'gray', label: c.type };
      return `<div class="cfh-row"><span class="cs-dot ${t.color}"></span>
        <div><b>${t.label}</b><small>${esc(c.text || c.desc || '')}</small></div><em>${esc(c.at || '')}</em></div>`; }).join('')}</div>`;
}
/* טאב "פרטי ליד" — נתוני הפגישה שנבחרה + טופס פרטי הליד (כמו ליד חדש) */
function coordLeadBodyHTML() {
  const st = coordState, r = st.caller;
  let meet;
  if (st.selected) {
    const s = coordPool().find(x => x.id === st.selected); const doc = cDoc(s.doc), tr = cTreat(s.treatment), br = cBranch(s.branch);
    meet = `<div class="cp-meeting">
      <div class="cpm-t">${ic('calendar')} נתוני הפגישה</div>
      <div class="cpm-main"><b>${tr.label}</b><span>${doc.name} · ${br.short}</span></div>
      <div class="cpm-when">${cDayLbl(s.date)} · ${fmtH(s.h)}–${fmtH(s.h + s.dur)} · ${Math.round(s.dur * 60)} דק׳</div>
      <button class="cpm-change" data-cchange>${ic('sync')} שנה מועד</button>
    </div>`;
  } else {
    meet = `<div class="cp-nomeet">${ic('alert')} טרם נבחר מועד — בחר מהתוצאות הזמינות, או עבור לקריטריונים כדי לצמצם</div>`;
  }
  if (r) {
    return meet + `<div class="sec-title">${ic('user')} פרטי הליד · טעונים</div>
      <div class="lf-read">
        <div><span>סוג</span><b>${ENTITY_TYPES[r.entity].label}</b></div>
        <div><span>מסלול</span><b>${JOURNEY_TYPES[r.journey].label}</b></div>
        <div><span>ארגון</span><b>${esc(r.org) || '—'}</b></div>
        <div><span>מקור</span><b>${esc(r.source) || '—'}</b></div>
        <div><span>מטרה</span><b>${OBJECTIVES[r.objective] || '—'}</b></div>
      </div>`;
  }
  /* פנייה חדשה — אותו טופס בדיוק כמו "פנייה חדשה" (leadFormFieldsHTML) */
  return meet + `<div class="sec-title">${ic('plus')} פנייה חדשה · פרטי ליד</div>
    <div class="dup-hint" id="coordDup">${ic('alert')} המערכת תבדוק כפילות לפי טלפון/מייל בעת היצירה.</div>
    ${leadFormFieldsHTML(st.newLead)}`;
}
function coordCriteriaHTML(slots) {
  const st = coordState;
  const settingsNote = `<div class="cc-settings-note">${ic('settings')} הקריטריונים, הסניפים והמטפלים נטענים ממסך ההגדרות של העסק · ההתאמה מחושבת לפי סניף, מיומנות, ציוד וזכאות</div>`;
  let body;
  if (st.panelTab === 'criteria') body = settingsNote + coordCriteriaBodyHTML();
  else if (st.caller) body = drawerTabHTML(st.caller, st.panelTab);   // ליד קיים — אותו קוד בדיוק כמו ה-Drawer
  else body = coordLeadBodyHTML();                                    // פנייה חדשה — טופס יצירה משותף
  let foot;
  if (st.panelTab === 'criteria') {
    foot = `<button class="btn primary block" data-csearch>${ic('search')} חפש / רענן תוצאות</button>
       <div class="cc-found">${ic('check')} נמצאו <b>${slots.length}</b> מועדים זמינים</div>`;
  } else if (st.caller) {   // ליד קיים — קביעת תור
    foot = st.selected ? `<button class="btn primary block" data-cbook>${ic('check')} קבע תור · שלח אישור</button>`
      : `<div class="cp-foot-hint">${ic('alert')} בחר מועד מהתוצאות הזמינות</div>`;
  } else {   // פנייה חדשה — יצירת ליד (+ קביעת תור אם נבחר מועד)
    foot = `<button class="btn primary block" data-ccreate>${ic('check')} ${st.selected ? 'צור פנייה וקבע תור' : 'צור פנייה והתחל טיפול'}</button>`;
  }
  return `<aside class="coord-criteria coord-panel">
    ${coordPanelHeadHTML(slots)}
    <div class="drawer-body cp-body">${body}</div>
    <div class="cp-foot">${foot}</div>
  </aside>`;
}
function coordConfirmHTML() {
  const s = coordPool().find(x => x.id === coordState.selected); if (!s) return '';
  const doc = cDoc(s.doc), tr = cTreat(s.treatment), br = cBranch(s.branch);
  const who = coordState.caller ? coordState.caller.name : (coordState.newLead.name || 'הפונה');
  return `<div class="cc-confirm">
    <div class="ccf-t">${ic('calendar')} אישור תיאום</div>
    <div class="ccf-line"><b>${who}</b> · ${tr.label}</div>
    <div class="ccf-line">${doc.name} · ${br.short}</div>
    <div class="ccf-line">${cDayLbl(s.date)} · ${fmtH(s.h)}–${fmtH(s.h + s.dur)}</div>
    <div class="ccf-act"><button class="btn sm primary" data-cbook>${ic('check')} קבע תור</button>
      <button class="btn sm" data-cunsel>בטל</button></div>
  </div>`;
}

/* ---- פאנל אמצעי: רשימת תוצאות זמינות ---- */
function coordSlotCardHTML(s) {
  const doc = cDoc(s.doc), tr = cTreat(s.treatment), br = cBranch(s.branch);
  return `<div class="cs-card ${coordState.selected === s.id ? 'sel' : ''}" data-slot="${s.id}">
    <div class="csc-top"><span class="csc-when">${cDayLbl(s.date)} · ${fmtH(s.h)}–${fmtH(s.h + s.dur)}</span>
      <span class="csc-tag">זמין</span></div>
    <div class="csc-doc"><b>${doc.name}</b></div>
    <div class="csc-sub"><span class="dot ${tr.color}"></span>${tr.label} · ${br.short} · ${Math.round(s.dur * 60)} דק׳</div>
    <button class="btn sm primary block" data-cselect="${s.id}">בחר מועד</button>
  </div>`;
}
function coordSlotsHTML(slots) {
  const st = coordState, shown = slots.slice(0, st.slotLimit);
  return `<section class="coord-slots">
    <div class="cs-head"><b>תוצאות זמינות (${slots.length})</b><span class="muted">מיון: הקרוב ביותר</span></div>
    <div class="cs-list">
      ${shown.length ? shown.map(coordSlotCardHTML).join('')
        : `<div class="cs-empty">${ic('filter')}<b>אין מועדים תואמים</b><small>הרחב את הקריטריונים כדי לראות תוצאות</small></div>`}
    </div>
    ${slots.length > st.slotLimit ? `<button class="cs-more" data-cslotmore>הצג עוד ${slots.length - st.slotLimit} תוצאות</button>` : ''}
  </section>`;
}

/* ---- פאנל שמאלי: יומן חזותי ---- */
function coordCalHTML() {
  const v = coordState.view;
  return `<main class="coord-cal">${v === 'week' ? coordWeekHTML() : v === 'branch' ? coordBranchHTML() : coordDayHTML()}</main>`;
}
/* ---- תצוגת סניפים: עמודה לכל סניף, מציגה מי פנוי ומתי בכל סניף ---- */
function coordBranchHTML() {
  const st = coordState;
  const branches = COORD_BRANCHES.filter(b => st.branches.has(b.key));
  if (!branches.length) return `<div class="coord-cal-empty">${ic('org')}<b>לא נבחרו סניפים</b><small>סמן סניף כדי לראות זמינות</small></div>`;
  const hours = []; for (let h = 8; h < 19; h++) hours.push(h);
  // slots per branch|hour עבור התאריך הנבחר
  const byCell = {};
  coordPool().forEach(s => { if (s.date !== st.date) return; if (!st.doctors.has(s.doc)) return;
    const k = `${s.branch}|${Math.floor(s.h)}`; (byCell[k] = byCell[k] || []).push(s); });
  return `<div class="cgrid" style="grid-template-columns:52px repeat(${branches.length}, minmax(120px,1fr))">
    <div class="cg-corner">${fmtH(st.hourStart)}</div>
    ${branches.map(b => `<div class="cg-doc"><span class="cbr-ic">${ic('org')}</span><div><b>${b.short}</b><small>${b.label}</small></div></div>`).join('')}
    ${hours.map(h => `
      <div class="cg-hour">${String(h).padStart(2, '0')}:00</div>
      ${branches.map(b => {
        const cell = (byCell[`${b.key}|${h}`] || []);
        const free = cell.filter(s => !s.booked && !coordIsPast(s) && (st.open ? coordMatch(s) : true));
        const booked = cell.filter(s => s.booked);
        if (!cell.length) return `<div class="cg-cell"><div class="cg-none"></div></div>`;
        return `<div class="cg-cell cg-multi">
          ${free.map(s => { const doc = cDoc(s.doc), tr = cTreat(s.treatment);
            return `<button class="cg-brfree ${tr.color} ${st.selected === s.id ? 'sel' : ''}" ${st.open ? `data-slot="${s.id}"` : `data-openslot="${s.id}"`}
              title="פנוי — ${doc ? doc.name : ''} · ${tr.label}"><b>${fmtH(s.h)}</b><span>${doc ? doc.name : ''}</span></button>`; }).join('')}
          ${(!st.onlyAvailable ? booked : []).map(s => { const doc = cDoc(s.doc);
            return `<div class="cg-brbusy" title="תפוס · ${doc ? doc.name : ''}"><b>${fmtH(s.h)}</b><span>${doc ? doc.name : ''}</span></div>`; }).join('')}
        </div>`;
      }).join('')}
    `).join('')}
  </div>`;
}
function coordDocAv(doc) {
  const init = doc.name.replace('ד"ר', '').trim().split(' ').map(w => w[0]).slice(0, 2).join('');
  return `<span class="cdoc-av ${doc.gender === 'f' ? 'f' : 'm'}">${init}</span>`;
}
function coordDayHTML() {
  const st = coordState;
  const docs = COORD_DOCTORS.filter(d => st.doctors.has(d.key) && st.branches.has(d.branch));
  if (!docs.length) return `<div class="coord-cal-empty">${ic('user')}<b>לא נבחרו מטפלים</b><small>סמן סניף ומטפל כדי לראות יומן</small></div>`;
  const hours = []; for (let h = 8; h < 19; h++) hours.push(h);
  const byCell = {};
  coordPool().forEach(s => { if (s.date === st.date) byCell[`${s.doc}|${Math.floor(s.h)}`] = s; });
  const pastBanner = coordDayFullyPast(st.date)
    ? `<div class="cg-pastbanner">${ic('alert')} היום כבר עבר — לא ניתן לקבוע מועדים להיום. עבור ליום הבא כדי לתאם.</div>` : '';
  return pastBanner + `<div class="cgrid" style="grid-template-columns:52px repeat(${docs.length}, minmax(104px,1fr))">
    <div class="cg-corner">${fmtH(st.hourStart)}</div>
    ${docs.map(d => `<div class="cg-doc">${coordDocAv(d)}<div><b>${d.name}</b><small>${d.sched ? 'רב-סניפי' : cBranch(d.branch).short}</small></div></div>`).join('')}
    ${hours.map(h => `
      <div class="cg-hour">${String(h).padStart(2, '0')}:00</div>
      ${docs.map(d => {
        const s = byCell[`${d.key}|${h}`];
        if (s && s.booked) {
          if (st.onlyAvailable) return `<div class="cg-cell"><div class="cg-busy" title="תפוס">תפוס</div></div>`;
          const tr = cTreat(s.treatment), br = cBranch(s.branch);
          return `<div class="cg-cell"><div class="cg-ev ${tr.color}" title="${tr.label} · ${br ? br.short : ''}"><b>${fmtH(s.h)}</b>${tr.label}<i class="cg-br">${br ? br.short : ''}</i></div></div>`;
        }
        if (s && !s.booked) {
          const tr = cTreat(s.treatment), br = cBranch(s.branch);
          if (coordIsPast(s)) {   // הזמן עבר — לא ניתן לקבוע
            return `<div class="cg-cell"><div class="cg-past" title="הזמן עבר — לא ניתן לקבוע תור">${fmtH(s.h)}</div></div>`;
          }
          if (!st.open) {   // תצוגת יומן כללית — כל המשבצות הפנויות, לחיצה פותחת "הוסף תיאום"
            return `<div class="cg-cell"><button class="cg-free overview" data-openslot="${s.id}"
              title="פנוי — ${br ? br.short : ''} · לחץ להוספת תיאום">${ic('plus')}<span>${fmtH(s.h)}</span><i class="cg-br">${br ? br.short : ''}</i></button></div>`;
          }
          if (coordMatch(s)) return `<div class="cg-cell"><button class="cg-free ${tr.color} ${st.selected === s.id ? 'sel' : ''}" data-slot="${s.id}"
            title="פנוי — ${tr.label} · ${br ? br.short : ''}">${ic('plus')}<span>${fmtH(s.h)}</span><i class="cg-br">${br ? br.short : ''}</i></button></div>`;
        }
        return `<div class="cg-cell"><div class="cg-none"></div></div>`;
      }).join('')}
    `).join('')}
  </div>`;
}
function coordVisibleSlots() {
  const st = coordState;
  if (st.open) return coordAvailable();
  return coordPool().filter(s => !s.booked && !coordIsPast(s) && coordBranchOK(s) && st.doctors.has(s.doc) && st.branches.has(s.branch)
    && st.days.has(s.dow) && s.date >= st.dateFrom && s.date <= st.dateTo)
    .sort((a, b) => a.date === b.date ? a.h - b.h : a.date.localeCompare(b.date));
}
function coordWeekHTML() {
  const st = coordState;
  const avail = coordVisibleSlots();
  // רק ימים שיש בהם חלונות פנויים
  const days = COORD_DAYS.filter(d => d.date >= st.dateFrom && d.date <= st.dateTo && st.days.has(d.dow) && avail.some(s => s.date === d.date));
  if (!days.length) return `<div class="coord-cal-empty">${ic('calendar')}<b>אין ימים עם חלונות פנויים</b><small>הרחב את הקריטריונים או הטווח</small></div>`;
  return `<div class="cweek" style="grid-template-columns:repeat(${days.length}, minmax(150px,1fr))">
    ${days.map(day => {
      const list = avail.filter(s => s.date === day.date);
      const d = new Date(day.date + 'T00:00:00');
      return `<div class="cwk-col">
        <div class="cwk-head ${day.date === COORD_TODAY ? 'today' : ''}">${HEB_DAYS[d.getDay()]}<small>${d.getDate()}/${d.getMonth() + 1}</small>
          <span class="cwk-cnt">${list.length}</span></div>
        <div class="cwk-list">
          ${list.length ? list.map(s => { const tr = cTreat(s.treatment), doc = cDoc(s.doc), br = cBranch(s.branch);
            return `<button class="cwk-slot ${st.selected === s.id ? 'sel' : ''}" ${st.open ? `data-slot="${s.id}"` : `data-openslot="${s.id}"`}>
              <span class="dot ${tr.color}"></span><b>${fmtH(s.h)}</b>
              <small>${doc.name}</small><em class="cwk-br">${br ? br.short : ''}</em></button>`; }).join('')
            : `<div class="cwk-empty">אין פנוי</div>`}
        </div></div>`;
    }).join('')}
  </div>`;
}
function coordLegendHTML() {
  return `<div class="coord-legend">
    ${COORD_TREATMENTS.map(t => `<span class="cl-item"><span class="dot ${t.color}"></span>${t.label}</span>`).join('')}
    <span class="cl-sep"></span>
    <span class="cl-item"><span class="cg-busy sm">תפוס</span> מועד שנתפס</span>
    <span class="cl-item">${ic('plus')} מועד פנוי — לחיצה מתאמת</span>
  </div>`;
}

/* ============================================================
   חיווט
   ============================================================ */
function coordSelect(id) {
  const wasOpen = coordState.open;
  coordState.selected = id;
  coordState.open = true;
  if (!wasOpen) {
    // הפאנל היה סגור (נסגר ב-X) → פתיחת ליד חדש ישירות, בלי לשייך לליד הקודם
    coordState.caller = null; coordState.leadSearch = ''; coordState.allowDup = false; coordState.panelTab = 'lead';
    coordState.newLead = { name: '', phone: '', idnum: '', mail: '', org: '', entity: 'lead', journey: 'sales', source: 'קמפיין גוגל', prio: 'medium', subject: '' };
  } else if (!coordState.caller) {
    coordState.panelTab = 'lead';
  }
  renderCoordView();
}
function coordBook() {
  const s = coordPool().find(x => x.id === coordState.selected); if (!s) return;
  if (coordIsPast(s)) { toast('לא ניתן לקבוע תור למועד שכבר עבר'); coordState.selected = null; renderCoordView(); return; }
  const r = coordState.caller;
  if (r) return coordAskBook(r, s);   // ליד פתוח — אישור: החלפה אם יש תור, אחרת קביעה
  doCoordBook(s, false);
}
function doCoordBook(s, replaced) {
  const st = coordState, r = st.caller, doc = cDoc(s.doc), tr = cTreat(s.treatment);
  const who = r ? r.name : (st.newLead.name || 'הפונה');
  if (r && r.coordSlotId) { const old = coordPool().find(x => x.id === r.coordSlotId); if (old) old.booked = false; }   // שחרור התור הישן חזרה ליומן
  s.booked = true;
  if (r) {
    r.meeting = { date: cDayLbl(s.date), time: fmtH(s.h), dur: Math.round(s.dur * 60), channel: cBranch(s.branch).short, with: doc.name };
    r.coordSlotId = s.id;   // עדכון התור החדש בתוך הליד
  }
  st.selected = null; st.open = false;
  renderCoordView();
  toast(replaced
    ? `התור הוחלף: ${who} · ${doc.name} · ${fmtH(s.h)} ✓ התור הישן שוחרר ליומן, אישור חדש נשלח`
    : `התור נקבע: ${who} · ${tr.label} · ${doc.name} · ${fmtH(s.h)} ✓ אישור נשלח`);
}
function closeCoordConfirm() { $('#cpConfirm')?.remove(); }
function coordAskBook(r, s) {
  closeCoordConfirm();
  const m = r.meeting, hasMeeting = !!m;
  const newWhen = `<b>${cDayLbl(s.date)} · ${fmtH(s.h)}</b> עם ${cDoc(s.doc).name}`;
  const pop = document.createElement('div');
  pop.className = 'cp-confirm-wrap'; pop.id = 'cpConfirm';
  pop.innerHTML = `<div class="cp-confirm-box">
    <div class="cpc-t">${ic(hasMeeting ? 'alert' : 'calendar')} ${hasMeeting ? `כבר קיים תור ל${r.name}` : `קביעת תור ל${r.name}`}</div>
    <div class="cpc-body">${hasMeeting
      ? `התור הקיים: <b>${esc(m.date)} · ${esc(m.time)}</b>${m.with ? ' עם ' + esc(m.with) : ''}.<br>להחליף אותו במועד החדש — ${newWhen}? התור הישן ישוחרר חזרה ליומן.`
      : `לקבוע ל${r.name} תור חדש — ${newWhen}?`}</div>
    <div class="cpc-act"><button class="btn primary" data-cpc-yes>${ic('check')} ${hasMeeting ? 'כן, החלף תור' : 'כן, קבע תור'}</button>
      <button class="btn" data-cpc-no>ביטול</button></div>
  </div>`;
  document.body.appendChild(pop);
  pop.querySelector('[data-cpc-yes]').addEventListener('click', () => { closeCoordConfirm(); doCoordBook(s, hasMeeting); });
  pop.querySelector('[data-cpc-no]').addEventListener('click', closeCoordConfirm);
  pop.addEventListener('click', e => { if (e.target === pop) closeCoordConfirm(); });
}
/* פנייה חדשה מתוך לוח התיאום — אותו תהליך של יצירת ליד (+ קביעת תור אם נבחר מועד) */
function coordCreateAndBook() {
  const st = coordState;
  const v = readLeadForm($('.coord-panel'));
  if (!v.name || !v.phone) { toast('נא למלא שם וטלפון בטאב פרטי ליד'); st.panelTab = 'lead'; renderCoordView(); return; }
  const dup = st.allowDup ? null : findLeadDup(v.phone);   // "חדש לאותו לקוח" — מותר ליצור פנייה נוספת
  if (dup) {
    const d = $('#coordDup');
    if (d) { d.className = 'dup-hint warn';
      d.innerHTML = `${ic('alert')} קיימת כבר רשומה עם טלפון זה: <b>${dup.name}</b>. <button class="btn sm" data-coorddup>פתח קיימת</button>`;
      const b = $('[data-coorddup]'); if (b) b.addEventListener('click', () => { st.caller = dup; st.panelTab = 'flow'; renderCoordView(); }); }
    return;
  }
  const rec = buildLeadRecord(v);
  RECORDS.unshift(rec);
  if (typeof autoFireTrigger === 'function') autoFireTrigger('בעת יצירת ליד', { rec: RECORDS[0] });
  let msg = `נוצרה פנייה: ${rec.name}`;
  const s = st.selected ? coordPool().find(x => x.id === st.selected) : null;
  if (s && !coordIsPast(s)) {
    s.booked = true;
    rec.meeting = { date: cDayLbl(s.date), time: fmtH(s.h), dur: Math.round(s.dur * 60), channel: cBranch(s.branch).short, with: cDoc(s.doc).name };
    msg += ` · נקבע תור ${fmtH(s.h)} עם ${cDoc(s.doc).name}`;
  }
  // נשאר inline בתוך היומן — הליד החדש נטען לאותו פאנל (בלי overlay מחשיך)
  st.caller = rec; st.selected = null; st.panelTab = 'flow'; st.leadSearch = ''; st.allowDup = false;
  st.newLead = { name: '', phone: '', mail: '', org: '', entity: 'lead', journey: 'sales', source: 'קמפיין גוגל', prio: 'medium', subject: '' };
  if (typeof renderList === 'function' && $('#listBody')) { renderSummary(); renderList(); }
  renderCoordView();
  toast(msg + ' ✓');
}
function coordBind() {
  const st = coordState;
  // ליד קיים — ציר הטיפול הוא אותו קוד כמו ה-Drawer, מחייב את אותה קשירת אירועים
  if (st.caller && st.panelTab === 'flow' && typeof bindFlow === 'function') { try { bindFlow(st.caller); } catch (e) {} }
  // תצוגה / ניווט
  $$('[data-cv]').forEach(b => b.addEventListener('click', () => { st.view = b.dataset.cv; renderCoordView(); }));
  $$('[data-cmob]').forEach(b => b.addEventListener('click', () => { st.mobileCal = b.dataset.cmob === 'cal'; renderCoordView(); }));
  $$('[data-cnav]').forEach(b => b.addEventListener('click', () => {
    const days = coordAvailDays(); if (!days.length) return;   // רק ימים עם חלונות פנויים
    const dir = +b.dataset.cnav, i = days.findIndex(d => d.date === st.date);
    const ni = Math.max(0, Math.min(days.length - 1, (i < 0 ? 0 : i) + dir));
    st.date = days[ni].date; renderCoordView();
  }));
  const only = $('[data-conly]'); if (only) only.addEventListener('click', () => { st.onlyAvailable = !st.onlyAvailable; renderCoordView(); });
  // "הוסף תיאום" — אותו טופס/פקודות כמו "פנייה חדשה", אבל בתוך היומן נפתח inline (דוחף את התורים הצידה, לא overlay מחשיך)
  const nw = $('[data-cnew]'); if (nw) nw.addEventListener('click', () => {
    st.open = true; st.caller = null; st.selected = null; st.panelTab = 'lead'; st.leadSearch = ''; st.allowDup = false;
    st.newLead = { name: '', phone: '', mail: '', org: '', entity: 'lead', journey: 'sales', source: 'קמפיין גוגל', prio: 'medium', subject: '' };
    renderCoordView();
  });
  // חיפוש ליד/לקוח קיים למעלה בפאנל
  const sInp = $('[data-leadsearch]');
  if (sInp) {
    const populate = () => { const res = $('#cpSearchRes'); if (res) { res.innerHTML = coordSearchResults(sInp.value); bindCoordSearchResults(); } };
    sInp.addEventListener('input', () => { st.leadSearch = sInp.value; populate(); });
    if (st.leadSearch) populate();
  }
  // חיפוש בסרגל העליון של הלוח — שיוך ישיר לליד/לקוח
  const tInp = $('[data-topsearch]');
  if (tInp) {
    const populateTop = () => { const res = $('#ctSearchRes'); if (res) { res.innerHTML = coordSearchResults(tInp.value); bindCoordSearchResults(); } };
    tInp.addEventListener('input', () => { st.topSearch = tInp.value; populateTop(); });
    if (st.topSearch) populateTop();
  }
  const pc = $('[data-cpanel-close]'); if (pc) pc.addEventListener('click', () => { st.open = false; renderCoordView(); });
  $$('[data-openslot]').forEach(b => b.addEventListener('click', () => coordSelect(b.dataset.openslot)));
  // טופס פרטי ליד — אותו טופס כמו "פנייה חדשה" (שמירה למצב בלי רינדור מחדש כדי לא לאבד פוקוס)
  $$('.coord-panel [data-nl]').forEach(el => el.addEventListener('input', () => { st.newLead[el.dataset.nl] = el.value; }));
  $$('.coord-panel [data-nl]').forEach(el => el.addEventListener('change', () => { st.newLead[el.dataset.nl] = el.value; }));
  const create = $('[data-ccreate]'); if (create) create.addEventListener('click', coordCreateAndBook);
  const chg = $('[data-cchange]'); if (chg) chg.addEventListener('click', () => { st.selected = null; renderCoordView(); });
  // טאבים בפאנל (מבנה כמו חלון הליד)
  $$('[data-ptab]').forEach(b => b.addEventListener('click', () => { st.panelTab = b.dataset.ptab; renderCoordView(); }));
  // פעולות מהירות בזמן שיחה
  $$('[data-cq]').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.cq, who = st.caller ? st.caller.name : (st.newLead.name || 'הפונה');
    if (q === 'call') dialTel(st.caller ? st.caller.phone : st.newLead.phone, who);
    if (q === 'wa')   toast(`נפתחת שיחת וואטסאפ עם ${who}`);
    if (q === 'note') toast('נפתחה הערה לתיאום');
    if (q === 'hist') { st.panelTab = 'history'; renderCoordView(); }
  }));
  // אקורדיון קריטריונים — בנייד: פתיחה סוגרת את השאר וממקמת את הכותרת גבוה (לא קופץ למעלה)
  $$('[data-critacc]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.critacc;
    const mobile = document.documentElement.classList.contains('cb-mobile');
    const wasOpen = st.critOpen.has(k);
    if (mobile) { st.critOpen.clear(); if (!wasOpen) st.critOpen.add(k); }
    else { wasOpen ? st.critOpen.delete(k) : st.critOpen.add(k); }
    renderCoordView();
    if (mobile && !wasOpen) requestAnimationFrame(() => scrollCritHeadTop(k));
  }));
  $$('[data-adv]').forEach(c => c.addEventListener('change', () => { st.adv[c.dataset.adv] = c.checked; renderCoordView(); }));
  // קריטריונים
  const toggle = (set, k) => { set.has(k) ? set.delete(k) : set.add(k); renderCoordView(); };
  $$('[data-cb]').forEach(c => c.addEventListener('change', () => toggle(st.branches, c.dataset.cb)));
  $$('[data-cd]').forEach(c => c.addEventListener('change', () => toggle(st.doctors, c.dataset.cd)));
  $$('[data-ct]').forEach(c => c.addEventListener('change', () => toggle(st.treatments, c.dataset.ct)));
  $$('[data-cg]').forEach(b => b.addEventListener('click', () => { st.gender = b.dataset.cg; renderCoordView(); }));
  $$('[data-cmore]').forEach(b => b.addEventListener('click', () => { st[b.dataset.cmore] = !st[b.dataset.cmore]; renderCoordView(); }));
  $$('[data-cday]').forEach(b => b.addEventListener('click', () => toggle(st.days, +b.dataset.cday)));
  $$('[data-cdur]').forEach(r => r.addEventListener('input', () => {
    const v = +r.value;
    if (r.dataset.cdur === 'min') st.durMin = Math.min(v, st.durMax); else st.durMax = Math.max(v, st.durMin);
    renderCoordView();
  }));
  $$('[data-cdate]').forEach(d => d.addEventListener('change', () => { st[d.dataset.cdate === 'from' ? 'dateFrom' : 'dateTo'] = d.value; renderCoordView(); }));
  $$('[data-chour]').forEach(n => n.addEventListener('change', () => { st[n.dataset.chour === 'start' ? 'hourStart' : 'hourEnd'] = +n.value; renderCoordView(); }));
  const search = $('[data-csearch]'); if (search) search.addEventListener('click', () => { renderCoordView(); toast(`${coordAvailable().length} מועדים זמינים תואמים לקריטריונים`); });
  // בחירת מועד
  $$('[data-cselect]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); coordSelect(b.dataset.cselect); }));
  $$('[data-slot]').forEach(el => el.addEventListener('click', () => coordSelect(el.dataset.slot)));
  const slotMore = $('[data-cslotmore]'); if (slotMore) slotMore.addEventListener('click', () => { st.slotLimit += 8; renderCoordView(); });
  // אישור
  const book = $('[data-cbook]'); if (book) book.addEventListener('click', coordBook);
  const unsel = $('[data-cunsel]'); if (unsel) unsel.addEventListener('click', () => { st.selected = null; renderCoordView(); });
}
