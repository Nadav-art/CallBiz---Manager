/* ============================================================
   CallBiz Manager – פלטפורמת "צ'אט צוות" (עיצוב מלא לפי ה-ZIP)
   מסך ראשי · שיחה חדשה (אנשי קשר→פעילות) · קבוצה חדשה · שיחה · ניהול
   ============================================================ */

let platView = 'list';      // list | contacts | activity | group | conv | admin
let platFilter = 'pending'; // דיפולט: ממתין לטיפול

/* כניסה למסך הצ'אט: דיפולט "ממתין לטיפול" + פתיחה אוטומטית על הצ'אט הראשון */
function enterChatPlatform() {
  platFilter = 'pending'; adminDetail = null;
  const list = filteredConvs();
  if (list.length) {
    platActive = list[0].id;
    const c = list[0]; c.unreadMark = c.unread; c.unread = 0;
    platView = 'conv';
  } else platView = 'list';
  renderChatPlatform();
}
let platActive = 1;
let newConvContact = null;
let newGroup = { name: '', members: [], sendPerm: 'all', addPerm: 'all' };
let platTyping = false;

const CHAT_CONTACTS = [
  { id: 'c1', name: 'נדב כהן',   role: 'מנהל פעילות', activity: 'אשר פרסום', presence: 'available', hours: '08:00–17:00', initials: 'נכ' },
  { id: 'c2', name: 'אורלי עוזרי', role: 'נציגת שירות', activity: 'אינטגרציה א׳', presence: 'available', hours: '09:00–15:00', initials: 'או' },
  { id: 'c3', name: 'דנה שרון',  role: 'משאבי אנוש', activity: 'HR רווחה', presence: 'available', hours: '09:00–16:00', initials: 'דש' },
  { id: 'c4', name: 'יוסי מלכה', role: 'נציג מכירות', activity: 'גיוס לקוחות', presence: 'available', hours: '10:00–19:00', initials: 'ימ', moved: 'עבר פעילות · נציג מסחר' },
  { id: 'c5', name: 'משה לוי',   role: 'מנהל פעילות', activity: 'מיכל שירות', presence: 'active', hours: '08:00–17:00', initials: 'מל' },
  { id: 'c6', name: 'שלמה דגן',  role: 'מנהל פעילות', activity: 'רונית שירות', presence: 'offline', hours: '—', initials: 'שד' },
];
const CHAT_ACTIVITIES = [
  { id: 'a1', name: 'אשר פרסום', icon: 'docs' },
  { id: 'a2', name: 'לקוחות',    icon: 'clients' },
];
const CHAT_FILTERS = [
  { key: 'all',     label: 'הכל',          icon: 'tasks' },
  { key: 'pending', label: 'ממתין לטיפול', icon: 'clock' },
  { key: 'groups',  label: 'קבוצות',       icon: 'clients' },
  { key: 'closed',  label: 'סגורות',       icon: 'check' },
];

const CONVERSATIONS = [
  { id: 1, ts: 4, name: 'מיכל רוזן', kind: 'internal', activity: 'התייעצות · ליד ישראל כהן', recordId: 1, presence: 'available', unread: 2, last: 'קיבלתי, אני בודק ומעדכן', time: '09:41', status: 'live',
    thread: [
      { me: false, text: 'מה המצב עם ההצעה לישראל כהן?', who: 'מיכל', time: '09:38' },
      { me: true, text: 'שלחתי הצעת מחיר, מחכה לתשובה עד מחר', who: 'יואב', time: '09:40' },
      { me: false, text: 'קיבלתי, אני בודק ומעדכן', who: 'מיכל', time: '09:41' },
    ] },
  { id: 2, ts: 3, name: 'דוד לוי', kind: 'internal', activity: 'מנהל מוקד', presence: 'available', unread: 0, last: 'אישרתי את החריגה', time: '09:15', status: 'open',
    thread: [
      { me: false, text: 'צריך אישור לתור ב-17:30 (חריגת עומס)', who: 'דוד', time: '09:10' },
      { me: true, text: 'תודה, זה ללקוח VIP', who: 'יואב', time: '09:12' },
      { me: false, text: 'אישרתי את החריגה ✅', who: 'דוד', time: '09:15' },
    ] },
  { id: 3, ts: 2, name: 'צוות מכירות', kind: 'group', activity: '5 חברים', presence: 'available', unread: 1, last: 'מיכל: מי לוקח את הליד?', time: '08:50', status: 'open',
    thread: [{ me: false, text: 'מי לוקח את הליד החדש מגוגל?', who: 'מיכל', time: '08:50' }] },
  { id: 4, ts: 1, name: 'ישראל כהן', kind: 'client', activity: 'לקוח · WhatsApp', presence: 'offline', unread: 1, last: 'תזכורת: פגישה היום 09:30', time: '08:15', status: 'open', recordId: 1,
    thread: [
      { me: false, text: 'שלום, קיבלתי את הפרטים לפגישה', who: 'ישראל', time: 'אתמול 16:20' },
      { me: true, text: 'מעולה, נתראה מחר!', who: 'יואב', time: 'אתמול 16:22' },
      { notice: true, kind: 'meeting', recordId: 1, title: 'תזכורת פגישה', text: 'היום 09:30 · Google Meet · ישראל כהן' },
    ] },
];

/* ---------- מונים ---------- */
/* הצ'אט עם התקשורת העדכנית ביותר — תמיד למעלה */
function sortByRecent(list) { return [...list].sort((a, b) => (b.ts || 0) - (a.ts || 0)); }
function filteredConvs() {
  if (platFilter === 'pending') return sortByRecent(CONVERSATIONS.filter(c => c.status === 'open' || c.status === 'live'));
  if (platFilter === 'groups')  return sortByRecent(CONVERSATIONS.filter(c => c.kind === 'group'));
  if (platFilter === 'closed')  return sortByRecent(CONVERSATIONS.filter(c => c.status === 'closed'));
  return sortByRecent(CONVERSATIONS);
}
function filterCount(key) {
  if (key === 'pending') return CONVERSATIONS.filter(c => c.status === 'open' || c.status === 'live').length;
  if (key === 'groups')  return CONVERSATIONS.filter(c => c.kind === 'group').length;
  if (key === 'closed')  return CONVERSATIONS.filter(c => c.status === 'closed').length;
  return CONVERSATIONS.length;
}

/* ============================================================ */
function renderChatPlatform() {
  if (platView === 'admin') { $('#viewHost').innerHTML = `<div class="plat">${platHeaderHTML()}${platAdminHTML()}</div>`; return bindPlatform(); }
  let body = '';
  if (platView === 'list')     body = platListHTML();
  if (platView === 'contacts') body = platContactsHTML();
  if (platView === 'activity') body = platActivityHTML();
  if (platView === 'group')    body = platGroupHTML();
  if (platView === 'conv')     body = platSplitHTML();   // שיחה לצד הרשימה, לא במקומה
  $('#viewHost').innerHTML = `<div class="plat">${platHeaderHTML()}${body}</div>`;
  bindPlatform();
}

