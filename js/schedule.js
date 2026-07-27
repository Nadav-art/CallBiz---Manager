/* ============================================================
   CallBiz Manager – "הצע זמנים" לנייד: מסך ייעודי של זמנים מוצעים בלבד
   • בלי יומן פיזי / גרירה — רק רשימת מועדים מוצעים + סינון לפי יום + חץ חזרה לליד
   • נוהל התעדוף מוגדר פר-עובד (יומן לפי עובד/סניף) — קובע איך יוצעו הזמנים
   ============================================================ */
const SCHED_MODES = [
  { key: 'adjacent', label: 'צמוד לפגישה הקודמת', desc: 'ממלא פערים — קרוב ככל האפשר לפגישה שלפני', gap: false },
  { key: 'lastDay',  label: 'אחרון ביום',          desc: 'בסוף היום, אחרי הפגישות הקיימות', gap: false },
  { key: 'gapStart', label: 'רווח מתחילת היום',     desc: 'לפחות X דקות אחרי תחילת יום העבודה', gap: true },
  { key: 'gapPrev',  label: 'רווח מהפגישה הקודמת',   desc: 'לפחות X דקות אחרי הפגישה שלפני', gap: true },
];
function staffByName(n) { return (typeof STAFF !== 'undefined') && STAFF.find(s => s.name === n); }
/* המרת תאריך משבצת ISO (YYYY-MM-DD) לפורמט התצוגה בכרטיס הפגישה (DD/MM/YY) */
function ptFmtDate(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso; }
function staffById(id) { return (typeof STAFF !== 'undefined') && STAFF.find(s => s.id === id); }
function schedPrefOf(st) { if (!st.schedPref) st.schedPref = { mode: 'adjacent', gap: 15 }; return st.schedPref; }
let proposeState = { dayFilter: 'all', rec: null, services: [], mode: 'consolidated', track: 'self', selfDur: 30 };
const selfBooked = new Set();

/* משבצות פנויות ביומן *שלי* (המשתמש המחובר) — פגישה מהירה/אישית, לפי הזמינות שלי בלבד */
function mySelfSlots() {
  const durH = (proposeState.selfDur || 30) / 60;
  const busy = (typeof CAL_EVENTS !== 'undefined' && CAL_EVENTS[CURRENT_USER]) || [];
  const startH = 9, endH = 18, out = [];
  const days = (typeof COORD_DAYS !== 'undefined') ? COORD_DAYS : [];
  days.forEach((day, di) => {
    for (let h = startH; h + durH <= endH; h += 0.5) {
      // ביום הראשון מכבדים את האירועים הקיימים ביומן שלי; שאר הימים פנויים (דמו)
      if (di === 0 && busy.some(e => h < e.h + e.dur && h + durH > e.h)) continue;
      out.push({ id: 'self|' + day.date + '|' + h, date: day.date, h, dur: proposeState.selfDur, self: true });
    }
  });
  return out;
}

/* חסימת שירות לפי קריטריונים: מגדר / סניף / מטפל קיים / דרישת סליקה — מחזיר סיבה או null */
function svcBlockReason(key) {
  const t = (typeof cTreat === 'function') && cTreat(key); if (!t) return null;
  // שאלון התאמה — התוצאה קובעת אילו שירותים בכלל מוצעים
  if (typeof fitBlockReason === 'function' && proposeState.rec) {
    const fr = fitBlockReason(proposeState.rec, key); if (fr) return fr;
  }
  const needs = (proposeState.rec && proposeState.rec.needs) || {};
  let docs = docsForOne(key);
  if (!docs.length) return 'אין מטפל שמבצע שירות זה';
  if (needs.gender) { docs = docs.filter(d => d.gender === needs.gender); if (!docs.length) return `אין ${needs.gender === 'm' ? 'מטפל גבר' : 'מטפלת'} לשירות זה`; }
  if (needs.branch) { const has = coordPool().some(s => docs.some(d => d.key === s.doc) && s.branch === needs.branch); if (!has) return 'לא מוצע בסניף שנבחר'; }
  if (t.requiresBilling && !t.canScheduleWithoutBilling) return 'דורש תשלום/סליקה לפני קביעת הפגישה';
  return null;
}

/* מטפלים שיכולים לבצע את *כל* השירותים שנבחרו → ריכוז אצל מטפל אחד */
function eligibleDocs(services) { return services.length ? COORD_DOCTORS.filter(d => services.every(k => d.skills.includes(k))) : []; }
function docsForOne(key) { return COORD_DOCTORS.filter(d => d.skills.includes(key)); }
function svcDur(keys) { return keys.reduce((s, k) => s + (cTreat(k) ? cTreat(k).dur : 30), 0); }

