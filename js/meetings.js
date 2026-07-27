/* ============================================================
   CallBiz Manager – מסך "פגישות" מבוסס-תפקידים (יומן כמו Google)
   • עובד: היומן שלי + המשימות הבאות + הוספה ידנית (אירוע פרטי / חסימה / פגישה פנימית)
   • מנהל: היומן שלי + גישה ליומני הצוות
   • מנהל-על: כל היומנים
   • זיהוי משתתפים תפוסים (busy) בעת הוספה — כמו Google
   • תשתית מוכנה לחיבור Gmail ו-Outlook (מקורות יומן)
   ============================================================ */
let meetRole = 'emp';                 // emp | mgr | super
let meetPickOwner = null;             // מנהל: יומן ספציפי שנבחר לצפייה (null = כולם)
const MEET_ROLES = [
  { key: 'emp',   label: 'עובד',      icon: 'user',    desc: 'היומן שלי בלבד' },
  { key: 'mgr',   label: 'מנהל',      icon: 'clients', desc: 'היומן שלי + יומני הצוות' },
  { key: 'super', label: 'מנהל-על',   icon: 'layers',  desc: 'כל היומנים בארגון' },
];
/* חיבורי יומן חיצוניים — תשתית ל-Gmail / Outlook */
const MEET_SOURCES = [
  { key: 'google',  label: 'Google Calendar', sub: 'Gmail', connected: true,  color: '#EA4335' },
  { key: 'outlook', label: 'Outlook',         sub: 'Microsoft 365', connected: false, color: '#0078D4' },
];
const MEET_EVENT_TYPES = [
  { key: 'meeting',  label: 'פגישה',        c: 'green',  icon: 'calendar' },
  { key: 'internal', label: 'פגישה פנימית', c: 'blue',   icon: 'clients'  },
  { key: 'private',  label: 'אירוע פרטי',   c: 'brand',  icon: 'user'     },
  { key: 'block',    label: 'חסימת יומן',   c: 'gray',   icon: 'clock'    },
];

/* מי מהעובדים גלוי לפי התפקיד */
function meetVisibleOwners() {
  if (meetRole === 'emp') return [CURRENT_USER];
  if (meetRole === 'mgr') return meetPickOwner ? [meetPickOwner] : CAL_OWNERS;
  return CAL_OWNERS;   // super
}
/* האם רואים פירוט מלא ביומן של owner (אחרת "תפוס" בלבד) */
function meetCanSeeDetail(owner) {
  if (owner === CURRENT_USER) return true;
  return meetRole === 'mgr' || meetRole === 'super';
}

/* משבצות תפוסות של משתתף בטווch שעות — לזיהוי התנגשויות כמו Google */
function meetBusyRanges(name, startH, endH) {
  const evs = CAL_EVENTS[name] || [];
  return evs.filter(e => e.h < endH && (e.h + e.dur) > startH)
            .map(e => `${fmtH(e.h)}–${fmtH(e.h + e.dur)}`);
}

