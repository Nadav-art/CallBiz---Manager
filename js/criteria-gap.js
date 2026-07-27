/* ============================================================
   חלון תיאום מהפגישה הקודמת — מודול עצמאי
   ------------------------------------------------------------
   זה לא "כמה זמן עבר" (סיווג) אלא **אילו מועדים בכלל אפשר להציע**:

     מינימום — "רק אם עברו 20 יום מהתור הקודם"   → לא לפני prev + 20 יום
     מקסימום — "עד 8 חודשים מהפגישה הקודמת"      → לא אחרי prev + 8 חודשים

   שני הכיוונים יכולים לפעול יחד ויוצרים **חלון**:
        prev ──20 יום──▶ [ מותר לתאם ] ◀──8 חודשים── prev

   שלושת המצבים הם ה"ערכים" של הקריטריון, ולכן כל מנוע הכללים הקיים
   חל עליהם: מוקדם מדי / בתוך החלון / חלף המועד. כך "אלא אם משלמים"
   זה פשוט כלל תשלום על הערך "חלף המועד", ו"אסור" זה כלל חסימה.

   האינטגרציה: הזמנים המוצעים מסומנים/נחסמים לפי החלון, עם באנר
   שמראה בדיוק מאיזה תאריך ועד איזה תאריך ניתן לתאם ולמה.
   ============================================================ */
