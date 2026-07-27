/* ============================================================
   CallBiz Desktop · הרכבה
   ------------------------------------------------------------
   מחבר את כל השכבות: זהות מה-CRM → מנוע טלפוניה → ממשק →
   התראות בזמן אמת. שום שכבה לא מכירה את השנייה ישירות, הכל דרך
   אירועים — כדי שאפשר יהיה להחליף את המנוע בשרת אמיתי בלי לגעת
   בממשק.
   ============================================================ */
(async function () {

  /* 1. זהות והרשאות — לפני הכל.
     קודם מנסים חיבור אוטומטי מפורטל הנציגים; אם הוא הצליח, הסשן
     כבר בפנים ו-CRM.connect לא ידרוס אותו. */
  if (window.SSO) { try { await SSO.boot(); } catch (e) {} }
  if (!CRM.ready()) await CRM.connect();
  UIX.rail(); UIX.stage();

  /* 1ב. חיבור למרכזייה — אוטומטי אם כך הוגדר */
  if (window.SIPCFG) {
    SIPCFG.on('state', st => {
      UIX.rail();
      if (st.state === 'registered') UIX.alert2({ t: 'מחובר למרכזייה', kind: 'info', icon: 'check',
        why: 'שלוחה ' + (SIPCFG.get().user || '') + ' · שיחות נכנסות ינותבו לכאן' });
      if (st.state === 'failed') UIX.alert2({ t: 'החיבור למרכזייה נכשל', kind: 'bad', icon: 'alert',
        why: st.error, sticky: true, action: 'בדיקת מוכנות',
        onAction: () => { UIX.go('set'); if (window.SETUI) SETUI.preflight(); } });
    });
    SIPCFG.on('voicemail', v => { if (v.count) UIX.alert2({ t: v.count + ' הודעות בתא הקולי', kind: 'info', icon: 'alert' }); });
    /* מתחברים לבד רק כשבאמת יש עם מה — אחרת הנציג מקבל שגיאה
       בהפעלה ראשונה, לפני שהספיק להגדיר משהו. */
    const c0 = SIPCFG.get();
    const ready = c0.mode === 'managed'
      ? (window.PROV && PROV.requirement().need === 'nothing')
      : !!(c0.wss && c0.user);
    if (c0.autoStart && ready && !SIPCFG.connected()) SIPCFG.connect();
  }
  /* 1ג. Check-in אוטומטי — הנציג לא נוגע בזה
     ------------------------------------------------------------
     במרכזייה, מכשיר שאינו משויך לנציג לא יכול לחייג ולא מקבל
     שיחות מהתור (FACILITY_NOT_SUBSCRIBED). בממשק של הספק זה
     נעשה ידנית: הנציג מקבל קוד ‎**NNNN ומחייג אליו.

     כאן זה קורה לבד: פתיחת הדסקטופ = check-in, סגירה = check-out.
     forceCheckOut משחרר את הנציג ממכשיר קודם — למשל אם נשאר
     מחובר בחייגן הווב מאתמול. */
  if (window.PBXAPI && CRM.session()) {
    const ses = CRM.session(), emp = ses.employee || {};
    const uid = emp.pbxUserId || emp.id, did = emp.pbxDeviceId;
    if (uid) {
      PBXAPI.configure({ userId: uid, deviceId: did });
      const r = await PBXAPI.checkIn({ force: true });
      if (r && r.success) {
        UIX.alert2({ t: 'מחובר למוקד', kind: 'info', icon: 'check',
          why: 'המכשיר שויך אליך — שיחות מהתור ינותבו לכאן' });
      } else if (r && r.data) {
        /* המרכזייה ביקשה אישור בחיוג — עושים גם את זה לבד */
        UIX.alert2({ t: 'משלים חיבור למוקד…', kind: 'info', icon: 'phone' });
        TEL.dial(r.data, { silent: true });
      } else {
        UIX.alert2({ t: 'לא בוצע חיבור למוקד', kind: 'warn', sticky: true,
          why: 'בלי זה לא ניתן לחייג ולא יתקבלו שיחות מהתור.',
          fix: (r && r.msg) || 'בדוק שהנציג משויך למכשיר במרכזייה',
          action: 'נסה שוב', onAction: () => PBXAPI.checkIn({ force: true }) });
      }
      /* שחרור בסגירה — כדי שהמכשיר לא יישאר תפוס */
      window.addEventListener('pagehide', () => {
        try { navigator.sendBeacon && PBXAPI.checkOut(); } catch (e) {}
      });
    }
  }

  /* שיחה נכנסת אמיתית מהמרכזייה → למנוע הטלפוניה */
  if (window.SIPCFG) SIPCFG.on('incoming', d => {
    if (window.TEL && TEL.adoptSip) TEL.adoptSip(d.dialog);
    UIX.go('phone');
  });

  if (!CRM.isActive()) {
    UIX.alert2({ t: 'העובד אינו מסומן כפעיל ב-CRM', kind: 'warn', sticky: true,
      why: 'שיחות לא ינותבו אליך עד שהסטטוס יעודכן במערכת הניהול.' });
  }
  if (CRM.mode() === 'demo') {
    UIX.alert2({ t: 'מצב הדגמה — אין חיבור ל-CRM', kind: 'info', icon: 'alert',
      why: 'הזהות, ההרשאות והלקוחות הם נתוני הדגמה. בהפעלה מתוך המנג׳ר הכל מגיע משם.' });
  }

  /* 2. מחזור השיחה → רענון הממשק */
  TEL.on('call', () => { if (UIX.state.view === 'phone') UIX.phone(); });
  TEL.on('tick', () => {
    const el = document.querySelector('.live-time');
    const c = TEL.call(); if (el && c) el.textContent = STATS.fmtSec(c.seconds);
  });
  TEL.on('contact', c => {
    if (UIX.state.view === 'phone') UIX.phone();
    if (c) UIX.alert2({ t: 'זוהה: ' + c.name, kind: 'info', icon: 'crm',
      why: (c.org || '') + (c.lastCall ? ' · שיחה אחרונה ' + c.lastCall : ''),
      action: 'פתח כרטיס', onAction: () => { CRM.screenPop(c); UIX.go('crm'); } });
  });

  /* 3. איכות — עדכון חי + זיהוי תקלה בשפה פשוטה */
  TEL.on('stats', st => {
    if (UIX.state.view === 'phone') {
      const map = { mos: st.mos || '—', loss: (st.loss || 0) + '%', jitter: (st.jitter || 0) + 'ms', rtt: (st.rtt || 0) + 'ms' };
      const boxes = document.querySelectorAll('.q-b');
      const vals = [map.mos, map.loss, map.jitter, map.rtt];
      boxes.forEach((b, i) => { const v = b.querySelector('b'); if (v) v.textContent = vals[i]; });
    }
    const issue = DIAG.watch(st);
    if (issue) UIX.alert2({ t: issue.t, why: issue.why, fix: issue.fix, kind: 'warn', sticky: true,
      action: 'עבור לגשר טלפוני', onAction: () => TEL.setTransport('pstn', true) });
  });

  /* 4. מעבר מסלול — הודעה שקטה, בלי לקטוע את השיחה */
  TEL.on('transport', e => {
    const to = TEL.transportOf(e.to);
    UIX.alert2({ t: 'החיבור עבר ל' + to.label, kind: e.to === 'pstn' ? 'warn' : 'info',
      icon: 'wifi', why: e.auto ? 'המעבר בוצע אוטומטית לפי איכות הרשת' : 'נבחר ידנית' });
    if (UIX.state.view === 'phone') UIX.phone();
  });

  /* 5. סיום שיחה → סיכום קצר */
  TEL.on('ended', c => {
    UIX.alert2({ t: 'השיחה הסתיימה · ' + STATS.fmtSec(c.seconds), kind: 'info', icon: 'check',
      why: 'איכות ממוצעת ' + (c.quality || '—') + ' · ' + TEL.transportOf(c.transport).label +
        (c.switches.length ? ' · ' + c.switches.length + ' מעברי מסלול' : '') });
    if (UIX.state.view === 'stats') UIX.stage();
  });

  TEL.on('error', e => UIX.alert2({ t: e.msg, kind: 'bad', icon: 'alert' }));

  /* 6. חיוג יזום מהמנג׳ר (click-to-call) */
  CRM.on('dial', d => {
    if (!CRM.can('call')) return UIX.alert2({ t: 'אין הרשאת חיוג', kind: 'bad' });
    TEL.dial(d.phone);
    UIX.go('phone');
  });
  CRM.on('session', () => UIX.rail());

  /* 7. קיצורי מקלדת של שולחן עבודה */
  document.addEventListener('keydown', e => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const c = TEL.call();
    if (e.key === 'm' && c) { TEL.mute(); }
    if (e.key === 'h' && c) { TEL.hold(); }
    if (e.key === 'Escape' && c) { TEL.hangup(); }
    if (e.key === 'Enter' && !c) { const v = (document.getElementById('padIn') || {}).value; if (v) TEL.dial(v); }
  });

  /* 8. עדכונים — בדיקה בהפעלה ואז ברקע */
  if (window.UPDATER) UPDATER.start();

  console.log('[CallBiz Desktop] מוכן ·', CRM.mode(), '· גרסה', window.APP_VERSION);
})();
