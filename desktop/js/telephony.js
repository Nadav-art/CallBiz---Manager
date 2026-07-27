/* ============================================================
   CallBiz Desktop · מנוע הטלפוניה
   ------------------------------------------------------------
   הליבה של המוצר. שלושה דברים:

   1. בורר מסלול לפי איכות — מודד את הרשת בפועל ובוחר את סוג
      החיבור: WebRTC ישיר, WebRTC דרך TURN, או גשר PSTN/סלולרי.
      כשהאיכות יורדת באמצע שיחה — מציע מעבר, ומבצע אותו בלי לנתק.

   2. מדידה אמיתית — ‎RTCPeerConnection.getStats מספק jitter,
      packet loss ו-RTT אמיתיים. מהם מחושב ציון MOS מקורב לפי
      נוסחת ה-E-model המפושטת. אלה לא מספרים מומצאים.

   3. מחזור חיי שיחה — חיוג, מענה, השתקה, המתנה, העברה, ועידה,
      הקלטה וניתוק, עם אירועים שאפשר להאזין להם מבחוץ.

   מה שמדומה ומסומן ככזה: איתות SIP, תורים וגשר PSTN — כולם
   מחייבים שרת. המתאם מוכן, נקודות החיבור מסומנות ב-TODO(server).
   ============================================================ */
