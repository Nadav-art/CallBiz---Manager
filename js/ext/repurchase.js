/* ============================================================
   הרחבה: המלצת תדירות רכישה והרחבת פעילות  ·  key = 'rep2'
   ------------------------------------------------------------
   לכל שירות ומוצר אפשר להגדיר כל כמה זמן נכון לחזור עליו.
   כשמתקרב המועד — נפתחת פנייה אחת ללקוח, שמרכזת את <כל>
   הפריטים שהגיע זמנם, ולא פנייה לכל פריט בנפרד.
   באוטומציה בוחרים על אילו פריטים זה חל וכמה זמן מראש.
   ============================================================ */
(function () {

  const CFG_DEF = { scope: 'some', items: [], leadDays: 14, onePerPerson: true };
  let CFG = Object.assign({}, CFG_DEF, CBX.load('rep2_cfg', {}));
  let ITEMS = CBX.load('rep2_items', null) || {
    laser: { on: true, days: 42, note: 'סדרת לייזר — מפגש כל 6 שבועות' },
    facial: { on: true, days: 30, note: 'טיפול פנים — אחת לחודש' },
    injection: { on: true, days: 180, note: 'הזרקות — רענון אחת לחצי שנה' },
    'SER-VITC': { on: true, days: 60, note: 'סרום 30 מ״ל — מספיק לחודשיים' },
    'SPF-50': { on: true, days: 90, note: 'קרם הגנה — נגמר ברבעון' },
  };
  const saveCfg = () => CBX.store('rep2_cfg', CFG);
  const saveItems = () => CBX.store('rep2_items', ITEMS);

  /* ---------------- הפריטים שאפשר להגדיר להם תדירות ---------------- */
  function catalog() {
    const out = [];
    (typeof COORD_TREATMENTS !== 'undefined' ? COORD_TREATMENTS : []).forEach(t =>
      out.push({ key: t.key, label: t.label, kind: 'שירות' }));
    if (window.INV && CBX.isOn('inv')) window.INV.items().filter(i => i.sell)
      .forEach(i => out.push({ key: i.sku, label: i.name, kind: 'מוצר' }));
    return out;
  }
  const itemOf = k => ITEMS[k] || null;
  const isTracked = k => { const i = itemOf(k); return !!(i && i.on); };
  /* על אילו פריטים האוטומציה חלה בפועל */
  const inScope = k => isTracked(k) && (CFG.scope === 'all' || (CFG.items || []).indexOf(k) >= 0);
  const labelOf = k => { const c = catalog().find(x => x.key === k); return c ? c.label : k; };

  /* ---------------- מתי נרכש לאחרונה ---------------- */
  const today = () => (typeof clockTodayISO === 'function') ? clockTodayISO() : '2024-05-23';
  const dayMs = 86400000;
  const addDays = (d, n) => new Date(Date.parse(d) + n * dayMs).toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs);
  function normDate(d) {
    if (!d) return null;
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s);          /* 22/05/24 */
    if (m) return '20' + m[3] + '-' + m[2] + '-' + m[1];
    return null;
  }
  /* כל הרכישות של אדם — מהפניות, מההזמנות ומהחיובים */
  function purchases() {
    const map = {};
    const put = (key, personKey, name, phone, at) => {
      const d = normDate(at); if (!key || !d) return;
      const p = map[personKey] = map[personKey] || { key: personKey, name, phone, items: {} };
      if (!p.items[key] || p.items[key] < d) p.items[key] = d;
    };
    const pkey = r => (window.PERSON && CBX.isOn('person')) ? window.PERSON.idOf(r)
      : 'p:' + String(r.phone || '').replace(/\D/g, '').slice(-9);
    (typeof RECORDS !== 'undefined' ? RECORDS : []).filter(r => !r.mergedInto).forEach(r => {
      const at = (r.meeting && r.meeting.date) || null;
      (r.services || []).forEach(k => put(k, pkey(r), r.name, r.phone, at));
    });
    if (window.SHOPX && CBX.isOn('shop')) window.SHOPX.orders().forEach(o => {
      const k2 = pkey({ phone: o.phone, mail: o.mail, name: o.name });
      (o.lines || []).forEach(l => put(l.sku || String(l.baseId || l.id).replace('svc:', '').split('|')[0],
        k2, o.name, o.phone, o.t));
    });
    return Object.values(map);
  }
  /* מי הגיע זמנו — פריט אחד או כמה, מרוכזים לאדם */
  function due(leadDays) {
    const lead = leadDays == null ? (+CFG.leadDays || 14) : leadDays;
    const t = today(), out = [];
    purchases().forEach(p => {
      const items = [];
      Object.keys(p.items).forEach(k => {
        if (!inScope(k)) return;
        const cfg = itemOf(k), last = p.items[k];
        const dueAt = addDays(last, +cfg.days || 30);
        const inDays = daysBetween(t, dueAt);
        if (inDays <= lead) items.push({ key: k, label: labelOf(k), last, dueAt, inDays, days: cfg.days });
      });
      if (items.length) out.push({ person: p, items: items.sort((a, b) => a.inDays - b.inDays),
        soonest: Math.min.apply(null, items.map(x => x.inDays)) });
    });
    return out.sort((a, b) => a.soonest - b.soonest);
  }

  /* ---------------- פתיחת פנייה מרוכזת ---------------- */
  function openLead(d) {
    if (typeof RECORDS === 'undefined') return null;
    const names = d.items.map(x => x.label).join(' · ');
    const initials = String(d.person.name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
    const rec = {
      id: 'RP' + (RECORDS.length + 1), name: d.person.name, org: '', avatar: initials,
      phone: d.person.phone, mail: '', idnum: '',
      entity: 'customer', journey: 'upsell', objective: 'proposal', stageKey: 'proposal',
      subject: 'הרחבת פעילות · ' + names, assignee: '', source: 'המלצת תדירות רכישה',
      priority: d.soonest <= 0 ? 'high' : 'medium',
      sla: { label: 'בזמן', color: 'green', mins: 240 },
      status: { label: 'המלצה להרחבה', color: 'blue' },
      services: d.items.map(x => x.key).filter(k => (typeof cTreat === 'function') && cTreat(k)),
      needs: {}, repeatItems: d.items,
      next: { type: 'followup', at: d.soonest <= 0 ? 'היום' : 'בעוד ' + d.soonest + ' ימים' },
    };
    RECORDS.unshift(rec);
    if (typeof autoFireTrigger === 'function') { try { autoFireTrigger('בעת יצירת ליד', { rec }); } catch (e) {} }
    if (window.AUDIT && CBX.isOn('audit'))
      window.AUDIT.rec('lead', 'פנייה מהמלצת תדירות', d.person.name + ' · ' + names);
    return rec;
  }

  /* ---------------- ההגדרה יושבת בתוך כרטיס הפריט ---------------- */
  function oneHTML(key, kind) {
    const i2 = itemOf(key) || {};
    return `<div class="rp-inline ${i2.on ? 'on' : ''}">
      <label class="rp-in-h"><input type="checkbox" data-rpon="${esc(key)}" ${i2.on ? 'checked' : ''}>
        <span>${ic('sync')}<b>המלצת תדירות רכישה</b>
          <small>כל כמה זמן נכון לחזור על ${kind === 'product' ? 'המוצר' : 'השירות'} הזה.
            כשמתקרב המועד נפתחת פנייה להרחבת פעילות.</small></span></label>
      ${i2.on ? `<div class="rp-in-b">
        <label class="inv-f"><span>כל כמה ימים</span>
          <input class="cc-inp sm" type="number" min="1" max="730" value="${+i2.days || 30}" data-rpd="${esc(key)}"></label>
        <label class="inv-f"><span>הסבר לנציג</span>
          <input class="cc-inp sm" value="${esc(i2.note || '')}" data-rpn="${esc(key)}"></label>
        <small class="rp-in-note">${ic('bolt')} חל רק אם הפריט נבחר גם באוטומציה "הרחבת פעילות לפי תדירות".</small>
      </div>` : ''}
    </div>`;
  }
  function oneBind(root, redraw) {
    const q = sel => [...(root || document).querySelectorAll(sel)];
    q('[data-rpon]').forEach(c => c.addEventListener('change', () => {
      const k = c.dataset.rpon; ITEMS[k] = ITEMS[k] || { days: 30, note: '' };
      ITEMS[k].on = c.checked; saveItems(); if (redraw) redraw();
    }));
    q('[data-rpd]').forEach(i3 => i3.addEventListener('change', () => {
      ITEMS[i3.dataset.rpd].days = +i3.value || 30; saveItems(); }));
    q('[data-rpn]').forEach(i3 => i3.addEventListener('change', () => {
      ITEMS[i3.dataset.rpn].note = i3.value; saveItems(); }));
  }
  /* החלפה במקום, כדי שהפאנל לא ייסגר בכל סימון */
  function mount(host, key, kind) {
    if (!host) return;
    const old = host.querySelector('.rp-inline');
    const d = document.createElement('div'); d.innerHTML = oneHTML(key, kind);
    const el = d.firstElementChild;
    if (old) old.replaceWith(el); else host.appendChild(el);
    oneBind(el.parentNode, () => mount(host, key, kind));
  }

  /* ---------------- הגדרות האוטומציה ---------------- */
  function cfgHTML() {
    const set = (typeof apSet === 'function') ? apSet
      : (l, h, c) => `<div class="ap-set"><div class="ap-set-h"><b>${l}</b><small>${h}</small></div><div class="ap-set-c">${c}</div></div>`;
    const cat = catalog().filter(c => isTracked(c.key));
    const d = due();
    return `<div class="ap-wrap">
      ${set('על אילו פריטים החוק חל?', 'ברירת המחדל אינה "הכל" — בוחרים במפורש. פריט שאינו מסומן לא יפתח פנייה גם אם הגיע זמנו.',
        `<div class="rt-methods">
          <button class="rt-m ${CFG.scope === 'all' ? 'on' : ''}" data-rpsc="all"><b>כל הפריטים שהוגדרה להם תדירות</b>
            <small>${cat.length} פריטים כרגע. כל פריט חדש ייכנס אוטומטית.</small></button>
          <button class="rt-m ${CFG.scope === 'some' ? 'on' : ''}" data-rpsc="some"><b>רק פריטים שאבחר</b>
            <small>שליטה מלאה — ${(CFG.items || []).length} נבחרו</small></button>
        </div>`)}
      ${CFG.scope === 'some' ? `<div class="rp-pick">
        <div class="rp-pick-h">${ic('layers')} <b>בחירת פריטים</b>
          <button class="btn xs" id="rpAll">סמן הכל</button><button class="btn xs" id="rpNone">נקה</button></div>
        <div class="rp-chips">${cat.map(c => `<button class="fx-chip ${(CFG.items || []).indexOf(c.key) >= 0 ? 'on' : ''}"
          data-rpit="${esc(c.key)}">${esc(c.label)} <i>${(itemOf(c.key) || {}).days} ימים</i></button>`).join('')
          || '<span class="terr-anyday">לא הוגדרה תדירות לאף פריט</span>'}</div></div>` : ''}
      ${set('כמה זמן מראש לפתוח את הפנייה?', 'פנייה שנפתחת מוקדם מדי מציקה, ומאוחר מדי מפספסת. שבועיים הוא איזון סביר.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" max="120" id="rpLead" value="${+CFG.leadDays || 14}"><span>ימים מראש</span></div>`)}
      ${set('פנייה אחת ללקוח', 'לקוח שקנה שני מוצרים שהגיע זמנם — יקבל פנייה אחת עם שניהם, ולא שתי פניות.',
        `<label class="rt-row"><input type="checkbox" id="rpOne" ${CFG.onePerPerson ? 'checked' : ''}><span>כן, לרכז</span></label>`)}
      <div class="rp-preview">
        <div class="rp-prev-h">${ic('eye')} <b>מי ייפתח כרגע</b>
          <span class="fx-tag ${d.length ? 'mine' : ''}">${d.length ? (d.length === 1 ? 'לקוח אחד' : d.length + ' לקוחות') : 'אף אחד'}</span></div>
        ${d.length ? `<div class="rp-prev-l">${d.slice(0, 6).map(x => `<div class="rp-prev-r">
          <b>${esc(x.person.name)}</b>
          <span>${x.items.map(i => esc(i.label) + ' (' + (i.inDays <= 0 ? 'עבר המועד' : 'בעוד ' + i.inDays + ' ימים') + ')').join(' · ')}</span>
        </div>`).join('')}</div>`
        : `<p class="rp-none">אין כרגע לקוח שהגיע זמנו לפי ההגדרות האלה.</p>`}
      </div>
    </div>`;
  }
  function cfgBind(RR) {
    $$('[data-rpsc]').forEach(b => b.addEventListener('click', () => { CFG.scope = b.dataset.rpsc; saveCfg(); RR(); }));
    $$('[data-rpit]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.rpit; CFG.items = CFG.items || [];
      const i = CFG.items.indexOf(k); if (i >= 0) CFG.items.splice(i, 1); else CFG.items.push(k);
      saveCfg(); RR(); }));
    const a = $('#rpAll'); if (a) a.addEventListener('click', () => {
      CFG.items = catalog().filter(c => isTracked(c.key)).map(c => c.key); saveCfg(); RR(); });
    const n = $('#rpNone'); if (n) n.addEventListener('click', () => { CFG.items = []; saveCfg(); RR(); });
    const l = $('#rpLead'); if (l) l.addEventListener('change', () => { CFG.leadDays = +l.value || 14; saveCfg(); RR(); });
    const o = $('#rpOne'); if (o) o.addEventListener('change', () => { CFG.onePerPerson = o.checked; saveCfg(); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'rep2', label: 'המלצת תדירות רכישה', icon: 'sync',
    desc: 'כל כמה זמן נכון לחזור על כל שירות ומוצר. כשמתקרב המועד נפתחת פנייה אחת ללקוח שמרכזת את כל הפריטים שהגיע זמנם, לפי הפריטים והזמן מראש שנבחרו באוטומציה.',
    files: ['js/ext/repurchase.js'],
    install() {
      /* בתוך כרטיס השירות בקטלוג */
      if (typeof openCatalogItemEditor === 'function') CBX.wrap('rep2', 'openCatalogItemEditor', o => function (key) {
        const r = o.apply(this, arguments);
        /* מיידי ולא ב-setTimeout: הגוף כבר מלא כשהמקורית חוזרת */
        try { if (key) mount(document.querySelector('#modal .modal-body') || document.querySelector('#modal'), key, 'service'); }
        catch (e) { console.error('[rep2]', e); }
        return r;
      });
      /* ובתוך כרטיס המוצר במלאי */
      CBX.on('rep2', 'inv:editor', ev => {
        if (ev.item && ev.item.sku) mount(ev.host, ev.item.sku, 'product'); });
      /* האוטומציה */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('rep2', AUTOMATIONS,
        [{ key: 'x_repurchase', trigger: 'הגיע זמן לחזור על רכישה', title: 'הרחבת פעילות לפי תדירות',
          desc: 'פותח פנייה אחת ללקוח עם כל הפריטים שהגיע זמנם', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('rep2', AUTO_IMPL, {
        x_repurchase: {
          what: 'בודק מתי כל לקוח רכש לאחרונה כל פריט שהוגדרה לו תדירות, ומזהה למי מתקרב המועד לחזור. נפתחת פנייה אחת ללקוח שמרכזת את כל הפריטים שהגיע זמנם — כדי שהנציג יתקשר פעם אחת ולא שלוש.',
          cfg: 'rep2CfgHTML', cfgBind: 'rep2CfgBind',
          run: () => {
            const d = due();
            if (!d.length) return 'אין לקוח שהגיע זמנו — לא בוצע';
            const made = [];
            d.slice(0, 5).forEach(x => {
              const already = (typeof RECORDS !== 'undefined')
                && RECORDS.some(r => !r.done && r.source === 'המלצת תדירות רכישה' && r.phone === x.person.phone);
              if (already) return;
              const rec = openLead(x);
              if (rec) made.push(x.person.name + ' (' + x.items.length + ' פריטים)');
              if (typeof autoNotify === 'function')
                autoNotify('הרחבת פעילות', x.person.name + ' · ' + x.items.map(i => i.label).join(' · '), 'reminder');
            });
            if (!made.length) return 'לכל מי שהגיע זמנו כבר קיימת פנייה פתוחה — לא בוצע';
            return 'נפתחו ' + (made.length === 1 ? 'פנייה אחת' : made.length + ' פניות') + ': ' + made.join(' · ');
          } } });
      window.rep2CfgHTML = cfgHTML; window.rep2CfgBind = cfgBind;
      CBX._remember('rep2', () => { delete window.rep2CfgHTML; delete window.rep2CfgBind; });
      /* חיפוש */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('rep2', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        catalog().filter(c => isTracked(c.key)).forEach(c => {
          if (c.label.toLowerCase().includes(q))
            res.push({ type: 'תדירות רכישה', label: c.label, goto: 'catalog',
              sub: 'כל ' + (itemOf(c.key) || {}).days + ' ימים' });
        });
      });
    },
  });

  window.REP2 = { due, items: () => ITEMS, cfg: () => CFG, catalog, openLead, purchases };
})();
