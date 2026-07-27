/* ============================================================
   קריטריונים — היקף (Scope) + כללים והשלכות (Rules)   · מודול עצמאי
   ------------------------------------------------------------
   שכבה שנייה מעל רישום הקריטריונים (needs-criteria.js), בלי לגעת בו:

   1) היקף — "רק אם רלוונטי" לא אומר "כל הסניפים וכל השירותים".
      כאן קובעים במקום אחד:
        • לאילו שירותים בקטלוג הקריטריון שייך  → נכתב ל-t.critKeys (הקטלוג)
        • באילו סניפים הוא פעיל                → CRIT_SCOPE[key].branches
        • אילו ערכים כל סניף מכבד (מטריצה)     → נכתב ל-b.brCriteria[label]
      אין כפילות: הקטלוג והסניפים נשארים מקור-האמת — כאן רק עורכים אותם.

   2) "אחר" — בכל קריטריון קיימת אוטומטית האפשרות "אחר / לא מהרשימה",
      שמשמעותה: **הקריטריון אינו נתמך במקרה הזה**. למשל הסדר קופה
      כללית/לאומית — לקוח ממכבי יסומן "אחר" והמערכת תקבע תשלום מלא.

   3) כללים והשלכות — לכל קריטריון (גורף) ולכל ערך בנפרד:
      אופן תשלום · תמחור · תורים משוריינים · אחריות · מסמכים נדרשים ·
      אישור מראש · משך טיפול · הערה לנציג · כללים נוספים (חופשי).
      הרישום CRIT_EFFECTS הוא נקודת ההרחבה: הוספת סוג כלל חדש = רשומה אחת.
   ============================================================ */

/* אייקונים נוספים (תוספת בלבד לרישום הקיים) */
if (typeof ICONS !== 'undefined') {
  if (!ICONS.shekel) ICONS.shekel = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 5h7a4 4 0 0 1 4 4v10"/><path d="M18 19h-7a4 4 0 0 1-4-4V5"/></svg>';
  if (!ICONS.shield) ICONS.shield = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
  if (!ICONS.ticket) ICONS.ticket = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12" stroke-dasharray="2 2"/></svg>';
}

const CRIT_ALL = '__all';        // כללים שחלים על כל ערכי הקריטריון
const CRIT_OTHER = '__other';    // "אחר / לא מהרשימה" — הקריטריון אינו נתמך
const CRIT_OTHER_LABEL = 'אחר / לא מהרשימה';

/* ---------------- אחסון ---------------- */
let CRIT_RULES = (function () { try { return JSON.parse(localStorage.getItem('cb_critRules')) || {}; } catch (e) { return {}; } })();
let CRIT_SCOPE = (function () { try { return JSON.parse(localStorage.getItem('cb_critScope')) || {}; } catch (e) { return {}; } })();
function critSave() { try { localStorage.setItem('cb_critRules', JSON.stringify(CRIT_RULES)); localStorage.setItem('cb_critScope', JSON.stringify(CRIT_SCOPE)); } catch (e) {} }

/* ---------------- רישום סוגי הכללים (נקודת ההרחבה) ---------------- */
const CRIT_PAY_MODES = [
  { key: 'default', label: 'ברירת מחדל (לפי הקטלוג)', rank: 0 },
  { key: 'exempt', label: 'ללא תשלום — פטור מלא', rank: 1, badge: 'ללא תשלום' },
  { key: 'copay', label: 'השתתפות עצמית', rank: 2, amount: true, badge: v => 'השתתפות ' + (v || 0) + ' ₪' },
  { key: 'deposit', label: 'מקדמה בלבד', rank: 3, amount: true, badge: v => 'מקדמה ' + (v || 0) + ' ₪' },
  { key: 'refund', label: 'תשלום מלא + החזר בדיעבד', rank: 4, badge: 'החזר בדיעבד' },
  { key: 'full', label: 'תשלום מלא', rank: 5, badge: 'תשלום מלא' },
];
function critPayMode(k) { return CRIT_PAY_MODES.find(m => m.key === k) || CRIT_PAY_MODES[0]; }
function critPayBadge(pay) { const m = critPayMode(pay && pay.mode); return typeof m.badge === 'function' ? m.badge(pay.amount) : (m.badge || ''); }

const CRIT_PRICE_MODES = [
  { key: 'none', label: 'ללא שינוי' },
  { key: 'fixed', label: 'מחיר קבוע (₪)', unit: '₪' },
  { key: 'off', label: 'הנחה (₪)', unit: '₪' },
  { key: 'pct', label: 'הנחה (%)', unit: '%' },
  { key: 'add', label: 'תוספת (₪)', unit: '₪' },
];
function critPriceBadge(p) {
  if (!p || !p.mode || p.mode === 'none') return '';
  const v = +p.val || 0;
  return p.mode === 'fixed' ? v + ' ₪ קבוע' : p.mode === 'off' ? '−' + v + ' ₪' : p.mode === 'pct' ? '−' + v + '%' : '+' + v + ' ₪';
}

