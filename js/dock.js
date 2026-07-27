/* ============================================================
   CallBiz Manager – צ'אט מוצמד (Docked) בתחתית המסך
   נגיש מכל מסך · לראות שיחות/פניות קודמות · משתמש ב-CONVERSATIONS
   ============================================================ */
let dockOpen = false;
let dockConv = null;
let dockFilter = 'pending';   // דיפולט: ממתין לטיפול
function filteredConvsDock() {
  if (dockFilter === 'pending') return sortByRecent(CONVERSATIONS.filter(c => c.status === 'open' || c.status === 'live'));
  if (dockFilter === 'groups')  return sortByRecent(CONVERSATIONS.filter(c => c.kind === 'group'));
  if (dockFilter === 'closed')  return sortByRecent(CONVERSATIONS.filter(c => c.status === 'closed'));
  return sortByRecent(CONVERSATIONS);
}

function initDock() {
  if ($('#chatDock')) return;
  const el = document.createElement('div');
  el.id = 'chatDock';
  document.body.appendChild(el);
  renderDock();
  // כשנמצאים במסך הצ'אט המלא — האייקון הצף מוסתר; חוזר ביציאה מהמסך
  const host = $('#viewHost');
  if (host) new MutationObserver(updateDockVisibility).observe(host, { childList: true });
  updateDockVisibility();
}
function updateDockVisibility() {
  const d = $('#chatDock'); if (!d) return;
  const onChatScreen = !!$('#viewHost .plat');
  if (onChatScreen && dockOpen) closeChatDock();
  d.style.display = onChatScreen ? 'none' : '';
}
function renderDock() {
  const unread = CONVERSATIONS.reduce((s, c) => s + c.unread, 0);
  $('#chatDock').innerHTML = `
    ${dockOpen ? dockPanel() : ''}
    <button class="dock-btn ${dockOpen ? 'open' : ''}" id="dockBtn" title="צ'אט צוות">
      ${dockOpen ? ic('close') : ic('whatsapp')}
      ${!dockOpen && unread ? `<span class="dock-badge">${unread}</span>` : ''}
    </button>`;
  bindDock();
}
let dockAnim = false;   // אנימציה רק בפתיחה ראשונה של הפאנל
function dockPanel() {
  const anim = dockAnim ? ' anim' : '';
  // שיחה נפתחת לצד הרשימה (לא במקומה); בלי שיחה — רשימה בלבד
  if (dockConv === null || dockConv === false || dockConv === undefined || !CONVERSATIONS.find(c => c.id === dockConv))
    return `<div class="dock-panel${anim}">${dockListCol()}</div>`;
  // ב-RTL הילד הראשון = ימני: השיחה נפתחת מימין, הרשימה נשארת במקומה בלי שינוי
  return `<div class="dock-panel wide${anim}"><div class="dock-split">${dockConvView()}${dockListCol()}</div></div>`;
}
function dockListView() { return `<div class="dock-panel">${dockListCol()}</div>`; }
function dockListCol() {
  const list = filteredConvsDock();
  return `
    <div class="dock-list-col">
      <div class="dp-head">
        <div class="dp-brand">
          <span class="dp-logo">${ic('whatsapp')}</span>
          <div class="dp-brand-txt"><b>צ'אט צוות</b><small><i class="pdot" style="background:oklch(60% 0.16 145)"></i>זמין · נוכח בפורטל</small></div>
          <div class="dp-top-actions">
            ${document.documentElement.classList.contains('cb-mobile')
              ? `<button class="dp-tbtn" id="dockClose" title="סגור" aria-label="סגור">${ic('close')}</button>`
              : `<button class="dp-tbtn" id="dockExpand" title="מסך מלא">${ic('expand')}</button>`}
          </div>
        </div>
      </div>
      <div class="dp-btns">
        <button class="pbtn solid" id="dockNewConv">${ic('plus')} שיחה חדשה</button>
        <button class="pbtn ghost" id="dockNewGroup">קבוצה חדשה</button>
      </div>
      <div class="dp-search"><input placeholder="חיפוש לפי שם, נציג או פעילות…"><span>${ic('search')}</span></div>
      <div class="dp-pills">
        ${CHAT_FILTERS.map(f => `<button class="dp-pill ${dockFilter === f.key ? 'on' : ''}" data-dpf="${f.key}">${f.label} <span>${filterCount(f.key)}</span></button>`).join('')}
      </div>
      <div class="dp-body">
        ${list.length ? `<div class="dock-list">${list.map(dockConvRow).join('')}</div>`
          : `<div class="dp-empty"><span class="dpe-ic">${ic('check')}</span><b>אין שיחות בטיפול</b><small>סיימת לטפל בכל הצ'אטים 🎉</small></div>`}
      </div>
    </div>`;
}
function dockConvRow(c) {
  const pr = PRESENCE[c.presence];
  return `<button class="dock-conv ${c.id === dockConv ? 'on' : ''}" data-dconv="${c.id}">
    <span class="conv-av ${c.kind}">${c.kind === 'group' ? ic('clients') : c.name[0]}<span class="conv-dot" style="background:${pr.c}"></span></span>
    <span class="conv-info">
      <span class="conv-top"><b>${c.name}</b><small>${c.time}</small></span>
      <span class="conv-last">${c.last}</span>
    </span>
    ${c.unread ? `<span class="conv-badge">${c.unread}</span>` : ''}
  </button>`;
}
function dockConvView() {
  const c = CONVERSATIONS.find(x => x.id === dockConv);
  const pr = PRESENCE[c.presence];
  return `
    <div class="dock-conv-col">
      <div class="dock-head ${c.kind}">
        ${document.documentElement.classList.contains('cb-mobile') ? `<button class="dock-back" id="dockBack" title="חזרה" aria-label="חזרה">${ic('chevronR')}</button>` : ''}
        <span class="ca-badge">${c.kind === 'client' ? ic('whatsapp') + ' לקוח' : '🔒 פנימי'}</span>
        <div class="dock-recip"><span class="cc-dot" style="background:${pr.c};border:1.5px solid #fff"></span>
          <div><b>${c.name}</b><small>${c.activity}</small></div></div>
        ${c.recordId ? `<button class="lead-chip" data-goto-lead="${c.recordId}" title="פתח את הליד">${ic('user')} ${(RECORDS.find(x => x.id === c.recordId) || {}).name || 'לליד'}</button>` : ''}
      </div>
      <div class="dock-thread" id="dockThread">
        ${(() => { const mark = c.unreadMark || 0, at = c.thread.length - mark;
          return c.thread.map((m, i) => `${mark > 0 && i === at ? unreadDivHTML() : ''}${m.notice ? noticeCardHTML(m) : `<div class="cc-row ${m.me ? 'me' : 'them'}">
          <div class="cc-bubble ${m.me ? 'me' : 'them'} ${m.req ? 'req' : ''}">${esc(m.text)}</div>
          <div class="cc-meta">${m.who} · ${m.time}</div></div>`}`).join(''); })()}
      </div>
      <div class="cc-composer">
        <div class="cc-input-row">
          <textarea id="dockInput" rows="1" placeholder="${c.kind === 'client' ? 'הודעה ללקוח…' : 'הודעה פנימית…'}"></textarea>
          <button class="cc-send" id="dockSend" title="שלח" aria-label="שלח"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>
      </div>
    </div>`;
}
function bindDock() {
  $('#dockBtn').addEventListener('click', () => {
    dockOpen = !dockOpen; if (!dockOpen) dockConv = null;
    if (dockOpen) dockFilter = 'pending';   // תמיד נפתח על "ממתין לטיפול"
    dockAnim = dockOpen;            // אנימציה רק כשנפתח מחדש
    renderDock();
    dockAnim = false;
  });
  const exp = $('#dockExpand'); if (exp) exp.addEventListener('click', dockExpand);
  const dcl = $('#dockClose'); if (dcl) dcl.addEventListener('click', () => { dockOpen = false; dockConv = null; renderDock(); });
  const min = $('#dockMin'); if (min) min.addEventListener('click', () => { dockOpen = false; dockConv = null; renderDock(); });
  if (document.documentElement.classList.contains('cb-mobile')) attachDockSwipeDown();
  const nc = $('#dockNewConv'); if (nc) nc.addEventListener('click', () => { platView = 'contacts'; dockExpand(); });
  const ng = $('#dockNewGroup'); if (ng) ng.addEventListener('click', () => { platView = 'group'; newGroup = { name: '', members: [], sendPerm: 'all', addPerm: 'all' }; dockExpand(); });
  $$('[data-dpf]').forEach(b => b.addEventListener('click', () => { dockFilter = b.dataset.dpf; renderDock(); }));
  const back = $('#dockBack'); if (back) back.addEventListener('click', () => { dockConv = null; renderDock(); });
  $$('.dock-conv').forEach(b => b.addEventListener('click', () => {
    const id = +b.dataset.dconv;
    dockConv = dockConv === id ? null : id;   // לחיצה נוספת על אותה שיחה → הסתרה
    const c = CONVERSATIONS.find(x => x.id === id);
    if (c && dockConv === id) { c.unreadMark = c.unread; c.unread = 0; }   // סימון לקו "לא נקראה"
    renderDock();
  }));
  $$('[data-notice-rec]').forEach(b => b.addEventListener('click', () => openRecordFromChat(b.dataset.noticeRec)));
  $$('#chatDock [data-goto-lead]').forEach(b => b.addEventListener('click', () => openRecordFromChat(b.dataset.gotoLead)));
  const send = $('#dockSend'); if (send) send.addEventListener('click', dockSendMsg);
  const inp = $('#dockInput');
  if (inp) {
    /* בנייד/מגע: Enter = שורה חדשה (שולחים בכפתור). בדסקטופ: Enter שולח, Shift+Enter שורה */
    inp.addEventListener('keydown', e => {
      const mobile = (typeof isTouchDevice === 'function' && isTouchDevice()) || document.documentElement.classList.contains('cb-mobile');
      if (e.key === 'Enter' && !e.shiftKey && !mobile) { e.preventDefault(); dockSendMsg(); }
    });
    inp.addEventListener('input', () => autoGrowTA(inp));
  }
  const th = $('#dockThread'); if (th) th.scrollTop = th.scrollHeight;
}
/* החלקה קלה כלפי מטה בכל מקום בפאנל (כשהתוכן בראש הגלילה) → סגירת הצ'אט, כמו גיליון בטלפון */
function attachDockSwipeDown() {
  const panel = document.querySelector('#chatDock .dock-panel'); if (!panel) return;
  let startY = 0, startX = 0, dy = 0, dragging = false;
  panel.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { dragging = false; return; }
    startY = e.touches[0].clientY; startX = e.touches[0].clientX; dy = 0;
    // גרירה-לסגירה מותרת רק כשאזור הגלילה הפנימי כבר בראש (אחרת גוללים רגיל)
    const sc = e.target.closest('.dp-body, .dock-thread, .dock-list, .dock-list-col');
    dragging = !sc || sc.scrollTop <= 0;
    panel.style.transition = 'none';
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (dy > 0 && dy > Math.abs(dx)) {
      e.preventDefault();   // מונע שהמסך שמאחורי הצ'אט ייגלל בזמן הגרירה
      panel.style.transform = `translateY(${dy}px)`; panel.style.opacity = String(Math.max(0.55, 1 - dy / 650));
    } else if (dy < 0) { dragging = false; panel.style.transform = ''; panel.style.opacity = ''; }
  }, { passive: false });
  panel.addEventListener('touchend', () => {
    if (!dragging) return; dragging = false;
    panel.style.transition = 'transform .22s ease, opacity .22s ease';
    if (dy > 55) { panel.style.transform = 'translateY(100%)'; panel.style.opacity = '0'; setTimeout(() => { dockOpen = false; dockConv = null; renderDock(); }, 200); }
    else { panel.style.transform = ''; panel.style.opacity = ''; }
  });
}
function dockSendMsg() {
  const inp = $('#dockInput'); const txt = inp.value.trim(); if (!txt) return;
  const c = CONVERSATIONS.find(x => x.id === dockConv);
  c.thread.push({ me: true, text: txt, who: 'יואב', time: 'עכשיו' }); c.last = txt; touchConv(c); inp.value = '';
  renderDock();
  setTimeout(() => {
    const reply = c.kind === 'client' ? 'תודה! ✅' : 'קיבלתי 👍';
    c.thread.push({ me: false, text: reply, who: c.name, time: 'עכשיו' }); c.last = reply; touchConv(c);
    playChatSound();
    const focused = $('#dockThread') && dockConv === c.id;
    if ($('#dockThread')) renderDock(); else if (dockConv !== c.id) c.unread = (c.unread || 0) + 1;
    if (!focused) pushNotify({ title: c.name + (c.kind === 'client' ? ' (לקוח)' : ''), body: reply, cid: c.id });   // התראה קופצת אם לא צופים בשיחה
  }, 900);
}

/* יומן התראות — שומר כל התראה שקפצה כדי שאפשר לראות אותה שוב בפעמון גם אחרי סגירה */
let NOTIF_LOG = [];
function logNotif(o) {
  NOTIF_LOG.unshift({ title: o.title || 'הודעה', body: o.body || '', kind: o.kind || 'chat', cid: o.cid, recId: o.recId, read: false });
  if (NOTIF_LOG.length > 40) NOTIF_LOG.length = 40;
  // הודעת צ'אט → מוסיפים את ההודעה המדויקת לשרשור השיחה, כדי שלחיצה על ההתראה תיכנס בדיוק להודעה הזאת
  if ((o.kind === 'chat' || !o.kind) && o.cid != null && o.body && typeof CONVERSATIONS !== 'undefined') {
    const c = CONVERSATIONS.find(x => x.id === o.cid);
    if (c && Array.isArray(c.thread)) {
      const lastTxt = c.thread.length ? c.thread[c.thread.length - 1].text : null;
      if (lastTxt !== o.body) {
        c.thread.push({ me: false, text: o.body, who: c.name, time: 'עכשיו', _fromNotif: true });
        c.last = o.body; c.time = 'עכשיו'; c.unread = (c.unread || 0) + 1;
      }
    }
  }
  if (typeof updateBellBadge === 'function') updateBellBadge();
}
/* ---- התראות בסגנון אפליקציית הודעות — באנר קופץ מלמעלה, לחיץ ---- */
function pushNotify(o) {
  if (!o.__replay) logNotif(o);   // תיעוד ליומן (למעט הצגה חוזרת של דחיית תזכורת)
  // לא מקפיצים התראות כשהמשתמש כבר בתוך הצ'אט — dock פתוח או מסך הצ'אט המלא
  if ((typeof dockOpen !== 'undefined' && dockOpen) || document.querySelector('#viewHost .plat')) return;
  // לא מקפיצים בזמן שהמשתמש מקליד בחיפוש (חוסם/מוציא מהאנימציה) — הספירה באייקון עדיין עולה
  const _si = document.querySelector('.topbar .search input');
  if (_si && document.activeElement === _si) return;
  const isReminder = o.kind === 'reminder';
  // תזכורות למארח נפרד — כדי שבמחשב יופיעו למטה רחב, והצ'אט משמאל מעל אייקון הצ'אט
  const hostId = isReminder ? 'pushHostReminder' : 'pushHost';
  let host = document.getElementById(hostId);
  if (!host) { host = document.createElement('div'); host.id = hostId; document.body.appendChild(host); }
  const n = document.createElement('div'); n.className = 'push-note' + (isReminder ? ' reminder' : '');
  n.innerHTML = `<div class="pn-ic ${isReminder ? 'rem' : ''}">${ic(isReminder ? 'calendar' : 'whatsapp')}</div>
    <div class="pn-body"><b>${esc(o.title || 'הודעה חדשה')}</b><small>${esc(o.body || '')}</small>${isReminder ? `<span class="pn-hint">החלק מעלה = דחייה ב-5 דק׳</span>
      <div class="pn-actions">
        <button class="pn-btn primary" data-pn="open">פתח</button>
        <button class="pn-btn" data-pn="snooze">${ic('clock')} דחה 5 דק'</button>
        <button class="pn-btn ghost" data-pn="done">${ic('check')} בוצע</button>
      </div>` : ''}</div>
    <button class="pn-x" aria-label="סגור">${ic('close')}</button>`;
  host.appendChild(n);
  requestAnimationFrame(() => n.classList.add('in'));
  // תזכורת פגישה — לא נעלמת לבד עד תחילת הפגישה (אחרת אין משמעות לדחייה ב-5 דק׳). הודעות רגילות נשארות מספיק זמן לקריאה.
  let t = isReminder ? null : setTimeout(close, 11000);
  function close() { clearTimeout(t); n.classList.remove('in'); n.style.transition = 'transform .28s ease, opacity .28s ease'; n.style.transform = 'translateY(-140%)'; n.style.opacity = '0'; setTimeout(() => n.remove(), 300); }
  function snooze() { close(); if (typeof toast === 'function') toast('התזכורת נדחתה ב-5 דקות ⏰'); setTimeout(() => pushNotify(o), REMINDER_SNOOZE_MS); }
  n.querySelector('.pn-x').addEventListener('click', e => { e.stopPropagation(); close(); });
  if (isReminder) {
    n.querySelector('[data-pn="open"]').addEventListener('click', e => { e.stopPropagation(); close(); pnOpenReminderLead(o); });
    n.querySelector('[data-pn="snooze"]').addEventListener('click', e => { e.stopPropagation(); snooze(); });
    n.querySelector('[data-pn="done"]').addEventListener('click', e => { e.stopPropagation(); close(); if (typeof toast === 'function') toast('הפגישה סומנה כבוצעה ✓'); });
  }
  // גרירה כלפי מעלה → העלמה. passive:false + preventDefault כדי שהמסך שמאחור לא ייגלל
  let sy = 0, ny = 0, drag = false, moved = false;
  n.addEventListener('touchstart', e => { sy = e.touches[0].clientY; ny = 0; drag = true; moved = false; clearTimeout(t); n.style.transition = 'none'; }, { passive: true });
  n.addEventListener('touchmove', e => {
    if (!drag) return; ny = e.touches[0].clientY - sy; if (Math.abs(ny) > 6) moved = true;
    if (ny < 0) { e.preventDefault(); n.style.transform = `translateY(${ny}px)`; }   // רק החלקה מעלה — בלי לגלול רקע
  }, { passive: false });
  n.addEventListener('touchend', () => {
    if (!drag) return; drag = false;
    if (ny < -40) {
      if (isReminder) snooze();   // תזכורת פגישה — החלקה מעלה = דחייה ב-5 דק׳ וחזרה
      else close();
    } else { n.style.transition = 'transform .2s ease'; n.style.transform = ''; if (!isReminder) t = setTimeout(close, 6000); }   // תזכורת נשארת — בלי טיימר
  });
  n.addEventListener('click', e => {
    if (moved || e.target.closest('.pn-btn') || e.target.closest('.pn-x')) return;   // כפתורים מטופלים בנפרד
    close();
    if (isReminder) pnOpenReminderLead(o);        // תזכורת יומן — פותח את הליד ואת הזימון
    else openDockFromNotify(o.cid);               // הודעת צ'אט — פותח את השיחה עם האדם
  });
}
const REMINDER_SNOOZE_MS = 5 * 60 * 1000;   // דחיית תזכורת ב-5 דקות
/* תזכורת יומן: פתיחת הליד בלבד (בלי מסך התיאום) */
function pnOpenReminderLead(o) {
  const r = (typeof RECORDS !== 'undefined' && o.recId != null) ? RECORDS.find(x => x.id === o.recId) : null;
  if (!r) { if (typeof toast === 'function') toast('פותח את הפגישה…'); return; }
  if (typeof openDrawer === 'function') openDrawer(r);
}
function openDockFromNotify(cid) {
  dockOpen = true; if (cid) dockConv = cid;
  if ($('#chatDock')) renderDock();
  CONVERSATIONS.forEach(c => { if (c.id === cid) c.unread = 0; });
}
/* דמו: הודעות נכנסות שקופצות כמו התראות טלפון — הכותרת נגזרת מהשיחה עצמה כדי שהלחיצה תפתח את השיחה הנכונה */
(function demoNotifs() {
  if (typeof CONVERSATIONS === 'undefined') return;
  const internal = CONVERSATIONS.find(c => c.kind === 'internal');
  const client = CONVERSATIONS.find(c => c.kind === 'client');
  if (internal) setTimeout(() => pushNotify({ title: internal.name, body: 'שלחתי לך את פרטי הליד של דנה 📋', cid: internal.id }), 6500);
  if (client) setTimeout(() => pushNotify({ title: client.name + ' (לקוח)', body: 'מעולה, נתראה מחר ב-9:30 👍', cid: client.id }), 15000);
})();
setTimeout(() => pushNotify({ title: 'תזכורת פגישה · ישראל כהן', body: 'פגישה היום 09:30 · Google Meet', kind: 'reminder', recId: 1 }), 10000);   // תזכורת פגישה — נשארת עד פעולה; פתח/דחה 5 דק׳/בוצע
function closeChatDock() { dockOpen = false; dockConv = null; if ($('#chatDock')) renderDock(); }
function dockExpand() {
  closeChatDock();
  $$('#nav .nav-item').forEach(x => x.classList.remove('active'));
  const w = $('[data-nav="whatsapp"]'); if (w) w.classList.add('active');
  $$('#procTabs .proc-tab').forEach(x => x.classList.remove('active'));
  if (platView === 'list') enterChatPlatform(); else renderChatPlatform();
}
