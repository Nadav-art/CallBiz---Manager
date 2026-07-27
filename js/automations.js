/* ============================================================
   מנוע אוטומציות — מודול עצמאי
   ------------------------------------------------------------
   עד כה טאב האוטומציות היה תצוגה בלבד: מתגים שלא נשמרו וכפתורים מתים.
   כאן נבנה מנוע אמיתי:

     • כל החוקים **כבויים כברירת מחדל** — שום דבר לא רץ עד שמדליקים.
     • לכל חוק יש פעולה אמיתית (run) שמשנה את מצב המערכת.
     • כל הרצה נרשמת ביומן (AUTO_LOG) — מי, מתי, מה קרה.
     • לכל חוק יש "הרץ עכשיו" להדגמה מבוקרת, כדי להבין מה הוא עושה.

   נקודות החיבור נקראות דרך autoFire(key, ctx) מתוך הקוד הקיים,
   כך שכיבוי חוק באמת מבטל את ההתנהגות.
   ============================================================ */
let AUTO_STATE = (function () { try { return JSON.parse(localStorage.getItem('cb_autoOn')) || {}; } catch (e) { return {}; } })();
let AUTO_LOG = (function () { try { return JSON.parse(localStorage.getItem('cb_autoLog')) || []; } catch (e) { return []; } })();
let AUTO_CUSTOM = (function () { try { return JSON.parse(localStorage.getItem('cb_autoCustom')) || []; } catch (e) { return []; } })();
function autoSave() {
  try { localStorage.setItem('cb_autoOn', JSON.stringify(AUTO_STATE));
    localStorage.setItem('cb_autoLog', JSON.stringify(AUTO_LOG.slice(0, 60)));
    localStorage.setItem('cb_autoCustom', JSON.stringify(AUTO_CUSTOM)); } catch (e) {}
}
/* כבוי כברירת מחדל — רק מה שהודלק במפורש פעיל */
function autoIsOn(key) { return AUTO_STATE[key] === true; }
function autoSet(key, on) { AUTO_STATE[key] = !!on; autoSave(); }
function autoAllOff() { AUTO_STATE = {}; autoSave(); }
function autoStamp() { return (typeof docStamp === 'function') ? docStamp() : ''; }
function autoLog(key, title, what, manual, blocked, dry) {
  AUTO_LOG.unshift({ key: key, title: title, what: what, at: autoStamp(), by: dry ? 'בדיקה' : (manual ? 'הרצה ידנית' : 'אוטומציה'), blocked: !!blocked, dry: !!dry });
  if (AUTO_LOG.length > 60) AUTO_LOG.length = 60;
  autoSave();
}
/* נקודת החיבור מהקוד: מריץ רק אם החוק דלוק */
const AUTO_BUSY = {};
function autoFire(key, ctx, manual) {
  const d = autoDef(key); if (!d) return false;
  if (!manual && !autoIsOn(key)) return false;
  if (AUTO_BUSY[key]) return false;            // מניעת לולאה: החוק כבר רץ כרגע
  const blocked = why => { autoLog(key, d.title, 'נחסם — ' + why, manual, true);
    if (typeof autoStatBump === 'function') autoStatBump(key, 'blocked'); return false; };
  // חלון פעילות של החוק (תאריכים · ימים · שעות)
  if (!manual && typeof autoWindowOk === 'function') { const w = autoWindowOk(key); if (!w.ok) return blocked(w.why); }
  // הגבלת תדירות ומניעת כפילויות
  if (!manual && typeof autoLimitOk === 'function') { const l = autoLimitOk(key, ctx || {}); if (!l.ok) return blocked(l.why); }
  // תנאים על החוק
  if (typeof autoCondPass === 'function') {
    const cp = autoCondPass(key, ctx || {});
    if (!cp.ok) return blocked(cp.why);
  }
  // מצב בדיקה — מריצים על עותק ומשחזרים, כדי לראות מה היה קורה
  const dry = (typeof AUTO_DRY !== 'undefined') && AUTO_DRY;
  const snap = dry ? autoSnapshot(ctx) : null;
  AUTO_BUSY[key] = true;
  let res = false;
  try { res = autoRunNow(key, d, ctx, manual, dry); } finally { AUTO_BUSY[key] = false; }
  if (dry) { autoRestore(snap); return res; }
  if (res) {
    if (typeof autoStatBump === 'function') autoStatBump(key, 'ok');
    if (typeof autoLimitMark === 'function') autoLimitMark(key, ctx || {});
    if (typeof autoRunChain === 'function') autoRunChain(key, ctx || {});        // שרשור
  } else {
    if (typeof autoStatBump === 'function') autoStatBump(key, 'fail');
    autoFallback(key, ctx, d);                                                    // פעולה חלופית
  }
  return res;
}
function autoRunNow(key, d, ctx, manual, dry) {
  let what = '';
  try { what = d.run ? d.run(ctx || {}) : ''; } catch (e) { what = 'שגיאה: ' + e.message; }
  if (what) autoLog(key, d.title, (dry ? '[בדיקה] ' : '') + what, manual, false, dry);
  return !!what;
}
/* צילום/שחזור מצב — למצב בדיקה */
function autoSnapshot(ctx) {
  const r = (ctx || {}).rec;
  return { rec: r, recCopy: r ? JSON.parse(JSON.stringify(r)) : null,
    notifs: (typeof NOTIF_LOG !== 'undefined') ? NOTIF_LOG.slice() : null,
    queue: (typeof AUTO_QUEUE !== 'undefined') ? AUTO_QUEUE.slice() : null };
}
function autoRestore(sn) {
  if (!sn) return;
  if (sn.rec && sn.recCopy) { Object.keys(sn.rec).forEach(k => delete sn.rec[k]); Object.assign(sn.rec, sn.recCopy); }
  if (sn.notifs && typeof NOTIF_LOG !== 'undefined') { NOTIF_LOG.length = 0; sn.notifs.forEach(n => NOTIF_LOG.push(n)); }
  if (sn.queue && typeof AUTO_QUEUE !== 'undefined') { AUTO_QUEUE.length = 0; sn.queue.forEach(q => AUTO_QUEUE.push(q)); }
  if (typeof updateBellBadge === 'function') updateBellBadge();
}
/* פעולה חלופית כשהחוק לא ביצע דבר (למשל וואטסאפ נכשל → SMS) */
function autoFallback(key, ctx, d) {
  const m = (typeof autoMeta === 'function') ? autoMeta(key) : null;
  if (!m || !m.onFail) return;
  const act = (typeof AUTO_ACTIONS !== 'undefined') ? AUTO_ACTIONS.find(a => a.key === m.onFail) : null;
  if (!act) return;
  let what = ''; try { what = act.run({ title: d.title, param: (typeof autoMerge === 'function') ? autoMerge(d.param || '', ctx || {}) : (d.param || '') }); } catch (e) { what = ''; }
  if (what) autoLog(key, d.title, 'פעולה חלופית: ' + what, false, false);
}
function autoDef(key) {
  const base = (typeof AUTOMATIONS !== 'undefined') ? AUTOMATIONS.find(a => a.key === key) : null;
  const impl = AUTO_IMPL[key];
  const cust = AUTO_CUSTOM.find(c => c.key === key);
  if (cust) return Object.assign({}, cust, { run: ctx => autoCustomRun(cust, ctx) });
  if (!base) return null;
  return Object.assign({}, base, impl || {});
}
function autoAll() { return ((typeof AUTOMATIONS !== 'undefined') ? AUTOMATIONS : []).concat(AUTO_CUSTOM); }

