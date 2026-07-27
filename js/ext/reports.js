/* ============================================================
   הרחבה: דוחות ובונה דוחות  ·  key = 'rep'
   ------------------------------------------------------------
   טאב הדוחות היה כמעט ריק. כאן: דשבורד לפי תפקיד, ובונה דוחות
   שמנהל בונה בעצמו — בוחר מקור נתונים, לפי מה לקבץ ומה למדוד —
   בלי לכתוב שורת קוד. אפשר לשמור, לשתף ולייצא.
   מקורות הנתונים נרשמים דינמית: כל הרחבה אחרת יכולה להוסיף
   מקור משלה, ואם היא כבויה — המקור פשוט לא מופיע.
   ============================================================ */
(function () {

  /* ---------------- מקורות נתונים ----------------
     כל מקור: rows() מחזיר מערך אובייקטים, dims = לפי מה לקבץ,
     metrics = מה למדוד. הכול בשפה של המשתמש, לא של המפתח. */
  function SOURCES() {
    const S = [];
    if (typeof RECORDS !== 'undefined') S.push({
      key: 'leads', label: 'פניות ולידים', icon: 'leads',
      rows: () => RECORDS.filter(r => !r.archived),
      dims: [
        { key: 'assignee', label: 'נציג מטפל', get: r => r.assignee || 'לא משויך' },
        { key: 'source', label: 'מקור הפנייה', get: r => r.source || 'לא ידוע' },
        { key: 'stage', label: 'שלב בתהליך', get: r => (r.status && r.status.label) || r.stageKey || '—' },
        { key: 'priority', label: 'עדיפות', get: r => ({ high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' })[r.priority] || '—' },
        { key: 'journey', label: 'מסלול', get: r => ({ sales: 'מכירות', support: 'שירות', billing: 'גבייה', upsell: 'הרחבה' })[r.journey] || r.journey || '—' },
        { key: 'branch', label: 'סניף', get: r => { const b = (r.needs || {}).branch;
          const x = (typeof cBranch === 'function' && b) ? cBranch(b) : null; return x ? (x.short || x.label) : 'לא נבחר'; } },
        { key: 'service', label: 'שירות', get: r => { const s = (r.services || [])[0];
          const t = (typeof cTreat === 'function' && s) ? cTreat(s) : null; return t ? t.label : 'ללא'; } },
      ],
      metrics: [
        { key: 'count', label: 'מספר פניות', calc: rs => rs.length },
        { key: 'overdue', label: 'פניות באיחור', calc: rs => rs.filter(r => typeof recIsOverdue === 'function' && recIsOverdue(r)).length },
        { key: 'value', label: 'שווי משוער', money: true, calc: rs => rs.reduce((a, r) => a + (+r.orderTotal || 0), 0) },
      ] });

    if (typeof STAFF !== 'undefined') S.push({
      key: 'staff', label: 'צוות', icon: 'clients',
      rows: () => STAFF,
      dims: [
        { key: 'dept', label: 'מחלקה', get: s => s.dept || '—' },
        { key: 'role', label: 'תפקיד', get: s => s.role || '—' },
        { key: 'perm', label: 'רמת הרשאה', get: s => s.perm || '—' },
      ],
      metrics: [
        { key: 'count', label: 'מספר עובדים', calc: rs => rs.length },
        { key: 'load', label: 'לידים פתוחים', calc: rs => rs.reduce((a, s) =>
          a + ((typeof RECORDS !== 'undefined') ? RECORDS.filter(r => r.assignee === s.name && !r.done).length : 0), 0) },
      ] });

    if (typeof autoAll === 'function') S.push({
      key: 'auto', label: 'אוטומציות', icon: 'bolt',
      rows: () => autoAll(),
      dims: [
        { key: 'trigger', label: 'מתי רצה', get: a => a.trigger },
        { key: 'state', label: 'מצב', get: a => (typeof autoIsOn === 'function' && autoIsOn(a.key)) ? 'פעילה' : 'כבויה' },
      ],
      metrics: [
        { key: 'count', label: 'מספר חוקים', calc: rs => rs.length },
        { key: 'runs', label: 'סה״כ ריצות', calc: rs => rs.reduce((a, x) =>
          a + ((typeof autoStat === 'function') ? (autoStat(x.key).runs || 0) : 0), 0) },
      ] });

    /* מקורות מהרחבות אחרות — מופיעים רק אם ההרחבה דלוקה */
    if (window.INV && CBX.isOn('inv')) S.push({
      key: 'inv', label: 'מלאי ומוצרים', icon: 'tasks',
      rows: () => window.INV.items(),
      dims: [
        { key: 'cat', label: 'קטגוריה', get: i => i.cat },
        { key: 'sell', label: 'נמכר ללקוח', get: i => i.sell ? 'כן' : 'לא' },
      ],
      metrics: [
        { key: 'count', label: 'מספר פריטים', calc: rs => rs.length },
        { key: 'qty', label: 'כמות במלאי', calc: rs => rs.reduce((a, i) => a + window.INV.stock(i.sku), 0) },
        { key: 'value', label: 'שווי בעלות', money: true, calc: rs => rs.reduce((a, i) => a + window.INV.stock(i.sku) * (+i.cost || 0), 0) },
      ] });

    if (window.BILL && CBX.isOn('bill')) S.push({
      key: 'bill', label: 'גבייה', icon: 'shekel',
      rows: () => window.BILL.docs().filter(d => !d.void),
      dims: [
        { key: 'kind', label: 'סוג מסמך', get: d => d.kind },
        { key: 'status', label: 'סטטוס', get: d => ({ open: 'פתוחה', paid: 'שולמה', overdue: 'באיחור' })[window.BILL.status(d)] || '—' },
        { key: 'cust', label: 'לקוח', get: d => d.cust },
      ],
      metrics: [
        { key: 'count', label: 'מספר מסמכים', calc: rs => rs.length },
        { key: 'total', label: 'סכום כולל', money: true, calc: rs => rs.reduce((a, d) => a + (+d.total || 0), 0) },
        { key: 'open', label: 'יתרה פתוחה', money: true, calc: rs => rs.reduce((a, d) => a + window.BILL.balance(d), 0) },
      ] });

    if (window.TKT && CBX.isOn('tkt')) S.push({
      key: 'tkt', label: 'כרטיסי תמיכה', icon: 'ticket',
      rows: () => window.TKT.list(),
      dims: [
        { key: 'cat', label: 'קטגוריה', get: t => t.cat },
        { key: 'prio', label: 'עדיפות', get: t => (window.TKT.prios().find(p => p.key === t.prio) || {}).label || '—' },
        { key: 'state', label: 'סטטוס', get: t => (window.TKT.states().find(x => x.key === t.state) || {}).label || '—' },
        { key: 'tier', label: 'רמת לקוח', get: t => (window.TKT.tiers().find(x => x.key === t.tier) || {}).label || '—' },
      ],
      metrics: [
        { key: 'count', label: 'מספר כרטיסים', calc: rs => rs.length },
        { key: 'breach', label: 'חריגות SLA', calc: rs => rs.filter(t => t.state !== 'done' && window.TKT.sla(t).breach).length },
        { key: 'avg', label: 'זמן פתוח ממוצע (דק׳)', calc: rs => rs.length ? Math.round(rs.reduce((a, t) => a + (+t.mins || 0), 0) / rs.length) : 0 },
      ] });

    if (window.SHOPX && CBX.isOn('shop')) S.push({
      key: 'shop', label: 'הזמנות מהחנות', icon: 'org',
      rows: () => window.SHOPX.orders(),
      dims: [
        { key: 'fulfil', label: 'אופן אספקה', get: o => o.fulfil === 'ship' ? 'משלוח' : 'איסוף' },
        { key: 'coupon', label: 'קופון', get: o => o.coupon || 'ללא' },
        { key: 'status', label: 'סטטוס', get: o => o.status === 'new' ? 'חדשה' : 'טופלה' },
      ],
      metrics: [
        { key: 'count', label: 'מספר הזמנות', calc: rs => rs.length },
        { key: 'rev', label: 'מחזור', money: true, calc: rs => rs.reduce((a, o) => a + o.totals.total, 0) },
        { key: 'avg', label: 'הזמנה ממוצעת', money: true, calc: rs => rs.length ? Math.round(rs.reduce((a, o) => a + o.totals.total, 0) / rs.length) : 0 },
      ] });
    return S;
  }
  const src = k => SOURCES().find(s => s.key === k) || SOURCES()[0];

  /* ---------------- חישוב הדוח ---------------- */
  function runReport(def) {
    /* מקור שאינו זמין — למשל דוח על גבייה כשההרחבה כובתה.
       עדיף להגיד את זה מפורש מאשר להציג בשקט נתונים של מקור אחר. */
    const S = SOURCES().find(x => x.key === def.source);
    if (!S) return { missing: true, srcLabel: def.source, rows: [], total: 0, dimLabel: '', metLabel: '' };
    const dim = (S.dims.find(d => d.key === def.dim) || S.dims[0]);
    const met = (S.metrics.find(m => m.key === def.metric) || S.metrics[0]);
    const rows = S.rows() || [];
    const buckets = {};
    rows.forEach(r => { let k; try { k = dim.get(r); } catch (e) { k = '—'; }
      k = (k == null || k === '') ? '—' : String(k);
      (buckets[k] = buckets[k] || []).push(r); });
    let out = Object.keys(buckets).map(k => ({ key: k, n: buckets[k].length, v: met.calc(buckets[k]) }));
    out.sort((a, b) => def.sort === 'name' ? a.key.localeCompare(b.key) : b.v - a.v);
    if (def.top) out = out.slice(0, +def.top);
    const total = out.reduce((a, x) => a + x.v, 0);
    return { rows: out, total, dimLabel: dim.label, metLabel: met.label, money: !!met.money, srcLabel: S.label };
  }
  const fmt = (v, money) => money ? CBX.money(v) : String(v);

  /* ---------------- דוחות שמורים ---------------- */
  const SEED = [
    { id: 'r1', name: 'פניות לפי נציג', source: 'leads', dim: 'assignee', metric: 'count', chart: 'bar', sort: 'val' },
    { id: 'r2', name: 'מאיפה מגיעים הלידים', source: 'leads', dim: 'source', metric: 'count', chart: 'bar', sort: 'val' },
    { id: 'r3', name: 'פניות באיחור לפי סניף', source: 'leads', dim: 'branch', metric: 'overdue', chart: 'bar', sort: 'val' },
  ];
  let SAVED = CBX.load('rep_saved', null) || JSON.parse(JSON.stringify(SEED));
  const save = () => CBX.store('rep_saved', SAVED);

  /* ---------------- דשבורד לפי תפקיד ---------------- */
  const ROLES = [
    { key: 'mgr', label: 'מנכ״ל', desc: 'תמונה עסקית כוללת' },
    { key: 'branch', label: 'מנהל סניף', desc: 'עומסים, קיבולת וצוות' },
    { key: 'rep', label: 'נציג', desc: 'מה פתוח אצלי' },
  ];
  function kpis(role) {
    const R = (typeof RECORDS !== 'undefined') ? RECORDS : [];
    const open = R.filter(r => !r.done);
    const late = open.filter(r => typeof recIsOverdue === 'function' && recIsOverdue(r));
    const out = [];
    if (role === 'rep') {
      const me = (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : '';
      const mine = open.filter(r => r.assignee === me);
      out.push({ v: mine.length, l: 'פניות פתוחות אצלי' },
        { v: mine.filter(r => typeof recIsOverdue === 'function' && recIsOverdue(r)).length, l: 'באיחור אצלי', warn: true },
        { v: mine.filter(r => r.next && /מחר|היום/.test(r.next.at || '')).length, l: 'לטיפול היום ומחר' });
    } else {
      out.push({ v: open.length, l: 'פניות פתוחות' }, { v: late.length, l: 'באיחור', warn: !!late.length });
      if (window.BILL && CBX.isOn('bill')) {
        const docs = window.BILL.docs().filter(d => !d.void);
        out.push({ v: CBX.money(docs.reduce((a, d) => a + window.BILL.balance(d), 0)), l: 'יתרה פתוחה בגבייה' });
      }
      if (window.SHOPX && CBX.isOn('shop'))
        out.push({ v: CBX.money(window.SHOPX.orders().reduce((a, o) => a + o.totals.total, 0)), l: 'מחזור מהחנות' });
      if (role === 'branch' && window.INV && CBX.isOn('inv'))
        out.push({ v: window.INV.low().length, l: 'חוסרים במלאי', warn: !!window.INV.low().length });
    }
    return out;
  }

  /* ---------------- ממשק ---------------- */
  let repTab = 'dash', repRole = 'mgr', repOpen = null;
  let draft = { name: '', source: 'leads', dim: '', metric: '', chart: 'bar', sort: 'val', top: 0 };

  function repHTML() {
    return `<div class="bill-wrap">
      <div class="inv-tabs">
        <button class="inv-tab ${repTab === 'dash' ? 'on' : ''}" data-reptab="dash">${ic('reports')} דשבורד</button>
        <button class="inv-tab ${repTab === 'saved' ? 'on' : ''}" data-reptab="saved">${ic('docs')} דוחות שמורים</button>
        <button class="inv-tab ${repTab === 'build' ? 'on' : ''}" data-reptab="build">${ic('plus')} בונה דוחות</button>
      </div>
      ${repTab === 'dash' ? dashHTML() : repTab === 'saved' ? savedHTML() : buildHTML()}
    </div>`;
  }

  function dashHTML() {
    const k = kpis(repRole);
    return `<p class="inv-lead">מה שרואים כאן משתנה לפי התפקיד — למנכ״ל, למנהל סניף ולנציג יש שאלות שונות.</p>
      <div class="fx-chips" style="margin-bottom:14px">${ROLES.map(r => `<button class="fx-chip ${repRole === r.key ? 'on' : ''}" data-reprole="${r.key}">
        ${esc(r.label)}</button>`).join('')}</div>
      <div class="inv-kpis">${k.map(x => `<div class="inv-kpi ${x.warn ? 'warn' : ''}"><b>${esc(String(x.v))}</b><small>${esc(x.l)}</small></div>`).join('')}</div>
      <div class="rep-grid">${SAVED.slice(0, 4).map(d => { const r = runReport(d); if (!r || r.missing) return '';
        return `<div class="rep-card"><div class="rep-card-h"><b>${esc(d.name)}</b>
          <button class="btn xs" data-repopen="${d.id}">${ic('expand')}</button></div>
          ${chartHTML(r, 5)}</div>`; }).join('')}</div>`;
  }

  function chartHTML(r, limit) {
    const rows = r.rows.slice(0, limit || 12);
    const max = Math.max(1, ...rows.map(x => x.v));
    return `<div class="rep-bars">${rows.map(x => `<div class="rep-bar-row">
        <span class="rep-bl" title="${esc(x.key)}">${esc(x.key)}</span>
        <span class="rep-bt"><span class="rep-bf" style="width:${Math.round(x.v / max * 100)}%"></span></span>
        <b class="rep-bv">${fmt(x.v, r.money)}</b></div>`).join('')
      || `<p class="fx-none">אין נתונים להצגה</p>`}</div>`;
  }

  function tableHTML(r) {
    return `<div class="inv-table-wrap"><table class="inv-table">
      <thead><tr><th>${esc(r.dimLabel)}</th><th>${esc(r.metLabel)}</th><th>שיעור</th></tr></thead>
      <tbody>${r.rows.map(x => `<tr><td>${esc(x.key)}</td><td><b>${fmt(x.v, r.money)}</b></td>
        <td>${r.total ? Math.round(x.v / r.total * 100) : 0}%</td></tr>`).join('')}
        <tr class="rep-tot"><td><b>סה״כ</b></td><td><b>${fmt(r.total, r.money)}</b></td><td>100%</td></tr>
      </tbody></table></div>`;
  }

  function savedHTML() {
    if (repOpen) {
      const d = SAVED.find(x => x.id === repOpen), r = d ? runReport(d) : null;
      if (!r) return '<p class="fx-none">הדוח לא נמצא</p>';
      if (r.missing) return `<div class="rep-open">
        <div class="rep-open-h"><button class="btn sm" id="repBack">${ic('chevronR')} חזרה</button><b>${esc(d.name)}</b></div>
        <p class="fx-none">${ic('alert')} מקור הנתונים של הדוח הזה אינו זמין כרגע —
          ההרחבה שמספקת אותו כבויה. הדליקו אותה ב<b>הגדרות › הרחבות המערכת</b> והדוח יחזור לעבוד.</p></div>`;
      return `<div class="rep-open">
        <div class="rep-open-h"><button class="btn sm" id="repBack">${ic('chevronR')} חזרה</button>
          <b>${esc(d.name)}</b><span class="muted">${esc(r.srcLabel)} · ${esc(r.metLabel)} לפי ${esc(r.dimLabel)}</span>
          <button class="btn sm" id="repCsv">${ic('docs')} ייצוא CSV</button></div>
        ${chartHTML(r, 14)}${tableHTML(r)}</div>`;
    }
    return `<p class="inv-lead">דוחות ששמרתם. לחיצה פותחת את הדוח המלא עם טבלה וייצוא.</p>
      <div class="rep-list">${SAVED.map(d => { const r = runReport(d);
        return `<div class="rep-row ${r && r.missing ? 'off' : ''}"><span class="rep-n"><b>${esc(d.name)}</b>
          <small>${r && r.missing ? 'מקור הנתונים אינו זמין — ההרחבה כבויה'
            : esc((r ? r.srcLabel : '') + ' · ' + (r ? r.metLabel : '') + ' לפי ' + (r ? r.dimLabel : ''))}</small></span>
          <span class="rep-sum">${r && !r.missing ? fmt(r.total, r.money) : '—'}</span>
          <button class="btn xs" data-repopen="${d.id}">${ic('eye')} פתח</button>
          <button class="btn xs" data-repdel="${d.id}">${ic('close')}</button></div>`; }).join('')
        || '<p class="fx-none">אין דוחות שמורים</p>'}</div>`;
  }

  function buildHTML() {
    const S = src(draft.source);
    if (!draft.dim) draft.dim = S.dims[0].key;
    if (!draft.metric) draft.metric = S.metrics[0].key;
    const r = runReport(draft);
    return `<p class="inv-lead">שלושה צעדים: על מה הדוח, לפי מה לפלח, ומה למדוד. התצוגה מתעדכנת תוך כדי.</p>
      <div class="fx-step"><span class="fx-n">1</span><b>על מה הדוח?</b></div>
      <div class="fx-chips">${SOURCES().map(s => `<button class="fx-chip ${draft.source === s.key ? 'on' : ''}" data-repsrc="${s.key}">
        ${ic(s.icon)} ${esc(s.label)}</button>`).join('')}</div>
      <div class="fx-step"><span class="fx-n">2</span><b>לפי מה לפלח?</b></div>
      <div class="fx-chips">${S.dims.map(d => `<button class="fx-chip ${draft.dim === d.key ? 'on' : ''}" data-repdim="${d.key}">${esc(d.label)}</button>`).join('')}</div>
      <div class="fx-step"><span class="fx-n">3</span><b>מה למדוד?</b></div>
      <div class="fx-chips">${S.metrics.map(m => `<button class="fx-chip ${draft.metric === m.key ? 'on' : ''}" data-repmet="${m.key}">${esc(m.label)}</button>`).join('')}</div>
      <div class="fx-step"><span class="fx-n">4</span><b>תצוגה</b></div>
      <div class="fx-chips">
        <button class="fx-chip ${draft.sort === 'val' ? 'on' : ''}" data-repsort="val">מהגבוה לנמוך</button>
        <button class="fx-chip ${draft.sort === 'name' ? 'on' : ''}" data-repsort="name">לפי שם</button>
      </div>
      <div class="rep-preview">
        <div class="rep-open-h"><b>${ic('eye')} תצוגה מקדימה</b>
          <span class="muted">${esc(r.metLabel)} לפי ${esc(r.dimLabel)}</span></div>
        ${chartHTML(r, 10)}
      </div>
      <div class="rep-save">
        <input class="cc-inp sm" id="repName" placeholder="שם הדוח (למשל: מחזור לפי סניף)" value="${esc(draft.name)}">
        <button class="btn sm primary" id="repSave">${ic('check')} שמור דוח</button>
      </div>`;
  }

  function repBind(RR) {
    $$('[data-reptab]').forEach(b => b.addEventListener('click', () => { repTab = b.dataset.reptab; repOpen = null; RR(); }));
    $$('[data-reprole]').forEach(b => b.addEventListener('click', () => { repRole = b.dataset.reprole; RR(); }));
    $$('[data-repopen]').forEach(b => b.addEventListener('click', () => { repTab = 'saved'; repOpen = b.dataset.repopen; RR(); }));
    $$('[data-repdel]').forEach(b => b.addEventListener('click', () => {
      SAVED = SAVED.filter(x => x.id !== b.dataset.repdel); save(); RR(); toast('הדוח נמחק'); }));
    const bk = $('#repBack'); if (bk) bk.addEventListener('click', () => { repOpen = null; RR(); });
    $$('[data-repsrc]').forEach(b => b.addEventListener('click', () => { draft.source = b.dataset.repsrc; draft.dim = ''; draft.metric = ''; RR(); }));
    $$('[data-repdim]').forEach(b => b.addEventListener('click', () => { draft.dim = b.dataset.repdim; RR(); }));
    $$('[data-repmet]').forEach(b => b.addEventListener('click', () => { draft.metric = b.dataset.repmet; RR(); }));
    $$('[data-repsort]').forEach(b => b.addEventListener('click', () => { draft.sort = b.dataset.repsort; RR(); }));
    const nm = $('#repName'); if (nm) nm.addEventListener('input', () => { draft.name = nm.value; });
    const sv = $('#repSave'); if (sv) sv.addEventListener('click', () => {
      const name = (draft.name || '').trim();
      if (!name) { toast('נא לתת שם לדוח'); return; }
      SAVED.push(Object.assign({}, draft, { id: 'r' + (SAVED.length + 1) + draft.source, name }));
      save(); draft = { name: '', source: draft.source, dim: draft.dim, metric: draft.metric, chart: 'bar', sort: draft.sort, top: 0 };
      repTab = 'saved'; RR(); toast('הדוח נשמר ✓'); });
    const cs = $('#repCsv'); if (cs) cs.addEventListener('click', () => {
      const d = SAVED.find(x => x.id === repOpen), r = d ? runReport(d) : null; if (!r) return;
      const csv = [r.dimLabel + ',' + r.metLabel].concat(r.rows.map(x => '"' + x.key + '",' + x.v)).join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
      a.download = d.name + '.csv'; a.click();
      toast('הדוח יוצא כקובץ CSV ✓'); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'rep', label: 'דוחות ובונה דוחות', icon: 'reports',
    desc: 'דשבורד לפי תפקיד ובונה דוחות ללא קוד — בוחרים מקור, פילוח ומדד. כל הרחבה פעילה מוסיפה את הנתונים שלה כמקור.',
    files: ['js/ext/reports.js'],
    install() {
      CBX.wrap('rep', 'renderReportsView', o => function () {
        const host = document.getElementById('viewHost');
        host.innerHTML = `<div class="view-head"><div class="vh-title"><span class="num">${ic('reports')}</span>
          דוחות · <span class="muted">דשבורד, דוחות שמורים ובונה דוחות</span></div></div>` + repHTML();
        repBind(() => renderReportsView());
      });
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('rep', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        SAVED.forEach(d => { if (d.name.toLowerCase().includes(q))
          res.push({ type: 'דוח', label: d.name, goto: 'report', entId: d.id, sub: (src(d.source) || {}).label || '' }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('rep', 'gotoEntity', o => function (where, id) {
        if (where === 'report') { navActive = 'reports'; repTab = 'saved'; repOpen = id; renderReportsView(); return; }
        return o.call(this, where, id);
      });
    },
  });

  window.REP = { sources: SOURCES, run: runReport, saved: () => SAVED };
})();
