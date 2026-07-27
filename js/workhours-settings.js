/* ============================================================
   הגדרות שעות פעילות — חלון מלא מודולרי
   ------------------------------------------------------------
   מבנה מכוון להפרדה: כל מקטע בסיידבר = אובייקט עצמאי ב-WHS_PANELS
   עם render() + bind() משלו. כדי לשנות עיצוב/פונקציונליות של פאנל
   אחד — עורכים רק את זוג הפונקציות שלו כאן, בלי לגעת בשאר.
   מעטפת (header/sidebar/footer) מופרדת מהפאנלים לגמרי.
   ============================================================ */
let whsOpen = false;
let whsActive = 'hours';                 // מפתח הפאנל הפעיל
let whsTz = 'ירושלים (GMT+3)';

/* נירמול: לוודא שכל 7 ימי השבוע קיימים ב-workSchedule (חסרים = לא-פעילים) */
function whsEnsureAllDays() {
  ALL_WEEK.forEach(day => {
    if (!workSchedule.some(d => d.day === day))
      workSchedule.push({ day, on: false, segments: [{ type: 'shift', start: '08:00', end: '17:00' }] });
  });
  if (typeof sortSchedule === 'function') sortSchedule();
}

/* === רישום פאנלים — הוספה/הסרה/שינוי סדר כאן בלבד === */
const WHS_PANELS = [
  { key: 'general',  label: 'כללי',            icon: 'settings', render: whsPanelGeneral,  bind: whsBindGeneral },
  { key: 'hours',    label: 'שעות פעילות',      icon: 'clock',    render: whsPanelHours,    bind: whsBindHours },
  { key: 'breaks',   label: 'הפסקות, חגים וחופשות', icon: 'pause', render: () => whsPanelBreaks() + '<div style="height:14px"></div>' + whsPanelHolidays(), bind: () => { whsBindBreaks(); whsBindHolidays(); } },
  { key: 'services', label: 'סוגי שירות וקיבולת', icon: 'tasks',   render: whsPanelServices, bind: whsBindServices },
  { key: 'more',     label: 'הגדרות נוספות',    icon: 'docs',     render: whsPanelMore,     bind: whsBindMore },
];
function whsPanelDef(key) { return WHS_PANELS.find(p => p.key === key) || WHS_PANELS.find(p => p.key === 'hours'); }

/* ---------- מעטפת החלון ---------- */
function openWorkHoursSettings() {
  whsEnsureAllDays();
  whsOpen = true;
  let ov = document.getElementById('whsOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'whsOverlay'; ov.className = 'whs-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = `
    <div class="whs-window" role="dialog" aria-modal="true" aria-label="הגדרות שעות פעילות">
      <header class="whs-head">
        <div class="whs-head-r">
          <button class="whs-x" id="whsClose" aria-label="סגור">${ic('close')}</button>
          <div class="whs-title">${ic('clock')} <b>הגדרות שעות פעילות</b></div>
        </div>
        <button class="btn primary whs-save" id="whsSave">${ic('check')} שמירה</button>
      </header>
      <div class="whs-body">
        <aside class="whs-side" id="whsSide">
          ${WHS_PANELS.map(p => `<button class="whs-nav ${p.key === whsActive ? 'on' : ''}" data-whs-nav="${p.key}">${ic(p.icon)} <span>${p.label}</span></button>`).join('')}
        </aside>
        <main class="whs-content" id="whsContent"></main>
      </div>
      <footer class="whs-foot">
        <div class="whs-autosave">${ic('check')} השינויים נשמרים אוטומטית</div>
        <div class="whs-tz">${ic('org')}
          <select class="cc-inp" id="whsTzSel">
            ${['ירושלים (GMT+3)', 'לונדון (GMT+0)', 'ניו-יורק (GMT-5)'].map(z => `<option ${z === whsTz ? 'selected' : ''}>${z}</option>`).join('')}
          </select>
        </div>
      </footer>
    </div>`;
  requestAnimationFrame(() => ov.classList.add('open'));
  $('#whsClose').addEventListener('click', closeWorkHoursSettings);
  $('#whsSave').addEventListener('click', () => { toast('הגדרות שעות הפעילות נשמרו ✓'); closeWorkHoursSettings(); });
  $('#whsTzSel').addEventListener('change', e => { whsTz = e.target.value; toast('אזור הזמן עודכן · ' + whsTz); });
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeWorkHoursSettings(); });
  document.addEventListener('keydown', whsEscHandler);
  $$('[data-whs-nav]').forEach(b => b.addEventListener('click', () => { whsActive = b.dataset.whsNav; whsSyncNav(); whsRenderPanel(); }));
  whsRenderPanel();
}
function whsEscHandler(e) { if (e.key === 'Escape' && whsOpen && !document.getElementById('cbConfirmWrap') && !document.getElementById('copyDaysPop')) closeWorkHoursSettings(); }
function closeWorkHoursSettings() {
  whsOpen = false;
  document.removeEventListener('keydown', whsEscHandler);
  const ov = document.getElementById('whsOverlay');
  if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); }
  if (typeof renderSettingsView === 'function' && $('#viewHost')) renderSettingsView();   // רענון הכרטיס המוטבע
}
function whsSyncNav() { $$('[data-whs-nav]').forEach(b => b.classList.toggle('on', b.dataset.whsNav === whsActive)); }
/* רענון תוכן הפאנל הפעיל בלבד — מנגנון הרענון של whRefresh() כשחלון פתוח */
function whsRenderPanel() {
  const host = document.getElementById('whsContent'); if (!host) return;
  const p = whsPanelDef(whsActive);
  host.innerHTML = p.render();
  p.bind();
}