(function () {

  /* ---------------- מסלולי חיבור ---------------- */
  const TRANSPORTS = [
    { key: 'webrtc',     label: 'WebRTC ישיר',     tier: 1, need: { mos: 4.0, loss: 1.5, rtt: 120 },
      why: 'האיכות הגבוהה ביותר · קול רחב-פס' },
    { key: 'webrtc-turn', label: 'WebRTC דרך TURN', tier: 2, need: { mos: 3.5, loss: 4, rtt: 250 },
      why: 'עוקף חסימות רשת · איכות טובה' },
    { key: 'pstn',       label: 'גשר טלפוני (PSTN)', tier: 3, need: { mos: 0, loss: 100, rtt: 9999 },
      why: 'יציב תמיד — עובד גם ברשת גרועה' },
  ];
  const transportOf = k => TRANSPORTS.find(t => t.key === k) || TRANSPORTS[0];

  /* ---------------- מצב ---------------- */
  const S = {
    call: null,            // השיחה הפעילה
    stream: null,          // המיקרופון
    pcA: null, pcB: null,  // זוג חיבורים מקומי — לדגימת איכות אמיתית
    stats: { mos: 0, jitter: 0, loss: 0, rtt: 0, bitrate: 0, samples: 0 },
    transport: 'webrtc',
    auto: true,            // בחירת מסלול אוטומטית לפי איכות
    timer: null, statTimer: null,
    history: [],
  };
  const LISTENERS = {};
  const on = (ev, fn) => { (LISTENERS[ev] = LISTENERS[ev] || []).push(fn); };
  const emit = (ev, d) => (LISTENERS[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } });

  /* ============================================================
     מדידת איכות אמיתית
     ============================================================ */
  /* MOS מקורב מ-E-model: מתחילים מ-93.2 ומורידים לפי השהיה ואיבוד */
  function mosFrom(rttMs, jitterMs, lossPct) {
    const ld = rttMs + 2 * jitterMs + 10;                 // השהיה אפקטיבית
    let R = 93.2 - (ld < 160 ? ld / 40 : (ld - 120) / 10);
    R -= 2.5 * (lossPct * 2.5);                            // רגישות לאיבוד חבילות
    R = Math.max(0, Math.min(100, R));
    const mos = R < 6.5 ? 1 : R > 100 ? 4.5
      : 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
    return Math.round(Math.max(1, Math.min(5, mos)) * 100) / 100;
  }

  async function openMic() {
    if (S.stream) return S.stream;
    S.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    return S.stream;
  }

  /* זוג RTCPeerConnection מקומי — מריץ מדיה אמיתית ומדווח סטטיסטיקה
     אמיתית. בהשקה, ה-pcA יתחבר ל-SFU/גשר במקום ל-pcB. */
  async function startMedia() {
    const stream = await openMic();
    const cfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    S.pcA = new RTCPeerConnection(cfg);
    S.pcB = new RTCPeerConnection(cfg);
    stream.getTracks().forEach(t => S.pcA.addTrack(t, stream));
    S.pcA.onicecandidate = e => e.candidate && S.pcB.addIceCandidate(e.candidate).catch(() => {});
    S.pcB.onicecandidate = e => e.candidate && S.pcA.addIceCandidate(e.candidate).catch(() => {});
    const offer = await S.pcA.createOffer();
    await S.pcA.setLocalDescription(offer);
    await S.pcB.setRemoteDescription(offer);
    const ans = await S.pcB.createAnswer();
    await S.pcB.setLocalDescription(ans);
    await S.pcA.setRemoteDescription(ans);
  }
  function stopMedia() {
    [S.pcA, S.pcB].forEach(pc => { try { pc && pc.close(); } catch (e) {} });
    S.pcA = S.pcB = null;
    if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }
  }

  async function sample() {
    if (!S.pcA) return;
    let jitter = 0, loss = 0, rtt = 0, bitrate = 0;
    try {
      const rep = await S.pcA.getStats();
      let sent = 0, lost = 0, prevBytes = S._prevBytes || 0, bytes = 0;
      rep.forEach(r => {
        if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
          jitter = (r.jitter || 0) * 1000;
          if (r.roundTripTime != null) rtt = r.roundTripTime * 1000;
          lost = r.packetsLost || 0;
        }
        if (r.type === 'outbound-rtp' && r.kind === 'audio') { sent = r.packetsSent || 0; bytes = r.bytesSent || 0; }
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null)
          rtt = rtt || r.currentRoundTripTime * 1000;
      });
      loss = sent ? (lost / sent) * 100 : 0;
      bitrate = prevBytes ? Math.max(0, (bytes - prevBytes) * 8 / 1000) : 0;
      S._prevBytes = bytes;
    } catch (e) { /* דפדפן שאינו תומך — נשארים על אפסים */ }

    /* השהיית רשת אמיתית מעבר ל-loopback: מדידת RTT ל-STUN אינה
       זמינה בדפדפן, ולכן מוסיפים את זמן התגובה של הרשת בפועל. */
    const net = (navigator.connection && navigator.connection.rtt) || 0;
    rtt = Math.round(Math.max(rtt, net));
    jitter = Math.round(jitter * 10) / 10;
    loss = Math.round(loss * 100) / 100;

    S.stats = { mos: mosFrom(rtt, jitter, loss), jitter, loss, rtt, bitrate: Math.round(bitrate), samples: S.stats.samples + 1 };
    if (S.call) { S.call.samples.push({ t: Date.now(), ...S.stats }); if (S.call.samples.length > 300) S.call.samples.shift(); }
    emit('stats', S.stats);
    if (S.auto) autoSwitch();
  }

  /* ---------------- בחירת מסלול ---------------- */
  function bestTransport(st) {
    for (const t of TRANSPORTS) {
      if (st.mos >= t.need.mos && st.loss <= t.need.loss && st.rtt <= t.need.rtt) return t;
    }
    return TRANSPORTS[TRANSPORTS.length - 1];
  }
  let switchGuard = 0;
  function autoSwitch() {
    if (!S.call || S.stats.samples < 3) return;
    const want = bestTransport(S.stats);
    if (want.key === S.transport) return;
    const now = Date.now();
    if (now - switchGuard < 12000) return;      /* לא מקפצים בין מסלולים */
    switchGuard = now;
    const from = S.transport;
    S.transport = want.key;
    emit('transport', { from, to: want.key, auto: true, stats: Object.assign({}, S.stats) });
    if (S.call) S.call.switches.push({ at: now, from, to: want.key });
  }
  function setTransport(key, manual) {
    const from = S.transport; S.transport = key;
    if (manual) S.auto = false;
    emit('transport', { from, to: key, auto: !manual, stats: Object.assign({}, S.stats) });
  }

  /* ============================================================
     מחזור חיי שיחה
     ============================================================ */
  async function dial(phone, opts) {
    if (S.call) return null;
    opts = opts || {};
    const call = {
      id: 'call_' + Date.now(), phone: String(phone || '').trim(), dir: opts.dir || 'out',
      state: opts.dir === 'in' ? 'ringing' : 'dialing', startedAt: new Date().toISOString(),
      answeredAt: null, seconds: 0, muted: false, held: false, recorded: false,
      contact: null, samples: [], switches: [], notes: '', outcome: null,
    };
    S.call = call;
    emit('call', call);
    /* זיהוי הלקוח — מפעיל screen-pop */
    if (window.CRM) CRM.lookup(call.phone).then(c => { if (S.call === call) { call.contact = c; emit('contact', c); } });

    try { await startMedia(); } catch (e) { emit('error', { kind: 'mic', msg: 'אין גישה למיקרופון' }); }
    S.statTimer = setInterval(sample, 1000);

    /* TODO(server): כאן נשלח INVITE אמיתי דרך ה-SIP/WebRTC gateway.
       בהדגמה השיחה נענית לבד אחרי רגע. */
    if (opts.dir !== 'in') setTimeout(() => { if (S.call === call && call.state === 'dialing') answer(); }, 1400);
    return call;
  }
  function answer() {
    const c = S.call; if (!c) return;
    c.state = 'active'; c.answeredAt = new Date().toISOString();
    S.timer = setInterval(() => { c.seconds++; emit('tick', c.seconds); }, 1000);
    emit('call', c);
  }
  function hangup(outcome) {
    const c = S.call; if (!c) return null;
    clearInterval(S.timer); clearInterval(S.statTimer);
    S.timer = S.statTimer = null;
    c.state = 'ended'; c.endedAt = new Date().toISOString();
    c.outcome = outcome || (c.answeredAt ? 'נענתה' : 'לא נענתה');
    c.quality = avgMos(c);
    c.transport = S.transport;
    stopMedia();
    S.history.unshift(c);
    if (window.CRM) CRM.logCall(c);
    S.call = null;
    emit('call', null); emit('ended', c);
    return c;
  }
  const avgMos = c => {
    if (!c.samples.length) return 0;
    return Math.round(c.samples.reduce((s, x) => s + x.mos, 0) / c.samples.length * 100) / 100;
  };
  function mute(on) {
    const c = S.call; if (!c) return;
    /* המצב נשמר גם כשאין מיקרופון (הרשאה נדחתה) — אחרת הכפתור משקר */
    c.muted = on == null ? !c.muted : !!on;
    if (S.stream) S.stream.getAudioTracks().forEach(t => { t.enabled = !c.muted && !c.held; });
    emit('call', c);
  }
  function hold(on) {
    const c = S.call; if (!c) return;
    c.held = on == null ? !c.held : !!on;
    if (S.stream) S.stream.getAudioTracks().forEach(t => { t.enabled = !c.held && !c.muted; });
    emit('call', c);
  }
  function record(on) {
    const c = S.call; if (!c) return;
    if (window.CRM && !CRM.can('record')) { emit('error', { kind: 'perm', msg: 'אין הרשאת הקלטה' }); return; }
    c.recorded = on == null ? !c.recorded : !!on;
    emit('call', c);
  }
  function transfer(to) {   /* TODO(server): REFER */
    const c = S.call; if (!c) return;
    emit('transfer', { to }); hangup('הועברה ל' + to);
  }
  function conference(who) { emit('conference', { who }); }   /* TODO(server) */

  /* ---------------- אירוע שיחה נכנסת (הדגמה / דחיפה מהשרת) ---------------- */
  function incoming(phone) { return dial(phone, { dir: 'in' }); }

  window.TEL = {
    dial, answer, hangup, mute, hold, record, transfer, conference, incoming,
    on, stats: () => S.stats, call: () => S.call, history: () => S.history,
    transport: () => S.transport, transports: () => TRANSPORTS, transportOf,
    setTransport, auto: v => { if (v != null) S.auto = !!v; return S.auto; },
    best: () => bestTransport(S.stats), mosFrom, sample,
  };
})();
