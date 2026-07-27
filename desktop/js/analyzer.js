/* ============================================================
   CallBiz Desktop · ניתוח מסלול התקשורת
   ------------------------------------------------------------
   השאלה שנציג שואל היא אף פעם לא "מה ה-jitter". היא "למה לא
   שומעים אותי". המערכת הזאת עונה על זה: היא מפרקת את הדרך שהקול
   עושה לחוליות, מודדת כל חוליה בנפרד, ואומרת באיזו חוליה זה
   נשבר — ומה לעשות.

   שרשרת הקול, מהנציג החוצה:

     אוזניות → מיקרופון → האפליקציה → קידוד → רשת מקומית →
     פורטים וחומת אש → איתות → ערוץ הקול → מרכזייה → תור →
     הצד השני

   כל חוליה נמדדת ממקור אמיתי:
     · התקנים    — enumerateDevices + מצב ה-track בפועל
     · מיקרופון  — audioLevel מתוך getStats (media-source)
     · קידוד     — outbound-rtp: האם חבילות באמת מיוצרות
     · חומת אש   — סוגי מועמדי ICE שנאספו (host/srflx/relay)
     · ערוץ קול  — inbound/outbound RTP, loss, jitter, RTT
     · איתות     — מצב ה-WebSocket והרישום
     · מרכזייה   — קוד התשובה האחרון מה-SIP

   ואז מנוע מסקנה: לא מציג עשרה מדדים אדומים, אלא מצליב אותם
   ומוציא משפט אחד. "הקול יוצא ולא חוזר — הפורטים חסומים ברשת
   שלך" זה אבחון. "packet loss 12%" זה מספר.
   ============================================================ */
