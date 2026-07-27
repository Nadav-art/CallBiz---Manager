/* ============================================================
   מערכת חוזים — מודול עצמאי ונתיק
   ------------------------------------------------------------
   • בניית תבניות חוזה (טקסט שעבר אישור משפטי) + חותמת חברה
   • שליחה לחתימה מתוך ליד — מיזוג נתוני הליד לתוך התבנית
   • פופ-אפ תצוגה מקדימה (איך הלקוח יראה) לפני שליחה
   • חיווי "לייב" של השלב שבו הלקוח נמצא בקישור
   • חתימה דיגיטלית (pad) — UI מוכן לחיבור לשירות חתימה חוקית בהשקה
   ============================================================ */
const CONTRACT_TYPES = ['הסכם התקשרות', 'הסכם שירות', 'כתב הסכמה / ויתור', 'הסכם מנוי חודשי', 'הצעת מחיר מחייבת'];
/* שלבי הלקוח בקישור החתימה (חיווי לייב) */
const CONTRACT_STAGES = [
  { key: 'open', label: 'נכנס לקישור', icon: 'eye' },
  { key: 'identity', label: 'אימות זהות', icon: 'lock', secure: true },
  { key: 'details', label: 'מילוי פרטים אישיים', icon: 'user', secure: true },
  { key: 'read', label: 'קריאת ההסכם', icon: 'docs' },
  { key: 'sign', label: 'חתימה דיגיטלית', icon: 'check', secure: true },
  { key: 'done', label: 'הושלם', icon: 'check' },
];
let CONTRACT_TEMPLATES = [
  { id: 'c1', name: 'הסכם התקשרות סטנדרטי', type: 'הסכם התקשרות', audience: 'client', legalApproved: true, requireSignature: true, requireId: true, stamp: null,
    text: 'הסכם התקשרות\n\nבין: {שם_עסק}\nלבין: {שם_לקוח} · ת.ז {ת.ז}\n\nהלקוח מזמין את השירות {שירות} בעלות של {סכום} ₪.\nמועד: {מועד}.\n\nתנאי התקשרות מלאים אושרו על ידי היועץ המשפטי.\n\nחתימת הלקוח מהווה הסכמה לכלל התנאים.' },
  { id: 'c2', name: 'הסכם מנוי חודשי', type: 'הסכם מנוי חודשי', audience: 'client', legalApproved: true, requireSignature: true, requireId: false, stamp: null,
    text: 'הסכם מנוי\n\n{שם_לקוח} מצטרף/ת למנוי חודשי בעלות {סכום} ₪ לחודש.\nהמנוי מתחדש אוטומטית וניתן לביטול בהתראה של 30 יום.' },
  { id: 'e1', name: 'הסכם העסקה סטנדרטי', type: 'הסכם העסקה', audience: 'employee', legalApproved: true, requireSignature: true, requireId: true, stamp: null,
    text: 'הסכם העסקה\n\nבין: {שם_עסק} (להלן: "המעסיק")\nלבין: {שם_עובד} · ת.ז {ת.ז_עובד} (להלן: "העובד")\n\n1. תפקיד: {תפקיד} במחלקת {מחלקה}, בסניף {סניף}.\n2. סוג העסקה: {סוג_העסקה} · היקף משרה: {היקף_משרה}%.\n3. תחילת עבודה: {תחילת_עבודה}.\n4. כפיפות: העובד יהיה כפוף ל{מנהל_ישיר}.\n5. סודיות: העובד מתחייב לשמור על סודיות מלאה של כל מידע שיגיע אליו במסגרת תפקידו.\n6. תנאי השכר והזכויות הסוציאליות מפורטים בנספח השכר.\n\nחתימת העובד מהווה הסכמה לכלל התנאים.' },
  { id: 'e2', name: 'הסכם סודיות (NDA)', type: 'הסכם סודיות (NDA)', audience: 'employee', legalApproved: true, requireSignature: true, requireId: false, stamp: null,
    text: 'הסכם סודיות\n\n{שם_עובד}, ת.ז {ת.ז_עובד}, בתפקיד {תפקיד} ב{שם_עסק}, מתחייב/ת בזאת:\n\n1. לשמור בסודיות מוחלטת על כל מידע עסקי, מסחרי ואישי של החברה ולקוחותיה.\n2. לא לעשות שימוש במידע שלא לצורך ביצוע התפקיד.\n3. להשיב כל חומר, מסמך וציוד בסיום ההעסקה.\n\nהתחייבות זו תעמוד בתוקפה גם לאחר סיום ההעסקה.' },
];
let contractDraft = null, contractEditId = null;
let ctAud = 'client';   // קהל התבניות המוצג: client / employee (לפי הרשאות)
function contractById(id) { return CONTRACT_TEMPLATES.find(c => c.id === id); }

