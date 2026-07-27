/* ============================================================
   הרחבה: מסמכים לחתימה  ·  key = 'docsign'
   ------------------------------------------------------------
   קהל שלישי במערכת החוזים, לצד הסכמי לקוחות והסכמי העסקה:
   מסמכים שאינם הסכם — הצהרת בריאות, כתב הסכמה לטיפול, אישור
   קבלת מידע, ויתור. חלקם דורשים חתימה דיגיטלית וחלקם רק אישור
   קריאה, ולכן לכל מסמך יש מתג "דורש חתימה" נפרד.

   שני דברים שטרם הוגדרו ומסומנים בגלוי בממשק:
     · מאיפה נשאב המידע לכל מסמך (איזה שדות ומאיזו ישות)
     · באיזה שלב בתהליך המסמך מופק אוטומטית
   שניהם מוצגים כ"טרם הוגדר" ולא מנוחשים — כדי שלא ייווצר מצב
   שמסמך מופק עם מקור מידע שגוי.
   ============================================================ */
(function () {

  const AUD = { key: 'doc', label: 'מסמכים לחתימה', icon: 'note',
    desc: 'הצהרות, אישורים וויתורים — עם חתימה דיגיטלית או בלי' };

  const TYPES = ['הצהרת בריאות', 'כתב הסכמה לטיפול', 'אישור קבלת מידע',
    'ויתור על סודיות', 'אישור הגעה', 'שאלון טרום-טיפול'];

  const SEED = [
    { id: 'd1', name: 'הצהרת בריאות', type: 'הצהרת בריאות', audience: 'doc',
      legalApproved: true, requireSignature: true, requireId: false, stamp: null,
      docSrc: null, docStage: null,
      text: 'הצהרת בריאות\n\nאני, {שם_לקוח}, ת.ז {ת.ז}, מצהיר/ה בזאת כי:\n\n1. מצב בריאותי ידוע לי ואין מניעה רפואית לקבלת {שירות}.\n2. דיווחתי על כל תרופה קבועה, רגישות או אלרגיה הידועות לי.\n3. אעדכן את הצוות בכל שינוי במצבי הבריאותי לפני הטיפול.\n\nהצהרה זו ניתנת מרצוני החופשי ולאחר שהבנתי את תוכנה.' },
    { id: 'd2', name: 'כתב הסכמה לטיפול', type: 'כתב הסכמה לטיפול', audience: 'doc',
      legalApproved: true, requireSignature: true, requireId: true, stamp: null,
      docSrc: null, docStage: null,
      text: 'כתב הסכמה לטיפול\n\n{שם_לקוח}, ת.ז {ת.ז}\n\nהוסבר לי מהות הטיפול {שירות}, מהלכו, הסיכונים והחלופות.\nניתנה לי הזדמנות לשאול שאלות וקיבלתי מענה מלא.\n\nאני מסכים/ה לביצוע הטיפול במועד {מועד}.' },
    { id: 'd3', name: 'אישור קבלת מידע והנחיות', type: 'אישור קבלת מידע', audience: 'doc',
      legalApproved: true, requireSignature: false, requireId: false, stamp: null,
      docSrc: null, docStage: null,
      text: 'אישור קבלת מידע\n\n{שם_לקוח} — קיבלתי את ההנחיות לקראת {שירות} ולאחריו, וקראתי אותן.\n\nמסמך זה אינו דורש חתימה — די באישור קריאה.' },
  ];

  /* מה שטרם הוגדר — מוצג ולא מנוחש */
  const undefinedBits = c => {
    const out = [];
    if (!c.docSrc) out.push('מאיפה נשאב המידע');
    if (!c.docStage) out.push('באיזה שלב יופק');
    return out;
  };

  function bannerHTML() {
    const list = (typeof CONTRACT_TEMPLATES !== 'undefined' ? CONTRACT_TEMPLATES : []).filter(c => c.audience === 'doc');
    const pend = list.filter(c => undefinedBits(c).length).length;
    return `<div class="dsg-bar">${ic('alert')}
      <div><b>שתי הגדרות עדיין פתוחות — ${pend} מתוך ${list.length} המסמכים</b>
        <small><b>מאיפה נשאב המידע</b> — אילו שדות ומאיזו ישות (ליד · תיק מטופל · תיק עובד) ממלאים את המסמך.
        <b>באיזה שלב יופק</b> — הנקודה בתהליך שבה הוא נשלח אוטומטית.
        עד שיוגדרו, המסמכים נשלחים ידנית והשדות נשארים ריקים למילוי הלקוח.</small></div></div>`;
  }

  CBX.register({
    key: 'docsign', label: 'מסמכים לחתימה', icon: 'note',
    desc: 'קהל שלישי במערכת החוזים למסמכים שאינם הסכם — הצהרת בריאות, כתב הסכמה, אישור קבלת מידע. לכל מסמך מתג "דורש חתימה" נפרד. מקור המידע ושלב ההפקה מסומנים כטרם-הוגדרו.',
    files: ['js/ext/doc-forms.js'],
    install() {
      if (typeof CT_AUDIENCES !== 'undefined' && !CT_AUDIENCES.some(a => a.key === 'doc'))
        CBX.push('docsign', CT_AUDIENCES, AUD);
      if (typeof CONTRACT_TYPES !== 'undefined')
        CBX.push('docsign', CONTRACT_TYPES, TYPES.filter(t => CONTRACT_TYPES.indexOf(t) < 0));
      if (typeof CONTRACT_TEMPLATES !== 'undefined')
        CBX.push('docsign', CONTRACT_TEMPLATES, SEED.filter(s => !CONTRACT_TEMPLATES.some(c => c.id === s.id)));
      /* חזרה ל"לקוחות" בהסרה — אחרת המסך נשאר על קהל שלא קיים */
      CBX._remember('docsign', () => { if (typeof ctAud !== 'undefined' && ctAud === 'doc') { ctAud = 'client';
        if (typeof navActive !== 'undefined' && navActive === 'contracts' && typeof renderContractsView === 'function') renderContractsView(); } });

      if (typeof renderContractsView === 'function') CBX.wrap('docsign', 'renderContractsView', o => function () {
        const out = o.apply(this, arguments);
        try {
          if (typeof ctAud === 'undefined' || ctAud !== 'doc') return out;
          const host = document.getElementById('viewHost'); if (!host) return out;

          /* כותרת המשנה מדברת על "תבניות חוזה" — כאן מדובר במסמכים */
          const t = host.querySelector('.vhs-title');
          if (t) t.innerHTML = `${ic('note')} מסמכים לחתימה
            <span class="muted" style="font-size:12px">· הצהרות ואישורים · חתימה דיגיטלית לפי מסמך</span>`;
          const add = document.getElementById('ctAdd');
          if (add) add.innerHTML = `${ic('plus')} מסמך חדש`;

          /* מה שטרם הוגדר — בגלוי, מעל הרשימה */
          const grid = host.querySelector('.ct-grid');
          if (grid && !host.querySelector('.dsg-bar')) {
            const d = document.createElement('div'); d.innerHTML = bannerHTML();
            grid.parentNode.insertBefore(d.firstElementChild, grid);
          }
          /* חיווי פר-מסמך: חתימה או אישור קריאה, ומה חסר */
          host.querySelectorAll('.ct-card').forEach(card => {
            const btn = card.querySelector('[data-ctedit]');
            const id = btn ? btn.dataset.ctedit : null;
            const c = id && typeof contractById === 'function' ? contractById(id) : null;
            if (!c || card.querySelector('.dsg-chips')) return;
            const miss = undefinedBits(c);
            const flags = card.querySelector('.ct-flags');
            const d = document.createElement('div'); d.className = 'dsg-chips';
            d.innerHTML = `<span class="dsg-chip ${c.requireSignature ? 'sign' : 'read'}">
                ${ic(c.requireSignature ? 'check' : 'eye')} ${c.requireSignature ? 'נדרשת חתימה דיגיטלית' : 'אישור קריאה בלבד — ללא חתימה'}</span>
              ${miss.map(m => `<span class="dsg-chip todo">${ic('alert')} טרם הוגדר: ${esc(m)}</span>`).join('')}`;
            (flags || card).appendChild(d);
          });
        } catch (e) { console.error('[docsign]', e); }
        return out;
      });
    },
  });

  window.DOCSIGN = { audience: AUD, seed: SEED, pending: undefinedBits };
})();
