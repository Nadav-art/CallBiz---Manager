/* ============================================================
   ממשק HR מורחב — מודול עצמאי (תוספת ל"הרשאות")
   ------------------------------------------------------------
   לשוניות: תיק עובד · העסקה ותפקיד · נוכחות וחופשות · הכשרות והסמכות ·
            מסמכי עובד · תהליכי קליטה/סיום.
   ההרשאות (לפי תפקיד / לפי עובד) נשארות כפי שהיו — כאן נוספות לשוניות HR.
   ============================================================ */
const HR_EMPLOY_TYPES = ['שכיר · מלא', 'שכיר · חלקי', 'שעתי', 'פרילנס / קבלן', 'סטודנט'];
const HR_LEAVE_TYPES = [
  { key: 'vacation', label: 'חופשה', color: 'blue' },
  { key: 'sick', label: 'מחלה', color: 'amber' },
  { key: 'reserve', label: 'מילואים', color: 'green' },
  { key: 'unpaid', label: 'חל״ת', color: 'gray' },
];
const HR_DOC_TYPES = ['חוזה העסקה', 'טופס 101', 'תעודת זהות', 'אישור לימודים', 'תעודת הסמכה', 'אחר'];
const HR_ONBOARD_TASKS = ['חתימה על חוזה העסקה', 'טופס 101', 'פתיחת משתמש במערכת', 'הרשאות ושיוך סניף', 'הדרכת מערכת', 'ציוד וכלי עבודה', 'חתימה על סודיות'];
const HR_OFFBOARD_TASKS = ['החזרת ציוד', 'ביטול הרשאות', 'גמר חשבון', 'מכתב סיום העסקה', 'העברת תיקים / לידים'];

/* נתוני HR נשמרים על העובד (emp.hr) — נירמול */
function hrOf(emp) {
  if (!emp.hr) emp.hr = {};
  const h = emp.hr;
  if (h.employType === undefined) h.employType = HR_EMPLOY_TYPES[0];
  if (h.startDate === undefined) h.startDate = '';
  if (h.endDate === undefined) h.endDate = '';
  if (h.idnum === undefined) h.idnum = '';
  if (h.birth === undefined) h.birth = '';
  if (h.phone === undefined) h.phone = '';
  if (h.mail === undefined) h.mail = '';
  if (h.addr === undefined) h.addr = '';
  if (h.emergency === undefined) h.emergency = '';
  if (h.manager === undefined) h.manager = '';
  if (h.scopePct === undefined) h.scopePct = 100;
  if (h.leaveBalance === undefined) h.leaveBalance = 12;
  if (h.leaves === undefined) h.leaves = [];
  if (h.certs === undefined) h.certs = [];
  if (h.docs === undefined) h.docs = [];
  if (h.onboard === undefined) h.onboard = {};
  if (h.offboard === undefined) h.offboard = {};
  return h;
}
function hrStamp() { return (typeof docStamp === 'function') ? docStamp() : ''; }

/* ---------------- לשוניות HR ---------------- */
const HR_TABS = [
  { key: 'file', label: 'תיק עובד', icon: 'user' },
  { key: 'employ', label: 'העסקה ותפקיד', icon: 'org' },
  { key: 'leave', label: 'נוכחות וחופשות', icon: 'calendar' },
  { key: 'certs', label: 'הכשרות והסמכות', icon: 'check' },
  { key: 'docs', label: 'מסמכי עובד', icon: 'docs' },
  { key: 'lifecycle', label: 'קליטה וסיום', icon: 'sync' },
  { key: 'perms', label: 'הרשאות', icon: 'lock' },
];
let hrTab = 'file', hrEmp = null;

