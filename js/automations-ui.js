/* ============================================================
   מסך האוטומציות — מודול תצוגה נפרד (מעל automations.js)
   ------------------------------------------------------------
   מציג את החוקים לפי תחום, עם מתג אמיתי שנשמר, הסבר מה כל חוק
   עושה בפועל, "הרץ עכשיו" להדגמה, ויומן הרצות חי.
   ============================================================ */
const AUTO_AREAS = [
  { key: 'lead', label: 'ליד חדש וטיפול', icon: 'leads', keys: ['a1', 'a1b', 'a1c', 'a1d', 'a7', 'a8'] },
  { key: 'meeting', label: 'פגישות ותורים', icon: 'calendar', keys: ['a2', 'a3', 'a4', 'a5', 'a6'] },
  { key: 'hold', label: 'שיריון וסליקה', icon: 'lock', keys: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a9'] },
  { key: 'contract', label: 'הסכמים וחתימות', icon: 'docs', keys: ['h7', 'h8'] },
];
/* היכן החוק מופעל בפועל מתוך הקוד */
const AUTO_RECOMMENDED = ['a1c', 'a1b'];
const AUTO_HOOKS = {
  a1: 'רץ אוטומטית ביצירת ליד חדש', a1b: 'רץ אוטומטית ביצירת ליד חדש',
  a1c: 'רץ אוטומטית ביצירת ליד חדש', a1d: 'רץ אוטומטית ביצירת ליד חדש', a2: 'רץ אוטומטית בקביעת פגישה מהצעת הזמנים',
  a3: 'הרצה יזומה · בהשקה — תזמון שעה לפני הפגישה', a4: 'רץ אוטומטית בביטול פגישה',
  a5: 'הרצה יזומה — סימון אי-הגעה', a6: 'רץ בסגירת ליד',
  a7: 'רץ בקביעת פולו-אפ', h1: 'רץ אוטומטית בנעילת תור לסליקה',
  h2: 'רץ כשהנעילה יורדת מתחת ל-5 דקות', h3: 'רץ בשחרור נעילה',
  h4: 'רץ בשחרור נעילה', h5: 'רץ בהשלמת סליקה',
  h6: 'רץ בהשלמת סליקה', h7: 'הרצה יזומה · בהשקה — סריקה יומית של מרשם ההסכמים',
  h8: 'רץ בקליטת חתימה על הסכם',
  a8: 'רץ בסבב המועדים — סורק לידים שחרגו',
  a9: 'רץ בסבב המועדים — סורק זמינות בסניפים',
};
function autoAreaList(ar) {
  const all = autoAll();
  return all.filter(a => ar.keys.indexOf(a.key) >= 0);
}

function renderAutomationsScreen() {
  const all = autoAll();
  const onCount = all.filter(a => autoIsOn(a.key)).length;
  const flt = (typeof autoMatches === 'function') ? (l => l.filter(autoMatches)) : (l => l);
  const byPrio = l => (typeof autoMeta === 'function') ? l.slice().sort((a, b) => autoMeta(a.key).priority - autoMeta(b.key).priority) : l;
  const areas = AUTO_AREAS.map(ar => ({ ar: ar, list: byPrio(flt(autoAreaList(ar))) })).filter(x => x.list.length);
  if (AUTO_CUSTOM.length && flt(AUTO_CUSTOM).length) areas.push({ ar: { key: 'custom', label: 'אוטומציות שהוספת', icon: 'plus' }, list: byPrio(flt(AUTO_CUSTOM)) });
  $('#viewHost').innerHTML = `
    <div class="view-head"><div class="vh-title"><span class="num">${ic('bolt')}</span> אוטומציות
      <span class="muted" style="font-size:13px">· ${onCount} מתוך ${all.length} פעילות</span></div>
      <button class="btn sm primary" id="autoAdd">${ic('plus')} אוטומציה חדשה</button></div>

    <div class="auto-note ${onCount ? 'on' : ''}">${ic(onCount ? 'bolt' : 'alert')}
      <div><b>${onCount ? onCount + ' חוקים פעילים ורצים בפועל' : 'כל החוקים כבויים — שום דבר לא רץ'}</b>
        <small>הדליקו אוטומציה כדי שתתחיל לעבוד. אפשר להתאים אותה אישית — מתי להפעיל, מה לעשות אחר כך — או פשוט להשאיר כמו שהיא.</small></div>
      <div class="auto-note-acts">
        <button class="btn xs" id="autoTick" title="מריץ עכשיו את החוקים תלויי-הזמן על מה שבשל">${ic('sync')} סבב בדיקת מועדים</button>
        ${onCount ? `<button class="btn xs ghost" id="autoAllOff">${ic('close')} כבה הכל</button>` : ''}</div></div>

    ${typeof autoGlobalHTML === 'function' ? autoGlobalHTML() : ''}
    ${typeof autoToolbarHTML === 'function' ? autoToolbarHTML() : ''}
    <div class="auto-cols">
      <div class="auto-main">
        ${areas.map(x => `<section class="card auto-area">
          <div class="card-head"><div class="title">${ic(x.ar.icon)} ${x.ar.label}</div>
            <span class="chip gray sm">${x.list.filter(a => autoIsOn(a.key)).length}/${x.list.length} פעילות</span></div>
          <div class="auto-list">
            ${x.list.map(a => { const d = autoDef(a.key) || a; const on = autoIsOn(a.key);
              const custom = (typeof autoCondOf === 'function' && autoCondOf(a.key).length)
                || (typeof autoChainOf === 'function' && autoChainOf(a.key).length)
                || (typeof autoMeta === 'function' && autoMeta(a.key).limit !== 'none');
              return `<div class="auto-item ${on ? 'is-on' : ''}">
                <span class="auto-sw"><span class="toggle wh-toggle ${on ? 'on' : ''}" data-autotog="${esc(a.key)}" role="button" tabindex="0" title="${on ? 'פעיל — רץ לבד' : 'כבוי — לא ירוץ'}"><i></i></span>
                  <small class="auto-swl">${on ? 'פעיל' : 'כבוי'}</small></span>
                <div class="auto-body">
                  <div class="auto-top"><b>${esc(a.title)}</b><span class="auto-when">${esc(a.trigger)}</span>
                    ${(typeof AUTO_RECOMMENDED !== 'undefined' && AUTO_RECOMMENDED.indexOf(a.key) >= 0 && !on) ? '<span class="auto-rec">מומלץ</span>' : ''}</div>
                  <div class="auto-desc">${esc(d.what || a.desc || '')}</div>
                </div>
                <div class="auto-acts">
                  <button class="btn xs ${custom ? 'has-custom' : ''}" data-autoinfo="${esc(a.key)}">${ic('settings')} התאם אישית${custom ? '<i class="ac-dot"></i>' : ''}</button>
                </div>
              </div>`; }).join('')}
          </div>
        </section>`).join('')}
      </div>

      <aside class="auto-side">
        <section class="card">
          <div class="card-head"><div class="title">${ic('history')} יומן הרצות</div>
            ${AUTO_LOG.length ? `<button class="btn xs ghost" id="autoLogClear">נקה</button>` : ''}</div>
          <div class="auto-log">
            ${AUTO_LOG.length ? AUTO_LOG.map(l => `<div class="alog ${l.blocked ? 'blocked' : ''} ${l.dry ? 'dry' : ''}">
                <div class="alog-h"><b>${esc(l.title)}</b>${l.blocked ? `<span class="alog-by blk">נחסם</span>` : ''}${l.dry ? `<span class="alog-by dry">בדיקה</span>` : ''}<span class="alog-by ${l.by === 'הרצה ידנית' ? 'manual' : ''}">${esc(l.by)}</span></div>
                <div class="alog-w">${esc(l.what)}</div>
                <div class="alog-at">${ic('clock')} ${esc(l.at)}</div>
              </div>`).join('')
              : `<div class="auto-empty">${ic('history')}<p>עדיין לא רצה אף אוטומציה</p><small>הדלק חוק או לחץ "הרץ" כדי לראות בדיוק מה קורה</small></div>`}
          </div>
        </section>
      </aside>
    </div>`;
  bindAutomationsScreen();
}
function bindAutomationsScreen() {
  $$('[data-autotog]').forEach(t => t.addEventListener('click', () => {
    const k = t.dataset.autotog, on = !autoIsOn(k);
    autoSet(k, on);
    if (typeof autoPatchRow === 'function') autoPatchRow(k, on); else renderAutomationsScreen();
    toast((on ? 'הופעל' : 'כובה') + ': ' + ((autoDef(k) || {}).title || k));
  }));
  $$('[data-autorun]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.autorun;
    const ok = autoFire(k, { rec: autoDemoLead() }, true);
    if (typeof autoPatchLog === 'function') { autoPatchLog(); autoPatchRow(k, autoIsOn(k)); } else renderAutomationsScreen();
    toast(ok ? 'הורץ · ראה ביומן ההרצות' : 'החוק לא ביצע דבר בהקשר הנוכחי');
  }));
  $$('[data-autoinfo]').forEach(b => b.addEventListener('click', () => openAutoInfo(b.dataset.autoinfo)));
  const tk = $('#autoTick'); if (tk) tk.addEventListener('click', () => { const res = autoTick(true); renderAutomationsScreen();
    toast(res.length ? 'רצו ' + res.length + ' חוקים תלויי-זמן' : 'אין כרגע מה להריץ'); });
  const ao = $('#autoAllOff'); if (ao) ao.addEventListener('click', () => { autoAllOff(); renderAutomationsScreen(); toast('כל האוטומציות כובו'); });
  const lc = $('#autoLogClear'); if (lc) lc.addEventListener('click', () => { AUTO_LOG = []; autoSave(); renderAutomationsScreen(); });
  const ad = $('#autoAdd'); if (ad) ad.addEventListener('click', () => {
    if (typeof openAutoWizard === 'function') openAutoWizard(); else openAutoBuilder(); });
  $$('[data-autodup]').forEach(b => b.addEventListener('click', () => {
    const nk = (typeof autoDuplicate === 'function') ? autoDuplicate(b.dataset.autodup) : null;
    renderAutomationsScreen();
    if (!nk) { toast('שכפול נכשל'); return; }
    openAutoInfo._focusName = true; openAutoInfo(nk);          // נפתח מיד לעריכת השם
    toast('החוק שוכפל (כבוי) — עדכן את השם');
  }));
  if (typeof autoToolbarBind === 'function') autoToolbarBind(renderAutomationsScreen);
  if (typeof autoGlobalBind === 'function') autoGlobalBind(renderAutomationsScreen);
}

