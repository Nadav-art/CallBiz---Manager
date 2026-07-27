/* ============================================================
   קריטריונים נגזרים — טווחים, תוקף, סבב והצהרת בריאות   · מודול עצמאי
   ------------------------------------------------------------
   לא כל קריטריון הוא שאלה ללקוח. חלק **נגזרים מנתונים**:

     age    · גיל הלקוח            → עד 18 לא מבצעים · 18–21 בליווי/אישור · 21+ מותר
     since  · זמן מאז בדיקה/אירוע  → מכשיר שמיעה רק תוך 8 חודשים מהבדיקה
     count  · מספר הפעם (סבב)      → בדיקה ראשונה חינם · בדיקה חוזרת 500 ₪
     decl   · הצהרת בריאות         → שאלון שעוברים עם הלקוח; תשובה מסוימת פוסלת

   הרעיון: **טווח = ערך**. כל טווח מתנהג בדיוק כמו ערך רגיל, ולכן כל
   מנוע הכללים הקיים (תשלום · תמחור · מסמכים · אישור · תורים משוריינים)
   עובד עליו ללא שינוי. מה שנוסף כאן: איך מחשבים את הטווח, ושני כללים
   חדשים — "ביצוע / חסימה" ו"חריגה באישור" (למשל: אלא אם רופא מאשר).
   ============================================================ */

/* יחידות זמן לקריטריון "זמן שחלף" — נבחרות פר-קריטריון */
const CRIT_UNITS = [
  { key: 'days', label: 'ימים', one: 'יום' },
  { key: 'weeks', label: 'שבועות', one: 'שבוע' },
  { key: 'months', label: 'חודשים', one: 'חודש' },
  { key: 'years', label: 'שנים', one: 'שנה' },
];
function critUnitOf(def) { const u = (def && def.unit) || 'months'; return CRIT_UNITS.find(x => x.key === u) || CRIT_UNITS[2]; }
/* מקור התאריך שממנו סופרים */
const CRIT_BASIS = [
  { key: 'auto', label: 'מהפגישה הקודמת', desc: 'נשלף אוטומטית ממועד הפגישה/הבדיקה האחרונה של הלקוח' },
  { key: 'manual', label: 'תאריך שמוזן ידנית', desc: 'הנציג מזין את תאריך הבדיקה בבירור הצורך' },
];
function critBasisOf(def) { return (def && def.basis) || 'auto'; }
/* כמה חלף ביחידה הנבחרת */
function critElapsed(unitKey, d) {
  const t = critToday();
  if (unitKey === 'days') return Math.max(0, Math.round((t - d) / 86400000));
  if (unitKey === 'weeks') return Math.max(0, Math.floor((t - d) / 604800000));
  if (unitKey === 'years') return critYearsSince(d);
  return critMonthsSince(d);
}
/* מועד הפגישה/בדיקה הקודמת של הלקוח */
function critLastVisit(r) {
  if (!r) return null;
  if (r.lastVisit) return r.lastVisit;
  const m = r.meeting && r.meeting.date ? r.meeting.date : '';
  if (!m) return null;
  const d = critParseDate(m); if (!d) return null;
  return (d <= critToday()) ? m : null;      // פגישה עתידית אינה "הבדיקה הקודמת"
}

/* שלוש משפחות — הפרדה בין סוג הנתון לבין הלוגיקה העסקית */
const CRIT_GROUPS = [
  { key: 'data', label: 'שדות מידע', icon: 'user', desc: 'נתון על הלקוח — נקרא מהתיק או מוזן פעם אחת' },
  { key: 'qa', label: 'שאלות ותשובות', icon: 'tasks', desc: 'מה שואלים את הלקוח בשיחה' },
  { key: 'smart', label: 'קריטריונים חכמים', icon: 'bolt', desc: 'לוגיקה עסקית — חישובי זמן, חלונות תיאום וניתוב לשירות' },
];
const CRIT_KINDS = [
  { key: 'list', label: 'ערכים לבחירה', icon: 'layers', group: 'qa', desc: 'רשימת אפשרויות שנשאלת מהלקוח (הסדר קופה, סוג עור…)' },
  { key: 'age', label: 'גיל הלקוח', icon: 'user', group: 'data', bands: true, unit: 'שנים', derived: true,
    desc: 'טווחי גיל — נגזר מתאריך הלידה', dataLabel: 'תאריך לידה', dataPh: 'dd/mm/yyyy' },
  { key: 'since', label: 'זמן שחלף מאז בדיקה / אירוע', icon: 'clock', group: 'smart', bands: true, unit: 'חודשים', units: true, derived: true,
    desc: 'תוקף — ימים / שבועות / חודשים / שנים מהפגישה הקודמת', dataLabel: 'תאריך הבדיקה / האירוע', dataPh: 'dd/mm/yyyy' },
  { key: 'count', label: 'מספר הפעם (סבב)', icon: 'sync', group: 'data', bands: true, unit: 'פעמים', derived: true,
    desc: 'ראשונה / חוזרת — נגזר מהיסטוריית הלקוח', dataLabel: 'איזו פעם זו', dataPh: '1' },
  { key: 'decl', label: 'הצהרת בריאות (שאלון)', icon: 'docs', group: 'qa', decl: true, derived: true,
    desc: 'שאלון שעוברים עם הלקוח — תשובה מסוימת פוסלת מהשירות' },
];
function critKindOf(def) { return CRIT_KINDS.find(k => k.key === ((def && def.kind) || 'list')) || CRIT_KINDS[0]; }
function critIsDerived(def) { return !!critKindOf(def).derived; }
function critIsBands(def) { return !!critKindOf(def).bands; }
function critIsDecl(def) { return !!critKindOf(def).decl; }

