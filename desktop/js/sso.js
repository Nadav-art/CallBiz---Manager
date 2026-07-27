/* ============================================================
   CallBiz Desktop · חיבור אוטומטי מפורטל הנציגים (SSO)
   ------------------------------------------------------------
   נציג שמתחבר לפורטל — מחובר גם כאן. בלי להקליד שוב, ובלי
   שתי סיסמאות שצריך לזכור.

   ארבעה מסלולים, לפי איפה האפליקציה רצה. הראשון שמצליח מנצח:

   1. משובץ (הכי נפוץ)
      שולחן העבודה רץ בתוך המנג׳ר/הפורטל בטאב "שיחות". הפורטל
      כבר יודע מי הנציג, ושולח את הסשן ב-postMessage ברגע שהמסך
      נטען. אפס לחיצות.

   2. פתיחה מהפורטל
      בפורטל יש כפתור "פתח שולחן עבודה". הוא פותח את האפליקציה
      עם אסימון חד-פעמי קצר-מועד בכתובת. האפליקציה פודה אותו
      מול השרת, מקבלת סשן, ומנקה אותו מהכתובת מיד.

   3. אותו מקור
      אם הפורטל והאפליקציה על אותו דומיין — הסשן משותף, וגם
      התחברות בטאב אחר מחברת כאן בזמן אמת.

   4. קוד צימוד
      האפליקציה מותקנת על מחשב אחר. הפורטל מציג קוד בן 6 ספרות,
      הנציג מקליד אותו פעם אחת, והמחשב נזכר.

   אבטחה: האסימון בכתובת הוא חד-פעמי ותקף לדקות ספורות בלבד.
   הסשן עצמו לא נשמר לצמיתות — רק אסימון רענון, ורק אם הנציג
   ביקש "זכור אותי במחשב הזה".
   ============================================================ */
