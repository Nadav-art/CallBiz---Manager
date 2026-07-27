/* ============================================================
   CallBiz Desktop · גשר ה-CRM  —  חוזה האינטגרציה היחיד
   ------------------------------------------------------------
   הדסקטופ עומד בפני עצמו, אבל הזהות וההרשאות אינן שלו: הן מגיעות
   מה-CRM. כל מה שהאפליקציה מציגה ומרשה נגזר מהאובייקט שמוחזר כאן.

   שלושה מצבי עבודה, לפי הסדר:
     1. משובץ (iframe/webview) — תקשורת postMessage עם המנג׳ר
     2. מקומי — שרת CRM אמיתי דרך fetch (TODO(server))
     3. עצמאי — פרופיל הדגמה, מסומן בבירור בממשק

   החוזה כלפי חוץ:
     CRM.session()                → { employee, active, activities, role, perms }
     CRM.lookup(phone)            → { id, name, org, tags, lastCall, url } | null
     CRM.logCall(call)            → רישום שיחה בכרטיס הלקוח
     CRM.screenPop(rec)           → פתיחת הכרטיס במסך המשובץ
     CRM.on(event, fn)            → 'session', 'lookup', 'ready'
   ============================================================ */
(function () {

  const LISTENERS = {};
  const emit = (ev, data) => (LISTENERS[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } });
  const on = (ev, fn) => { (LISTENERS[ev] = LISTENERS[ev] || []).push(fn); };

  /* ---------------- מצב החיבור ---------------- */
  const MODE = { EMBED: 'embedded', SERVER: 'server', DEMO: 'demo' };
  let mode = MODE.DEMO, session = null, ready = false;

  /* פרופיל הדגמה — רק כשאין CRM. מסומן בממשק כדי שלא יבלבל. */
  const DEMO_SESSION = {
    employee: { id: 'yk', name: 'יוסי כהן', role: 'נציג שירות', avatar: 'י', ext: '201' },
    active: true,
    activities: ['שיחות נכנסות', 'פולו-אפ'],
    role: 'agent',
    perms: { call: true, transfer: true, conference: true, record: true,
      viewCrm: true, editCrm: false, diagnostics: true, analytics: true, admin: false },
    tenant: 'callbiz-demo',
    source: 'demo',
  };

  /* ---------------- זיהוי הסביבה ---------------- */
  function detect() {
    if (window.parent && window.parent !== window) { mode = MODE.EMBED; return; }
    if (window.CB_CRM_ENDPOINT) { mode = MODE.SERVER; return; }
    mode = MODE.DEMO;
  }

  /* ---------------- הודעות מהמנג׳ר ---------------- */
  const PENDING = {};
  let seq = 1;
  function send(type, payload) {
    if (mode !== MODE.EMBED) return Promise.resolve(null);
    return new Promise(resolve => {
      const id = 'q' + (seq++);
      PENDING[id] = resolve;
      window.parent.postMessage({ ns: 'callbiz', dir: 'desk→crm', id, type, payload }, '*');
      setTimeout(() => { if (PENDING[id]) { delete PENDING[id]; resolve(null); } }, 2500);
    });
  }
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m || m.ns !== 'callbiz' || m.dir !== 'crm→desk') return;
    if (m.id && PENDING[m.id]) { PENDING[m.id](m.payload); delete PENDING[m.id]; return; }
    /* אירועים יזומים מהמנג׳ר */
    if (m.type === 'session') { session = m.payload; emit('session', session); }
    if (m.type === 'dial' && m.payload && m.payload.phone) emit('dial', m.payload);
  });

  /* ---------------- API ---------------- */
  async function connect() {
    detect();
    if (mode === MODE.EMBED) {
      const s = await send('session');
      if (s) { session = Object.assign({ source: 'crm' }, s); }
    } else if (mode === MODE.SERVER) {
      /* TODO(server): GET {CB_CRM_ENDPOINT}/session עם קוקי/טוקן של המשתמש */
      try {
        const r = await fetch(window.CB_CRM_ENDPOINT + '/session', { credentials: 'include' });
        if (r.ok) session = Object.assign({ source: 'server' }, await r.json());
      } catch (e) { /* נופלים להדגמה */ }
    }
    if (!session) { session = JSON.parse(JSON.stringify(DEMO_SESSION)); mode = MODE.DEMO; }
    ready = true;
    emit('session', session); emit('ready', session);
    return session;
  }

  async function lookup(phone) {
    const digits = String(phone || '').replace(/\D/g, '').slice(-9);
    if (!digits) return null;
    if (mode === MODE.EMBED) {
      const r = await send('lookup', { phone: digits });
      if (r) return r;
    }
    /* הדגמה — כמה לקוחות מוכרים כדי שה-screen-pop יהיה אמיתי */
    const DEMO = [
      { id: 1, name: 'שרה לוי', org: 'לוי ובניו', phone: '521234567', tags: ['לקוח קיים', 'VIP'], lastCall: 'לפני 3 ימים' },
      { id: 2, name: 'דנה לוי', org: 'Tech Solutions', phone: '537654321', tags: ['ליד חם'], lastCall: 'אתמול' },
      { id: 3, name: 'אבי רוזן', org: 'Zohar Group', phone: '541112222', tags: ['שירות'], lastCall: 'לפני שבוע' },
    ];
    return DEMO.find(x => x.phone.slice(-9) === digits) || null;
  }

  function logCall(call) {
    const rec = {
      phone: call.phone, dir: call.dir, startedAt: call.startedAt, seconds: call.seconds,
      outcome: call.outcome, quality: call.quality, transport: call.transport,
      recorded: !!call.recorded, notes: call.notes || '',
      /* ההקלטה עצמה נשארת במרכזייה — נשמר רק המזהה שמאפשר לפתוח אותה */
      recordingId: call.recordingId || null, recordingUrl: call.recordingUrl || null,
      id: call.id, agent: (session && session.employee) ? session.employee.id : null,
    };
    if (mode === MODE.EMBED) send('logCall', rec);
    /* TODO(server): POST /calls */
    const all = JSON.parse(localStorage.getItem('cbd_calls') || '[]');
    all.unshift(Object.assign({ id: rec.id || ('c' + Date.now()) }, rec));
    localStorage.setItem('cbd_calls', JSON.stringify(all.slice(0, 200)));
    emit('logged', rec);
    return rec;
  }
  /* המרכזייה מחזירה קישור בסיום — מעדכנים את הרשומה השמורה */
  function attachRecording(callId, url) {
    const all = JSON.parse(localStorage.getItem('cbd_calls') || '[]');
    const c = all.find(x => x.id === callId);
    if (c) { c.recordingUrl = url; localStorage.setItem('cbd_calls', JSON.stringify(all)); }
    if (mode === MODE.EMBED) send('recording', { callId, url });
    emit('recording', { callId, url });
    return c;
  }
  function screenPop(rec) { if (mode === MODE.EMBED) send('screenPop', rec); emit('screenPop', rec); }

  const can = k => !!(session && session.perms && session.perms[k]);
  const isActive = () => !!(session && session.active);

  /* ---------------- אימוץ סשן מבחוץ (SSO) ----------------
     כשפורטל הנציגים מזהה את העובד, הוא מוסר לנו את הסשן. משם
     והלאה זה מקור האמת — בדיוק כמו סשן שהתקבל מהמנג׳ר. */
  function adopt(s, via) {
    if (!s) return null;
    session = Object.assign({ source: via || 'sso' }, s);
    if (via === 'embedded') mode = MODE.EMBED;
    else if (window.CB_API || window.CB_CRM_ENDPOINT) mode = MODE.SERVER;
    ready = true;
    emit('session', session); emit('ready', session);
    return session;
  }

  /* ---------------- פרטי חיבור למרכזייה ----------------
     המקור היחיד לשלוחה של הנציג. שלושה מקורות אפשריים, לפי
     מה שקיים: הסשן עצמו, המנג׳ר המשובץ, או נקודת קצה בשרת. */
  async function pbxCreds(opts) {
    if (session && session.pbx && session.pbx.user) return session.pbx;
    if (mode === MODE.EMBED) {
      const r = await send('pbx', opts || {});
      if (r && r.user) { if (session) session.pbx = r; return r; }
    }
    const base = window.CB_API || window.CB_CRM_ENDPOINT;
    if (base) {
      try {
        const r = await fetch(base + '/pbx/provision', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ employeeId: (session && session.employee || {}).id }, opts || {})),
        });
        if (r.ok) { const j = await r.json(); if (session) session.pbx = j; return j; }
      } catch (e) {}
    }
    return null;
  }

  window.CRM = { connect, lookup, logCall, attachRecording, screenPop, on, can, isActive,
    adopt, pbxCreds,
    session: () => session, mode: () => mode, ready: () => ready, MODE,
    calls: () => JSON.parse(localStorage.getItem('cbd_calls') || '[]') };
})();