/* מתג התפקיד מוגבל להרשאת המשתמש: נציג=אין מתג · מנהל סניף=עובד+מנהל · מנהל רשת/אדמין=הכל */
function allowedMeetRoles() {
  const me = (typeof STAFF !== 'undefined') && STAFF.find(s => s.name === CURRENT_USER);
  const perm = me ? me.perm : 'נציג';
  if (perm === 'מנהל רשת' || perm === 'אדמין') return ['emp', 'mgr', 'super'];
  if (perm === 'מנהל סניף') return ['emp', 'mgr'];
  return ['emp'];
}
/* ---------- המסך הראשי ---------- */
let meetView = 'cal';   // בנייד: cal = יומן · agenda = לוח זמנים (מתג עליון במקום גלילה)
function renderMeetingsView() {
  const allowed = allowedMeetRoles();
  if (!allowed.includes(meetRole)) meetRole = allowed[0];   // הגבלה להרשאה
  const roleOptions = MEET_ROLES.filter(r => allowed.includes(r.key));
  // מרקאפ אחד לשני הממשקים — יומן + לוח-זמנים תמיד מרונדרים; בנייד ה-CSS מציג את הפעיל לפי meetView, במחשב מציג הכל
  $('#viewHost').innerHTML = `
    <div class="meet-head">
      <div class="vh-title"><span class="num">${ic('calendar')}</span> יומן פגישות</div>
      ${roleOptions.length > 1 ? `<div class="meet-roles" role="tablist">
        ${roleOptions.map(r => `<button class="meet-role ${r.key === meetRole ? 'on' : ''}" data-mrole="${r.key}" title="${r.desc}">${ic(r.icon)}<span>${r.label}</span></button>`).join('')}
      </div>` : ''}
    </div>
    <div class="meet-main view-${meetView}">
      <div class="meet-toolbar">
        <div class="seg">
          <button class="seg-btn ${calMode==='day'?'on':''}" data-mmode="day">יום</button>
          <button class="seg-btn ${calMode==='week'?'on':''}" data-mmode="week">שבוע</button>
          <button class="seg-btn ${calMode==='month'?'on':''}" data-mmode="month">חודש</button>
        </div>
        <div class="cal-nav">
          <button class="icon-btn" data-mnav="-1" title="הקודם">${ic('chevronR')}</button>
          <button class="btn sm" data-mnav="today">היום</button>
          <button class="icon-btn" data-mnav="1" title="הבא">${ic('chevronL')}</button>
        </div>
        <span class="cal-label">${calLabel()}</span>
        ${meetRole === 'mgr' ? `<div class="meet-ownerpick">
          <button class="chip-pick ${!meetPickOwner?'on':''}" data-mpick="">כל הצוות</button>
          ${CAL_OWNERS.map(o => `<button class="chip-pick ${meetPickOwner===o?'on':''}" data-mpick="${o}">${o}</button>`).join('')}
        </div>` : ''}
        <div class="spacer"></div>
        <button class="btn sm primary" data-madd>${ic('plus')} הוסף</button>
      </div>
      <div class="meet-body">
        <section class="card meet-cal">${meetCalHTML()}</section>
        <aside class="meet-side">
          <div class="meet-agenda-add"><button class="btn sm primary" data-madd>${ic('plus')} פגישה / אירוע חדש</button></div>
          ${meetRole === 'emp' ? meetTasksHTML() : meetTeamHTML()}
          ${meetSourcesHTML()}
        </aside>
      </div>
    </div>`;
  bindMeetings();
  if (typeof renderTabs === 'function' && document.getElementById('procTabs')) renderTabs();   // מסנכרן את בורר יומן/לוח-זמנים בטופבר
}

/* ---------- חיפוש אירועים ביומן (פנייה / שם אירוע / סוג · עבר ועתיד) ---------- */
function meetSearchEvents(q) {
  q = q.toLowerCase(); const out = [];
  Object.keys(CAL_EVENTS || {}).forEach(owner => {
    (CAL_EVENTS[owner] || []).forEach(e => {
      const rec = e.recId && RECORDS.find(r => r.id === e.recId);
      const hay = ((e.t || '') + ' ' + owner + ' ' + (rec ? rec.name + ' ' + (rec.org || '') : '')).toLowerCase();
      if (hay.includes(q)) out.push({ owner, t: e.t, h: e.h, dur: e.dur, recId: e.recId });
    });
  });
  return out.slice(0, 12);
}
function closeMeetSearchResults() { $('#meetSearchRes')?.remove(); }
function bindMeetSearch() {
  const inp = document.querySelector('.topbar .search input'); if (!inp) return;
  inp.setAttribute('placeholder', 'חיפוש אירוע ביומן — פנייה / שם / סוג…');
  inp.oninput = () => {
    const q = inp.value.trim(); closeMeetSearchResults();
    if (q.length < 2) return;
    const res = meetSearchEvents(q);
    const pop = document.createElement('div'); pop.id = 'meetSearchRes'; pop.className = 'meet-search-res';
    pop.innerHTML = res.length ? res.map(e => `<button class="msr-item" data-msr="${e.recId || ''}">
        <span class="msr-time">${fmtH(e.h)}</span>
        <span class="msr-body"><b>${esc(e.t)}</b><small>${e.owner}</small></span>${e.recId ? ic('chevronL') : ''}</button>`).join('')
      : `<div class="msr-empty">לא נמצאו אירועים תואמים</div>`;
    const r = inp.getBoundingClientRect();
    pop.style.top = (r.bottom + 4) + 'px'; pop.style.right = '10px'; pop.style.left = '10px';
    document.body.appendChild(pop);
    $$('[data-msr]', pop).forEach(b => b.addEventListener('click', () => {
      const id = +b.dataset.msr; closeMeetSearchResults(); inp.blur();
      const rec = RECORDS.find(x => x.id === id); if (rec) openDrawer(rec); else toast('אירוע: ' + b.querySelector('b').textContent);
    }));
  };
  inp.addEventListener('blur', () => setTimeout(closeMeetSearchResults, 200));
}

