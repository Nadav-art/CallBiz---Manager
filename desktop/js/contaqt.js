/* ============================================================
   CallBiz Desktop · שכבת ה-API של המרכזייה (Reshetcall)
   ------------------------------------------------------------
   הדוקומנטציה של הספק פותחת דרך שנייה, ובמובנים רבים טובה יותר,
   מזו שהתחלנו בה.

   שתי דרכים לבצע שיחה:

   A · דרך ה-API  ("Click to Call")
       אנחנו לא מעבירים קול בכלל. שולחים בקשה למרכזייה, היא
       מצלצלת למכשיר של הנציג, הוא עונה, והיא מחברת אותו ליעד.
       הקול עובר בין המרכזייה למכשיר — לא דרכנו.
       יתרונות: עובד מיד, בלי WebRTC, בלי חומות אש, ואיכות הקול
       היא של המרכזייה. חיסרון: צריך מכשיר שיצלצל.

   B · דרך WebRTC  (מחסנית ה-SIP שכתבנו)
       הקול עובר דרכנו. מכשיר מסוג WebRTC נדרש במרכזייה.

   השתיים לא סותרות — הן משלימות. המערכת בוחרת לפי מה שזמין,
   וזה מה ש-`mode` עושה כאן.

   מה שה-API נותן ולא היה לנו:
     · רשימת המספרים המזוהים המותרים לנציג  (user.dids)
     · Check-in / Check-out — שיוך מכשיר לנציג
     · הצטרפות ועזיבה של תורים, והפסקות
     · שיחות פעילות בזמן אמת
     · קישור להקלטה לפי מזהה שיחה — בלי לאחסן כלום אצלנו
     · Webhooks על כל אירוע שיחה

   ------------------------------------------------------------
   אזהרת אבטחה שחשוב שתישאר כאן:
   ה-api_key הוא מפתח מלא לחשבון. אסור להטמיע אותו בקוד שרץ
   בדפדפן של נציג — כל אחד יוכל לפתוח את הקוד ולקחת אותו.
   לכן ברירת המחדל היא 'proxy': הבקשות עוברות דרך השרת שלנו,
   שמחזיק את המפתח ומאמת שהנציג רשאי לבצע את הפעולה.
   מצב 'direct' קיים לפיתוח ולבדיקה בלבד.
   ============================================================ */