/* ---------------- טווחים ---------------- */
/* band: { from, to, label }  — from כולל, to לא כולל, to=null = ומעלה */
function critBandsOf(def) { return (def && def.bands) || []; }
function critBandText(b, kind, def) {
  const u = (def && critKindOf(def).units) ? ' ' + critUnitOf(def).label : (kind && kind.unit ? ' ' + kind.unit : '');
  if (b.to == null) return b.from + u + ' ומעלה';
  if (!b.from) return 'עד ' + b.to + u;
  return b.from + '–' + b.to + u;
}
/* התוויות של הטווחים הן ה"ערכים" של הקריטריון — כך כל מנוע הכללים עובד ללא שינוי */
function critSyncBandValues(def) {
  if (!critIsBands(def)) return;
  def.values = critBandsOf(def).map(b => b.label);
  if (typeof needsSave === 'function') needsSave();
}
function critBandFor(def, num) {
  const bs = critBandsOf(def);
  for (let i = 0; i < bs.length; i++) { const b = bs[i];
    if (num >= (+b.from || 0) && (b.to == null || num < +b.to)) return b; }
  return null;
}
function critAddBand(def, from, to, label) {
  def.bands = critBandsOf(def).slice();
  def.bands.push({ from: +from || 0, to: (to === '' || to == null) ? null : +to, label: (label || '').trim() || 'טווח' });
  def.bands.sort((a, b) => (+a.from || 0) - (+b.from || 0));
  critSyncBandValues(def);
}
function critDelBand(def, i) { def.bands = critBandsOf(def).slice(); def.bands.splice(i, 1); critSyncBandValues(def); }

/* ---------------- הצהרת בריאות ---------------- */
/* item: { q, effect: 'block'|'cond'|'note', reason } — effect כשהתשובה "כן" */
const CRIT_DECL_EFFECTS = [
  { key: 'block', label: 'פוסל מהשירות', color: 'red' },
  { key: 'cond', label: 'דורש אישור רפואי', color: 'amber' },
  { key: 'note', label: 'לתשומת לב בלבד', color: 'gray' },
];
function critDeclItems(def) { return (def && def.decl) || []; }
/* איזו תשובה מפעילה את ההשלכה — ברירת מחדל: תשובה חיובית ("כן") */
const CRIT_WHEN = [{ key: 'yes', label: 'תשובה חיובית (כן)' }, { key: 'no', label: 'תשובה שלילית (לא)' }];
function critWhenOf(it, dflt) { return (it && it.when) || dflt || 'yes'; }
function critItemFires(it, ans, dflt) { const w = critWhenOf(it, dflt); return w === 'no' ? ans === false : ans === true; }
function critAddDeclItem(def, q, effect, reason, when) {
  def.decl = critDeclItems(def).slice();
  def.decl.push({ q: (q || '').trim(), when: when || 'yes', effect: effect || 'block', reason: (reason || '').trim() });
  if (typeof needsSave === 'function') needsSave();
}
function critDelDeclItem(def, i) { def.decl = critDeclItems(def).slice(); def.decl.splice(i, 1); if (typeof needsSave === 'function') needsSave(); }
/* תוצאות ההצהרה כ"ערך" — כדי שגם עליה יחולו כללים רגילים */
const DECL_VALS = { pass: 'עבר הצהרת בריאות', cond: 'דורש אישור רפואי', fail: 'נפסל בהצהרת בריאות' };
function critSyncDeclValues(def) { def.values = [DECL_VALS.pass, DECL_VALS.cond, DECL_VALS.fail]; if (typeof needsSave === 'function') needsSave(); }