/* ---------------- עזרים ---------------- */
function autoDemoLead() { return (typeof RECORDS !== 'undefined') ? (RECORDS.find(r => !r.done) || RECORDS[0]) : null; }
function autoNotify(title, body, kind) {
  if (typeof NOTIF_LOG !== 'undefined') { NOTIF_LOG.unshift({ title: title, body: body, kind: kind || 'chat', read: false });
    if (NOTIF_LOG.length > 40) NOTIF_LOG.length = 40; }
  if (typeof updateBellBadge === 'function') updateBellBadge();
}
/* סבב שוויוני — הנציג עם הכי מעט לידים פתוחים */
function autoNextRep() {
  const staff = (typeof STAFF !== 'undefined') ? STAFF.filter(s => s.on !== false) : [];
  if (!staff.length) return null;
  const load = {}; staff.forEach(s => load[s.name] = 0);
  ((typeof RECORDS !== 'undefined') ? RECORDS : []).forEach(r => { if (!r.done && load[r.assignee] !== undefined) load[r.assignee]++; });
  return staff.slice().sort((a, b) => load[a.name] - load[b.name])[0];
}
function autoBizHours() { return { from: 8, to: 18 }; }

/* ---------------- מימוש החוקים ---------------- */
const AUTO_IMPL = {
  a1: { what: 'בודק אם הטלפון כבר קיים בתיק אחר במערכת. אם כן — מסמן שזה אותו לקוח, כדי שלא ייפתחו לו שני תיקים במקביל.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      const dup = ((typeof RECORDS !== 'undefined') ? RECORDS : []).find(x => x !== r && x.phone && x.phone === r.phone);
      if (!dup) return r.name + ': לא נמצא תיק קיים עם אותו טלפון';
      r.dupOf = dup.id;
      return r.name + ': זוהה תיק קיים — ' + dup.name + ' (' + (r.phone || '') + ')'; } },

  a1b: { what: 'מחליט למי מהצוות הליד מגיע ומשייך אותו אוטומטית. איך בוחרים את הנציג — בהגדרות שלמטה.',
    cfg: 'routeConfigHTML', cfgBind: 'routeBindConfig',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      if (typeof routeAssign !== 'function') return '';
      const res = routeAssign(r);
      return r.name + ': ' + res.why; } },

  a1c: { what: 'ברגע שליד נכנס — המערכת קובעת לו מועד ליצירת קשר לפי היומן ושעות הפעילות, כדי ששום פנייה לא תישכח.',
    cfg: 'autoFuCfgHTML', cfgBind: 'autoFuCfgBind',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      const sch = (typeof autoFuSchedule === 'function') ? autoFuSchedule(r) : { at: 'היום 09:00', why: '' };
      r.next = r.next || {}; r.next.type = 'followup'; r.next.at = sch.at;
      return r.name + ': נקבעה יצירת קשר ל' + sch.at + (sch.why ? ' · ' + sch.why : ''); } },

  a1d: { what: 'מתחיל לספור כמה זמן עובר עד שחוזרים ללקוח, ומסמן באדום ליד שחרג מהזמן שהוגדר.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      r.slaStarted = (typeof autoStamp === 'function') ? autoStamp() : '';
      return r.name + ': התחילה מדידת זמן תגובה · ' + r.slaStarted; } },

  a2: { what: 'עם קביעת פגישה: סוגר את הפולו-אפ הפתוח ושולח ללקוח אישור עם פרטי המועד.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r || !r.meeting) return r ? r.name + ': אין פגישה קבועה — לא בוצע' : '';
      if (r.next && r.next.type === 'followup') r.next = { type: 'meeting', at: r.meeting.date + ' ' + r.meeting.time };
      const q = autoSendToCustomer('אישור פגישה נשלח', r.name + ' · ' + r.meeting.date + ' ' + r.meeting.time, 'reminder');
      return r.name + ': פולו-אפ נסגר · אישור נשלח ל' + (r.phone || 'לקוח') + q; } },

  a3: { what: 'שעה לפני הפגישה נשלחת תזכורת ללקוח (SMS + וואטסאפ) ונרשמת התראה לנציג.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r || !r.meeting) return '';
      const q = autoSendToCustomer('תזכורת נשלחה ללקוח', r.name + ' · פגישה ב-' + r.meeting.time + ' · SMS + וואטסאפ', 'reminder');
      return r.name + ': תזכורת שעה לפני ' + r.meeting.time + q; } },

  a4: { what: 'בעת ביטול: משחרר את המשבצת, פותח פולו-אפ ושולח ללקוח 3 מועדים חלופיים לפי הקריטריונים שלו.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      let alts = [];
      if (typeof coordPool === 'function' && typeof cDayLbl === 'function' && typeof fmtH === 'function')
        alts = coordPool().filter(s => !s.booked && !s.held).slice(0, 3).map(s => cDayLbl(s.date) + ' ' + fmtH(s.h));
      r.next = { type: 'followup', at: 'היום 10:00' };
      autoNotify('הוצעו מועדים חלופיים', r.name + ' · ' + (alts.join(' · ') || 'אין זמינות'), 'chat');
      return r.name + ': נפתח פולו-אפ · הוצעו ' + alts.length + ' מועדים'; } },

  a5: { what: 'בעת אי-הגעה: מסמן "לא הגיע" ופותח שיחת חזרה לנציג המטפל.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      r.noShow = true; r.next = { type: 'followup', at: 'מחר 09:00' };
      return r.name + ': סומן לא-הגיע · נקבעה שיחת חזרה למחר 09:00'; } },

  a6: { what: 'לאחר פגישה: חוסם סגירת ליד ללא תוצאה ופעולה הבאה, ומציג המלצת המשך.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      r.requireOutcome = true;
      return r.name + ': סגירה נחסמה עד להזנת תוצאה + פעולה הבאה'; } },

  a7: { what: 'פולו-אפ שנקבע מחוץ לשעות הפעילות מוזז אוטומטית לחלון הפנוי הבא (08:00 למחרת).',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r || !r.next) return '';
      const h = autoBizHours(); const m = /(\d{1,2}):(\d{2})/.exec(r.next.at || '');
      const hr = m ? +m[1] : 9;
      if (hr >= h.from && hr < h.to) return r.name + ': ' + (r.next.at || '') + ' — בתוך שעות הפעילות, לא הוזז';
      const was = r.next.at; r.next.at = 'מחר 08:00';
      return r.name + ': ' + was + ' → מחר 08:00 (מחוץ לשעות ' + h.from + ':00–' + h.to + ':00)'; } },

  h1: { what: 'עם נעילת התור נשלח ללקוח קישור סליקה מאובטח בוואטסאפ.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); const hold = ctx.hold;
      const q = autoSendToCustomer('קישור סליקה נשלח', (r ? r.name : '') + (hold ? ' · ' + hold.price + ' ₪' : ''), 'chat');
      return (r ? r.name : '') + ': קישור סליקה נשלח' + (hold ? ' על ' + hold.price + ' ₪' : '') + q; } },

  h2: { what: '5 דקות לפני שהנעילה פגה — התראה לנציג בפעמון ותזכורת ללקוח.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); const hold = ctx.hold;
      autoNotify('הנעילה עומדת לפוג', (r ? r.name : '') + ' · נותרו ' + ((hold && hold.minsLeft) || 5) + ' דקות', 'reminder');
      return (r ? r.name : '') + ': תזכורת דחופה נשלחה'; } },

  h3: { what: 'בתום זמן הנעילה המשבצת משתחררת, הלקוח יורד מרשימת ההמתנה ונפתח פולו-אפ.',
    run: ctx => { const hold = ctx.hold || ((typeof SLOT_HOLDS !== 'undefined') ? SLOT_HOLDS[0] : null);
      if (!hold) return 'אין נעילה פעילה — לא בוצע';
      const live = (typeof SLOT_HOLDS !== 'undefined') && SLOT_HOLDS.some(x => x.id === hold.id);
      if (live && typeof releaseHold === 'function') {
        const sl = (typeof coordPool === 'function') ? coordPool().find(x => x.id === hold.slotId) : null;
        const rr = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => x.id === hold.recId) : null;
        releaseHold(hold, rr, sl, true);
      }
      const r = ctx.rec || ((typeof RECORDS !== 'undefined') ? RECORDS.find(x => x.id === hold.recId) : null);
      if (r) r.next = { type: 'followup', at: 'היום 12:00' };
      return (hold.name || '') + ': הנעילה שוחררה · התור חזר להיות פנוי · נפתח פולו-אפ'; } },

  h4: { what: 'בתום הנעילה נשלחים ללקוח 3 מועדים חלופיים לפי הקריטריונים שלו.',
    run: ctx => AUTO_IMPL.a4.run(ctx) },

  h5: { what: 'לאחר סליקה מוצלחת: המשבצת נסגרת סופית ונשלח ללקוח אישור עם פרטי התור והנחיות הכנה.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      const m = r.meeting ? (r.meeting.date + ' ' + r.meeting.time) : 'המועד שנבחר';
      const q = autoSendToCustomer('אישור תור נשלח', r.name + ' · ' + m, 'reminder');
      return r.name + ': שיריון סופי · אישור והנחיות הכנה נשלחו' + q; } },

  h6: { what: 'לאחר סליקה נוצרת קבלה ומתויקת אוטומטית בטאב "מסמכים" של הליד, עם חותמת זמן וחתימת המפיק.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      const amt = (r.paid && r.paid.amount) || (ctx.hold && ctx.hold.price) || 0;
      r.docs = r.docs || [];
      r.docs.unshift({ name: 'קבלה · ' + amt + ' ₪.pdf', type: 'קבלה', by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''), at: autoStamp(), auto: true });
      return r.name + ': קבלה על ' + amt + ' ₪ נוצרה ותויקה במסמכי הליד'; } },

  h7: { what: 'הסכם שנשלח ולא נחתם — נשלחת תזכורת חתימה לפי מספר הימים שהוגדר בהגדרות ההסכמים.',
    run: ctx => { const days = (typeof ctRemindDays === 'function') ? ctRemindDays() : 3;
      const open = (typeof CONTRACT_REGISTRY !== 'undefined') ? CONTRACT_REGISTRY.filter(x => x.status === 'sent' || x.status === 'viewed') : [];
      if (!open.length) return 'אין הסכמים ממתינים לחתימה — לא בוצע';
      open.forEach(x => { x.audit = x.audit || []; x.audit.push({ act: 'תזכורת אוטומטית', by: 'אוטומציה', at: autoStamp() }); });
      if (typeof ctRegSave === 'function') ctRegSave();
      autoNotify('תזכורת חתימה נשלחה', open.length + ' הסכמים ממתינים · לאחר ' + days + ' ימים', 'chat');
      return 'נשלחו תזכורות ל-' + open.length + ' הסכמים (סף: ' + days + ' ימים)'; } },

  h8: { what: 'עם קליטת חתימת הלקוח נפתח אוטומטית מסך הסליקה והנעילה מוארכת.',
    run: ctx => { const r = ctx.rec || autoDemoLead(); if (!r) return '';
      const hold = ctx.hold || ((typeof SLOT_HOLDS !== 'undefined') ? SLOT_HOLDS.find(h => h.recId === r.id) : null);
      if (hold) { hold.minsLeft = Math.max(hold.minsLeft || 0, 10); }
      return r.name + ': חתימה נקלטה · מעבר לסליקה' + (hold ? ' · הנעילה הוארכה ל-' + hold.minsLeft + ' דק׳' : ''); } },
};