/* ---------- לוח היומן לפי תצוגה + תפקיד ---------- */
function meetCalHTML() {
  if (calMode === 'month') return calMonthHTML();     // חוזר לרינדור החודשי הקיים
  const owners = meetVisibleOwners();
  const hours = []; for (let h = 8; h <= 18; h++) hours.push(h);
  const cols = calMode === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(calDate, i))   // חלון מתגלגל של 7 ימים מ-calDate — החצים מזיזים יום-יום
    : owners;
  const head = calMode === 'week'
    ? cols.map(d => `<div class="mcal-owner ${dkey(d)===DEMO_DAY?'is-today':''}">${HEB_DAYS_S[d.getDay()]}<small>${d.getDate()}/${d.getMonth()+1}</small></div>`).join('')
    : cols.map(o => `<div class="mcal-owner">${o}${o===CURRENT_USER?' <small>(אני)</small>':''}</div>`).join('');
  const isDemo = dkey(calDate) === DEMO_DAY;
  return `<div class="mcal" style="grid-template-columns:52px repeat(${cols.length}, 1fr)">
    <div class="mcal-corner"></div>${head}
    ${hours.map(h => `
      <div class="mcal-hour">${String(h).padStart(2,'0')}:00</div>
      ${cols.map(col => {
        const owner = calMode === 'week' ? CURRENT_USER : col;
        const dayKey = calMode === 'week' ? dkey(col) : dkey(calDate);
        const onDemo = dayKey === DEMO_DAY;
        const evs = onDemo ? (CAL_EVENTS[owner] || []).filter(e => Math.floor(e.h) === h) : [];
        if (evs.length) {
          const detail = meetCanSeeDetail(owner);
          return `<div class="mcal-cell filled">${evs.map(ev => detail
            ? calEvHTML(ev, calMode === 'week', owner)
            : `<div class="mcal-ev busy" title="תפוס — יומן של ${owner}"><span class="ev-t">תפוס</span></div>`).join('')}</div>`;
        }
        if (onDemo && (h + 1) * 60 <= nowHM()) return `<div class="mcal-cell past"></div>`;
        return `<div class="mcal-cell slot-free" data-mslot data-o="${owner}" data-h="${h}" data-d="${dayKey}"></div>`;
      }).join('')}
    `).join('')}
  </div>`;
}

/* ---------- המשימות הבאות שלי (עובד) ---------- */
function meetTasksHTML() {
  const mine = (CAL_EVENTS[CURRENT_USER] || []).slice().sort((a, b) => a.h - b.h);
  return `<div class="meet-panel">
    <div class="mp-head">${ic('tasks')} המשימות הבאות שלי</div>
    <div class="mp-list">
      ${mine.map(e => `<div class="mp-task">
        <span class="mt-time">${fmtH(e.h)}</span>
        <span class="mt-dot ${e.c}"></span>
        <span class="mt-t">${e.t}</span>
        ${e.recId ? `<button class="mt-open" data-mopen="${e.recId}" title="פתח ליד">${ic('chevronL')}</button>` : ''}
      </div>`).join('') || '<div class="mp-empty">אין משימות להיום 🎉</div>'}
    </div>
    <div class="mp-quick">
      ${MEET_EVENT_TYPES.map(t => `<button class="mp-qbtn" data-madd data-mtype="${t.key}">${ic(t.icon)} ${t.label}</button>`).join('')}
    </div>
  </div>`;
}