/* ---------- עזרי UI משותפים לפאנלים ---------- */
function whsTgl(on, group, i) {
  return `<button class="whs-switch ${on ? 'on' : ''}" type="button" data-whs-tgl="${group}:${i}"><span class="whs-switch-dot"></span></button>`;
}
function whsBindTgls(map) {
  $$('[data-whs-tgl]').forEach(b => b.addEventListener('click', () => {
    const [g, i] = b.dataset.whsTgl.split(':');
    const arr = map[g]; if (!arr || !arr[+i]) return;
    arr[+i].on = !arr[+i].on; whsRenderPanel();
    toast(arr[+i].on ? 'הופעל' : 'כובה');
  }));
}
/* פופ-אפ קטן להוספת ערך טקסטואלי (קריטריון) — במקום prompt נייטיב */
function whsInputPop(title, placeholder, onOk) {
  const old = document.getElementById('whsInputPop'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'whsInputPop';
  w.innerHTML = `<div class="cbc-box"><div class="cbc-head"><span class="cbc-ic">${ic('target')}</span><b>${title}</b></div>
    <div style="margin:4px 0 14px"><input class="cc-inp" id="whsInpField" placeholder="${placeholder}" style="width:100%"></div>
    <div class="cbc-actions"><button class="btn ghost" id="whsInpCancel">ביטול</button><button class="btn primary" id="whsInpOk">${ic('check')} הוסף</button></div></div>`;
  document.body.appendChild(w);
  requestAnimationFrame(() => w.classList.add('open'));
  const close = () => w.remove();
  const field = $('#whsInpField'); field.focus();
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#whsInpCancel').addEventListener('click', close);
  $('#whsInpOk').addEventListener('click', () => { const v = (field.value || '').trim(); close(); if (v) onOk(v); });
  field.addEventListener('keydown', e => { if (e.key === 'Enter') $('#whsInpOk').click(); if (e.key === 'Escape') close(); });
}

/* ============================================================
   פאנל: כללי (דיוק תזמון + מדיניות אישור + סנכרון יומנים)
   ============================================================ */
function whsPanelGeneral() {
  return `
    <h3 class="whs-ph">${ic('settings')} כללי</h3>
    <div class="whs-secgrid">
      <section class="whs-sec">
        <h4>${ic('clock')} דיוק תזמון ביומן</h4>
        <div class="seg" style="width:100%">
          ${CAL_STEP_OPTIONS.map(m => `<button class="seg-btn ${CAL_STEP.minutes === m ? 'on' : ''}" data-calstep="${m}" style="flex:1">${m === 60 ? 'שעה' : m + ' דק\''}</button>`).join('')}
          <button class="seg-btn ${!CAL_STEP_OPTIONS.includes(CAL_STEP.minutes) ? 'on' : ''}" data-calstep="custom" style="flex:1">אחר</button>
        </div>
        ${!CAL_STEP_OPTIONS.includes(CAL_STEP.minutes) ? `<div class="field" style="margin-top:8px"><input class="cc-inp" type="number" id="calStepCustom" min="5" max="180" step="5" value="${CAL_STEP.minutes}"></div>` : ''}
      </section>
      <section class="whs-sec">
        <h4>${ic('check')} מדיניות אישור</h4>
        ${APPROVAL_POLICIES.map((p, i) => `<div class="whs-row"><span>${p.label}</span>${whsTgl(p.on, 'appr', i)}</div>`).join('')}
      </section>
      <section class="whs-sec whs-sec-wide">
        <h4>${ic('sync')} סנכרון יומנים</h4>
        ${SYNC_CALENDARS.map((s, i) => `<div class="whs-row"><span><b>${s.name}</b><small class="muted"> · ${s.mode}</small></span>${whsTgl(s.on, 'sync', i)}</div>`).join('')}
      </section>
    </div>`;
}
function whsBindGeneral() {
  $$('[data-calstep]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.calstep === 'custom') { if (CAL_STEP_OPTIONS.includes(CAL_STEP.minutes)) CAL_STEP.minutes = 45; whsRenderPanel(); return; }
    CAL_STEP.minutes = +b.dataset.calstep; whsRenderPanel();
    toast(`דיוק התזמון: ${CAL_STEP.minutes === 60 ? 'שעה' : CAL_STEP.minutes + ' דקות'}`);
  }));
  const csc = $('#calStepCustom'); if (csc) csc.addEventListener('change', () => { CAL_STEP.minutes = Math.max(5, Math.min(180, +csc.value || 15)); whsRenderPanel(); });
  whsBindTgls({ appr: APPROVAL_POLICIES, sync: SYNC_CALENDARS });
}