/* ---------------- אוטומציה מותאמת (בונה חוקים) ---------------- */
const AUTO_TRIGGERS = ['בעת יצירת ליד', 'בעת קביעת פגישה', 'לפני פגישה', 'בעת ביטול', 'בעת אי-הגעה',
  'לאחר פגישה', 'מחוץ לשעות פעילות', 'בעת נעילה זמנית', 'לאחר סליקה', 'בעת חתימת הסכם'];
const AUTO_ACTIONS = [
  { key: 'notify', label: 'שליחת התראה לנציג', run: c => { autoNotify(c.title, c.param || '', 'chat'); return 'התראה נשלחה: ' + (c.param || c.title); } },
  { key: 'wa', label: 'שליחת וואטסאפ ללקוח', run: c => { const r = autoDemoLead(); autoNotify('וואטסאפ נשלח', (r ? r.name : '') + ' · ' + (c.param || ''), 'chat'); return 'וואטסאפ נשלח ללקוח'; } },
  { key: 'followup', label: 'פתיחת פולו-אפ', run: c => { const r = autoDemoLead(); if (!r) return ''; r.next = { type: 'followup', at: c.param || 'מחר 09:00' }; return r.name + ': נפתח פולו-אפ ל' + (c.param || 'מחר 09:00'); } },
  { key: 'assign', label: 'שיוך נציג בסבב שוויוני', run: c => { const r = autoDemoLead(), rep = autoNextRep(); if (!r || !rep) return ''; r.assignee = rep.name; return r.name + ': שויך ל' + rep.name; } },
  { key: 'doc', label: 'תיוק מסמך בליד', run: c => { const r = autoDemoLead(); if (!r) return ''; r.docs = r.docs || []; r.docs.unshift({ name: (c.param || 'מסמך') + '.pdf', type: 'אחר', by: 'אוטומציה', at: autoStamp(), auto: true }); return r.name + ': תויק ' + (c.param || 'מסמך'); } },
];
function autoCustomRun(c, ctx) {
  const a = AUTO_ACTIONS.find(x => x.key === c.action); if (!a) return '';
  const merged = Object.assign({}, c);
  if (typeof autoMerge === 'function') { merged.param = autoMerge(c.param || '', ctx || {}); merged.title = autoMerge(c.title || '', ctx || {}); }
  return a.run(merged);
}
function autoAddCustom(trigger, title, action, param) {
  const key = 'x' + (AUTO_CUSTOM.length + 1) + '_' + Math.abs((title || '').length * 7 + AUTO_CUSTOM.length);
  const a = AUTO_ACTIONS.find(x => x.key === action);
  AUTO_CUSTOM.push({ key: key, trigger: trigger, title: title, action: action, param: param || '',
    desc: (a ? a.label : '') + (param ? ' · ' + param : ''), custom: true, on: false });
  AUTO_STATE[key] = false; autoSave(); return key;
}
function autoUpdateCustom(key, patch) {
  const c = AUTO_CUSTOM.find(x => x.key === key); if (!c) return null;
  Object.assign(c, patch);
  const a = AUTO_ACTIONS.find(x => x.key === c.action);
  c.desc = (a ? a.label : '') + (c.param ? ' · ' + c.param : '');
  autoSave(); return c;
}
function autoDelCustom(key) { AUTO_CUSTOM = AUTO_CUSTOM.filter(c => c.key !== key); delete AUTO_STATE[key]; autoSave(); }

