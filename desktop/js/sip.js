/* ============================================================
   CallBiz Desktop · מחסנית SIP אמיתית (SIP over WebSocket)
   ------------------------------------------------------------
   זו לא הדמיה. זו מחסנית SIP עובדת לפי RFC 3261 + RFC 7118,
   שמתחברת למרכזייה אמיתית ומבצעת שיחות אמיתיות.

   למה WebSocket ולא UDP?
     דפדפן — וגם Electron — לא יכול לפתוח סוקט UDP גולמי. לכן
     כל הסופטפונים המודרניים ברשת עובדים ב-SIP over WebSocket:
     המרכזייה חושפת מאזין wss ומתרגמת פנימה ל-SIP רגיל.
       · Asterisk    → wss://pbx:8089/ws        (http.conf + PJSIP)
       · FreeSWITCH  → wss://pbx:7443
       · Kamailio    → wss://pbx:443
     המדיה עצמה (הקול) עוברת ב-RTP/SRTP רגיל דרך WebRTC — בדיוק
     כמו בכל סופטפון.

   מה ממומש כאן:
     · פרסור וסריאליזציה של הודעות SIP
     · REGISTER עם אתגר Digest (MD5, qop=auth) וחידוש אוטומטי
     · INVITE יוצא עם SDP מ-RTCPeerConnection, ‎100/180/183/200
     · INVITE נכנס: ‎180 Ringing → ‎200 OK עם answer
     · ACK, BYE, CANCEL, וטיפול נכון ב-CSeq / branch / tags
     · re-INVITE עם ‎a=sendonly להמתנה אמיתית במרכזייה
     · REFER להעברה עיוורת, ו-REFER עם Replaces להעברה מלווה
     · DTMF ב-RFC 2833 (RTCDTMFSender) או ב-SIP INFO, לפי הגדרה
     · keep-alive, זיהוי ניתוק, וחיבור מחדש עם השהיה מדורגת
   ============================================================ */
