/* ============================================================
   CallBiz Manager – לוגיקת אפליקציה
   מסך אחוד: סיכום + רשימה + Drawer(טאבים+workflow) + תזמון + Work Queue
   ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = (n) => ICONS[n] || '';
const esc = (s) => (s == null ? '' : String(s));
/* חיוג: בנייד/מגע פותח את חייגן הטלפון (tel:) עד לחיבור Click2Call של המרכזייה; בדסקטופ טוסט */
function dialTel(phone, name) {
  const p = (phone || '').replace(/[^\d+]/g, '');
  const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || document.documentElement.classList.contains('cb-mobile');
  if (touch && p) { window.location.href = 'tel:' + p; return; }
  toast(`מחייג ל${name || ''}${p ? ' · ' + p : ''}… (יחובר ל-Click2Call של המרכזייה)`);
}

let selectedId = null;
let activeTab  = 'flow';
let activeFilter = null;
let listFilters = { status: null, journey: null, assignee: null };

/* ---------------- חיפוש גלובלי — לפי הקשר הטאב + מתג "חיפוש חכם" (כל המערכת) ---------------- */
let smartSearch = false;
function searchPlaceholder() {
  if (smartSearch) return 'חיפוש חכם — בכל המערכת…';
  const m = { meetings: 'חיפוש אירוע ביומן — פנייה / שם / סוג…', clients: 'חיפוש לקוח…', calls: 'חיפוש שיחה…', mail: 'חיפוש דוא"ל…', docs: 'חיפוש מסמך…',
    automation: 'חיפוש אוטומציה — שם / טריגר / תיאור…' };
  return m[navActive] || 'חיפוש ליד / לקוח / טלפון…';
}
function runGlobalSearch(q) {
  q = q.toLowerCase(); const res = [];
  const leads = smartSearch || ['home', 'leads', 'calls', 'mail', 'docs'].includes(navActive);
  const clients = smartSearch || navActive === 'clients';
  const events = smartSearch || navActive === 'meetings';
  if (leads || clients) RECORDS.forEach(r => {
    if (clients && !leads && !isClient(r)) return;
    if ((r.name + ' ' + (r.org || '') + ' ' + (r.phone || '') + ' ' + (r.subject || '')).toLowerCase().includes(q))
      res.push({ type: (clients && !leads) ? 'לקוח' : 'ליד', label: r.name, sub: r.org || r.phone || '', recId: r.id });
  });
  // אוטומציות — בטאב האוטומציות תמיד, ובחיפוש חכם מכל מקום
  if ((smartSearch || navActive === 'automation') && typeof autoAll === 'function') autoAll().forEach(a => {
    const d = (typeof autoDef === 'function' ? autoDef(a.key) : null) || a;
    const hay = (a.title + ' ' + a.trigger + ' ' + (d.what || a.desc || '')).toLowerCase();
    if (hay.includes(q)) res.push({ type: 'אוטומציה', label: a.title,
      sub: a.trigger + ' · ' + (autoIsOn(a.key) ? 'פעיל' : 'כבוי'), autoKey: a.key });
  });
  if (events && typeof CAL_EVENTS !== 'undefined') Object.keys(CAL_EVENTS).forEach(o => (CAL_EVENTS[o] || []).forEach(e => {
    if ((e.t + ' ' + o).toLowerCase().includes(q)) res.push({ type: 'אירוע', label: e.t, sub: o + ' · ' + (typeof fmtH === 'function' ? fmtH(e.h) : e.h), recId: e.recId });
  }));
  // חיפוש חכם = כל המערכת: שירותים · סניפים · עובדים · תבניות חוזה · תנאים קבועים · קריטריונים
  if (smartSearch) runGlobalSearchWide(q, res);
  return res.slice(0, 24);
}
/* שאר היישויות — כל תוצאה יודעת לאיזה מסך לקפוץ */
function runGlobalSearchWide(q, res) {
  const hit = t => String(t || '').toLowerCase().includes(q);
  if (typeof COORD_TREATMENTS !== 'undefined') COORD_TREATMENTS.forEach(t => {
    if (hit(t.label) || hit(t.kind) || hit(t.pre) || hit(t.instr))
      res.push({ type: 'שירות', label: t.label, goto: 'catalog',
        sub: [t.kind, (t.dur || 0) + ' דק׳', t.price ? t.price + ' ₪' : ''].filter(Boolean).join(' · ') });
  });
  if (typeof COORD_BRANCHES !== 'undefined') COORD_BRANCHES.forEach(b => {
    if (hit(b.label) || hit(b.short) || hit(b.city) || hit(b.street))
      res.push({ type: 'סניף', label: b.short || b.label, goto: 'branches',
        sub: [b.street, b.num, b.city].filter(Boolean).join(' ') });
  });
  if (typeof STAFF !== 'undefined') STAFF.forEach(st => {
    if (hit(st.name) || hit(st.role) || hit(st.perm) || hit(st.dept))
      res.push({ type: 'עובד', label: st.name, goto: 'staff', entId: st.id,
        sub: [st.role, st.dept].filter(Boolean).join(' · ') });
  });
  if (typeof CONTRACT_TEMPLATES !== 'undefined') CONTRACT_TEMPLATES.forEach(c => {
    if (hit(c.name) || hit(c.type) || hit(c.text))
      res.push({ type: 'תבנית חוזה', label: c.name, goto: 'contract', entId: c.id,
        sub: c.type + (c.legalApproved ? ' · אושר משפטית' : ' · טרם אושר') });
  });
  if (typeof CT_SVC_TERMS !== 'undefined') CT_SVC_TERMS.forEach(t => {
    if (hit(t.title) || hit(t.text))
      res.push({ type: 'תנאי בהסכם', label: t.title, goto: 'terms',
        sub: (t.locked !== false ? 'קבוע · ' : 'ניתן לשינוי · ') + (typeof ctTermScope === 'function' ? ctTermScope(t).svc : '') });
  });
  if (typeof needsAllDefs === 'function') needsAllDefs().forEach(d => {
    if (hit(d.label) || hit(d.detail))
      res.push({ type: 'קריטריון', label: d.label, goto: 'criteria',
        sub: (d.values || []).slice(0, 3).join(' · ') || (d.detail || '') });
  });
}
function closeSearchResults() { $('#globalSearchRes')?.remove(); }
function showSearchResults(inp) {
  closeSearchResults();
  const q = inp.value.trim(); if (q.length < 2) return;
  const res = runGlobalSearch(q);
  const pop = document.createElement('div'); pop.id = 'globalSearchRes'; pop.className = 'meet-search-res';
  pop.innerHTML = res.length ? res.map(e => `<button class="msr-item" ${e.autoKey ? `data-gsa="${esc(e.autoKey)}"`
      : e.goto ? `data-gsgo="${esc(e.goto)}" data-gsid="${esc(String(e.entId == null ? '' : e.entId))}"` : `data-gsr="${e.recId || ''}"`}>
      <span class="msr-badge">${e.type}</span><span class="msr-body"><b>${esc(e.label)}</b><small>${esc(e.sub)}</small></span>${(e.recId || e.autoKey) ? ic('chevronL') : ''}</button>`).join('')
    : `<div class="msr-empty">לא נמצאו תוצאות${smartSearch ? '' : ' · נסה "חיפוש חכם" לכל המערכת'}</div>`;
  const r = inp.getBoundingClientRect(); pop.style.top = (r.bottom + 4) + 'px'; pop.style.right = '10px'; pop.style.left = '10px';
  document.body.appendChild(pop);
  $$('[data-gsr]', pop).forEach(b => b.addEventListener('click', () => {
    const id = +b.dataset.gsr; closeSearchResults(); inp.blur();
    const rec = RECORDS.find(x => x.id === id); if (rec) openDrawer(rec);
  }));
  // תוצאת אוטומציה → מעבר לטאב האוטומציות ופתיחת החוק
  $$('[data-gsa]', pop).forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.gsa; closeSearchResults(); inp.blur();
    if (navActive !== 'automation' && typeof go === 'function') go('automation');
    else if (typeof renderAutomationsScreen === 'function') renderAutomationsScreen();
    setTimeout(() => { if (typeof openAutoInfo === 'function') openAutoInfo(k); }, 60);
  }));
  // תוצאה מכל יישות אחרת → קפיצה למסך שבו מנהלים אותה
  $$('[data-gsgo]', pop).forEach(b => b.addEventListener('click', () => {
    const where = b.dataset.gsgo, id = b.dataset.gsid; closeSearchResults(); inp.blur();
    gotoEntity(where, id);
  }));
}
/* יעד לכל סוג יישות — מקום ניהול אחד לכל דבר, בלי כפילות */
function gotoEntity(where, id) {
  if (where === 'contract' || where === 'terms') {
    navActive = 'contracts';
    if (typeof renderNav === 'function') renderNav();
    if (typeof renderContractsView === 'function') renderContractsView();
    setTimeout(() => {
      if (where === 'terms') { if (typeof openSvcTermsPanel === 'function') openSvcTermsPanel(); }
      else if (id && typeof openContractEditor === 'function') openContractEditor(id);
    }, 60);
    return;
  }
  navActive = 'settings';
  const mode = where === 'catalog' ? 'catalog' : where === 'branches' ? 'branches'
    : where === 'staff' ? 'mgr' : 'perms';
  if (typeof applySetMode === 'function') applySetMode(mode);
  if (where === 'criteria' && typeof mgrSec !== 'undefined') mgrSec = 'criteria';
  if (where === 'staff' && id && typeof mgrEmpOpen !== 'undefined') mgrEmpOpen = isNaN(+id) ? id : +id;
  if (typeof renderNav === 'function') renderNav();
  if (typeof renderSettingsView === 'function') renderSettingsView();
}
let searchSubmitted = false;
function outsideSearchClose(e) { if (!e.target.closest('#globalSearchRes') && !e.target.closest('.search')) { closeSearchResults(); document.removeEventListener('click', outsideSearchClose); } }
function bindGlobalSearch() {
  const inp = document.querySelector('.topbar .search input'); if (!inp) return;
  inp.addEventListener('input', () => {
    showSearchResults(inp);
    // בטאב האוטומציות — החיפוש העליון מסנן גם את הרשימה עצמה (מקום אחד לחיפוש)
    if (navActive === 'automation' && typeof autoSearch !== 'undefined') {
      autoSearch = inp.value.trim();
      if (typeof renderAutomationsScreen === 'function' && document.querySelector('.auto-cols')) renderAutomationsScreen();
    }
  });
  // אנטר = שליחה: מציג תוצאות, מחזיר את הבר לגודלו (blur) ומשאיר את התוצאות עד לחיצה מחוץ
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchSubmitted = true; showSearchResults(inp); inp.blur(); } });
  inp.addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement === inp) return;   // חזר לפוקוס (למשל אחרי מתג חכם) — לא לסגור
    if (searchSubmitted) { searchSubmitted = false; setTimeout(() => document.addEventListener('click', outsideSearchClose), 0); }
    else closeSearchResults();
  }, 200));
  // גלילה מבטלת את מצב החיפוש הפרוס — אין סיבה שהאנימציה תישאר פעילה בזמן גלילה
  document.addEventListener('scroll', () => { if (document.activeElement === inp) { inp.blur(); closeSearchResults(); } }, true);
  const st = $('#smartToggle');
  if (st) {
    st.innerHTML = ic('bolt');
    st.addEventListener('pointerdown', e => e.preventDefault());   // שומר את הפוקוס בשדה — נכנסים/יוצאים ממצב חכם בלי לצאת מהאנימציה
    st.addEventListener('click', () => {
      smartSearch = !smartSearch; st.classList.toggle('on', smartSearch); st.setAttribute('aria-pressed', smartSearch);
      inp.setAttribute('placeholder', searchPlaceholder());
      if (inp.value.trim().length >= 2) showSearchResults(inp);
      inp.focus();   // להישאר בתוך האנימציה
      toast(smartSearch ? 'חיפוש חכם: בכל המערכת ✓' : 'חיפוש: בטאב הנוכחי בלבד');
    });
  }
}

/* ---------------- שלד ---------------- */
let navActive = 'home';          // ברירת מחדל: טאב "ראשי" (תואם למסך המוצג)
let navManageOpen = false;