/* ---------- צוות (מנהל / מנהל-על) ---------- */
function meetTeamHTML() {
  const owners = CAL_OWNERS;
  return `<div class="meet-panel">
    <div class="mp-head">${ic('clients')} יומני הצוות ${meetRole==='super' ? '· כל הארגון' : ''}</div>
    <div class="mp-list">
      ${owners.map(o => {
        const evs = CAL_EVENTS[o] || [];
        const busy = evs.length, free = 11 - busy;
        return `<button class="mp-owner ${meetPickOwner===o?'on':''}" data-mpick="${o}">
          <span class="mo-name">${o}${o===CURRENT_USER?' (אני)':''}</span>
          <span class="mo-stat"><b>${busy}</b> תפוס · <b>${Math.max(0,free)}</b> פנוי</span>
        </button>`;
      }).join('')}
    </div>
    <div class="mp-note">${ic('eye')} ${meetRole==='super' ? 'מנהל-על רואה פירוט מלא בכל היומנים.' : 'מנהל רואה את יומני הצוות שלו בפירוט מלא.'}</div>
  </div>`;
}

/* ---------- מקורות יומן — Gmail / Outlook ---------- */
function meetSourcesHTML() {
  return `<div class="meet-panel">
    <div class="mp-head">${ic('sync')} מקורות יומן</div>
    <div class="mp-sources">
      ${MEET_SOURCES.map(s => `<div class="mp-source">
        <span class="ms-dot" style="background:${s.color}"></span>
        <span class="ms-name">${s.label}<small>${s.sub}</small></span>
        <button class="ms-btn ${s.connected?'on':''}" data-msrc="${s.key}">${s.connected ? ic('check') + ' מחובר' : 'חבר'}</button>
      </div>`).join('')}
    </div>
    <div class="mp-note">${ic('bolt')} דו-כיווני: אירועים מ-CallBiz יסונכרנו ליומן החיצוני ולהיפך.</div>
  </div>`;
}