/* ---------------- מסך ניהול החוזים ---------------- */
function renderContractsView() {
  /* הגנת הרשאות: אם הקהל הנוכחי אינו מורשה למשתמש — חזרה לקהל הראשון המותר */
  if (typeof ctVisibleAudiences === 'function') {
    const av = ctVisibleAudiences().map(a => a.key);
    if (av.length && av.indexOf(ctAud) < 0) ctAud = av[0];
  }
  $('#viewHost').innerHTML = `
    <div class="view-head">
      <div class="vh-title"><span class="num">${ic('docs')}</span> מערכת חוזים · <span class="muted">תבניות, חתימה דיגיטלית ומעקב חי</span></div>
    </div>
    ${(() => { const auds = (typeof ctVisibleAudiences === 'function') ? ctVisibleAudiences() : [];
      if (auds.length < 2) return '';
      return `<div class="ct-aud-tabs">${auds.map(a => `<button class="ct-aud ${ctAud === a.key ? 'on' : ''}" data-ctaud="${a.key}">
        ${ic(a.icon)}<span class="ca-t"><b>${a.label}</b><small>${a.desc}</small></span></button>`).join('')}</div>`;
    })()}
    <div class="view-head-sub">
      <div class="vhs-title">${ic('docs')} ${ctAud === 'employee' ? 'תבניות הסכם העסקה' : 'תבניות חוזה לקוחות'} <span class="muted" style="font-size:12px">· ${ctAud === 'employee' ? 'מופק מתיק העובד (HR) · משתני עובד' : 'מופק מתוך הליד · משתני לקוח'} · חתימה דיגיטלית</span></div>
      <span class="vhs-btns">
        ${ctAud === 'employee' ? '' : `<button class="btn sm" id="ctSvcTerms">${ic('docs')} תנאים קבועים בהסכם</button>`}
        <button class="btn sm primary" id="ctAdd">${ic('plus')} תבנית ${ctAud === 'employee' ? 'העסקה' : 'חוזה'} חדשה</button>
      </span>
    </div>
    <div class="ct-grid">
      ${(typeof ctTemplatesFor === 'function' ? ctTemplatesFor(ctAud) : CONTRACT_TEMPLATES).map(c => `<section class="card ct-card">
        <div class="ct-card-head">
          <div class="ct-ic">${ic('docs')}</div>
          <div class="ct-meta"><b>${esc(c.name)}</b><small>${esc(c.type)}</small></div>
          ${c.legalApproved ? `<span class="badge green sm">${ic('check')} אושר משפטית</span>` : `<span class="badge amber sm">טרם אושר</span>`}
        </div>
        <div class="ct-flags">
          ${c.requireSignature ? `<span class="ct-flag">${ic('check')} חתימה דיגיטלית</span>` : ''}
          ${c.requireId ? `<span class="ct-flag">${ic('lock')} אימות ת.ז</span>` : ''}
          ${c.reqStamp ? `<span class="ct-flag">${ic('org')} חותמת מהלקוח</span>` : (c.stamp ? `<span class="ct-flag">${ic('org')} חותמת חברה</span>` : '')}
        </div>
        <div class="ct-preview-text">${esc(c.text).slice(0, 120)}…</div>
        <div class="ct-card-actions">
          <button class="btn xs" data-ctedit="${c.id}">${ic('settings')} עריכה</button>
          <button class="btn xs" data-ctpreview="${c.id}">${ic('eye')} תצוגה מקדימה</button>
        </div>
      </section>`).join('')}
      <section class="card ct-card ct-add" id="ctAdd2"><div class="ct-add-inner">${ic('plus')}<b>תבנית חדשה</b></div></section>
    </div>
    <p class="hint" style="margin-top:16px">${ic('alert')} ${ctAud === 'employee'
      ? 'הפקת הסכם העסקה מתבצעת <b>מתוך תיק העובד</b> (הרשאות › ניהול עובדים · HR › מסמכי עובד) — כדי למזג את נתוני העובד לתוך ההסכם.'
      : 'שליחת הסכם לחתימה מתבצעת <b>מתוך הליד</b> בלבד (פעולה "הפק הסכם") — כדי למזג את נתוני הלקוח שנסגרו לתוך ההסכם.'}</p>
    ${typeof ctRegistryCardHTML === 'function' ? ctRegistryCardHTML() : ''}
    ${ctVarsCardHTML()}`;
  $$('[data-ctaud]').forEach(b => b.addEventListener('click', () => { ctAud = b.dataset.ctaud; renderContractsView(); }));
  if (typeof bindCtRegistry === 'function') bindCtRegistry();
  bindCtVarsCard();
  const cst = $('#ctSvcTerms'); if (cst) cst.addEventListener('click', () => { if (typeof openSvcTermsPanel === 'function') openSvcTermsPanel(); });
  $('#ctAdd').addEventListener('click', () => openContractEditor(null));
  $('#ctAdd2').addEventListener('click', () => openContractEditor(null));
  $$('[data-ctedit]').forEach(b => b.addEventListener('click', () => openContractEditor(b.dataset.ctedit)));
  $$('[data-ctpreview]').forEach(b => b.addEventListener('click', () => { const c = contractById(b.dataset.ctpreview); if (typeof openContractWizard === 'function') openContractWizard(c, null, 'preview'); else openContractPreview(c, null); }));
}