/* ---------------- חלון החוק ---------------- */
let aiSec = '';                       /* איזה מקטע פתוח: cond · chain · cfg · stats */
function aiSecHead(key, icon, title, summary, action) {
  const open = aiSec === key;
  return `<button class="ai-sec-h ${open ? 'open' : ''}" data-aisec="${key}">
    <span class="ai-sec-t">${ic(icon)} <b>${title}</b></span>
    <span class="ai-sec-s">${summary}</span>
    <span class="ai-sec-a">${action || ''}${ic(open ? 'chevron' : 'chevronL')}</span></button>`;
}
function openAutoInfo(key) {
  const d = autoDef(key); if (!d) return;
  const old = document.getElementById('autoInfoPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'autoInfoPanel'; document.body.appendChild(w);
  const close = () => { const e = document.getElementById('autoInfoPanel'); if (e) e.remove(); };
  const render = () => {
    const on = autoIsOn(key);
    const conds = (typeof autoCondOf === 'function') ? autoCondOf(key) : [];
    const cgroups = (typeof autoCondGroups === 'function') ? autoCondGroups(key) : [];
    const chain = (typeof autoChainOf === 'function') ? autoChainOf(key) : [];
    const m = (typeof autoMeta === 'function') ? autoMeta(key) : {};
    const st = (typeof autoStat === 'function') ? autoStat(key) : {};
    const cfgBits = [];
    if (m.priority !== 5) cfgBits.push('עדיפות ' + m.priority);
    if (m.limit && m.limit !== 'none') cfgBits.push(autoLimitLabel(m.limit));
    if (m.from || m.to) cfgBits.push('חלון תאריכים');
    if (m.hFrom !== 0 || m.hTo !== 24) cfgBits.push(m.hFrom + ':00–' + m.hTo + ':00');
    if (m.onFail) cfgBits.push('פעולה חלופית');
    w.innerHTML = `<div class="cbc-box ai-box" style="max-width:520px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('bolt')}</span>
        <b>${esc(d.title)}</b>
        <span class="ai-state ${on ? 'on' : ''}">${on ? 'פעיל' : 'כבוי'}</span></div>

      <div class="ai-trig">${ic('clock')} <b>מתי:</b> ${esc(d.trigger)} <small>${esc(AUTO_HOOKS[key] || 'חוק מותאם')}</small></div>
      <p class="ai-what2">${esc(d.what || d.desc || '')}</p>

      ${(d.custom && typeof autoCustomEditHTML === 'function') ? autoCustomEditHTML(key, d) : ''}

      <div class="ai-secs">
        ${aiSecHead('cond', 'filter', 'מתי להפעיל?',
          conds.length ? `<b>${cgroups.length > 1 ? 'אחד מ־' + cgroups.length + ' מצבים' : (conds.length === 1 ? 'רק בתנאי אחד' : 'רק כאשר מתקיימים ' + conds.length + ' תנאים יחד')}</b>` : 'תמיד — בכל פעם שהאירוע קורה',
          `<span class="ai-edit">${conds.length ? 'ערוך' : 'הוסף'}</span>`)}
        ${aiSec === 'cond' ? `<div class="ai-sec-b">${typeof autoCondPanelHTML === 'function' ? autoCondPanelHTML(key) : ''}</div>` : ''}

        ${aiSecHead('chain', 'layers', 'מה לעשות אחר כך?',
          chain.length ? `<b>${chain.length === 1 ? 'מפעיל עוד אוטומציה אחת' : 'מפעיל עוד ' + chain.length + ' אוטומציות'}</b>` : 'כלום — נעצר כאן',
          `<span class="ai-edit">${chain.length ? 'ערוך' : 'הוסף'}</span>`)}
        ${aiSec === 'chain' ? `<div class="ai-sec-b">${typeof autoChainPanelHTML === 'function' ? autoChainPanelHTML(key) : ''}</div>` : ''}

        ${aiSecHead('cfg', 'settings', 'אפשרויות נוספות',
          cfgBits.length ? esc(cfgBits.join(' · ')) : 'ברירת מחדל — מומלץ להשאיר', '')}
        ${aiSec === 'cfg' ? `<div class="ai-sec-b">
          ${(d.cfg && typeof window[d.cfg] === 'function') ? window[d.cfg]() : ''}
          ${typeof autoProCfgHTML === 'function' ? autoProCfgHTML(key) : ''}</div>` : ''}

        ${aiSecHead('stats', 'reports', 'הרצות קודמות',
          st.runs ? `רץ ${st.runs === 1 ? 'פעם אחת' : st.runs + ' פעמים'} · אחרונה ${esc(st.last || '—')}` : 'עדיין לא רץ', '')}
        ${aiSec === 'stats' ? `<div class="ai-sec-b">${typeof autoStatsHTML === 'function' ? autoStatsHTML(key) : ''}</div>` : ''}
      </div>

      <div class="cbc-actions ai-foot">
        ${d.custom ? `<button class="ai-link danger" id="aiDel">מחק</button>` : ''}
        <button class="ai-link" id="aiDup2">${ic('copy')} שכפל</button>
        <button class="ai-link" id="aiRun">${ic('sync')} נסה עכשיו</button>
        <button class="btn primary" id="aiTog">${on ? ic('close') + ' כבה חוק' : ic('check') + ' הפעל חוק'}</button>
      </div></div>`;
    $$('[data-aisec]', w).forEach(b => b.addEventListener('click', () => {
      aiSec = (aiSec === b.dataset.aisec) ? '' : b.dataset.aisec; render(); }));
    $('#aiRun').addEventListener('click', () => { autoFire(key, { rec: autoDemoLead() }, true);
      if (typeof autoPatchLog === 'function') { autoPatchLog(); autoPatchRow(key, autoIsOn(key)); }
      render(); toast('הורץ · ראה ביומן ההרצות'); });
    $('#aiTog').addEventListener('click', () => { autoSet(key, !autoIsOn(key));
      if (typeof autoPatchRow === 'function') autoPatchRow(key, autoIsOn(key)); render(); });
    const dup2 = $('#aiDup2'); if (dup2) dup2.addEventListener('click', () => {
      const nk = (typeof autoDuplicate === 'function') ? autoDuplicate(key) : null;
      close(); if (typeof renderAutomationsScreen === 'function') renderAutomationsScreen();
      if (nk) { openAutoInfo._focusName = true; openAutoInfo(nk); aiSec = ''; }
      toast(nk ? 'שוכפל — עדכן את השם' : 'שכפול נכשל'); });
    const del = $('#aiDel'); if (del) del.addEventListener('click', () => { autoDelCustom(key); close();
      if (typeof renderAutomationsScreen === 'function') renderAutomationsScreen(); toast('החוק נמחק'); });
    if (typeof autoCustomEditBind === 'function') autoCustomEditBind(key, render);
    if (aiSec === 'cond' && typeof autoCondBind === 'function') autoCondBind(key, render);
    if (aiSec === 'chain' && typeof autoChainBind === 'function') autoChainBind(key, render);
    if (aiSec === 'cfg') {
      if (d.cfgBind && typeof window[d.cfgBind] === 'function') window[d.cfgBind](render);
      if (typeof autoProCfgBind === 'function') autoProCfgBind(key, render);
    }
    if (openAutoInfo._focusName) { openAutoInfo._focusName = false;
      const n = $('#aeTitle'); if (n) { n.focus(); n.select(); } }
  };
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  render();
  requestAnimationFrame(() => w.classList.add('open'));
}

/* בונה אוטומציה חדשה */
function openAutoBuilder() {
  const old = document.getElementById('autoBuildPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'autoBuildPanel'; document.body.appendChild(w);
  const close = () => w.remove();
  w.innerHTML = `<div class="cbc-box" style="max-width:520px;text-align:start">
    <div class="cbc-head"><span class="cbc-ic">${ic('plus')}</span><b>אוטומציה חדשה</b></div>
    <label class="exf"><span>שם החוק</span><input class="cc-inp" id="abTitle" placeholder="למשל: התראה למנהל על ליד VIP"></label>
    <label class="exf"><span>מתי לרוץ (טריגר)</span><select class="cc-inp" id="abTrig">${AUTO_TRIGGERS.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
    <label class="exf"><span>מה לעשות (פעולה)</span><select class="cc-inp" id="abAct">${AUTO_ACTIONS.map(a => `<option value="${a.key}">${esc(a.label)}</option>`).join('')}</select></label>
    <label class="exf"><span>פרמטר (טקסט / מועד — לפי הפעולה)</span><input class="cc-inp" id="abParam" placeholder="למשל: מחר 09:00 · או נוסח ההתראה"></label>
    <p class="cr-hint">${ic('alert')} החוק ייווצר <b>כבוי</b>. הדלק אותו כשתרצה שירוץ, או לחץ "הרץ" כדי לבדוק אותו.</p>
    <div class="cbc-actions"><button class="btn ghost" id="abCancel">ביטול</button>
      <button class="btn primary" id="abSave">${ic('check')} צור אוטומציה</button></div></div>`;
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $('#abCancel').addEventListener('click', close);
  $('#abSave').addEventListener('click', () => {
    const t = ($('#abTitle') || {}).value || '';
    if (!t.trim()) { toast('נא לתת שם לחוק'); return; }
    autoAddCustom(($('#abTrig') || {}).value, t.trim(), ($('#abAct') || {}).value, ($('#abParam') || {}).value);
    close(); renderAutomationsScreen(); toast('האוטומציה נוצרה (כבויה) · הדלק אותה כדי שתרוץ');
  });
  requestAnimationFrame(() => w.classList.add('open'));
}