/* ---------- הוספת אירוע ידני + זיהוי משתתפים תפוסים ---------- */
let meetDraft = null;
function openMeetAddModal(presetType) {
  meetDraft = { title: '', type: presetType || 'meeting', date: DEMO_DAY, start: 10, end: 11, participants: [] };
  renderMeetAddModal();
  $('#modalWrap').classList.add('open');
}
function renderMeetAddModal() {
  const d = meetDraft;
  const staffOptions = STAFF.filter(s => s.name !== CURRENT_USER);
  $('#modal').style.maxWidth = '560px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('plus')}</span> אירוע חדש ביומן</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body meet-add">
      <div class="ma-types">
        ${MEET_EVENT_TYPES.map(t => `<button class="ma-type ${d.type===t.key?'on':''}" data-matype="${t.key}"><span class="mt-dot ${t.c}"></span>${t.label}</button>`).join('')}
      </div>
      <label class="lf-lbl">כותרת</label>
      <input class="cc-inp" id="maTitle" placeholder="${MEET_EVENT_TYPES.find(t=>t.key===d.type).label}…" value="${esc(d.title)}">
      <div class="ma-row">
        <div><label class="lf-lbl">תאריך</label><input type="date" class="cc-inp" id="maDate" value="${d.date}"></div>
        <div><label class="lf-lbl">משעה</label><input type="number" class="cc-inp" id="maStart" min="6" max="22" step="1" value="${d.start}"></div>
        <div><label class="lf-lbl">עד שעה</label><input type="number" class="cc-inp" id="maEnd" min="7" max="23" step="1" value="${d.end}"></div>
      </div>
      ${d.type === 'block' || d.type === 'private' ? '' : `
      <label class="lf-lbl">משתתפים ${ic('clients')}</label>
      <div class="ma-parts">
        ${staffOptions.map(s => {
          const on = d.participants.includes(s.name);
          const busy = on ? meetBusyRanges(s.name, d.start, d.end) : [];
          return `<button class="ma-part ${on?'on':''} ${busy.length?'busy':''}" data-mpart="${s.name}">
            <span class="mpa-name">${s.name}</span>
            ${on ? (busy.length ? `<span class="mpa-busy">${ic('alert')} תפוס ${busy.join(', ')}</span>` : `<span class="mpa-free">${ic('check')} פנוי</span>`) : `<span class="mpa-role">${s.role}</span>`}
          </button>`;
        }).join('')}
      </div>
      ${d.participants.some(n => meetBusyRanges(n, d.start, d.end).length) ? `<div class="ma-warn">${ic('alert')} חלק מהמשתתפים תפוסים בזמן שנבחר — שקול זמן אחר.</div>` : ''}`}
    </div>
    <div class="modal-foot">
      <button class="btn ghost" id="maCancel">ביטול</button>
      <button class="btn primary" id="maSave">${ic('check')} שמור ביומן</button>
    </div>`;
  const sync = () => { d.title = $('#maTitle').value; d.date = $('#maDate').value; d.start = +$('#maStart').value; d.end = Math.max(+$('#maStart').value + 1, +$('#maEnd').value); };
  $('#closeModal').addEventListener('click', closeModal);
  $('#maCancel').addEventListener('click', closeModal);
  $$('[data-matype]').forEach(b => b.addEventListener('click', () => { sync(); d.type = b.dataset.matype; renderMeetAddModal(); }));
  $$('[data-mpart]').forEach(b => b.addEventListener('click', () => {
    sync(); const n = b.dataset.mpart;
    d.participants.includes(n) ? d.participants.splice(d.participants.indexOf(n), 1) : d.participants.push(n);
    renderMeetAddModal();
  }));
  ['maStart', 'maEnd', 'maDate'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('change', () => { sync(); renderMeetAddModal(); }); });
  $('#maSave').addEventListener('click', () => {
    sync();
    const type = MEET_EVENT_TYPES.find(t => t.key === d.type);
    (CAL_EVENTS[CURRENT_USER] = CAL_EVENTS[CURRENT_USER] || []).push({
      h: d.start, dur: Math.max(0.5, d.end - d.start), t: d.title || type.label, c: type.c,
    });
    closeModal(); renderMeetingsView();
    toast(`נוסף ליומן: ${d.title || type.label} · ${fmtH(d.start)}–${fmtH(d.end)}${d.participants.length ? ' · ' + d.participants.length + ' משתתפים' : ''}`);
  });
}

/* ---------- קשירת אירועים ---------- */
function bindMeetings() {
  $$('[data-mview]').forEach(b => b.addEventListener('click', () => { meetView = b.dataset.mview; renderMeetingsView(); }));
  $$('[data-mrole]').forEach(b => b.addEventListener('click', () => {
    meetRole = b.dataset.mrole; meetPickOwner = null; renderMeetingsView();
    toast('תצוגת ' + MEET_ROLES.find(r => r.key === meetRole).label);
  }));
  $$('[data-mmode]').forEach(b => b.addEventListener('click', () => { calMode = b.dataset.mmode; renderMeetingsView(); }));
  $$('[data-mnav]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.mnav === 'today') calDate = (typeof clockTodayDate==='function'?clockTodayDate():new Date(2024,4,23)); else calShift(+b.dataset.mnav);
    renderMeetingsView();
  }));
  $$('[data-mpick]').forEach(b => b.addEventListener('click', () => { meetPickOwner = b.dataset.mpick || null; renderMeetingsView(); }));
  $$('[data-madd]').forEach(b => b.addEventListener('click', () => openMeetAddModal(b.dataset.mtype)));
  $$('[data-mslot]').forEach(c => c.addEventListener('click', () => {
    if (!meetCanSeeDetail(c.dataset.o)) return toast('יומן של עובד אחר — אין הרשאת עריכה');
    meetDraft = { title: '', type: 'meeting', date: c.dataset.d, start: +c.dataset.h, end: +c.dataset.h + 1, participants: [] };
    renderMeetAddModal(); $('#modalWrap').classList.add('open');
  }));
  $$('[data-mopen]').forEach(b => b.addEventListener('click', () => { const r = RECORDS.find(x => x.id === +b.dataset.mopen); if (r) openDrawer(r); }));
  $$('[data-msrc]').forEach(b => b.addEventListener('click', () => {
    const s = MEET_SOURCES.find(x => x.key === b.dataset.msrc); if (!s) return;
    s.connected = !s.connected; renderMeetingsView();
    toast(s.connected ? `${s.label} חובר · הסנכרון יתחיל` : `${s.label} נותק`);
  }));
  $$('.mcal-ev', $('#viewHost')).forEach(e => e.addEventListener('click', ev => {
    ev.stopPropagation();
    if (e.classList.contains('busy')) return toast('הזמן תפוס · פרטי האירוע חסויים');
    if (e.dataset.rec) openCalEvPopover(e); else toast(`אירוע: ${e.dataset.t || ''}`);
  }));
}
