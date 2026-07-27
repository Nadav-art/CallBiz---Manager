/* ============================================================
   CallBiz Desktop · אספקה אוטומטית (Provisioning)
   ------------------------------------------------------------
   המטרה: נציג שמתקין את המערכת לא מקליד כתובות, פורטים ונתיבים.
   במקרה הטוב הוא לא מקליד כלום, ובמקרה הרגיל — רק את מספר
   השלוחה שלו.

   שלוש שכבות, מהחזקה לחלשה. הראשונה שמצליחה — מנצחת:

   1. אספקה מהשרת  (ProfileSource = 'server')
      המנג׳ר מחזיר את פרטי החיבור של הנציג המחובר. הנציג לא
      מקליד כלום ולא רואה סיסמה. זו הדרך הנכונה לארגון.
        POST /api/pbx/provision  { employeeId }
        →   { wss, domain, user, pass, callerId, displayName }

   2. פרופיל ארגוני + שלוחה  (ProfileSource = 'tenant')
      המנהל מגדיר פעם אחת את המרכזייה של העסק. הנציג מקליד
      מספר שלוחה וסיסמה, וזהו. הכתובת, הפורט והנתיב מתגלים לבד.

   3. גילוי מדומיין  (ProfileSource = 'discover')
      נותנים רק "pbx.example.co.il" — המערכת סורקת את הכתובות
      המקובלות ומוצאת את המאזין הפעיל.

   הגילוי הוא אמיתי: פותחים WebSocket עם תת-פרוטוקול "sip" לכל
   מועמד במקביל, והראשון שנענה הוא הכתובת. אין ניחוש.
   ============================================================ */