/* דירוג משבצות פנויות לפי נוהל התעדוף של המטפל */
function rankedSlots(docKeys) {
  const pool = coordPool();
  let free = pool.filter(s => docKeys.includes(s.doc) && !s.booked && !s.held && !coordIsPast(s));   // s.held = נעילה זמנית עד סליקה
  if (proposeState.dayFilter !== 'all') free = free.filter(s => s.date === proposeState.dayFilter);
  // #5: הקריטריונים מ"בירור צורך" מסננים את הזמנים המוצעים
  const needs = (proposeState.rec && proposeState.rec.needs) || {};
  if (needs.branch && needs.branch !== '__near') free = free.filter(s => s.branch === needs.branch);   // '__near' = תעדוף לפי קרבה (לא סינון סניף)
  if (needs.timeOfDay) { const rng = { morning: [8, 12], noon: [12, 16], evening: [16, 18] }[needs.timeOfDay]; if (rng) free = free.filter(s => s.h >= rng[0] && s.h < rng[1]); }
  if (needs.gender) free = free.filter(s => { const st = staffById(s.doc); return st && st.gender === needs.gender; });
  const booked = {};
  pool.filter(s => docKeys.includes(s.doc) && s.booked).forEach(s => { const k = s.doc + '|' + s.date; (booked[k] = booked[k] || []).push(s); });
  const DS = 8;
  const out = free.map(s => {
    const st = staffById(s.doc); const pref = st ? schedPrefOf(st) : { mode: 'adjacent', gap: 15 };
    const bk = (booked[s.doc + '|' + s.date] || []).filter(b => b.h + b.dur <= s.h).sort((a, b) => b.h - a.h);
    const prevEnd = bk.length ? bk[0].h + bk[0].dur : DS;
    let score, reason;
    if (pref.mode === 'adjacent') { score = s.h - prevEnd; reason = bk.length ? `צמוד ל-${fmtH(prevEnd)}` : 'ראשון ביום'; }
    else if (pref.mode === 'lastDay') { score = -s.h; reason = 'מאוחר ביום'; }
    else if (pref.mode === 'gapStart') { const g = pref.gap / 60; score = s.h >= DS + g ? Math.abs(s.h - (DS + g)) : 90; reason = `רווח ${pref.gap} ד׳ מהבוקר`; }
    else { const g = pref.gap / 60; score = s.h >= prevEnd + g ? Math.abs(s.h - (prevEnd + g)) : 90; reason = `רווח ${pref.gap} ד׳ מ-${fmtH(prevEnd)}`; }
    return { ...s, score, reason, docName: st ? st.name : s.doc };
  });
  // תעדוף סניף קרוב לבית הלקוח — ממוין קודם לפי מרחק, ואז לפי הניקוד הרגיל
  if ((needs.branch === '__near' || needs.nearBranch === '1') && typeof nearestBranches === 'function') {
    const kmBy = {}; nearestBranches(proposeState.rec).forEach(x => { kmBy[x.b.key] = x.km; });
    return out.map(s => {
      const km = kmBy[s.branch];
      return km != null ? { ...s, km, reason: `${km} ק״מ מהלקוח · ${s.reason}` } : s;
    }).sort((a, b) => {
      const ka = a.km == null ? 1e9 : a.km, kb = b.km == null ? 1e9 : b.km;
      if (ka !== kb) return ka - kb;
      return a.date === b.date ? a.score - b.score : a.date.localeCompare(b.date);
    });
  }
  return out.sort((a, b) => a.date === b.date ? a.score - b.score : a.date.localeCompare(b.date));
}

