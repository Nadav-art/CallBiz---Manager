/* ============================================================
   שאלון התאמה — מודול עצמאי
   ------------------------------------------------------------
   בניגוד ל"הצהרת בריאות" (שרק פוסלת), שאלון ההתאמה **מנתב לשירות**:

     עומד בכל הדרישות        → מתאים במלואו  → השירות המלא
     נופל בשאלה אחת או יותר  → מתאים חלקית   → שירות חלופי
     נופל בשאלה פוסלת        → לא מתאים      → אין שירות מתאים

   לכל שאלה מגדירים מה קורה כשהתשובה **אינה** עומדת בדרישה:
     down = מוריד לחלופה   ·   disq = פוסל לגמרי

   שלוש התוצאות הן **ערכי הקריטריון**, ולכן כל מנוע הכללים חל עליהן
   (תשלום, מחיר, מסמכים, חסימה). מה שנוסף כאן: **סינון הקטלוג** —
   כל תוצאה קובעת אילו שירותים בכלל מוצעים ללקוח.
   ============================================================ */
const FIT_VALS = { full: 'מתאים במלואו', partial: 'מתאים חלקית', none: 'לא מתאים' };
const FIT_TIERS = [
  { key: 'full', label: FIT_VALS.full, color: 'green', desc: 'ענה כנדרש על כל השאלות' },
  { key: 'partial', label: FIT_VALS.partial, color: 'amber', desc: 'נפל בשאלה אחת או יותר' },
  { key: 'none', label: FIT_VALS.none, color: 'red', desc: 'נפל בשאלה פוסלת' },
];
const FIT_MODES = [
  { key: 'all', label: 'כל הקטלוג' },
  { key: 'only', label: 'רק שירותים נבחרים' },
  { key: 'none', label: 'אין שירות מתאים' },
];
const FIT_Q_EFFECTS = [
  { key: 'down', label: 'מוריד לחלופה', color: 'amber' },
  { key: 'disq', label: 'פוסל לגמרי', color: 'red' },
];

function fitCfg(def) {
  const f = (def && def.fit) || {};
  return {
    items: f.items || [],
    tiers: {
      full: Object.assign({ mode: 'all', svcs: [] }, (f.tiers || {}).full),
      partial: Object.assign({ mode: 'only', svcs: [] }, (f.tiers || {}).partial),
      none: Object.assign({ mode: 'none', svcs: [] }, (f.tiers || {}).none),
    },
  };
}
function fitRaw(key) { return (typeof NEEDS_CUSTOM !== 'undefined') ? NEEDS_CUSTOM.find(x => x.key === key) : null; }
function fitSave(key, mut) {
  const raw = fitRaw(key); if (!raw) return;
  raw.fit = raw.fit || { items: [], tiers: {} };
  mut(raw.fit);
  raw.values = [FIT_VALS.full, FIT_VALS.partial, FIT_VALS.none];
  if (typeof needsSave === 'function') needsSave();
}
/* איזו תשובה מפעילה את ההשלכה — ברירת המחדל בשאלון התאמה: תשובה שלילית ("לא") */
function fitWhenOf(it) { return (it && it.when) || 'no'; }
function fitFires(it, ans) { return fitWhenOf(it) === 'no' ? ans === false : ans === true; }
function fitAddItem(key, q, effect, reason, when) {
  fitSave(key, f => { f.items = (f.items || []).slice(); f.items.push({ q: (q || '').trim(), when: when || 'no', effect: effect || 'down', reason: (reason || '').trim() }); });
}
function fitDelItem(key, i) { fitSave(key, f => { f.items = (f.items || []).slice(); f.items.splice(i, 1); }); }
function fitSetTier(key, tier, patch) {
  fitSave(key, f => { f.tiers = f.tiers || {}; f.tiers[tier] = Object.assign({ mode: tier === 'none' ? 'none' : (tier === 'full' ? 'all' : 'only'), svcs: [] }, f.tiers[tier], patch); });
}
function fitToggleTierSvc(key, tier, svcKey) {
  const cur = fitCfg(fitRaw(key)).tiers[tier].svcs.slice();
  const i = cur.indexOf(svcKey); if (i >= 0) cur.splice(i, 1); else cur.push(svcKey);
  fitSetTier(key, tier, { svcs: cur });
}

