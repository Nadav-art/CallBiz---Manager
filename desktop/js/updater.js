/* ============================================================
   CallBiz Desktop · פלטפורמת עדכונים
   ------------------------------------------------------------
   הנציג לא צריך לדעת מה זה cache או גרסה. הוא מקבל חיווי אחד:
   "יש עדכון" → לוחץ → המערכת מתעדכנת ונטענת מחדש. כמו אפליקציה
   בטלפון.

   איך זה עובד:
     · version.json יושב לצד האפליקציה ומכיל את הגרסה הנוכחית,
       תאריך, ומה חדש. זה הקובץ היחיד שצריך לעדכן כדי לשחרר.
     · בכל הפעלה, ואז כל 15 דקות, נבדק הקובץ עם מניעת cache.
     · אם המספר גבוה ממה שרץ — מוצג באנר עדין (ולא חוסם).
     · לחיצה על "עדכן" מנקה את ה-cache של הקבצים ומרעננת עם
       חותמת גרסה חדשה, כך שהדפדפן מושך את הקוד החדש בוודאות.
     · אם העדכון מסומן critical — לא ניתן לדחות.

   בזמן שיחה פעילה העדכון לא מופעל אוטומטית ולא מציק — ממתין
   לסיום השיחה. אף פעם לא מנתקים נציג באמצע.
   ============================================================ */
(function () {

  const RUNNING = window.APP_VERSION || '1.0.0';
  const SEEN = 'cbd_seenVer', LAST = 'cbd_lastCheck';
  let latest = null, banner = null, timer = null;

  const cmp = (a, b) => {
    const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) { if ((A[i] || 0) > (B[i] || 0)) return 1; if ((A[i] || 0) < (B[i] || 0)) return -1; }
    return 0;
  };

  async function check(manual) {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw 0;
      const v = await r.json();
      localStorage.setItem(LAST, String(Date.now()));
      latest = v;
      if (cmp(v.version, RUNNING) > 0) { show(v); return v; }
      if (manual) toast('הגרסה שלך עדכנית · ' + RUNNING);
      return null;
    } catch (e) {
      if (manual) toast('לא ניתן לבדוק עדכונים כרגע');
      return null;
    }
  }

  function show(v) {
    if (banner) banner.remove();
    const critical = !!v.critical;
    const dismissed = localStorage.getItem(SEEN) === v.version;
    if (dismissed && !critical) return;
    banner = document.createElement('div');
    banner.className = 'upd' + (critical ? ' crit' : '');
    banner.innerHTML = `
      <span class="upd-i">${ic(critical ? 'alert' : 'refresh')}</span>
      <div class="upd-t">
        <b>${critical ? 'עדכון חובה זמין' : 'יש גרסה חדשה'} · ${esc(v.version)}</b>
        <small>${esc(v.summary || 'שיפורים ותיקונים')}</small>
      </div>
      <button class="upd-go">${ic('refresh')} עדכן עכשיו</button>
      ${critical ? '' : '<button class="upd-later">אחר כך</button>'}
      <button class="upd-more" title="מה חדש">${ic('alert')}</button>`;
    document.body.appendChild(banner);
    banner.querySelector('.upd-go').addEventListener('click', () => apply(v));
    const l = banner.querySelector('.upd-later');
    if (l) l.addEventListener('click', () => { localStorage.setItem(SEEN, v.version); banner.remove(); banner = null; });
    banner.querySelector('.upd-more').addEventListener('click', () => notes(v));
  }

  function notes(v) {
    if (!window.UIX) return;
    UIX.modal('מה חדש בגרסה ' + v.version, `
      <p class="m-l">${esc(v.date || '')}${v.summary ? ' · ' + esc(v.summary) : ''}</p>
      <ul class="upd-list">${(v.notes || []).map(n => `<li>${esc(n)}</li>`).join('') || '<li>שיפורים ותיקונים</li>'}</ul>
      <p class="m-l sm">הגרסה שרצה אצלך: ${esc(RUNNING)}</p>`);
  }

  /* העדכון עצמו — ניקוי cache ורענון עם חותמת חדשה */
  async function apply(v) {
    const c = window.TEL && TEL.call();
    if (c && c.state === 'active') {
      toast('יש שיחה פעילה — העדכון יתבצע מיד בסיומה');
      if (window.TEL) TEL.on('ended', () => setTimeout(() => apply(v), 800));
      return;
    }
    if (banner) { banner.querySelector('.upd-go').innerHTML = '<i class="spin"></i> מעדכן…'; }
    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(() => {})));
      }
    } catch (e) {}
    localStorage.setItem(SEEN, v.version);
    /* חותמת הגרסה בכתובת מבטיחה משיכה מחדש של כל הקבצים */
    const u = new URL(location.href);
    u.searchParams.set('v', v.version);
    location.replace(u.toString());
  }

  const toast = t => { if (window.UIX) UIX.toast(t); };

  function start() {
    check();
    clearInterval(timer);
    timer = setInterval(check, 15 * 60 * 1000);
    /* בדיקה גם כשחוזרים לחלון אחרי שהיה ברקע */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  window.UPDATER = { check, apply, start, running: RUNNING, latest: () => latest, notes };
})();
