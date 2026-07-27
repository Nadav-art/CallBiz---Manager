/* ============================================================
   הרחבה: שלבי הזרימה נשארים פתוחים  ·  key = 'flowhold'
   ------------------------------------------------------------
   כל עוד אנחנו משדרגים את הזרימה — בירור צורך · בחירת שירות/מוצר ·
   תיאום פגישה · הצעת מחיר · הסכם לחתימה — השלבים האלה לא מתקפלים
   לתוך "שלבים שהושלמו", גם כשהטיפול בהם הסתיים. הם נשארים מול
   העיניים כדי שאפשר יהיה לחזור אליהם ולעדכן.

   הסרה מחזירה את ההתנהגות הרגילה (השלבים מתכווצים כרגיל).
   ============================================================ */
(function () {

  /* מפתחות השלבים בכל המסלולים — לפי WORKFLOWS */
  const KEYS = [
    'qualify', 'need', 'needs',            // בירור צורך
    'service', 'svc', 'services',          // בחירת שירות / מוצר
    'meeting', 'schedule', 'offer', 'confirm',  // תיאום פגישה
    'proposal', 'quote',                   // הצעת מחיר
    'contract', 'sign',                    // הסכם לחתימה
  ];

  CBX.register({
    key: 'flowhold', label: 'שלבי הזרימה נשארים פתוחים', icon: 'flag',
    desc: 'בירור צורך, בחירת שירות/מוצר, תיאום, הצעת מחיר והסכם לחתימה לא מתקפלים ל"שלבים שהושלמו" גם אחרי שהסתיימו — כדי שאפשר יהיה לחזור אליהם ולעדכן תוך כדי השדרוג של התהליך.',
    files: ['js/ext/flow-hold.js'],
    install() {
      const prev = window.KEEP_STAGES_OPEN;
      window.KEEP_STAGES_OPEN = KEYS.slice();
      CBX._remember('flowhold', () => { window.KEEP_STAGES_OPEN = prev; });
      /* רענון מיידי אם מגירת ליד פתוחה */
      CBX._remember('flowhold', () => { try {
        if (typeof selectedId !== 'undefined' && selectedId && typeof RECORDS !== 'undefined') {
          const r = RECORDS.find(x => x.id === selectedId);
          if (r && typeof renderDrawerTab === 'function') renderDrawerTab(r);
        } } catch (e) {} });
    },
  });

  window.FLOWHOLD = { keys: () => KEYS.slice() };
})();
