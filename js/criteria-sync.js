/* ============================================================
   ריכוז ובקרה — הקריטריונים במקום אחד   · מודול עצמאי
   ------------------------------------------------------------
   הנחת העבודה של פלטפורמת הקריטריונים:
   **אין קריטריון בסניף או בשירות שאין לו חיווי כאן.**

   1) שיוך מהיר — מתוך טבלת הקריטריונים אפשר לשייך לשירותים ולסניפים
      בלחיצה. השיוך נכתב **ישירות למקורות האמת**:
        שירות → t.critKeys (הקטלוג)   ·   סניף → b.brCriteria (הסניף)
      ולכן אין סנכרון-אחורה: זה אותו נתון. עדכון נקודתי בתוך סניף או
      בתוך כרטיס שירות משתקף כאן מיד, ולהפך.

   2) בקרה — סריקה שמאתרת פערים:
        • קריטריון שהוגדר בסניף/שירות ואינו ברישום  → "ייבא לרישום"
        • קריטריון ברישום שאינו משויך לאף שירות     → לא ייִשאל בכלל
        • קריטריון שמשויך לשירות אך אין סניף שמכבד  → ייחסם בפועל
   ============================================================ */

/* ---------------- סריקה ---------------- */
function critRegistryLabels() {
  return ((typeof needsAllDefs === 'function') ? needsAllDefs() : []).filter(d => d.custom).map(d => d.label);
}
/* קריטריונים שמופיעים בסניפים אך אינם ברישום */
function critOrphans() {
  const known = critRegistryLabels(), map = {};
  const add = (label, where, vals) => {
    if (!label || known.indexOf(label) >= 0) return;
    const o = map[label] = map[label] || { label: label, where: [], values: [] };
    if (o.where.indexOf(where) < 0) o.where.push(where);
    (vals || []).forEach(v => { if (o.values.indexOf(v) < 0) o.values.push(v); });
  };
  ((typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES : []).forEach(b => {
    Object.keys(b.brCriteria || {}).forEach(l => add(l, (b.short || b.label), b.brCriteria[l]));
    Object.keys(b.svcCriteria || {}).forEach(sk => Object.keys(b.svcCriteria[sk] || {}).forEach(l => add(l, (b.short || b.label) + ' · ' + sk, b.svcCriteria[sk][l])));
  });
  // קטלוג: שיוך למפתח שאינו קיים ברישום
  ((typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : []).forEach(t => {
    (t.critKeys || []).forEach(k => { if (typeof needsDefOf === 'function' && !needsDefOf(k))
      add(String(k).replace(/^c_/, ''), 'קטלוג · ' + t.label, []); });
  });
  return Object.keys(map).map(k => map[k]);
}
/* ייבוא קריטריון יתום לרישום — כולל השיוכים שכבר קיימים בפועל */
function critImportOrphan(label) {
  if (typeof needsAddCustom !== 'function') return null;
  const o = critOrphans().find(x => x.label === label); if (!o) return null;
  const d = needsAddCustom(label, o.values, ''); if (!d) return null;
  if (typeof needsCfgSet === 'function') needsCfgSet(d.key, { ask: 'auto' });
  // שירותים שכבר משויכים למפתח הזה
  ((typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : []).forEach(t => {
    if ((t.critKeys || []).indexOf(d.key) >= 0 && typeof critMirrorSvcs === 'function') critMirrorSvcs(d.key);
  });
  // סניפים שכבר מכבדים אותו → קיבוע ההיקף
  const brs = ((typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES : []).filter(b => (b.brCriteria || {})[label]);
  if (brs.length && typeof critScopeSet === 'function') critScopeSet(d.key, { branchMode: 'pick', branches: brs.map(b => b.key) });
  if (typeof critMirrorBrVals === 'function') critMirrorBrVals(d.key);
  return d;
}
/* בקרת שלמות לכל קריטריון */
function critHealth(def) {
  const svcs = (typeof critSvcKeys === 'function') ? critSvcKeys(def.key) : [];
  const brs = (typeof critBranchKeys === 'function') ? critBranchKeys(def.key) : [];
  const cfg = (typeof needsCfgOf === 'function') ? needsCfgOf(def) : { ask: 'auto' };
  const derived = (typeof critIsDerived === 'function') && critIsDerived(def);
  const honoured = brs.filter(bk => !derived ? ((typeof critBranchVals === 'function' ? critBranchVals(def.key, bk) : []).length) : true);
  const out = { svcs: svcs, branches: brs, honoured: honoured, issues: [] };
  if (cfg.ask === 'never') return out;
  if (cfg.ask === 'auto' && !svcs.length) out.issues.push('לא משויך לאף שירות — לא ייִשאל');
  else if (!brs.length && svcs.length) out.issues.push('אין סניף פעיל שמציע את השירותים המשויכים');
  else if (!derived && brs.length && !honoured.length && (def.values || []).length) out.issues.push('אף סניף לא סימן ערכים — כל הסניפים ייחסמו');
  return out;
}

/* ---------------- שיוך מהיר מהטבלה ---------------- */
function critQuickSvcHTML(def) {
  const cat = (typeof COORD_TREATMENTS === 'undefined') ? [] : COORD_TREATMENTS;
  const on = (typeof critSvcKeys === 'function') ? critSvcKeys(def.key) : [];
  return `<div class="cq-cell">
    <div class="cq-chips">${cat.map(t => `<button class="cq-chip ${on.indexOf(t.key) >= 0 ? 'on' : ''}" data-cqsvc="${esc(def.key)}|${esc(t.key)}" title="${esc(t.label)}">${esc(t.label)}</button>`).join('')}</div>
    <button class="cq-all" data-cqsvcall="${esc(def.key)}|${on.length === cat.length ? '0' : '1'}">${on.length === cat.length ? 'נקה' : 'הכל'}</button>
  </div>`;
}
function critQuickBrHTML(def) {
  const brs = ((typeof COORD_BRANCHES === 'undefined') ? [] : COORD_BRANCHES).filter(b => b.active !== false);
  const inScope = (typeof critBranchKeys === 'function') ? critBranchKeys(def.key) : [];
  const sc = (typeof critScopeOf === 'function') ? critScopeOf(def.key) : { branchMode: 'auto', branches: [] };
  const derived = (typeof critIsDerived === 'function') && critIsDerived(def);
  return `<div class="cq-cell">
    <div class="cq-chips">${brs.map(b => { const on = inScope.indexOf(b.key) >= 0;
      const vals = (!derived && typeof critBranchVals === 'function') ? critBranchVals(def.key, b.key) : [];
      return `<button class="cq-chip ${on ? 'on' : ''} ${on && !derived && !vals.length && (def.values || []).length ? 'warn' : ''}"
        data-cqbr="${esc(def.key)}|${esc(b.key)}" title="${esc(b.label)}${vals.length ? ' · ' + vals.join(', ') : ''}">
        ${esc(b.short || b.label)}${vals.length ? `<i>${vals.length}</i>` : ''}</button>`; }).join('')}</div>
    <span class="cq-mode ${sc.branchMode === 'auto' ? 'auto' : ''}" title="${sc.branchMode === 'auto' ? 'נגזר אוטומטית מהשירותים המשויכים' : 'סניפים שנבחרו ידנית'}">${sc.branchMode === 'auto' ? 'אוטומטי' : 'ידני'}</span>
  </div>`;
}
/* שיוך סניף = גם היקף וגם סימון הערכים בסניף עצמו (כתיבה למקור האמת) */
function critAssignBranch(key, bKey, on) {
  const def = (typeof needsDefOf === 'function') ? needsDefOf(key) : null; if (!def) return;
  const sc = critScopeOf(key), list = sc.branches.slice();
  const i = list.indexOf(bKey);
  if (on && i < 0) list.push(bKey); if (!on && i >= 0) list.splice(i, 1);
  critScopeSet(key, { branchMode: 'pick', branches: list });
  const derived = (typeof critIsDerived === 'function') && critIsDerived(def);
  if (!derived && (def.values || []).length && typeof critSetBranchAll === 'function') critSetBranchAll(key, bKey, on);
}
function bindCritQuick(rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  $$('[data-cqsvc]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.cqsvc.split('|');
    critToggleSvc(p[0], p[1]); RR(); }));
  $$('[data-cqsvcall]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.cqsvcall.split('|');
    critSetAllSvcs(p[0], p[1] === '1'); RR(); }));
  $$('[data-cqbr]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.cqbr.split('|');
    critAssignBranch(p[0], p[1], !b.classList.contains('on')); RR(); }));
  $$('[data-cqimport]').forEach(b => b.addEventListener('click', () => {
    const d = critImportOrphan(b.dataset.cqimport); RR();
    toast(d ? 'הקריטריון יובא לרישום · ' + d.label : 'הייבוא נכשל');
  }));
}

