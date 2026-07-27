/* ============================================================
   הרחבה: שלבי המהלך לפי דרישות הפריט  ·  key = 'flowsteps'
   ------------------------------------------------------------
   מטפל במסלול "הלקוח לא יודע מה הוא רוצה" בלבד, ובדיוק במצבים
   שהוגדרו:

     אין פגישה · אין סליקה · אין הסכם
        קריטריונים → שירות/מוצר → סיכום            (שלב 3)

     נדרשת פגישה, בלי סליקה
        קריטריונים → שירות/מוצר → תיאום → סיכום     (שלב 4)

     נדרשת סליקה + פגישה
        ... → תיאום (קופץ שיריון) → סליקה → סיכום
        זמן שיריון 0 = אין שיריון בלי תשלום.

     נדרשת סליקה בלי פגישה (רכישת מוצר)
        ... → סליקה → סיכום        — בלי מסך תיאום כלל.

   הדרישות מוגדרות ברשימה אחת (REQS) כדי שאפשר יהיה להוסיף
   דרישות נוספות בעתיד והן יחולו על כל המהלך אוטומטית:
       FLOWSTEPS.addReq({ key, label, test, step })
   ============================================================ */
(function () {

  /* ---------------- מרשם הדרישות ---------------- */
  const REQS = [
    { key: 'meeting',  label: 'פגישה', icon: 'calendar', step: 'cal',      test: t => !!t.requiresMeeting },
    { key: 'billing',  label: 'סליקה', icon: 'check',    step: 'pay',      test: t => !!t.requiresBilling },
    { key: 'contract', label: 'הסכם',  icon: 'docs',     step: 'contract', test: t => !!t.requiresContract },
  ];
  const addReq = req => { if (req && req.key && !REQS.some(x => x.key === req.key)) REQS.push(req); };

  const treats = r => ((r && r.services) || []).map(k => (typeof cTreat === 'function') ? cTreat(k) : null).filter(Boolean);
  function reqsOf(r, keys) {
    const list = (keys ? keys.map(k => cTreat(k)).filter(Boolean) : treats(r));
    const on = {};
    REQS.forEach(q => { on[q.key] = list.some(q.test); });
    return { list, on, none: REQS.every(q => !on[q.key]) };
  }
  /* האם יש בכלל במערכת פריט שדורש פגישה — קובע אם מסך התיאום רלוונטי */
  const catalogHasMeeting = () => (typeof COORD_TREATMENTS !== 'undefined')
    && COORD_TREATMENTS.some(t => t.requiresMeeting);

  /* ---------------- השלבים ---------------- */
  function steps(r, keys) {
    /* המסלול נקבע ברשומה בלבד. אסור לגזור אותו מהבחירה הזמנית —
       modeOf מחזיר 'known' ברגע שיש שירותים, וזה היה מהפך את הסדר
       באמצע המהלך ומחזיר את הנציג לקריטריונים. */
    const mode = (window.FLOW && FLOW.mode) ? FLOW.mode(r) : 'unknown';
    const base = mode === 'unknown' ? ['crit', 'svc'] : ['svc', 'crit'];
    /* כשמסך הבחירה פתוח — הרצועה משקפת את הבחירה החיה, כך שהשלב
       הנדרש נכנס לרצועה ברגע הסימון ולא רק אחרי השמירה. */
    let use = keys;
    if (!use && typeof svcSelState !== 'undefined' && svcSelState && svcSelState.rec === r
        && document.querySelector('#modal .svc-sel')) use = svcSelState.sel;
    const q = reqsOf(r, use);
    if (!q.list.length) return base.concat(['summary']);
    const out = base.slice();
    if (q.on.contract) out.push('contract');
    /* פגישה — רק אם פריט דורש אותה, או שסומנה פגישה פנימית לקידום */
    if (q.on.meeting || r.internalMeet) out.push('cal');
    /* סיכום ההצעה קודם — הוא מסכם את מה שהוצע, והסליקה חותמת אחריו */
    out.push('summary');
    if (q.on.billing) out.push('pay');
    return out;
  }

  /* ---------------- שיריון ---------------- */
  const holdMins = () => {
    if (typeof NEEDS_CFG !== 'undefined' && NEEDS_CFG.__holdMin !== undefined) return +NEEDS_CFG.__holdMin || 0;
    return (typeof holdMinutes === 'function') ? holdMinutes() : 10;
  };
  const holdAllowed = () => holdMins() > 0;

  /* ---------------- חסימת פריט שאינו עומד בקריטריונים ---------------- */
  function svcBlock(r, key) {
    const t = (typeof cTreat === 'function') ? cTreat(key) : null;
    if (!t) return null;
    /* 1. שאלון ההתאמה והאזור */
    if (window.FLOW && FLOW.blocked) { const w = FLOW.blocked(r, key); if (w) return { why: w, short: 'לא מתאים ללקוח' }; }
    /* 2. מטפל מתאים — רלוונטי רק לפריט שדורש פגישה. מוצר נמכר
          בלי מטפל, ולכן אין טעם לחסום אותו על "אין מטפל". */
    if (t.requiresMeeting && window.FLOW && FLOW.staffFor) {
      const st = FLOW.staffFor(r, key); if (!st.ok) return { why: st.why, short: 'אין מטפל מתאים' };
    }
    /* 3. זמינות אמיתית ביומן — רק לפריט שדורש פגישה */
    if (t.requiresMeeting && window.CRITFX) {
      const rt = { id: r.id, name: r.name, city: r.city, services: [key], needs: r.needs || {} };
      const pool = CRITFX.candidates(rt);
      if (pool && pool.length) {
        const needs = Object.assign({}, r.needs || {}); delete needs.note;
        if (!CRITFX.countFor(rt, pool, needs))
          return { why: 'אין מועד פנוי לשירות הזה בקריטריונים שנבחרו — יש לשנות קריטריון או לבחור פריט אחר',
            short: 'אין מועד בקריטריונים' };
      } else if (pool) {
        return { why: 'אין סניף פעיל שמספק את השירות הזה', short: 'אין סניף שמספק' };
      }
    }
    return null;
  }

  /* פופ-אפ ההסבר — אותו רכיב שבמסך הקריטריונים */
  function tip(anchor, text, title) {
    const old = document.getElementById('cfxTip'); if (old) old.remove();
    const t = document.createElement('div'); t.className = 'cfx-tip'; t.id = 'cfxTip';
    t.innerHTML = `<div class="cfx-tip-h">${ic('lock')} <b>${esc(title || 'למה הפריט נעול')}</b>
      <button class="cfx-tip-x" aria-label="סגור">${ic('close')}</button></div><p>${esc(text)}</p>`;
    document.body.appendChild(t);
    const rc = anchor.getBoundingClientRect(), tw = t.offsetWidth || 260, th = t.offsetHeight || 90;
    t.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, rc.left + rc.width / 2 - tw / 2)) + 'px';
    t.style.top = (rc.bottom + 8 + th > window.innerHeight - 8 ? Math.max(8, rc.top - th - 8) : rc.bottom + 8) + 'px';
    t.querySelector('.cfx-tip-x').addEventListener('click', () => t.remove());
    setTimeout(() => document.addEventListener('mousedown', function out(e) {
      if (!e.target.closest('#cfxTip') && !e.target.closest('.cfx-q')) { t.remove(); document.removeEventListener('mousedown', out); }
    }), 0);
  }

  let onlyFit = false;   // הצ׳יפ "רק תואמים"

  /* ============================================================
     כל השלבים חיים בתוך אותו פופ-אפ (#modal). אין חלון נוסף שקופץ
     מעל — הכותרת, רצועת השלבים והכפתורים נשארים במקומם, ומתחלף רק
     גוף המסך. כך המהלך מרגיש רציף.
     ============================================================ */
  const money = n => (n || 0).toLocaleString('he-IL') + ' ₪';

  function shell(r, key, title, body, foot) {
    const m = document.getElementById('modal'); if (!m) return;
    m.classList.add('fl-modal');
    m.style.maxWidth = '600px'; m.style.width = '100%'; m.style.height = 'min(78vh, 720px)';
    m.innerHTML = `
      <div class="modal-head"><div class="title"><span class="num">${ic('tasks')}</span> ${esc(title)} · ${esc(r.name)}</div>
        <button class="close-btn" id="closeModal">${ic('close')}</button></div>
      <div class="modal-body fs-step" data-fsstep="${esc(key)}">
        ${(window.FLOW && FLOW.header) ? FLOW.header(r, key) : ''}
        ${body}
      </div>
      <div class="modal-foot">${foot}</div>`;
    const x = document.getElementById('closeModal');
    if (x) x.addEventListener('click', () => { if (typeof closeModal === 'function') closeModal(); });
    if (window.FLOW && FLOW.bindHeader) FLOW.bindHeader(document.querySelector('#modal .fs-step'), r, key);
    const wrap = document.getElementById('modalWrap'); if (wrap) wrap.classList.add('open');
  }
  const prevStep = (r, key) => { const st = steps(r); return st[st.indexOf(key) - 1]; };
  const nextStep = (r, key) => { const st = steps(r); return st[st.indexOf(key) + 1]; };
  function backBtn(r, key) {
    const pv = prevStep(r, key);
    return pv ? `<button class="btn ghost" data-fsback>${ic('chevronR')} חזרה</button>` : '';
  }

  /* ---------------- תיאום — בתוך החלון ---------------- */
  let calDay = 'all';
  function slotsFor(r) {
    if (typeof rankedSlots !== 'function' || typeof eligibleDocs !== 'function') return [];
    const svcs = (r.services || []).filter(Boolean);
    if (typeof proposeState !== 'undefined') proposeState = Object.assign({}, proposeState,
      { rec: r, services: svcs, dayFilter: 'all', track: 'service', mode: 'consolidated' });
    const elig = eligibleDocs(svcs);
    const docs = (elig.length ? elig : (typeof COORD_DOCTORS !== 'undefined' ? COORD_DOCTORS : [])).map(d => d.key);
    let list = rankedSlots(docs) || [];
    if (calDay !== 'all') list = list.filter(s => s.date === calDay);
    return list.slice(0, 40);
  }
  function openCal(r) {
    const q = reqsOf(r);
    const all = slotsFor(r);
    const days = [];
    (slotsFor(r) || []).forEach(s => { if (days.indexOf(s.date) < 0) days.push(s.date); });
    const hold = q.on.billing && holdAllowed();
    const body = `
      ${q.on.billing ? `<div class="fs-hold ${hold ? '' : 'warn'}">${ic(hold ? 'lock' : 'alert')}
        <div><b>${hold ? 'המועד ייכנס לשיריון זמני' : 'לא ניתן לשריין'}</b>
          <small>${hold ? 'השירות דורש תשלום — המועד נשמר ל' + holdMins() + ' דקות עד להשלמת הסליקה'
            : 'זמן השיריון בהגדרות הוא 0 — המועד ייקבע רק אחרי הסליקה'}</small></div></div>` : ''}
      <div class="fs-days"><button class="fs-day ${calDay === 'all' ? 'on' : ''}" data-fsday="all">הכל</button>
        ${days.slice(0, 6).map(d => `<button class="fs-day ${calDay === d ? 'on' : ''}" data-fsday="${esc(d)}">
          ${typeof cDayLbl === 'function' ? esc(cDayLbl(d)) : esc(d)}</button>`).join('')}</div>
      <div class="fs-slots">${all.length ? all.map(s => `<button class="fs-slot" data-fsslot="${esc(s.id)}">
          <span class="fs-t">${typeof fmtH === 'function' ? fmtH(s.h) : ''}</span>
          <span class="fs-i"><b>${typeof cDayLbl === 'function' ? esc(cDayLbl(s.date)) : esc(s.date)} · ${esc(s.docName || '')}</b>
            <small>${esc((typeof cBranch === 'function' && cBranch(s.branch)) ? (cBranch(s.branch).short || cBranch(s.branch).label) : '')}
              ${s.reason ? ' · ' + esc(s.reason) : ''}</small></span>
          <span class="fs-go">${ic('chevronL')}</span></button>`).join('')
        : `<div class="fs-empty2">${ic('alert')} אין מועדים פנויים בקריטריונים שנבחרו</div>`}</div>`;
    shell(r, 'cal', 'תיאום מועד', body,
      `${backBtn(r, 'cal')}<span class="fs-foot-n">${all.length} מועדים מתאימים</span>`);
    const host = document.querySelector('#modal .fs-step');
    host.querySelectorAll('[data-fsday]').forEach(b => b.addEventListener('click', () => { calDay = b.dataset.fsday; openCal(r); }));
    host.querySelectorAll('[data-fsslot]').forEach(b => b.addEventListener('click', () => pickSlot(r, b.dataset.fsslot)));
    bindBack(r, 'cal');
  }
  /* בחירת מועד — קביעה, או שיריון זמני כשנדרשת סליקה */
  function pickSlot(r, id) {
    const s = (typeof coordPool === 'function') ? coordPool().find(x => x.id === id) : null;
    if (!s) return;
    const q = reqsOf(r);
    const staff = (typeof staffById === 'function' && staffById(s.doc)) ? staffById(s.doc).name : '';
    if (q.on.billing) {
      if (holdAllowed()) {
        s.held = true; s.heldBy = r.id;
        const tot = holdMins();
        r.slotHold = { id: 'hold_' + s.id, slotId: s.id, recId: r.id, name: r.name, staffName: staff,
          date: s.date, h: s.h, price: (typeof svcTotals === 'function') ? svcTotals(r.services || []).price : 0,
          minsLeft: tot, totalMins: tot };
        if (typeof SLOT_HOLDS !== 'undefined') SLOT_HOLDS.unshift(r.slotHold);
        toast('המועד בשיריון זמני ל' + tot + ' דקות — עד להשלמת הסליקה');
      } else {
        r.pendingSlot = { id: s.id, date: s.date, h: s.h, staffName: staff };
        toast('המועד יישמר רק לאחר הסליקה');
      }
    } else {
      s.booked = true;
      r.meeting = { date: (typeof ptFmtDate === 'function') ? ptFmtDate(s.date) : s.date,
        time: (typeof fmtH === 'function') ? fmtH(s.h) : '', dur: (typeof svcDur === 'function') ? svcDur(r.services || []) : 60,
        channel: staff, with: staff };
      if (typeof autoFire === 'function') autoFire('a2', { rec: r });
      toast('נקבעה פגישה · ' + ((typeof cDayLbl === 'function') ? cDayLbl(s.date) : s.date) + ' ' + ((typeof fmtH === 'function') ? fmtH(s.h) : ''));
    }
    if (typeof renderList === 'function') renderList();
    openSummary(r);
  }

  /* ---------------- סיכום הצעה ---------------- */
  function openSummary(r) {
    const q = reqsOf(r);
    const price = (window.BOOKMODE && BOOKMODE.price) ? BOOKMODE.price(r) : { base: 0, disc: 0, final: 0 };
    const dur = q.list.reduce((s, t) => s + (+t.dur || 0), 0);
    const when = r.meeting ? (r.meeting.date + ' ' + r.meeting.time)
      : r.slotHold ? ((typeof cDayLbl === 'function' ? cDayLbl(r.slotHold.date) : '') + ' ' + (typeof fmtH === 'function' ? fmtH(r.slotHold.h) : '') + ' · בשיריון')
      : r.pendingSlot ? ((typeof cDayLbl === 'function' ? cDayLbl(r.pendingSlot.date) : '') + ' ' + (typeof fmtH === 'function' ? fmtH(r.pendingSlot.h) : '') + ' · ממתין לתשלום') : '';
    const body = `
      <div class="fs-sec">${ic('layers')} <b>מה נבחר</b></div>
      <div class="fs-items">${q.list.map(t => `<div class="fs-item">
        <div class="fs-it-h"><b>${esc(t.label)}</b>
          <span class="fs-it-m">${t.kind ? esc(t.kind) : ''}${t.dur ? ' · ' + t.dur + ' דק׳' : ''}${t.price ? ' · ' + money(t.price) : ' · ללא עלות'}</span></div>
        ${t.pre ? `<div class="fs-note"><span>${ic('note')} הנחיות ללקוח</span><p>${esc(t.pre)}</p></div>` : ''}
        ${t.instr ? `<div class="fs-note in"><span>${ic('tasks')} הנחיות פנימיות</span><p>${esc(t.instr)}</p></div>` : ''}
      </div>`).join('') || '<p class="fs-none">לא נבחרו פריטים</p>'}</div>
      <div class="fs-grid">
        <div class="fs-box">
          <div class="fs-sec sm">${ic('check')} <b>סיכום</b></div>
          <div class="fs-kv"><span>פריטים</span><b>${q.list.length}</b></div>
          ${dur ? `<div class="fs-kv"><span>זמן כולל</span><b>${dur} דק׳</b></div>` : ''}
          <div class="fs-kv"><span>עלות</span><b>${price.base ? money(price.final) : 'ללא עלות'}</b></div>
          ${when ? `<div class="fs-kv"><span>מועד</span><b>${esc(when)}</b></div>` : ''}
          ${r.paid ? `<div class="fs-kv"><span>תשלום</span><b class="ok">שולם · ${esc(r.paid.ref || '')}</b></div>` : ''}
        </div>
        <div class="fs-box">
          <div class="fs-sec sm">${ic('bolt')} <b>מה נדרש בפריטים</b></div>
          ${REQS.map(x => `<div class="fs-kv"><span>${ic(x.icon)} ${esc(x.label)}</span>
            <b class="${q.on[x.key] ? 'need' : 'no'}">${q.on[x.key] ? 'נדרש' : 'לא נדרש'}</b></div>`).join('')}
        </div>
      </div>`;
    const nx = nextStep(r, 'summary');
    shell(r, 'summary', 'סיכום הצעה', body,
      `${backBtn(r, 'summary')}<button class="btn primary" data-fsnext>${ic('check')} ${nx === 'pay' ? 'המשך לסליקה' : 'סיום'}</button>`);
    bindBack(r, 'summary');
    const b = document.querySelector('#modal [data-fsnext]');
    if (b) b.addEventListener('click', () => {
      if (nx === 'pay') return openPay(r);
      r.dealDone = true;
      if (typeof closeModal === 'function') closeModal();
      toast('המהלך הושלם');
      if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
      if (typeof renderList === 'function') renderList();
    });
  }

  /* ---------------- סליקה ---------------- */
  function openPay(r) {
    const q = reqsOf(r);
    const price = (window.BOOKMODE && BOOKMODE.price) ? BOOKMODE.price(r) : { final: 0 };
    const dep = q.list.reduce((s, t) => s + (+t.deposit || 0), 0);
    const due = dep || price.final;
    const body = `
      ${r.slotHold ? `<div class="fs-hold">${ic('lock')} <div><b>המועד בשיריון זמני</b>
          <small>${typeof cDayLbl === 'function' ? cDayLbl(r.slotHold.date) : ''} ${typeof fmtH === 'function' ? fmtH(r.slotHold.h) : ''}
          · הסליקה תהפוך אותו לתור קבוע</small></div></div>`
        : (q.on.meeting ? `<div class="fs-hold warn">${ic('alert')} <div><b>המועד טרם נשמר</b>
            <small>${holdAllowed() ? 'אין שיריון פעיל' : 'זמן השיריון בהגדרות הוא 0'} — התור ייקבע עם אישור הסליקה</small></div></div>` : '')}
      <div class="fs-kv big"><span>לתשלום</span><b>${money(due)}</b></div>
      ${dep && price.final > dep ? `<div class="fs-kv"><span>יתרה</span><b>${money(price.final - dep)}</b></div>` : ''}
      <p class="fs-hint">${ic('alert')} הסליקה מתבצעת כרגע בפלטפורמה חיצונית. אפשר לשלוח קישור ללקוח,
        או לאשר כאן שהתשלום כבר בוצע — והמערכת תמשיך בהתאם.</p>
      <button class="btn fs-wide" data-fslink>${ic('sync')} שליחת קישור סליקה ללקוח</button>`;
    shell(r, 'pay', 'סליקה', body,
      `${backBtn(r, 'pay')}<button class="btn primary" data-fsok>${ic('check')} אשר שבוצעה סליקה</button>`);
    bindBack(r, 'pay');
    const lk = document.querySelector('#modal [data-fslink]');
    if (lk) lk.addEventListener('click', () => { r.payLinkSent = true; toast('קישור סליקה נשלח ללקוח'); });
    const ok = document.querySelector('#modal [data-fsok]');
    if (ok) ok.addEventListener('click', () => {
      r.paid = { at: (typeof docStamp === 'function') ? docStamp() : '', amount: due,
        ref: 'EXT-' + ((r.id || 0) * 7 + 1000), mode: 'external' };
      const src = r.slotHold || r.pendingSlot;
      if (src) {
        const s = (typeof coordPool === 'function') ? coordPool().find(x => x.id === src.slotId || x.id === src.id) : null;
        if (s) { s.booked = true; s.held = false; }
        r.meeting = { date: (typeof ptFmtDate === 'function') ? ptFmtDate(src.date) : src.date,
          time: (typeof fmtH === 'function') ? fmtH(src.h) : '', dur: 60,
          channel: src.staffName || '', with: src.staffName || '' };
        if (r.slotHold && typeof SLOT_HOLDS !== 'undefined') SLOT_HOLDS = SLOT_HOLDS.filter(x => x.id !== r.slotHold.id);
        r.slotHold = null; r.pendingSlot = null;
      }
      r.dealDone = true;
      if (typeof closeModal === 'function') closeModal();
      toast('הסליקה אושרה · ' + money(due) + (r.meeting ? ' · התור נקבע' : ''));
      if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
      if (typeof renderList === 'function') renderList();
    });
  }

  function bindBack(r, key) {
    const b = document.querySelector('#modal [data-fsback]');
    if (b) b.addEventListener('click', () => {
      const pv = prevStep(r, key); if (pv) open(r, pv);
    });
  }

  /* ---------------- ניווט ---------------- */
  function open(r, key) {
    if (key === 'crit' && typeof openNeedsClarify === 'function') return openNeedsClarify(r);
    if (key === 'svc' && typeof openServiceSelect === 'function') return openServiceSelect(r);
    if (key === 'cal') return openCal(r);
    if (key === 'pay') return openPay(r);
    if (key === 'summary') return openSummary(r);
  }
  function next(r, from) {
    const st = steps(r), i = st.indexOf(from);
    const k = st[i + 1]; if (!k) return;
    open(r, k);
  }

  CBX.register({
    key: 'flowsteps', label: 'שלבי המהלך לפי דרישות הפריט', icon: 'bolt',
    desc: 'הפריטים שאינם עומדים בקריטריונים ננעלים במסך הבחירה באותה שפה כמו במסך הקריטריונים, עם צ׳יפ "רק תואמים". השלבים נגזרים מהדרישות: בלי פגישה/סליקה/הסכם — ישר לסיכום; עם פגישה — תיאום ואז סיכום; עם סליקה — שיריון (אם מוגדר) וסליקה. רכישת מוצר בלי פגישה מדלגת על מסך התיאום.',
    files: ['js/ext/flow-steps.js', 'css/ext/steps.css'],
    install() {
      /* השלבים שהרצועה מציגה */
      window.FLOW_STEPS_PROVIDER = steps;

      /* --- מסך הבחירה: נעילה + צ׳יפ "רק תואמים" --- */
      if (typeof renderServiceSelect === 'function') CBX.wrap('flowsteps', 'renderServiceSelect', o => function () {
        const out = o.apply(this, arguments);
        try {
          const st = (typeof svcSelState !== 'undefined') ? svcSelState : null;
          const r = st && st.rec, body = document.querySelector('#modal .svc-sel');
          if (!r || !body) return out;

          const cards = Array.prototype.slice.call(body.querySelectorAll('[data-svc]'));
          let blocked = 0;
          cards.forEach(card => {
            const b = svcBlock(r, card.dataset.svc);
            if (!b) return;
            blocked++;
            card.classList.add('fs-locked');
            card.dataset.svcwhy = b.why;                    /* הליבה כבר חוסמת בחירה לפי זה */
            const tags = card.querySelector('.svc-tags');
            if (tags && !tags.querySelector('.fs-lock')) {
              const s = document.createElement('span');
              s.className = 'svc-tag fs-lock';
              s.innerHTML = ic('lock') + ' ' + esc(b.short);
              tags.insertBefore(s, tags.firstChild);
            }
            if (!card.querySelector('.cfx-q')) {
              const qm = document.createElement('span');
              qm.className = 'cfx-q'; qm.textContent = '?'; qm.setAttribute('role', 'button');
              qm.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
                tip(qm, b.why, (card.querySelector('b') || {}).textContent || 'הפריט נעול'); });
              card.appendChild(qm);
            }
            if (onlyFit) card.classList.add('fs-hidden');
          });

          /* הצ׳יפ */
          const list = body.querySelector('.svc-list');
          if (list && !body.querySelector('.fs-filter')) {
            const bar = document.createElement('div');
            bar.className = 'fs-filter';
            bar.innerHTML = `<button class="fs-chip ${onlyFit ? 'on' : ''}" data-fsonly>
                ${ic(onlyFit ? 'check' : 'target')} הצג רק תואמים</button>
              <small>${blocked ? blocked + ' פריטים אינם עומדים בקריטריונים' : 'כל הפריטים תואמים'}</small>`;
            list.parentNode.insertBefore(bar, list);
            bar.querySelector('[data-fsonly]').addEventListener('click', () => { onlyFit = !onlyFit; renderServiceSelect(); });
          }

          /* הכפתור הראשי — לשלב הבא האמיתי */
          const nextBtn = document.getElementById('svcNext');
          if (nextBtn) {
            const stx = steps(r, st.sel);
            const i = stx.indexOf('svc'), nk = stx[i + 1];
            const LBL = { crit: 'לקריטריונים', contract: 'להסכם', cal: 'לתיאום', pay: 'לסליקה', summary: 'לסיכום' };
            if (nk && LBL[nk]) nextBtn.innerHTML = `בחירה והמשך ${LBL[nk]} ${ic('chevronL')}`;
            if (!nextBtn.__fs) {
              nextBtn.__fs = true;
              nextBtn.addEventListener('click', (e) => {
                /* מקבעים את המסלול לפני שמירת השירותים — אחרת modeOf
                   היה מתהפך ל"יודע" ברגע שיש שירותים, והשלב הבא היה
                   קופץ חזרה לקריטריונים. */
                if (window.FLOW && FLOW.mode && !r.flowMode) r.flowMode = FLOW.mode(r);
                r.services = (st.sel || []).slice();
                /* השלב הבא נגזר מחדש *אחרי* השמירה — כך שכל שלב ביניים
                   שיתווסף בעתיד ייכנס לרצף מאליו, בלי לגעת כאן. */
                const seq = steps(r);
                const nx2 = seq[seq.indexOf('svc') + 1];
                if (!nx2) return;
                /* הכול נשאר באותו חלון — רק מחליפים את גוף המסך */
                e.preventDefault(); e.stopImmediatePropagation();
                open(r, nx2);
              }, true);
            }
          }
        } catch (e) { console.error('[flowsteps] svc', e); }
        return out;
      });

      /* --- שיריון: כשזמן השיריון 0 אין שיריון בלי תשלום --- */
      if (typeof holdSlotForPayment === 'function') CBX.wrap('flowsteps', 'holdSlotForPayment', o => function (r, s, staffName, flow) {
        if (!holdAllowed()) {
          toast('זמן השיריון בהגדרות הוא 0 — המועד לא נשמר עד להשלמת הסליקה');
          if (typeof closeProposedTimes === 'function') closeProposedTimes(false);
          setTimeout(() => openPay(r), 150);
          return;
        }
        return o.apply(this, arguments);
      });
    },
  });

  window.FLOWSTEPS = { steps, reqs: reqsOf, addReq, REQS, block: svcBlock, summary: openSummary,
    pay: openPay, open, next, holdAllowed, hasMeetingCatalog: catalogHasMeeting };
})();
