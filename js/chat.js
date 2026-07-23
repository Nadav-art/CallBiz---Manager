/* ============================================================
   CallBiz Manager – חלון צ'אט (הצלבה עם "צ'אט צוות · קוליביז")
   מצב לקוח (חיצוני) + מצב התייעצות פנימית · עיצוב oklch כחול
   דורס את openWhatsApp מ-flows.js
   ============================================================ */

/* עמיתים להתייעצות פנימית (מבוסס על פלטפורמת הצ'אט) */
const CHAT_COLLEAGUES = [
  { id: 'ml',  name: 'מיכל רוזן', role: 'נציגת מכירות', presence: 'available', shared: 'מטפלת יחד בליד' },
  { id: 'dvd', name: 'דוד לוי',   role: 'מנהל מוקד',    presence: 'available', shared: 'מנהל ישיר' },
  { id: 'sa',  name: 'שרון אביב', role: 'שירות',        presence: 'active',    shared: null, needsRequest: true },
  { id: 'rl',  name: 'רותם לוי',  role: 'נציג',         presence: 'offline',   shared: 'צוות מכירות' },
];
const PRESENCE = {
  available: { c: 'oklch(60% 0.16 145)', label: 'זמין בפורטל' },
  active:    { c: 'oklch(58% 0.16 250)', label: 'פעיל · לא בדף' },
  offline:   { c: 'oklch(72% 0.02 250)', label: 'לא מחובר' },
};
const CHAT_EMOJIS = ['👍','🙏','✅','😊','💪','📅','📞','⏰','🔥','❗','💬','🤝'];

let chat = null;

/* ---- עזרים משותפים לכל הצ'אטים ---- */
/* עדכון "מגע אחרון" בשיחה — הצ'אט העדכני תמיד עולה למעלה */
function touchConv(c) { if (!c) return; c.ts = Date.now(); c.time = 'עכשיו'; }

