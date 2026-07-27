/* ============================================================
   שני סוגי חוזים במערכת אחת — לקוחות מול עובדים (מודול עצמאי)
   ------------------------------------------------------------
   הרעיון: מערכת אחת, שני "קהלים" (audience):
     client   — הסכמי לקוח (התקשרות/שירות/מנוי) · מופקים מתוך הליד
     employee — הסכמי העסקה · מופקים מתוך תיק העובד (HR)
   ההפרדה לפי **הרשאות**: מי שאין לו הרשאת "ניהול הסכמי עובדים"
   רואה רק את הסכמי הלקוחות. כך אנשי מכירות ו-HR עובדים באותה מערכת
   אבל כל אחד רואה את מה שרלוונטי לו, עם משתנים ומבנה שונים.
   ============================================================ */
const CT_AUDIENCES = [
  { key: 'client', label: 'הסכמי לקוחות', icon: 'clients', desc: 'התקשרות, שירות, מנוי — מופק מתוך הליד' },
  { key: 'employee', label: 'הסכמי העסקה', icon: 'user', desc: 'עובדים — מופק מתוך תיק העובד (HR)', perm: 'ניהול הסכמי עובדים' },
];
const CT_EMPLOYEE_TYPES = ['הסכם העסקה', 'הסכם סודיות (NDA)', 'נספח שכר', 'הסכם קבלן / פרילנס', 'סיום העסקה'];

/* משתני עובד — מקורות מתיק ה-HR */
const CONTRACT_EMP_SOURCES = [
  { key: 'empName', label: 'שם העובד', get: e => e && e.name },
  { key: 'empId', label: 'ת.ז עובד', get: e => e && e.hr && e.hr.idnum },
  { key: 'empRole', label: 'תפקיד', get: e => e && e.role },
  { key: 'empDept', label: 'מחלקה', get: e => e && e.dept },
  { key: 'empType', label: 'סוג העסקה', get: e => e && e.hr && e.hr.employType },
  { key: 'empScope', label: 'היקף משרה (%)', get: e => e && e.hr && e.hr.scopePct },
  { key: 'empStart', label: 'תחילת עבודה', get: e => e && e.hr && e.hr.startDate },
  { key: 'empPhone', label: 'טלפון עובד', get: e => e && e.hr && e.hr.phone },
  { key: 'empMail', label: 'דוא״ל עובד', get: e => e && e.hr && e.hr.mail },
  { key: 'empAddr', label: 'כתובת עובד', get: e => e && e.hr && e.hr.addr },
  { key: 'empMgr', label: 'מנהל ישיר', get: e => { const m = (typeof STAFF !== 'undefined' && e && e.hr) ? STAFF.find(x => x.id === e.hr.manager) : null; return m ? m.name : ''; } },
  { key: 'empBranch', label: 'סניף', get: e => { const b = (typeof COORD_BRANCHES !== 'undefined' && e) ? COORD_BRANCHES.find(x => x.key === ((e.branches || [])[0] || e.branch)) : null; return b ? (b.short || b.label) : ''; } },
  { key: 'business', label: 'שם העסק (קבוע)', get: () => 'CallBiz' },
];
const CONTRACT_EMP_VARS_DEFAULT = {
  '{שם_עובד}': 'empName', '{ת.ז_עובד}': 'empId', '{תפקיד}': 'empRole', '{מחלקה}': 'empDept',
  '{סוג_העסקה}': 'empType', '{היקף_משרה}': 'empScope', '{תחילת_עבודה}': 'empStart',
  '{טלפון_עובד}': 'empPhone', '{דואל_עובד}': 'empMail', '{מנהל_ישיר}': 'empMgr', '{סניף}': 'empBranch', '{שם_עסק}': 'business',
};
let CONTRACT_EMP_VARS = (function () { try { return Object.assign({}, CONTRACT_EMP_VARS_DEFAULT, JSON.parse(localStorage.getItem('cb_ctEmpVars')) || {}); } catch (e) { return Object.assign({}, CONTRACT_EMP_VARS_DEFAULT); } })();
function ctEmpVarsSave() { try { localStorage.setItem('cb_ctEmpVars', JSON.stringify(CONTRACT_EMP_VARS)); } catch (e) {} }
function ctEmpSourceOf(k) { return CONTRACT_EMP_SOURCES.find(s => s.key === k); }
/* מיזוג נתוני עובד לנוסח הסכם העסקה */
function contractMergeEmp(text, emp) {
  return (text || '').replace(/\{[^}]+\}/g, m => {
    const sk = CONTRACT_EMP_VARS[m]; if (!sk) return m;
    const s = ctEmpSourceOf(sk); if (!s) return m;
    const v = s.get(emp);
    return (v === undefined || v === null || v === '') ? '________' : String(v);
  });
}

