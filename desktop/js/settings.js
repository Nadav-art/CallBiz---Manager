/* ============================================================
   CallBiz Desktop · הגדרות טלפוניה + חיבור למרכזייה
   ------------------------------------------------------------
   כאן נשמרות ההגדרות, וכאן מנוהל החיבור החי למרכזייה דרך
   מחסנית ה-SIP. שני עקרונות:

   1. הזהות מגיעה מה-CRM. מי הנציג, לאיזו פעילות הוא משויך ומה
      מותר לו — נקבע במנג'ר, לא כאן. ההגדרות כאן הן *טכניות*:
      לאיזה שרת מתחברים ובאילו אישורים.

   2. מצב שרת-מנוהל (ברירת המחדל): הנציג לא מקליד כלום. המנג'ר
      מחזיר את פרטי החיבור של השלוחה שלו, והמערכת מתחברת לבד.
      מצב ידני קיים בשביל מרכזייה של לקוח או להתקנה ראשונה.
   ============================================================ */
(function () {

  const KEY = 'cbd_sip';
  const SKEY = 'cbd_sip_secret';   /* הסיסמה בנפרד — כדי שייצוא הגדרות לא ייקח אותה */

  const DEF = {
    mode: 'managed',              /* managed = פרטי החיבור מגיעים מה-CRM | manual */
    /* --- חשבון --- */
    label: 'המרכזייה שלי',
    wss: '', domain: '', user: '', authUser: '', callerId: '', displayName: '',
    expires: 600, autoStart: true,
    /* --- רשת ומדיה --- */
    stun: 'stun:stun.l.google.com:19302', turn: '', turnUser: '', turnPass: '',
    keepAlive: 30, srtp: 'sdes',  /* דפדפן תמיד מצפין; זו רק העדפת הצגה */
    /* --- קודקים לפי סדר עדיפות --- */
    codecs: [
      { k: 'opus',  m: 'opus/48000',  label: 'Opus',        band: 'רחב-פס',  note: 'האיכות הטובה ביותר', on: true },
      { k: 'g722',  m: 'G722/8000',   label: 'G.722',       band: 'רחב-פס',  note: 'איכות גבוהה, נתמך ברוב המרכזיות', on: true },
      { k: 'pcmu',  m: 'PCMU/8000',   label: 'G.711 μ-law', band: 'צר-פס',   note: 'תאימות מלאה, צורך רוחב פס', on: true },
      { k: 'pcma',  m: 'PCMA/8000',   label: 'G.711 A-law', band: 'צר-פס',   note: 'תקן אירופה/ישראל', on: true },
    ],
    /* --- שמע --- */
    micId: '', spkId: '', ringId: '', aec: true, ns: true, agc: true, micGain: 100,
    /* --- צלצול ומענה --- */
    ring: 'classic', ringVol: 70, autoAnswer: 0, callWaiting: true,
    /* --- התנהגות --- */
    dtmfMode: 'rfc2833',
    /* --- כתיבת מספרים מחדש --- */
    rewrite: [
      { on: true, match: '^\\+972(\\d+)$',   to: '0$1',  note: 'מספר בינלאומי ישראלי → מקומי' },
      { on: true, match: '^00(\\d+)$',       to: '+$1',  note: '00 בתחילת מספר → +' },
      { on: false, match: '^(\\d{3,4})$',    to: '$1',   note: 'שלוחה פנימית — נשלחת כמו שהיא' },
    ],
  };

  /* ---------------- שמירה וטעינה ---------------- */
  function load() {
    let c;
    try { c = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { c = null; }
    c = Object.assign(JSON.parse(JSON.stringify(DEF)), c || {});
    try { c.pass = localStorage.getItem(SKEY) || ''; } catch (e) { c.pass = ''; }
    return c;
  }
  function persist() {
    const copy = Object.assign({}, CFG); delete copy.pass;
    try {
      localStorage.setItem(KEY, JSON.stringify(copy));
      if (CFG.pass) localStorage.setItem(SKEY, CFG.pass); else localStorage.removeItem(SKEY);
    } catch (e) {}
    return CFG;
  }
  let CFG = load();

  /* ---------------- אירועים ---------------- */
  const L = {};
  const on = (e, f) => { (L[e] = L[e] || []).push(f); };
  const emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (x) { console.error(x); } });

  /* ---------------- מצב החיבור ---------------- */
  const ST = { state: 'offline', since: 0, error: '', lastReg: '', trace: [], voicemail: 0 };
  let ua = null;

  const HE = { offline: 'לא מחובר', connecting: 'מתחבר…', registering: 'מזדהה…',
    registered: 'מחובר', failed: 'החיבור נכשל' };
  const label = s => HE[s] || s;

  /* פרטי חיבור מנוהלים — מגיעים מהמנג'ר לפי הנציג המחובר */
  async function managedCreds() {
    if (!window.CRM || !CRM.pbxCreds) return null;
    try { return await CRM.pbxCreds(); } catch (e) { return null; }
  }

  async function connect() {
    disconnect(true);
    let c = CFG;
    if (CFG.mode === 'managed') {
      const m = await managedCreds();
      if (!m) { fail('לא התקבלו פרטי חיבור מהמערכת. בדקו שהנציג משויך לשלוחה.'); return false; }
      c = Object.assign({}, CFG, m);
    }
    if (!c.wss || !c.user) { fail('חסרים כתובת שרת או שם משתמש'); return false; }

    ua = new SIPStack.UA({
      wss: c.wss, domain: c.domain || hostOf(c.wss), user: c.user, pass: c.pass,
      authUser: c.authUser, displayName: c.displayName || c.callerId, expires: c.expires,
      stun: c.stun, turn: c.turn, turnUser: c.turnUser, turnPass: c.turnPass,
      keepAlive: c.keepAlive, dtmfMode: c.dtmfMode, micId: c.micId,
      instanceId: instanceId(),
    });

    ua.on('state', s => { ST.state = s; ST.since = Date.now(); if (s !== 'failed') ST.error = ''; emit('state', ST); });
    ua.on('registered', d => { ST.lastReg = new Date().toLocaleString('he-IL'); ST.error = ''; emit('state', ST); });
    ua.on('error', e => { ST.error = e.msg || ''; emit('state', ST); emit('error', e); });
    ua.on('retry', r => { ST.error = 'מנסה להתחבר מחדש בעוד ' + r.in + ' שניות'; emit('state', ST); });
    ua.on('voicemail', v => { ST.voicemail = v.count || 0; emit('voicemail', v); });
    ua.on('sip', t => { ST.trace.push(t); if (ST.trace.length > 200) ST.trace.shift(); emit('trace', t); });
    /* השיחות עצמן עוברות למנוע הטלפוניה */
    ['call', 'incoming', 'ended', 'media', 'ice', 'message'].forEach(ev => ua.on(ev, d => emit(ev, d)));

    ua.start();
    return true;
  }
  function fail(msg) { ST.state = 'failed'; ST.error = msg; emit('state', ST); emit('error', { msg }); }
  function disconnect(quiet) {
    if (ua) { try { ua.stop(); } catch (e) {} ua = null; }
    ST.state = 'offline'; if (!quiet) emit('state', ST);
  }
  const hostOf = u => String(u).replace(/^wss?:\/\//, '').split('/')[0].split(':')[0];
  function instanceId() {
    let id = localStorage.getItem('cbd_instance');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now()); localStorage.setItem('cbd_instance', id); }
    return id;
  }

  /* ---------------- כתיבת מספרים מחדש ---------------- */
  function rewrite(number) {
    let n = String(number || '').trim().replace(/[^\d+*#]/g, '');
    for (const r of (CFG.rewrite || [])) {
      if (!r.on) continue;
      try { const re = new RegExp(r.match); if (re.test(n)) { n = n.replace(re, r.to); break; } }
      catch (e) { /* ביטוי לא תקין — מדלגים במקום להפיל חיוג */ }
    }
    return n;
  }
  /* בדיקה חיה למסך ההגדרות: מה יקרה למספר הזה */
  function testRewrite(number) {
    const rules = CFG.rewrite || [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]; if (!r.on) continue;
      try {
        const re = new RegExp(r.match);
        const clean = String(number).replace(/[^\d+*#]/g, '');
        if (re.test(clean)) return { out: clean.replace(re, r.to), rule: i, note: r.note };
      } catch (e) { return { out: number, rule: -1, error: 'כלל ' + (i + 1) + ' אינו תקין' }; }
    }
    return { out: String(number).replace(/[^\d+*#]/g, ''), rule: -1 };
  }

  /* ---------------- התקני שמע ---------------- */
  async function devices(ask) {
    if (!navigator.mediaDevices) return { in: [], out: [], denied: true };
    try {
      if (ask) { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
      const d = await navigator.mediaDevices.enumerateDevices();
      const named = d.some(x => x.label);
      return { in: d.filter(x => x.kind === 'audioinput'), out: d.filter(x => x.kind === 'audiooutput'), named };
    } catch (e) { return { in: [], out: [], denied: true }; }
  }
  /* בדיקת מיקרופון — מחזיר עוצמה חיה, ועוצר לבד */
  async function micTest(cb, ms) {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: Object.assign({}, CFG.micId ? { deviceId: { exact: CFG.micId } } : {}) });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(s), an = ctx.createAnalyser();
    an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let alive = true;
    const tick = () => {
      if (!alive) return;
      an.getByteTimeDomainData(buf);
      let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
      cb(Math.min(100, Math.round(peak / 128 * 200)));
      requestAnimationFrame(tick);
    };
    tick();
    const stop = () => { alive = false; s.getTracks().forEach(t => t.stop()); try { ctx.close(); } catch (e) {} };
    if (ms) setTimeout(stop, ms);
    return stop;
  }
  /* בדיקת רמקול — צליל חיוג ישראלי (400Hz) דרך המכשיר שנבחר */
  async function spkTest() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain(), dst = ctx.createMediaStreamDestination();
    o.frequency.value = 400; g.gain.value = (CFG.ringVol || 70) / 100 * 0.25;
    o.connect(g);
    const el = new Audio();
    if (CFG.spkId && el.setSinkId) { try { await el.setSinkId(CFG.spkId); } catch (e) {} }
    g.connect(dst); el.srcObject = dst.stream; el.play().catch(() => { g.connect(ctx.destination); });
    o.start();
    setTimeout(() => { try { o.stop(); ctx.close(); el.pause(); } catch (e) {} }, 1200);
  }

  /* ---------------- בדיקת מוכנות ---------------- */
  /* מה שבאמת חייב לעבוד כדי שנציג יוכל לדבר. כל שורה שנכשלת
     מגיעה עם הסבר מה לעשות — לא עם קוד שגיאה. */
  async function preflight() {
    const out = [];
    const push = (t, ok, why, fix) => out.push({ t, ok, why, fix });

    push('חיבור מאובטח (HTTPS)', location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname),
      'הדפדפן חוסם מיקרופון בדף לא מאובטח',
      'הפעילו דרך הקובץ Start-CallBiz-Desktop.cmd, או פרסו את המערכת ב-HTTPS');

    push('תמיכת WebRTC', !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      'הדפדפן לא תומך בשיחות קול', 'השתמשו ב-Chrome או ב-Edge בגרסה עדכנית');

    let mic = false, micWhy = 'לא ניתנה הרשאה למיקרופון';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic = s.getAudioTracks().length > 0; s.getTracks().forEach(t => t.stop());
    } catch (e) { micWhy = e.name === 'NotFoundError' ? 'לא נמצא מיקרופון מחובר' : 'ההרשאה למיקרופון נדחתה'; }
    push('מיקרופון', mic, micWhy, 'לחצו על סמל המנעול בשורת הכתובת ואפשרו מיקרופון, ואז רעננו');

    const c = CFG.mode === 'managed' ? Object.assign({}, CFG, await managedCreds() || {}) : CFG;
    push('פרטי מרכזייה', !!(c.wss && c.user), 'לא הוגדרה כתובת שרת או שלוחה',
      CFG.mode === 'managed' ? 'שייכו את הנציג לשלוחה במנג׳ר' : 'מלאו את פרטי החשבון במסך זה');

    if (c.wss) {
      const r = await probeWss(c.wss);
      push('קישוריות לשרת', r.ok, r.why, 'ודאו שהמרכזייה חושפת WSS ושהתעודה תקפה. פורטים נפוצים: 8089 ל-Asterisk, 7443 ל-FreeSWITCH');
    }
    push('רישום למרכזייה', ST.state === 'registered', ST.error || 'טרם בוצע חיבור', 'לחצו "התחבר" למעלה');
    return out;
  }
  /* בדיקת WSS אמיתית: פותחים סוקט ורואים אם הוא נענה */
  function probeWss(url) {
    return new Promise(res => {
      if (!/^wss?:\/\//.test(url)) url = 'wss://' + url;
      let ws, done = false;
      const end = r => { if (done) return; done = true; try { ws && ws.close(); } catch (e) {} res(r); };
      const t = setTimeout(() => end({ ok: false, why: 'השרת לא הגיב תוך 6 שניות' }), 6000);
      try { ws = new WebSocket(url, 'sip'); } catch (e) { clearTimeout(t); return end({ ok: false, why: 'כתובת לא תקינה' }); }
      ws.onopen = () => { clearTimeout(t); end({ ok: true, why: 'השרת ענה' }); };
      ws.onerror = () => { clearTimeout(t); end({ ok: false, why: 'לא ניתן להתחבר — כתובת, פורט או תעודת SSL' }); };
    });
  }

  window.SIPCFG = {
    get: () => CFG,
    set: (k, v) => { if (typeof k === 'object') Object.assign(CFG, k); else CFG[k] = v; persist(); emit('change', CFG); return CFG; },
    save: persist,
    reset: () => { CFG = Object.assign(JSON.parse(JSON.stringify(DEF)), { pass: '' }); persist(); emit('change', CFG); return CFG; },
    DEF, on, status: () => ST, label,
    connect, disconnect, ua: () => ua, connected: () => ST.state === 'registered',
    rewrite, testRewrite, devices, micTest, spkTest, preflight, probeWss,
  };
})();
