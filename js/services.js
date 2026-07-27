/* ============================================================
   CallBiz Manager – שלב היסוד: קטלוג כתצורה + בחירת שירות/מוצר + ניתוב אוטומטי
   • כל שירות בקטלוג מגדיר: דורש פגישה / דורש סליקה / ניתן לתאם ללא סליקה / מקדמה / משך / מחיר
   • שלב "בחירת שירות/מוצר" לפני תיאום או רכישה
   • לפי התצורה המערכת מנתבת אוטומטית: תיאום / רכישה / שילוב
   ============================================================ */
/* מיזוג ברירות-מחדל של תצורה לתוך הקטלוג (מקור-אמת יחיד — ניתן לעריכה בהגדרות) */
const SERVICE_CFG_DEFAULTS = {
  consult:   { requiresMeeting: true,  requiresBilling: false, canScheduleWithoutBilling: true,  deposit: 0,   price: 0 },
  followup:  { requiresMeeting: true,  requiresBilling: false, canScheduleWithoutBilling: true,  deposit: 0,   price: 0 },
  facial:    { requiresMeeting: true,  requiresBilling: true,  canScheduleWithoutBilling: true,  deposit: 150, price: 690 },
  injection: { requiresMeeting: true,  requiresBilling: true,  canScheduleWithoutBilling: false, deposit: 300, price: 1200 },
  laser:     { requiresMeeting: true,  requiresBilling: true,  canScheduleWithoutBilling: true,  deposit: 200, price: 950 },
};
(function mergeServiceCfg() {
  if (typeof COORD_TREATMENTS === 'undefined') return;
  COORD_TREATMENTS.forEach(t => {
    const d = SERVICE_CFG_DEFAULTS[t.key] || {};
    if (t.requiresMeeting === undefined) t.requiresMeeting = d.requiresMeeting !== undefined ? d.requiresMeeting : (t.kind !== 'מוצר');
    if (t.requiresBilling === undefined) t.requiresBilling = !!d.requiresBilling;
    if (t.canScheduleWithoutBilling === undefined) t.canScheduleWithoutBilling = d.canScheduleWithoutBilling !== false;
    if (t.deposit === undefined) t.deposit = d.deposit || 0;
    if (t.price === undefined) t.price = d.price != null ? d.price : (t.dur || 30) * 20;
    if (t.isExtension === undefined) t.isExtension = !!d.isExtension;
  });
})();
function svcCfg(key) { return cTreat(key) || {}; }
/* ניתוב אוטומטי לפי השירותים שנבחרו (#7) */
function serviceRoute(keys) {
  const cfgs = keys.map(svcCfg);
  const meeting = cfgs.some(c => c.requiresMeeting);
  const billing = cfgs.some(c => c.requiresBilling);
  if (meeting && billing) return 'both';
  if (meeting) return 'schedule';
  if (billing) return 'purchase';
  return 'schedule';
}
const ROUTE_LBL = { schedule: 'תיאום פגישה', purchase: 'רכישה', both: 'תיאום + רכישה' };
function svcTotals(keys) {
  const c = keys.map(svcCfg);
  return { dur: c.reduce((s, x) => s + (x.dur || 0), 0), price: c.reduce((s, x) => s + (x.price || 0), 0), deposit: c.reduce((s, x) => s + (x.deposit || 0), 0) };
}

