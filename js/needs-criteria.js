/* ============================================================
   רישום קריטריונים — מקור-אמת יחיד (מודול עצמאי)
   ------------------------------------------------------------
   ארכיטקטורה (בלי כפילויות):
   1) כל הקריטריונים מוגדרים **כאן בלבד** — במסך המנהל (הגדרות › שדות פנייה).
      לכל קריטריון: שם · אפשרויות (ערכים) · מקור מידע · מתי נשאל · חובה לפני תיאום.
   2) "מתי נשאל":
        always = תמיד נשאל בבירור צורך (גורף לכל השירותים)
        auto   = "רק אם רלוונטי" → נפתח **לשיוך פרטני בכרטיס השירות**;
                 נשאל רק אם השירות שנבחר שויך לקריטריון.
        never  = לא נשאל
   3) שיוך בכרטיס השירות (t.critKeys) → הקריטריון מופיע אוטומטית גם
      **בסניף** שמציע את השירות (בחירת הערכים הרלוונטיים לסניף).
   4) קריטריונים מובנים (branch/timeOfDay/gender/nearBranch) שואבים מהמערכת
      ולכן אין להם ערכים לעריכה — רק מתי נשאל/חובה.
   ============================================================ */
const NEEDS_BUILTIN = [
  { key: 'branch', label: 'סניף / אזור מועדף', src: 'סניפים פעילים · הגדרות › סניפים',
    autoRule: 'נשאל רק אם קיים יותר מסניף אחד פעיל', defAsk: 'auto', defReq: false, system: true },
  { key: 'timeOfDay', label: 'העדפת זמן ביום', src: 'שעות פעילות + זמינות היומן החי',
    autoRule: 'נשאל תמיד — מסנן את הזמנים המוצעים', defAsk: 'always', defReq: false, system: true },
  { key: 'gender', label: 'העדפת מגדר מטפל/ת', src: 'שדה "מגדר" בכרטיס העובד',
    autoRule: 'נשאל רק אם קיימים מטפלים משני המגדרים', defAsk: 'auto', defReq: false, system: true },
  { key: 'nearBranch', label: 'תעדוף סניף קרוב לבית', src: 'כתובת הלקוח + קואורדינטות הסניף',
    autoRule: 'נשאל רק אם קיים יותר מסניף אחד פעיל — דורש כתובת לקוח', defAsk: 'auto', defReq: false, system: true },
];
/* תצורה + קריטריונים מותאמים (מוגדרי-מנהל) — נשמרים ב-localStorage */
let NEEDS_CFG = (function () { try { return JSON.parse(localStorage.getItem('cb_needsCfg')) || {}; } catch (e) { return {}; } })();
let NEEDS_CUSTOM = (function () { try { return JSON.parse(localStorage.getItem('cb_needsCustom')) || []; } catch (e) { return []; } })();
function needsSave() { try { localStorage.setItem('cb_needsCfg', JSON.stringify(NEEDS_CFG)); localStorage.setItem('cb_needsCustom', JSON.stringify(NEEDS_CUSTOM)); } catch (e) {} }
function needsCfgOf(def) {
  const c = NEEDS_CFG[def.key] || {};
  return { ask: c.ask || def.defAsk, required: c.required !== undefined ? c.required : def.defReq };
}
function needsCfgSet(key, patch) { NEEDS_CFG[key] = Object.assign({}, NEEDS_CFG[key], patch); needsSave(); }

