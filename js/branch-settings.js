/* ============================================================
   הגדרות סניף — חלון מלא מודולרי (נפתח בלחיצה על סניף)
   ------------------------------------------------------------
   משתמש בשלד ה-CSS של חלון שעות-הפעילות (.whs-*).
   פאנלים עצמאיים ב-BR_PANELS. תוספת מרכזית: יומן פיצולים פר-סניף —
   כל פיצול-זמן מתויג לקהל/שירות (למשל מבוגרים בבוקר, ילדים בצהריים).
   ============================================================ */
let brWinKey = null;
let brActive = 'general';
const BRANCH_AUDIENCES = ['כללי', 'מבוגרים', 'ילדים', 'צעירים', 'נשים', 'גברים'];
const BR_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function brOf(key) { return (typeof COORD_BRANCHES !== 'undefined') && COORD_BRANCHES.find(b => b.key === key); }
function brH(n) { return String(n).padStart(2, '0') + ':00'; }
/* השלמת שדות חסרים לסניף (שם עצמאי, קואורדינטות, יומן פיצולים) */
function ensureBranchFields(b) {
  if (b.name === undefined) b.name = b.label || b.short || 'סניף';
  if (b.lat === undefined) b.lat = '';
  if (b.lng === undefined) b.lng = '';
  if (b.verified === undefined) b.verified = !!(b.city && b.street && b.num);   // כתובת קיימת נחשבת מאומתת
  if (!b.attrs) b.attrs = {};                 // מאפייני נגישות/מידע (נגישות, נכים, חנייה, מעלית)
  if (!b.infoCriteria) b.infoCriteria = [];   // מידע חובה גנרי נוסף (טקסט חופשי)
  if (!b.svcMode) b.svcMode = {};             // סיווג שירות: 'general' (כללי לסניף) / 'shift' (לפי משמרת)
  if (!b.svcCriteria) b.svcCriteria = {};     // בחירת ערכים פר-שירות { [svcKey]: { [critLabel]: [values] } }
  if (!b.brCriteria) b.brCriteria = {};       // בחירת ערכים כללית לסניף { [critLabel]: [values] }
  if (!b.critMode) b.critMode = {};           // מצב קריטריון: 'general' (כללי לסניף) / 'byservice' (לפי שירות)
  if (!b.schedule) {
    b.schedule = {};
    (b.days || []).forEach(di => { b.schedule[di] = { on: true, splits: [{ from: brH(b.from || 8), to: brH(b.to || 17), svcs: ['כללי'] }] }; });
  }
  // מיגרציה: svc יחיד → svcs מרובה
  Object.values(b.schedule).forEach(d => (d.splits || []).forEach(s => { if (s.svcs === undefined) s.svcs = s.svc ? [s.svc] : ['כללי']; delete s.svc; }));
  return b;
}
/* אפשרויות תיוג לפיצול = רק שירותים שסווגו "לפי משמרת" (השאר כלליים לסניף) + "כללי" */
function brSvcOptions(b) {
  const shift = (b.treatments || []).filter(k => (b.svcMode && b.svcMode[k]) === 'shift').map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k);
  return ['כללי', ...shift];
}
/* מאפייני נגישות/מידע-חובה סטנדרטיים של סניף */
const BR_ATTRS = [
  { key: 'access', label: 'נגישות', icon: 'check' },
  { key: 'disabled', label: 'נגיש לנכים', icon: 'user' },
  { key: 'parking', label: 'חנייה', icon: 'org' },
  { key: 'elevator', label: 'מעלית', icon: 'layers' },
];

const BR_PANELS = [
  { key: 'general', label: 'פרטי הסניף',    icon: 'org',      render: brPanelGeneral,  bind: brBindGeneral },
  { key: 'hours',   label: 'יומן ופיצולים', icon: 'clock',    render: brPanelHours,    bind: brBindHours },
  { key: 'services', label: 'שירותים',      icon: 'tasks',    render: brPanelServices, bind: brBindServices },
];
function brPanelDef(k) { return BR_PANELS.find(p => p.key === k) || BR_PANELS[0]; }