(function () {

  /* ============================================================
     החוליות
     ============================================================ */
  const LINKS = [
    { k: 'head',  label: 'אוזניות',        icon: 'phone', side: 'me' },
    { k: 'mic',   label: 'מיקרופון',       icon: 'phone', side: 'me' },
    { k: 'app',   label: 'האפליקציה',      icon: 'gear',  side: 'me' },
    { k: 'codec', label: 'קידוד',          icon: 'chart', side: 'me' },
    { k: 'lan',   label: 'הרשת שלך',       icon: 'wifi',  side: 'net' },
    { k: 'fw',    label: 'פורטים',         icon: 'tools', side: 'net' },
    { k: 'sig',   label: 'איתות',          icon: 'wifi',  side: 'net' },
    { k: 'rtp',   label: 'ערוץ הקול',      icon: 'wifi',  side: 'net' },
    { k: 'pbx',   label: 'מרכזייה',        icon: 'crm',   side: 'far' },
    { k: 'queue', label: 'תור וזמינות',    icon: 'clock', side: 'far' },
    { k: 'far',   label: 'הצד השני',       icon: 'user',  side: 'far' },
  ];

  /* ============================================================
     מצב וזיכרון קצר — צריך היסטוריה כדי לזהות "נעצר"
     ============================================================ */
  const H = {                       /* חלון מדידות אחרון */
    out: [], in: [], lvlOut: [], lvlIn: [],
    push(k, v) { const a = this[k]; a.push(v); if (a.length > 12) a.shift(); },
    rising(k, min) { const a = this[k]; if (a.length < 3) return null;
      return (a[a.length - 1] - a[0]) > (min || 0); },
    flat(k) { const a = this[k]; if (a.length < 4) return false;
      return a[a.length - 1] === a[0]; },
    max(k) { return this[k].length ? Math.max.apply(null, this[k]) : 0; },
    reset() { this.out = []; this.in = []; this.lvlOut = []; this.lvlIn = []; },
  };

  const S = {
    links: {},            /* k → { state, value, why, fix, extra } */
    verdict: null,
    events: [],           /* ציר זמן */
    ice: { host: 0, srflx: 0, relay: 0, tcp: 0, udp: 0, selected: null },
    snap: null,
    running: false, timer: null,
    devices: { in: [], out: [], lastChange: 0 },
  };
  const L = {};
  const on = (e, f) => { (L[e] = L[e] || []).push(f); };
  const emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (x) { console.error(x); } });

  const ok   = (v, extra) => ({ state: 'ok', value: v, extra });
  const warn = (v, why, fix, extra) => ({ state: 'warn', value: v, why, fix, extra });
  const bad  = (v, why, fix, extra) => ({ state: 'bad', value: v, why, fix, extra });
  const idle = (v) => ({ state: 'idle', value: v || '—' });

  /* ---------------- ציר זמן ---------------- */
  function event(kind, t, why, sev) {
    const e = { at: Date.now(), kind, t, why, sev: sev || 'info' };
    S.events.push(e);
    if (S.events.length > 200) S.events.shift();
    emit('event', e);
    return e;
  }

  /* מזהים ניתוק/חיבור של אוזניות תוך כדי עבודה */
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      const before = S.devices.in.length + S.devices.out.length;
      await readDevices();
      const after = S.devices.in.length + S.devices.out.length;
      S.devices.lastChange = Date.now();
      if (after < before) event('device', 'התקן שמע נותק', 'ייתכן שהאוזניות נשלפו — הקול עבר להתקן אחר', 'warn');
      else if (after > before) event('device', 'התקן שמע חובר', '', 'info');
      run();
    });
  }
  window.addEventListener('online',  () => { event('net', 'החיבור לאינטרנט חזר', '', 'ok'); run(); });
  window.addEventListener('offline', () => { event('net', 'אין חיבור לאינטרנט', 'כל השיחות ייקטעו עד שהחיבור יחזור', 'bad'); run(); });

  async function readDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return S.devices;
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      S.devices.in = d.filter(x => x.kind === 'audioinput');
      S.devices.out = d.filter(x => x.kind === 'audiooutput');
    } catch (e) {}
    return S.devices;
  }

  /* ============================================================
     איסוף מדידה אחת — כל המקורות, בבת אחת
     ============================================================ */
  async function collect() {
    const call = window.TEL && TEL.call();
    const pc = call && call.sip ? call.sip.pc : (window.TEL && TEL._pc ? TEL._pc() : null);
    const st = window.SIPCFG ? SIPCFG.status() : { state: 'offline' };
    const snap = {
      t: Date.now(), call, pc, sip: st,
      online: navigator.onLine !== false,
      secure: location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname),
      hidden: document.hidden,
      conn: navigator.connection || null,
      micTrack: null, outAudio: null,
      rtp: { outPkts: 0, inPkts: 0, outBytes: 0, inBytes: 0, loss: 0, jitter: 0, rtt: 0,
        codec: '', lvlOut: 0, lvlIn: 0, remoteLoss: null },
      ice: { host: 0, srflx: 0, relay: 0, selected: null, proto: '', state: pc ? pc.iceConnectionState : '' },
    };

    /* המיקרופון בפועל — לא ההגדרה, ה-track החי */
    const stream = call && call.sip ? call.sip.localStream : null;
    if (stream) {
      const t = stream.getAudioTracks()[0];
      if (t) snap.micTrack = { label: t.label, enabled: t.enabled, muted: t.muted, state: t.readyState };
    }

    if (pc && pc.getStats) {
      try {
        const rep = await pc.getStats();
        rep.forEach(r => {
          if (r.type === 'outbound-rtp' && r.kind === 'audio') {
            snap.rtp.outPkts = r.packetsSent || 0; snap.rtp.outBytes = r.bytesSent || 0;
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            snap.rtp.inPkts = r.packetsReceived || 0; snap.rtp.inBytes = r.bytesReceived || 0;
            snap.rtp.jitter = (r.jitter || 0) * 1000;
            if (r.audioLevel != null) snap.rtp.lvlIn = r.audioLevel;
            if (r.packetsLost != null && r.packetsReceived)
              snap.rtp.loss = r.packetsLost / (r.packetsLost + r.packetsReceived) * 100;
          }
          if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
            if (r.roundTripTime != null) snap.rtp.rtt = r.roundTripTime * 1000;
            if (r.fractionLost != null) snap.rtp.remoteLoss = r.fractionLost * 100;
          }
          if (r.type === 'media-source' && r.kind === 'audio' && r.audioLevel != null) snap.rtp.lvlOut = r.audioLevel;
          if (r.type === 'codec' && /audio/.test(r.mimeType || '')) snap.rtp.codec = (r.mimeType || '').split('/')[1];
          if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated)) {
            snap.ice.selected = r; if (r.currentRoundTripTime != null) snap.rtp.rtt = snap.rtp.rtt || r.currentRoundTripTime * 1000;
          }
          if (r.type === 'local-candidate') {
            if (r.candidateType === 'host') snap.ice.host++;
            if (r.candidateType === 'srflx' || r.candidateType === 'prflx') snap.ice.srflx++;
            if (r.candidateType === 'relay') snap.ice.relay++;
            if (r.protocol) snap.ice.proto = r.protocol;
          }
        });
      } catch (e) {}
    }
    /* היסטוריה — כדי לדעת אם משהו *נעצר*, לא רק אם הוא אפס */
    H.push('out', snap.rtp.outPkts); H.push('in', snap.rtp.inPkts);
    H.push('lvlOut', snap.rtp.lvlOut); H.push('lvlIn', snap.rtp.lvlIn);
    S.snap = snap;
    S.ice = snap.ice;
    return snap;
  }

  /* ============================================================
     הערכת כל חוליה
     ============================================================ */
  const EVAL = {
    /* --- אוזניות / פלט --- */
    head(s) {
      if (!S.devices.out.length && !S.devices.in.length) return warn('לא נבדק', 'הדפדפן לא חושף התקנים עד שניתנת הרשאה', 'הפעילו בדיקת מיקרופון בהגדרות');
      if (!S.devices.out.length) return warn('אין התקן פלט', 'לא נמצא רמקול או אוזניות', 'חברו אוזניות ובדקו שהן נבחרות במערכת ההפעלה');
      const sel = window.SIPCFG && SIPCFG.get().spkId;
      const still = !sel || S.devices.out.some(d => d.deviceId === sel);
      if (!still) return bad('ההתקן שנבחר נעלם', 'האוזניות שהוגדרו כאן כבר לא מחוברות', 'בחרו התקן פלט אחר בהגדרות → שמע');
      if (Date.now() - S.devices.lastChange < 8000)
        return warn('התקן התחלף כרגע', 'הקול עבר להתקן אחר בזמן העבודה', 'ודאו שאתם שומעים דרך ההתקן הנכון');
      const nm = (S.devices.out.find(d => d.deviceId === sel) || S.devices.out[0] || {}).label;
      /* אין דרך למדוד קול שיוצא לרמקול — מדווחים רק את מה שידוע */
      if (s.call && s.rtp.inPkts > 0 && s.rtp.lvlIn === 0 && H.flat('lvlIn'))
        return warn('מגיע קול אך בעוצמה אפסית', 'החבילות מגיעות אבל הן שקטות — ייתכן שהצד השני מושתק', 'בקשו מהצד השני לבדוק השתקה');
      return ok(nm || (S.devices.out.length + ' התקנים'));
    },

    /* --- מיקרופון --- */
    mic(s) {
      if (!navigator.mediaDevices) return bad('לא נתמך', 'הדפדפן לא מאפשר גישה למיקרופון', 'עברו ל-Chrome או Edge עדכני');
      if (!s.secure) return bad('חסום', 'דפדפנים חוסמים מיקרופון בדף לא מאובטח', 'הפעילו דרך Start-CallBiz-Desktop.cmd או ב-HTTPS');
      if (!S.devices.in.length) return bad('לא נמצא מיקרופון', 'אין התקן קלט מחובר', 'חברו אוזניות עם מיקרופון');
      if (!s.call) return ok(S.devices.in.length + ' התקני קלט');

      const t = s.micTrack;
      if (!t) return warn('לא נתפס', 'השיחה פעילה אבל אין track של מיקרופון', 'נתקו והתקשרו שוב');
      if (t.state === 'ended') return bad('המיקרופון נותק', 'ההתקן נשלף או נתפס בידי יישום אחר', 'חברו מחדש ונתקו יישומים שמשתמשים במיקרופון');
      if (t.muted) return bad('מושתק במערכת ההפעלה', 'לא אנחנו השתקנו — ההשתקה היא ברמת המכשיר', 'בדקו כפתור השתקה פיזי על האוזניות ואת הגדרות הקול של Windows');
      if (!t.enabled) return warn('מושתק בשיחה', 'ההשתקה בוצעה מהאפליקציה', 'לחצו על כפתור ההשתקה כדי לבטל');
      /* הבדיקה החשובה: track חי אבל לא נכנס אליו קול */
      if (H.lvlOut.length >= 6 && H.max('lvlOut') < 0.001)
        return bad('מחובר אך לא קולט', 'המיקרופון פתוח ולא נכנס אליו שום קול', 'בדקו כפתור השתקה על הכבל, ואת עוצמת הקלט בהגדרות הקול של Windows');
      const lvl = Math.round((s.rtp.lvlOut || 0) * 100);
      return ok(t.label ? t.label.slice(0, 28) : 'פעיל', { level: lvl });
    },

    /* --- האפליקציה --- */
    app(s) {
      if (!s.secure) return bad('הקשר לא מאובטח', 'חלק מהיכולות חסומות', 'הפעילו דרך קובץ ההפעלה או ב-HTTPS');
      if (!window.RTCPeerConnection) return bad('אין תמיכה בשיחות', 'הדפדפן ישן מדי', 'עדכנו את הדפדפן');
      if (s.hidden && s.call) return warn('החלון ברקע', 'דפדפנים מאטים לשוניות ברקע וזה עלול לגרום לקטיעות', 'השאירו את חלון השיחה מלפנים');
      return ok('תקין · גרסה ' + (window.APP_VERSION || '?'));
    },

    /* --- קידוד --- */
    codec(s) {
      if (!s.call) return idle('ללא שיחה');
      if (!s.pc) return warn('אין ערוץ מדיה', 'השיחה לא הגיעה לשלב המדיה', 'נתקו ונסו שוב');
      if (!s.rtp.codec && !s.rtp.outPkts) return warn('טרם נבחר קודק', 'המשא ומתן על הקודק לא הסתיים', 'המתינו רגע — אם נתקע, ייתכן שאין קודק משותף עם המרכזייה');
      if (s.rtp.outPkts > 0 && H.flat('out'))
        return bad('הקידוד נעצר', 'כבר לא נוצרות חבילות קול — לרוב עומס מעבד או תקלה בהתקן', 'סגרו יישומים כבדים ונסו שוב');
      const name = { opus: 'Opus', PCMU: 'G.711 μ', PCMA: 'G.711 A', G722: 'G.722' }[s.rtp.codec] || s.rtp.codec || '—';
      const wide = /opus|G722/i.test(s.rtp.codec);
      return wide ? ok(name + ' · רחב-פס') : ok(name);
    },

    /* --- רשת מקומית --- */
    lan(s) {
      if (!s.online) return bad('מנותק', 'אין חיבור לאינטרנט', 'בדקו את הכבל או את ה-Wi-Fi');
      const c = s.conn;
      if (c && /^(slow-)?2g$/.test(c.effectiveType || ''))
        return bad('רשת איטית מאוד', 'החיבור לא מספיק לשיחת קול', 'עברו ל-Wi-Fi או לחיבור קווי');
      if (c && c.rtt > 300) return warn('השהיה גבוהה ברשת · ' + c.rtt + 'ms', 'הרשת עמוסה', 'סגרו הורדות ווידאו ברקע, או התקרבו לנתב');
      if (c && c.downlink && c.downlink < 1)
        return warn('רוחב פס נמוך · ' + c.downlink + 'Mb/s', 'ייתכנו קטיעות', 'עברו לחיבור קווי');
      return ok(c && c.effectiveType ? c.effectiveType.toUpperCase() + (c.rtt ? ' · ' + c.rtt + 'ms' : '') : 'מחובר');
    },

    /* --- פורטים וחומת אש --- */
    fw(s) {
      if (!s.call || !s.pc) {
        return idle('נבדק בשיחה');
      }
      const i = s.ice;
      if (i.state === 'failed')
        return bad('חסום', 'לא נמצא אף מסלול שהרשת מאפשרת', 'הרשת חוסמת UDP. פתחו יציאות UDP 10000-20000, או הגדירו שרת TURN בהגדרות → רשת');
      if (i.state === 'disconnected')
        return bad('המסלול נותק', 'החיבור שנבחר הפסיק להגיב', 'לרוב מעבר בין רשתות. אם זה חוזר — הגדירו TURN');
      if (!i.host && !i.srflx && !i.relay) return warn('טרם נאספו מסלולים', 'איסוף המועמדים עדיין רץ', '');
      if (!i.srflx && !i.relay)
        return bad('לא נמצא מסלול החוצה', 'רק כתובות מקומיות נאספו — חומת האש חוסמת את ה-STUN', 'אפשרו UDP 3478 החוצה, או הגדירו שרת TURN');
      if (i.relay && !i.srflx)
        return warn('עובר דרך שרת מתווך', 'חיבור ישיר חסום, הקול עובר ב-TURN', 'עובד תקין, אבל ההשהיה גבוהה יותר. שווה לבדוק את חומת האש');
      if (i.proto === 'tcp')
        return warn('קול על TCP', 'UDP חסום והקול עובר ב-TCP — נוטה להיתקע', 'פתחו UDP ברשת');
      return ok('פתוח · ' + (i.relay ? 'עם TURN' : 'ישיר'));
    },

    /* --- איתות --- */
    sig(s) {
      const st = s.sip.state;
      if (st === 'registered') return ok('מחובר' + (s.sip.lastReg ? ' · ' + s.sip.lastReg.split(',').pop().trim() : ''));
      if (st === 'connecting' || st === 'registering') return warn('מתחבר…', 'ההזדהות מול המרכזייה בעיצומה', '');
      if (st === 'failed') return bad('נכשל', s.sip.error || 'ההזדהות נדחתה', 'בדקו שלוחה וסיסמה בהגדרות → חיבור');
      if (!(window.SIPCFG && SIPCFG.get().user)) return idle('לא הוגדר');
      return bad('מנותק', 'אין ערוץ איתות למרכזייה — שיחות נכנסות לא יגיעו', 'לחצו "התחבר" בהגדרות');
    },

    /* --- ערוץ הקול --- */
    rtp(s) {
      if (!s.call) return idle('ללא שיחה');
      if (!s.pc) return idle('—');
      const outUp = H.rising('out', 0), inUp = H.rising('in', 0);
      if (H.out.length < 3) return warn('מתחיל…', 'הקול עוד לא זרם', '');
      if (!outUp && !inUp)
        return bad('אין קול בשני הכיוונים', 'לא נשלחות ולא מתקבלות חבילות', 'בדקו את המיקרופון ואת הפורטים בשרשרת');
      if (outUp && !inUp)
        return bad('קול יוצא, לא נכנס', 'הם שומעים אותך — אתה לא שומע אותם', 'לרוב חומת אש שחוסמת תעבורה נכנסת, או TURN חסר');
      if (!outUp && inUp)
        return bad('קול נכנס, לא יוצא', 'אתה שומע אותם — הם לא שומעים אותך', 'בדקו את המיקרופון ואת ההשתקה');
      const loss = Math.round(s.rtp.loss * 10) / 10, jit = Math.round(s.rtp.jitter);
      if (loss > 5) return bad(loss + '% אובדן', 'חלק ניכר מהקול לא מגיע — הקול ייקטע', 'עברו לחיבור קווי, או תנו למערכת לעבור לגשר טלפוני');
      if (loss > 2) return warn(loss + '% אובדן', 'הקול ייקטע מדי פעם', 'התקרבו לנתב או עברו לכבל');
      if (jit > 40) return warn(jit + 'ms רעידה', 'החבילות מגיעות לא אחיד — קול "רובוטי"', 'סגרו הורדות ברקע');
      if (s.rtp.rtt > 300) return warn(Math.round(s.rtp.rtt) + 'ms השהיה', 'יש עיכוב מורגש ושני הצדדים ידרכו זה על זה', 'החליפו רשת');
      return ok('תקין · ' + loss + '% · ' + jit + 'ms');
    },

    /* --- מרכזייה --- */
    pbx(s) {
      if (!(window.SIPCFG && SIPCFG.get().user)) return idle('לא הוגדרה');
      if (s.sip.state !== 'registered') return bad('אין רישום', 'המרכזייה לא מכירה אותנו כרגע', 'התחברו מחדש בהגדרות');
      const tr = (s.sip.trace || []);
      const last4xx = tr.slice().reverse().find(x => x.dir === 'in' && /SIP\/2\.0 [45]\d\d/.test(x.line));
      if (last4xx && Date.now() - last4xx.t < 20000) {
        const code = (last4xx.line.match(/SIP\/2\.0 (\d+)/) || [])[1];
        const HE = { 403: 'המרכזייה דחתה — אין הרשאה לפעולה', 404: 'היעד לא קיים במרכזייה',
          486: 'היעד תפוס', 480: 'היעד לא זמין', 503: 'המרכזייה עמוסה או בתחזוקה',
          408: 'המרכזייה לא ענתה בזמן' };
        return warn('תשובה ' + code, HE[code] || 'המרכזייה החזירה שגיאה', 'אם זה חוזר — פנו לספק המרכזייה עם יומן האיתות מלשונית מתקדם');
      }
      return ok('רשומה · שלוחה ' + (SIPCFG.get().user || ''));
    },

    /* --- תור וזמינות --- */
    queue(s) {
      if (!window.CRM) return idle('—');
      const ses = CRM.session() || {};
      if (!ses.employee) return warn('לא מזוהה', 'אין סשן עובד — שיחות לא ינותבו', 'התחברו לפורטל הנציגים');
      if (!CRM.isActive()) return bad('לא פעיל', 'הנציג מסומן כלא פעיל ולכן לא מקבל שיחות', 'שנו את הסטטוס לפעיל במנג׳ר');
      if (!(ses.activities || []).length) return warn('ללא שיוך', 'הנציג לא משויך לאף פעילות — שום תור לא ינותב אליו', 'שייכו פעילות במנג׳ר');
      if (!CRM.can('call')) return warn('אין הרשאת חיוג', 'הנציג יכול לענות אך לא לחייג', 'עדכנו הרשאות במנג׳ר');
      return ok(ses.activities.join(' · '));
    },

    /* --- הצד השני --- */
    far(s) {
      if (!s.call) return idle('ללא שיחה');
      if (s.rtp.remoteLoss == null) return idle('אין דיווח');
      const rl = Math.round(s.rtp.remoteLoss * 10) / 10;
      if (rl > 5) return bad(rl + '% אובדן אצלם', 'הם מאבדים חלק ניכר ממה שאנחנו שולחים — הבעיה בצד שלהם או ברשת ביניים', 'אם זה קורה רק מול לקוח מסוים — הבעיה אצלו');
      if (rl > 2) return warn(rl + '% אובדן אצלם', 'הצד השני מאבד חבילות', 'שאלו אם הם על Wi-Fi חלש או ברשת סלולרית');
      return ok('מקבלים תקין');
    },
  };

  /* ============================================================
     מנוע המסקנה — משפט אחד, לא עשרה מדדים
     ------------------------------------------------------------
     הסדר הוא סדר: הכלל הראשון שמתאים מנצח, כי החוליה הראשונה
     שנשברת היא זו שמסבירה את כל השאר. אין טעם להגיד "אובדן
     חבילות" למי שהאינטרנט שלו מנותק.
     ============================================================ */
  const RULES = [
    { id: 'offline', when: (l, s) => !s.online,
      t: 'אין חיבור לאינטרנט', where: 'lan',
      why: 'המחשב מנותק מהרשת. שום שיחה לא תעבוד עד שזה ייפתר.',
      fix: 'בדקו את כבל הרשת או את ה-Wi-Fi. אם יש נתב — הפעילו אותו מחדש.' },

    { id: 'insecure', when: (l, s) => !s.secure,
      t: 'המערכת רצה בהקשר לא מאובטח', where: 'app',
      why: 'הדפדפן חוסם גישה למיקרופון כשהדף לא מאובטח, ולכן אי אפשר לדבר.',
      fix: 'סגרו והפעילו דרך Start-CallBiz-Desktop.cmd, או פרסו את המערכת ב-HTTPS.' },

    { id: 'nomic', when: l => l.mic.state === 'bad' && /לא נמצא/.test(l.mic.value),
      t: 'אין מיקרופון מחובר', where: 'mic',
      why: 'המחשב לא מזהה אף התקן קלט.',
      fix: 'חברו אוזניות עם מיקרופון. אם הן מחוברות — בדקו שהן מופיעות בהגדרות הקול של Windows.' },

    { id: 'micmuted', when: l => l.mic.state === 'bad' && /מושתק במערכת/.test(l.mic.value),
      t: 'המיקרופון מושתק מחוץ למערכת', where: 'mic',
      why: 'ההשתקה לא בוצעה כאן — היא ברמת ההתקן או מערכת ההפעלה, ולכן כפתור ההשתקה באפליקציה לא יעזור.',
      fix: 'בדקו כפתור השתקה פיזי על האוזניות או על הכבל, ואת מתג הפרטיות במחשבים ניידים.' },

    { id: 'micsilent', when: l => l.mic.state === 'bad' && /לא קולט/.test(l.mic.value),
      t: 'המיקרופון פתוח אבל לא נכנס אליו קול', where: 'mic',
      why: 'ההתקן פעיל והמערכת מקבלת ממנו אפס אנרגיה — כלומר הוא מחובר אך שקט לחלוטין.',
      fix: 'בדקו שאתם מדברים לתוך המיקרופון הנכון, שהעוצמה בהגדרות הקול של Windows אינה 0, ושאין השתקה פיזית.' },

    { id: 'devlost', when: l => l.head.state === 'bad',
      t: 'האוזניות שהוגדרו נותקו', where: 'head',
      why: 'ההתקן שנבחר בהגדרות כבר לא מחובר, והקול עבר להתקן אחר בלי להודיע.',
      fix: 'חברו מחדש, או בחרו התקן אחר בהגדרות → שמע.' },

    { id: 'sigdown', when: (l, s) => l.sig.state === 'bad' && !s.call,
      t: 'אין חיבור למרכזייה', where: 'sig',
      why: 'בלי רישום, שיחות נכנסות לא מגיעות אליך כלל — גם אם הכל שאר תקין.',
      fix: 'הגדרות → חיבור → התחבר. אם זה נכשל, הריצו בדיקת מוכנות.' },

    { id: 'authfail', when: l => l.sig.state === 'bad' && /נכשל/.test(l.sig.value),
      t: 'ההזדהות מול המרכזייה נדחתה', where: 'sig',
      why: 'השרת ענה, אבל דחה את השלוחה או הסיסמה.',
      fix: 'ודאו את מספר השלוחה והסיסמה. אם הן נכונות — ייתכן שהשלוחה נעולה או תפוסה במכשיר אחר.' },

    { id: 'fwblock', when: l => l.fw.state === 'bad' && /חסום|מסלול החוצה/.test(l.fw.value),
      t: 'הרשת חוסמת את הקול', where: 'fw',
      why: 'האיתות עובר (הוא על 443), אבל הקול עצמו זקוק ל-UDP והוא חסום. זו הסיבה הנפוצה ביותר ל"מתחבר אבל אין קול".',
      fix: 'בקשו מאיש הרשת לפתוח UDP 3478 ו-UDP 10000-20000 החוצה, או הגדירו שרת TURN בהגדרות → רשת ואיכות.' },

    { id: 'oneway-in', when: l => l.rtp.state === 'bad' && /לא נכנס/.test(l.rtp.value),
      t: 'אתה לא שומע אותם', where: 'rtp',
      why: 'הקול שלך יוצא תקין, אבל שום חבילה לא חוזרת. זה כמעט תמיד חסימה של תעבורה נכנסת ולא בעיית אוזניות.',
      fix: 'בדקו חומת אש/NAT, או הגדירו TURN. אם זה קורה רק מהבית — נסו רשת אחרת כדי לאשש.' },

    { id: 'oneway-out', when: l => l.rtp.state === 'bad' && /לא יוצא/.test(l.rtp.value),
      t: 'הם לא שומעים אותך', where: 'rtp',
      why: 'מגיעות אלינו חבילות, אבל אנחנו לא שולחים. מקור הבעיה בצד שלנו — מיקרופון או קידוד.',
      fix: 'בדקו את חוליית המיקרופון בשרשרת. אם היא ירוקה — נתקו והתקשרו שוב.' },

    { id: 'dead', when: l => l.rtp.state === 'bad' && /שני הכיוונים/.test(l.rtp.value),
      t: 'ערוץ הקול לא נפתח', where: 'rtp',
      why: 'השיחה התחברה ברמת האיתות, אבל המדיה לא זורמת לאף כיוון.',
      fix: 'לרוב חסימת פורטים. נתקו, הריצו בדיקת מוכנות, ואם הפורטים תקינים — נסו שוב.' },

    { id: 'codecstall', when: l => l.codec.state === 'bad',
      t: 'הקידוד נעצר באמצע', where: 'codec',
      why: 'המחשב הפסיק לייצר חבילות קול — לרוב עומס מעבד או התקן שנתפס בידי יישום אחר.',
      fix: 'סגרו יישומים כבדים (וידאו, מכונות וירטואליות) ונסו שוב.' },

    { id: 'lossy', when: l => l.rtp.state === 'bad' && /אובדן/.test(l.rtp.value),
      t: 'הרשת מאבדת חלק ניכר מהקול', where: 'rtp',
      why: 'החבילות יוצאות ומגיעות, אבל חלקן נופל בדרך — הקול יישמע קטוע.',
      fix: 'עברו לחיבור קווי, או אשרו למערכת לעבור לגשר טלפוני שנשאר יציב ברשת גרועה.' },

    { id: 'relay', when: l => l.fw.state === 'warn' && /מתווך/.test(l.fw.value),
      t: 'הקול עובר דרך שרת מתווך', where: 'fw',
      why: 'חיבור ישיר חסום, אז המערכת מנתבת דרך TURN. עובד — אבל מוסיף השהיה.',
      fix: 'לא דחוף. אם ההשהיה מפריעה, בקשו לפתוח UDP ישיר ברשת.' },

    { id: 'farside', when: l => l.far.state === 'bad',
      t: 'הבעיה בצד של הלקוח', where: 'far',
      why: 'אנחנו שולחים תקין, אבל הדיווח שחוזר מראה שהם מאבדים חלק ניכר. הרשת שלהם או שלנו-אליהם.',
      fix: 'אין מה לתקן מהצד שלנו. שווה להציע לחזור אליהם בקו אחר.' },

    { id: 'notactive', when: l => l.queue.state === 'bad',
      t: 'הנציג לא מסומן כפעיל', where: 'queue',
      why: 'הכל תקין טכנית, אבל התור לא ינתב אליך שיחות כי הסטטוס במנג׳ר אינו פעיל.',
      fix: 'עדכנו את הסטטוס לפעיל במנג׳ר, במסך העובד.' },

    { id: 'bg', when: l => l.app.state === 'warn',
      t: 'חלון השיחה ברקע', where: 'app',
      why: 'דפדפנים מאטים לשוניות שאינן מלפנים, וזה גורם לקטיעות קול.',
      fix: 'השאירו את חלון השיחה פתוח מלפנים בזמן שיחה.' },

    { id: 'jitter', when: l => l.rtp.state === 'warn' && /רעידה/.test(l.rtp.value),
      t: 'הקול מגיע לא אחיד', where: 'rtp',
      why: 'החבילות מגיעות בקצב משתנה — נשמע "רובוטי" או קופצני.',
      fix: 'סגרו הורדות, גיבויים ווידאו ברקע. Wi-Fi עמוס הוא החשוד הרגיל.' },

    { id: 'slow', when: l => l.lan.state !== 'ok' && l.lan.state !== 'idle',
      t: 'הרשת המקומית חלשה', where: 'lan',
      why: 'עוד לפני המרכזייה, החיבור עצמו לא מספק את מה ששיחת קול צריכה.',
      fix: 'עברו לחיבור קווי או התקרבו לנתב.' },
  ];

  function judge(links, snap) {
    for (const r of RULES) {
      let hit = false;
      try { hit = r.when(links, snap); } catch (e) { hit = false; }
      if (hit) return { id: r.id, t: r.t, why: r.why, fix: r.fix, where: r.where, sev: 'bad', at: Date.now() };
    }
    const anyCall = !!snap.call;
    return { id: 'ok', where: null, sev: 'ok', at: Date.now(),
      t: anyCall ? 'השיחה תקינה מקצה לקצה' : 'המערכת מוכנה לשיחות',
      why: anyCall ? 'כל החוליות מדווחות תקין — קול יוצא, קול נכנס, ואיכות בטווח.'
        : 'כל החוליות שניתן לבדוק ללא שיחה תקינות. חוליות המדיה ייבדקו ברגע שתתחיל שיחה.',
      fix: '' };
  }

  /* ============================================================
     ריצה
     ============================================================ */
  async function run() {
    const snap = await collect();
    const links = {};
    LINKS.forEach(l => {
      try { links[l.k] = Object.assign({ k: l.k, label: l.label }, EVAL[l.k](snap)); }
      catch (e) { links[l.k] = { k: l.k, label: l.label, state: 'idle', value: '—' }; }
    });
    S.links = links;
    const v = judge(links, snap);
    /* אירוע לציר הזמן רק כשהמסקנה משתנה — לא כל שנייה */
    if (!S.verdict || S.verdict.id !== v.id) {
      event('verdict', v.t, v.why, v.sev === 'ok' ? 'ok' : 'bad');
      S.verdict = v;
      emit('verdict', v);
    } else { S.verdict.at = v.at; }
    emit('update', { links, verdict: S.verdict, snap });
    return { links, verdict: S.verdict, snap };
  }

  function start(ms) {
    if (S.running) return;
    S.running = true;
    readDevices().then(run);
    S.timer = setInterval(run, ms || 2000);
    emit('running', true);
  }
  function stop() {
    S.running = false; clearInterval(S.timer); S.timer = null;
    emit('running', false);
  }

  /* דוח מלא לשליחה לתמיכה — כל מה שצריך כדי לאבחן מרחוק */
  function report() {
    const s = S.snap || {};
    return {
      at: new Date().toISOString(),
      app: window.APP_VERSION, ua: navigator.userAgent,
      verdict: S.verdict,
      links: Object.keys(S.links).map(k => ({ k, state: S.links[k].state, value: S.links[k].value })),
      sip: window.SIPCFG ? { state: SIPCFG.status().state, error: SIPCFG.status().error,
        user: SIPCFG.get().user, domain: SIPCFG.get().domain, wss: SIPCFG.get().wss } : null,
      rtp: s.rtp, ice: s.ice, online: s.online, secure: s.secure,
      devices: { in: S.devices.in.length, out: S.devices.out.length },
      events: S.events.slice(-60),
    };
  }

  /* חיבור לאירועי שיחה — מאפסים חלון מדידה בכל שיחה חדשה */
  if (window.TEL) {
    TEL.on('call', c => { if (c && c.state === 'dialing') { H.reset(); event('call', 'שיחה יוצאת · ' + c.phone, '', 'info'); }
      if (c && c.state === 'ringing') event('call', 'שיחה נכנסת · ' + c.phone, '', 'info'); });
    TEL.on('ended', c => { event('call', 'השיחה הסתיימה', (c && c.outcome) || '', 'info'); H.reset(); });
    TEL.on('transport', e => event('transport', 'מעבר מסלול', 'מ' + e.from + ' ל' + e.to, 'warn'));
  }
  if (window.SIPCFG) {
    SIPCFG.on('state', st => {
      const HE = { registered: 'נרשם למרכזייה', failed: 'הרישום נכשל', offline: 'נותק מהמרכזייה' };
      if (HE[st.state]) event('sip', HE[st.state], st.error || '', st.state === 'registered' ? 'ok' : 'bad');
    });
  }

  window.PATH = { LINKS, RULES, run, start, stop, report, on,
    links: () => S.links, verdict: () => S.verdict, events: () => S.events,
    snap: () => S.snap, running: () => S.running, event };
})();