const CRIT_EFFECTS = [
  { key: 'pay', label: 'אופן תשלום', icon: 'shekel', def: () => ({ mode: 'default', amount: 0, force: false }),
    active: v => !!v.mode && v.mode !== 'default',
    badge: v => critPayBadge(v) + (v.force ? ' (גובר)' : ''),
    html: v => `<label class="cre-f"><span>מצב</span><select class="cc-inp sm" data-cre="pay|mode">${CRIT_PAY_MODES.map(m => `<option value="${m.key}" ${v.mode === m.key ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      ${critPayMode(v.mode).amount ? `<label class="cre-f"><span>סכום (₪)</span><input class="cc-inp sm" type="number" min="0" data-cre="pay|amount" value="${+v.amount || 0}"></label>` : ''}
      ${v.mode && v.mode !== 'default' ? `<label class="cre-f chk"><input type="checkbox" data-cre="pay|force" ${v.force ? 'checked' : ''}><span>כלל <b>גובר</b> — מבטל כללי תשלום אחרים</span></label>` : ''}` },

  { key: 'price', label: 'תמחור', icon: 'flag', def: () => ({ mode: 'none', val: 0, force: false }),
    active: v => !!v.mode && v.mode !== 'none',
    badge: v => critPriceBadge(v) + (v.force ? ' (גובר)' : ''),
    html: v => `<label class="cre-f"><span>שינוי מחיר</span><select class="cc-inp sm" data-cre="price|mode">${CRIT_PRICE_MODES.map(m => `<option value="${m.key}" ${v.mode === m.key ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      ${v.mode && v.mode !== 'none' ? `<label class="cre-f"><span>ערך</span><input class="cc-inp sm" type="number" min="0" data-cre="price|val" value="${+v.val || 0}"></label>
      <label class="cre-f chk"><input type="checkbox" data-cre="price|force" ${v.force ? 'checked' : ''}><span>כלל <b>גובר</b> — מבטל שינויי מחיר אחרים</span></label>` : ''}` },

  { key: 'slots', label: 'תורים משוריינים', icon: 'ticket', def: () => ({ on: false, weekly: 0, window: '', branchOnly: false }),
    active: v => !!v.on,
    badge: v => v.on ? (v.weekly ? v.weekly + ' תורים/שבוע' : 'תורים משוריינים') + (v.window ? ' · ' + v.window : '') : '',
    html: v => `<label class="cre-f chk"><input type="checkbox" data-cre="slots|on" ${v.on ? 'checked' : ''}><span>קיימת מכסת תורים משוריינת למקרים אלו</span></label>
      ${v.on ? `<label class="cre-f"><span>כמות לשבוע</span><input class="cc-inp sm" type="number" min="0" max="99" data-cre="slots|weekly" value="${+v.weekly || 0}"></label>
      <label class="cre-f wide"><span>חלון זמן / הערה</span><input class="cc-inp sm" data-cre="slots|window" value="${esc(v.window || '')}" placeholder="למשל: ימי ג׳ 16:00–18:00 · סניף ירושלים"></label>
      <label class="cre-f chk"><input type="checkbox" data-cre="slots|branchOnly" ${v.branchOnly ? 'checked' : ''}><span>רק בסניפים שבהיקף הקריטריון</span></label>` : ''}` },

  { key: 'warranty', label: 'אחריות', icon: 'shield', def: () => ({ months: 0, text: '' }),
    active: v => !!(+v.months || (v.text || '').trim()),
    badge: v => (+v.months ? 'אחריות ' + v.months + ' ח׳' : (v.text ? 'אחריות' : '')),
    html: v => `<label class="cre-f"><span>חודשי אחריות</span><input class="cc-inp sm" type="number" min="0" max="120" data-cre="warranty|months" value="${+v.months || 0}"></label>
      <label class="cre-f wide"><span>נוסח / תנאי אחריות</span><input class="cc-inp sm" data-cre="warranty|text" value="${esc(v.text || '')}" placeholder="למשל: תיקון חוזר ללא עלות תוך 3 חודשים"></label>` },

  { key: 'docs', label: 'מסמכים נדרשים', icon: 'docs', def: () => ({ list: [] }),
    active: v => !!(v.list || []).length,
    badge: v => (v.list || []).length ? 'נדרש: ' + v.list.join(' · ') : '',
    html: v => `<div class="cre-f wide"><span>מסמכים שהלקוח חייב להביא <small class="muted">(Enter לכל מסמך)</small></span>
      <div class="ccr-tags sm" data-credocs>${(v.list || []).map((d, i) => `<span class="ccr-tag">${esc(d)}<button type="button" data-credocdel="${i}">${ic('close')}</button></span>`).join('')}
        <input class="ccr-valinp" data-credocadd placeholder="למשל: התחייבות קופה 17"></div></div>` },

  { key: 'approval', label: 'אישור מראש', icon: 'check', def: () => ({ on: false, by: '' }),
    active: v => !!v.on,
    badge: v => v.on ? 'דורש אישור' + (v.by ? ' · ' + v.by : '') : '',
    html: v => `<label class="cre-f chk"><input type="checkbox" data-cre="approval|on" ${v.on ? 'checked' : ''}><span>חייב אישור לפני קביעת התור</span></label>
      ${v.on ? `<label class="cre-f wide"><span>מי מאשר</span><input class="cc-inp sm" data-cre="approval|by" value="${esc(v.by || '')}" placeholder="למשל: מנהל הסניף / מוקד הקופה"></label>` : ''}` },

  { key: 'duration', label: 'משך הטיפול', icon: 'clock', def: () => ({ delta: 0 }),
    active: v => !!+v.delta,
    badge: v => +v.delta ? (v.delta > 0 ? '+' : '') + v.delta + ' ד׳' : '',
    html: v => `<label class="cre-f"><span>תוספת/קיצור (דקות)</span><input class="cc-inp sm" type="number" min="-120" max="240" data-cre="duration|delta" value="${+v.delta || 0}"></label>` },

  { key: 'note', label: 'הערה לנציג', icon: 'note', def: () => ({ text: '' }),
    active: v => !!(v.text || '').trim(),
    badge: v => (v.text || '').slice(0, 40),
    html: v => `<label class="cre-f wide"><span>תוצג לנציג בעת התיאום</span><input class="cc-inp sm" data-cre="note|text" value="${esc(v.text || '')}" placeholder="למשל: לוודא מול הקופה לפני ההגעה"></label>` },

  { key: 'block', label: 'ביצוע / חסימה', icon: 'lock', def: () => ({ mode: 'allow', reason: '' }),
    active: v => !!v.mode && v.mode !== 'allow',
    badge: v => v.mode === 'block' ? 'לא מבוצע' : v.mode === 'cond' ? 'מותר בתנאי' : '',
    html: v => `<label class="cre-f"><span>מצב</span><select class="cc-inp sm" data-cre="block|mode">
        <option value="allow" ${v.mode === 'allow' ? 'selected' : ''}>מותר לביצוע</option>
        <option value="cond" ${v.mode === 'cond' ? 'selected' : ''}>מותר בתנאי (אישור / ליווי / מסמך)</option>
        <option value="block" ${v.mode === 'block' ? 'selected' : ''}>לא מבוצע — חוסם תיאום</option></select></label>
      ${v.mode && v.mode !== 'allow' ? `<label class="cre-f wide"><span>נימוק שיוצג לנציג</span><input class="cc-inp sm" data-cre="block|reason" value="${esc(v.reason || '')}" placeholder="למשל: מתחת לגיל המינימלי / חלפו יותר מ-8 חודשים מהבדיקה"></label>` : ''}` },

  { key: 'override', label: 'חריגה באישור', icon: 'shield', def: () => ({ on: false, by: '', waive: 'pay' }),
    active: v => !!v.on,
    badge: v => v.on ? 'חריגה: ' + (v.by || 'מאשר מוסמך') : '',
    html: v => `<label class="cre-f chk"><input type="checkbox" data-cre="override|on" ${v.on ? 'checked' : ''}><span>ניתן לאשר חריגה מהכלל</span></label>
      ${v.on ? `<label class="cre-f"><span>מי מאשר</span><input class="cc-inp sm" data-cre="override|by" value="${esc(v.by || '')}" placeholder="למשל: רופא / מנהל רפואי"></label>
      <label class="cre-f"><span>מה החריגה מבטלת</span><select class="cc-inp sm" data-cre="override|waive">
        <option value="pay" ${v.waive === 'pay' ? 'selected' : ''}>את התשלום</option>
        <option value="block" ${v.waive === 'block' ? 'selected' : ''}>את החסימה</option>
        <option value="both" ${v.waive === 'both' ? 'selected' : ''}>גם וגם</option></select></label>` : ''}` },

  { key: 'extra', label: 'כללים נוספים', icon: 'plus', def: () => ({ list: [] }),
    active: v => !!(v.list || []).length,
    badge: v => (v.list || []).map(x => x.k + ': ' + x.v).join(' · ').slice(0, 60),
    html: v => `<div class="cre-f wide"><span>כלל חופשי <small class="muted">(שם + ערך — לכל דבר שאין לו שדה מובנה)</small></span>
      <div class="cre-extra">${(v.list || []).map((x, i) => `<div class="cre-extra-row"><b>${esc(x.k)}</b><span>${esc(x.v)}</span><button class="whs-del" data-creexdel="${i}">${ic('close')}</button></div>`).join('')}
        <div class="cre-extra-add"><input class="cc-inp sm" data-creexk placeholder="שם הכלל"><input class="cc-inp sm" data-creexv placeholder="ערך / תיאור"><button class="btn xs primary" data-creexadd>${ic('plus')} הוסף</button></div></div></div>` },
];
function critEffectDef(k) { return CRIT_EFFECTS.find(e => e.key === k); }

/* ---------------- קריאה/כתיבה של ערכות כללים ---------------- */
function critRuleRaw(key, val) { return ((CRIT_RULES[key] || {})[val]) || {}; }
function critRuleGet(key, val) {
  const raw = critRuleRaw(key, val), out = {};
  CRIT_EFFECTS.forEach(e => { out[e.key] = Object.assign(e.def(), raw[e.key] || {}); });
  // ברירת מחדל ל"אחר": הקריטריון אינו נתמך → תשלום מלא
  if (val === CRIT_OTHER && !(raw.pay && raw.pay.mode)) out.pay = { mode: 'full', amount: 0 };
  return out;
}
function critRuleSetVal(key, val, effKey, patch) {
  CRIT_RULES[key] = CRIT_RULES[key] || {};
  CRIT_RULES[key][val] = CRIT_RULES[key][val] || {};
  CRIT_RULES[key][val][effKey] = Object.assign({}, CRIT_RULES[key][val][effKey], patch);
  critSave();
}
function critRuleClear(key, val) { if (CRIT_RULES[key]) { delete CRIT_RULES[key][val]; critSave(); } }
/* האם לערך יש כללים פעילים (לתגית בטבלה) */
function critActiveEffects(key, val) {
  const rs = critRuleGet(key, val);
  return CRIT_EFFECTS.filter(e => e.active(rs[e.key])).map(e => ({ e: e, v: rs[e.key], badge: e.badge(rs[e.key]) }));
}
function critHasAnyRules(key) {
  const vals = [CRIT_ALL, CRIT_OTHER].concat(critValuesOf(key));
  return vals.some(v => critActiveEffects(key, v).length);
}
function critValuesOf(key) { const d = (typeof needsDefOf === 'function') ? needsDefOf(key) : null; return (d && d.values) || []; }
function critLabelOf(key) { const d = (typeof needsDefOf === 'function') ? needsDefOf(key) : null; return d ? d.label : key; }
function critValLabel(val) { return val === CRIT_ALL ? 'כל הערכים (גורף)' : val === CRIT_OTHER ? CRIT_OTHER_LABEL : val; }

/* ---------------- היקף: שירותים · סניפים · ערכים לפי סניף ---------------- */
function critScopeOf(key) {
  const s = CRIT_SCOPE[key] || {};
  return { branchMode: s.branchMode || 'auto', branches: (s.branches || []).slice() };
}
function critScopeSet(key, patch) { CRIT_SCOPE[key] = Object.assign({}, CRIT_SCOPE[key], patch); critSave(); }
/* שירותים — מקור האמת הוא הקטלוג (t.critKeys) */
function critSvcKeys(key) { return (typeof COORD_TREATMENTS === 'undefined') ? [] : COORD_TREATMENTS.filter(t => (t.critKeys || []).indexOf(key) >= 0).map(t => t.key); }
function critToggleSvc(key, svcKey) {
  const t = (typeof cTreat === 'function') ? cTreat(svcKey) : null; if (!t) return;
  t.critKeys = t.critKeys || [];
  const i = t.critKeys.indexOf(key);
  if (i >= 0) t.critKeys.splice(i, 1); else t.critKeys.push(key);
  critMirrorSvcs(key);
}
function critSetAllSvcs(key, on) {
  if (typeof COORD_TREATMENTS === 'undefined') return;
  COORD_TREATMENTS.forEach(t => { t.critKeys = t.critKeys || []; const i = t.critKeys.indexOf(key);
    if (on && i < 0) t.critKeys.push(key); if (!on && i >= 0) t.critKeys.splice(i, 1); });
  critMirrorSvcs(key);
}
/* הקטלוג והסניפים הם מקור-האמת בזמן ריצה, אבל הם בזיכרון בלבד —
   לכן נשמר כאן "מראה" מתמידה של השיוך, ומוחזרת לקטלוג בטעינה. */
function critMirrorSvcs(key) { critScopeSet(key, { svcs: critSvcKeys(key) }); }
function critMirrorBrVals(key) {
  const map = {};
  (typeof COORD_BRANCHES === 'undefined' ? [] : COORD_BRANCHES).forEach(b => {
    const v = (b.brCriteria || {})[critLabelOf(key)]; if (v && v.length) map[b.key] = v.slice();
  });
  critScopeSet(key, { brVals: map });
}
function critRestoreScope() {
  let dirty = false;
  Object.keys(CRIT_SCOPE || {}).forEach(key => {
    if (typeof needsDefOf === 'function' && !needsDefOf(key)) { delete CRIT_SCOPE[key]; if (typeof CRIT_RULES !== 'undefined') delete CRIT_RULES[key]; return; }
    const sc = CRIT_SCOPE[key] || {};
    if (sc.svcs && typeof COORD_TREATMENTS !== 'undefined') {
      COORD_TREATMENTS.forEach(t => { t.critKeys = t.critKeys || [];
        const should = sc.svcs.indexOf(t.key) >= 0, i = t.critKeys.indexOf(key);
        if (should && i < 0) t.critKeys.push(key); if (!should && i >= 0) t.critKeys.splice(i, 1); });
    }
    if (sc.brVals && typeof COORD_BRANCHES !== 'undefined') {
      const lbl = critLabelOf(key);
      COORD_BRANCHES.forEach(b => { const v = sc.brVals[b.key]; if (!v) return;
        b.brCriteria = b.brCriteria || {}; b.critMode = b.critMode || {};
        if (!b.critMode[lbl]) b.critMode[lbl] = 'general';
        b.brCriteria[lbl] = v.slice(); });
    }
  });
}
/* סניפים בהיקף: auto = כל סניף פעיל שמציע לפחות אחד מהשירותים המשויכים */
function critBranchKeys(key) {
  const brs = (typeof COORD_BRANCHES === 'undefined') ? [] : COORD_BRANCHES.filter(b => b.active !== false);
  const sc = critScopeOf(key);
  if (sc.branchMode === 'pick') return brs.filter(b => sc.branches.indexOf(b.key) >= 0).map(b => b.key);
  const svcs = critSvcKeys(key);
  if (!svcs.length) return [];
  return brs.filter(b => svcs.some(k => (b.treatments || []).indexOf(k) >= 0)).map(b => b.key);
}
function critAppliesInBranch(key, bKey) { return critBranchKeys(key).indexOf(bKey) >= 0; }
/* אילו ערכים סניף מכבד — נשמר במבנה הקיים של הסניף (b.brCriteria לפי תווית) */
function critBranchVals(key, bKey) {
  const b = (typeof COORD_BRANCHES === 'undefined') ? null : COORD_BRANCHES.find(x => x.key === bKey);
  if (!b) return [];
  return ((b.brCriteria || {})[critLabelOf(key)] || []).slice();
}
function critToggleBranchVal(key, bKey, val) {
  const b = (typeof COORD_BRANCHES === 'undefined') ? null : COORD_BRANCHES.find(x => x.key === bKey); if (!b) return;
  const lbl = critLabelOf(key);
  b.brCriteria = b.brCriteria || {}; b.critMode = b.critMode || {};
  if (!b.critMode[lbl]) b.critMode[lbl] = 'general';
  const arr = b.brCriteria[lbl] = (b.brCriteria[lbl] || []).slice();
  const i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); else arr.push(val);
  b.brCriteria[lbl] = arr;
  critMirrorBrVals(key);
}
function critSetBranchAll(key, bKey, on) {
  const b = (typeof COORD_BRANCHES === 'undefined') ? null : COORD_BRANCHES.find(x => x.key === bKey); if (!b) return;
  const lbl = critLabelOf(key);
  b.brCriteria = b.brCriteria || {}; b.critMode = b.critMode || {};
  if (!b.critMode[lbl]) b.critMode[lbl] = 'general';
  b.brCriteria[lbl] = on ? critValuesOf(key).slice() : [];
  critMirrorBrVals(key);
}

/* ---------------- חישוב ההשלכות על ליד ---------------- */
/* כל הקריטריונים שנענו ברשומה + ערכות הכללים שחלות עליהם */
function critAppliedFor(r) {
  if (typeof critSyncDerived === 'function') critSyncDerived(r);   // קריטריונים נגזרים (גיל · תוקף · סבב · הצהרה)
  const n = (r && r.needs) || {}, out = [];
  Object.keys(n).forEach(k => {
    if (k.indexOf('c_') !== 0 || !n[k]) return;
    const def = (typeof needsDefOf === 'function') ? needsDefOf(k) : null; if (!def) return;
    out.push({ key: k, label: def.label, val: n[k], valLabel: critValLabel(n[k]),
      all: critRuleGet(k, CRIT_ALL), own: critRuleGet(k, n[k]), rawOwn: critRuleRaw(k, n[k]), rawAll: critRuleRaw(k, CRIT_ALL) });
  });
  return out;
}
/* מיזוג: ערך ספציפי גובר על "כל הערכים" */
function critMergedRules(a) {
  const out = {};
  CRIT_EFFECTS.forEach(e => {
    const ownActive = e.active(a.own[e.key]), allActive = e.active(a.all[e.key]);
    out[e.key] = { v: ownActive ? a.own[e.key] : allActive ? a.all[e.key] : e.def(), on: ownActive || allActive, from: ownActive ? a.valLabel : allActive ? 'כל הערכים' : '' };
  });
  return out;
}
/* אגרגציה של כל הקריטריונים שנענו */
function critEffects(r) {
  const agg = { pay: null, payRejected: [], payWaived: [], price: [], slots: [], warranty: [], docs: [], approval: [], durDelta: 0, notes: [], extra: [] };
  critAppliedFor(r).forEach(a => {
    const m = critMergedRules(a), src = a.label + ' = ' + a.valLabel;
    // חריגה שאושרה בליד (למשל: רופא אישר ללא תשלום) מבטלת את כלל התשלום
    const ovr = (typeof critOverridesOf === 'function') ? critOverridesOf(r)[a.key] : null;
    const payWaived = ovr && (ovr.waive === 'pay' || ovr.waive === 'both');
    if (m.pay.on && payWaived) agg.payWaived.push({ src: src, by: ovr.by, at: ovr.at, was: critPayBadge(m.pay.v) });
    else if (m.pay.on) {
      const cand = { mode: m.pay.v.mode, amount: +m.pay.v.amount || 0, src: src, rank: critPayMode(m.pay.v.mode).rank, force: !!m.pay.v.force };
      if (!agg.pay) agg.pay = cand;
      else if (cand.force && !agg.pay.force) { agg.payRejected.push(agg.pay); agg.pay = cand; }
      else if (!cand.force && agg.pay.force) agg.payRejected.push(cand);
      else if (cand.rank > agg.pay.rank) { agg.payRejected.push(agg.pay); agg.pay = cand; }
      else agg.payRejected.push(cand);
    }
    if (m.price.on) agg.price.push({ mode: m.price.v.mode, val: +m.price.v.val || 0, src: src, force: !!m.price.v.force });
    if (m.slots.on) agg.slots.push({ weekly: +m.slots.v.weekly || 0, window: m.slots.v.window || '', branchOnly: !!m.slots.v.branchOnly, src: src });
    if (m.warranty.on) agg.warranty.push({ months: +m.warranty.v.months || 0, text: m.warranty.v.text || '', src: src });
    if (m.docs.on) (m.docs.v.list || []).forEach(d => { if (agg.docs.indexOf(d) < 0) agg.docs.push(d); });
    if (m.approval.on) agg.approval.push({ by: m.approval.v.by || '', src: src });
    if (m.duration.on) agg.durDelta += +m.duration.v.delta || 0;
    if (m.note.on) agg.notes.push({ text: m.note.v.text, src: src });
    if (m.extra.on) (m.extra.v.list || []).forEach(x => agg.extra.push({ k: x.k, v: x.v, src: src }));
  });
  return agg;
}
/* מחיר סופי אחרי כללי הקריטריונים */
function critPriceFor(r, baseOverride) {
  const svcs = (r && r.services) || [];
  let base = baseOverride;
  if (base === undefined) base = (typeof svcTotals === 'function' && svcs.length) ? svcTotals(svcs).price : 0;
  const agg = critEffects(r), lines = [];
  let val = base;
  const forcedP = agg.price.some(p => p.force);
  const priceList = forcedP ? agg.price.filter(p => p.force) : agg.price;
  const order = ['fixed', 'off', 'pct', 'add'];
  order.forEach(mode => priceList.filter(p => p.mode === mode).forEach(p => {
    const before = val;
    if (mode === 'fixed') val = p.val;
    else if (mode === 'off') val = Math.max(0, val - p.val);
    else if (mode === 'pct') val = Math.max(0, Math.round(val * (1 - p.val / 100)));
    else val = val + p.val;
    lines.push({ src: p.src, text: critPriceBadge(p), before: before, after: val });
  }));
  if (agg.pay && agg.pay.mode === 'exempt') { if (val !== 0) lines.push({ src: agg.pay.src, text: 'פטור מתשלום', before: val, after: 0 }); val = 0; }
  else if (agg.pay && agg.pay.mode === 'copay') { if (val !== agg.pay.amount) lines.push({ src: agg.pay.src, text: 'השתתפות עצמית', before: val, after: agg.pay.amount }); val = agg.pay.amount; }
  return { base: base, final: val, lines: lines, agg: agg };
}
/* רמז קצר לאפשרות בשאלת הצורך (מוצג מתחת לכפתור) */
function critOptionHint(key, val) {
  if (!val) return '';
  const eff = critActiveEffects(key, val).map(x => x.badge).filter(Boolean);
  if (val === CRIT_OTHER && !eff.length) return 'תשלום מלא';
  return eff.slice(0, 2).join(' · ');
}

/* ---------------- תצוגה: פס השלכות (ליד / הצעת זמנים / סליקה) ---------------- */
function critEffectsBarHTML(r) {
  const applied = critAppliedFor(r); if (!applied.length) return '';
  const p = critPriceFor(r), a = p.agg, chips = [];
  if (a.pay) chips.push({ i: 'shekel', t: critPayBadge(a.pay), s: a.pay.src, cls: a.pay.mode === 'exempt' ? 'good' : a.pay.mode === 'full' ? 'warn' : '' });
  if (p.final !== p.base) chips.push({ i: 'flag', t: p.base + ' ₪ ← ' + p.final + ' ₪', s: p.lines.map(l => l.src).join(' · '), cls: p.final < p.base ? 'good' : 'warn' });
  a.slots.forEach(s => chips.push({ i: 'ticket', t: (s.weekly ? s.weekly + ' תורים משוריינים/שבוע' : 'תורים משוריינים') + (s.window ? ' · ' + s.window : ''), s: s.src, cls: 'good' }));
  a.warranty.forEach(w => chips.push({ i: 'shield', t: (w.months ? 'אחריות ' + w.months + ' ח׳' : 'אחריות') + (w.text ? ' · ' + w.text : ''), s: w.src }));
  if (a.docs.length) chips.push({ i: 'docs', t: 'נדרש: ' + a.docs.join(' · '), s: 'קריטריונים', cls: 'warn' });
  a.approval.forEach(x => chips.push({ i: 'check', t: 'דורש אישור מראש' + (x.by ? ' · ' + x.by : ''), s: x.src, cls: 'warn' }));
  if (a.durDelta) chips.push({ i: 'clock', t: (a.durDelta > 0 ? '+' : '') + a.durDelta + ' דקות טיפול', s: 'קריטריונים' });
  a.notes.forEach(x => chips.push({ i: 'note', t: x.text, s: x.src }));
  a.extra.forEach(x => chips.push({ i: 'plus', t: x.k + ': ' + x.v, s: x.src }));
  if (!chips.length) return '';
  return `<div class="crit-eff-bar">
    <div class="ceb-h">${ic('target')} השלכות הקריטריונים<small>${applied.map(x => esc(x.label + ' = ' + x.valLabel)).join(' · ')}</small></div>
    <div class="ceb-chips">${chips.map(c => `<span class="ceb-chip ${c.cls || ''}" title="${esc(c.s || '')}">${ic(c.i)} ${esc(c.t)}${c.s ? `<small>${esc(c.s)}</small>` : ''}</span>`).join('')}</div>
    ${a.payWaived && a.payWaived.length ? `<div class="ceb-note ok">${ic('shield')} חריגה שאושרה: ${a.payWaived.map(x => esc(x.was + ' בוטל · ' + x.src + ' · ' + x.by + ' · ' + x.at)).join(' · ')}</div>` : ''}
    ${a.payRejected.length ? `<div class="ceb-note">${ic('alert')} נקבע התשלום המחמיר: <b>${esc(critPayBadge(a.pay))}</b> (${esc(a.pay.src)}) · נדחו: ${a.payRejected.map(x => esc(critPayBadge(x) + ' — ' + x.src)).join(' · ')}</div>` : ''}
  </div>`;
}

/* ---------------- פאנל המנהל: היקף וכללים ---------------- */
let critPanelTab = 'scope', critOpenVal = CRIT_ALL, critPanelKey = null, critPanelAfter = null, critPanelNew = false;
/* אשף: 1 סוג · 2 הגדרה · 3 שיוך · 4 כללים — שלב אחד בכל פעם */
let critWizStep = 1, critWizFam = '';
const CRIT_WIZ = [
  { n: 1, label: 'סוג', icon: 'layers' },
  { n: 2, label: 'הגדרה', icon: 'note' },
  { n: 3, label: 'שיוך', icon: 'org' },
  { n: 4, label: 'כללים', icon: 'bolt' },
];
/* מה חסר כדי לעבור הלאה */
function critWizMissing(step, key, def) {
  const kind = (typeof critKindOf === 'function') ? critKindOf(def) : { key: 'list' };
  if (step === 2) {
    if (!def.label || /^קריטריון חדש/.test(def.label)) return 'יש לתת שם לקריטריון';
    if (kind.key === 'list' && !(def.values || []).length) return 'יש להוסיף לפחות ערך אחד';
    if (kind.bands && !((def.bands || []).length)) return 'יש להגדיר לפחות טווח אחד';
    if (kind.key === 'decl' && !((def.decl || []).length)) return 'יש להוסיף לפחות שאלה אחת';
    if (kind.key === 'fit' && !(((def.fit || {}).items || []).length)) return 'יש להוסיף לפחות שאלה אחת';
    if (kind.key === 'gap') { const c = (typeof gapCfg === 'function') ? gapCfg(def) : {}; if (!c.minOn && !c.maxOn) return 'יש לסמן מרווח מינימלי או מועד אחרון'; }
    return '';
  }
  if (step === 3) {
    const cfg = (typeof needsCfgOf === 'function') ? needsCfgOf(def) : { ask: 'auto' };
    if (cfg.ask === 'auto' && typeof critSvcKeys === 'function' && !critSvcKeys(key).length) return 'יש לשייך לפחות שירות אחד (או לקבוע "תמיד נשאל")';
    return '';
  }
  return '';
}
function openCritRules(key, after) {
  critPanelKey = key; critPanelAfter = after || null; critPanelTab = 'scope'; critOpenVal = CRIT_ALL; critPanelNew = false;
  critWizStep = 1; critWizFam = '';
  const d0 = (typeof needsDefOf === 'function') ? needsDefOf(key) : null;
  if (d0 && d0.kind && typeof critGroupOf === 'function') critWizFam = critGroupOf(d0).key;   // קריטריון חדש מתחיל מבחירת משפחה
  const old = document.getElementById('critRulesPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'critRulesPanel';
  document.body.appendChild(w);
  renderCritRules();
  requestAnimationFrame(() => w.classList.add('open'));
}
function closeCritRules() {
  const w = document.getElementById('critRulesPanel'); if (w) w.remove();
  if (typeof critPanelAfter === 'function') critPanelAfter();
}
function renderCritRules() {
  const w = document.getElementById('critRulesPanel'); if (!w) return;
  const key = critPanelKey, def = (typeof needsDefOf === 'function') ? needsDefOf(key) : null; if (!def) { closeCritRules(); return; }
  const miss = critWizMissing(critWizStep, key, def);
  const body = critWizStep === 1 ? critWizKindHTML(key, def)
    : critWizStep === 2 ? critDefinePanelHTML(key, def)
    : critWizStep === 3 ? critScopePanelHTML(key, def)
    : critRulesPanelHTML(key, def);
  w.innerHTML = `<div class="cbc-box cr-box" style="max-width:680px;text-align:start">
    <div class="cbc-head"><span class="cbc-ic">${ic('target')}</span>
      <b>${esc(def.label && !/^קריטריון חדש/.test(def.label) ? def.label : 'קריטריון חדש')}</b>
      <button class="cr-x" id="crX">${ic('close')}</button></div>
    <div class="cr-steps">${CRIT_WIZ.map(st => `<button class="cr-stepbtn ${critWizStep === st.n ? 'on' : ''} ${critWizStep > st.n ? 'done' : ''}"
        data-crstep="${st.n}"><span class="crs-n">${critWizStep > st.n ? ic('check') : st.n}</span><span class="crs-l">${st.label}</span></button>`).join('')}</div>
    <div class="cr-body">${body}</div>
    <div class="cbc-actions cr-nav">
      ${critWizStep > 1 ? `<button class="btn ghost" id="crBack">${ic('chevronR')} הקודם</button>` : (critPanelNew ? `<button class="btn ghost" id="crCancelNew">${ic('close')} בטל</button>` : '')}
      ${miss ? `<span class="cr-miss">${ic('alert')} ${esc(miss)}</span>` : ''}
      ${critWizStep < 4 ? `<button class="btn primary" id="crNext" ${miss ? 'disabled' : ''}>הבא ${ic('chevronL')}</button>`
        : `<button class="btn primary" id="crDone">${ic('check')} ${critPanelNew ? 'סיום ויצירה' : 'סיום'}</button>`}
    </div></div>`;
  $('#crX').addEventListener('click', () => { if (critPanelNew && critWizMissing(2, key, def)) { critDiscardNew(); return; } closeCritRules(); });
  w.addEventListener('mousedown', e => { if (e.target === w) { if (critPanelNew && critWizMissing(2, key, def)) { critDiscardNew(); return; } closeCritRules(); } });
  $$('[data-crstep]', w).forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.crstep;
    if (n > critWizStep) { for (let k = critWizStep; k < n; k++) { const m = critWizMissing(k, key, def); if (m) { toast(m); return; } } }
    critWizStep = n; renderCritRules();
  }));
  const bk = $('#crBack'); if (bk) bk.addEventListener('click', () => { critWizStep--; renderCritRules(); });
  const nx = $('#crNext'); if (nx) nx.addEventListener('click', () => { const m = critWizMissing(critWizStep, key, def); if (m) { toast(m); return; } critWizStep++; renderCritRules(); });
  const dn = $('#crDone'); if (dn) dn.addEventListener('click', () => {
    for (let k = 1; k <= 3; k++) { const m = critWizMissing(k, key, def); if (m) { toast(m); critWizStep = k; renderCritRules(); return; } }
    if (critPanelNew) { critPanelNew = false; toast('הקריטריון נוצר · ' + def.label); }
    closeCritRules();
  });
  const cn = $('#crCancelNew'); if (cn) cn.addEventListener('click', critDiscardNew);
  if (critWizStep === 1) bindCritWizKind(key, def);
  else if (critWizStep === 2) { if (typeof bindCritDefinePanel === 'function') bindCritDefinePanel(key, def, renderCritRules); }
  else if (critWizStep === 3) bindCritScopePanel(key);
  else bindCritRulesPanel(key);
}
function critDiscardNew() {
  if (critPanelNew && typeof needsDeleteCustom === 'function') needsDeleteCustom(critPanelKey);
  critPanelNew = false; closeCritRules(); toast('בוטל');
}