(function () {

  const CFG = {
    base: '',              /* https://callbiz.contaqt.com */
    key: '',               /* רק במצב direct */
    via: 'proxy',          /* proxy (בטוח) | direct (פיתוח בלבד) */
    proxy: '/api/pbx',     /* נקודת הקצה אצלנו שמעבירה הלאה */
    userId: null, deviceId: null,
  };
  const L = {};
  const on = (e, f) => { (L[e] = L[e] || []).push(f); };
  const emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (x) { console.error(x); } });

  function configure(o) { Object.assign(CFG, o || {}); return CFG; }

  /* ---------------- קריאה ---------------- */
  async function call(path, params, opts) {
    opts = opts || {};
    const q = Object.assign({}, params || {});
    Object.keys(q).forEach(k => (q[k] == null || q[k] === '') && delete q[k]);

    let url, init = { method: opts.method || 'GET', headers: {} };
    if (CFG.via === 'direct') {
      if (!CFG.base) throw new Error('לא הוגדרה כתובת המרכזייה');
      q.api_key = CFG.key;
      url = CFG.base.replace(/\/$/, '') + path + '?' + new URLSearchParams(q);
    } else {
      /* השרת שלנו מוסיף את המפתח ומאמת הרשאה */
      url = CFG.proxy + path + '?' + new URLSearchParams(q);
      init.credentials = 'include';
    }
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }

    let r;
    try { r = await fetch(url, init); }
    catch (e) {
      /* חסימת CORS נראית בדיוק כמו נפילת רשת — מבחינים לפי המצב */
      const why = CFG.via === 'direct'
        ? 'הדפדפן חסם את הבקשה (CORS). קריאות ישירות למרכזייה דורשות אישור מהספק — עדיף לעבור דרך השרת.'
        : 'אין תקשורת לשרת';
      emit('error', { path, msg: why });
      return { success: false, msg: why, network: true };
    }
    if (r.status === 401) { emit('error', { path, msg: 'מפתח ה-API אינו תקף' }); return { success: false, msg: 'Unauthorized' }; }
    let j;
    try { j = await r.json(); } catch (e) { return { success: false, msg: 'תשובה לא תקינה מהמרכזייה' }; }
    if (!j.success) emit('error', { path, msg: j.msg || 'הפעולה נדחתה' });
    return j;
  }

  /* ============================================================
     שיחות
     ============================================================ */
  /* חיוג דרך המרכזייה. הנציג יקבל צלצול, ורק כשיענה — היעד יחויג.
     sip_auto_answer חוסך לו את המענה בטלפונים שתומכים בזה. */
  async function originate(o) {
    o = o || {};
    if (!o.destination) return { success: false, msg: 'חסר מספר יעד' };
    const r = await call('/api/cc_agent/originate', {
      destination: o.destination,
      device_id: o.deviceId || CFG.deviceId,
      user_id: o.deviceId ? null : (o.userId || CFG.userId),
      extension: o.extension,
      cid: o.cid, cnam: o.cnam,
      display_cid: o.displayCid, display_cnam: o.displayCnam,
      lead_id: o.leadId,
      sip_auto_answer: o.autoAnswer === false ? null : 1,
    });
    if (r.success) emit('originated', { uuid: r.uuid, destination: o.destination });
    return r;
  }
  const activeCalls = f => call('/api/cc_agent/active_calls', {
    user_id: (f && f.userId) || CFG.userId, ext_user_id: f && f.extUserId,
    lead_id: f && f.leadId, queue_id: f && f.queueId });
  const bargeMedia = (mediaId, stop) => call('/api/cc_agent/barge_media',
    { user_id: CFG.userId, media_id: mediaId, stop: stop ? 1 : null });

  /* ============================================================
     נוכחות הנציג
     ------------------------------------------------------------
     זה מה שממש חשוב: check-in משייך מכשיר לנציג, וזה תנאי
     לקבלת שיחות מהתור. בלי זה הנציג "מחובר" אצלנו ולא קיים
     מבחינת המרכזייה — בדיוק סוג התקלה שמסך הניתוח נועד לתפוס.
     ============================================================ */
  async function checkIn(o) {
    o = o || {};
    /* עם device_id אין צורך בפעולה מצד הנציג */
    if (o.deviceId || CFG.deviceId) {
      const r = await call('/api/cc_agent/checkInDevice', {
        user_id: o.userId || CFG.userId, device_id: o.deviceId || CFG.deviceId,
        forceCheckOut: o.force ? 1 : null });
      if (r.success) emit('checkin', { deviceId: o.deviceId || CFG.deviceId });
      return r;
    }
    /* בלי מכשיר — המרכזייה מחזירה מספר שהנציג צריך לחייג אליו */
    const r = await call('/api/cc_agent/checkIn', {
      user_id: o.userId || CFG.userId, forceCheckOut: o.force ? 1 : null });
    if (r.success && r.data) emit('checkin-dial', { number: r.data });
    return r;
  }
  const checkOut = userId => call('/api/cc_agent/checkOut', { user_id: userId || CFG.userId })
    .then(r => { if (r.success) emit('checkout', {}); return r; });
  const setPause = (pauseId, userId) => call('/api/cc_agent/setPause',
    { id: pauseId || 0, user_id: userId || CFG.userId })
    .then(r => { if (r.success) emit('pause', { pauseId: pauseId || 0 }); return r; });
  const available = userId => setPause(0, userId);
  const setQueues = (ids, userId) => call('/api/cc_agent/setQueues',
    { queue_ids: Array.isArray(ids) ? ids.join(',') : ids, user_id: userId || CFG.userId });
  const wrapUp = (seconds, userId) => call('/api/cc_agent/wrapup',
    { user_id: userId || CFG.userId, seconds: seconds });

  /* ============================================================
     נציגים, מכשירים ומספרים מזוהים
     ============================================================ */
  const user = id => call('/api/user/' + (id || CFG.userId));
  const users = q => call('/api/user', { q, is_agent: 1 });

  /* מה שהנציג באמת צריך: מי הוא, אילו מכשירים יש לו, ואילו
     מספרים מזוהים מותר לו להציג. הכל משורת משתמש אחת. */
  async function profile(id) {
    const r = await user(id);
    if (!r.success || !r.data) return null;
    const u = r.data;
    return {
      id: u.id, name: u.name, username: u.username, email: u.email,
      active: u.active === 1 || u.active === true,
      isAgent: !!u.is_agent,
      extUserId: u.ext_user_id || null,
      devices: u.devices || [],
      webDeviceId: u.web_device_id || null,
      extensions: String(u.extensions || '').split(',').filter(Boolean),
      /* המספרים המזוהים — בדיוק הרשימה שמופיעה בחייגן שלהם */
      dids: String(u.dids || '').split(',').filter(Boolean),
      queues: u.queues || [],
      online: !!u.online,
      pauseId: u.pause_id || 0,
      permissions: u.permissions || {},
      callWaiting: !!u.call_waiting,
      wrapUpTime: u.wrap_up_time, wrapUpOut: u.wrap_up_out,
      timezone: u.timezone,
    };
  }
  const queues = () => call('/api/cc_quque');
  const queueAgents = id => call('/api/cc_queue/' + id + '/users');

  /* ============================================================
     הקלטות — קישור בלבד, שום קובץ אצלנו
     ------------------------------------------------------------
     בדיוק המודל שביקשת: המרכזייה מחזיקה את ההקלטה, אנחנו
     מחזיקים מזהה שיחה. הכתובת נבנית ממנו ולא נחשפת לנציג.
     ============================================================ */
  function recordingUrl(uuid) {
    if (!uuid) return null;
    if (CFG.via === 'direct') return CFG.base.replace(/\/$/, '') + '/api/cdr/recordings/' + uuid + '.mp3';
    return CFG.proxy + '/recording/' + uuid;     /* השרת מאמת הרשאה ומזרים */
  }
  /* פותח את ההקלטה בלי להראות כתובת — הנגן מקבל blob */
  async function recording(uuid) {
    const url = recordingUrl(uuid);
    if (!url) return null;
    try {
      const r = await fetch(url, CFG.via === 'direct' ? {} : { credentials: 'include' });
      if (!r.ok) return null;
      const b = await r.blob();
      return URL.createObjectURL(b);
    } catch (e) { return null; }
  }

  /* ============================================================
     אירועים
     ------------------------------------------------------------
     המרכזייה דוחפת Webhooks לכתובת שמוגדרת בחשבון — כלומר
     לשרת שלנו, לא לדפדפן. עד שיהיה שרת, מדגמים שיחות פעילות.
     כשיהיה — מחליפים ל-WebSocket ומכבים את הדגימה, בלי לשנות
     שורה בממשק.
     ============================================================ */
  const EV = ['call:ring', 'call:answer', 'call:end', 'call:start',
    'agent:checkin', 'agent:checkout', 'agent:status', 'queue:join', 'queue:leave'];
  let poll = null, seen = {};
  function watch(ms) {
    stop();
    poll = setInterval(async () => {
      const r = await activeCalls();
      if (!r.success) return;
      const now = {};
      (r.data || []).forEach(c => {
        now[c.uuid] = c;
        if (!seen[c.uuid]) emit('call:ring', c);
        else if (seen[c.uuid].state !== c.state && c.state === 'Answer') emit('call:answer', c);
      });
      Object.keys(seen).forEach(u => { if (!now[u]) emit('call:end', seen[u]); });
      seen = now;
      emit('active', r.data || []);
    }, ms || 3000);
  }
  function stop() { clearInterval(poll); poll = null; }
  /* כשהשרת קיים — הוא מזרים את אותם אירועים בדיוק */
  function attachStream(ws) {
    ws.addEventListener('message', e => {
      try { const m = JSON.parse(e.data); if (EV.indexOf(m.event) >= 0) emit(m.event, m.data); }
      catch (x) {}
    });
    stop();
  }

  /* ---------------- בדיקת חיבור ---------------- */
  async function test() {
    const r = await call('/api/user', { q: '' });
    if (r.network) return { ok: false, why: r.msg,
      fix: 'הפעילו את המערכת דרך השרת שלנו, או בקשו מהספק לאשר CORS לדומיין שלכם' };
    if (!r.success) return { ok: false, why: r.msg || 'המפתח נדחה',
      fix: 'צרו מפתח בממשק: משתמשים → המשתמש → אבטחה → API Auth Key, והוסיפו הרשאת Call Center API' };
    return { ok: true, why: 'ה-API עונה · ' + ((r.data || []).length) + ' משתמשים' };
  }

  window.PBXAPI = { configure, cfg: () => CFG, call, on,
    originate, activeCalls, bargeMedia,
    checkIn, checkOut, setPause, available, setQueues, wrapUp,
    user, users, profile, queues, queueAgents,
    recordingUrl, recording, watch, stop, attachStream, test, EVENTS: EV };
})();