const GAP_VALS = { early: 'מוקדם מדי', ok: 'בתוך החלון', late: 'חלף המועד' };
const GAP_UNITS = [
  { key: 'days', label: 'ימים', one: 'יום' },
  { key: 'weeks', label: 'שבועות', one: 'שבוע' },
  { key: 'months', label: 'חודשים', one: 'חודש' },
  { key: 'years', label: 'שנים', one: 'שנה' },
];
function gapUnitLabel(n, u) { const d = GAP_UNITS.find(x => x.key === u) || GAP_UNITS[0]; return n + ' ' + (n === 1 ? d.one : d.label); }
function gapCfg(def) {
  const g = (def && def.gap) || {};
  return { minOn: !!g.minOn, minN: +g.minN || 0, minU: g.minU || 'days',
           maxOn: !!g.maxOn, maxN: +g.maxN || 0, maxU: g.maxU || 'months' };
}
function gapSet(key, patch) {
  const raw = (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null; if (!raw) return;
  raw.gap = Object.assign({}, raw.gap, patch);
  raw.values = [GAP_VALS.early, GAP_VALS.ok, GAP_VALS.late];
  if (typeof needsSave === 'function') needsSave();
}
/* חישוב תאריכים */
function gapAdd(d, n, unit) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (unit === 'days') x.setDate(x.getDate() + n);
  else if (unit === 'weeks') x.setDate(x.getDate() + n * 7);
  else if (unit === 'months') x.setMonth(x.getMonth() + n);
  else x.setFullYear(x.getFullYear() + n);
  return x;
}
function gapISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function gapHeb(ds) { const d = (typeof rotParse === 'function') ? rotParse(ds) : null; return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) : ds; }
/* החלון של קריטריון מסוים עבור ליד */
function gapWindow(def, r) {
  const prevRaw = (typeof critLastVisit === 'function') ? critLastVisit(r) : null;
  const manual = (r && r.critData) ? r.critData[def.key] : null;
  const src = manual || prevRaw;
  if (!src) return { prev: null, from: null, to: null };
  const p = (typeof critParseDate === 'function') ? critParseDate(src) : null;
  if (!p) return { prev: null, from: null, to: null };
  const c = gapCfg(def);
  return { prev: src, prevISO: gapISO(p),
    from: c.minOn && c.minN ? gapISO(gapAdd(p, c.minN, c.minU)) : null,
    to: c.maxOn && c.maxN ? gapISO(gapAdd(p, c.maxN, c.maxU)) : null };
}
/* מצב תאריך מועמד מול החלון */
function gapStateFor(def, r, ds) {
  const w = gapWindow(def, r); if (!w.prev) return { state: '', w: w };
  if (w.from && ds < w.from) return { state: 'early', w: w };
  if (w.to && ds > w.to) return { state: 'late', w: w };
  return { state: 'ok', w: w };
}
/* כל קריטריוני החלון הרלוונטיים לליד */
function gapDefsFor(r) {
  const all = (typeof needsAllDefs === 'function') ? needsAllDefs() : [];
  const svcs = (r && r.services) || [];
  return all.filter(d => {
    if (!d.custom || (d.kind !== 'gap')) return false;
    const cfg = (typeof needsCfgOf === 'function') ? needsCfgOf(d) : { ask: 'auto' };
    if (cfg.ask === 'never') return false;
    if (cfg.ask === 'always') return true;
    return svcs.some(k => { const t = (typeof cTreat === 'function') ? cTreat(k) : null; return t && (t.critKeys || []).indexOf(d.key) >= 0; });
  });
}
/* האם מותר לתאם בתאריך — מסכם את כל קריטריוני החלון */
function gapCheckDate(r, ds) {
  const out = { ok: true, blocked: false, pay: false, lines: [] };
  gapDefsFor(r).forEach(d => {
    const st = gapStateFor(d, r, ds); if (!st.state || st.state === 'ok') return;
    const val = GAP_VALS[st.state];
    const rules = (typeof critRuleGet === 'function') ? critRuleGet(d.key, val) : null;
    const blockMode = rules && rules.block ? rules.block.mode : 'allow';
    const payMode = rules && rules.pay ? rules.pay.mode : 'default';
    const hard = blockMode === 'block';
    const line = { def: d.label, state: st.state, val: val, w: st.w, hard: hard,
      reason: (rules && rules.block && rules.block.reason) || (st.state === 'early'
        ? 'טרם חלף המרווח המינימלי מהפגישה הקודמת' : 'חלף המועד המרבי מהפגישה הקודמת'),
      pay: (payMode && payMode !== 'default') ? payMode : '' };
    if (hard) { out.ok = false; out.blocked = true; }
    if (line.pay) out.pay = true;
    out.lines.push(line);
  });
  return out;
}
/* גזירת הערך לליד — לפי היום (מה מצבנו עכשיו) */
function gapDerive(def, r) {
  const today = (typeof clockTodayISO === 'function') ? clockTodayISO() : gapISO(new Date());
  const st = gapStateFor(def, r, today);
  if (!st.state) return { val: '', missing: true, basis: 'לא נמצאה פגישה קודמת — נדרש תאריך' };
  const c = gapCfg(def), w = st.w, parts = [];
  if (c.minOn && c.minN) parts.push('לא לפני ' + gapUnitLabel(c.minN, c.minU));
  if (c.maxOn && c.maxN) parts.push('לא אחרי ' + gapUnitLabel(c.maxN, c.maxU));
  return { val: GAP_VALS[st.state], missing: false,
    basis: 'הפגישה הקודמת ' + gapHeb(w.prevISO) + ' · ' + (parts.join(' · ') || 'ללא הגבלה') +
      ' → ניתן לתאם ' + (w.from ? gapHeb(w.from) : 'מיד') + ' – ' + (w.to ? gapHeb(w.to) : 'ללא הגבלה') };
}

