/* ============================================================
   הרחבה: נוהל תעדוף מועדים בכרטיס העובד  ·  key = 'schedpref'
   ------------------------------------------------------------
   ההגדרה הזו קיימת במנוע מזמן — rankedSlots() מדרג את המועדים
   המוצעים לפי schedPref של כל עובד — אבל המסך שערך אותה נפתח רק
   מתוך פאנל "זמנים מוצעים" הישן, ומאז שהתיאום עבר לתוך חלון
   המהלך לא הייתה אליה שום דרך גישה.

   כאן היא חוזרת למקום הנכון: כרטיס העובד בהגדרות › אנשים
   והרשאות, פר-עובד, לצד שאר ההגדרות שלו.

     צמוד לפגישה הקודמת · אחרון ביום · רווח מתחילת היום ·
     רווח מהפגישה הקודמת (+ מספר הדקות)
   ============================================================ */
(function () {

  const MODES = () => (typeof SCHED_MODES !== 'undefined') ? SCHED_MODES : [];
  const prefOf = emp => {
    if (!emp.schedPref) emp.schedPref = { mode: 'adjacent', gap: 15 };
    return emp.schedPref;
  };

  function cardHTML(emp) {
    const p = prefOf(emp);
    const cur = MODES().find(m => m.key === p.mode) || MODES()[0] || {};
    return `<section class="card emp-profile sp-card">
      <div class="card-head"><div class="title">${ic('bolt')} נוהל תעדוף מועדים</div>
        <span class="muted" style="font-size:12px">לפי זה יוצעו הזמנים ל${esc(emp.name)} בכל תיאום</span></div>
      <div class="sp-body">
        <p class="sp-hint">${ic('user')} ההגדרה היא פר-עובד. המנוע מדרג את המועדים הפנויים לפי הכלל שנבחר,
          כך שהמועד המוצע ראשון הוא זה שמתאים לשיטת העבודה של ${esc(emp.name)}.</p>
        <div class="sp-opts">${MODES().map(m => `<button class="sp-opt ${p.mode === m.key ? 'on' : ''}"
          data-sp="${esc(emp.id)}|${esc(m.key)}">
          <span class="sp-ck">${p.mode === m.key ? ic('check') : ''}</span>
          <b>${esc(m.label)}</b><small>${esc(m.desc)}</small></button>`).join('')}</div>
        ${cur.gap ? `<label class="sp-gap"><span>${ic('clock')} רווח בדקות</span>
          <input type="number" class="cc-inp" data-spgap="${esc(emp.id)}" min="0" max="120" step="5" value="${+p.gap || 0}">
        </label>` : ''}
        <div class="sp-now">${ic('target')} כרגע: <b>${esc(cur.label || '')}</b>${cur.gap ? ` · ${+p.gap || 0} דק׳` : ''}</div>
      </div>
    </section>`;
  }

  const empById = id => (typeof STAFF !== 'undefined') ? STAFF.find(s => String(s.id) === String(id)) : null;
  const rerender = () => { if (typeof renderSettingsView === 'function') renderSettingsView(); };

  CBX.register({
    key: 'schedpref', label: 'נוהל תעדוף מועדים בכרטיס העובד', icon: 'bolt',
    desc: 'ההגדרה שקובעת איך מוצעים המועדים לכל עובד — צמוד לפגישה הקודמת, אחרון ביום, או רווח קבוע — חוזרת לכרטיס העובד בהגדרות. עד עכשיו היא הייתה רק בפאנל הזמנים הישן ולא הייתה אליה גישה.',
    files: ['js/ext/sched-pref.js', 'css/ext/schedpref.css'],
    install() {
      if (typeof empDetailsCard === 'function') CBX.wrap('schedpref', 'empDetailsCard', o => function (emp) {
        const html = o.apply(this, arguments);
        try { return html + cardHTML(emp); } catch (e) { console.error('[schedpref]', e); return html; }
      });
      CBX.delegate('schedpref', '[data-sp]', el => {
        const p = el.dataset.sp.split('|'), emp = empById(p[0]);
        if (!emp) return;
        prefOf(emp).mode = p[1];
        const m = MODES().find(x => x.key === p[1]);
        toast('נוהל התעדוף עודכן · ' + ((m && m.label) || ''));
        rerender();
      });
      CBX.delegate('schedpref', '[data-spgap]', () => {});
      document.addEventListener('change', e => {
        const el = e.target && e.target.closest ? e.target.closest('[data-spgap]') : null;
        if (!el) return;
        const emp = empById(el.dataset.spgap); if (!emp) return;
        prefOf(emp).gap = Math.max(0, +el.value || 0);
        toast('הרווח עודכן · ' + prefOf(emp).gap + ' דק׳');
      });
    },
  });

  window.SCHEDPREF = { of: prefOf, card: cardHTML };
})();