/* "בירור צורך" — needsQuestions() עבר למודול js/needs-criteria.js (רישום קריטריונים + הגדרות מנהל) */
/* אילוץ קריטי: אם לשירות שנבחר יש מטפל יחיד — לציין (אין טעם לחפש עומק זמינות) */
function needsConstraint(r) {
  const svcs = r.services || []; if (!svcs.length || typeof COORD_DOCTORS === 'undefined') return null;
  const eligible = COORD_DOCTORS.filter(d => svcs.every(k => d.skills.includes(k)));
  if (eligible.length === 1) return `שים לב: רק מטפל אחד (${eligible[0].name}) מבצע את השירות הזה — הזמינות מוגבלת אליו.`;
  if (eligible.length === 0) return `אין מטפל יחיד לכל השירותים — יידרש תיאום נפרד.`;
  return null;
}
/* באנר אילוצים+קריטריונים — מוצג גם בבחירת שירות וגם בפופ-אפ התיאום, עם חזרה מהירה לקריטריונים */
function needsBannerHTML(r, ctx) {
  const con = needsConstraint(r);
  const miss = (typeof needsMissingRequired === 'function') ? needsMissingRequired(r) : [];
  const sum = (typeof needsSummary === 'function') ? needsSummary(r) : [];
  if (!con && !miss.length && !sum.length) return '';
  return `<div class="needs-banner ${miss.length ? 'blocked' : con ? 'warn' : ''}" data-needsbanner="${ctx || ''}">
    ${con ? `<div class="nb-line">${ic('alert')} ${esc(con)}</div>` : ''}
    ${miss.length ? `<div class="nb-line req">${ic('lock')} חסר קריטריון חובה לפני תיאום: <b>${miss.map(esc).join(' · ')}</b></div>` : ''}
    ${sum.length ? `<div class="nb-line sum">${ic('target')} צורך: ${sum.map(esc).join(' · ')}</div>` : ''}
    <button class="nb-edit" data-needsedit>${ic('settings')} עדכן קריטריונים</button>
  </div>`;
}
/* חיווט הכפתור "עדכן קריטריונים" — פותח את בירור הצורך מכל הקשר */
function bindNeedsBanner(r, after) {
  $$('[data-needsedit]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof openNeedsClarify === 'function') openNeedsClarify(r, after);
  }));
}
/* גוף השאלות — משותף למודל ולתצוגה בתוך שלב "בירור צורך" בציר הטיפול */
function needsQuestionsHTML(r) {
  r.needs = r.needs || {};
  const qs = needsQuestions(r), con = needsConstraint(r);
  return `${con ? `<div class="needs-con">${ic('alert')} ${con}</div>` : ''}
    ${qs.map(q => `<div class="needs-q"><label class="needs-lbl">${q.label}</label>
      <div class="needs-opts">${q.opts.map(o => `<button class="needs-opt ${((r.needs[q.key] || '') === o.v) ? 'on' : ''}" data-nq="${q.key}" data-nv="${o.v}">${o.t}${o.hint ? `<small class="nopt-hint">${esc(o.hint)}</small>` : ''}</button>`).join('')}</div></div>`).join('')}
    ${typeof critDerivedHTML === 'function' ? critDerivedHTML(r) : ''}
    ${typeof critEffectsBarHTML === 'function' ? critEffectsBarHTML(r) : ''}`;
}
function openNeedsClarify(r, after) {
  r.needs = r.needs || {};
  const qs = needsQuestions(r), con = needsConstraint(r);
  $('#modal').style.maxWidth = '520px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('tasks')}</span> בירור צורך · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body needs-body">
      <p class="needs-hint">${ic('bolt')} השאלות נגזרות מהקריטריונים שהוגדרו (הגדרות › שדות פנייה › קריטריוני בירור צורך) — מוצגות רק הרלוונטיות.</p>
      ${con ? `<div class="needs-con">${ic('alert')} ${con}</div>` : ''}
      ${typeof leadAddrHTML === 'function' ? leadAddrHTML(r) : ''}
      ${(() => {   // התראה דינמית: הבחירה הנוכחית נפסלה בגלל קריטריון אחר
        const bad = qs.filter(q => { const v = r.needs[q.key]; if (!v) return false; const o = (q.opts || []).find(x => x.v === v); return o && o.blocked; })
          .map(q => { const o = q.opts.find(x => x.v === r.needs[q.key]); return `${o.t} — ${o.why}`; });
        return bad.length ? `<div class="needs-con blocked">${ic('alert')} <b>הבחירה אינה אפשרית:</b> ${bad.map(esc).join(' · ')}<br><small>בחר אפשרות אחרת או שנה את הקריטריון שחוסם.</small></div>` : '';
      })()}
      ${qs.filter(q => !q.inline).map(q => `<div class="needs-q"><label class="needs-lbl">${q.label}${q.required ? ' <span class="needs-req">חובה</span>' : ''}</label>
        ${q.src ? `<small class="needs-src">${ic('docs')} מקור: ${esc(q.src)}${q.detail ? ' · ' + esc(q.detail) : ''}</small>` : ''}
        <div class="needs-opts">${q.opts.map(o => `<button class="needs-opt ${(typeof needsAnswered === 'function' ? needsAnswered(r, q.key) : true) && (r.needs[q.key] || '') === o.v ? 'on' : ''} ${o.blocked ? 'blocked' : ''} ${o.other ? 'other' : ''}" data-nq="${q.key}" data-nv="${esc(o.v)}" ${o.blocked ? `data-nwhy="${esc(o.why)}" title="${esc(o.why)}"` : ''}>${o.t}${o.blocked ? ' ' + ic('lock') : ''}${o.hint ? `<small class="nopt-hint">${esc(o.hint)}</small>` : ''}</button>`).join('')}</div></div>`).join('')}
      ${typeof critDerivedHTML === 'function' ? critDerivedHTML(r) : ''}
      ${typeof critOverrideBarHTML === 'function' ? critOverrideBarHTML(r) : ''}
      ${typeof critEffectsBarHTML === 'function' ? critEffectsBarHTML(r) : ''}
      <div class="needs-q"><label class="needs-lbl">${ic('note')} מידע חשוב נוסף</label>
        <textarea class="cc-inp" id="needsNoteM" rows="2" placeholder="רגישויות, אילוצים, בקשות מיוחדות…">${esc(r.needs.note || '')}</textarea></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" id="needsCancel">ביטול</button><button class="btn primary" id="needsSave">${ic('check')} שמור והמשך</button></div>`;
  $('#closeModal').addEventListener('click', closeModal); $('#needsCancel').addEventListener('click', closeModal);
  // כתובת הלקוח + תעדוף סניף קרוב — רינדור מחדש כדי לעדכן את דירוג הסניפים
  if (typeof bindLeadAddr === 'function') bindLeadAddr(r, () => { const nt = $('#needsNoteM'); if (nt) r.needs.note = nt.value; openNeedsClarify(r, after); });
  if (typeof bindCritDerived === 'function') bindCritDerived(r, () => { const nt = $('#needsNoteM'); if (nt) r.needs.note = nt.value; openNeedsClarify(r, after); });
  $$('[data-nq]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nwhy) { toast('לא אפשרי: ' + b.dataset.nwhy); return; }   // אפשרות חסומה — מציג את הסיבה
    r.needs[b.dataset.nq] = b.dataset.nv;
    const nt = $('#needsNoteM'); if (nt) r.needs.note = nt.value;
    openNeedsClarify(r, after);   // רינדור מחדש — הפסילות מתעדכנות דינמית תוך כדי הבחירה
  }));
  $('#needsSave').addEventListener('click', () => {
    const nt = $('#needsNoteM'); if (nt) r.needs.note = nt.value;
    const miss = (typeof needsMissingRequired === 'function') ? needsMissingRequired(r) : [];
    if (miss.length) { toast('חסר קריטריון חובה: ' + miss.join(' · ')); return; }
    closeModal();
    toast('הצורך נשמר · הזמנים יסוננו לפי ההעדפות');
    if (typeof after === 'function') { after(); return; }
    if (!(r.services || []).length) { if (typeof openServiceSelect === 'function') openServiceSelect(r); }
    else if (typeof openProposedTimes === 'function') openProposedTimes(r);
  });
  $('#modalWrap').classList.add('open');
}