/* גדילה אוטומטית עד ~4 שורות ואז גלילה; "שלח" נשאר בגובה שורה */
function autoGrowTA(ta, cap = 112) {
  ta.style.height = 'auto';
  const h = Math.min(ta.scrollHeight, cap);
  ta.style.height = h + 'px';
  ta.style.overflowY = ta.scrollHeight > cap ? 'auto' : 'hidden';
}
function unreadDivHTML() {
  return `<div class="unread-div"><i></i><span>הודעה שלא נקראה</span><i></i></div>`;
}
/* צליל התראה על הודעה נכנסת — נשמע גם כשנמצאים במסך/מערכת אחרת */
function playChatSound() {
  try {
    const ctx = window.__chatAC || (window.__chatAC = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.07;
    o.frequency.setValueAtTime(1174, ctx.currentTime + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch (e) { /* דפדפן חוסם אודיו לפני אינטראקציה */ }
  // חיווי גם בכותרת הטאב — למי שנמצא במערכת אחרת
  const t0 = 'CallBiz Manager – מסך עבודה אחוד';
  document.title = '💬 הודעה חדשה · CallBiz';
  clearTimeout(window.__titleT);
  window.__titleT = setTimeout(() => document.title = t0, 4000);
}

/* סנכרון מלא עם רשימת הצ'אטים: פתיחה בפופ-אפ = שיחה פתוחה בצ'אט צוות */
function nextConvId() { return Math.max(0, ...CONVERSATIONS.map(x => x.id)) + 1; }
function ensureConv(r, mode, colleague) {
  let c;
  if (mode === 'client') {
    c = CONVERSATIONS.find(x => x.kind === 'client' && x.recordId === r.id);
    if (!c) {
      c = { id: nextConvId(), name: r.name, kind: 'client', activity: 'לקוח · WhatsApp', recordId: r.id,
        presence: 'offline', unread: 0, last: '', time: 'עכשיו', status: 'open', thread: buildClientThread(r) };
      CONVERSATIONS.unshift(c);
    }
  } else {
    c = CONVERSATIONS.find(x => x.kind === 'internal' && x.name === colleague.name && x.recordId === r.id);
    if (!c) {
      c = { id: nextConvId(), name: colleague.name, kind: 'internal', activity: `התייעצות · ליד ${r.name}`, recordId: r.id,
        presence: colleague.presence || 'available', unread: 0, last: '', time: 'עכשיו', status: 'open', thread: [] };
      CONVERSATIONS.unshift(c);
    }
  }
  if (c.status === 'closed') c.status = 'open';   // פתיחה מחדש מהפופ-אפ
  touchConv(c);
  return c;
}
function syncChatUIs() {
  if (typeof renderDock === 'function' && document.querySelector('.dock-panel')) renderDock();
  if (document.querySelector('#viewHost .plat')) renderChatPlatform();
}

/* נקודת הכניסה – דורסת את openWhatsApp */
function openChat(r, mode = 'client') {
  chat = { r, mode, colleague: null, conv: null, thread: [], internalThread: [] };
  if (mode === 'client') {
    chat.conv = ensureConv(r, 'client', null);
    chat.thread = chat.conv.thread;             // אותו תיל — מסונכרן דו-כיוונית
    syncChatUIs();
  }
  $('#modal').style.maxWidth = '460px';
  $('#modal').style.height = '600px';
  renderChat();
  $('#modalWrap').classList.add('open');
}
function openWhatsApp(r) { openChat(r, 'client'); }        // שמירת תאימות לקריאות קיימות
function openConsult(r)  { openChat(r, 'internal'); }

/* ---- בניית שיחת לקוח לפי הזמנים בפועל של הרשומה ---- */
function ctxTime(r) {
  if (r.meeting) return `${r.meeting.date === '22/05/24' ? 'היום' : r.meeting.date} בשעה ${r.meeting.time}`;
  if (r.next?.at) return r.next.at;
  return 'בהקדם';
}
function buildClientThread(r) {
  const when = ctxTime(r);
  const chan = r.meeting?.channel || 'טלפון';
  return [
    { me: false, text: 'שלום, קיבלתי את הפרטים. מתי אפשר להיפגש?', who: r.name, time: '09:02' },
    { me: true,  text: `היי ${r.name.split(' ')[0]}, זה יואב. אשמח לתאם ${r.meeting ? 'פגישה' : 'שיחה'} ${when} ✅`, who: 'יואב', time: '09:03' },
    { me: false, text: 'מעולה, מתאים לי 👍', who: r.name, time: '09:04' },
    { me: true,  text: `שלחתי לך זימון ופרטים ל-${chan}. נתראה!`, who: 'יואב', time: '09:05' },
    ...(r.meeting ? [{ notice: true, kind: 'meeting', recordId: r.id, title: 'תזכורת פגישה', text: `${when} · ${chan}` }] : []),
  ];
}

function chatContext(r) {
  if (r.meeting) return `פגישה · ${ctxTime(r)}`;
  const na = NEXT_ACTIONS[r.next?.type];
  return na ? `${na.label} · ${r.next.at}` : 'פנייה פעילה';
}

/* ---- רינדור החלון ---- */
function renderChat() {
  const r = chat.r;
  const isInt = chat.mode === 'internal';
  $('#modal').innerHTML = `
    <div class="cbchat">
      <!-- טאבים: לקוח / התייעצות פנימית -->
      <div class="cc-tabs">
        <button class="cc-tab ${!isInt ? 'on' : ''}" data-cmode="client">${ic('whatsapp')} לקוח</button>
        <button class="cc-tab ${isInt ? 'on' : ''}" data-cmode="internal">${ic('clients')} התייעצות פנימית</button>
        <button class="close-btn cc-close" id="closeModal">${ic('close')}</button>
      </div>
      ${isInt ? internalHTML(r) : clientHTML(r)}
    </div>`;
  bindChat();
}

/* ---- מצב לקוח ---- */
function clientHTML(r) {
  return `
    <div class="cc-head client">
      <div class="cc-recip"><span class="cc-dot" style="background:oklch(60% 0.16 145)"></span>
        <div><b class="lead-click" data-goto-lead="${r.id}" title="פתח את הליד">${r.name}</b><small>${chatContext(r)} · WhatsApp</small></div>
      </div>
      <button class="cc-finish" id="ccFinish">סיים שיחה</button>
      <span class="cc-badge ext">${ic('whatsapp')} חיצוני</span>
    </div>
    <div class="cc-thread" id="ccThread">${threadHTML(chat.thread)}</div>
    ${composerHTML()}`;
}

/* ---- מצב התייעצות פנימית ---- */
function internalHTML(r) {
  if (!chat.colleague) return colleaguePicker(r);
  const col = chat.colleague, p = PRESENCE[col.presence];
  return `
    <div class="cc-head internal">
      <button class="cc-back" id="ccBack">${ic('chevronR')}</button>
      <div class="cc-recip"><span class="cc-dot" style="background:${p.c};border:1.5px solid #fff"></span>
        <div><b>${col.name}</b><small>${col.role} · ${p.label}</small></div>
      </div>
      <button class="cc-finish" id="ccFinish">סיים שיחה</button>
      <span class="cc-badge int">🔒 פנימי</span>
    </div>
    <div class="cc-context">${ic('note')} התייעצות על: <b class="lead-click" data-goto-lead="${r.id}" title="פתח את הליד">${r.name}</b> · ${r.subject}</div>
    <div class="cc-thread" id="ccThread">${threadHTML(chat.internalThread)}</div>
    ${composerHTML()}`;
}

function colleaguePicker(r) {
  const card = c => {
    const p = PRESENCE[c.presence];
    return `<button class="cc-col" data-col="${c.id}">
      <span class="cc-av">${c.name[0]}<span class="cc-av-dot" style="background:${p.c}"></span></span>
      <span class="cc-col-info"><b>${c.name} ${c.needsRequest ? '<span class="cc-req">דרושה בקשה</span>' : ''}</b>
        <small>${c.role} · ${p.label}</small>
        ${c.shared ? `<small class="cc-shared">↔ ${c.shared}</small>` : '<small class="cc-noshared">אין פעילות משותפת</small>'}</span>
    </button>`;
  };
  return `
    <div class="cc-picker">
      <div class="cc-note">${ic('alert')} שיחה פנימית בין עובדים — הלקוח אינו רואה אותה. עמית ללא פעילות משותפת דורש בקשת שיחה.</div>
      <input class="cc-search" placeholder="חיפוש עמית — שם, תפקיד או פעילות…">
      <div class="cc-col-title">אנשי קשר · צוות</div>
      <div class="cc-col-list">${CHAT_COLLEAGUES.map(card).join('')}</div>
      <div class="cc-legend">
        <span><i style="background:oklch(60% 0.16 145)"></i>זמין בפורטל</span>
        <span><i style="background:oklch(58% 0.16 250)"></i>פעיל · לא בדף</span>
        <span><i style="background:oklch(72% 0.02 250)"></i>לא מחובר</span>
      </div>
    </div>`;
}

function threadHTML(list) {
  if (!list.length) return `<div class="cc-empty">${ic('whatsapp')}<p>התחל את השיחה…</p></div>`;
  return list.map(m => m.notice ? noticeCardHTML(m) : `
    <div class="cc-row ${m.me ? 'me' : 'them'}">
      <div class="cc-bubble ${m.me ? 'me' : 'them'}">${esc(m.text)}</div>
      <div class="cc-meta">${m.who} · ${m.time}</div>
    </div>`).join('');
}

function composerHTML() {
  return `
    <div class="cc-composer">
      <div class="cc-emoji-row">${CHAT_EMOJIS.map(e => `<button class="cc-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>
      <div class="cc-input-row">
        <textarea id="ccInput" rows="1" placeholder="${chat.mode === 'internal' ? 'הודעה פנימית…' : 'כתבו הודעה…'}"></textarea>
        <button class="cc-send" id="ccSend">${ic('chevronL')}</button>
      </div>
    </div>`;
}

function bindChat() {
  $('#closeModal').addEventListener('click', closeModal);
  $$('.cc-tab').forEach(b => b.addEventListener('click', () => { chat.mode = b.dataset.cmode; renderChat(); }));
  $$('[data-notice-rec]').forEach(b => b.addEventListener('click', () => openRecordFromChat(b.dataset.noticeRec)));
  $$('.cbchat [data-goto-lead]').forEach(b => b.addEventListener('click', () => openRecordFromChat(b.dataset.gotoLead)));
  // סיים שיחה → עוברת ישר ל"סגורות" בצ'אט צוות
  const fin = $('#ccFinish');
  if (fin) fin.addEventListener('click', () => {
    if (chat.conv) { chat.conv.status = 'closed'; chat.conv.time = 'עכשיו'; syncChatUIs(); }
    closeModal();
    toast('השיחה הסתיימה והועברה ל"סגורות" ✓');
  });
  const back = $('#ccBack'); if (back) back.addEventListener('click', () => { chat.colleague = null; renderChat(); });
  $$('.cc-col').forEach(b => b.addEventListener('click', () => {
    const col = CHAT_COLLEAGUES.find(c => c.id === b.dataset.col);
    chat.colleague = col;
    chat.conv = ensureConv(chat.r, 'internal', col);
    chat.internalThread = chat.conv.thread;     // מסונכרן לרשימת הצ'אטים
    if (col.needsRequest && !chat.conv.thread.length) {
      chat.conv.thread.push({ me: true, text: `שלחתי בקשת שיחה בנושא "${chat.r.subject}"`, who: 'יואב', time: 'עכשיו', req: true });
      chat.conv.last = 'בקשת שיחה נשלחה';
      toast(`בקשת שיחה נשלחה ל${col.name} (אין פעילות משותפת)`);
    }
    syncChatUIs();
    renderChat();
  }));
  $$('.cc-emoji').forEach(b => b.addEventListener('click', () => { const i = $('#ccInput'); if (i) i.value += b.dataset.emoji; i.focus(); }));
  const send = $('#ccSend'); if (send) send.addEventListener('click', sendChatMsg);
  const inp = $('#ccInput');
  if (inp) {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(); } });
    inp.addEventListener('input', () => autoGrowTA(inp));
  }
  const th = $('#ccThread'); if (th) th.scrollTop = th.scrollHeight;
}

function sendChatMsg() {
  const inp = $('#ccInput'); const txt = inp.value.trim(); if (!txt) return;
  const list = chat.mode === 'internal' ? chat.internalThread : chat.thread;
  list.push({ me: true, text: txt, who: 'יואב', time: 'עכשיו' });
  if (chat.conv) { chat.conv.last = txt; touchConv(chat.conv); syncChatUIs(); }
  inp.value = '';
  renderChat();
  // תגובה מדומה מהצד השני
  setTimeout(() => {
    const who = chat.mode === 'internal' ? (chat.colleague?.name || 'עמית') : chat.r.name;
    const reply = chat.mode === 'internal' ? 'קיבלתי, אני בודק ומעדכן 👍' : 'תודה! מאשר ✅';
    list.push({ me: false, text: reply, who, time: 'עכשיו' });
    if (chat && chat.conv) { chat.conv.last = reply; touchConv(chat.conv); syncChatUIs(); }
    playChatSound();
    if ($('#ccThread')) renderChat();
  }, 900);
}
