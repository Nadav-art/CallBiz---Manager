/* ============================================================
   מודול הרשאות — עצמאי ונתיק (מנוע + UI)
   ------------------------------------------------------------
   מנוע (API לחילוץ עתידי לממשק חיצוני):
     effectivePerm(emp, label)  → boolean · ההרשאה בפועל (override פר-עובד גובר על התפקיד)
     hasPermission(emp, label)  → alias
     setRoleGrant(label, roleIdx, on)     · מטריצת ברירת-המחדל לפי תפקיד
     setEmpOverride(emp, label, val)      · חריגה נקודתית לעובד
     clearEmpOverride(emp, label)         · חזרה לברירת התפקיד
   הנתונים: PERMISSIONS + ROLES (data.js); overrides ב-emp.permOverrides.
   ============================================================ */
function permRoleGrant(emp, label) { const p = PERMISSIONS.find(x => x.label === label); const ri = ROLES.indexOf(emp && emp.perm); return (p && ri >= 0) ? !!p.grants[ri] : false; }
function permIsOverridden(emp, label) { return !!(emp && emp.permOverrides && Object.prototype.hasOwnProperty.call(emp.permOverrides, label)); }
function effectivePerm(emp, label) { return permIsOverridden(emp, label) ? !!emp.permOverrides[label] : permRoleGrant(emp, label); }
function hasPermission(emp, label) { return effectivePerm(emp, label); }
function setRoleGrant(label, roleIdx, on) { const p = PERMISSIONS.find(x => x.label === label); if (p) p.grants[roleIdx] = on ? 1 : 0; }
function setEmpOverride(emp, label, val) { emp.permOverrides = emp.permOverrides || {}; emp.permOverrides[label] = !!val; }
function clearEmpOverride(emp, label) { if (emp && emp.permOverrides) delete emp.permOverrides[label]; }

/* ---------------- UI ---------------- */
let permsTab = 'role';    // 'role' = מטריצת תפקידים · 'emp' = פר-עובד
let permsEmp = null;      // מזהה העובד הנבחר בלשונית "לפי עובד"

function renderPermissionsView() {
  $('#viewHost').innerHTML = `
    ${settingsHeader()}
    ${permsMgrPanel()}`;
  bindSettingsHeader();
  bindPermsMgr();
}