/* ---------------- תוצאת השאלון ---------------- */
function fitResultOf(answers, def) {
  const c = fitCfg(def); let res = 'full';
  (c.items || []).forEach((it, i) => {
    if (!fitFires(it, answers[i])) return;            // התשובה שהוגדרה כמפעילה
    if (it.effect === 'disq') res = 'none';
    else if (res !== 'none') res = 'partial';
  });
  return res;
}
function fitDerive(def, r) {
  const st = (typeof critDataOf === 'function') ? critDataOf(r)[def.key] : null;
  if (!st || !st.answers) return { val: '', missing: true, basis: 'טרם בוצע שאלון התאמה' };
  const tier = fitCfg(def).tiers[st.result] || {};
  const svcTxt = tier.mode === 'all' ? 'כל הקטלוג' : tier.mode === 'none' ? 'אין שירות מתאים'
    : (tier.svcs || []).map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k).join(' · ') || 'טרם נבחרו שירותים';
  return { val: FIT_VALS[st.result] || FIT_VALS.full, missing: false,
    basis: 'שאלון התאמה · ' + (st.by || '') + ' · ' + (st.at || '') + ' → ' + svcTxt, fit: st };
}
/* קריטריוני ההתאמה הרלוונטיים לליד */
function fitDefsFor(r) {
  const all = (typeof needsAllDefs === 'function') ? needsAllDefs() : [];
  const svcs = (r && r.services) || [];
  return all.filter(d => {
    if (!d.custom || d.kind !== 'fit') return false;
    const cfg = (typeof needsCfgOf === 'function') ? needsCfgOf(d) : { ask: 'auto' };
    if (cfg.ask === 'never') return false;
    if (cfg.ask === 'always') return true;
    // שאלון התאמה מסנן את הקטלוג — לכן הוא רלוונטי גם לפני שנבחר שירות
    if (!svcs.length) return true;
    return svcs.some(k => { const t = (typeof cTreat === 'function') ? cTreat(k) : null; return t && (t.critKeys || []).indexOf(d.key) >= 0; });
  });
}
/* האם שירות מוצע ללקוח לפי תוצאות שאלוני ההתאמה */
function fitServiceState(r, svcKey) {
  let blocked = null;
  fitDefsFor(r).forEach(d => {
    if (blocked) return;
    const st = (typeof critDataOf === 'function') ? critDataOf(r)[d.key] : null;
    if (!st || !st.answers) return;                    // טרם בוצע — לא מסנן
    const tier = fitCfg(d).tiers[st.result] || {};
    if (tier.mode === 'all') return;
    if (tier.mode === 'none') { blocked = { why: d.label + ': ' + FIT_VALS[st.result] + ' — אין שירות מתאים', def: d, tier: st.result }; return; }
    if ((tier.svcs || []).indexOf(svcKey) < 0) {
      const list = (tier.svcs || []).map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k).join(' · ');
      blocked = { why: d.label + ': ' + FIT_VALS[st.result] + (list ? ' — מוצע רק ' + list : ' — לא הוגדרו שירותים'), def: d, tier: st.result };
    }
  });
  return blocked;
}
function fitBlockReason(r, svcKey) { const b = fitServiceState(r, svcKey); return b ? b.why : null; }
/* השירותים המוצעים בפועל */
function fitAllowedServices(r) {
  const cat = (typeof COORD_TREATMENTS === 'undefined') ? [] : COORD_TREATMENTS;
  return cat.filter(t => !fitServiceState(r, t.key)).map(t => t.key);
}

