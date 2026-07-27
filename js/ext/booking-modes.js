/* ============================================================
   הרחבה: מסלולי סגירה — מוצר · פגישה חינם · פגישה בתשלום
   key = 'bookmode'
   ------------------------------------------------------------
   מה שנבחר בקטלוג קובע איך התהליך נסגר, ולכן גם מה מוצג בליד:

     מוצר בלבד (לא דורש פגישה)
       אין תיאום כלל — רק מעבר לרכישה. אם קטגוריית המוצר דורשת
       הסכם, מוצג גם כפתור ההסכם לחתימה.

     פגישה בלי תשלום ובלי הסכם
       אחרי התיאום נשארים עם מועד הפגישה וכפתור עין שמציג את
       ההנחיות והמידע לטיפול.

     פגישה + סליקה
       אפשר לשריין זמנית — ואז המועד יושב בכרטיס הליד בכתום, עם
       אזהרה ושעון יורד לשעות/דקות/שניות. סליקה שאושרה סוגרת את
       השיריון; מי שלא מאשר ולא רוצה לשריין יוצא בלי תאריך.

   בנוסף: בתוך מסך התיאום, כששירות בתשלום נבחר — תוקף הצעה,
   קוד קופון והנחה (סכום או אחוז) עם חישוב חי.
   ============================================================ */