/* --- שלב 1: משפחה → סוג (דריל-דאון, לא הכול פתוח) --- */
function critWizKindHTML(key, def) {
  const kind = (typeof critKindOf === 'function') ? critKindOf(def) : null;
  const groups = (typeof CRIT_GROUPS !== 'undefined') ? CRIT_GROUPS : [];
  if (!critWizFam) {
    return `<p class="cr-lead">${ic('bolt')} במה מדובר?</p>
      <div class="cr-fams">${groups.map(g => { const n = CRIT_KINDS.filter(k => (k.group || 'qa') === g.key).length;
        return `<button class="cr-fam ${g.key}" data-crfam="${g.key}">
          <span class="crf-ic">${ic(g.icon)}</span>
          <span class="crf-t"><b>${g.label}</b><small>${g.desc}</small></span>
          <span class="crf-n">${n}</span>${ic('chevronL')}</button>`; }).join('')}</div>`;
  }
  const g = groups.find(x => x.key === critWizFam) || groups[0];
  const list = CRIT_KINDS.filter(k => (k.group || 'qa') === g.key);
  return `<button class="cr-backfam" data-crfamback>${ic('chevronR')} כל המשפחות</button>
    <p class="cr-lead">${ic(g.icon)} <b>${g.label}</b> — ${g.desc}</p>
    <div class="cd-kinds">${list.map(k => `<button class="cd-kind ${kind && kind.key === k.key ? 'on' : ''}" data-cdkind="${k.key}">
      ${ic(k.icon)}<span><b>${k.label}</b><small>${k.desc}</small></span>${kind && kind.key === k.key ? ic('check') : ''}</button>`).join('')}</div>`;
}
function bindCritWizKind(key, def) {
  $$('[data-crfam]').forEach(b => b.addEventListener('click', () => { critWizFam = b.dataset.crfam; renderCritRules(); }));
  const bk = $('[data-crfamback]'); if (bk) bk.addEventListener('click', () => { critWizFam = ''; renderCritRules(); });
  $$('[data-cdkind]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.cdkind;
    if (typeof needsUpdateCustom === 'function') needsUpdateCustom(key, { kind: k });
    const raw = (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null;
    if (raw) {
      if (typeof critIsBands === 'function' && critIsBands(raw)) critSyncBandValues(raw);
      else if (typeof critIsDecl === 'function' && critIsDecl(raw)) critSyncDeclValues(raw);
      else { const kk = critKindOf(raw); if (kk.initFn && typeof window[kk.initFn] === 'function') window[kk.initFn](key, raw); }
      // שם ברירת מחדל לפי הסוג
      if (!raw.label || /^קריטריון חדש/.test(raw.label)) {
        const kk = critKindOf(raw);
        if (kk.key !== 'list' && typeof needsRenameCustom === 'function') { const nk = needsRenameCustom(key, kk.label); if (nk) critPanelKey = nk; }
      }
    }
    critWizStep = 2; renderCritRules();
  }));
}

