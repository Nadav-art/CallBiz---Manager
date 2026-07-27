/* ============================================================
   הרחבה: סדר הבירור — מוצר וקריטריונים  ·  key = 'flow'
   ------------------------------------------------------------
   יש שני מסלולים שונים לגמרי, ועד היום המערכת התייחסה אליהם אותו דבר:

     • הלקוח יודע מה הוא רוצה  →  מוצר ← קריטריונים ← תיאום
       אחרי בחירת המוצר בודקים התאמה. אם אין התאמה:
         – הבעיה בקריטריונים → חוסמים מעבר לתיאום עד עדכון,
           ומסבירים בדיוק למה לפי נתוני הסניף.
         – הבעיה במוצר → מחזירים לראות שהלקוח לא עומד בקריטריוני
           המוצר, ומציגים אילו מוצרים *מקבילים* כן פתוחים לו.

     • הלקוח לא יודע  →  קריטריונים ← מוצר ← תיאום
       לא מציגים מוצר לפני שיודעים מה בכלל אפשר לספק.

   בשני המסלולים אפשר לנוע קדימה ואחורה בין השלבים — גם ממסך
   התיאום חזרה לשירותים או לקריטריונים.
   ============================================================ */
(function () {

  const MODES = [
    { key: 'known', label: 'הלקוח יודע מה הוא רוצה', icon: 'target',
      desc: 'בוחרים מוצר, ואז בודקים התאמה' },
    { key: 'unknown', label: 'הלקוח לא יודע', icon: 'search',
      desc: 'מבררים קודם, ואז מציגים רק מה שמתאים' },
  ];
  const modeOf = r => r && r.flowMode ? r.flowMode : (r && (r.services || []).length ? 'known' : '');
  function setMode(r, m) { r.flowMode = m; }

  /* סדר השלבים לפי המסלול */
  const S_CRIT = { key: 'crit', label: 'קריטריונים', icon: 'settings' };
  const S_SVC = { key: 'svc', label: 'שירות / מוצר', icon: 'layers' };
  const S_CAL = { key: 'cal', label: 'תיאום', icon: 'calendar' };
  const stepsOf = r => modeOf(r) === 'unknown' ? [S_CRIT, S_SVC, S_CAL] : [S_SVC, S_CRIT, S_CAL];

  /* ---------------- בדיקת ההתאמה ---------------- */
  const reqMissing = r => (typeof needsMissingRequired === 'function') ? needsMissingRequired(r) : [];
  function svcBlocked(r, key) {
    if (typeof fitBlockReason === 'function') { const w = fitBlockReason(r, key); if (w) return w; }
    if (window.TERR && CBX.isOn('terr')) {
      const svc = (window.TERR.svc() || {})[key];
      if (svc && svc.field) {
        const z = window.TERR.zoneOf(r);
        if (z && (svc.zones || []).length && svc.zones.indexOf(z) < 0)
          return 'לא ניתן באזור ' + ((window.TERR.zones().find(x => x.key === z) || {}).label || '');
      }
    }
    return null;
  }
  /* האם יש מטפל שיכול לבצע — וגם זמין לפי הקריטריונים */
  function staffFor(r, key) {
    const all = (typeof STAFF !== 'undefined') ? STAFF : [];
    const able = all.filter(s => (s.skills || []).indexOf(key) >= 0);
    if (!able.length) return { ok: false, why: 'אין מטפל שמוסמך לשירות הזה', who: [] };
    const g = (r.needs || {}).gender;
    let who = able;
    if (g === 'm' || g === 'זכר' || g === 'גבר') who = able.filter(s => s.gender === 'm');
    else if (g === 'f' || g === 'נקבה' || g === 'אישה') who = able.filter(s => s.gender === 'f');
    if (!who.length) return { ok: false, why: 'אין מטפל בהעדפת המגדר שנבחרה', who: able };
    return { ok: true, why: '', who };
  }

  /* ---------------- חלופה *מקבילה* בלבד ----------------
     לא מציעים ניתוח למי שביקש זריקה. חלופה נחשבת מקבילה רק אם:
       · הוגדרה במפורש בקטלוג (altKeys), או
       · אותו סוג פריט (kind) — וגם חופפת בקריטריונים או בסדר גודל
     כל חלופה מוצגת עם הסיבה שבגללה היא מקבילה. */
  function relatedTo(base, t) {
    if (!base || !t) return null;
    if ((base.altKeys || []).indexOf(t.key) >= 0) return 'הוגדר בקטלוג כחלופה';
    if ((base.kind || '') !== (t.kind || '')) return null;
    const a = base.critKeys || [], b = t.critKeys || [];
    const shared = a.filter(k => b.indexOf(k) >= 0);
    if (shared.length) return 'אותו סוג · אותם קריטריוני התאמה';
    const da = +base.dur || 0, db = +t.dur || 0;
    if (da && db && Math.abs(da - db) <= Math.max(da, db) * 0.5) return 'אותו סוג · היקף דומה';
    if (!a.length && !b.length) return 'אותו סוג פריט';
    return null;
  }
  function alternatives(r, blockedKey) {
    const cat = (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : [];
    const base = cat.find(t => t.key === blockedKey);
    return cat.map(t => {
      if (t.key === blockedKey) return null;
      const rel = relatedTo(base, t); if (!rel) return null;
      if (svcBlocked(r, t.key) || !staffFor(r, t.key).ok) return null;
      return { t, why: rel };
    }).filter(Boolean).slice(0, 4);
  }

  /* ---------------- האם באמת יש מועדים ----------------
     המטרה: לא להעביר למסך תיאום ריק. הבדיקה רצה מול היומן האמיתי
     ומסווגת את החסם — מוצר או קריטריון. */
  function readiness(r) {
    const svcs = (r.services || []).filter(Boolean);
    const miss = reqMissing(r);
    /* חסם ברמת המוצר קודם — הוא מסביר את עצמו טוב יותר */
    const bad = svcs.map(k => {
      const st = staffFor(r, k);
      return { k, why: svcBlocked(r, k) || (st.ok ? null : st.why) };
    }).filter(x => x.why);
    if (bad.length) return { ok: false, blame: 'product', bad, miss, slots: 0 };
    if (miss.length) return { ok: false, blame: 'crit', bad: [], miss, slots: 0, reasons: [] };
    if (!window.CRITFX || !svcs.length) return { ok: true, blame: '', bad: [], miss, slots: -1 };

    const pool = window.CRITFX.candidates(r);
    if (!pool) return { ok: true, blame: '', bad: [], miss, slots: -1 };
    const needs = Object.assign({}, r.needs || {}); delete needs.note;
    const n = window.CRITFX.countFor(r, pool, needs);
    if (n) return { ok: true, blame: '', bad: [], miss, slots: n };

    /* אין מועדים — מי אשם? קריטריון שאם משחררים אותו נפתחים מועדים */
    const keys = Object.keys(needs).filter(k => needs[k] && k !== 'nearBranch');
    const rel = keys.filter(k => { const alt = Object.assign({}, needs); delete alt[k]; return window.CRITFX.countFor(r, pool, alt); });
    if (rel.length) return { ok: false, blame: 'crit', bad: [], miss, slots: 0, reasons: rel.map(k => critWhy(r, k, needs[k])) , relKeys: rel };
    /* אף שחרור לא עוזר — הבעיה בשילוב המוצר עם הסניפים */
    return { ok: false, blame: 'product', bad: svcs.map(k => ({ k, why: 'אין מועד פנוי לשירות הזה בסניפים שעומדים בקריטריונים' })), miss, slots: 0 };
  }
  /* ההסבר מבוסס על נתוני הסניף — לא ניסוח כללי */
  function critWhy(r, key, val) {
    const L = { branch: 'סניף מועדף', timeOfDay: 'העדפת זמן ביום', gender: 'העדפת מגדר מטפל/ת' };
    const label = L[key] || ((typeof needsDefOf === 'function' && needsDefOf(key)) ? needsDefOf(key).label : key);
    let det = '';
    if (key === 'branch' && typeof branchBlockReason === 'function') {
      const w = branchBlockReason(r, val); if (w) det = w;
      else { const b = (typeof cBranch === 'function') && cBranch(val);
        if (b) det = `בסניף ${b.short || b.label} אין מועד פנוי בשאר הקריטריונים שנבחרו`; }
    } else if (key === 'timeOfDay') {
      const T = { morning: 'בוקר', noon: 'צהריים', evening: 'אחה״צ' };
      det = `אין מועד פנוי ב${T[val] || val} בסניפים ובמטפלים שמתאימים`;
    } else if (key === 'gender') {
      det = `אין ${val === 'm' ? 'מטפל גבר' : 'מטפלת'} עם מועד פנוי בשאר הקריטריונים`;
    } else det = 'אין מועד פנוי עם הערך שנבחר';
    return { key, label, det };
  }

  /* ---------------- רצועת השלבים ---------------- */
  function stripHTML(r, cur) {
    const st = stepsOf(r); if (!modeOf(r)) return '';
    const done = { crit: !reqMissing(r).length && Object.keys(r.needs || {}).some(k => r.needs[k] && k !== 'note'),
      svc: !!(r.services || []).length, cal: !!r.meeting };
    return `<div class="fl-strip">${st.map((s, i) => {
      const cls = s.key === cur ? 'now' : (done[s.key] ? 'done' : 'todo');
      return `<button class="fl-st ${cls}" data-flgo="${s.key}"><span class="fl-si">${done[s.key] && s.key !== cur ? ic('check') : ic(s.icon)}</span>
        <b>${s.label}</b><small>שלב ${i + 1}</small></button>`;
    }).join('<span class="fl-arr">' + ic('chevronL') + '</span>')}</div>`;
  }
  function bindStrip(host, r, after) {
    $$('[data-flgo]', host).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.flgo;
      if (k === 'crit') { const before = snapshot(r);
        if (typeof closeModal === 'function' && document.querySelector('#modal .svc-sel')) { /* נשאר פתוח */ }
        openNeedsClarify(r, () => { if (typeof after === 'function') after(); checkAfterCritChange(r, before); }); }
      else if (k === 'svc') { if (typeof openServiceSelect === 'function') openServiceSelect(r); }
      else if (k === 'cal') {
        const rd = readiness(r);
        if (!rd.ok) { toast(rd.blame === 'product' ? 'המוצר שנבחר אינו מתאים — יש לבחור חלופה' : 'צריך לעדכן קריטריונים — אין מועד מתאים'); return; }
        if (typeof closeModal === 'function') closeModal();
        if (typeof openProposedTimes === 'function') openProposedTimes(r);
      }
    }));
  }

  /* ---------------- החלק שמוזרק למסך בחירת השירות ---------------- */
  function gateHTML(r) {
    const mode = modeOf(r), miss = reqMissing(r);
    const sel = (typeof svcSelState !== 'undefined' && svcSelState) ? svcSelState.sel : (r.services || []);
    const rd = sel.length ? readiness(Object.assign({}, r, { services: sel })) : null;
    return `<div class="fl-gate">
      <div class="fl-mode-h">${ic('bolt')} <b>מה הלקוח יודע?</b>
        <small>זה קובע את סדר הבירור — ולכן גם מה מוצג לו.</small></div>
      <div class="fl-modes">${MODES.map(m => `<button class="fl-mode ${mode === m.key ? 'on' : ''}" data-flmode="${m.key}">
        ${ic(m.icon)}<b>${m.label}</b><small>${m.desc}</small></button>`).join('')}</div>
      ${stripHTML(r, 'svc')}

      ${mode === 'unknown' && miss.length ? `<div class="fl-step now">
        <span class="fl-n">1</span>
        <div><b>קודם מבררים</b>
          <small>עוד לא נענו: ${esc(miss.join(' · '))}. עד שלא נדע, כל מוצר שנציע עלול להיות לא רלוונטי.</small></div>
        <button class="btn sm primary" data-flcrit="1">${ic('settings')} לשאלות</button>
      </div>` : ''}

      ${sel.length ? (function () {
        const rows = sel.map(k => {
          const t = (typeof cTreat === 'function') ? cTreat(k) : null;
          const b = svcBlocked(r, k), st = staffFor(r, k);
          return { k, label: t ? t.label : k, block: b, staff: st };
        });
        const bad = rows.filter(x => x.block || !x.staff.ok);
        const prodBad = rd && !rd.ok && rd.blame === 'product';
        const critBad = rd && !rd.ok && rd.blame === 'crit' && (rd.reasons || []).length;
        return `<div class="fl-step ${bad.length || !rd || !rd.ok ? 'bad' : 'ok'}">
          <span class="fl-n">${(bad.length || (rd && !rd.ok)) ? ic('alert') : ic('check')}</span>
          <div><b>${bad.length ? 'הלקוח אינו עומד בקריטריונים של המוצר'
            : (rd && !rd.ok ? (rd.blame === 'crit' ? 'המוצר מתאים — אבל אין מועד בקריטריונים שנבחרו' : 'אין מועד פנוי למוצר הזה')
            : (rd && rd.slots > 0 ? 'המוצר מתאים ויש מועדים פנויים' : 'המוצר מתאים — אפשר להמשיך'))}</b>
            <div class="fl-rows">${rows.map(x => `<div class="fl-row ${x.block || !x.staff.ok ? 'bad' : 'ok'}">
              <span>${esc(x.label)}</span>
              <small>${x.block ? esc(x.block) : (x.staff.ok
                ? (x.staff.who.length === 1 ? 'מטפל אחד מתאים · ' + esc(x.staff.who[0].name)
                   : x.staff.who.length + ' מטפלים מתאימים')
                : esc(x.staff.why))}</small></div>`).join('')}</div>

            ${critBad ? `<div class="fl-critbad">${ic('lock')}
              <b>מה חוסם — לפי נתוני הסניף</b>
              <div class="fl-rows">${rd.reasons.map(x => `<div class="fl-row bad">
                <span>${esc(x.label)}</span><small>${esc(x.det)}</small></div>`).join('')}</div>
              <button class="btn sm primary" data-flcrit="1">${ic('settings')} לעדכון הקריטריונים</button>
            </div>` : ''}

            ${(bad.length || prodBad) ? (function () {
              const alt = alternatives(r, (bad[0] || rd.bad[0] || {}).k);
              return alt.length ? `<div class="fl-alt"><b>${ic('layers')} מוצרים מקבילים שכן פתוחים ללקוח:</b>
                ${alt.map(a => `<button class="fl-altc" data-flalt="${esc(a.t.key)}">
                  <b>${esc(a.t.label)}</b><small>${esc(a.why)}</small></button>`).join('')}</div>`
                : `<div class="fl-alt none">${ic('alert')} אין מוצר מקביל שעומד בקריטריונים.
                   מוצרים מסוגים אחרים לא מוצעים כאן — הם לא בהכרח מענה לאותו צורך.</div>`; })() : ''}
          </div>
        </div>`; })() : ''}

      ${miss.length ? `<div class="fl-block">${ic('lock')}
        <b>לא ניתן להמשיך לתיאום</b>
        <small>${miss.length === 1 ? 'קריטריון חובה שטרם נענה' : miss.length + ' קריטריוני חובה שטרם נענו'}:
          ${esc(miss.join(' · '))}</small>
        <button class="btn sm primary" data-flcrit="1">${ic('settings')} השלם עכשיו</button>
      </div>` : ''}
    </div>`;
  }

  /* ---------------- אזהרה על שינוי קריטריון ---------------- */
  function snapshot(r) {
    return JSON.stringify({ n: r.needs || {}, s: (r.services || []).slice().sort() });
  }
  function checkAfterCritChange(r, before) {
    if (!r || !(r.services || []).length) return;
    const broken = (r.services || []).map(k => ({ k, why: svcBlocked(r, k) || (staffFor(r, k).ok ? null : staffFor(r, k).why) }))
      .filter(x => x.why);
    if (!broken.length) return;
    const meeting = r.meeting;
    const old = document.getElementById('flWarn'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'flWarn';
    const alt = alternatives(r, broken[0].k);
    w.innerHTML = `<div class="cbc-box fl-warn">
      <div class="cbc-head"><span class="cbc-ic">${ic('alert')}</span><b>הקריטריון השתנה — הבחירה כבר לא מתאימה</b></div>
      <p class="fl-warn-l">אחרי העדכון, ${broken.length === 1 ? 'שירות אחד שנבחר' : broken.length + ' שירותים שנבחרו'}
        כבר לא עומדים בקריטריונים:</p>
      <div class="fl-rows">${broken.map(x => { const t = (typeof cTreat === 'function') ? cTreat(x.k) : null;
        return `<div class="fl-row bad"><span>${esc(t ? t.label : x.k)}</span><small>${esc(x.why)}</small></div>`; }).join('')}</div>
      ${alt.length ? `<div class="fl-alt"><b>${ic('layers')} מקבילים שכן פתוחים:</b>
        ${alt.map(a => `<button class="fl-altc" data-flwalt="${esc(a.t.key)}"><b>${esc(a.t.label)}</b><small>${esc(a.why)}</small></button>`).join('')}</div>` : ''}
      ${meeting ? `<div class="fl-warn-m">${ic('calendar')} <b>יש תור קבוע</b>
        <small>${esc(meeting.date)} ${esc(meeting.time)} — המשך יבטל אותו.</small></div>` : ''}
      <div class="cbc-actions">
        <button class="btn" id="flBack">${ic('chevronR')} חזרה לעדכן את הקריטריון</button>
        <button class="btn primary" id="flGo">${ic('check')} להמשיך${meeting ? ' ולבטל את התור' : ''}</button>
      </div></div>`;
    $('#flBack', w).addEventListener('click', () => {
      /* מחזירים את המצב הקודם — הנציג יעדכן מחדש */
      try { const prev = JSON.parse(before); r.needs = prev.n; } catch (e) {}
      w.remove();
      if (typeof openNeedsClarify === 'function') openNeedsClarify(r);
      else if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
    });
    $$('[data-flwalt]', w).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.flwalt;
      r.services = (r.services || []).filter(x => !broken.some(bb => bb.k === x));
      if (r.services.indexOf(k) < 0) r.services.push(k);
      w.remove(); toast('הוחלף למוצר מקביל שמתאים ללקוח');
      if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
    }));
    $('#flGo', w).addEventListener('click', () => {
      if (meeting) { r.meeting = null; r.next = { type: 'followup', at: '' };
        if (r.status) r.status = { label: 'התור בוטל — נדרש תיאום מחדש', color: 'orange' };
        toast('התור בוטל · נדרש תיאום מחדש'); }
      r.services = (r.services || []).filter(k => !broken.some(b => b.k === k));
      w.remove();
      if (typeof renderDrawerTab === 'function') renderDrawerTab(r);
      if (typeof renderList === 'function') renderList();
    });
    document.body.appendChild(w);
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'flow', label: 'סדר הבירור — מוצר וקריטריונים', icon: 'target',
    desc: 'שני מסלולים: לקוח שיודע עובר מוצר ← קריטריונים ← תיאום, ולקוח שלא יודע מברר קודם. מעבר לתיאום נחסם כשאין מועד אמיתי, עם הסבר מי חוסם — קריטריון או מוצר — והצעת מוצרים מקבילים בלבד.',
    files: ['js/ext/flow-order.js'],
    install() {
      if (typeof renderServiceSelect === 'function') CBX.wrap('flow', 'renderServiceSelect', o => function () {
        const r = o.apply(this, arguments);
        try {
          const rec = (typeof svcSelState !== 'undefined' && svcSelState) ? svcSelState.rec : null;
          const body = document.querySelector('#modal .svc-sel');
          if (!rec || !body || body.querySelector('.fl-gate')) return r;
          const d = document.createElement('div'); d.innerHTML = gateHTML(rec);
          body.insertBefore(d.firstElementChild, body.firstChild);

          /* לקוח שלא יודע — המוצרים ננעלים עד שהחובה נענתה */
          const mode = modeOf(rec), miss = reqMissing(rec);
          if (mode === 'unknown' && miss.length) body.classList.add('fl-locked');
          else body.classList.remove('fl-locked');

          /* מעבר לתיאום נחסם כשאין מועד אמיתי */
          const sel = svcSelState.sel;
          const rd = sel.length ? readiness(Object.assign({}, rec, { services: sel })) : null;
          const next = document.getElementById('svcNext');
          if (next) {
            if (miss.length) { next.disabled = true; next.title = 'חסר: ' + miss.join(' · '); }
            else if (rd && !rd.ok) { next.disabled = true;
              next.title = rd.blame === 'product' ? 'המוצר שנבחר אינו מתאים ללקוח' : 'אין מועד פנוי בקריטריונים שנבחרו'; }
          }

          const rr = () => renderServiceSelect();
          bindStrip(body, rec, rr);
          $$('[data-flmode]', body).forEach(b => b.addEventListener('click', () => { setMode(rec, b.dataset.flmode); rr(); }));
          $$('[data-flcrit]', body).forEach(b => b.addEventListener('click', () => {
            const before = snapshot(rec);
            if (typeof openNeedsClarify === 'function') openNeedsClarify(rec, () => { rr(); checkAfterCritChange(rec, before); });
            else toast('מסך הקריטריונים אינו זמין');
          }));
          $$('[data-flalt]', body).forEach(b => b.addEventListener('click', () => {
            const k = b.dataset.flalt;
            if (typeof svcSelState !== 'undefined' && svcSelState) {
              svcSelState.sel = svcSelState.sel.filter(x => !svcBlocked(rec, x) || x === k);
              if (svcSelState.sel.indexOf(k) < 0) svcSelState.sel.push(k);
            }
            rr(); toast('הוחלף למוצר מקביל שמתאים ללקוח');
          }));
        } catch (e) { console.error('[flow]', e); }
        return r;
      });

      /* רצועת השלבים + מצב ההתאמה גם בתוך בירור הצורך */
      if (typeof openNeedsClarify === 'function') CBX.wrap('flow', 'openNeedsClarify', o => function (rec, done) {
        const before = rec ? snapshot(rec) : '';
        const out = o.call(this, rec, function () {
          if (typeof done === 'function') done();
          if (rec) setTimeout(() => checkAfterCritChange(rec, before), 0);
        });
        try {
          const body = document.querySelector('#modal .needs-body');
          if (!body || !rec || body.querySelector('.fl-strip')) return out;
          const rd = readiness(rec);
          const d = document.createElement('div');
          d.innerHTML = stripHTML(rec, 'crit') + ((rec.services || []).length ? `<div class="fl-ready ${rd.ok ? 'ok' : 'bad'}">
            ${ic(rd.ok ? 'check' : 'alert')}
            <div><b>${rd.ok ? (rd.slots > 0 ? 'יש מועדים שמתאימים לצירוף הזה' : 'אין חסימה — אפשר להמשיך לתיאום')
              : (rd.blame === 'product' ? 'המוצר שנבחר אינו מתאים ללקוח' : 'אין מועד פנוי בצירוף הקריטריונים')}</b>
            <small>${rd.ok ? 'המשך יפתח את מסך התיאום עם מועדים אמיתיים.'
              : esc((rd.reasons || []).map(x => x.label + ' — ' + x.det).join(' · ') || (rd.bad || []).map(x => x.why).join(' · '))}</small></div>
            ${!rd.ok && rd.blame === 'product' ? `<button class="btn sm" id="flToSvc">${ic('layers')} לבחירת מוצר מקביל</button>` : ''}</div>` : '');
          while (d.firstChild) body.insertBefore(d.firstChild, body.firstChild);
          bindStrip(body, rec, () => openNeedsClarify(rec, done));
          const ts = document.getElementById('flToSvc');
          if (ts) ts.addEventListener('click', () => { if (typeof openServiceSelect === 'function') openServiceSelect(rec); });
        } catch (e) { console.error('[flow] needs', e); }
        return out;
      });

      /* ממסך התיאום — חזרה לשירותים או לקריטריונים */
      if (typeof renderCoordView === 'function') CBX.wrap('flow', 'renderCoordView', o => function () {
        const out = o.apply(this, arguments);
        try {
          const st = (typeof coordState !== 'undefined') ? coordState : null;
          const rec = st && st.caller; if (!rec) return out;
          const host = (typeof coordViewHost === 'function') ? coordViewHost() : document.getElementById('viewHost');
          if (!host || host.querySelector('.fl-cbar')) return out;
          const d = document.createElement('div');
          d.innerHTML = `<div class="fl-cbar">${ic('layers')}
            <b>${(rec.services || []).length ? (rec.services || []).length + ' שירותים נבחרו' : 'לא נבחר שירות'}</b>
            <button class="btn sm" id="flCSvc">${ic('layers')} עדכון שירותים</button>
            <button class="btn sm" id="flCCrit">${ic('settings')} חזרה לקריטריונים</button></div>`;
          host.insertBefore(d.firstElementChild, host.firstChild);
          const a = document.getElementById('flCSvc');
          if (a) a.addEventListener('click', () => { if (typeof openServiceSelect === 'function') openServiceSelect(rec); });
          const b = document.getElementById('flCCrit');
          if (b) b.addEventListener('click', () => {
            const before = snapshot(rec);
            openNeedsClarify(rec, () => { if (coordState) coordState.__critFor = null; renderCoordView(); checkAfterCritChange(rec, before); });
          });
        } catch (e) { console.error('[flow] coord', e); }
        return out;
      });
    },
  });

  window.FLOW = { mode: modeOf, blocked: svcBlocked, staffFor, alternatives, related: relatedTo,
    missing: reqMissing, check: checkAfterCritChange, readiness, steps: stepsOf };
})();