/* ---------------- עורך תבנית ---------------- */
function openContractEditor(id) {
  const isNew = !id || !contractById(id);
  const isEmp = ctAud === 'employee';
  const typeList = isEmp && typeof CT_EMPLOYEE_TYPES !== 'undefined' ? CT_EMPLOYEE_TYPES : CONTRACT_TYPES;
  const c = isNew ? { id: 'c' + (CONTRACT_TEMPLATES.length + 1) + '_' + CONTRACT_TEMPLATES.length, name: '', type: typeList[0], audience: ctAud, legalApproved: false, requireSignature: true, requireId: true, stamp: null, text: '' } : contractById(id);
  contractDraft = Object.assign({}, c); contractEditId = isNew ? null : id;
  const render = () => {
    $('#modal').style.maxWidth = '620px'; $('#modal').style.height = '';
    $('#modal').innerHTML = `
      <div class="modal-head"><div class="title"><span class="num">${ic(isNew ? 'plus' : 'docs')}</span> ${isNew ? 'תבנית חוזה חדשה' : esc(contractDraft.name || 'עריכת תבנית')}</div>
        <button class="close-btn" id="closeModal">${ic('close')}</button></div>
      <div class="modal-body ct-edit">
        <div class="cat-edit-row">
          <div class="field"><label>שם התבנית *</label><input class="cc-inp" id="ctName" value="${esc(contractDraft.name)}" placeholder="למשל: הסכם התקשרות סטנדרטי"></div>
          <div class="field"><label>סוג הסכם</label><select class="cc-inp" id="ctType">${typeList.map(t => `<option ${contractDraft.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>נוסח ההסכם <small class="muted">— לחץ על משתנה כדי להוסיף אותו במקום הסמן (בלי להקליד)</small></label>
          <div class="var-palette">
            ${Object.keys(isEmp && typeof CONTRACT_EMP_VARS !== 'undefined' ? CONTRACT_EMP_VARS : CONTRACT_VARS).map(v => { const s = isEmp ? ctEmpSourceOf(CONTRACT_EMP_VARS[v]) : ctSourceOf(CONTRACT_VARS[v]);
              return `<button type="button" class="var-chip" data-varins="${esc(v)}" title="${s ? 'נשאב מ: ' + esc(s.label) : ''}">${esc(v)}</button>`; }).join('')}
            <span class="var-hint">${ic('bolt')} המשתנים מוחלפים אוטומטית בנתוני הליד</span>
          </div>
          <textarea class="cc-inp ct-text" id="ctText" rows="9" placeholder="הדבק כאן את נוסח ההסכם שעבר אישור משפטי…">${esc(contractDraft.text)}</textarea>
          <div class="var-preview-bar">
            <button type="button" class="btn xs" id="ctVarPrev">${ic('eye')} ${contractDraft._showPrev ? 'הסתר תצוגת נתונים' : 'הצג עם נתונים אמיתיים'}</button>
            <span class="muted" style="font-size:11px">${isEmp ? ((typeof STAFF !== 'undefined' && STAFF[0]) ? 'לדוגמה לפי העובד: ' + esc(STAFF[0].name) : '') : ((typeof RECORDS !== 'undefined' && RECORDS[0]) ? 'לדוגמה לפי הליד: ' + esc(RECORDS[0].name) : '')}</span>
          </div>
          ${contractDraft._showPrev ? `<pre class="var-preview">${esc(isEmp ? contractMergeEmp(contractDraft.text, (typeof STAFF !== 'undefined') ? STAFF[0] : null) : contractMerge(contractDraft.text, (typeof RECORDS !== 'undefined') ? RECORDS[0] : null))}</pre>` : ''}
        </div>
        <label class="cfg-row hl"><span>${ic('check')} עבר אישור משפטי<small>רק תבניות מאושרות ניתנות לשליחה</small></span><input type="checkbox" id="ctLegal" ${contractDraft.legalApproved ? 'checked' : ''}></label>
        <label class="cfg-row"><span>${ic('check')} דורש חתימה דיגיטלית</span><input type="checkbox" id="ctSig" ${contractDraft.requireSignature ? 'checked' : ''}></label>
        <label class="cfg-row"><span>${ic('lock')} דורש אימות ת.ז (אבטחת פרטים)</span><input type="checkbox" id="ctId" ${contractDraft.requireId ? 'checked' : ''}></label>
        <div class="ct-terms-link">${ic('docs')} <b>תנאים קבועים בהסכם</b>
          <small>ביטול, אחריות, איחור — מוגדרים פעם אחת ונכנסים לכל ההסכמים, לא רק לתבנית הזו.</small>
          <button class="btn xs" type="button" id="ctOpenTerms">פתח</button></div>
        <label class="cfg-row"><span>${ic('org')} לבקש חותמת חברה מהלקוח<small>תופיע בטופס החתימה רק אם הלקוח יסמן שהוא חברה בע״מ</small></span><input type="checkbox" id="ctStampReq" ${contractDraft.reqStamp ? 'checked' : ''}></label>
        ${contractDraft.stamp ? `<div class="field"><label>${ic('org')} חותמת שהועלתה בעבר</label>
          <div class="ct-stamp-row"><div class="ct-stamp-prev has"><img src="${contractDraft.stamp}" alt="חותמת"></div>
          <button class="btn sm" id="ctStampDel">${ic('close')} הסר</button></div></div>` : ''}
      </div>
      <div class="modal-foot"><button class="btn ghost" id="ctPrevBtn">${ic('eye')} תצוגה מקדימה</button>
        <button class="btn primary" id="ctSave">${ic('check')} ${isNew ? 'צור תבנית' : 'שמור'}</button></div>`;
    $('#closeModal').addEventListener('click', closeModal);
    const sync = () => { contractDraft.name = $('#ctName').value; contractDraft.type = $('#ctType').value; contractDraft.text = $('#ctText').value; contractDraft.legalApproved = $('#ctLegal').checked; contractDraft.requireSignature = $('#ctSig').checked; contractDraft.requireId = $('#ctId').checked;
      const sr = $('#ctStampReq'); if (sr) contractDraft.reqStamp = sr.checked; };
    const ot = $('#ctOpenTerms'); if (ot) ot.addEventListener('click', () => { if (typeof openSvcTermsPanel === 'function') openSvcTermsPanel(); });
    const sr0 = $('#ctStampReq'); if (sr0) sr0.addEventListener('change', () => { sync(); });
    const sd = $('#ctStampDel'); if (sd) sd.addEventListener('click', () => { sync(); contractDraft.stamp = null; render(); });
    // הוספת משתנה במקום הסמן — בלי הקלדה
    $$('[data-varins]').forEach(b => b.addEventListener('click', () => {
      const ta = $('#ctText'), v = b.dataset.varins; if (!ta) return;
      const st = ta.selectionStart || 0, en = ta.selectionEnd || 0;
      ta.value = ta.value.slice(0, st) + v + ta.value.slice(en);
      contractDraft.text = ta.value;
      ta.focus(); ta.selectionStart = ta.selectionEnd = st + v.length;
      if (contractDraft._showPrev) { sync(); render(); }
    }));
    const vp = $('#ctVarPrev'); if (vp) vp.addEventListener('click', () => { sync(); contractDraft._showPrev = !contractDraft._showPrev; render(); });
    $('#ctPrevBtn').addEventListener('click', () => { sync(); openContractPreview(contractDraft, null); });
    $('#ctSave').addEventListener('click', () => {
      sync();
      if (!(contractDraft.name || '').trim()) { toast('נא להזין שם תבנית'); return; }
      if (!(contractDraft.text || '').trim()) { toast('נא להזין נוסח הסכם'); return; }
      if (contractEditId != null) { Object.assign(contractById(contractEditId), contractDraft); toast('התבנית עודכנה ✓'); }
      else { contractDraft.id = 'c' + Date.now(); CONTRACT_TEMPLATES.push(Object.assign({}, contractDraft)); toast('התבנית נוצרה ✓'); }
      closeModal(); renderContractsView();
    });
  };
  render();
  $('#modalWrap').classList.add('open');
}

/* ---------------- משתני הסכם: מיפוי חיצוני להגדרות (מאיזה שדה לשאוב) ----------------
   כל משתין בנוסח ההסכם ממופה לשדה מקור בליד. המנהל יכול לשנות את המיפוי בהגדרות. */
const CONTRACT_FIELD_SOURCES = [
  { key: 'name', label: 'שם הלקוח', get: r => r && r.name },
  { key: 'org', label: 'שם החברה / ארגון', get: r => r && (r.org || r.name) },
  { key: 'idnum', label: 'ת.ז / ח.פ', get: r => r && r.idnum },
  { key: 'phone', label: 'טלפון', get: r => r && r.phone },
  { key: 'mail', label: 'דוא״ל', get: r => r && r.mail },
  { key: 'subject', label: 'נושא הפנייה', get: r => r && r.subject },
  { key: 'services', label: 'שירותים נבחרים (קטלוג)', get: r => (r && r.services && r.services.length && typeof cTreat === 'function') ? r.services.map(k => (cTreat(k) ? cTreat(k).label : k)).join(', ') : '' },
  { key: 'price', label: 'סה״כ מחיר (מהקטלוג)', get: r => (r && r.services && typeof svcTotals === 'function') ? svcTotals(r.services).price : '' },
  { key: 'deposit', label: 'מקדמה (מהקטלוג)', get: r => (r && r.services && typeof svcTotals === 'function') ? svcTotals(r.services).deposit : '' },
  { key: 'meeting', label: 'מועד הפגישה/התור', get: r => (r && r.meeting) ? (r.meeting.date + ' ' + r.meeting.time) : '' },
  { key: 'addr', label: 'כתובת הלקוח', get: r => (typeof leadAddrText === 'function') ? leadAddrText(r) : '' },
  { key: 'assignee', label: 'גורם מטפל', get: r => r && r.assignee },
  { key: 'source', label: 'מקור הפנייה', get: r => r && r.source },
  { key: 'business', label: 'שם העסק שלי (קבוע)', get: () => 'CallBiz' },
];
const CONTRACT_VARS_DEFAULT = {
  '{שם_לקוח}': 'name', '{שם_חברה}': 'org', '{ת.ז}': 'idnum', '{טלפון}': 'phone', '{דואל}': 'mail',
  '{שירות}': 'services', '{סכום}': 'price', '{מקדמה}': 'deposit', '{מועד}': 'meeting',
  '{כתובת}': 'addr', '{נציג}': 'assignee', '{שם_עסק}': 'business',
};
let CONTRACT_VARS = (function () { try { return Object.assign({}, CONTRACT_VARS_DEFAULT, JSON.parse(localStorage.getItem('cb_ctVars')) || {}); } catch (e) { return Object.assign({}, CONTRACT_VARS_DEFAULT); } })();
function ctVarsSave() { try { localStorage.setItem('cb_ctVars', JSON.stringify(CONTRACT_VARS)); } catch (e) {} }
function ctSourceOf(key) { return CONTRACT_FIELD_SOURCES.find(s => s.key === key); }
/* ---------------- מיזוג נתוני ליד לתוך נוסח (לפי המיפוי) ---------------- */
function contractMerge(text, lead) {
  return (text || '').replace(/\{[^}]+\}/g, m => {
    const srcKey = CONTRACT_VARS[m]; if (!srcKey) return m;
    const src = ctSourceOf(srcKey); if (!src) return m;
    const v = src.get(lead);
    return (v === undefined || v === null || v === '') ? '________' : String(v);
  });
}

/* ---------------- תצוגה מקדימה (איך הלקוח יראה) ---------------- */
function openContractPreview(c, lead) {
  if (!c) return;
  const old = document.getElementById('ctPrevWrap'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'ct-modal-wrap'; w.id = 'ctPrevWrap';
  w.innerHTML = `<div class="ct-modal">
      <div class="ct-modal-head"><div><b>${ic('eye')} כך הלקוח יראה את ההסכם</b><small>תצוגה מקדימה · ${esc(c.name)}</small></div>
        <button class="close-btn" id="ctPrevClose">${ic('close')}</button></div>
      <div class="ct-client-view">
        <div class="ctv-doc">
          <div class="ctv-brand">${ic('org')} CallBiz · ${esc(c.type)}</div>
          <pre class="ctv-text">${esc(contractMerge(c.text, lead))}</pre>
          ${c.stamp ? `<div class="ctv-stamp"><img src="${c.stamp}" alt="חותמת חברה"><small>חותמת החברה</small></div>` : ''}
          ${c.requireSignature ? `<div class="ctv-sign">
            <label>חתימת הלקוח (חתימה דיגיטלית מאושרת):</label>
            <canvas class="ctv-canvas" width="440" height="120"></canvas>
            <div class="ctv-sign-actions"><button class="btn xs" id="ctSigClear">${ic('close')} נקה</button>
              <span class="ctv-legal">${ic('lock')} חתימה זו קבילה משפטית לפי חוק חתימה אלקטרונית</span></div>
          </div>` : ''}
        </div>
      </div>
      <div class="ct-modal-foot"><button class="btn ghost" id="ctPrevClose2">סגור</button>
        ${lead ? `<button class="btn primary" id="ctPrevSend">${ic('mail')} שלח ל${esc(lead.name)}</button>` : ''}</div>
    </div>`;
  document.body.appendChild(w);
  requestAnimationFrame(() => w.classList.add('open'));
  const close = () => w.remove();
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#ctPrevClose').addEventListener('click', close);
  $('#ctPrevClose2').addEventListener('click', close);
  const ps = $('#ctPrevSend'); if (ps) ps.addEventListener('click', () => { close(); openContractSend(c, lead); });
  ctInitSignature(w);
}
/* חתימה על קנבס (עכבר/מגע) */
function ctInitSignature(root) {
  const cv = root.querySelector('.ctv-canvas'); if (!cv) return;
  const ctx = cv.getContext('2d'); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1E2233';
  let drawing = false, last = null;
  const pos = e => { const r = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  const start = e => { drawing = true; last = pos(e); e.preventDefault(); };
  const move = e => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; e.preventDefault(); };
  const end = () => { drawing = false; };
  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  cv.addEventListener('touchstart', start); cv.addEventListener('touchmove', move); cv.addEventListener('touchend', end);
  const clr = root.querySelector('#ctSigClear'); if (clr) clr.addEventListener('click', () => ctx.clearRect(0, 0, cv.width, cv.height));
}

/* ---------------- שליחה לחתימה + חיווי לייב ---------------- */
let ctLiveTimer = null;
function openContractSend(c, lead) {
  if (!c) return;
  if (!c.legalApproved) { toast('לא ניתן לשלוח — התבנית טרם אושרה משפטית'); return; }
  const old = document.getElementById('ctSendWrap'); if (old) old.remove();
  let stageIdx = 0;
  const w = document.createElement('div'); w.className = 'ct-modal-wrap'; w.id = 'ctSendWrap';
  const render = () => {
    w.innerHTML = `<div class="ct-modal ct-send-modal">
      <div class="ct-modal-head"><div><b>${ic('mail')} שליחת הסכם לחתימה</b><small>${esc(c.name)} ${lead ? '· ' + esc(lead.name) : ''}</small></div>
        <button class="close-btn" id="ctSendClose">${ic('close')}</button></div>
      <div class="ct-send-body">
        <div class="ct-send-side">
          <div class="ct-send-doc">
            <pre class="ctv-text sm">${esc(contractMerge(c.text, lead).slice(0, 260))}…</pre>
            ${c.stamp ? `<div class="ctv-stamp sm"><img src="${c.stamp}" alt="חותמת"></div>` : ''}
          </div>
        </div>
        <div class="ct-live">
          <div class="ct-live-head">${stageIdx > 0 ? `<span class="ct-live-dot"></span> חי — הלקוח בקישור` : 'ממתין לכניסת הלקוח'}</div>
          <div class="ct-stages">
            ${CONTRACT_STAGES.map((s, i) => `<div class="ct-stage ${i < stageIdx ? 'done' : ''} ${i === stageIdx && stageIdx > 0 ? 'active' : ''}">
              <span class="ct-stage-ic">${i < stageIdx ? ic('check') : ic(s.icon)}</span>
              <span class="ct-stage-lbl">${s.label}${s.secure ? ` <span class="ct-secure" title="מאובטח">${ic('lock')}</span>` : ''}</span></div>`).join('')}
          </div>
          <p class="hint" style="margin-top:10px">${ic('lock')} השלבים המסומנים מאובטחים (אימות זהות, פרטים אישיים, חתימה) לפי דרישות אבטחת מידע.</p>
        </div>
      </div>
      <div class="ct-modal-foot">
        <button class="btn ghost" id="ctSendClose2">סגור</button>
        ${stageIdx === 0 ? `<button class="btn primary" id="ctSendGo">${ic('mail')} שלח קישור חתימה ${lead ? 'ל' + esc(lead.name) : ''}</button>`
          : stageIdx >= CONTRACT_STAGES.length - 1 ? `<span class="ct-done-badge">${ic('check')} ההסכם נחתם והושלם</span>` : `<span class="muted">${ic('eye')} עוקב אחר התקדמות הלקוח בזמן אמת…</span>`}
      </div>
    </div>`;
    $('#ctSendClose').addEventListener('click', closeSend);
    $('#ctSendClose2').addEventListener('click', closeSend);
    const go = $('#ctSendGo'); if (go) go.addEventListener('click', () => {
      toast(`קישור חתימה נשלח${lead ? ' ל' + lead.name : ''} · מעקב חי החל`);
      stageIdx = 1; render(); advance();
    });
  };
  const advance = () => {
    clearTimeout(ctLiveTimer);
    if (stageIdx >= CONTRACT_STAGES.length - 1) return;
    ctLiveTimer = setTimeout(() => { stageIdx++; render(); advance(); }, 1600);   // סימולציית לייב של התקדמות הלקוח
  };
  const closeSend = () => { clearTimeout(ctLiveTimer); w.remove(); };
  document.body.appendChild(w); render();
  requestAnimationFrame(() => w.classList.add('open'));
  w.addEventListener('mousedown', e => { if (e.target === w) closeSend(); });
}
/* נקודת כניסה מתוך ליד — בחירת תבנית ושליחה עם מיזוג נתוני הליד */
function openContractForLead(lead) {
  const approved = CONTRACT_TEMPLATES.filter(c => c.legalApproved);
  if (!approved.length) { toast('אין תבניות מאושרות — צור תבנית במערכת החוזים'); return; }
  // בחירת תבנית מהירה
  const old = document.getElementById('ctPickWrap'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'ctPickWrap';
  w.innerHTML = `<div class="cbc-box" style="max-width:420px;text-align:start">
    <div class="cbc-head"><span class="cbc-ic">${ic('docs')}</span><b>שליחת הסכם ל${esc(lead.name)}</b></div>
    <div class="ct-pick-list">${approved.map(c => `<button class="ct-pick" data-ctpick="${c.id}">${ic('docs')} <b>${esc(c.name)}</b><small>${esc(c.type)}</small></button>`).join('')}</div>
    <div class="cbc-actions"><button class="btn ghost" id="ctPickCancel">ביטול</button></div></div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('open'));
  const close = () => w.remove();
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#ctPickCancel').addEventListener('click', close);
  $$('[data-ctpick]', w).forEach(b => b.addEventListener('click', () => { const c = contractById(b.dataset.ctpick); close(); if (typeof openContractWizard === 'function') openContractWizard(c, lead, 'preview'); else openContractPreview(c, lead); }));
}

/* ---------------- הגדרות: מיפוי משתני הסכם לשדות מקור ---------------- */
let ctVarNewOpen = false;
/* הקשר המשתנים לפי הקהל הנבחר — לקוח (מהליד) או עובד (מתיק ה-HR) */
function ctVarCtx() {
  const isEmp = (typeof ctAud !== 'undefined' && ctAud === 'employee' && typeof CONTRACT_EMP_VARS !== 'undefined');
  if (isEmp) {
    const smp = (typeof STAFF !== 'undefined' && STAFF[0]) ? ((typeof hrOf === 'function') ? (hrOf(STAFF[0]), STAFF[0]) : STAFF[0]) : null;
    return { emp: true, vars: CONTRACT_EMP_VARS, defs: CONTRACT_EMP_VARS_DEFAULT, srcs: CONTRACT_EMP_SOURCES,
      save: ctEmpVarsSave, sourceOf: ctEmpSourceOf, sample: smp, first: 'empName',
      title: 'משתני הסכם העסקה · מאיזה שדה בתיק העובד לשאוב', sampleCol: 'דוגמה מהעובד הראשון',
      ph: '{מספר_עובד}', hint: 'המשתנים נשאבים מתיק העובד (HR) בעת הפקת הסכם ההעסקה. שינוי המיפוי כאן חל על כל תבניות ההעסקה.' };
  }
  return { emp: false, vars: CONTRACT_VARS, defs: CONTRACT_VARS_DEFAULT, srcs: CONTRACT_FIELD_SOURCES,
    save: ctVarsSave, sourceOf: ctSourceOf, sample: (typeof RECORDS !== 'undefined' ? RECORDS[0] : null), first: 'name',
    title: 'משתני הסכם · מאיזה שדה לשאוב', sampleCol: 'דוגמה מהליד הנוכחי',
    ph: '{מספר_לקוח}', hint: 'המשתנים מוחלפים אוטומטית בעת הפקת ההסכם. שינוי המיפוי כאן חל על כל התבניות — כך שאין צורך לערוך נוסחים.' };
}
function ctVarsCardHTML() {
  const cx = ctVarCtx(), vars = Object.keys(cx.vars);
  return '<section class="card set-card wide ctv-card" style="margin-top:18px">' +
    '<div class="card-head"><div class="title">' + ic('settings') + ' ' + cx.title + '</div>' +
      '<button class="btn sm ' + (ctVarNewOpen ? '' : 'primary') + '" id="ctVarAdd">' + ic(ctVarNewOpen ? 'close' : 'plus') + ' ' + (ctVarNewOpen ? 'בטל' : 'הוסף משתנה') + '</button></div>' +
    '<div class="set-body">' +
    (ctVarNewOpen ? '<div class="nc-newbox"><div class="nc-new-row">' +
      '<label class="exf"><span>שם המשתנה (בסוגריים מסולסלים)</span><input class="cc-inp" id="ctVarName" placeholder="' + cx.ph + '"></label>' +
      '<label class="exf"><span>שדה מקור</span><select class="cc-inp" id="ctVarSrc">' + cx.srcs.map(function (s) { return '<option value="' + s.key + '">' + s.label + '</option>'; }).join('') + '</select></label>' +
      '</div><button class="btn sm primary" id="ctVarSave">' + ic('check') + ' הוסף</button></div>' : '') +
    '<div class="table-wrap"><table class="mini-table"><thead><tr><th>משתנה בנוסח</th><th>נשאב מהשדה</th><th>' + cx.sampleCol + '</th><th></th></tr></thead><tbody>' +
      vars.map(function (v) {
        const cur = cx.vars[v], src = cx.sourceOf(cur);
        let sample = ''; try { sample = (cx.sample && src) ? src.get(cx.sample) : ''; } catch (e) { sample = ''; }
        return '<tr><td><b dir="ltr">' + esc(v) + '</b></td>' +
          '<td><select class="cat-in sm" data-ctvar="' + esc(v) + '">' + cx.srcs.map(function (s) { return '<option value="' + s.key + '" ' + (cur === s.key ? 'selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select></td>' +
          '<td><small class="muted">' + esc(sample === '' || sample == null ? '— ריק' : String(sample)) + '</small></td>' +
          '<td>' + (cx.defs[v] ? '' : '<button class="whs-del" data-ctvardel="' + esc(v) + '" title="מחק">' + ic('close') + '</button>') + '</td></tr>';
      }).join('') +
    '</tbody></table></div>' +
    '<p class="hint" style="margin-top:10px">' + ic('alert') + ' ' + cx.hint + '</p>' +
    '</div></section>';
}
function bindCtVarsCard() {
  const cx = ctVarCtx();
  const ab = $('#ctVarAdd'); if (ab) ab.addEventListener('click', function () { ctVarNewOpen = !ctVarNewOpen; renderContractsView(); });
  const sv = $('#ctVarSave'); if (sv) sv.addEventListener('click', function () {
    let n = (($('#ctVarName') || {}).value || '').trim();
    if (!n) { toast('נא להזין שם משתנה'); return; }
    if (n[0] !== '{') n = '{' + n; if (n[n.length - 1] !== '}') n = n + '}';
    cx.vars[n] = (($('#ctVarSrc') || {}).value) || cx.first; cx.save();
    ctVarNewOpen = false; renderContractsView(); toast('המשתנה נוסף · ' + n);
  });
  $$('[data-ctvar]').forEach(function (sel) { sel.addEventListener('change', function () {
    cx.vars[sel.dataset.ctvar] = sel.value; cx.save(); renderContractsView(); toast('המיפוי עודכן');
  }); });
  $$('[data-ctvardel]').forEach(function (b) { b.addEventListener('click', function () {
    delete cx.vars[b.dataset.ctvardel]; cx.save(); renderContractsView(); toast('המשתנה נמחק');
  }); });
}
