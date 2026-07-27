/* ============================================================
   הרחבה: היקף אחריות של עובד  ·  key = 'scope'
   ------------------------------------------------------------
   "תחומי אחריות" ערבב שלושה צירים שונים באותה שורה: אזורים
   גיאוגרפיים, נושאי טיפול ופלחי לקוחות. הם לא מאותו סוג ולכן
   לא יכולים להיבחר יחד.
   כאן הם מופרדים לשלושה צירים — ומה שנבחר קובע בפועל מה העובד
   רואה במסך הלידים. עובד שמוגדר רק על מכירות לא יראה פניות
   שסווגו כשירות.
   העריכה נעשית במסך המנהל; לעובד ללא הרשאת עריכה זו תצוגה בלבד.
   ============================================================ */
(function () {

  /* ---------------- שלושת הצירים ---------------- */
  function AXES() {
    return [
      { key: 'journeys', label: 'מסלולי טיפול', icon: 'layers',
        desc: 'אילו סוגי פניות העובד מטפל בהם. מה שלא נבחר — לא יופיע לו במסך הלידים.',
        opts: () => Object.keys(typeof JOURNEY_TYPES !== 'undefined' ? JOURNEY_TYPES : {})
          .map(k => ({ key: k, label: JOURNEY_TYPES[k].label })) },
      { key: 'segments', label: 'פלחי לקוחות', icon: 'clients',
        desc: 'קהלים שהעובד אחראי עליהם. משמש לניתוב ולסינון, לא לחסימה.',
        opts: () => ['לידים חדשים', 'לקוחות VIP', 'לקוחות קיימים', 'לקוחות עסקיים'].map(x => ({ key: x, label: x })) },
      { key: 'zones', label: 'אזורים גיאוגרפיים', icon: 'target',
        desc: 'אזורי פעילות. כשהרחבת השטח פעילה — אלה אותם אזורים.',
        opts: () => (window.TERR && CBX.isOn('terr'))
          ? window.TERR.zones().map(z => ({ key: z.key, label: z.label }))
          : ['אזור צפון', 'אזור מרכז', 'אזור דרום'].map(x => ({ key: x, label: x })) },
    ];
  }
  const axis = k => AXES().find(a => a.key === k);

  let SCOPE = CBX.load('scope_map', {});   /* empId -> { journeys:[], segments:[], zones:[] } */
  const save = () => CBX.store('scope_map', SCOPE);

  /* המרה חד-פעמית מהשדה הישן, כדי שלא יתחיל ריק */
  const LEGACY = { 'חידושים': ['renewal'], 'תלונות': ['support'], 'גבייה': ['billing'],
    'שימור': ['retention'], 'התקנות': ['installation'], 'הדרכות': ['training'] };
  function scopeOf(emp) {
    if (!emp) return { journeys: [], segments: [], zones: [] };
    let s = SCOPE[emp.id];
    if (!s) {
      s = { journeys: [], segments: [], zones: [] };
      (emp.resp || []).concat(emp.occ || []).forEach(x => {
        if (LEGACY[x]) LEGACY[x].forEach(j => { if (s.journeys.indexOf(j) < 0) s.journeys.push(j); });
        else if (/אזור/.test(x)) s.zones.push(x);
        else if (/לידים|VIP|לקוח/.test(x)) s.segments.push(x);
      });
      SCOPE[emp.id] = s; save();
    }
    return s;
  }
  const empBy = name => (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === name) : null;
  const canEdit = emp => {
    const me = empBy(typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '');
    if (!me) return true;
    if (typeof effectivePerm === 'function') return effectivePerm(me, 'ניהול הרשאות') || effectivePerm(me, 'עריכה') && /מנהל/.test(me.perm || '');
    return /מנהל/.test(me.perm || '');
  };

  /* ---------------- הסינון בפועל ---------------- */
  const CFG_DEF = { enforce: true };
  let CFG = Object.assign({}, CFG_DEF, CBX.load('scope_cfg', {}));
  const saveCfg = () => CBX.store('scope_cfg', CFG);
  /* מנהל רואה הכל. עובד רואה רק את מסלולי הטיפול שהוגדרו לו. */
  function visibleTo(emp, r) {
    if (!CFG.enforce || !emp) return true;
    if (/מנהל/.test(emp.perm || '')) return true;
    const s = scopeOf(emp);
    if (!s.journeys.length) return true;          /* לא הוגדר — רואה הכל */
    return s.journeys.indexOf(r.journey) >= 0;
  }
  function hiddenCount(emp, list) { return list.filter(r => !visibleTo(emp, r)).length; }

  /* ---------------- ממשק ---------------- */
  function scopeHTML(emp) {
    const s = scopeOf(emp), edit = canEdit(emp);
    const recs = (typeof RECORDS !== 'undefined') ? RECORDS.filter(r => !r.mergedInto) : [];
    const hid = hiddenCount(emp, recs);
    return `<section class="card emp-profile sc-card">
      <div class="card-head"><div class="title">${ic('lock')} היקף אחריות · ${esc(emp.name)}</div>
        ${edit ? '' : `<span class="sc-ro">${ic('eye')} תצוגה בלבד</span>`}</div>
      <div class="set-body">
        <p class="inv-lead">שלושה צירים נפרדים. <b>מסלולי הטיפול</b> הם היחידים שמסננים בפועל —
          מה שלא נבחר לא יופיע לעובד במסך הלידים.</p>
        ${AXES().map(a => `<div class="sc-axis">
          <div class="sc-a-h">${ic(a.icon)} <b>${a.label}</b>
            ${a.key === 'journeys' ? '<span class="sc-tag">מסנן בפועל</span>' : ''}
            <small>${a.desc}</small></div>
          <div class="sc-chips">${a.opts().map(o => `<button class="fx-chip ${(s[a.key] || []).indexOf(o.key) >= 0 ? 'on' : ''}"
            data-sc="${esc(String(emp.id))}|${a.key}|${esc(o.key)}" ${edit ? '' : 'disabled'}>${esc(o.label)}</button>`).join('')}
            ${!(s[a.key] || []).length ? '<span class="sc-all">לא נבחר — ללא הגבלה</span>' : ''}</div>
        </div>`).join('')}
        <div class="sc-effect ${hid ? 'on' : ''}">${ic(hid ? 'lock' : 'eye')}
          <b>${hid ? esc(emp.name) + ' לא רואה ' + (hid === 1 ? 'פנייה אחת' : hid + ' פניות')
            : esc(emp.name) + ' רואה את כל הפניות'}</b>
          <small>${(s.journeys || []).length
            ? 'מוגדר על: ' + s.journeys.map(j => (JOURNEY_TYPES[j] || {}).label || j).join(' · ')
            : 'לא הוגדרו מסלולי טיפול — אין הגבלה'}</small></div>
        ${edit ? `<label class="sc-enf"><input type="checkbox" id="scEnf" ${CFG.enforce ? 'checked' : ''}>
          <span><b>לאכוף את ההיקף במסכים</b><small>כשכבוי — ההגדרה נשמרת אבל כולם רואים הכל. שימושי בהרצה.</small></span></label>` : ''}
      </div></section>`;
  }
  function scopeBind(RR) {
    $$('[data-sc]').forEach(b => b.addEventListener('click', () => {
      const [id, ax, val] = b.dataset.sc.split('|');
      const s = SCOPE[id] = SCOPE[id] || { journeys: [], segments: [], zones: [] };
      s[ax] = s[ax] || []; const i = s[ax].indexOf(val);
      if (i >= 0) s[ax].splice(i, 1); else s[ax].push(val);
      save(); RR();
      if (window.AUDIT && CBX.isOn('audit')) window.AUDIT.rec('lead', 'שינוי היקף אחריות', id + ' · ' + ax); }));
    const e = $('#scEnf'); if (e) e.addEventListener('change', () => { CFG.enforce = e.checked; saveCfg(); RR(); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'scope', label: 'היקף אחריות של עובד', icon: 'lock',
    desc: 'מפריד את "תחומי האחריות" לשלושה צירים — מסלולי טיפול, פלחי לקוחות ואזורים — ומסנן בפועל את מסך הלידים לפי מסלולי הטיפול שהוגדרו לעובד.',
    files: ['js/ext/scope.js'],
    install() {
      /* מחליף את שורת "תחומי אחריות" המעורבת */
      /* מחליפים את השורה המעורבת כבר ברמת ה-HTML — כך אין הבהוב
         ואין תלות בתזמון הרינדור */
      if (typeof empDetailsCard === 'function') CBX.wrap('scope', 'empDetailsCard', o => function (emp) {
        let html = o.apply(this, arguments);
        try {
          html = html.replace(/<div class="tag-group"><span class="tag-lbl">תחומי אחריות<\/span>[\s\S]*?<\/div><\/div>/, '');
          html += scopeHTML(emp);
        } catch (e) { console.error('[scope]', e); }
        return html;
      });
      const rebind = () => { try { scopeBind(() => {
        if (typeof renderStaffFileView === 'function') renderStaffFileView();
        else if (typeof renderSettingsView === 'function') renderSettingsView(); }); } catch (e) {} };
      /* תיק העובד המלא בונה את המסך בעצמו — מוסיפים גם שם */
      if (typeof renderStaffFileView === 'function') CBX.wrap('scope', 'renderStaffFileView', o => function () {
        const r = o.apply(this, arguments);
        try {
          const emp = (typeof STAFF !== 'undefined' && typeof mgrEmpOpen !== 'undefined')
            ? STAFF.find(x => String(x.id) === String(mgrEmpOpen)) : null;
          const host = document.getElementById('viewHost');
          if (emp && host && !host.querySelector('.sc-card')) {
            const d = document.createElement('div'); d.innerHTML = scopeHTML(emp);
            host.appendChild(d.firstElementChild);
          }
        } catch (e) { console.error('[scope] file', e); }
        rebind(); return r; });
      if (typeof renderSettingsView === 'function') CBX.wrap('scope', 'renderSettingsView', o => function () {
        const r = o.apply(this, arguments); if (document.querySelector('.sc-card')) rebind(); return r; });
      /* הסינון בפועל במסך הלידים */
      if (typeof filteredRecords === 'function') CBX.wrap('scope', 'filteredRecords', o => function () {
        const rows = o.apply(this, arguments);
        try {
          const me = empBy(typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '');
          if (!me) return rows;
          return rows.filter(r => visibleTo(me, r));
        } catch (e) { return rows; }
      });
      /* חיווי כמה הוסתר — כדי שלא ייראה כאילו נעלמו רשומות */
      if (typeof renderList === 'function') CBX.wrap('scope', 'renderList', o => function () {
        const r = o.apply(this, arguments);
        try {
          const me = empBy(typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '');
          const cnt = document.getElementById('listCount');
          if (!me || !cnt || !CFG.enforce || /מנהל/.test(me.perm || '')) return r;
          const s = scopeOf(me); if (!s.journeys.length) return r;
          const all = (typeof RECORDS !== 'undefined') ? RECORDS.filter(x => !x.mergedInto) : [];
          const hid = hiddenCount(me, all);
          if (hid) cnt.textContent += ' · ' + hid + ' מחוץ להיקף שלי';
        } catch (e) {}
        return r;
      });
    },
  });

  window.SCOPE = { of: scopeOf, visible: visibleTo, axes: AXES, cfg: () => CFG, map: () => SCOPE };
})();