/* ---------- מסך בחירת שירות/מוצר (#6) ---------- */
let svcSelState = { rec: null, sel: [] };
function openServiceSelect(r) {
  svcSelState = { rec: r, sel: (r.services || []).slice() };
  renderServiceSelect();
  $('#modalWrap').classList.add('open');
}
function renderServiceSelect() {
  const r = svcSelState.rec, sel = svcSelState.sel;
  // הרחבת שירות → רק פריטים שסומנו כ"הרחבה" בקטלוג
  const isUpsell = r && r.journey === 'upsell';
  const exts = COORD_TREATMENTS.filter(t => t.isExtension);
  const catalog = (isUpsell && exts.length) ? exts : COORD_TREATMENTS;
  const route = sel.length ? serviceRoute(sel) : null;
  const tot = svcTotals(sel);
  $('#modal').style.maxWidth = '560px'; $('#modal').style.height = '';
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('tasks')}</span> בחירת שירות / מוצר · ${r.name}</div>
      <button class="close-btn" id="closeModal">${ic('close')}</button></div>
    <div class="modal-body svc-sel">
      ${typeof needsBannerHTML === 'function' ? needsBannerHTML(r, 'svcsel') : ''}
      ${typeof fitBarHTML === 'function' ? fitBarHTML(r) : ''}
      <div class="svc-list">
        ${catalog.map(t => {
          const on = sel.includes(t.key);
          const fitWhy = (typeof fitBlockReason === 'function') ? fitBlockReason(r, t.key) : null;
          return `<button class="svc-card ${on ? 'on' : ''} ${fitWhy ? 'fit-blocked' : ''}" data-svc="${t.key}" ${fitWhy ? `data-svcwhy="${esc(fitWhy)}"` : ''}>
            <span class="svc-check">${on ? ic('check') : ''}</span>
            <span class="svc-main"><b>${t.label}</b><small>${t.kind} · ${t.dur} ד׳${t.price ? ' · ' + t.price + ' ₪' : ''}</small></span>
            <span class="svc-tags">
              ${fitWhy ? `<span class="svc-tag blocked">${ic('lock')} ${esc(fitWhy)}</span>` : ''}
              ${t.isExtension ? `<span class="svc-tag ext">${ic('layers')} הרחבה</span>` : ''}
              ${t.requiresMeeting ? `<span class="svc-tag meet">${ic('calendar')} פגישה</span>` : ''}
              ${t.requiresBilling ? `<span class="svc-tag bill">₪ סליקה</span>` : `<span class="svc-tag free">ללא סליקה</span>`}
              ${t.deposit ? `<span class="svc-tag dep">מקדמה ${t.deposit}₪</span>` : ''}
            </span>
            <button class="svc-cfg" data-svccfg="${t.key}" title="הגדרות השירות" aria-label="הגדרות">${ic('settings')}</button>
          </button>`;
        }).join('')}
      </div>
      ${sel.length ? `<div class="svc-summary">
        <div class="ss-route">${ic('bolt')} ניתוב אוטומטי: <b>${ROUTE_LBL[route]}</b></div>
        <div class="ss-totals"><span>${sel.length} פריטים</span><span>${tot.dur} ד׳</span><span>${tot.price} ₪</span>${tot.deposit ? `<span>מקדמה ${tot.deposit}₪</span>` : ''}</div>
      </div>` : `<div class="svc-empty-hint">${ic('alert')} בחר שירות/מוצר אחד או יותר — המערכת תחליט אוטומטית אם להמשיך לתיאום, רכישה או שניהם.</div>`}
    </div>
    <div class="modal-foot svc-foot">
      <button class="btn ghost" id="svcCancel">ביטול</button>
      <button class="btn" id="svcSaveOnly" ${sel.length ? '' : 'disabled'}>${ic('check')} בחירה</button>
      <button class="btn primary" id="svcNext" ${sel.length ? '' : 'disabled'}>בחירה והמשך לתיאום ${ic('chevronL')}</button>
    </div>`;
  $('#closeModal').addEventListener('click', closeModal);
  $('#svcCancel').addEventListener('click', closeModal);
  if (typeof bindNeedsBanner === 'function') bindNeedsBanner(r, () => openServiceSelect(r));   // חזרה לבחירת שירות אחרי עדכון קריטריונים
  $$('[data-svc]').forEach(b => b.addEventListener('click', e => {
    if (e.target.closest('[data-svccfg]')) return;
    if (b.dataset.svcwhy) { toast('לא מוצע ללקוח — ' + b.dataset.svcwhy); return; }   // נחסם בשאלון ההתאמה
    const k = b.dataset.svc, i = sel.indexOf(k);
    i >= 0 ? sel.splice(i, 1) : sel.push(k);
    renderServiceSelect();
  }));
  $$('[data-svccfg]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openServiceCfgEditor(b.dataset.svccfg); }));
  // "בחירה" — שומר את הפריטים לליד בלי לעבור לתיאום (זמין להצעת מחיר ולפגישה אישית, כדי לזכור במה התעניין)
  const so = $('#svcSaveOnly'); if (so) so.addEventListener('click', () => {
    if (!sel.length) return;
    svcSelState.rec.services = sel.slice();
    closeModal();
    // רענון שלב הליד כדי שהבחירה תיראה מיד (חיווי "נבחר" + הפריטים)
    if (typeof renderDrawerTab === 'function' && typeof selectedId !== 'undefined' && selectedId === svcSelState.rec.id) renderDrawerTab(svcSelState.rec);
    else if (typeof openDrawer === 'function' && $('#drawer') && $('#drawer').classList.contains('open')) openDrawer(svcSelState.rec);
    toast(`נשמרו ${sel.length} פריטים לליד · זמינים להצעת מחיר ולפגישה (${svcTotals(sel).price} ₪)`);
  });
  // "בחירה והמשך לתיאום" — שומר וממשיך למסך הזמנים
  const nx = $('#svcNext'); if (nx) nx.addEventListener('click', () => {
    if (!sel.length) return;
    svcSelState.rec.services = sel.slice();
    const route = serviceRoute(sel);
    closeModal();
    if (typeof openProposedTimes === 'function') openProposedTimes(svcSelState.rec);
    if (route === 'both') setTimeout(() => toast(`לאחר התיאום — רכישה על סך ${svcTotals(sel).price} ₪`), 400);
  });
}

/* ---------- עורך תצורת שירות (#8) — מרוכז בקטלוג ---------- */
function openServiceCfgEditor(key) {
  const t = cTreat(key); if (!t) return;
  $('#modal').style.maxWidth = '460px';
  const prev = $('#modal').innerHTML;
  $('#modal').innerHTML = `
    <div class="modal-head"><div class="title"><span class="num">${ic('settings')}</span> הגדרות שירות · ${t.label}</div>
      <button class="close-btn" id="cfgClose">${ic('close')}</button></div>
    <div class="modal-body svc-cfg">
      <label class="cfg-row"><span>דורש פגישה</span><input type="checkbox" data-cfg="requiresMeeting" ${t.requiresMeeting ? 'checked' : ''}></label>
      <label class="cfg-row"><span>דורש סליקה</span><input type="checkbox" data-cfg="requiresBilling" ${t.requiresBilling ? 'checked' : ''}></label>
      <label class="cfg-row"><span>ניתן לתאם ללא סליקה</span><input type="checkbox" data-cfg="canScheduleWithoutBilling" ${t.canScheduleWithoutBilling ? 'checked' : ''}></label>
      <label class="cfg-row"><span>משך פגישה (ד׳)</span><input type="number" class="cc-inp" data-cfg="dur" min="15" max="180" step="15" value="${t.dur}"></label>
      <label class="cfg-row"><span>מחיר (₪)</span><input type="number" class="cc-inp" data-cfg="price" min="0" step="10" value="${t.price}"></label>
      <label class="cfg-row"><span>גובה מקדמה (₪)</span><input type="number" class="cc-inp" data-cfg="deposit" min="0" step="10" value="${t.deposit}"></label>
      <p class="cfg-hint">${ic('bolt')} התצורה מרוכזת בקטלוג ומשפיעה על הניתוב, הזמנים המוצעים והמחיר לאורך כל התהליך.</p>
    </div>
    <div class="modal-foot"><button class="btn primary block" id="cfgSave">${ic('check')} שמור</button></div>`;
  $('#cfgClose').addEventListener('click', () => { $('#modal').innerHTML = prev; renderServiceSelect(); });
  $('#cfgSave').addEventListener('click', () => {
    $$('[data-cfg]').forEach(inp => {
      const k = inp.dataset.cfg;
      t[k] = inp.type === 'checkbox' ? inp.checked : +inp.value;
    });
    if (typeof window !== 'undefined') window.__coordPool = null;
    renderServiceSelect(); toast('הגדרות השירות נשמרו');
  });
}
