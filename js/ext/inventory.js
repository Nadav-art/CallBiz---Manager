/* ============================================================
   הרחבה: מלאי ומוצרים  ·  key = 'inv'
   ------------------------------------------------------------
   מוסיפה לקטלוג שכבת מוצרים פיזיים: מק"ט, ברקוד, עלות מול מחיר,
   מלאי לכל סניף, ספקים, אצוות ותוקף, ותנועות מלאי מתועדות.
   מחוברת לשירותים דרך "מרשם צריכה" — כל טיפול יודע אילו מוצרים
   הוא צורך, והמלאי יורד אוטומטית בסיום.
   הכל דרך CBX. אפס שינויים בקבצי הליבה.
   ============================================================ */
(function () {

  /* ---------------- נתונים ---------------- */
  const UNITS = ['יח׳', 'מ״ל', 'גרם', 'מארז', 'שעה'];
  const INV_CATS = ['חומר מתכלה', 'מוצר למכירה', 'ציוד', 'אריזה'];

  const SEED_SUPPLIERS = [
    { id: 's1', name: 'מדיקל סאפליי בע״מ', contact: 'רונית לוי', phone: '03-5550101', mail: 'orders@medsupply.co.il', terms: 'שוטף+30', lead: 5 },
    { id: 's2', name: 'קוסמו דרם', contact: 'עופר גל', phone: '09-7770202', mail: 'info@cosmoderm.co.il', terms: 'שוטף+60', lead: 12 },
  ];
  const SEED_ITEMS = [
    { sku: 'GEL-500', barcode: '7290011112', name: 'ג׳ל הולכה לייזר', cat: 'חומר מתכלה', unit: 'מ״ל',
      cost: 0.08, price: 0, sell: false, vat: true, supplier: 's1', reorder: 400, track: true, expiry: true,
      stock: { tlv: 3000, haifa: 1200, bsheva: 2000, jlm: 350, herzliya: 1500 } },
    { sku: 'TIP-LZ', barcode: '7290011129', name: 'ראש לייזר חד־פעמי', cat: 'חומר מתכלה', unit: 'יח׳',
      cost: 12, price: 0, sell: false, vat: true, supplier: 's1', reorder: 20, track: true, expiry: false,
      stock: { tlv: 45, haifa: 8, bsheva: 30, jlm: 26, herzliya: 33 } },
    { sku: 'NDL-30G', barcode: '7290011136', name: 'מחט 30G להזרקה', cat: 'חומר מתכלה', unit: 'יח׳',
      cost: 3.5, price: 0, sell: false, vat: true, supplier: 's1', reorder: 50, track: true, expiry: true,
      stock: { tlv: 120, haifa: 90, bsheva: 15, jlm: 75, herzliya: 60 } },
    { sku: 'SER-VITC', barcode: '7290011143', name: 'סרום ויטמין C 30מ״ל', cat: 'מוצר למכירה', unit: 'יח׳',
      cost: 62, price: 189, sell: true, vat: true, supplier: 's2', reorder: 5, track: true, expiry: true,
      stock: { tlv: 12, haifa: 9, bsheva: 7, jlm: 11, herzliya: 6 },
      desc: 'סרום מרוכז להבהרה ולחידוש העור. מומלץ לשימוש יומי לאחר טיפול פנים.' },
    { sku: 'SPF-50', barcode: '7290011150', name: 'קרם הגנה SPF50', cat: 'מוצר למכירה', unit: 'יח׳',
      cost: 41, price: 129, sell: true, vat: true, supplier: 's2', reorder: 8, track: true, expiry: true,
      stock: { tlv: 3, haifa: 11, bsheva: 9, jlm: 14, herzliya: 10 },
      desc: 'הגנה רחבת טווח — חובה אחרי לייזר ואחרי טיפול פנים.' },
    { sku: 'MSK-HYD', barcode: '7290011167', name: 'מסכת לחות (יחידה)', cat: 'מוצר למכירה', unit: 'יח׳',
      cost: 18, price: 55, sell: true, vat: true, supplier: 's2', reorder: 10, track: true, expiry: true,
      stock: { tlv: 22, haifa: 16, bsheva: 4, jlm: 19, herzliya: 12 },
      desc: 'מסכת לחות לשימוש ביתי בין טיפולים.' },
  ];
  /* מרשם צריכה — מה כל שירות מוריד מהמלאי */
  const SEED_BOM = {
    laser:     [{ sku: 'GEL-500', qty: 15 }, { sku: 'TIP-LZ', qty: 1 }],   /* 15 מ״ל ג׳ל + ראש אחד */
    injection: [{ sku: 'NDL-30G', qty: 2 }],
    facial:    [{ sku: 'MSK-HYD', qty: 1 }],
  };

  let INV_ITEMS = CBX.load('inv_items', null) || JSON.parse(JSON.stringify(SEED_ITEMS));
  let INV_SUPPLIERS = CBX.load('inv_suppliers', null) || JSON.parse(JSON.stringify(SEED_SUPPLIERS));
  let INV_BOM = CBX.load('inv_bom', null) || JSON.parse(JSON.stringify(SEED_BOM));
  let INV_MOVES = CBX.load('inv_moves', []);
  let INV_PO = CBX.load('inv_po', []);

  const saveItems = () => CBX.store('inv_items', INV_ITEMS);
  const saveSup = () => CBX.store('inv_suppliers', INV_SUPPLIERS);
  const saveBom = () => CBX.store('inv_bom', INV_BOM);
  const saveMoves = () => CBX.store('inv_moves', INV_MOVES.slice(0, 300));
  const savePO = () => CBX.store('inv_po', INV_PO);

  /* ---------------- לוגיקה ---------------- */
  function invBranches() {
    return (typeof COORD_BRANCHES !== 'undefined')
      ? COORD_BRANCHES.filter(b => b.active !== false).map(b => ({ key: b.key, label: b.short || b.label }))
      : [{ key: 'tlv', label: 'ראשי' }];
  }
  function invItem(sku) { return INV_ITEMS.find(i => i.sku === sku) || null; }
  function invStock(sku, br) {
    const it = invItem(sku); if (!it) return 0;
    if (br) return +(it.stock || {})[br] || 0;
    return Object.keys(it.stock || {}).reduce((a, k) => a + (+it.stock[k] || 0), 0);
  }
  function invValue() { return INV_ITEMS.reduce((a, i) => a + invStock(i.sku) * (+i.cost || 0), 0); }
  function invLow() {
    const out = [];
    INV_ITEMS.filter(i => i.track !== false).forEach(i => {
      invBranches().forEach(b => {
        /* סניף שלא מחזיק את הפריט בכלל אינו "חוסר" — רק סניף שאמור להחזיק אותו */
        if (!i.stock || i.stock[b.key] === undefined) return;
        const q = invStock(i.sku, b.key);
        if (q <= (+i.reorder || 0)) out.push({ item: i, branch: b, qty: q });
      });
    });
    return out;
  }
  function invStamp() { return (typeof autoStamp === 'function') ? autoStamp() : ''; }
  /* תנועת מלאי — כל שינוי עובר דרך כאן, כדי שתמיד יהיה תיעוד */
  function invMove(sku, br, delta, kind, note) {
    const it = invItem(sku); if (!it) return { ok: false, why: 'מק״ט לא נמצא' };
    it.stock = it.stock || {};
    const before = +it.stock[br] || 0, after = before + (+delta || 0);
    if (after < 0 && kind !== 'adjust') return { ok: false, why: 'אין מספיק מלאי ב' + br + ' (' + before + ')' };
    it.stock[br] = after;
    INV_MOVES.unshift({ t: invStamp(), sku, name: it.name, br, delta: +delta || 0, before, after, kind, note: note || '' });
    saveItems(); saveMoves();
    CBX.emit('inv:move', { sku, br, delta, after });
    return { ok: true, before, after };
  }
  function invTransfer(sku, from, to, qty) {
    const a = invMove(sku, from, -Math.abs(qty), 'transfer', 'העברה אל ' + to);
    if (!a.ok) return a;
    return invMove(sku, to, Math.abs(qty), 'transfer', 'התקבל מ' + from);
  }
  /* צריכה אוטומטית בסיום טיפול */
  function invConsume(svcKey, br, note) {
    const bom = INV_BOM[svcKey] || []; if (!bom.length) return [];
    return bom.map(l => {
      const r = invMove(l.sku, br, -Math.abs(l.qty), 'consume', note || ('צריכה · ' + svcKey));
      return { sku: l.sku, qty: l.qty, ok: r.ok, why: r.why || '' };
    });
  }
  function invSupplier(id) { return INV_SUPPLIERS.find(s => s.id === id) || null; }

  /* ---------------- מסך המלאי ---------------- */
  let invTab = 'items', invBr = 'all', invQ = '', invOpen = null;
  /* כמה סניפים להציג בשורה, ולפי איזה קצה. עמודה לכל סניף לא מתאימה
     לרשת עם עשרות או מאות סניפים. */
  let invView = CBX.load('inv_view', { edge: 'low', n: 3 });
  const saveView = () => CBX.store('inv_view', invView);

  const INV_TABS = [
    { key: 'items', label: 'מוצרים ומלאי', icon: 'tasks' },
    { key: 'bom', label: 'צריכה לפי שירות', icon: 'sync' },
    { key: 'suppliers', label: 'ספקים והזמנות', icon: 'org' },
    { key: 'moves', label: 'תנועות מלאי', icon: 'clock' },
  ];

  function invViewHTML() {
    const brs = invBranches();
    const low = invLow();
    return `<div class="inv-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${INV_ITEMS.length}</b><small>מוצרים בקטלוג</small></div>
        <div class="inv-kpi"><b>${CBX.money(invValue())}</b><small>שווי מלאי בעלות</small></div>
        <div class="inv-kpi ${low.length ? 'warn' : ''}"><b>${low.length}</b><small>מתחת לנקודת הזמנה</small></div>
        <div class="inv-kpi"><b>${INV_ITEMS.filter(i => i.sell).length}</b><small>נמכרים ללקוח</small></div>
      </div>
      <div class="inv-tabs">${INV_TABS.map(t => `<button class="inv-tab ${invTab === t.key ? 'on' : ''}" data-invtab="${t.key}">${ic(t.icon)} ${t.label}</button>`).join('')}</div>
      ${invTab === 'items' ? invItemsHTML(brs) : invTab === 'bom' ? invBomHTML() : invTab === 'suppliers' ? invSupHTML() : invMovesHTML()}
    </div>`;
  }

  function invItemsHTML(brs) {
    const q = invQ.toLowerCase();
    const list = INV_ITEMS.filter(i => !q || (i.name + ' ' + i.sku + ' ' + (i.barcode || '')).toLowerCase().includes(q));
    /* הסניפים שמחזיקים את הפריט, ממוינים לפי הקצה שנבחר */
    const held = i => brs.filter(b => i.stock && i.stock[b.key] !== undefined)
      .map(b => ({ b, q: invStock(i.sku, b.key), low: invStock(i.sku, b.key) <= (+i.reorder || 0) }))
      .sort((x, y) => invView.edge === 'low' ? x.q - y.q : y.q - x.q);
    return `<div class="inv-bar">
        <input class="cc-inp sm" id="invQ" placeholder="חיפוש מוצר / מק״ט / ברקוד…" value="${esc(invQ)}">
        <button class="btn sm primary" id="invAdd">${ic('plus')} מוצר חדש</button>
      </div>
      <div class="inv-viewbar">
        <span class="inv-vb-l">${ic('org')} הצג בשורה</span>
        <span class="terr-freq">
          <button class="fx-chip ${invView.edge === 'low' ? 'on' : ''}" data-invedge="low">הסניפים עם הכי מעט</button>
          <button class="fx-chip ${invView.edge === 'high' ? 'on' : ''}" data-invedge="high">הסניפים עם הכי הרבה</button>
        </span>
        <select class="cc-inp sm inv-vb-n" id="invN">
          ${[1, 2, 3, 5].map(n => `<option value="${n}" ${invView.n === n ? 'selected' : ''}>${n} סניפים</option>`).join('')}
        </select>
        <span class="inv-vb-note">${brs.length} סניפים בסך הכול · השאר נפתח בלחיצה</span>
      </div>
      <div class="inv-table-wrap"><table class="inv-table inv-rows">
        <thead><tr><th>מוצר</th><th>מק״ט</th><th>קטגוריה</th>
          <th>${invView.edge === 'low' ? 'הכי מעט' : 'הכי הרבה'}</th>
          <th>סה״כ</th><th>עלות</th><th>מחיר</th><th></th></tr></thead>
        <tbody>${list.map(i => {
          const h = held(i), tot = invStock(i.sku);
          const lowAny = h.some(x => x.low);
          const shown = h.slice(0, invView.n), rest = h.slice(invView.n);
          const open = invOpen === i.sku;
          return `<tr class="inv-row ${lowAny ? 'low' : ''} ${open ? 'open' : ''}" data-invrow="${esc(i.sku)}">
            <td><b>${esc(i.name)}</b>${i.sell ? '<span class="inv-chip sell">נמכר</span>' : ''}${i.expiry ? '<span class="inv-chip">תוקף</span>' : ''}</td>
            <td class="mono">${esc(i.sku)}</td><td>${esc(i.cat)}</td>
            <td class="inv-br-cell">
              ${shown.map(x => `<span class="inv-bq ${x.low ? 'low' : ''}">${esc(x.b.label)} <b>${x.q}</b></span>`).join('')
                || '<span class="q-na">לא מוחזק</span>'}
              ${rest.length ? `<button class="inv-more" data-invmore="${esc(i.sku)}">
                ${open ? 'הסתר' : '+' + rest.length + ' סניפים'}</button>` : ''}
            </td>
            <td><b>${tot}</b> <small>${esc(i.unit)}</small></td>
            <td>${CBX.money(i.cost)}</td><td>${i.sell ? CBX.money(i.price) : '—'}</td>
            <td class="inv-acts">
              <button class="btn xs" data-invmv="${esc(i.sku)}">${ic('sync')} תנועה</button>
              <button class="btn xs" data-invedit="${esc(i.sku)}">${ic('settings')} פתח</button>
            </td></tr>
            ${open && rest.length ? `<tr class="inv-expand"><td colspan="8">
              <div class="inv-exp-h">${ic('org')} <b>כל הסניפים · ${esc(i.name)}</b>
                <span>${h.length} סניפים מחזיקים · סה״כ ${tot} ${esc(i.unit)}</span></div>
              <div class="inv-exp-l">${h.map(x => `<span class="inv-bq ${x.low ? 'low' : ''}">
                ${esc(x.b.label)} <b>${x.q}</b></span>`).join('')}</div>
            </td></tr>` : ''}`; }).join('') || `<tr><td colspan="8" class="inv-empty">אין מוצרים תואמים</td></tr>`}
        </tbody></table></div>
      <p class="cr-hint">${ic('alert')} שורה מסומנת = לפחות סניף אחד מתחת לנקודת ההזמנה. האוטומציה "מלאי נמוך" שולחת על כך התראה.</p>`;
  }

  function invBomHTML() {
    const treats = (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : [];
    return `<p class="inv-lead">כאן מגדירים מה כל שירות צורך. בסיום טיפול המלאי יורד לבד בסניף שבו הוא בוצע —
      בלי שאף אחד יצטרך לזכור לעדכן.</p>
      <div class="inv-bom">${treats.map(t => {
        const lines = INV_BOM[t.key] || [];
        const cost = lines.reduce((a, l) => a + (invItem(l.sku) ? invItem(l.sku).cost * l.qty : 0), 0);
        return `<div class="inv-bom-card">
          <div class="inv-bom-h"><span class="dot ${t.color}"></span><b>${esc(t.label)}</b>
            <span class="inv-bom-cost">עלות חומרים: <b>${CBX.money(cost)}</b>${t.price ? ' · מתוך מחיר ' + CBX.money(t.price) : ''}</span></div>
          <div class="inv-bom-lines">${lines.map((l, i) => { const it = invItem(l.sku);
            return `<div class="inv-bom-line"><span>${esc(it ? it.name : l.sku)}</span>
              <input class="cc-inp sm" type="number" min="0" step="0.5" value="${l.qty}" data-bomqty="${t.key}|${i}">
              <small>${esc(it ? it.unit : '')}</small>
              <button class="btn xs" data-bomdel="${t.key}|${i}">${ic('close')}</button></div>`; }).join('')
            || '<p class="inv-bom-none">לא הוגדרה צריכה לשירות זה</p>'}</div>
          <div class="inv-bom-add">
            <select class="cc-inp sm" data-bomsku="${t.key}">${INV_ITEMS.map(i => `<option value="${esc(i.sku)}">${esc(i.name)}</option>`).join('')}</select>
            <button class="btn xs" data-bomadd="${t.key}">${ic('plus')} הוסף</button>
          </div></div>`; }).join('')}</div>`;
  }

  function invSupHTML() {
    const low = invLow();
    return `<p class="inv-lead">ספקים, תנאי תשלום וזמן אספקה. הזמנת רכש נפתחת ישירות מהחוסרים.</p>
      <div class="inv-sup-grid">${INV_SUPPLIERS.map(s => {
        const items = INV_ITEMS.filter(i => i.supplier === s.id);
        const need = low.filter(l => l.item.supplier === s.id);
        return `<div class="inv-sup-card">
          <div class="inv-sup-h">${ic('org')} <b>${esc(s.name)}</b></div>
          <div class="inv-sup-meta"><span>${esc(s.contact)}</span><span>${esc(s.phone)}</span><span>${esc(s.mail)}</span></div>
          <div class="inv-sup-facts"><span>${esc(s.terms)}</span><span>אספקה ${s.lead} ימים</span><span>${items.length} מוצרים</span></div>
          ${need.length ? `<button class="btn sm primary" data-invpo="${s.id}">${ic('plus')} הזמנת רכש · ${need.length} חוסרים</button>`
            : '<span class="inv-sup-ok">' + ic('check') + ' אין חוסרים</span>'}
        </div>`; }).join('')}</div>
      ${INV_PO.length ? `<div class="inv-po-list"><h4>${ic('docs')} הזמנות רכש</h4>
        ${INV_PO.map((p, i) => `<div class="inv-po">
          <b>${esc(p.supplier)}</b><span>${p.lines.length} שורות · ${CBX.money(p.total)}</span>
          <span class="inv-po-st ${p.status}">${p.status === 'open' ? 'פתוחה' : 'התקבלה'}</span>
          <small>${esc(p.t)}</small>
          ${p.status === 'open' ? `<button class="btn xs primary" data-poget="${i}">${ic('check')} קליטה למלאי</button>` : ''}
        </div>`).join('')}</div>` : ''}`;
  }

  function invMovesHTML() {
    const KIND = { in: 'קליטה', out: 'הוצאה', transfer: 'העברה', adjust: 'תיקון ספירה', consume: 'צריכה בטיפול', sale: 'מכירה' };
    return `<p class="inv-lead">כל שינוי במלאי מתועד — מי, מתי, כמה ולמה. אין שינוי שלא עובר כאן.</p>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>מתי</th><th>מוצר</th><th>סניף</th><th>סוג</th><th>שינוי</th><th>לפני → אחרי</th><th>הערה</th></tr></thead>
        <tbody>${INV_MOVES.slice(0, 60).map(m => `<tr>
          <td><small>${esc(m.t)}</small></td><td>${esc(m.name)}</td>
          <td>${esc((invBranches().find(b => b.key === m.br) || {}).label || m.br)}</td>
          <td>${KIND[m.kind] || m.kind}</td>
          <td class="${m.delta < 0 ? 'neg' : 'pos'}">${m.delta > 0 ? '+' : ''}${m.delta}</td>
          <td class="mono">${m.before} → ${m.after}</td><td><small>${esc(m.note)}</small></td>
        </tr>`).join('') || `<tr><td colspan="7" class="inv-empty">עדיין אין תנועות</td></tr>`}
        </tbody></table></div>`;
  }

  function invBind(rerender) {
    const RR = rerender;
    $$('[data-invtab]').forEach(b => b.addEventListener('click', () => { invTab = b.dataset.invtab; RR(); }));
    const q = $('#invQ'); if (q) q.addEventListener('input', () => { invQ = q.value; RR();
      const n = $('#invQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    const br = $('#invBr'); if (br) br.addEventListener('change', () => { invBr = br.value; RR(); });
    const ad = $('#invAdd'); if (ad) ad.addEventListener('click', () => openInvItem(null, RR));
    $$('[data-invedit]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openInvItem(b.dataset.invedit, RR); }));
    /* השורה כולה פותחת את המוצר — יעד לחיצה של אייקון 24px הוא לא שמיש */
    $$('[data-invrow]').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      openInvItem(tr.dataset.invrow, RR); }));
    $$('[data-invmore]').forEach(b => b.addEventListener('click', e => { e.stopPropagation();
      invOpen = invOpen === b.dataset.invmore ? null : b.dataset.invmore; RR(); }));
    $$('[data-invedge]').forEach(b => b.addEventListener('click', () => { invView.edge = b.dataset.invedge; saveView(); RR(); }));
    const vn = $('#invN'); if (vn) vn.addEventListener('change', () => { invView.n = +vn.value || 3; saveView(); RR(); });
    $$('[data-invmv]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openInvMove(b.dataset.invmv, RR); }));
    // מרשם צריכה
    $$('[data-bomqty]').forEach(i => i.addEventListener('change', () => {
      const [k, ix] = i.dataset.bomqty.split('|'); INV_BOM[k][+ix].qty = +i.value || 0; saveBom(); RR(); }));
    $$('[data-bomdel]').forEach(b => b.addEventListener('click', () => {
      const [k, ix] = b.dataset.bomdel.split('|'); INV_BOM[k].splice(+ix, 1); if (!INV_BOM[k].length) delete INV_BOM[k]; saveBom(); RR(); }));
    $$('[data-bomadd]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.bomadd, sel = document.querySelector('[data-bomsku="' + k + '"]'); if (!sel) return;
      INV_BOM[k] = INV_BOM[k] || [];
      if (INV_BOM[k].some(l => l.sku === sel.value)) { toast('המוצר כבר במרשם'); return; }
      INV_BOM[k].push({ sku: sel.value, qty: 1 }); saveBom(); RR(); }));
    // רכש
    $$('[data-invpo]').forEach(b => b.addEventListener('click', () => {
      const s = invSupplier(b.dataset.invpo); if (!s) return;
      const need = invLow().filter(l => l.item.supplier === s.id);
      const lines = need.map(l => ({ sku: l.item.sku, name: l.item.name, br: l.branch.key,
        qty: Math.max(1, (+l.item.reorder || 1) * 2 - l.qty), cost: l.item.cost }));
      const total = lines.reduce((a, l) => a + l.qty * l.cost, 0);
      INV_PO.unshift({ t: invStamp(), supplier: s.name, supId: s.id, lines, total, status: 'open' });
      savePO(); RR(); toast('נפתחה הזמנת רכש · ' + lines.length + ' שורות');
    }));
    $$('[data-poget]').forEach(b => b.addEventListener('click', () => {
      const po = INV_PO[+b.dataset.poget]; if (!po || po.status !== 'open') return;
      po.lines.forEach(l => invMove(l.sku, l.br, l.qty, 'in', 'קליטה מהזמנה · ' + po.supplier));
      po.status = 'received'; savePO(); RR(); toast('ההזמנה נקלטה למלאי ✓');
    }));
  }

  /* ---------------- עורך מוצר ---------------- */
  function openInvItem(sku, done) {
    const isNew = !sku;
    const src = isNew ? { sku: '', barcode: '', name: '', cat: INV_CATS[0], unit: UNITS[0], cost: 0, price: 0,
      sell: false, vat: true, supplier: (INV_SUPPLIERS[0] || {}).id || '', reorder: 0, track: true, expiry: false, stock: {}, desc: '' } : invItem(sku);
    const d = JSON.parse(JSON.stringify(src));
    const old = document.getElementById('invItemPanel'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'invItemPanel';
    const render = () => {
      w.innerHTML = `<div class="cbc-box inv-edit">
        <div class="cbc-head"><span class="cbc-ic">${ic('tasks')}</span><b>${isNew ? 'מוצר חדש' : esc(d.name)}</b></div>
        <div class="inv-f2">
          <label class="inv-f"><span>שם המוצר *</span><input class="cc-inp" id="iiName" value="${esc(d.name)}"></label>
          <label class="inv-f"><span>מק״ט *</span><input class="cc-inp" id="iiSku" value="${esc(d.sku)}" ${isNew ? '' : 'readonly'}></label>
          <label class="inv-f"><span>ברקוד</span><input class="cc-inp" id="iiBar" value="${esc(d.barcode || '')}"></label>
          <label class="inv-f"><span>קטגוריה</span><select class="cc-inp" id="iiCat">${INV_CATS.map(c => `<option ${d.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="inv-f"><span>יחידת מידה</span><select class="cc-inp" id="iiUnit">${UNITS.map(u => `<option ${d.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
          <label class="inv-f"><span>ספק</span><select class="cc-inp" id="iiSup">${INV_SUPPLIERS.map(s => `<option value="${s.id}" ${d.supplier === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
          <label class="inv-f"><span>עלות ליחידה</span><input class="cc-inp" type="number" min="0" step="0.5" id="iiCost" value="${+d.cost || 0}"></label>
          <label class="inv-f"><span>נקודת הזמנה</span><input class="cc-inp" type="number" min="0" id="iiRe" value="${+d.reorder || 0}"></label>
        </div>
        <label class="inv-chk"><input type="checkbox" id="iiSell" ${d.sell ? 'checked' : ''}>
          <span><b>נמכר ללקוח</b><small>יופיע בחנות ובעגלה. מוצר שאינו נמכר הוא חומר פנימי בלבד.</small></span></label>
        ${d.sell ? `<div class="inv-f2">
          <label class="inv-f"><span>מחיר לצרכן</span><input class="cc-inp" type="number" min="0" id="iiPrice" value="${+d.price || 0}"></label>
          <label class="inv-f"><span>כולל מע״מ</span><select class="cc-inp" id="iiVat"><option value="1" ${d.vat ? 'selected' : ''}>כן</option><option value="0" ${!d.vat ? 'selected' : ''}>לא</option></select></label>
        </div>
        <label class="inv-f"><span>תיאור לחנות</span><textarea class="cc-inp" rows="2" id="iiDesc">${esc(d.desc || '')}</textarea></label>` : ''}
        <label class="inv-chk"><input type="checkbox" id="iiTrack" ${d.track !== false ? 'checked' : ''}>
          <span><b>לעקוב אחרי מלאי</b><small>אם כבוי — הפריט לא נספר ולא מתריע.</small></span></label>
        <label class="inv-chk"><input type="checkbox" id="iiExp" ${d.expiry ? 'checked' : ''}>
          <span><b>בעל תוקף / אצווה</b><small>חובה בחומרים רפואיים וקוסמטיים — כדי שחומר שפג לא ייצא לשימוש.</small></span></label>
        <div class="inv-stock-h">${ic('org')} <b>מלאי פותח לפי סניף</b></div>
        <div class="inv-f2">${invBranches().map(b => `<label class="inv-f"><span>${esc(b.label)}</span>
          <input class="cc-inp" type="number" min="0" data-iist="${b.key}" value="${+(d.stock || {})[b.key] || 0}"></label>`).join('')}</div>
        <div class="cbc-actions">
          ${isNew ? '' : `<button class="btn" id="iiDel">${ic('close')} מחק</button>`}
          <button class="btn primary" id="iiSave">${ic('check')} ${isNew ? 'צור מוצר' : 'שמור'}</button>
          <button class="btn ghost" id="iiCancel">ביטול</button></div>
      </div>`;
      const g = id => (document.getElementById(id) || {}).value;
      const sync = () => {
        d.name = g('iiName'); d.sku = g('iiSku') || d.sku; d.barcode = g('iiBar'); d.cat = g('iiCat');
        d.unit = g('iiUnit'); d.supplier = g('iiSup'); d.cost = +g('iiCost') || 0; d.reorder = +g('iiRe') || 0;
        d.sell = document.getElementById('iiSell').checked;
        d.track = document.getElementById('iiTrack').checked;
        d.expiry = document.getElementById('iiExp').checked;
        if (d.sell) { d.price = +g('iiPrice') || 0; d.vat = g('iiVat') === '1'; d.desc = g('iiDesc') || ''; }
        d.stock = d.stock || {};
        $$('[data-iist]', w).forEach(i => { d.stock[i.dataset.iist] = +i.value || 0; });
      };
      $('#iiSell', w).addEventListener('change', () => { sync(); render(); });
      $('#iiSave', w).addEventListener('click', () => {
        sync();
        if (!d.name.trim()) { toast('נא למלא שם מוצר'); return; }
        if (!d.sku.trim()) { toast('נא למלא מק״ט'); return; }
        if (isNew && invItem(d.sku)) { toast('מק״ט זה כבר קיים'); return; }
        if (isNew) { INV_ITEMS.push(d); Object.keys(d.stock).forEach(b => { if (d.stock[b]) INV_MOVES.unshift({ t: invStamp(), sku: d.sku, name: d.name, br: b, delta: d.stock[b], before: 0, after: d.stock[b], kind: 'in', note: 'מלאי פותח' }); }); }
        else { const t = invItem(sku); Object.keys(d).forEach(k => { t[k] = d[k]; }); }
        saveItems(); saveMoves(); w.remove(); if (done) done();
        toast(isNew ? 'המוצר נוסף ✓' : 'המוצר עודכן ✓');
      });
      /* נקודת חיבור לניהול השדות — שדות שהוגדרו למוצר נכנסים לכאן */
      CBX.emit('inv:editor', { item: d, host: w.querySelector('.cbc-box'), isNew });
      $('#iiCancel', w).addEventListener('click', () => w.remove());
      const del = $('#iiDel', w); if (del) del.addEventListener('click', () => {
        const i = INV_ITEMS.findIndex(x => x.sku === sku); if (i >= 0) INV_ITEMS.splice(i, 1);
        Object.keys(INV_BOM).forEach(k => { INV_BOM[k] = INV_BOM[k].filter(l => l.sku !== sku); if (!INV_BOM[k].length) delete INV_BOM[k]; });
        saveItems(); saveBom(); w.remove(); if (done) done(); toast('המוצר נמחק');
      });
    };
    render();
    w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
    document.body.appendChild(w);
  }

  /* ---------------- תנועת מלאי ידנית ---------------- */
  function openInvMove(sku, done) {
    const it = invItem(sku); if (!it) return;
    const old = document.getElementById('invMovePanel'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'invMovePanel';
    const brs = invBranches();
    w.innerHTML = `<div class="cbc-box inv-move">
      <div class="cbc-head"><span class="cbc-ic">${ic('sync')}</span><b>תנועת מלאי · ${esc(it.name)}</b></div>
      <div class="inv-cur">${brs.map(b => `<span><i>${esc(b.label)}</i><b>${invStock(sku, b.key)}</b></span>`).join('')}</div>
      <label class="inv-f"><span>סוג התנועה</span><select class="cc-inp" id="mvKind">
        <option value="in">קליטה למלאי</option><option value="out">הוצאה מהמלאי</option>
        <option value="transfer">העברה בין סניפים</option><option value="adjust">תיקון אחרי ספירה</option>
      </select></label>
      <div class="inv-f2">
        <label class="inv-f"><span>סניף</span><select class="cc-inp" id="mvBr">${brs.map(b => `<option value="${b.key}">${esc(b.label)}</option>`).join('')}</select></label>
        <label class="inv-f" id="mvToWrap" hidden><span>אל סניף</span><select class="cc-inp" id="mvTo">${brs.map(b => `<option value="${b.key}">${esc(b.label)}</option>`).join('')}</select></label>
        <label class="inv-f"><span>כמות</span><input class="cc-inp" type="number" min="0" step="0.5" id="mvQty" value="1"></label>
      </div>
      <label class="inv-f"><span>הערה</span><input class="cc-inp" id="mvNote" placeholder="למשל: שבור / פג תוקף / ספירה חודשית"></label>
      <div class="cbc-actions"><button class="btn primary" id="mvOk">${ic('check')} בצע</button>
        <button class="btn ghost" id="mvCancel">ביטול</button></div>
    </div>`;
    const kind = $('#mvKind', w);
    kind.addEventListener('change', () => { $('#mvToWrap', w).hidden = kind.value !== 'transfer'; });
    $('#mvCancel', w).addEventListener('click', () => w.remove());
    $('#mvOk', w).addEventListener('click', () => {
      const k = kind.value, br = $('#mvBr', w).value, qty = +$('#mvQty', w).value || 0, note = $('#mvNote', w).value;
      if (qty <= 0) { toast('נא להזין כמות'); return; }
      let r;
      if (k === 'transfer') { const to = $('#mvTo', w).value;
        if (to === br) { toast('בחר סניף יעד שונה'); return; }
        r = invTransfer(sku, br, to, qty); }
      else if (k === 'adjust') { const cur = invStock(sku, br); r = invMove(sku, br, qty - cur, 'adjust', note || 'ספירה'); }
      else r = invMove(sku, br, k === 'in' ? qty : -qty, k, note);
      if (!r.ok) { toast(r.why); return; }
      w.remove(); if (done) done(); toast('התנועה נרשמה ✓');
    });
    w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
    document.body.appendChild(w);
  }

  /* ---------------- רישום ההרחבה ---------------- */
  CBX.register({
    key: 'inv', label: 'מלאי ומוצרים', icon: 'tasks',
    desc: 'מוצרים פיזיים, מלאי לפי סניף, ספקים, רכש, ומרשם צריכה שמוריד מלאי אוטומטית בסיום טיפול.',
    files: ['js/ext/inventory.js', 'css/ext/inventory.css'],
    install() {
      /* 1) לשונית "מלאי ומוצרים" בתוך מסך הקטלוג */
      CBX.wrap('inv', 'renderCatalogView', orig => function () {
        if (!window.__invMode) return orig.apply(this, arguments);
        const host = document.getElementById('viewHost');
        host.innerHTML = (typeof settingsHeader === 'function' ? settingsHeader() : '')
          + '<div class="inv-switch"><button class="btn sm inv-back" id="invBack">' + ic('chevronR') + ' חזרה לשירותים</button></div>'
          + invViewHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        const b = document.getElementById('invBack');
        if (b) b.addEventListener('click', () => { window.__invMode = false; renderCatalogView(); });
        invBind(() => renderCatalogView());
      });
      /* 2) כפתור מעבר בתוך מסך השירותים */
      CBX.wrap('inv', 'renderCatalogView', orig => function () {
        const r = orig.apply(this, arguments);
        if (window.__invMode) return r;
        /* שורה משלהם — הכנסה לתוך .cat-controls דחסה את בוררי הקטגוריה
           והמיון ל-19px ברוחב 375, ועשתה אותם בלתי שמישים במגע. */
        const ctrl = document.querySelector('#viewHost .cat-controls');
        if (ctrl && !document.getElementById('invGo')) {
          let row = document.getElementById('cbxCatRow');
          if (!row) { row = document.createElement('div'); row.className = 'cbx-cat-row'; row.id = 'cbxCatRow';
            ctrl.parentNode.insertBefore(row, ctrl.nextSibling); }
          const b = document.createElement('button');
          b.className = 'btn sm cbx-cat-btn'; b.id = 'invGo'; b.type = 'button';
          const low = invLow().length;
          b.innerHTML = ic('tasks') + ' מלאי ומוצרים' + (low ? ' <span class="inv-badge">' + low + '</span>' : '');
          row.appendChild(b);
        }
        return r;
      });
      /* 3) אוטומציה: התראת מלאי נמוך */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('inv', AUTOMATIONS,
        [{ key: 'x_inv_low', trigger: 'מלאי נמוך', title: 'התראת מלאי נמוך', desc: 'כשמוצר יורד מתחת לנקודת ההזמנה — התראה למנהל', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('inv', AUTO_IMPL, {
        x_inv_low: {
          what: 'סורק את המלאי בכל הסניפים. מוצר שירד מתחת לנקודת ההזמנה שהוגדרה לו — יוצאת התראה, כדי שלא ייגמר באמצע יום עבודה.',
          run: () => {
            const low = invLow(); if (!low.length) return 'כל המוצרים מעל נקודת ההזמנה — לא בוצע';
            low.slice(0, 5).forEach(l => { if (typeof autoNotify === 'function')
              autoNotify('מלאי נמוך', l.item.name + ' · ' + l.branch.label + ' — נותרו ' + l.qty + ' ' + l.item.unit, 'reminder'); });
            return 'התראה על ' + low.length + ' חוסרים: ' + low.slice(0, 4).map(l => l.item.name + ' (' + l.branch.label + ')').join(' · ');
          } } });
      /* 4) צריכה אוטומטית בסיום טיפול */
      CBX.on('inv', 'service:done', d => {
        const res = invConsume(d.service, d.branch || 'tlv', 'סיום טיפול · ' + (d.name || ''));
        if (res.length && typeof toast === 'function') toast('ירדו מהמלאי: ' + res.filter(r => r.ok).length + ' פריטים');
      });
      /* 5) מוצרים בחיפוש החכם */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('inv', 'runGlobalSearchWide', orig => function (q, res) {
        orig.call(this, q, res);
        INV_ITEMS.forEach(i => {
          if ((i.name + ' ' + i.sku + ' ' + (i.barcode || '') + ' ' + i.cat).toLowerCase().includes(q))
            res.push({ type: 'מוצר', label: i.name, goto: 'inventory',
              sub: i.sku + ' · מלאי ' + invStock(i.sku) + ' ' + i.unit + (i.sell ? ' · ' + CBX.money(i.price) : '') });
        });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('inv', 'gotoEntity', orig => function (where, id) {
        if (where === 'inventory') { navActive = 'settings'; if (typeof applySetMode === 'function') applySetMode('catalog');
          window.__invMode = true; invTab = 'items'; renderCatalogView(); return; }
        return orig.call(this, where, id);
      });
      CBX.delegate('inv', '#invGo', () => { window.__invMode = true; renderCatalogView(); });
      CBX._remember('inv', () => { window.__invMode = false; });
    },
  });

  /* חשיפה למודולים אחרים (החנות) */
  window.INV = { items: () => INV_ITEMS, item: invItem, stock: invStock, move: invMove,
    consume: invConsume, low: invLow, branches: invBranches, bom: () => INV_BOM,
    sellable: () => INV_ITEMS.filter(i => i.sell && invStock(i.sku) > 0) };
})();
