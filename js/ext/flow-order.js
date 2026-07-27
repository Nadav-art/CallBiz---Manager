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

  /* "לא יודע" הוא נקודת הפתיחה — רוב הפניות מגיעות בלי החלטה,
     ולכן הוא ראשון ברשימה וגם ברירת המחדל. */
  const MODES = [
    { key: 'unknown', label: 'הלקוח לא יודע מה הוא רוצה', icon: 'search',
      desc: 'מבררים קודם, ואז מציגים רק מה שמתאים' },
    { key: 'known', label: 'הלקוח יודע מה הוא רוצה', icon: 'target',
      desc: 'בוחרים מוצר, ואז בודקים התאמה' },
  ];
  const modeOf = r => r && r.flowMode ? r.flowMode : (r && (r.services || []).length ? 'known' : 'unknown');
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

  /* ---------------- רצועת השלבים ----------------
     החלפת מסלול משנה את סדר השלבים — ולכן הרצועה מונפשת (FLIP)
     והמיקוד חוזר לשלב 1 החדש. */
  let jumpTo1 = false;

  /* שני המסכים הם אותו מהלך — ולכן אותו חלון בדיוק: אותו רוחב (הרחב
     מבין השניים) ואותו גובה, כדי שהמעבר בין שלב לשלב לא "יקפיץ"
     את הפופ-אפ למקום אחר על המסך. */
  function sizeModal() {
    const m = document.getElementById('modal'); if (!m) return;
    m.classList.add('fl-modal');
    m.style.maxWidth = '600px';
    m.style.width = '100%';
    m.style.height = 'min(78vh, 720px)';
  }
  function unsizeModal() {
    const m = document.getElementById('modal'); if (!m) return;
    m.classList.remove('fl-modal');
    m.style.height = ''; m.style.width = '';
  }
  function stripRects(host) {
    const m = {};
    (host ? host.querySelectorAll('[data-flgo]') : []).forEach(el => { m[el.dataset.flgo] = el.getBoundingClientRect().left; });
    return m;
  }
  function flipStrip(host, before) {
    if (!host) return;
    host.querySelectorAll('[data-flgo]').forEach(el => {
      const b = before[el.dataset.flgo]; if (b === undefined) return;
      const dx = b - el.getBoundingClientRect().left;
      if (Math.abs(dx) < 2) return;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
      const go = () => { el.style.transition = 'transform .34s cubic-bezier(.2,.9,.3,1)'; el.style.transform = ''; };
      requestAnimationFrame(go); setTimeout(go, 16);
    });
  }
  /* כותרת אחת לשני המסכים — בחירת המסלול + רצועת השלבים.
     כשעוברים לקריטריונים החלק העליון נשאר, ולא "נעלם" באמצע. */
  function headerHTML(r, cur) {
    const mode = modeOf(r);
    return `<div class="fl-gate">
      <div class="fl-mode-h">${ic('bolt')} <b>מה הלקוח יודע?</b>
        <small>זה קובע את סדר הבירור — ולכן גם מה מוצג לו.</small></div>
      <div class="fl-modes">${MODES.map(m => `<button class="fl-mode ${mode === m.key ? 'on' : ''}" data-flmode="${m.key}">
        ${ic(m.icon)}<b>${m.label}</b><small>${m.desc}</small></button>`).join('')}</div>
      ${stripHTML(r, cur)}
    </div>`;
  }
  function stripHTML(r, cur) {
    if (jumpTo1) { const s = stepsOf(r)[0]; if (s) cur = s.key; }
    const st = stepsOf(r); if (!modeOf(r)) return '';
    const done = { crit: !reqMissing(r).length && Object.keys(r.needs || {}).some(k => r.needs[k] && k !== 'note'),
      svc: !!(r.services || []).length, cal: !!r.meeting };
    return `<div class="fl-strip">${st.map((s, i) => {
      const cls = s.key === cur ? 'now' : (done[s.key] ? 'done' : 'todo');
      return `<button class="fl-st ${cls}" data-flgo="${s.key}"><span class="fl-si">${done[s.key] && s.key !== cur ? ic('check') : ic(s.icon)}</span>
        <b>${s.label}</b><small>שלב ${i + 1}</small></button>`;
    }).join('<span class="fl-arr">' + ic('chevronL') + '</span>')}</div>`;
  }
  /* החלפת מסלול — אנימציה, ואז מעבר לשלב 1 החדש */
  function bindModes(host, r, cur, rerender) {
    $$('[data-flmode]', host).forEach(b => b.addEventListener('click', () => {
      if (modeOf(r) === b.dataset.flmode) return;
      const before = stripRects(host);
      setMode(r, b.dataset.flmode);
      jumpTo1 = true;
      if (typeof rerender === 'function') rerender();
      flipStrip(document.querySelector('#modal .needs-body') || document.querySelector('#modal .svc-sel'), before);
      const first = stepsOf(r)[0];
      setTimeout(() => {
        jumpTo1 = false;
        if (first && first.key === cur) return;                    // כבר במסך הנכון
        if (first && first.key === 'crit') { const bf = snapshot(r);
          if (typeof openNeedsClarify === 'function') openNeedsClarify(r, () => checkAfterCritChange(r, bf)); }
        else if (first && first.key === 'svc') { if (typeof openServiceSelect === 'function') openServiceSelect(r); }
      }, 360);
    }));
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
    return `${headerHTML(r, 'svc')}<div class="fl-gate gate-body">
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
        /* לפני שנענו הקריטריונים אי-אפשר לקבוע שהמוצר "מתאים" —
           כל מה שידוע בשלב הזה הוא שיש מועדים פנויים. */
        const answered = Object.keys(r.needs || {}).some(k => k !== 'note' && (r.needs || {})[k]);
        return `<div class="fl-step ${bad.length || !rd || !rd.ok ? 'bad' : 'ok'}">
          <span class="fl-n">${(bad.length || (rd && !rd.ok)) ? ic('alert') : ic('check')}</span>
          <div><b>${bad.length ? 'הלקוח אינו עומד בקריטריונים של המוצר'
            : (rd && !rd.ok ? (rd.blame === 'crit' ? 'אין מועד בקריטריונים שנבחרו' : 'אין מועד פנוי למוצר הזה')
            : !answered ? (rd && rd.slots > 0 ? 'יש מועדים פנויים · ההתאמה תיבדק בבירור הצורך' : 'אפשר להמשיך לבירור הצורך')
            : (rd && rd.slots > 0 ? 'עומד בקריטריונים ויש מועדים פנויים' : 'עומד בקריטריונים — אפשר להמשיך'))}</b>
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
          if (!rec || !body) return r;
          sizeModal();
          if (body.querySelector('.fl-gate')) return r;
          const d = document.createElement('div'); d.innerHTML = gateHTML(rec);
          while (d.lastElementChild) body.insertBefore(d.lastElementChild, body.firstChild);

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
          bindModes(body, rec, 'svc', rr);
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
          if (!body || !rec) return out;
          sizeModal();
          if (body.querySelector('.fl-strip')) return out;
          const rd = readiness(rec);
          const d = document.createElement('div');
          d.innerHTML = headerHTML(rec, 'crit') + ((rec.services || []).length ? `<div class="fl-ready ${rd.ok ? 'ok' : 'bad'}">
            ${ic(rd.ok ? 'check' : 'alert')}
            <div><b>${rd.ok ? (rd.slots > 0 ? 'יש מועדים שמתאימים לצירוף הזה' : 'אין חסימה — אפשר להמשיך לתיאום')
              : (rd.blame === 'product' ? 'המוצר שנבחר אינו מתאים ללקוח' : 'אין מועד פנוי בצירוף הקריטריונים')}</b>
            <small>${rd.ok ? 'המשך יפתח את מסך התיאום עם מועדים אמיתיים.'
              : esc((rd.reasons || []).map(x => x.label + ' — ' + x.det).join(' · ') || (rd.bad || []).map(x => x.why).join(' · '))}</small></div>
            ${!rd.ok && rd.blame === 'product' ? `<button class="btn sm" id="flToSvc">${ic('layers')} לבחירת מוצר מקביל</button>` : ''}</div>` : '');
          while (d.lastChild) body.insertBefore(d.lastChild, body.firstChild);
          bindStrip(body, rec, () => openNeedsClarify(rec, done));
          bindModes(body, rec, 'crit', () => openNeedsClarify(rec, done));
          const ts = document.getElementById('flToSvc');
          if (ts) ts.addEventListener('click', () => { if (typeof openServiceSelect === 'function') openServiceSelect(rec); });

          /* "שמור והמשך" ממשיך לשלב הבא לפי הסדר — ולא יוצא מהמהלך */
          const sv = document.getElementById('needsSave');
          if (sv && !sv.__fl) {
            const fresh = sv.cloneNode(true); fresh.__fl = true;
            const steps = stepsOf(rec), i = steps.findIndex(s => s.key === 'crit');
            const nxt = steps[i + 1] || steps[steps.length - 1];
            fresh.innerHTML = `${ic('check')} שמור והמשך`;
            sv.parentNode.replaceChild(fresh, sv);
            fresh.addEventListener('click', () => {
              const nt = document.getElementById('needsNoteM'); if (nt) rec.needs.note = nt.value;
              const miss = reqMissing(rec);
              if (miss.length) { toast('חסר קריטריון חובה: ' + miss.join(' · ')); return; }
              if (typeof closeModal === 'function') closeModal();
              if (typeof done === 'function') done();
              setTimeout(() => {
                if (nxt.key === 'svc') { if (typeof openServiceSelect === 'function') openServiceSelect(rec); return; }
                if (nxt.key === 'cal') {
                  const rd2 = readiness(rec);
                  if (!rd2.ok) { toast(rd2.blame === 'product' ? 'המוצר שנבחר אינו מתאים — יש לבחור חלופה' : 'אין מועד בקריטריונים שנבחרו');
                    if (typeof openServiceSelect === 'function') openServiceSelect(rec); return; }
                  if (typeof openProposedTimes === 'function') openProposedTimes(rec);
                }
              }, 60);
            });
          }
        } catch (e) { console.error('[flow] needs', e); }
        return out;
      });

      /* בירור הצורך ובחירת השירות הם מהלך אחד — ולכן שלב אחד בליד:
         "התאמת שירות / מוצר", עם כפתור יחיד שפותח את החלון. */
      const MERGE_CRIT = ['qualify', 'need', 'needs', 'classify'];
      const MERGE_SVC = ['service', 'svc', 'services'];
      if (typeof computeStages === 'function') CBX.wrap('flow', 'computeStages', o => function (r) {
        const list = o.apply(this, arguments);
        try {
          const ci = list.findIndex(s => MERGE_CRIT.indexOf(s.key) >= 0);
          const si = list.findIndex(s => MERGE_SVC.indexOf(s.key) >= 0);
          if (ci < 0 || si < 0) return list;
          const c = list[ci], s = list[si];
          const both = [c, s];
          /* הושלם בפועל: נבחר שירות *וגם* נענו קריטריונים — אז השלב
             נצבע ירוק בדיוק כמו אחרי תיאום, בלי לחכות לשלב הבא. */
          const sumOK = (typeof needsSummary === 'function' ? needsSummary(r) : []).length > 0;
          const svcOK = ((r.services || []).length > 0);
          const filled = sumOK && svcOK;
          const state = filled ? 'done'
            : both.every(x => x.state === 'done') ? 'done'
            : both.some(x => x.state === 'overdue') ? 'overdue'
            : both.some(x => x.state === 'active') ? 'active'
            : both.some(x => x.state === 'done') ? 'active' : 'todo';
          const parts = both.map(x => x.result).filter(Boolean);
          const merged = Object.assign({}, ci < si ? c : s, {
            key: c.key, title: 'התאמת שירות / מוצר', state: state,
            result: parts.length ? parts.join(' · ') : null,
            noContent: state === 'done' && !parts.length && !filled,
            idx: Math.min(c.idx, s.idx),
          });
          const out = list.filter((x, i) => i !== ci && i !== si);
          out.splice(Math.min(ci, si), 0, merged);
          return out;
        } catch (e) { console.error('[flow] merge', e); return list; }
      });

      if (typeof accBody === 'function') CBX.wrap('flow', 'accBody', o => function (s, r) {
        const k = s && s.key;
        if (MERGE_CRIT.indexOf(k) < 0) return o.apply(this, arguments);
        const sum = (typeof needsSummary === 'function') ? needsSummary(r) : [];
        const miss = reqMissing(r);
        const svcs = (r.services || []).map(x => (typeof cTreat === 'function' && cTreat(x)) ? cTreat(x).label : x);
        const mode = modeOf(r);
        return `<div class="stage-needs fl-critstage">
          <p class="needs-hint">${ic('bolt')} הבירור והבחירה הם מהלך אחד — הקריטריונים מסננים את הקטלוג ואת היומן בזמן אמת,
            כדי שלא ייבחר משהו שאין לו מועד.</p>
          <div class="fl-mini">
            <div class="fl-mini-r ${svcs.length ? 'ok' : ''}"><span>${ic('layers')} שירות / מוצר</span>
              <b>${svcs.length ? esc(svcs.join(' · ')) : 'טרם נבחר'}</b></div>
            <div class="fl-mini-r ${sum.length ? 'ok' : ''}"><span>${ic('settings')} קריטריונים</span>
              <b>${sum.length ? esc(sum.join(' · ')) : 'טרם נענו'}</b></div>
          </div>
          ${miss.length ? `<p class="fl-none bad">${ic('lock')} חסר לפני תיאום: ${esc(miss.join(' · '))}</p>` : ''}
          <button class="btn primary fl-openbtn" data-flopencrit="${esc(String(r.id))}">
            ${ic('tasks')} בחר שירות / מוצר ${ic('chevronL')}</button>
          <small class="fl-modehint">${mode === 'known' ? ic('target') + ' המסלול: הלקוח יודע — שירות ואז קריטריונים'
            : ic('search') + ' המסלול: הלקוח לא יודע — קריטריונים ואז שירות'}</small>
        </div>`;
      });
      if (typeof closeModal === 'function') CBX.wrap('flow', 'closeModal', o => function () {
        unsizeModal(); return o.apply(this, arguments);
      });

      /* הכפתור פותח את המהלך בשלב 1 של המסלול הנוכחי */
      CBX.delegate('flow', '[data-flopencrit]', el => {
        const r = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => String(x.id) === el.dataset.flopencrit) : null;
        if (!r) return;
        const before = snapshot(r);
        const first = stepsOf(r)[0];
        if (first && first.key === 'svc') { if (typeof openServiceSelect === 'function') openServiceSelect(r); return; }
        if (typeof openNeedsClarify === 'function')
          openNeedsClarify(r, () => { if (typeof renderDrawerTab === 'function') renderDrawerTab(r); checkAfterCritChange(r, before); });
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
