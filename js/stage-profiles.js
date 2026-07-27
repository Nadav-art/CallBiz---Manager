/* ============================================================
   פרופיל שלבים — איזה שלב רלוונטי לאיזו עסקה (מודול עצמאי)
   ------------------------------------------------------------
   הבעיה: מסלול אחד מכיל את כל השלבים האפשריים, אבל לא כל לקוח/עסקה
   צריך את כולם — תיאום פגישה מול רכישה ישירה מול העברה למטפל אחר.
   הפתרון (3 שכבות, בסדר עדיפות):
     1) חסימת מנהל (פח)          — השלב לא קיים בכלל.
     2) כבוי כברירת מחדל (עין)    — קיים אך מוסתר עד הפעלה פרטנית בליד.
     3) **רלוונטיות אוטומטית**    — נגזרת מתצורת השירות שנבחר בקטלוג:
          requiresMeeting  → שלבי פגישה/תזכורות/ביצוע
          requiresBilling  → שלבי תשלום/מקדמה
          requiresContract → שלבי הסכם
        רכישת מוצר בלי פגישה תדלג אוטומטית על כל שלבי הפגישה.
     4) הפעלה פרטנית בליד (enableStages) גוברת על 2 ו-3.
   בעלות על שלב (stageOwner) מאפשרת להעביר שלב למטפל אחר בלי לפצל את הליד.
   ============================================================ */
const STAGE_REQ_TAGS = {
  /* שלבי פגישה — רלוונטיים רק אם השירות דורש פגישה */
  meeting: 'meeting', reminder: 'meeting', held: 'meeting', summary: 'meeting', confirm: 'meeting',
  schedule: 'meeting', offer: 'meeting', present: 'meeting', arrived: 'meeting',
  /* שלבי תשלום */
  deposit: 'billing', payment: 'billing', billing: 'billing',
  /* שלבי הסכם */
  contract: 'contract', sign: 'contract',
};
/* דריסות מנהל לפרופיל (איזה תג חל על שלב) — נשמר ב-localStorage */
let STAGE_TAG_OVERRIDES = (function () { try { return JSON.parse(localStorage.getItem('cb_stageTags')) || {}; } catch (e) { return {}; } })();
function stageTagSave() { try { localStorage.setItem('cb_stageTags', JSON.stringify(STAGE_TAG_OVERRIDES)); } catch (e) {} }
function stageTagOf(key) { return STAGE_TAG_OVERRIDES[key] !== undefined ? STAGE_TAG_OVERRIDES[key] : (STAGE_REQ_TAGS[key] || ''); }
function stageTagSet(key, tag) { STAGE_TAG_OVERRIDES[key] = tag; stageTagSave(); }