/* ---------------- פאנל ההגדרה (מוזרק לפאנל הקריטריון) ---------------- */
function gapDefinePanel(key, def) {
  const c = gapCfg(def);
  const unitBtns = (which, cur) => GAP_UNITS.map(u => `<button class="cd-unit sm ${cur === u.key ? 'on' : ''}" data-gapu="${which}|${u.key}">${u.label}</button>`).join('');
  return `<div class="cr-sec">
      <div class="cr-h"><span class="cr-step">2</span>${ic('clock')} חלון התיאום מהפגישה הקודמת</div>

      <div class="gap-rule ${c.minOn ? 'on' : ''}">
        <label class="cre-f chk"><input type="checkbox" data-gapon="min" ${c.minOn ? 'checked' : ''}>
          <span><b>מרווח מינימלי</b> — אי אפשר לתאם לפני שעבר הזמן הזה מהתור הקודם</span></label>
        ${c.minOn ? `<div class="gap-row">
          <input class="cc-inp sm gap-n" type="number" min="1" max="999" data-gapn="min" value="${c.minN || 20}">
          <div class="cd-units sm">${unitBtns('min', c.minU)}</div></div>
          <p class="cr-hint">${ic('bolt')} לדוגמה: "רק אם עברו 20 יום מהתור הקודם".</p>` : ''}
      </div>

      <div class="gap-rule ${c.maxOn ? 'on' : ''}">
        <label class="cre-f chk"><input type="checkbox" data-gapon="max" ${c.maxOn ? 'checked' : ''}>
          <span><b>מועד אחרון</b> — אי אפשר לתאם אחרי שעבר הזמן הזה מהפגישה הקודמת</span></label>
        ${c.maxOn ? `<div class="gap-row">
          <input class="cc-inp sm gap-n" type="number" min="1" max="999" data-gapn="max" value="${c.maxN || 8}">
          <div class="cd-units sm">${unitBtns('max', c.maxU)}</div></div>
          <p class="cr-hint">${ic('bolt')} לדוגמה: "עד 8 חודשים מהפגישה הקודמת" — אחריה נדרשת בדיקה חדשה או תשלום.</p>` : ''}
      </div>

      ${(!c.minOn && !c.maxOn) ? `<p class="cr-todo" style="margin-top:8px">${ic('alert')} סמן לפחות כיוון אחד — מינימלי, מרבי, או שניהם.</p>` : `
      <div class="gap-preview">${ic('calendar')} <b>כך זה ייראה:</b>
        <span class="gap-line">
          <span class="gap-pt">הפגישה הקודמת</span>
          ${c.minOn ? `<span class="gap-seg bad">${gapUnitLabel(c.minN || 20, c.minU)} — מוקדם מדי</span>` : ''}
          <span class="gap-seg good">מותר לתאם</span>
          ${c.maxOn ? `<span class="gap-seg warn">אחרי ${gapUnitLabel(c.maxN || 8, c.maxU)} — חלף המועד</span>` : ''}
        </span></div>`}
    </div>
    <div class="cr-sec">
      <div class="cr-h"><span class="cr-step">3</span>${ic('bolt')} מה קורה מחוץ לחלון</div>
      <p class="cr-hint">${ic('alert')} שלושת המצבים הם <b>ערכי הקריטריון</b> — עבור ללשונית <b>"כללים והשלכות"</b> וקבע לכל אחד מהם מה קורה:
        חסימה מלאה, תשלום מלא, מחיר אחר, אישור חריג של רופא, מסמך נדרש וכו׳.</p>
      <div class="gap-vals">
        ${['early', 'ok', 'late'].map(k => { const eff = (typeof critActiveEffects === 'function') ? critActiveEffects(key, GAP_VALS[k]) : [];
          return `<div class="gap-val ${k}"><b>${GAP_VALS[k]}</b>
            ${eff.length ? eff.map(x => `<span class="cr-badge">${ic(x.e.icon)} ${esc(x.badge || x.e.label)}</span>`).join('') : '<small class="muted">ללא כללים</small>'}</div>`;
        }).join('')}
      </div>
    </div>`;
}
function gapBindDefine(key, def, RR) {
  $$('[data-gapon]').forEach(cb => cb.addEventListener('change', () => {
    const w = cb.dataset.gapon, c = gapCfg(def);
    const patch = {}; patch[w + 'On'] = cb.checked;
    if (cb.checked && !c[w + 'N']) { patch[w + 'N'] = (w === 'min' ? 20 : 8); patch[w + 'U'] = (w === 'min' ? 'days' : 'months'); }
    gapSet(key, patch); gapSeedRules(key); RR();
  }));
  $$('[data-gapn]').forEach(inp => inp.addEventListener('change', () => {
    const w = inp.dataset.gapn, patch = {}; patch[w + 'N'] = Math.max(1, +inp.value || 1);
    gapSet(key, patch); RR();
  }));
  $$('[data-gapu]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.gapu.split('|'), patch = {}; patch[p[0] + 'U'] = p[1];
    gapSet(key, patch); RR();
  }));
}
/* ברירות מחדל הגיוניות בפעם הראשונה — כדי שיעבוד מיד */
function gapSeedRules(key) {
  if (typeof critRuleSetVal !== 'function' || typeof critRuleRaw !== 'function') return;
  if (!Object.keys(critRuleRaw(key, GAP_VALS.early)).length)
    critRuleSetVal(key, GAP_VALS.early, 'block', { mode: 'block', reason: 'טרם חלף המרווח המינימלי מהתור הקודם' });
  if (!Object.keys(critRuleRaw(key, GAP_VALS.late)).length) {
    critRuleSetVal(key, GAP_VALS.late, 'pay', { mode: 'full', force: true });
    critRuleSetVal(key, GAP_VALS.late, 'block', { mode: 'cond', reason: 'חלף המועד מהפגישה הקודמת — בתשלום מלא' });
  }
}