function hrPanelHTML(embedded) {
  const emp = STAFF.find(s => s.id === hrEmp) || STAFF[0]; hrEmp = emp.id;
  const h = hrOf(emp);
  const groups = DEPARTMENTS.map(dp => {
    const opts = STAFF.filter(s => s.dept === dp).map(s => `<option value="${s.id}" ${s.id === emp.id ? 'selected' : ''}>${s.name} · ${s.role}</option>`).join('');
    return opts ? `<optgroup label="${dp}">${opts}</optgroup>` : '';
  }).join('');
  return `<section class="card set-card wide hr-card">
    ${embedded ? '' : `<div class="card-head"><div class="title">${ic('clients')} ניהול עובדים · HR</div>
      <div class="emp-select"><span>עובד:</span><select id="hrEmpSel">${groups}</select></div></div>`}
    <div class="hr-tabs">${HR_TABS.map(t => `<button class="hr-tab ${hrTab === t.key ? 'on' : ''}" data-hrtab="${t.key}">${ic(t.icon)} ${t.label}</button>`).join('')}</div>
    <div class="set-body hr-body">${hrTabHTML(hrTab, emp, h)}</div>
  </section>`;
}
function hrTabHTML(tab, emp, h) {
  if (tab === 'perms') {
    if (typeof PERMISSIONS === 'undefined' || typeof effectivePerm !== 'function')
      return '<p class="muted">מודול ההרשאות אינו זמין.</p>';
    return `
      <p class="hint" style="margin-top:0">${ic('alert')} ברירת המחדל נגזרת מהתפקיד <b>${esc(emp.perm)}</b>
        (נקבעת בלשונית "הרשאות לפי תפקיד"). כאן נותנים או שוללים הרשאה <b>נקודתית לעובד הזה</b> — למשל מנהל סניף שמקבל הרשאה אחת חריגה.</p>
      <div class="perms-emp-list">
        ${PERMISSIONS.map(p => { const eff = effectivePerm(emp, p.label), ov = permIsOverridden(emp, p.label), def = permRoleGrant(emp, p.label);
          return `<div class="pe-row ${ov ? 'ov' : ''}">
            <span class="pe-lbl">${p.label}${ov ? '<span class="pe-badge">חריגה אישית</span>' : ''}</span>
            <span class="pe-right">
              ${ov ? `<button class="pe-reset" data-hrpermreset="${esc(p.label)}">${ic('sync')} אפס לתפקיד</button>` : `<span class="pe-def">ברירת מחדל: ${def ? 'מותר' : 'חסום'}</span>`}
              <span class="toggle wh-toggle ${eff ? 'on' : ''}" data-hrperm="${esc(p.label)}" role="button" tabindex="0"><i></i></span>
            </span></div>`; }).join('')}
      </div>
      <p class="hint" style="margin-top:10px">${ic('lock')} כל שינוי נרשם על תיק העובד ומשפיע מיד על מה שהוא רואה במערכת.</p>`;
  }
  if (tab === 'file') return `
    <div class="hr-grid">
      <div class="hr-col"><h4>${ic('user')} פרטים אישיים</h4>
        <label>שם מלא<input class="cc-inp" data-hrf="__name" value="${esc(emp.name)}"></label>
        <label>ת.ז<input class="cc-inp" data-hrf="idnum" value="${esc(h.idnum)}" placeholder="000000000"></label>
        <label>תאריך לידה<input class="cc-inp" data-hrf="birth" value="${esc(h.birth)}" placeholder="01/01/1990"></label>
        <label>מגדר
          <span class="hr-gender">
            <button class="tag-chip ${emp.gender === 'm' ? 'on' : ''}" data-hrgender="m">גבר</button>
            <button class="tag-chip ${emp.gender === 'f' ? 'on' : ''}" data-hrgender="f">אישה</button>
          </span></label>
      </div>
      <div class="hr-col"><h4>${ic('phone')} יצירת קשר</h4>
        <label>טלפון<input class="cc-inp" data-hrf="phone" value="${esc(h.phone)}"></label>
        <label>דוא״ל<input class="cc-inp" data-hrf="mail" value="${esc(h.mail)}"></label>
        <label>כתובת<input class="cc-inp" data-hrf="addr" value="${esc(h.addr)}"></label>
        <label>איש קשר לחירום<input class="cc-inp" data-hrf="emergency" value="${esc(h.emergency)}" placeholder="שם · טלפון · קשר"></label>
      </div>
    </div>
    <p class="hint" style="margin-top:10px">${ic('lock')} פרטים אישיים נגישים לבעלי הרשאת HR בלבד ומאובטחים לפי חוק הגנת הפרטיות.</p>`;

  if (tab === 'employ') return `
    <div class="hr-grid">
      <div class="hr-col"><h4>${ic('org')} העסקה</h4>
        <label>סוג העסקה<select class="cc-inp" data-hrf="employType">${HR_EMPLOY_TYPES.map(t => `<option ${h.employType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>היקף משרה (%)<input class="cc-inp" type="number" min="1" max="100" data-hrf="scopePct" value="${h.scopePct}"></label>
        <label>תחילת עבודה<input class="cc-inp" data-hrf="startDate" value="${esc(h.startDate)}" placeholder="01/01/2024"></label>
        <label>סיום עבודה (אם רלוונטי)<input class="cc-inp" data-hrf="endDate" value="${esc(h.endDate)}" placeholder="—"></label>
      </div>
      <div class="hr-col"><h4>${ic('user')} תפקיד וכפיפות</h4>
        <label>תפקיד<input class="cc-inp" data-hrf="__role" value="${esc(emp.role)}"></label>
        <label>מחלקה<select class="cc-inp" data-hrf="__dept">${DEPARTMENTS.map(d => `<option ${emp.dept === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label>מנהל ישיר<select class="cc-inp" data-hrf="manager"><option value="">—</option>${STAFF.filter(s => s.id !== emp.id).map(s => `<option value="${s.id}" ${h.manager === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>
        <label>רמת הרשאה <small class="muted">(נקבעת בלשונית ההרשאות)</small><input class="cc-inp" value="${esc(emp.perm)}" readonly></label>
      </div>
    </div>
    <div class="hr-sec"><h4>${ic('org')} סניפים משויכים</h4>
      <div class="tag-wrap">${COORD_BRANCHES.map(b => `<button class="tag-chip ${(emp.branches || []).includes(b.key) ? 'on' : ''}" data-hrbranch="${b.key}">${b.short}</button>`).join('')}</div></div>`;

  if (tab === 'leave') {
    const used = (h.leaves || []).filter(l => l.type === 'vacation').reduce((s, l) => s + (+l.days || 0), 0);
    return `
    <div class="hr-balance">
      <div class="hr-bal-box"><b>${h.leaveBalance}</b><small>ימי חופשה לשנה</small></div>
      <div class="hr-bal-box"><b>${used}</b><small>נוצלו</small></div>
      <div class="hr-bal-box hl"><b>${Math.max(0, h.leaveBalance - used)}</b><small>יתרה</small></div>
      <label class="hr-bal-edit">עדכן מכסה<input class="cc-inp" type="number" min="0" max="60" data-hrf="leaveBalance" value="${h.leaveBalance}"></label>
    </div>
    <div class="hr-sec"><h4>${ic('calendar')} היעדרויות</h4>
      <div class="hr-leave-add">
        <select class="cc-inp" id="hrLvType">${HR_LEAVE_TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}</select>
        <input class="cc-inp" id="hrLvFrom" placeholder="מתאריך">
        <input class="cc-inp" id="hrLvDays" type="number" min="1" max="60" value="1" placeholder="ימים">
        <input class="cc-inp" id="hrLvNote" placeholder="הערה (אופציונלי)">
        <button class="btn sm primary" id="hrLvAdd">${ic('plus')} הוסף</button>
      </div>
      ${(h.leaves || []).length ? `<div class="hr-list">${h.leaves.map((l, i) => { const t = HR_LEAVE_TYPES.find(x => x.key === l.type) || HR_LEAVE_TYPES[0];
        return `<div class="hr-row"><span class="badge ${t.color} sm">${t.label}</span>
          <b>${esc(l.from)}</b><span class="muted">${l.days} ימים</span>
          ${l.note ? `<small class="muted">${esc(l.note)}</small>` : ''}
          <span class="hr-row-end"><span class="badge ${l.approved ? 'green' : 'amber'} sm">${l.approved ? 'אושר' : 'ממתין לאישור'}</span>
            ${!l.approved ? `<button class="btn xs primary" data-hrlvok="${i}">${ic('check')} אשר</button>` : ''}
            <button class="whs-del" data-hrlvdel="${i}">${ic('close')}</button></span></div>`; }).join('')}</div>`
        : '<p class="muted" style="font-size:12.5px;margin:0">אין היעדרויות רשומות.</p>'}
    </div>`;
  }

  if (tab === 'certs') return `
    <div class="hr-sec"><h4>${ic('check')} הכשרות והסמכות</h4>
      <div class="hr-leave-add">
        <input class="cc-inp" id="hrCertName" placeholder="שם ההסמכה / הכשרה">
        <input class="cc-inp" id="hrCertDate" placeholder="תאריך הסמכה">
        <input class="cc-inp" id="hrCertExp" placeholder="תוקף עד (אופציונלי)">
        <button class="btn sm primary" id="hrCertAdd">${ic('plus')} הוסף</button>
      </div>
      ${(h.certs || []).length ? `<div class="hr-list">${h.certs.map((c, i) => `<div class="hr-row">
        <span class="hr-cert-ic">${ic('check')}</span><b>${esc(c.name)}</b>
        <span class="muted">${esc(c.date || '')}</span>
        ${c.exp ? `<span class="badge amber sm">תוקף עד ${esc(c.exp)}</span>` : ''}
        <span class="hr-row-end"><button class="whs-del" data-hrcertdel="${i}">${ic('close')}</button></span></div>`).join('')}</div>`
        : '<p class="muted" style="font-size:12.5px;margin:0">טרם נרשמו הכשרות.</p>'}
    </div>
    <div class="hr-sec"><h4>${ic('tasks')} מומחיות · טיפולים <small class="muted">(מזין את שיבוץ התורים)</small></h4>
      <div class="tag-wrap">${COORD_TREATMENTS.map(t => `<button class="tag-chip ${(emp.skills || []).includes(t.key) ? 'on' : ''}" data-hrskill="${t.key}">${t.label}</button>`).join('')}</div></div>`;

  if (tab === 'docs') return `
    ${typeof openEmployeeContractPicker === 'function' ? `<div class="hr-ct-bar">
      <span>${ic('docs')} <b>הסכמי העסקה</b> — מופקים ממערכת החוזים עם נתוני העובד</span>
      <button class="btn sm primary" id="hrIssueCt">${ic('docs')} הפק הסכם העסקה</button>
    </div>` : ''}
    <div class="hr-sec"><h4>${ic('docs')} מסמכי עובד (${(h.docs || []).length})</h4>
      <div class="hr-leave-add">
        <select class="cc-inp" id="hrDocType">${HR_DOC_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
        <input class="cc-inp" id="hrDocName" placeholder="שם המסמך">
        <button class="btn sm primary" id="hrDocAdd">${ic('plus')} הוסף מסמך</button>
      </div>
      ${(h.docs || []).length ? `<div class="hr-list">${h.docs.map((d, i) => `<div class="hr-row">
        <span class="hr-cert-ic">${ic('docs')}</span><b>${esc(d.name)}</b>
        <span class="badge blue sm">${esc(d.type)}</span>
        <small class="muted">${ic('user')} ${esc(d.by)} · ${esc(d.at)}</small>
        <span class="hr-row-end"><button class="whs-del" data-hrdocdel="${i}">${ic('close')}</button></span></div>`).join('')}</div>`
        : '<p class="muted" style="font-size:12.5px;margin:0">אין מסמכים.</p>'}
      <p class="hint" style="margin-top:10px">${ic('lock')} כל מסמך נחתם בשם המעלה וחותמת זמן.</p>
    </div>`;

  if (tab === 'lifecycle') {
    const prog = list => { const done = list.filter(t => h.onboard[t]).length; return Math.round(done / list.length * 100); };
    const progOff = list => { const done = list.filter(t => h.offboard[t]).length; return Math.round(done / list.length * 100); };
    return `
    <div class="hr-sec"><h4>${ic('plus')} קליטת עובד (Onboarding) <span class="hr-prog">${prog(HR_ONBOARD_TASKS)}%</span></h4>
      <div class="hr-checks">${HR_ONBOARD_TASKS.map(t => `<label class="hr-check ${h.onboard[t] ? 'on' : ''}"><input type="checkbox" data-hron="${esc(t)}" ${h.onboard[t] ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
    <div class="hr-sec"><h4>${ic('close')} סיום העסקה (Offboarding) <span class="hr-prog">${progOff(HR_OFFBOARD_TASKS)}%</span></h4>
      <div class="hr-checks">${HR_OFFBOARD_TASKS.map(t => `<label class="hr-check ${h.offboard[t] ? 'on' : ''}"><input type="checkbox" data-hroff="${esc(t)}" ${h.offboard[t] ? 'checked' : ''}> ${t}</label>`).join('')}</div>
      <p class="hint" style="margin-top:10px">${ic('alert')} סיום העסקה מבטל אוטומטית את ההרשאות ומשחרר את שיבוצי היומן העתידיים.</p></div>`;
  }
  return '';
}
function bindHrPanel(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const emp = STAFF.find(s => s.id === hrEmp) || STAFF[0]; const h = hrOf(emp);
  const sel = $('#hrEmpSel'); if (sel) sel.addEventListener('change', () => { hrEmp = sel.value; RR(); });
  $$('[data-hrtab]').forEach(b => b.addEventListener('click', () => { hrTab = b.dataset.hrtab; RR(); }));
  // שדות — __ מציין שדה על העובד עצמו (לא תחת hr)
  $$('[data-hrf]').forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.hrf;
    if (k === '__name') emp.name = inp.value;
    else if (k === '__role') emp.role = inp.value;
    else if (k === '__dept') emp.dept = inp.value;
    else h[k] = (inp.type === 'number') ? +inp.value : inp.value;
    if (typeof syncCoordStaff === 'function') syncCoordStaff();
    toast('נשמר');
    if (k === 'leaveBalance' || k === '__dept') RR();
  }));
  $$('[data-hrgender]').forEach(b => b.addEventListener('click', () => { emp.gender = b.dataset.hrgender; if (typeof syncCoordStaff === 'function') syncCoordStaff(); RR(); toast('המגדר עודכן'); }));
  $$('[data-hrbranch]').forEach(b => b.addEventListener('click', () => {
    emp.branches = emp.branches || []; const k = b.dataset.hrbranch, i = emp.branches.indexOf(k);
    i >= 0 ? emp.branches.splice(i, 1) : emp.branches.push(k);
    emp.branch = emp.branches[0] || emp.branch;
    if (typeof syncCoordStaff === 'function') syncCoordStaff(); RR();
  }));
  $$('[data-hrskill]').forEach(b => b.addEventListener('click', () => {
    emp.skills = emp.skills || []; const k = b.dataset.hrskill, i = emp.skills.indexOf(k);
    i >= 0 ? emp.skills.splice(i, 1) : emp.skills.push(k);
    if (typeof syncCoordStaff === 'function') syncCoordStaff(); RR();
  }));
  // חופשות
  const lv = $('#hrLvAdd'); if (lv) lv.addEventListener('click', () => {
    const from = ($('#hrLvFrom') || {}).value || '', days = +(($('#hrLvDays') || {}).value || 1);
    if (!from.trim()) { toast('נא להזין תאריך'); return; }
    h.leaves.unshift({ type: ($('#hrLvType') || {}).value || 'vacation', from: from.trim(), days, note: (($('#hrLvNote') || {}).value || '').trim(), approved: false });
    RR(); toast('ההיעדרות נרשמה — ממתינה לאישור');
  });
  $$('[data-hrlvok]').forEach(b => b.addEventListener('click', () => { h.leaves[+b.dataset.hrlvok].approved = true; RR(); toast('ההיעדרות אושרה'); }));
  $$('[data-hrlvdel]').forEach(b => b.addEventListener('click', () => { h.leaves.splice(+b.dataset.hrlvdel, 1); RR(); }));
  // הסמכות
  const ca = $('#hrCertAdd'); if (ca) ca.addEventListener('click', () => {
    const n = (($('#hrCertName') || {}).value || '').trim(); if (!n) { toast('נא להזין שם הסמכה'); return; }
    h.certs.unshift({ name: n, date: (($('#hrCertDate') || {}).value || '').trim(), exp: (($('#hrCertExp') || {}).value || '').trim() });
    RR(); toast('ההסמכה נוספה');
  });
  $$('[data-hrcertdel]').forEach(b => b.addEventListener('click', () => { h.certs.splice(+b.dataset.hrcertdel, 1); RR(); }));
  // מסמכים
  const da = $('#hrDocAdd'); if (da) da.addEventListener('click', () => {
    const n = (($('#hrDocName') || {}).value || '').trim(); if (!n) { toast('נא להזין שם מסמך'); return; }
    h.docs.unshift({ name: n, type: ($('#hrDocType') || {}).value || 'אחר', by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''), at: hrStamp() });
    RR(); toast('המסמך נוסף ונחתם');
  });
  $$('[data-hrdocdel]').forEach(b => b.addEventListener('click', () => { h.docs.splice(+b.dataset.hrdocdel, 1); RR(); }));
  $$('[data-hrperm]').forEach(t => t.addEventListener('click', () => {
    const label = t.dataset.hrperm, cur = effectivePerm(emp, label);
    if (typeof setEmpOverride === 'function') setEmpOverride(emp, label, !cur);
    RR(); toast((!cur ? 'ניתנה' : 'נשללה') + ' הרשאה: ' + label + ' · ' + emp.name);
  }));
  $$('[data-hrpermreset]').forEach(b => b.addEventListener('click', () => {
    if (typeof clearEmpOverride === 'function') clearEmpOverride(emp, b.dataset.hrpermreset);
    RR(); toast('אופס לברירת המחדל של התפקיד');
  }));
  const ict = $('#hrIssueCt'); if (ict) ict.addEventListener('click', () => { if (typeof openEmployeeContractPicker === 'function') openEmployeeContractPicker(emp); });
  // קליטה/סיום
  $$('[data-hron]').forEach(cb => cb.addEventListener('change', () => { h.onboard[cb.dataset.hron] = cb.checked; RR(); }));
  $$('[data-hroff]').forEach(cb => cb.addEventListener('change', () => { h.offboard[cb.dataset.hroff] = cb.checked; RR(); }));
}
