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
  function steps(r) {
    const mode = (window.FLOW && FLOW.mode) ? FLOW.mode(r) : 'unknown';
    const base = mode === 'unknown' ? ['crit', 'svc'] : ['svc', 'crit'];
    const q = reqsOf(r);
    if (!q.list.length) return base.concat(['summary']);
    const out = base.slice();
    if (q.on.contract) out.push('contract');
    /* פגישה — רק אם פריט דורש אותה, או שסומנה פגישה פנימית לקידום */
    if (q.on.meeting || r.internalMeet) out.push('cal');
    if (q.on.billing) out.push('pay');
    out.push('summary');
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

  /* ---------------- סיכום ---------------- */
  function openSummary(r) {
    const q = reqsOf(r);
    const price = (window.BOOKMODE && BOOKMODE.price) ? BOOKMODE.price(r) : { base: 0, disc: 0, final: 0 };
    const dur = q.list.reduce((s, t) => s + (+t.dur || 0), 0);
    const old = document.getElementById('fsSum'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'fsSum';
    const money = n => (n || 0).toLocaleString('he-IL') + ' ₪';
    w.innerHTML = `<div class="cbc-box fs-sum" style="max-width:640px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('check')}</span>
        <div><b>סיכום</b><small class="fs-sub">${esc(r.name)}${r.org ? ' · ' + esc(r.org) : ''}</small></div></div>

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
          ${r.meeting ? `<div class="fs-kv"><span>מועד</span><b>${esc(r.meeting.date)} ${esc(r.meeting.time)}</b></div>` : ''}
          ${r.paid ? `<div class="fs-kv"><span>תשלום</span><b class="ok">שולם · ${esc(r.paid.ref || '')}</b></div>` : ''}
        </div>
        <div class="fs-box">
          <div class="fs-sec sm">${ic('bolt')} <b>מה נדרש בפריטים</b></div>
          ${REQS.map(x => `<div class="fs-kv"><span>${ic(x.icon)} ${esc(x.label)}</span>
            <b class="${q.on[x.key] ? 'need' : 'no'}">${q.on[x.key] ? 'נדרש' : 'לא נדרש'}</b></div>`).join('')}
        </div>
      </div>

      <div class="cbc-actions">
        <button class="btn ghost" id="fsBack">${ic('layers')} חזרה לפריטים</button>
        <button class="btn primary" id="fsDone">${ic('check')} סיום</button>
      </div></div>`;
    document.body.appendChild(w);
    w.querySelector('#fsBack').addEventListener('click', () => { w.remove(); if (typeof openServiceSelect === 'function') openServiceSelect(r); });
    w.querySelector('#fsDone').addEventListener('click', () => {
      w.remove(); r.dealDone = true;
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
    const money = n => (n || 0).toLocaleString('he-IL') + ' ₪';
    const old = document.getElementById('fsPay'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'fsPay';
    w.innerHTML = `<div class="cbc-box fs-box2" style="max-width:520px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('check')}</span><b>סליקה · ${esc(r.name)}</b></div>
      ${r.slotHold ? `<div class="fs-hold">${ic('lock')} <b>המועד בשיריון זמני</b>
          <small>${typeof cDayLbl === 'function' ? cDayLbl(r.slotHold.date) : ''} ${typeof fmtH === 'function' ? fmtH(r.slotHold.h) : ''}
          · הסליקה תהפוך אותו לתור קבוע</small></div>`
        : (q.on.meeting ? `<div class="fs-hold warn">${ic('alert')} <b>אין שיריון פעיל</b>
            <small>${holdAllowed() ? 'המועד לא נשמר' : 'זמן השיריון בהגדרות הוא 0 — לא ניתן לשריין בלי תשלום'}</small></div>` : '')}
      <div class="fs-kv big"><span>לתשלום</span><b>${money(due)}</b></div>
      ${dep && price.final > dep ? `<div class="fs-kv"><span>יתרה</span><b>${money(price.final - dep)}</b></div>` : ''}
      <p class="fs-hint">${ic('alert')} הסליקה מתבצעת כרגע בפלטפורמה חיצונית. אפשר לשלוח קישור,
        או לאשר כאן שהתשלום כבר בוצע — והמערכת תמשיך בהתאם.</p>
      <div class="cbc-actions col">
        <button class="btn" id="fsPayLink">${ic('sync')} שליחת קישור סליקה ללקוח</button>
        <button class="btn primary" id="fsPayOK">${ic('check')} אשר שבוצעה סליקה</button>
        <button class="btn ghost" id="fsPayX">חזרה</button>
      </div></div>`;
    document.body.appendChild(w);
    const done = (ref, note) => {
      r.paid = { at: (typeof docStamp === 'function') ? docStamp() : '', amount: due, ref, mode: 'external' };
      if (r.slotHold) {   /* השיריון הופך לתור קבוע */
        const s = (typeof coordPool === 'function') ? coordPool().find(x => x.id === r.slotHold.slotId) : null;
        if (s) { s.booked = true; s.held = false; }
        r.meeting = { date: (typeof ptFmtDate === 'function') ? ptFmtDate(r.slotHold.date) : r.slotHold.date,
          time: (typeof fmtH === 'function') ? fmtH(r.slotHold.h) : '', dur: 60,
          channel: r.slotHold.staffName || '', with: r.slotHold.staffName || '' };
        if (typeof SLOT_HOLDS !== 'undefined') SLOT_HOLDS = SLOT_HOLDS.filter(x => x.id !== r.slotHold.id);
        r.slotHold = null;
      }
      w.remove(); toast(note);
      if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
      openSummary(r);
    };
    w.querySelector('#fsPayLink').addEventListener('click', () => {
      r.payLinkSent = true; toast('קישור סליקה נשלח ללקוח · הפנייה תתעדכן עם החיווי');
      w.remove(); openSummary(r);
    });
    w.querySelector('#fsPayOK').addEventListener('click', () => done('EXT-' + ((r.id || 0) * 7 + 1000), 'הסליקה אושרה · ' + money(due)));
    w.querySelector('#fsPayX').addEventListener('click', () => w.remove());
  }

  /* ---------------- ניווט ---------------- */
  function open(r, key) {
    if (key === 'crit' && typeof openNeedsClarify === 'function') return openNeedsClarify(r);
    if (key === 'svc' && typeof openServiceSelect === 'function') return openServiceSelect(r);
    if (key === 'cal' && typeof openProposedTimes === 'function') return openProposedTimes(r);
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
            const stx = steps(Object.assign({}, r, { services: st.sel }));
            const i = stx.indexOf('svc'), nk = stx[i + 1];
            const LBL = { crit: 'לקריטריונים', contract: 'להסכם', cal: 'לתיאום', pay: 'לסליקה', summary: 'לסיכום' };
            if (nk && LBL[nk]) nextBtn.innerHTML = `בחירה והמשך ${LBL[nk]} ${ic('chevronL')}`;
            if (!nextBtn.__fs) {
              nextBtn.__fs = true;
              nextBtn.addEventListener('click', () => {
                r.services = (st.sel || []).slice();
                if (!nk || nk === 'cal') return;             /* הליבה כבר מטפלת בתיאום */
                setTimeout(() => { if (typeof closeModal === 'function') closeModal(); open(r, nk); }, 30);
              }, true);
            }
          }
        } catch (e) { console.error('[flowsteps] svc', e); }
        return out;
      });

      /* --- אחרי התיאום: סיכום, או סליקה אם נדרשת --- */
      if (typeof closeProposedTimes === 'function') CBX.wrap('flowsteps', 'closeProposedTimes', o => function () {
        const r = (typeof proposeState !== 'undefined') ? proposeState.rec : null;
        const out = o.apply(this, arguments);
        try {
          if (!r || (!r.meeting && !r.slotHold)) return out;
          if (document.getElementById('fsSum') || document.getElementById('fsPay')) return out;
          const q = reqsOf(r);
          setTimeout(() => { q.on.billing && !r.paid ? openPay(r) : openSummary(r); }, 220);
        } catch (e) {}
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