function openBranchSettings(key, panel) {
  const b = brOf(key); if (!b) return;
  ensureBranchFields(b); brWinKey = key; brActive = panel || 'general';
  let ov = document.getElementById('brOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'brOverlay'; ov.className = 'whs-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = `
    <div class="whs-window" role="dialog" aria-modal="true" aria-label="הגדרות סניף">
      <header class="whs-head">
        <div class="whs-head-r">
          <button class="whs-x" id="brClose" aria-label="סגור">${ic('close')}</button>
          <div class="whs-title">${ic('org')} <b>הגדרות סניף · <span id="brTitleName">${esc(b.name)}</span></b></div>
        </div>
        <button class="btn primary whs-save" id="brSave">${ic('check')} שמירה</button>
      </header>
      <div class="whs-body">
        <aside class="whs-side">${BR_PANELS.map(p => `<button class="whs-nav ${p.key === brActive ? 'on' : ''}" data-br-nav="${p.key}">${ic(p.icon)} <span>${p.label}</span></button>`).join('')}</aside>
        <main class="whs-content" id="brContent"></main>
      </div>
      <footer class="whs-foot">
        <div class="whs-autosave">${ic('check')} השינויים נשמרים אוטומטית</div>
        <div class="whs-tz">${ic('user')} מנהל: <b style="margin-inline-start:5px">${(STAFF.find(s => s.id === b.mgr) || {}).name || '—'}</b></div>
      </footer>
    </div>`;
  requestAnimationFrame(() => ov.classList.add('open'));
  $('#brClose').addEventListener('click', closeBranchSettings);
  $('#brSave').addEventListener('click', () => { toast('הגדרות הסניף נשמרו ✓'); closeBranchSettings(); });
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeBranchSettings(); });
  $$('[data-br-nav]').forEach(x => x.addEventListener('click', () => { brActive = x.dataset.brNav; $$('[data-br-nav]').forEach(n => n.classList.toggle('on', n === x)); brRenderPanel(); }));
  brRenderPanel();
}
function closeBranchSettings() {
  const ov = document.getElementById('brOverlay');
  if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); }
  if (typeof renderSettingsView === 'function' && $('#viewHost')) renderSettingsView();
}
function brRenderPanel() {
  const host = document.getElementById('brContent'); if (!host) return;
  const b = brOf(brWinKey); if (!b) return;
  const p = brPanelDef(brActive);
  host.innerHTML = p.render(b); p.bind(b);
}

