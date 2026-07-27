/* ============================================================
   הרחבה: אתר סחר וממשק חנות  ·  key = 'shop'
   ------------------------------------------------------------
   הופכת את הקטלוג (שירותים) + המלאי (מוצרים) לחנות שהלקוח
   מזמין ממנה בעצמו: קטלוג, עגלה, קופונים, תיאום תור עצמי,
   ותשלום. ההזמנה נכנסת חזרה למערכת כליד/הזמנה, והמלאי יורד.
   תלויה בהרחבת המלאי רק למוצרים — בלעדיה מציגה שירותים בלבד.
   ============================================================ */
(function () {

  const SHOP_DEF = {
    name: 'CallBiz Beauty', tagline: 'טיפולים ומוצרים — הזמנה אונליין',
    currency: '₪', pickup: true, ship: true, shipCost: 29, shipFree: 300,
    selfBook: true, requireApproval: false, terms: 'ביטול עד 48 שעות לפני המועד.',
  };
  let SHOP = Object.assign({}, SHOP_DEF, CBX.load('shop_cfg', {}));
  let COUPONS = CBX.load('shop_coupons', [
    { code: 'WELCOME10', kind: 'pct', val: 10, min: 0, uses: 0, max: 100, on: true, note: 'הנחת הצטרפות' },
    { code: 'SHIP0', kind: 'ship', val: 0, min: 150, uses: 0, max: 0, on: true, note: 'משלוח חינם מ-150 ₪' },
    { code: 'קיץ50', kind: 'sum', val: 50, min: 200, uses: 0, max: 50, on: true, note: 'מבצע קיץ' },
  ]);
  let ORDERS = CBX.load('shop_orders', []);
  let CART = [];
  let shopView = 'store';   // store | cart | checkout | done
  let shopCat = 'all', shopCoupon = null, shopSlot = null, shopFulfil = 'pickup';
  let lastOrder = null;

  const saveCfg = () => CBX.store('shop_cfg', SHOP);
  const saveCoupons = () => CBX.store('shop_coupons', COUPONS);
  const saveOrders = () => CBX.store('shop_orders', ORDERS.slice(0, 100));

  /* ---------------- קטלוג החנות ---------------- */
  function shopServices() {
    return (typeof COORD_TREATMENTS !== 'undefined' ? COORD_TREATMENTS : [])
      .filter(t => t.price > 0 || t.dur)
      .map(t => ({ id: 'svc:' + t.key, kind: 'service', name: t.label, price: +t.price || 0,
        dur: t.dur, color: t.color, desc: t.pre || t.instr || '', cat: t.kind || 'שירות', book: true }));
  }
  function shopProducts() {
    if (!window.INV || !CBX.isOn('inv')) return [];
    return window.INV.sellable().map(i => ({ id: 'prd:' + i.sku, kind: 'product', name: i.name,
      price: +i.price || 0, desc: i.desc || '', cat: i.cat, sku: i.sku, stock: window.INV.stock(i.sku), book: false }));
  }
  function shopAll() { return shopServices().concat(shopProducts()); }
  function shopCats() { return ['all'].concat([...new Set(shopAll().map(x => x.cat))]); }

  /* ---------------- עגלה ---------------- */
  function cartAdd(id, after) {
    const p = shopAll().find(x => x.id === id); if (!p) return;
    /* נקודת חיבור: הרחבת החבילות יכולה לתפוס את ההוספה ולפתוח
       בחירת אזורים לפני שהפריט נכנס לעגלה. */
    const ev = { id, kind: p.kind, handled: false,
      done: sel => { cartPush(p, sel); if (after) after(); } };
    CBX.emit('shop:beforeAdd', ev);
    if (ev.handled) return;
    cartPush(p, null); if (after) after();
  }
  function cartPush(p, sel) {
    if (sel) {
      CART.push({ id: p.id + '|' + CART.length, baseId: p.id,
        name: p.name + ' · ' + sel.areas.join(' · ') + (sel.sessions > 1 ? ' (' + sel.sessions + ' מפגשים)' : ''),
        price: sel.price, kind: p.kind, sku: p.sku, qty: 1, sel });
      toast(sel.save ? 'נוסף לעגלה · חסכת ' + CBX.money(sel.save) : p.name + ' נוסף לעגלה');
      return;
    }
    const ex = CART.find(l => l.id === p.id);
    if (p.kind === 'product' && ex && ex.qty + 1 > p.stock) { toast('אין מספיק במלאי (' + p.stock + ')'); return; }
    if (ex) ex.qty++; else CART.push({ id: p.id, name: p.name, price: p.price, kind: p.kind, sku: p.sku, qty: 1 });
    toast(p.name + ' נוסף לעגלה');
  }
  function cartQty(id, q) {
    const l = CART.find(x => x.id === id); if (!l) return;
    const p = shopAll().find(x => x.id === id);
    if (p && p.kind === 'product' && q > p.stock) { toast('במלאי יש ' + p.stock + ' בלבד'); q = p.stock; }
    l.qty = Math.max(0, q); if (!l.qty) CART = CART.filter(x => x.id !== id);
  }
  function cartHasService() { return CART.some(l => l.kind === 'service'); }
  function cartTotals() {
    const sub = CART.reduce((a, l) => a + l.price * l.qty, 0);
    let disc = 0, ship = 0;
    const needShip = shopFulfil === 'ship' && CART.some(l => l.kind === 'product');
    if (needShip) ship = sub >= (+SHOP.shipFree || 0) ? 0 : (+SHOP.shipCost || 0);
    if (shopCoupon) {
      if (shopCoupon.kind === 'pct') disc = Math.round(sub * shopCoupon.val) / 100;
      else if (shopCoupon.kind === 'sum') disc = Math.min(sub, shopCoupon.val);
      else if (shopCoupon.kind === 'ship') ship = 0;
    }
    const total = Math.max(0, sub - disc + ship);
    return { sub, disc, ship, total, vat: Math.round(total / 1.17 * 0.17 * 100) / 100 };
  }
  function couponApply(code) {
    const c = COUPONS.find(x => x.on !== false && x.code.toLowerCase() === String(code || '').trim().toLowerCase());
    if (!c) return { ok: false, why: 'קוד לא נמצא או לא פעיל' };
    if (c.max && c.uses >= c.max) return { ok: false, why: 'הקוד מוצה' };
    const { sub } = cartTotals();
    if (c.min && sub < c.min) return { ok: false, why: 'הקוד תקף מ-' + CBX.money(c.min) + ' ומעלה' };
    shopCoupon = c; return { ok: true, c };
  }

  /* ---------------- משבצות לתיאום עצמי ---------------- */
  function shopSlots() {
    if (typeof coordPool !== 'function') return [];
    return coordPool().filter(s => !s.booked && !s.held && !(typeof coordIsPast === 'function' && coordIsPast(s)))
      .slice(0, 12)
      .map(s => ({ key: s.date + '|' + s.h, date: s.date, h: s.h,
        label: s.date + ' · ' + (typeof fmtH === 'function' ? fmtH(s.h) : s.h),
        branch: (typeof cBranch === 'function' && cBranch(s.branch)) ? (cBranch(s.branch).short || cBranch(s.branch).label) : s.branch,
        brKey: s.branch, raw: s }));
  }

  /* ---------------- חזית החנות ---------------- */
  function openShop(asAdmin) {
    const old = document.getElementById('shopOv'); if (old) old.remove();
    const ov = document.createElement('div'); ov.id = 'shopOv'; ov.className = 'shop-ov';
    shopView = 'store'; CART = []; shopCoupon = null; shopSlot = null;
    const render = () => {
      ov.innerHTML = `<div class="shop-frame">
        <div class="shop-bar">
          <div class="shop-brand">${ic('org')} <b>${esc(SHOP.name)}</b><small>${esc(SHOP.tagline)}</small></div>
          <div class="shop-bar-r">
            ${asAdmin ? `<span class="shop-preview">${ic('eye')} תצוגת לקוח</span>` : ''}
            <button class="shop-cart-btn ${CART.length ? 'has' : ''}" id="shCart">${ic('tasks')} עגלה
              ${CART.length ? `<span class="shop-cnt">${CART.reduce((a, l) => a + l.qty, 0)}</span>` : ''}</button>
            <button class="shop-x" id="shClose">${ic('close')}</button>
          </div>
        </div>
        <div class="shop-body">${shopView === 'store' ? storeHTML() : shopView === 'cart' ? cartHTML()
          : shopView === 'checkout' ? checkoutHTML() : doneHTML()}</div>
      </div>`;
      bind();
    };

    const storeHTML = () => {
      const cats = shopCats();
      const list = shopAll().filter(p => shopCat === 'all' || p.cat === shopCat);
      return `<div class="shop-cats">${cats.map(c => `<button class="shop-cat ${shopCat === c ? 'on' : ''}" data-shcat="${esc(c)}">${c === 'all' ? 'הכל' : esc(c)}</button>`).join('')}</div>
        <div class="shop-grid">${list.map(p => `
          <div class="shop-card">
            <div class="shop-thumb ${p.kind}">${ic(p.kind === 'service' ? 'calendar' : 'tasks')}</div>
            <div class="shop-info">
              <b>${esc(p.name)}</b>
              <span class="shop-kind">${p.kind === 'service' ? 'שירות · ' + p.dur + ' דק׳' : 'מוצר' + (p.stock <= 3 ? ' · נותרו ' + p.stock : '')}</span>
              ${p.desc ? `<small>${esc(String(p.desc).slice(0, 90))}</small>` : ''}
            </div>
            <div class="shop-buy">
              <span class="shop-price">${p.price ? CBX.money(p.price) : 'ללא עלות'}</span>
              <button class="btn sm primary" data-shadd="${esc(p.id)}">${ic('plus')} ${p.kind === 'service' ? 'לתיאום' : 'לעגלה'}</button>
            </div>
          </div>`).join('') || `<p class="shop-empty">אין פריטים להצגה. סמנו מוצרים כ"נמכר ללקוח" במסך המלאי.</p>`}</div>`;
    };

    const cartHTML = () => {
      const t = cartTotals();
      if (!CART.length) return `<div class="shop-pane"><p class="shop-empty">${ic('tasks')} העגלה ריקה</p>
        <button class="btn primary" id="shBack">חזרה לחנות</button></div>`;
      return `<div class="shop-pane">
        <h3>${ic('tasks')} העגלה שלי</h3>
        <div class="shop-lines">${CART.map(l => `<div class="shop-line">
          <span class="sl-n"><b>${esc(l.name)}</b><small>${l.kind === 'service' ? 'שירות' : 'מוצר'}${l.sel && l.sel.save ? ' · <i class="sl-save">' + esc(l.sel.why) + ' — חסכת ' + CBX.money(l.sel.save) + '</i>' : ''}</small></span>
          <span class="sl-q"><button class="btn xs" data-shq="${esc(l.id)}|-1">−</button>
            <b>${l.qty}</b><button class="btn xs" data-shq="${esc(l.id)}|1">+</button></span>
          <span class="sl-p">${CBX.money(l.price * l.qty)}</span>
          <button class="btn xs" data-shdel="${esc(l.id)}">${ic('close')}</button></div>`).join('')}</div>
        ${CART.some(l => l.kind === 'product') ? `<div class="shop-fulfil">
          <b>איך לקבל את המוצרים?</b>
          <label><input type="radio" name="ff" value="pickup" ${shopFulfil === 'pickup' ? 'checked' : ''}> איסוף מהסניף — ללא עלות</label>
          <label><input type="radio" name="ff" value="ship" ${shopFulfil === 'ship' ? 'checked' : ''}> משלוח — ${CBX.money(SHOP.shipCost)} (חינם מ-${CBX.money(SHOP.shipFree)})</label>
        </div>` : ''}
        <div class="shop-coupon">
          <input class="cc-inp sm" id="shCode" placeholder="קוד קופון" value="${shopCoupon ? esc(shopCoupon.code) : ''}">
          <button class="btn sm" id="shCoupon">${shopCoupon ? 'החלף' : 'הפעל'}</button>
          ${shopCoupon ? `<span class="shop-cok">${ic('check')} ${esc(shopCoupon.note || shopCoupon.code)}</span>` : ''}
        </div>
        <div class="shop-sum">
          <div><span>סכום ביניים</span><b>${CBX.money(t.sub)}</b></div>
          ${t.disc ? `<div class="disc"><span>הנחה</span><b>−${CBX.money(t.disc)}</b></div>` : ''}
          ${t.ship ? `<div><span>משלוח</span><b>${CBX.money(t.ship)}</b></div>` : ''}
          <div class="tot"><span>לתשלום</span><b>${CBX.money(t.total)}</b></div>
          <small>כולל מע״מ ${CBX.money(t.vat)}</small>
        </div>
        <div class="shop-acts"><button class="btn" id="shBack">המשך קנייה</button>
          <button class="btn primary" id="shGo">${ic('check')} המשך להזמנה</button></div>
      </div>`;
    };

    const checkoutHTML = () => {
      const t = cartTotals(), slots = shopSlots();
      return `<div class="shop-pane">
        <h3>${ic('check')} פרטי הזמנה</h3>
        <div class="shop-f2">
          <label class="shop-f"><span>שם מלא *</span><input class="cc-inp" id="coName"></label>
          <label class="shop-f"><span>טלפון *</span><input class="cc-inp" id="coPhone" placeholder="050-0000000"></label>
          <label class="shop-f"><span>דוא״ל</span><input class="cc-inp" id="coMail"></label>
          ${shopFulfil === 'ship' ? `<label class="shop-f"><span>כתובת למשלוח *</span><input class="cc-inp" id="coAddr"></label>` : ''}
        </div>
        ${cartHasService() && SHOP.selfBook ? `<div class="shop-slots">
          <b>${ic('calendar')} בחירת מועד לטיפול</b>
          <small>המועדים שמוצגים הם הזמנים שבאמת פנויים ביומן — הבחירה משריינת מיד.</small>
          <div class="shop-slot-grid">${slots.map(s => `<button class="shop-slot ${shopSlot && shopSlot.key === s.key ? 'on' : ''}" data-shslot="${esc(s.key)}">
            <b>${esc(s.label)}</b><small>${esc(s.branch)}</small></button>`).join('')
            || '<p class="shop-empty">אין מועדים פנויים כרגע — נציג יחזור אליכם.</p>'}</div>
        </div>` : ''}
        <div class="shop-sum compact"><div class="tot"><span>לתשלום</span><b>${CBX.money(t.total)}</b></div></div>
        <label class="shop-terms"><input type="checkbox" id="coTerms">
          <span>קראתי ואני מסכים/ה לתנאים — ${esc(SHOP.terms)}</span></label>
        <div class="shop-acts"><button class="btn" id="shBackCart">חזרה לעגלה</button>
          <button class="btn primary" id="shPay">${ic('lock')} אישור והזמנה</button></div>
        <p class="shop-secure">${ic('lock')} התשלום מאובטח. פרטי האשראי אינם נשמרים במערכת.</p>
      </div>`;
    };

    const doneHTML = () => `<div class="shop-pane shop-done">
      <div class="shop-done-ic">${ic('check')}</div>
      <h3>ההזמנה התקבלה</h3>
      <p>מספר הזמנה <b>${esc(lastOrder ? lastOrder.no : '')}</b></p>
      ${lastOrder && lastOrder.slot ? `<p>${ic('calendar')} המועד נשמר: <b>${esc(lastOrder.slot.label)}</b> · ${esc(lastOrder.slot.branch)}</p>` : ''}
      <p class="muted">נשלח אישור ל${esc(lastOrder ? (lastOrder.mail || lastOrder.phone) : '')}.</p>
      ${lastOrder && lastOrder.stockMsg ? `<p class="shop-stock">${ic('tasks')} ${esc(lastOrder.stockMsg)}</p>` : ''}
      <button class="btn primary" id="shBack">חזרה לחנות</button></div>`;

    const bind = () => {
      const q = s => ov.querySelector(s), qa = s => [...ov.querySelectorAll(s)];
      q('#shClose').addEventListener('click', () => ov.remove());
      const c = q('#shCart'); if (c) c.addEventListener('click', () => { shopView = 'cart'; render(); });
      qa('[data-shcat]').forEach(b => b.addEventListener('click', () => { shopCat = b.dataset.shcat; render(); }));
      qa('[data-shadd]').forEach(b => b.addEventListener('click', () => { cartAdd(b.dataset.shadd, render); }));
      qa('[data-shq]').forEach(b => b.addEventListener('click', () => {
        const [id, d] = b.dataset.shq.split('|'); const l = CART.find(x => x.id === id);
        cartQty(id, (l ? l.qty : 0) + (+d)); render(); }));
      qa('[data-shdel]').forEach(b => b.addEventListener('click', () => { cartQty(b.dataset.shdel, 0); render(); }));
      qa('[name="ff"]').forEach(r => r.addEventListener('change', () => { shopFulfil = r.value; render(); }));
      const bk = q('#shBack'); if (bk) bk.addEventListener('click', () => { shopView = 'store'; render(); });
      const bc = q('#shBackCart'); if (bc) bc.addEventListener('click', () => { shopView = 'cart'; render(); });
      const cp = q('#shCoupon'); if (cp) cp.addEventListener('click', () => {
        const r = couponApply(q('#shCode').value);
        if (!r.ok) { shopCoupon = null; toast(r.why); } else toast('הקופון הופעל ✓');
        render(); });
      const go = q('#shGo'); if (go) go.addEventListener('click', () => { shopView = 'checkout'; render(); });
      qa('[data-shslot]').forEach(b => b.addEventListener('click', () => {
        shopSlot = shopSlots().find(s => s.key === b.dataset.shslot) || null; render(); }));
      const pay = q('#shPay'); if (pay) pay.addEventListener('click', () => {
        const name = (q('#coName').value || '').trim(), phone = (q('#coPhone').value || '').trim();
        const mail = q('#coMail') ? q('#coMail').value.trim() : '';
        const addr = q('#coAddr') ? q('#coAddr').value.trim() : '';
        if (!name) { toast('נא למלא שם'); return; }
        if (phone.replace(/\D/g, '').length < 9) { toast('נא למלא טלפון תקין'); return; }
        if (shopFulfil === 'ship' && !addr) { toast('נא למלא כתובת למשלוח'); return; }
        if (!q('#coTerms').checked) { toast('נא לאשר את התנאים'); return; }
        if (cartHasService() && SHOP.selfBook && shopSlots().length && !shopSlot) { toast('נא לבחור מועד לטיפול'); return; }
        lastOrder = shopPlaceOrder({ name, phone, mail, addr });
        shopView = 'done'; render();
      });
    };

    render();
    document.body.appendChild(ov);
    return ov;
  }

  /* ---------------- ביצוע ההזמנה — מחזיר הכל למערכת ---------------- */
  function shopPlaceOrder(cust) {
    const t = cartTotals();
    const no = 'ORD-' + (1000 + ORDERS.length + 1);
    const brKey = shopSlot ? shopSlot.brKey : (window.INV ? (window.INV.branches()[0] || {}).key : 'tlv');
    /* 1) מוצרים יורדים מהמלאי */
    let stockMsg = '';
    if (window.INV && CBX.isOn('inv')) {
      const prod = CART.filter(l => l.kind === 'product');
      prod.forEach(l => { if (l.sku) window.INV.move(l.sku, brKey, -l.qty, 'sale', 'הזמנה ' + no); });
      if (prod.length) stockMsg = prod.length + ' מוצרים ירדו מהמלאי בסניף';
    }
    /* 2) שריון המשבצת ביומן */
    if (shopSlot && shopSlot.raw) shopSlot.raw.held = { by: cust.name, until: 'הזמנה ' + no };
    /* 3) ליד במערכת — כדי שההזמנה לא תחיה מחוץ ל-CRM */
    let recId = null;
    if (typeof RECORDS !== 'undefined') {
      const svc = CART.filter(l => l.kind === 'service')
        .map(l => String(l.baseId || l.id).replace('svc:', '').split('|')[0]);
      /* רשומה מלאה — בדיוק במבנה של ליד רגיל, אחרת מסכי הליבה נשברים */
      const initials = cust.name.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('');
      const rec = {
        id: 'SH' + (ORDERS.length + 1), name: cust.name, org: '', avatar: initials,
        phone: cust.phone, mail: cust.mail, idnum: '',
        entity: 'lead', journey: 'sales', objective: shopSlot ? 'meeting' : 'proposal',
        stageKey: shopSlot ? 'meeting' : 'new',
        subject: 'הזמנה מהחנות · ' + no, assignee: '', source: 'חנות אונליין',
        priority: 'medium',
        sla: { label: 'בזמן', color: 'green', mins: 240 },
        status: { label: shopSlot ? 'מועד נקבע' : 'הזמנה חדשה', color: shopSlot ? 'green' : 'blue' },
        services: svc, needs: { branch: brKey },
        orderNo: no, orderTotal: t.total,
        time: shopSlot ? (typeof fmtH === 'function' ? fmtH(shopSlot.h) : '') : '',
        next: shopSlot ? { type: 'meeting', at: shopSlot.label } : { type: 'followup', at: '' },
      };
      if (shopSlot) rec.meeting = { date: shopSlot.date, time: (typeof fmtH === 'function' ? fmtH(shopSlot.h) : ''),
        dur: 60, channel: 'בסניף', with: shopSlot.branch };
      RECORDS.unshift(rec); recId = rec.id;
      if (typeof autoFireTrigger === 'function') { try { autoFireTrigger('בעת יצירת ליד', { rec }); } catch (e) {} }
    }
    /* 4) קופון נצרך */
    if (shopCoupon) { shopCoupon.uses = (shopCoupon.uses || 0) + 1; saveCoupons(); }
    const order = { no, t: (typeof autoStamp === 'function') ? autoStamp() : '', name: cust.name, phone: cust.phone,
      mail: cust.mail, addr: cust.addr, fulfil: shopFulfil, lines: CART.slice(), totals: t,
      coupon: shopCoupon ? shopCoupon.code : '', slot: shopSlot, recId, status: 'new', stockMsg };
    ORDERS.unshift(order); saveOrders();
    CBX.emit('shop:order', order);
    CART = []; shopCoupon = null;
    return order;
  }

  /* ---------------- מסך הניהול של החנות ---------------- */
  let shTab = 'orders';
  function shopAdminHTML() {
    const rev = ORDERS.reduce((a, o) => a + o.totals.total, 0);
    return `<div class="shop-admin">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${ORDERS.length}</b><small>הזמנות</small></div>
        <div class="inv-kpi"><b>${CBX.money(rev)}</b><small>מחזור מהחנות</small></div>
        <div class="inv-kpi"><b>${shopAll().length}</b><small>פריטים בחנות</small></div>
        <div class="inv-kpi"><b>${COUPONS.filter(c => c.on !== false).length}</b><small>קופונים פעילים</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${shTab === 'orders' ? 'on' : ''}" data-shtab="orders">${ic('docs')} הזמנות</button>
        <button class="inv-tab ${shTab === 'coupons' ? 'on' : ''}" data-shtab="coupons">${ic('bolt')} קופונים</button>
        <button class="inv-tab ${shTab === 'cfg' ? 'on' : ''}" data-shtab="cfg">${ic('settings')} הגדרות החנות</button>
      </div>
      ${shTab === 'orders' ? ordersHTML() : shTab === 'coupons' ? couponsHTML() : cfgHTML()}
    </div>`;
  }
  const ordersHTML = () => `<div class="inv-table-wrap"><table class="inv-table">
      <thead><tr><th>הזמנה</th><th>לקוח</th><th>פריטים</th><th>אספקה</th><th>מועד</th><th>סכום</th><th>סטטוס</th></tr></thead>
      <tbody>${ORDERS.map(o => `<tr>
        <td class="mono"><b>${esc(o.no)}</b><br><small>${esc(o.t)}</small></td>
        <td>${esc(o.name)}<br><small>${esc(o.phone)}</small></td>
        <td>${o.lines.map(l => esc(l.name) + ' ×' + l.qty).join('<br>')}</td>
        <td>${o.fulfil === 'ship' ? 'משלוח' : 'איסוף'}</td>
        <td>${o.slot ? esc(o.slot.label) : '—'}</td>
        <td><b>${CBX.money(o.totals.total)}</b>${o.coupon ? '<br><small>' + esc(o.coupon) + '</small>' : ''}</td>
        <td><span class="shop-st ${o.status}">${o.status === 'new' ? 'חדשה' : 'טופלה'}</span></td>
      </tr>`).join('') || `<tr><td colspan="7" class="inv-empty">עדיין אין הזמנות</td></tr>`}</tbody></table></div>`;
  const couponsHTML = () => `<p class="inv-lead">קודי הנחה עם תוקף, סף מינימום ומגבלת שימושים.</p>
    <div class="inv-table-wrap"><table class="inv-table">
      <thead><tr><th>קוד</th><th>סוג</th><th>ערך</th><th>מינימום</th><th>שימושים</th><th>פעיל</th><th></th></tr></thead>
      <tbody>${COUPONS.map((c, i) => `<tr>
        <td class="mono"><b>${esc(c.code)}</b><br><small>${esc(c.note || '')}</small></td>
        <td>${c.kind === 'pct' ? 'אחוז' : c.kind === 'sum' ? 'סכום' : 'משלוח חינם'}</td>
        <td>${c.kind === 'pct' ? c.val + '%' : c.kind === 'sum' ? CBX.money(c.val) : '—'}</td>
        <td>${c.min ? CBX.money(c.min) : '—'}</td>
        <td>${c.uses || 0}${c.max ? ' / ' + c.max : ''}</td>
        <td><button class="btn xs ${c.on !== false ? 'primary' : ''}" data-cpon="${i}">${c.on !== false ? 'פעיל' : 'כבוי'}</button></td>
        <td><button class="btn xs" data-cpdel="${i}">${ic('close')}</button></td>
      </tr>`).join('')}</tbody></table></div>
    <div class="shop-cp-add">
      <input class="cc-inp sm" id="cpCode" placeholder="קוד (למשל SUMMER20)">
      <select class="cc-inp sm" id="cpKind"><option value="pct">אחוז הנחה</option><option value="sum">סכום קבוע</option><option value="ship">משלוח חינם</option></select>
      <input class="cc-inp sm" id="cpVal" type="number" min="0" placeholder="ערך">
      <input class="cc-inp sm" id="cpMin" type="number" min="0" placeholder="מינימום קנייה">
      <button class="btn sm primary" id="cpAdd">${ic('plus')} הוסף קופון</button>
    </div>`;
  const cfgHTML = () => {
    const set = (typeof apSet === 'function') ? apSet
      : (l, h, c) => `<div class="ap-set"><div class="ap-set-h"><b>${l}</b><small>${h}</small></div><div class="ap-set-c">${c}</div></div>`;
    return `<div class="ap-wrap">
      ${set('שם החנות', 'מוצג ללקוח בראש העמוד.', `<input class="cc-inp sm" id="scName" value="${esc(SHOP.name)}">`)}
      ${set('משפט פתיחה', 'שורה אחת שמסבירה מה מוכרים כאן.', `<input class="cc-inp sm" id="scTag" value="${esc(SHOP.tagline)}">`)}
      ${set('תיאום עצמי ללקוח', 'הלקוח בוחר מועד מהיומן בעצמו. המועדים שמוצגים הם רק זמנים שבאמת פנויים.',
        `<label class="rt-row"><input type="checkbox" id="scBook" ${SHOP.selfBook ? 'checked' : ''}><span>כן, לאפשר בחירת מועד</span></label>`)}
      ${set('משלוח מוצרים', 'עלות המשלוח, ומאיזה סכום הוא חינם.',
        `<div class="ap-hours"><span>עלות</span><input class="cc-inp sm" type="number" min="0" id="scShip" value="${+SHOP.shipCost || 0}">
         <span>חינם מ־</span><input class="cc-inp sm" type="number" min="0" id="scFree" value="${+SHOP.shipFree || 0}"></div>`)}
      ${set('תנאי ההזמנה', 'המשפט שהלקוח מאשר לפני התשלום.', `<textarea class="cc-inp sm" rows="2" id="scTerms">${esc(SHOP.terms)}</textarea>`)}
      <div class="shop-open-row"><button class="btn primary" id="scOpen">${ic('eye')} פתח את החנות בתצוגת לקוח</button></div>
    </div>`;
  };
  function shopAdminBind(RR) {
    $$('[data-shtab]').forEach(b => b.addEventListener('click', () => { shTab = b.dataset.shtab; RR(); }));
    $$('[data-cpon]').forEach(b => b.addEventListener('click', () => { const c = COUPONS[+b.dataset.cpon]; c.on = c.on === false; saveCoupons(); RR(); }));
    $$('[data-cpdel]').forEach(b => b.addEventListener('click', () => { COUPONS.splice(+b.dataset.cpdel, 1); saveCoupons(); RR(); }));
    const ca = $('#cpAdd'); if (ca) ca.addEventListener('click', () => {
      const code = ($('#cpCode').value || '').trim(); if (!code) { toast('נא להזין קוד'); return; }
      if (COUPONS.some(c => c.code.toLowerCase() === code.toLowerCase())) { toast('קוד זה כבר קיים'); return; }
      COUPONS.push({ code, kind: $('#cpKind').value, val: +$('#cpVal').value || 0, min: +$('#cpMin').value || 0, uses: 0, max: 0, on: true, note: '' });
      saveCoupons(); RR(); toast('הקופון נוסף ✓'); });
    const g = id => (document.getElementById(id) || {}).value;
    ['scName', 'scTag', 'scShip', 'scFree', 'scTerms'].forEach(id => { const e = document.getElementById(id);
      if (e) e.addEventListener('change', () => {
        SHOP.name = g('scName') || SHOP.name; SHOP.tagline = g('scTag'); SHOP.shipCost = +g('scShip') || 0;
        SHOP.shipFree = +g('scFree') || 0; SHOP.terms = g('scTerms'); saveCfg(); }); });
    const sb = $('#scBook'); if (sb) sb.addEventListener('change', () => { SHOP.selfBook = sb.checked; saveCfg(); });
    const so = $('#scOpen'); if (so) so.addEventListener('click', () => openShop(true));
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'shop', label: 'אתר סחר וממשק חנות', icon: 'org',
    desc: 'חנות שהלקוח מזמין ממנה בעצמו: שירותים ומוצרים, עגלה, קופונים, תיאום מועד מהיומן ותשלום. ההזמנה נכנסת כליד והמלאי יורד.',
    files: ['js/ext/shop.js', 'css/ext/shop.css'],
    install() {
      /* מסך ניהול החנות — לשונית נוספת בתוך הקטלוג */
      CBX.wrap('shop', 'renderCatalogView', orig => function () {
        if (window.__shopMode) {
          const host = document.getElementById('viewHost');
          host.innerHTML = (typeof settingsHeader === 'function' ? settingsHeader() : '')
            + '<div class="inv-switch"><button class="btn sm" id="shopBack">' + ic('chevronR') + ' חזרה לשירותים</button>'
            + '<button class="btn sm primary" id="shopOpen">' + ic('eye') + ' פתח חנות</button></div>'
            + shopAdminHTML();
          if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
          const b = document.getElementById('shopBack');
          if (b) b.addEventListener('click', () => { window.__shopMode = false; renderCatalogView(); });
          const o = document.getElementById('shopOpen'); if (o) o.addEventListener('click', () => openShop(true));
          shopAdminBind(() => renderCatalogView());
          return;
        }
        const r = orig.apply(this, arguments);
        if (window.__invMode) return r;
        const ctrl = document.querySelector('#viewHost .cat-controls');
        if (ctrl && !document.getElementById('shopGo')) {
          let row = document.getElementById('cbxCatRow');
          if (!row) { row = document.createElement('div'); row.className = 'cbx-cat-row'; row.id = 'cbxCatRow';
            ctrl.parentNode.insertBefore(row, ctrl.nextSibling); }
          const b = document.createElement('button');
          b.className = 'btn sm cbx-cat-btn'; b.id = 'shopGo'; b.type = 'button';
          const nw = ORDERS.filter(o => o.status === 'new').length;
          b.innerHTML = ic('org') + ' חנות' + (nw ? ' <span class="inv-badge">' + nw + '</span>' : '');
          row.appendChild(b);
        }
        return r;
      });
      /* הזמנות בחיפוש החכם */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('shop', 'runGlobalSearchWide', orig => function (q, res) {
        orig.call(this, q, res);
        ORDERS.forEach(o => { if ((o.no + ' ' + o.name + ' ' + o.phone).toLowerCase().includes(q))
          res.push({ type: 'הזמנה', label: o.no + ' · ' + o.name, goto: 'shop', sub: CBX.money(o.totals.total) + ' · ' + o.t }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('shop', 'gotoEntity', orig => function (where, id) {
        if (where === 'shop') { navActive = 'settings'; if (typeof applySetMode === 'function') applySetMode('catalog');
          window.__shopMode = true; shTab = 'orders'; renderCatalogView(); return; }
        return orig.call(this, where, id);
      });
      /* אוטומציה: הזמנה חדשה מהחנות */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('shop', AUTOMATIONS,
        [{ key: 'x_shop_order', trigger: 'הזמנה חדשה מהחנות', title: 'טיפול בהזמנה מהאתר', desc: 'שיוך נציג, אישור ללקוח ופתיחת מעקב', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('shop', AUTO_IMPL, {
        x_shop_order: {
          what: 'כשמתקבלת הזמנה מהאתר — נשלח אישור ללקוח, ההזמנה משויכת לנציג, ונפתח מעקב כדי שלא תישאר ללא טיפול.',
          run: () => {
            const nw = ORDERS.filter(o => o.status === 'new');
            if (!nw.length) return 'אין הזמנות חדשות — לא בוצע';
            nw.slice(0, 5).forEach(o => { o.status = 'handled';
              if (typeof autoNotify === 'function') autoNotify('הזמנה חדשה מהאתר', o.no + ' · ' + o.name + ' · ' + CBX.money(o.totals.total), 'reminder'); });
            saveOrders();
            return 'טופלו ' + Math.min(nw.length, 5) + ' הזמנות: ' + nw.slice(0, 4).map(o => o.no).join(' · ');
          } } });
      CBX.delegate('shop', '#shopGo', () => { window.__shopMode = true; renderCatalogView(); });
      CBX._remember('shop', () => { window.__shopMode = false; const ov = document.getElementById('shopOv'); if (ov) ov.remove(); });
    },
  });

  window.SHOPX = { open: openShop, orders: () => ORDERS, cfg: () => SHOP };
})();