/* מטריצת הרשאות לפי תפקיד (ברירת מחדל כללית) */
function permsRolePanel() {
  return `<section class="card set-card wide">
    <div class="card-head"><div class="title">${ic('user')} הרשאות לפי תפקיד</div>
      <span class="muted" style="font-size:12px">מטריצת ברירת-המחדל שכל תפקיד מקבל</span></div>
    <div class="set-body">
      <p class="hint" style="margin-top:0">${ic('alert')} זו ברירת המחדל לכל תפקיד. חריגה אישית לעובד בודד נקבעת ב<b>כל העובדים › תיק העובד › לשונית "הרשאות"</b>.
        <button class="btn xs" id="permsGoHr">${ic('clients')} פתח תיק עובד</button></p>
      <div class="table-wrap"><table class="mini-table perm-table perms-matrix">
      <thead><tr><th>הרשאה</th>${ROLES.map(rl => `<th>${rl}</th>`).join('')}</tr></thead>
      <tbody>${PERMISSIONS.map(p => `<tr><td><b>${p.label}</b></td>
        ${p.grants.map((g, gi) => `<td class="perm-cell"><span class="toggle wh-toggle ${g ? 'on' : ''}" data-permrole="${esc(p.label)}|${gi}" role="button" tabindex="0"><i></i></span></td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></div></section>`;
}
function bindPermsRole() {
  const gh = $('#permsGoHr'); if (gh) gh.addEventListener('click', () => {
    if (typeof hrTab !== 'undefined') hrTab = 'perms';
    if (typeof mgrEmpOpen !== 'undefined') mgrEmpOpen = (typeof settingsEmp !== 'undefined') ? settingsEmp : (STAFF[0] || {}).id;
    if (typeof applySetMode === 'function') { applySetMode('mgr'); renderSettingsView(); }
  });
  $$('[data-permrole]').forEach(t => t.addEventListener('click', () => {
    const [label, gi] = t.dataset.permrole.split('|'); const p = PERMISSIONS.find(x => x.label === label);
    if (p) { p.grants[+gi] = p.grants[+gi] ? 0 : 1; renderPermissionsView(); toast(`${label} · ${ROLES[+gi]}: ${p.grants[+gi] ? 'הותר' : 'נחסם'}`); }
  }));
}

/* הגדרות מנהל — כל ההגדרות ברמת מנהל מרוכזות כאן (הועברו מ"שדות פנייה") */
const MGR_SECTIONS = [
  { key: 'criteria', label: 'קריטריונים ובירור צורך', icon: 'target', desc: 'אילו קריטריונים נשאלים, מאיפה המידע, ומה חובה לפני תיאום' },
  { key: 'fields', label: 'שדות פנייה', icon: 'docs', desc: 'אילו שדות מופיעים בפנייה, לפי וורקפלואו וקטגוריה' },
  { key: 'booking', label: 'תיאום ושמירת תור', icon: 'clock', desc: 'זמן נעילה זמנית של תור עד להשלמת סליקה' },
  { key: 'contracts', label: 'הסכמים וחתימות', icon: 'docs', desc: 'תוקף קישור חתימה ותזכורות אוטומטיות' },
  { key: 'roles', label: 'הרשאות לפי תפקיד', icon: 'lock', desc: 'מטריצת ברירת המחדל שכל תפקיד מקבל' },
];
let mgrSec = 'criteria';
function permsMgrPanel() {
  const cur = MGR_SECTIONS.find(s => s.key === mgrSec) || MGR_SECTIONS[0];
  let body = '';
  if (mgrSec === 'criteria') body = (typeof needsCriteriaCardHTML === 'function') ? needsCriteriaCardHTML() : '';
  else if (mgrSec === 'fields') body = (typeof fieldsManagerHTML === 'function') ? fieldsManagerHTML() : '';
  else if (mgrSec === 'booking') body = (typeof holdSettingHTML === 'function') ? holdSettingHTML() : '';
  else if (mgrSec === 'contracts') body = mgrContractsHTML();
  else if (mgrSec === 'roles') body = permsRolePanel();
  return `<div class="mgr-wrap">
    <aside class="mgr-nav">
      <div class="mgr-nav-h">${ic('lock')} הגדרות מנהל</div>
      ${MGR_SECTIONS.map(s => `<button class="mgr-nav-item ${mgrSec === s.key ? 'on' : ''}" data-mgrsec="${s.key}">
        <span class="mgr-nav-ic">${ic(s.icon)}</span>
        <span class="mgr-nav-t"><b>${s.label}</b><small>${s.desc}</small></span></button>`).join('')}
      <div class="mgr-nav-note">${ic('alert')} הגדרות אלו חלות על <b>כל המערכת</b> — כל הלידים, הסניפים והעובדים.</div>
    </aside>
    <main class="mgr-main">
      <div class="mgr-main-h">${ic(cur.icon)} <b>${cur.label}</b><small>${cur.desc}</small></div>
      ${body}
    </main>
  </div>`;
}
/* הגדרות הסכמים ברמת מנהל (מרוכז כאן; המרשם עצמו נשאר במערכת החוזים) */
function mgrContractsHTML() {
  const vd = (typeof ctValidDays === 'function') ? ctValidDays() : 14;
  const rd = (typeof ctRemindDays === 'function') ? ctRemindDays() : 3;
  const tplCount = (typeof CONTRACT_TEMPLATES !== 'undefined') ? CONTRACT_TEMPLATES.length : 0;
  const approved = (typeof CONTRACT_TEMPLATES !== 'undefined') ? CONTRACT_TEMPLATES.filter(c => c.legalApproved).length : 0;
  const issued = (typeof CONTRACT_REGISTRY !== 'undefined') ? CONTRACT_REGISTRY.length : 0;
  return `<section class="card set-card wide">
    <div class="card-head"><div class="title">${ic('docs')} הסכמים וחתימות</div></div>
    <div class="set-body">
      <div class="mgr-stats">
        <div class="mgr-stat"><b>${tplCount}</b><small>תבניות</small></div>
        <div class="mgr-stat"><b>${approved}</b><small>מאושרות משפטית</small></div>
        <div class="mgr-stat hl"><b>${issued}</b><small>הסכמים שהופקו</small></div>
      </div>
      <div class="mgr-fields">
        <label class="mgr-f">תוקף קישור חתימה (ימים)<input class="cc-inp" type="number" id="mgrCtValid" min="1" max="365" value="${vd}"></label>
        <label class="mgr-f">תזכורת אוטומטית אם לא נחתם (ימים)<input class="cc-inp" type="number" id="mgrCtRemind" min="0" max="60" value="${rd}"></label>
      </div>
      <p class="hint" style="margin-top:12px">${ic('lock')} כל הפקה, שליחה, תזכורת וחתימה נרשמות במסלול ביקורת. ניהול התבניות והמרשם — בטאב <b>מערכת חוזים</b>.</p>
    </div></section>`;
}
function bindPermsMgr() {
  $$('[data-mgrsec]').forEach(b => b.addEventListener('click', () => { mgrSec = b.dataset.mgrsec; renderPermissionsView(); }));
  if (mgrSec === 'roles') bindPermsRole();
  if (mgrSec === 'fields' && typeof bindFieldsManager === 'function') bindFieldsManager();
  if (typeof bindNeedsCriteriaCard === 'function') bindNeedsCriteriaCard(renderPermissionsView);
  if (typeof bindHoldSetting === 'function') bindHoldSetting(renderPermissionsView);
  const v = $('#mgrCtValid'); if (v) v.addEventListener('change', () => { if (typeof ctSetValidDays === 'function') ctSetValidDays(v.value); toast('תוקף קישור חתימה: ' + v.value + ' ימים'); });
  const rd = $('#mgrCtRemind'); if (rd) rd.addEventListener('change', () => { if (typeof ctSetRemindDays === 'function') ctSetRemindDays(rd.value); toast('תזכורת אוטומטית: ' + rd.value + ' ימים'); });
}
/* הרשאות פר-עובד — override על ברירת התפקיד */
function permsEmpPanel() {
  const emp = STAFF.find(s => s.id === permsEmp) || STAFF[0]; permsEmp = emp.id;
  const groups = DEPARTMENTS.map(dp => { const opts = STAFF.filter(s => s.dept === dp).map(s => `<option value="${s.id}" ${s.id === emp.id ? 'selected' : ''}>${s.name} · ${s.role}</option>`).join(''); return opts ? `<optgroup label="${dp}">${opts}</optgroup>` : ''; }).join('');
  return `<section class="card set-card wide">
    <div class="card-head"><div class="title">${ic('clients')} הרשאות לפי עובד</div>
      <div class="emp-select"><span>עובד:</span><select id="permsEmpSel">${groups}</select></div></div>
    <div class="set-body">
      <p class="hint" style="margin-top:0">${ic('alert')} ברירת המחדל לפי התפקיד (<b>${emp.perm}</b>). כאן אפשר לתת/לשלול הרשאה נקודתית לעובד ספציפי — גם אם התפקיד לא כולל אותה (למשל מנהל סניף שמקבל הרשאת מנהל-על אחת).</p>
      <div class="perms-emp-list">
        ${PERMISSIONS.map(p => { const eff = effectivePerm(emp, p.label), ov = permIsOverridden(emp, p.label), def = permRoleGrant(emp, p.label);
          return `<div class="pe-row ${ov ? 'ov' : ''}">
            <span class="pe-lbl">${p.label}${ov ? '<span class="pe-badge">חריגה אישית</span>' : ''}</span>
            <span class="pe-right">
              ${ov ? `<button class="pe-reset" data-permreset="${esc(p.label)}">${ic('sync')} אפס לתפקיד</button>` : `<span class="pe-def">ברירת מחדל: ${def ? 'מותר' : 'חסום'}</span>`}
              <span class="toggle wh-toggle ${eff ? 'on' : ''}" data-permemp="${esc(p.label)}" role="button" tabindex="0"><i></i></span>
            </span></div>`; }).join('')}
      </div>
    </div></section>`;
}
function bindPermsEmp() {
  const emp = STAFF.find(s => s.id === permsEmp) || STAFF[0];
  const sel = $('#permsEmpSel'); if (sel) sel.addEventListener('change', () => { permsEmp = +sel.value; renderPermissionsView(); });
  $$('[data-permemp]').forEach(t => t.addEventListener('click', () => {
    const label = t.dataset.permemp, cur = effectivePerm(emp, label), def = permRoleGrant(emp, label);
    // אם המצב החדש שווה לברירת התפקיד — מנקים את ה-override במקום להשאיר חריגה מיותרת
    if (!cur === def) clearEmpOverride(emp, label); else setEmpOverride(emp, label, !cur);
    renderPermissionsView(); toast(`${label}: ${!cur ? 'ניתן' : 'נשלל'} ל${emp.name}`);
  }));
  $$('[data-permreset]').forEach(b => b.addEventListener('click', () => { clearEmpOverride(emp, b.dataset.permreset); renderPermissionsView(); toast('ההרשאה אופסה לברירת התפקיד'); }));
}
