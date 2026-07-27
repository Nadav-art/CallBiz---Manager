/* ============================================================
   הרחבה: פולו-אפ מסונכרן  ·  key = 'fusync'
   ------------------------------------------------------------
   מה שהיה: פאנל הפולו-אפ הציג נתונים קבועים בקוד — שלושה ימים
   כתובים מראש (22–24/05), ארבעה חלונות עם "קיבולת" ו"תפוסים"
   דמיוניים, וכפתורי "בעוד 15 דק׳" עם שעות קשיחות. הוא לא הכיר
   את יומן העובד, לא את שעות העבודה שבהגדרות, לא את ההרשאות
   ולא את הקריטריונים של הפנייה.

   מה שיש עכשיו — הכול נגזר ממקורות האמת:
     · הימים   — ימי העבודה הפעילים של האחראי (הגדרות › שעות פעילות)
     · השעות   — המשמרות של אותו יום, בלי ההפסקות
     · התפוסה  — האירועים האמיתיים ביומן שלו (CAL_EVENTS) והתורים
     · העבר    — שעון המערכת; חלון שעבר אינו ניתן לבחירה
     · הרשאות  — עובד מתזמן לעצמו; שיבוץ לאחר דורש הרשאת מנהל
     · קריטריונים — העדפת הזמן של הלקוח מסומנת כמומלצת
   ============================================================ */
