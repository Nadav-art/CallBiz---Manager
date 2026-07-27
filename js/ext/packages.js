/* ============================================================
   הרחבה: חבילות ומבצעים  ·  key = 'pkg'
   ------------------------------------------------------------
   השכבה שחסרה בין הקטלוג לקריטריונים:
     1) יחידות בתוך שירות — "אזורים" (בית שחי, רגליים, שפם…)
     2) חבילות ומבצעים על היחידות האלה:
        • חבילה — N אזורים במחיר קבוע + K אזורים קטנים חינם
        • כרטיסייה — 10 טיפולים במחיר 8
        • מדרגות כמות — ככל שקונים יותר, ההנחה גדלה
   המערכת בוחרת לבד את העסקה הכי טובה ללקוח ומראה כמה חסך.
   ============================================================ */
(function () {

  /* ---------------- יחידות (אזורים) בתוך שירות ---------------- */
  const SEED_AREAS = {
    laser: [
      { key: 'legs', name: 'רגליים מלא', size: 'big', price: 320 },
      { key: 'bikini', name: 'ביקיני מלא', size: 'big', price: 280 },
      { key: 'back', name: 'גב מלא', size: 'big', price: 300 },
      { key: 'arms', name: 'ידיים', size: 'big', price: 220 },
      { key: 'armpit', name: 'בית שחי', size: 'small', price: 90 },
      { key: 'lip', name: 'שפם', size: 'small', price: 70 },
      { key: 'chin', name: 'סנטר', size: 'small', price: 70 },
      { key: 'hands', name: 'כפות ידיים', size: 'small', price: 60 },
    ],
    facial: [
      { key: 'clean', name: 'ניקוי עמוק', size: 'big', price: 280 },
      { key: 'peel', name: 'פילינג', size: 'big', price: 240 },
      { key: 'mask', name: 'מסכה מותאמת', size: 'small', price: 80 },
      { key: 'eye', name: 'טיפול עיניים', size: 'small', price: 90 },
    ],
    injection: [
      { key: 'forehead', name: 'מצח', size: 'big', price: 650 },
      { key: 'eyes', name: 'קמטי צחוק', size: 'big', price: 600 },
      { key: 'lips', name: 'שפתיים', size: 'big', price: 900 },
    ],
  };
  /* ---------------- מבצעים ---------------- */
  const SEED_PROMOS = [
    { id: 'p1', on: true, kind: 'bundle', name: '3 אזורים + אזור קטן חינם', svc: 'laser',
      need: 3, needSize: 'big', price: 690, freeQty: 1, freeSize: 'small',
      note: 'בוחרים 3 אזורים גדולים במחיר קבוע, ומקבלים אזור קטן אחד במתנה.' },
    { id: 'p2', on: true, kind: 'punch', name: 'כרטיסיית לייזר — 10 בעלות 8', svc: 'laser',
      qty: 10, pay: 8, note: 'משלמים על 8 מפגשים ומקבלים 10. תקף שנה מהרכישה.' },
    { id: 'p3', on: true, kind: 'tier', name: 'ככל שיותר אזורים — יותר הנחה', svc: 'facial',
      tiers: [{ from: 2, pct: 10 }, { from: 3, pct: 15 }, { from: 4, pct: 22 }],
      note: 'ההנחה נקבעת אוטומטית לפי מספר האזורים בעגלה.' },
  ];

  let AREAS = CBX.load('pkg_areas', null) || JSON.parse(JSON.stringify(SEED_AREAS));
  let PROMOS = CBX.load('pkg_promos', null) || JSON.parse(JSON.stringify(SEED_PROMOS));
  let pkgTab = 'promos', pkgSvc = 'laser';
  const saveA = () => CBX.store('pkg_areas', AREAS);
  const saveP = () => CBX.store('pkg_promos', PROMOS);

  const SIZES = { big: 'אזור גדול', small: 'אזור קטן' };
  const KINDS = { bundle: 'חבילה במחיר קבוע', punch: 'כרטיסייה', tier: 'מדרגות כמות' };
  const svcLabel = k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k;
  const svcKeys = () => (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS.map(t => t.key) : Object.keys(AREAS);
  function areasOf(svc) { return AREAS[svc] || []; }
  function area(svc, key) { return areasOf(svc).find(a => a.key === key) || null; }

  /* ---------------- מנוע התמחור ----------------
     מקבל בחירה: { svc, areas:[key], sessions } ומחזיר את העסקה
     הזולה ביותר עבור הלקוח, עם הסבר בשפה פשוטה. */
  function pkgPrice(sel) {
    const list = (sel.areas || []).map(k => area(sel.svc, k)).filter(Boolean);
    const base = list.reduce((a, x) => a + (+x.price || 0), 0);
    const sessions = Math.max(1, +sel.sessions || 1);
    let best = { total: base * sessions, base: base * sessions, save: 0, promo: null, why: 'מחיר מלא', free: [] };

    PROMOS.filter(p => p.on !== false && p.svc === sel.svc).forEach(p => {
      /* חבילה: N אזורים בגודל מסוים במחיר קבוע + K חינם */
      if (p.kind === 'bundle') {
        const pool = list.filter(x => x.size === p.needSize).sort((a, b) => b.price - a.price);
        if (pool.length < p.need) return;
        const inBundle = pool.slice(0, p.need);
        const rest = list.filter(x => inBundle.indexOf(x) < 0);
        /* האזורים החינמיים נלקחים מהיקרים ביותר שנותרו בגודל המתאים */
        const freePool = rest.filter(x => x.size === p.freeSize).sort((a, b) => b.price - a.price);
        const free = freePool.slice(0, +p.freeQty || 0);
        const paidRest = rest.filter(x => free.indexOf(x) < 0);
        const one = (+p.price || 0) + paidRest.reduce((a, x) => a + x.price, 0);
        const total = one * sessions;
        if (total < best.total) best = { total, base: base * sessions, save: base * sessions - total, promo: p,
          why: p.name, free: free.map(f => f.name) };
      }
      /* כרטיסייה: משלמים על pay מתוך qty */
      if (p.kind === 'punch' && sessions >= p.qty) {
        const sets = Math.floor(sessions / p.qty), left = sessions % p.qty;
        const total = base * (sets * p.pay + left);
        if (total < best.total) best = { total, base: base * sessions, save: base * sessions - total, promo: p,
          why: p.name + ' · ' + sets + ' כרטיסיות', free: [] };
      }
      /* מדרגות כמות לפי מספר אזורים */
      if (p.kind === 'tier') {
        const t = (p.tiers || []).slice().sort((a, b) => b.from - a.from).find(x => list.length >= x.from);
        if (!t) return;
        const total = Math.round(base * (1 - t.pct / 100)) * sessions;
        if (total < best.total) best = { total, base: base * sessions, save: base * sessions - total, promo: p,
          why: p.name + ' · ' + t.pct + '% על ' + list.length + ' אזורים', free: [] };
      }
    });
    return best;
  }

  /* ---------------- מסך הניהול ---------------- */
  function pkgHTML() {
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${PROMOS.filter(p => p.on !== false).length}</b><small>מבצעים פעילים</small></div>
        <div class="inv-kpi"><b>${Object.keys(AREAS).reduce((a, k) => a + AREAS[k].length, 0)}</b><small>אזורים מוגדרים</small></div>
        <div class="inv-kpi"><b>${Object.keys(AREAS).length}</b><small>שירותים עם אזורים</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${pkgTab === 'promos' ? 'on' : ''}" data-pkgtab="promos">${ic('bolt')} מבצעים וחבילות</button>
        <button class="inv-tab ${pkgTab === 'areas' ? 'on' : ''}" data-pkgtab="areas">${ic('layers')} אזורים בתוך שירות</button>
        <button class="inv-tab ${pkgTab === 'sim' ? 'on' : ''}" data-pkgtab="sim">${ic('eye')} בדיקת מחיר</button>
      </div>
      ${pkgTab === 'promos' ? promosHTML() : pkgTab === 'areas' ? areasHTML() : simHTML()}
    </div>`;
  }

  function promosHTML() {
    return `<p class="inv-lead">כשלקוח בוחר אזורים, המערכת בודקת את כל המבצעים ומחילה לבד את הזול ביותר עבורו —
      ומראה לו כמה חסך. אין צורך שנציג יזכור מבצעים.</p>
      <div class="pkg-list">${PROMOS.map((p, i) => `
        <div class="pkg-card ${p.on === false ? 'off' : ''}">
          <div class="pkg-h"><b>${esc(p.name)}</b>
            <span class="pkg-kind">${KINDS[p.kind]}</span>
            <span class="pkg-svc">${esc(svcLabel(p.svc))}</span>
            <button class="btn xs ${p.on !== false ? 'primary' : ''}" data-pkgon="${i}">${p.on !== false ? 'פעיל' : 'כבוי'}</button>
            <button class="btn xs" data-pkgdel="${i}">${ic('close')}</button></div>
          <div class="pkg-rule">${pkgRuleText(p)}</div>
          ${p.note ? `<small class="pkg-note">${esc(p.note)}</small>` : ''}
        </div>`).join('') || `<p class="inv-empty">אין מבצעים מוגדרים</p>`}</div>
      <div class="pkg-add">
        <div class="pkg-add-h">${ic('plus')} <b>מבצע חדש</b></div>
        <div class="inv-f2">
          <label class="inv-f"><span>סוג</span><select class="cc-inp" id="pkKind">
            ${Object.keys(KINDS).map(k => `<option value="${k}">${KINDS[k]}</option>`).join('')}</select></label>
          <label class="inv-f"><span>על איזה שירות</span><select class="cc-inp" id="pkSvc">
            ${svcKeys().map(k => `<option value="${k}">${esc(svcLabel(k))}</option>`).join('')}</select></label>
          <label class="inv-f"><span>שם המבצע</span><input class="cc-inp" id="pkName" placeholder="למשל: 3 אזורים + 1 חינם"></label>
        </div>
        <div id="pkParams"></div>
        <button class="btn sm primary" id="pkAdd">${ic('check')} צור מבצע</button>
      </div>`;
  }
  function pkgRuleText(p) {
    if (p.kind === 'bundle') return `בוחרים <b>${p.need}</b> ${SIZES[p.needSize]} במחיר קבוע של <b>${CBX.money(p.price)}</b>` +
      (p.freeQty ? ` ומקבלים <b>${p.freeQty}</b> ${SIZES[p.freeSize]} <b>חינם</b>` : '');
    if (p.kind === 'punch') return `משלמים על <b>${p.pay}</b> מפגשים ומקבלים <b>${p.qty}</b>`;
    if (p.kind === 'tier') return (p.tiers || []).map(t => `מ-<b>${t.from}</b> אזורים → <b>${t.pct}%</b> הנחה`).join(' · ');
    return '';
  }
  function paramsHTML(kind) {
    if (kind === 'bundle') return `<div class="inv-f2">
      <label class="inv-f"><span>כמה אזורים בחבילה</span><input class="cc-inp" type="number" min="1" id="pkNeed" value="3"></label>
      <label class="inv-f"><span>מאיזה גודל</span><select class="cc-inp" id="pkNeedSize"><option value="big">אזור גדול</option><option value="small">אזור קטן</option></select></label>
      <label class="inv-f"><span>מחיר החבילה</span><input class="cc-inp" type="number" min="0" id="pkPrice" value="690"></label>
      <label class="inv-f"><span>כמה חינם</span><input class="cc-inp" type="number" min="0" id="pkFreeQty" value="1"></label>
      <label class="inv-f"><span>גודל החינמיים</span><select class="cc-inp" id="pkFreeSize"><option value="small">אזור קטן</option><option value="big">אזור גדול</option></select></label></div>`;
    if (kind === 'punch') return `<div class="inv-f2">
      <label class="inv-f"><span>כמה מפגשים מקבלים</span><input class="cc-inp" type="number" min="2" id="pkQty" value="10"></label>
      <label class="inv-f"><span>על כמה משלמים</span><input class="cc-inp" type="number" min="1" id="pkPay" value="8"></label></div>`;
    return `<div class="inv-f2">
      <label class="inv-f"><span>מ-2 אזורים</span><input class="cc-inp" type="number" min="0" max="90" id="pkT2" value="10"><small>% הנחה</small></label>
      <label class="inv-f"><span>מ-3 אזורים</span><input class="cc-inp" type="number" min="0" max="90" id="pkT3" value="15"><small>% הנחה</small></label>
      <label class="inv-f"><span>מ-4 אזורים</span><input class="cc-inp" type="number" min="0" max="90" id="pkT4" value="22"><small>% הנחה</small></label></div>`;
  }

  function areasHTML() {
    const list = areasOf(pkgSvc);
    return `<p class="inv-lead">אזור הוא יחידה שנמכרת בתוך שירות. המחיר של השירות נגזר מהאזורים שנבחרו,
      והמבצעים פועלים עליהם.</p>
      <div class="inv-bar">
        <select class="cc-inp sm" id="pkAreaSvc">${svcKeys().map(k => `<option value="${k}" ${pkgSvc === k ? 'selected' : ''}>${esc(svcLabel(k))}</option>`).join('')}</select>
      </div>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>אזור</th><th>גודל</th><th>מחיר</th><th></th></tr></thead>
        <tbody>${list.map((a, i) => `<tr>
          <td><input class="cc-inp sm" value="${esc(a.name)}" data-arn="${i}"></td>
          <td><select class="cc-inp sm" data-ars="${i}">
            <option value="big" ${a.size === 'big' ? 'selected' : ''}>אזור גדול</option>
            <option value="small" ${a.size === 'small' ? 'selected' : ''}>אזור קטן</option></select></td>
          <td><input class="cc-inp sm" type="number" min="0" value="${+a.price || 0}" data-arp="${i}"></td>
          <td><button class="btn xs" data-ard="${i}">${ic('close')}</button></td></tr>`).join('')
          || `<tr><td colspan="4" class="inv-empty">לשירות זה לא הוגדרו אזורים</td></tr>`}</tbody></table></div>
      <button class="btn sm" id="pkAreaAdd">${ic('plus')} הוסף אזור</button>`;
  }

  let simSel = [], simSess = 1;
  function simHTML() {
    const list = areasOf(pkgSvc);
    const res = pkgPrice({ svc: pkgSvc, areas: simSel, sessions: simSess });
    return `<p class="inv-lead">בחרו אזורים כמו שלקוח היה בוחר — וראו איזה מבצע המערכת מחילה ולמה.</p>
      <div class="inv-bar">
        <select class="cc-inp sm" id="pkSimSvc">${svcKeys().map(k => `<option value="${k}" ${pkgSvc === k ? 'selected' : ''}>${esc(svcLabel(k))}</option>`).join('')}</select>
        <label class="ap-hours"><span>מספר מפגשים</span><input class="cc-inp sm" type="number" min="1" max="30" id="pkSimSess" value="${simSess}"></label>
      </div>
      <div class="pkg-areas">${list.map(a => `<button class="pkg-area ${simSel.indexOf(a.key) >= 0 ? 'on' : ''}" data-simarea="${esc(a.key)}">
        <b>${esc(a.name)}</b><small>${SIZES[a.size]} · ${CBX.money(a.price)}</small></button>`).join('')
        || '<p class="inv-empty">אין אזורים לשירות זה</p>'}</div>
      ${simSel.length ? `<div class="pkg-result ${res.save ? 'win' : ''}">
        <div class="pkg-res-h">${ic('bolt')} <b>${esc(res.why)}</b></div>
        <div class="pkg-res-rows">
          <div><span>מחיר מלא</span><b class="${res.save ? 'strike' : ''}">${CBX.money(res.base)}</b></div>
          ${res.save ? `<div class="save"><span>חיסכון</span><b>−${CBX.money(res.save)}</b></div>` : ''}
          ${res.free.length ? `<div class="free"><span>חינם</span><b>${esc(res.free.join(' · '))}</b></div>` : ''}
          <div class="tot"><span>לתשלום</span><b>${CBX.money(res.total)}</b></div>
        </div></div>` : `<p class="cr-hint">${ic('alert')} בחרו אזורים כדי לראות את התמחור.</p>`}`;
  }

  function pkgBind(RR) {
    $$('[data-pkgtab]').forEach(b => b.addEventListener('click', () => { pkgTab = b.dataset.pkgtab; RR(); }));
    $$('[data-pkgon]').forEach(b => b.addEventListener('click', () => { const p = PROMOS[+b.dataset.pkgon]; p.on = p.on === false; saveP(); RR(); }));
    $$('[data-pkgdel]').forEach(b => b.addEventListener('click', () => { PROMOS.splice(+b.dataset.pkgdel, 1); saveP(); RR(); toast('המבצע נמחק'); }));
    const kd = $('#pkKind'); const pr = $('#pkParams');
    if (kd && pr) { pr.innerHTML = paramsHTML(kd.value); kd.addEventListener('change', () => { pr.innerHTML = paramsHTML(kd.value); }); }
    const ad = $('#pkAdd'); if (ad) ad.addEventListener('click', () => {
      const g = id => (document.getElementById(id) || {}).value;
      const kind = g('pkKind'), name = (g('pkName') || '').trim();
      if (!name) { toast('נא לתת שם למבצע'); return; }
      const p = { id: 'p' + (PROMOS.length + 1) + kind, on: true, kind, svc: g('pkSvc'), name, note: '' };
      if (kind === 'bundle') Object.assign(p, { need: +g('pkNeed') || 3, needSize: g('pkNeedSize'),
        price: +g('pkPrice') || 0, freeQty: +g('pkFreeQty') || 0, freeSize: g('pkFreeSize') });
      else if (kind === 'punch') Object.assign(p, { qty: +g('pkQty') || 10, pay: +g('pkPay') || 8 });
      else p.tiers = [{ from: 2, pct: +g('pkT2') || 0 }, { from: 3, pct: +g('pkT3') || 0 }, { from: 4, pct: +g('pkT4') || 0 }].filter(t => t.pct > 0);
      PROMOS.push(p); saveP(); RR(); toast('המבצע נוצר ✓');
    });
    // אזורים
    const as = $('#pkAreaSvc'); if (as) as.addEventListener('change', () => { pkgSvc = as.value; RR(); });
    $$('[data-arn]').forEach(i => i.addEventListener('change', () => { areasOf(pkgSvc)[+i.dataset.arn].name = i.value; saveA(); }));
    $$('[data-ars]').forEach(i => i.addEventListener('change', () => { areasOf(pkgSvc)[+i.dataset.ars].size = i.value; saveA(); RR(); }));
    $$('[data-arp]').forEach(i => i.addEventListener('change', () => { areasOf(pkgSvc)[+i.dataset.arp].price = +i.value || 0; saveA(); RR(); }));
    $$('[data-ard]').forEach(b => b.addEventListener('click', () => { areasOf(pkgSvc).splice(+b.dataset.ard, 1); saveA(); RR(); }));
    const aa = $('#pkAreaAdd'); if (aa) aa.addEventListener('click', () => {
      AREAS[pkgSvc] = AREAS[pkgSvc] || [];
      AREAS[pkgSvc].push({ key: 'a' + Object.keys(AREAS[pkgSvc]).length + Math.abs(AREAS[pkgSvc].length * 7 + 3), name: 'אזור חדש', size: 'small', price: 0 });
      saveA(); RR(); });
    // סימולציה
    const ss = $('#pkSimSvc'); if (ss) ss.addEventListener('change', () => { pkgSvc = ss.value; simSel = []; RR(); });
    const se = $('#pkSimSess'); if (se) se.addEventListener('change', () => { simSess = Math.max(1, +se.value || 1); RR(); });
    $$('[data-simarea]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.simarea, i = simSel.indexOf(k);
      if (i >= 0) simSel.splice(i, 1); else simSel.push(k); RR(); }));
  }

  /* ---------------- בחירת אזורים בחנות ---------------- */
  function openAreaPicker(svc, onPick) {
    const list = areasOf(svc); if (!list.length) { onPick(null); return; }
    let sel = [], sess = 1;
    const old = document.getElementById('pkPick'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'pkPick';
    const render = () => {
      const res = pkgPrice({ svc, areas: sel, sessions: sess });
      w.innerHTML = `<div class="cbc-box pkg-pick">
        <div class="cbc-head"><span class="cbc-ic">${ic('layers')}</span><b>${esc(svcLabel(svc))} — בחירת אזורים</b></div>
        <p class="pkg-pick-lead">בוחרים את האזורים הרצויים. המערכת מחילה לבד את המבצע המשתלם ביותר.</p>
        <div class="pkg-areas">${list.map(a => `<button class="pkg-area ${sel.indexOf(a.key) >= 0 ? 'on' : ''}" data-pa="${esc(a.key)}">
          <b>${esc(a.name)}</b><small>${SIZES[a.size]} · ${CBX.money(a.price)}</small></button>`).join('')}</div>
        <label class="ap-hours pkg-sess"><span>מספר מפגשים</span>
          <input class="cc-inp sm" type="number" min="1" max="30" id="paSess" value="${sess}"></label>
        ${sel.length ? `<div class="pkg-result ${res.save ? 'win' : ''}">
          <div class="pkg-res-h">${ic('bolt')} <b>${esc(res.why)}</b></div>
          <div class="pkg-res-rows">
            <div><span>מחיר מלא</span><b class="${res.save ? 'strike' : ''}">${CBX.money(res.base)}</b></div>
            ${res.save ? `<div class="save"><span>חסכת</span><b>−${CBX.money(res.save)}</b></div>` : ''}
            ${res.free.length ? `<div class="free"><span>קיבלת חינם</span><b>${esc(res.free.join(' · '))}</b></div>` : ''}
            <div class="tot"><span>לתשלום</span><b>${CBX.money(res.total)}</b></div></div></div>` : ''}
        <div class="cbc-actions">
          <button class="btn primary" id="paOk" ${sel.length ? '' : 'disabled'}>${ic('check')} הוסף לעגלה</button>
          <button class="btn ghost" id="paX">ביטול</button></div></div>`;
      $$('[data-pa]', w).forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.pa, i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else sel.push(k); render(); }));
      const s = $('#paSess', w); if (s) s.addEventListener('change', () => { sess = Math.max(1, +s.value || 1); render(); });
      $('#paX', w).addEventListener('click', () => { w.remove(); onPick(null); });
      $('#paOk', w).addEventListener('click', () => {
        const r = pkgPrice({ svc, areas: sel, sessions: sess });
        w.remove();
        onPick({ areas: sel.map(k => area(svc, k).name), sessions: sess, price: r.total,
          save: r.save, why: r.why, free: r.free });
      });
    };
    render();
    w.addEventListener('mousedown', e => { if (e.target === w) { w.remove(); onPick(null); } });
    document.body.appendChild(w);
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'pkg', label: 'חבילות ומבצעים', icon: 'bolt',
    desc: 'אזורים בתוך שירות, חבילות במחיר קבוע עם אזורים חינם, כרטיסיות ומדרגות כמות. המערכת מחילה לבד את העסקה הזולה ביותר ללקוח.',
    files: ['js/ext/packages.js'],
    install() {
      /* כפתור בקטלוג */
      CBX.wrap('pkg', 'renderCatalogView', orig => function () {
        if (window.__pkgMode) {
          const host = document.getElementById('viewHost');
          host.innerHTML = (typeof settingsHeader === 'function' ? settingsHeader() : '')
            + '<div class="inv-switch"><button class="btn sm" id="pkgBack">' + ic('chevronR') + ' חזרה לשירותים</button></div>'
            + pkgHTML();
          if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
          const b = document.getElementById('pkgBack');
          if (b) b.addEventListener('click', () => { window.__pkgMode = false; renderCatalogView(); });
          pkgBind(() => renderCatalogView());
          return;
        }
        const r = orig.apply(this, arguments);
        if (window.__invMode || window.__shopMode) return r;
        const ctrl = document.querySelector('#viewHost .cat-controls');
        if (ctrl && !document.getElementById('pkgGo')) {
          const b = document.createElement('button'); b.className = 'btn sm'; b.id = 'pkgGo';
          b.innerHTML = ic('bolt') + ' חבילות ומבצעים';
          ctrl.insertBefore(b, ctrl.querySelector('#addTreat'));
          b.addEventListener('click', () => { window.__pkgMode = true; renderCatalogView(); });
        }
        return r;
      });
      /* בחירת אזורים בחנות — לפני הוספה לעגלה */
      CBX.on('pkg', 'shop:beforeAdd', ev => {
        if (ev.kind !== 'service') return;
        const svc = ev.id.replace('svc:', '');
        if (!areasOf(svc).length) return;
        ev.handled = true;
        openAreaPicker(svc, sel => { if (sel) ev.done(sel); });
      });
      /* מבצעים בחיפוש */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('pkg', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        PROMOS.forEach(p => { if ((p.name + ' ' + (p.note || '')).toLowerCase().includes(q))
          res.push({ type: 'מבצע', label: p.name, goto: 'packages', sub: KINDS[p.kind] + ' · ' + svcLabel(p.svc) }); });
        Object.keys(AREAS).forEach(svc => AREAS[svc].forEach(a => {
          if (a.name.toLowerCase().includes(q))
            res.push({ type: 'אזור', label: a.name, goto: 'packages', sub: svcLabel(svc) + ' · ' + CBX.money(a.price) }); }));
      });
      if (typeof gotoEntity === 'function') CBX.wrap('pkg', 'gotoEntity', o => function (where, id) {
        if (where === 'packages') { navActive = 'settings'; if (typeof applySetMode === 'function') applySetMode('catalog');
          window.__pkgMode = true; renderCatalogView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('pkg', () => { window.__pkgMode = false; });
    },
  });

  window.PKG = { areas: areasOf, promos: () => PROMOS, price: pkgPrice, pick: openAreaPicker };
})();