/* --- מיגרציה חד-פעמית: קריטריונים שהוגדרו בעבר בתוך פריטי הקטלוג → לרישום המרכזי + שיוך --- */
function needsMigrateLegacy() {
  if (typeof COORD_TREATMENTS === 'undefined') return;
  COORD_TREATMENTS.forEach(t => {
    t.critKeys = t.critKeys || [];
    (t.criteria || []).forEach(c => {
      if (!c || !(c.label || '').trim()) return;
      const key = 'c_' + c.label.trim();
      let def = NEEDS_CUSTOM.find(x => x.key === key);
      if (!def) { def = { key, label: c.label.trim(), values: (c.values || []).slice(), detail: c.detail || '', defAsk: 'auto', defReq: false }; NEEDS_CUSTOM.push(def); }
      else (c.values || []).forEach(v => { if (def.values.indexOf(v) < 0) def.values.push(v); });
      if (t.critKeys.indexOf(key) < 0) t.critKeys.push(key);
    });
    delete t.criteria;   // אין יותר הגדרה כפולה בכרטיס השירות — רק שיוך
  });
  needsSave();
}
/* קריטריון מותאם: הוספה / עדכון / מחיקה (מסך המנהל) */
function needsAddCustom(label, values, detail) {
  label = (label || '').trim(); if (!label) return null;
  const key = 'c_' + label;
  if (NEEDS_CUSTOM.some(x => x.key === key)) { if (typeof toast === 'function') toast('קריטריון בשם זה כבר קיים'); return null; }
  const def = { key, label, values: (values || []).slice(), detail: detail || '', defAsk: 'auto', defReq: false };
  NEEDS_CUSTOM.push(def); needsSave(); return def;
}
function needsUpdateCustom(key, patch) { const d = NEEDS_CUSTOM.find(x => x.key === key); if (d) { Object.assign(d, patch); needsSave(); } }
/* שינוי שם קריטריון — המפתח נגזר מהשם, ולכן מועברים גם השיוכים והכללים */
function needsRenameCustom(key, label) {
  label = (label || '').trim(); if (!label) return key;
  const d = NEEDS_CUSTOM.find(x => x.key === key); if (!d || d.label === label) return key;
  const nk = 'c_' + label;
  if (NEEDS_CUSTOM.some(x => x.key === nk)) { if (typeof toast === 'function') toast('קריטריון בשם זה כבר קיים'); return key; }
  const oldLabel = d.label;
  d.key = nk; d.label = label;
  if (NEEDS_CFG[key]) { NEEDS_CFG[nk] = NEEDS_CFG[key]; delete NEEDS_CFG[key]; }
  if (typeof CRIT_RULES !== 'undefined' && CRIT_RULES[key]) { CRIT_RULES[nk] = CRIT_RULES[key]; delete CRIT_RULES[key]; }
  if (typeof CRIT_SCOPE !== 'undefined' && CRIT_SCOPE[key]) { CRIT_SCOPE[nk] = CRIT_SCOPE[key]; delete CRIT_SCOPE[key]; }
  if (typeof COORD_TREATMENTS !== 'undefined') COORD_TREATMENTS.forEach(t => {
    if (!t.critKeys) return; const i = t.critKeys.indexOf(key); if (i >= 0) t.critKeys[i] = nk; });
  if (typeof COORD_BRANCHES !== 'undefined') COORD_BRANCHES.forEach(b => {
    if (b.brCriteria && b.brCriteria[oldLabel] !== undefined) { b.brCriteria[label] = b.brCriteria[oldLabel]; delete b.brCriteria[oldLabel]; }
    if (b.critMode && b.critMode[oldLabel] !== undefined) { b.critMode[label] = b.critMode[oldLabel]; delete b.critMode[oldLabel]; } });
  needsSave(); if (typeof critSave === 'function') critSave();
  return nk;
}
/* יצירת קריטריון חדש — נפתח ישירות בפאנל (מקום אחד לניהול) */
function openNewCriterion(rerender) {
  let n = 1, label = 'קריטריון חדש';
  while (NEEDS_CUSTOM.some(x => x.key === 'c_' + label)) { n++; label = 'קריטריון חדש ' + n; }
  const d = needsAddCustom(label, [], '');
  if (!d) return;
  needsCfgSet(d.key, { ask: 'auto' });
  if (typeof openCritRules === 'function') {
    openCritRules(d.key, rerender);
    if (typeof critPanelTab !== 'undefined') { critPanelTab = 'define'; critPanelNew = true; if (typeof renderCritRules === 'function') renderCritRules(); }
  }
}
function needsDeleteCustom(key) {
  const def = needsDefOf(key), label = def ? def.label : String(key).replace(/^c_/, '');
  NEEDS_CUSTOM = NEEDS_CUSTOM.filter(x => x.key !== key); delete NEEDS_CFG[key];
  if (typeof COORD_TREATMENTS !== 'undefined') COORD_TREATMENTS.forEach(t => { if (t.critKeys) t.critKeys = t.critKeys.filter(k => k !== key); });
  // ניקוי מלא — אחרת השיוך "קם לתחייה" מהמראה המתמידה, והקריטריון נשאר בסניפים בלי רישום
  if (typeof CRIT_SCOPE !== 'undefined') delete CRIT_SCOPE[key];
  if (typeof CRIT_RULES !== 'undefined') delete CRIT_RULES[key];
  if (typeof COORD_BRANCHES !== 'undefined') COORD_BRANCHES.forEach(b => {
    if (b.brCriteria) delete b.brCriteria[label];
    if (b.critMode) delete b.critMode[label];
    if (b.svcCriteria) Object.keys(b.svcCriteria).forEach(sk => { if (b.svcCriteria[sk]) delete b.svcCriteria[sk][label]; });
  });
  if (typeof critSave === 'function') critSave();
  needsSave();
}
function needsCustomDefs() {
  return NEEDS_CUSTOM.map(d => Object.assign({}, d, {
    src: 'קריטריון שהוגדר בהגדרות · ' + (needsCfgOf(d).ask === 'auto' ? 'משויך לשירותים ספציפיים' : 'גורף'),
    autoRule: needsCfgOf(d).ask === 'auto' ? 'נשאל רק אם השירות שנבחר שויך לקריטריון (שיוך בכרטיס השירות)' : 'נשאל בכל תיאום',
    custom: true,
  }));
}
function needsAllDefs() { return NEEDS_BUILTIN.concat(needsCustomDefs()); }
function needsDefOf(key) { return needsAllDefs().find(d => d.key === key) || null; }
/* קריטריונים שניתן לשייך לשירות = מותאמים שמסומנים "רק אם רלוונטי" */
function needsAttachableDefs() { return needsCustomDefs().filter(d => needsCfgOf(d).ask === 'auto'); }
/* הקריטריונים המשויכים לשירות */
function svcCritDefs(t) { return ((t && t.critKeys) || []).map(needsDefOf).filter(Boolean); }
/* הקריטריונים שהסניף יורש מהשירותים שהוא מציע (לבחירת ערכים פר-סניף) */
function branchCritDefs(b) {
  const keys = [];
  ((b && b.treatments) || []).forEach(k => {
    const t = (typeof cTreat === 'function') ? cTreat(k) : null;
    ((t && t.critKeys) || []).forEach(ck => { if (keys.indexOf(ck) < 0) keys.push(ck); });
  });
  return keys.map(needsDefOf).filter(Boolean);
}

