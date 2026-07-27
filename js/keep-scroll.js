/* ============================================================
   שמירת מיקום הגלילה — מודול עצמאי (תוספת בלבד)
   ------------------------------------------------------------
   הרבה פעולות במערכת (בחירת צ׳יפ, מתג, טאב, ערך) מרנדרות מחדש את
   המסך כולו. רינדור מחדש מאפס את הגלילה — והמשתמש "נזרק" למעלה.
   כאן עוטפים את פונקציות הרינדור: לפני הרינדור שומרים את מיקום
   הגלילה של החלון ושל כל מיכל נגלל, ומיד אחריו מחזירים אותו.
   ============================================================ */
const KS_SCROLLERS = [
  '.workspace', '#viewHost', '.cr-body', '.cbc-box', '.cd-box-m', '.auto-log',
  '.drawer-body', '.modal-body', '.set-body', '.table-wrap', '.mgr-main',
  '.hr-body', '.pt-list', '.auto-main', '.whs-body', '.cr-box',
];
function ksSnapshot() {
  const snap = { win: window.scrollY || document.documentElement.scrollTop || 0, els: [] };
  KS_SCROLLERS.forEach(sel => {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (el.scrollTop > 0 || el.scrollLeft > 0) snap.els.push([sel, i, el.scrollTop, el.scrollLeft]);
    });
  });
  return snap;
}
function ksRestore(snap) {
  if (!snap) return;
  if (snap.win) window.scrollTo(0, snap.win);
  snap.els.forEach(([sel, i, top, left]) => {
    const el = document.querySelectorAll(sel)[i];
    if (!el) return;
    if (top) el.scrollTop = top;
    if (left) el.scrollLeft = left;
  });
}
/* מריץ פעולה ומחזיר את הגלילה למקומה — כולל אחרי הרינדור הבא */
function ksKeep(fn, thisArg, args) {
  const snap = ksSnapshot();
  const out = fn.apply(thisArg, args || []);
  ksRestore(snap);
  requestAnimationFrame(() => { ksRestore(snap); requestAnimationFrame(() => ksRestore(snap)); });
  [30, 120, 300].forEach(t => setTimeout(() => ksRestore(snap), t));   // גם אחרי פריסה איטית
  return out;
}
/* עטיפת פונקציות רינדור גלובליות */
const KS_WRAP = [
  'renderSettingsView', 'renderPermissionsView', 'renderAutomationsScreen', 'renderAutomationView',
  'renderCritRules', 'renderProposedTimes', 'renderContractsView', 'renderCoordView',
  'renderServiceSelect', 'openNeedsClarify', 'openAutoInfo', 'whRefresh', 'brRenderPanel',
  'whsRenderPanel', 'renderStaffManagerView', 'renderStaffFileView', 'renderFieldsManagerView',
  'renderBranchManagerView', 'renderCatalogView',
];
(function ksInstall() {
  const done = {};
  const install = () => {
    KS_WRAP.forEach(name => {
      if (done[name]) return;
      const f = window[name];
      if (typeof f !== 'function' || f.__ks) return;
      const wrapped = function () { return ksKeep(f, this, arguments); };
      wrapped.__ks = true;
      try { window[name] = wrapped; done[name] = true; } catch (e) {}
    });
  };
  install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 0);
  setTimeout(install, 400);
})();
