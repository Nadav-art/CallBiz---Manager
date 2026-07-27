/* ============================================================
   הרחבה: ניהול שדות של כל המערכת  ·  key = 'fields'
   ------------------------------------------------------------
   עד היום אפשר היה להוסיף שדות רק לפנייה. כאן מנהלים שדות של
   כל ישות במערכת — תיק עובד, סניף, מוצר, שירות, לקוח — ובוחרים
   בדיוק לאיזו לשונית ולאיזו קבוצת שדות השדה נכנס.
   שדה שנוסף מופיע מיד במסך האמיתי של אותה ישות, והערך נשמר
   על הרשומה עצמה תחת fx.
   ============================================================ */
(function () {

  const TYPES = [
    { key: 'text', label: 'טקסט קצר' }, { key: 'textarea', label: 'טקסט ארוך' },
    { key: 'number', label: 'מספר' }, { key: 'date', label: 'תאריך' },
    { key: 'select', label: 'בחירה מרשימה' }, { key: 'check', label: 'כן / לא' },
    { key: 'phone', label: 'טלפון' }, { key: 'mail', label: 'דוא״ל' },
  ];

  /* ---- הישויות שאפשר להוסיף להן שדות ----
     native = השדות שכבר קיימים במסך, כדי שהרשימה תהיה מלאה ולא מטעה. */
  function ENTITIES() {
    return [
      { key: 'lead', label: 'פנייה / ליד', icon: 'leads', native: true,
        tabs: () => (typeof WF_FOR_FIELDS !== 'undefined' ? WF_FOR_FIELDS : []).map(w => ({ key: w.key, label: w.label })),
        groups: wf => ((typeof WORKFLOWS !== 'undefined' && WORKFLOWS[wf]) || []).map(s => ({ key: s.key, label: s.title })),
        nativeOf: (wf, cat) => {
          if (typeof initWfFieldMap === 'function' && typeof WF_FIELD_MAP !== 'undefined' && !WF_FIELD_MAP) initWfFieldMap();
          const m = (typeof WF_FIELD_MAP !== 'undefined' && WF_FIELD_MAP) ? (WF_FIELD_MAP[wf] || {}) : {};
          return (m[cat] || [])
          .map(k => ({ key: k, label: (typeof fldDisplayLabel === 'function' && typeof LEAD_FIELDS !== 'undefined' && LEAD_FIELDS[k])
            ? fldDisplayLabel(LEAD_FIELDS[k]) : k })); } },

      { key: 'staff', label: 'תיק עובד', icon: 'user',
        tabs: () => (typeof HR_TABS !== 'undefined' ? HR_TABS : []).map(t => ({ key: t.key, label: t.label })),
        groups: () => [{ key: 'main', label: 'שדות נוספים' }],
        nativeOf: tab => ({
          file: [{ key: 'name', label: 'שם מלא' }, { key: 'idnum', label: 'ת.ז' }, { key: 'phone', label: 'טלפון' },
                 { key: 'mail', label: 'דוא״ל' }, { key: 'birth', label: 'תאריך לידה' }, { key: 'addr', label: 'כתובת' }],
          employ: [{ key: 'role', label: 'תפקיד' }, { key: 'dept', label: 'מחלקה' }, { key: 'start', label: 'תאריך תחילה' },
                   { key: 'scope', label: 'היקף משרה' }, { key: 'salary', label: 'שכר' }, { key: 'branches', label: 'סניפים' }],
          leave: [{ key: 'vacDays', label: 'ימי חופשה' }, { key: 'sick', label: 'ימי מחלה' }],
          certs: [{ key: 'cert', label: 'הסמכה' }, { key: 'certExp', label: 'תוקף' }],
          docs: [{ key: 'doc', label: 'מסמך' }],
          lifecycle: [{ key: 'onboard', label: 'קליטה' }, { key: 'offboard', label: 'סיום' }],
          perms: [{ key: 'perm', label: 'רמת הרשאה' }],
        }[tab] || []) },

      { key: 'branch', label: 'סניף', icon: 'org',
        tabs: () => (typeof BR_PANELS !== 'undefined' ? BR_PANELS : [{ key: 'general', label: 'כללי' }])
          .map(p => ({ key: p.key, label: p.label })),
        groups: () => [{ key: 'main', label: 'שדות נוספים' }],
        nativeOf: tab => ({
          general: [{ key: 'name', label: 'שם הסניף' }, { key: 'short', label: 'שם קצר' }, { key: 'city', label: 'עיר' },
                    { key: 'street', label: 'רחוב' }, { key: 'num', label: 'מספר' }, { key: 'phone', label: 'טלפון' },
                    { key: 'mgr', label: 'מנהל הסניף' }],
        }[tab] || []) },

      { key: 'product', label: 'מוצר במלאי', icon: 'tasks',
        tabs: () => [{ key: 'main', label: 'פרטי המוצר' }, { key: 'price', label: 'מחיר ומלאי' }, { key: 'sup', label: 'ספק ורכש' }],
        groups: () => [{ key: 'main', label: 'שדות נוספים' }],
        nativeOf: tab => ({
          main: [{ key: 'name', label: 'שם המוצר' }, { key: 'sku', label: 'מק״ט' }, { key: 'barcode', label: 'ברקוד' },
                 { key: 'cat', label: 'קטגוריה' }, { key: 'unit', label: 'יחידת מידה' }, { key: 'desc', label: 'תיאור לחנות' }],
          price: [{ key: 'cost', label: 'עלות' }, { key: 'price', label: 'מחיר לצרכן' }, { key: 'vat', label: 'כולל מע״מ' },
                  { key: 'reorder', label: 'נקודת הזמנה' }, { key: 'stock', label: 'מלאי לפי סניף' }],
          sup: [{ key: 'supplier', label: 'ספק' }, { key: 'expiry', label: 'תוקף / אצווה' }],
        }[tab] || []) },

      { key: 'service', label: 'שירות בקטלוג', icon: 'layers',
        tabs: () => [{ key: 'main', label: 'פרטי השירות' }, { key: 'ops', label: 'תפעול והנחיות' }],
        groups: () => [{ key: 'main', label: 'שדות נוספים' }],
        nativeOf: tab => ({
          main: [{ key: 'label', label: 'שם' }, { key: 'kind', label: 'קטגוריה' }, { key: 'dur', label: 'אורך' },
                 { key: 'price', label: 'מחיר' }, { key: 'deposit', label: 'מקדמה' }],
          ops: [{ key: 'pre', label: 'הכנה' }, { key: 'instr', label: 'הנחיות ביצוע' }, { key: 'approval', label: 'דורש אישור' },
                { key: 'requiresBilling', label: 'דורש סליקה' }],
        }[tab] || []) },
    ];
  }
  const ent = k => ENTITIES().find(e => e.key === k) || ENTITIES()[0];

  /* ---------------- אחסון ---------------- */
  let FX = CBX.load('fx_fields', {});          /* 'entity|tab|group' -> [field] */
  let FXG = CBX.load('fx_groups', {});         /* 'entity|tab' -> [{key,label}] נוספות */
  const save = () => { CBX.store('fx_fields', FX); CBX.store('fx_groups', FXG); };
  const path = (e, t, g) => e + '|' + t + '|' + g;
  function groupsOf(e, t) {
    const base = ent(e).groups(t) || [];
    return base.concat(FXG[e + '|' + t] || []);
  }
  function fieldsOf(e, t, g) { return FX[path(e, t, g)] || []; }
  function allFieldsOf(e, t) { return groupsOf(e, t).reduce((a, g) => a.concat(fieldsOf(e, t, g.key).map(f => ({ ...f, g: g.key, gl: g.label }))), []); }
  function fxAdd(e, t, g, f) {
    const p = path(e, t, g); FX[p] = FX[p] || [];
    if (FX[p].some(x => x.label === f.label)) return { ok: false, why: 'כבר קיים שדה בשם הזה בקבוצה' };
    FX[p].push(f); save(); CBX.emit('fx:add', { entity: e, tab: t, group: g, field: f });
    return { ok: true };
  }

  /* ---------------- רינדור השדות במסך האמיתי ---------------- */
  const val = (obj, key) => ((obj && obj.fx) || {})[key];
  function fxInput(f, obj, ref) {
    const v = val(obj, f.key), id = 'fx_' + ref + '_' + f.key;
    const attr = `data-fxset="${esc(ref)}|${esc(f.key)}" id="${id}"`;
    if (f.type === 'textarea') return `<textarea class="cc-inp" rows="2" ${attr}>${esc(v || '')}</textarea>`;
    if (f.type === 'check') return `<label class="fx-chk"><input type="checkbox" ${v ? 'checked' : ''} ${attr}><span>כן</span></label>`;
    if (f.type === 'select') return `<select class="cc-inp" ${attr}><option value=""></option>` +
      (f.opts || []).map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('') + '</select>';
    const t = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'mail' ? 'email' : f.type === 'phone' ? 'tel' : 'text';
    return `<input class="cc-inp" type="${t}" value="${esc(v == null ? '' : v)}" ${attr}>`;
  }
  /* מקטע השדות הנוספים — נכנס לתחתית הלשונית הרלוונטית */
  function fxSectionHTML(e, t, obj, ref) {
    const gs = groupsOf(e, t).filter(g => fieldsOf(e, t, g.key).length);
    if (!gs.length) return '';
    return gs.map(g => `<div class="fx-sec">
      <div class="fx-sec-h">${ic('docs')} <b>${esc(g.label)}</b></div>
      <div class="fx-grid">${fieldsOf(e, t, g.key).map(f => `<label class="fx-f">
        <span>${esc(f.label)}${f.req ? ' *' : ''}</span>${fxInput(f, obj, ref)}
        ${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`).join('')}</div>
    </div>`).join('');
  }
  /* קישור השמירה — הערך נשמר על הרשומה עצמה */
  const FX_REFS = {};
  function fxBind(root) {
    (root || document).querySelectorAll('[data-fxset]').forEach(i => {
      if (i.__fxBound) return; i.__fxBound = true;
      i.addEventListener('change', () => {
        const [ref, key] = i.dataset.fxset.split('|');
        const obj = FX_REFS[ref]; if (!obj) return;
        obj.fx = obj.fx || {};
        obj.fx[key] = i.type === 'checkbox' ? i.checked : i.value;
        CBX.emit('fx:value', { ref, key, value: obj.fx[key] });
      });
    });
  }
  function fxRef(name, obj) { FX_REFS[name] = obj; return name; }

  /* ---------------- מסך ניהול השדות ---------------- */
  let fxE = 'lead', fxT = '', fxG = '', fxNewG = false;
  function curTabs() { return ent(fxE).tabs() || []; }
  function ensure() {
    const tabs = curTabs();
    if (!tabs.some(t => t.key === fxT)) fxT = (tabs[0] || {}).key || '';
    const gs = groupsOf(fxE, fxT);
    if (!gs.some(g => g.key === fxG)) fxG = (gs[0] || {}).key || '';
  }
  function fxManagerHTML() {
    ensure();
    const E = ent(fxE), tabs = curTabs(), gs = groupsOf(fxE, fxT);
    const nativeList = E.nativeOf ? (E.nativeOf(fxT, fxG) || []) : [];
    const custom = fieldsOf(fxE, fxT, fxG);
    const total = Object.keys(FX).reduce((a, k) => a + FX[k].length, 0);
    return `<div class="fx-wrap">
      <p class="inv-lead">כאן מנהלים את השדות של <b>כל</b> המערכת, לא רק של הפנייה.
        בוחרים ישות, לשונית וקבוצת שדות — והשדה החדש מופיע מיד במסך האמיתי של אותה ישות.</p>
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${ENTITIES().length}</b><small>ישויות</small></div>
        <div class="inv-kpi"><b>${total}</b><small>שדות שהוספתם</small></div>
        <div class="inv-kpi"><b>${nativeList.length + custom.length}</b><small>שדות בקבוצה הנוכחית</small></div>
      </div>

      <div class="fx-step"><span class="fx-n">1</span><b>לאיזו ישות?</b></div>
      <div class="fx-chips">${ENTITIES().map(e => `<button class="fx-chip ${fxE === e.key ? 'on' : ''}" data-fxe="${e.key}">
        ${ic(e.icon)} ${esc(e.label)}</button>`).join('')}</div>

      <div class="fx-step"><span class="fx-n">2</span><b>לאיזו לשונית?</b></div>
      <div class="fx-chips">${tabs.map(t => `<button class="fx-chip ${fxT === t.key ? 'on' : ''}" data-fxt="${esc(t.key)}">${esc(t.label)}</button>`).join('')
        || '<span class="muted">לישות זו אין לשוניות</span>'}</div>

      <div class="fx-step"><span class="fx-n">3</span><b>לאיזו קבוצת שדות?</b></div>
      <div class="fx-chips">${gs.map(g => `<button class="fx-chip ${fxG === g.key ? 'on' : ''}" data-fxg="${esc(g.key)}">${esc(g.label)}</button>`).join('')}
        <button class="fx-chip add" id="fxNewGroup">${ic('plus')} קבוצה חדשה</button></div>
      ${fxNewG ? `<div class="fx-newg">
        <input class="cc-inp sm" id="fxGName" placeholder="שם קבוצת השדות (למשל: מידע רגולטורי)">
        <button class="btn sm primary" id="fxGOk">${ic('check')} צור</button>
        <button class="btn sm" id="fxGCancel">ביטול</button></div>` : ''}

      <div class="fx-cur">
        <div class="fx-cur-h">${ic('docs')} <b>${esc(E.label)} › ${esc((tabs.find(t => t.key === fxT) || {}).label || '')} › ${esc((gs.find(g => g.key === fxG) || {}).label || '')}</b></div>
        <div class="fx-list">
          ${nativeList.map(f => `<div class="fx-row sys"><span class="fx-lbl">${esc(f.label)}</span>
            <span class="fx-tag">שדה מערכת</span></div>`).join('')}
          ${custom.map((f, i) => `<div class="fx-row"><span class="fx-lbl">${esc(f.label)}${f.req ? ' *' : ''}</span>
            <span class="fx-tag mine">${esc((TYPES.find(t => t.key === f.type) || {}).label || f.type)}</span>
            <button class="btn xs" data-fxdel="${i}">${ic('close')}</button></div>`).join('')}
          ${!nativeList.length && !custom.length ? '<p class="fx-none">אין עדיין שדות בקבוצה הזו</p>' : ''}
        </div>
      </div>

      <div class="fx-add">
        <div class="fx-add-h">${ic('plus')} <b>שדה חדש בקבוצה הזו</b></div>
        <div class="inv-f2">
          <label class="inv-f"><span>שם השדה *</span><input class="cc-inp" id="fxLabel" placeholder="למשל: מספר סידורי"></label>
          <label class="inv-f"><span>סוג</span><select class="cc-inp" id="fxType">${TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}</select></label>
          <label class="inv-f" id="fxOptsWrap" hidden><span>אפשרויות (מופרדות בפסיק)</span><input class="cc-inp" id="fxOpts" placeholder="קטן, בינוני, גדול"></label>
          <label class="inv-f"><span>הסבר קצר</span><input class="cc-inp" id="fxHint" placeholder="לא חובה"></label>
        </div>
        <label class="inv-chk"><input type="checkbox" id="fxReq">
          <span><b>שדה חובה</b><small>לא יהיה אפשר לשמור את הרשומה בלי למלא אותו.</small></span></label>
        <button class="btn sm primary" id="fxAdd">${ic('check')} הוסף שדה</button>
      </div>
      <p class="cr-hint">${ic('bolt')} שדה שנוסף מופיע מיד במסך של אותה ישות — בתיק העובד, בהגדרות הסניף,
        בכרטיס המוצר או בכרטיס השירות — בדיוק בלשונית ובקבוצה שנבחרו כאן.</p>`;
  }
  function fxManagerBind(RR) {
    $$('[data-fxe]').forEach(b => b.addEventListener('click', () => { fxE = b.dataset.fxe; fxT = ''; fxG = ''; RR(); }));
    $$('[data-fxt]').forEach(b => b.addEventListener('click', () => { fxT = b.dataset.fxt; fxG = ''; RR(); }));
    $$('[data-fxg]').forEach(b => b.addEventListener('click', () => { fxG = b.dataset.fxg; RR(); }));
    $$('[data-fxdel]').forEach(b => b.addEventListener('click', () => {
      FX[path(fxE, fxT, fxG)].splice(+b.dataset.fxdel, 1); save(); RR(); toast('השדה הוסר'); }));
    /* קבוצה חדשה — שדה מוטמע, בלי prompt (חסום בחלק מהסביבות ורע כחוויה) */
    const ng = $('#fxNewGroup'); if (ng) ng.addEventListener('click', () => { fxNewG = !fxNewG; RR(); });
    const ok = $('#fxGOk'); if (ok) ok.addEventListener('click', () => {
      const name = ($('#fxGName').value || '').trim();
      if (!name) { toast('נא להזין שם לקבוצה'); return; }
      const k = 'g' + (Object.keys(FXG).length + 1) + '_' + name.replace(/\s+/g, '_');
      FXG[fxE + '|' + fxT] = (FXG[fxE + '|' + fxT] || []).concat([{ key: k, label: name }]);
      fxG = k; fxNewG = false; save(); RR(); toast('הקבוצה נוספה ✓'); });
    const cx = $('#fxGCancel'); if (cx) cx.addEventListener('click', () => { fxNewG = false; RR(); });
    const ty = $('#fxType'), ow = $('#fxOptsWrap');
    if (ty && ow) { const upd = () => { ow.hidden = ty.value !== 'select'; }; upd(); ty.addEventListener('change', upd); }
    const ad = $('#fxAdd'); if (ad) ad.addEventListener('click', () => {
      const label = ($('#fxLabel').value || '').trim();
      if (!label) { toast('נא למלא שם שדה'); return; }
      const type = $('#fxType').value;
      const f = { key: 'fx' + Math.abs(label.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 100000),
        label, type, req: $('#fxReq').checked, hint: ($('#fxHint').value || '').trim() };
      if (type === 'select') f.opts = ($('#fxOpts').value || '').split(',').map(x => x.trim()).filter(Boolean);
      const r = fxAdd(fxE, fxT, fxG, f);
      if (!r.ok) { toast(r.why); return; }
      RR(); toast('השדה נוסף ל' + ent(fxE).label + ' ✓');
    });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'fields', label: 'ניהול שדות של כל המערכת', icon: 'docs',
    desc: 'הוספת שדות לכל ישות — תיק עובד, סניף, מוצר, שירות ופנייה — עם בחירת לשונית וקבוצת שדות. השדה מופיע מיד במסך האמיתי.',
    files: ['js/ext/fields.js'],
    install() {
      /* מקטע נוסף בתוך "שדות פנייה" שבהגדרות המנהל */
      if (typeof fieldsManagerHTML === 'function') CBX.wrap('fields', 'fieldsManagerHTML', o => function () {
        /* קודם הליבה — היא מאתחלת את מפת השדות שגם אנחנו קוראים ממנה */
        const base = o.apply(this, arguments);
        return '<section class="card set-card wide fx-card">' +
          '<div class="card-head"><div class="title">' + ic('layers') + ' ניהול שדות — כל המערכת</div></div>' +
          '<div class="set-body">' + fxManagerHTML() + '</div></section>' + base;
      });
      if (typeof bindFieldsManager === 'function') CBX.wrap('fields', 'bindFieldsManager', o => function () {
        const r = o.apply(this, arguments);
        fxManagerBind(() => { if (typeof permsMode !== 'undefined' && permsMode) renderPermissionsView(); else renderFieldsManagerView(); });
        return r;
      });

      /* ---- הזרקה למסכים האמיתיים ---- */
      /* תיק עובד */
      if (typeof hrTabHTML === 'function') CBX.wrap('fields', 'hrTabHTML', o => function (tab, emp, h) {
        const base = o.apply(this, arguments);
        const ref = fxRef('staff:' + (emp && emp.id), emp);
        return base + fxSectionHTML('staff', tab, emp, ref);
      });
      if (typeof hrPanelHTML === 'function') CBX.wrap('fields', 'hrPanelHTML', o => function () {
        const r = o.apply(this, arguments); setTimeout(() => fxBind(), 0); return r;
      });
      /* סניף */
      if (typeof brRenderPanel === 'function') CBX.wrap('fields', 'brRenderPanel', o => function () {
        const r = o.apply(this, arguments);
        const host = document.getElementById('brContent');
        if (host && typeof brOf === 'function' && typeof brWinKey !== 'undefined') {
          const b = brOf(brWinKey);
          const html = fxSectionHTML('branch', brActive, b, fxRef('branch:' + brWinKey, b));
          if (html) { const d = document.createElement('div'); d.innerHTML = html; host.appendChild(d); fxBind(host); }
        }
        return r;
      });
      /* שירות בקטלוג */
      if (typeof openCatalogItemEditor === 'function') CBX.wrap('fields', 'openCatalogItemEditor', o => function (key) {
        const r = o.apply(this, arguments);
        setTimeout(() => {
          const t = (typeof cTreat === 'function') ? cTreat(key) : null; if (!t) return;
          const body = document.querySelector('#modal .modal-body') || document.querySelector('#modal');
          if (!body || body.querySelector('.fx-sec')) return;
          const ref = fxRef('service:' + key, t);
          const html = fxSectionHTML('service', 'main', t, ref) + fxSectionHTML('service', 'ops', t, ref);
          if (html) { const d = document.createElement('div'); d.innerHTML = html; body.appendChild(d); fxBind(body); }
        }, 0);
        return r;
      });
      /* מוצר במלאי — דרך אירוע, כי העורך יושב בהרחבת המלאי */
      CBX.on('fields', 'inv:editor', ev => {
        const ref = fxRef('product:' + ev.item.sku, ev.item);
        const html = fxSectionHTML('product', 'main', ev.item, ref)
          + fxSectionHTML('product', 'price', ev.item, ref) + fxSectionHTML('product', 'sup', ev.item, ref);
        if (html && ev.host) { const d = document.createElement('div'); d.innerHTML = html; ev.host.appendChild(d); fxBind(ev.host); }
      });
      /* שדות בחיפוש */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('fields', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        Object.keys(FX).forEach(p => { const [e, t, g] = p.split('|');
          FX[p].forEach(f => { if (f.label.toLowerCase().includes(q))
            res.push({ type: 'שדה', label: f.label, goto: 'fields',
              sub: ent(e).label + ' › ' + ((ent(e).tabs() || []).find(x => x.key === t) || {}).label }); }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('fields', 'gotoEntity', o => function (where, id) {
        if (where === 'fields') { navActive = 'settings'; if (typeof applySetMode === 'function') applySetMode('perms');
          if (typeof mgrSec !== 'undefined') mgrSec = 'fields'; renderSettingsView(); return; }
        return o.call(this, where, id);
      });
    },
  });

  window.FX = { add: fxAdd, all: allFieldsOf, section: fxSectionHTML, bind: fxBind, ref: fxRef,
    entities: ENTITIES, groups: groupsOf, store: () => FX };
})();