/* ---------- בדיקת כשירות סניף מול הקריטריונים שנבחרו (דינמי, תוך כדי הבחירה) ---------- */
function branchBlockReason(r, bKey) {
  const b = (typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES.find(x => x.key === bKey) : null;
  if (!b) return null;
  if (b.active === false) return 'הסניף כבוי';
  const svcs = (r && r.services) || [], needs = (r && r.needs) || {};
  // השירותים שנבחרו נתמכים בסניף?
  const unsupported = svcs.filter(k => !((b.treatments || []).indexOf(k) >= 0));
  if (unsupported.length) return 'הסניף אינו מספק: ' + unsupported.map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k).join(', ');
  // יש מטפל מוסמך המקושר לסניף (ואם נבחר מגדר — גם בהתאמה)?
  const docs = (typeof COORD_DOCTORS !== 'undefined') ? COORD_DOCTORS : [];
  let elig = docs.filter(d => ((d.branches || [d.branch]).indexOf(bKey) >= 0) && (!svcs.length || svcs.every(k => (d.skills || []).indexOf(k) >= 0)));
  if (!elig.length) return svcs.length ? 'אין בסניף מטפל מוסמך לשירות שנבחר' : 'אין מטפלים משויכים לסניף';
  if (needs.gender) { const g = elig.filter(d => d.gender === needs.gender); if (!g.length) return 'אין בסניף ' + (needs.gender === 'm' ? 'מטפל גבר' : 'מטפלת') + ' לשירות שנבחר'; }
  // קריטריון קטלוג שנבחר (למשל הסדר קופה) — האם הערך קיים בהסדר של הסניף?
  const keys = Object.keys(needs);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]; if (k.indexOf('c_') !== 0 || !needs[k]) continue;
    const def = needsDefOf(k); if (!def) continue;
    // "אחר" = הקריטריון אינו נתמך ללקוח — אינו חוסם סניף; במקומו חלים כללי "אחר" (למשל תשלום מלא)
    if (needs[k] === (typeof CRIT_OTHER !== 'undefined' ? CRIT_OTHER : '__other')) continue;
    // קריטריון נגזר (גיל · תוקף · סבב · הצהרה) אינו "הסדר" של סניף — הוא נבדק בכללי החסימה, לא כאן
    if (typeof critIsDerived === 'function' && critIsDerived(def)) continue;
    // הקריטריון פעיל רק בסניפים שבהיקף שהוגדר לו
    if (typeof critAppliesInBranch === 'function' && !critAppliesInBranch(k, bKey)) continue;
    const sel = ((b.brCriteria || {})[def.label] || []);
    const perSvc = svcs.some(sk => (((b.svcCriteria || {})[sk] || {})[def.label] || []).indexOf(needs[k]) >= 0);
    const mode = (b.critMode || {})[def.label] || 'general';
    const ok = mode === 'general' ? (sel.indexOf(needs[k]) >= 0) : perSvc;
    if ((sel.length || perSvc || mode === 'general') && !ok) return def.label + ' "' + needs[k] + '" אינו בהסדר בסניף זה';
  }
  return null;
}
/* ---------- בניית השאלות בפועל לרשומה ---------- */
function needsQuestions(r) {
  const qs = [];
  const branches = (typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES.filter(b => b.active !== false) : [];
  const docs = (typeof COORD_DOCTORS !== 'undefined') ? COORD_DOCTORS : [];
  const svcs = (r && r.services) || [];
  needsAllDefs().forEach(def => {
    const cfg = needsCfgOf(def);
    if (cfg.ask === 'never') return;
    let relevant = true, opts = null, inline = false;
    if (def.key === 'branch') {
      relevant = branches.length > 1;
      // "הקרוב לבית" הוא אפשרות בתוך רשימת הסניפים (לא שאלה נפרדת) — בכפוף להגדרת nearBranch
      const nearDef = NEEDS_BUILTIN.find(x => x.key === 'nearBranch');
      const nearOn = nearDef && needsCfgOf(nearDef).ask !== 'never' && branches.length > 1;
      opts = [{ v: '', t: 'אין העדפה' }].concat(nearOn ? [{ v: '__near', t: '📍 הקרוב לבית הלקוח' }] : [])
        .concat(branches.map(b => { const blk = branchBlockReason(r, b.key); return { v: b.key, t: b.label, blocked: !!blk, why: blk || '' }; }));
    }
    else if (def.key === 'timeOfDay') { opts = [{ v: '', t: 'גמיש' }, { v: 'morning', t: 'בוקר (8–12)' }, { v: 'noon', t: 'צהריים (12–16)' }, { v: 'evening', t: 'אחה״צ (16–18)' }]; }
    else if (def.key === 'gender') { relevant = docs.some(d => d.gender === 'm') && docs.some(d => d.gender === 'f'); opts = [{ v: '', t: 'אין העדפה' }, { v: 'm', t: 'גבר' }, { v: 'f', t: 'אישה' }]; }
    else if (def.key === 'nearBranch') return;   // אינו שאלה נפרדת — מוצג כאפשרות בתוך "סניף מועדף" (בלי כפילות)
    else if (typeof critIsDerived === 'function' && critIsDerived(def)) return;   // קריטריון נגזר — מחושב מנתונים (גיל · תוקף · סבב · הצהרה), אינו נשאל
    else {
      // קריטריון מותאם: 'always' = גורף · 'auto' = רק אם שירות שנבחר שויך אליו
      if (cfg.ask === 'auto') relevant = !svcs.length ? false : svcs.some(k => { const t = (typeof cTreat === 'function') ? cTreat(k) : null; return t && (t.critKeys || []).indexOf(def.key) >= 0; });
      const hint = (v) => (typeof critOptionHint === 'function') ? critOptionHint(def.key, v) : '';
      opts = [{ v: '', t: 'לא רלוונטי' }]
        .concat((def.values || []).map(v => ({ v: v, t: v, hint: hint(v) })))
        // "אחר" = הקריטריון אינו נתמך במקרה הזה (למשל: הסדר קופה שאינו ברשימה) → חלים כללי "אחר"
        .concat([{ v: (typeof CRIT_OTHER !== 'undefined' ? CRIT_OTHER : '__other'), t: (typeof CRIT_OTHER_LABEL !== 'undefined' ? CRIT_OTHER_LABEL : 'אחר / לא מהרשימה'), hint: hint(typeof CRIT_OTHER !== 'undefined' ? CRIT_OTHER : '__other'), other: true }]);
    }
    if (cfg.ask === 'auto' && !relevant) return;
    qs.push({ key: def.key, label: def.label + (cfg.required ? ' *' : ''), opts: opts, required: cfg.required, src: def.src, detail: def.detail || '', inline: inline });
  });
  return qs;
}
function needsMissingRequired(r) {
  const n = (r && r.needs) || {};
  return needsQuestions(r).filter(q => q.required && !n[q.key]).map(q => q.label.replace(/\s*\*$/, ''));
}
function needsSummary(r) {
  const n = (r && r.needs) || {}, out = [];
  needsQuestions(r).forEach(q => {
    const v = n[q.key]; if (!v) return;
    const o = (q.opts || []).find(x => x.v === v);
    out.push(q.label.replace(/\s*\*$/, '') + ': ' + (o ? o.t : v));
  });
  if (n.note) out.push('הערה: ' + String(n.note).slice(0, 40));
  return out;
}

/* ---------- הגדרת מנהל: זמן שמירת תור (נעילה זמנית) עד להשלמת סליקה ---------- */
const HOLD_PRESETS = [10, 20, 40, 60, 180, 1440];
function holdMinutes() { const v = +(NEEDS_CFG.__holdMin); return (v && v > 0) ? v : 10; }
function setHoldMinutes(m) { m = Math.max(1, Math.min(10080, +m || 10)); NEEDS_CFG.__holdMin = m; needsSave(); }
function holdLabel(m) { m = m || holdMinutes(); return m >= 1440 ? (m / 1440 === 1 ? '24 שעות' : Math.round(m / 1440) + ' ימים') : m >= 60 ? (m / 60 === 1 ? 'שעה' : Math.round(m / 60) + ' שעות') : m + ' דקות'; }
function holdSettingHTML() {
  const cur = holdMinutes();
  return '<section class="card set-card wide nc-hold">' +
    '<div class="card-head"><div class="title">' + ic('clock') + ' זמן שמירת תור · נעילה זמנית</div>' +
      '<span class="muted" style="font-size:12px">כמה זמן התור נשמר ללקוח עד להשלמת הסליקה</span></div>' +
    '<div class="set-body">' +
      '<div class="hold-row">' + HOLD_PRESETS.map(function (m) { return '<button class="hold-chip ' + (cur === m ? 'on' : '') + '" data-hold="' + m + '">' + holdLabel(m) + '</button>'; }).join('') +
        '<label class="hold-custom">אחר (דקות)<input class="cc-inp" type="number" id="holdCustom" min="1" max="10080" value="' + cur + '"></label></div>' +
      '<p class="hint" style="margin-top:10px">' + ic('alert') + ' כששירות דורש סליקה: התור נכנס ל<b>נעילה זמנית</b> ברשימת ההמתנה למשך <b>' + holdLabel(cur) + '</b> — כדי שיהיה זמן להביא את פרטי האשראי. <b>השיריון בפועל מתבצע רק לאחר הסליקה</b>; אם הזמן חלף — הנעילה משתחררת והתור חוזר להיות פנוי.</p>' +
    '</div></section>';
}
function bindHoldSetting(rerender) {
  $$('[data-hold]').forEach(function (b) { b.addEventListener('click', function () { setHoldMinutes(+b.dataset.hold); if (rerender) rerender(); toast('זמן שמירת תור: ' + holdLabel()); }); });
  const hc = $('#holdCustom'); if (hc) hc.addEventListener('change', function () { setHoldMinutes(+hc.value); if (rerender) rerender(); toast('זמן שמירת תור: ' + holdLabel()); });
}

/* ---------- מסך המנהל: כל הקריטריונים + הוספה עם אפשרויות ---------- */
let ncNewOpen = false, ncDraft = { label: '', values: [], detail: '', kind: 'list' };
function needsCriteriaCardHTML() {
  const defs = needsAllDefs();
  const svcOf = key => (typeof COORD_TREATMENTS === 'undefined') ? [] : COORD_TREATMENTS.filter(t => (t.critKeys || []).indexOf(key) >= 0).map(t => t.label);
  return '<section class="card set-card wide nc-card">' +
    '<div class="card-head"><div class="title">' + ic('target') + ' קריטריונים · מקור-אמת יחיד</div>' +
      '<button class="btn sm primary" id="ncAddBtn">' + ic('plus') + ' הוסף קריטריון</button></div>' +
    '<div class="set-body">' +
    (typeof critAuditBarHTML === 'function' ? critAuditBarHTML() : '') +
    '<div class="table-wrap"><table class="mini-table nc-table">' +
      '<thead><tr><th>קריטריון</th><th>אפשרויות</th><th>שירותים</th><th>סניפים</th><th>מתי נשאל</th><th>חובה</th><th></th></tr></thead><tbody>' +
      defs.map(function (d) { const cfg = needsCfgOf(d), svcs = d.custom ? svcOf(d.key) : [];
        return '<tr><td><b>' + esc(d.label) + '</b>' + (d.system ? ' <span class="badge gray sm">מערכת</span>' : '') +
          (d.custom && typeof critGroupOf === 'function' ? ' <span class="cq-group ' + critGroupOf(d).key + '">' + critGroupOf(d).label + '</span>' + (critKindOf(d).key !== 'list' ? ' <small class="muted">' + critKindOf(d).label + '</small>' : '') : '') + (d.detail ? '<br><small class="muted">' + esc(d.detail) + '</small>' : '') + '</td>' +
          '<td class="nc-vals" data-l="אפשרויות">' + (d.system ? '<small class="muted">נשאב מהמערכת</small>' :
            '<div class="ccr-tags sm">' + (d.values || []).map(function (v, i) { return '<span class="ccr-tag">' + esc(v) + '<button type="button" data-ncdv="' + esc(d.key) + '|' + i + '">' + ic('close') + '</button></span>'; }).join('') +
            '<input class="ccr-valinp" data-ncav="' + esc(d.key) + '" placeholder="+ ערך"></div>') + '</td>' +
          '<td data-l="שירותים">' + (d.custom && typeof critQuickSvcHTML === 'function' ? critQuickSvcHTML(d) : '<small class="muted">' + esc(d.src) + '</small>') + '</td>' +
          '<td data-l="סניפים">' + (d.custom && typeof critQuickBrHTML === 'function' ? critQuickBrHTML(d) : '<small class="muted">—</small>') + '</td>' +
          '<td data-l="מתי נשאל"><div class="br-mode-seg sm nc-seg">' +
            '<button class="' + (cfg.ask === 'always' ? 'on' : '') + '" data-ncask="' + esc(d.key) + '|always">תמיד</button>' +
            '<button class="' + (cfg.ask === 'auto' ? 'on' : '') + '" data-ncask="' + esc(d.key) + '|auto">רק אם רלוונטי</button>' +
            '<button class="' + (cfg.ask === 'never' ? 'on' : '') + '" data-ncask="' + esc(d.key) + '|never">לא נשאל</button></div></td>' +
          '<td data-l="חובה"><span class="toggle wh-toggle ' + (cfg.required ? 'on' : '') + '" data-ncreq="' + esc(d.key) + '"><i></i></span></td>' +
          '<td class="nc-acts">' + (d.custom && typeof openCritRules === 'function'
            ? '<button class="btn xs nc-rules" data-ncrules="' + esc(d.key) + '" title="היקף (שירותים/סניפים) וכללים והשלכות">' + ic('target') + ' היקף וכללים' +
              (typeof critHasAnyRules === 'function' && critHasAnyRules(d.key) ? '<span class="nc-rulebadge">' + ic('bolt') + ' כללים</span>' : '') + '</button> ' : '') +
            (d.custom ? '<button class="whs-del" data-ncdel="' + esc(d.key) + '" title="מחק קריטריון">' + ic('close') + '</button>' : '') + '</td></tr>';
      }).join('') +
    '</tbody></table></div>' +
    '<p class="hint" style="margin-top:10px">' + ic('alert') + ' <b>אין כפילויות:</b> קריטריון מוגדר כאן בלבד. "תמיד" = נשאל בכל תיאום · "רק אם רלוונטי" = משייכים אותו לשירותים ספציפיים בכרטיס השירות, ואז הוא מופיע אוטומטית גם בסניף שמציע את השירות. קריטריון <b>חובה</b> חוסם הצעת זמנים עד שימולא.</p>' +
    '</div></section>';
}
function bindNeedsCriteriaCard(rerender) {
  const RR = function () { if (typeof rerender === 'function') rerender(); };
  const ab = $('#ncAddBtn'); if (ab) ab.addEventListener('click', function () { openNewCriterion(RR); });
  if (typeof bindCritQuick === 'function') bindCritQuick(RR);
  // עריכת ערכים בטבלה
  $$('[data-ncav]').forEach(function (inp) { inp.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ',') return; e.preventDefault();
    const key = inp.dataset.ncav, v = (inp.value || '').replace(/,+$/, '').trim(); if (!v) return;
    const d = NEEDS_CUSTOM.find(function (x) { return x.key === key; }); if (!d) return;
    if (d.values.indexOf(v) < 0) { d.values.push(v); needsSave(); }
    RR();
  }); });
  $$('[data-ncdv]').forEach(function (b) { b.addEventListener('click', function () {
    const p = b.dataset.ncdv.split('|'), d = NEEDS_CUSTOM.find(function (x) { return x.key === p[0]; });
    if (d) { d.values.splice(+p[1], 1); needsSave(); RR(); }
  }); });
  $$('[data-ncrules]').forEach(function (b) { b.addEventListener('click', function () {
    if (typeof openCritRules === 'function') openCritRules(b.dataset.ncrules, RR);
  }); });
  $$('[data-ncask]').forEach(function (b) { b.addEventListener('click', function () {
    const p = b.dataset.ncask.split('|'); needsCfgSet(p[0], { ask: p[1] }); RR(); toast('עודכן: מתי נשאל');
  }); });
  $$('[data-ncreq]').forEach(function (t) { t.addEventListener('click', function () {
    const key = t.dataset.ncreq, def = needsDefOf(key); if (!def) return;
    needsCfgSet(key, { required: !needsCfgOf(def).required }); RR(); toast('עודכן: חובה לפני תיאום');
  }); });
  $$('[data-ncdel]').forEach(function (b) { b.addEventListener('click', function () {
    const key = b.dataset.ncdel, def = needsDefOf(key);
    const doDel = function () { needsDeleteCustom(key); RR(); toast('הקריטריון נמחק'); };
    if (typeof cbConfirm === 'function') cbConfirm({ title: 'מחיקת קריטריון', danger: true, confirmLabel: 'מחק',
      message: 'למחוק את "' + esc(def ? def.label : '') + '"? הוא יוסר גם מכל השירותים שמשויכים אליו.', onConfirm: doDel });
    else doDel();
  }); });
}
/* מיגרציה בטעינה */
needsMigrateLegacy();
/* החזרת שיוך הקריטריונים (שירותים · ערכים בסניף) לקטלוג ולסניפים שבזיכרון */
if (typeof critRestoreScope === 'function') critRestoreScope();
