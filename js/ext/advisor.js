/* ============================================================
   הרחבה: בדיקה עצמית ויועץ אוטומציות  ·  key = 'adv'
   ------------------------------------------------------------
   המערכת בודקת את עצמה בזמנים קבועים ושואלת:
     • יש אוטומציה כבויה שהייתה מונעת בעיה שקרתה בפועל?
     • יש אוטומציה דלוקה שלא רצה אף פעם — כי התנאים חונקים אותה?
     • יש תהליך שאין עליו שום כיסוי?
   כל ממצא נשען על נתונים אמיתיים מהמערכת, לא על הנחות, ומגיע
   עם פעולה אחת שסוגרת אותו.
   ============================================================ */
(function () {

  const CFG_DEF = { on: true, every: 'tick', keepDays: 30, autoApplyNever: true };
  let CFG = Object.assign({}, CFG_DEF, CBX.load('adv_cfg', {}));
  let LOG = CBX.load('adv_log', []);
  let MUTED = CBX.load('adv_muted', {});
  const saveCfg = () => CBX.store('adv_cfg', CFG);
  const saveLog = () => CBX.store('adv_log', LOG.slice(0, 60));
  const saveMuted = () => CBX.store('adv_muted', MUTED);

  const isOn = k => typeof autoIsOn === 'function' && autoIsOn(k);
  const exists = k => typeof autoDef === 'function' && !!autoDef(k);
  const title = k => { const d = (typeof autoDef === 'function') ? autoDef(k) : null; return d ? d.title : k; };
  const runsOf = k => (typeof autoStat === 'function') ? (autoStat(k).runs || 0) : 0;
  const blockedOf = k => (typeof autoStat === 'function') ? (autoStat(k).blocked || 0) : 0;
  const R = () => (typeof RECORDS !== 'undefined') ? RECORDS.filter(r => !r.mergedInto) : [];

  /* ---------------- הבדיקות ----------------
     כל בדיקה מחזירה ממצא רק אם יש ראיה מספרית. */
  const CHECKS = [
    /* 1) בעיה שקרתה בפועל, ויש אוטומציה כבויה שנועדה בדיוק לזה */
    { key: 'overdue_no_escalation', area: 'לידים',
      run: () => {
        if (!exists('a8') || isOn('a8')) return null;
        const late = R().filter(r => !r.done && typeof recIsOverdue === 'function' && recIsOverdue(r));
        if (late.length < 2) return null;
        return { level: 'high', label: 'לידים נתקעים ואף אחד לא יודע',
          why: 'יש כרגע ' + late.length + ' לידים באיחור, והחוק "' + title('a8') + '" כבוי.',
          gain: 'הפעלה תשלח התראה למנהל על כל ליד שנתקע — בלי להעביר אותו לטיפולו.',
          act: { type: 'on', key: 'a8' } };
      } },
    { key: 'leads_no_followup', area: 'לידים',
      run: () => {
        if (!exists('a1c') || isOn('a1c')) return null;
        const noNext = R().filter(r => !r.done && !(r.next && r.next.at));
        if (!noNext.length) return null;
        return { level: 'high', label: 'פניות בלי מועד ליצירת קשר',
          why: (noNext.length === 1 ? 'פנייה אחת פתוחה' : noNext.length + ' פניות פתוחות') + ' בלי מועד לחזרה, והחוק "' + title('a1c') + '" כבוי.',
          gain: 'כל פנייה חדשה תקבל מועד אוטומטית לפי היומן — שום פנייה לא תישכח.',
          act: { type: 'on', key: 'a1c' } };
      } },
    { key: 'unassigned', area: 'לידים',
      run: () => {
        if (!exists('a1b') || isOn('a1b')) return null;
        const none = R().filter(r => !r.done && !r.assignee);
        if (!none.length) return null;
        return { level: 'med', label: 'פניות ללא נציג מטפל',
          why: (none.length === 1 ? 'פנייה אחת' : none.length + ' פניות') + ' ללא שיוך, והחוק "' + title('a1b') + '" כבוי.',
          gain: 'שיוך אוטומטי לפי השיטה שהוגדרה — עומס, מיומנות או סניף.',
          act: { type: 'on', key: 'a1b' } };
      } },
    /* 2) הרחבות פעילות שהאוטומציה שלהן כבויה */
    { key: 'stock_low_alert', area: 'מלאי',
      run: () => {
        if (!window.INV || !CBX.isOn('inv') || !exists('x_inv_low') || isOn('x_inv_low')) return null;
        const low = window.INV.low(); if (!low.length) return null;
        return { level: 'high', label: 'חוסרים במלאי בלי התראה',
          why: low.length + ' פריטים מתחת לנקודת ההזמנה, והחוק "' + title('x_inv_low') + '" כבוי.',
          gain: 'התראה לפני שחומר נגמר באמצע יום עבודה.',
          act: { type: 'on', key: 'x_inv_low' } };
      } },
    { key: 'dunning_off', area: 'גבייה',
      run: () => {
        if (!window.BILL || !CBX.isOn('bill') || !exists('x_dunning') || isOn('x_dunning')) return null;
        const late = window.BILL.docs().filter(d => !d.void && window.BILL.status(d) === 'overdue');
        if (!late.length) return null;
        const sum = late.reduce((a, d) => a + window.BILL.balance(d), 0);
        return { level: 'high', label: 'חוב בפיגור בלי מסלול גבייה',
          why: (late.length === 1 ? 'מסמך אחד' : late.length + ' מסמכים') + ' בפיגור בסך ' + CBX.money(sum) + ', והחוק "' + title('x_dunning') + '" כבוי.',
          gain: 'מסלול מדורג — תזכורת, התראה, הקפאה — במקום שהחוב יישכח.',
          act: { type: 'on', key: 'x_dunning' } };
      } },
    { key: 'sla_off', area: 'שירות',
      run: () => {
        if (!window.TKT || !CBX.isOn('tkt') || !exists('x_sla_breach') || isOn('x_sla_breach')) return null;
        const b = window.TKT.breached(); if (!b.length) return null;
        return { level: 'high', label: 'חריגות SLA בלי התראה',
          why: (b.length === 1 ? 'כרטיס אחד חרג' : b.length + ' כרטיסים חרגו') + ' מהזמן שהובטח, והחוק "' + title('x_sla_breach') + '" כבוי.',
          gain: 'התראה למנהל השירות ברגע שכרטיס חורג.',
          act: { type: 'on', key: 'x_sla_breach' } };
      } },
    { key: 'terr_route_off', area: 'שטח',
      run: () => {
        if (!window.TERR || !CBX.isOn('terr') || !exists('x_terr_rec') || isOn('x_terr_rec')) return null;
        const recs = window.TERR.recommendations(); if (recs.length < 2) return null;
        return { level: 'med', label: 'המלצות ניתוב שטח לא רצות',
          why: 'מנוע ההמלצות מזהה ' + recs.length + ' דברים לטפל בהם, והחוק "' + title('x_terr_rec') + '" כבוי.',
          gain: 'המלצות ריכוז והזזה יגיעו לבד במקום לחכות שמישהו ייכנס למסך.',
          act: { type: 'on', key: 'x_terr_rec' } };
      } },
    { key: 'shop_order_off', area: 'חנות',
      run: () => {
        if (!window.SHOPX || !CBX.isOn('shop') || !exists('x_shop_order') || isOn('x_shop_order')) return null;
        const nw = window.SHOPX.orders().filter(o => o.status === 'new'); if (!nw.length) return null;
        return { level: 'med', label: 'הזמנות מהאתר ממתינות',
          why: (nw.length === 1 ? 'הזמנה אחת' : nw.length + ' הזמנות') + ' לא טופלו, והחוק "' + title('x_shop_order') + '" כבוי.',
          gain: 'אישור ללקוח ופתיחת מעקב אוטומטית על כל הזמנה.',
          act: { type: 'on', key: 'x_shop_order' } };
      } },
    /* 3) אוטומציה דלוקה שלא עושה כלום — סימן שהתנאים חונקים אותה */
    { key: 'never_ran', area: 'אוטומציות',
      run: () => {
        if (typeof autoAll !== 'function') return null;
        const dead = autoAll().filter(a => isOn(a.key) && runsOf(a.key) === 0 && blockedOf(a.key) > 0);
        if (!dead.length) return null;
        return { level: 'med', label: 'אוטומציות דלוקות שלא רצות בפועל',
          why: dead.map(a => a.title + ' (נחסמה ' + blockedOf(a.key) + ' פעמים)').join(' · '),
          gain: 'התנאים כנראה צרים מדי. שווה לפתוח אותם או להסיר תנאי אחד.',
          act: { type: 'openAuto', key: dead[0].key } };
      } },
    { key: 'mostly_blocked', area: 'אוטומציות',
      run: () => {
        if (typeof autoAll !== 'function') return null;
        const bad = autoAll().filter(a => isOn(a.key) && runsOf(a.key) > 0 && blockedOf(a.key) > runsOf(a.key) * 2);
        if (!bad.length) return null;
        return { level: 'low', label: 'אוטומציות שנחסמות יותר ממה שהן רצות',
          why: bad.map(a => a.title + ' — ' + runsOf(a.key) + ' ריצות מול ' + blockedOf(a.key) + ' חסימות').join(' · '),
          gain: 'כדאי לבדוק אם התנאי או מגבלת התדירות מתאימים למציאות.',
          act: { type: 'openAuto', key: bad[0].key } };
      } },
    /* 4) פערי כיסוי — לא אוטומציה, אלא הגדרה חסרה */
    { key: 'zone_no_staff', area: 'שטח',
      run: () => {
        if (!window.TERR || !CBX.isOn('terr')) return null;
        const gaps = window.TERR.recommendations().filter(x => x.level === 'gap');
        if (!gaps.length) return null;
        return { level: 'high', label: 'אזורים בלי איש שטח',
          why: gaps.map(g => g.title.replace('אין כיסוי ל', '')).join(' · ') + ' — יש קריאות ואין מי שייצא.',
          gain: 'שיוך איש שטח לאזור יאפשר לתאם שם בכלל.',
          act: { type: 'goto', where: 'criteria' } };
      } },
    { key: 'no_fixed_terms', area: 'חוזים',
      run: () => {
        if (typeof CT_SVC_TERMS === 'undefined') return null;
        const locked = CT_SVC_TERMS.filter(t => t.on !== false && t.locked !== false);
        if (locked.length) return null;
        return { level: 'med', label: 'אין תנאים קבועים בהסכם',
          why: 'לא הוגדר אף תנאי נעול — כל הסכם יוצא בלי מדיניות ביטול או אחריות.',
          gain: 'תנאי קבוע אחד מגן על העסק בכל הסכם שיוצא מהיום.',
          act: { type: 'goto', where: 'terms' } };
      } },
  ];

  /* ---------------- הרצה ---------------- */
  function run(manual) {
    const found = [];
    CHECKS.forEach(c => {
      if (MUTED[c.key]) return;
      let f = null; try { f = c.run(); } catch (e) { console.error('[adv] ' + c.key, e); }
      if (f) found.push(Object.assign({ key: c.key, area: c.area }, f));
    });
    const order = { high: 0, med: 1, low: 2 };
    found.sort((a, b) => order[a.level] - order[b.level]);
    const entry = { t: (typeof autoStamp === 'function') ? autoStamp() : '', n: found.length,
      manual: !!manual, keys: found.map(f => f.key) };
    LOG.unshift(entry); saveLog();
    CBX.emit('adv:run', { found, entry });
    return found;
  }
  let LAST = null;
  const findings = () => (LAST = LAST || run());
  const refresh = () => { LAST = run(); return LAST; };

  function apply(f) {
    if (!f || !f.act) return { ok: false };
    if (f.act.type === 'on') {
      if (typeof autoSet === 'function') autoSet(f.act.key, true);
      if (window.AUDIT && CBX.isOn('audit')) window.AUDIT.rec('auto', 'הופעל מהיועץ', title(f.act.key));
      return { ok: true, msg: '"' + title(f.act.key) + '" הופעלה ✓' };
    }
    if (f.act.type === 'openAuto') {
      navActive = 'automation';
      if (typeof renderAutomationView === 'function') renderAutomationView();
      setTimeout(() => { if (typeof openAutoInfo === 'function') openAutoInfo(f.act.key); }, 60);
      return { ok: true, msg: '' };
    }
    if (f.act.type === 'goto' && typeof gotoEntity === 'function') { gotoEntity(f.act.where, ''); return { ok: true, msg: '' }; }
    return { ok: false };
  }

  /* ---------------- ממשק ---------------- */
  const LV = { high: 'כדאי לטפל', med: 'שווה לבדוק', low: 'לתשומת לב' };
  function advHTML() {
    const f = findings();
    const byLv = k => f.filter(x => x.level === k).length;
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi ${byLv('high') ? 'warn' : ''}"><b>${byLv('high')}</b><small>כדאי לטפל</small></div>
        <div class="inv-kpi"><b>${byLv('med')}</b><small>שווה לבדוק</small></div>
        <div class="inv-kpi"><b>${CHECKS.length}</b><small>בדיקות שרצות</small></div>
        <div class="inv-kpi"><b>${LOG.length}</b><small>סבבי בדיקה</small></div>
      </div>
      <div class="adv-bar">
        <span class="adv-when">${ic('clock')} ${LOG[0] ? 'נבדק לאחרונה: ' + esc(LOG[0].t) : 'טרם רצה'}</span>
        <button class="btn sm primary" id="advRun">${ic('sync')} בדוק עכשיו</button>
      </div>
      ${f.length ? `<div class="adv-list">${f.map(x => `<div class="adv-f ${x.level}">
        <div class="adv-f-h"><span class="adv-lv">${LV[x.level]}</span><b>${esc(x.label)}</b>
          <span class="fx-tag">${esc(x.area)}</span></div>
        <div class="adv-why">${esc(x.why)}</div>
        <div class="adv-gain">${ic('bolt')} ${esc(x.gain)}</div>
        <div class="adv-acts">
          <button class="btn sm primary" data-advdo="${esc(x.key)}">
            ${x.act.type === 'on' ? ic('check') + ' הפעל' : ic('chevronL') + ' פתח'}</button>
          <button class="btn sm ghost" data-advmute="${esc(x.key)}">${ic('close')} לא רלוונטי</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="adv-clean">${ic('check')} <b>הכול מכוסה</b>
          <small>אין כרגע תהליך שחסרה עליו אוטומציה, ואין אוטומציה שנחנקת. הבדיקה תרוץ שוב לבד.</small></div>`}
      ${Object.keys(MUTED).length ? `<div class="adv-muted">
        <b>${ic('eye')} בדיקות שסימנתם כלא רלוונטיות</b>
        ${Object.keys(MUTED).map(k => `<span>${esc((CHECKS.find(c => c.key === k) || {}).area || k)}
          <button class="btn xs" data-advunmute="${esc(k)}">החזר</button></span>`).join('')}</div>` : ''}
      <div class="adv-cfg">
        <div class="ps-m-sec">${ic('settings')} <b>מתי לבדוק</b>
          <small>הבדיקה זולה ורצה על הנתונים שכבר במערכת.</small></div>
        <div class="rt-methods">
          <button class="rt-m ${CFG.every === 'tick' ? 'on' : ''}" data-advev="tick"><b>בכל סבב מועדים</b>
            <small>הכי מהיר לזהות — רץ יחד עם שאר הבדיקות של המערכת</small></button>
          <button class="rt-m ${CFG.every === 'daily' ? 'on' : ''}" data-advev="daily"><b>פעם ביום</b>
            <small>מספיק לרוב העסקים, פחות רעש</small></button>
          <button class="rt-m ${CFG.every === 'off' ? 'on' : ''}" data-advev="off"><b>ידני בלבד</b>
            <small>רץ רק כשלוחצים "בדוק עכשיו"</small></button>
        </div>
      </div>`;
  }

  function advBind(RR) {
    const rb = $('#advRun'); if (rb) rb.addEventListener('click', () => {
      const n = refresh().length; RR();
      toast(n ? 'נמצאו ' + (n === 1 ? 'ממצא אחד' : n + ' ממצאים') : 'הכול מכוסה ✓'); });
    $$('[data-advdo]').forEach(b => b.addEventListener('click', () => {
      const f = findings().find(x => x.key === b.dataset.advdo); if (!f) return;
      const r = apply(f); refresh();
      if (r.msg) toast(r.msg);
      if (f.act.type === 'on') RR(); }));
    $$('[data-advmute]').forEach(b => b.addEventListener('click', () => {
      MUTED[b.dataset.advmute] = 1; saveMuted(); refresh(); RR(); toast('הבדיקה לא תוצג יותר'); }));
    $$('[data-advunmute]').forEach(b => b.addEventListener('click', () => {
      delete MUTED[b.dataset.advunmute]; saveMuted(); refresh(); RR(); }));
    $$('[data-advev]').forEach(b => b.addEventListener('click', () => { CFG.every = b.dataset.advev; saveCfg(); RR(); }));
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'adv', label: 'בדיקה עצמית ויועץ אוטומציות', icon: 'shield',
    desc: 'המערכת בודקת את עצמה בזמנים קבועים: איזו אוטומציה כבויה הייתה מונעת בעיה שקרתה בפועל, איזו דלוקה ולא רצה כי התנאים חונקים אותה, ואיפה אין כיסוי בכלל.',
    files: ['js/ext/advisor.js'],
    install() {
      let advMode = false;
      if (typeof SET_GROUPS !== 'undefined') {
        const g = SET_GROUPS.find(x => x.key === 'manage');
        if (g) CBX.push('adv', g.items, [{ m: 'advisor', label: 'בדיקה עצמית', icon: 'shield', desc: 'מה חסר, מה נחנק ומה כדאי להפעיל' }]);
      }
      CBX.wrap('adv', 'applySetMode', o => function (m) { advMode = m === 'advisor'; return o.apply(this, arguments); });
      CBX.wrap('adv', 'currentSetModeKey', o => function () { return advMode ? 'advisor' : o.apply(this, arguments); });
      CBX.wrap('adv', 'renderSettingsView', o => function () {
        if (!advMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + advHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        advBind(() => renderSettingsView());
      });
      /* רץ יחד עם סבב המועדים של המערכת */
      if (typeof autoTick === 'function') CBX.wrap('adv', 'autoTick', o => function () {
        const r = o.apply(this, arguments);
        if (CFG.on && CFG.every === 'tick') { try { refresh(); } catch (e) {} }
        return r;
      });
      /* חיווי במסך האוטומציות — שם זה הכי רלוונטי */
      if (typeof renderAutomationView === 'function') CBX.wrap('adv', 'renderAutomationView', o => function () {
        const r = o.apply(this, arguments);
        try {
          const f = findings().filter(x => x.level === 'high');
          const host = document.getElementById('viewHost');
          if (!f.length || !host || host.querySelector('.adv-banner')) return r;
          const d = document.createElement('div'); d.className = 'adv-banner';
          d.innerHTML = `${ic('shield')} <b>הבדיקה העצמית מצאה ${f.length === 1 ? 'דבר אחד' : f.length + ' דברים'} שכדאי לטפל בהם</b>
            <small>${esc(f[0].label)}${f.length > 1 ? ' ועוד' : ''}</small>
            <button class="btn sm" id="advGo">${ic('chevronL')} הצג</button>`;
          /* מעל יומן ההרצות — שם המנהל מסתכל ממילא */
          const logEl = host.querySelector('.auto-log');
          const anchor = logEl ? (logEl.closest('section, .card') || logEl) : null;
          if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(d, anchor);
          else { const head = host.querySelector('.view-head');
            if (head && head.nextSibling) host.insertBefore(d, head.nextSibling); else host.insertBefore(d, host.firstChild); }
          const b = document.getElementById('advGo');
          if (b) b.addEventListener('click', () => { navActive = 'settings';
            if (typeof applySetMode === 'function') applySetMode('advisor'); renderSettingsView(); });
        } catch (e) {}
        return r;
      });
      /* אוטומציה: דוח בדיקה עצמית */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('adv', AUTOMATIONS,
        [{ key: 'x_selfcheck', trigger: 'בדיקה עצמית מתוזמנת', title: 'דוח בדיקה עצמית', desc: 'סורק מה לא מכוסה ומה נחנק, ושולח סיכום', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('adv', AUTO_IMPL, {
        x_selfcheck: {
          what: 'מריץ את כל הבדיקות העצמיות ושולח סיכום: אילו אוטומציות כבויות היו מונעות בעיה שקרתה בפועל, אילו דלוקות ולא רצות, ואיפה אין כיסוי. כך המערכת מדייקת את עצמה במקום לחכות שמישהו ישים לב.',
          run: () => {
            const f = refresh();
            if (!f.length) return 'הבדיקה העצמית עברה — אין ממצאים';
            f.slice(0, 4).forEach(x => { if (typeof autoNotify === 'function')
              autoNotify('בדיקה עצמית · ' + x.label, x.why + ' · ' + x.gain, 'reminder'); });
            return (f.length === 1 ? 'ממצא אחד' : f.length + ' ממצאים') + ': ' + f.slice(0, 3).map(x => x.label).join(' · ');
          } } });
      CBX._remember('adv', () => { advMode = false; LAST = null; });
    },
  });

  window.ADV = { run, refresh, findings, apply, checks: () => CHECKS, log: () => LOG, cfg: () => CFG };
})();