(function () {

  const treats = r => ((r && r.services) || []).map(k => (typeof cTreat === 'function') ? cTreat(k) : null).filter(Boolean);
  const flags = r => {
    const l = treats(r);
    return { any: l.length, meet: l.some(t => t.requiresMeeting), pay: l.some(t => t.requiresBilling),
      contract: l.some(t => t.requiresContract), freeSched: l.every(t => t.canScheduleWithoutBilling !== false), list: l };
  };
  function modeOf(r) {
    const f = flags(r);
    if (!f.any) return 'none';
    if (!f.meet) return 'product';
    return f.pay ? 'paid' : 'free';
  }

  /* ---------------- הצעה: תוקף · קופון · הנחה ---------------- */
  function offerOf(r) { return (r.offer = r.offer || { validUntil: '', coupon: '', discType: 'pct', discVal: 0, couponOk: null }); }
  const COUPONS = { WELCOME10: { t: 'pct', v: 10, label: 'הצטרפות · 10%' },
    SUMMER50: { t: 'sum', v: 50, label: 'קיץ · 50 ₪' },
    VIP15: { t: 'pct', v: 15, label: 'לקוח VIP · 15%' } };
  function priceOf(r, keys) {
    const base = (typeof svcTotals === 'function') ? svcTotals(keys || r.services || []).price : 0;
    const o = offerOf(r);
    let d = 0;
    if (+o.discVal > 0) d = o.discType === 'pct' ? Math.round(base * Math.min(100, +o.discVal) / 100) : Math.min(base, +o.discVal);
    return { base, disc: d, final: Math.max(0, base - d) };
  }
  function offerHTML(r, keys) {
    const o = offerOf(r), p = priceOf(r, keys);
    return `<div class="bm-offer">
      <div class="bm-offer-h">${ic('bolt')} <b>תנאי ההצעה</b>
        <small>נשמרים על הפנייה ועוברים להצעת המחיר ולהסכם</small></div>
      <div class="bm-offer-g">
        <label class="bm-f"><span>${ic('calendar')} תוקף ההצעה</span>
          <input type="date" class="cc-inp" id="bmValid" value="${esc(o.validUntil || '')}"></label>
        <label class="bm-f"><span>${ic('flag')} קוד קופון</span>
          <input class="cc-inp" id="bmCoupon" placeholder="למשל WELCOME10" value="${esc(o.coupon || '')}">
          ${o.couponOk === true ? `<small class="bm-ok">${ic('check')} ${esc(o.couponLbl || 'הקופון הוחל')}</small>`
            : o.couponOk === false ? `<small class="bm-bad">${ic('alert')} קוד לא מוכר</small>` : ''}</label>
        <div class="bm-f"><span>${ic('check')} הנחה</span>
          <div class="bm-disc">
            <div class="bm-seg">
              <button class="${o.discType === 'pct' ? 'on' : ''}" data-bmdt="pct">%</button>
              <button class="${o.discType === 'sum' ? 'on' : ''}" data-bmdt="sum">₪</button>
            </div>
            <input type="number" class="cc-inp" id="bmDisc" min="0" value="${+o.discVal || 0}">
          </div></div>
      </div>
      <div class="bm-tot">
        <span>מחיר מלא <b>${p.base} ₪</b></span>
        ${p.disc ? `<span class="bm-off">הנחה <b>−${p.disc} ₪</b></span>` : ''}
        <span class="bm-fin">לתשלום <b>${p.final} ₪</b></span>
      </div></div>`;
  }
  /* רינדור מקומי בלבד — הבלוק מצייר את עצמו מחדש בלי לרנדר את כל המסך,
     אחרת כל לחיצה על מתג נבלעת ברינדור הגדול והמתג "לא עובד". */
  function mountOffer(box, r, keysFn) {
    const draw = () => {
      box.innerHTML = offerHTML(r, keysFn ? keysFn() : null);
      bindOffer(box, r, draw, keysFn);
    };
    draw();
    return draw;
  }
  function bindOffer(host, r, after, keysFn) {
    const o = offerOf(r);
    const rr = () => { if (typeof after === 'function') after(); };
    const v = host.querySelector('#bmValid');
    if (v) v.addEventListener('change', () => { o.validUntil = v.value; toast(v.value ? 'תוקף ההצעה נשמר' : 'התוקף הוסר'); rr(); });
    const c = host.querySelector('#bmCoupon');
    if (c) c.addEventListener('change', () => {
      const code = (c.value || '').trim().toUpperCase();
      o.coupon = code;
      if (!code) { o.couponOk = null; }
      else if (COUPONS[code]) { const x = COUPONS[code]; o.couponOk = true; o.couponLbl = x.label; o.discType = x.t; o.discVal = x.v; toast('הקופון הוחל · ' + x.label); }
      else { o.couponOk = false; toast('קוד קופון לא מוכר'); }
      rr();
    });
    host.querySelectorAll('[data-bmdt]').forEach(b => b.addEventListener('click', () => { o.discType = b.dataset.bmdt; rr(); }));
    const d = host.querySelector('#bmDisc');
    if (d) d.addEventListener('change', () => { o.discVal = Math.max(0, +d.value || 0); o.coupon = o.coupon && o.couponOk ? o.coupon : o.coupon; rr(); });
  }

  /* ---------------- שעון יורד לשעות/דקות/שניות ---------------- */
  function holdEndsAt(h) {
    if (!h.__endsAt) h.__endsAt = Date.now() + (h.minsLeft || 0) * 60000;
    return h.__endsAt;
  }
  function leftParts(h) {
    const ms = Math.max(0, holdEndsAt(h) - Date.now());
    const s = Math.floor(ms / 1000);
    return { hh: Math.floor(s / 3600), mm: Math.floor((s % 3600) / 60), ss: s % 60, ms };
  }
  const two = n => String(n).padStart(2, '0');

  /* ---------------- ההנחיות והמידע (כפתור העין) ---------------- */
  function openInfo(r) {
    const old = document.getElementById('bmInfo'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'bmInfo';
    const l = treats(r), m = r.meeting;
    w.innerHTML = `<div class="cbc-box bm-info" style="max-width:520px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('eye')}</span><b>ההנחיות והמידע לפגישה</b></div>
      ${m ? `<div class="bm-when">${ic('calendar')} <b>${esc(m.date)} · ${esc(m.time)}</b>
        <span>${esc(m.with || '')}${m.branch && typeof cBranch === 'function' && cBranch(m.branch) ? ' · ' + esc(cBranch(m.branch).short || cBranch(m.branch).label) : ''}</span></div>` : ''}
      <div class="bm-info-l">${l.map(t => `<div class="bm-info-i">
        <b>${ic('layers')} ${esc(t.label)}</b>
        ${t.pre ? `<div class="bm-info-r"><span>לפני</span><p>${esc(t.pre)}</p></div>` : ''}
        ${t.instr ? `<div class="bm-info-r"><span>מהלך</span><p>${esc(t.instr)}</p></div>` : ''}
        ${!t.pre && !t.instr ? '<div class="bm-info-r none">לא הוגדרו הנחיות לשירות הזה בקטלוג</div>' : ''}
      </div>`).join('') || '<p class="bm-info-r none">לא נבחרו שירותים</p>'}</div>
      <div class="cbc-actions">
        <button class="btn" id="bmInfoSend">${ic('sync')} שלח ללקוח</button>
        <button class="btn primary" id="bmInfoX">${ic('check')} סגור</button></div></div>`;
    document.body.appendChild(w);
    w.querySelector('#bmInfoX').addEventListener('click', () => w.remove());
    w.querySelector('#bmInfoSend').addEventListener('click', () => { w.remove(); toast('ההנחיות נשלחו ללקוח'); });
    w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
  }

  /* ---------------- הסרגל בתוך הליד ---------------- */
  function barHTML(r) {
    const mode = modeOf(r); if (mode === 'none') return '';
    const f = flags(r), m = r.meeting, h = r.slotHold;

    if (mode === 'product') return `<div class="bm-bar product">${ic('layers')}
      <div><b>מוצר — אין צורך בתיאום פגישה</b>
        <small>${esc(f.list.map(t => t.label).join(' · '))}${f.pay ? ' · ' + priceOf(r).final + ' ₪' : ''}</small></div>
      ${f.pay ? `<button class="btn sm primary" data-bmbuy>${ic('check')} מעבר לרכישה</button>` : ''}
      ${f.contract ? `<button class="btn sm" data-bmct>${ic('docs')} הסכם לחתימה</button>` : ''}</div>`;

    if (mode === 'free') return m
      ? `<div class="bm-bar ok">${ic('check')}
          <div><b>הפגישה נקבעה — אין תשלום ואין הסכם</b>
            <small>${esc(m.date)} · ${esc(m.time)}${m.with ? ' · ' + esc(m.with) : ''}</small></div>
          <button class="btn sm" data-bmeye title="הנחיות ומידע">${ic('eye')} הנחיות ומידע</button></div>`
      : `<div class="bm-bar">${ic('calendar')}
          <div><b>שירות ללא תשלום — נשאר רק לתאם</b>
            <small>${esc(f.list.map(t => t.label).join(' · '))}</small></div>
          <button class="btn sm primary" data-bmflow>${ic('calendar')} לתיאום פגישה</button></div>`;

    /* paid */
    if (h) { const t = leftParts(h);
      return `<div class="bm-bar hold ${t.ms <= 120000 ? 'urgent' : ''}">${ic('alert')}
        <div><b>המועד בשיריון זמני — טרם שולם</b>
          <small>${typeof cDayLbl === 'function' ? cDayLbl(h.date) : ''} ${typeof fmtH === 'function' ? fmtH(h.h) : ''}${h.staffName ? ' · ' + esc(h.staffName) : ''} · ${priceOf(r).final} ₪</small></div>
        <span class="bm-clock" data-bmclock>${t.hh ? two(t.hh) + ':' : ''}${two(t.mm)}:${two(t.ss)}</span>
        <button class="btn sm primary" data-bmpay>${ic('check')} להמשך סליקה</button>
        <button class="btn sm" data-bmdrop>${ic('close')} שחרר</button></div>`; }
    if (m) return `<div class="bm-bar ok">${ic('check')}
      <div><b>שולם והתור שוריין</b><small>${esc(m.date)} · ${esc(m.time)}${m.with ? ' · ' + esc(m.with) : ''}</small></div>
      <button class="btn sm" data-bmeye>${ic('eye')} הנחיות ומידע</button></div>`;
    return `<div class="bm-bar pay">${ic('lock')}
      <div><b>שירות בתשלום — התור נסגר רק אחרי סליקה</b>
        <small>${esc(f.list.map(t => t.label).join(' · '))} · ${priceOf(r).final} ₪
          · ${f.freeSched ? 'ניתן לתאם גם לפני תשלום' : 'שיריון זמני עד להשלמת הסליקה'}</small></div>
      <button class="btn sm primary" data-bmflow>${ic('calendar')} לתיאום וסליקה</button>
      <button class="btn sm" data-bmhold>${ic('lock')} שריון זמני</button>
      <button class="btn sm ghost" data-bmnodate>${ic('close')} צא בלי תאריך</button></div>`;
  }

  function bind(r) {
    const q = s => document.querySelector(s);
    const go = () => { if (typeof renderDrawerTab === 'function') renderDrawerTab(r); };
    const a = q('[data-bmflow]'); if (a) document.querySelectorAll('[data-bmflow]').forEach(b => b.addEventListener('click', () => {
      if (typeof openServiceSelect === 'function') openServiceSelect(r); }));
    const e = q('[data-bmeye]'); if (e) e.addEventListener('click', () => openInfo(r));
    const buy = q('[data-bmbuy]'); if (buy) buy.addEventListener('click', () => {
      if (typeof openPayPanel === 'function') openPayPanel(r);
      else if (typeof openBillingPanel === 'function') openBillingPanel(r);
      else toast('מעבר לסליקה · ' + priceOf(r).final + ' ₪'); });
    const ct = q('[data-bmct]'); if (ct) ct.addEventListener('click', () => {
      const c = (typeof CONTRACT_TEMPLATES !== 'undefined') ? CONTRACT_TEMPLATES.find(x => (x.audience || 'client') === 'client' && x.legalApproved) : null;
      if (c && typeof openContractWizard === 'function') openContractWizard(c, r, 'preview');
      else toast('אין תבנית הסכם מאושרת'); });
    const pay = q('[data-bmpay]'); if (pay) pay.addEventListener('click', () => {
      const h = r.slotHold; if (!h) return;
      const slot = (typeof coordPool === 'function') ? coordPool().find(x => x.id === h.slotId) : null;
      if (typeof openHoldPaymentPanel === 'function') openHoldPaymentPanel(r, slot, h); });
    const hd = q('[data-bmhold]'); if (hd) hd.addEventListener('click', () => {
      if (typeof openProposedTimes === 'function') { openProposedTimes(r); toast('בחר מועד — הוא יישמר בשיריון זמני עד להשלמת הסליקה'); }
      else if (typeof openServiceSelect === 'function') openServiceSelect(r); });
    const dr = q('[data-bmdrop]'); if (dr) dr.addEventListener('click', () => {
      const h = r.slotHold; if (!h) return;
      const slot = (typeof coordPool === 'function') ? coordPool().find(x => x.id === h.slotId) : null;
      if (typeof releaseHold === 'function') releaseHold(h, r, slot, true);
      go(); });
    const nd = q('[data-bmnodate]'); if (nd) nd.addEventListener('click', () => {
      r.meeting = null; r.noDate = true;
      r.next = { type: 'followup', at: '' };
      if (r.status) r.status = { label: 'ללא תאריך — ממתין להחלטת הלקוח', color: 'amber' };
      toast('נסגר בלי תאריך · הפנייה נשארת פתוחה למעקב');
      go(); if (typeof renderList === 'function') renderList(); });

    /* השעון — פעימה כל שנייה, בלי לרנדר מחדש את כל המגירה */
    if (window.__bmTick) { clearInterval(window.__bmTick); window.__bmTick = null; }
    if (r.slotHold) window.__bmTick = setInterval(() => {
      const el = document.querySelector('[data-bmclock]');
      if (!el || !r.slotHold) { clearInterval(window.__bmTick); window.__bmTick = null; return; }
      const t = leftParts(r.slotHold);
      el.textContent = (t.hh ? two(t.hh) + ':' : '') + two(t.mm) + ':' + two(t.ss);
      const bar = el.closest('.bm-bar'); if (bar) bar.classList.toggle('urgent', t.ms <= 120000);
      if (t.ms <= 0) { clearInterval(window.__bmTick); window.__bmTick = null;
        if (typeof renderDrawerTab === 'function') renderDrawerTab(r); }
    }, 1000);
  }

  CBX.register({
    key: 'bookmode', label: 'מסלולי סגירה — מוצר · פגישה · סליקה', icon: 'bolt',
    desc: 'מוצר נסגר בלי תיאום (עם כפתור הסכם אם נדרש), שירות חינם נסגר במועד + כפתור הנחיות, ושירות בתשלום מציע שיריון זמני עם שעון יורד לשניות, סליקה, או יציאה בלי תאריך. במסך התיאום נוספו תוקף הצעה, קופון והנחה.',
    files: ['js/ext/booking-modes.js', 'css/ext/booking.css'],
    install() {
      /* סרגל אחד בתוך הליד — עם הכפתור שפותח את ממשק התיאום והמכירה */
      if (typeof flowHTML === 'function') CBX.wrap('bookmode', 'flowHTML', o => function (r) {
        const html = o.apply(this, arguments);
        try {
          const bar = barHTML(r);
          return bar ? html.replace('<div class="sec-title">', bar + '<div class="sec-title">') : html;
        } catch (e) { console.error('[bookmode]', e); return html; }
      });

      if (typeof renderDrawerTab === 'function') CBX.wrap('bookmode', 'renderDrawerTab', o => function (r) {
        const out = o.apply(this, arguments);
        try { bind(r); } catch (e) { console.error('[bookmode] bind', e); }
        return out;
      });

      /* תוקף · קופון · הנחה — בשלב בחירת השירות/המוצר, ליד סיכום המחיר */
      if (typeof renderServiceSelect === 'function') CBX.wrap('bookmode', 'renderServiceSelect', o => function () {
        const out = o.apply(this, arguments);
        try {
          const st = (typeof svcSelState !== 'undefined') ? svcSelState : null;
          const r = st && st.rec, body = document.querySelector('#modal .svc-sel');
          if (!r || !body || body.querySelector('.bm-offer-box')) return out;
          const sel = () => (svcSelState && svcSelState.sel) || [];
          const paid = sel().map(k => (typeof cTreat === 'function') ? cTreat(k) : null)
            .filter(Boolean).some(t => t.price > 0 || t.requiresBilling);
          if (!paid) return out;
          const box = document.createElement('div'); box.className = 'bm-offer-box';
          const sum = body.querySelector('.svc-summary');
          sum ? sum.parentNode.insertBefore(box, sum) : body.appendChild(box);
          mountOffer(box, r, sel);
        } catch (e) { console.error('[bookmode] offer', e); }
        return out;
      });

      CBX._remember('bookmode', () => { if (window.__bmTick) { clearInterval(window.__bmTick); window.__bmTick = null; } });
    },
  });

  window.BOOKMODE = { mode: modeOf, price: priceOf, offer: offerOf, info: openInfo, flags };
})();