/* ============================================================
   פאנל: שעות פעילות (כרטיסי הימים + פעולות מהירות + טופ-בר)
   ============================================================ */
function whsPanelHours() {
  return `
    <div class="whs-topbar">
      <button class="wh-24 ${wh24 ? 'on' : ''}" id="wh24Toggle" type="button"><span class="wh-24-dot"></span> הצג 24 שעות</button>
      <div class="whs-tb-mid">
        <button class="whs-tb-chip" id="whsWeekView">${ic('calendar')} תצוגה שבועית ${ic('chevron')}</button>
        <button class="whs-tb-nav" data-whs-week="-1" aria-label="שבוע קודם">${ic('chevronR')}</button>
        <button class="whs-tb-nav" data-whs-week="1" aria-label="שבוע הבא">${ic('chevronL')}</button>
        <button class="whs-tb-chip" id="whsCopyWeek">${ic('layers')} העתק משבוע</button>
      </div>
    </div>
    ${typeof whBranchBannerHTML === 'function' ? whBranchBannerHTML() : ''}
    <div class="wh-daysgrid whs-daysgrid">${workSchedule.map((d, i) => whDayCard(d, i)).join('')}</div>
    ${whQuickbarHTML()}`;
}
function whsBindHours() {
  bindWorkHours();   // מחווט את data-seg / data-wh-* / #wh24Toggle / presets / copydays — כולם דרך whRefresh()
  const wv = $('#whsWeekView'); if (wv) wv.addEventListener('click', () => toast('תצוגה שבועית · תצוגות יומית/חודשית בקרוב'));
  $$('[data-whs-week]').forEach(b => b.addEventListener('click', () => toast(+b.dataset.whsWeek > 0 ? 'מעבר לשבוע הבא' : 'מעבר לשבוע הקודם')));
  const cw = $('#whsCopyWeek'); if (cw) cw.addEventListener('click', () => toast('לוח השבוע הנוכחי הועתק · ניתן להדביק בשבוע אחר'));
}

/* ============================================================
   פאנל: הפסקות (הפסקת ברירת-מחדל + החלה/ניקוי לכל הימים)
   ============================================================ */