/* ---------------- פאנל ההגדרה ---------------- */
function fitDefinePanel(key, def) {
  const c = fitCfg(def);
  const cat = (typeof COORD_TREATMENTS === 'undefined') ? [] : COORD_TREATMENTS;
  return `<div class="cr-sec">
      <div class="cr-h"><span class="cr-step">2</span>${ic('tasks')} שאלות ההתאמה <small class="muted">— "כן" = עומד בדרישה</small></div>
      <div class="cd-items">${(c.items || []).map((it, i) => `<div class="cd-item ${it.effect === 'disq' ? 'block' : 'cond'}">
          <span class="cd-item-q"><b>${esc(it.q)}</b>${it.reason ? `<small>${esc(it.reason)}</small>` : ''}</span>
          <span class="q-when">${fitWhenOf(it) === 'no' ? 'לא' : 'כן'} ←</span>
          <span class="badge ${it.effect === 'disq' ? 'red' : 'amber'} sm">${(FIT_Q_EFFECTS.find(e => e.key === it.effect) || {}).label}</span>
          <button class="whs-del" data-fitqdel="${i}">${ic('close')}</button></div>`).join('')
        || `<small class="cr-todo">${ic('alert')} טרם הוגדרו שאלות — הוסף לפחות שאלה אחת.</small>`}</div>
      <div class="cd-itemadd">
        <label class="cre-f wide"><span>שאלה</span><input class="cc-inp sm" id="fitQ" placeholder="למשל: האם קיימת עדות רפואית תקפה?"></label>
        <label class="cre-f"><span>איזו תשובה מפעילה</span><select class="cc-inp sm" id="fitW">${(typeof CRIT_WHEN !== 'undefined' ? CRIT_WHEN : []).map(w => `<option value="${w.key}" ${w.key === 'no' ? 'selected' : ''}>${w.label}</option>`).join('')}</select></label>
        <label class="cre-f"><span>ואז</span><select class="cc-inp sm" id="fitE">${FIT_Q_EFFECTS.map(e => `<option value="${e.key}">${e.label}</option>`).join('')}</select></label>
        <label class="cre-f wide"><span>נימוק שיוצג</span><input class="cc-inp sm" id="fitR" placeholder="למשל: ללא עדות לא ניתן לבצע את המסלול המלא"></label>
        <button class="btn sm primary" id="fitAdd">${ic('plus')} הוסף שאלה</button></div>
    </div>
    <div class="cr-sec">
      <div class="cr-h"><span class="cr-step">3</span>${ic('layers')} איזה שירות מוצע בכל תוצאה</div>
      <div class="fit-tiers">${FIT_TIERS.map(t => { const cur = c.tiers[t.key];
        return `<div class="fit-tier ${t.key}">
          <div class="fit-tier-h"><span class="badge ${t.color} sm">${t.label}</span><small>${t.desc}</small></div>
          <div class="br-mode-seg sm">${FIT_MODES.map(m => `<button class="${cur.mode === m.key ? 'on' : ''}" data-fitmode="${t.key}|${m.key}">${m.label}</button>`).join('')}</div>
          ${cur.mode === 'only' ? `<div class="tag-wrap">${cat.map(sv => `<button class="tag-chip ${(cur.svcs || []).indexOf(sv.key) >= 0 ? 'on' : ''}" data-fitsvc="${t.key}|${esc(sv.key)}">${esc(sv.label)}</button>`).join('')}</div>
            ${!(cur.svcs || []).length ? `<p class="cr-todo">${ic('alert')} בחר לפחות שירות אחד — אחרת לא יוצע דבר.</p>` : ''}` : ''}
        </div>`; }).join('')}</div>
      <p class="cr-hint">${ic('bolt')} התוצאה מסננת את הקטלוג בבחירת השירות ובהצעת הזמנים. בנוסף, שלוש התוצאות הן ערכי הקריטריון —
        אפשר לתת לכל אחת כללי תשלום/מחיר/מסמכים בלשונית <b>"כללים והשלכות"</b>.</p>
    </div>`;
}
function fitBindDefine(key, def, RR) {
  const add = $('#fitAdd'); if (add) add.addEventListener('click', () => {
    const q = ($('#fitQ') || {}).value || ''; if (!q.trim()) { toast('נא להזין שאלה'); return; }
    fitAddItem(key, q, ($('#fitE') || {}).value, ($('#fitR') || {}).value, ($('#fitW') || {}).value); RR();
  });
  $$('[data-fitqdel]').forEach(b => b.addEventListener('click', () => { fitDelItem(key, +b.dataset.fitqdel); RR(); }));
  $$('[data-fitmode]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.fitmode.split('|'); fitSetTier(key, p[0], { mode: p[1] }); RR(); }));
  $$('[data-fitsvc]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.fitsvc.split('|'); fitToggleTierSvc(key, p[0], p[1]); RR(); }));
}

/* ---------------- הרצת השאלון מול הלקוח ---------------- */
function openCritFit(r, key, after) {
  const def = (typeof needsDefOf === 'function') ? needsDefOf(key) : null; if (!def) return;
  const c = fitCfg(def), items = c.items || [];
  const prev = (typeof critDataOf === 'function') ? (critDataOf(r)[key] || { answers: {} }) : { answers: {} };
  const ans = Object.assign({}, prev.answers);
  const old = document.getElementById('critFitPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'critFitPanel'; document.body.appendChild(w);
  const close = () => w.remove();
  const render = () => {
    const res = fitResultOf(ans, def), tier = c.tiers[res] || {};
    const svcList = tier.mode === 'all' ? (typeof COORD_TREATMENTS !== 'undefined' ? COORD_TREATMENTS.map(t => t.label) : [])
      : tier.mode === 'none' ? [] : (tier.svcs || []).map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k);
    w.innerHTML = `<div class="cbc-box cd-box-m" style="max-width:560px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('tasks')}</span><b>${esc(def.label)} · ${esc(r.name)}</b></div>
      <p class="cr-hint">${ic('alert')} לעבור על השאלון <b>עם הלקוח</b>. התוצאה קובעת אילו שירותים יוצעו.</p>
      <div class="cd-qs">${items.length ? items.map((it, i) => `<div class="cd-q ${fitFires(it, ans[i]) ? 'yes ' + (it.effect === 'disq' ? 'block' : 'cond') : ''}">
          <span class="cd-qt">${esc(it.q)}<small class="cd-qe ${it.effect === 'disq' ? 'block' : 'cond'}">${fitWhenOf(it) === 'no' ? 'תשובה שלילית' : 'תשובה חיובית'} ${it.effect === 'disq' ? 'פוסלת' : 'מורידה לחלופה'}</small></span>
          <span class="cd-yn"><button class="cd-b ${ans[i] === true ? (fitFires(it, true) ? 'on yes' : 'on no') : ''}" data-fitq="${i}|1">כן</button><button class="cd-b ${ans[i] === false ? (fitFires(it, false) ? 'on yes' : 'on no') : ''}" data-fitq="${i}|0">לא</button></span>
        </div>`).join('') : '<p class="muted" style="font-size:12.5px;margin:0">לא הוגדרו שאלות — הוסף אותן בהגדרות הקריטריון.</p>'}</div>
      <div class="cd-res ${res === 'none' ? 'fail' : res === 'partial' ? 'cond' : 'pass'}">
        ${ic(res === 'none' ? 'lock' : res === 'partial' ? 'alert' : 'check')} <b>${esc(FIT_VALS[res])}</b>
        <small>${svcList.length ? 'שירותים שיוצעו: ' + esc(svcList.join(' · ')) : 'אין שירות מתאים ללקוח לפי תשובותיו.'}</small></div>
      <div class="cbc-actions"><button class="btn ghost" id="fitCancel">ביטול</button>
        <button class="btn primary" id="fitSave">${ic('check')} שמור תוצאה</button></div></div>`;
    $$('[data-fitq]', w).forEach(b => b.addEventListener('click', () => { const p = b.dataset.fitq.split('|'); ans[+p[0]] = p[1] === '1'; render(); }));
    $('#fitCancel').addEventListener('click', close);
    $('#fitSave').addEventListener('click', () => {
      if (items.length && items.some((it, i) => ans[i] === undefined)) { toast('יש לענות על כל השאלות'); return; }
      const result = fitResultOf(ans, def);
      critSetData(r, key, { answers: ans, result: result, by: (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : '', at: (typeof docStamp === 'function') ? docStamp() : '' });
      // שירות שנבחר וכבר אינו מוצע — מוסר מהליד
      const before = (r.services || []).length;
      r.services = (r.services || []).filter(k => !fitServiceState(r, k));
      if (typeof critSyncDerived === 'function') critSyncDerived(r);
      close();
      toast('שאלון ההתאמה נשמר · ' + FIT_VALS[result] + (before !== (r.services || []).length ? ' · שירות שאינו מתאים הוסר' : ''));
      if (typeof after === 'function') after();
    });
  };
  render(); requestAnimationFrame(() => w.classList.add('open'));
}

/* ---------------- באנר: מה מוצע ללקוח ---------------- */
function fitBarHTML(r) {
  const defs = fitDefsFor(r); if (!defs.length) return '';
  const rows = defs.map(d => {
    const st = (typeof critDataOf === 'function') ? critDataOf(r)[d.key] : null;
    if (!st || !st.answers) return `<div class="fitb-line miss">${ic('alert')} <b>${esc(d.label)}</b> — טרם בוצע; הקטלוג אינו מסונן
      <button class="btn xs primary" data-fitrun="${esc(d.key)}">${ic('tasks')} בצע שאלון</button></div>`;
    const tier = fitCfg(d).tiers[st.result] || {};
    const list = tier.mode === 'all' ? 'כל הקטלוג' : tier.mode === 'none' ? 'אין שירות מתאים'
      : (tier.svcs || []).map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k).join(' · ');
    return `<div class="fitb-line ${st.result}">${ic(st.result === 'none' ? 'lock' : st.result === 'partial' ? 'alert' : 'check')}
      <b>${esc(d.label)}</b><span class="badge ${st.result === 'none' ? 'red' : st.result === 'partial' ? 'amber' : 'green'} sm">${esc(FIT_VALS[st.result])}</span>
      <span class="fitb-svcs">מוצע: <b>${esc(list)}</b></span>
      <button class="btn xs" data-fitrun="${esc(d.key)}">${ic('sync')} בצע מחדש</button></div>`;
  }).join('');
  return `<div class="fit-bar">${rows}</div>`;
}
function bindFitBar(r, rerender) {
  $$('[data-fitrun]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
    openCritFit(r, b.dataset.fitrun, rerender); }));
}