(function () {

  /* ---------------- מועמדי כתובת ----------------
     לפי מה שמרכזיות באמת חושפות בברירת מחדל. הסדר הוא סדר
     הסבירות, אבל הסריקה מקבילה — הראשון שנענה מנצח. */
  const CANDIDATES = [
    { port: 8089, path: '/ws',      pbx: 'Asterisk (PJSIP)' },
    { port: 8089, path: '/asterisk/ws', pbx: 'Asterisk מאחורי proxy' },
    { port: 7443, path: '',         pbx: 'FreeSWITCH' },
    { port: 443,  path: '/ws',      pbx: 'Kamailio / OpenSIPS' },
    { port: 443,  path: '',         pbx: 'שער WSS ייעודי' },
    { port: 8443, path: '/ws',      pbx: 'שער חלופי' },
    { port: 5065, path: '',         pbx: 'מאזין WS ישיר' },
  ];
  const CKEY = 'cbd_wss_cache';

  /* ---------------- ספקים מוכרים ----------------
     כשמזהים את הספק אפשר לדלג על הסריקה ולגשת ישר לכתובת
     הנכונה. זה גם מה שמאפשר לנציג להקליד רק שלוחה: הדומיין
     של המרכזייה כבר ידוע מהחשבון. */
  const PROVIDERS = [
    /* אומת מול החשבון בפועל: המאזין יושב על 443/ws ולא על 7443
       — Contaqt מציבים את FreeSWITCH מאחורי proxy. */
    { id: 'contaqt', name: 'Contaqt (FreeSWITCH)',
      match: /(^|\.)sip\.io$/i,
      wss: d => 'wss://' + d + '/ws',
      portal: 'callbiz.contaqt.com',
      note: 'מרכזייה מבוססת FreeSWITCH מאחורי proxy. מאזין ה-WSS על 443 בנתיב /ws, שם המשתמש הוא מספר השלוחה, והדומיין הוא ה-FS Domain של החשבון.' },
    { id: 'asterisk', name: 'Asterisk',
      match: /^(pbx|sip|voip)\./i,
      wss: d => 'wss://' + d + ':8089/ws',
      note: 'ברירת המחדל של Asterisk עם PJSIP: פורט 8089 ונתיב /ws.' },
  ];
  const providerOf = d => PROVIDERS.find(p => p.match.test(clean(d))) || null;

  /* חשבון ברירת מחדל — הדומיין בלבד, בלי סיסמאות.
     נטען פעם אחת בהתקנה ראשונה, וניתן לשינוי מהמסך. */
  const SEED = { name: 'CallBiz', domain: 'a1053.sip.io', wss: 'wss://a1053.sip.io/ws',
    pbx: 'Contaqt (FreeSWITCH)', portal: 'callbiz.contaqt.com' };

  const clean = d => String(d || '').trim()
    .replace(/^\w+:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');

  /* בדיקת מועמד יחיד: האם נפתח סוקט SIP */
  function probe(url, ms) {
    return new Promise(res => {
      let ws, done = false;
      const t0 = Date.now();
      const end = ok => { if (done) return; done = true; clearTimeout(t);
        try { ws && ws.close(); } catch (e) {} res(ok ? { url, ms: Date.now() - t0 } : null); };
      const t = setTimeout(() => end(false), ms || 5000);
      try { ws = new WebSocket(url, 'sip'); } catch (e) { return end(false); }
      ws.onopen = () => end(true);
      ws.onerror = () => end(false);
      ws.onclose = () => end(false);
    });
  }

  /* גילוי מלא — סורק את כל המועמדים במקביל ומחזיר את המהיר ביותר */
  async function discover(domain, opts) {
    opts = opts || {};
    const d = clean(domain);
    if (!d) return { ok: false, why: 'לא הוזן דומיין' };

    /* ספק מוכר — בודקים קודם את הכתובת שלו, וחוסכים סריקה שלמה */
    const prov = providerOf(d);
    if (prov && !opts.fresh) {
      const r = await probe(prov.wss(d), 6000);
      if (r) {
        remember(d, prov.wss(d), prov.name);
        return { ok: true, url: prov.wss(d), pbx: prov.name, ms: r.ms, provider: prov.id };
      }
    }

    if (!opts.fresh) {
      try {
        const c = JSON.parse(localStorage.getItem(CKEY) || '{}');
        if (c[d] && Date.now() - c[d].at < 7 * 864e5) return { ok: true, url: c[d].url, pbx: c[d].pbx, cached: true };
      } catch (e) {}
    }

    const list = CANDIDATES.map(c => ({
      url: 'wss://' + d + (c.port === 443 ? '' : ':' + c.port) + c.path, pbx: c.pbx }));
    if (opts.onStep) opts.onStep({ total: list.length });

    const results = await Promise.all(list.map(async c => {
      const r = await probe(c.url, 5000);
      if (opts.onStep) opts.onStep({ url: c.url, ok: !!r, pbx: c.pbx });
      return r ? Object.assign({}, c, r) : null;
    }));
    const hits = results.filter(Boolean).sort((a, b) => a.ms - b.ms);
    if (!hits.length) return { ok: false, why: 'לא נמצא מאזין WSS בדומיין הזה', tried: list.map(x => x.url) };

    const best = hits[0];
    remember(d, best.url, best.pbx);
    return { ok: true, url: best.url, pbx: best.pbx, ms: best.ms, others: hits.slice(1).map(x => x.url) };
  }
  function remember(d, url, pbx) {
    try {
      const c = JSON.parse(localStorage.getItem(CKEY) || '{}');
      c[d] = { url, pbx, at: Date.now() };
      localStorage.setItem(CKEY, JSON.stringify(c));
    } catch (e) {}
  }

  /* ============================================================
     הפרופיל הארגוני — מוגדר פעם אחת, משרת את כל הנציגים
     ============================================================ */
  const PKEY = 'cbd_tenant_pbx';
  const emptyProfile = () => ({
    name: '', domain: '', wss: '', pbx: '', outPrefix: '', callerId: '',
    passMode: 'agent',      /* agent = כל נציג עם סיסמה משלו | shared | server */
    sharedPass: '', setAt: '',
  });
  function profile() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) {}
    /* התקנה ראשונה — נטען הדומיין של החשבון, בלי סיסמאות */
    if (!saved) saved = Object.assign({}, SEED);
    return Object.assign(emptyProfile(), saved);
  }
  function setProfile(p) {
    const v = Object.assign(profile(), p, { setAt: new Date().toISOString() });
    try { localStorage.setItem(PKEY, JSON.stringify(v)); } catch (e) {}
    return v;
  }
  const hasProfile = () => !!(profile().wss || profile().domain);

  /* ============================================================
     מה הנציג באמת צריך להקליד
     ============================================================ */
  function requirement() {
    if (window.CRM && CRM.mode() !== 'demo' && CRM.pbxCreds) return { need: 'nothing', src: 'server' };
    const p = profile();
    if (p.wss || p.domain) return { need: p.passMode === 'agent' ? 'ext+pass' : 'ext', src: 'tenant', profile: p };
    return { need: 'all', src: 'discover' };
  }

  /* ============================================================
     החיבור עצמו — מרכיב את פרטי החשבון המלאים מכל מקור שיש
     ============================================================ */
  async function resolve(input) {
    input = input || {};
    const out = { ok: false };

    /* 1 · אספקה מהשרת */
    if (window.CRM && CRM.pbxCreds) {
      try {
        const s = await CRM.pbxCreds(input.ext ? { ext: input.ext } : undefined);
        if (s && s.wss && s.user) return Object.assign({ ok: true, src: 'server' }, s);
        if (s && s.domain && s.user) {
          const d = await discover(s.domain);
          if (d.ok) return Object.assign({ ok: true, src: 'server+discover', pbx: d.pbx }, s, { wss: d.url });
        }
      } catch (e) { /* ממשיכים לשכבה הבאה */ }
    }

    /* 2 · פרופיל ארגוני */
    const p = profile();
    if (p.wss || p.domain) {
      let wss = p.wss;
      if (!wss) {
        const d = await discover(p.domain);
        if (!d.ok) return { ok: false, why: d.why, src: 'tenant' };
        wss = d.url; setProfile({ wss, pbx: d.pbx });
      }
      const user = String(input.ext || '').trim();
      if (!user) return { ok: false, why: 'הזינו מספר שלוחה', src: 'tenant', need: 'ext' };
      const pass = p.passMode === 'shared' ? p.sharedPass : input.pass;
      if (p.passMode === 'agent' && !pass) return { ok: false, why: 'הזינו סיסמה', src: 'tenant', need: 'pass' };
      return { ok: true, src: 'tenant', wss, domain: p.domain || hostOf(wss), user, pass,
        callerId: p.callerId || '', displayName: input.name || '' };
    }

    /* 3 · גילוי מדומיין שהוזן ידנית */
    if (input.domain) {
      const d = await discover(input.domain, { fresh: input.fresh });
      if (!d.ok) return { ok: false, why: d.why, tried: d.tried, src: 'discover' };
      return { ok: true, src: 'discover', pbx: d.pbx, wss: d.url, domain: clean(input.domain),
        user: input.ext, pass: input.pass, callerId: input.callerId || '' };
    }
    out.why = 'חסרים פרטי חיבור';
    return out;
  }
  const hostOf = u => String(u).replace(/^wss?:\/\//, '').split('/')[0].split(':')[0];

  /* ============================================================
     חיבור בלחיצה אחת — מגלה, מרכיב, שומר ומתחבר
     ============================================================ */
  async function autoConnect(input, onStep) {
    const step = s => { try { onStep && onStep(s); } catch (e) {} };
    step({ t: 'מאתר את המרכזייה…' });
    const r = await resolve(input);
    if (!r.ok) { step({ t: r.why, err: true }); return r; }
    step({ t: 'נמצא ' + (r.pbx ? r.pbx + ' · ' : '') + hostOf(r.wss), ok: true });

    SIPCFG.set({ mode: 'manual', wss: r.wss, domain: r.domain, user: r.user,
      pass: r.pass || SIPCFG.get().pass, callerId: r.callerId || SIPCFG.get().callerId,
      displayName: r.displayName || SIPCFG.get().displayName });

    step({ t: 'מזדהה מול המרכזייה…' });
    const ok = await new Promise(res => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res({ ok: false, why: 'אין תשובה מהמרכזייה' }); } }, 15000);
      SIPCFG.on('state', function h(st) {
        if (done) return;
        if (st.state === 'registered') { done = true; clearTimeout(t); res({ ok: true }); }
        if (st.state === 'failed') { done = true; clearTimeout(t); res({ ok: false, why: st.error }); }
      });
      SIPCFG.connect();
    });
    if (!ok.ok) { step({ t: ok.why || 'ההזדהות נכשלה', err: true }); return { ok: false, why: ok.why }; }
    step({ t: 'מחובר · שלוחה ' + r.user, ok: true, done: true });
    return { ok: true, account: r };
  }

  window.PROV = { discover, probe, profile, setProfile, hasProfile, emptyProfile,
    requirement, resolve, autoConnect, CANDIDATES, clean };
})();