let whsBreakDef = { start: '13:00', end: '14:00' };
function whsPanelBreaks() {
  return `
    <h3 class="whs-ph">${ic('pause')} הפסקות</h3>
    <div class="whs-secgrid">
      <section class="whs-sec">
        <h4>${ic('pause')} הפסקת ברירת מחדל</h4>
        <div class="whs-breakdef">
          <span class="wh-seg-clk">${ic('clock')}</span>
          <input type="time" id="whsBrkStart" value="${whsBreakDef.start}">
          <span class="wh-seg-dash">–</span>
          <input type="time" id="whsBrkEnd" value="${whsBreakDef.end}">
        </div>
        <button class="btn primary sm whs-block-btn" id="whsApplyBrk">${ic('plus')} הוסף לכל הימים הפעילים</button>
        <button class="btn sm whs-block-btn" id="whsClearBrk">${ic('close')} נקה הפסקות מכל הימים</button>
      </section>
      <section class="whs-sec">
        <h4>${ic('calendar')} הפסקות לפי יום</h4>
        ${workSchedule.map(d => { const brks = d.segments.filter(s => s.type === 'break');
          return `<div class="whs-row"><span><b>${d.day}</b>${d.on ? '' : ' <small class="muted">· לא פעיל</small>'}</span>
            <span class="muted">${brks.length ? brks.map(b => b.start + '–' + b.end).join(' · ') : 'ללא הפסקה'}</span></div>`; }).join('')}
      </section>
    </div>`;
}
function whsBindBreaks() {
  const s = $('#whsBrkStart'), e = $('#whsBrkEnd');
  if (s) s.addEventListener('change', () => whsBreakDef.start = s.value);
  if (e) e.addEventListener('change', () => whsBreakDef.end = e.value);
  const ap = $('#whsApplyBrk'); if (ap) ap.addEventListener('click', () => {
    const bs = whsBreakDef.start, be = whsBreakDef.end; let n = 0;
    workSchedule.forEach(d => { if (!d.on) return;
      const ws = d.segments[0].start, we = d.segments[d.segments.length - 1].end;
      if (hmToMin(bs) > hmToMin(ws) && hmToMin(be) < hmToMin(we) && hmToMin(be) > hmToMin(bs)) {
        d.segments = [{ type: 'shift', start: ws, end: bs }, { type: 'break', start: bs, end: be }, { type: 'shift', start: be, end: we }]; n++;
      }
    });
    whsRenderPanel(); toast(n ? `הפסקה ${bs}–${be} נוספה ל-${n} ימים` : 'ההפסקה מחוץ לשעות העבודה של הימים הפעילים');
  });
  const cl = $('#whsClearBrk'); if (cl) cl.addEventListener('click', () => {
    workSchedule.forEach(d => { if (d.segments.some(x => x.type === 'break')) d.segments = [{ type: 'shift', start: d.segments[0].start, end: d.segments[d.segments.length - 1].end }]; });
    whsRenderPanel(); toast('כל ההפסקות נוקו');
  });
}

/* ============================================================
   פאנל: סוגי שירות (משכי תיאום ומרווחים — DURATIONS)
   ============================================================ */
/* פאנל מאוחד: סוגי שירות (משכים ומרווחים) + תורים מקסימליים (קיבולת) */
function whsPanelServices() {
  return `
    <h3 class="whs-ph">${ic('tasks')} סוגי שירות וקיבולת</h3>
    <section class="whs-sec whs-sec-wide">
      <h4>${ic('tasks')} סוגי שירות · משכים ומרווחים</h4>
      <table class="mini-table dur-table">
        <thead><tr><th>סוג</th><th>ברירת מחדל</th><th>מינ'</th><th>מקס'</th><th>הכנה</th><th>סיום</th></tr></thead>
        <tbody>${DURATIONS.map((d, i) => `<tr>
          <td><b>${d.type}</b></td>
          <td><span class="dur-in"><input value="${d.def}" data-dur="${i}:def"><em>דק'</em></span></td>
          <td><span class="dur-in"><input value="${d.min}" data-dur="${i}:min"></span></td>
          <td><span class="dur-in"><input value="${d.max}" data-dur="${i}:max"></span></td>
          <td><span class="dur-in"><input value="${d.prep}" data-dur="${i}:prep"><em>דק'</em></span></td>
          <td><span class="dur-in"><input value="${d.wrap}" data-dur="${i}:wrap"><em>דק'</em></span></td>
        </tr>`).join('')}</tbody>
      </table>
    </section>
    <section class="whs-sec whs-sec-wide" style="margin-top:14px">
      <h4>${ic('layers')} תורים מקסימליים · קיבולת</h4>
      ${CAPACITY.map((c, i) => `<div class="whs-row"><span>${c.label}</span>
        <input class="num-in" type="number" min="0" value="${c.value}" data-cap="${i}"></div>`).join('')}
      <p class="hint" style="margin-top:8px">${ic('alert')} המגבלות נאכפות בעת תיאום — חריגה מציגה אזהרה ומנתבת לחלון פנוי.</p>
    </section>`;
}
function whsBindServices() {
  $$('[data-dur]').forEach(inp => inp.addEventListener('change', () => { const [i, key] = inp.dataset.dur.split(':'); DURATIONS[+i][key] = inp.value; toast('משך השירות עודכן'); }));
  $$('[data-cap]').forEach(inp => inp.addEventListener('change', () => { CAPACITY[+inp.dataset.cap].value = Math.max(0, +inp.value || 0); toast('הקיבולת עודכנה'); }));
}

