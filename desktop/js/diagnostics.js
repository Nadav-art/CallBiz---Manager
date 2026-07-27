/* ============================================================
   CallBiz Desktop · אבחון ופתרון תקלות
   ------------------------------------------------------------
   שתי שכבות:

   1. בדיקה לפני שיחה — מיקרופון, התקנים, יציאה לרשת, זמינות
      STUN/TURN ורוחב פס. כל בדיקה מחזירה מצב, סיבה בשפה פשוטה,
      והצעת תיקון שאפשר להפעיל בלחיצה.

   2. ניטור חי בזמן שיחה — כשמדד יורד מתחת לסף, נפתחת התראה עם
      הסיבה הסבירה והפעולה המומלצת, ולא רק מספר אדום.

   העיקרון: הנציג לא צריך להבין רשתות. הוא צריך לדעת מה קרה ומה
   לעשות עכשיו.
   ============================================================ */
(function () {

  const CHECKS = [
    {
      key: 'mic', label: 'מיקרופון',
      async run() {
        if (!navigator.mediaDevices) return bad('הדפדפן אינו תומך בגישה למיקרופון', 'יש לעבור לדפדפן עדכני');
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          const t = s.getAudioTracks()[0];
          const name = t ? t.label : '';
          s.getTracks().forEach(x => x.stop());
          return ok('פעיל' + (name ? ' · ' + name : ''));
        } catch (e) {
          if (e && e.name === 'NotAllowedError') return bad('ההרשאה נדחתה', 'לחצו על סמל המנעול בשורת הכתובת ואפשרו מיקרופון', 'perm');
          if (e && e.name === 'NotFoundError') return bad('לא נמצא מיקרופון', 'חברו אוזניות או מיקרופון והריצו שוב', 'device');
          return bad('לא ניתן לפתוח את המיקרופון', 'סגרו יישום אחר שמשתמש במיקרופון');
        }
      },
    },
    {
      key: 'devices', label: 'התקני שמע',
      async run() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return warn('לא ניתן לרשום התקנים', '');
        const d = await navigator.mediaDevices.enumerateDevices();
        const ins = d.filter(x => x.kind === 'audioinput'), outs = d.filter(x => x.kind === 'audiooutput');
        if (!ins.length) return bad('אין התקן קלט', 'חברו מיקרופון', 'device');
        return ok(ins.length + ' קלט · ' + (outs.length || 1) + ' פלט');
      },
    },
    {
      key: 'net', label: 'חיבור לרשת',
      async run() {
        if (!navigator.onLine) return bad('אין חיבור לאינטרנט', 'בדקו את הרשת או עברו לרשת אחרת', 'net');
        const c = navigator.connection;
        if (c && c.effectiveType && /2g/.test(c.effectiveType))
          return bad('הרשת איטית מאוד (' + c.effectiveType + ')', 'עברו ל-Wi-Fi או לחיבור קווי', 'net');
        const rtt = c ? c.rtt : null, down = c ? c.downlink : null;
        if (rtt != null && rtt > 300) return warn('השהיית רשת גבוהה · ' + rtt + 'ms', 'החיבור יעבוד, אך ייתכן הד או קטיעות');
        return ok((c && c.effectiveType ? c.effectiveType.toUpperCase() : 'מחובר')
          + (down ? ' · ' + down + 'Mb/s' : '') + (rtt ? ' · ' + rtt + 'ms' : ''));
      },
    },
    {
      key: 'stun', label: 'מעבר חומת אש (STUN)',
      async run() {
        try {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          pc.createDataChannel('probe');
          await pc.setLocalDescription(await pc.createOffer());
          const got = await new Promise(res => {
            let done = false;
            pc.onicecandidate = e => {
              if (!e.candidate) { if (!done) { done = true; res(false); } return; }
              if (/typ srflx|typ relay/.test(e.candidate.candidate) && !done) { done = true; res(true); }
            };
            setTimeout(() => { if (!done) { done = true; res(false); } }, 3000);
          });
          pc.close();
          return got ? ok('נמצא מסלול חוצה-רשת')
            : warn('לא נמצא מסלול ישיר', 'השיחות ינותבו דרך שרת TURN — איכות טובה, תעבורה גבוהה יותר');
        } catch (e) { return warn('בדיקה נכשלה', 'ניתן להמשיך — המערכת תבחר מסלול חלופי'); }
      },
    },
    {
      key: 'quality', label: 'איכות משוערת',
      async run() {
        const c = navigator.connection;
        const rtt = (c && c.rtt) || 40, mos = window.TEL ? TEL.mosFrom(rtt, 5, 0.3) : 4.2;
        if (mos >= 4) return ok('MOS ' + mos + ' · איכות מצוינת');
        if (mos >= 3.4) return warn('MOS ' + mos + ' · איכות סבירה', 'מומלץ לעבור לחיבור קווי');
        return bad('MOS ' + mos + ' · איכות נמוכה', 'המערכת תעבור לגשר טלפוני כדי לשמור על השיחה', 'net');
      },
    },
  ];

  const ok = (d) => ({ state: 'ok', detail: d });
  const warn = (d, fix) => ({ state: 'warn', detail: d, fix });
  const bad = (d, fix, kind) => ({ state: 'bad', detail: d, fix, kind });

  async function runAll(onEach) {
    const out = [];
    for (const c of CHECKS) {
      if (onEach) onEach({ key: c.key, label: c.label, state: 'run' });
      let r;
      try { r = await c.run(); } catch (e) { r = bad('שגיאה בבדיקה', ''); }
      const row = Object.assign({ key: c.key, label: c.label }, r);
      out.push(row);
      if (onEach) onEach(row);
    }
    return out;
  }

  /* ---------------- ניטור חי ---------------- */
  const THRESH = { mos: 3.4, loss: 3, jitter: 30, rtt: 250 };
  const REASONS = [
    { test: s => s.loss > THRESH.loss, t: 'איבוד חבילות',
      why: 'חלק מהקול לא מגיע — בדרך כלל רשת עמוסה או Wi-Fi חלש',
      fix: 'התקרבו לנתב, או עברו לחיבור קווי' },
    { test: s => s.jitter > THRESH.jitter, t: 'קול מקוטע',
      why: 'החבילות מגיעות בקצב לא אחיד', fix: 'סגרו הורדות או שיחות וידאו ברקע' },
    { test: s => s.rtt > THRESH.rtt, t: 'השהיה גבוהה',
      why: 'הקול מגיע באיחור וקשה לנהל שיחה', fix: 'החליפו רשת, או המשיכו בגשר טלפוני' },
    { test: s => s.mos < THRESH.mos, t: 'איכות ירודה',
      why: 'שילוב של השהיה ואיבוד חבילות', fix: 'המערכת יכולה לעבור לגשר טלפוני מיד' },
  ];
  let lastAlert = 0;
  function watch(stats) {
    const hit = REASONS.find(r => r.test(stats));
    if (!hit) return null;
    const now = Date.now();
    if (now - lastAlert < 15000) return null;
    lastAlert = now;
    return Object.assign({ at: now, stats: Object.assign({}, stats) }, hit);
  }

  window.DIAG = { CHECKS, runAll, watch, THRESH };
})();