/* ---------- כותרת ראשית ---------- */
function platHeaderHTML() {
  return `
    <div class="plat-head">
      <div class="plat-brand">
        <span class="plat-logo">${ic('whatsapp')}</span>
        <div><b>צ'אט צוות</b><small><i class="pdot" style="background:oklch(60% 0.16 145)"></i>זמין · נוכח בפורטל</small></div>
      </div>
      <div class="plat-head-actions">
        ${platView === 'admin'
          ? `<button class="pbtn solid" data-pv="admin">${ic('layers')} ניהול ובקרה</button>
             <button class="pbtn ghost" data-pv="list">${ic('whatsapp')} צ'אט</button>`
          : `<button class="pbtn ghost" data-pv="admin">${ic('layers')} ניהול ובקרה</button>
             <button class="pbtn ghost" data-pv="group">${ic('clients')} קבוצה חדשה</button>
             <button class="pbtn solid" data-pv="contacts">${ic('plus')} שיחה חדשה</button>`}
      </div>
    </div>`;
}

/* ---------- מסך ראשי: חיפוש + פילטרים + רשימה/ריק ---------- */
function platListHTML() {
  const list = filteredConvs();
  return `
    <div class="plat-search"><span>${ic('search')}</span><input placeholder="חיפוש לפי שם, נציג או פעילות…"></div>
    <div class="plat-pills">
      ${CHAT_FILTERS.map(f => `<button class="ppill ${platFilter === f.key ? 'on' : ''}" data-pf="${f.key}">
        ${ic(f.icon)} ${f.label} <span class="pc">${filterCount(f.key)}</span></button>`).join('')}
    </div>
    <div class="plat-list-card">
      ${list.length ? `<div class="conv-list wide">${list.map(convRowHTML).join('')}</div>`
        : `<div class="plat-empty">
            <span class="pe-ic">${ic('whatsapp')}</span>
            <b>אין שיחות בקטגוריה זו</b>
            <small>סיימת לטפל בכל הצ'אטים</small>
          </div>`}
    </div>`;
}
function convRowHTML(c, active) {
  const pr = PRESENCE[c.presence];
  return `<button class="conv ${active ? 'on' : ''}" data-openconv="${c.id}">
    <span class="conv-av ${c.kind}">${c.kind === 'group' ? ic('clients') : c.name[0]}<span class="conv-dot" style="background:${pr.c}"></span></span>
    <span class="conv-info">
      <span class="conv-top"><b>${c.name}</b><small>${c.time}</small></span>
      <span class="conv-ctx">${c.kind === 'client' ? ic('whatsapp') : ''}${c.activity}</span>
      <span class="conv-last">${c.last}</span>
    </span>
    ${c.unread ? `<span class="conv-badge">${c.unread}</span>` : ''}
  </button>`;
}

/* ---------- שיחה חדשה: אנשי קשר ---------- */
function platContactsHTML() {
  const card = c => {
    const pr = PRESENCE[c.presence];
    const avail = c.presence === 'available' ? `<span class="ct-avail on">זמין ${c.hours}</span>`
      : c.presence === 'active' ? `<span class="ct-avail on">זמין · ${c.hours}</span>`
      : `<span class="ct-avail off">לא זמין כעת</span>`;
    return `<button class="ct-card" data-contact="${c.id}">
      <span class="ct-arrow">${ic('chevronR')}</span>
      <span class="ct-info"><b>${c.name}</b><small>מנהל פעילות: ${c.activity}</small>${avail}${c.moved ? `<small class="ct-moved">↪ ${c.moved}</small>` : ''}</span>
      <span class="ct-av">${c.initials}<span class="ct-dot" style="background:${pr.c}"></span></span>
    </button>`;
  };
  return `
    <div class="plat-sub">
      <div class="plat-sub-head"><b>שיחה חדשה · אנשי קשר</b>
        <button class="plat-back" data-pv="list">${ic('chevronR')} חזרה</button></div>
      <div class="plat-search"><span>${ic('search')}</span><input placeholder="חיפוש איש קשר — שם, תפקיד או פעילות…"></div>
      <button class="ct-general" data-contact="general">
        <span class="ct-arrow">${ic('chevronR')}</span>
        <span class="ct-info"><b>שיחה כללית</b><small>ללא שיוך לפעילות</small></span>
        <span class="ct-gicon">${ic('whatsapp')}</span>
      </button>
      <div class="plat-sec-title">אנשי קשר אחרונים</div>
      <div class="ct-list">${CHAT_CONTACTS.map(card).join('')}</div>
    </div>`;
}

/* ---------- בחירת פעילות לשיחה ---------- */
function platActivityHTML() {
  const c = newConvContact;
  const pr = PRESENCE[c.presence];
  return `
    <div class="plat-sub">
      <div class="plat-sub-head"><b>שיחה חדשה · אנשי קשר</b>
        <button class="plat-back" data-pv="contacts">${ic('chevronR')} חזרה לאנשי הקשר</button></div>
      <div class="ct-selected">
        <span class="ct-av lg">${c.initials}<span class="ct-dot" style="background:${pr.c}"></span></span>
        <div><b>${c.name}</b><small>מנהל פעילות: ${c.activity}</small><small class="ct-avail on">זמין ${c.hours}</small></div>
      </div>
      <div class="plat-list-card pad">
        <div class="plat-open-title"><b>פתיחת שיחה</b><small>בחרו לאיזו פעילות לשייך את השיחה</small></div>
        ${CHAT_ACTIVITIES.map(a => `<button class="act-card" data-act="${a.name}">
          <span class="ct-arrow">${ic('chevronR')}</span>
          <b>${a.name}</b><span class="act-ic">${ic(a.icon)}</span></button>`).join('')}
        <button class="act-card general" data-act="שיחה כללית">
          <span class="ct-arrow">${ic('chevronR')}</span>
          <span class="act-gen"><b>שיחה כללית</b><small>ללא שיוך לפעילות</small></span><span class="act-ic">${ic('whatsapp')}</span></button>
      </div>
      <button class="pbtn ghost block" data-pv="contacts">ביטול</button>
    </div>`;
}

/* ---------- קבוצה חדשה ---------- */
function platGroupHTML() {
  return `
    <div class="plat-sub">
      <div class="plat-sub-head grp"><span class="grp-ic">${ic('clients')}</span>
        <div><b>קבוצה חדשה</b><small>צור קבוצה והוסף חברים בקלות</small></div>
        <button class="plat-back" data-pv="list">${ic('close')}</button></div>
      <label class="grp-lbl">שם הקבוצה <span class="req">*</span></label>
      <input class="grp-in" id="grpName" placeholder="לדוגמה: צוות מכירות – בקרת שעות" value="${newGroup.name}">
      <label class="grp-lbl">משתתפים (הצוות/הראש/ה)</label>
      <div class="plat-search"><span>${ic('search')}</span><input id="grpSearch" placeholder="הקלד/י שם, בחר/י מהרשימה…"></div>
      <div class="grp-members">${newGroup.members.length ? newGroup.members.map((m, i) => {
        const c = CHAT_CONTACTS.find(x => x.id === m) || {};
        return `<div class="grp-mem"><span class="ct-av sm">${c.initials || '??'}</span>
          <div class="grp-mem-info"><b>${c.name || ''}</b><small>${c.role || ''} · ${c.activity || ''}</small></div>
          <button class="grp-x" data-grpx="${m}">${ic('close')}</button></div>`;
      }).join('') : `<div class="grp-pick">${CHAT_CONTACTS.slice(0, 4).map(c => `<button class="grp-add" data-grpadd="${c.id}">${ic('plus')} ${c.name}</button>`).join('')}</div>`}</div>
      <div class="grp-perms">
        <div class="grp-perms-head">${ic('user')} הרשאות הקבוצה</div>
        ${[['send', 'מי יכול לשלוח הודעות'], ['add', 'מי יכול להוסיף משתתפים']].map(([k, lbl]) => `
          <div class="grp-perm-row"><span>${lbl}</span>
            <div class="seg2">
              <button class="seg2-b ${newGroup[k + 'Perm'] === 'all' ? 'on' : ''}" data-perm="${k}:all">כל המשתתפים</button>
              <button class="seg2-b ${newGroup[k + 'Perm'] === 'mgr' ? 'on' : ''}" data-perm="${k}:mgr">מנהלים בלבד</button>
            </div></div>`).join('')}
      </div>
      <div class="grp-actions">
        <button class="pbtn ghost" data-pv="list">ביטול</button>
        <button class="pbtn solid" id="grpCreate">${ic('plus')} צור קבוצה</button>
      </div>
    </div>`;
}

/* ---------- פריסת שיחה + רשימה זו לצד זו ---------- */
function platSplitHTML() {
  const list = filteredConvs();
  return `
    <div class="plat-split">
      <aside class="ps-side">
        <div class="plat-search side"><span>${ic('search')}</span><input placeholder="חיפוש לפי שם, נציג או פעילות…"></div>
        <div class="ps-pills">
          ${CHAT_FILTERS.map(f => `<button class="ps-pill ${platFilter === f.key ? 'on' : ''}" data-pf="${f.key}">${f.label} <span>${filterCount(f.key)}</span></button>`).join('')}
        </div>
        <div class="ps-list">
          ${list.length ? list.map(c => convRowHTML(c, c.id === platActive)) .join('')
            : `<div class="plat-empty small"><b>אין שיחות בקטגוריה זו</b></div>`}
        </div>
      </aside>
      ${platConvHTML()}
    </div>`;
}

/* ---------- שיחה פעילה ---------- */
function platConvHTML() {
  const c = CONVERSATIONS.find(x => x.id === platActive) || CONVERSATIONS[0];
  const pr = PRESENCE[c.presence];
  return `
    <div class="conv-full">
      <div class="cf-head ${c.kind}">
        <button class="plat-back light" data-pv="list">${ic('chevronR')}</button>
        <div class="cf-recip"><b>${c.name}</b><small>${c.activity} · ${pr.label}</small></div>
        <span class="cf-dot" style="background:${pr.c}"></span>
        ${c.recordId ? `<button class="lead-chip" data-goto-lead="${c.recordId}" title="פתח את הליד">${ic('user')} ${(RECORDS.find(x => x.id === c.recordId) || {}).name || 'לליד'}</button>` : ''}
        <button class="cf-finish" id="cfFinish">${c.status === 'closed' ? 'שיחה הסתיימה' : 'סיים טיפול'}</button>
      </div>
      <div class="cf-thread dotted" id="cfThread">
        ${(() => { const mark = c.unreadMark || 0, at = c.thread.length - mark;
          return c.thread.map((m, i) => `${mark > 0 && i === at ? unreadDivHTML() : ''}${m.notice ? noticeCardHTML(m) : `<div class="cc-row ${m.me ? 'me' : 'them'}">
          <div class="cc-bubble ${m.me ? 'me' : 'them'} ${m.req ? 'req' : ''}">${esc(m.text)}</div>
          <div class="cc-meta">${m.who} · ${m.time}</div></div>`}`).join(''); })()}
        ${platTyping ? `<div class="cc-row them"><div class="typing"><i></i><i></i><i></i></div><div class="cc-meta">${c.name} (נוכח בפורטל) מקליד/ה…</div></div>` : ''}
      </div>
      <div class="cf-composer">
        <div class="cf-input-row">
          <button class="cf-send" id="cfSend">${ic('chevronL')} שלח</button>
          <div class="cf-ta-wrap">
            <div class="cf-grip" id="cfGrip" title="גרור למעלה להרחבה"></div>
            <textarea id="cfInput" rows="1" placeholder="הקלד/י הודעה… (Enter לשליחה · Shift+Enter לשורה חדשה)"></textarea>
          </div>
        </div>
        <button class="cf-default" id="cfDefault">↩ הודעת ברירת מחדל עבור ${c.name}</button>
      </div>
    </div>`;
}

/* ---------- ניהול ובקרה (ללא שינוי מהותי) ---------- */
function noticeCardHTML(m) {
  const kindIc = { meeting: 'calendar', followup: 'phone', task: 'flag' }[m.kind] || 'alert';
  return `<button class="chat-notice" data-notice-rec="${m.recordId}">
    <span class="cn-ic">${ic(kindIc)}</span>
    <span class="cn-body"><b>${m.title}</b><small>${m.text}</small></span>
    <span class="cn-cta">פרטי הלקוח ${ic('chevronL')}</span></button>`;
}
function openRecordFromChat(id) {
  const r = RECORDS.find(x => x.id === +id);
  // הצ'אט נשאר פתוח — הליד נפתח לצידו כדי שאפשר להמשיך לכתוב ולראות מידע
  if (r) { closeModal(); openDrawer(r); }
}
function adminKpis() {
  const cnt = f => PLAT_ADMIN.filter(f).length;
  return [
    { icon: '💬', label: 'שיחות פתוחות', value: PLAT_ADMIN.reduce((s, r) => s + r.openChats, 0), color: 'oklch(52% 0.2 262)', bg: 'oklch(95% 0.03 262)' },
    { icon: '🔴', label: 'לייב עכשיו',   value: cnt(r => r.empStatus === 'live'), color: 'oklch(55% 0.2 25)', bg: 'oklch(95% 0.06 25)' },
    { icon: '✏️', label: 'מקלידים עכשיו', value: cnt(r => r.empStatus === 'typing'), color: 'oklch(52% 0.2 262)', bg: 'oklch(95% 0.03 262)' },
    { icon: '✅', label: 'נסגרו היום',   value: PLAT_ADMIN.reduce((s, r) => s + r.closedToday, 0), color: 'oklch(48% 0.14 145)', bg: 'oklch(94% 0.05 145)' },
    { icon: '⚠️', label: 'הטרדה',        value: cnt(r => r.harassment), color: 'oklch(50% 0.19 25)', bg: 'oklch(95% 0.06 25)' },
    { icon: '🔁', label: 'שאלות חוזרות', value: cnt(r => r.repeated), color: 'oklch(48% 0.14 70)', bg: 'oklch(95% 0.05 70)' },
    { icon: '⏳', label: 'זמן מענה חריג', value: cnt(r => r.slow), color: 'oklch(50% 0.12 300)', bg: 'oklch(95% 0.03 300)' },
  ];
}
function platAdminHTML() {
  const rows = filteredAdmin();
  const chips = [['all', 'הכל'], ['typing', 'מקלידים'], ['live', 'לייב'], ['active', 'פעילים'], ['offline', 'מנותקים']];
  const chipCnt = k => k === 'all' ? PLAT_ADMIN.length : PLAT_ADMIN.filter(r => r.empStatus === k).length;
  return `<div class="plat-admin">
      <div class="plat-kpis seven">
        ${adminKpis().map(k => `<div class="plat-kpi"><span class="pk-ic" style="background:${k.bg};color:${k.color}">${k.icon}</span>
          <div><b style="color:${k.color}">${k.value}</b><small>${k.label}</small></div></div>`).join('')}
      </div>
      <div class="ad-filters">
        <input class="ad-search" id="adminQ1" placeholder="כל הנציגים — הקלידו שם…" value="${adminQName}">
        <input class="ad-search" id="adminQ2" placeholder="כל הפעילויות — הקלידו שם…" value="${adminQAct}">
        <div class="ad-chips">${chips.map(([k, l]) => `<button class="ad-chip ${adminFilter === k ? 'on' : ''}" data-af="${k}">${l} · ${chipCnt(k)}</button>`).join('')}</div>
      </div>
      <div class="card"><div class="card-head"><div class="title">${ic('clients')} בקרת שיחות · כלל העובדים</div>
        <span class="muted" style="font-size:12px">${ic('eye')} עין → פירוט מלא</span></div>
        <div class="table-wrap"><table class="list plat-table">
          <thead><tr><th>עובד</th><th>צ'אטים פתוחים</th><th>נסגרו היום</th><th>סטטוס</th><th>הודעות</th><th>אחרונה</th><th>סימונים</th></tr></thead>
          <tbody>${rows.map(r => { const i = PLAT_ADMIN.indexOf(r); const st = EMP_STATUS[r.empStatus];
            return `<tr data-admin-row="${i}" style="cursor:pointer"><td><div class="client-cell">
                <span class="emp-av-sm">${r.emp[0]}</span>
                <div class="meta"><b>${r.emp}</b><small>${r.role}</small></div>
                <button class="icon-btn ad-eye" title="פירוט">${ic('eye')}</button></div></td>
              <td><b style="color:oklch(52% 0.2 262)">${r.openChats}</b></td>
              <td><b style="color:oklch(48% 0.14 145)">${r.closedToday}</b></td>
              <td><span class="st-pill" style="color:${st.c};background:${st.bg}">${r.empStatus === 'live' ? '<i class="pdot" style="background:' + st.c + '"></i>' : ''}${r.empStatus === 'typing' ? '<i class="tdots">•••</i>' : ''}${st.label}</span></td>
              <td><b ${r.hot ? 'style="color:oklch(55% 0.2 25)"' : ''}>${r.msg}</b></td><td class="muted">${r.last}</td>
              <td>${r.harassment ? '<span class="flag har">⚠ הטרדה</span>' : ''}${r.repeated ? '<span class="flag rep">🔁 חוזרות</span>' : ''}${r.slow ? '<span class="flag slow">⏳ זמן מענה</span>' : ''}${!r.harassment && !r.repeated && !r.slow ? '<span class="muted">—</span>' : ''}</td></tr>`;
          }).join('')}</tbody></table></div></div>

      <div class="card" style="margin-top:16px"><div class="card-head"><div class="title">${ic('settings')} הגדרות סימונים · זיהוי אוטומטי</div></div>
        <div class="flag-settings">
          ${FLAG_SETTINGS.map(s => `<div class="fs-row">
            <span class="toggle ${s.on ? 'on' : ''}" data-fs="${s.key}"><i></i></span>
            <div class="fs-info"><b>${s.label}</b><small>${s.desc}</small></div>
          </div>`).join('')}
          <div class="fs-row thresh"><span class="fs-info"><b>סף שאלות חוזרות</b><small>כמה פעמים אותה שאלה עד סימון</small></span>
            <input class="num-in" value="3"></div>
        </div></div>

      ${adminDetail !== null ? adminDetailHTML(PLAT_ADMIN[adminDetail]) : ''}
    </div>`;
}

/* פאנל פירוט שורת בקרה — האפיון המלא */
function adminDetailHTML(r) {
  return `
    <div class="ad-overlay" data-ad-close>
      <div class="ad-panel" onclick="event.stopPropagation()">
        <div class="ad-head">
          <span class="emp-av-sm lg">${r.emp[0]}</span>
          <div class="ad-info"><b>${r.emp}</b><small>${r.role}${r.withName ? ` · בשיחה עם ${r.withName}` : ''}</small></div>
          <button class="ad-x" data-ad-close2>${ic('close')}</button>
        </div>
        <div class="ad-stats">
          <div class="ad-stat"><b>${r.msg}</b><small>הודעות</small></div>
          <div class="ad-stat"><b>${r.last}</b><small>פעילות אחרונה</small></div>
          <div class="ad-stat"><b>${r.activity}</b><small>פעילות</small></div>
        </div>
        <div class="ad-body">
          ${r.repeatedDetail ? adRepeatedBox(r) : ''}
          ${r.slowDetail ? adSlowBox(r) : ''}
          ${r.harassment ? adHarassBox(r) : ''}
          ${!r.repeatedDetail && !r.slowDetail && !r.harassment ? `<div class="hint-box">${ic('check')} אין סימוני חריגה בשיחות של עובד זה.</div>` : ''}
        </div>
      </div>
    </div>`;
}
function adRepeatedBox(r) {
  return `<div class="ad-box rep">
    <div class="ad-box-head"><span class="ad-box-ic">🔁</span><div><b>שאלות חוזרות</b><small>נושאים שנשאלו שוב ושוב</small></div></div>
    ${r.repeatedDetail.map((it, idx) => `
      <details class="ad-q" ${idx === 0 && it.occ.length ? 'open' : ''}>
        <summary><span class="ad-times">× ${it.times}</span><b>${it.q}</b></summary>
        ${it.askedOf ? `<div class="ad-warn">⚠ נשאלה אצל 2 גורמים: ${it.askedOf}</div>` : ''}
        ${it.occ.length ? `<div class="ad-occ-title">כל המופעים · לפי תאריך ושעה</div>
          ${it.occ.map(o => `<div class="ad-occ">
            <div class="ad-occ-q">${o.text}</div><small>${o.time} · ${o.who}</small>
            ${o.answer ? `<div class="ad-ans"><small>התשובה שקיבל · ${o.answer.time}</small>${o.answer.text}</div>` : ''}
            <button class="btn sm" data-fullchat data-hl="${encodeURIComponent(o.text)}">לצ'אט המלא ←</button>
          </div>`).join('')}` : `<button class="btn sm" style="margin:0 12px 10px" data-fullchat data-hl="${encodeURIComponent(it.q)}">לצ'אט המלא ←</button>`}
      </details>`).join('')}
  </div>`;
}
function adSlowBox(r) {
  const d = r.slowDetail;
  return `<div class="ad-box slow">
    <div class="ad-box-head"><span class="ad-box-ic">⏳</span><div><b>זמן מענה חריג</b><small>פערים גדולים בין שאלה לתשובה</small></div></div>
    <div class="ad-occ">
      <div class="ad-occ-q">"${d.q}"</div>
      <div class="ad-slow-row">נשאל: <b>${d.asked}</b> · נענה: <b>${d.answered}</b> · המתנה: <b class="ad-red">${d.waited}</b></div>
      <small>${d.who}</small>
      <button class="btn sm" data-fullchat data-hl="${encodeURIComponent(d.q)}">לצ'אט המלא ←</button>
    </div>
  </div>`;
}
function adHarassBox(r) {
  return `<div class="ad-box har">
    <div class="ad-box-head"><span class="ad-box-ic">⚠</span><div><b>סימון הטרדה</b><small>כיצד בא לידי ביטוי</small></div></div>
    ${(r.harassReasons || []).map(x => `<div class="ad-reason">• ${x}</div>`).join('')}
    <div class="ad-sub">הודעות שסומנו</div>
    ${(r.harassFlagged || []).map(f => `<div class="ad-msg">"${f.text}" <small>· ${f.time}</small></div>`).join('')}
    <div class="ad-actions">
      <button class="btn sm primary">${ic('user')} העבר למנהל</button>
      <button class="btn sm" data-fullchat data-hl="${encodeURIComponent((r.harassFlagged?.[0]?.text) || '')}">לצ'אט המלא ←</button>
    </div>
  </div>`;
}

/* ============================================================
   צפיית מנהל (Shadow View) — הצ'אט מהעין של הנציג, קריאה בלבד
   ============================================================ */
let supState = null;
function buildSupChats(r) {
  // אורי שמבה — נתונים מלאים מהמופעים (empStatus=active → אין צ'אט לייב)
  if (r.emp === 'אורי שמבה') return [
    { name: 'אליאור לוי (אחמ"ש)', status: 'open', last: 'לפני 4 דק\'', thread: [
      { me: true,  text: 'היי, איך מזינים דיווח שעות ידני?', time: 'אתמול 16:20' },
      { me: false, text: 'דרך מסך הדיווח, כפתור + בפינה', time: 'אתמול 21:35' },
      { me: true,  text: 'שוב — איך מזינים דיווח ידני? שכחתי', time: '08:40' },
      { me: false, text: 'אותו מקום 🙂 מסך דיווח → +', time: '08:44' },
      { me: true,  text: 'איך מזינים דיווח שעות ידני? לא מוצא את הכפתור', time: '11:20' },
      { me: true,  text: 'מתי מתעדכן השכר?', time: '12:05' },
    ] },
    { name: 'שירה בן דוד (הדרכה)', status: 'open', last: 'לפני 20 דק\'', thread: [
      { me: true,  text: 'שירה, איך מזינים דיווח שעות ידני?', time: '10:15' },
      { me: false, text: 'דרך מסך הדיווח. אליאור לא הסביר?', time: '10:22' },
      { me: true,  text: 'הסביר, לא הסתדרתי 😅', time: '10:24' },
    ] },
  ];
  // רון לובסי — מקליד כרגע מול טל אבני (הצ'אט הנוכחי היחיד)
  if (r.emp === 'רון לובסי') return [
    { name: 'טל אבני (נציג)', status: 'open', current: true, last: 'עכשיו', thread: [
      { me: true, text: 'היי, צריך תשובה על ההחלפה', time: '22:10' },
      { me: true, text: '?', time: '22:40' },
      { me: true, text: 'למה אתה מתעלם ממני? תענה כבר', time: '23:41' },
      { me: true, text: 'אני אמשיך לכתוב עד שתגיב', time: '23:47' },
    ] },
    { name: 'נדב כהן (מנהל)', status: 'open', last: 'לפני 20 דק\'', thread: [
      { me: true, text: 'נדב, מתי מגיעים הלידים החדשים?', time: '11:30' },
      { me: false, text: 'בודק ומעדכן אותך', time: '11:40' },
    ] },
    { name: 'עידן ברק (גיוס)', status: 'open', last: 'לפני שעה', thread: [
      { me: false, text: 'שלחתי לך את פרטי המועמד', time: '12:10' },
    ] },
    { name: 'לקוח — עודד מ.', status: 'closed', last: 'אתמול', thread: [
      { me: false, text: 'אתם גנבים, אני אדאג שתסגרו', time: '10:22' },
      { me: false, text: 'תיזהר ממני', time: '10:35' },
      { me: true, text: 'אני מבין את התסכול, מעביר למנהל', time: '10:36' },
    ] },
  ];
  // עובדים אחרים — נבנה מהסימונים הקיימים
  const convs = [];
  if (r.harassFlagged) convs.push({ name: r.withName || 'לקוח', status: 'open', last: r.last, thread: [
    { me: true, text: 'שלום, איך אפשר לעזור?', time: '10:15' },
    ...r.harassFlagged.map(f => ({ me: false, text: f.text, time: f.time })),
    { me: true, text: 'אני מבין את התסכול, אבדוק את זה מיד', time: '10:36' },
  ] });
  if (r.repeatedDetail) convs.push({ name: r.withName || 'לקוח', status: 'open', last: r.last, thread:
    r.repeatedDetail.flatMap(it => Array.from({ length: it.times }, (_, k) => ({ me: false, text: it.q, time: `${9 + k}:1${k}` }))).slice(0, 6)
      .concat([{ me: true, text: 'עונה לך מיד', time: '12:00' }]) });
  if (!convs.length) convs.push({ name: r.withName || 'שיחה אחרונה', status: r.openChats ? 'open' : 'closed', last: r.last, thread: [
    { me: true, text: 'שיחה פעילה — ' + r.msg + ' הודעות', time: r.last },
  ] });
  // אם הנציג לייב/מקליד — הצ'אט הפתוח הראשון הוא הנוכחי
  if (['live', 'typing'].includes(r.empStatus)) { const cur = convs.find(c => c.status === 'open'); if (cur) cur.current = true; }
  return convs;
}
/* לוגיקת סטטוס לשיחה: רק צ'אט אחד "נוכחי" — מקליד גובר על לייב, השאר פתוחה/נסגרה */
function supConvStatus(c, emp) {
  if (c.status === 'closed') return { label: 'נסגרה', cls: 'closed' };
  if (c.current && ['live', 'typing'].includes(emp.empStatus))
    return emp.empStatus === 'typing' ? { label: 'מקליד/ה', cls: 'typing' } : { label: 'לייב', cls: 'live' };
  return { label: 'פתוחה', cls: 'open' };
}
function openSupervisorChat(r, hlText) {
  supState = { emp: r, convs: buildSupChats(r), active: null, hl: hlText || '', tab: 'open' };
  // עדיפות: השיחה עם ההודעה המסומנת → הצ'אט הנוכחי (לייב/מקליד) → הראשונה
  const hlIdx = supState.convs.findIndex(c => c.thread.some(m => hlMatch(m.text, supState.hl)));
  const curIdx = supState.convs.findIndex(c => c.current);
  supState.active = hlIdx >= 0 ? hlIdx : (curIdx >= 0 ? curIdx : 0);
  $('#modal').style.maxWidth = '900px'; $('#modal').style.height = '600px';
  renderSupChat();
  $('#modalWrap').classList.add('open');
}
function hlMatch(msgText, hl) {
  if (!hl) return false;
  const clean = s => s.replace(/["״]/g, '').trim();
  return clean(msgText).includes(clean(hl)) || clean(hl).includes(clean(msgText));
}
function renderSupChat() {
  const { emp, convs, active, hl, tab } = supState;
  const open = convs.filter(c => c.status === 'open'), closed = convs.filter(c => c.status === 'closed');
  const list = tab === 'open' ? open : closed;
  const conv = convs[active];
  $('#modal').innerHTML = `
    <div class="sup-head">
      <span class="sup-av">${emp.emp[0]}</span>
      <div class="sup-title"><b>הצ'אט של ${emp.emp} · תצוגה חיה</b>
        <small>${ic('eye')} צפייה בלבד · העובד אינו מודע לצפייה · מיועדת לצורכי בקרה</small></div>
      <button class="sup-x" id="supClose">${ic('close')}</button>
    </div>
    <div class="sup-body">
      <aside class="sup-side">
        <div class="sup-tabs">
          <button class="sup-tab ${tab === 'open' ? 'on' : ''}" data-suptab="open">ממתין לטיפול <span>${open.length}</span></button>
          <button class="sup-tab ${tab === 'closed' ? 'on' : ''}" data-suptab="closed">סגורות <span>${closed.length}</span></button>
        </div>
        ${list.map(c => { const i = convs.indexOf(c); const st = supConvStatus(c, emp);
          return `<button class="sup-conv ${i === active ? 'on' : ''}" data-supconv="${i}">
            <span class="sup-cav">${c.name[0]}</span>
            <span class="sup-cinfo"><b>${c.name}</b><small>${c.last}</small></span>
            <span class="sup-cstatus ${st.cls}">${st.cls === 'live' ? '<i class="pdot" style="background:currentColor"></i>' : ''}${st.cls === 'typing' ? '<i class="tdots">•••</i>' : ''}${st.label}</span>
          </button>`; }).join('')}
      </aside>
      ${conv ? (() => { const st = supConvStatus(conv, emp); return `
      <div class="sup-main">
        <div class="sup-conv-head"><b>${conv.name}</b><span class="sup-cstatus ${st.cls}">${st.label}</span></div>
        <div class="sup-thread" id="supThread">
          ${conv.thread.map(m => `<div class="sup-row ${m.me ? 'me' : 'them'}">
            <div class="sup-bubble ${m.me ? 'me' : 'them'} ${hlMatch(m.text, hl) ? 'hl' : ''}">${esc(m.text)}</div>
            <div class="sup-meta">${m.me ? emp.emp : conv.name} · ${m.time}</div>
          </div>`).join('')}
          ${st.cls === 'typing' ? `<div class="sup-row me"><div class="typing"><i></i><i></i><i></i></div><div class="sup-meta">${emp.emp} מקליד/ה כרגע…</div></div>` : ''}
        </div>
        <div class="sup-lock">🔒 מצב צפייה בלבד — אין אפשרות להגיב או לגעת בשיחה</div>
      </div>`; })() : `
      <div class="sup-main empty"><div class="sup-empty">${ic('eye')}<b>בחר שיחה מהרשימה</b><small>לחיצה על שיחה פותחת אותה לצפייה · לחיצה נוספת מסתירה</small></div></div>`}
    </div>`;
  $('#supClose').addEventListener('click', () => { closeModal(); $('#modal').style.height = ''; });
  $$('[data-suptab]').forEach(b => b.addEventListener('click', () => { supState.tab = b.dataset.suptab; renderSupChat(); }));
  // לחיצה על שיחה → פתיחה משמאל · לחיצה נוספת על אותה שיחה → הסתרה
  $$('[data-supconv]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.supconv;
    supState.active = supState.active === i ? null : i;
    renderSupChat();
  }));
  // גלילה אוטומטית להודעה המסומנת (או לסוף)
  const th = $('#supThread');
  if (th) {
    const hlEl = th.querySelector('.sup-bubble.hl');
    if (hlEl) hlEl.scrollIntoView({ block: 'center' });
    else th.scrollTop = th.scrollHeight;
  }
}
const PLAT_KPIS = [
  { icon: '💬', label: 'לא נקראו', value: 4, color: 'oklch(52% 0.2 262)', bg: 'oklch(95% 0.03 262)' },
  { icon: '🟢', label: 'לייב עכשיו', value: 1, color: 'oklch(52% 0.15 145)', bg: 'oklch(95% 0.04 145)' },
  { icon: '📋', label: 'בטיפול', value: 3, color: 'oklch(58% 0.14 70)', bg: 'oklch(96% 0.04 70)' },
  { icon: '✓', label: 'נסגרו היום', value: 12, color: 'oklch(50% 0.02 250)', bg: 'oklch(96% 0.006 250)' },
  { icon: '⚠', label: 'סימוני חריגה', value: 2, color: 'oklch(50% 0.19 25)', bg: 'oklch(95% 0.06 25)' },
  { icon: '⏱', label: 'תגובה ממוצעת', value: '2ד\'', color: 'oklch(52% 0.2 262)', bg: 'oklch(95% 0.03 262)' },
];
/* סטטוס עובד בבקרה */
const EMP_STATUS = {
  typing:  { label: 'מקליד/ה', c: 'oklch(52% 0.2 262)', bg: 'oklch(95% 0.03 262)' },
  active:  { label: 'פעיל',    c: 'oklch(48% 0.14 145)', bg: 'oklch(94% 0.05 145)' },
  live:    { label: 'לייב',    c: 'oklch(55% 0.2 25)',  bg: 'oklch(95% 0.06 25)' },
  offline: { label: 'מנותק',   c: 'oklch(50% 0.01 250)', bg: 'oklch(95% 0.006 250)' },
};
const PLAT_ADMIN = [
  { emp: 'אביה מדר',  role: 'נציג שירות',  activity: 'שירות',  openChats: 2, closedToday: 0, empStatus: 'typing',  msg: 20, last: 'עכשיו' },
  { emp: 'אורי שמבה', role: 'נציג בכיר',   activity: 'הדרכה טלפונית', withName: 'אליאור לוי (אחמ"ש)', openChats: 2, closedToday: 0, empStatus: 'active', msg: 9, last: 'לפני 4 דק\'', repeated: true, slow: true,
    repeatedDetail: [
      { q: 'איך מזינים דיווח שעות ידני?', times: 4, askedOf: 'אליאור לוי (אחמ"ש), שירה בן דוד (הדרכה)',
        occ: [
          { text: '"היי, איך מזינים דיווח שעות ידני?"', time: 'אתמול 16:20', who: 'מול אליאור לוי (אחמ"ש)', answer: { text: '"דרך מסך הדיווח, כפתור + בפינה"', time: 'אתמול 21:35' } },
          { text: '"שוב — איך מזינים דיווח ידני? שכחתי"', time: '08:40', who: 'מול אליאור לוי (אחמ"ש)', answer: { text: '"אותו מקום 🙂 מסך דיווח → +"', time: '08:44' } },
          { text: '"איך מזינים דיווח שעות ידני? לא מוצא את הכפתור"', time: '11:20', who: 'מול אליאור לוי (אחמ"ש)' },
          { text: '"שירה, איך מזינים דיווח שעות ידני?"', time: '10:15', who: 'מול שירה בן דוד (הדרכה)', answer: { text: '"דרך מסך הדיווח. אליאור לא הסביר?"', time: '10:22' } },
        ] },
      { q: 'מתי מתעדכן השכר?', times: 1, occ: [] },
    ],
    slowDetail: { q: 'איך מזינים דיווח שעות ידני?', asked: 'אתמול 16:20', answered: 'אתמול 21:35', waited: '5 שעות 15 דק\'', who: 'מול אליאור לוי (אחמ"ש)' } },
  { emp: 'איתי טובול', role: 'נציג בכיר',   activity: 'מכירות', openChats: 1, closedToday: 0, empStatus: 'active', msg: 9,  last: 'לפני 12 דק\'' },
  { emp: 'אורלי עזורי',role: 'נציגת שירות', activity: 'שירות',  openChats: 0, closedToday: 1, empStatus: 'active', msg: 0,  last: 'היום 12:40' },
  { emp: 'רון לובסי',  role: 'נציג מכירות', activity: 'מכירות', withName: 'לקוח — עודד מ.', openChats: 3, closedToday: 1, empStatus: 'typing', msg: 76, hot: true, last: 'עכשיו', harassment: true, repeated: true,
    harassReasons: ['שימוש חוזר בשפה פוגענית כלפי הנציג (3 הודעות)', 'איומים למרות מענה תקין'],
    harassFlagged: [{ text: 'אתם גנבים, אני אדאג שתסגרו', time: '10:22' }, { text: 'תיזהר ממני', time: '10:35' }],
    repeatedDetail: [{ q: 'מתי מגיע הטכנאי?', times: 3, occ: [] }] },
  { emp: 'מור דדון',   role: 'נציגת שירות', activity: 'שירות',  openChats: 1, closedToday: 0, empStatus: 'offline', msg: 22, last: 'לפני 3 דק\'', repeated: true,
    repeatedDetail: [{ q: 'איך מאפסים סיסמה ללקוח?', times: 3, occ: [] }] },
  { emp: 'יואב נחום',  role: 'נציג שירות',  activity: 'שירות',  openChats: 0, closedToday: 0, empStatus: 'active', msg: 0,  last: 'לפני יומיים' },
  { emp: 'ליהי שגב',   role: 'אחמ"ש',       activity: 'תפעול',  openChats: 1, closedToday: 0, empStatus: 'live',   msg: 3,  last: 'עכשיו' },
  { emp: 'דור כהן',    role: 'נציג מכירות', activity: 'מכירות', openChats: 2, closedToday: 0, empStatus: 'active', msg: 49, hot: true, last: 'לפני 8 דק\'', harassment: true, repeated: true,
    harassReasons: ['קללות ולחץ חוזר מצד הלקוח'],
    harassFlagged: [{ text: 'אני אתלונן עליך אישית', time: '09:12' }],
    repeatedDetail: [{ q: 'למה חויבתי פעמיים?', times: 4, occ: [] }] },
  { emp: 'נטע ברזני',  role: 'נציגת שירות', activity: 'שירות',  openChats: 0, closedToday: 0, empStatus: 'active', msg: 0,  last: 'לפני 3 ימים' },
];
let adminFilter = 'all', adminQName = '', adminQAct = '';
function filteredAdmin() {
  return PLAT_ADMIN.filter(r => {
    if (adminFilter !== 'all' && r.empStatus !== adminFilter) return false;
    if (adminQName && !(r.emp + ' ' + r.role).includes(adminQName)) return false;
    if (adminQAct && !(r.activity || '').includes(adminQAct)) return false;
    return true;
  });
}

/* הגדרות פנימיות לזיהוי סימונים */
const FLAG_SETTINGS = [
  { key: 'harassAuto',   label: 'זיהוי הטרדה אוטומטי (AI)',            desc: 'סימון שיחות עם שפה פוגענית או איומים', on: true },
  { key: 'harassAlert',  label: 'התראה מיידית למנהל על הטרדה',          desc: 'שליחת התראה בזמן אמת + סימון בשורה', on: true },
  { key: 'harassLock',   label: 'חסימת שליחה עד אישור מנהל',            desc: 'שיחה מסומנת דורשת אישור להמשך', on: false },
  { key: 'repeatAuto',   label: 'זיהוי שאלות חוזרות',                   desc: 'אותה שאלה 3 פעמים ומעלה → סימון 🔁', on: true },
  { key: 'repeatSuggest',label: 'הצעת תשובה מוכנה לשאלה חוזרת',         desc: 'AI מציע תשובה מהמאגר לשאלות שחוזרות', on: true },
];
let adminDetail = null;   // שורת אדמין פתוחה בפאנל צד
const STATUS_STYLE = {
  live: { c: 'oklch(50% 0.15 145)', bg: 'oklch(94% 0.05 145)' },
  open: { c: 'oklch(50% 0.14 70)', bg: 'oklch(95% 0.05 70)' },
  closed: { c: 'oklch(50% 0.01 250)', bg: 'oklch(95% 0.006 250)' },
};
const STATUS_LBL = { live: 'לייב', open: 'בטיפול', closed: 'נסגר' };

/* ============================================================
   Bind
   ============================================================ */
function bindPlatform() {
  $$('[data-pv]').forEach(b => b.addEventListener('click', () => { platView = b.dataset.pv; adminDetail = null; if (platView === 'group') newGroup = { name: '', members: [], sendPerm: 'all', addPerm: 'all' }; renderChatPlatform(); }));
  $$('[data-admin-row]').forEach(tr => tr.addEventListener('click', () => { adminDetail = +tr.dataset.adminRow; renderChatPlatform(); }));
  // העין → פופ-אפ הצ'אטים החיים של הנציג (מה פתוח ומה סגור עכשיו)
  $$('.ad-eye').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const tr = b.closest('[data-admin-row]');
    openSupervisorChat(PLAT_ADMIN[+tr.dataset.adminRow], '');
  }));
  $$('[data-ad-close],[data-ad-close2]').forEach(b => b.addEventListener('click', () => { adminDetail = null; renderChatPlatform(); }));
  $$('[data-fs]').forEach(t => t.addEventListener('click', () => { const s = FLAG_SETTINGS.find(x => x.key === t.dataset.fs); s.on = !s.on; renderChatPlatform(); toast(s.on ? `הופעל: ${s.label}` : `כובה: ${s.label}`); }));
  $$('[data-af]').forEach(b => b.addEventListener('click', () => { adminFilter = b.dataset.af; renderChatPlatform(); }));
  const q1 = $('#adminQ1'); if (q1) q1.addEventListener('change', () => { adminQName = q1.value.trim(); renderChatPlatform(); });
  const q2 = $('#adminQ2'); if (q2) q2.addEventListener('change', () => { adminQAct = q2.value.trim(); renderChatPlatform(); });
  $$('[data-fullchat]').forEach(b => b.addEventListener('click', () => {
    const emp = PLAT_ADMIN[adminDetail]; if (!emp) return;
    openSupervisorChat(emp, decodeURIComponent(b.dataset.hl || ''));
  }));
  $$('[data-pf]').forEach(b => b.addEventListener('click', () => { platFilter = b.dataset.pf; renderChatPlatform(); }));
  $$('[data-openconv]').forEach(b => b.addEventListener('click', () => {
    platActive = +b.dataset.openconv;
    const c = CONVERSATIONS.find(x => x.id === platActive);
    if (c) { c.unreadMark = c.unread; c.unread = 0; }   // קו "הודעה שלא נקראה"
    platView = 'conv'; platTyping = c && c.thread.length <= 1; renderChatPlatform();
  }));
  $$('[data-contact]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.contact === 'general') { startConv('שיחה כללית', { name: 'שיחה כללית', initials: 'שכ', presence: 'available', activity: 'ללא שיוך', hours: '' }); return; }
    newConvContact = CHAT_CONTACTS.find(c => c.id === b.dataset.contact); platView = 'activity'; renderChatPlatform();
  }));
  $$('[data-act]').forEach(b => b.addEventListener('click', () => startConv(b.dataset.act, newConvContact)));
  $$('[data-notice-rec]').forEach(b => b.addEventListener('click', () => openRecordFromChat(b.dataset.noticeRec)));
  $$('[data-goto-lead]').forEach(b => b.addEventListener('click', () => openRecordFromChat(b.dataset.gotoLead)));
  // קבוצה
  const gn = $('#grpName'); if (gn) gn.addEventListener('input', () => newGroup.name = gn.value);
  $$('[data-grpadd]').forEach(b => b.addEventListener('click', () => { newGroup.members.push(b.dataset.grpadd); renderChatPlatform(); }));
  $$('[data-grpx]').forEach(b => b.addEventListener('click', () => { newGroup.members = newGroup.members.filter(m => m !== b.dataset.grpx); renderChatPlatform(); }));
  $$('[data-perm]').forEach(b => b.addEventListener('click', () => { const [k, v] = b.dataset.perm.split(':'); newGroup[k + 'Perm'] = v; renderChatPlatform(); }));
  const gc = $('#grpCreate'); if (gc) gc.addEventListener('click', createGroup);
  // שיחה
  const send = $('#cfSend'); if (send) send.addEventListener('click', platSend);
  const inp = $('#cfInput');
  if (inp) {
    cfManual = false;   // רינדור חדש = חזרה לשורה אחת ולמצב אוטומטי
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); platSend(); }
      // Shift+Enter → שורה חדשה (ברירת מחדל של textarea)
    });
    inp.addEventListener('input', () => autoGrowCF(inp));
    const grip = $('#cfGrip'); if (grip) grip.addEventListener('pointerdown', startCfDrag);
  }
  const def = $('#cfDefault'); if (def) def.addEventListener('click', platDefaultReply);
  const fin = $('#cfFinish'); if (fin) fin.addEventListener('click', () => { const c = CONVERSATIONS.find(x => x.id === platActive); c.status = c.status === 'closed' ? 'open' : 'closed'; platView = 'list'; renderChatPlatform(); toast('הטיפול בשיחה הסתיים'); });
  const th = $('#cfThread'); if (th) th.scrollTop = th.scrollHeight;
}
function startConv(activity, contact) {
  let c = CONVERSATIONS.find(x => x.name === contact.name);
  if (!c) {
    c = { id: Math.max(...CONVERSATIONS.map(x => x.id)) + 1, name: contact.name, kind: 'internal', activity: `${activity} · ${contact.activity || ''}`.trim(), presence: contact.presence || 'available', unread: 0, last: '', time: 'עכשיו', status: 'open', thread: [] };
    CONVERSATIONS.unshift(c);
  }
  touchConv(c); platActive = c.id; platView = 'conv'; platTyping = true; renderChatPlatform();
  setTimeout(() => { platTyping = false; if (platView === 'conv') renderChatPlatform(); }, 2500);
}
function createGroup() {
  const name = ($('#grpName').value || '').trim();
  if (!name) { toast('נא למלא שם קבוצה'); return; }
  const c = { id: Math.max(...CONVERSATIONS.map(x => x.id)) + 1, name, kind: 'group', activity: `${newGroup.members.length} חברים`, presence: 'available', unread: 0, last: 'הקבוצה נוצרה', time: 'עכשיו', status: 'open', thread: [{ me: true, text: `הקבוצה "${name}" נוצרה`, who: 'יואב', time: 'עכשיו' }] };
  CONVERSATIONS.unshift(c); touchConv(c); platActive = c.id; platView = 'conv'; renderChatPlatform();
  toast(`נוצרה קבוצה: ${name}`);
}
/* ---- קומפוזר חכם: גדילה עד 4 שורות → גלילה · הרחבה ידנית עד חצי מסך ---- */
let cfManual = false;
const CF_AUTO_CAP = 112;   // ≈ 4 שורות
function autoGrowCF(ta) {
  if (cfManual) { ta.style.overflowY = ta.scrollHeight > ta.offsetHeight ? 'auto' : 'hidden'; return; }
  ta.style.height = 'auto';
  const h = Math.min(ta.scrollHeight, CF_AUTO_CAP);
  ta.style.height = h + 'px';
  ta.style.overflowY = ta.scrollHeight > CF_AUTO_CAP ? 'auto' : 'hidden';
}
function startCfDrag(e) {
  e.preventDefault();
  const ta = $('#cfInput'); if (!ta) return;
  const startY = e.clientY, startH = ta.offsetHeight;
  cfManual = true;
  const move = ev => {
    let h = startH + (startY - ev.clientY);                       // גרירה למעלה = הגדלה
    h = Math.max(46, Math.min(Math.round(window.innerHeight / 2), h));   // עד אמצע המסך
    ta.style.height = h + 'px';
    ta.style.overflowY = ta.scrollHeight > h ? 'auto' : 'hidden';
  };
  const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function platSend() {
  const inp = $('#cfInput'); const txt = inp.value.trim(); if (!txt) return;
  const c = CONVERSATIONS.find(x => x.id === platActive);
  c.thread.push({ me: true, text: txt, who: 'יואב', time: 'עכשיו' }); c.last = txt; touchConv(c); inp.value = '';
  platTyping = true; renderChatPlatform();
  setTimeout(() => { platTyping = false; c.thread.push({ me: false, text: c.kind === 'client' ? 'תודה! ✅' : 'קיבלתי, מטפל 👍', who: c.name, time: 'עכשיו' }); c.last = 'תגובה'; touchConv(c); playChatSound(); if (platView === 'conv') renderChatPlatform(); else { c.unread = (c.unread || 0) + 1; } }, 1100);
}
function platDefaultReply() {
  const c = CONVERSATIONS.find(x => x.id === platActive);
  c.thread.push({ me: false, text: 'שלום, קיבלתי את פנייתך ואחזור אליך בהקדם 🙏', who: c.name, time: 'עכשיו' });
  platTyping = false; renderChatPlatform();
}
