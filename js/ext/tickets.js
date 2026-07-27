/* ============================================================
   הרחבה: כרטיסי תמיכה ו-SLA  ·  key = 'tkt'
   ------------------------------------------------------------
   פנייה לשירות אינה ליד מכירה: יש לה עדיפות, קטגוריה, זמן תגובה
   מובטח שתלוי בסוג הלקוח, ומדידת שביעות רצון בסוף.
   כאן: כרטיסים, מדיניות SLA לפי רמת לקוח, תשובות מוכנות,
   בסיס ידע, והסלמה אוטומטית כשחורגים.
   ============================================================ */
(function () {

  const PRIOS = [
    { key: 'urgent', label: 'קריטי', desc: 'השירות מושבת', color: 'red' },
    { key: 'high', label: 'גבוה', desc: 'פוגע בעבודה', color: 'orange' },
    { key: 'normal', label: 'רגיל', desc: 'תקלה נקודתית', color: 'blue' },
    { key: 'low', label: 'נמוך', desc: 'שאלה או בקשה', color: 'green' },
  ];
  const CATS = ['תקלה טכנית', 'שאלה על חיוב', 'בקשת שינוי מועד', 'תלונה', 'בקשת מידע', 'אחר'];
  const STATES = [
    { key: 'new', label: 'חדש' }, { key: 'open', label: 'בטיפול' },
    { key: 'wait', label: 'ממתין ללקוח' }, { key: 'done', label: 'נסגר' },
  ];
  /* רמות לקוח — כל רמה מקבלת זמני תגובה אחרים */
  const TIERS_DEF = [
    { key: 'vip', label: 'פרימיום', first: 30, resolve: 240, hours: 'סביב השעון' },
    { key: 'biz', label: 'עסקי', first: 120, resolve: 480, hours: 'שעות פעילות' },
    { key: 'std', label: 'רגיל', first: 240, resolve: 1440, hours: 'שעות פעילות' },
  ];
  const CANNED_DEF = [
    { t: 'קיבלנו את הפנייה', x: 'שלום {שם_לקוח}, קיבלנו את פנייתך ואנחנו בודקים. נחזור אליך תוך {זמן_תגובה}.' },
    { t: 'בקשה לפרטים', x: 'כדי שנוכל להתקדם, נשמח לצילום מסך או לפרטים נוספים על מה שקרה.' },
    { t: 'נפתר', x: 'הטיפול הושלם. אם משהו עדיין לא תקין — פשוט השיבו להודעה הזו והכרטיס ייפתח מחדש.' },
    { t: 'שינוי מועד', x: 'שינינו את המועד בהתאם לבקשתך. אישור מעודכן נשלח אליך.' },
  ];
  const KB_DEF = [
    { q: 'איך משנים מועד תור?', a: 'מאזור אישי › התורים שלי › שינוי מועד, או בשיחה עם נציג. שינוי עד 48 שעות לפני המועד ללא עלות.', cat: 'בקשת שינוי מועד', pub: true },
    { q: 'מתי מחייבים את הכרטיס?', a: 'מקדמה נגבית בעת שריון התור, והיתרה בסיום הטיפול. חשבונית נשלחת אוטומטית למייל.', cat: 'שאלה על חיוב', pub: true },
    { q: 'מה עושים כשלקוח מבקש החזר?', a: 'בודקים אם הטיפול בוצע. לא בוצע — זיכוי מלא. בוצע — לפי מדיניות הביטול בהסכם. מעל 500 ₪ נדרש אישור מנהל.', cat: 'תלונה', pub: false },
  ];

  let TK = CBX.load('tkt_list', null) || seed();
  let TIERS = CBX.load('tkt_tiers', null) || JSON.parse(JSON.stringify(TIERS_DEF));
  let CANNED = CBX.load('tkt_canned', null) || JSON.parse(JSON.stringify(CANNED_DEF));
  let KB = CBX.load('tkt_kb', null) || JSON.parse(JSON.stringify(KB_DEF));
  const save = () => CBX.store('tkt_list', TK);
  const saveT = () => CBX.store('tkt_tiers', TIERS);
  const saveC = () => CBX.store('tkt_canned', CANNED);
  const saveK = () => CBX.store('tkt_kb', KB);

  function seed() {
    const R = (typeof RECORDS !== 'undefined') ? RECORDS : [];
    return [
      { id: 'TK-101', subj: 'לא קיבלתי אישור על התור', cat: 'בקשת מידע', prio: 'normal', tier: 'std',
        cust: (R[0] || {}).name || 'לקוח', recId: (R[0] || {}).id, phone: (R[0] || {}).phone,
        state: 'open', opened: '2024-05-22 09:10', firstReply: '2024-05-22 10:40', mins: 1520,
        msgs: [{ who: 'לקוח', t: 'לא הגיע אישור במייל' }, { who: 'נציג', t: 'נשלח שוב, נא לבדוק גם בספאם' }] },
      { id: 'TK-102', subj: 'חיוב כפול בכרטיס', cat: 'שאלה על חיוב', prio: 'urgent', tier: 'vip',
        cust: (R[1] || {}).name || 'לקוח', recId: (R[1] || {}).id, phone: (R[1] || {}).phone,
        state: 'new', opened: '2024-05-23 08:05', firstReply: null, mins: 95,
        msgs: [{ who: 'לקוח', t: 'חויבתי פעמיים על אותו טיפול' }] },
      { id: 'TK-103', subj: 'רוצה להזיז את התור לשבוע הבא', cat: 'בקשת שינוי מועד', prio: 'low', tier: 'biz',
        cust: (R[2] || {}).name || 'לקוח', recId: (R[2] || {}).id, phone: (R[2] || {}).phone,
        state: 'wait', opened: '2024-05-21 14:30', firstReply: '2024-05-21 15:05', mins: 2600,
        msgs: [{ who: 'לקוח', t: 'אפשר להעביר לשבוע הבא?' }, { who: 'נציג', t: 'אילו ימים נוחים לך?' }] },
    ];
  }

  /* ---------------- SLA ---------------- */
  const tier = k => TIERS.find(t => t.key === k) || TIERS[TIERS.length - 1];
  function slaOf(t) {
    const T = tier(t.tier);
    /* קריטי מקבל חצי מהזמן — חומרה מקצרת את ההבטחה */
    const mul = t.prio === 'urgent' ? 0.5 : t.prio === 'high' ? 0.75 : 1;
    const first = Math.round(T.first * mul), resolve = Math.round(T.resolve * mul);
    const age = +t.mins || 0;
    const firstOk = t.firstReply ? true : age <= first;
    const resolveOk = t.state === 'done' ? true : age <= resolve;
    return { T, first, resolve, age, firstOk, resolveOk,
      breach: !firstOk || !resolveOk,
      leftFirst: first - age, leftResolve: resolve - age };
  }
  const mins = n => n >= 1440 ? Math.round(n / 1440) + ' ימים' : n >= 60 ? Math.round(n / 60) + ' שעות' : n + ' דק׳';
  const openTk = () => TK.filter(t => t.state !== 'done');
  const breached = () => openTk().filter(t => slaOf(t).breach);

  /* ---------------- ממשק ---------------- */
  let tkTab = 'list', tkFilter = 'all', tkOpen = null, tkQ = '';

  function tktHTML() {
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${openTk().length}</b><small>כרטיסים פתוחים</small></div>
        <div class="inv-kpi ${breached().length ? 'warn' : ''}"><b>${breached().length}</b><small>חריגה מ-SLA</small></div>
        <div class="inv-kpi"><b>${TK.filter(t => t.state === 'new').length}</b><small>טרם נענו</small></div>
        <div class="inv-kpi"><b>${TK.filter(t => t.state === 'done').length}</b><small>נסגרו</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${tkTab === 'list' ? 'on' : ''}" data-tktab="list">${ic('ticket')} כרטיסים</button>
        <button class="inv-tab ${tkTab === 'sla' ? 'on' : ''}" data-tktab="sla">${ic('clock')} מדיניות SLA</button>
        <button class="inv-tab ${tkTab === 'canned' ? 'on' : ''}" data-tktab="canned">${ic('bolt')} תשובות מוכנות</button>
        <button class="inv-tab ${tkTab === 'kb' ? 'on' : ''}" data-tktab="kb">${ic('docs')} בסיס ידע</button>
      </div>
      ${tkTab === 'list' ? (tkOpen ? oneHTML() : listHTML()) : tkTab === 'sla' ? slaHTML()
        : tkTab === 'canned' ? cannedHTML() : kbHTML()}
    </div>`;
  }

  const FILTERS = [{ k: 'all', l: 'הכל' }, { k: 'new', l: 'טרם נענו' }, { k: 'open', l: 'בטיפול' },
    { k: 'wait', l: 'ממתין ללקוח' }, { k: 'breach', l: 'חריגה מ-SLA' }, { k: 'done', l: 'נסגרו' }];
  function listHTML() {
    const q = tkQ.toLowerCase();
    const list = TK.filter(t => tkFilter === 'all' ? true : tkFilter === 'breach' ? slaOf(t).breach : t.state === tkFilter)
      .filter(t => !q || (t.subj + ' ' + t.cust + ' ' + t.id).toLowerCase().includes(q));
    return `<div class="inv-bar">
        <input class="cc-inp sm" id="tkQ" placeholder="חיפוש כרטיס…" value="${esc(tkQ)}">
        <span class="ap-filters">${FILTERS.map(f => `<button class="ap-f ${tkFilter === f.k ? 'on' : ''}" data-tkf="${f.k}">${f.l}</button>`).join('')}</span>
        <button class="btn sm primary" id="tkNew">${ic('plus')} כרטיס חדש</button>
      </div>
      <div class="tk-list">${list.map(t => { const s = slaOf(t), P = PRIOS.find(p => p.key === t.prio) || PRIOS[2];
        return `<div class="tk-card ${s.breach && t.state !== 'done' ? 'breach' : ''}">
          <div class="tk-top">
            <span class="tk-prio ${P.color}">${P.label}</span>
            <b class="tk-subj">${esc(t.subj)}</b>
            <span class="tk-id mono">${esc(t.id)}</span>
          </div>
          <div class="tk-meta">
            <span>${ic('user')} ${esc(t.cust)}</span><span>${esc(t.cat)}</span>
            <span class="tk-tier">${esc(tier(t.tier).label)}</span>
            <span class="tk-state ${t.state}">${(STATES.find(x => x.key === t.state) || {}).label}</span>
          </div>
          <div class="tk-sla ${s.breach && t.state !== 'done' ? 'bad' : 'ok'}">
            ${t.state === 'done' ? ic('check') + ' נסגר'
              : !t.firstReply ? (s.firstOk ? ic('clock') + ' תגובה ראשונה תוך ' + mins(Math.max(0, s.leftFirst))
                  : ic('alert') + ' חריגה: לא נענה ' + mins(s.age) + ' (הובטח ' + mins(s.first) + ')')
              : (s.resolveOk ? ic('clock') + ' לסגירה תוך ' + mins(Math.max(0, s.leftResolve))
                  : ic('alert') + ' חריגה: פתוח ' + mins(s.age) + ' (הובטח ' + mins(s.resolve) + ')')}
          </div>
          <button class="btn xs" data-tkopen="${esc(t.id)}">${ic('eye')} פתח כרטיס</button>
        </div>`; }).join('') || `<p class="fx-none">אין כרטיסים בסינון זה</p>`}</div>`;
  }

  function oneHTML() {
    const t = TK.find(x => x.id === tkOpen); if (!t) return '<p class="fx-none">הכרטיס לא נמצא</p>';
    const s = slaOf(t);
    return `<div class="tk-one">
      <div class="rep-open-h"><button class="btn sm" id="tkBack">${ic('chevronR')} חזרה</button>
        <b>${esc(t.subj)}</b><span class="muted mono">${esc(t.id)}</span></div>
      <div class="tk-one-grid">
        <label class="inv-f"><span>עדיפות</span><select class="cc-inp" id="tkPrio">
          ${PRIOS.map(p => `<option value="${p.key}" ${t.prio === p.key ? 'selected' : ''}>${p.label} — ${p.desc}</option>`).join('')}</select></label>
        <label class="inv-f"><span>קטגוריה</span><select class="cc-inp" id="tkCat">
          ${CATS.map(c => `<option ${t.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="inv-f"><span>רמת לקוח</span><select class="cc-inp" id="tkTier">
          ${TIERS.map(x => `<option value="${x.key}" ${t.tier === x.key ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
        <label class="inv-f"><span>סטטוס</span><select class="cc-inp" id="tkState">
          ${STATES.map(x => `<option value="${x.key}" ${t.state === x.key ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
      </div>
      <div class="tk-slabox ${s.breach && t.state !== 'done' ? 'bad' : 'ok'}">
        ${ic('clock')} <b>ההבטחה ללקוח:</b>
        <span>תגובה ראשונה תוך ${mins(s.first)} · סגירה תוך ${mins(s.resolve)} · ${esc(s.T.hours)}</span>
        ${s.breach && t.state !== 'done' ? '<span class="tk-breach">חריגה</span>' : ''}
      </div>
      <div class="tk-thread">${(t.msgs || []).map(m => `<div class="tk-msg ${m.who === 'נציג' ? 'us' : ''}">
        <b>${esc(m.who)}</b><span>${esc(m.t)}</span></div>`).join('')}</div>
      <div class="tk-reply">
        <select class="cc-inp sm" id="tkCanned"><option value="">תשובה מוכנה…</option>
          ${CANNED.map((c, i) => `<option value="${i}">${esc(c.t)}</option>`).join('')}</select>
        <textarea class="cc-inp" id="tkMsg" rows="2" placeholder="כתבו תשובה ללקוח…"></textarea>
        <button class="btn sm primary" id="tkSend">${ic('check')} שלח ללקוח</button>
      </div>`;
  }

  function slaHTML() {
    return `<p class="inv-lead">כמה זמן מובטח ללקוח — לפי רמת הלקוח. פנייה קריטית מקבלת חצי מהזמן,
      ופנייה בעדיפות גבוהה שלושה רבעים. החריגות מוצגות אדום ברשימה, ואוטומציה יכולה להתריע עליהן.</p>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>רמת לקוח</th><th>תגובה ראשונה</th><th>סגירה</th><th>שעות מענה</th><th>כרטיסים פתוחים</th></tr></thead>
        <tbody>${TIERS.map((x, i) => `<tr>
          <td><b>${esc(x.label)}</b></td>
          <td><input class="cc-inp sm" type="number" min="5" value="${x.first}" data-tkf1="${i}"> <small>דק׳</small></td>
          <td><input class="cc-inp sm" type="number" min="10" value="${x.resolve}" data-tkr="${i}"> <small>דק׳</small></td>
          <td><select class="cc-inp sm" data-tkh="${i}">
            <option ${x.hours === 'שעות פעילות' ? 'selected' : ''}>שעות פעילות</option>
            <option ${x.hours === 'סביב השעון' ? 'selected' : ''}>סביב השעון</option></select></td>
          <td>${openTk().filter(t => t.tier === x.key).length}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function cannedHTML() {
    return `<p class="inv-lead">נוסחים קבועים שנציג בוחר במקום להקליד מחדש. המשתנים מוחלפים אוטומטית.</p>
      <div class="tk-canned">${CANNED.map((c, i) => `<div class="tk-can">
        <input class="cc-inp sm" value="${esc(c.t)}" data-tkct="${i}">
        <textarea class="cc-inp sm" rows="2" data-tkcx="${i}">${esc(c.x)}</textarea>
        <button class="btn xs" data-tkcd="${i}">${ic('close')}</button></div>`).join('')}</div>
      <button class="btn sm" id="tkCanAdd">${ic('plus')} תשובה חדשה</button>`;
  }

  function kbHTML() {
    return `<p class="inv-lead">שאלות שחוזרות. מסומן "מוצג ללקוח" מופיע גם באזור האישי ובחנות;
      השאר נשאר פנימי לנציגים בלבד.</p>
      <div class="tk-kb">${KB.map((k, i) => `<details class="tk-kbi">
        <summary><b>${esc(k.q)}</b><span class="fx-tag ${k.pub ? 'mine' : ''}">${k.pub ? 'מוצג ללקוח' : 'פנימי'}</span></summary>
        <div class="tk-kba"><textarea class="cc-inp sm" rows="3" data-tkka="${i}">${esc(k.a)}</textarea>
          <div class="tk-kbb"><button class="btn xs" data-tkkp="${i}">${k.pub ? 'הפוך לפנימי' : 'הצג ללקוח'}</button>
            <button class="btn xs" data-tkkd="${i}">${ic('close')} מחק</button></div></div>
      </details>`).join('')}</div>
      <div class="tk-kbadd">
        <input class="cc-inp sm" id="tkKbQ" placeholder="השאלה">
        <input class="cc-inp sm" id="tkKbA" placeholder="התשובה">
        <button class="btn sm primary" id="tkKbAdd">${ic('plus')} הוסף</button>
      </div>`;
  }

  function tktBind(RR) {
    $$('[data-tktab]').forEach(b => b.addEventListener('click', () => { tkTab = b.dataset.tktab; tkOpen = null; RR(); }));
    $$('[data-tkf]').forEach(b => b.addEventListener('click', () => { tkFilter = b.dataset.tkf; RR(); }));
    $$('[data-tkopen]').forEach(b => b.addEventListener('click', () => { tkOpen = b.dataset.tkopen; RR(); }));
    const bk = $('#tkBack'); if (bk) bk.addEventListener('click', () => { tkOpen = null; RR(); });
    const q = $('#tkQ'); if (q) q.addEventListener('input', () => { tkQ = q.value; RR();
      const n = $('#tkQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    const nw = $('#tkNew'); if (nw) nw.addEventListener('click', () => {
      const R = (typeof RECORDS !== 'undefined') ? RECORDS : [];
      const r = R[0] || {};
      TK.unshift({ id: 'TK-' + (101 + TK.length), subj: 'כרטיס חדש', cat: CATS[0], prio: 'normal', tier: 'std',
        cust: r.name || 'לקוח', recId: r.id, phone: r.phone, state: 'new',
        opened: (typeof autoStamp === 'function') ? autoStamp() : '', firstReply: null, mins: 0, msgs: [] });
      save(); tkOpen = TK[0].id; RR(); toast('נפתח כרטיס חדש'); });
    /* עריכת כרטיס */
    const t = TK.find(x => x.id === tkOpen);
    if (t) {
      [['tkPrio', 'prio'], ['tkCat', 'cat'], ['tkTier', 'tier'], ['tkState', 'state']].forEach(([id, k]) => {
        const e = $('#' + id); if (e) e.addEventListener('change', () => { t[k] = e.value; save(); RR(); }); });
      const cn = $('#tkCanned'); if (cn) cn.addEventListener('change', () => {
        const c = CANNED[+cn.value]; if (!c) return;
        const m = $('#tkMsg'); if (m) m.value = c.x.replace('{שם_לקוח}', t.cust).replace('{זמן_תגובה}', mins(slaOf(t).first)); });
      const sd = $('#tkSend'); if (sd) sd.addEventListener('click', () => {
        const m = $('#tkMsg'); if (!m || !m.value.trim()) { toast('נא לכתוב תשובה'); return; }
        t.msgs = t.msgs || []; t.msgs.push({ who: 'נציג', t: m.value.trim() });
        if (!t.firstReply) t.firstReply = (typeof autoStamp === 'function') ? autoStamp() : 'עכשיו';
        if (t.state === 'new') t.state = 'open';
        save(); RR(); toast('התשובה נשלחה ללקוח ✓'); });
    }
    /* SLA */
    $$('[data-tkf1]').forEach(i => i.addEventListener('change', () => { TIERS[+i.dataset.tkf1].first = +i.value || 30; saveT(); RR(); }));
    $$('[data-tkr]').forEach(i => i.addEventListener('change', () => { TIERS[+i.dataset.tkr].resolve = +i.value || 240; saveT(); RR(); }));
    $$('[data-tkh]').forEach(i => i.addEventListener('change', () => { TIERS[+i.dataset.tkh].hours = i.value; saveT(); }));
    /* תשובות מוכנות */
    $$('[data-tkct]').forEach(i => i.addEventListener('change', () => { CANNED[+i.dataset.tkct].t = i.value; saveC(); }));
    $$('[data-tkcx]').forEach(i => i.addEventListener('change', () => { CANNED[+i.dataset.tkcx].x = i.value; saveC(); }));
    $$('[data-tkcd]').forEach(b => b.addEventListener('click', () => { CANNED.splice(+b.dataset.tkcd, 1); saveC(); RR(); }));
    const ca = $('#tkCanAdd'); if (ca) ca.addEventListener('click', () => { CANNED.push({ t: 'תשובה חדשה', x: '' }); saveC(); RR(); });
    /* בסיס ידע */
    $$('[data-tkka]').forEach(i => i.addEventListener('change', () => { KB[+i.dataset.tkka].a = i.value; saveK(); }));
    $$('[data-tkkp]').forEach(b => b.addEventListener('click', () => { const k = KB[+b.dataset.tkkp]; k.pub = !k.pub; saveK(); RR(); }));
    $$('[data-tkkd]').forEach(b => b.addEventListener('click', () => { KB.splice(+b.dataset.tkkd, 1); saveK(); RR(); }));
    const ka = $('#tkKbAdd'); if (ka) ka.addEventListener('click', () => {
      const q2 = ($('#tkKbQ').value || '').trim(), a2 = ($('#tkKbA').value || '').trim();
      if (!q2) { toast('נא להזין שאלה'); return; }
      KB.push({ q: q2, a: a2, cat: CATS[0], pub: false }); saveK(); RR(); toast('נוסף לבסיס הידע ✓'); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'tkt', label: 'כרטיסי תמיכה ו-SLA', icon: 'ticket',
    desc: 'פניות שירות כישות נפרדת מליד: עדיפות, קטגוריה, זמני תגובה מובטחים לפי רמת לקוח, תשובות מוכנות ובסיס ידע.',
    files: ['js/ext/tickets.js'],
    install() {
      let tktMode = false;
      if (typeof SET_GROUPS !== 'undefined') CBX.push('tkt', SET_GROUPS, [{
        key: 'support', label: 'שירות ותמיכה', icon: 'ticket', desc: 'כרטיסי תמיכה, SLA ובסיס ידע',
        items: [{ m: 'support', label: 'כרטיסי תמיכה', icon: 'ticket', desc: 'כרטיסים · SLA · תשובות מוכנות · בסיס ידע' }] }]);
      CBX.wrap('tkt', 'applySetMode', o => function (m) { tktMode = m === 'support'; return o.apply(this, arguments); });
      CBX.wrap('tkt', 'currentSetModeKey', o => function () { return tktMode ? 'support' : o.apply(this, arguments); });
      CBX.wrap('tkt', 'renderSettingsView', o => function () {
        if (!tktMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + tktHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        tktBind(() => renderSettingsView());
      });
      /* אוטומציה: חריגה מ-SLA */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('tkt', AUTOMATIONS,
        [{ key: 'x_sla_breach', trigger: 'חריגה מ-SLA בשירות', title: 'התראה על חריגה בזמן מענה', desc: 'כרטיס תמיכה שחרג מהזמן שהובטח ללקוח — התראה למנהל השירות', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('tkt', AUTO_IMPL, {
        x_sla_breach: {
          what: 'עובר על כל כרטיסי התמיכה הפתוחים ובודק מי חרג מזמן התגובה או מזמן הסגירה שהובטחו לפי רמת הלקוח. על כל חריגה יוצאת התראה — הכרטיס נשאר אצל הנציג.',
          run: () => {
            const b = breached(); if (!b.length) return 'כל הכרטיסים בתוך ה-SLA — לא בוצע';
            b.slice(0, 5).forEach(t => { const s = slaOf(t);
              if (typeof autoNotify === 'function')
                autoNotify('חריגה מ-SLA · ' + t.id, t.cust + ' · ' + t.subj + ' · פתוח ' + mins(s.age)
                  + ' (הובטח ' + mins(t.firstReply ? s.resolve : s.first) + ')', 'reminder'); });
            return 'התראה על ' + b.length + ' חריגות: ' + b.slice(0, 4).map(t => t.id).join(' · ');
          } } });
      /* מקור נתונים לדוחות */
      /* חיפוש */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('tkt', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        TK.forEach(t => { if ((t.id + ' ' + t.subj + ' ' + t.cust).toLowerCase().includes(q))
          res.push({ type: 'כרטיס תמיכה', label: t.id + ' · ' + t.subj, goto: 'ticket', entId: t.id,
            sub: t.cust + ' · ' + (STATES.find(x => x.key === t.state) || {}).label }); });
        KB.forEach(k => { if ((k.q + ' ' + k.a).toLowerCase().includes(q))
          res.push({ type: 'בסיס ידע', label: k.q, goto: 'kb', sub: k.pub ? 'מוצג ללקוח' : 'פנימי' }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('tkt', 'gotoEntity', o => function (where, id) {
        if (where === 'ticket' || where === 'kb') { navActive = 'settings';
          if (typeof applySetMode === 'function') applySetMode('support');
          tkTab = where === 'kb' ? 'kb' : 'list'; tkOpen = where === 'ticket' ? id : null;
          renderSettingsView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('tkt', () => { tktMode = false; });
    },
  });

  window.TKT = { list: () => TK, sla: slaOf, breached, tiers: () => TIERS, kb: () => KB, prios: () => PRIOS, states: () => STATES };
})();