(function () {

  const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = t => { const p = String(t || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };

  /* מי האחראי על הפנייה — ולפי היומן שלו נבנה הפאנל */
  function ownerOf(r) {
    const name = (r && (r.assignee || r.owner)) || (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '');
    const emp = (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === name) : null;
    return { name, emp };
  }
  /* הרשאה: לעצמי תמיד; לאחר — רק אם יש הרשאת ניהול */
  function mayBookFor(name) {
    if (typeof CURRENT_USER === 'undefined' || name === CURRENT_USER) return true;
    if (window.CALROLE && CALROLE.canSee) return CALROLE.canSee(name);
    const me = (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === CURRENT_USER) : null;
    return !!me && (me.perm === 'מנהל רשת' || me.perm === 'אדמין' || me.perm === 'מנהל סניף');
  }

  /* ימי העבודה הבאים של האחראי — לפי ההגדרות, לא לפי תאריכים קשיחים */
  function daysFor(r, n) {
    const out = [];
    const base = (typeof COORD_TODAY !== 'undefined') ? COORD_TODAY : null;
    if (!base || typeof workSchedule === 'undefined') return out;
    const d0 = new Date(base + 'T00:00:00');
    for (let i = 0; out.length < (n || 3) && i < 21; i++) {
      const d = new Date(d0.getTime() + i * 86400000);
      const dayName = DOW[d.getDay()];
      const ws = workSchedule.find(x => x.day === dayName);
      if (!ws || !ws.on) continue;                       // יום שאינו פעיל בהגדרות
      out.push({
        label: i === 0 ? 'היום' : i === 1 ? 'מחר' : dayName,
        date: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'),
        iso: d.toISOString().slice(0, 10), dayName, ws, offset: i,
      });
    }
    return out;
  }

  /* חלונות היום — משמרות בלי הפסקות, בחתך שעה */
  function windowsFor(day) {
    if (!day) return [];
    const out = [];
    (day.ws.segments || []).forEach(sg => {
      if (sg.type === 'break') return;
      let a = toMin(sg.start); const end = toMin(sg.end);
      while (a + 60 <= end) { out.push({ from: a, to: a + 60, range: hm(a) + ' - ' + hm(a + 60) }); a += 60; }
      if (a < end && end - a >= 30) out.push({ from: a, to: end, range: hm(a) + ' - ' + hm(end) });
    });
    return out;
  }

  /* תפוסה אמיתית: אירועי היומן של האחראי + פולו-אפים שכבר נקבעו */
  function loadOf(win, day, owner) {
    const evs = (typeof CAL_EVENTS !== 'undefined' && CAL_EVENTS[owner.name]) || [];
    let busy = 0;
    if (day.offset === 0) evs.forEach(e => {                 // הדמו מחזיק אירועים ליום הראשון
      const a = e.h * 60, b = (e.h + e.dur) * 60;
      if (a < win.to && b > win.from) busy++;
    });
    const fus = (typeof RECORDS !== 'undefined' ? RECORDS : []).filter(x => {
      if (!x.fuAt) return false;
      return String(x.fuAt).indexOf(day.date) >= 0 && String(x.fuAt).indexOf(win.range) >= 0;
    }).length;
    const cap = Math.max(1, Math.round((win.to - win.from) / 15));   // רבע שעה לשיחה
    return { busy: busy + fus, cap, free: Math.max(0, cap - busy - fus) };
  }

  /* חלון שכבר עבר לפי שעון המערכת */
  function isPast(win, day) {
    if (day.offset !== 0) return false;
    const now = (typeof APP_NOW !== 'undefined' && APP_NOW.min != null) ? APP_NOW.min
      : (typeof nowHM === 'function' ? nowHM() : 0);
    return win.to <= now;
  }
  /* העדפת הזמן של הלקוח — מסומנת כמומלצת */
  const PREF = { morning: [8 * 60, 12 * 60], noon: [12 * 60, 16 * 60], evening: [16 * 60, 18 * 60] };
  function matchesPref(win, r) {
    const p = (r && r.needs && r.needs.timeOfDay) ? PREF[r.needs.timeOfDay] : null;
    return p ? (win.from >= p[0] && win.to <= p[1]) : false;
  }

  let fuDayIdx = 0;

  function panelHTML(r) {
    const own = ownerOf(r);
    const may = mayBookFor(own.name);
    const days = daysFor(r, 3);
    if (!days.length) return `<div class="fus-empty">${ic('alert')} אין ימי עבודה פעילים ל${esc(own.name)} — יש להגדיר שעות פעילות</div>`;
    if (fuDayIdx >= days.length) fuDayIdx = 0;
    const day = days[fuDayIdx];
    const wins = windowsFor(day);
    const cur = r.fuAt || null;

    return `<div class="fus">
      <div class="fus-src">${ic('sync')}
        <div><b>מסונכרן עם היומן של ${esc(own.name)}</b>
          <small>ימים ושעות מתוך הגדרות שעות הפעילות · תפוסה לפי האירועים ביומן
          ${(r.needs || {}).timeOfDay ? ' · העדפת הלקוח מסומנת' : ''}</small></div></div>
      ${!may ? `<div class="fus-block">${ic('lock')} אין לך הרשאה לקבוע ביומן של ${esc(own.name)} — פנה למנהל</div>` : ''}

      <div class="fu2-lbl">בחר יום · ימי עבודה בלבד</div>
      <div class="fu2-days">${days.map((d, i) => `<button class="fu2-day ${i === fuDayIdx ? 'on' : ''}" data-fusday="${i}">
        <b>${esc(d.label)}</b><small>${esc(d.date)}</small></button>`).join('')}</div>

      <div class="fu2-lbl">${ic('clock')} חלונות פנויים · ${esc(day.label)} ${esc(day.date)}</div>
      <div class="fu2-wins">${wins.length ? wins.map(w => {
        const L = loadOf(w, day, own), past = isPast(w, day), full = L.free <= 0;
        const label = `${day.label} ${day.date} · ${w.range}`;
        const isCur = cur === label;
        const dis = past || full || !may;
        const rec = matchesPref(w, r) && !dis;
        return `<button class="fu2-win ${dis ? 'full' : ''} ${isCur ? 'cur' : ''} ${rec ? 'rec' : ''}"
          ${dis ? 'disabled' : `data-fuspick="${esc(label)}"`}>
          <span class="fw-time">${w.range}</span>
          ${rec ? `<span class="fus-rec">${ic('target')} מועדף ללקוח</span>` : ''}
          ${isCur ? `<span class="fw-cap cur">✓ נבחר</span>`
            : `<span class="fw-cap ${past || full ? 'full' : L.free <= 2 ? 'low' : ''}">${past ? 'עבר' : full ? 'מלא' : L.free + ' פנויים'}</span>`}
        </button>`;
      }).join('') : `<div class="fus-empty">${ic('alert')} אין משמרת ביום הזה</div>`}</div>
    </div>`;
  }

  CBX.register({
    key: 'fusync', label: 'פולו-אפ מסונכרן ליומן ולהגדרות', icon: 'sync',
    desc: 'פאנל הפולו-אפ נגזר מיומן האחראי, משעות הפעילות שבהגדרות ומההרשאות — במקום ימים וחלונות שהיו כתובים קשיח בקוד. חלון שעבר או מלא נחסם, והעדפת הזמן של הלקוח מסומנת.',
    files: ['js/ext/fu-sync.js', 'css/ext/fusync.css'],
    install() {
      if (typeof renderFollowup === 'function') CBX.wrap('fusync', 'renderFollowup', o => function (r) {
        const out = o.apply(this, arguments);
        try {
          const body = document.querySelector('#modal .fu2');
          if (!body || !r) return out;
          /* מחליפים את הימים והחלונות הקשיחים בגזורים מהיומן */
          const old1 = body.querySelector('.fu2-days'), old2 = body.querySelector('.fu2-wins');
          const lbls = body.querySelectorAll('.fu2-lbl');
          const d = document.createElement('div'); d.innerHTML = panelHTML(r);
          const block = d.firstElementChild;
          if (old1 && old1.previousElementSibling && old1.previousElementSibling.classList.contains('fu2-lbl'))
            old1.previousElementSibling.remove();
          if (old2 && old2.previousElementSibling && old2.previousElementSibling.classList.contains('fu2-lbl'))
            old2.previousElementSibling.remove();
          if (old1) old1.remove();
          if (old2) old2.parentNode.insertBefore(block, old2), old2.remove();
          else body.insertBefore(block, body.firstChild.nextSibling);

          block.querySelectorAll('[data-fusday]').forEach(b => b.addEventListener('click', () => {
            fuDayIdx = +b.dataset.fusday; renderFollowup(r);
          }));
          block.querySelectorAll('[data-fuspick]').forEach(b => b.addEventListener('click', () => {
            r.fuAt = b.dataset.fuspick;
            r.next = { type: 'followup', at: r.fuAt };
            toast('מועד הפולו-אפ נקבע · ' + r.fuAt);
            renderFollowup(r);
            if (typeof renderList === 'function') renderList();
          }));
        } catch (e) { console.error('[fusync]', e); }
        return out;
      });
    },
  });

  window.FUSYNC = { days: daysFor, windows: windowsFor, load: loadOf, owner: ownerOf, may: mayBookFor };
})();
