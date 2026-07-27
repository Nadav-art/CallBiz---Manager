/* ============================================================
   הרחבה: יומן ביקורת  ·  key = 'audit'
   ------------------------------------------------------------
   כשיש הרשאות, מסמכים חתומים וכסף — חייבים לדעת מי שינה מה
   ומתי. ההרחבה עוטפת את נקודות השינוי המהותיות במערכת ורושמת
   כל פעולה. אין שינוי בהתנהגות — רק תיעוד.
   ============================================================ */
(function () {

  let LOG = CBX.load('audit_log', []);
  const save = () => CBX.store('audit_log', LOG.slice(0, 500));
  let auditMode = false, auditQ = '', auditArea = 'all';

  const AREAS = [
    { key: 'all', label: 'הכל' }, { key: 'auto', label: 'אוטומציות' },
    { key: 'inv', label: 'מלאי' }, { key: 'bill', label: 'גבייה' },
    { key: 'crit', label: 'קריטריונים' }, { key: 'ct', label: 'חוזים' },
    { key: 'lead', label: 'לידים' }, { key: 'ext', label: 'הרחבות' },
  ];

  function who() { return (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : 'משתמש'; }
  function when() { return (typeof autoStamp === 'function') ? autoStamp() : ''; }
  function rec(area, what, detail) {
    LOG.unshift({ t: when(), who: who(), area, what, detail: detail || '' });
    if (LOG.length > 500) LOG.length = 500;
    save();
  }
  /* עוטף פונקציה ורושם קריאה אליה. fmt מקבל את הארגומנטים ומחזיר תיאור. */
  function track(name, area, what, fmt) {
    if (typeof window[name] !== 'function') return;
    CBX.wrap('audit', name, orig => function () {
      const r = orig.apply(this, arguments);
      try { rec(area, what, fmt ? fmt.apply(null, arguments) : ''); } catch (e) {}
      return r;
    });
  }

  /* ---------------- מסך היומן ---------------- */
  function auditHTML() {
    const q = auditQ.toLowerCase();
    const list = LOG.filter(l => (auditArea === 'all' || l.area === auditArea)
      && (!q || (l.what + ' ' + l.detail + ' ' + l.who).toLowerCase().includes(q)));
    const byUser = {};
    LOG.forEach(l => { byUser[l.who] = (byUser[l.who] || 0) + 1; });
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${LOG.length}</b><small>פעולות מתועדות</small></div>
        <div class="inv-kpi"><b>${Object.keys(byUser).length}</b><small>משתמשים פעילים</small></div>
        <div class="inv-kpi"><b>${LOG.filter(l => l.area === 'bill').length}</b><small>פעולות בגבייה</small></div>
        <div class="inv-kpi"><b>${LOG.filter(l => l.area === 'inv').length}</b><small>פעולות במלאי</small></div>
      </div>
      <p class="inv-lead">כל שינוי מהותי במערכת נרשם כאן — מי ביצע, מה שונה ומתי.
        התיעוד לקריאה בלבד ואי אפשר לערוך אותו מהממשק.</p>
      <div class="inv-bar">
        <input class="cc-inp sm" id="adQ" placeholder="חיפוש ביומן…" value="${esc(auditQ)}">
        <span class="ap-filters">${AREAS.map(a => `<button class="ap-f ${auditArea === a.key ? 'on' : ''}" data-adarea="${a.key}">${a.label}</button>`).join('')}</span>
      </div>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>מתי</th><th>מי</th><th>תחום</th><th>פעולה</th><th>פרטים</th></tr></thead>
        <tbody>${list.slice(0, 120).map(l => `<tr>
          <td><small>${esc(l.t)}</small></td><td>${esc(l.who)}</td>
          <td><span class="ad-area">${esc((AREAS.find(a => a.key === l.area) || {}).label || l.area)}</span></td>
          <td>${esc(l.what)}</td><td><small>${esc(l.detail)}</small></td>
        </tr>`).join('') || `<tr><td colspan="5" class="inv-empty">אין רשומות תואמות</td></tr>`}
        </tbody></table></div>
      ${list.length > 120 ? `<p class="cr-hint">${ic('alert')} מוצגות 120 הרשומות האחרונות מתוך ${list.length}.</p>` : ''}`;
  }
  function auditBind(RR) {
    const q = $('#adQ'); if (q) q.addEventListener('input', () => { auditQ = q.value; RR();
      const n = $('#adQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    $$('[data-adarea]').forEach(b => b.addEventListener('click', () => { auditArea = b.dataset.adarea; RR(); }));
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'audit', label: 'יומן ביקורת', icon: 'history',
    desc: 'תיעוד של כל שינוי מהותי — מי, מה ומתי. לקריאה בלבד. חובה כשיש הרשאות, מסמכים חתומים וכסף.',
    files: ['js/ext/audit.js'],
    install() {
      /* מסך משלו */
      if (typeof SET_GROUPS !== 'undefined') CBX.push('audit', SET_GROUPS, [{
        key: 'audit', label: 'יומן ביקורת', icon: 'history', desc: 'מי שינה מה ומתי',
        items: [{ m: 'audit', label: 'יומן ביקורת', icon: 'history', desc: 'תיעוד מלא של פעולות במערכת' }] }]);
      CBX.wrap('audit', 'applySetMode', o => function (m) { auditMode = m === 'audit'; return o.apply(this, arguments); });
      CBX.wrap('audit', 'currentSetModeKey', o => function () { return auditMode ? 'audit' : o.apply(this, arguments); });
      CBX.wrap('audit', 'renderSettingsView', o => function () {
        if (!auditMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + auditHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        auditBind(() => renderSettingsView());
      });

      /* ---- נקודות השינוי שמתועדות ---- */
      track('autoSet', 'auto', 'שינוי מצב אוטומציה',
        (k, on) => { const d = (typeof autoDef === 'function') ? autoDef(k) : null; return (d ? d.title : k) + ' → ' + (on ? 'פעילה' : 'כבויה'); });
      track('autoMetaSet', 'auto', 'שינוי הגדרות אוטומציה',
        (k, p) => { const d = (typeof autoDef === 'function') ? autoDef(k) : null; return (d ? d.title : k) + ': ' + Object.keys(p || {}).join(', '); });
      track('autoCondSet', 'auto', 'שינוי תנאים', k => { const d = (typeof autoDef === 'function') ? autoDef(k) : null; return d ? d.title : k; });
      track('needsCfgSet', 'crit', 'שינוי הגדרת קריטריון', k => String(k));
      track('needsAddCustom', 'crit', 'הוספת קריטריון', l => String(l));
      track('needsDeleteCustom', 'crit', 'מחיקת קריטריון', k => String(k));
      track('ctSvcTermsSave', 'ct', 'עדכון תנאים קבועים בהסכם');
      track('ctTermOvSet', 'ct', 'שינוי סעיף בהסכם', k => String(k));
      track('routeSet', 'lead', 'שינוי חלוקת לידים', p => Object.keys(p || {}).map(k => k + '=' + p[k]).join(', '));

      /* אירועים מהרחבות אחרות */
      CBX.on('audit', 'inv:move', d => rec('inv', 'תנועת מלאי', d.sku + ' · ' + (d.delta > 0 ? '+' : '') + d.delta + ' · יתרה ' + d.after));
      CBX.on('audit', 'shop:order', o => rec('lead', 'הזמנה מהחנות', o.no + ' · ' + o.name + ' · ' + CBX.money(o.totals.total)));
      CBX.on('audit', 'bill:doc', d => rec('bill', 'הפקת מסמך', d.no + ' · ' + d.cust + ' · ' + CBX.money(d.total)));
      CBX.on('audit', 'bill:pay', p => rec('bill', 'רישום תשלום', p.doc.no + ' · ' + CBX.money(p.sum)));

      /* הדלקה/כיבוי של הרחבות — גם זה שינוי מהותי */
      CBX.wrap('audit', 'openExtPanel', o => function () { rec('ext', 'פתיחת ניהול הרחבות'); return o.apply(this, arguments); });
      const origSetOn = CBX.setOn;
      CBX.setOn = function (key, on) { const m = CBX.def(key);
        if (key !== 'audit') { try { rec('ext', 'שינוי הרחבה', (m ? m.label : key) + ' → ' + (on ? 'פעילה' : 'כבויה')); } catch (e) {} }
        return origSetOn.apply(this, arguments); };
      CBX._remember('audit', () => { CBX.setOn = origSetOn; auditMode = false; });

      rec('ext', 'יומן הביקורת הופעל');
    },
  });

  window.AUDIT = { log: () => LOG, rec };
})();