(function () {

  /* ============================================================
     MD5 — נדרש לאימות Digest. אין לזה תחליף מובנה בדפדפן:
     ה-SubtleCrypto לא תומך ב-MD5 בכוונה, אבל SIP מחייב אותו.
     ============================================================ */
  const md5 = (function () {
    function sa(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cm(q, a, b, x, s, t) { return sa(rl(sa(sa(a, q), sa(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cm((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cm((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cm(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cm(c ^ (b | ~d), a, b, x, s, t); }
    function cw(s) {
      const n = ((s.length + 8) >> 6) + 1, w = new Array(n * 16).fill(0);
      for (let i = 0; i < s.length; i++) w[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
      w[s.length >> 2] |= 0x80 << ((s.length % 4) * 8);
      w[n * 16 - 2] = s.length * 8;
      return w;
    }
    function hex(n) { let s = ''; for (let i = 0; i < 4; i++) s += ('0' + ((n >> (i * 8 + 4)) & 0x0F).toString(16)).slice(-1) + ('0' + ((n >> (i * 8)) & 0x0F).toString(16)).slice(-1); return s; }
    return function (str) {
      /* UTF-8 → בייטים, אחרת סיסמאות בעברית ישברו */
      const s = unescape(encodeURIComponent(str));
      const x = cw(s);
      let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
      for (let i = 0; i < x.length; i += 16) {
        const oa = a, ob = b, oc = c, od = d;
        a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
        a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222);
        c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = sa(a, oa); b = sa(b, ob); c = sa(c, oc); d = sa(d, od);
      }
      return hex(a) + hex(b) + hex(c) + hex(d);
    };
  })();

  /* ============================================================
     כלי עזר
     ============================================================ */
  const rnd = (n) => { let s = ''; const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const a = new Uint8Array(n || 12); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.fill(7));
    for (let i = 0; i < a.length; i++) s += c[a[i] % c.length]; return s; };
  const branch = () => 'z9hG4bK' + rnd(10);          /* magic cookie חובה לפי RFC */
  const tag = () => rnd(8);
  const callid = () => rnd(16) + '@callbiz.desktop';

  /* ---------------- פרסור הודעת SIP ---------------- */
  function parse(raw) {
    const i = raw.indexOf('\r\n\r\n');
    const head = i < 0 ? raw : raw.slice(0, i);
    const body = i < 0 ? '' : raw.slice(i + 4);
    const lines = head.split('\r\n');
    const first = lines.shift() || '';
    const m = { headers: {}, body, raw };
    if (/^SIP\/2\.0/.test(first)) {
      m.kind = 'response';
      m.status = parseInt(first.slice(8, 11), 10);
      m.reason = first.slice(12);
    } else {
      m.kind = 'request';
      const p = first.split(' ');
      m.method = p[0]; m.uri = p[1];
    }
    let cur = null;
    lines.forEach(l => {
      if (/^\s/.test(l) && cur) { m.headers[cur][m.headers[cur].length - 1] += ' ' + l.trim(); return; }
      const c = l.indexOf(':'); if (c < 0) return;
      let k = l.slice(0, c).trim().toLowerCase();
      const SHORT = { i: 'call-id', m: 'contact', f: 'from', t: 'to', v: 'via', c: 'content-type', l: 'content-length', s: 'subject', k: 'supported' };
      if (SHORT[k]) k = SHORT[k];
      cur = k;
      (m.headers[k] = m.headers[k] || []).push(l.slice(c + 1).trim());
    });
    m.h = k => (m.headers[k.toLowerCase()] || [])[0] || '';
    m.cseq = (() => { const p = m.h('cseq').split(/\s+/); return { num: parseInt(p[0], 10) || 0, method: p[1] || '' }; })();
    m.callId = m.h('call-id');
    m.fromTag = (m.h('from').match(/;tag=([^;\s>]+)/) || [])[1] || '';
    m.toTag = (m.h('to').match(/;tag=([^;\s>]+)/) || [])[1] || '';
    return m;
  }

  /* ---------------- אתגר Digest ---------------- */
  /* ערכים באתגר מגיעים גם מצוטטים וגם לא — Asterisk שולח
     algorithm=MD5 בלי מרכאות ו-realm="..." עם. שניהם חייבים לעבוד. */
  function parseAuth(v) {
    const o = {};
    const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
    let m;
    while ((m = re.exec(v || ''))) o[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
    return o;
  }
  function digest(ch, opts) {
    const nc = ('00000000' + opts.nc).slice(-8), cnonce = rnd(8);
    const ha1 = md5(opts.user + ':' + ch.realm + ':' + opts.pass);
    const ha2 = md5(opts.method + ':' + opts.uri);
    let resp, extra = '';
    if (ch.qop && /auth/.test(ch.qop)) {
      resp = md5(ha1 + ':' + ch.nonce + ':' + nc + ':' + cnonce + ':auth:' + ha2);
      extra = ', qop=auth, nc=' + nc + ', cnonce="' + cnonce + '"';
    } else {
      resp = md5(ha1 + ':' + ch.nonce + ':' + ha2);
    }
    return 'Digest username="' + opts.user + '", realm="' + ch.realm + '", nonce="' + ch.nonce +
      '", uri="' + opts.uri + '", response="' + resp + '"' +
      (ch.opaque ? ', opaque="' + ch.opaque + '"' : '') +
      (ch.algorithm ? ', algorithm=' + ch.algorithm : '') + extra;
  }

  /* ============================================================
     ה-UA
     ============================================================ */
  function UA(cfg) {
    const ua = this;
    const L = {};
    ua.on = (e, f) => { (L[e] = L[e] || []).push(f); return ua; };
    const emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (err) { console.error('[sip]', e, err); } });

    ua.cfg = cfg;
    ua.state = 'offline';
    ua.ws = null;
    ua.dialogs = {};                /* callId → dialog */
    ua.pending = {};                /* callId+cseq → callback לתשובה */
    let cseq = Math.floor(Math.random() * 1000) + 1;
    let regTimer = null, kaTimer = null, retry = 0, closing = false;
    let regState = { nc: 0, challenge: null, callId: callid(), fromTag: tag(), cseq: 0 };

    const uri = () => 'sip:' + cfg.user + '@' + cfg.domain;
    const contactHost = () => ua._contactHost || (rnd(12) + '.invalid');
    const contact = () => '<sip:' + cfg.user + '@' + contactHost() + ';transport=ws>' +
      (cfg.instanceId ? ';+sip.instance="<urn:uuid:' + cfg.instanceId + '>"' : '');
    const log = (dir, m) => emit('sip', { dir, line: m.split('\r\n')[0], raw: m, t: Date.now() });

    /* ---------------- חיבור ---------------- */
    ua.start = function () {
      closing = false;
      if (ua.ws && (ua.ws.readyState === 0 || ua.ws.readyState === 1)) return;
      let url = cfg.wss || '';
      if (!url) { emit('error', { msg: 'לא הוגדרה כתובת שרת' }); return; }
      if (!/^wss?:\/\//.test(url)) url = 'wss://' + url;
      ua.state = 'connecting'; emit('state', ua.state);
      try { ua.ws = new WebSocket(url, 'sip'); }
      catch (e) { emit('error', { msg: 'כתובת שרת לא תקינה' }); scheduleRetry(); return; }

      ua.ws.onopen = () => {
        retry = 0;
        ua._contactHost = rnd(12) + '.invalid';
        emit('transport', { up: true, url });
        register();
        clearInterval(kaTimer);
        /* keep-alive: CRLF כפול לפי RFC 5626 — שומר על ה-NAT פתוח */
        kaTimer = setInterval(() => { try { ua.ws.readyState === 1 && ua.ws.send('\r\n\r\n'); } catch (e) {} }, (cfg.keepAlive || 30) * 1000);
      };
      ua.ws.onmessage = ev => {
        const raw = typeof ev.data === 'string' ? ev.data : '';
        if (!raw.trim()) return;                       /* keep-alive מהשרת */
        log('in', raw);
        try { handle(parse(raw)); } catch (e) { console.error('[sip] parse', e); }
      };
      ua.ws.onclose = () => {
        clearInterval(kaTimer); clearInterval(regTimer);
        ua.state = 'offline'; emit('state', ua.state); emit('transport', { up: false });
        if (!closing) scheduleRetry();
      };
      ua.ws.onerror = () => emit('error', { msg: 'החיבור לשרת נכשל' });
    };
    function scheduleRetry() {
      if (closing) return;
      retry++;
      const wait = Math.min(30000, 1000 * Math.pow(2, Math.min(retry, 5)));
      emit('retry', { in: wait / 1000, attempt: retry });
      setTimeout(() => { if (!closing) ua.start(); }, wait);
    }
    ua.stop = function () {
      closing = true;
      clearInterval(kaTimer); clearInterval(regTimer);
      try { if (ua.state === 'registered') unregister(); } catch (e) {}
      setTimeout(() => { try { ua.ws && ua.ws.close(); } catch (e) {} }, 200);
      ua.state = 'offline'; emit('state', ua.state);
    };
    function send(msg) {
      if (!ua.ws || ua.ws.readyState !== 1) { emit('error', { msg: 'אין חיבור לשרת' }); return false; }
      log('out', msg); ua.ws.send(msg); return true;
    }

    /* ---------------- בניית בקשה ---------------- */
    function build(method, target, o) {
      o = o || {};
      const via = 'SIP/2.0/WSS ' + contactHost() + ';branch=' + (o.branch || branch()) + ';rport';
      const lines = [
        method + ' ' + target + ' SIP/2.0',
        'Via: ' + via,
        'Max-Forwards: 70',
        'From: ' + (cfg.displayName ? '"' + cfg.displayName + '" ' : '') + '<' + uri() + '>;tag=' + o.fromTag,
        'To: <' + (o.toUri || target) + '>' + (o.toTag ? ';tag=' + o.toTag : ''),
        'Call-ID: ' + o.callId,
        'CSeq: ' + o.cseq + ' ' + method,
      ];
      if (method !== 'ACK' && method !== 'CANCEL') lines.push('Contact: ' + contact());
      lines.push('User-Agent: CallBiz-Desktop/' + (window.APP_VERSION || '1.0'));
      if (o.auth) lines.push((o.proxy ? 'Proxy-Authorization: ' : 'Authorization: ') + o.auth);
      if (method === 'INVITE') {
        lines.push('Allow: ACK,CANCEL,BYE,INVITE,OPTIONS,INFO,NOTIFY,REFER,UPDATE');
        lines.push('Supported: replaces,timer,ice,outbound');
      }
      (o.extra || []).forEach(h => lines.push(h));
      const body = o.body || '';
      lines.push('Content-Type: ' + (body ? (o.ctype || 'application/sdp') : ''));
      if (!body) lines.pop();
      lines.push('Content-Length: ' + new Blob([body]).size);
      return lines.join('\r\n') + '\r\n\r\n' + body;
    }

    /* ---------------- רישום ---------------- */
    function register(auth, proxy) {
      regState.cseq = ++cseq;
      const msg = build('REGISTER', 'sip:' + cfg.domain, {
        callId: regState.callId, fromTag: regState.fromTag, cseq: regState.cseq,
        toUri: uri(), auth, proxy,
        extra: ['Expires: ' + (cfg.expires || 600)],
      });
      ua.pending[regState.callId + ':' + regState.cseq] = onRegisterResponse;
      ua.state = 'registering'; emit('state', ua.state);
      send(msg);
    }
    function unregister() {
      const c = ++cseq;
      send(build('REGISTER', 'sip:' + cfg.domain, {
        callId: regState.callId, fromTag: regState.fromTag, cseq: c, toUri: uri(),
        auth: regState.lastAuth, proxy: regState.proxy, extra: ['Expires: 0'],
      }));
    }
    function onRegisterResponse(res) {
      if (res.status === 401 || res.status === 407) {
        const proxy = res.status === 407;
        const ch = parseAuth(proxy ? res.h('proxy-authenticate') : res.h('www-authenticate'));
        if (regState.nc > 3) { ua.state = 'failed'; emit('state', ua.state);
          emit('error', { msg: 'שם משתמש או סיסמה שגויים, או שהשלוחה מושבתת' }); return; }
        regState.nc++;
        regState.challenge = ch;
        const a = digest(ch, { user: cfg.authUser || cfg.user, pass: cfg.pass, method: 'REGISTER', uri: 'sip:' + cfg.domain, nc: regState.nc });
        regState.lastAuth = a; regState.proxy = proxy;
        register(a, proxy);
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        regState.nc = 0;
        ua.state = 'registered'; emit('state', ua.state);
        emit('registered', { at: Date.now(), contact: res.h('contact') });
        const exp = parseInt((res.h('expires') || (res.h('contact').match(/expires=(\d+)/) || [])[1] || cfg.expires || 600), 10);
        clearInterval(regTimer);
        /* מחדשים מוקדם — 90% מהזמן — כדי שלא ייווצר חלון בלי רישום */
        regTimer = setInterval(() => register(regState.lastAuth, regState.proxy), Math.max(30, exp * 0.9) * 1000);
        return;
      }
      if (res.status >= 400) {
        ua.state = 'failed'; emit('state', ua.state);
        emit('error', { msg: 'הרישום נדחה · ' + res.status + ' ' + res.reason, code: res.status });
      }
    }

    /* ============================================================
       שיחות
       ============================================================ */
    function newDialog(o) {
      const d = Object.assign({
        callId: callid(), fromTag: tag(), toTag: '', cseq: 0, target: '', remote: '',
        pc: null, state: 'init', dir: 'out', route: [], remoteTarget: '', inviteBranch: '',
        held: false, auth: null, nc: 0, earlyMedia: false,
      }, o || {});
      ua.dialogs[d.callId] = d;
      return d;
    }

    async function makePc(d) {
      const ice = [];
      if (cfg.stun) ice.push({ urls: cfg.stun });
      if (cfg.turn) ice.push({ urls: cfg.turn, username: cfg.turnUser || '', credential: cfg.turnPass || '' });
      const pc = new RTCPeerConnection({ iceServers: ice, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
      d.pc = pc;
      pc.ontrack = e => { emit('media', { dialog: d, stream: e.streams[0] }); d.remoteStream = e.streams[0]; };
      pc.oniceconnectionstatechange = () => emit('ice', { dialog: d, state: pc.iceConnectionState });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: Object.assign({ echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          cfg.micId ? { deviceId: { exact: cfg.micId } } : {}),
        video: false,
      });
      d.localStream = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      return pc;
    }
    /* ממתינים ל-ICE כדי לשלוח SDP מלא. חצי שנייה תקרה — שרתים
       רבים לא צריכים את כל המועמדים כדי להתחיל. */
    function iceReady(pc, ms) {
      return new Promise(res => {
        if (pc.iceGatheringState === 'complete') return res();
        const done = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); };
        const chk = () => { if (pc.iceGatheringState === 'complete') done(); };
        const t = setTimeout(done, ms || 1500);
        pc.addEventListener('icegatheringstatechange', chk);
      });
    }

    /* ---------------- חיוג יוצא ---------------- */
    ua.invite = async function (number, opts) {
      opts = opts || {};
      const target = /^sips?:/.test(number) ? number : 'sip:' + number + '@' + cfg.domain;
      const d = newDialog({ target, remote: number, dir: 'out' });
      d.state = 'calling';
      try {
        const pc = await makePc(d);
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await iceReady(pc);
        d.localSdp = pc.localDescription.sdp;
        sendInvite(d);
        emit('call', { dialog: d, state: 'calling', number });
      } catch (e) {
        emit('error', { msg: e.name === 'NotAllowedError' ? 'אין הרשאת מיקרופון' : 'לא ניתן להתחיל שיחה', err: e });
        cleanup(d);
        return null;
      }
      return d;
    };
    /* proxy=true → הכותרת חייבת להיות Proxy-Authorization ולא
       Authorization. שרת שמאותגר ב-407 ומקבל Authorization פשוט
       יאתגר שוב, ללא סוף. */
    function sendInvite(d, auth, proxy) {
      d.cseq = ++cseq;
      d.inviteBranch = branch();
      d.inviteCseq = d.cseq;
      const msg = build('INVITE', d.target, {
        callId: d.callId, fromTag: d.fromTag, toTag: d.toTag, cseq: d.cseq,
        branch: d.inviteBranch, auth, proxy, body: d.localSdp,
        extra: opts2extra(d),
      });
      ua.pending[d.callId + ':' + d.cseq] = res => onInviteResponse(d, res);
      send(msg);
    }
    const opts2extra = d => d.replaces ? ['Replaces: ' + d.replaces] : [];

    async function onInviteResponse(d, res) {
      if (res.status === 401 || res.status === 407) {
        /* חובה ACK לתשובת השגיאה לפני שליחת INVITE חדש */
        ackFailure(d, res);
        if (d.nc > 3) { emit('error', { msg: 'אימות נכשל' }); return cleanup(d); }
        d.nc = (d.nc || 0) + 1;
        const proxy = res.status === 407;
        const ch = parseAuth(proxy ? res.h('proxy-authenticate') : res.h('www-authenticate'));
        const a = digest(ch, { user: cfg.authUser || cfg.user, pass: cfg.pass, method: 'INVITE', uri: d.target, nc: d.nc });
        /* אותו Call-ID ואותו From tag — הדיאלוג טרם נוצר, רק
           עסקה חדשה עם CSeq גבוה יותר. */
        sendInvite(d, a, proxy);
        return;
      }
      if (res.status === 100) { emit('call', { dialog: d, state: 'trying' }); return; }
      if (res.status === 180) { d.state = 'ringing'; emit('call', { dialog: d, state: 'ringing' }); return; }
      if (res.status === 183) {
        /* early media — מוזיקה או הודעה לפני מענה */
        d.toTag = res.toTag || d.toTag;
        if (res.body && d.pc && !d.pc.currentRemoteDescription) {
          try { await d.pc.setRemoteDescription({ type: 'answer', sdp: res.body }); d.earlyMedia = true; } catch (e) {}
        }
        emit('call', { dialog: d, state: 'progress', early: true });
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        d.toTag = res.toTag;
        d.remoteTarget = (res.h('contact').match(/<([^>]+)>/) || [])[1] || d.target;
        d.route = (res.headers['record-route'] || []).slice().reverse();
        if (res.body && d.pc) {
          try {
            if (d.earlyMedia && d.pc.currentRemoteDescription) { /* כבר הוגדר ב-183 */ }
            else await d.pc.setRemoteDescription({ type: 'answer', sdp: res.body });
          } catch (e) { emit('error', { msg: 'התאמת מדיה נכשלה', err: e }); }
        }
        sendAck(d);
        d.state = 'active'; d.answeredAt = Date.now();
        emit('call', { dialog: d, state: 'active' });
        return;
      }
      if (res.status >= 300) {
        ackFailure(d, res);
        const why = { 486: 'תפוס', 603: 'השיחה נדחתה', 404: 'מספר לא קיים', 480: 'לא זמין',
          408: 'אין מענה', 503: 'השירות לא זמין', 403: 'אין הרשאה לחייג',
          /* 488 כמעט תמיד אומר שהמכשיר מוגדר כטלפון רגיל ולא כ-WebRTC:
             הדפדפן חייב DTLS-SRTP, ופרופיל רגיל מצפה ל-RTP פשוט. */
          488: 'המרכזייה לא מקבלת את פורמט הקול — ודאו שהמכשיר מוגדר כ-WebRTC',
          606: 'אין קודק משותף עם המרכזייה',
          484: 'מספר חסר ספרות', 401: 'נדרשת הזדהות', 407: 'נדרשת הזדהות מול ה-proxy',
        }[res.status] || ('שגיאה ' + res.status);
        emit('call', { dialog: d, state: 'failed', reason: why, code: res.status });
        cleanup(d);
      }
    }
    function sendAck(d) {
      send(build('ACK', d.remoteTarget || d.target, {
        callId: d.callId, fromTag: d.fromTag, toTag: d.toTag, cseq: d.inviteCseq,
        toUri: d.target, extra: d.route,
      }));
    }
    /* ACK לשגיאה חייב לשאת את אותו branch של ה-INVITE */
    function ackFailure(d, res) {
      send(build('ACK', d.target, {
        callId: d.callId, fromTag: d.fromTag, toTag: res.toTag, cseq: d.inviteCseq || d.cseq,
        branch: d.inviteBranch, toUri: d.target,
      }));
    }

    /* ---------------- שיחה נכנסת ---------------- */
    async function onIncomingInvite(req) {
      const from = req.h('from');
      const number = (from.match(/sip:([^@>;]+)/) || [])[1] || 'לא ידוע';
      const name = (from.match(/^"?([^"<]*)"?\s*</) || [])[1] || '';
      const d = newDialog({
        callId: req.callId, fromTag: tag(), toTag: '', dir: 'in',
        remote: number, remoteName: name.trim(),
        target: (from.match(/<([^>]+)>/) || [])[1] || ('sip:' + number + '@' + cfg.domain),
        remoteTarget: (req.h('contact').match(/<([^>]+)>/) || [])[1] || '',
        theirTag: req.fromTag, inviteCseq: req.cseq.num, viaIn: req.h('via'),
        remoteSdp: req.body, route: (req.headers['record-route'] || []).slice(),
      });
      d.state = 'incoming';
      respond(req, 100, 'Trying');
      respond(req, 180, 'Ringing', null, d.fromTag);
      emit('incoming', { dialog: d, number, name: d.remoteName });
      emit('call', { dialog: d, state: 'incoming', number });
      d._req = req;
    }
    ua.answer = async function (d) {
      const req = d._req; if (!req) return;
      try {
        const pc = await makePc(d);
        await pc.setRemoteDescription({ type: 'offer', sdp: d.remoteSdp });
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        await iceReady(pc);
        respond(req, 200, 'OK', pc.localDescription.sdp, d.fromTag);
        d.state = 'active'; d.answeredAt = Date.now();
        emit('call', { dialog: d, state: 'active' });
      } catch (e) {
        respond(req, 486, 'Busy Here', null, d.fromTag);
        emit('error', { msg: e.name === 'NotAllowedError' ? 'אין הרשאת מיקרופון' : 'מענה נכשל', err: e });
        cleanup(d);
      }
    };
    ua.reject = function (d, code) {
      if (d._req) respond(d._req, code || 486, code === 603 ? 'Decline' : 'Busy Here', null, d.fromTag);
      emit('call', { dialog: d, state: 'ended', reason: 'נדחתה' });
      cleanup(d);
    };
    function respond(req, code, reason, body, toTag) {
      const vias = (req.headers['via'] || []).map(v => 'Via: ' + v);
      const to = req.h('to') + (toTag && !req.toTag ? ';tag=' + toTag : '');
      const lines = [
        'SIP/2.0 ' + code + ' ' + reason,
        ...vias,
        ...((req.headers['record-route'] || []).map(r => 'Record-Route: ' + r)),
        'From: ' + req.h('from'),
        'To: ' + to,
        'Call-ID: ' + req.callId,
        'CSeq: ' + req.h('cseq'),
      ];
      if (code >= 180 && code < 300) lines.push('Contact: ' + contact());
      if (code === 200 && req.method === 'INVITE') lines.push('Allow: ACK,CANCEL,BYE,INVITE,OPTIONS,INFO,NOTIFY,REFER');
      lines.push('User-Agent: CallBiz-Desktop/' + (window.APP_VERSION || '1.0'));
      if (body) lines.push('Content-Type: application/sdp');
      lines.push('Content-Length: ' + (body ? new Blob([body]).size : 0));
      send(lines.join('\r\n') + '\r\n\r\n' + (body || ''));
    }

    /* ---------------- ניתוק ---------------- */
    ua.hangup = function (d) {
      if (!d) return;
      if (d.state === 'calling' || d.state === 'ringing' || d.state === 'trying') {
        /* CANCEL חייב את אותו branch ו-CSeq של ה-INVITE */
        send(build('CANCEL', d.target, {
          callId: d.callId, fromTag: d.fromTag, toTag: d.toTag, cseq: d.inviteCseq,
          branch: d.inviteBranch, toUri: d.target,
        }));
      } else if (d.state === 'incoming') {
        return ua.reject(d);
      } else if (d.state === 'active' || d.state === 'held') {
        send(build('BYE', d.remoteTarget || d.target, {
          callId: d.callId, fromTag: d.fromTag, toTag: d.dir === 'in' ? d.theirTag : d.toTag,
          cseq: ++cseq, toUri: d.target, extra: d.route,
        }));
      }
      emit('call', { dialog: d, state: 'ended', reason: 'נותקה' });
      cleanup(d);
    };
    function cleanup(d) {
      try { d.pc && d.pc.close(); } catch (e) {}
      try { d.localStream && d.localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      d.pc = null; d.state = 'ended';
      delete ua.dialogs[d.callId];
      emit('ended', { dialog: d });
    }

    /* ---------------- המתנה אמיתית (re-INVITE) ----------------
       לא רק כיבוי הטראק — שולחים למרכזייה sendonly, וכך היא
       מנגנת מוזיקת המתנה ללקוח כמו בכל מרכזייה. */
    ua.hold = async function (d, on) {
      if (!d || !d.pc) return;
      const want = on == null ? !d.held : !!on;
      try {
        const offer = await d.pc.createOffer();
        let sdp = offer.sdp.replace(/a=sendrecv|a=sendonly|a=inactive/g, want ? 'a=sendonly' : 'a=sendrecv');
        await d.pc.setLocalDescription({ type: 'offer', sdp: offer.sdp });
        d.localSdp = sdp;
        d.cseq = ++cseq; d.inviteCseq = d.cseq; d.inviteBranch = branch();
        ua.pending[d.callId + ':' + d.cseq] = res => { if (res.status >= 200 && res.status < 300) sendAck(d); };
        send(build('INVITE', d.remoteTarget || d.target, {
          callId: d.callId, fromTag: d.fromTag, toTag: d.dir === 'in' ? d.theirTag : d.toTag,
          cseq: d.cseq, branch: d.inviteBranch, toUri: d.target, body: sdp, extra: d.route,
        }));
      } catch (e) {}
      d.held = want;
      if (d.localStream) d.localStream.getAudioTracks().forEach(t => { t.enabled = !want && !d.muted; });
      emit('call', { dialog: d, state: want ? 'held' : 'active' });
    };
    ua.mute = function (d, on) {
      if (!d) return;
      d.muted = on == null ? !d.muted : !!on;
      if (d.localStream) d.localStream.getAudioTracks().forEach(t => { t.enabled = !d.muted && !d.held; });
      emit('call', { dialog: d, state: d.state, muted: d.muted });
    };

    /* ---------------- DTMF ---------------- */
    ua.dtmf = function (d, key) {
      if (!d) return;
      if ((cfg.dtmfMode || 'rfc2833') === 'info') {
        send(build('INFO', d.remoteTarget || d.target, {
          callId: d.callId, fromTag: d.fromTag, toTag: d.dir === 'in' ? d.theirTag : d.toTag,
          cseq: ++cseq, toUri: d.target, ctype: 'application/dtmf-relay',
          body: 'Signal=' + key + '\r\nDuration=160\r\n', extra: d.route,
        }));
      } else if (d.pc) {
        const s = d.pc.getSenders().find(x => x.dtmf);
        if (s && s.dtmf) { try { s.dtmf.insertDTMF(key, 160, 70); } catch (e) {} }
      }
    };

    /* ---------------- העברה ---------------- */
    ua.transfer = function (d, to) {                 /* עיוורת */
      if (!d) return;
      const target = /^sips?:/.test(to) ? to : 'sip:' + to + '@' + cfg.domain;
      send(build('REFER', d.remoteTarget || d.target, {
        callId: d.callId, fromTag: d.fromTag, toTag: d.dir === 'in' ? d.theirTag : d.toTag,
        cseq: ++cseq, toUri: d.target, extra: ['Refer-To: <' + target + '>', 'Referred-By: <' + uri() + '>'].concat(d.route),
      }));
      emit('call', { dialog: d, state: 'transferring', to });
    };
    /* מלווה: מחברים את השיחה הראשונה לשנייה עם Replaces */
    ua.transferAttended = function (d, consultDialog) {
      if (!d || !consultDialog) return;
      const rep = encodeURIComponent(consultDialog.callId + ';to-tag=' + consultDialog.toTag + ';from-tag=' + consultDialog.fromTag);
      const to = (consultDialog.remoteTarget || consultDialog.target) + '?Replaces=' + rep;
      send(build('REFER', d.remoteTarget || d.target, {
        callId: d.callId, fromTag: d.fromTag, toTag: d.dir === 'in' ? d.theirTag : d.toTag,
        cseq: ++cseq, toUri: d.target,
        extra: ['Refer-To: <' + to + '>', 'Referred-By: <' + uri() + '>'].concat(d.route),
      }));
      emit('call', { dialog: d, state: 'transferring', to: consultDialog.remote });
    };

    /* ---------------- ניתוב הודעות נכנסות ---------------- */
    function handle(m) {
      if (m.kind === 'response') {
        const cb = ua.pending[m.callId + ':' + m.cseq.num];
        if (cb) { if (m.status >= 200) delete ua.pending[m.callId + ':' + m.cseq.num]; return cb(m); }
        return;
      }
      const d = ua.dialogs[m.callId];
      switch (m.method) {
        case 'INVITE':
          if (d && d.state !== 'incoming') { respond(m, 200, 'OK', d.localSdp, d.fromTag); return; }  /* re-INVITE נכנס */
          return onIncomingInvite(m);
        case 'ACK': return;
        case 'CANCEL':
          respond(m, 200, 'OK');
          if (d) { if (d._req) respond(d._req, 487, 'Request Terminated', null, d.fromTag);
            emit('call', { dialog: d, state: 'ended', reason: 'המתקשר ניתק' }); cleanup(d); }
          return;
        case 'BYE':
          respond(m, 200, 'OK');
          if (d) { emit('call', { dialog: d, state: 'ended', reason: 'הצד השני ניתק' }); cleanup(d); }
          return;
        case 'OPTIONS': return respond(m, 200, 'OK');
        case 'INFO': return respond(m, 200, 'OK');
        case 'NOTIFY':
          respond(m, 200, 'OK');
          /* NOTIFY על מצב ההעברה, או על הודעות בתא הקולי */
          if (/message-summary/.test(m.h('event'))) {
            const w = (m.body.match(/Messages-Waiting:\s*(yes|no)/i) || [])[1];
            const n = (m.body.match(/Voice-Message:\s*(\d+)/i) || [])[1];
            emit('voicemail', { waiting: /yes/i.test(w || ''), count: parseInt(n || '0', 10) });
          }
          if (/refer/i.test(m.h('event')) && /200/.test(m.body)) {
            if (d) { emit('call', { dialog: d, state: 'ended', reason: 'ההעברה הושלמה' }); cleanup(d); }
          }
          return;
        case 'MESSAGE':
          respond(m, 200, 'OK');
          emit('message', { from: (m.h('from').match(/sip:([^@>;]+)/) || [])[1], text: m.body });
          return;
        default: return respond(m, 405, 'Method Not Allowed');
      }
    }

    ua.registered = () => ua.state === 'registered';
    ua.dialogList = () => Object.values(ua.dialogs);
  }

  window.SIPStack = { UA, md5, parse, digest, parseAuth };
})();
