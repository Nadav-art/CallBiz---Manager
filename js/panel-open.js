/* ============================================================
   פתיחת פאנלים — תיקון מערכתי
   ------------------------------------------------------------
   ‎.cbc-wrap נטען עם opacity:0, והמחלקה ‎.open היא זו שמציגה אותו.
   כל פאנל שנבנה בלי לזכור להוסיף ‎.open נפתח — אבל שקוף לגמרי,
   ולכן "הכפתור לא עובד". במקום לזכור בכל מקום מחדש, כאן יש
   מאזין אחד שמוסיף ‎.open לכל ‎.cbc-wrap שנכנס למסך.
   ============================================================ */
(function () {
  /* לא נשענים על requestAnimationFrame בלבד: בלשונית שאינה גלויה הוא
     לא נקרא כלל, והפאנל היה נשאר שקוף. setTimeout משמש רשת ביטחון. */
  const open = el => {
    if (!el || !el.classList || !el.classList.contains('cbc-wrap')) return;
    if (el.classList.contains('open')) return;
    const go = () => el.isConnected && el.classList.add('open');
    requestAnimationFrame(go);
    setTimeout(go, 0);
  };
  /* פאנלים שכבר קיימים (למשל אם הסקריפט נטען אחרי רינדור ראשון) */
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.cbc-wrap').forEach(open));
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType === 1) open(n); }));
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