/* ---- עמוד פתיחה: נשמר לכל משתמש/דפדפן; לחיצה ארוכה על טאב בנייד קובעת אותו ---- */
function getHomeNav() { try { return localStorage.getItem('cb_homeNav_' + CURRENT_USER) || null; } catch (e) { return null; } }
function setHomeNav(k) { try { k ? localStorage.setItem('cb_homeNav_' + CURRENT_USER, k) : localStorage.removeItem('cb_homeNav_' + CURRENT_USER); } catch (e) {} }
function closeNavHomeMenu() { $('#navHomeMenu')?.remove(); document.removeEventListener('click', navHomeOutside); }
function navHomeOutside(e) { if (!e.target.closest('#navHomeMenu')) closeNavHomeMenu(); }
function openNavHomeMenu(e, key, label) {
  e.preventDefault(); closeNavHomeMenu();
  const isHome = getHomeNav() === key;
  const pop = document.createElement('div'); pop.className = 'nav-home-menu'; pop.id = 'navHomeMenu';
  pop.innerHTML = `<div class="nhm-title">${ic('home')} ${esc(label)}</div>
    <button class="nhm-item" data-nhm="${isHome ? 'unset' : 'set'}">${isHome ? ic('close') + ' בטל עמוד פתיחה' : ic('check') + ' קבע כעמוד פתיחה'}</button>`;
  document.body.appendChild(pop);
  const x = e.clientX || window.innerWidth / 2, y = e.clientY || window.innerHeight;
  pop.style.left = Math.max(8, Math.min(x - pop.offsetWidth / 2, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = Math.max(8, y - pop.offsetHeight - 14) + 'px';   // מעל האצבע (הבר בתחתית)
  pop.querySelector('[data-nhm]').addEventListener('click', () => {
    const set = pop.querySelector('[data-nhm]').dataset.nhm === 'set';
    setHomeNav(set ? key : null); closeNavHomeMenu(); renderNav();
    toast(set ? `"${label}" נקבע כעמוד הפתיחה · ייפתח ראשון בכניסה ✓` : 'עמוד הפתיחה בוטל');
  });
  setTimeout(() => document.addEventListener('click', navHomeOutside), 0);
}
/* איפוס הגלילה בכל המיכלים שגוללים במערכת */
function scrollTopAll() {
  try {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    ['.workspace', '#viewHost', '.main', 'body'].forEach(sel => {
      const e = document.querySelector(sel); if (e) e.scrollTop = 0; });
  } catch (e) {}
}
function renderNav() {
  const mobile = document.documentElement.classList.contains('cb-mobile');
  document.documentElement.classList.toggle('screen-meetings', navActive === 'meetings');   // בפגישות: הבורר בטופבר = מעבר יומן/לוח-זמנים, החיפוש הופך לחיפוש אירועי יומן
  const si = document.querySelector('.topbar .search input'); if (si) si.setAttribute('placeholder', searchPlaceholder());
  if (typeof renderTabs === 'function' && $('#procTabs')) renderTabs();   // מרענן את בורר הטופבר לפי המסך (לידים/פגישות)
  // בנייד: לשונית "וואטסאפ" יורדת מהבר הראשי ונכנסת לקבוצת "ניהול" — פותחת ניהול ובקרה בלבד.
  // הצ'אט הרגיל נשאר זמין דרך האייקון הצף (#chatDock).
  const navMain = mobile ? NAV.filter(n => n.key !== 'whatsapp') : NAV;
  const navManage = mobile ? NAV_MANAGE.concat([{ key: 'whatsapp', label: 'ניהול וואטסאפ', icon: 'whatsapp' }]) : NAV_MANAGE;
  const home = getHomeNav();
  const item = (n, sub) => `
    <button class="nav-item ${sub ? 'sub' : ''} ${navActive === n.key ? 'active' : ''} ${home === n.key ? 'is-home' : ''}" data-nav="${n.key}">
      ${ic(n.icon)}<span>${n.label}</span>${home === n.key ? '<i class="nav-home-dot" title="עמוד הפתיחה שלי"></i>' : ''}</button>`;
  $('#nav').innerHTML = navMain.map(n => item(n, false)).join('') + `
    <button class="nav-item nav-manage ${navManageOpen ? 'open' : ''} ${navManage.some(m => m.key === navActive) ? 'active' : ''}" id="navManage">
      ${ic('manage')}<span>ניהול</span><i class="nm-chev">${ic('chevron')}</i>
    </button>
    <div class="nav-sub-wrap ${navManageOpen ? 'open' : ''}" id="navSubWrap">
      ${navManage.map(n => item(n, true)).join('')}
    </div>`;
  const mg = $('#navManage');
  if (mg) mg.addEventListener('click', e => {
    e.stopPropagation();
    navManageOpen = !navManageOpen;
    mg.classList.toggle('open', navManageOpen);
    $('#navSubWrap').classList.toggle('open', navManageOpen);
  });
  bindNavManageDismiss();
  // לחיצה ארוכה בנייד על טאב → קביעה כעמוד פתיחה (הלחיצה-הארוכה יורה contextmenu)
  $$('#nav .nav-item[data-nav]').forEach(b => b.addEventListener('contextmenu', e => {
    if (!document.documentElement.classList.contains('cb-mobile')) return;
    openNavHomeMenu(e, b.dataset.nav, b.querySelector('span')?.textContent || b.dataset.nav);
  }));
  $$('#nav .nav-item[data-nav]').forEach(b => b.addEventListener('click', () => {
    /* מעבר טאב מתחיל בראש העמוד — אחרת נוחתים באמצע המסך החדש
       בגובה הגלילה של הקודם, וזה מבלבל. */
    scrollTopAll();
    navActive = b.dataset.nav;
    navManageOpen = false;   // בחירת קטגוריה → סוגרים את תפריט "ניהול"
    pendingToolbarHint = true;   // רמז הגלילה יופעל שוב בכניסה למסך הרשימה
    renderNav();
    $$('#procTabs .proc-tab').forEach(x => x.classList.remove('active'));
    moveSegInd();
    const k = b.dataset.nav;
    if (k === 'meetings')   return renderMeetingsView();   // טאב פגישות = יומן מבוסס-תפקידים
    if (k === 'clients')    return renderClientsView();    // טאב לקוחות = הגדרה דינמית של לקוח
    if (k === 'reports')    return renderReportsView();
    if (k === 'contracts')  return renderContractsView();
    if (k === 'settings')   return renderSettingsView();
    if (k === 'whatsapp') {   // בנייד — ישר לניהול ובקרה (לא לצ'אט הרגיל)
      if (document.documentElement.classList.contains('cb-mobile')) { platView = 'admin'; adminDetail = null; return renderChatPlatform(); }
      return enterChatPlatform();
    }
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
/* תפריט "ניהול" — נסגר בגלילה או בלחיצה בחוץ, ונפתח שוב רק בלחיצה על "ניהול" */
function closeNavManage() {
  if (!navManageOpen) return;
  navManageOpen = false;
  const mg = $('#navManage'); if (mg) mg.classList.remove('open');
  const sw = $('#navSubWrap'); if (sw) sw.classList.remove('open');
}
function bindNavManageDismiss() {
  if (window.__navManageDismiss) return; window.__navManageDismiss = true;
  document.addEventListener('scroll', () => closeNavManage(), true);   // גלילה בכל מיכל → סגירה
  document.addEventListener('click', e => { if (navManageOpen && !e.target.closest('#navSubWrap') && !e.target.closest('#navManage')) closeNavManage(); }, true);
}
/* כותרת הטופבר לפי הטאב הפעיל. עד היום היה כתוב "פניות" בכל מסך —
   גם ביומן הפגישות וגם ביומן השיחות — וזה פשוט לא נכון. */
const PAGE_TITLES = {
  home: 'ראשי', leads: 'לידים', meetings: 'פגישות', calls: 'שיחות',
  whatsapp: 'וואטסאפ', mail: 'דוא״ל', docs: 'מסמכים', clients: 'לקוחות',
  reports: 'דוחות', automation: 'אוטומציות', contracts: 'מערכת חוזים',
  settings: 'הגדרות', calendar: 'יומן', tasks: 'משימות', coord: 'לוח תיאום',
};
function pageTitle() {
  if (PAGE_TITLES[navActive]) return PAGE_TITLES[navActive];
  const n = (typeof NAV !== 'undefined' ? NAV : []).concat(typeof NAV_MANAGE !== 'undefined' ? NAV_MANAGE : [])
    .find(x => x.key === navActive);
  return n ? n.label : 'פניות';
}
/* בוררי התצוגה של הלידים (מסך אחד / טיפול דינמי / לוח תיאום) שייכים
   למסכי עבודת הלידים בלבד. במסכים אחרים אין להם משמעות. */
const LEAD_CONTEXT = ['home', 'leads'];
function isLeadContext() { return LEAD_CONTEXT.indexOf(navActive) >= 0; }

function renderTabs() {
  const mobile = document.documentElement.classList.contains('cb-mobile');
  const pt = document.querySelector('.page-title'); if (pt) pt.textContent = pageTitle();
  // בפגישות: הבורר בטופבר הוא מעבר יומן/לוח-זמנים — בדיוק כמו בורר התצוגה בלידים
  if (navActive === 'meetings' && mobile) {
    const isCal = (typeof meetView === 'undefined' || meetView === 'cal');
    $('#procTabs').innerHTML = `<button type="button" class="proc-mob-btn" id="meetViewBtn">${ic(isCal ? 'calendar' : 'tasks')}<span>${isCal ? 'יומן' : 'לוח זמנים'}</span>${ic('chevron')}</button>`;
    $('#meetViewBtn').addEventListener('click', e => { e.stopPropagation(); openMeetViewMenu(); });
    return;
  }
  // בהגדרות: הבורר בטופבר מחליף בין אזורי ההגדרות (עובד/מנהל/סניפים/קטלוג/שדות) — במקום שורת כפתורים בתוך המסך
  if (navActive === 'settings' && mobile) {
    const m = currentSetMode(), cur = SET_MODES.find(x => x.k === m) || SET_MODES[0];
    $('#procTabs').innerHTML = `<button type="button" class="proc-mob-btn" id="setModeBtn">${ic(cur.icon)}<span>${cur.label}</span>${ic('chevron')}</button>`;
    $('#setModeBtn').addEventListener('click', e => { e.stopPropagation(); openSetModeMenu(); });
    return;
  }
  // מסך שאינו עבודת לידים — הטופבר נשאר נקי
  if (!isLeadContext()) { const h = $('#procTabs'); if (h) h.innerHTML = ''; return; }
  // בנייד: הטאבים תופסים רוחב ויוצאים מהמסך → dropdown מותאם (מיושר לימין)
  if (mobile) {
    const cur = PROC_TABS.find(t => t.active) || PROC_TABS[0];
    $('#procTabs').innerHTML = `<button type="button" class="proc-mob-btn" id="procMobBtn" title="${cur.label}">${ic(cur.icon)}<span>${cur.short || cur.label}</span>${ic('chevron')}</button>`;
    $('#procMobBtn').addEventListener('click', e => { e.stopPropagation(); openProcMenu(); });
    return;
  }
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
/* dropdown תצוגה בנייד — תפריט מותאם, מיושר לימין, נפתח מתחת לכפתור */
function closeProcMenu() { $('#procMenu')?.remove(); document.removeEventListener('click', procMenuOutside); }
function procMenuOutside(e) { if (!e.target.closest('#procMenu') && !e.target.closest('#procMobBtn') && !e.target.closest('#meetViewBtn') && !e.target.closest('#setModeBtn')) closeProcMenu(); }
/* אזורי מסך ההגדרות — נשלטים מבורר עליון בנייד (לפי התפעול של המסך) */
const SET_MODES = [
  { k: 'emp', label: 'רמת עובד', icon: 'user' },
  { k: 'mgr', label: 'מנהל כללי', icon: 'clients' },
  { k: 'branches', label: 'סניפים', icon: 'org' },
  { k: 'catalog', label: 'קטלוג טיפולים', icon: 'tasks' },
  { k: 'fields', label: 'שדות פנייה', icon: 'docs' },
  { k: 'perms', label: 'הרשאות', icon: 'lock' },
];
function currentSetMode() { return (typeof permsMode !== 'undefined' && permsMode) ? 'perms' : (typeof fieldsMode !== 'undefined' && fieldsMode) ? 'fields' : (typeof catalogMode !== 'undefined' && catalogMode) ? 'catalog' : (typeof branchesMode !== 'undefined' && branchesMode) ? 'branches' : (typeof mgrMode !== 'undefined' && mgrMode) ? 'mgr' : 'emp'; }
function setSetMode(m) { mgrMode = m === 'mgr'; branchesMode = m === 'branches'; catalogMode = m === 'catalog'; fieldsMode = m === 'fields'; permsMode = m === 'perms'; }
function openSetModeMenu() {
  closeProcMenu();
  const btn = $('#setModeBtn'); if (!btn) return;
  const m = currentSetMode();
  const pop = document.createElement('div'); pop.className = 'proc-menu'; pop.id = 'procMenu';
  pop.innerHTML = SET_MODES.map(o => `<button type="button" class="proc-menu-item ${m === o.k ? 'on' : ''}" data-sm="${o.k}">${ic(o.icon)}<span>${o.label}</span>${m === o.k ? ic('check') : ''}</button>`).join('');
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`; pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`; pop.style.minWidth = `${Math.max(r.width, 200)}px`;
  $$('[data-sm]', pop).forEach(b => b.addEventListener('click', () => { setSetMode(b.dataset.sm); closeProcMenu(); renderSettingsView(); renderTabs(); }));
  setTimeout(() => document.addEventListener('click', procMenuOutside), 0);
}
function openMeetViewMenu() {
  closeProcMenu();
  const btn = $('#meetViewBtn'); if (!btn) return;
  const opts = [{ k: 'cal', label: 'יומן', icon: 'calendar' }, { k: 'agenda', label: 'לוח זמנים', icon: 'tasks' }];
  const pop = document.createElement('div'); pop.className = 'proc-menu'; pop.id = 'procMenu';
  pop.innerHTML = opts.map(o => `<button type="button" class="proc-menu-item ${meetView === o.k ? 'on' : ''}" data-mv="${o.k}">${ic(o.icon)}<span>${o.label}</span>${meetView === o.k ? ic('check') : ''}</button>`).join('');
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`; pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`; pop.style.minWidth = `${Math.max(r.width, 180)}px`;
  $$('[data-mv]', pop).forEach(b => b.addEventListener('click', () => { meetView = b.dataset.mv; closeProcMenu(); renderMeetingsView(); }));
  setTimeout(() => document.addEventListener('click', procMenuOutside), 0);
}
function openProcMenu() {
  closeProcMenu();
  const btn = $('#procMobBtn'); if (!btn) return;
  const cur = PROC_TABS.find(t => t.active) || PROC_TABS[0];
  const pop = document.createElement('div'); pop.className = 'proc-menu'; pop.id = 'procMenu';
  pop.innerHTML = PROC_TABS.map(t => `<button type="button" class="proc-menu-item ${t.key === cur.key ? 'on' : ''}" data-pm="${t.key}">${ic(t.icon)}<span>${t.short || t.label}</span>${t.key === cur.key ? ic('check') : ''}</button>`).join('');
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  pop.style.minWidth = `${Math.max(r.width, 200)}px`;
  $$('[data-pm]', pop).forEach(b => b.addEventListener('click', () => {
    PROC_TABS.forEach(t => t.active = t.key === b.dataset.pm);
    closeProcMenu(); switchView(b.dataset.pm); renderTabs();   // רענון תווית הכפתור
  }));
  setTimeout(() => document.addEventListener('click', procMenuOutside), 0);
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
  if (key === 'coord') return renderCoordView();
  renderUnifiedView();
}

/* רשימת המתנה — כרטיס נשלף במסך הלידים (מתפנה זמן → הצעה אוטומטית ללקוח הבא) */
function waitlistCardHTML() {
  const wl = (typeof WAITLIST !== 'undefined') ? WAITLIST : [];
  return `<details class="card waitlist-card" open>
    <summary class="card-head"><div class="title"><span class="num">${ic('queue')}</span> רשימת המתנה <span class="wl-count">${wl.length}</span></div><span class="wl-chev">${ic('chevron')}</span></summary>
    <div class="wl-body">
      <p class="wl-note">${ic('bolt')} מתפנה זמן → הצעה אוטומטית ללקוח הבא</p>
      ${wl.map(w => `<div class="wl-row">
        <div class="wl-info"><b>${w.name}</b><small><span class="badge blue">${w.svc}</span> · ${w.req}</small><small class="muted">ממתין מ-${w.since}</small></div>
        <button class="btn xs primary" data-wl="${esc(w.name)}">${ic('check')} הצע זמן</button>
      </div>`).join('') || '<div class="muted" style="padding:8px">אין לקוחות בהמתנה</div>'}
    </div>
  </details>`;
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
        ${waitlistCardHTML()}
      </aside>
    </div>`;
  renderSummary(); renderList(); renderQueue(); renderLegend(); initToolbar();
  $$('[data-wl]').forEach(b => b.addEventListener('click', () => offerWaitlistTime(b.dataset.wl)));
  if (pendingToolbarHint) { pendingToolbarHint = false; setTimeout(hintScrollToolbar, 380); }
}
/* "הצע זמן" ללקוח המתנה — פותח את מסך הזמנים המוצעים לפי הבקשה הספציפית שלו */
function offerWaitlistTime(name) {
  const w = (typeof WAITLIST !== 'undefined') && WAITLIST.find(x => x.name === name); if (!w) return;
  const pseudo = { id: 'wl_' + name, name: w.name, phone: '', journey: 'sales', objective: 'meeting', services: [], needs: {}, fromWaitlist: true, waitReq: w.req };
  // מיפוי סוג השירות המבוקש לפריט בקטלוג (כדי לסנן זמנים רלוונטיים לבקשתו)
  if (typeof COORD_TREATMENTS !== 'undefined') {
    const m = COORD_TREATMENTS.find(t => w.svc && (t.label.includes(w.svc) || (t.kind && w.svc.includes(t.kind)) || (w.svc.includes('שירות') && t.kind === 'טיפול')));
    if (m) pseudo.services = [m.key];
  }
  if (typeof openProposedTimes === 'function') { openProposedTimes(pseudo); toast(`זמנים מוצעים ל${name} · לפי בקשתו (${w.svc} · ${w.req})`); }
  else toast(`הצעת זמן נשלחה ל${name} ✓`);
}

/* רמז ויזואלי: רצועת כרטיסי הסיכום בנייד ניתנת לגלילה → הצצה שמאלה וחזרה, פעם אחת בכניסה למסך */
let pendingToolbarHint = true;
function hintScrollToolbar() {
  if (!document.documentElement.classList.contains('cb-mobile')) return;
  const el = document.querySelector('#summary') || document.querySelector('.summary');
  if (!el || el.scrollWidth <= el.clientWidth + 6) return;   // אין מה לגלול
  const prevSnap = el.style.scrollSnapType;
  el.style.scrollSnapType = 'none';   // מנטרל scroll-snap שאחרת "תופס" את ההצצה חזרה
  const range = el.scrollWidth - el.clientWidth;
  const peek = -Math.min(92, range);   // RTL: שלילי חושף את התוכן המוסתר משמאל (חושף ~כרטיס)
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const out = 16, holdN = 6, back = 16, total = out + holdN + back;
  let i = 0;
  const iv = setInterval(() => {
    i++;
    if (i <= out) el.scrollLeft = peek * ease(i / out);                      // הצצה שמאלה
    else if (i <= out + holdN) el.scrollLeft = peek;                         // החזקה קצרה
    else if (i <= total) el.scrollLeft = peek * (1 - ease((i - out - holdN) / back));  // חזרה ימינה
    else { el.scrollLeft = 0; el.style.scrollSnapType = prevSnap; clearInterval(iv); }
  }, 28);
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
/* ניסוח "עבר לפני X" ממספר דקות איחור */
function fmtOverdue(mins) {
  if (mins == null) return 'באיחור';
  if (mins >= 1440) { const d = Math.floor(mins / 1440); return `באיחור · ${d} ${d === 1 ? 'יום' : 'ימים'}`; }
  if (mins >= 60) return `באיחור · ${Math.floor(mins / 60)} ש׳`;
  return `באיחור · ${Math.max(1, mins)} ד׳`;
}
function nextCell(r) {
  const na = NEXT_ACTIONS[r.next?.type] || NEXT_ACTIONS.none;
  const over = recIsOverdue(r);
  return `<div class="next-cell ${over ? 'overdue' : ''}" data-next role="button" title="עריכת הפעולה הבאה">
    <span class="chip ${na.color}">${ic(na.icon)}${na.label}</span>
    <small>${over ? fmtOverdue(overdueMins(r)) : esc(r.next?.at)}</small></div>`;
}

/* ---------------- טבלה ראשית ---------------- */
/* פרדיקטים משותפים – משמשים גם לספירת הכרטיסים וגם לסינון (כדי שהמספרים תמיד יתאימו) */
const FILTERS = {
  today_meetings: r => ['meeting', 'remind'].includes(r.next?.type) && !r.done,
  today_followup: r => r.next?.type === 'followup' && !r.done,
  overdue:        r => recIsOverdue(r),
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
/* קטגוריות שטרם מולאו בליד — לחיווי ההתראה בשורה */
function unfilledStages(r) {
  try { return (computeStages(r) || []).filter(s => s.noContent).map(s => s.title); }
  catch (e) { return []; }
}
function rowAlertHTML(r, cls) {
  const u = unfilledStages(r);
  if (!u.length) return '';
  return `<span class="row-alert ${cls}" data-alert="${esc(u.join('|'))}" aria-label="שלבים שטרם מולאו">${ic('alert')}</span>`;
}
/* פופ-אפ צף יחיד: בריחוף על סימן ההתראה מציג את השלבים שטרם מולאו (מחליף את כרטיס ה-hover) */
function showAlertPop(a) {
  hideAlertPop();
  if (typeof hideHoverCard === 'function') hideHoverCard();
  if (typeof hoverTimer !== 'undefined') clearTimeout(hoverTimer);
  const stages = (a.dataset.alert || '').split('|').filter(Boolean);
  const pop = document.createElement('div'); pop.className = 'alert-pop'; pop.id = 'alertPop';
  pop.innerHTML = `<div class="ap-head">${ic('alert')} שלבים שטרם מולאו</div>${stages.map(s => `<div class="ap-row">${ic('clock')} ${esc(s)}</div>`).join('')}`;
  document.body.appendChild(pop);
  const rc = a.getBoundingClientRect();
  let top = rc.bottom + 6; if (top + pop.offsetHeight > window.innerHeight - 8) top = rc.top - pop.offsetHeight - 6;
  let left = rc.left + rc.width / 2 - pop.offsetWidth / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pop.offsetWidth - 8));
  pop.style.top = `${Math.max(8, top)}px`; pop.style.left = `${left}px`;
}
function hideAlertPop() { const p = document.getElementById('alertPop'); if (p) p.remove(); }
function bindRowAlertPop() {
  if (window.__rowAlertBound) return; window.__rowAlertBound = true;
  document.addEventListener('mouseover', e => {
    if (document.documentElement.classList.contains('cb-mobile')) return;
    const a = e.target.closest && e.target.closest('.row-alert.deskonly'); if (a) showAlertPop(a);
  });
  document.addEventListener('mouseout', e => {
    const a = e.target.closest && e.target.closest('.row-alert.deskonly');
    if (a && !a.contains(e.relatedTarget)) hideAlertPop();
  });
}
/* שורת רשומה — משותפת לרשימה הראשית ולמסך הלקוחות */
function listRowHTML(r) {
  const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey], dep = deptOf(r.journey);
  return `
    <tr data-id="${r.id}" class="${r.id === selectedId ? 'sel' : ''} ${recIsOverdue(r) ? 'row-over' : ''}">
      <td><div class="row-actions">
        <button class="icon-btn wa" data-stop data-act="wa" title="WhatsApp">${ic('whatsapp')}</button>
        <button class="icon-btn tel" data-stop data-act="call" title="חיוג">${ic('phone')}</button>
      </div></td>
      <td><div class="client-cell">
        ${avatar(r)}
        <span class="ent-dot ${et.color}" title="${et.label}"></span>
        <div class="meta"><b>${r.name}${rowAlertHTML(r, 'mobonly')}</b><small>${esc(r.org) || esc(r.phone)}</small></div>
      </div></td>
      <td>${r.subject}</td>
      <td><span class="badge ${jt.color}">${jt.label}</span><span class="dept-chip ${dep.color}" title="מחלקה">${dep.label}</span></td>
      <td><div class="status-cell"><span class="chip ${r.status.color}">${r.status.label}</span>${rowAlertHTML(r, 'deskonly')}</div></td>
      <td>${nextCell(r)}</td>
      <td>${prioTag(r.priority)}</td>
    </tr>`;
}
function bindListRow(tr) {
  const r = RECORDS.find(x => x.id === +tr.dataset.id);
  tr.addEventListener('click', () => openDrawer(r));
  $$('[data-stop]', tr).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    if (b.dataset.act === 'call') dialTel(r.phone, r.name);
    if (b.dataset.act === 'wa')   openWhatsApp(r);
  }));
  const nc = $('[data-next]', tr);
  if (nc) nc.addEventListener('click', e => { e.stopPropagation(); openNextActionEditor(r, nc); });
  attachHoverCard(tr, r);
}
function renderList() {
  const body = $('#listBody'); if (!body) return;   // הגנה: לא במסך האחוד
  const rows = filteredRecords();
  const cnt = $('#listCount'); if (cnt) cnt.textContent = `${rows.length} רשומות`;
  body.innerHTML = rows.map(listRowHTML).join('');
  $$('#listBody tr').forEach(bindListRow);
}

/* ---------------- מסך לקוחות — הגדרה דינמית של "מיהו לקוח" ---------------- */
const CLIENT_CRITERIA = [
  { key: 'scheduled',  label: 'נקבעה פגישה',  icon: 'calendar', desc: 'ליד שנקבעה לו פגישה',
    test: r => r.status.label === 'נקבעה פגישה' || r.next?.type === 'meeting' || r.stageKey === 'meeting' || !!r.meeting },
  { key: 'arrived',    label: 'הגיע לפגישה',  icon: 'check', desc: 'מי שהפגישה שלו התקיימה',
    test: r => ['handle', 'summary', 'next', 'close', 'met', 'arrived', 'service'].includes(r.stageKey) || r.status.label === 'בטיפול' || !!r.done },
  { key: 'purchased',  label: 'ביצע רכישה',   icon: 'tag', desc: 'לקוח שרכש / נסגרה עסקה',
    test: r => r.entity === 'customer' || ['upsell', 'renewal'].includes(r.journey) || /נסגר|נרכש|זכייה|רכש|עסקה/.test(r.status.label) },
  { key: 'onboarding', label: 'התחיל מימוש',  icon: 'bolt', desc: 'לקוח שהחל תהליך הטמעה/מימוש',
    test: r => ['installation', 'onboarding', 'implementation', 'training', 'deposit'].includes(r.stageKey) || ['installation', 'training'].includes(r.journey) },
];
let clientDefs = null;
let clientDefOpen = false;   // בר ההגדרה מכווץ כברירת מחדל — נפתח בחץ
function getClientDefs() {
  if (clientDefs) return clientDefs;
  let saved = null; try { saved = JSON.parse(localStorage.getItem('cb_clientDefs')); } catch (e) {}
  clientDefs = new Set(saved && saved.length ? saved : ['purchased']);   // ברירת מחדל: מי שרכש
  return clientDefs;
}
function saveClientDefs() { try { localStorage.setItem('cb_clientDefs', JSON.stringify([...getClientDefs()])); } catch (e) {} }
function isClient(r) { const d = getClientDefs(); return CLIENT_CRITERIA.some(c => d.has(c.key) && c.test(r)); }
function renderClientsView() {
  const defs = getClientDefs();
  const clients = RECORDS.filter(isClient);
  const activeLabels = CLIENT_CRITERIA.filter(c => defs.has(c.key)).map(c => c.label).join(' · ');
  $('#viewHost').innerHTML = `
    <div class="clients-def card ${clientDefOpen ? 'open' : ''}">
      <button class="cd-active-row" data-cdtoggle>
        <span class="cda-ic">${ic('user')}</span>
        <span class="cda-txt">הגדרה פעילה: <b>${activeLabels}</b> · ${clients.length} לקוחות</span>
        <span class="cda-chev">${ic('chevron')}</span>
      </button>
      <div class="cd-collapse">
        <div class="cd-head">${ic('bolt')} <b>מי נחשב ל"לקוח"?</b> <small>בחר קריטריון אחד או יותר · רשומה שעונה לאחד מהם תוצג כלקוח</small></div>
        <div class="cd-chips">
          ${CLIENT_CRITERIA.map(c => `<button class="cd-chip ${defs.has(c.key) ? 'on' : ''}" data-cdef="${c.key}" title="${c.desc}">
            ${ic(c.icon)} <span class="cd-lbl">${c.label}</span> <span class="cd-n">${RECORDS.filter(c.test).length}</span></button>`).join('')}
        </div>
      </div>
    </div>
    <section class="card list-card">
      <div class="card-head"><div class="title"><span class="num">${ic('clients')}</span> רשימת לקוחות</div>
        <span class="muted" style="font-size:12px">${clients.length} לקוחות</span></div>
      <div class="table-wrap"><table class="list">
        <thead><tr><th style="width:96px"></th><th>לקוח</th><th>נושא</th><th>מסלול</th><th>סטטוס</th><th>הפעולה הבאה</th><th>עדיפות</th></tr></thead>
        <tbody id="clientsBody"></tbody></table></div>
    </section>`;
  const body = $('#clientsBody');
  body.innerHTML = clients.length ? clients.map(listRowHTML).join('')
    : `<tr><td class="cl-empty">אין רשומות שעונות להגדרת הלקוח הנוכחית — בחר קריטריון נוסף למעלה</td></tr>`;
  $$('#clientsBody tr[data-id]').forEach(bindListRow);
  $$('[data-cdtoggle]').forEach(b => b.addEventListener('click', () => {
    clientDefOpen = !clientDefOpen;
    const cd = document.querySelector('.clients-def'); if (cd) cd.classList.toggle('open', clientDefOpen);
  }));
  $$('[data-cdef]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.cdef, d = getClientDefs();
    d.has(k) ? d.delete(k) : d.add(k);
    if (d.size === 0) d.add(k);   // חייב להישאר לפחות קריטריון אחד
    saveClientDefs(); renderClientsView();
    toast(`הגדרת הלקוח עודכנה · ${RECORDS.filter(isClient).length} לקוחות`);
  }));
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

/* ---------------- מגירת התראות (פעמון) — חריגות SLA / איחורים + יומן הודעות שקפצו ---------------- */
function alertsList() {
  const out = [];
  (typeof RECORDS !== 'undefined' ? RECORDS : []).forEach(r => {
    if (r.done) return;
    // באיחור מחושב מול שעון-הייחוס — התראה שהייתה אמורה לקפוץ כשעבר המועד
    if (recIsOverdue(r)) { const na = NEXT_ACTIONS[r.next?.type]; out.push({ r, label: 'פעולה באיחור', sub: fmtOverdue(overdueMins(r)) + (na ? ' · ' + na.label : ''), tone: 'red' }); }
    else if (r.sla && r.sla.color === 'red') out.push({ r, label: 'חריגת SLA', sub: r.sla.label || 'חריגה', tone: 'red' });
    else if (r.next && r.next.type === 'followup') out.push({ r, label: 'פולו-אפ להיום', sub: r.next.at || '', tone: 'blue' });
  });
  return out;
}
/* ---- מונה ההתראות: סופר רק מה שחדש מאז הפתיחה האחרונה של הפעמון ----
   התראה מזוהה לפי הליד + סוג ההתראה, כך שהתראה שכבר נראתה לא נספרת שוב,
   אבל שינוי מצב (למשל "פולו-אפ" → "פעולה באיחור") נחשב חדש. */
let BELL_SEEN = (function () { try { return JSON.parse(localStorage.getItem('cb_bellSeen')) || { keys: [], at: '' }; } catch (e) { return { keys: [], at: '' }; } })();
function bellSeenSave() { try { localStorage.setItem('cb_bellSeen', JSON.stringify(BELL_SEEN)); } catch (e) {} }
function alertKey(a) { return a.r.id + '|' + a.label; }
/* הפריטים החדשים בלבד */
function bellNew() {
  const seen = new Set(BELL_SEEN.keys || []);
  const newAlerts = alertsList().filter(a => !seen.has(alertKey(a)));
  const newNotifs = (typeof NOTIF_LOG !== 'undefined') ? NOTIF_LOG.filter(n => !n.read) : [];
  return { alerts: newAlerts, notifs: newNotifs, total: newAlerts.length + newNotifs.length };
}
/* סה"כ פריטים במגירה (התראות פתוחות + הודעות) — לכותרת, לא לבאדג' */
function bellItemsTotal() {
  return alertsList().length + ((typeof NOTIF_LOG !== 'undefined') ? NOTIF_LOG.length : 0);
}
function bellCountTotal() { return bellNew().total; }
/* פתיחת הפעמון = איפוס המונה: כל מה שמוצג כרגע נחשב "נראה" */
function bellMarkSeen() {
  BELL_SEEN = { keys: alertsList().map(alertKey), at: (typeof docStamp === 'function') ? docStamp() : '' };
  bellSeenSave();
  if (typeof NOTIF_LOG !== 'undefined') NOTIF_LOG.forEach(n => n.read = true);
  updateBellBadge();
}
function updateBellBadge() {
  const el = document.getElementById('bellCount'); if (!el) return;
  const n = bellCountTotal();
  el.textContent = n; el.style.display = n ? '' : 'none';
  const btn = document.getElementById('bell'); if (btn) btn.classList.toggle('has-new', !!n);
}
function openAlertsDrawer() {
  const alerts = alertsList();
  const notifs = (typeof NOTIF_LOG !== 'undefined') ? NOTIF_LOG : [];
  const fresh = bellNew();                                    // מה חדש — לפני שמסמנים כנראה
  const freshKeys = new Set(fresh.alerts.map(alertKey));
  const row = a => `
    <div class="task-row ${freshKeys.has(alertKey(a)) ? 'is-new' : ''}" data-alertopen="${a.r.id}">
      <span class="al-ic ${a.tone}">${ic('alert')}</span>
      <div class="task-body"><b>${esc(a.r.name)}${freshKeys.has(alertKey(a)) ? ' <span class="new-tag">חדש</span>' : ''}</b><small>${a.label} · ${esc(a.sub)}</small></div>
      <button class="icon-btn" title="פתח את הליד">${ic('layers')}</button>
    </div>`;
  const notifRow = (nn, i) => `
    <div class="task-row ${nn.read ? '' : 'is-new'}" data-notifopen="${i}">
      <span class="al-ic ${nn.kind === 'reminder' ? 'blue' : 'green'}">${ic(nn.kind === 'reminder' ? 'calendar' : 'whatsapp')}</span>
      <div class="task-body"><b>${esc(nn.title)}${nn.read ? '' : ' <span class="new-tag">חדש</span>'}</b><small>${esc(nn.body)}</small></div>
      ${(nn.cid != null || nn.recId != null) ? `<button class="icon-btn" title="פתח">${ic('chevronL')}</button>` : ''}
    </div>`;
  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <div class="top">
        <div class="t"><span class="num">${ic('bell')}</span> התראות ${bellItemsTotal() ? `<span class="chip gray sm">${bellItemsTotal()}</span>` : ''}${fresh.total ? ` <span class="chip red sm">${fresh.total} חדשות</span>` : ''}</div>
        <button class="close-btn" id="closeDrawer">${ic('close')}</button>
      </div>
    </div>
    <div class="drawer-body">
      ${!bellItemsTotal() ? '' : ''}
      ${alerts.length ? `<div class="sec-title">${ic('alert')} דורש טיפול <span class="sec-count">${alerts.length}</span></div><div class="task-list">${alerts.map(row).join('')}</div>` : ''}
      ${notifs.length ? `<div class="sec-title" style="margin-top:14px">${ic('clock')} הודעות אחרונות <span class="sec-count">${notifs.length}</span></div><div class="task-list">${notifs.map(notifRow).join('')}</div>` : ''}
      ${!alerts.length && !notifs.length ? `<div class="empty">${ic('check')}<p>אין התראות פתוחות 🎉</p></div>` : ''}
    </div>`;
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $$('[data-alertopen]').forEach(b => b.addEventListener('click', () => {
    const r = RECORDS.find(x => x.id === +b.dataset.alertopen);
    if (r) openDrawer(r, openAlertsDrawer);   // חזרה לרשימת ההתראות במקום יציאה מלאה
  }));
  $$('[data-notifopen]').forEach(b => b.addEventListener('click', () => {
    const nn = NOTIF_LOG[+b.dataset.notifopen]; if (!nn) return;
    if (nn.kind === 'reminder' && nn.recId != null) { const r = RECORDS.find(x => x.id === nn.recId); if (r && typeof pnOpenReminderLead === 'function') { closeDrawer(); pnOpenReminderLead(nn); } }
    else if (nn.cid != null && typeof openDockFromNotify === 'function') { closeDrawer(); openDockFromNotify(nn.cid); }
  }));
  // פתיחת המגירה = איפוס המונה; מכאן והלאה ייספרו רק התראות חדשות
  bellMarkSeen();
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
  $('#overlay').classList.add('open');
}

/* ---------------- Drawer ---------------- */
let drawerReturnFn = null;   // חזרה למסך שממנו נפתח הליד (למשל רשימת המשימות) — במקום יציאה מלאה
/* שעון יורד של נעילת התור בתוך הליד — מתי השיריון מפסיק להיות רלוונטי */
function holdCountdownHTML(r) {
  if (typeof autoFire === 'function' && typeof SLOT_HOLDS !== 'undefined') {
    const _h = SLOT_HOLDS.find(x => x.recId === (r && r.id));
    if (_h && _h.minsLeft <= 5 && !_h.__warned) { _h.__warned = true; autoFire('h2', { rec: r, hold: _h }); }
  }
  const h = r && r.slotHold; if (!h) return '';
  const total = h.totalMins || h.minsLeft || 1;
  const pct = Math.max(0, Math.min(100, Math.round((h.minsLeft / total) * 100)));
  const urgent = h.minsLeft <= Math.max(2, Math.round(total * 0.2));
  return `<div class="hold-cd ${urgent ? 'urgent' : ''}" data-holdcd>
    <div class="hold-cd-top">${ic('lock')} <b>נעילה זמנית — התור טרם שוריין סופית</b>
      <span class="hold-cd-left">${ic('clock')} ${h.minsLeft} דק׳</span></div>
    <div class="hold-cd-bar"><span style="width:${pct}%"></span></div>
    <div class="hold-cd-sub">${typeof cDayLbl === 'function' ? cDayLbl(h.date) : ''} ${typeof fmtH === 'function' ? fmtH(h.h) : ''}${h.staffName ? ' · ' + esc(h.staffName) : ''} · ${h.price} ₪
      <button class="hold-cd-btn" data-holdopen>${ic('chevronL')} המשך תהליך</button></div>
  </div>`;
}
/* תקציר מוצר/שירות בכותרת הליד — מה מעניין את הלקוח או אילו שירותים קיימים (לגבייה/הרחבה) */
function leadSvcSummary(r) {
  const j = r.journey;
  const label = j === 'upsell' ? 'שירותים קיימים · להרחבה' : (j === 'billing' || j === 'renewal') ? 'שירותים לגבייה' : j === 'support' ? 'שירות קיים' : 'מעוניין ב';
  let value = '', missing = false;
  if (r.services && r.services.length && typeof cTreat === 'function') value = r.services.map(k => (cTreat(k) ? cTreat(k).label : k)).join(' · ');
  else if (r.subject) value = r.subject;
  else { value = 'לא נמסר — מידע חסר'; missing = true; }
  return { label, value, missing };
}
function openDrawer(r, returnFn) {
  qaEdit = false;   // כל ליד נפתח עם העין סגורה — לא נשאר מצב-התאמה מהליד הקודם
  drawerReturnFn = returnFn || null;
  selectedId = r.id; activeTab = 'flow'; renderList();
  const et = ENTITY_TYPES[r.entity], jt = JOURNEY_TYPES[r.journey];
  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <div class="top">
        <div class="t">${drawerReturnFn ? `<button class="drawer-back" id="drawerBack" aria-label="חזרה">${ic('chevronR')}</button>` : `<span class="num">2</span>`} מרכז הטיפול</div>
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
        ${(() => { const s = leadSvcSummary(r); return `<span class="head-svc ${s.missing ? 'missing' : ''}" title="${s.missing ? 'הלקוח לא מסר — מידע חסר' : ''}">${ic('tasks')} ${s.label}: <b>${esc(s.value)}</b></span>`; })()}
        <button class="assignee-transfer" data-transfer title="העבר את הטיפול לגורם אחר">${ic('user')} <b>${r.assignee}</b><span class="at-tag">${ic('sync')} העבר</span></button>
        <span class="sla ${r.sla.color}">${ic('clock')} SLA: ${r.sla.label}</span>
        <button class="qa-eye-mini" data-qaeye title="התאמת הפעולות המוצגות">${ic('eye')}</button>
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
  requestAnimationFrame(() => requestAnimationFrame(scrollDrawerToActiveStage));   // גלילה אוטומטית לשלב הפעיל
}
/* גלילה אוטומטית בכניסה לליד — מביא את השלב הפעיל לחלק התחתון של האזור, כך שהתקציר נשאר גלוי למעלה */
function scrollDrawerToActiveStage() {
  const body = $('#drawerBody'); if (!body || activeTab !== 'flow') return;
  const active = body.querySelector('.acc-item.st-active, .acc-item.st-overdue');
  if (!active) return;
  const bodyRect = body.getBoundingClientRect(), aRect = active.getBoundingClientRect();
  if (aRect.top >= bodyRect.top && aRect.bottom <= bodyRect.bottom) return;   // כבר נראה — לא לגלול
  // מיקום רצוי: השלב הפעיל בתחתית האזור הנראה → התקציר נשאר גלוי למעלה
  const target = bodyRect.bottom - Math.min(aRect.height, bodyRect.height * 0.55) - 16;
  const delta = aRect.top - target;
  if (delta > 8) body.scrollTop += delta;
}
/* קביעה/שינוי מועד — נפתח תמיד ישירות לפופ-אפ הזמנים המוצעים (גם במחשב),
   כדי שאפשר לעיין בזמנים חלופיים בלי להתחייב. האישור על שינוי תור קיים
   מוקפץ (cbConfirm ממורכז) רק ברגע בחירת מועד חדש בפועל — ראה schedule.js. */
function openSchedule(r) {
  if (typeof openProposedTimes === 'function') openProposedTimes(r);
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
  return btns;
}
function bindQuickRow(r) {
  const qr = $('#quickRow'); if (qr) qr.classList.toggle('qa-editing', qaEdit);   // מצב התאמה: מסגרת מקווקוות + שיקשוק
  $$('#quickRow [data-q]').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.q;
    if (qaEdit) {   // מצב התאמה: לחיצה מסתירה/מציגה — בלי שיקשוק חוזר
      const qr = $('#quickRow'); if (qr) qr.classList.remove('qa-open-anim');
      hiddenQA.has(q) ? hiddenQA.delete(q) : hiddenQA.add(q);
      localStorage.setItem('cb_hiddenQA', JSON.stringify([...hiddenQA]));
      refreshQuick(r);
      return;
    }
    if (q === 'call') dialTel(r.phone, r.name);
    if (q === 'wa')   openWhatsApp(r);
    if (q === 'consult') openConsult(r);
    if (q === 'mail') toast('נפתח חלון דוא"ל');
    if (q === 'meet') return openSchedule(r);
    if (q === 'fu')   openFollowupPanel(r);
    if (q === 'note') openNotes(r);
  }));
}
function refreshQuick(r) { const q = $('#quickRow'); if (q) { q.innerHTML = quickRowHTML(r); bindQuickRow(r); } }

function bindDrawer(r) {
  $('#closeDrawer').addEventListener('click', closeDrawer);
  const bk = $('#drawerBack');
  if (bk) bk.addEventListener('click', () => { const fn = drawerReturnFn; drawerReturnFn = null; if (typeof fn === 'function') fn(); else closeDrawer(); });
  $('#cancelTreat').addEventListener('click', closeDrawer);
  $('#saveTreat').addEventListener('click', () => { toast('הטיפול נשמר · השלב קודם · אישור נשלח ✓'); });
  bindQuickRow(r);
  const trBtn = $('#drawer [data-transfer]');
  if (trBtn) trBtn.addEventListener('click', () => openTransferLead(r));
  const eye = $('#drawer [data-qaeye]');
  if (eye) eye.addEventListener('click', () => {
    qaEdit = !qaEdit;
    eye.classList.toggle('on', qaEdit);
    refreshQuick(r);
    if (qaEdit) {   // שיקשוק חד-פעמי רק בפתיחת המצב
      const qr = $('#quickRow');
      if (qr) { qr.classList.add('qa-open-anim'); setTimeout(() => qr.classList.remove('qa-open-anim'), 700); }
    }
    toast(qaEdit ? 'מצב התאמה: לחץ על אייקון כדי להסתיר/להציג, ואז על העין לסיום' : 'התצוגה נשמרה ✓');
  });
  $$('.drawer-tabs .d-tab').forEach(b => b.addEventListener('click', () => {
    activeTab = b.dataset.dtab;
    $$('.drawer-tabs .d-tab').forEach(x => x.classList.remove('active')); b.classList.add('active');
    renderDrawerTab(r);
  }));
}

/* ---------------- תוכן טאב ----------------
   מקור-אמת יחיד למבנה הליד: משמש גם ב-Drawer (מסך ליד / מהלך דינמי)
   וגם בפאנל של לוח התיאום החי — אותו קוד בדיוק, בלי פערים. */
function drawerTabHTML(r, tab) {
  if (tab === 'flow')    return flowHTML(r);
  if (tab === 'details') return detailsHTML(r);
  if (tab === 'history') return historyHTML(r);
  if (tab === 'log')     return logHTML(r);
  if (tab === 'tasks')   return `<div class="empty">${ic('check')}<p>אין משימות פתוחות לרשומה זו.</p><button class="btn sm primary">${ic('plus')} משימה חדשה</button></div>`;
  if (tab === 'docs')    return docsTabHTML(r);
  return '';
}
const DOC_TYPES = ['תעודת זהות', 'הסכם חתום', 'אישור רפואי', 'קבלה / חשבונית', 'צילום מסמך', 'אחר'];
function docStamp() { const d = (typeof COORD_TODAY !== 'undefined' ? COORD_TODAY : ''); const t = (typeof minToHM === 'function' && typeof nowHM === 'function') ? minToHM(nowHM()) : ''; return `${d} ${t}`.trim(); }
function docsTabHTML(r) {
  const docs = r.docs || [];
  return `<div class="docs-tab">
    <div class="docs-head"><b>${ic('docs')} מסמכים מצורפים (${docs.length})</b>
      <button class="btn sm primary" id="docUpBtn">${ic('plus')} העלה מסמך</button>
      <input type="file" id="docFile" accept="image/*,.pdf,.doc,.docx" hidden></div>
    ${docs.length ? `<div class="docs-list">${docs.map((d, i) => `<div class="doc-row">
        <span class="doc-ic">${ic('docs')}</span>
        <div class="doc-info"><b>${esc(d.name)}</b>
          <small><span class="badge blue sm">${esc(d.type)}</span> · ${ic('user')} ${esc(d.by)} · ${ic('clock')} ${esc(d.at)}</small></div>
        <button class="doc-del" data-docdel="${i}" title="הסר">${ic('close')}</button>
      </div>`).join('')}</div>`
      : `<div class="empty sm">${ic('docs')}<p>אין מסמכים מצורפים.</p></div>`}
    <p class="hint" style="margin-top:10px">${ic('lock')} כל מסמך נחתם אוטומטית בשם המעלה (${CURRENT_USER}) וחותמת זמן.</p>
  </div>`;
}
/* פופ-אפ בחירת סוג מסמך לאחר בחירת קובץ */
function openDocTypePicker(r, fileName) {
  const old = document.getElementById('docTypeWrap'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'docTypeWrap';
  w.innerHTML = `<div class="cbc-box" style="max-width:400px;text-align:start">
    <div class="cbc-head"><span class="cbc-ic">${ic('docs')}</span><b>סוג המסמך</b></div>
    <div class="cbc-msg" style="text-align:start">${ic('docs')} ${esc(fileName)}</div>
    <div class="doc-type-list">${DOC_TYPES.map((t, i) => `<button class="doc-type-opt" data-doctype="${esc(t)}">${t}</button>`).join('')}</div>
    <div class="cbc-actions"><button class="btn ghost" id="docTypeCancel">ביטול</button></div></div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('open'));
  const close = () => w.remove();
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#docTypeCancel', w).addEventListener('click', close);
  $$('[data-doctype]', w).forEach(b => b.addEventListener('click', () => {
    r.docs = r.docs || [];
    r.docs.unshift({ name: fileName, type: b.dataset.doctype, by: CURRENT_USER, at: docStamp() });
    close(); renderDrawerTab(r); toast(`"${fileName}" הועלה ונחתם ✓`);
  }));
}
function renderDrawerTab(r) {
  const body = $('#drawerBody');
  if (!body) { if (typeof renderCoordView === 'function' && $('.coord-panel')) renderCoordView(); return; }   // בהקשר לוח התיאום — רענון הפאנל
  body.innerHTML = drawerTabHTML(r, activeTab);
  if (activeTab === 'flow') bindFlow(r);
  if (activeTab === 'history') $$('#drawerBody [data-restore]').forEach(b => b.addEventListener('click', () => restoreField(r, b.dataset.restore)));
  if (activeTab === 'log') {
    const lb = $('#logAddBtn');
    if (lb) lb.addEventListener('click', () => { const t = $('#logAdd'); if (t && t.value.trim()) { t.value = ''; toast('התיעוד נוסף ✓'); } else toast('נא לכתוב תיעוד'); });
  }
  if (activeTab === 'docs') {
    const up = $('#docUpBtn'), file = $('#docFile');
    if (up && file) { up.addEventListener('click', () => file.click()); file.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) openDocTypePicker(r, f.name); e.target.value = ''; }); }
    $$('#drawerBody [data-docdel]').forEach(b => b.addEventListener('click', () => { r.docs.splice(+b.dataset.docdel, 1); renderDrawerTab(r); toast('המסמך הוסר'); }));
  }
}

/* ---- ציר טיפול דינמי (מנוע Workflow) ---- */
/* תקציר תוצאת שלב — מה בוצע בו (מקור אמת: נתוני הרשומה + הערות שנשמרו + seed להדגמה) */
const STAGE_RESULT_SEED = {
  intake: 'נקלט אוטומטית ממקור הפנייה', assign: 'שויך לנציג · סבב שוויוני',
  contactinfo: 'פרטי קשר אומתו', contact: 'שיחה · נוצר קשר, הלקוח מעוניין',
  qualify: 'צורך סווג · מתאים למסלול', reminder: 'תזכורת נשלחה ללקוח',
  open: 'פנייה נפתחה', identify: 'הלקוח זוהה במערכת', request: 'התקבלה בקשת הרחבה',
};
function getStageResult(r, key) {
  if (r.stageNotes && r.stageNotes[key]) return r.stageNotes[key];   // הערה שנשמרה ידנית לשלב
  if (['meeting', 'present', 'offer', 'call', 'schedule', 'confirm', 'held'].includes(key) && r.meeting)
    return `נקבע: ${r.meeting.date} ${r.meeting.time} · ${r.meeting.with}`;
  if (['svc', 'services', 'service'].includes(key) && (r.services || []).length)
    return 'שירותים: ' + r.services.map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k).join(', ');
  if (key === 'proposal' && (r.services || []).length && typeof svcTotals === 'function')
    return 'הצעת מחיר: ' + svcTotals(r.services).price + ' ₪';
  // בירור צורך — משקף את הקריטריונים שמולאו בפועל (אחרת השלב נראה "טרם מולא" גם כשמלא)
  if (['qualify', 'need', 'classify', 'diagnose'].includes(key) && typeof needsSummary === 'function') {
    const s = needsSummary(r);
    if (s.length) return s.join(' · ');
  }
  return STAGE_RESULT_SEED[key] || null;
}
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
    if (i === curIdx && recIsOverdue(r)) state = 'overdue';
    // שלב שטרם התחיל לא מציג תקציר/וי ירוק (אחרת "טרם התחיל" עם וי ביצוע — סתירה)
    let result = (state === 'todo') ? null : getStageResult(r, s.key);
    const noContent = state === 'done' && !result;   // "הושלם" בלי תוכן — לא מסמנים ככה (#1)
    return { ...s, state, idx: i, result, noContent };
  });
}
function servicesBarHTML(r) {
  const sel = r.services || [];
  if (typeof serviceRoute !== 'function') return '';
  if (!sel.length) return `<button class="svc-pick-btn" data-svcpick>${ic('tasks')} בחר שירות / מוצר <small>· לפני תיאום או רכישה</small> ${ic('chevronL')}</button>`;
  const route = serviceRoute(sel), tot = svcTotals(sel);
  return `<div class="svc-chosen-box">
    <div class="sc-top">${ic('tasks')} <b>שירותים / מוצרים נבחרים (${sel.length})</b> <span class="sc-route">${ROUTE_LBL[route]}</span></div>
    <div class="sc-list">${sel.map(k => `<span class="sc-chip">${cTreat(k) ? cTreat(k).label : k}<button class="sc-chip-x" data-svcremove="${k}" title="הסר מוצר">${ic('close')}</button></span>`).join('')}</div>
    <div class="sc-actions">
      <button class="sc-add" data-svcpick>${ic('plus')} הוסף מוצרים</button>
      <span class="sc-tot">${tot.dur} ד׳ · ${tot.price} ₪${tot.deposit ? ' · מקדמה ' + tot.deposit + '₪' : ''}</span>
    </div>
  </div>`;
}
/* הפקת הסכם מתוך השלב — אחרי בחירת מוצר. בוחרים תבנית ממערכת החוזים ומפיקים עם הנתונים שנשמרו. */
function contractIssueHTML(r) {
  if (!(r.services || []).length) return '';
  if (typeof CONTRACT_TEMPLATES === 'undefined') return '';
  const approved = CONTRACT_TEMPLATES.filter(c => c.legalApproved);
  if (!approved.length) return `<div class="hint-box" style="margin-top:10px">${ic('alert')} אין תבניות הסכם מאושרות — צור תבנית ב"מערכת חוזים".</div>`;
  const sel = r.contractTpl || approved[0].id;
  const issued = r.contractIssued;
  return `<div class="ct-issue">
    <div class="ct-issue-head">${ic('docs')} הפקת הסכם <small class="muted">· עם הנתונים שנשמרו בליד</small></div>
    <div class="ct-issue-row">
      <select class="cc-inp" data-ctpl>${approved.map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <button class="btn sm" data-ctprev>${ic('eye')} תצוגה מקדימה</button>
      <button class="btn sm primary" data-ctissue>${ic('whatsapp')} הפק ושלח בוואטסאפ</button>
    </div>
    ${issued ? `<div class="ct-issued">${ic('check')} הופק ונשלח · ${esc(issued.tplName)} · ${esc(issued.at)} · נשמר במסמכי הליד</div>` : ''}
  </div>`;
}
/* הפקה בפועל: שולח קישור חתימה בוואטסאפ + מכניס את המסמך לטאב "מסמכים" של הליד */
function issueContractForLead(r, tplId) {
  const c = (typeof contractById === 'function') ? contractById(tplId) : null;
  if (!c) { toast('נא לבחור תבנית הסכם'); return; }
  const at = (typeof docStamp === 'function') ? docStamp() : '';
  const name = `${c.name} — ${r.name}.pdf`;
  r.docs = r.docs || [];
  r.docs.unshift({ name, type: 'הסכם חתום', by: CURRENT_USER, at, contract: true, status: 'נשלח לחתימה' });
  r.contractTpl = tplId;
  r.contractIssued = { tplId, tplName: c.name, at };
  // רישום במרשם ההסכמים (סטטוס, טוקן, מסלול ביקורת) — תוספת, לא משנה את הזרימה הקיימת
  if (typeof ctRegisterIssue === 'function') { const rec = ctRegisterIssue(c, r); r.contractIssued.no = rec.no; if (r.docs && r.docs[0]) r.docs[0].contractNo = rec.no; }
  renderDrawerTab(r);
  toast(`ההסכם הופק · קישור חתימה נשלח ל${r.name} בוואטסאפ · המסמך נשמר במסמכי הליד`);
  if (typeof openContractSend === 'function') openContractSend(c, r);   // מעקב חי אחר שלבי הלקוח בקישור
}
function needsBtnHTML(r) {
  if (typeof openNeedsClarify !== 'function') return '';
  const n = r.needs || {}, active = Object.values(n).filter(Boolean);
  const map = { m: 'גבר', f: 'אישה', morning: 'בוקר', noon: 'צהריים', evening: 'אחה״צ' };
  const sum = active.length ? active.map(v => (typeof cBranch === 'function' && cBranch(v)) ? cBranch(v).label : (map[v] || v)).join(' · ') : '';
  return `<button class="needs-btn ${active.length ? 'done' : ''}" data-needs>${ic('tasks')}
    <span class="nb-lbl">בירור צורך</span>${sum ? `<span class="nb-sum">${esc(sum)}</span>` : `<small>· שאלות דינמיות לפי הקריטריונים</small>`} ${ic('chevronL')}</button>`;
}
function getStagePin() { try { return localStorage.getItem('cb_pinStages_' + CURRENT_USER) === '1'; } catch (e) { return false; } }
function setStagePin(v) { try { v ? localStorage.setItem('cb_pinStages_' + CURRENT_USER, '1') : localStorage.removeItem('cb_pinStages_' + CURRENT_USER); } catch (e) {} }
function flowHTML(r) {
  const stages = computeStages(r);
  const pinned = getStagePin();
  // מכווצים שלבים שהושלמו (יש תקציר ממילא); מציגים: שלבים לא-מולאו + הנוכחי + הבאים. נעץ = תמיד הכל.
  // חריג: "בחירת שירות / מוצר" תמיד גלוי כל עוד הוא במסלול — הפריטים הנבחרים חייבים להיות מול העיניים.
  // KEEP_STAGES_OPEN — רשימה שהרחבות יכולות להוסיף אליה (נשארת ריקה בלעדיהן)
  const ALWAYS_VISIBLE_STAGES = ['service', 'svc', 'services'].concat(window.KEEP_STAGES_OPEN || []);
  const isDoneFilled = s => s.state === 'done' && !s.noContent && !ALWAYS_VISIBLE_STAGES.includes(s.key);
  const completed = stages.filter(isDoneFilled);
  const visible = stages.filter(s => !isDoneFilled(s));
  const expander = (!pinned && completed.length) ? `
    <details class="flow-done-wrap">
      <summary class="flow-done-toggle">${ic('check')} ${completed.length} שלבים שהושלמו — לחצו להצגה<span class="fd-chev">${ic('chevron')}</span></summary>
      <div class="flow-done-list">${completed.map(s => accItem(s, r)).join('')}</div>
    </details>` : '';
  const body = pinned ? stages.map(s => accItem(s, r)).join('') : (expander + visible.map(s => accItem(s, r)).join(''));
  return `${clientSummaryCard(r)}
    ${holdCountdownHTML(r)}
    ${typeof dealProfileHTML === 'function' ? dealProfileHTML(r) : ''}
    <div class="sec-title">${ic('layers')} ציר הטיפול · מסלול ${JOURNEY_TYPES[r.journey].label}
      <button class="pin-btn ${pinned ? 'on' : ''}" data-pin-stages title="נעץ — הצג תמיד את כל השלבים (נשמר למשתמש שלך בכל החשבון)">${ic('flag')}</button>
      <button class="btn sm flow-custom" data-custom-stages>${ic('settings')} התאם שלבים</button></div>
    <div class="accordion" id="accordion">
      ${body}
    </div>`;
}
/* עורך שלבים: הוספה, הסרה ושינוי סדר (גרירה או חצים) */
function stageLocked(r, key, idx, len) {
  return idx === 0 || key === 'close';   // שלב ראשון + סגירה = חובה
}
function openStageCustomizer(r) {
  let flow = dynamicFlow(r).map(s => s.key);          // עותק עבודה — נשמר רק ב"החל"
  $('#modal').style.maxWidth = '460px'; $('#modal').style.height = '';
  const render = () => {
    const inFlow = new Set(flow);
    const addable = [...workflowFor(r.journey), ...EXTRA_STAGE_LIB].filter(s => !inFlow.has(s.key));
    $('#modal').innerHTML = `
      <div class="modal-head"><div class="title">${ic('settings')} התאמת שלבים · ${r.name}</div>
        <button class="close-btn" id="closeModal">${ic('close')}</button></div>
      <div class="modal-body">
        <div class="fu2-lbl">סדר השלבים במסלול — גרור לשינוי סדר, או השתמש בחצים</div>
        <div class="se-list" id="seList">
          ${flow.map((k, i) => { const s = stageByKey(r.journey, k); const locked = stageLocked(r, k, i, flow.length);
            return `<div class="se-row ${locked ? 'locked' : ''}" draggable="${!locked}" data-sek="${k}">
              <span class="se-grip" title="${locked ? 'שלב חובה' : 'גרור לשינוי סדר'}">${locked ? ic('flag') : ic('kebab')}</span>
              <span class="se-num">${i + 1}</span>
              <b class="se-title">${s.title}</b>
              ${locked ? '<small class="se-lock">חובה</small>' : `
                <button class="se-btn" data-seup="${i}" title="העבר למעלה" ${i <= 1 ? 'disabled' : ''}>${ic('chevron')}</button>
                <button class="se-btn dn" data-sedn="${i}" title="העבר למטה" ${i >= flow.length - 2 ? 'disabled' : ''}>${ic('chevron')}</button>
                <button class="se-btn rm" data-serm="${i}" title="הסר שלב">${ic('close')}</button>`}
            </div>`; }).join('')}
        </div>
        ${addable.length ? `<div class="fu2-lbl">הוסף שלב למסלול</div>
        <div class="se-add">
          ${addable.map(s => `<button class="se-add-btn" data-seadd="${s.key}" title="${s.desc || ''}">${ic('plus')} ${s.title}</button>`).join('')}
        </div>` : ''}
        <div class="succ-actions"><button class="btn" id="scCancel">בטל</button>
          <button class="btn primary" id="scSave">${ic('check')} החל שלבים</button></div>
      </div>`;
    $('#closeModal').addEventListener('click', closeModal);
    $('#scCancel').addEventListener('click', closeModal);
    $('#scSave').addEventListener('click', () => {
      r.customFlow = [...flow];
      closeModal();
      renderDrawerTab(r);
      toast(`השלבים הותאמו: ${flow.length} שלבים במסלול ✓`);
    });
    $$('#modal [data-seup]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.seup; [flow[i - 1], flow[i]] = [flow[i], flow[i - 1]]; render();
    }));
    $$('#modal [data-sedn]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.sedn; [flow[i + 1], flow[i]] = [flow[i], flow[i + 1]]; render();
    }));
    $$('#modal [data-serm]').forEach(b => b.addEventListener('click', () => {
      flow.splice(+b.dataset.serm, 1); render();
    }));
    $$('#modal [data-seadd]').forEach(b => b.addEventListener('click', () => {
      const closeIdx = flow.indexOf('close');
      flow.splice(closeIdx > 0 ? closeIdx : flow.length, 0, b.dataset.seadd); render();
    }));
    // גרירה לשינוי סדר
    let dragK = null;
    $$('#seList .se-row[draggable="true"]').forEach(row => {
      row.addEventListener('dragstart', e => { dragK = row.dataset.sek; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => { dragK = null; row.classList.remove('dragging'); });
    });
    $$('#seList .se-row').forEach(row => {
      row.addEventListener('dragover', e => { if (dragK && dragK !== row.dataset.sek) { e.preventDefault(); row.classList.add('drag-over'); } });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('drag-over');
        if (!dragK || dragK === row.dataset.sek) return;
        const from = flow.indexOf(dragK), to = flow.indexOf(row.dataset.sek);
        if (stageLocked(r, row.dataset.sek, to, flow.length) && (to === 0 || row.dataset.sek === 'close') && to === 0) return;
        flow.splice(from, 1);
        flow.splice(flow.indexOf(row.dataset.sek) + (from < to ? 1 : 0), 0, dragK);
        // שמירה על גבולות: ראשון וסגירה נשארים בקצוות
        if (flow.indexOf(dragK) === 0) { flow.splice(0, 1); flow.splice(1, 0, dragK); }
        const ci = flow.indexOf('close');
        if (ci > -1 && ci !== flow.length - 1) { flow.splice(ci, 1); flow.push('close'); }
        render();
      });
    });
  };
  render();
  $('#modalWrap').classList.add('open');
}

/* קליק ימני על שלב בציר — תפריט פעולות מבוקר (בלי מחיקה בטעות) */
function openStageContextMenu(e, r, key) {
  e.preventDefault();
  $('#stageCtx')?.remove();
  const flow = dynamicFlow(r).map(s => s.key);
  const i = flow.indexOf(key);
  const locked = stageLocked(r, key, i, flow.length);
  const menu = document.createElement('div');
  menu.className = 'minute-pop stage-ctx'; menu.id = 'stageCtx';
  menu.innerHTML = `
    <div class="mp-title">${stageByKey(r.journey, key)?.title || key}</div>
    ${locked ? `<div class="ctx-lock">${ic('flag')} שלב חובה — לא ניתן להסרה</div>` : `
      <button class="ctx-item" data-ctx="up" ${i <= 1 ? 'disabled' : ''}>${ic('chevron')} העבר למעלה</button>
      <button class="ctx-item" data-ctx="dn" ${i >= flow.length - 2 ? 'disabled' : ''}>${ic('chevron')} העבר למטה</button>
      <button class="ctx-item rm" data-ctx="rm">${ic('close')} הסר שלב מהמסלול</button>`}
    <button class="ctx-item" data-ctx="edit">${ic('settings')} התאם שלבים…</button>`;
  document.body.appendChild(menu);
  let top = e.clientY + 4, left = e.clientX - menu.offsetWidth + 10;
  if (top + menu.offsetHeight > window.innerHeight - 8) top = e.clientY - menu.offsetHeight - 4;
  menu.style.top = `${Math.max(8, top)}px`; menu.style.left = `${Math.max(8, left)}px`;
  const apply = (f) => { r.customFlow = f; renderDrawerTab(r); };
  menu.addEventListener('click', ev => {
    const a = ev.target.closest('[data-ctx]'); if (!a || a.disabled) return;
    closeStageCtx();
    if (a.dataset.ctx === 'edit') return openStageCustomizer(r);
    const f = [...flow];
    if (a.dataset.ctx === 'up') { [f[i - 1], f[i]] = [f[i], f[i - 1]]; apply(f); toast('השלב הועבר למעלה ✓'); }
    if (a.dataset.ctx === 'dn') { [f[i + 1], f[i]] = [f[i], f[i + 1]]; apply(f); toast('השלב הועבר למטה ✓'); }
    if (a.dataset.ctx === 'rm') { f.splice(i, 1); apply(f); toast(`השלב הוסר · ${f.length} שלבים במסלול`); }
  });
  setTimeout(() => document.addEventListener('click', closeStageCtxOutside), 0);
}
function closeStageCtxOutside(e) { const m = $('#stageCtx'); if (m && !m.contains(e.target)) closeStageCtx(); }
function closeStageCtx() { $('#stageCtx')?.remove(); document.removeEventListener('click', closeStageCtxOutside); }

/* ============================================================
   העברת טיפול לגורם אחר (אבחון תקלה / תיאום / טיפול) — זמין בכל המערכת (דסקטופ + מובייל)
   ============================================================ */
let transferState = { rec: null, target: null, reasons: new Set(), note: '' };
const TRANSFER_REASONS = ['אבחון תקלה', 'תיאום וטיפול', 'התמחות מקצועית', 'עומס / זמינות', 'אזור / סניף', 'הסלמה למנהל'];
const AVAIL_LBL = { available: 'פנוי', active: 'פעיל', offline: 'לא מחובר' };
function trInitials(name) { return (name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join(''); }
function openTransferLead(r) {
  transferState = { rec: r, target: null, reasons: new Set(), note: '' };
  renderTransferModal();
  $('#modalWrap').classList.add('open');
}
function renderTransferModal() {
  const r = transferState.rec;
  const groups = DEPARTMENTS.map(dp => {
    const members = STAFF.filter(s => s.dept === dp && s.name !== r.assignee);
    if (!members.length) return '';
    return `<div class="tr-group"><div class="tr-group-lbl">${dp}</div>
      ${members.map(s => `<button class="tr-person ${transferState.target === s.name ? 'on' : ''} ${s.avail === 'offline' ? 'off' : ''}" data-trperson="${esc(s.name)}">
        <span class="tr-av">${trInitials(s.name)}</span>
        <span class="tr-main"><b>${s.name}</b><small>${s.role} · <span class="tr-avail ${s.avail}">${AVAIL_LBL[s.avail] || s.avail}</span></small></span>
        <span class="tr-check">${transferState.target === s.name ? ic('check') : ''}</span>
      </button>`).join('')}
    </div>`;
  }).join('');
  $('#modal').style.maxWidth = '520px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('sync')}</span> העברת טיפול · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body transfer-body">
      <div class="tr-current">${ic('user')} מטפל נוכחי: <b>${r.assignee}</b></div>
      <div class="tr-sec-lbl">העבר אל גורם מטפל:</div>
      <div class="tr-people">${groups}</div>
      <div class="tr-sec-lbl">סיבת ההעברה (אופציונלי):</div>
      <div class="tr-reasons">${TRANSFER_REASONS.map(x => `<button class="tr-reason ${transferState.reasons.has(x) ? 'on' : ''}" data-trreason="${x}">${x}</button>`).join('')}</div>
      <div class="tr-note-wrap"><label class="tr-note-lbl">${ic('note')} הערה לגורם המטפל הנכנס</label>
        <textarea class="cc-inp" id="trNote" rows="2" placeholder="מה חשוב שהגורם הבא יידע — אבחון, מה נעשה עד כה, מה נדרש…">${esc(transferState.note)}</textarea></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" id="trCancel">ביטול</button>
      <button class="btn primary" id="trConfirm" ${transferState.target ? '' : 'disabled'}>${ic('sync')} העבר ${transferState.target ? 'ל' + transferState.target : 'לטיפול'}</button></div>`;
  const saveNote = () => { const n = $('#trNote'); if (n) transferState.note = n.value; };
  $('#closeModal').addEventListener('click', closeModal);
  $('#trCancel').addEventListener('click', closeModal);
  $$('[data-trperson]').forEach(b => b.addEventListener('click', () => {
    saveNote(); const nm = b.dataset.trperson;
    transferState.target = transferState.target === nm ? null : nm;
    renderTransferModal();
  }));
  $$('[data-trreason]').forEach(b => b.addEventListener('click', () => {
    saveNote(); const x = b.dataset.trreason;
    transferState.reasons.has(x) ? transferState.reasons.delete(x) : transferState.reasons.add(x);
    renderTransferModal();
  }));
  const cf = $('#trConfirm'); if (cf) cf.addEventListener('click', confirmTransfer);
}
function confirmTransfer() {
  const r = transferState.rec, to = transferState.target; if (!to) return;
  const from = r.assignee;
  transferState.note = ($('#trNote') ? $('#trNote').value : transferState.note) || '';
  r.assignee = to;
  const reasons = [...transferState.reasons], note = (transferState.note || '').trim();
  const parts = [`הועבר מ-${from} ל-${to}`];
  if (reasons.length) parts.push('סיבה: ' + reasons.join(', '));
  if (note) parts.push('הערה: ' + note);
  if (!r.commLog) r.commLog = buildCommLog(r);
  r.commLog.unshift({ type: 'note', at: nowStamp(), by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : 'משתמש'), text: '🔄 העברת טיפול · ' + parts.join(' · ') });
  closeModal();
  toast(`הטיפול הועבר ל${to} ✓`);
  if ($('#drawer') && $('#drawer').classList.contains('open')) openDrawer(r);   // רענון ה-Drawer עם המטפל החדש
  if (typeof renderList === 'function') renderList();
}

/* ============================================================
   זימון: משתתפים · הערות · קישור למפגש
   ============================================================ */
function ensureMeetingMeta(r) {
  const m = r.meeting; if (!m) return;
  if (!m.participants) {
    m.participants = [{ name: r.name, kind: 'external' }];
    const host = m.with && m.with !== r.name ? m.with : (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : 'אני');
    m.participants.push({ name: host, kind: 'internal' });
  }
  if (!m.link) m.link = 'https://meet.google.com/cbz-' + (r.id != null ? r.id : 'x') + '-mtg';
  if (!m.notes) m.notes = [];
}
function refreshDrawerMeeting(r) { if ($('#drawer') && $('#drawer').classList.contains('open')) { activeTab = 'flow'; renderDrawerTab(r); } }
let meetPartState = { rec: null, ext: '' };
function openMeetingParticipants(r) {
  ensureMeetingMeta(r);
  meetPartState = { rec: r, ext: '' };
  renderMeetingParticipants();
  $('#modalWrap').classList.add('open');
}
function renderMeetingParticipants() {
  const r = meetPartState.rec, m = r.meeting;
  const inMeeting = nm => m.participants.some(p => p.name === nm);
  const staff = (typeof STAFF !== 'undefined') ? STAFF : [];
  $('#modal').style.maxWidth = '500px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('clients')}</span> משתתפי הזימון · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body sm-body">
      <div class="sm-sub">משתתפים נוכחיים:</div>
      <div class="sm-parts">${m.participants.map((p, i) => `<span class="mtg-chip ${p.kind}">${p.kind === 'external' ? ic('mail') : ic('user')} ${esc(p.name)}${p.removable !== false ? ` <button class="mtg-chip-x" data-mtgrm="${i}" aria-label="הסר">${ic('close')}</button>` : ''}</span>`).join('')}</div>
      <div class="sm-sub" style="margin-top:14px">הוסף מהצוות (פנימי):</div>
      <div class="sm-parts">${staff.filter(s => !inMeeting(s.name)).map(s => `<button type="button" class="sm-part" data-mtgaddint="${esc(s.name)}">${ic('plus')} ${s.name} <small>· ${s.role}</small></button>`).join('') || '<span class="sm-sub">כל הצוות כבר מוזמן</span>'}</div>
      <div class="sm-sub" style="margin-top:14px">הוסף חיצוני (אימייל / שם):</div>
      <div class="mtg-ext-row"><input class="cc-inp" id="mtgExt" placeholder="name@email.com או שם" value="${esc(meetPartState.ext)}"><button class="btn sm primary" id="mtgExtAdd">${ic('plus')} הוסף</button></div>
    </div>
    <div class="modal-foot"><button class="btn primary block" id="mtgPartDone">${ic('check')} סיום</button></div>`;
  $('#closeModal').addEventListener('click', () => { closeModal(); refreshDrawerMeeting(r); });
  $('#mtgPartDone').addEventListener('click', () => { closeModal(); refreshDrawerMeeting(r); });
  $$('[data-mtgrm]').forEach(b => b.addEventListener('click', () => { m.participants.splice(+b.dataset.mtgrm, 1); renderMeetingParticipants(); }));
  $$('[data-mtgaddint]').forEach(b => b.addEventListener('click', () => { m.participants.push({ name: b.dataset.mtgaddint, kind: 'internal' }); renderMeetingParticipants(); toast(`${b.dataset.mtgaddint} נוסף לזימון`); }));
  $('#mtgExtAdd').addEventListener('click', () => {
    const v = ($('#mtgExt').value || '').trim(); if (!v) { toast('הזן אימייל או שם'); return; }
    m.participants.push({ name: v, kind: 'external' }); meetPartState.ext = ''; renderMeetingParticipants(); toast(`${v} הוזמן לזימון`);
  });
}
function openMeetingNote(r) {
  ensureMeetingMeta(r); const m = r.meeting;
  $('#modal').style.maxWidth = '460px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('note')}</span> הערה לזימון · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body">
      ${m.notes.length ? `<div class="mtg-notes-list">${m.notes.map(n => `<div class="mtg-note"><b>${esc(n.by)}</b> · ${esc(n.text)}</div>`).join('')}</div>` : ''}
      <div class="field" style="margin-top:10px"><label>הערה חדשה (גלויה לכל המשתתפים)</label>
        <textarea class="cc-inp" id="mtgNoteTxt" rows="3" placeholder="לדוגמה: להביא מסמכים, נקודות לדיון, קישור לחומר…"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" id="mtgNoteCancel">ביטול</button>
      <button class="btn primary" id="mtgNoteSave">${ic('check')} הוסף הערה</button></div>`;
  $('#closeModal').addEventListener('click', () => { closeModal(); refreshDrawerMeeting(r); });
  $('#mtgNoteCancel').addEventListener('click', () => { closeModal(); refreshDrawerMeeting(r); });
  $('#mtgNoteSave').addEventListener('click', () => {
    const t = ($('#mtgNoteTxt').value || '').trim(); if (!t) { toast('כתוב הערה'); return; }
    m.notes.push({ by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : 'משתמש'), text: t });
    closeModal(); toast('ההערה נוספה לזימון ✓'); refreshDrawerMeeting(r);
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
  const subLabel = s.noContent ? 'טרם מולא' : st.label;         // #1: לא "הושלם" בלי תוכן
  const subColor = s.noContent ? 'amber' : st.color;
  return `
    <div class="acc-item st-${s.state} ${open ? 'open' : ''} ${s.noContent ? 'no-content' : ''}" data-key="${s.key}">
      <button class="acc-head">
        <span class="state ${s.noContent ? 'amber' : st.color}">${s.noContent ? ic('alert') : stateIcon}</span>
        <span class="acc-lbl"><span class="label">${s.title}</span>${s.result ? `<span class="acc-summary">${ic('check')} ${esc(s.result)}</span>` : ''}</span>
        ${(() => { const nm = (typeof stageOwnerName === 'function') ? stageOwnerName(r, s.key) : '';
          return `<span class="stage-owner ${nm ? 'set' : ''}" data-stageowner="${s.key}" title="${nm ? 'אחראי: ' + esc(nm) + ' — לחץ לשינוי' : 'העבר שלב למטפל אחר'}">${ic('user')}${nm ? `<small>${esc(nm)}</small>` : ''}</span>`; })()}
        <span class="sub ${subColor}">${subLabel}</span>
        <span class="chev">${ic('chevron')}</span>
      </button>
      <div class="acc-panel"><div class="acc-panel-inner">${accBody(s, r)}</div></div>
    </div>`;
}
function accBody(s, r) {
  const k = s.key;
  // בירור צורך — שאלות דינמיות לפי הקריטריונים + אזור טקסט חופשי למידע חשוב
  if (['qualify', 'need', 'classify'].includes(k) && typeof needsQuestionsHTML === 'function')
    return `<div class="stage-needs">
        <p class="needs-hint">${ic('bolt')} השאלות נגזרות מהקריטריונים בהגדרות — רק הרלוונטיות מוצגות.</p>
        ${needsQuestionsHTML(r)}
        <div class="needs-q"><label class="needs-lbl">${ic('note')} מידע חשוב נוסף</label>
          <textarea class="cc-inp needs-free" data-needsfree rows="3" placeholder="פרטים חשובים מהלקוח שחשוב לא לפספס — רגישויות, אילוצים, בקשות מיוחדות…">${esc((r.needs || {}).note || '')}</textarea></div>
      </div>`;
  // בחירת שירות / מוצר — שלב נפרד אחרי בירור הצורך
  if (['service', 'svc'].includes(k) && typeof servicesBarHTML === 'function')
    return `<div class="stage-needs">
        <p class="needs-hint">${ic('tasks')} בחר את השירות/המוצר מהקטלוג — המערכת תנתב לתיאום / רכישה בהתאם.</p>
        ${typeof needsBannerHTML === 'function' ? needsBannerHTML(r, 'stage') : ''}
        ${servicesBarHTML(r)}
        ${contractIssueHTML(r)}
      </div>`;
  if (['meeting','call','offer','present'].includes(k)) {
    if (r.meeting) ensureMeetingMeta(r);
    const mt = r.meeting;
    return `<div class="meeting-box">
        <div class="line">${ic('calendar')} <b>${mt ? 'פגישה מתוכננת' : 'טרם נקבעה פגישה'}</b></div>
        ${mt ? `<div class="line">${ic('clock')} ${mt.date}, ${mt.time} · ${mt.dur} דק'</div>
        <div class="line">${ic('video')} ${mt.channel} · <button class="mtg-linkbtn" data-mtgjoin>${ic('video')} הצטרף</button><button class="mtg-linkbtn ghost" data-mtgcopy>${ic('note')} העתק קישור</button></div>
        <div class="mtg-sec">
          <div class="mtg-sec-head">${ic('clients')} משתתפים (${mt.participants.length})<button class="mtg-mini" data-mtgaddpart>${ic('plus')} הוסף</button></div>
          <div class="mtg-chips">${mt.participants.map(p => `<span class="mtg-chip ${p.kind}">${p.kind === 'external' ? ic('mail') : ic('user')} ${esc(p.name)}</span>`).join('')}</div>
        </div>
        <div class="mtg-sec">
          <div class="mtg-sec-head">${ic('note')} הערות הזימון (${mt.notes.length})<button class="mtg-mini" data-mtgaddnote>${ic('plus')} הוסף הערה</button></div>
          ${mt.notes.length ? mt.notes.map(n => `<div class="mtg-note"><b>${esc(n.by)}</b> · ${esc(n.text)}</div>`).join('') : `<div class="mtg-note empty">אין הערות עדיין — הוסף פרטים שחשוב שכל המשתתפים יראו</div>`}
        </div>` : ''}
        <div class="actions">
          <button class="btn sm primary" data-open="schedule">${ic('clock')} ${mt ? 'שנה מועד' : 'הצע זמנים'}</button>
          <button class="btn sm" data-open="calendar">${ic('calendar')} יומן מלא</button>
        </div></div>`;
  }
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
          ${list.some(c => c._saved === false) ? `<button class="btn sm primary" data-csave>${ic('check')} שמור אנשי קשר</button>` : ''}
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
  if (['proposal'].includes(k)) {
    const tot = (r.services || []).length && typeof svcTotals === 'function' ? svcTotals(r.services) : null;
    return `<div class="field-row">
        <div class="field"><label>סכום</label><input value="${tot ? tot.price.toLocaleString() + ' ₪' : '4,900 ₪'}"></div>
        <div class="field"><label>תוקף</label><input value="14 ימים"></div></div>
      <button class="btn sm">${ic('mail')} שלח הצעת מחיר</button>
      ${contractIssueHTML(r)}`;
  }
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
  $$('[data-svcpick]').forEach(b => b.addEventListener('click', () => { if (typeof openServiceSelect === 'function') openServiceSelect(r); }));
  if (typeof bindDealProfile === 'function') bindDealProfile(r, () => renderDrawerTab(r));
  // העברת שלב למטפל אחר (בעלות פר-שלב)
  $$('#accordion [data-stageowner]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof openStageOwnerPicker === 'function') openStageOwnerPicker(r, b.dataset.stageowner, () => renderDrawerTab(r));
  }));
  // שעון הנעילה בליד — המשך תהליך + רענון חי כל דקה
  const hb = $('[data-holdopen]'); if (hb) hb.addEventListener('click', () => {
    const h = r.slotHold; if (!h) return;
    const slot = (typeof coordPool === 'function') ? coordPool().find(x => x.id === h.slotId) : null;
    if (typeof openHoldPaymentPanel === 'function') openHoldPaymentPanel(r, slot, h);
  });
  if (r.slotHold && !window.__holdCdTimer) {
    window.__holdCdTimer = setInterval(() => {
      const el = document.querySelector('[data-holdcd]');
      if (!el || !r.slotHold) { clearInterval(window.__holdCdTimer); window.__holdCdTimer = null; return; }
      renderDrawerTab(r);
    }, 60000);
  }
  // הפקת הסכם מתוך השלב (אחרי בחירת מוצר)
  if (typeof bindNeedsBanner === 'function') bindNeedsBanner(r, () => renderDrawerTab(r));
  const ctpl = $('[data-ctpl]'); if (ctpl) ctpl.addEventListener('change', () => { r.contractTpl = ctpl.value; });
  const ctprev = $('[data-ctprev]'); if (ctprev) ctprev.addEventListener('click', () => {
    const id = (ctpl && ctpl.value) || r.contractTpl;
    const c = (typeof contractById === 'function') ? contractById(id) : null;
    if (!c) { toast('נא לבחור תבנית'); return; }
    if (typeof openContractWizard === 'function') openContractWizard(c, r, 'preview');
    else if (typeof openContractPreview === 'function') openContractPreview(c, r);
  });
  const ctiss = $('[data-ctissue]'); if (ctiss) ctiss.addEventListener('click', () => issueContractForLead(r, (ctpl && ctpl.value) || r.contractTpl));
  $$('[data-svcremove]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const k = b.dataset.svcremove, i = (r.services || []).indexOf(k);
    if (i >= 0) r.services.splice(i, 1);
    toast(`${cTreat(k) ? cTreat(k).label : k} הוסר`);
    renderDrawerTab(r);
  }));
  $$('#accordion [data-nq]').forEach(b => b.addEventListener('click', () => {   // בירור צורך — שאלות בתוך השלב
    r.needs = r.needs || {}; r.needs[b.dataset.nq] = b.dataset.nv;
    $$(`#accordion [data-nq="${b.dataset.nq}"]`).forEach(x => x.classList.toggle('on', x === b));
  }));
  const nf = $('#accordion [data-needsfree]');
  if (nf) nf.addEventListener('input', () => { r.needs = r.needs || {}; r.needs.note = nf.value; });
  $$('#accordion .acc-head').forEach(h => h.addEventListener('click', () =>
    h.closest('.acc-item').classList.toggle('open')));
  $$('#accordion .acc-item').forEach(a => a.addEventListener('contextmenu', e =>
    openStageContextMenu(e, r, a.dataset.key)));
  $$('[data-open="schedule"]').forEach(b => b.addEventListener('click', () => openSchedule(r)));   // פופ-אפ זמנים מוצעים (מחשב+נייד), עם אישור לפני שינוי
  $$('[data-open="calendar"]').forEach(b => b.addEventListener('click', () => {
    if (document.documentElement.classList.contains('cb-mobile')) return openProposedTimes(r);
    closeDrawer(); openCoordForRecord(r);
  }));
  $$('[data-open="ai"]').forEach(b => b.addEventListener('click', () => openAiOutcome(r)));
  // זימון: משתתפים · הערות · קישור
  $$('[data-mtgaddpart]').forEach(b => b.addEventListener('click', () => openMeetingParticipants(r)));
  $$('[data-mtgaddnote]').forEach(b => b.addEventListener('click', () => openMeetingNote(r)));
  $$('[data-mtgjoin]').forEach(b => b.addEventListener('click', () => { ensureMeetingMeta(r); toast('פותח את המפגש… ' + r.meeting.link); }));
  $$('[data-mtgcopy]').forEach(b => b.addEventListener('click', () => { ensureMeetingMeta(r); if (navigator.clipboard) navigator.clipboard.writeText(r.meeting.link).catch(() => {}); toast('קישור המפגש הועתק ✓'); }));
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
  const pb = $('#drawerBody [data-pin-stages]');
  if (pb) pb.addEventListener('click', () => { setStagePin(!getStagePin()); renderDrawerTab(r); toast(getStagePin() ? 'נעוץ · תמיד מוצגים כל השלבים' : 'שלבים שהושלמו מכווצים'); });
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
    dialTel(c.phone, c.name || 'איש הקשר');
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
    ['כתובת הלקוח', (typeof leadAddrText === 'function' && leadAddrText(r)) || '— לא נמסרה (נשמרת בבירור צורך)'],
  ];
  if (r.former) rows.push(['סיום שירות', r.former.endedAt], ['סיבת עזיבה', r.former.reason], ['מותר לפנות', r.former.allowContact ? 'כן' : 'לא']);
  return `<div class="kv">${rows.map(([k,v]) => `<div class="kv-row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
}
/* ============================================================
   9. תיעוד מול היסטוריה
   • תיעוד (log): שיחות, מעברי תהליך ואירועים משמעותיים (נרטיב אנושי)
   • היסטוריה (history): Audit מלא ברמת שדה — before/after, מי, מתי + איחזור
     כולל טיפול ב"שינוי מתגלגל" (cascade) על שדות מספריים
   ============================================================ */
const LEAD_HISTORY = {};
let HIST_SEQ = 500, HIST_CLOCK = 40;
function nowStamp() { HIST_CLOCK++; return `22/05 09:${String(HIST_CLOCK).padStart(2, '0')}`; }
function leadHistory(r) {
  if (LEAD_HISTORY[r.id]) return LEAD_HISTORY[r.id];
  if (r.points == null) r.points = 5;   // מונה מצטבר לדוגמה (נקודות מועדון) — למצב "שינוי מתגלגל"
  LEAD_HISTORY[r.id] = [
    { id: 'e1', kind: 'event',   at: '21/05 21:15', by: 'מערכת',    label: 'פתיחת ליד',        desc: 'נקלט ממקור: ' + (r.source || '—') },
    { id: 'e2', kind: 'process', at: '21/05 21:15', by: 'אוטומציה', label: 'שיוך נציג אוטומטי', desc: 'הוקצה ל-' + r.assignee + ' (סבב שוויוני)' },
    { id: 'e3', kind: 'field',   at: '21/05 21:16', by: 'יואב כהן', field: 'phone',  label: 'טלפון',  before: '050-0000000', after: r.phone },
    { id: 'e4', kind: 'field',   at: '22/05 08:45', by: 'יואב כהן', field: 'status', label: 'סטטוס',  before: 'ליד חדש', after: r.status.label },
    { id: 'p0', kind: 'field',   at: '16/05 09:00', by: 'מערכת',    field: 'points', label: 'נקודות מועדון', before: 0, after: 1, numeric: true },
    { id: 'p1', kind: 'field',   at: '17/05 09:00', by: 'יואב כהן', field: 'points', label: 'נקודות מועדון', before: 1, after: 0, numeric: true, note: 'אופס — אופס לאפס בטעות' },
    { id: 'p2', kind: 'field',   at: '18/05 09:00', by: 'אוטומציה', field: 'points', label: 'נקודות מועדון', before: 0, after: 1, numeric: true },
    { id: 'p3', kind: 'field',   at: '19/05 09:00', by: 'אוטומציה', field: 'points', label: 'נקודות מועדון', before: 1, after: 2, numeric: true },
    { id: 'p4', kind: 'field',   at: '20/05 09:00', by: 'אוטומציה', field: 'points', label: 'נקודות מועדון', before: 2, after: 3, numeric: true },
    { id: 'p5', kind: 'field',   at: '21/05 09:00', by: 'אוטומציה', field: 'points', label: 'נקודות מועדון', before: 3, after: 4, numeric: true },
    { id: 'p6', kind: 'field',   at: '22/05 09:00', by: 'אוטומציה', field: 'points', label: 'נקודות מועדון', before: 4, after: 5, numeric: true },
    { id: 'e5', kind: 'process', at: '22/05 08:46', by: 'אוטומציה', label: 'תזכורת SMS',        desc: 'אישור פגישה נשלח ללקוח' },
  ];
  return LEAD_HISTORY[r.id];
}
function getFieldValue(r, f) {
  if (f === 'status') return r.status.label;
  if (f === 'priority') return ({ high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' })[r.priority] || r.priority;
  return r[f];
}
function applyFieldValue(r, f, v) {
  if (f === 'status') r.status = { ...r.status, label: v };
  else if (f === 'priority') r.priority = ({ 'גבוהה': 'high', 'בינונית': 'medium', 'נמוכה': 'low' })[v] || r.priority;
  else r[f] = v;
}
function fieldEntriesAfter(r, e) {
  const h = leadHistory(r); const i = h.indexOf(e);
  return h.slice(i + 1).filter(x => x.kind === 'field' && x.field === e.field);
}
function applyRestore(r, e, newVal, modeLabel) {
  const cur = getFieldValue(r, e.field);
  applyFieldValue(r, e.field, newVal);
  e.restored = true;   // אי אפשר לאחזר שוב את האירוע הזה (אך הוא נשאר בהיסטוריה)
  leadHistory(r).push({ id: 'h' + (HIST_SEQ++), kind: 'field', at: nowStamp(), by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : 'משתמש'),
    field: e.field, label: e.label, before: cur, after: newVal, numeric: e.numeric,
    note: 'איחזור' + (modeLabel ? ' · ' + modeLabel : '') + ' (מאירוע ' + e.at + ')' });
  renderDrawerTab(r); renderList();
  toast(`"${e.label}" אוחזר → ${newVal}`);
}
function restoreField(r, entryId) {
  const e = leadHistory(r).find(x => x.id === entryId);
  if (!e || e.restored || e.kind !== 'field') return;
  const later = fieldEntriesAfter(r, e);
  if (!later.length) return applyRestore(r, e, e.before);   // אין שינויים אחריו — איחזור פשוט
  openRestoreChoiceModal(r, e, later);                      // יש שינויים עתידיים — בחירה מפורשת
}
function openRestoreChoiceModal(r, e, later) {
  const numeric = e.numeric;
  const sumDeltas = later.reduce((s, x) => s + (Number(x.after) - Number(x.before)), 0);
  const preserved = Number(e.before) + sumDeltas;   // אפשרות א' — כולל השינויים העתידיים
  const isolated = e.before;                          // אפשרות ב' — התעלמות מהשינויים העתידיים
  const curVal = getFieldValue(r, e.field);
  $('#modal').style.maxWidth = '480px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('history')}</span> איחזור "${e.label}"</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body rest-modal">
      <div class="rest-note">${ic('alert')} מאז השינוי הזה בוצעו <b>${later.length}</b> שינויים נוספים על "<b>${e.label}</b>". הערך כרגע: <b>${curVal}</b>. איך לאחזר?</div>
      ${numeric ? `
      <button class="rest-opt" data-rmode="preserve">
        <div class="ro-head"><span class="ro-ic keep">${ic('check')}</span> שמור את השינויים שנוספו אחריו</div>
        <div class="ro-desc">מתקן רק את השינוי השגוי ומחיל מחדש את ${later.length} השינויים שאחריו · תוצאה סופית: <b>${preserved}</b></div>
      </button>
      <button class="rest-opt" data-rmode="isolate">
        <div class="ro-head"><span class="ro-ic reset">${ic('history')}</span> החזר למצב ההוא בלבד</div>
        <div class="ro-desc">מתעלם מכל השינויים העתידיים ומחזיר לערך שהיה אז: <b>${isolated}</b></div>
      </button>` : `
      <button class="rest-opt" data-rmode="isolate">
        <div class="ro-head"><span class="ro-ic reset">${ic('history')}</span> החזר לערך "<b>${isolated}</b>"</div>
        <div class="ro-desc">שים לב: יש שינוי מאוחר יותר (${curVal}) שיוחלף בערך הזה.</div>
      </button>`}
      <button class="rest-opt ghost" data-rmode="cancel"><div class="ro-head">${ic('close')} ביטול</div></button>
    </div>`;
  $('#closeModal').addEventListener('click', closeModal);
  $$('[data-rmode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.rmode; closeModal();
    if (m === 'preserve') applyRestore(r, e, preserved, 'כולל שינויים עתידיים');
    else if (m === 'isolate') applyRestore(r, e, isolated, 'ללא שינויים עתידיים');
  }));
  $('#modalWrap').classList.add('open');
}
function historyHTML(r) {
  const hist = leadHistory(r).slice().reverse();   // חדש למעלה
  const km = { field: { ic: 'sync', c: 'blue' }, process: { ic: 'bolt', c: 'brand' }, event: { ic: 'flag', c: 'gray' } };
  return `<div class="sec-title">${ic('history')} היסטוריית שינויים · Audit מלא</div>
    <div class="hist-list">
      ${hist.map(e => { const k = km[e.kind] || km.event; return `
      <div class="hist-item">
        <span class="hi-ic ${k.c}">${ic(k.ic)}</span>
        <div class="hi-body">
          <div class="hi-top"><b>${e.label}</b><small>${e.at} · ${e.by}</small></div>
          ${e.kind === 'field'
            ? `<div class="hi-change"><span class="hc-before">${esc(String(e.before))}</span><span class="hc-arrow">←</span><span class="hc-after">${esc(String(e.after))}</span></div>${e.note ? `<div class="hi-note">${esc(e.note)}</div>` : ''}`
            : `<div class="hi-desc">${esc(e.desc || '')}</div>`}
        </div>
        ${e.kind === 'field'
          ? (e.restored ? `<span class="hi-restored">${ic('check')} אוחזר</span>` : `<button class="hi-restore" data-restore="${e.id}">${ic('history')} איחזור</button>`)
          : ''}
      </div>`; }).join('')}
    </div>
    <p class="hint">${ic('alert')} כל שינוי נשמר לצמיתות. "איחזור" נרשם כעדכון חדש ואינו מוחק את ההיסטוריה.</p>`;
}
function logHTML(r) {
  const items = (typeof COMM_LOG !== 'undefined') ? COMM_LOG : [];
  return `<div class="sec-title">${ic('note')} תיעוד · שיחות ותהליכים משמעותיים</div>
    <div class="field"><label>הוספת תיעוד</label><textarea id="logAdd" rows="2" placeholder="סיכום שיחה / הערה משמעותית…"></textarea></div>
    <button class="btn sm primary" id="logAddBtn">${ic('plus')} הוסף תיעוד</button>
    <div class="log-list">
      ${items.map(c => { const t = (typeof COMM_TYPES !== 'undefined' && COMM_TYPES[c.type]) || {}; return `
      <div class="log-item"><span class="li-ic ${t.color || 'gray'}">${ic(t.icon || 'note')}</span>
        <div class="li-body"><div class="li-top"><b>${t.label || 'הערה'}</b><small>${c.at} · ${c.by}</small></div>
        <div class="li-desc">${esc(c.text)}</div></div></div>`; }).join('')}
    </div>`;
}
function closeDrawer() {
  qaEdit = false;   // סגירת ליד → יציאה ממצב התאמת האייקונים (העין נסגרת עם הליד)
  drawerReturnFn = null;
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
  $('#openFullCal').addEventListener('click', () => { closeModal(); openCoordForRecord(r); });
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
/* initDevClock() + מנוע הזמן — במודול js/clock.js */

/* פופ-אפ אישור ממורכז (modal צף עצמאי) — מחליף את confirm() הנייטיב.
   שכבה משלו (#cbConfirmWrap) שצפה מעל ה-Drawer/proposePanel/modal — לא נוגע ב-#modal. */
function cbConfirm(opts) {
  const o = opts || {};
  const title = o.title || 'אישור', message = o.message || '',
        confirmLabel = o.confirmLabel || 'אישור', cancelLabel = o.cancelLabel || 'ביטול',
        icon = o.icon || 'alert', danger = !!o.danger, onConfirm = o.onConfirm;
  const old = document.getElementById('cbConfirmWrap'); if (old) old.remove();
  const w = document.createElement('div');
  w.id = 'cbConfirmWrap'; w.className = 'cbc-wrap';
  w.innerHTML = `
    <div class="cbc-box" role="dialog" aria-modal="true">
      <div class="cbc-head"><span class="cbc-ic ${danger ? 'danger' : ''}">${ic(icon)}</span><b>${title}</b></div>
      <div class="cbc-msg">${message}</div>
      <div class="cbc-actions">
        <button class="btn ghost" data-cbc="cancel">${cancelLabel}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-cbc="ok">${ic('check')} ${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(w);
  const close = () => w.remove();
  w.addEventListener('click', e => { if (e.target === w) close(); });   // לחיצה על הרקע = ביטול
  w.querySelector('[data-cbc="cancel"]').addEventListener('click', close);
  w.querySelector('[data-cbc="ok"]').addEventListener('click', () => { close(); if (typeof onConfirm === 'function') onConfirm(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  requestAnimationFrame(() => w.classList.add('open'));
}

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
  $('#bellIc').innerHTML = ic('bell');
  $('#bell').addEventListener('click', () => openAlertsDrawer());
  if (typeof updateBellBadge === 'function') updateBellBadge();
  const tIc = $('#tasksIc'); if (tIc) tIc.innerHTML = ic('tasks');
  const tBtn = $('#tasksBtn'); if (tBtn) tBtn.addEventListener('click', () => openTasksDrawer());
  bindGlobalSearch();
  if (typeof bindRowAlertPop === 'function') bindRowAlertPop();
  if (typeof updateTasksBadge === 'function') updateTasksBadge();
  renderNav(); renderTabs();
  // עמוד פתיחה שמור (לחיצה ארוכה על טאב) → נפתח ראשון; אחרת ברירת המחדל "ראשי"
  const home = getHomeNav();
  const homeEl = home && document.querySelector(`#nav .nav-item[data-nav="${home}"]`);
  if (homeEl) homeEl.click(); else renderUnifiedView();
  if (typeof initDock === 'function') initDock();   // צ'אט מוצמד בתחתית
  initDevClock();                                    // תג זמן-ייחוס לפיתוח
  $('#overlay').addEventListener('click', closeDrawer);
  $('#modalWrap').addEventListener('click', e => { if (e.target === $('#modalWrap')) closeModal(); });
}
/* רץ גם אם ה-DOM כבר נטען (בגרסה המשותפת) – setTimeout מבטיח שכל הסקריפטים כבר הוגדרו */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else setTimeout(boot, 0);
