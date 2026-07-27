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
  let swapTo = null;          // מועד שנבחר להחלפה וממתין לאישור
  let calEntryTitle = '';     // הכותרת נקבעת בכניסה לשלב ולא משתנה תוך כדי

  /* המועד הנוכחי — פגישה קבועה, שיריון, או מועד שממתין לתשלום */
  function currentSlot(r) {
    if (r.meeting) return { kind: 'set', label: r.meeting.date + ' · ' + r.meeting.time,
      who: r.meeting.with || '', tag: 'נקבע' };
    if (r.slotHold) return { kind: 'hold',
      label: ((typeof cDayLbl === 'function') ? cDayLbl(r.slotHold.date) : '') + ' · ' + ((typeof fmtH === 'function') ? fmtH(r.slotHold.h) : ''),
      who: r.slotHold.staffName || '', tag: 'בשיריון זמני' };
    if (r.pendingSlot) return { kind: 'pending',
      label: ((typeof cDayLbl === 'function') ? cDayLbl(r.pendingSlot.date) : '') + ' · ' + ((typeof fmtH === 'function') ? fmtH(r.pendingSlot.h) : ''),
      who: r.pendingSlot.staffName || '', tag: 'ממתין לתשלום' };
    return null;
  }

  function openCal(r) {
    const q = reqsOf(r);
    const all = slotsFor(r);
    const days = [];
    (slotsFor(r) || []).forEach(s => { if (days.indexOf(s.date) < 0) days.push(s.date); });
    const hold = q.on.billing && holdAllowed();
    const cur = currentSlot(r);
    const sw = swapTo ? (typeof coordPool === 'function' ? coordPool().find(x => x.id === swapTo) : null) : null;
    const body = `
      ${cur ? `<div class="fs-cur ${cur.kind}">
        <div class="fs-cur-h">${ic('calendar')} <b>המועד שנבחר</b><span class="fs-cur-tag">${esc(cur.tag)}</span></div>
        <div class="fs-cur-b"><b>${esc(cur.label)}</b>${cur.who ? `<small>${esc(cur.who)}</small>` : ''}</div>
        <small class="fs-cur-n">אפשר לבחור מועד אחר מהרשימה (נדרש אישור), או להמשיך לשלב הבא.</small>
      </div>` : ''}
      ${sw ? `<div class="fs-swap">${ic('sync')}
        <div><b>להחליף את המועד?</b>
          <small>${esc(cur ? cur.label : '')} ← <b>${(typeof cDayLbl === 'function') ? esc(cDayLbl(sw.date)) : ''} · ${(typeof fmtH === 'function') ? esc(fmtH(sw.h)) : ''}</b></small></div>
        <button class="btn sm primary" data-fsswapok>${ic('check')} החלף</button>
        <button class="btn sm ghost" data-fsswapx>ביטול</button></div>` : ''}
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
    shell(r, 'cal', calEntryTitle || (cur ? 'עדכון פגישה' : 'תיאום מועד'), body,
      `${backBtn(r, 'cal')}<span class="fs-foot-n">${all.length} מועדים מתאימים</span>
       ${cur ? (function () {
         const nk = nextStep(r, 'cal');
         const L = { summary: 'סיכום הצעה', pay: 'סליקה', contract: 'הסכם' };
         return `<button class="btn primary" data-fskeep>${ic('check')} המשך ל${L[nk] || 'שלב הבא'} ${ic('chevronL')}</button>`;
       })() : ''}`);
    const host = document.querySelector('#modal .fs-step');
    host.querySelectorAll('[data-fsday]').forEach(b => b.addEventListener('click', () => { calDay = b.dataset.fsday; openCal(r); }));
    host.querySelectorAll('[data-fsslot]').forEach(b => b.addEventListener('click', () => {
      /* יש כבר מועד — לא מחליפים בלי אישור */
      if (currentSlot(r)) { swapTo = b.dataset.fsslot; openCal(r); return; }
      pickSlot(r, b.dataset.fsslot);
    }));
    const okb = document.querySelector('#modal [data-fsswapok]');
    if (okb) okb.addEventListener('click', () => { const id = swapTo; swapTo = null; releaseCurrent(r); pickSlot(r, id); });
    const xb = document.querySelector('#modal [data-fsswapx]');
    if (xb) xb.addEventListener('click', () => { swapTo = null; openCal(r); });
    const kp = document.querySelector('#modal [data-fskeep]');
    if (kp) kp.addEventListener('click', () => { swapTo = null; const nx = nextStep(r, 'cal'); if (nx) open(r, nx); });
    bindBack(r, 'cal');
  }
  /* משחררים את המועד הקודם לפני שתופסים חדש — אחרת המשבצת נשארת תפוסה */
  function releaseCurrent(r) {
    const pool = (typeof coordPool === 'function') ? coordPool() : [];
    if (r.slotHold) {
      const s = pool.find(x => x.id === r.slotHold.slotId);
      if (s) { s.held = false; s.heldBy = null; }
      if (typeof SLOT_HOLDS !== 'undefined') SLOT_HOLDS = SLOT_HOLDS.filter(x => x.id !== r.slotHold.id);
      r.slotHold = null;
    }
    if (r.pendingSlot) { const s = pool.find(x => x.id === r.pendingSlot.id); if (s) s.held = false; r.pendingSlot = null; }
    if (r.meeting) {
      const s = pool.find(x => (typeof ptFmtDate === 'function' ? ptFmtDate(x.date) : x.date) === r.meeting.date
        && (typeof fmtH === 'function' ? fmtH(x.h) : '') === r.meeting.time);
      if (s) s.booked = false;
      r.meeting = null;
    }
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
    /* לא מקדמים שלב מעצמנו — הנציג רואה מה נבחר ומחליט מתי להמשיך */
    openCal(r);
  }

  /* ---------------- הסכם לחתימה ---------------- */
  const ctState = r => (r.contract = r.contract || { tplId: null, sent: false, signed: false, at: '' });
  /* האם חובה לקבל הסכם חתום לפני סליקה — מוגדר בכרטיס הפריט */
  function mustSignFirst(r) {
    const q = reqsOf(r);
    if (!q.on.contract || !q.on.billing) return false;
    return q.list.some(t => t.requiresContract && t.contractBeforePay !== false);
  }
  function ctTemplates() {
    const all = (typeof CONTRACT_TEMPLATES !== 'undefined') ? CONTRACT_TEMPLATES : [];
    return all.filter(c => (c.audience || 'client') === 'client' && c.legalApproved);
  }
  function ctBlock(r) {
    const q = reqsOf(r), c = ctState(r), tpls = ctTemplates();
    if (!c.tplId && tpls.length) c.tplId = tpls[0].id;
    const need = q.on.contract;
    const state = c.signed ? 'signed' : (c.sent ? 'sent' : 'none');
    const LBL = { none: 'טרם נשלח', sent: 'נשלח — ממתין לחתימה', signed: 'נחתם' };
    return `<div class="fs-ct ${state} ${need ? 'need' : ''}">
      <div class="fs-sec sm">${ic('docs')} <b>הסכם לחתימה</b>
        <span class="fs-ct-tag ${state}">${need ? 'נדרש · ' : 'לא נדרש · '}${LBL[state]}</span></div>
      ${need && mustSignFirst(r) ? `<p class="fs-ct-rule">${ic('lock')} לפי הגדרת הפריט — חובה לקבל הסכם חתום <b>לפני</b> הסליקה.</p>`
        : (need ? `<p class="fs-ct-rule ok">${ic('bolt')} לפי הגדרת הפריט — אפשר לסלוק גם לפני החתימה.</p>` : '')}
      ${tpls.length ? `<label class="fs-ct-sel"><span>תבנית</span>
        <select class="cc-inp" data-fsct>${tpls.map(t => `<option value="${esc(t.id)}" ${c.tplId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`
        : `<p class="fs-none">אין תבנית הסכם מאושרת במערכת</p>`}
      <div class="fs-ct-acts">
        ${!c.sent ? `<button class="btn sm" data-fsctsend>${ic('sync')} ${need ? 'שלח לחתימה' : 'שלח הסכם לחתימה (לא חובה)'}</button>`
          : `<button class="btn sm" data-fsctsend>${ic('sync')} שלח שוב</button>`}
        ${c.sent && !c.signed ? `<button class="btn sm primary" data-fsctsign>${ic('check')} סמן כנחתם</button>` : ''}
        ${tpls.length ? `<button class="btn sm ghost" data-fsctprev>${ic('eye')} תצוגה מקדימה</button>` : ''}
      </div>
    </div>`;
  }
  function bindCt(r, rerender) {
    const c = ctState(r);
    const sel = document.querySelector('#modal [data-fsct]');
    if (sel) sel.addEventListener('change', () => { c.tplId = sel.value; });
    const sn = document.querySelector('#modal [data-fsctsend]');
    if (sn) sn.addEventListener('click', () => {
      c.sent = true; c.at = (typeof docStamp === 'function') ? docStamp() : '';
      if (typeof ctRegisterIssue === 'function' && typeof contractById === 'function') {
        const t = contractById(c.tplId); if (t) { try { ctRegisterIssue(t, r); } catch (e) {} }
      }
      toast('ההסכם נשלח ללקוח לחתימה'); rerender();
    });
    const sg = document.querySelector('#modal [data-fsctsign]');
    if (sg) sg.addEventListener('click', () => {
      c.signed = true; toast('ההסכם סומן כנחתם'); rerender();
    });
    const pv = document.querySelector('#modal [data-fsctprev]');
    if (pv) pv.addEventListener('click', () => {
      const t = (typeof contractById === 'function') ? contractById(c.tplId) : null;
      if (t && typeof openContractWizard === 'function') openContractWizard(t, r, 'preview');
      else toast('אין תצוגה מקדימה זמינה');
    });
  }

  /* ---------------- סיכום הצעה ---------------- */
  function openSummary(r) {
    const q = reqsOf(r);
    const price = (window.BOOKMODE && BOOKMODE.price) ? BOOKMODE.price(r) : { base: 0, disc: 0, final: 0 };
    const dur = q.list.reduce((s, t) => s + (+t.dur || 0), 0);
    const dep = q.list.reduce((s, t) => s + (+t.deposit || 0), 0);
    const tpl = (typeof contractById === 'function' && ctState(r).tplId) ? contractById(ctState(r).tplId) : null;
    const terms = (typeof ctSvcTermsFor === 'function') ? ctSvcTermsFor(r, tpl) : [];
    const when = r.meeting ? (r.meeting.date + ' ' + r.meeting.time)
      : r.slotHold ? ((typeof cDayLbl === 'function' ? cDayLbl(r.slotHold.date) : '') + ' ' + (typeof fmtH === 'function' ? fmtH(r.slotHold.h) : '') + ' · בשיריון')
      : r.pendingSlot ? ((typeof cDayLbl === 'function' ? cDayLbl(r.pendingSlot.date) : '') + ' ' + (typeof fmtH === 'function' ? fmtH(r.pendingSlot.h) : '') + ' · ממתין לתשלום') : '';
    const body = `
      <div class="sm-head">
        <div class="sm-h-ic">${ic('docs')}</div>
        <div><b>פריטים נבחרים להסכם</b>
          <small>${esc(r.name)}${r.org ? ' · ' + esc(r.org) : ''} · ${esc(((typeof JOURNEY_TYPES !== 'undefined' && JOURNEY_TYPES[r.journey]) || {}).label || '')}</small></div>
      </div>

      <div class="sm-tbl-wrap"><table class="sm-tbl">
        <thead><tr>
          <th>שם הפריט</th><th>קטגוריה</th><th>משך</th><th>מחיר</th><th>מקדמה</th>
          <th>סליקה / חיוב</th><th>פגישה</th><th>הנחיות</th>
        </tr></thead>
        <tbody>${q.list.map(t => `<tr>
          <td class="sm-name"><b>${esc(t.label)}</b>${t.subType ? `<span class="sm-sub">${esc(t.subType)}</span>` : ''}</td>
          <td><span class="sm-chip">${esc(t.kind || '')}</span></td>
          <td>${t.dur ? t.dur + ' דק׳' : '—'}</td>
          <td>${t.price ? money(t.price) : '—'}</td>
          <td>${t.deposit ? money(t.deposit) : '0 ₪'}</td>
          <td>${t.requiresBilling ? '<span class="sm-b need">נדרש חיוב</span>' : '<span class="sm-b free">ללא סליקה</span>'}</td>
          <td>${t.requiresMeeting ? '<span class="sm-b meet">נדרשת</span>' : '<span class="sm-b none">לא נדרשת</span>'}</td>
          <td class="sm-icons">${t.pre ? `<span title="${esc(t.pre)}">${ic('note')}</span>` : ''}
            ${t.instr ? `<span class="in" title="${esc(t.instr)}">${ic('tasks')}</span>` : ''}
            ${!t.pre && !t.instr ? '<i>—</i>' : ''}</td>
        </tr>`).join('') || '<tr><td colspan="8" class="sm-empty">לא נבחרו פריטים</td></tr>'}</tbody>
      </table></div>
      <button class="sm-add" data-fsedit>${ic('plus')} הוספה או שינוי של פריטים</button>

      <div class="sm-money">
        <div class="sm-m"><span>פריטים</span><b>${q.list.length}</b></div>
        <div class="sm-m"><span>זמן כולל</span><b>${dur} דק׳</b></div>
        <div class="sm-m"><span>סה״כ מחיר</span><b>${money(price.base)}</b></div>
        ${price.disc ? `<div class="sm-m off"><span>הנחה${r.offer && r.offer.discType === 'pct' && +r.offer.discVal ? ' ' + (+r.offer.discVal) + '%' : ''}</span>
          <b>−${money(price.disc)}</b></div>` : ''}
        <div class="sm-m"><span>מקדמה כוללת</span><b>${money(dep)}</b></div>
        <div class="sm-m tot"><span>יתרה לחיוב</span><b>${money(Math.max(0, price.final - dep))}</b></div>
      </div>

      <div class="sm-grid">
        <div class="sm-card">
          <div class="sm-c-h">${ic('clients')} <b>מה יופיע ללקוח בהסכם</b></div>
          <ul class="sm-list">
            ${(r.offer && r.offer.validUntil) ? `<li>${ic('check')} תוקף ההצעה: ${esc(r.offer.validUntil)}</li>` : ''}
            ${price.disc ? `<li>${ic('check')} הנחה שסוכמה: ${money(price.disc)}</li>` : ''}
            ${terms.length ? terms.slice(0, 5).map(t => `<li>${ic('check')} ${esc(t.title)}</li>`).join('')
              : `<li class="muted">${q.on.contract ? 'טרם נבחרה תבנית הסכם' : 'לא נדרש הסכם לפריטים שנבחרו'}</li>`}
            ${terms.length > 5 ? `<li class="muted">ועוד ${terms.length - 5} תנאים</li>` : ''}
          </ul>
        </div>
        <div class="sm-card">
          <div class="sm-c-h">${ic('note')} <b>הנחיות פנימיות</b></div>
          <ul class="sm-list">
            ${q.list.filter(t => t.instr).map(t => `<li>${ic('check')} ${esc(t.label)}: ${esc(t.instr)}</li>`).join('')}
            ${q.on.contract ? `<li>${ic('check')} להחתים על ההסכם ${mustSignFirst(r) ? 'לפני הסליקה' : 'במהלך התהליך'}</li>` : ''}
            ${q.on.billing ? `<li>${ic('check')} להסביר תנאי סליקה ותשלום</li>` : ''}
            ${(r.needs || {}).note ? `<li>${ic('check')} ${esc(String(r.needs.note).slice(0, 90))}</li>` : ''}
            ${!q.list.some(t => t.instr) && !q.on.contract && !q.on.billing ? '<li class="muted">אין הנחיות מיוחדות</li>' : ''}
          </ul>
        </div>
        <div class="sm-card">
          <div class="sm-c-h">${ic('calendar')} <b>מועד ותיאום</b></div>
          <ul class="sm-list">
            ${when ? `<li>${ic('check')} ${esc(when)}</li>` : `<li class="muted">${q.on.meeting ? 'טרם נבחר מועד' : 'לא נדרשת פגישה'}</li>`}
            ${r.paid ? `<li>${ic('check')} שולם · ${esc(r.paid.ref || '')}</li>` : (q.on.billing ? '<li class="muted">טרם שולם</li>' : '')}
          </ul>
        </div>
      </div>
      ${ctBlock(r)}`;
    const nx = nextStep(r, 'summary');
    const gate = nx === 'pay' && mustSignFirst(r) && !ctState(r).signed;
    shell(r, 'summary', 'סיכום הצעה', body,
      `${backBtn(r, 'summary')}
       ${gate ? `<span class="fs-gate">${ic('lock')} נדרש הסכם חתום לפני סליקה</span>` : ''}
       <button class="btn primary" data-fsnext ${gate ? 'disabled' : ''}>${ic('check')} ${nx === 'pay' ? 'המשך לסליקה' : 'סיום'}</button>`);
    bindBack(r, 'summary');
    bindCt(r, () => openSummary(r));
    const ed = document.querySelector('#modal [data-fsedit]');
    if (ed) ed.addEventListener('click', () => { if (typeof openServiceSelect === 'function') openServiceSelect(r); });
    const b = document.querySelector('#modal [data-fsnext]');
    if (b) b.addEventListener('click', () => {
      if (gate) { toast('יש לשלוח את ההסכם ולקבל אותו חתום לפני הסליקה'); return; }
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
      if (mustSignFirst(r) && !ctState(r).signed) { toast('נדרש הסכם חתום לפני סליקה — חזרה לסיכום ההצעה'); return openSummary(r); }
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
    if (key === 'cal') { calEntryTitle = currentSlot(r) ? 'עדכון פגישה' : 'תיאום מועד'; return openCal(r); }
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
