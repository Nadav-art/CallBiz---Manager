/* ============================================================
   הרחבה: פריסת פופ-אפים לצד זה — מצב אבחון  ·  key = 'ptile'
   ------------------------------------------------------------
   בזמן בניית מהלך התאמת השירות נפתחים כמה חלונות זה על גבי זה,
   וקשה לראות כמה בדיוק פתוחים ומי פתח את מי. במצב הזה כל חלון
   פתוח נפרס לצד השני, ממוספר לפי סדר הפתיחה, והדף מצטמצם לרוחב
   אחד — כדי לזהות את הכפילויות.

   חשוב: המצב הזה **אינו נוגע בסגנון של אף חלון**. הוא רק מוסיף
   מחלקות ומשתני CSS. לכן הפקודה "החזר פופאפ למקור" מסירה אותן
   והכול חוזר בדיוק לגודל ולמיקום המקוריים, בלי מספור:

       POPUPS.restore()      // או כיבוי ההרחבה במסך ההרחבות
   ============================================================ */
(function () {

  /* כל מה שנחשב "חלון" במערכת */
  const SEL = '.cbc-wrap, #modalWrap.open, #proposePanel.open, .ps-side.open, .ct-modal-wrap.open';
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.id === 'modalWrap' && !el.classList.contains('open')) return false;
    return el.getBoundingClientRect().width > 0;
  };

  function boxOf(w) {
    return w.querySelector('.cbc-box, #modal, .pt-inner, .ct-modal, .ps-side-in') || w.firstElementChild;
  }

  let on = false;

  function tick() {
    if (!on) return;
    const wraps = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(visible);
    document.body.classList.toggle('pt-on', wraps.length > 1);
    /* ניקוי סימונים מחלונות שנסגרו */
    document.querySelectorAll('.pt-item').forEach(el => {
      if (wraps.indexOf(el) < 0) { el.classList.remove('pt-item'); el.style.removeProperty('--pt-i');
        el.style.removeProperty('--pt-n'); const b = el.querySelector('.pt-num'); if (b) b.remove(); }
    });
    if (wraps.length < 2) return;
    wraps.forEach((w, i) => {
      w.classList.add('pt-item');
      w.style.setProperty('--pt-i', i);
      w.style.setProperty('--pt-n', wraps.length);
      const box = boxOf(w); if (!box) return;
      let b = w.querySelector('.pt-num');
      if (!b) { b = document.createElement('span'); b.className = 'pt-num'; box.appendChild(b); }
      b.textContent = String(i + 1);
      b.title = (box.id || box.className || '').split(' ')[0] + ' · חלון ' + (i + 1) + ' מתוך ' + wraps.length;
    });
  }

  function restore() {
    on = false;
    document.body.classList.remove('pt-on');
    document.querySelectorAll('.pt-item').forEach(el => {
      el.classList.remove('pt-item');
      el.style.removeProperty('--pt-i'); el.style.removeProperty('--pt-n');
    });
    document.querySelectorAll('.pt-num').forEach(b => b.remove());
    if (typeof toast === 'function') toast('הפופ-אפים חזרו לגודל ולמיקום המקוריים');
  }

  let mo = null, iv = null;

  CBX.register({
    key: 'ptile', label: 'פריסת פופ-אפים לצד זה (אבחון)', icon: 'layers',
    desc: 'מצב זמני לאיתור כפילויות: כשנפתח יותר מחלון אחד, כולם נפרסים זה לצד זה וממוספרים לפי סדר הפתיחה. המצב אינו משנה סגנון של אף חלון — "החזר פופאפ למקור" (POPUPS.restore) מחזיר הכול בדיוק כפי שהיה, בלי מספור.',
    files: ['js/ext/popup-tile.js', 'css/ext/ptile.css'],
    install() {
      on = true;
      mo = new MutationObserver(() => tick());
      mo.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
      /* גם שינויי מחלקה על העטיפות עצמן (open/close) */
      iv = setInterval(tick, 400);
      tick();
      CBX._remember('ptile', () => { if (mo) mo.disconnect(); if (iv) clearInterval(iv); restore(); });
    },
  });

  window.POPUPS = { restore, tick, count: () => document.querySelectorAll('.pt-item').length };
})();