/* ---------- הרשאות: מי רואה מה ---------- */
function ctCanSeeAudience(key) {
  const a = CT_AUDIENCES.find(x => x.key === key); if (!a) return false;
  if (!a.perm) return true;
  const emp = (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '')) : null;
  if (!emp) return true;
  return (typeof effectivePerm === 'function') ? effectivePerm(emp, a.perm) : true;
}
function ctVisibleAudiences() { return CT_AUDIENCES.filter(a => ctCanSeeAudience(a.key)); }
/* תבניות לפי קהל (תבנית ללא audience = לקוח, לתאימות אחורה) */
function ctTemplatesFor(aud) { return (typeof CONTRACT_TEMPLATES !== 'undefined' ? CONTRACT_TEMPLATES : []).filter(c => (c.audience || 'client') === aud); }

/* ---------- הפקת הסכם העסקה מתוך תיק העובד ---------- */
function openEmployeeContractPicker(emp) {
  const tpls = ctTemplatesFor('employee').filter(c => c.legalApproved);
  if (!tpls.length) { toast('אין תבניות הסכם העסקה מאושרות — צור תבנית במערכת החוזים › הסכמי העסקה'); return; }
  const old = document.getElementById('empCtPick'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'empCtPick';
  w.innerHTML = '<div class="cbc-box" style="max-width:440px;text-align:start">' +
    '<div class="cbc-head"><span class="cbc-ic">' + ic('docs') + '</span><b>הפקת הסכם העסקה · ' + esc(emp.name) + '</b></div>' +
    '<div class="ct-pick-list">' + tpls.map(function (c) {
      return '<button class="ct-pick" data-empctpick="' + c.id + '">' + ic('docs') + ' <b>' + esc(c.name) + '</b><small>' + esc(c.type) + '</small></button>'; }).join('') + '</div>' +
    '<div class="cbc-actions"><button class="btn ghost" id="empCtCancel">ביטול</button></div></div>';
  document.body.appendChild(w); requestAnimationFrame(function () { w.classList.add('open'); });
  const close = function () { w.remove(); };
  $('#empCtCancel').addEventListener('click', close);
  w.addEventListener('mousedown', function (e) { if (e.target === w) close(); });
  $$('[data-empctpick]', w).forEach(function (b) { b.addEventListener('click', function () {
    const c = (typeof contractById === 'function') ? contractById(b.dataset.empctpick) : null; close();
    if (c) issueEmployeeContract(emp, c);
  }); });
}
function issueEmployeeContract(emp, tpl) {
  const h = (typeof hrOf === 'function') ? hrOf(emp) : (emp.hr = emp.hr || {});
  const at = (typeof docStamp === 'function') ? docStamp() : '';
  const name = tpl.name + ' — ' + emp.name + '.pdf';
  h.docs = h.docs || [];
  h.docs.unshift({ name: name, type: 'חוזה העסקה', by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''), at: at, contract: true, status: 'נשלח לחתימה' });
  // רישום במרשם ההסכמים עם קהל = עובד
  if (typeof ctRegisterIssue === 'function') {
    const pseudo = { id: emp.id, name: emp.name, phone: h.phone || '', services: [] };
    const rec = ctRegisterIssue(tpl, pseudo);
    rec.audience = 'employee';
    rec.textSnapshot = contractMergeEmp(tpl.text, emp);
    if (typeof ctRegSave === 'function') ctRegSave();
    h.docs[0].contractNo = rec.no;
  }
  toast('הסכם העסקה הופק ונשלח ל' + emp.name + ' לחתימה · נשמר במסמכי העובד');
  if (typeof renderPermissionsView === 'function') renderPermissionsView();
}
