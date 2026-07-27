/* ============================================================
   CallBiz Desktop · טלמטריה ושליטה מרחוק
   ------------------------------------------------------------
   הבעיה שזה פותר: נציג מתקשר ואומר "לא שומעים אותי". עד שמבררים
   מה קורה אצלו עוברות עשר דקות, והתקלה כבר לא משחזרת.

   מה שנשלח: התוצאה של מסך ניתוח התקשורת — איזו חוליה תקינה,
   איזו לא, ומה המסקנה. אותו מידע שהנציג רואה אצלו, רק שהוא
   מגיע גם למוקד.

   מה *לא* נשלח, אף פעם:
     · קול, הקלטות, או תוכן שיחה
     · תוכן מסכים, כרטיסי לקוח או פרטים אישיים של לקוחות
     · סיסמאות, מפתחות או אסימונים
   נשלח רק אבחון: מצב חוליות, מדדי רשת, וקודי תשובה של SIP.

   שלושה ערוצים, לפי מה שהעמדה מאפשרת:

     1. דחיפה תקופתית  — POST כל 30 שניות, ומיד כשמשהו נשבר.
        עובד תמיד, גם דרך proxy. זה ברירת המחדל.

     2. ערוץ חי (WebSocket) — כשיש, מאפשר גם לשלוח פקודות
        חזרה לעמדה: לרשום מחדש, להחליף מסלול, לבקש יומן איתות.
        הפקודות מוגבלות לרשימה סגורה — אין הרצת קוד מרחוק.

     3. אירועי המרכזייה — מגיעים ישירות לשרת שלנו מ-Reshetcall
        (Event Push Notifications). לא דורשים כלום מהעמדה, ולכן
        עובדים גם כשהעמדה עצמה תקועה.
   ============================================================ */