(function () {

  const TK = 'cbd_refresh', DEV = 'cbd_device';
  const L = {};
  const on = (e, f) => { (L[e] = L[e] || []).push(f); };
  const emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (x) { console.error(x); } });

  const S = { state: 'anon', employee: null, via: '', at: 0 };

  function deviceId() {
    let d = localStorage.getItem(DEV);
    if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2)); localStorage.setItem(DEV, d); }
    return d;
  }

  /* ---------------- 1 · משובץ: הפורטל מזהה אותנו לבד ---------------- */
  function embedded() {
    return new Promise(res => {
      if (window.parent === window) return res(null);
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; window.removeEventListener('message', h); res(null); } }, 2500);
      function h(e) {
        const m = e.data;
        if (!m || m.ns !== 'callbiz' || m.dir !== 'crm→desk') return;
        if (m.type !== 'session' && m.type !== 'auth') return;
        done = true; clearTimeout(t); window.removeEventListener('message', h);
        res({ via: 'embedded', session: m.payload, origin: e.origin });
      }
      window.addEventListener('message', h);
      /* מבקשים סשן; אם הפורטל שולח מיוזמתו — נתפוס גם את זה */
      try { window.parent.postMessage({ ns: 'callbiz', dir: 'desk→crm', type: 'hello',
        payload: { device: deviceId(), app: 'desktop', v: window.APP_VERSION } }, '*'); } catch (e) {}
    });
  }

  /* ---------------- 2 · אסימון חד-פעמי בכתובת ---------------- */
  async function fromUrl() {
    const u = new URL(location.href);
    const t = u.searchParams.get('t') || u.searchParams.get('token') || (location.hash.match(/[#&]t=([^&]+)/) || [])[1];
    if (!t) return null;
    /* מנקים מיד — אסימון לא נשאר בהיסטוריית הדפדפן */
    u.searchParams.delete('t'); u.searchParams.delete('token');
    history.replaceState(null, '', u.pathname + (u.search === '?' ? '' : u.search));
    const r = await redeem(t);
    return r ? { via: 'link', session: r } : null;
  }
  /* פדיון האסימון מול השרת. אם אין שרת (הדגמה) — האסימון עצמו
     נושא את הסשן מקודד ב-base64, כדי שהזרימה תהיה מלאה מקצה לקצה. */
  async function redeem(token) {
    const base = window.CB_API || '';
    if (base) {
      try {
        const res = await fetch(base + '/auth/desktop/redeem', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, device: deviceId() }),
        });
        if (res.ok) { const j = await res.json(); if (j.refresh) localStorage.setItem(TK, j.refresh); return j; }
      } catch (e) {}
      return null;
    }
    try { return JSON.parse(decodeURIComponent(escape(atob(token.replace(/-/g, '+').replace(/_/g, '/'))))); }
    catch (e) { return null; }
  }

  /* ---------------- 3 · אותו מקור: סשן משותף וחי ---------------- */
  function sameOrigin() {
    try {
      const raw = localStorage.getItem('cb_session') || localStorage.getItem('cb_portal_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.employee) return null;
      if (s.exp && Date.now() > s.exp) return null;
      return { via: 'same-origin', session: s };
    } catch (e) { return null; }
  }
  /* מאזין חי — התחברות בטאב אחר מחברת גם כאן, בלי רענון */
  window.addEventListener('storage', e => {
    if (e.key !== 'cb_session' && e.key !== 'cb_portal_session') return;
    if (!e.newValue) { logout('הפורטל התנתק'); return; }
    const r = sameOrigin();
    if (r) apply(r);
  });

  /* ---------------- 4 · אסימון רענון שמור ---------------- */
  async function fromRefresh() {
    const r = localStorage.getItem(TK);
    if (!r) return null;
    const base = window.CB_API || '';
    if (!base) return null;
    try {
      const res = await fetch(base + '/auth/desktop/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: r, device: deviceId() }),
      });
      if (!res.ok) { localStorage.removeItem(TK); return null; }
      const j = await res.json();
      if (j.refresh) localStorage.setItem(TK, j.refresh);
      return { via: 'remembered', session: j };
    } catch (e) { return null; }
  }

  /* ---------------- 5 · קוד צימוד ---------------- */
  async function pair(code, remember) {
    const base = window.CB_API || '';
    if (!base) return { ok: false, why: 'צימוד דורש חיבור לשרת' };
    try {
      const res = await fetch(base + '/auth/desktop/pair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(code).replace(/\D/g, ''), device: deviceId(), remember: !!remember }),
      });
      if (!res.ok) return { ok: false, why: res.status === 404 ? 'הקוד לא תקף או פג תוקף' : 'הצימוד נכשל' };
      const j = await res.json();
      if (j.refresh && remember) localStorage.setItem(TK, j.refresh);
      apply({ via: 'pair', session: j });
      return { ok: true };
    } catch (e) { return { ok: false, why: 'אין תקשורת לשרת' }; }
  }

  /* ============================================================
     ההפעלה
     ============================================================ */
  function apply(r) {
    if (!r || !r.session) return false;
    const s = r.session;
    S.state = 'authed'; S.employee = s.employee || null; S.via = r.via; S.at = Date.now(); S.session = s;
    /* מזינים את הסשן לגשר ה-CRM — משם כל המערכת יונקת זהות והרשאות */
    if (window.CRM && CRM.adopt) CRM.adopt(s, r.via);
    emit('auth', S);

    /* וזה הלב של מה שביקשת: מחוברים לפורטל → מחוברים למרכזייה */
    if (s.pbx && window.SIPCFG) {
      SIPCFG.set({ mode: 'managed' });
      if (SIPCFG.get().autoStart !== false) SIPCFG.connect();
      emit('pbx', s.pbx);
    } else if (window.SIPCFG && SIPCFG.get().autoStart !== false && SIPCFG.get().mode === 'managed') {
      SIPCFG.connect();
    }
    return true;
  }
  function logout(why) {
    S.state = 'anon'; S.employee = null; S.session = null;
    localStorage.removeItem(TK);
    if (window.SIPCFG) SIPCFG.disconnect();
    emit('logout', { why });
  }

  /* ניסיון מלא — לפי סדר, הראשון שמצליח */
  async function boot() {
    S.state = 'checking'; emit('state', S);
    const tries = [
      () => fromUrl(),
      () => embedded(),
      () => Promise.resolve(sameOrigin()),
      () => fromRefresh(),
    ];
    for (const t of tries) {
      let r = null;
      try { r = await t(); } catch (e) { r = null; }
      if (r && apply(r)) return S;
    }
    S.state = 'anon'; emit('state', S); emit('need-login', {});
    return S;
  }

  /* קישור לפתיחה מהפורטל — הפורטל בונה אותו עם אסימון אמיתי */
  function launchUrl(token, base) {
    const b = base || (location.origin + location.pathname);
    return b + '?t=' + encodeURIComponent(token);
  }

  window.SSO = { boot, apply, logout, pair, on, state: () => S, deviceId, launchUrl, redeem };
})();