/* ---------------- סבב בדיקת מועדים (חוקים תלויי-זמן) ---------------- */
function autoTick(manual) {
  const out = [];
  // a3 — תזכורת לפני פגישה: לכל ליד עם פגישה היום
  if (autoIsOn('a3') || manual) {
    ((typeof RECORDS !== 'undefined') ? RECORDS : []).filter(r => !r.done && r.meeting).slice(0, 3)
      .forEach(r => { if (autoFire('a3', { rec: r }, manual)) out.push('a3 · ' + r.name); });
  }
  // a7 — פולו-אפ מחוץ לשעות
  if (autoIsOn('a7') || manual) {
    ((typeof RECORDS !== 'undefined') ? RECORDS : []).filter(r => !r.done && r.next && r.next.at).slice(0, 5)
      .forEach(r => { if (autoFire('a7', { rec: r }, manual)) out.push('a7 · ' + r.name); });
  }
  // h7 — הסכמים שממתינים לחתימה
  if (autoIsOn('h7') || manual) { if (autoFire('h7', {}, manual)) out.push('h7'); }
  // a8 — אסקלציה · a9 — קיבולת
  if (autoIsOn('a8') || manual) { if (autoFire('a8', {}, manual)) out.push('a8'); }
  if (autoIsOn('a9') || manual) { if (autoFire('a9', {}, manual)) out.push('a9'); }
  // שחרור התור בחלון השקט כשהחלון נסגר
  if (typeof autoInQuiet === 'function' && !autoInQuiet() && typeof AUTO_QUEUE !== 'undefined' && AUTO_QUEUE.length) {
    const n = autoQuietFlush(); if (n) out.push('quiet:' + n);
  }
  return out;
}