/* ---------------- נתוני הליד שמהם נגזר הקריטריון ---------------- */
function critDataOf(r) { r.critData = r.critData || {}; return r.critData; }
function critSetData(r, key, v) { critDataOf(r)[key] = v; }
function critParseDate(s) {
  const m = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/.exec(String(s || '')); if (!m) return null;
  let y = +m[3]; if (y < 100) y += 2000;
  return new Date(y, +m[2] - 1, +m[1]);
}
function critToday() { return (typeof clockTodayDate === 'function') ? clockTodayDate() : new Date(); }
function critYearsSince(d) { const t = critToday(); let y = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) y--; return y; }
function critMonthsSince(d) { const t = critToday();
  let mo = (t.getFullYear() - d.getFullYear()) * 12 + (t.getMonth() - d.getMonth());
  if (t.getDate() < d.getDate()) mo--; return Math.max(0, mo); }

/* חישוב הערך (הטווח) של קריטריון נגזר עבור ליד */
function critDerive(def, r) {
  const kind = critKindOf(def), raw = critDataOf(r)[def.key];
  // סוג עם גזירה משלו (למשל חלון תיאום) — מוגדר במודול נפרד
  if (kind.derive && typeof window[kind.derive] === 'function') return window[kind.derive](def, r);
  if (kind.key === 'decl') {
    const st = (raw && raw.answers) ? raw : null;
    if (!st) return { val: '', missing: true, basis: 'טרם בוצעה הצהרת בריאות' };
    return { val: DECL_VALS[st.result] || DECL_VALS.pass, missing: false,
      basis: 'הצהרת בריאות · ' + (st.by || '') + ' · ' + (st.at || ''), decl: st };
  }
  // "זמן שחלף" יכול להישאב אוטומטית מהפגישה הקודמת — בלי הזנה ידנית
  let src = raw, auto = false;
  if (kind.key === 'since' && critBasisOf(def) === 'auto' && (src === undefined || src === '' || src === null)) {
    const lv = critLastVisit(r); if (lv) { src = lv; auto = true; }
  }
  if (src === undefined || src === '' || src === null) {
    return { val: '', missing: true, basis: kind.key === 'since' && critBasisOf(def) === 'auto' ? 'לא נמצאה פגישה קודמת — נדרש תאריך' : '' };
  }
  let num = null, basis = '';
  if (kind.key === 'age') { const d = critParseDate(src); if (!d) return { val: '', missing: true, basis: 'תאריך לא תקין' };
    num = critYearsSince(d); basis = 'גיל ' + num + ' · נולד/ה ' + src; }
  else if (kind.key === 'since') { const d = critParseDate(src); if (!d) return { val: '', missing: true, basis: 'תאריך לא תקין' };
    const u = critUnitOf(def); num = critElapsed(u.key, d);
    basis = 'חלפו ' + num + ' ' + (num === 1 ? u.one : u.label) + ' · מאז ' + src + (auto ? ' (מהפגישה הקודמת)' : ''); }
  else { num = +src || 0; basis = 'פעם מס׳ ' + num; }
  const b = critBandFor(def, num);
  return { val: b ? b.label : '', num: num, missing: !b, basis: basis + (b ? ' → ' + b.label : ' → אין טווח מתאים') };
}
/* הקריטריונים הנגזרים הרלוונטיים לליד (לפי היקף — שירות שנבחר) */
function critDerivedDefs(r) {
  const all = (typeof needsAllDefs === 'function') ? needsAllDefs() : [];
  const svcs = (r && r.services) || [];
  return all.filter(d => {
    if (!d.custom || !critIsDerived(d)) return false;
    const cfg = (typeof needsCfgOf === 'function') ? needsCfgOf(d) : { ask: 'auto' };
    if (cfg.ask === 'never') return false;
    if (cfg.ask === 'always') return true;
    return svcs.some(k => { const t = (typeof cTreat === 'function') ? cTreat(k) : null; return t && (t.critKeys || []).indexOf(d.key) >= 0; });
  });
}
/* כתיבת הערכים הנגזרים ל-r.needs — כך כל מנוע הכללים הקיים חל עליהם */
function critSyncDerived(r) {
  if (!r) return;
  r.needs = r.needs || {};
  critDerivedDefs(r).forEach(d => { const res = critDerive(d, r); if (res.val) r.needs[d.key] = res.val; else delete r.needs[d.key]; });
}