function openProposedTimes(r) {
  const svcs = (r.services || []).slice();
  // דיפולט הטראק: אם נבחר שירות → "עם איש מקצוע"; אם לא → "פגישה מולי"
  proposeState = { dayFilter: 'all', rec: r, services: svcs, mode: 'consolidated', track: svcs.length ? 'service' : 'self', selfDur: 30 };
  let p = document.getElementById('proposePanel');
  if (!p) { p = document.createElement('div'); p.id = 'proposePanel'; document.body.appendChild(p); }
  renderProposedTimes();
  requestAnimationFrame(() => p.classList.add('open'));
}
function closeProposedTimes(reopenDrawer) {
  const p = $('#proposePanel'); if (p) p.classList.remove('open');
  if (reopenDrawer && proposeState.rec) setTimeout(() => openDrawer(proposeState.rec), 140);
}
function ptSlotHTML(s, svcLabel) {
  // חלון תיאום מהפגישה הקודמת — מועד מחוץ לחלון מסומן (חסום או בתשלום)
  const g = (typeof gapSlotNote === 'function' && proposeState.rec) ? gapSlotNote(proposeState.rec, s.date) : null;
  return `<button class="pt-slot ${g ? (g.hard ? 'gap-block' : 'gap-warn') : ''}" data-ptbook="${s.id}" ${g ? `data-gapnote="${esc(g.text)}" data-gaphard="${g.hard ? 1 : 0}"` : ''}>
    <span class="pts-time">${fmtH(s.h)}</span>
    <span class="pts-info"><b>${cDayLbl(s.date)} · ${s.docName}</b><small>${svcLabel} · ${cBranch(s.branch) ? (cBranch(s.branch).short || cBranch(s.branch).label) : ''}</small>
      ${g ? `<small class="pts-gap">${ic(g.hard ? 'lock' : 'alert')} ${esc(g.text)}</small>` : ''}</span>
    <span class="pts-reason">${g ? (g.hard ? 'לא ניתן' : 'בתשלום') : s.reason}</span></button>`;
}
function renderProposedTimes() {
  const r = proposeState.rec, services = proposeState.services;
  const self = proposeState.track === 'self';
  const catalog = (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : [];

  // ימי בחירה — לפי הטראק
  let days;
  if (self) {
    days = [...new Set(mySelfSlots().map(s => s.date))].sort();
  } else {
    const eligAll = eligibleDocs(services);
    const relevantDocs = ((eligAll.length ? eligAll : COORD_DOCTORS)).map(d => d.key);
    days = [...new Set(coordPool().filter(s => relevantDocs.includes(s.doc) && !s.booked && !coordIsPast(s)).map(s => s.date))].sort();
  }

  // גוף — לפי הטראק
  let body, picker;
  if (self) {
    // פגישה איתי — ביומן שלי, לפי הזמינות שלי; בלי בחירת שירות
    let slots = mySelfSlots().filter(s => !selfBooked.has(s.id));
    if (proposeState.dayFilter !== 'all') slots = slots.filter(s => s.date === proposeState.dayFilter);
    slots = slots.slice(0, 16);
    picker = `<div class="pt-selfbar">
        <span class="pt-selflbl">${ic('user')} משך הפגישה:</span>
        <div class="pt-durs">${[30, 45, 60].map(d => `<button class="pt-dur ${proposeState.selfDur === d ? 'on' : ''}" data-ptdur="${d}">${d} ד׳</button>`).join('')}</div>
      </div>`;
    body = `<div class="pt-modebar self">${ic('calendar')} <b>פגישה ביומן שלך</b> · ${CURRENT_USER} · לפי הזמינות שלך</div>
      ${slots.length ? slots.map(s => `<button class="pt-slot" data-ptbookself="${s.id}">
          <span class="pts-time">${fmtH(s.h)}</span>
          <span class="pts-info"><b>${cDayLbl(s.date)}</b><small>פגישה אישית · ${proposeState.selfDur} ד׳</small></span>
          <span class="pts-reason">${ic('check')} פנוי</span></button>`).join('')
        : `<div class="pt-empty">${ic('clock')} אין חלון פנוי ביומן שלך בטווח — נסה יום אחר או משך קצר יותר</div>`}`;
  } else {
    // עם איש מקצוע — שירות מהקטלוג, עם חסימת קריטריונים
    const needsSet = Object.values((r.needs || {})).some(Boolean);
    picker = `<div class="pt-svcpick">
        <div class="pt-svcpick-lbl">${ic('tasks')} שירותים / מוצרים נדרשים:${needsSet ? ' <span class="pt-needsnote">מסונן לפי הצורך שעודכן</span>' : ''}</div>
        <div class="pt-svcchips">
          ${catalog.map(t => {
            const on = services.includes(t.key), reason = svcBlockReason(t.key);
            return `<button class="pt-svcchip ${on ? 'on' : ''} ${reason ? 'blocked' : ''}" data-ptsvc="${t.key}" ${reason ? `data-ptblock="${esc(reason)}"` : ''} title="${reason ? esc(reason) : t.label}">${t.label}${on ? ' ' + ic('check') : reason ? ' ' + ic('lock') : ''}</button>`;
          }).join('')}
        </div>
        ${catalog.some(t => svcBlockReason(t.key)) ? `<div class="pt-blocknote">${ic('alert')} שירות נעול אינו עומד בקריטריונים — לחץ עליו לראות מדוע.</div>` : ''}
      </div>`;
    const elig = eligibleDocs(services);
    const canConsolidate = elig.length > 0;
    const mode = canConsolidate ? proposeState.mode : 'split';
    if (!services.length) {
      body = `<div class="pt-empty">${ic('tasks')} בחר שירות/מוצר אחד או יותר למעלה כדי לראות זמנים מוצעים</div>`;
    } else if (mode === 'consolidated') {
      const slots = rankedSlots(elig.map(d => d.key)).slice(0, 14);
      const svcLabel = services.map(k => cTreat(k).label).join(' + ');
      body = `<div class="pt-modebar">${ic('clients')} <b>ריכוז מטפלים</b> · מטפל אחד לכל השירותים (${svcDur(services)} ד׳)
          <button class="pt-split-btn" data-ptmode="split">${ic('layers')} פצל תיאום</button></div>
        ${slots.length ? slots.map(s => ptSlotHTML(s, svcLabel)).join('') : `<div class="pt-empty">${ic('clock')} אין מועד מרוכז פנוי — נסה לפצל</div>`}`;
    } else {
      const banner = canConsolidate
        ? `<div class="pt-modebar">${ic('layers')} <b>תיאום מפוצל</b> · תיאום נפרד לכל שירות
            <button class="pt-split-btn" data-ptmode="consolidated">${ic('clients')} ריכוז מטפלים</button></div>`
        : `<div class="pt-modebar warn">${ic('alert')} אין מטפל יחיד שמבצע את כל השירותים — תיאום נפרד לכל אחד</div>`;
      body = banner + services.map(k => {
        const slots = rankedSlots(docsForOne(k).map(d => d.key)).slice(0, 4);
        return `<div class="pt-svc-group"><div class="pt-svc-head">${ic('tasks')} ${cTreat(k).label} <small>${cTreat(k).dur} ד׳</small></div>
          ${slots.length ? slots.map(s => ptSlotHTML(s, cTreat(k).label)).join('') : `<div class="pt-empty sm">${ic('clock')} אין זמנים ל${cTreat(k).label}</div>`}</div>`;
      }).join('');
    }
  }

  $('#proposePanel').innerHTML = `
    <div class="pt-head">
      <button class="pt-back" id="ptBack" aria-label="חזרה לליד">${ic('chevronR')}</button>
      <div class="pt-title"><b>זמנים מוצעים</b><small>${r.name}</small></div>
      <button class="pt-x" id="ptClose" aria-label="סגור">${ic('close')}</button>
    </div>
    <div class="pt-track">
      <button class="pt-trackbtn ${self ? 'on' : ''}" data-pttrack="self">${ic('user')} פגישה איתי<small>ליומן שלי</small></button>
      <button class="pt-trackbtn ${self ? '' : 'on'}" data-pttrack="service">${ic('clients')} עם איש מקצוע<small>שירות מהקטלוג</small></button>
    </div>
    ${typeof needsBannerHTML === 'function' ? needsBannerHTML(r, 'pt') : ''}
    ${typeof fitBarHTML === 'function' ? fitBarHTML(r) : ''}
    ${typeof gapBarHTML === 'function' ? gapBarHTML(r) : ''}
    ${typeof critGuardHTML === 'function' ? critGuardHTML(r) : ''}
    ${typeof critOverrideBarHTML === 'function' ? critOverrideBarHTML(r) : ''}
    ${typeof critEffectsBarHTML === 'function' ? critEffectsBarHTML(r) : ''}
    ${picker}
    <div class="pt-days">
      <button class="pt-day ${proposeState.dayFilter === 'all' ? 'on' : ''}" data-ptday="all">הכל</button>
      ${days.map(d => `<button class="pt-day ${proposeState.dayFilter === d ? 'on' : ''}" data-ptday="${d}">${cDayLbl(d)}</button>`).join('')}
    </div>
    <div class="pt-list">${body}</div>`;
  $('#ptBack').addEventListener('click', () => closeProposedTimes(true));
  $('#ptClose').addEventListener('click', () => closeProposedTimes(false));
  // "עדכן קריטריונים" מתוך פופ-אפ התיאום — חוזר לכאן אחרי השמירה (בלי לחפש את השלב שנעלם)
  if (typeof bindNeedsBanner === 'function') bindNeedsBanner(r, () => renderProposedTimes());
  if (typeof bindCritDerived === 'function') bindCritDerived(r, () => renderProposedTimes());
  if (typeof bindFitBar === 'function') bindFitBar(r, () => renderProposedTimes());
  $$('[data-pttrack]').forEach(b => b.addEventListener('click', () => { proposeState.track = b.dataset.pttrack; proposeState.dayFilter = 'all'; renderProposedTimes(); }));
  $$('[data-ptdur]').forEach(b => b.addEventListener('click', () => { proposeState.selfDur = +b.dataset.ptdur; renderProposedTimes(); }));
  $$('[data-ptsvc]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.ptblock) { toast(`${b.textContent.trim()} · נעול: ${b.dataset.ptblock}`); return; }
    const k = b.dataset.ptsvc, i = proposeState.services.indexOf(k);
    i >= 0 ? proposeState.services.splice(i, 1) : proposeState.services.push(k);
    r.services = proposeState.services.slice();   // נשמר על הליד
    renderProposedTimes();
  }));
  $$('[data-ptmode]').forEach(b => b.addEventListener('click', () => { proposeState.mode = b.dataset.ptmode; renderProposedTimes(); }));
  $$('[data-ptday]').forEach(b => b.addEventListener('click', () => { proposeState.dayFilter = b.dataset.ptday; renderProposedTimes(); }));
  $$('[data-ptbook]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.gaphard === '1') { toast('לא ניתן לתאם למועד זה: ' + b.dataset.gapnote); return; }
    if (typeof critBookGuard === 'function') { const g = critBookGuard(r);
      if (g.mode === 'block') { toast('לא ניתן לתאם: ' + (g.blocks[0].reason || g.blocks[0].src)); return; }
      if (g.mode === 'pending') { toast('חסר נתון לפני תיאום: ' + g.pending[0].label); return; } }
    const s = coordPool().find(x => x.id === b.dataset.ptbook); if (!s) return;
    const staffName = staffById(s.doc) ? staffById(s.doc).name : '';
    // תהליך התיאום נגזר מהשירותים: הסכם ו/או סליקה ו/או ישר לשיריון (מוגדר בכרטיס השירות)
    const fl = bookingFlowFor(proposeState.services || []);
    if ((fl.contract || fl.billing) && typeof holdSlotForPayment === 'function') { holdSlotForPayment(r, s, staffName, fl); return; }
    const doBook = () => {
      s.booked = true;
      r.meeting = { date: ptFmtDate(s.date), time: fmtH(s.h), dur: svcDur(proposeState.services) || (s.dur || 60), channel: staffName || 'איש מקצוע', with: staffName };
      if (typeof autoFire === 'function') autoFire('a2', { rec: r });
      toast(`נקבעה פגישה · ${cDayLbl(s.date)} ${fmtH(s.h)} · ${staffName}`);
      closeProposedTimes(true);
    };
    // תור קיים → אישור ממורכז לפני העדכן; אחרת קביעה ישירה
    if (r.meeting && typeof cbConfirm === 'function') {
      cbConfirm({
        title: 'שינוי מועד פגישה', icon: 'sync', confirmLabel: 'עדכן תור',
        message: `כבר קבועה פגישה ל־<b>${r.meeting.date} · ${r.meeting.time}</b>.<br>לעדכן למועד החדש <b>${cDayLbl(s.date)} · ${fmtH(s.h)}${staffName ? ' · ' + staffName : ''}</b>?`,
        onConfirm: doBook,
      });
    } else doBook();
  }));
  $$('[data-ptbookself]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.ptbookself, s = mySelfSlots().find(x => x.id === id);
    if (s) openSelfMeetingDetails(s);   // פותח מסך פרטי פגישה — כותרת + משתתפים — לפני קביעה
  }));
}
/* מסך פרטי פגישה אישית — כותרת + משתתפים לפני קביעה (נפתח בלחיצה על שעה פנויה) */
let selfMeetState = { slot: null, title: '', parts: new Set() };
function openSelfMeetingDetails(s) {
  const r = proposeState.rec;
  selfMeetState = { slot: s, title: (r ? r.name : '') + ' – פגישה', parts: new Set() };
  renderSelfMeeting();
  $('#modalWrap').classList.add('open');
}
function renderSelfMeeting() {
  const s = selfMeetState.slot, r = proposeState.rec;
  const staff = (typeof STAFF !== 'undefined') ? STAFF.filter(x => x.name !== CURRENT_USER) : [];
  $('#modal').style.maxWidth = '500px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('calendar')}</span> פרטי פגישה</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body sm-body">
      <div class="sm-when">${ic('clock')} ${cDayLbl(s.date)} · ${fmtH(s.h)} · ${proposeState.selfDur} ד׳ · ביומן של ${CURRENT_USER}</div>
      <div class="field"><label>כותרת הפגישה</label><input class="cc-inp" id="smTitle" value="${esc(selfMeetState.title)}" placeholder="נושא הפגישה"></div>
      <div class="field"><label>משתתפים</label>
        <div class="sm-parts">
          <span class="sm-part fixed">${ic('user')} ${r ? esc(r.name) : 'לקוח'} · לקוח</span>
          <span class="sm-part fixed me">${ic('user')} ${CURRENT_USER} · אני</span>
        </div>
        <div class="sm-sub">הוסף משתתפים מהצוות:</div>
        <div class="sm-parts">
          ${staff.map(x => `<button type="button" class="sm-part ${selfMeetState.parts.has(x.name) ? 'on' : ''}" data-smpart="${esc(x.name)}">${selfMeetState.parts.has(x.name) ? ic('check') : ic('plus')} ${x.name}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" id="smCancel">ביטול</button>
      <button class="btn primary" id="smSave">${ic('check')} קבע פגישה</button></div>`;
  $('#closeModal').addEventListener('click', closeModal);
  $('#smCancel').addEventListener('click', closeModal);
  $$('[data-smpart]').forEach(b => b.addEventListener('click', () => {
    selfMeetState.title = $('#smTitle') ? $('#smTitle').value : selfMeetState.title;
    const nm = b.dataset.smpart;
    selfMeetState.parts.has(nm) ? selfMeetState.parts.delete(nm) : selfMeetState.parts.add(nm);
    renderSelfMeeting();
  }));
  $('#smSave').addEventListener('click', () => {
    const title = ($('#smTitle').value || '').trim() || ((r ? r.name : '') + ' – פגישה');
    const doSave = () => {
      selfBooked.add(s.id);
      if (typeof CAL_EVENTS !== 'undefined') (CAL_EVENTS[CURRENT_USER] = CAL_EVENTS[CURRENT_USER] || []).push({ h: s.h, dur: s.dur / 60, t: title, c: 'brand', recId: r ? r.id : undefined });
      if (r) r.meeting = { date: ptFmtDate(s.date), time: fmtH(s.h), dur: proposeState.selfDur, channel: 'פגישה אישית', with: CURRENT_USER };
      const extra = selfMeetState.parts.size ? ` · +${selfMeetState.parts.size} משתתפים` : '';
      closeModal();
      toast(`נקבעה פגישה ביומן שלך · ${cDayLbl(s.date)} ${fmtH(s.h)} · ${proposeState.selfDur} ד׳${extra}`);
      closeProposedTimes(true);
    };
    // תור קיים → אישור ממורכז לפני העדכן
    if (r && r.meeting && typeof cbConfirm === 'function') {
      cbConfirm({
        title: 'שינוי מועד פגישה', icon: 'sync', confirmLabel: 'עדכן תור',
        message: `כבר קבועה פגישה ל־<b>${r.meeting.date} · ${r.meeting.time}</b>.<br>לעדכן למועד החדש <b>${cDayLbl(s.date)} · ${fmtH(s.h)}</b>?`,
        onConfirm: doSave,
      });
    } else doSave();
  });
}
function openSchedRuleModal() {
  const st = proposeState.staff, pref = schedPrefOf(st);
  $('#modal').style.maxWidth = '460px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('bolt')}</span> נוהל תעדוף · ${st.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body sched-rule">
      <p class="sr-hint">${ic('user')} מוגדר פר-עובד (יומן לפי עובד/סניף) · לפי זה יוצעו הזמנים אוטומטית כשפנוי.</p>
      ${SCHED_MODES.map(m => `<button class="sr-opt ${pref.mode === m.key ? 'on' : ''}" data-srmode="${m.key}"><b>${m.label}</b><small>${m.desc}</small></button>`).join('')}
      <div class="sr-gap ${SCHED_MODES.find(m => m.key === pref.mode).gap ? '' : 'hidden'}"><label>רווח (דקות)</label>
        <input type="number" class="cc-inp" id="srGap" min="0" max="120" step="5" value="${pref.gap}"></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" id="srCancel">ביטול</button><button class="btn primary" id="srSave">${ic('check')} שמור נוהל</button></div>`;
  $('#closeModal').addEventListener('click', closeModal); $('#srCancel').addEventListener('click', closeModal);
  $$('[data-srmode]').forEach(b => b.addEventListener('click', () => { if ($('#srGap')) pref.gap = +$('#srGap').value; pref.mode = b.dataset.srmode; openSchedRuleModal(); }));
  $('#srSave').addEventListener('click', () => { if ($('#srGap')) pref.gap = +$('#srGap').value; closeModal(); if ($('#proposePanel')) renderProposedTimes(); toast('נוהל התעדוף נשמר · הזמנים המוצעים עודכנו'); });
  $('#modalWrap').classList.add('open');
}

/* ============================================================
   נעילה זמנית של תור עד להשלמת סליקה
   • התור נכנס לרשימת ההמתנה עם סטטוס "נעילה זמנית" + טיימר לפי הגדרת המנהל
   • השיריון בפועל מתבצע רק אחרי סליקה מוצלחת; אחרת הנעילה משתחררת
   ============================================================ */
let SLOT_HOLDS = [];   // { id, slotId, recId, name, staffName, date, h, price, flow }
function holdMs() { return (typeof holdMinutes === 'function' ? holdMinutes() : 10) * 60000; }
/* תהליך התיאום הנדרש לפי השירותים שנבחרו — מוגדר בכרטיס השירות בקטלוג */
function bookingFlowFor(keys) {
  const list = (keys || []).map(k => (typeof cTreat === 'function') ? cTreat(k) : null).filter(Boolean);
  return {
    contract: list.some(t => t.requiresContract),
    billing: list.some(t => t.requiresBilling),
  };
}
function holdSlotForPayment(r, s, staffName, flow) {
  let price = (typeof svcTotals === 'function') ? svcTotals(proposeState.services || []).price : 0;
  // כללי הקריטריונים (פטור · השתתפות עצמית · הנחה) גוברים על מחיר הקטלוג
  let critPrice = null;
  if (typeof critPriceFor === 'function') { critPrice = critPriceFor(r, price); price = critPrice.final; }
  const id = 'hold_' + s.id;
  SLOT_HOLDS = SLOT_HOLDS.filter(h => h.slotId !== s.id);
  s.held = true; s.heldBy = r.id;                                   // המשבצת חסומה לאחרים בזמן הנעילה
  const until = (typeof Date !== 'undefined') ? null : null;         // הזמן מוצג לפי דקות שנותרו (זמן-ייחוס)
  const tot = (typeof holdMinutes === 'function' ? holdMinutes() : 10);
  const hold = { id, slotId: s.id, recId: r.id, name: r.name, staffName, date: s.date, h: s.h, price, crit: critPrice, flow: flow || { contract: false, billing: true }, minsLeft: tot, totalMins: tot };
  SLOT_HOLDS.unshift(hold);
  if (typeof autoFire === 'function') autoFire('h1', { rec: r, hold: hold });
  // מוסיפים לרשימת ההמתנה עם חיווי נעילה זמנית
  if (typeof WAITLIST !== 'undefined') {
    WAITLIST.unshift({ pos: 0, name: r.name, svc: 'נעילה זמנית · ממתין לסליקה', req: `${cDayLbl(s.date)} ${fmtH(s.h)}`, since: 'עכשיו', hold: hold, temp: true });
    WAITLIST.forEach((w, i) => w.pos = i + 1);
  }
  r.slotHold = hold;
  closeProposedTimes(false);
  const p = document.getElementById('proposePanel'); if (p) p.remove();
  openHoldPaymentPanel(r, s, hold);
  toast(`התור בנעילה זמנית ל-${typeof holdLabel === 'function' ? holdLabel() : '10 דקות'} · השיריון יושלם לאחר הסליקה`);
}
/* פאנל סליקה — השיריון בפועל רק לאחר תשלום */
function openHoldPaymentPanel(r, s, hold) {
  const old = document.getElementById('holdPayWrap'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'holdPayWrap';
  const render = () => {
    const f = hold.flow || {};
    // אפשרויות הבחירה — הפעולה מתבצעת לפי מה שנבחר, בלחיצה על "הבא"
    const opts = [
      { k: 'book', t: 'שיריון תור', ic: 'calendar', desc: 'שריון מיידי בלי סליקה' },
      { k: 'contract', t: 'שליחת הסכם לחתימה', ic: 'docs', desc: r.contractIssued ? 'ההסכם כבר נשלח — שלח שוב' : 'ההסכם יישלח ללקוח בוואטסאפ' },
      { k: 'pay', t: 'מעבר לסליקה', ic: 'check', desc: 'מסך תשלום — השיריון יושלם לאחריו' },
    ];
    if (!hold.choice) hold.choice = f.contract && !r.contractIssued ? 'contract' : f.billing ? 'pay' : 'book';
    w.innerHTML = `<div class="cbc-box hold-box" style="max-width:480px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('lock')}</span><b>נעילה זמנית · התור נשמר ללקוח</b></div>
      <div class="hold-banner ${hold.minsLeft <= 2 ? 'urgent' : ''}">
        ${ic('clock')} <span class="hold-banner-t">משך השיריון: <b>${typeof holdLabel === 'function' ? holdLabel(hold.totalMins || hold.minsLeft) : hold.minsLeft + ' דקות'}</b></span>
        <span class="hold-banner-left">נותרו <b>${hold.minsLeft}</b> דק׳</span>
      </div>
      <div class="hold-info">
        <div class="hold-row2"><span>${ic('user')} לקוח</span><b>${esc(r.name)}</b></div>
        <div class="hold-row2"><span>${ic('calendar')} מועד שנשמר</span><b>${cDayLbl(hold.date)} ${fmtH(hold.h)}${hold.staffName ? ' · ' + esc(hold.staffName) : ''}</b></div>
        <div class="hold-row2"><span>${ic('check')} לתשלום</span><b>${hold.price} ₪</b></div>
      </div>
      <p class="hint" style="margin:10px 0">${ic('alert')} התור אינו משוריין סופית עד להשלמת התהליך. אם הזמן יחלוף — הנעילה תשוחרר והמשבצת תחזור להיות פנויה.</p>
      <div class="hold-choice-h">${ic('bolt')} מה עושים עכשיו?</div>
      <div class="hold-choices">
        ${opts.map(o => `<button class="hold-choice ${hold.choice === o.k ? 'on' : ''}" data-holdchoice="${o.k}">
          <span class="hc-ic">${ic(o.ic)}</span><span class="hc-t"><b>${o.t}</b><small>${o.desc}${o.k === 'contract' && r.contractIssued ? ' ✓' : ''}</small></span>
          <span class="hc-mark">${hold.choice === o.k ? ic('check') : ''}</span></button>`).join('')}
      </div>
      <div class="cbc-actions hold-actions">
        <button class="btn ghost" id="holdRelease">${ic('close')} שחרר נעילה</button>
        <button class="btn primary" id="holdNext">הבא ${ic('chevronL')}</button>
      </div></div>`;
    $('#holdRelease').addEventListener('click', () => releaseHold(hold, r, s, true));
    $$('[data-holdchoice]', w).forEach(b => b.addEventListener('click', () => { hold.choice = b.dataset.holdchoice; render(); }));
    // "הבא" — מתקדם לפי מה שנבחר
    $('#holdNext').addEventListener('click', () => {
      if (hold.choice === 'contract') {
        w.remove();
        if (typeof openContractForLead === 'function') openContractForLead(r); else toast('מערכת החוזים לא זמינה');
        setTimeout(() => { if (!document.getElementById('holdPayWrap')) openHoldPaymentPanel(r, s, hold); }, 400);
        return;
      }
      if (hold.choice === 'pay') {
        if (f.contract && !r.contractIssued) { toast('נדרש הסכם חתום לפני הסליקה — בחר "שליחת הסכם לחתימה"'); return; }
        w.remove(); openBillingPanel(r, s, hold); return;
      }
      // שיריון תור
      if (f.contract && !r.contractIssued) { toast('נדרש הסכם חתום לפני השיריון — בחר "שליחת הסכם לחתימה"'); return; }
      if (f.billing) { toast('שירות זה דורש סליקה — בחר "מעבר לסליקה"'); return; }
      w.remove(); completeHoldBooking(r, s, hold);
    });
  };
  document.body.appendChild(w); render();
  requestAnimationFrame(() => w.classList.add('open'));
  w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
  // טיימר ספירה לאחור — משחרר את הנעילה בתום הזמן
  hold._t = setInterval(() => {
    hold.minsLeft--;
    if (hold.minsLeft <= 0) { clearInterval(hold._t); releaseHold(hold, r, s, false); return; }
    if (document.getElementById('holdPayWrap')) render();
  }, 60000);
}
function releaseHold(hold, r, s, manual) {
  if (typeof autoFire === 'function') { autoFire('h3', { rec: r, hold: hold }); autoFire('h4', { rec: r, hold: hold }); }
  clearInterval(hold._t);
  if (s) { s.held = false; s.heldBy = null; }
  SLOT_HOLDS = SLOT_HOLDS.filter(x => x.id !== hold.id);
  if (typeof WAITLIST !== 'undefined') { const i = WAITLIST.findIndex(x => x.hold && x.hold.id === hold.id); if (i >= 0) WAITLIST.splice(i, 1); WAITLIST.forEach((x, j) => x.pos = j + 1); }
  if (r) r.slotHold = null;
  const w = document.getElementById('holdPayWrap'); if (w) w.remove();
  toast(manual ? 'הנעילה שוחררה · המשבצת פנויה' : 'זמן שמירת התור חלף · הנעילה שוחררה והמשבצת פנויה');
  if (typeof renderUnifiedView === 'function' && document.getElementById('listBody')) renderUnifiedView();
}

/* ============================================================
   קטגוריית סליקה — מסך תשלום בפועל (נפתח מ"עבור לסליקה" בנעילה הזמנית)
   השיריון מתבצע רק לאחר סליקה מוצלחת; הנעילה נשמרת בזמן הסליקה.
   ============================================================ */
function completeHoldBooking(r, s, hold) {
  s.held = false; s.booked = true;
  r.meeting = { date: (typeof ptFmtDate === 'function') ? ptFmtDate(s.date) : s.date, time: fmtH(s.h),
    dur: (typeof svcDur === 'function' ? svcDur(proposeState.services || []) : 60) || 60, channel: hold.staffName || 'איש מקצוע', with: hold.staffName };
  clearInterval(hold._t);
  SLOT_HOLDS = SLOT_HOLDS.filter(x => x.id !== hold.id);
  if (typeof WAITLIST !== 'undefined') { const i = WAITLIST.findIndex(x => x.hold && x.hold.id === hold.id); if (i >= 0) WAITLIST.splice(i, 1); WAITLIST.forEach((x, j) => x.pos = j + 1); }
  r.slotHold = null;
  r.paid = { amount: hold.price, at: (typeof docStamp === 'function') ? docStamp() : '', token: hold.token || null };
  if (typeof autoFire === 'function') { autoFire('h5', { rec: r, hold: hold }); autoFire('h6', { rec: r, hold: hold }); }
  toast(`הסליקה הושלמה · התור שוריין בפועל · ${cDayLbl(hold.date)} ${fmtH(hold.h)}`);
  if (typeof renderUnifiedView === 'function' && document.getElementById('listBody')) renderUnifiedView();
  if (typeof openDrawer === 'function') openDrawer(r);
}
function openBillingPanel(r, s, hold) {
  const old = document.getElementById('billWrap'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'billWrap';
  let mode = 'card';
  const render = () => {
    w.innerHTML = `<div class="cbc-box bill-box" style="max-width:480px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('check')}</span><b>סליקה · ${esc(r.name)}</b></div>
      <div class="bill-hold">${ic('lock')} נעילה זמנית פעילה — נותרו <b>${hold.minsLeft}</b> דקות · ${cDayLbl(hold.date)} ${fmtH(hold.h)}</div>
      <div class="bill-amt"><span>סכום לחיוב</span><b>${hold.price} ₪</b>${hold.crit && hold.crit.final !== hold.crit.base ? `<small class="bill-crit">${ic('target')} מחיר קטלוג ${hold.crit.base} ₪ · לפי הקריטריונים: ${hold.crit.lines.map(l => esc(l.text + ' (' + l.src + ')')).join(' · ')}</small>` : ''}</div>
      ${typeof critEffectsBarHTML === 'function' ? critEffectsBarHTML(r) : ''}
      <div class="bill-tabs">
        <button class="bill-tab ${mode === 'card' ? 'on' : ''}" data-bill="card">כרטיס אשראי</button>
        <button class="bill-tab ${mode === 'link' ? 'on' : ''}" data-bill="link">קישור סליקה (וואטסאפ)</button>
        <button class="bill-tab ${mode === 'later' ? 'on' : ''}" data-bill="later">מקדמה בלבד</button>
      </div>
      ${mode === 'card' ? `<div class="bill-form">
          <label>מספר כרטיס<input class="cc-inp" id="billCard" placeholder="0000 0000 0000 0000"></label>
          <div class="bill-row"><label>תוקף<input class="cc-inp" id="billExp" placeholder="MM/YY"></label><label>CVV<input class="cc-inp" id="billCvv" placeholder="•••"></label></div>
          <div class="ctw-secure-note">${ic('lock')} הכרטיס אינו נשמר — יופק טוקן חיוב מאובטח.</div>
        </div>`
        : mode === 'link' ? `<div class="bill-form"><p class="hint" style="margin:0">${ic('whatsapp')} קישור סליקה מאובטח יישלח ל${esc(r.name)} · ${esc(r.phone || '')}. הנעילה תישמר עד להשלמת התשלום.</p></div>`
        : `<div class="bill-form"><label>סכום מקדמה<input class="cc-inp" id="billDep" value="${Math.round((hold.price || 0) * 0.3)}"></label>
          <p class="hint" style="margin:6px 0 0">${ic('alert')} מקדמה משריינת את התור; היתרה תיגבה במועד הטיפול.</p></div>`}
      <div class="cbc-actions">
        <button class="btn ghost" id="billBack">${ic('chevronR')} חזור לנעילה</button>
        <button class="btn primary" id="billGo">${mode === 'link' ? ic('whatsapp') + ' שלח קישור סליקה' : ic('check') + ' בצע סליקה ושריין'}</button>
      </div></div>`;
    $$('[data-bill]', w).forEach(b => b.addEventListener('click', () => { mode = b.dataset.bill; render(); }));
    $('#billBack').addEventListener('click', () => { w.remove(); openHoldPaymentPanel(r, s, hold); });
    $('#billGo').addEventListener('click', () => {
      if (mode === 'card') {
        const c = (($('#billCard') || {}).value || '').replace(/\D/g, '');
        if (c.length < 8) { toast('נא להזין מספר כרטיס תקין'); return; }
        hold.token = 'tok_' + c.slice(-4) + '_' + (c.length * 131 % 9000 + 1000);
        w.remove(); completeHoldBooking(r, s, hold);
      } else if (mode === 'link') {
        toast(`קישור סליקה נשלח ל${r.name} בוואטסאפ · הנעילה נשמרת (${hold.minsLeft} דק׳)`);
        w.remove(); openHoldPaymentPanel(r, s, hold);
      } else {
        const d = +(($('#billDep') || {}).value || 0);
        if (!d) { toast('נא להזין סכום מקדמה'); return; }
        hold.price = d; w.remove(); completeHoldBooking(r, s, hold);
      }
    });
  };
  document.body.appendChild(w); render();
  requestAnimationFrame(() => w.classList.add('open'));
  w.addEventListener('mousedown', e => { if (e.target === w) { w.remove(); openHoldPaymentPanel(r, s, hold); } });
}