/* דרישות העסקה בפועל — נגזרות מהשירותים שנבחרו בליד */
function leadRequirements(r) {
  const svcs = (r && r.services) || [];
  if (!svcs.length) return { meeting: null, billing: null, contract: null };   // null = טרם נקבע → לא מסתירים כלום
  const list = svcs.map(function (k) { return (typeof cTreat === 'function') ? cTreat(k) : null; }).filter(Boolean);
  return {
    meeting: list.some(function (t) { return t.requiresMeeting; }),
    billing: list.some(function (t) { return t.requiresBilling; }),
    contract: list.some(function (t) { return t.requiresContract; }),
  };
}
/* האם השלב רלוונטי לעסקה הזו */
function stageRelevantFor(r, stageKey) {
  const tag = stageTagOf(stageKey);
  if (!tag) return true;                       // שלב ללא תג — תמיד רלוונטי
  const req = leadRequirements(r);
  const v = req[tag];
  if (v === null || v === undefined) return true;   // טרם נבחר שירות — לא מסתירים
  return !!v;
}
/* שלבים שהוסתרו אוטומטית (לחיווי "הוסתרו אוטומטית · הצג") */
function autoHiddenStages(r) {
  const enabled = (r && r.enableStages) || [];
  return (typeof workflowFor === 'function' ? workflowFor(r.journey) : []).filter(function (s) {
    if ((r.skipStages || []).indexOf(s.key) >= 0) return false;
    if (typeof stageIsBlocked === 'function' && stageIsBlocked(r.journey, s.key)) return false;
    if (enabled.indexOf(s.key) >= 0) return false;
    return !stageRelevantFor(r, s.key);
  });
}
/* פרופיל העסקה בשם קריא — לחיווי בליד */
function dealProfileLabel(r) {
  const req = leadRequirements(r);
  if (req.meeting === null) return '';
  const parts = [];
  parts.push(req.meeting ? 'תיאום פגישה' : 'רכישה ישירה');
  if (req.billing) parts.push('סליקה');
  if (req.contract) parts.push('הסכם');
  return parts.join(' + ');
}
/* חיווי בליד: פרופיל + שלבים שהוסתרו אוטומטית (עם אפשרות להציג) */
function dealProfileHTML(r) {
  const lbl = dealProfileLabel(r); if (!lbl) return '';
  const hid = autoHiddenStages(r);
  return '<div class="deal-profile">' +
    '<span class="dp-t">' + ic('bolt') + ' פרופיל העסקה: <b>' + esc(lbl) + '</b></span>' +
    (hid.length ? '<span class="dp-hid">' + hid.length + ' שלבים לא רלוונטיים הוסתרו' +
      '<button class="dp-show" data-dpshow>' + ic('eye') + ' הצג</button></span>' : '') +
  '</div>';
}
function bindDealProfile(r, after) {
  const b = $('[data-dpshow]'); if (!b) return;
  b.addEventListener('click', function () {
    r.enableStages = (r.enableStages || []).concat(autoHiddenStages(r).map(function (s) { return s.key; }));
    if (typeof after === 'function') after(); else if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
    toast('כל השלבים מוצגים לליד זה');
  });
}

/* ---------- העברת שלב למטפל אחר (בעלות פר-שלב) ---------- */
function stageOwnerOf(r, key) { return (r.stageOwners && r.stageOwners[key]) || null; }
function setStageOwner(r, key, staffId) { r.stageOwners = r.stageOwners || {}; if (staffId) r.stageOwners[key] = staffId; else delete r.stageOwners[key]; }
function stageOwnerName(r, key) {
  const id = stageOwnerOf(r, key); if (!id) return '';
  const st = (typeof STAFF !== 'undefined') ? STAFF.find(function (x) { return x.id === id; }) : null;
  return st ? st.name : '';
}
/* פופ-אפ העברת שלב */
function openStageOwnerPicker(r, key, after) {
  const old = document.getElementById('stageOwnerPop'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'stageOwnerPop';
  const cur = stageOwnerOf(r, key);
  const staff = (typeof STAFF !== 'undefined') ? STAFF : [];
  w.innerHTML = '<div class="cbc-box" style="max-width:420px;text-align:start">' +
    '<div class="cbc-head"><span class="cbc-ic">' + ic('user') + '</span><b>אחראי על השלב</b></div>' +
    '<p class="hint" style="margin:0 0 10px">' + ic('alert') + ' העברת השלב למטפל אחר — הליד נשאר אצל ' + esc(r.assignee || '') + ', והשלב הזה יופיע במשימות של מי שנבחר.</p>' +
    '<div class="so-list">' +
      '<button class="so-opt ' + (!cur ? 'on' : '') + '" data-so="">' + ic('user') + ' ' + esc(r.assignee || 'הגורם המטפל בליד') + ' <small>(ברירת מחדל)</small></button>' +
      staff.map(function (s) { return '<button class="so-opt ' + (cur === s.id ? 'on' : '') + '" data-so="' + s.id + '">' + ic('user') + ' ' + esc(s.name) + ' <small>' + esc(s.role) + '</small></button>'; }).join('') +
    '</div>' +
    '<div class="cbc-actions"><button class="btn ghost" id="soClose">סגור</button></div></div>';
  document.body.appendChild(w); requestAnimationFrame(function () { w.classList.add('open'); });
  $('#soClose').addEventListener('click', function () { w.remove(); });
  w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
  $$('[data-so]', w).forEach(function (b) { b.addEventListener('click', function () {
    setStageOwner(r, key, b.dataset.so || null);
    w.remove();
    const nm = stageOwnerName(r, key);
    toast(nm ? 'השלב הועבר ל' + nm : 'השלב חזר לגורם המטפל בליד');
    if (typeof after === 'function') after(); else if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
  }); });
}