/* ---------------- רישום הסוג ---------------- */
function fitInit(key, def) {
  def.values = [FIT_VALS.full, FIT_VALS.partial, FIT_VALS.none];
  def.fit = def.fit || { items: [], tiers: { full: { mode: 'all', svcs: [] }, partial: { mode: 'only', svcs: [] }, none: { mode: 'none', svcs: [] } } };
  if (typeof needsSave === 'function') needsSave();
  if (typeof critRuleSetVal === 'function' && typeof critRuleRaw === 'function' && !Object.keys(critRuleRaw(key, FIT_VALS.none)).length)
    critRuleSetVal(key, FIT_VALS.none, 'block', { mode: 'block', reason: 'לא נמצא שירות מתאים לפי שאלון ההתאמה' });
}
if (typeof CRIT_KINDS !== 'undefined' && !CRIT_KINDS.some(k => k.key === 'fit')) {
  CRIT_KINDS.push({ key: 'fit', label: 'שאלון התאמה', icon: 'tasks', group: 'qa', derived: true,
    desc: 'שאלון שמנתב לשירות: מלא / חלופי / אין שירות מתאים — ומסנן את הקטלוג',
    panel: 'fitDefinePanel', panelBind: 'fitBindDefine', derive: 'fitDerive', initFn: 'fitInit', runFn: 'openCritFit' });
}
