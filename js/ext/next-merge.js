/* ============================================================
   הרחבה: איחוד "חזרה ללקוח" ו"פולו-אפ"  ·  key = 'nextmerge'
   ------------------------------------------------------------
   שתי פעולות נפרדות שמשמעותן זהה — לחזור ללקוח במועד שנקבע.
   ההפרדה רק בלבלה: אותו אייקון, אותו תהליך, שני צבעים ושני
   שמות. כאן הן מאוחדות ל"פולו-אפ · חזרה ללקוח" אחד:

     · "חזרה ללקוח" יורדת מרשימות הבחירה
     · פניות שכבר סומנו callback ממשיכות לעבוד ומוצגות כפולו-אפ
     · תיעוד "ביקש לחזור מאוחר" ביומן השיחות נשאר כפי שהוא —
       זו סיבה לשיחה, לא סוג הפעולה הבאה

   הסרת ההרחבה מחזירה את שתי הפעולות בדיוק כפי שהיו.
   ============================================================ */
(function () {

  const LABEL = 'פולו-אפ · חזרה ללקוח';

  CBX.register({
    key: 'nextmerge', label: 'איחוד "חזרה ללקוח" ו"פולו-אפ"', icon: 'phone',
    desc: 'שתי הפעולות היו מילים נרדפות לאותו דבר. עכשיו יש אחת — "פולו-אפ · חזרה ללקוח" — ופניות קיימות שסומנו כ"חזרה ללקוח" ממשיכות לעבוד ומוצגות תחתיה.',
    files: ['js/ext/next-merge.js'],
    install() {
      if (typeof NEXT_ACTIONS === 'undefined') return;

      /* השם המאוחד, ו-callback מוצג בדיוק כמוהו לתאימות אחורה */
      CBX.assign('nextmerge', NEXT_ACTIONS.followup, { label: LABEL });
      CBX.assign('nextmerge', NEXT_ACTIONS.callback,
        { label: LABEL, color: NEXT_ACTIONS.followup.color, icon: NEXT_ACTIONS.followup.icon, alias: true });

      /* יורדת מרשימות הבחירה — בלי למחוק אותה מהמערכת */
      if (typeof NEXT_BY_DEPT !== 'undefined') Object.keys(NEXT_BY_DEPT).forEach(k => {
        const list = NEXT_BY_DEPT[k];
        const i = list.indexOf('callback');
        if (i < 0) return;
        list.splice(i, 1);
        if (list.indexOf('followup') < 0) list.splice(i, 0, 'followup');
        CBX._remember('nextmerge', () => { if (list.indexOf('callback') < 0) list.splice(i, 0, 'callback'); });
      });

      /* בכל מסך שמרנדר את רשימת הפעולות — מסירים כפילות שנותרה */
      const dedupe = () => {
        document.querySelectorAll('select#naType, select.na-sel').forEach(sel => {
          let seen = false;
          Array.prototype.slice.call(sel.options).forEach(op => {
            if (op.value !== 'callback' && op.value !== 'followup') return;
            if (seen) { op.remove(); return; }
            seen = true; op.textContent = LABEL;
            if (op.value === 'callback') op.value = 'followup';
          });
        });
      };
      if (typeof openNextActionEditor === 'function') CBX.wrap('nextmerge', 'openNextActionEditor', o => function () {
        const out = o.apply(this, arguments); try { dedupe(); } catch (e) {} return out;
      });
      if (typeof renderNextAction === 'function') CBX.wrap('nextmerge', 'renderNextAction', o => function () {
        const out = o.apply(this, arguments); try { dedupe(); } catch (e) {} return out;
      });
    },
  });

  window.NEXTMERGE = { label: LABEL };
})();