/* --- לשונית היקף --- */
function critScopePanelHTML(key, def) {
  const cfg = (typeof needsCfgOf === 'function') ? needsCfgOf(def) : { ask: 'auto' };
  const cat = (typeof COORD_TREATMENTS === 'undefined') ? [] : COORD_TREATMENTS;
  const svcKeys = critSvcKeys(key), sc = critScopeOf(key);
  const brs = (typeof COORD_BRANCHES === 'undefined') ? [] : COORD_BRANCHES.filter(b => b.active !== false);
  const inScope = critBranchKeys(key), vals = critValuesOf(key);
  return `
    ${cfg.ask === 'always' ? `<div class="cr-warn">${ic('alert')} הקריטריון מוגדר <b>"תמיד"</b> — הוא נשאל בכל תיאום ללא תלות בהיקף.
      <button class="btn xs" id="crToAuto">העבר ל"רק אם רלוונטי"</button></div>` : ''}
    ${cfg.ask === 'never' ? `<div class="cr-warn">${ic('alert')} הקריטריון מוגדר <b>"לא נשאל"</b> — ההיקף והכללים לא יבואו לידי ביטוי.</div>` : ''}

    <div class="cr-sec">
      <div class="cr-h">${ic('tasks')} שירותים בקטלוג <small class="muted">— רק שירות שמסומן כאן יפעיל את הקריטריון (נשמר בכרטיס השירות)</small>
        <span class="cr-acts"><button class="btn xs" data-crsvcall="1">הכל</button><button class="btn xs" data-crsvcall="0">נקה</button></span></div>
      <div class="tag-wrap">${cat.map(t => `<button class="tag-chip ${svcKeys.indexOf(t.key) >= 0 ? 'on' : ''}" data-crsvc="${esc(t.key)}">${esc(t.label)}</button>`).join('')}</div>
      ${!svcKeys.length ? `<p class="cr-hint warn">${ic('alert')} לא שויך אף שירות — הקריטריון לא ייִשאל בשום תיאום.</p>` : ''}
    </div>

    <div class="cr-sec">
      <div class="cr-h">${ic('org')} סניפים
        <div class="br-mode-seg sm cr-seg">
          <button class="${sc.branchMode === 'auto' ? 'on' : ''}" data-crbmode="auto">אוטומטי — לפי השירותים</button>
          <button class="${sc.branchMode === 'pick' ? 'on' : ''}" data-crbmode="pick">סניפים נבחרים</button>
        </div></div>
      ${sc.branchMode === 'pick'
        ? `<div class="tag-wrap">${brs.map(b => `<button class="tag-chip ${sc.branches.indexOf(b.key) >= 0 ? 'on' : ''}" data-crbr="${esc(b.key)}">${esc(b.short || b.label)}</button>`).join('')}</div>`
        : `<p class="cr-hint">${ic('check')} פעיל בסניפים שמציעים את השירותים שנבחרו: <b>${inScope.length ? inScope.map(k => { const b = brs.find(x => x.key === k); return esc(b ? (b.short || b.label) : k); }).join(' · ') : 'אין'}</b></p>`}
    </div>

    ${vals.length && !(typeof critIsDerived === 'function' && critIsDerived(def)) ? `<div class="cr-sec">
      <div class="cr-h">${ic('layers')} אילו ערכים כל סניף מכבד <small class="muted">— למשל: הסדר מלא בירושלים רק עם כללית</small></div>
      <div class="table-wrap"><table class="mini-table cr-matrix">
        <thead><tr><th>סניף</th>${vals.map(v => `<th>${esc(v)}</th>`).join('')}<th>הכל</th></tr></thead>
        <tbody>${inScope.length ? inScope.map(bk => { const b = brs.find(x => x.key === bk) || {}; const sel = critBranchVals(key, bk);
          return `<tr><td><b>${esc(b.short || b.label || bk)}</b></td>
            ${vals.map(v => `<td><button class="cr-cell ${sel.indexOf(v) >= 0 ? 'on' : ''}" data-crmx="${esc(bk)}|${esc(v)}">${sel.indexOf(v) >= 0 ? ic('check') : ''}</button></td>`).join('')}
            <td><button class="btn xs" data-crmxall="${esc(bk)}|${sel.length === vals.length ? '0' : '1'}">${sel.length === vals.length ? 'נקה' : 'סמן הכל'}</button></td></tr>`;
        }).join('') : `<tr><td colspan="${vals.length + 2}"><small class="muted">אין סניפים בהיקף — בחר שירותים או סניפים למעלה.</small></td></tr>`}</tbody>
      </table></div>
      <p class="cr-hint">${ic('alert')} ערך שאינו מסומן בסניף → הסניף ייחסם ללקוח עם אותו ערך, עם הסבר. לקוח עם ערך שאינו ברשימה כלל יבחר <b>"${CRIT_OTHER_LABEL}"</b> ואז יחולו כללי "אחר".</p>
    </div>` : ''}`;
}
function bindCritScopePanel(key) {
  const RR = () => renderCritRules();
  const ta = $('#crToAuto'); if (ta) ta.addEventListener('click', () => { if (typeof needsCfgSet === 'function') needsCfgSet(key, { ask: 'auto' }); RR(); toast('הקריטריון יישאל רק כשרלוונטי'); });
  $$('[data-crsvc]').forEach(b => b.addEventListener('click', () => { critToggleSvc(key, b.dataset.crsvc); RR(); }));
  $$('[data-crsvcall]').forEach(b => b.addEventListener('click', () => { critSetAllSvcs(key, b.dataset.crsvcall === '1'); RR(); }));
  $$('[data-crbmode]').forEach(b => b.addEventListener('click', () => { critScopeSet(key, { branchMode: b.dataset.crbmode }); RR(); }));
  $$('[data-crbr]').forEach(b => b.addEventListener('click', () => {
    const sc = critScopeOf(key), k = b.dataset.crbr, i = sc.branches.indexOf(k);
    if (i >= 0) sc.branches.splice(i, 1); else sc.branches.push(k);
    critScopeSet(key, { branches: sc.branches }); RR();
  }));
  $$('[data-crmx]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.crmx.split('|'); critToggleBranchVal(key, p[0], p[1]); RR(); }));
  $$('[data-crmxall]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.crmxall.split('|'); critSetBranchAll(key, p[0], p[1] === '1'); RR(); }));
}

/* --- לשונית כללים --- */
function critRulesPanelHTML(key, def) {
  // ב"אחר" אין משמעות לקריטריון נגזר (גיל/תוקף/סבב/הצהרה) — הערך תמיד מחושב
  const derived = (typeof critIsDerived === 'function') && critIsDerived(def);
  const vals = [CRIT_ALL].concat(critValuesOf(key)).concat(derived ? [] : [CRIT_OTHER]);
  return `<p class="cr-hint">${ic('bolt')} כלל שנקבע על <b>ערך מסוים</b> גובר על הכלל הגורף. באפשרות <b>"${CRIT_OTHER_LABEL}"</b> מוגדר מה קורה כשהקריטריון <b>אינו נתמך</b> ללקוח — ברירת מחדל: תשלום מלא.</p>
    <div class="cr-vals">${vals.map(v => {
      const act = critActiveEffects(key, v), open = critOpenVal === v;
      return `<div class="cr-val ${open ? 'open' : ''} ${v === CRIT_OTHER ? 'other' : ''} ${v === CRIT_ALL ? 'allv' : ''}">
        <button class="cr-val-h" data-crval="${esc(v)}">
          <span class="cr-val-t">${v === CRIT_OTHER ? ic('alert') : v === CRIT_ALL ? ic('layers') : ic('check')} <b>${esc(critValLabel(v))}</b></span>
          <span class="cr-val-badges">${act.length ? act.map(x => `<span class="cr-badge">${ic(x.e.icon)} ${esc(x.badge || x.e.label)}</span>`).join('') : '<small class="muted">ללא כללים</small>'}</span>
          ${ic(open ? 'chevron' : 'chevronR')}</button>
        ${open ? `<div class="cr-val-body">
          ${CRIT_EFFECTS.map(e => { const rs = critRuleGet(key, v), on = e.active(rs[e.key]);
            return `<div class="cre ${on ? 'on' : ''}"><div class="cre-h">${ic(e.icon)} <b>${e.label}</b>${on ? `<span class="cre-on">${ic('check')} פעיל</span>` : ''}</div>
              <div class="cre-fields">${e.html(rs[e.key])}</div></div>`; }).join('')}
          ${act.length ? `<div class="cr-val-foot"><button class="btn xs ghost" data-crclear="${esc(v)}">${ic('close')} נקה את כל הכללים לערך זה</button></div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('')}</div>`;
}
function bindCritRulesPanel(key) {
  const RR = () => renderCritRules();
  $$('[data-crval]').forEach(b => b.addEventListener('click', () => { critOpenVal = (critOpenVal === b.dataset.crval) ? '' : b.dataset.crval; RR(); }));
  $$('[data-crclear]').forEach(b => b.addEventListener('click', () => { critRuleClear(key, b.dataset.crclear); RR(); toast('הכללים נוקו'); }));
  const val = critOpenVal; if (!val) return;
  // שדות רגילים — שמירה בכל שינוי
  $$('[data-cre]').forEach(inp => {
    const ev = (inp.tagName === 'SELECT' || inp.type === 'checkbox') ? 'change' : 'change';
    inp.addEventListener(ev, () => {
      const p = inp.dataset.cre.split('|');
      const v = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? (+inp.value || 0) : inp.value);
      critRuleSetVal(key, val, p[0], { [p[1]]: v });
      RR();
    });
  });
  // מסמכים — תגיות
  const da = $('[data-credocadd]'); if (da) da.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ',') return; e.preventDefault();
    const v = (da.value || '').replace(/,+$/, '').trim(); if (!v) return;
    const list = (critRuleGet(key, val).docs.list || []).slice(); if (list.indexOf(v) < 0) list.push(v);
    critRuleSetVal(key, val, 'docs', { list: list }); RR();
  });
  $$('[data-credocdel]').forEach(b => b.addEventListener('click', () => {
    const list = (critRuleGet(key, val).docs.list || []).slice(); list.splice(+b.dataset.credocdel, 1);
    critRuleSetVal(key, val, 'docs', { list: list }); RR();
  }));
  // כללים נוספים
  const ea = $('[data-creexadd]'); if (ea) ea.addEventListener('click', () => {
    const k = ($('[data-creexk]') || {}).value || '', v = ($('[data-creexv]') || {}).value || '';
    if (!k.trim()) { toast('נא להזין שם כלל'); return; }
    const list = (critRuleGet(key, val).extra.list || []).slice(); list.push({ k: k.trim(), v: v.trim() });
    critRuleSetVal(key, val, 'extra', { list: list }); RR();
  });
  $$('[data-creexdel]').forEach(b => b.addEventListener('click', () => {
    const list = (critRuleGet(key, val).extra.list || []).slice(); list.splice(+b.dataset.creexdel, 1);
    critRuleSetVal(key, val, 'extra', { list: list }); RR();
  }));
}