/* ---------------- חריגה באישור (למשל: רופא מאשר ללא תשלום) ---------------- */
function critOverridesOf(r) { r.critOverrides = r.critOverrides || {}; return r.critOverrides; }
function critOverrideActive(r, key) { return !!critOverridesOf(r)[key]; }
function critApplyOverride(r, key, by, waive) {
  critOverridesOf(r)[key] = { by: by || ((typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : ''),
    at: (typeof docStamp === 'function') ? docStamp() : '', waive: waive || 'pay' };
}
function critClearOverride(r, key) { delete critOverridesOf(r)[key]; }

/* ---------------- מצב ביצוע: מותר / בתנאי / חסום ---------------- */
function critBookGuard(r) {
  critSyncDerived(r);
  const out = { mode: 'allow', blocks: [], conds: [], pending: [] };
  // נתונים חסרים בקריטריונים נגזרים
  critDerivedDefs(r).forEach(d => { const res = critDerive(d, r);
    if (res.missing) out.pending.push({ key: d.key, label: d.label, why: res.basis || (critIsDecl(d) ? 'טרם בוצעה הצהרת בריאות' : 'חסר נתון') }); });
  // כללי "ביצוע / חסימה" מתוך מנוע הכללים
  if (typeof critAppliedFor === 'function') {
    critAppliedFor(r).forEach(a => {
      const m = (typeof critMergedRules === 'function') ? critMergedRules(a) : null; if (!m || !m.block || !m.block.on) return;
      const bm = m.block.v.mode, reason = m.block.v.reason || '', src = a.label + ' = ' + a.valLabel;
      const ov = critOverridesOf(r)[a.key];
      const waived = ov && (ov.waive === 'block' || ov.waive === 'both');
      if (bm === 'block' && !waived) out.blocks.push({ key: a.key, src: src, reason: reason, ov: m.override && m.override.on ? m.override.v : null });
      else if (bm === 'block' && waived) out.conds.push({ key: a.key, src: src, reason: 'חסימה בוטלה באישור ' + (ov.by || '') + ' · ' + (ov.at || '') });
      else if (bm === 'cond') out.conds.push({ key: a.key, src: src, reason: reason });
    });
  }
  out.mode = out.blocks.length ? 'block' : (out.pending.length ? 'pending' : (out.conds.length ? 'cond' : 'allow'));
  return out;
}

/* ---------------- UI: נתוני הקריטריונים הנגזרים בתוך בירור הצורך ---------------- */
function critDerivedHTML(r) {
  const defs = critDerivedDefs(r); if (!defs.length) return '';
  return `<div class="cd-box">
    <div class="cd-h">${ic('bolt')} קריטריונים נגזרים <small class="muted">— מחושבים מנתונים, לא נשאלים</small></div>
    ${defs.map(d => { const kind = critKindOf(d), res = critDerive(d, r), raw = critDataOf(r)[d.key];
      // סוג שמופעל כשאלון (הצהרת בריאות / שאלון התאמה) — כפתור הרצה במקום שדה
      if (kind.runFn && kind.key !== 'decl') {
        const st = (raw && raw.answers) ? raw : null;
        const cls = !st ? 'pending' : (st.result === 'none' || st.result === 'fail') ? 'bad' : (st.result === 'partial' || st.result === 'cond') ? 'warn' : 'good';
        return `<div class="cd-row ${cls}">
          <div class="cd-t">${ic(kind.icon)} <b>${esc(d.label)}</b>
            <small>${st ? esc(res.basis) : 'טרם בוצע — יש לעבור על השאלון עם הלקוח'}</small></div>
          <button class="btn xs ${st ? '' : 'primary'}" data-cdrun="${esc(d.key)}|${esc(kind.runFn)}">${ic(st ? 'sync' : 'tasks')} ${st ? 'בצע מחדש' : 'בצע שאלון'}</button>
        </div>`;
      }
      if (kind.key === 'decl') {
        const st = (raw && raw.answers) ? raw : null;
        const cls = !st ? 'pending' : st.result === 'fail' ? 'bad' : st.result === 'cond' ? 'warn' : 'good';
        return `<div class="cd-row ${cls}">
          <div class="cd-t">${ic('docs')} <b>${esc(d.label)}</b>
            <small>${st ? esc(res.val + ' · ' + res.basis) : 'טרם בוצעה — יש לעבור על השאלון עם הלקוח'}</small></div>
          <button class="btn xs ${st ? '' : 'primary'}" data-cddecl="${esc(d.key)}">${ic(st ? 'eye' : 'tasks')} ${st ? 'צפה / בצע מחדש' : 'בצע הצהרה'}</button>
        </div>`;
      }
      const cls = res.missing ? 'pending' : 'good';
      const autoSrc = (kind.key === 'since' && critBasisOf(d) === 'auto') ? critLastVisit(r) : null;
      return `<div class="cd-row ${cls}">
        <div class="cd-t">${ic(kind.icon)} <b>${esc(d.label)}</b>
          <small>${res.missing ? esc(res.basis || kind.desc) : esc(res.basis)}</small></div>
        <label class="cd-inp"><span>${esc(kind.dataLabel)}${autoSrc && !raw ? ' <small class="cd-auto">אוטומטי</small>' : ''}</span>
          <input class="cc-inp sm" data-cddata="${esc(d.key)}" value="${esc(raw == null ? '' : String(raw))}" placeholder="${esc(autoSrc || kind.dataPh || '')}"></label>
        ${res.val ? `<span class="cd-val">${res.val}</span>` : ''}
      </div>`;
    }).join('')}
  </div>${typeof fitBarHTML === 'function' ? fitBarHTML(r) : ''}${critGuardHTML(r)}`;
}
/* פס מצב הביצוע — חסימות, תנאים, חריגות */
function critGuardHTML(r) {
  const g = critBookGuard(r);
  if (g.mode === 'allow') return '';
  const cls = g.mode === 'block' ? 'bad' : g.mode === 'pending' ? 'pending' : 'warn';
  return `<div class="cd-guard ${cls}">
    <div class="cdg-h">${ic(g.mode === 'block' ? 'lock' : 'alert')} ${g.mode === 'block' ? 'לא ניתן לבצע את השירות' : g.mode === 'pending' ? 'חסרים נתונים לפני תיאום' : 'ניתן לבצע — בתנאים'}</div>
    ${g.blocks.map(b => `<div class="cdg-line">${ic('close')} <b>${esc(b.src)}</b> — ${esc(b.reason || 'חסום')}
      ${b.ov ? `<button class="btn xs" data-cdov="${esc(b.key)}|both|${esc(b.ov.by || 'מאשר מוסמך')}">${ic('shield')} חריגה באישור ${esc(b.ov.by || '')}</button>` : ''}</div>`).join('')}
    ${g.pending.map(p => `<div class="cdg-line">${ic('clock')} <b>${esc(p.label)}</b> — ${esc(p.why)}</div>`).join('')}
    ${g.conds.map(c => `<div class="cdg-line">${ic('check')} <b>${esc(c.src)}</b> — ${esc(c.reason || 'דורש אישור')}</div>`).join('')}
  </div>`;
}
/* כפתורי החריגה על כללי תשלום (אלא אם רופא מאשר שלא לתשלום) */
function critOverrideBarHTML(r) {
  const rows = [];
  if (typeof critAppliedFor === 'function') critAppliedFor(r).forEach(a => {
    const m = (typeof critMergedRules === 'function') ? critMergedRules(a) : null; if (!m || !m.override || !m.override.on) return;
    const ov = critOverridesOf(r)[a.key];
    rows.push({ key: a.key, src: a.label + ' = ' + a.valLabel, by: m.override.v.by || 'מאשר מוסמך', waive: m.override.v.waive || 'pay', cur: ov });
  });
  if (!rows.length) return '';
  return `<div class="cd-ov">${rows.map(x => x.cur
    ? `<div class="cd-ov-row on">${ic('shield')} <b>חריגה הוחלה</b> · ${esc(x.src)} · אושר ע״י ${esc(x.cur.by)} · ${esc(x.cur.at)}
        <button class="btn xs ghost" data-cdovdel="${esc(x.key)}">${ic('close')} בטל חריגה</button></div>`
    : `<div class="cd-ov-row">${ic('shield')} ${esc(x.src)} — ניתן לאשר חריגה (${esc(x.by)})
        <button class="btn xs" data-cdov="${esc(x.key)}|${esc(x.waive)}|${esc(x.by)}">${ic('check')} החל חריגה</button></div>`).join('')}</div>`;
}
function bindCritDerived(r, rerender) {
  const RR = () => { if (typeof rerender === 'function') rerender(); };
  $$('[data-cddata]').forEach(inp => inp.addEventListener('change', () => { critSetData(r, inp.dataset.cddata, inp.value.trim()); critSyncDerived(r); RR(); }));
  $$('[data-cddecl]').forEach(b => b.addEventListener('click', () => openCritDecl(r, b.dataset.cddecl, RR)));
  $$('[data-cdrun]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.cdrun.split('|');
    if (typeof window[p[1]] === 'function') window[p[1]](r, p[0], RR); }));
  if (typeof bindFitBar === 'function') bindFitBar(r, RR);
  $$('[data-cdov]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.cdov.split('|');
    critApplyOverride(r, p[0], p[2], p[1]); RR(); toast('חריגה הוחלה באישור ' + p[2]); }));
  $$('[data-cdovdel]').forEach(b => b.addEventListener('click', () => { critClearOverride(r, b.dataset.cdovdel); RR(); toast('החריגה בוטלה'); }));
}