/* ---------------- באנר בקרה ---------------- */
function critAuditBarHTML() {
  const orph = critOrphans();
  const defs = ((typeof needsAllDefs === 'function') ? needsAllDefs() : []).filter(d => d.custom);
  const bad = defs.map(d => ({ d: d, h: critHealth(d) })).filter(x => x.h.issues.length);
  if (!orph.length && !bad.length) {
    return `<div class="cq-audit ok">${ic('check')} <b>הכול מסונכרן</b> — ${defs.length} קריטריונים ברישום, כולם משויכים ומכובדים בסניפים.</div>`;
  }
  return `<div class="cq-audit">
    ${orph.length ? `<div class="cqa-sec">
      <div class="cqa-h">${ic('alert')} <b>${orph.length} קריטריונים הוגדרו בסניף/שירות ואינם ברישום</b>
        <small>ללא רישום אין להם כללים, היקף או השלכות — יש לייבא אותם.</small></div>
      ${orph.map(o => `<div class="cqa-row"><b>${esc(o.label)}</b>
        <span class="cqa-where">${esc(o.where.join(' · '))}</span>
        ${o.values.length ? `<span class="cqa-vals">${o.values.map(esc).join(' · ')}</span>` : ''}
        <button class="btn xs primary" data-cqimport="${esc(o.label)}">${ic('plus')} ייבא לרישום</button></div>`).join('')}
    </div>` : ''}
    ${bad.length ? `<div class="cqa-sec">
      <div class="cqa-h">${ic('alert')} <b>${bad.length} קריטריונים לא יבואו לידי ביטוי</b></div>
      ${bad.map(x => `<div class="cqa-row"><b>${esc(x.d.label)}</b><span class="cqa-where">${esc(x.h.issues.join(' · '))}</span></div>`).join('')}
    </div>` : ''}
  </div>`;
}