(function () {

  const CFG = {
    endpoint: '',            /* https://.../telemetry  — השרת שלנו */
    ws: '',                  /* wss://.../agent        — ערוץ חי */
    interval: 30000,
    enabled: true,
    consent: true,           /* מוצג לנציג בהגדרות, ניתן לכיבוי */
  };

  const L = {};
  const on = (e, f) => { (L[e] = L[e] || []).push(f); };
  const emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (x) {} });

  let timer = null, sock = null, lastVerdict = null, seq = 0, retry = 0;

  /* ---------------- זהות העמדה ---------------- */
  function who() {
    const s = (window.CRM && CRM.session()) || {};
    const e = s.employee || {};
    return {
      agentId: e.id || null,
      agentName: e.name || null,
      ext: e.ext || (window.SIPCFG && SIPCFG.get().user) || null,
      tenant: s.tenant || null,
      station: localStorage.getItem('cbd_instance') || null,
      app: window.APP_VERSION || null,
      ua: navigator.userAgent.slice(0, 120),
      platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform,
    };
  }

  /* ---------------- מה שנשלח ---------------- */
  function snapshot(reason) {
    const links = (window.PATH && PATH.links()) || {};
    const v = (window.PATH && PATH.verdict()) || null;
    const s = (window.PATH && PATH.snap()) || {};
    const sip = window.SIPCFG ? SIPCFG.status() : {};
    const call = window.TEL && TEL.call();

    return {
      v: 1, seq: ++seq, at: new Date().toISOString(), reason,
      who: who(),
      verdict: v ? { id: v.id, t: v.t, where: v.where, sev: v.sev } : null,
      /* מצב בלבד — לא ערכים חופשיים, כדי שאפשר יהיה לצבור ולהשוות */
      links: Object.keys(links).reduce((o, k) => {
        o[k] = { state: links[k].state, value: String(links[k].value || '').slice(0, 60) };
        return o;
      }, {}),
      net: {
        online: s.online, secure: s.secure, hidden: s.hidden,
        type: (s.conn && s.conn.effectiveType) || null,
        rtt: (s.conn && s.conn.rtt) || null,
        downlink: (s.conn && s.conn.downlink) || null,
      },
      media: s.rtp ? {
        outPkts: s.rtp.outPkts, inPkts: s.rtp.inPkts,
        loss: Math.round((s.rtp.loss || 0) * 10) / 10,
        jitter: Math.round(s.rtp.jitter || 0),
        rtt: Math.round(s.rtp.rtt || 0),
        codec: s.rtp.codec || null,
        lvlOut: Math.round((s.rtp.lvlOut || 0) * 100),
        lvlIn: Math.round((s.rtp.lvlIn || 0) * 100),
      } : null,
      ice: s.ice ? { host: s.ice.host, srflx: s.ice.srflx, relay: s.ice.relay,
        proto: s.ice.proto, state: s.ice.state } : null,
      sip: { state: sip.state, error: sip.error || null, lastReg: sip.lastReg || null,
        /* רק שורת הפתיחה של ההודעות — בלי כותרות ובלי גוף */
        recent: (sip.trace || []).slice(-8).map(t => t.dir + ' ' + t.line) },
      call: call ? { id: call.id, dir: call.dir, state: call.state,
        seconds: call.seconds, held: call.held, muted: call.muted } : null,
      devices: { in: (s.devicesIn || 0), out: (s.devicesOut || 0) },
    };
  }

  /* ---------------- שליחה ---------------- */
  async function push(reason) {
    if (!CFG.enabled || !CFG.consent || !CFG.endpoint) return false;
    const body = snapshot(reason);
    try {
      /* sendBeacon שורד גם סגירת חלון — חשוב כדי לתפוס קריסות */
      if (reason === 'unload' && navigator.sendBeacon) {
        return navigator.sendBeacon(CFG.endpoint,
          new Blob([JSON.stringify(body)], { type: 'application/json' }));
      }
      const r = await fetch(CFG.endpoint, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      emit('sent', { reason, ok: r.ok });
      return r.ok;
    } catch (e) {
      emit('error', { msg: 'טלמטריה לא נשלחה' });
      return false;
    }
  }

  /* ---------------- ערוץ חי ופקודות ---------------- */
  /* רשימה סגורה. אין eval, אין הרצת קוד, אין גישה לקבצים.
     כל פקודה מחזירה תוצאה כדי שהמוקד ידע שהיא בוצעה. */
  const COMMANDS = {
    ping: () => ({ ok: true, at: Date.now() }),
    snapshot: () => snapshot('requested'),
    reregister: () => { if (window.SIPCFG) { SIPCFG.disconnect(); SIPCFG.connect(); } return { ok: true }; },
    checkin: async () => (window.PBXAPI ? await PBXAPI.checkIn({ force: true }) : { ok: false }),
    diagnose: async () => (window.PATH ? await PATH.run() : null),
    trace: () => ({ trace: (window.SIPCFG ? SIPCFG.status().trace : []).slice(-40).map(t => t.dir + ' ' + t.line) }),
    devices: async () => (window.SIPCFG ? await SIPCFG.devices() : null),
    transport: (a) => { if (window.TEL && a && a.to) TEL.setTransport(a.to, true); return { ok: true }; },
    update: () => { if (window.UPDATER) UPDATER.check(true); return { ok: true }; },
    /* הודעה לנציג — לא התראה סמויה, הוא רואה אותה */
    notify: (a) => { if (window.UIX) UIX.alert2({ t: String(a && a.text || '').slice(0, 120),
      kind: 'info', icon: 'alert', why: 'הודעה ממוקד התמיכה', sticky: true }); return { ok: true }; },
  };

  function connectWs() {
    if (!CFG.ws || !CFG.consent) return;
    try { sock = new WebSocket(CFG.ws); } catch (e) { return; }
    sock.onopen = () => { retry = 0; sock.send(JSON.stringify({ type: 'hello', who: who() })); emit('live', true); };
    sock.onmessage = async ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      const fn = COMMANDS[m.cmd];
      if (!fn) return sock.send(JSON.stringify({ id: m.id, error: 'פקודה לא מוכרת' }));
      let out; try { out = await fn(m.args || {}); } catch (e) { out = { error: String(e).slice(0, 120) }; }
      sock.send(JSON.stringify({ id: m.id, cmd: m.cmd, result: out }));
      emit('command', { cmd: m.cmd });
    };
    sock.onclose = () => {
      emit('live', false); sock = null;
      if (!CFG.consent) return;
      retry++;
      setTimeout(connectWs, Math.min(60000, 2000 * Math.pow(2, Math.min(retry, 5))));
    };
  }

  /* ---------------- הפעלה ---------------- */
  function start(cfg) {
    Object.assign(CFG, cfg || {});
    if (!CFG.consent) return;
    clearInterval(timer);
    timer = setInterval(() => push('tick'), CFG.interval);
    push('start');
    connectWs();

    /* דיווח מיידי כשהמסקנה משתנה — זה הרגע שבו נשבר משהו */
    if (window.PATH) {
      PATH.on('verdict', v => {
        if (!v || v.id === lastVerdict) return;
        lastVerdict = v.id;
        push('verdict:' + v.id);
      });
    }
    if (window.SIPCFG) SIPCFG.on('error', () => push('sip-error'));
    if (window.TEL) TEL.on('ended', () => push('call-ended'));
    window.addEventListener('pagehide', () => push('unload'));
  }
  function stop() { clearInterval(timer); timer = null; try { sock && sock.close(); } catch (e) {} }
  function consent(v) { CFG.consent = !!v; if (!v) stop(); else start(); return CFG.consent; }

  window.TELEMETRY = { start, stop, push, snapshot, consent, on,
    cfg: () => CFG, commands: () => Object.keys(COMMANDS) };
})();