/* ---------- פאנל: פרטי הסניף (שם עצמאי + כתובת מגוגל) ---------- */
function brPanelGeneral(b) {
  const cities = (typeof IL_CITIES !== 'undefined') ? IL_CITIES : [];
  return `
    <h3 class="whs-ph">${ic('org')} פרטי הסניף</h3>
    <div class="whs-secgrid">
      <section class="whs-sec">
        <h4>${ic('org')} זיהוי</h4>
        <div class="field"><label>שם הסניף <small class="muted">(עצמאי — לא נגזר מהעיר)</small></label>
          <input class="cc-inp" id="brName" value="${esc(b.name)}" placeholder="למשל: סניף המרכז / הקליניקה של דנה"></div>
        <div class="br-active-row"><span>סניף פעיל</span>${whsTgl(b.active, 'bract', 0)}</div>
      </section>
      <section class="whs-sec">
        <h4>${ic('org')} כתובת מדויקת
          <span class="br-verify-badge ${b.verified ? 'ok' : 'no'}">${b.verified ? ic('check') + ' אומת' : ic('alert') + ' לא אומת'}</span></h4>
        <div class="field"><label>עיר / יישוב</label>
          <input class="cc-inp" id="brCity" list="brCities" value="${esc(b.city || '')}" placeholder="הקלד עיר או יישוב בישראל"></div>
        <datalist id="brCities">${cities.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
        <div class="cat-edit-row">
          <div class="field"><label>רחוב</label><input class="cc-inp" id="brStreet" list="brStreets" value="${esc(b.street || '')}" placeholder="רחוב"></div>
          <div class="field" style="max-width:90px"><label>מס׳</label><input class="cc-inp" id="brNum" value="${esc(b.num || '')}" placeholder="מס׳"></div>
        </div>
        <datalist id="brStreets">${(typeof IL_STREETS !== 'undefined' ? IL_STREETS : []).map(s => `<option value="${s}">`).join('')}</datalist>
        <button class="btn sm block ${b.verified ? '' : 'primary'}" id="brGeocode" style="margin-top:10px">${b.verified ? ic('sync') + ' אמת מחדש' : ic('search') + ' אמת כתובת'}</button>
        ${b.verified ? `<button class="btn sm block primary" id="brShowMap" style="margin-top:8px">${ic('org')} הצג את המיקום במפה</button>` : ''}
        <p class="hint" style="margin-top:8px">${ic('alert')} בהשקה: אימות מלא מול <b>Google Places</b> יאשר קיום-כתובת אמיתי ויאחסן מיקום ברקע (לחישוב מרחק וניתוב צפון↔דרום). בדמו נבדקת סבירות בלבד (Google חסום ב-CSP). שינוי עיר / רחוב / מספר מבטל את האימות.</p>
      </section>
    </div>`;
}
function brBindGeneral(b) {
  const nm = $('#brName'); if (nm) nm.addEventListener('input', () => { b.name = nm.value; const t = $('#brTitleName'); if (t) t.textContent = b.name; });
  // שינוי עיר/רחוב/מספר → מבטל אימות ומצריך אימות מחדש
  const invalidate = (field, val) => { b[field] = val; if (b.verified) { b.verified = false; b.lat = ''; b.lng = ''; brRenderPanel(); } };
  const cy = $('#brCity'); if (cy) cy.addEventListener('change', () => invalidate('city', cy.value));
  const st = $('#brStreet'); if (st) st.addEventListener('change', () => invalidate('street', st.value));
  const nu = $('#brNum'); if (nu) nu.addEventListener('change', () => invalidate('num', nu.value));
  $$('[data-whs-tgl="bract:0"]').forEach(t => t.addEventListener('click', () => { b.active = !b.active; brRenderPanel(); toast(b.active ? 'הסניף הופעל' : 'הסניף כובה'); }));
  const gc = $('#brGeocode'); if (gc) gc.addEventListener('click', () => {
    // סנכרון ערכים אחרונים לפני אימות
    if (cy) b.city = (cy.value || '').trim(); if (st) b.street = (st.value || '').trim(); if (nu) b.num = (nu.value || '').trim();
    if (!b.city || !b.street) { toast('נא למלא עיר ורחוב'); return; }
    // אימות קיום-כתובת אמיתי מחייב חיבור חי ל-Google Geocoding/Places (חסום ב-CSP של הדמו) — יעבוד בהשקה.
    // בדמו: בדיקת סבירות בלבד (עיר+רחוב מלאים, מספר בית 1–999) — בלי רשימת ערים סגורה שפוסלת ערים אמיתיות.
    const numOk = /^\d{1,3}$/.test((b.num || '').trim()) && +b.num >= 1 && +b.num <= 999;
    if (!numOk) { toast('מספר בית לא תקין — הזן מספר בין 1 ל-999.'); return; }
    // מיקום ברקע (בהשקה — קואורדינטות אמיתיות מ-Google)
    b.lat = (31.4 + (b.city.length * 7 % 33) / 10).toFixed(4);
    b.lng = (34.5 + (b.street.length * 5 % 22) / 10).toFixed(4);
    b.verified = true;
    brRenderPanel(); toast(`הכתובת אומתה ✓ · ${b.street} ${b.num}, ${b.city}`);
  });
  const sm = $('#brShowMap'); if (sm) sm.addEventListener('click', () => openBranchMap(b));
}
/* פופ-אפ מפה — מציג את מיקום הסניף וקישור ל-Google Maps (דמו: תצוגת מפה מוטמעת חסומה ב-CSP) */
function openBranchMap(b) {
  const old = document.getElementById('brMapPop'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'brMapPop';
  const q = encodeURIComponent(`${b.street} ${b.num}, ${b.city}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}(${q})`;
  w.innerHTML = `<div class="cbc-box br-map-box">
      <div class="cbc-head"><span class="cbc-ic">${ic('org')}</span><b>מיקום הסניף · ${esc(b.name)}</b></div>
      <div class="br-map-view">
        <svg viewBox="0 0 320 160" class="br-map-svg" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="160" fill="#EAF0F6"/>
          <path d="M0 60 H320 M0 110 H320 M90 0 V160 M210 0 V160" stroke="#D6E0EA" stroke-width="6"/>
          <path d="M0 92 Q160 70 320 100" stroke="#BFE0C8" stroke-width="10" fill="none"/>
          <circle cx="160" cy="82" r="9" fill="#5B4CE6"/><circle cx="160" cy="82" r="20" fill="#5B4CE6" opacity="0.18"/>
        </svg>
        <div class="br-map-addr">${ic('org')} ${esc(b.street)} ${esc(b.num)}, ${esc(b.city)} <small>· ${b.lat}, ${b.lng}</small></div>
      </div>
      <div class="cbc-actions">
        <button class="btn ghost" id="brMapClose">סגור</button>
        <a class="btn primary" href="${mapsUrl}" target="_blank" rel="noopener">${ic('org')} פתח ב-Google Maps</a>
      </div>
    </div>`;
  document.body.appendChild(w);
  requestAnimationFrame(() => w.classList.add('open'));
  const close = () => w.remove();
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#brMapClose').addEventListener('click', close);
}

/* ---------- פאנל: יומן ופיצולים (פיצול-זמן מתויג לקהל/שירות) ---------- */
function brPanelHours(b) {
  const opts = brSvcOptions(b);
  const emptySvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M9.5 14l5 5M14.5 14l-5 5"/></svg>';
  // כרטיס יום בסגנון היומן של העובד (wh-day) — עם פיצולים כבלוקים נקיים
  const dayCard = di => {
    const d = b.schedule[di] || { on: false, splits: [] };
    const body = d.on
      ? `<div class="wh-segs">${(d.splits || []).map((s, si) => `
           <div class="wh-seg shift br-seg">
             <div class="wh-seg-top"><span class="wh-seg-lbl">${d.splits.length > 1 ? 'משמרת ' + (si + 1) : 'משמרת'}</span>
               ${(d.splits.length > 1) ? `<button class="wh-seg-x" data-brsplitdel="${di}:${si}" title="הסר פיצול">${ic('close')}</button>` : ''}</div>
             <div class="wh-seg-time"><input type="time" value="${s.from}" data-brsplit="${di}:${si}:from"><span class="wh-seg-dash">–</span><input type="time" value="${s.to}" data-brsplit="${di}:${si}:to"></div>
             <div class="br-split-svcs">${opts.map(o => `<button type="button" class="br-svc-chip ${(s.svcs || []).includes(o) ? 'on' : ''}" data-brsplitsvc="${di}:${si}|${esc(o)}">${o}</button>`).join('')}</div>
           </div>`).join('')}</div>
         <div class="wh-dayadd"><button class="wh-add" data-braddsplit="${di}">${ic('plus')} הוסף פיצול</button></div>`
      : `<div class="wh-day-empty"><span class="wh-empty-ic">${emptySvg}</span><span>סגור</span></div>`;
    return `<div class="wh-day ${d.on ? '' : 'off'}">
      <div class="wh-day-head"><b class="wh-name">${BR_DAY_NAMES[di]}</b><span class="toggle wh-toggle ${d.on ? 'on' : ''}" data-brdaytgl="${di}"><i></i></span></div>
      ${body}</div>`;
  };
  return `
    <h3 class="whs-ph">${ic('clock')} יומן הסניף · פיצולי שירות</h3>
    <p class="hint" style="margin-top:0;margin-bottom:14px">${ic('alert')} כל פיצול-זמן מתויג לקהל/שירות (בחירה מרובה) — למשל מבוגרים בבוקר וילדים בצהריים, או חוגי בוקר לצעירים וחוגי ערב למבוגרים.</p>
    <div class="wh-daysgrid br-daysgrid">${[0, 1, 2, 3, 4, 5, 6].map(dayCard).join('')}</div>`;
}
function brBindHours(b) {
  $$('[data-brdaytgl]').forEach(t => t.addEventListener('click', () => {
    const di = +t.dataset.brdaytgl;
    b.schedule[di] = b.schedule[di] || { on: false, splits: [] };
    b.schedule[di].on = !b.schedule[di].on;
    if (b.schedule[di].on && !b.schedule[di].splits.length) b.schedule[di].splits = [{ from: brH(b.from || 8), to: brH(b.to || 17), svcs: ['כללי'] }];
    brRenderPanel();
  }));
  $$('[data-brsplit]').forEach(el => el.addEventListener('change', () => {
    const [di, si, f] = el.dataset.brsplit.split(':'); const d = b.schedule[+di]; if (d && d.splits[+si]) d.splits[+si][f] = el.value;
  }));
  $$('[data-brsplitsvc]').forEach(btn => btn.addEventListener('click', () => {
    const [pos, svc] = btn.dataset.brsplitsvc.split('|'); const [di, si] = pos.split(':');
    const s = b.schedule[+di].splits[+si]; s.svcs = s.svcs || [];
    const i = s.svcs.indexOf(svc); i >= 0 ? s.svcs.splice(i, 1) : s.svcs.push(svc);
    brRenderPanel();
  }));
  $$('[data-braddsplit]').forEach(btn => btn.addEventListener('click', () => {
    const di = +btn.dataset.braddsplit, d = b.schedule[di]; const last = d.splits[d.splits.length - 1];
    d.splits.push({ from: last ? last.to : '08:00', to: last ? brH(Math.min(23, +last.to.split(':')[0] + 2)) : '10:00', svcs: ['כללי'] });
    brRenderPanel();
  }));
  $$('[data-brsplitdel]').forEach(btn => btn.addEventListener('click', () => {
    const [di, si] = btn.dataset.brsplitdel.split(':'); b.schedule[+di].splits.splice(+si, 1); brRenderPanel();
  }));
}

/* ---------- פאנל: שירותים + קריטריוני/קהלי הסניף ---------- */
function brPanelServices(b) {
  const cat = (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : [];
  return `
    <h3 class="whs-ph">${ic('tasks')} שירותים וקריטריונים של הסניף</h3>
    <section class="whs-sec whs-sec-wide">
      <h4>${ic('tasks')} שירותים נתמכים בסניף</h4>
      <div class="tag-wrap">${cat.map(t => `<button class="tag-chip ${(b.treatments || []).includes(t.key) ? 'on' : ''}" data-brtreatx="${t.key}">${t.label}</button>`).join('')}</div>
      <p class="hint" style="margin-top:10px">${ic('alert')} רק שירותים שסומנו יוצעו לתיאום בסניף זה (בכפוף למטפל מוסמך המקושר לסניף).</p>
      ${(b.treatments || []).length ? `<div class="br-svc-modes">
        <div class="chips-title" style="margin-top:12px">סיווג השירותים <small class="muted">— "לפי משמרת" יופיע כאפשרות תיוג בפיצולים; "כללי" חל על כל הסניף</small></div>
        ${(b.treatments || []).map(k => { const md = (b.svcMode && b.svcMode[k]) || 'general';
          return `<div class="br-svc-mode-row"><span>${(cTreat(k) ? cTreat(k).label : k)}</span>
            <div class="br-mode-seg"><button class="${md === 'general' ? 'on' : ''}" data-brsvcmode="${k}|general">כללי לסניף</button><button class="${md === 'shift' ? 'on' : ''}" data-brsvcmode="${k}|shift">לפי משמרת</button></div></div>`; }).join('')}
      </div>` : ''}
    </section>
    <section class="whs-sec whs-sec-wide" style="margin-top:14px">
      <h4>${ic('flag')} מאפייני סניף · נגישות ומידע חובה <small class="muted">— גנרי, מוצג לכל מי שמתאם</small></h4>
      <div class="br-attrs">${BR_ATTRS.map(a => `<label class="br-attr ${(b.attrs && b.attrs[a.key]) ? 'on' : ''}"><input type="checkbox" data-brattr="${a.key}" ${(b.attrs && b.attrs[a.key]) ? 'checked' : ''}>${ic(a.icon)} ${a.label}</label>`).join('')}</div>
      <div class="chips-title" style="margin-top:12px">מידע חובה נוסף: <small class="muted">(למשל: קבלת נשים בלבד בימי ג׳ בבוקר)</small></div>
      <div class="chips-wrap">${(b.infoCriteria || []).map((c, i) => `<span class="pill editable">${esc(c)}<button class="pill-x" data-brcritx="${i}" title="הסר">${ic('close')}</button></span>`).join('')}
        <button class="pill-add" data-brcritadd>${ic('plus')} הוסף מידע</button></div>
    </section>
    ${brSvcCriteriaHTML(b)}`;
}
/* קריטריונים מהקטלוג (למשל "הסדר קופה" עם ערכים כללית/מכבי) — נגזרים אוטומטית מהשירותים שבסניף,
   מאוחדים לפי שם קריטריון. כל קריטריון = "כללי לסניף" (חל על כל השירותים) או "לפי שירות". */
function brAggregateCriteria(b) {
  // נגזר מהרישום המרכזי: כל קריטריון שמשויך לשירות שהסניף מציע (t.critKeys)
  const map = {};
  (b.treatments || []).forEach(k => { const t = cTreat && cTreat(k); if (!t) return;
    ((t.critKeys) || []).forEach(ck => {
      const def = (typeof needsDefOf === 'function') ? needsDefOf(ck) : null;
      if (!def || !(def.values || []).length) return;
      const e = map[def.label] = map[def.label] || { label: def.label, detail: def.detail || '', values: [], services: [] };
      def.values.forEach(v => { if (!e.values.includes(v)) e.values.push(v); });
      if (!e.services.includes(k)) e.services.push(k);
    });
  });
  return Object.values(map);
}
function brSvcCriteriaHTML(b) {
  const crits = brAggregateCriteria(b);
  if (!crits.length) return '';
  return `<section class="whs-sec whs-sec-wide" style="margin-top:14px">
    <h4>${ic('flag')} קריטריונים והסדרים <small class="muted">— נגזרים מהשירותים; כלליים לסניף או לפי שירות</small></h4>
    ${crits.map(c => { const mode = b.critMode[c.label] || 'general';
      return `<div class="br-svc-crit">
        <div class="br-crit-head"><span class="br-crit-svc">${ic('tasks')} ${esc(c.label)}${c.detail ? ` <small class="muted">· ${esc(c.detail)}</small>` : ''}</span>
          <div class="br-mode-seg sm"><button class="${mode === 'general' ? 'on' : ''}" data-brcritmode="${esc(c.label)}|general">כללי לסניף</button><button class="${mode === 'byservice' ? 'on' : ''}" data-brcritmode="${esc(c.label)}|byservice">לפי שירות</button></div></div>
        ${mode === 'general'
          ? `<div class="br-crit-row"><span class="br-crit-name">ערכים בהסדר בסניף:</span>
              <div class="br-crit-vals">${c.values.map(v => { const sel = (b.brCriteria[c.label] || []).includes(v);
                return `<button type="button" class="br-crit-chip ${sel ? 'on' : ''}" data-brcritgen="${esc(c.label)}||${esc(v)}">${sel ? ic('check') + ' ' : ''}${v}</button>`; }).join('')}</div></div>`
          : c.services.map(k => `<div class="br-crit-row"><span class="br-crit-name">${esc(cTreat(k) ? cTreat(k).label : k)}:</span>
              <div class="br-crit-vals">${c.values.map(v => { const sel = ((b.svcCriteria[k] || {})[c.label] || []).includes(v);
                return `<button type="button" class="br-crit-chip ${sel ? 'on' : ''}" data-brcritval="${k}||${esc(c.label)}||${esc(v)}">${sel ? ic('check') + ' ' : ''}${v}</button>`; }).join('')}</div></div>`).join('')}
      </div>`; }).join('')}
  </section>`;
}
function brBindServices(b) {
  $$('[data-brtreatx]').forEach(btn => btn.addEventListener('click', () => {
    const k = btn.dataset.brtreatx; b.treatments = b.treatments || [];
    const i = b.treatments.indexOf(k); i >= 0 ? b.treatments.splice(i, 1) : b.treatments.push(k);
    if (typeof syncCoordStaff === 'function') syncCoordStaff();
    brRenderPanel();
  }));
  $$('[data-brattr]').forEach(cb => cb.addEventListener('change', () => { b.attrs = b.attrs || {}; b.attrs[cb.dataset.brattr] = cb.checked; brRenderPanel(); }));
  $$('[data-brsvcmode]').forEach(btn => btn.addEventListener('click', () => { const [k, m] = btn.dataset.brsvcmode.split('|'); b.svcMode = b.svcMode || {}; b.svcMode[k] = m; brRenderPanel(); }));
  $$('[data-brcritval]').forEach(btn => btn.addEventListener('click', () => {
    const [k, label, v] = btn.dataset.brcritval.split('||');
    b.svcCriteria[k] = b.svcCriteria[k] || {}; const arr = b.svcCriteria[k][label] = b.svcCriteria[k][label] || [];
    const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); brRenderPanel();
  }));
  // ערך כללי לסניף (חל על כל השירותים עם הקריטריון)
  $$('[data-brcritgen]').forEach(btn => btn.addEventListener('click', () => {
    const [label, v] = btn.dataset.brcritgen.split('||');
    const arr = b.brCriteria[label] = b.brCriteria[label] || [];
    const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); brRenderPanel();
  }));
  // מצב קריטריון: כללי לסניף / לפי שירות
  $$('[data-brcritmode]').forEach(btn => btn.addEventListener('click', () => { const [label, m] = btn.dataset.brcritmode.split('|'); b.critMode[label] = m; brRenderPanel(); }));
  $$('[data-brcritx]').forEach(btn => btn.addEventListener('click', () => { b.infoCriteria.splice(+btn.dataset.brcritx, 1); brRenderPanel(); }));
  const ca = $('[data-brcritadd]'); if (ca) ca.addEventListener('click', () => {
    if (typeof whsInputPop === 'function') whsInputPop('הוסף מידע חובה לסניף', 'למשל: קבלת נשים בלבד בימי ג׳ בבוקר', v => { b.infoCriteria = b.infoCriteria || []; b.infoCriteria.push(v); brRenderPanel(); toast('המידע נוסף'); });
  });
}