/* ---------------- תצוגה: באנר החלון בהצעת הזמנים ---------------- */
function gapBarHTML(r) {
  const defs = gapDefsFor(r); if (!defs.length) return '';
  const rows = defs.map(d => { const w = gapWindow(d, r), c = gapCfg(d);
    if (!w.prev) return `<div class="gapb-line miss">${ic('alert')} <b>${esc(d.label)}</b> — לא נמצאה פגישה קודמת, החלון אינו מחושב</div>`;
    return `<div class="gapb-line">${ic('calendar')} <b>${esc(d.label)}</b>
      <span>הפגישה הקודמת ${esc(gapHeb(w.prevISO))}</span>
      <span class="gapb-win">ניתן לתאם: <b>${w.from ? esc(gapHeb(w.from)) : 'מיד'}</b> – <b>${w.to ? esc(gapHeb(w.to)) : 'ללא הגבלה'}</b></span>
      ${c.minOn ? `<span class="gapb-tag">מינימום ${esc(gapUnitLabel(c.minN, c.minU))}</span>` : ''}
      ${c.maxOn ? `<span class="gapb-tag">עד ${esc(gapUnitLabel(c.maxN, c.maxU))}</span>` : ''}</div>`;
  }).join('');
  return `<div class="gap-bar">${rows}
    <div class="gapb-foot">${ic('bolt')} מועדים מחוץ לחלון מסומנים ברשימה — חסומים או מותרים בתשלום, לפי הכללים שהוגדרו.</div></div>`;
}
/* תווית קצרה למשבצת מחוץ לחלון */
function gapSlotNote(r, ds) {
  const c = gapCheckDate(r, ds);
  if (!c.lines.length) return null;
  const l = c.lines[0];
  return { hard: c.blocked, pay: c.pay, text: l.val + ' · ' + l.reason, state: l.state };
}

/* ---------------- רישום הסוג ברישום הקריטריונים ---------------- */
function gapInit(key, def) {
  def.values = [GAP_VALS.early, GAP_VALS.ok, GAP_VALS.late];
  def.gap = def.gap || { minOn: false, minN: 20, minU: 'days', maxOn: true, maxN: 8, maxU: 'months' };
  if (typeof needsSave === 'function') needsSave();
  gapSeedRules(key);
}
if (typeof CRIT_KINDS !== 'undefined' && !CRIT_KINDS.some(k => k.key === 'gap')) {
  CRIT_KINDS.push({ key: 'gap', label: 'חלון תיאום מהפגישה הקודמת', icon: 'calendar', group: 'smart', derived: true,
    desc: 'מינימום ו/או מקסימום זמן מהתור הקודם — מסנן את המועדים המוצעים',
    dataLabel: 'תאריך הפגישה הקודמת', dataPh: 'dd/mm/yyyy',
    panel: 'gapDefinePanel', panelBind: 'gapBindDefine', derive: 'gapDerive', initFn: 'gapInit' });
}