/* ============================================================
   פאנל: חגים וחופשות (EXCEPTIONS — הוספה/מחיקה אמיתית)
   ============================================================ */
let whsExAdd = false;
let whsExEditIdx = null;   // null = הוספה חדשה · מספר = עריכת חריג קיים
let whsExDraft = { date: '', label: '', type: 'יום מקוצר', from: '08:00', to: '13:00', note: '' };
/* הסבר לכל סוג חריג — מה זה אומר בפועל */
const EX_TYPE_DESC = {
  'יום מקוצר':   'יום עבודה שמסתיים מוקדם מהרגיל (למשל ערב חג) — הגדר את שעות העבודה המקוצרות ליום זה.',
  'סגור':         'הסניף/העובד סגור לגמרי ביום זה — לא ישובצו תורים ולא ייפתחו זמנים.',
  'שעות מיוחדות': 'שעות פתיחה שונות מהרגיל ליום זה (למשל אירוע/פתיחה חלקית) — הגדר טווח שעות מותאם והסבר.',
};
function whsPanelHolidays() {
  const d = whsExDraft, isClosed = d.type === 'סגור';
  return `
    <div class="whs-ph-row"><h3 class="whs-ph">${ic('flag')} חגים וחופשות</h3>
      <button class="btn sm ${whsExAdd ? '' : 'primary'}" id="whsExAddBtn">${ic(whsExAdd ? 'close' : 'plus')} ${whsExAdd ? 'בטל' : 'הוסף חריג'}</button></div>
    <section class="whs-sec whs-sec-wide">
      ${whsExAdd ? `<div class="whs-exform-box">
        <div class="whs-exform-title">${ic(whsExEditIdx != null ? 'settings' : 'plus')} ${whsExEditIdx != null ? 'עריכת חריג' : 'חריג חדש'}</div>
        <div class="whs-exform2">
          <label class="exf"><span>תאריך</span><input class="cc-inp" id="whsExDate" value="${esc(d.date)}" placeholder="05/06/24"></label>
          <label class="exf"><span>תיאור</span><input class="cc-inp" id="whsExLabel" value="${esc(d.label)}" placeholder="למשל: ערב חג שבועות"></label>
          <label class="exf"><span>סוג</span><select class="cc-inp" id="whsExType">${['יום מקוצר', 'סגור', 'שעות מיוחדות'].map(tp => `<option ${d.type === tp ? 'selected' : ''}>${tp}</option>`).join('')}</select></label>
        </div>
        <p class="whs-ex-desc">${ic('alert')} ${EX_TYPE_DESC[d.type]}</p>
        ${!isClosed ? `<div class="whs-exhours">
          <span class="exh-lbl">${ic('clock')} שעות העבודה ביום זה:</span>
          <input type="time" id="whsExFrom" value="${d.from}"> <span class="wh-seg-dash">–</span> <input type="time" id="whsExTo" value="${d.to}">
        </div>` : ''}
        <label class="exf full"><span>הסבר / הערה</span><input class="cc-inp" id="whsExNote" value="${esc(d.note)}" placeholder="פירוט השינוי ביום זה — יוצג לצוות (אופציונלי)"></label>
        <div class="whs-exform-foot">
          <button class="btn sm primary" id="whsExSave">${ic('check')} שמור חריג</button>
          <button class="btn sm" id="whsExCancel">ביטול</button>
        </div>
      </div>` : ''}
      <div class="whs-exlist">
        ${EXCEPTIONS.length ? EXCEPTIONS.map((x, i) => `<div class="whs-exrow">
          <div class="whs-exinfo"><span><b>${x.date}</b> · ${x.label}
            ${x.type !== 'סגור' && x.from ? `<span class="ex-hours">${ic('clock')} ${x.from}–${x.to}</span>` : ''}</span>
            ${x.note ? `<small class="ex-note">${esc(x.note)}</small>` : ''}</div>
          <span class="whs-exright"><span class="badge amber">${x.type}</span>
            <button class="whs-edit" data-whs-exedit="${i}" title="עריכה">${ic('settings')}</button>
            <button class="whs-del" data-whs-exdel="${i}" title="הסר">${ic('close')}</button></span></div>`).join('')
          : '<div class="muted" style="padding:8px">אין חריגים מוגדרים. לחץ "הוסף חריג".</div>'}
      </div>
    </section>`;
}
function whsBindHolidays() {
  const g = id => document.getElementById(id);
  const syncDraft = () => { ['Date', 'Label', 'Type', 'From', 'To', 'Note'].forEach(f => { const el = g('whsEx' + f); if (el) whsExDraft[f.toLowerCase()] = el.value; }); };
  const ab = g('whsExAddBtn'); if (ab) ab.addEventListener('click', () => { whsExAdd = !whsExAdd; whsExEditIdx = null; if (whsExAdd) whsExDraft = { date: '', label: '', type: 'יום מקוצר', from: '08:00', to: '13:00', note: '' }; whsRenderPanel(); });
  const ty = g('whsExType'); if (ty) ty.addEventListener('change', () => { syncDraft(); whsRenderPanel(); });
  const sv = g('whsExSave'); if (sv) sv.addEventListener('click', () => {
    syncDraft(); const d = whsExDraft;
    if (!d.date || !d.label) { toast('נא למלא תאריך ותיאור'); return; }
    const ex = { date: d.date, label: d.label, type: d.type, note: d.note };
    if (d.type !== 'סגור') { ex.from = d.from; ex.to = d.to; }
    if (whsExEditIdx != null) { EXCEPTIONS[whsExEditIdx] = ex; toast('החריג עודכן ✓'); }
    else { EXCEPTIONS.push(ex); toast('החריג נוסף ✓'); }
    whsExAdd = false; whsExEditIdx = null; whsRenderPanel();
  });
  const cn = g('whsExCancel'); if (cn) cn.addEventListener('click', () => { whsExAdd = false; whsExEditIdx = null; whsRenderPanel(); });
  $$('[data-whs-exedit]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.whsExedit, x = EXCEPTIONS[i]; if (!x) return;
    whsExEditIdx = i; whsExAdd = true;
    whsExDraft = { date: x.date || '', label: x.label || '', type: x.type || 'יום מקוצר', from: x.from || '08:00', to: x.to || '13:00', note: x.note || '' };
    whsRenderPanel();
  }));
  $$('[data-whs-exdel]').forEach(b => b.addEventListener('click', () => { EXCEPTIONS.splice(+b.dataset.whsExdel, 1); whsRenderPanel(); toast('החריג הוסר'); }));
}

