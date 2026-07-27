/* ============================================================
   הרחבה: תזכורת רק כשהיא באמת נדרשת  ·  key = 'remindg'
   ------------------------------------------------------------
   מה שהיה: אוטומציית התזכורת (a3) רצה על כל פנייה שיש לה פגישה —
   בלי לבדוק מתי הפגישה, אם היא כבר עברה, אם היא בכלל היום, ואם
   כבר נשלחה תזכורת. התוצאה: התראות שלא היו צריכות לקרות.

   הכלל עכשיו — תזכורת נשלחת רק אם כל אלה מתקיימים:
     · יש פגישה עם מועד תקין
     · המועד עוד לא עבר
     · נותר פחות מחלון התזכורת שהוגדר (ברירת מחדל: שעה)
     · טרם נשלחה תזכורת לאותו מועד
     · הפנייה אינה סגורה
   ============================================================ */
(function () {

  const KEY = 'cb_remindLead';
  const leadMins = () => { try { const v = +localStorage.getItem(KEY); return v > 0 ? v : 60; } catch (e) { return 60; } };
  const setLead = m => { try { localStorage.setItem(KEY, String(Math.max(5, +m || 60))); } catch (e) {} };

  /* "עכשיו" לפי שעון המערכת (שעון הפיתוח כשהוא פעיל) */
  function nowMin() {
    const base = (typeof COORD_TODAY !== 'undefined') ? COORD_TODAY : null;
    const min = (typeof APP_NOW !== 'undefined' && APP_NOW.min != null) ? APP_NOW.min
      : (typeof nowHM === 'function' ? nowHM() : 0);
    if (!base) return null;
    return { day: base, min };
  }
  /* המרת מועד הפגישה (DD/MM/YY + HH:MM) לדקות מוחלטות */
  function meetAt(r) {
    const m = r && r.meeting; if (!m || !m.date || !m.time) return null;
    const d = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(String(m.date));
    const t = /^(\d{1,2}):(\d{2})$/.exec(String(m.time));
    if (!d || !t) return null;
    const iso = '20' + d[3] + '-' + d[2] + '-' + d[1];
    return { iso, min: (+t[1]) * 60 + (+t[2]) };
  }
  const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);

  /* האם התזכורת נדרשת — ולמה לא */
  function due(r) {
    if (!r || r.done) return { ok: false, why: 'הפנייה סגורה' };
    const at = meetAt(r);
    if (!at) return { ok: false, why: 'אין פגישה קבועה' };
    const now = nowMin();
    if (!now) return { ok: false, why: 'אין שעון מערכת' };
    const mins = dayDiff(at.iso, now.day) * 1440 + at.min - now.min;
    if (mins < 0) return { ok: false, why: 'המועד כבר עבר', mins };
    const lead = leadMins();
    if (mins > lead) return { ok: false, why: 'עוד ' + fmtLeft(mins) + ' — התזכורת תישלח ' + fmtLead(lead) + ' לפני', mins };
    const stamp = at.iso + ' ' + at.min;
    if (r.remindedFor === stamp) return { ok: false, why: 'כבר נשלחה תזכורת למועד הזה', mins };
    return { ok: true, mins, stamp };
  }
  const fmtLeft = m => m >= 1440 ? Math.round(m / 1440) + ' ימים' : m >= 60 ? Math.round(m / 60) + ' שעות' : m + ' דקות';
  const fmtLead = m => m >= 1440 ? (m / 1440 === 1 ? 'יום' : Math.round(m / 1440) + ' ימים') : m >= 60 ? (m / 60 === 1 ? 'שעה' : Math.round(m / 60) + ' שעות') : m + ' דקות';

  const LEADS = [15, 30, 60, 180, 1440];

  CBX.register({
    key: 'remindg', label: 'תזכורת לפגישה — רק כשצריך', icon: 'clock',
    desc: 'תזכורת נשלחת רק אם יש פגישה עם מועד תקין, המועד לא עבר, נותר פחות מחלון התזכורת שהוגדר, וטרם נשלחה תזכורת לאותו מועד. קודם לכן היא רצה על כל פנייה שיש לה פגישה.',
    files: ['js/ext/remind-guard.js'],
    install() {
      /* השער — חל גם על הסבב האוטומטי וגם על הרצה ידנית */
      if (typeof autoFire === 'function') CBX.wrap('remindg', 'autoFire', o => function (key, ctx, manual) {
        if (key !== 'a3') return o.apply(this, arguments);
        const r = ctx && ctx.rec;
        const d = due(r);
        if (!d.ok) return false;                       /* לא נשלחת — ואין רישום מיותר */
        const out = o.apply(this, arguments);
        if (out !== false && r) r.remindedFor = d.stamp;
        return out;
      });

      /* שלב "תזכורות לפגישה" בליד — מצב אמיתי במקום כפתור סתמי */
      if (typeof accBody === 'function') CBX.wrap('remindg', 'accBody', o => function (s, r) {
        if (!s || s.key !== 'reminder') return o.apply(this, arguments);
        const d = due(r), at = meetAt(r), lead = leadMins();
        return `<div class="stage-needs rg-box">
          <div class="rg-state ${d.ok ? 'due' : (at ? 'wait' : 'none')}">
            ${ic(d.ok ? 'clock' : (at ? 'calendar' : 'alert'))}
            <div><b>${d.ok ? 'התזכורת אמורה לצאת עכשיו' : (at ? 'יש פגישה — התזכורת עוד לא בזמנה' : 'אין פגישה קבועה')}</b>
              <small>${d.ok ? 'נותרו ' + fmtLeft(d.mins) + ' למועד' : esc(d.why)}</small></div>
          </div>
          ${at ? `<label class="rg-lead"><span>${ic('bolt')} מתי לשלוח</span>
            <select class="cc-inp" data-rglead>${LEADS.map(v => `<option value="${v}" ${lead === v ? 'selected' : ''}>${fmtLead(v)} לפני</option>`).join('')}</select>
          </label>
          <button class="btn sm ${d.ok ? 'primary' : ''}" data-rgsend="${esc(String(r.id))}" ${d.ok ? '' : 'disabled'}>
            ${ic('sync')} שלח תזכורת עכשיו</button>
          ${!d.ok && !r.remindedFor ? `<small class="rg-note">${ic('alert')} הכפתור נפתח רק כשהתזכורת באמת נדרשת — כדי לא להציף את הלקוח.</small>` : ''}
          ${r.remindedFor ? `<small class="rg-note ok">${ic('check')} נשלחה תזכורת למועד הזה</small>` : ''}`
          : `<small class="rg-note">${ic('alert')} תזכורת נשלחת רק אחרי שנקבע מועד.</small>`}
        </div>`;
      });

      CBX.delegate('remindg', '[data-rgsend]', el => {
        if (el.disabled) return;
        const r = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => String(x.id) === el.dataset.rgsend) : null;
        if (!r) return;
        const d = due(r);
        if (!d.ok) { toast('התזכורת אינה נדרשת כרגע — ' + d.why); return; }
        if (typeof autoFire === 'function') autoFire('a3', { rec: r }, true);
        toast('תזכורת נשלחה ללקוח');
        if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
      });
      document.addEventListener('change', e => {
        const el = e.target && e.target.closest ? e.target.closest('[data-rglead]') : null;
        if (!el) return;
        setLead(el.value);
        toast('חלון התזכורת עודכן · ' + fmtLead(+el.value) + ' לפני הפגישה');
      });
    },
  });

  window.REMINDG = { due, leadMins, setLead, meetAt };
})();
