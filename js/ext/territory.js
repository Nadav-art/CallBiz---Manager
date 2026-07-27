/* ============================================================
   הרחבה: שטח, אזורים והמלצות ניתוב  ·  key = 'terr'
   ------------------------------------------------------------
   איש שטח אינו יושב בסניף — הוא נוסע, ולרוב לפי ימים קבועים
   באזורים קבועים. ארבעה דברים חייבים להיות מוגדרים:
     1) אזורים, ומה נחשב "אותו טווח".
     2) מי מכסה איזה אזור, ובאילו ימים.
     3) סף כדאיות — מתי בכלל שווה לשלוח מישהו לאזור.
     4) מה קורה כשהתיאום סותר את כל זה.
   ומעל הכול: מנוע המלצות שאומר מה לעשות, ולא רק מה לא בסדר.
   כולל אזורי חלוקה למשלוחים.
   ============================================================ */
(function () {

  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const DAYS_S = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  const SEED_TERR = [
    { key: 'center', label: 'מרכז', color: 'brand', cities: ['תל אביב', 'רמת גן', 'גבעתיים', 'בני ברק'], minJobs: 1, ship: { on: true, freq: 'weekly', from: '2024-05-01', days: [0, 1, 2, 3, 4], cost: 0, minOrder: 0, eta: 'יום עסקים אחד' } },
    { key: 'sharon', label: 'שרון', color: 'green', cities: ['רעננה', 'כפר סבא', 'הוד השרון', 'נתניה', 'הרצליה'], minJobs: 2, ship: { on: true, freq: 'weekly', from: '2024-05-01', days: [0, 2, 4], cost: 25, minOrder: 150, eta: '1–2 ימי עסקים' } },
    { key: 'jlm', label: 'ירושלים והסביבה', color: 'orange', cities: ['ירושלים', 'מבשרת ציון', 'בית שמש', 'מודיעין'], minJobs: 3, ship: { on: true, freq: 'biweekly', from: '2024-05-01', days: [1], cost: 35, minOrder: 200, eta: '2–3 ימי עסקים' } },
    { key: 'north', label: 'צפון', color: 'blue', cities: ['חיפה', 'קריות', 'עכו', 'נהריה', 'טבריה'], minJobs: 4, ship: { on: true, freq: 'tri', from: '2024-05-01', days: [2], cost: 45, minOrder: 300, eta: '3 ימי עסקים' } },
    { key: 'south', label: 'דרום', color: 'red', cities: ['באר שבע', 'אשדוד', 'אשקלון', 'קרית גת'], minJobs: 4, ship: { on: false, freq: 'biweekly', from: '2024-05-01', days: [3], cost: 55, minOrder: 350, eta: '3–5 ימי עסקים' } },
  ];
  const SEED_TRAVEL = {
    'center|sharon': 30, 'center|jlm': 60, 'center|north': 90, 'center|south': 75,
    'sharon|jlm': 80, 'sharon|north': 70, 'sharon|south': 100,
    'jlm|north': 140, 'jlm|south': 90, 'north|south': 170,
  };
  /* אופני מסירה — לא כל אזור מקבל את כולם */
  const DELIV = [
    { key: 'home', label: 'משלוח עד הבית', icon: 'org', desc: 'שליח מגיע לכתובת הלקוח' },
    { key: 'point', label: 'נקודת איסוף', icon: 'target', desc: 'הלקוח אוסף מנקודה מוסכמת באזור' },
    { key: 'pickup', label: 'איסוף עצמי מהסניף', icon: 'home', desc: 'ללא עלות, כפוף לשעות הפתיחה' },
  ];
  const CFG_DEF = { on: true, mode: 'warn', inZone: 20, maxTravel: 45, buffer: 15, enforceDays: true, recommend: true };

  let TERR = CBX.load('terr_list', null) || JSON.parse(JSON.stringify(SEED_TERR));
  let TRAVEL = CBX.load('terr_travel', null) || Object.assign({}, SEED_TRAVEL);
  let ST = CBX.load('terr_staff', null) || {};    /* id -> { field, zones:[], days:{zone:[dow]} } */
  let SVC = CBX.load('terr_svc', null) || {};     /* svcKey -> { field:true, zones:[] } */
  let CFG = Object.assign({}, CFG_DEF, CBX.load('terr_cfg', {}));
  const saveT = () => CBX.store('terr_list', TERR);
  const saveTr = () => CBX.store('terr_travel', TRAVEL);
  const saveS = () => CBX.store('terr_staff', ST);
  const saveSv = () => CBX.store('terr_svc', SVC);
  const saveC = () => CBX.store('terr_cfg', CFG);

  const terr = k => TERR.find(t => t.key === k) || null;
  const tLabel = k => { const t = terr(k); return t ? t.label : '—'; };
  function travel(a, b) {
    if (!a || !b) return 0;
    if (a === b) return +CFG.inZone || 0;
    return +(TRAVEL[a + '|' + b] != null ? TRAVEL[a + '|' + b] : TRAVEL[b + '|' + a]) || 0;
  }
  function zoneOfCity(city) {
    const c = String(city || '').trim(); if (!c) return null;
    const hit = TERR.find(t => (t.cities || []).some(x => c.indexOf(x) >= 0 || x.indexOf(c) >= 0));
    return hit ? hit.key : null;
  }
  function zoneOfRec(r) {
    if (!r) return null;
    if (r.zone) return r.zone;
    const byCity = zoneOfCity(r.city || (r.needs || {}).city || ''); if (byCity) return byCity;
    const bk = (r.needs || {}).branch;
    const b = (bk && typeof cBranch === 'function') ? cBranch(bk) : null;
    return b ? zoneOfCity(b.city) : null;
  }
  const staffOf = id => ST[id] || {};
  const zonesOf = id => staffOf(id).zones || [];
  const daysOf = (id, z) => (staffOf(id).days || {})[z] || [];
  const fieldStaff = () => (typeof STAFF !== 'undefined' ? STAFF : []).filter(s => staffOf(s.id).field);
  const staffName = id => { const s = (typeof STAFF !== 'undefined') ? STAFF.find(x => String(x.id) === String(id)) : null; return s ? s.name : id; };
  const dowOf = d => { const t = Date.parse(d); return isNaN(t) ? -1 : new Date(t).getDay(); };
  /* מי מכסה אזור ביום מסוים — הבסיס לכל ההמלצות */
  const coversOn = (id, z, dow) => zonesOf(id).indexOf(z) >= 0 && (!CFG.enforceDays || !daysOf(id, z).length || daysOf(id, z).indexOf(dow) >= 0);
  function nextDayFor(id, z, fromDow) {
    const d = daysOf(id, z); if (!d.length) return null;
    for (let i = 1; i <= 7; i++) { const c = (fromDow + i) % 7; if (d.indexOf(c) >= 0) return c; }
    return null;
  }
  /* שירות שדורש הגעה לשטח */
  const svcIsField = k => !!(SVC[k] || {}).field;
  const recIsField = r => (r.services || []).some(svcIsField);

  /* ---------------- בדיקת התיאום ---------------- */
  function check(staffId, date, hour, zone) {
    const out = { ok: true, level: 'ok', why: '', conflicts: [], tips: [] };
    if (!CFG.on || !staffId || !zone) return out;
    const dow = dowOf(date);
    if (zonesOf(staffId).indexOf(zone) < 0) {
      out.ok = false; out.level = 'block';
      out.why = tLabel(zone) + ' אינו באזורי הכיסוי של ' + staffName(staffId);
      const alt = fieldStaff().filter(s => zonesOf(s.id).indexOf(zone) >= 0);
      if (alt.length) out.tips.push({ kind: 'staff', text: 'מכסים את ' + tLabel(zone) + ': ' + alt.map(s => s.name).join(' · ') });
      return out;
    }
    if (CFG.enforceDays && daysOf(staffId, zone).length && daysOf(staffId, zone).indexOf(dow) < 0) {
      out.level = CFG.mode === 'block' ? 'block' : 'warn'; out.ok = CFG.mode !== 'block';
      out.why = staffName(staffId) + ' לא באזור ' + tLabel(zone) + ' ביום ' + DAYS[dow];
      const nd = nextDayFor(staffId, zone, dow);
      if (nd != null) out.tips.push({ kind: 'day', dow: nd, text: 'הוא באזור הזה ביום ' + DAYS[nd] + ' — מומלץ לתאם אז' });
    }
    const same = dayAppointments(staffId, date);
    same.forEach(a => {
      if (!a.zone || a.zone === zone) return;
      const gapMin = Math.abs(a.h - hour) * 60;
      const need = travel(a.zone, zone) + (+CFG.buffer || 0);
      if (gapMin < need) out.conflicts.push({ why: 'בין ' + tLabel(a.zone) + ' ל' + tLabel(zone)
        + ' נדרשות ' + need + ' דק׳, ויש רק ' + Math.round(gapMin) });
      else if (travel(a.zone, zone) > (+CFG.maxTravel || 45)) out.conflicts.push({
        why: 'קפיצה בין ' + tLabel(a.zone) + ' ל' + tLabel(zone) + ' באותו יום (' + travel(a.zone, zone) + ' דק׳ נסיעה)' });
    });
    if (out.conflicts.length) {
      out.level = CFG.mode === 'block' ? 'block' : 'warn'; out.ok = CFG.mode !== 'block';
      out.why = out.why || out.conflicts[0].why;
      const zoneDays = daysOf(staffId, zone);
      if (zoneDays.length) out.tips.push({ kind: 'cluster',
        text: 'ריכוז: ' + tLabel(zone) + ' מכוסה בימים ' + zoneDays.map(d => DAYS[d]).join(', ') });
    }
    return out;
  }
  function dayAppointments(staffId, date) {
    const out = [];
    if (typeof coordPool === 'function') coordPool().forEach(sl => {
      if (String(sl.doc) !== String(staffId) || sl.date !== date) return;
      if (!sl.booked && !sl.held) return;
      const r = (typeof RECORDS !== 'undefined' && sl.recId) ? RECORDS.find(x => x.id === sl.recId) : null;
      out.push({ h: sl.h, rec: r, zone: (r ? zoneOfRec(r) : null)
        || zoneOfCity((typeof cBranch === 'function' && cBranch(sl.branch)) ? cBranch(sl.branch).city : '') });
    });
    return out.sort((a, b) => a.h - b.h);
  }
  function dayRoute(staffId, date) {
    const stops = dayAppointments(staffId, date);
    let drive = 0;
    for (let i = 1; i < stops.length; i++) drive += travel(stops[i - 1].zone, stops[i].zone);
    return { stops, drive, zones: [...new Set(stops.map(x => x.zone).filter(Boolean))] };
  }

  /* ---------------- מנוע ההמלצות ----------------
     לא "מה לא בסדר" אלא "מה כדאי לעשות". */
  function pending() {
    const R = (typeof RECORDS !== 'undefined') ? RECORDS : [];
    return R.filter(r => !r.done && !r.mergedInto && recIsField(r)).map(r => ({ r, zone: zoneOfRec(r) })).filter(x => x.zone);
  }
  function recommendations() {
    const out = [];
    const today = (typeof clockTodayISO === 'function') ? clockTodayISO() : '';
    const dow = dowOf(today);
    /* 1) לכל אזור — המלצה אחת בלבד. אזור בלי כיסוי לא אמור לקבל
       גם "שווה לצאת" וגם "אין כיסוי" — זו סתירה שמבלבלת. */
    const byZone = {};
    pending().forEach(x => (byZone[x.zone] = byZone[x.zone] || []).push(x.r));
    TERR.forEach(t => {
      const n = (byZone[t.key] || []).length, min = +t.minJobs || 1;
      if (!n) return;
      const who = fieldStaff().filter(s => zonesOf(s.id).indexOf(t.key) >= 0);
      if (!who.length) {
        out.push({ level: 'gap', zone: t.key, title: 'אין כיסוי ל' + t.label,
          why: 'יש ' + (n === 1 ? 'קריאה אחת' : n + ' קריאות') + ' ואף איש שטח לא מוגדר לאזור.',
          action: 'לשייך איש שטח לאזור', recs: byZone[t.key] });
        return;
      }
      if (n < min) {
        const nd = nextDayFor(who[0].id, t.key, dow);
        out.push({ level: 'hold', zone: t.key,
          title: 'לא כדאי לצאת ל' + t.label + ' עדיין',
          why: 'יש ' + (n === 1 ? 'קריאה אחת' : n + ' קריאות') + ' והסף שהוגדר הוא ' + min + '.',
          action: nd != null ? 'להמתין לריכוז — ' + who[0].name + ' באזור ביום ' + DAYS[nd]
            : 'להמתין לצבירה או להוריד את הסף',
          recs: byZone[t.key] });
      } else {
        out.push({ level: 'go', zone: t.key,
          title: 'שווה לצאת ל' + t.label,
          why: 'הצטברו ' + (n === 1 ? 'קריאה אחת' : n + ' קריאות') + ', בסף שהוגדר (' + min + ').',
          action: 'לרכז ליום אחד ולשלוח', recs: byZone[t.key] });
      }
    });
    /* 2) קריאה בודדת שנופלת ביום לא נכון — הצעה להזזה */
    fieldStaff().forEach(s => {
      const r = dayRoute(s.id, today);
      const home = r.zones.length ? r.zones[0] : null;
      r.stops.forEach(st2 => {
        if (!st2.zone || !home || st2.zone === home) return;
        if (travel(home, st2.zone) <= (+CFG.maxTravel || 45)) return;
        const nd = nextDayFor(s.id, st2.zone, dow);
        out.push({ level: 'move', zone: st2.zone,
          title: 'להזיז תיאום מחוץ לאזור היום',
          why: s.name + ' נמצא היום ב' + tLabel(home) + ', ויש לו תיאום ב' + tLabel(st2.zone)
            + ' (' + travel(home, st2.zone) + ' דק׳ נסיעה).',
          action: nd != null ? 'להעביר ליום ' + DAYS[nd] + ' שבו הוא ממילא באזור' : 'להעביר לאיש שטח שמכסה את האזור',
          recs: st2.rec ? [st2.rec] : [] });
      });
    });
    /* 4) פערי הגדרה — לא קריאות, אלא הגדרה חסרה שתשתק את הכול.
       זה בדיוק מה שמופיע כאזהרה בכרטיס העובד, וצריך להופיע גם כאן. */
    fieldStaff().forEach(s => {
      if (!zonesOf(s.id).length) out.push({ level: 'gap', zone: null,
        title: s.name + ' מסומן/ת כעובד/ת שטח בלי אזורים',
        why: 'בלי אזור אי אפשר לתאם לו/ה כלום — כל תיאום ייחסם.',
        action: 'לבחור אזורי כיסוי בכרטיס העובד או בלשונית "אנשי שטח וימים"', recs: [] });
    });
    if (CFG.enforceDays) fieldStaff().forEach(s => {
      const noDays = zonesOf(s.id).filter(z => !daysOf(s.id, z).length);
      if (noDays.length === zonesOf(s.id).length && zonesOf(s.id).length) return;   /* כולם "כל הימים" — תקין */
      if (!noDays.length) return;
      out.push({ level: 'move', zone: noDays[0],
        title: s.name + ' — אזורים בלי ימי כיסוי',
        why: noDays.map(tLabel).join(' · ') + ' מוגדרים לו/ה בלי ימים, בעוד שלאחרים כן נקבעו ימים.',
        action: 'לקבוע ימים גם לאזורים האלה, אחרת הריכוז לא יעבוד נכון', recs: [] });
    });
    if (!fieldStaff().length && TERR.some(t => (t.cities || []).length)) out.push({
      level: 'gap', zone: null, title: 'לא הוגדר אף עובד שטח',
      why: 'יש אזורים מוגדרים אבל אין מי שייצא אליהם.',
      action: 'לסמן עובד/ת כשטח בכרטיס העובד', recs: [] });

    const order = { gap: 0, move: 1, go: 2, hold: 3 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  /* ---------------- תדירות חלוקה ----------------
     יש אזורים שמחלקים בהם כל שבוע, ויש שאחת לשבועיים או לשלושה.
     החישוב נשען על מספר השבוע בשנה, כך שהמחזור יציב ולא "זז". */
  const FREQ = [
    { key: 'weekly', label: 'אחת לשבוע', weeks: 1 },
    { key: 'biweekly', label: 'אחת לשבועיים', weeks: 2 },
    { key: 'tri', label: 'אחת ל-3 שבועות', weeks: 3 },
    { key: 'monthly', label: 'אחת לחודש', weeks: 4 },
    { key: 'bimonthly', label: 'אחת לחודשיים', weeks: 9 },
    { key: 'quarter', label: 'אחת לרבעון', weeks: 13 },
    { key: 'halfyear', label: 'אחת לחצי שנה', weeks: 26 },
  ];
  const freqDef = k => FREQ.find(f => f.key === k) || FREQ[0];
  const dayMs = 86400000;
  /* כמה שבועות עברו מתאריך ההתחלה — זה מה שקובע את המחזור,
     ולכן חייב להיות "החל מ" ולא מספר שבוע שרירותי בשנה. */
  function weeksSince(start, date) {
    const a = Date.parse(start), b = Date.parse(date);
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.floor((b - a) / (7 * dayMs));
  }
  /* האם מחלקים לאזור בתאריך מסוים */
  function shipsOn(zoneKey, date) {
    const t = terr(zoneKey); if (!t || !t.ship || !t.ship.on) return false;
    const sh = t.ship, dow = dowOf(date);
    if ((sh.days || []).indexOf(dow) < 0) return false;
    const w = freqDef(sh.freq).weeks;
    if (w <= 1) return true;
    const start = sh.from || '2024-05-01';
    if (Date.parse(date) < Date.parse(start)) return false;
    return (weeksSince(start, date) % w) === 0;
  }
  /* המועד הקרוב שבו יוצא שליח לאזור */
  function nextShip(zoneKey, fromDate) {
    const base = Date.parse(fromDate || ((typeof clockTodayISO === 'function') ? clockTodayISO() : ''));
    if (isNaN(base)) return null;
    /* חצי שנה היא 26 שבועות — חלון של 35 יום היה מפספס כל תדירות ארוכה */
    for (let i = 0; i <= 200; i++) {
      const d = new Date(base + i * 86400000).toISOString().slice(0, 10);
      if (shipsOn(zoneKey, d)) return d;
    }
    return null;
  }

  /* ---------------- קריאת קובץ ערים ----------------
     המשתמש לא צריך לדעת באיזו עמודה הערים יושבות — המערכת מזהה
     את העמודה שהכי מתנהגת כמו רשימת ערים. */
  function parseRows(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      .map(l => l.split(/[\t,;|]/).map(c => c.trim().replace(/^"|"$/g, '')));
  }
  const CITY_HEAD = /עיר|ערים|יישוב|ישוב|city|town|locality/i;
  function pickCityCol(rows) {
    if (!rows.length) return { col: 0, header: false };
    const width = Math.max.apply(null, rows.map(r => r.length));
    /* 1) שורת כותרת מפורשת */
    const head = rows[0];
    for (let c = 0; c < width; c++) if (CITY_HEAD.test(head[c] || '')) return { col: c, header: true };
    /* 2) ניקוד: טקסט קצר, בלי ספרות, ערכים ייחודיים */
    let best = 0, bestScore = -1;
    for (let c = 0; c < width; c++) {
      const vals = rows.map(r => (r[c] || '').trim()).filter(Boolean);
      if (!vals.length) continue;
      const textish = vals.filter(v => /[א-תA-Za-z]/.test(v) && !/\d/.test(v) && v.length >= 2 && v.length <= 24).length;
      const uniq = new Set(vals).size;
      const score = (textish / vals.length) * 2 + (uniq / vals.length);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    const looksHeader = /[א-תA-Za-z]/.test(rows[0][best] || '') && rows.length > 1
      && CITY_HEAD.test(rows[0][best] || '');
    return { col: best, header: looksHeader };
  }
  function citiesFromText(text) {
    const rows = parseRows(text); if (!rows.length) return { cities: [], col: 0 };
    const { col, header } = pickCityCol(rows);
    const body = header ? rows.slice(1) : rows;
    const seen = {}, cities = [];
    body.forEach(r => { const v = (r[col] || '').trim();
      if (!v || /^\d+$/.test(v) || seen[v]) return; seen[v] = 1; cities.push(v); });
    return { cities, col, header, cols: Math.max.apply(null, rows.map(r => r.length)) };
  }

  /* ---------------- ממשק ---------------- */
  let tTab = 'rec', zoneOpen = null, bulkOpen = false, shipOpen = null;
  function terrHTML() {
    const recs = CFG.recommend ? recommendations() : [];
    return `<section class="card set-card wide terr-card">
      <div class="card-head"><div class="title">${ic('target')} שטח, אזורים וניתוב</div></div>
      <div class="set-body">
        <p class="inv-lead">איש שטח נוסע. כאן מגדירים אילו אזורים הוא מכסה <b>ובאילו ימים</b>,
          מתי בכלל שווה לצאת לאזור, ומה קורה כשתיאום סותר את זה.</p>
        <div class="inv-tabs">
          <button class="inv-tab ${tTab === 'rec' ? 'on' : ''}" data-ttab="rec">${ic('bolt')} המלצות${recs.length ? ' <span class="inv-badge">' + recs.length + '</span>' : ''}</button>
          <button class="inv-tab ${tTab === 'staff' ? 'on' : ''}" data-ttab="staff">${ic('clients')} אנשי שטח וימים</button>
          <button class="inv-tab ${tTab === 'zones' ? 'on' : ''}" data-ttab="zones">${ic('org')} אזורים וסף כדאיות</button>
          <button class="inv-tab ${tTab === 'svc' ? 'on' : ''}" data-ttab="svc">${ic('tasks')} שירותי שטח</button>
          <button class="inv-tab ${tTab === 'ship' ? 'on' : ''}" data-ttab="ship">${ic('sync')} אזורי חלוקה</button>
          <button class="inv-tab ${tTab === 'travel' ? 'on' : ''}" data-ttab="travel">${ic('clock')} זמני נסיעה</button>
          <button class="inv-tab ${tTab === 'rule' ? 'on' : ''}" data-ttab="rule">${ic('settings')} כללים</button>
        </div>
        ${tTab === 'rec' ? recHTML(recs) : tTab === 'staff' ? staffHTML() : tTab === 'zones' ? zonesHTML()
          : tTab === 'svc' ? svcHTML() : tTab === 'ship' ? shipHTML() : tTab === 'travel' ? travelHTML() : ruleHTML()}
      </div></section>`;
  }

  const LV = { go: 'שווה לצאת', hold: 'להמתין', move: 'להזיז', gap: 'חסר כיסוי' };
  function recHTML(recs) {
    if (!CFG.recommend) return `<p class="fx-none">${ic('alert')} מנוע ההמלצות כבוי. אפשר להדליק אותו בלשונית הכללים.</p>`;
    return `<p class="cr-hint">${ic('bolt')} ההמלצות מחושבות מהקריאות הפתוחות, מסף הכדאיות של כל אזור
      ומימי הכיסוי של אנשי השטח — ומתעדכנות לבד.</p>
      <div class="terr-recs">${recs.map(x => `<div class="terr-rec ${x.level}">
        <div class="terr-rec-h"><span class="terr-lv">${LV[x.level]}</span><b>${esc(x.title)}</b>
          ${x.zone ? `<span class="fx-tag">${esc(tLabel(x.zone))}</span>` : ''}</div>
        <div class="terr-rec-w">${esc(x.why)}</div>
        <div class="terr-rec-a">${ic('chevronL')} <b>${esc(x.action)}</b></div>
        ${x.recs && x.recs.length ? `<div class="terr-rec-l">${x.recs.slice(0, 5).map(r => `
          <button class="terr-rl" data-terrrec="${esc(String(r.id))}">${esc(r.name)} · ${esc(r.subject || '')}</button>`).join('')}</div>` : ''}
      </div>`).join('') || `<p class="fx-none">${ic('check')} אין כרגע המלצות — הלו״ז מסתדר</p>`}`;
  }

  function staffHTML() {
    const all = (typeof STAFF !== 'undefined') ? STAFF : [];
    const today = (typeof clockTodayISO === 'function') ? clockTodayISO() : '';
    return `<p class="cr-hint">${ic('bolt')} לכל איש שטח: אילו אזורים, ובאילו ימים בכל אזור.
      בלי ימים — הוא זמין לאזור בכל יום.</p>
      <div class="terr-staff">${all.map(s => { const st = staffOf(s.id);
        return `<div class="terr-s ${st.field ? 'on' : ''}">
          <label class="terr-s-h"><input type="checkbox" data-tsf="${esc(String(s.id))}" ${st.field ? 'checked' : ''}>
            <span><b>${esc(s.name)}</b><small>${esc(s.role || '')}</small></span></label>
          ${st.field ? `
            <div class="terr-zrows">${TERR.map(t => { const on = (st.zones || []).indexOf(t.key) >= 0;
              return `<div class="terr-zrow ${on ? 'on' : ''}">
                <button class="fx-chip ${on ? 'on' : ''}" data-tsz="${esc(String(s.id))}|${t.key}">${esc(t.label)}</button>
                ${on ? `<div class="terr-days">${DAYS_S.map((d, i) => `<button class="terr-d ${daysOf(s.id, t.key).indexOf(i) >= 0 ? 'on' : ''}"
                  data-tsd="${esc(String(s.id))}|${t.key}|${i}" title="${DAYS[i]}">${d}</button>`).join('')}
                  ${!daysOf(s.id, t.key).length ? '<small class="terr-anyday">כל הימים</small>' : ''}</div>` : ''}
              </div>`; }).join('')}</div>
            <div class="terr-route">${ic('clock')} היום: ${(() => { const r = dayRoute(s.id, today);
              return r.stops.length ? r.stops.length + ' תיאומים · ' + (r.zones.map(tLabel).join(' → ') || '—') + ' · ' + r.drive + ' דק׳ נסיעה'
                : 'אין תיאומים'; })()}</div>
            ${!(st.zones || []).length ? `<div class="terr-warn">${ic('alert')} לא נבחרו אזורים — לא ניתן לתאם לו</div>` : ''}` : ''}
        </div>`; }).join('')}</div>`;
  }

  function zonesHTML() {
    const byZone = {}; pending().forEach(x => (byZone[x.zone] = byZone[x.zone] || []).push(x.r));
    return `<p class="cr-hint">${ic('bolt')} <b>סף כדאיות</b> = כמה קריאות צריכות להצטבר לפני שבכלל שווה לשלוח מישהו לאזור.
      זה מה שמונע נסיעה של שעתיים בשביל קריאה אחת.</p>
      <div class="terr-tools">
        <button class="btn sm ${bulkOpen ? 'primary' : ''}" id="tzBulk">${ic('docs')} טעינת טבלת ערים</button>
        <button class="btn sm" id="tzExport">${ic('copy')} ייצוא הרשימה</button>
        <span class="terr-tools-n">${TERR.length} אזורים · ${TERR.reduce((a, t) => a + (t.cities || []).length, 0)} ערים</span>
      </div>
      ${bulkOpen ? `<div class="terr-bulk">
        <div class="terr-bulk-h">${ic('docs')} <b>טעינת אזורים לפי ערים</b>
          <small>שורה לכל עיר, בפורמט <code>עיר, אזור</code>. אפשר להדביק ישירות מגיליון.
            אזור שלא קיים — ייווצר.</small></div>
        <textarea class="cc-inp" id="tzBulkTxt" rows="6" placeholder="תל אביב, מרכז&#10;חיפה, צפון&#10;אילת, דרום"></textarea>
        <div class="terr-bulk-a">
          <button class="btn sm primary" id="tzBulkGo">${ic('check')} טען</button>
          <button class="btn sm" id="tzBulkX">ביטול</button>
        </div></div>` : ''}
      <div class="terr-zones-list">${TERR.map((t, i2) => { const n = (byZone[t.key] || []).length;
        const open = zoneOpen === t.key;
        return `<div class="terr-z ${open ? 'open' : ''}">
          <button class="terr-z-top" data-tzo="${t.key}">
            <span class="dot ${t.color}"></span>
            <b>${esc(t.label)}</b>
            <span class="terr-z-sum">${(t.cities || []).length} ערים · סף ${+t.minJobs || 1}</span>
            <span class="fx-tag ${n >= (+t.minJobs || 1) ? 'mine' : ''}">${n} קריאות</span>
            <span class="terr-chev">${ic('chevron')}</span>
          </button>
          ${open ? `<div class="terr-z-body">
            <div class="terr-z-b">
              <label class="inv-f"><span>שם האזור</span><input class="cc-inp sm" value="${esc(t.label)}" data-tzl="${i2}"></label>
              <label class="inv-f"><span>סף כדאיות — מינימום קריאות</span>
                <input class="cc-inp sm" type="number" min="1" max="20" value="${+t.minJobs || 1}" data-tzm="${i2}"></label>
            </div>
            <div class="terr-cities-h">${ic('org')} <b>ערים באזור</b>
              <small>לחיצה על עיר מסירה אותה. אפשר להוסיף כמה בבת אחת, מופרדות בפסיק.</small></div>
            <div class="terr-cities">${(t.cities || []).map((c, ci) => `<button class="terr-city" data-tzcd="${i2}|${ci}">
              ${esc(c)} <i>${ic('close')}</i></button>`).join('') || '<span class="terr-anyday">טרם הוגדרו ערים</span>'}</div>
            <div class="terr-city-add">
              <input class="cc-inp sm" data-tzca="${i2}" placeholder="עיר או כמה ערים, מופרדות בפסיק">
              <button class="btn sm" data-tzcgo="${i2}">${ic('plus')} הוסף</button>
              <label class="btn sm terr-up">${ic('docs')} העלאת קובץ
                <input type="file" accept=".csv,.txt,.tsv" data-tzup="${i2}" hidden></label>
            </div>
            <small class="terr-up-note">${ic('bolt')} קובץ CSV או TXT — המערכת מזהה לבד את העמודה עם הערים.
              מאקסל: <b>קובץ ← שמירה בשם ← CSV</b>.</small>
            <button class="btn xs terr-z-del" data-tzd="${i2}">${ic('close')} מחק אזור</button>
          </div>` : ''}
        </div>`; }).join('')}</div>
      <div class="tk-kbadd"><input class="cc-inp sm" id="tzNew" placeholder="שם אזור חדש">
        <button class="btn sm primary" id="tzAdd">${ic('plus')} הוסף אזור</button></div>`;
  }

  function svcHTML() {
    const tr = (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : [];
    return `<p class="cr-hint">${ic('bolt')} שירות שמסומן כ"שטח" מפעיל את כל בדיקות האזורים בתיאום שלו.
      אפשר גם להגביל שירות לאזורים מסוימים בלבד.</p>
      <div class="terr-svcs">${tr.map(t => { const c = SVC[t.key] || {};
        return `<div class="terr-svc ${c.field ? 'on' : ''}">
          <label class="terr-s-h"><input type="checkbox" data-tvf="${esc(t.key)}" ${c.field ? 'checked' : ''}>
            <span><b>${esc(t.label)}</b><small>${esc(t.kind || '')} · ${t.dur} דק׳</small></span></label>
          ${c.field ? `<div class="terr-zones">
            ${TERR.map(z => `<button class="fx-chip ${(c.zones || []).indexOf(z.key) >= 0 ? 'on' : ''}"
              data-tvz="${esc(t.key)}|${z.key}">${esc(z.label)}</button>`).join('')}
            ${!(c.zones || []).length ? '<small class="terr-anyday">כל האזורים</small>' : ''}</div>` : ''}
        </div>`; }).join('')}</div>`;
  }

  function shipHTML() {
    const today = (typeof clockTodayISO === 'function') ? clockTodayISO() : '';
    const active = TERR.filter(t => (t.ship || {}).on).length;
    return `<div class="terr-head">
        <p class="cr-hint">${ic('bolt')} לכל אזור: באילו ימים יוצא שליח, ובאיזו תדירות — שבועי, דו-שבועי או
          אחת לשלושה שבועות. המערכת מחשבת מזה את מועד המשלוח הקרוב, והחנות משתמשת בו.</p>
        <span class="terr-tools-n">${active} מתוך ${TERR.length} אזורים בחלוקה</span>
      </div>
      <div class="terr-ships">${TERR.map((t, i2) => { const sh = t.ship || {};
        const nx = sh.on ? nextShip(t.key, today) : null;
        const open = shipOpen === t.key;
        return `<div class="terr-ship ${sh.on ? 'on' : 'off'} ${open ? 'open' : ''}">
          <button class="terr-ship-row" data-tso="${t.key}">
            <span class="dot ${t.color}"></span>
            <b>${esc(t.label)}</b>
            ${sh.on ? `<span class="terr-sum">${esc(freqDef(sh.freq).label)}</span>
              <span class="terr-sum">${DELIV.filter(dv => ((sh.deliv || {})[dv.key] || {}).on).map(dv =>
                ({ home: 'עד הבית', point: 'נקודת איסוף', pickup: 'איסוף עצמי' })[dv.key]).join(' · ') || 'ללא אופן מסירה'}</span>
              <span class="terr-sum days">${(sh.days || []).length ? (sh.days || []).map(d => DAYS_S[d]).join(' · ') : 'ללא ימים'}</span>
              <span class="terr-sum">${(+sh.cost || 0) ? CBX.money(sh.cost) : 'חינם'}</span>
              ${nx ? `<span class="terr-next">${ic('calendar')} ${esc(nx)}</span>` : `<span class="terr-sum warn">אין מועד</span>`}`
            : `<span class="terr-sum off">לא מחלקים לאזור</span>`}
            <span class="terr-chev">${ic('chevron')}</span>
          </button>
          ${open ? `<div class="terr-ship-b">
            <label class="terr-f2"><span>מחלקים לאזור?</span>
              <button class="btn xs ${sh.on ? 'primary' : ''}" data-tsh="${i2}">${sh.on ? 'כן' : 'לא'}</button></label>
            ${sh.on ? `
              <label class="terr-f2"><span>תדירות</span>
                <select class="cc-inp sm terr-freq-sel" data-tsfs="${i2}">
                  ${FREQ.map(f => `<option value="${f.key}" ${(sh.freq || 'weekly') === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}
                </select></label>
              ${freqDef(sh.freq).weeks > 1 ? `<label class="terr-f2"><span>החל מתאריך</span>
                <input class="cc-inp sm" type="date" value="${esc(sh.from || '2024-05-01')}" data-tsfr="${i2}">
                <small class="terr-anyday">ממנו נספר המחזור</small></label>` : ''}
              <label class="terr-f2"><span>ימי חלוקה</span>
                <span class="terr-days">${DAYS_S.map((d, j2) => `<button class="terr-d ${(sh.days || []).indexOf(j2) >= 0 ? 'on' : ''}"
                  data-tshd="${i2}|${j2}" title="${DAYS[j2]}">${d}</button>`).join('')}</span></label>

              <div class="terr-deliv-h">${ic('layers')} <b>אופני מסירה באזור</b>
                <small>אפשר לאפשר כמה במקביל. הלקוח יבחר מביניהם בחנות.</small></div>
              <div class="terr-deliv">${DELIV.map(dv => { const c = (sh.deliv || {})[dv.key] || {};
                return `<div class="terr-dv ${c.on ? 'on' : ''}">
                  <label class="terr-dv-h"><input type="checkbox" data-tsdv="${i2}|${dv.key}" ${c.on ? 'checked' : ''}>
                    <span>${ic(dv.icon)}<b>${dv.label}</b><small>${dv.desc}</small></span></label>
                  ${c.on ? `<div class="terr-dv-b">
                    ${dv.key === 'pickup' ? '' : `<label class="inv-f"><span>עלות</span>
                      <input class="cc-inp sm" type="number" min="0" value="${+c.cost || 0}" data-tsdc="${i2}|${dv.key}"></label>`}
                    <label class="inv-f"><span>זמן אספקה</span>
                      <input class="cc-inp sm" value="${esc(c.eta || '')}" data-tsde="${i2}|${dv.key}"></label>
                    ${dv.key === 'point' ? `<label class="inv-f full"><span>נקודות איסוף באזור</span>
                      <input class="cc-inp sm" value="${esc(c.places || '')}" data-tsdp="${i2}"
                        placeholder="שם ומיקום, מופרדים בפסיק"></label>` : ''}
                  </div>` : ''}
                </div>`; }).join('')}</div>
              <label class="terr-f2"><span>מינימום הזמנה</span>
                <input class="cc-inp sm terr-min" type="number" min="0" value="${+sh.minOrder || 0}" data-tshm="${i2}"></label>` : ''}
          </div>` : ''}
        </div>`; }).join('')}</div>`;
  }

  function travelHTML() {
    return `<p class="cr-hint">${ic('bolt')} זמן נסיעה ממוצע בין אזורים — הבסיס לכל בדיקה ולכל המלצה.</p>
      <div class="inv-table-wrap"><table class="inv-table terr-matrix">
        <thead><tr><th></th>${TERR.map(t => `<th>${esc(t.label)}</th>`).join('')}</tr></thead>
        <tbody>${TERR.map((a, i) => `<tr><th>${esc(a.label)}</th>
          ${TERR.map((b, j) => j <= i ? `<td class="${i === j ? 'self' : 'dim'}">${i === j ? CFG.inZone : '—'}</td>`
            : `<td><input class="cc-inp sm" type="number" min="0" max="600" value="${travel(a.key, b.key)}" data-ttv="${a.key}|${b.key}"></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>`;
  }

  function ruleHTML() {
    const tog = (id, on, l, d) => `<label class="terr-tog ${on ? 'on' : ''}">
      <input type="checkbox" id="${id}" ${on ? 'checked' : ''}>
      <span class="terr-tog-t"><b>${l}</b><small>${d}</small></span></label>`;
    const num = (id, v, l, d, suf) => `<div class="terr-num">
      <span class="terr-num-l">${l}</span>
      <span class="terr-num-i"><input class="cc-inp sm" type="number" min="0" max="300" id="${id}" value="${v}"><i>${suf}</i></span>
      <small>${d}</small></div>`;
    return `<div class="terr-rules">
      <section class="terr-rblock">
        <div class="terr-rb-h">${ic('shield')} <b>מה המערכת בודקת</b></div>
        <div class="terr-togs">
          ${tog('trOn', CFG.on, 'שמירה על טווח אזור', 'בודקת שאפשר להגיע בין התיאומים באותו יום')}
          ${tog('trDays', CFG.enforceDays, 'ימי כיסוי לפי אזור', 'טכנאי שבצפון רק בשלישי — לא יתואם ביום אחר')}
          ${tog('trRec', CFG.recommend, 'מנוע המלצות', 'מציע מה לרכז, מה להזיז ומתי להמתין')}
        </div>
      </section>

      <section class="terr-rblock">
        <div class="terr-rb-h">${ic('alert')} <b>כשיש התנגשות</b></div>
        <div class="terr-modes">
          <button class="terr-mode ${CFG.mode === 'warn' ? 'on' : ''}" data-trm="warn">
            <b>להזהיר</b><small>מציג את הבעיה וההמלצה, והנציג מחליט</small></button>
          <button class="terr-mode ${CFG.mode === 'block' ? 'on' : ''}" data-trm="block">
            <b>לחסום</b><small>לא מאפשר לתאם עד שיימצא מועד מתאים</small></button>
        </div>
      </section>

      <section class="terr-rblock">
        <div class="terr-rb-h">${ic('clock')} <b>זמני נסיעה</b></div>
        <div class="terr-nums">
          ${num('trIn', CFG.inZone, 'בתוך אותו אזור', 'זמן מעבר בין לקוח ללקוח', 'דק׳')}
          ${num('trMax', CFG.maxTravel, 'נסיעה מרבית', 'מעבר לזה היום מסומן כלא סביר', 'דק׳')}
          ${num('trBuf', CFG.buffer, 'מרווח ביטחון', 'חניה, עיכובים, כניסה ללקוח', 'דק׳')}
        </div>
      </section>
    </div>`;
  }

  function terrBind(RR) {
    const sh = i => { const x = TERR[i].ship = TERR[i].ship || { on: false, freq: 'weekly', from: '2024-05-01', days: [], cost: 0, minOrder: 0, eta: '' };
      x.deliv = x.deliv || { home: { on: true, cost: +x.cost || 0, eta: x.eta || '' },
        point: { on: false, cost: 0, eta: '', places: '' }, pickup: { on: true, cost: 0, eta: 'מוכן תוך יום עסקים' } };
      return x; };
    $$('[data-ttab]').forEach(b => b.addEventListener('click', () => { tTab = b.dataset.ttab; RR(); }));
    $$('[data-terrrec]').forEach(b => b.addEventListener('click', () => {
      const r = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => String(x.id) === b.dataset.terrrec) : null;
      if (r && typeof openDrawer === 'function') openDrawer(r); }));
    $$('[data-tsf]').forEach(c => c.addEventListener('change', () => {
      const id = c.dataset.tsf; ST[id] = ST[id] || { zones: [], days: {} };
      ST[id].field = c.checked; saveS(); RR(); }));
    $$('[data-tsz]').forEach(b => b.addEventListener('click', () => {
      const [id, z] = b.dataset.tsz.split('|');
      const st = ST[id] = ST[id] || { field: true, zones: [], days: {} };
      st.zones = st.zones || []; const i = st.zones.indexOf(z);
      if (i >= 0) st.zones.splice(i, 1); else st.zones.push(z);
      saveS(); RR(); }));
    $$('[data-tsd]').forEach(b => b.addEventListener('click', () => {
      const [id, z, d] = b.dataset.tsd.split('|');
      const st = ST[id] = ST[id] || { field: true, zones: [], days: {} };
      st.days = st.days || {}; st.days[z] = st.days[z] || [];
      const i = st.days[z].indexOf(+d); if (i >= 0) st.days[z].splice(i, 1); else st.days[z].push(+d);
      st.days[z].sort(); saveS(); RR(); }));
    $$('[data-tzo]').forEach(b => b.addEventListener('click', () => {
      zoneOpen = zoneOpen === b.dataset.tzo ? null : b.dataset.tzo; RR(); }));
    $$('[data-tzcd]').forEach(b => b.addEventListener('click', () => {
      const [i2, ci] = b.dataset.tzcd.split('|'); TERR[+i2].cities.splice(+ci, 1); saveT(); RR(); }));
    $$('[data-tzcgo]').forEach(b => b.addEventListener('click', () => {
      const i2 = +b.dataset.tzcgo, inp = document.querySelector('[data-tzca="' + i2 + '"]');
      if (!inp || !inp.value.trim()) return;
      const add = inp.value.split(',').map(x => x.trim()).filter(Boolean);
      TERR[i2].cities = (TERR[i2].cities || []).concat(add.filter(c => (TERR[i2].cities || []).indexOf(c) < 0));
      saveT(); RR(); toast(add.length === 1 ? 'העיר נוספה' : add.length + ' ערים נוספו'); }));
    $$('[data-tzup]').forEach(inp => inp.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const i2 = +inp.dataset.tzup;
      const rd = new FileReader();
      rd.onload = () => {
        const r2 = citiesFromText(rd.result);
        if (!r2.cities.length) { toast('לא זוהו ערים בקובץ'); return; }
        const before = (TERR[i2].cities || []).length;
        /* עיר שכבר שייכת לאזור אחר עוברת — כדי שלא תהיה כפילות */
        r2.cities.forEach(c => { TERR.forEach(t => { if (t !== TERR[i2]) t.cities = (t.cities || []).filter(x => x !== c); }); });
        TERR[i2].cities = (TERR[i2].cities || []).concat(r2.cities.filter(c => (TERR[i2].cities || []).indexOf(c) < 0));
        saveT(); RR();
        toast('נטענו ' + (TERR[i2].cities.length - before) + ' ערים מעמודה ' + (r2.col + 1)
          + (r2.cols > 1 ? ' מתוך ' + r2.cols : '') + ' ✓');
      };
      rd.readAsText(f, 'utf-8');
    }));
    const bk = $('#tzBulk'); if (bk) bk.addEventListener('click', () => { bulkOpen = !bulkOpen; RR(); });
    const bx = $('#tzBulkX'); if (bx) bx.addEventListener('click', () => { bulkOpen = false; RR(); });
    const bg = $('#tzBulkGo'); if (bg) bg.addEventListener('click', () => {
      const txt = ($('#tzBulkTxt').value || '').trim(); if (!txt) { toast('נא להדביק רשימה'); return; }
      let added = 0, zones = 0;
      txt.split(/\r?\n/).forEach(line => {
        const parts = line.split(/[,\t;]/).map(x => x.trim()).filter(Boolean);
        if (parts.length < 2) return;
        const city = parts[0], zname = parts[1];
        let z = TERR.find(t => t.label === zname);
        if (!z) { z = { key: 'z' + (TERR.length + 1) + Math.abs(zname.length * 7),
          label: zname, color: ['brand', 'green', 'orange', 'blue', 'red'][TERR.length % 5], cities: [], minJobs: 1,
          ship: { on: false, freq: 'weekly', from: '2024-05-01', days: [], cost: 0, minOrder: 0, eta: '' } }; TERR.push(z); zones++; }
        /* עיר שכבר משויכת לאזור אחר עוברת — כדי שלא תהיה כפילות */
        TERR.forEach(t => { if (t !== z) t.cities = (t.cities || []).filter(c => c !== city); });
        if ((z.cities || []).indexOf(city) < 0) { z.cities.push(city); added++; }
      });
      saveT(); bulkOpen = false; RR();
      toast('נטענו ' + added + ' ערים' + (zones ? ' ו-' + zones + ' אזורים חדשים' : '') + ' ✓'); });
    const ex = $('#tzExport'); if (ex) ex.addEventListener('click', () => {
      const csv = TERR.flatMap(t => (t.cities || []).map(c => c + ',' + t.label)).join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + csv);
      a.download = 'אזורים-לפי-ערים.csv'; a.click(); toast('הרשימה יוצאה ✓'); });
    $$('[data-tso]').forEach(b => b.addEventListener('click', () => {
      shipOpen = shipOpen === b.dataset.tso ? null : b.dataset.tso; RR(); }));
    $$('[data-tsfs]').forEach(e => e.addEventListener('change', () => {
      const sh2 = sh(+e.dataset.tsfs); sh2.freq = e.value;
      if (!sh2.from) sh2.from = (typeof clockTodayISO === 'function') ? clockTodayISO() : '2024-05-01';
      saveT(); RR(); }));
    $$('[data-tsfr]').forEach(e => e.addEventListener('change', () => {
      sh(+e.dataset.tsfr).from = e.value; saveT(); RR(); }));
    $$('[data-tzl]').forEach(i => i.addEventListener('change', () => { TERR[+i.dataset.tzl].label = i.value; saveT(); }));
    $$('[data-tzm]').forEach(i => i.addEventListener('change', () => { TERR[+i.dataset.tzm].minJobs = +i.value || 1; saveT(); RR(); }));
    $$('[data-tzc]').forEach(i => i.addEventListener('change', () => {
      TERR[+i.dataset.tzc].cities = i.value.split(',').map(x => x.trim()).filter(Boolean); saveT(); RR(); }));
    $$('[data-tzd]').forEach(b => b.addEventListener('click', () => { TERR.splice(+b.dataset.tzd, 1); saveT(); RR(); }));
    const za = $('#tzAdd'); if (za) za.addEventListener('click', () => {
      const n = ($('#tzNew').value || '').trim(); if (!n) { toast('נא להזין שם אזור'); return; }
      TERR.push({ key: 'z' + (TERR.length + 1), label: n, color: 'blue', cities: [], minJobs: 1,
        ship: { on: false, days: [], cost: 0, minOrder: 0, eta: '' } }); saveT(); RR(); });
    $$('[data-tvf]').forEach(c => c.addEventListener('change', () => {
      const k = c.dataset.tvf; SVC[k] = SVC[k] || { zones: [] }; SVC[k].field = c.checked; saveSv(); RR(); }));
    $$('[data-tvz]').forEach(b => b.addEventListener('click', () => {
      const [k, z] = b.dataset.tvz.split('|');
      const c = SVC[k] = SVC[k] || { field: true, zones: [] };
      c.zones = c.zones || []; const i = c.zones.indexOf(z);
      if (i >= 0) c.zones.splice(i, 1); else c.zones.push(z); saveSv(); RR(); }));
    /* משלוחים */
    $$('[data-tsh]').forEach(b => b.addEventListener('click', () => { const s2 = sh(+b.dataset.tsh); s2.on = !s2.on; saveT(); RR(); }));
    $$('[data-tshd]').forEach(b => b.addEventListener('click', () => {
      const [i, d] = b.dataset.tshd.split('|'); const s2 = sh(+i);
      s2.days = s2.days || []; const j = s2.days.indexOf(+d);
      if (j >= 0) s2.days.splice(j, 1); else s2.days.push(+d); s2.days.sort(); saveT(); RR(); }));
    $$('[data-tsdv]').forEach(c => c.addEventListener('change', () => {
      const [i2, k] = c.dataset.tsdv.split('|'); const x = sh(+i2);
      x.deliv[k] = x.deliv[k] || {}; x.deliv[k].on = c.checked; saveT(); RR(); }));
    $$('[data-tsdc]').forEach(i => i.addEventListener('change', () => {
      const [i2, k] = i.dataset.tsdc.split('|'); sh(+i2).deliv[k].cost = +i.value || 0; saveT(); }));
    $$('[data-tsde]').forEach(i => i.addEventListener('change', () => {
      const [i2, k] = i.dataset.tsde.split('|'); sh(+i2).deliv[k].eta = i.value; saveT(); }));
    $$('[data-tsdp]').forEach(i => i.addEventListener('change', () => {
      sh(+i.dataset.tsdp).deliv.point.places = i.value; saveT(); }));
    $$('[data-tshc]').forEach(i => i.addEventListener('change', () => { sh(+i.dataset.tshc).cost = +i.value || 0; saveT(); }));
    $$('[data-tshm]').forEach(i => i.addEventListener('change', () => { sh(+i.dataset.tshm).minOrder = +i.value || 0; saveT(); }));
    $$('[data-tshe]').forEach(i => i.addEventListener('change', () => { sh(+i.dataset.tshe).eta = i.value; saveT(); }));
    $$('[data-ttv]').forEach(i => i.addEventListener('change', () => { TRAVEL[i.dataset.ttv] = +i.value || 0; saveTr(); RR(); }));
    $$('[data-trm]').forEach(b => b.addEventListener('click', () => { CFG.mode = b.dataset.trm; saveC(); RR(); }));
    const gv = id => document.getElementById(id);
    [['trOn', 'on'], ['trDays', 'enforceDays'], ['trRec', 'recommend']].forEach(([id, k]) => {
      const e = gv(id); if (e) e.addEventListener('change', () => { CFG[k] = e.checked; saveC(); RR(); }); });
    [['trIn', 'inZone'], ['trMax', 'maxTravel'], ['trBuf', 'buffer']].forEach(([id, k]) => {
      const e = gv(id); if (e) e.addEventListener('change', () => { CFG[k] = +e.value || 0; saveC(); RR(); }); });
  }

  /* ---------------- כרטיס העובד ---------------- */
  function empHTML(emp) {
    const st = staffOf(emp.id);
    return `<section class="ax-group">
      <div class="ax-g-h">${ic('target')} <b>אזורי שטח וימי כיסוי</b></div>
      <label class="inv-chk"><input type="checkbox" data-tef="${esc(String(emp.id))}" ${st.field ? 'checked' : ''}>
        <span><b>עובד/ת שטח</b><small>נוסע/ת ללקוחות. מפעיל את בדיקות האזורים והימים בכל תיאום.</small></span></label>
      ${st.field ? `<div class="terr-zrows">${TERR.map(t => { const on = (st.zones || []).indexOf(t.key) >= 0;
        return `<div class="terr-zrow ${on ? 'on' : ''}">
          <button class="fx-chip ${on ? 'on' : ''}" data-tez="${esc(String(emp.id))}|${t.key}">${esc(t.label)}</button>
          ${on ? `<div class="terr-days">${DAYS_S.map((d, i) => `<button class="terr-d ${daysOf(emp.id, t.key).indexOf(i) >= 0 ? 'on' : ''}"
            data-ted="${esc(String(emp.id))}|${t.key}|${i}" title="${DAYS[i]}">${d}</button>`).join('')}
            ${!daysOf(emp.id, t.key).length ? '<small class="terr-anyday">כל הימים</small>' : ''}</div>` : ''}
        </div>`; }).join('')}</div>
        <p class="cr-hint">${ic('bolt')} בלי סימון ימים — זמין לאזור בכל יום. סימון ימים אומר למערכת לרכז את התיאומים.</p>`
      : ''}</section>`;
  }
  /* חיווי קצר: האם העובד משויך לשטח, ולאילו אזורים */
  function badgeHTML(emp) {
    const st = staffOf(emp.id);
    if (!st.field) return `<div class="terr-badge off">${ic('target')}
      <b>לא משויך לשטח</b><small>עובד מהסניף. שיוך לשטח נעשה בלשונית "העסקה ותפקיד".</small></div>`;
    const zs = st.zones || [];
    return `<div class="terr-badge">${ic('target')}
      <b>עובד/ת שטח</b>
      ${zs.length ? `<span class="terr-badge-z">${zs.map(z => {
          const d = daysOf(emp.id, z);
          return `<span class="terr-bz"><i>${esc(tLabel(z))}</i>${d.length
            ? '<u>' + d.map(x => DAYS_S[x]).join(' ') + '</u>' : '<u>כל הימים</u>'}</span>`; }).join('')}</span>`
        : '<small class="terr-badge-warn">לא נבחרו אזורים — לא ניתן לתאם לו</small>'}
    </div>`;
  }

  function empBind(emp, RR) {
    $$('[data-tef]').forEach(c => c.addEventListener('change', () => {
      ST[emp.id] = ST[emp.id] || { zones: [], days: {} }; ST[emp.id].field = c.checked; saveS(); RR(); }));
    $$('[data-tez]').forEach(b => b.addEventListener('click', () => {
      const [id, z] = b.dataset.tez.split('|');
      const st = ST[id] = ST[id] || { field: true, zones: [], days: {} };
      st.zones = st.zones || []; const i = st.zones.indexOf(z);
      if (i >= 0) st.zones.splice(i, 1); else st.zones.push(z); saveS(); RR(); }));
    $$('[data-ted]').forEach(b => b.addEventListener('click', () => {
      const [id, z, d] = b.dataset.ted.split('|');
      const st = ST[id] = ST[id] || { field: true, zones: [], days: {} };
      st.days = st.days || {}; st.days[z] = st.days[z] || [];
      const i = st.days[z].indexOf(+d); if (i >= 0) st.days[z].splice(i, 1); else st.days[z].push(+d);
      st.days[z].sort(); saveS(); RR(); }));
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'terr', label: 'שטח, אזורים והמלצות ניתוב', icon: 'target',
    desc: 'אזורים וימי כיסוי לכל איש שטח, סף כדאיות ליציאה לאזור, בדיקה שתיאומים נשארים בטווח, מנוע המלצות לריכוז והזזה, ואזורי חלוקה למשלוחים.',
    files: ['js/ext/territory.js'],
    install() {
      /* מסך הקריטריונים — שם מקומו */
      if (typeof needsCriteriaCardHTML === 'function') CBX.wrap('terr', 'needsCriteriaCardHTML', o => function () {
        return o.apply(this, arguments) + terrHTML();
      });
      if (typeof bindNeedsCriteriaCard === 'function') CBX.wrap('terr', 'bindNeedsCriteriaCard', o => function (rr) {
        const r = o.apply(this, arguments);
        terrBind(() => { if (typeof rr === 'function') rr(); else if (typeof renderPermissionsView === 'function') renderPermissionsView(); });
        return r;
      });
      /* כרטיס העובד — חיווי קצר בלשונית הראשית, והעריכה המלאה ב"העסקה ותפקיד" */
      if (typeof hrTabHTML === 'function') CBX.wrap('terr', 'hrTabHTML', o => function (tab, emp) {
        const base = o.apply(this, arguments);
        if (tab === 'employ') return base + empHTML(emp);
        if (tab === 'file') return badgeHTML(emp) + base;
        return base;
      });
      if (typeof hrPanelHTML === 'function') CBX.wrap('terr', 'hrPanelHTML', o => function () {
        const r = o.apply(this, arguments);
        setTimeout(() => { const emp = (typeof STAFF !== 'undefined' && typeof hrEmp !== 'undefined')
          ? STAFF.find(s => s.id === hrEmp) : null;
          if (emp) empBind(emp, () => { if (typeof renderSettingsView === 'function') renderSettingsView(); }); }, 0);
        return r;
      });
      /* בדיקת התיאום — באותה נקודה של שאר הקריטריונים */
      if (typeof critBookGuard === 'function') CBX.wrap('terr', 'critBookGuard', o => function (r) {
        const out = o.apply(this, arguments);
        try {
          if (!CFG.on || !r || !recIsField(r)) return out;
          const sid = r.assigneeId || (typeof STAFF !== 'undefined' ? (STAFF.find(s => s.name === r.assignee) || {}).id : null);
          if (!sid || !staffOf(sid).field) return out;
          const zone = zoneOfRec(r); if (!zone) return out;
          const date = (r.meeting && r.meeting.date) || ((typeof clockTodayISO === 'function') ? clockTodayISO() : '');
          const hour = r.meeting ? parseFloat(String(r.meeting.time).replace(':', '.')) : 10;
          const c = check(sid, date, hour, zone);
          const why = c.why + (c.tips.length ? ' · ' + c.tips[0].text : '');
          if (c.level === 'block') { out.mode = 'block'; out.blocks.push({ key: 'terr', label: 'אזור שטח', why }); }
          else if (c.level === 'warn') out.conds.push({ key: 'terr', label: 'אזור שטח', why });
        } catch (e) { console.error('[terr] guard', e); }
        return out;
      });
      /* משלוח בחנות לפי אזור החלוקה */
      CBX.on('terr', 'shop:ship', ev => {
        const z = zoneOfCity(ev.city); const t = z ? terr(z) : null;
        if (!t || !t.ship || !t.ship.on) { ev.ok = false; ev.why = 'אין חלוקה לאזור הזה'; return; }
        ev.ok = true; ev.cost = +t.ship.cost || 0; ev.minOrder = +t.ship.minOrder || 0;
        ev.eta = t.ship.eta; ev.days = (t.ship.days || []).map(d => DAYS[d]); ev.zone = t.label;
        ev.freq = freqDef(t.ship.freq).label;
        ev.next = nextShip(t.key, ev.date);
        const dv = t.ship.deliv || {};
        ev.methods = DELIV.filter(m => (dv[m.key] || {}).on).map(m => ({
          key: m.key, label: m.label, cost: +((dv[m.key] || {}).cost) || 0,
          eta: (dv[m.key] || {}).eta || t.ship.eta, places: (dv[m.key] || {}).places || '' }));
      });
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('terr', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        TERR.forEach(t => { if ((t.label + ' ' + (t.cities || []).join(' ')).toLowerCase().includes(q))
          res.push({ type: 'אזור שטח', label: t.label, goto: 'criteria', sub: (t.cities || []).slice(0, 3).join(' · ') }); });
      });
      /* אוטומציות */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('terr', AUTOMATIONS, [
        { key: 'x_terr_route', trigger: 'לו״ז שטח לא סביר', title: 'התראה על מסלול שטח בלתי אפשרי', desc: 'יום שבו זמני הנסיעה לא מאפשרים להגיע', on: false },
        { key: 'x_terr_rec', trigger: 'ריכוז קריאות באזור', title: 'המלצות ניתוב שטח', desc: 'מתי שווה לצאת לאזור, ומה כדאי להזיז', on: false },
      ]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('terr', AUTO_IMPL, {
        x_terr_route: {
          what: 'בודק לכל איש שטח אם מסלול היום שלו אפשרי פיזית — שיש מספיק זמן נסיעה בין תיאום לתיאום. יום שלא מסתדר מקבל התראה לפני שהלקוח מחכה לשווא.',
          run: () => {
            const day = (typeof clockTodayISO === 'function') ? clockTodayISO() : '';
            if (!fieldStaff().length) return 'לא הוגדרו אנשי שטח — לא בוצע';
            const bad = [];
            fieldStaff().forEach(s => { const r = dayRoute(s.id, day);
              for (let i = 1; i < r.stops.length; i++) {
                const gap = (r.stops[i].h - r.stops[i - 1].h) * 60;
                const need = travel(r.stops[i - 1].zone, r.stops[i].zone) + (+CFG.buffer || 0);
                if (gap < need) { bad.push(s.name + ': ' + tLabel(r.stops[i - 1].zone) + ' → ' + tLabel(r.stops[i].zone)
                  + ' (' + Math.round(gap) + ' דק׳ במקום ' + need + ')'); break; } } });
            if (!bad.length) return 'כל מסלולי השטח תקינים — לא בוצע';
            bad.slice(0, 4).forEach(b => { if (typeof autoNotify === 'function') autoNotify('מסלול שטח בלתי אפשרי', b, 'reminder'); });
            return 'התראה על ' + (bad.length === 1 ? 'מסלול אחד' : bad.length + ' מסלולים') + ': ' + bad.join(' · ');
          } },
        x_terr_rec: {
          what: 'מריץ את מנוע ההמלצות: לאילו אזורים הצטברו מספיק קריאות כדי שישתלם לצאת, מה כדאי להזיז ליום אחר, ואיפה אין כיסוי בכלל.',
          run: () => {
            const rs = recommendations(); if (!rs.length) return 'אין המלצות — הלו״ז מסתדר';
            rs.slice(0, 4).forEach(x => { if (typeof autoNotify === 'function')
              autoNotify(x.title, x.why + ' · ' + x.action, 'reminder'); });
            return rs.length + ' המלצות: ' + rs.slice(0, 3).map(x => x.title).join(' · ');
          } } });
    },
  });

  window.TERR = { zones: () => TERR, travel, check, route: dayRoute, zoneOf: zoneOfRec, zoneOfCity,
    shipsOn, nextShip, freq: () => FREQ,
    staff: () => ST, svc: () => SVC, fieldStaff, cfg: () => CFG, recommendations, coversOn, daysOf };
})();