/* ---------------- שאלון הצהרת בריאות (עוברים עם הלקוח) ---------------- */
function openCritDecl(r, key, after) {
  const def = (typeof needsDefOf === 'function') ? needsDefOf(key) : null; if (!def) return;
  const items = critDeclItems(def);
  const prev = critDataOf(r)[key] || { answers: {} };
  const ans = Object.assign({}, prev.answers);
  const old = document.getElementById('critDeclPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'critDeclPanel'; document.body.appendChild(w);
  const calc = () => { let res = 'pass';
    items.forEach((it, i) => { if (!critItemFires(it, ans[i], 'yes')) return;
      if (it.effect === 'block') res = 'fail'; else if (it.effect === 'cond' && res !== 'fail') res = 'cond'; });
    return res; };
  const render = () => {
    const res = calc();
    w.innerHTML = `<div class="cbc-box cd-box-m" style="max-width:560px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('docs')}</span><b>${esc(def.label)} · ${esc(r.name)}</b></div>
      <p class="cr-hint">${ic('alert')} לעבור על השאלון <b>עם הלקוח</b>. התשובות נשמרות עם שם הנציג וחותמת זמן.</p>
      <div class="cd-qs">${items.length ? items.map((it, i) => `<div class="cd-q ${critItemFires(it, ans[i], 'yes') ? 'yes ' + it.effect : ''}">
          <span class="cd-qt">${esc(it.q)}${it.effect !== 'note' ? `<small class="cd-qe ${it.effect}">${critWhenOf(it, 'yes') === 'no' ? 'תשובה שלילית' : 'תשובה חיובית'} ${it.effect === 'block' ? 'פוסלת' : 'דורשת אישור רפואי'}</small>` : ''}</span>
          <span class="cd-yn"><button class="cd-b ${ans[i] === true ? (critItemFires(it, true, 'yes') ? 'on yes' : 'on no') : ''}" data-cdq="${i}|1">כן</button><button class="cd-b ${ans[i] === false ? (critItemFires(it, false, 'yes') ? 'on yes' : 'on no') : ''}" data-cdq="${i}|0">לא</button></span>
        </div>`).join('') : '<p class="muted" style="font-size:12.5px;margin:0">לא הוגדרו שאלות — הוסף אותן בהגדרות הקריטריון (היקף וכללים › שאלון).</p>'}</div>
      <div class="cd-res ${res}">${ic(res === 'fail' ? 'lock' : res === 'cond' ? 'alert' : 'check')} <b>${esc(DECL_VALS[res])}</b>
        ${res === 'fail' ? '<small>הלקוח אינו יכול לבצע את השירות — ניתן לאשר חריגה בהתאם לכללי הקריטריון.</small>'
          : res === 'cond' ? '<small>נדרש אישור רפואי לפני ביצוע.</small>' : '<small>אין מניעה לביצוע.</small>'}</div>
      <div class="cbc-actions"><button class="btn ghost" id="cdCancel">ביטול</button>
        <button class="btn primary" id="cdSave">${ic('check')} שמור הצהרה</button></div></div>`;
    $$('[data-cdq]', w).forEach(b => b.addEventListener('click', () => { const p = b.dataset.cdq.split('|'); ans[+p[0]] = p[1] === '1'; render(); }));
    $('#cdCancel').addEventListener('click', close);
    $('#cdSave').addEventListener('click', () => {
      if (items.length && items.some((it, i) => ans[i] === undefined)) { toast('יש לענות על כל השאלות'); return; }
      critSetData(r, key, { answers: ans, result: calc(), by: (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : '', at: (typeof docStamp === 'function') ? docStamp() : '' });
      critSyncDerived(r); close(); toast('הצהרת הבריאות נשמרה · ' + DECL_VALS[calc()]);
      if (typeof after === 'function') after();
    });
  };
  const close = () => w.remove();
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  render(); requestAnimationFrame(() => w.classList.add('open'));
}

/* ---------------- עורך ההגדרה (טווחים / שאלון) — לשונית בפאנל הקריטריון ---------------- */
function critDefinePanelHTML(key, def) {
  const kind = critKindOf(def);
  return `<div class="cr-sec">
      <div class="cr-h"><span class="cr-step">1</span>${ic('note')} שם ופירוט
        <span class="cr-kindtag">${ic(kind.icon)} ${esc(kind.label)}<button class="cr-kindchg" data-crgoto="1">שנה</button></span></div>
      <div class="nc-new-row">
        <label class="exf"><span>שם הקריטריון *</span><input class="cc-inp" id="crName" value="${esc(def.label || '')}" placeholder="למשל: הסדר קופה"></label>
        <label class="exf"><span>פירוט (סוג המידע)</span><input class="cc-inp" id="crDetail" value="${esc(def.detail || '')}" placeholder="למשל: מלא / החזר"></label>
      </div>
    </div>
    ${kind.key === 'list' ? `<div class="cr-sec">
      <div class="cr-h"><span class="cr-step">2</span>${ic('target')} ערכים <small class="muted">(Enter או פסיק — כל ערך נפרד)</small></div>
      <div class="ccr-tags">${(def.values || []).map((v, i) => `<span class="ccr-tag">${esc(v)}<button type="button" data-crvdel="${i}">${ic('close')}</button></span>`).join('')}
        <input class="ccr-valinp" id="crValInp" placeholder="${(def.values || []).length ? 'ערך נוסף…' : 'למשל: כללית, מכבי, מאוחדת'}"></div>
      ${!(def.values || []).length ? `<p class="cr-todo">${ic('alert')} טרם הוגדרו ערכים — הוסף לפחות אחד.</p>` : ''}
      <p class="cr-hint">${ic('bolt')} האפשרות <b>"${CRIT_OTHER_LABEL}"</b> נוספת אוטומטית — לכל מקרה שאינו ברשימה.</p>
    </div>` : ''}
    ${kind.panel && typeof window[kind.panel] === 'function' ? window[kind.panel](key, def) : ''}
    ${kind.bands ? `<div class="cr-sec">
      <div class="cr-h"><span class="cr-step">${kind.units ? 3 : 2}</span>${ic('target')} טווחים <small class="muted">(${esc(kind.units ? critUnitOf(def).label : kind.unit)}) — כל טווח מתנהג כמו ערך: אפשר לתת לו כללים בלשונית "כללים"</small></div>
      <div class="table-wrap"><table class="mini-table"><thead><tr><th>מ־</th><th>עד (לא כולל)</th><th>שם הטווח</th><th></th></tr></thead>
        <tbody>${critBandsOf(def).length ? critBandsOf(def).map((b, i) => `<tr><td>${b.from}</td><td>${b.to == null ? '∞' : b.to}</td>
          <td><b>${esc(b.label)}</b> <small class="muted">${esc(critBandText(b, kind, def))}</small></td>
          <td><button class="whs-del" data-cdbdel="${i}">${ic('close')}</button></td></tr>`).join('')
          : `<tr><td colspan="4"><small class="cr-todo">${ic('alert')} טרם הוגדרו טווחים — הוסף לפחות שניים (למשל "בתוקף" ו"פג תוקף") כדי שהקריטריון יפעל.</small></td></tr>`}</tbody></table></div>
      <div class="cd-bandadd"><label class="cre-f"><span>מ־</span><input class="cc-inp sm" type="number" id="cdBFrom" value="0"></label>
        <label class="cre-f"><span>עד (ריק = ומעלה)</span><input class="cc-inp sm" type="number" id="cdBTo" placeholder="∞"></label>
        <label class="cre-f wide"><span>שם הטווח</span><input class="cc-inp sm" id="cdBLabel" placeholder="למשל: עד גיל 18 / בתוקף / בדיקה ראשונה"></label>
        <button class="btn sm primary" id="cdBAdd">${ic('plus')} הוסף טווח</button></div>
      <p class="cr-hint">${ic('bolt')} ${kind.key === 'age' ? 'לדוגמה: 0–18 "עד גיל 18" (חסום) · 18–21 "18–21" (בליווי/אישור) · 21+ "21 ומעלה" (מותר).'
        : kind.key === 'since' ? 'לדוגמה: 0–8 "בתוקף" · 8+ "פג תוקף" (חסום — נדרשת בדיקה חדשה).'
        : 'לדוגמה: 1–2 "בדיקה ראשונה" (ללא תשלום) · 2+ "בדיקה חוזרת" (500 ₪).'}</p>
    </div>` : ''}
    ${kind.decl ? `<div class="cr-sec">
      <div class="cr-h"><span class="cr-step">2</span>${ic('docs')} שאלות ההצהרה <small class="muted">— הנציג עובר עליהן עם הלקוח</small></div>
      <div class="cd-items">${critDeclItems(def).map((it, i) => `<div class="cd-item ${it.effect}">
          <span class="cd-item-q"><b>${esc(it.q)}</b>${it.reason ? `<small>${esc(it.reason)}</small>` : ''}</span>
          <span class="q-when">${critWhenOf(it, 'yes') === 'no' ? 'לא' : 'כן'} ←</span>
          <span class="badge ${it.effect === 'block' ? 'red' : it.effect === 'cond' ? 'amber' : 'gray'} sm">${(CRIT_DECL_EFFECTS.find(e => e.key === it.effect) || {}).label}</span>
          <button class="whs-del" data-cdidel="${i}">${ic('close')}</button></div>`).join('') || '<small class="muted">טרם הוגדרו שאלות.</small>'}</div>
      <div class="cd-itemadd"><label class="cre-f wide"><span>שאלה</span><input class="cc-inp sm" id="cdIQ" placeholder="למשל: האם את בהריון?"></label>
        <label class="cre-f"><span>איזו תשובה מפעילה</span><select class="cc-inp sm" id="cdIW">${CRIT_WHEN.map(w => `<option value="${w.key}">${w.label}</option>`).join('')}</select></label>
        <label class="cre-f"><span>ואז</span><select class="cc-inp sm" id="cdIE">${CRIT_DECL_EFFECTS.map(e => `<option value="${e.key}">${e.label}</option>`).join('')}</select></label>
        <label class="cre-f wide"><span>נימוק שיוצג</span><input class="cc-inp sm" id="cdIR" placeholder="למשל: הטיפול אסור בהריון"></label>
        <button class="btn sm primary" id="cdIAdd">${ic('plus')} הוסף שאלה</button></div>
      <p class="cr-hint">${ic('alert')} תוצאת ההצהרה נשמרת כערך הקריטריון (עבר / דורש אישור / נפסל) — ולכן אפשר לתת לכל תוצאה כללים בלשונית "כללים".</p>
    </div>` : ''}`;
}
function bindCritDefinePanel(key, def, RR) {
  const kd = critKindOf(def);
  $$('[data-crgoto]').forEach(b => b.addEventListener('click', () => { critWizStep = +b.dataset.crgoto; renderCritRules(); }));
  // שם ופירוט — נשמרים תוך כדי הקלדה, בלי רינדור מחדש (כדי לא לאבד פוקוס)
  const nm = $('#crName'); if (nm) nm.addEventListener('change', () => {
    const v = (nm.value || '').trim(); if (!v) { toast('נא להזין שם קריטריון'); nm.value = def.label; return; }
    if (typeof needsRenameCustom === 'function') { const nk = needsRenameCustom(key, v); if (nk && nk !== key) { critPanelKey = nk; } }
    RR();
  });
  const dt = $('#crDetail'); if (dt) dt.addEventListener('change', () => {
    if (typeof needsUpdateCustom === 'function') needsUpdateCustom(key, { detail: dt.value }); });
  // ערכים (סוג "ערכים לבחירה")
  const vi = $('#crValInp'); if (vi) vi.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ',') return; e.preventDefault();
    const v = (vi.value || '').replace(/,+$/, '').trim(); if (!v) return;
    const raw = (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null; if (!raw) return;
    raw.values = raw.values || []; if (raw.values.indexOf(v) < 0) raw.values.push(v);
    if (typeof needsSave === 'function') needsSave(); RR();
  });
  $$('[data-crvdel]').forEach(b => b.addEventListener('click', () => {
    const raw = (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null; if (!raw) return;
    raw.values.splice(+b.dataset.crvdel, 1); if (typeof needsSave === 'function') needsSave(); RR();
  }));
  if (kd.panelBind && typeof window[kd.panelBind] === 'function') window[kd.panelBind](key, def, RR);
  $$('[data-cdkind]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.cdkind;
    if (typeof needsUpdateCustom === 'function') needsUpdateCustom(key, { kind: k });
    const d2 = (typeof needsDefOf === 'function') ? needsDefOf(key) : null;
    const raw = (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null;
    if (raw) { if (critIsBands(raw)) critSyncBandValues(raw); else if (critIsDecl(raw)) critSyncDeclValues(raw);
      else { const kk = critKindOf(raw); if (kk.initFn && typeof window[kk.initFn] === 'function') window[kk.initFn](key, raw); } }
    RR(); toast('סוג הקריטריון עודכן');
  }));
  const raw = (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null; if (!raw) return;
  $$('[data-cdunit]').forEach(b => b.addEventListener('click', () => {
    raw.unit = b.dataset.cdunit; if (typeof needsSave === 'function') needsSave(); RR();
    toast('הטווחים נמדדים ב' + critUnitOf(raw).label);
  }));
  $$('[data-cdbasis]').forEach(b => b.addEventListener('click', () => {
    raw.basis = b.dataset.cdbasis; if (typeof needsSave === 'function') needsSave(); RR();
  }));
  const ba = $('#cdBAdd'); if (ba) ba.addEventListener('click', () => {
    const l = ($('#cdBLabel') || {}).value || ''; if (!l.trim()) { toast('נא לתת שם לטווח'); return; }
    critAddBand(raw, ($('#cdBFrom') || {}).value, ($('#cdBTo') || {}).value, l); RR();
  });
  $$('[data-cdbdel]').forEach(b => b.addEventListener('click', () => { critDelBand(raw, +b.dataset.cdbdel); RR(); }));
  const ia = $('#cdIAdd'); if (ia) ia.addEventListener('click', () => {
    const q = ($('#cdIQ') || {}).value || ''; if (!q.trim()) { toast('נא להזין שאלה'); return; }
    critAddDeclItem(raw, q, ($('#cdIE') || {}).value, ($('#cdIR') || {}).value, ($('#cdIW') || {}).value); critSyncDeclValues(raw); RR();
  });
  $$('[data-cdidel]').forEach(b => b.addEventListener('click', () => { critDelDeclItem(raw, +b.dataset.cdidel); RR(); }));
}

/* המשפחה של סוג קריטריון */
function critGroupOf(def) { const k = critKindOf(def); return CRIT_GROUPS.find(g => g.key === (k.group || 'qa')) || CRIT_GROUPS[1]; }
