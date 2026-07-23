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
            <button class="dp-tbtn" id="dockExpand" title="מסך מלא">${ic('expand')}</button>
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
          <button class="cc-send txt" id="dockSend">שלח</button>
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
  const min = $('#dockMin'); if (min) min.addEventListener('click', () => { dockOpen = false; dockConv = null; renderDock(); });
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
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dockSendMsg(); } });
    inp.addEventListener('input', () => autoGrowTA(inp));
  }
  const th = $('#dockThread'); if (th) th.scrollTop = th.scrollHeight;
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
    if ($('#dockThread')) renderDock(); else if (dockConv !== c.id) c.unread = (c.unread || 0) + 1;
  }, 900);
}
function closeChatDock() { dockOpen = false; dockConv = null; if ($('#chatDock')) renderDock(); }
function dockExpand() {
  closeChatDock();
  $$('#nav .nav-item').forEach(x => x.classList.remove('active'));
  const w = $('[data-nav="whatsapp"]'); if (w) w.classList.add('active');
  $$('#procTabs .proc-tab').forEach(x => x.classList.remove('active'));
  if (platView === 'list') enterChatPlatform(); else renderChatPlatform();
}
