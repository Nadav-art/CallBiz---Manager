/* ============================================================
   אוטומציות מתקדמות — ממשק · מודול עצמאי (תוספת בלבד)
   סטטיסטיקות · עדיפות · תדירות · חלון פעילות · פעולה חלופית ·
   חיפוש וסינון · מצב בדיקה · ייצוא/ייבוא · שכפול · אשף.
   ============================================================ */

/* ---------------- הגדרות מתקדמות בגלגל השיניים ---------------- */
/* שורת הגדרה אחידה: כותרת בשפה פשוטה + משפט הסבר + הפקד */
function apSet(label, hint, control) {
  return `<div class="ap-set"><div class="ap-set-h"><b>${label}</b><small>${hint}</small></div>
    <div class="ap-set-c">${control}</div></div>`;
}
function autoProCfgHTML(key) {
  const m = autoMeta(key);
  const days = (typeof HEB_DAYS_S !== 'undefined') ? HEB_DAYS_S : ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const allDays = (m.days || []).length === 7;
  const allHours = (+m.hFrom || 0) === 0 && (+m.hTo === undefined ? 24 : +m.hTo) === 24;
  const hOpt = sel => Array.from({ length: 25 }, (_, h) => `<option value="${h}" ${+sel === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
  return `<div class="ap-wrap">
    ${apSet('מי רץ ראשון?', 'רלוונטי רק אם כמה אוטומציות מופעלות על אותו אירוע. מספר קטן יותר = רצה קודם.',
      `<div class="ap-hours"><input class="cc-inp sm" type="number" min="1" max="9" data-apnum="priority" value="${m.priority}"><span>מתוך 9</span></div>`)}

    ${apSet('כמה פעמים לרוץ על אותו לקוח?', 'למשל "פעם אחת לליד" — גם אם האירוע יקרה שוב, האוטומציה לא תחזור על עצמה.',
      `<select class="cc-inp sm" data-apsel="limit">${AUTO_LIMITS.map(l => `<option value="${l.key}" ${m.limit === l.key ? 'selected' : ''}>${l.label}</option>`).join('')}</select>`)}

    ${apSet('להשתיק חזרה מהירה', 'אם האוטומציה כבר רצה על הלקוח הזה לפני פחות מהזמן הזה — היא תדלג. כך לא נשלחות שתי הודעות זהות ברצף. 0 = לא לבדוק.',
      `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" max="1440" data-apnum="dedupeMin" value="${m.dedupeMin}"><span>דקות</span></div>`)}

    ${apSet('רק בימים מסוימים', allDays ? 'כרגע: כל ימות השבוע. לחצו על יום כדי לכבות אותו.' : 'לחצו על יום כדי להדליק או לכבות אותו.',
      `<div class="ap-days">${days.map((d, i2) => `<button class="ap-day ${(m.days || []).indexOf(i2) >= 0 ? 'on' : ''}" data-apday="${i2}">${d}</button>`).join('')}</div>`)}

    ${apSet('רק בשעות מסוימות', allHours ? 'כרגע: כל שעות היממה.' : 'האוטומציה תרוץ רק בין השעות שנבחרו.',
      `<div class="ap-hours"><span>מהשעה</span>
        <select class="cc-inp sm" data-apnum="hFrom">${hOpt(m.hFrom)}</select>
        <span>עד השעה</span>
        <select class="cc-inp sm" data-apnum="hTo">${hOpt(m.hTo === undefined ? 24 : m.hTo)}</select></div>`)}

    ${apSet('רק בתקופה מסוימת', 'שימושי למבצע או לעונה. השאירו ריק כדי שהאוטומציה תעבוד תמיד.',
      `<div class="ap-dates">
        <label><span>מתאריך</span><input class="cc-inp sm" type="date" data-apdate="from" value="${esc(m.from)}"></label>
        <label><span>עד תאריך</span><input class="cc-inp sm" type="date" data-apdate="to" value="${esc(m.to)}"></label>
      </div>${(m.from || m.to) ? `<button class="btn xs" id="apDatesClear">${ic('close')} בטל הגבלת תאריכים</button>` : ''}`)}

    ${apSet('ואם הפעולה נכשלת?', 'למשל: אם הוואטסאפ לא נשלח — לשלוח במקומו התראה לנציג, כדי שלא ילך לאיבוד.',
      `<select class="cc-inp sm" data-apsel="onFail">
        <option value="">לא לעשות כלום</option>
        ${(typeof AUTO_ACTIONS !== 'undefined' ? AUTO_ACTIONS : []).map(a => `<option value="${a.key}" ${m.onFail === a.key ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}
      </select>`)}

    <div class="ap-vars"><b>${ic('bolt')} מילים שמתמלאות לבד</b>
      <small>אפשר לשתול אותן בתוך נוסח ההודעה — המערכת תחליף בפרטים האמיתיים של הלקוח:</small>
      <div class="ap-varlist">${Object.keys(AUTO_VARS).map(v => `<code>${esc(v)}</code>`).join('')}</div></div>
  </div>`;
}
function autoProCfgBind(key, rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  $$('[data-apnum]').forEach(i => i.addEventListener('change', () => { const p = {}; p[i.dataset.apnum] = +i.value || 0; autoMetaSet(key, p); RR(); }));
  $$('[data-apsel]').forEach(s => s.addEventListener('change', () => { const p = {}; p[s.dataset.apsel] = s.value; autoMetaSet(key, p); RR(); }));
  $$('[data-apdate]').forEach(d => d.addEventListener('change', () => { const p = {}; p[d.dataset.apdate] = d.value; autoMetaSet(key, p); RR(); }));
  const dc = $('#apDatesClear'); if (dc) dc.addEventListener('click', () => { autoMetaSet(key, { from: '', to: '' }); RR(); });
  $$('[data-apday]').forEach(b => b.addEventListener('click', () => {
    const m = autoMeta(key), i = +b.dataset.apday, arr = (m.days || []).slice();
    const at = arr.indexOf(i); if (at >= 0) arr.splice(at, 1); else arr.push(i);
    autoMetaSet(key, { days: arr.sort() }); RR();
  }));
}

/* ---------------- סרגל: חיפוש · סינון · מצב בדיקה · ייצוא/ייבוא ---------------- */
let autoSearch = '', autoFilter = 'all';
const AUTO_FILTERS = [{ key: 'all', label: 'הכל' }, { key: 'on', label: 'פעילים' }, { key: 'off', label: 'כבויים' }, { key: 'custom', label: 'שהוספתי' }];
function autoToolbarHTML() {
  return `<div class="ap-bar">
    ${autoSearch ? `<span class="ap-q">${ic('search')} "${esc(autoSearch)}"<button id="apQClear" title="נקה חיפוש">${ic('close')}</button></span>` : ''}
    <span class="ap-filters">${AUTO_FILTERS.map(f => `<button class="ap-f ${autoFilter === f.key ? 'on' : ''}" data-apf="${f.key}">${f.label}</button>`).join('')}</span>
    <span class="ap-more">
      <button class="btn xs" id="apMore">${ic('kebab')} עוד</button>
      <span class="ap-more-menu" id="apMoreMenu" hidden>
        <label class="ap-dry ${AUTO_DRY ? 'on' : ''}" title="מריץ ומראה מה היה קורה — בלי לשנות נתונים">
          <input type="checkbox" id="apDry" ${AUTO_DRY ? 'checked' : ''}>${ic('eye')} מצב בדיקה</label>
        <button class="ap-more-i" id="apExport">${ic('docs')} ייצוא אוטומציות</button>
        <button class="ap-more-i" id="apImport">${ic('plus')} ייבוא אוטומציות</button>
      </span></span>
  </div>`;
}
function autoMatches(a) {
  if (autoFilter === 'on' && !autoIsOn(a.key)) return false;
  if (autoFilter === 'off' && autoIsOn(a.key)) return false;
  if (autoFilter === 'custom' && !a.custom) return false;
  const q = (autoSearch || '').trim(); if (!q) return true;
  const d = autoDef(a.key) || a;
  return ((a.title || '') + ' ' + (a.trigger || '') + ' ' + (d.what || a.desc || '')).indexOf(q) >= 0;
}
function autoToolbarBind(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const qc = $('#apQClear'); if (qc) qc.addEventListener('click', () => { autoSearch = ''; RR(); });
  $$('[data-apf]').forEach(b => b.addEventListener('click', () => { autoFilter = b.dataset.apf; RR(); }));
  const d = $('#apDry'); if (d) d.addEventListener('change', () => { autoDrySet(d.checked); RR();
    toast(d.checked ? 'מצב בדיקה פעיל — הרצות לא ישנו נתונים' : 'מצב בדיקה כובה'); });
  const mo = $('#apMore'); if (mo) mo.addEventListener('click', e => { e.stopPropagation();
    const m = $('#apMoreMenu'); if (!m) return; m.hidden = !m.hidden;
    if (!m.hidden) setTimeout(() => document.addEventListener('click', function h() {
      const mm = $('#apMoreMenu'); if (mm) mm.hidden = true; document.removeEventListener('click', h); }), 0);
  });
  const ex = $('#apExport'); if (ex) ex.addEventListener('click', () => openAutoIO('export'));
  const im = $('#apImport'); if (im) im.addEventListener('click', () => openAutoIO('import'));
}
function openAutoIO(mode) {
  const old = document.getElementById('autoIOPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'autoIOPanel'; document.body.appendChild(w);
  const close = () => w.remove();
  w.innerHTML = `<div class="cbc-box" style="max-width:560px;text-align:start">
    <div class="cbc-head"><span class="cbc-ic">${ic('docs')}</span><b>${mode === 'export' ? 'ייצוא אוטומציות' : 'ייבוא אוטומציות'}</b></div>
    <p class="cr-hint">${ic('alert')} ${mode === 'export' ? 'העתק ושמור — אפשר לייבא לפעילות אחרת או ללקוח אחר.' : 'הדבק כאן קובץ ייצוא. חוקים קיימים לא נמחקים — רק מתווספים ומתעדכנים.'}</p>
    <textarea class="cc-inp" id="apIO" rows="10" style="font-family:monospace;font-size:11px" ${mode === 'export' ? 'readonly' : ''} placeholder="{ … }">${mode === 'export' ? esc(autoExport()) : ''}</textarea>
    <div class="cbc-actions"><button class="btn ghost" id="apIOClose">סגור</button>
      ${mode === 'export' ? `<button class="btn primary" id="apIOCopy">${ic('docs')} העתק</button>`
        : `<button class="btn primary" id="apIODo">${ic('check')} ייבא</button>`}</div></div>`;
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#apIOClose').addEventListener('click', close);
  const cp = $('#apIOCopy'); if (cp) cp.addEventListener('click', () => { const t = $('#apIO'); t.select();
    try { document.execCommand('copy'); toast('הועתק'); } catch (e) { toast('בחר והעתק ידנית'); } });
  const dm = $('#apIODo'); if (dm) dm.addEventListener('click', () => {
    const res = autoImport(($('#apIO') || {}).value || '');
    if (!res.ok) { toast('ייבוא נכשל: ' + res.why); return; }
    close(); if (typeof renderAutomationsScreen === 'function') renderAutomationsScreen();
    toast('יובאו ' + res.n + ' חוקים + הגדרות');
  });
  requestAnimationFrame(() => w.classList.add('open'));
}

/* ---------------- אשף יצירת אוטומציה — שלב אחר שלב ---------------- */
let awStep = 1, awDraft = null;
function openAutoWizard() {
  awStep = 1; awDraft = { title: '', trigger: (typeof AUTO_TRIGGERS !== 'undefined' ? AUTO_TRIGGERS[0] : ''), action: 'notify', param: '', cond: [], priority: 5, limit: 'none' };
  const old = document.getElementById('autoWizPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'autoWizPanel'; document.body.appendChild(w);
  renderAutoWizard();
  requestAnimationFrame(() => w.classList.add('open'));
}
const AW_STEPS = [{ n: 1, label: 'מתי' }, { n: 2, label: 'מה לעשות' }, { n: 3, label: 'תנאים ומגבלות' }, { n: 4, label: 'סיכום' }];
function renderAutoWizard() {
  const w = document.getElementById('autoWizPanel'); if (!w) return;
  const d = awDraft;
  const miss = awStep === 1 ? (!d.title.trim() ? 'יש לתת שם לחוק' : '') : '';
  let body = '';
  if (awStep === 1) body = `
    <label class="exf"><span>שם החוק *</span><input class="cc-inp" id="awTitle" value="${esc(d.title)}" placeholder="למשל: התראה למנהל על ליד VIP"></label>
    <label class="exf"><span>מתי לרוץ (טריגר)</span><select class="cc-inp" id="awTrig">${AUTO_TRIGGERS.map(t => `<option ${d.trigger === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <p class="cr-hint">${ic('bolt')} הטריגר הוא האירוע שמפעיל את החוק. אפשר לשנות אחר כך.</p>`;
  else if (awStep === 2) body = `
    <div class="aw-acts">${AUTO_ACTIONS.map(a => `<button class="rt-m ${d.action === a.key ? 'on' : ''}" data-awact="${a.key}"><b>${esc(a.label)}</b></button>`).join('')}</div>
    <label class="exf"><span>פרמטר (טקסט / מועד)</span><input class="cc-inp" id="awParam" value="${esc(d.param)}" placeholder="למשל: מחר 09:00 · או נוסח ההודעה"></label>
    <p class="cr-hint">${ic('bolt')} אפשר להשתמש במשתנים: ${Object.keys(AUTO_VARS).slice(0, 5).map(esc).join(' · ')}</p>`;
  else if (awStep === 3) body = `
    <label class="rt-row num"><span>עדיפות (1 = ראשון)</span><input class="cc-inp sm" type="number" min="1" max="9" id="awPrio" value="${d.priority}"></label>
    <label class="rt-row num"><span>הגבלת הרצה</span><select class="cc-inp sm" id="awLimit">${AUTO_LIMITS.map(l => `<option value="${l.key}" ${d.limit === l.key ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label>
    <p class="cr-hint">${ic('alert')} תנאים מפורטים אפשר להוסיף אחרי היצירה — בגלגל השיניים של החוק.</p>`;
  else body = `
    <div class="aw-sum">
      <div class="aw-row"><span>שם</span><b>${esc(d.title)}</b></div>
      <div class="aw-row"><span>מתי</span><b>${esc(d.trigger)}</b></div>
      <div class="aw-row"><span>פעולה</span><b>${esc((AUTO_ACTIONS.find(a => a.key === d.action) || {}).label || '')}</b></div>
      ${d.param ? `<div class="aw-row"><span>פרמטר</span><b>${esc(d.param)}</b></div>` : ''}
      <div class="aw-row"><span>עדיפות</span><b>${d.priority}</b></div>
      <div class="aw-row"><span>תדירות</span><b>${esc(autoLimitLabel(d.limit))}</b></div>
    </div>
    <p class="cr-hint">${ic('alert')} החוק ייווצר <b>כבוי</b>. הדלק אותו כשתרצה שירוץ.</p>`;
  w.innerHTML = `<div class="cbc-box cr-box" style="max-width:560px;text-align:start">
    <div class="cbc-head"><span class="cbc-ic">${ic('plus')}</span><b>אשף אוטומציה חדשה</b></div>
    <div class="cr-steps">${AW_STEPS.map(s => `<button class="cr-stepbtn ${awStep === s.n ? 'on' : ''} ${awStep > s.n ? 'done' : ''}" data-awstep="${s.n}">
      <span class="crs-n">${awStep > s.n ? ic('check') : s.n}</span><span class="crs-l">${s.label}</span></button>`).join('')}</div>
    <div class="cr-body">${body}</div>
    <div class="cbc-actions cr-nav">
      ${awStep > 1 ? `<button class="btn ghost" id="awBack">${ic('chevronR')} הקודם</button>` : `<button class="btn ghost" id="awCancel">ביטול</button>`}
      ${miss ? `<span class="cr-miss">${ic('alert')} ${esc(miss)}</span>` : ''}
      ${awStep < 4 ? `<button class="btn primary" id="awNext" ${miss ? 'disabled' : ''}>הבא ${ic('chevronL')}</button>`
        : `<button class="btn primary" id="awDone">${ic('check')} צור אוטומציה</button>`}
    </div></div>`;
  const save = () => {
    const t = $('#awTitle'); if (t) d.title = t.value;
    const tr = $('#awTrig'); if (tr) d.trigger = tr.value;
    const p = $('#awParam'); if (p) d.param = p.value;
    const pr = $('#awPrio'); if (pr) d.priority = +pr.value || 5;
    const li = $('#awLimit'); if (li) d.limit = li.value;
  };
  const close = () => { const el = document.getElementById('autoWizPanel'); if (el) el.remove(); };
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  const ti = $('#awTitle'); if (ti) ti.addEventListener('input', () => { d.title = ti.value;
    const btn = $('#awNext'); if (btn) btn.disabled = !d.title.trim(); });
  $$('[data-awact]').forEach(b => b.addEventListener('click', () => { save(); d.action = b.dataset.awact; renderAutoWizard(); }));
  $$('[data-awstep]').forEach(b => b.addEventListener('click', () => { save(); const n = +b.dataset.awstep;
    if (n > 1 && !d.title.trim()) { toast('יש לתת שם לחוק'); return; } awStep = n; renderAutoWizard(); }));
  const bk = $('#awBack'); if (bk) bk.addEventListener('click', () => { save(); awStep--; renderAutoWizard(); });
  const nx = $('#awNext'); if (nx) nx.addEventListener('click', () => { save(); if (!d.title.trim()) { toast('יש לתת שם לחוק'); return; } awStep++; renderAutoWizard(); });
  const cn = $('#awCancel'); if (cn) cn.addEventListener('click', close);
  const dn = $('#awDone'); if (dn) dn.addEventListener('click', () => {
    save();
    const k = autoAddCustom(d.trigger, d.title.trim(), d.action, d.param);
    if (k) autoMetaSet(k, { priority: d.priority, limit: d.limit });
    close(); if (typeof renderAutomationsScreen === 'function') renderAutomationsScreen();
    toast('האוטומציה נוצרה (כבויה) · הדלק אותה כדי שתרוץ');
  });
}

/* ---------------- עריכת חוק מותאם (שם · טריגר · פעולה) ---------------- */
function autoCustomEditHTML(key, d) {
  if (!d || !d.custom) return '';
  return `<div class="ap-edit">
    <div class="rt-h">${ic('settings')} <b>פרטי החוק</b></div>
    <label class="exf"><span>שם החוק</span><input class="cc-inp" id="aeTitle" value="${esc(d.title || '')}" placeholder="שם ברור שיזהה את החוק"></label>
    <div class="ap-edit-row">
      <label class="exf"><span>מתי לרוץ</span><select class="cc-inp" id="aeTrig">${(typeof AUTO_TRIGGERS !== 'undefined' ? AUTO_TRIGGERS : []).map(t => `<option ${d.trigger === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="exf"><span>פעולה</span><select class="cc-inp" id="aeAct">${(typeof AUTO_ACTIONS !== 'undefined' ? AUTO_ACTIONS : []).map(a => `<option value="${a.key}" ${d.action === a.key ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>
    </div>
    <label class="exf"><span>פרמטר</span><input class="cc-inp" id="aeParam" value="${esc(d.param || '')}" placeholder="טקסט / מועד — אפשר עם משתנים"></label>
  </div>`;
}
function autoCustomEditBind(key, rerender) {
  const upd = (patch, re) => { if (typeof autoUpdateCustom === 'function') autoUpdateCustom(key, patch);
    if (typeof renderAutomationsScreen === 'function' && document.querySelector('.auto-cols')) renderAutomationsScreen();
    if (re && typeof rerender === 'function') rerender(); };
  const t = $('#aeTitle'); if (t) {
    t.addEventListener('input', () => upd({ title: t.value }));
    t.addEventListener('change', () => { if (!t.value.trim()) { toast('לחוק חייב להיות שם'); return; } upd({ title: t.value.trim() }); });
  }
  const tr = $('#aeTrig'); if (tr) tr.addEventListener('change', () => upd({ trigger: tr.value }));
  const ac = $('#aeAct'); if (ac) ac.addEventListener('change', () => upd({ action: ac.value }, true));
  const pa = $('#aeParam'); if (pa) pa.addEventListener('change', () => upd({ param: pa.value }));
}

/* ---------------- מקטעי חלון החוק: תנאים · שרשור · סטטיסטיקות ---------------- */
function autoCondPanelHTML(key) {
  const groups = autoCondGroups(key), f0 = AUTO_FIELDS[0];
  const many = groups.length > 1;
  return `<div class="ac-groups">
      ${groups.map((g, gi) => `
        ${gi ? `<div class="ac-or"><span>או</span></div>` : ''}
        <div class="ac-group">
          <div class="ac-group-h">${many ? 'מצב ' + (gi + 1) : 'התנאים'} <small>כל התנאים כאן חייבים להתקיים יחד</small></div>
          <div class="ar-conds">${g.map((c, ci) => `${ci ? `<span class="ac-and">וגם</span>` : ''}
            <span class="ar-cond">${esc(autoCondText(c))}<button data-acdel="${gi}|${ci}" title="הסר">${ic('close')}</button></span>`).join('')}</div>
        </div>`).join('')}
    </div>

    <div class="ac-add-box">
      <div class="ac-add-h">${ic('plus')} <b>הוספת תנאי</b></div>
      <div class="ar-add">
        <select class="cc-inp sm" id="acField">${AUTO_FIELDS.map(f => `<option value="${f.key}">${esc(f.label)}</option>`).join('')}</select>
        <select class="cc-inp sm" id="acOp">${AUTO_OPS.map(o => `<option value="${o.key}">${esc(o.label)}</option>`).join('')}</select>
        <span id="acValWrap">${autoCondValHTML(f0)}</span>
      </div>
      ${groups.length ? `
        ${many ? `<label class="ac-target">להוסיף אל
          <select class="cc-inp sm" id="acTarget">${groups.map((g, gi) => `<option value="${gi}" ${gi === groups.length - 1 ? 'selected' : ''}>מצב ${gi + 1}</option>`).join('')}</select></label>` : ''}
        <div class="ac-add-btns">
          <button class="btn sm primary" id="acAddAnd">${ic('plus')} וגם <small>גם התנאי הזה חייב להתקיים</small></button>
          <button class="btn sm" id="acAddOr">${ic('plus')} או <small>מצב חלופי — מספיק שהוא יתקיים</small></button>
        </div>`
      : `<div class="ac-add-btns">
          <button class="btn sm primary" id="acAddAnd">${ic('plus')} הוסף תנאי</button>
        </div>`}
    </div>
    <p class="cr-hint">${ic('bolt')} <b>וגם</b> = כל התנאים במצב חייבים להתקיים · <b>או</b> = מספיק שמצב אחד מתקיים.</p>`;
}
function autoCondValHTML(f) {
  if (f.num) return `<input class="cc-inp sm" type="number" id="acVal" placeholder="0">`;
  const opts = autoFieldOpts(f);
  return `<select class="cc-inp sm" id="acVal">${opts.map(o => `<option value="${esc(o)}">${esc(f.fmt ? f.fmt(o) : o)}</option>`).join('')}</select>`;
}
function autoCondBind(key, rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const fs = $('#acField');
  if (fs) fs.addEventListener('change', () => { const w = $('#acValWrap'); if (w) w.innerHTML = autoCondValHTML(autoFieldOf(fs.value)); });
  const read = () => {
    const f = ($('#acField') || {}).value, o = ($('#acOp') || {}).value, v = ($('#acVal') || {}).value;
    if (v === undefined || v === '') { toast('נא לבחור ערך'); return null; }
    return { f: f, o: o, v: v };
  };
  const and = $('#acAddAnd'); if (and) and.addEventListener('click', () => {
    const d = read(); if (!d) return;
    const t = $('#acTarget');
    autoCondAdd(key, d.f, d.o, d.v, t ? +t.value : undefined); RR();
  });
  const or = $('#acAddOr'); if (or) or.addEventListener('click', () => {
    const d = read(); if (!d) return;
    autoCondAddGroup(key, d.f, d.o, d.v); RR();
  });
  $$('[data-acdel]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.acdel.split('|'); autoCondDel(key, +p[0], +p[1]); RR();
  }));
}
/* שרשור — חיפוש ובחירה במקום רשימה ארוכה */
let autoChainQ = '';
function autoChainPanelHTML(key) {
  const chain = autoChainOf(key);
  const q = (autoChainQ || '').trim();
  const opts = (typeof autoAll === 'function' ? autoAll() : [])
    .filter(a => a.key !== key && chain.indexOf(a.key) < 0)
    .filter(a => !q || (a.title + ' ' + a.trigger).indexOf(q) >= 0).slice(0, 6);
  return `${chain.length ? `<div class="ar-conds">${chain.map(k => { const d = autoDef(k);
      return `<span class="ar-cond chain">${esc(d ? d.title : k)}<button data-acunchain="${esc(k)}" title="הסר">${ic('close')}</button></span>`; }).join('')}</div>` : ''}
    <div class="ac-pick">
      <span class="ap-search sm">${ic('search')}<input id="acChainQ" placeholder="הקלד לחיפוש חוק…" value="${esc(autoChainQ)}"></span>
      ${opts.length ? `<div class="ac-opts">${opts.map(a => `<button class="ac-opt" data-acchain="${esc(a.key)}">
          <b>${esc(a.title)}</b><small>${esc(a.trigger)}</small>${ic('plus')}</button>`).join('')}</div>`
        : `<p class="cr-hint">${ic('alert')} ${q ? 'אין תוצאה לחיפוש' : 'כל החוקים כבר משורשרים'}</p>`}
    </div>
    ${chain.length ? `<p class="cr-hint">${ic('bolt')} אחרי הצלחה יורצו לפי הסדר — גם אם הם כבויים.</p>` : ''}`;
}
function autoChainBind(key, rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  const q = $('#acChainQ'); if (q) q.addEventListener('input', () => { autoChainQ = q.value; RR();
    const el = $('#acChainQ'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  $$('[data-acchain]').forEach(b => b.addEventListener('click', () => { autoChainToggle(key, b.dataset.acchain); autoChainQ = ''; RR(); }));
  $$('[data-acunchain]').forEach(b => b.addEventListener('click', () => { autoChainToggle(key, b.dataset.acunchain); RR(); }));
}
/* סטטיסטיקות — מקטע "מידע נוסף" */
function autoStatsHTML(key) {
  const st = autoStat(key);
  const runs = (typeof AUTO_LOG !== 'undefined') ? AUTO_LOG.filter(l => l.key === key).slice(0, 5) : [];
  return `<div class="ap-stats">
      <span class="ap-st"><b>${st.runs}</b><small>הרצות</small></span>
      <span class="ap-st ok"><b>${st.ok}</b><small>הצליחו</small></span>
      <span class="ap-st fail"><b>${st.fail}</b><small>נכשלו</small></span>
      <span class="ap-st blk"><b>${st.blocked}</b><small>נחסמו</small></span>
    </div>
    <div class="ai-runs"><b>${ic('history')} הרצות אחרונות</b>
      ${runs.length ? runs.map(l => `<div class="ai-run"><span>${esc(l.at)}</span> ${esc(l.what)}</div>`).join('')
        : '<small class="muted">טרם רץ</small>'}</div>`;
}