/* ============================================================
   פאנל: הגדרות נוספות (חלונות פולו-אפ + מועד חזרה + ניתוב/עדיפות + תבנית וואטסאפ)
   ============================================================ */
function whsPanelMore() {
  return `
    <h3 class="whs-ph">${ic('docs')} הגדרות נוספות</h3>
    <div class="whs-secgrid">
      <section class="whs-sec">
        <h4>${ic('phone')} חלונות פולו-אפ</h4>
        ${FOLLOWUP_WINDOWS.map((w, i) => `<div class="whs-row"><span>${w.range}</span>
          <span class="whs-fuwin"><input class="num-in sm" type="number" min="0" value="${w.capacity}" data-fuwin="${i}"><small class="muted">קיבולת · ${w.booked} תפוסים</small></span></div>`).join('')}
      </section>
      <section class="whs-sec">
        <h4>${ic('clock')} זמן פולו-אפ · מועד חזרה</h4>
        ${FU_POLICY_OPTIONS.map(o => `<label class="na-radio"><input type="checkbox" name="fupol" value="${o.key}" ${(FOLLOWUP_POLICY.modes || [FOLLOWUP_POLICY.mode]).includes(o.key) ? 'checked' : ''}> ${o.label}</label>`).join('')}
      </section>
      <section class="whs-sec whs-sec-wide">
        <h4>${ic('target')} כללי ניתוב ועדיפות</h4>
        <div class="chips-title">ניתוב לפי: <small class="muted">(✕ מסיר · "הוסף" מוסיף קריטריון)</small></div>
        <div class="chips-wrap">${ROUTING_RULES.map((r, i) => `<span class="pill editable">${r}<button class="pill-x" data-rr-del="${i}" title="הסר">${ic('close')}</button></span>`).join('')}
          <button class="pill-add" data-rr-add>${ic('plus')} הוסף</button></div>
        <div class="chips-title" style="margin-top:12px">ניקוד עדיפות לפי:</div>
        <div class="chips-wrap">${PRIORITY_RULES.map((r, i) => `<span class="pill editable">${r}<button class="pill-x" data-pr-del="${i}" title="הסר">${ic('close')}</button></span>`).join('')}
          <button class="pill-add" data-pr-add>${ic('plus')} הוסף</button></div>
      </section>
      <section class="whs-sec whs-sec-wide">
        <h4>${ic('whatsapp')} תבנית אישור הגעה · וואטסאפ</h4>
        <textarea id="waTplArrival" rows="3" class="cc-inp">${WA_TEMPLATES.arrival}</textarea>
        <p class="hint" style="margin:6px 0 8px">${ic('alert')} משתנים: {שם} · {נושא} · {מועד} — מוחלפים אוטומטית.</p>
        <button class="btn sm primary" data-tpl-save>${ic('check')} שמור תבנית</button>
      </section>
    </div>`;
}
function whsBindMore() {
  $$('[data-fuwin]').forEach(inp => inp.addEventListener('change', () => { FOLLOWUP_WINDOWS[+inp.dataset.fuwin].capacity = Math.max(0, +inp.value || 0); toast('קיבולת החלון עודכנה'); }));
  $$('input[name="fupol"]').forEach(cb => cb.addEventListener('change', () => {
    const modes = [...document.querySelectorAll('input[name="fupol"]:checked')].map(x => x.value);
    FOLLOWUP_POLICY.modes = modes; FOLLOWUP_POLICY.mode = modes[0] || 'same_day';
    toast(`מועד חזרה · ${modes.length} אפשרויות נבחרו`);
  }));
  $$('[data-rr-del]').forEach(b => b.addEventListener('click', () => { ROUTING_RULES.splice(+b.dataset.rrDel, 1); whsRenderPanel(); }));
  $$('[data-pr-del]').forEach(b => b.addEventListener('click', () => { PRIORITY_RULES.splice(+b.dataset.prDel, 1); whsRenderPanel(); }));
  const ra = $('[data-rr-add]'); if (ra) ra.addEventListener('click', () => whsInputPop('הוסף קריטריון ניתוב', 'למשל: זמינות נציג', v => { ROUTING_RULES.push(v); whsRenderPanel(); toast('קריטריון נוסף'); }));
  const pa = $('[data-pr-add]'); if (pa) pa.addEventListener('click', () => whsInputPop('הוסף קריטריון עדיפות', 'למשל: לקוח חוזר', v => { PRIORITY_RULES.push(v); whsRenderPanel(); toast('קריטריון נוסף'); }));
  $$('[data-tpl-save]').forEach(b => b.addEventListener('click', () => { const v = ($('#waTplArrival').value || '').trim(); if (!v) { toast('התבנית לא יכולה להיות ריקה'); return; } WA_TEMPLATES.arrival = v; toast('התבנית נשמרה ✓'); }));
}
