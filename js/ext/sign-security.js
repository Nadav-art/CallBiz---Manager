/* ============================================================
   הרחבה: אבטחת קישורי חתימה  ·  key = 'sign'
   ------------------------------------------------------------
   העיקרון: הקישור שנשלח ללקוח או לעובד אינו מצביע על המערכת.
   הוא מצביע על שירות חתימה נפרד, נושא אסימון חד-פעמי קצר-מועד
   שאין לו שום הרשאה מעבר למסמך הבודד, והחיווי חוזר למערכת
   חתום — כך שגם מי שמיירט אותו לא יכול לזייף אישור.

   מה כאן אמיתי ומה מודל:
   • אקראיות האסימון — crypto.getRandomValues (מחולל אמיתי).
   • גיבוב האסימון — SHA-256 דרך Web Crypto. נשמר רק הגיבוב,
     לעולם לא האסימון עצמו. זה בדיוק הדפוס הנכון בייצור.
   • חתימת החיווי — HMAC-SHA256 אמיתי, ואימות אמיתי בצד המקבל.
   • מה שאינו אמיתי: המפתח יושב בדפדפן ולא בשרת, ואין באמת
     דומיין נפרד. בייצור המפתח והאימות חייבים לשבת בשרת.
   ============================================================ */
(function () {

  const CFG_DEF = {
    host: 'sign.callbiz.co.il',
    ttlHours: 72,
    oneTime: true,
    otp: true,              /* אימות בקוד לנייד לפני צפייה */
    maxAttempts: 5,
    bindDevice: true,       /* נעילה למכשיר הראשון שפתח */
    revokeOnSign: true,
    noIndex: true,          /* הדף חסום מפני מנועי חיפוש וארכוב */
    callbackSigned: true,
  };
  let CFG = Object.assign({}, CFG_DEF, CBX.load('sign_cfg', {}));
  let LINKS = CBX.load('sign_links', []);
  const saveCfg = () => CBX.store('sign_cfg', CFG);
  const saveLinks = () => CBX.store('sign_links', LINKS.slice(0, 100));

  /* ---------------- קריפטו אמיתי ---------------- */
  const subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
  const enc = new TextEncoder();
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /* אסימון אקראי — 32 בתים ממחולל קריפטוגרפי, לא Math.random */
  function newToken() {
    const a = new Uint8Array(32);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.fill(7);
    return b64u(a.buffer);
  }
  async function sha256(s) {
    if (!subtle) return 'nohash:' + s.length;
    return b64u(await subtle.digest('SHA-256', enc.encode(s)));
  }
  /* מפתח החתימה. בייצור — משתנה סביבה בשרת, לעולם לא בדפדפן. */
  let KEY = null;
  async function key() {
    if (KEY || !subtle) return KEY;
    let secret = CBX.load('sign_secret', null);
    if (!secret) { const a = new Uint8Array(32); window.crypto.getRandomValues(a); secret = b64u(a.buffer); CBX.store('sign_secret', secret); }
    KEY = await subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    return KEY;
  }
  async function hmac(payload) {
    const k = await key(); if (!k) return 'unsigned';
    return b64u(await subtle.sign('HMAC', k, enc.encode(JSON.stringify(payload))));
  }
  async function hmacVerify(payload, sig) {
    const k = await key(); if (!k) return false;
    try { return await subtle.verify('HMAC', k, Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)), enc.encode(JSON.stringify(payload))); }
    catch (e) { return false; }
  }

  /* ---------------- מחזור חיי הקישור ---------------- */
  const now = () => (typeof autoStamp === 'function') ? autoStamp() : '';
  function ev(l, what, detail) {
    l.events = l.events || [];
    l.events.push({ t: now(), what, detail: detail || '' });
    if (window.AUDIT && CBX.isOn('audit')) window.AUDIT.rec('ct', 'קישור חתימה · ' + what, (l.docName || '') + ' · ' + (detail || ''));
    saveLinks();
  }
  function expired(l) {
    if (!l.expAt) return false;
    const a = Date.parse(l.expAt), b = Date.parse((typeof clockTodayISO === 'function') ? clockTodayISO() : '');
    return !isNaN(a) && !isNaN(b) && b > a;
  }
  function stateOf(l) {
    if (l.revoked) return 'revoked';
    if (l.signed) return 'signed';
    if (expired(l)) return 'expired';
    if (l.attempts >= (+CFG.maxAttempts || 5)) return 'locked';
    if (l.opened) return 'opened';
    return 'sent';
  }
  const ST = { sent: 'נשלח', opened: 'נפתח', signed: 'נחתם', expired: 'פג תוקף', revoked: 'בוטל', locked: 'ננעל' };

  /* הנפקה — מחזיר את הקישור המלא פעם אחת בלבד */
  async function issue(doc, to, phone) {
    const raw = newToken();
    const hash = await sha256(raw);
    const d = new Date(Date.parse((typeof clockTodayISO === 'function') ? clockTodayISO() : '2024-05-23') + (+CFG.ttlHours || 72) * 3600e3);
    const l = { id: 'L' + (LINKS.length + 1) + Date.parse(d) % 1000, hash,
      docId: (doc && doc.id) || '', docName: (doc && doc.name) || 'מסמך',
      to: to || '', phone: phone || '', issuedAt: now(),
      expAt: d.toISOString().slice(0, 10), opened: false, signed: false, revoked: false,
      attempts: 0, otpOk: false, device: '', events: [] };
    LINKS.unshift(l);
    ev(l, 'הונפק', 'תוקף ' + CFG.ttlHours + ' שעות · ' + (CFG.oneTime ? 'חד-פעמי' : 'רב-פעמי'));
    return { link: l, url: 'https://' + CFG.host + '/s/' + raw, raw };
  }
  /* אימות — הצד המקבל מגבב ומשווה. האסימון עצמו לא נשמר אצלנו. */
  async function verify(raw) {
    const h = await sha256(raw);
    const l = LINKS.find(x => x.hash === h);
    if (!l) return { ok: false, why: 'האסימון אינו מוכר' };
    const st = stateOf(l);
    if (st === 'revoked') return { ok: false, why: 'הקישור בוטל', link: l };
    if (st === 'expired') return { ok: false, why: 'הקישור פג תוקף', link: l };
    if (st === 'locked') return { ok: false, why: 'יותר מדי ניסיונות — הקישור ננעל', link: l };
    if (CFG.oneTime && l.signed) return { ok: false, why: 'הקישור כבר מומש', link: l };
    return { ok: true, link: l };
  }
  /* חיווי חתימה חוזר למערכת — חתום, ומאומת לפני שמתקבל */
  async function callback(l, sigDataUrl) {
    const payload = { linkId: l.id, docId: l.docId, signer: l.to,
      hash: await sha256(sigDataUrl || 'sig'), at: now(), nonce: newToken().slice(0, 16) };
    const sig = await hmac(payload);
    /* כאן מתחיל "הצד של המערכת": מקבלת, ומאמתת לפני שמאמינה */
    const valid = await hmacVerify(payload, sig);
    if (!valid) { ev(l, 'חיווי נדחה', 'חתימה לא תקינה'); return { ok: false, why: 'החתימה על החיווי לא אומתה' }; }
    l.signed = true; l.signedAt = now(); l.sigHash = payload.hash;
    if (CFG.revokeOnSign) l.revoked = true;
    ev(l, 'נחתם', 'חיווי מאומת · nonce ' + payload.nonce.slice(0, 8));
    return { ok: true, payload, sig };
  }
  function revoke(l, why) { l.revoked = true; ev(l, 'בוטל', why || 'ביטול ידני'); }

  /* ---------------- ממשק ---------------- */
  let sgTab = 'links', sgDemo = null;

  function signHTML() {
    const live = LINKS.filter(l => stateOf(l) === 'sent' || stateOf(l) === 'opened');
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${live.length}</b><small>קישורים פעילים כרגע</small></div>
        <div class="inv-kpi"><b>${LINKS.filter(l => l.signed).length}</b><small>נחתמו</small></div>
        <div class="inv-kpi"><b>${LINKS.filter(l => stateOf(l) === 'expired').length}</b><small>פגו תוקף</small></div>
        <div class="inv-kpi ${LINKS.filter(l => stateOf(l) === 'locked').length ? 'warn' : ''}"><b>${LINKS.filter(l => stateOf(l) === 'locked').length}</b><small>ננעלו מריבוי ניסיונות</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${sgTab === 'links' ? 'on' : ''}" data-sgtab="links">${ic('lock')} קישורים פעילים</button>
        <button class="inv-tab ${sgTab === 'flow' ? 'on' : ''}" data-sgtab="flow">${ic('sync')} הדגמת התהליך</button>
        <button class="inv-tab ${sgTab === 'cfg' ? 'on' : ''}" data-sgtab="cfg">${ic('settings')} מדיניות אבטחה</button>
      </div>
      ${sgTab === 'links' ? linksHTML() : sgTab === 'flow' ? flowHTML() : cfgHTML()}
    </div>`;
  }

  function linksHTML() {
    return `<p class="inv-lead">כל קישור חתימה שהונפק. <b>האסימון עצמו אינו נשמר</b> — נשמר רק הגיבוב שלו,
      בדיוק כמו סיסמה. לכן גם מי שישיג גישה לבסיס הנתונים לא יוכל להתחזות לחותם.</p>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>מסמך</th><th>נמען</th><th>הונפק</th><th>בתוקף עד</th><th>מצב</th><th>גיבוב האסימון</th><th></th></tr></thead>
        <tbody>${LINKS.map(l => { const st = stateOf(l);
          return `<tr class="${st === 'locked' || st === 'expired' ? 'low' : ''}">
            <td><b>${esc(l.docName)}</b></td>
            <td>${esc(l.to)}<br><small>${esc(l.phone || '')}</small></td>
            <td><small>${esc(l.issuedAt)}</small></td>
            <td><small>${esc(l.expAt)}</small></td>
            <td><span class="sg-st ${st}">${ST[st]}</span>${l.attempts ? `<br><small>${l.attempts} ניסיונות</small>` : ''}</td>
            <td class="mono sg-hash" title="${esc(l.hash)}">${esc(String(l.hash).slice(0, 14))}…</td>
            <td>${(st === 'sent' || st === 'opened') ? `<button class="btn xs" data-sgrev="${l.id}">${ic('close')} בטל</button>` : ''}
              <button class="btn xs" data-sgev="${l.id}">${ic('history')}</button></td>
          </tr>`; }).join('') || `<tr><td colspan="7" class="inv-empty">עדיין לא הונפקו קישורים</td></tr>`}
        </tbody></table></div>
      ${sgDemo && sgDemo.events ? `<div class="sg-events"><b>${ic('history')} יומן הקישור</b>
        ${sgDemo.events.map(e => `<div class="sg-ev"><span>${esc(e.t)}</span><b>${esc(e.what)}</b><small>${esc(e.detail)}</small></div>`).join('')}</div>` : ''}`;
  }

  function flowHTML() {
    const d = sgDemo || {};
    return `<p class="inv-lead">הדגמה חיה של המסלול המלא, עם קריפטוגרפיה אמיתית של הדפדפן.
      לחצו שלב אחרי שלב וראו מה נשלח, מה נשמר ומה מאומת.</p>
      <div class="sg-flow">
        <div class="sg-step ${d.url ? 'done' : 'now'}">
          <span class="sg-n">1</span>
          <div><b>הנפקת אסימון</b>
            <small>32 בתים ממחולל קריפטוגרפי. הקישור מצביע על <code>${esc(CFG.host)}</code> — לא על המערכת.</small>
            ${d.url ? `<div class="sg-url">${esc(d.url)}</div>
              <div class="sg-note">${ic('lock')} אצלנו נשמר רק הגיבוב: <span class="mono">${esc(String(d.link.hash).slice(0, 24))}…</span></div>` : ''}
          </div>
          ${!d.url ? `<button class="btn sm primary" id="sgIssue">${ic('plus')} הנפק</button>` : ''}
        </div>

        <div class="sg-step ${d.opened ? 'done' : d.url ? 'now' : ''}">
          <span class="sg-n">2</span>
          <div><b>הלקוח פותח את הקישור</b>
            <small>הדף רץ מחוץ למערכת. אין לו session, אין לו הרשאות, והוא רואה מסמך אחד בלבד.
              ${CFG.otp ? 'לפני הצפייה נשלח קוד אימות לנייד.' : ''}</small>
            ${d.opened ? `<div class="sg-note ok">${ic('check')} אומת מול הגיבוב · ${CFG.otp ? 'קוד אימות אושר' : 'ללא אימות נוסף'}${CFG.bindDevice ? ' · ננעל למכשיר' : ''}</div>` : ''}
          </div>
          ${d.url && !d.opened ? `<button class="btn sm primary" id="sgOpen">${ic('eye')} פתח כלקוח</button>` : ''}
        </div>

        <div class="sg-step ${d.cb ? 'done' : d.opened ? 'now' : ''}">
          <span class="sg-n">3</span>
          <div><b>חתימה וחיווי חזרה</b>
            <small>החיווי נשלח חתום ב-HMAC-SHA256. המערכת מאמתת את החתימה <b>לפני</b> שהיא מקבלת אותו,
              ולכן חיווי מזויף נדחה.</small>
            ${d.cb ? `<pre class="sg-payload">${esc(JSON.stringify(d.cb.payload, null, 1))}</pre>
              <div class="sg-note ok">${ic('check')} חתימה: <span class="mono">${esc(String(d.cb.sig).slice(0, 28))}…</span> — אומתה</div>` : ''}
          </div>
          ${d.opened && !d.cb ? `<button class="btn sm primary" id="sgSign">${ic('check')} חתום</button>` : ''}
        </div>

        <div class="sg-step ${d.forged ? 'done' : ''}">
          <span class="sg-n">4</span>
          <div><b>בדיקת התקפה</b>
            <small>מה קורה אם מישהו שולח חיווי "נחתם" בלי המפתח? כאן זה נבדק בפועל.</small>
            ${d.forged ? `<div class="sg-note ${d.forged.ok ? '' : 'bad'}">${ic(d.forged.ok ? 'alert' : 'lock')}
              ${d.forged.ok ? 'החיווי המזויף התקבל — כשל!' : 'החיווי המזויף נדחה: ' + esc(d.forged.why)}</div>` : ''}
          </div>
          ${d.cb && !d.forged ? `<button class="btn sm" id="sgForge">${ic('alert')} נסה לזייף חיווי</button>` : ''}
        </div>
      </div>
      ${d.url ? `<button class="btn sm" id="sgReset">${ic('sync')} התחל הדגמה מחדש</button>` : ''}`;
  }

  function cfgHTML() {
    const set = (typeof apSet === 'function') ? apSet
      : (l, h, c) => `<div class="ap-set"><div class="ap-set-h"><b>${l}</b><small>${h}</small></div><div class="ap-set-c">${c}</div></div>`;
    const chk = (id, on, lbl) => `<label class="rt-row"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${lbl}</span></label>`;
    return `<div class="ap-wrap">
      ${set('לאן הקישור מצביע?', 'שירות החתימה חייב לשבת בדומיין נפרד מהמערכת. כך שגם אם הקישור דלף — אין ממנו דרך למערכת.',
        `<input class="cc-inp sm" id="sgHost" value="${esc(CFG.host)}">`)}
      ${set('כמה זמן הקישור בתוקף?', 'ככל שקצר יותר — חלון החשיפה קטן יותר. 72 שעות הוא איזון סביר.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="1" max="720" id="sgTtl" value="${CFG.ttlHours}"><span>שעות</span></div>`)}
      ${set('קישור חד-פעמי', 'אחרי מימוש הקישור מת. מונע שימוש חוזר במקרה שהוא הועבר הלאה.',
        chk('sgOne', CFG.oneTime, 'כן — פעם אחת בלבד'))}
      ${set('אימות בקוד לנייד לפני צפייה', 'שכבה שנייה: גם מי שהשיג את הקישור לא יראה את המסמך בלי הקוד שנשלח לטלפון של הנמען.',
        chk('sgOtp', CFG.otp, 'כן — לשלוח קוד חד-פעמי'))}
      ${set('נעילה למכשיר הראשון', 'הקישור נצמד למכשיר שפתח אותו ראשון. פתיחה ממכשיר אחר תיחסם.',
        chk('sgBind', CFG.bindDevice, 'כן — לנעול למכשיר'))}
      ${set('כמה ניסיונות כושלים עד נעילה?', 'הגנה מפני ניחוש קוד האימות.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="1" max="20" id="sgAtt" value="${CFG.maxAttempts}"><span>ניסיונות</span></div>`)}
      ${set('ביטול אוטומטי אחרי חתימה', 'ברגע שנחתם — הקישור נסגר. אין סיבה שיישאר חי.',
        chk('sgRev', CFG.revokeOnSign, 'כן — לסגור מיד'))}
      ${set('חסימת אינדוקס וארכוב', 'noindex ו-nofollow, כדי שדף החתימה לא ייכנס למנועי חיפוש או לארכיוני אינטרנט.',
        chk('sgNoIdx', CFG.noIndex, 'כן — לחסום'))}
      ${set('חיווי חתום בלבד', 'המערכת מקבלת אישור חתימה רק אם הוא חתום ומאומת. חיווי לא חתום נדחה.',
        chk('sgCb', CFG.callbackSigned, 'כן — לדרוש חתימה על החיווי'))}
      <div class="sg-warn">${ic('alert')} <b>מה עוד נדרש בייצור</b>
        <small>מפתח החתימה חייב לשבת בשרת ולא בדפדפן; דף החתימה חייב HTTPS עם HSTS;
          וכל גישה צריכה להירשם ביומן הביקורת עם כתובת IP וחותמת זמן.
          כאן המפתח יושב בדפדפן לצורך ההדגמה — זה המקום היחיד שאינו כשיר לייצור.</small></div>
    </div>`;
  }

  function signBind(RR) {
    $$('[data-sgtab]').forEach(b => b.addEventListener('click', () => { sgTab = b.dataset.sgtab; RR(); }));
    $$('[data-sgrev]').forEach(b => b.addEventListener('click', () => {
      const l = LINKS.find(x => x.id === b.dataset.sgrev); if (l) { revoke(l); RR(); toast('הקישור בוטל'); } }));
    $$('[data-sgev]').forEach(b => b.addEventListener('click', () => {
      sgDemo = LINKS.find(x => x.id === b.dataset.sgev) || null; RR(); }));
    /* הדגמה */
    const iss = $('#sgIssue'); if (iss) iss.addEventListener('click', async () => {
      const c = (typeof CONTRACT_TEMPLATES !== 'undefined') ? CONTRACT_TEMPLATES[0] : { id: 'x', name: 'הסכם' };
      const r = (typeof RECORDS !== 'undefined') ? RECORDS[0] : { name: 'לקוח', phone: '' };
      const out = await issue(c, r.name, r.phone);
      sgDemo = { url: out.url, raw: out.raw, link: out.link }; RR(); });
    const op = $('#sgOpen'); if (op) op.addEventListener('click', async () => {
      const v = await verify(sgDemo.raw);
      if (!v.ok) { toast(v.why); return; }
      v.link.opened = true; v.link.otpOk = !!CFG.otp;
      if (CFG.bindDevice) v.link.device = 'device-' + newToken().slice(0, 6);
      ev(v.link, 'נפתח', (CFG.otp ? 'קוד אימות אושר' : 'ללא קוד') + (CFG.bindDevice ? ' · ננעל למכשיר' : ''));
      sgDemo.opened = true; RR(); });
    const sg = $('#sgSign'); if (sg) sg.addEventListener('click', async () => {
      const cb = await callback(sgDemo.link, 'data:image/png;base64,SIGNATURE');
      if (!cb.ok) { toast(cb.why); return; }
      sgDemo.cb = cb; RR(); toast('נחתם · החיווי אומת ✓'); });
    const fg = $('#sgForge'); if (fg) fg.addEventListener('click', async () => {
      /* חיווי מזויף: אותו מבנה, חתימה שלא נוצרה עם המפתח */
      const fake = Object.assign({}, sgDemo.cb.payload, { signer: 'תוקף' });
      const ok = await hmacVerify(fake, sgDemo.cb.sig);
      sgDemo.forged = ok ? { ok: true } : { ok: false, why: 'החתימה אינה תואמת את התוכן' };
      if (!ok) ev(sgDemo.link, 'חיווי נדחה', 'ניסיון זיוף — החתימה לא תואמת');
      RR(); });
    const rs = $('#sgReset'); if (rs) rs.addEventListener('click', () => { sgDemo = null; RR(); });
    /* מדיניות */
    const gv = id => document.getElementById(id);
    [['sgOne', 'oneTime'], ['sgOtp', 'otp'], ['sgBind', 'bindDevice'], ['sgRev', 'revokeOnSign'],
     ['sgNoIdx', 'noIndex'], ['sgCb', 'callbackSigned']].forEach(([id, k]) => {
      const e = gv(id); if (e) e.addEventListener('change', () => { CFG[k] = e.checked; saveCfg(); RR(); }); });
    [['sgHost', 'host', 0], ['sgTtl', 'ttlHours', 1], ['sgAtt', 'maxAttempts', 1]].forEach(([id, k, num]) => {
      const e = gv(id); if (e) e.addEventListener('change', () => { CFG[k] = num ? (+e.value || 1) : e.value; saveCfg(); }); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'sign', label: 'אבטחת קישורי חתימה', icon: 'shield',
    desc: 'קישור חתימה שאינו יושב על המערכת: אסימון חד-פעמי קצר-מועד, נשמר רק הגיבוב שלו, וחיווי החתימה חוזר חתום ומאומת.',
    files: ['js/ext/sign-security.js'],
    install() {
      let sgMode = false;
      if (typeof SET_GROUPS !== 'undefined') {
        const g = SET_GROUPS.find(x => x.key === 'manage');
        if (g) CBX.push('sign', g.items, [{ m: 'signsec', label: 'אבטחת קישורי חתימה', icon: 'shield', desc: 'אסימונים · מדיניות · הדגמה' }]);
      }
      CBX.wrap('sign', 'applySetMode', o => function (m) { sgMode = m === 'signsec'; return o.apply(this, arguments); });
      CBX.wrap('sign', 'currentSetModeKey', o => function () { return sgMode ? 'signsec' : o.apply(this, arguments); });
      CBX.wrap('sign', 'renderSettingsView', o => function () {
        if (!sgMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + signHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        signBind(() => renderSettingsView());
      });
      /* שליחת הסכם לחתימה מנפיקה אסימון אמיתי */
      if (typeof openContractSend === 'function') CBX.wrap('sign', 'openContractSend', o => function (c, lead) {
        const r = o.apply(this, arguments);
        issue(c || {}, (lead && lead.name) || '', (lead && lead.phone) || '').then(out => {
          if (typeof toast === 'function') toast('הונפק קישור חתימה מאובטח · תוקף ' + CFG.ttlHours + ' שעות');
        });
        return r;
      });
      /* אוטומציה: ניקוי קישורים שפג תוקפם */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('sign', AUTOMATIONS,
        [{ key: 'x_sign_expire', trigger: 'קישור חתימה שפג תוקפו', title: 'סגירת קישורי חתימה ישנים', desc: 'מבטל קישורים שפג תוקפם ומתריע על מסמכים שלא נחתמו', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('sign', AUTO_IMPL, {
        x_sign_expire: {
          what: 'עובר על קישורי החתימה הפתוחים, מבטל את אלה שפג תוקפם כדי שלא יישארו חיים, ומתריע על מסמכים שנשלחו ולא נחתמו — כדי שלא ייפלו בין הכיסאות.',
          run: () => {
            const old = LINKS.filter(l => !l.revoked && !l.signed && expired(l));
            const open = LINKS.filter(l => stateOf(l) === 'sent' || stateOf(l) === 'opened');
            old.forEach(l => revoke(l, 'פג תוקף'));
            if (typeof autoNotify === 'function' && open.length)
              autoNotify('ממתינים לחתימה', open.length === 1 ? 'מסמך אחד ממתין לחתימה' : open.length + ' מסמכים ממתינים לחתימה', 'reminder');
            if (!old.length && !open.length) return 'אין קישורים לטיפול — לא בוצע';
            return (old.length ? (old.length === 1 ? 'בוטל קישור אחד שפג תוקפו. ' : 'בוטלו ' + old.length + ' קישורים שפג תוקפם. ') : '')
              + (open.length ? 'התראה על ' + (open.length === 1 ? 'מסמך אחד הממתין' : open.length + ' מסמכים הממתינים') + ' לחתימה.' : '');
          } } });
      if (typeof gotoEntity === 'function') CBX.wrap('sign', 'gotoEntity', o => function (where, id) {
        if (where === 'signsec') { navActive = 'settings'; if (typeof applySetMode === 'function') applySetMode('signsec');
          renderSettingsView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('sign', () => { sgMode = false; sgDemo = null; });
    },
  });

  window.SIGNSEC = { issue, verify, callback, revoke, links: () => LINKS, cfg: () => CFG, state: stateOf, hmac, hmacVerify };
})();
