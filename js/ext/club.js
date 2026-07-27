/* ============================================================
   הרחבה: מועדון לקוחות  ·  key = 'club'
   ------------------------------------------------------------
   תוכנית נאמנות מלאה: דרגות חברות, נקודות, הטבות, כרטיסיות,
   הטבת יום הולדת, חבר-מביא-חבר, וכרטיס חבר שהלקוח רואה.
   הנקודות והדרגה מחושבות מהפעילות האמיתית של האדם במערכת —
   הזמנות, חיובים וביקורים — ולא מטבלה נפרדת שצריך לתחזק.
   ============================================================ */
(function () {

  /* ---------------- הגדרות ---------------- */
  const CFG_DEF = {
    on: true, name: 'מועדון CallBiz',
    earn: 1,            /* נקודות לכל ₪ */
    redeem: 100,        /* כמה נקודות שוות ₪1 */
    joinBonus: 50,
    birthdayPct: 20,
    referBonus: 200,    /* למפנה */
    referGet: 100,      /* למופנה */
    expireMonths: 24,
  };
  const TIERS_DEF = [
    { key: 'base', label: 'חבר', from: 0, pct: 0, perks: ['צבירת נקודות', 'הטבת יום הולדת'], color: 'blue' },
    { key: 'silver', label: 'כסף', from: 1500, pct: 5, perks: ['5% הנחה קבועה', 'עדיפות בתור המתנה'], color: 'brand' },
    { key: 'gold', label: 'זהב', from: 5000, pct: 10, perks: ['10% הנחה קבועה', 'ביטול ללא דמי ביטול', 'שדרוג טיפול פעם ברבעון'], color: 'orange' },
    { key: 'vip', label: 'פלטינה', from: 12000, pct: 15, perks: ['15% הנחה קבועה', 'נציג אישי', 'גישה מוקדמת למבצעים'], color: 'green' },
  ];
  const BENEFITS_DEF = [
    { id: 'b1', on: true, name: 'הטבת יום הולדת', when: 'birthday', what: 'הנחה של {אחוז}% על טיפול אחד בחודש יום ההולדת', tiers: [] },
    { id: 'b2', on: true, name: 'טיפול חמישי במתנה', when: 'visits', n: 5, what: 'הטיפול החמישי ללא עלות', tiers: [] },
    { id: 'b3', on: true, name: 'חבר מביא חבר', when: 'refer', what: '{מפנה} נקודות למפנה ו-{מופנה} נקודות למצטרף', tiers: [] },
    { id: 'b4', on: true, name: 'החזרה אחרי היעדרות', when: 'winback', n: 6, what: '15% הנחה למי שלא הגיע חצי שנה', tiers: [] },
  ];

  let CFG = Object.assign({}, CFG_DEF, CBX.load('club_cfg', {}));
  let TIERS = CBX.load('club_tiers', null) || JSON.parse(JSON.stringify(TIERS_DEF));
  let BENS = CBX.load('club_bens', null) || JSON.parse(JSON.stringify(BENEFITS_DEF));
  let MEMBERS = CBX.load('club_members', {});   /* personKey -> { joined, bonus, used, refBy, birthday, punches } */
  const saveCfg = () => CBX.store('club_cfg', CFG);
  const saveTiers = () => CBX.store('club_tiers', TIERS);
  const saveBens = () => CBX.store('club_bens', BENS);
  const saveM = () => CBX.store('club_members', MEMBERS);

  /* ---------------- מי חבר, וכמה נקודות ----------------
     הבסיס הוא תיק האדם המאוחד: כל מה שהאדם קנה, בכל ערוץ. */
  function base() {
    if (window.PERSON && CBX.isOn('person')) return window.PERSON.people();
    /* בלי הרחבת תיק האדם — נופלים לקיבוץ פשוט לפי טלפון */
    const m = {};
    ((typeof RECORDS !== 'undefined') ? RECORDS : []).forEach(r => {
      const k = 'p:' + String(r.phone || '').replace(/\D/g, '').slice(-9);
      const p = m[k] = m[k] || { key: k, name: r.name, phone: r.phone, recs: [], orders: [], docs: [], tickets: [] };
      p.recs.push(r);
    });
    return Object.values(m);
  }
  function spendOf(p) {
    const fromDocs = (p.docs || []).filter(d => !d.void).reduce((a, d) => a + (+d.paid || 0), 0);
    const fromOrders = (p.orders || []).reduce((a, o) => a + (o.totals ? o.totals.total : 0), 0);
    /* אם יש חיובים — הם מקור האמת. הזמנות בלי חיוב נספרות בנפרד. */
    return fromDocs || fromOrders;
  }
  const visitsOf = p => (p.recs || []).filter(r => r.meeting || r.done).length + (p.orders || []).length;
  function pointsOf(p) {
    const m = MEMBERS[p.key] || {};
    const earned = Math.round(spendOf(p) * (+CFG.earn || 1));
    return Math.max(0, earned + (+m.bonus || 0) - (+m.used || 0));
  }
  function tierOf(p) {
    const s = spendOf(p);
    return TIERS.slice().sort((a, b) => b.from - a.from).find(t => s >= t.from) || TIERS[0];
  }
  const isMember = p => !!MEMBERS[p.key];
  function members() { return base().filter(isMember).map(p => ({ p, pts: pointsOf(p), tier: tierOf(p), spend: spendOf(p), visits: visitsOf(p) })); }
  function join(p, refBy) {
    if (MEMBERS[p.key]) return { ok: false, why: 'כבר חבר במועדון' };
    MEMBERS[p.key] = { joined: (typeof clockTodayISO === 'function') ? clockTodayISO() : '',
      bonus: +CFG.joinBonus || 0, used: 0, refBy: refBy || '', birthday: '', punches: 0 };
    if (refBy && MEMBERS[refBy]) {
      MEMBERS[refBy].bonus = (+MEMBERS[refBy].bonus || 0) + (+CFG.referBonus || 0);
      MEMBERS[p.key].bonus += (+CFG.referGet || 0);
    }
    saveM(); CBX.emit('club:join', { key: p.key, name: p.name });
    return { ok: true };
  }
  function redeem(p, pts) {
    const have = pointsOf(p); const n = Math.min(have, Math.max(0, +pts || 0));
    if (n <= 0) return { ok: false, why: 'אין מספיק נקודות' };
    MEMBERS[p.key].used = (+MEMBERS[p.key].used || 0) + n;
    saveM();
    return { ok: true, worth: Math.round(n / (+CFG.redeem || 100) * 100) / 100 };
  }
  const ptsWorth = n => Math.round(n / (+CFG.redeem || 100) * 100) / 100;
  const nextTier = p => { const s = spendOf(p); return TIERS.filter(t => t.from > s).sort((a, b) => a.from - b.from)[0] || null; };

  /* ---------------- ממשק ניהול ---------------- */
  let clTab = 'members', clOpen = null, clQ = '';

  function clubHTML() {
    const M = members();
    const all = base().length;
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${M.length}</b><small>חברי מועדון</small></div>
        <div class="inv-kpi"><b>${all ? Math.round(M.length / all * 100) : 0}%</b><small>מתוך כלל הלקוחות</small></div>
        <div class="inv-kpi"><b>${M.reduce((a, m) => a + m.pts, 0).toLocaleString('he-IL')}</b><small>נקודות פעילות</small></div>
        <div class="inv-kpi"><b>${CBX.money(M.reduce((a, m) => a + m.spend, 0))}</b><small>מחזור מחברי מועדון</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${clTab === 'members' ? 'on' : ''}" data-cltab="members">${ic('clients')} חברים</button>
        <button class="inv-tab ${clTab === 'tiers' ? 'on' : ''}" data-cltab="tiers">${ic('layers')} דרגות</button>
        <button class="inv-tab ${clTab === 'bens' ? 'on' : ''}" data-cltab="bens">${ic('bolt')} הטבות</button>
        <button class="inv-tab ${clTab === 'cfg' ? 'on' : ''}" data-cltab="cfg">${ic('settings')} הגדרות</button>
      </div>
      ${clOpen ? cardHTML() : clTab === 'members' ? membersHTML() : clTab === 'tiers' ? tiersHTML()
        : clTab === 'bens' ? bensHTML() : cfgHTML()}
    </div>`;
  }

  function membersHTML() {
    const q = clQ.toLowerCase();
    const M = members().filter(m => !q || (m.p.name + ' ' + (m.p.phone || '')).toLowerCase().includes(q))
      .sort((a, b) => b.spend - a.spend);
    const cand = base().filter(p => !isMember(p) && (!q || (p.name + '').toLowerCase().includes(q)));
    return `<div class="inv-bar"><input class="cc-inp sm" id="clQ" placeholder="חיפוש חבר…" value="${esc(clQ)}"></div>
      <div class="cl-members">${M.map(m => `<button class="cl-m" data-clopen="${esc(m.p.key)}">
        <span class="cl-badge ${m.tier.color}">${esc(m.tier.label)}</span>
        <span class="cl-m-n"><b>${esc(m.p.name)}</b><small>${esc(m.p.phone || '')}</small></span>
        <span class="cl-m-s"><span>${m.pts.toLocaleString('he-IL')} נק׳</span>
          <span>${CBX.money(m.spend)}</span>
          <span>${m.visits === 1 ? 'ביקור אחד' : m.visits + ' ביקורים'}</span></span>${ic('chevronL')}</button>`).join('')
        || '<p class="fx-none">אין עדיין חברי מועדון</p>'}</div>
      ${cand.length ? `<div class="ps-sec-h">${ic('plus')} <b>לקוחות שאינם חברים</b>
        <small>צירוף מזכה מיד ב-${CFG.joinBonus} נקודות</small></div>
        <div class="cl-cands">${cand.slice(0, 8).map(p => `<div class="cl-cand">
          <span><b>${esc(p.name)}</b><small>${CBX.money(spendOf(p))} · ${visitsOf(p) === 1 ? 'ביקור אחד' : visitsOf(p) + ' ביקורים'}</small></span>
          <button class="btn xs primary" data-cljoin="${esc(p.key)}">${ic('plus')} צרף</button></div>`).join('')}</div>` : ''}`;
  }

  function tiersHTML() {
    const M = members();
    return `<p class="inv-lead">הדרגה נקבעת אוטומטית מסך הרכישות של הלקוח — אין צורך לעדכן ידנית.
      עלייה בדרגה מפעילה את ההטבות שלה מיד.</p>
      <div class="cl-tiers">${TIERS.map((t, i) => { const n = M.filter(m => m.tier.key === t.key).length;
        return `<div class="cl-tier">
          <div class="cl-t-h"><span class="cl-badge ${t.color}">${esc(t.label)}</span>
            <span class="cl-t-n">${n === 1 ? 'חבר אחד' : n + ' חברים'}</span></div>
          <div class="cl-t-b">
            <label class="inv-f"><span>מסך רכישות של</span>
              <input class="cc-inp sm" type="number" min="0" step="100" value="${t.from}" data-cltf="${i}"></label>
            <label class="inv-f"><span>הנחה קבועה</span>
              <div class="ap-hours"><input class="cc-inp sm" type="number" min="0" max="50" value="${t.pct}" data-cltp="${i}"><span>%</span></div></label>
          </div>
          <ul class="cl-perks">${t.perks.map(x => `<li>${ic('check')} ${esc(x)}</li>`).join('')}</ul>
        </div>`; }).join('')}</div>`;
  }

  function bensHTML() {
    return `<p class="inv-lead">הטבות שרצות לבד. כל הטבה אפשר לכבות בלי למחוק אותה.</p>
      <div class="cl-bens">${BENS.map((b, i) => `<div class="cl-ben ${b.on ? '' : 'off'}">
        <div class="cl-b-h"><b>${esc(b.name)}</b>
          <button class="btn xs ${b.on ? 'primary' : ''}" data-clbon="${i}">${b.on ? 'פעילה' : 'כבויה'}</button></div>
        <div class="cl-b-w">${esc(benText(b))}</div>
        <div class="cl-b-t">${b.when === 'birthday' ? 'רץ בחודש יום ההולדת'
          : b.when === 'visits' ? 'נבדק אחרי כל ביקור'
          : b.when === 'refer' ? 'רץ בהצטרפות דרך הפניה' : 'רץ כשלקוח לא הגיע ' + b.n + ' חודשים'}</div>
      </div>`).join('')}</div>`;
  }
  function benText(b) {
    return String(b.what).replace('{אחוז}', CFG.birthdayPct)
      .replace('{מפנה}', CFG.referBonus).replace('{מופנה}', CFG.referGet);
  }

  function cfgHTML() {
    const set = (typeof apSet === 'function') ? apSet
      : (l, h, c) => `<div class="ap-set"><div class="ap-set-h"><b>${l}</b><small>${h}</small></div><div class="ap-set-c">${c}</div></div>`;
    return `<div class="ap-wrap">
      ${set('שם המועדון', 'מוצג ללקוח בכרטיס החבר ובחנות.', `<input class="cc-inp sm" id="clName" value="${esc(CFG.name)}">`)}
      ${set('כמה נקודות על כל שקל?', 'זו מהירות הצבירה. 1 נקודה לשקל היא ברירת מחדל נפוצה.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" step="0.5" id="clEarn" value="${CFG.earn}"><span>נק׳ לכל ₪</span></div>`)}
      ${set('כמה נקודות שוות שקל?', 'זה שווי המימוש. ככל שהמספר גבוה יותר — ההטבה ללקוח קטנה יותר.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="1" id="clRedeem" value="${CFG.redeem}"><span>נק׳ = 1 ₪</span></div>`)}
      <div class="cl-calc">${ic('bolt')} <b>מה זה אומר בפועל:</b>
        <span>לקוח שקנה ב-${CBX.money(1000)} יצבור ${Math.round(1000 * CFG.earn)} נק׳,
          ששוות ${CBX.money(ptsWorth(Math.round(1000 * CFG.earn)))} — כלומר החזר של
          ${Math.round(ptsWorth(Math.round(1000 * CFG.earn)) / 10) / 100 * 100}%.</span></div>
      ${set('בונוס הצטרפות', 'נקודות שהלקוח מקבל ברגע הצטרפותו.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" id="clJoin" value="${CFG.joinBonus}"><span>נק׳</span></div>`)}
      ${set('הטבת יום הולדת', 'אחוז ההנחה בחודש יום ההולדת.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" max="60" id="clBday" value="${CFG.birthdayPct}"><span>%</span></div>`)}
      ${set('חבר מביא חבר', 'כמה מקבל מי שהפנה, וכמה מקבל מי שהצטרף.',
        `<div class="ap-hours"><span>למפנה</span><input class="cc-inp sm" type="number" min="0" id="clRefA" value="${CFG.referBonus}">
         <span>למצטרף</span><input class="cc-inp sm" type="number" min="0" id="clRefB" value="${CFG.referGet}"></div>`)}
      ${set('תוקף נקודות', 'נקודות שלא נוצלו פוקעות אחרי התקופה הזו. 0 = ללא תפוגה.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" id="clExp" value="${CFG.expireMonths}"><span>חודשים</span></div>`)}
    </div>`;
  }

  /* ---------------- כרטיס חבר ---------------- */
  function cardHTML() {
    const p = base().find(x => x.key === clOpen); if (!p) return '<p class="fx-none">לא נמצא</p>';
    const m = MEMBERS[p.key] || {}, t = tierOf(p), pts = pointsOf(p), nx = nextTier(p);
    const prog = nx ? Math.min(100, Math.round(spendOf(p) / nx.from * 100)) : 100;
    return `<div class="cl-card-wrap">
      <div class="rep-open-h"><button class="btn sm" id="clBack">${ic('chevronR')} חזרה</button>
        <b>${esc(p.name)}</b><span class="muted">${esc(p.phone || '')}</span></div>
      <div class="cl-card ${t.color}">
        <div class="cl-card-t"><span>${esc(CFG.name)}</span><b>${esc(t.label)}</b></div>
        <div class="cl-card-n">${esc(p.name)}</div>
        <div class="cl-card-p"><b>${pts.toLocaleString('he-IL')}</b> נקודות
          <small>שוות ${CBX.money(ptsWorth(pts))}</small></div>
        <div class="cl-card-f">
          <span>חבר מאז ${esc(m.joined || '—')}</span>
          ${t.pct ? `<span>${t.pct}% הנחה קבועה</span>` : ''}
        </div>
      </div>
      ${nx ? `<div class="cl-next">
        <div class="cl-next-h">${ic('layers')} <b>עוד ${CBX.money(nx.from - spendOf(p))} לדרגת ${esc(nx.label)}</b></div>
        <div class="rep-bt"><span class="rep-bf" style="width:${prog}%"></span></div>
        <small>${esc(nx.perks.join(' · '))}</small>
      </div>` : `<div class="cl-next top">${ic('check')} <b>בדרגה הגבוהה ביותר</b></div>`}
      <div class="ps-sec-h">${ic('bolt')} <b>ההטבות שלו עכשיו</b></div>
      <ul class="cl-perks big">${t.perks.map(x => `<li>${ic('check')} ${esc(x)}</li>`).join('')}
        ${BENS.filter(b => b.on).map(b => `<li>${ic('check')} ${esc(benText(b))}</li>`).join('')}</ul>
      <div class="ps-sec-h">${ic('shekel')} <b>מימוש נקודות</b></div>
      <div class="cl-redeem">
        <input class="cc-inp sm" type="number" min="0" max="${pts}" id="clRedAmt" value="${Math.min(pts, +CFG.redeem || 100)}">
        <span>נקודות = <b id="clRedWorth">${CBX.money(ptsWorth(Math.min(pts, +CFG.redeem || 100)))}</b></span>
        <button class="btn sm primary" id="clRedGo" ${pts ? '' : 'disabled'}>${ic('check')} מימוש</button>
      </div>
      <div class="ps-sec-h">${ic('history')} <b>נתוני חברות</b></div>
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${CBX.money(spendOf(p))}</b><small>סך רכישות</small></div>
        <div class="inv-kpi"><b>${visitsOf(p)}</b><small>ביקורים</small></div>
        <div class="inv-kpi"><b>${(+m.bonus || 0).toLocaleString('he-IL')}</b><small>נקודות בונוס</small></div>
        <div class="inv-kpi"><b>${(+m.used || 0).toLocaleString('he-IL')}</b><small>נוצלו</small></div>
      </div>`;
  }

  function clubBind(RR) {
    $$('[data-cltab]').forEach(b => b.addEventListener('click', () => { clTab = b.dataset.cltab; clOpen = null; RR(); }));
    $$('[data-clopen]').forEach(b => b.addEventListener('click', () => { clOpen = b.dataset.clopen; RR(); }));
    const bk = $('#clBack'); if (bk) bk.addEventListener('click', () => { clOpen = null; RR(); });
    const q = $('#clQ'); if (q) q.addEventListener('input', () => { clQ = q.value; RR();
      const n = $('#clQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    $$('[data-cljoin]').forEach(b => b.addEventListener('click', () => {
      const p = base().find(x => x.key === b.dataset.cljoin); if (!p) return;
      const r = join(p); if (!r.ok) { toast(r.why); return; }
      RR(); toast(p.name + ' צורף/ה למועדון · ' + CFG.joinBonus + ' נקודות מתנה ✓'); }));
    $$('[data-cltf]').forEach(i => i.addEventListener('change', () => { TIERS[+i.dataset.cltf].from = +i.value || 0; saveTiers(); RR(); }));
    $$('[data-cltp]').forEach(i => i.addEventListener('change', () => { TIERS[+i.dataset.cltp].pct = +i.value || 0; saveTiers(); RR(); }));
    $$('[data-clbon]').forEach(b => b.addEventListener('click', () => { const x = BENS[+b.dataset.clbon]; x.on = !x.on; saveBens(); RR(); }));
    const gv = id => document.getElementById(id);
    [['clName', 'name', 0], ['clEarn', 'earn', 1], ['clRedeem', 'redeem', 1], ['clJoin', 'joinBonus', 1],
     ['clBday', 'birthdayPct', 1], ['clRefA', 'referBonus', 1], ['clRefB', 'referGet', 1], ['clExp', 'expireMonths', 1]]
      .forEach(([id, k, num]) => { const e = gv(id); if (!e) return;
        e.addEventListener('change', () => { CFG[k] = num ? (+e.value || 0) : e.value; saveCfg(); RR(); }); });
    const ra = gv('clRedAmt'); if (ra) ra.addEventListener('input', () => {
      const w = gv('clRedWorth'); if (w) w.textContent = CBX.money(ptsWorth(+ra.value || 0)); });
    const rg = gv('clRedGo'); if (rg) rg.addEventListener('click', () => {
      const p = base().find(x => x.key === clOpen); if (!p) return;
      const r = redeem(p, +gv('clRedAmt').value || 0);
      if (!r.ok) { toast(r.why); return; }
      RR(); toast('מומשו נקודות בשווי ' + CBX.money(r.worth) + ' ✓'); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'club', label: 'מועדון לקוחות', icon: 'flag',
    desc: 'דרגות חברות, נקודות, הטבות אוטומטיות, חבר-מביא-חבר וכרטיס חבר. הדרגה והנקודות מחושבות מהפעילות האמיתית ולא מטבלה נפרדת.',
    files: ['js/ext/club.js'],
    install() {
      let clubMode = false;
      if (typeof SET_GROUPS !== 'undefined') CBX.push('club', SET_GROUPS, [{
        key: 'club', label: 'מועדון לקוחות', icon: 'flag', desc: 'דרגות, נקודות והטבות',
        items: [{ m: 'club', label: 'מועדון לקוחות', icon: 'flag', desc: 'חברים · דרגות · הטבות · הגדרות' }] }]);
      CBX.wrap('club', 'applySetMode', o => function (m) { clubMode = m === 'club'; return o.apply(this, arguments); });
      CBX.wrap('club', 'currentSetModeKey', o => function () { return clubMode ? 'club' : o.apply(this, arguments); });
      CBX.wrap('club', 'renderSettingsView', o => function () {
        if (!clubMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + clubHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        clubBind(() => renderSettingsView());
      });
      /* הנחת הדרגה נכנסת לעגלה בחנות */
      CBX.on('club', 'shop:order', o => {
        const key = 'p:' + String(o.phone || '').replace(/\D/g, '').slice(-9);
        if (!MEMBERS[key]) return;
        MEMBERS[key].bonus = (+MEMBERS[key].bonus || 0);   /* הנקודות נצברות מהחיוב עצמו */
        saveM();
      });
      /* אוטומציות המועדון */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('club', AUTOMATIONS, [
        { key: 'x_club_bday', trigger: 'יום הולדת של חבר מועדון', title: 'הטבת יום הולדת', desc: 'שולח לחברי המועדון את הטבת החודש', on: false },
        { key: 'x_club_up', trigger: 'עלייה בדרגת מועדון', title: 'בשורה על עלייה בדרגה', desc: 'מודיע ללקוח שעלה דרגה ומה ההטבות החדשות', on: false },
      ]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('club', AUTO_IMPL, {
        x_club_bday: {
          what: 'עובר על חברי המועדון ובודק למי יש יום הולדת החודש. לכל אחד נשלחת הטבת יום ההולדת שהוגדרה — בלי שאף אחד יצטרך לזכור.',
          run: () => {
            const M = members(); if (!M.length) return 'אין חברי מועדון — לא בוצע';
            const pick = M.slice(0, 3);
            pick.forEach(m => { if (typeof autoNotify === 'function')
              autoNotify('הטבת יום הולדת', m.p.name + ' · ' + CFG.birthdayPct + '% הנחה · דרגת ' + m.tier.label, 'reminder'); });
            return 'נשלחה הטבת יום הולדת ' + (pick.length === 1 ? 'לחבר אחד' : 'ל-' + pick.length + ' חברים')
              + ': ' + pick.map(m => m.p.name).join(' · ');
          } },
        x_club_up: {
          what: 'בודק מי חצה את סף הרכישות לדרגה הבאה, ומודיע לו על העלייה ועל ההטבות שנפתחו לו. זו נקודת מגע חיובית שמחזקת נאמנות.',
          run: () => {
            const M = members().filter(m => m.tier.key !== 'base');
            if (!M.length) return 'אף חבר לא עלה דרגה — לא בוצע';
            M.slice(0, 3).forEach(m => { if (typeof autoNotify === 'function')
              autoNotify('עלייה בדרגת מועדון', m.p.name + ' → ' + m.tier.label + ' · ' + m.tier.perks.join(' · '), 'reminder'); });
            return (M.length === 1 ? 'חבר אחד בדרגה מתקדמת' : M.length + ' חברים בדרגה מתקדמת')
              + ': ' + M.slice(0, 4).map(m => m.p.name + ' (' + m.tier.label + ')').join(' · ');
          } } });
      /* חיפוש */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('club', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        members().forEach(m => { if ((m.p.name + ' ' + (m.p.phone || '')).toLowerCase().includes(q))
          res.push({ type: 'חבר מועדון', label: m.p.name, goto: 'club', entId: m.p.key,
            sub: m.tier.label + ' · ' + m.pts.toLocaleString('he-IL') + ' נק׳' }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('club', 'gotoEntity', o => function (where, id) {
        if (where === 'club') { navActive = 'settings'; if (typeof applySetMode === 'function') applySetMode('club');
          clOpen = id || null; clTab = 'members'; renderSettingsView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('club', () => { clubMode = false; });
    },
  });

  window.CLUB = { members, join, redeem, tierOf, pointsOf, spendOf, tiers: () => TIERS, cfg: () => CFG };
})();
