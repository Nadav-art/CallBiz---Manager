/* ============================================================
   הרחבה: קריטריונים — נעילת אפשרויות ללא זמינות  ·  key = 'critfx'
   ------------------------------------------------------------
   הבעיה: אפשר היה לבחור צירוף קריטריונים שאין לו אף מועד ביומן
   (צפון + צהריים + מטפל גבר), ורק במסך התיאום התגלה שהוא ריק.
   הפתרון: כל אפשרות נבדקת מול היומן האמיתי לפי שאר הקריטריונים
   שכבר נבחרו. אפשרות בלי אף מועד ננעלת — מסומנת, מקווקוות, לא
   לחיצה — ומוצג מה צריך לשחרר כדי לפתוח אותה.
   ============================================================ */
(function () {

  const RANGE = { morning: [8, 12], noon: [12, 16], evening: [16, 18] };
  const LBL = { branch: 'סניף / אזור מועדף', timeOfDay: 'העדפת זמן ביום', gender: 'העדפת מגדר מטפל/ת' };
  const labelOf = k => LBL[k] || (typeof needsDefOf === 'function' && needsDefOf(k) ? needsDefOf(k).label : k);
  const valLabel = (k, v) => {
    if (!v) return 'ללא העדפה';
    if (k === 'branch') { const b = (typeof cBranch === 'function') && cBranch(v); return b ? (b.short || b.label) : v; }
    if (k === 'timeOfDay') return ({ morning: 'בוקר', noon: 'צהריים', evening: 'אחה״צ' })[v] || v;
    if (k === 'gender') return v === 'm' ? 'גבר' : 'אישה';
    return v;
  };

  /* ---------- מאגר המועדים הרלוונטיים לרשומה (שירותים + סניפים פעילים) ---------- */
  function candidates(r) {
    if (typeof coordPool !== 'function') return null;
    const svcs = ((r && r.services) || []).filter(Boolean);
    let pool;
    try { pool = coordPool() || []; } catch (e) { return null; }
    return pool.filter(s => {
      if (s.booked || s.held) return false;
      if (typeof coordIsPast === 'function' && coordIsPast(s)) return false;
      if (typeof coordBranchOK === 'function' && !coordBranchOK(s)) return false;
      const br = (typeof cBranch === 'function') && cBranch(s.branch);
      if (!br || br.active === false || br.on === false) return false;
      if (svcs.length) {
        if (!svcs.every(k => (br.treatments || []).indexOf(k) >= 0)) return false;
        const d = (typeof cDoc === 'function') && cDoc(s.doc);
        if (!d || !svcs.every(k => (d.skills || []).indexOf(k) >= 0)) return false;
      }
      return true;
    });
  }

  /* ---------- האם מועד עומד בקריטריונים שנבחרו ---------- */
  function slotPasses(s, rt, memo) {
    const n = rt.needs || {};
    if (n.branch && n.branch !== '__near' && s.branch !== n.branch) return false;
    const rg = n.timeOfDay && RANGE[n.timeOfDay];
    if (rg && !(s.h >= rg[0] && s.h < rg[1])) return false;
    if (n.gender) { const d = (typeof cDoc === 'function') && cDoc(s.doc); if (!d || d.gender !== n.gender) return false; }
    if (typeof branchBlockReason === 'function') {
      if (!(s.branch in memo)) memo[s.branch] = branchBlockReason(rt, s.branch);
      if (memo[s.branch]) return false;
    }
    return true;
  }

  /* ---------- כמה מועדים נשארים לצירוף נתון ---------- */
  function countFor(r, pool, needs) {
    const rt = { name: r.name, services: r.services, city: r.city, needs: needs };
    const memo = {};
    let n = 0;
    for (let i = 0; i < pool.length; i++) if (slotPasses(pool[i], rt, memo)) { n++; if (n > 3) break; }
    return n;
  }

  /* ---------- אילו קריטריונים אחרים חוסמים ---------- */
  function culprits(r, pool, needs) {
    const set = Object.keys(needs).filter(k => needs[k] && k !== 'note' && k !== 'nearBranch');
    const out = [];
    set.forEach(k => {
      const alt = Object.assign({}, needs); delete alt[k];
      if (countFor(r, pool, alt)) out.push(k);
    });
    return out;
  }

  /* ---------- סימון האפשרויות ---------- */
  function markQuestions(r, qs) {
    const pool = candidates(r);
    if (!pool || !pool.length) return { qs: qs, locked: 0, hints: [], dropped: [] };
    let base = Object.assign({}, r.needs || {});
    delete base.note;
    const hints = [], dropped = []; let locked = 0;

    /* בחירה קיימת שאינה אפשרית לא תנעל את כל שאר המסך.
       מנטרלים אותה מהבסיס, מסמנים אותה, ומציעים להחליף אותה. */
    qs.forEach(q => {
      const v = base[q.key]; if (!v) return;
      const o = (q.opts || []).find(x => x.v === v);
      if (o && o.blocked) { dropped.push({ k: q.key, v: v, why: o.why || 'הבחירה הזו אינה אפשרית' }); delete base[q.key]; }
    });
    let guard = 0;
    while (!countFor(r, pool, base) && guard++ < 6) {
      const keys = Object.keys(base).filter(k => base[k] && k !== 'nearBranch' && k !== 'note');
      if (!keys.length) break;
      let best = null, bestN = 0;
      keys.forEach(k => { const alt = Object.assign({}, base); delete alt[k];
        const n = countFor(r, pool, alt); if (n > bestN) { bestN = n; best = k; } });
      if (!best) best = keys[keys.length - 1];
      dropped.push({ k: best, v: base[best], why: 'הצירוף עם הערך הזה לא מותיר אף מועד' });
      delete base[best];
    }

    qs.forEach(q => {
      if (!q.opts) return;
      q.opts.forEach(o => {
        /* נחסם כבר ע״י כלל קיים — לא משנים את ההחלטה, רק מציגים את
           הסיבה גם על השורה עצמה ולא רק ב-tooltip */
        if (o.blocked) { locked++; if (!o.hint) o.hint = shortWhy(o.why); return; }
        if (!o.v || o.v === '__near') return;        // "אין העדפה" תמיד פתוח
        if (typeof CRIT_OTHER !== 'undefined' && o.v === CRIT_OTHER) return;
        const test = Object.assign({}, base); test[q.key] = o.v;
        if (countFor(r, pool, test)) return;         // יש זמינות — פתוח

        /* האם האפשרות זמינה כשהיא לבדה? רק אם כן — הצירוף הוא שחוסם.
           אחרת מדובר בעובדה מבנית (סניף סגור, אין יומן) ולא באשמת הבחירה. */
        const alone = {}; alone[q.key] = o.v;
        const standalone = countFor(r, pool, alone);
        o.blocked = true; o.noAvail = true; locked++;
        if (!standalone) {
          o.why = structuralWhy(q.key, o.v);
          o.hint = shortWhy(o.why);
          return;
        }
        const cul = culprits(r, pool, test).filter(k => k !== q.key);
        if (cul.length) {
          const names = cul.map(k => `${labelOf(k)}: ${valLabel(k, base[k])}`);
          o.why = 'אין מועד פנוי בצירוף הזה · ייפתח אם משנים ' + names.join(' או ');
          o.hint = 'לא מתאים לקריטריונים שנבחרו';
          cul.forEach(k => { if (hints.indexOf(k) < 0) hints.push(k); });
        } else {
          o.why = 'אין מועד פנוי ביומן לאפשרות הזו';
          o.hint = 'אין מועד פנוי';
        }
      });
      /* כל האפשרויות של השאלה ננעלו — משאירים אותה כאינדיקציה, לא כמלכודת */
      const live = q.opts.filter(o => !o.blocked);
      q.allBlocked = live.length <= 1;
    });
    return { qs: qs, locked: locked, hints: hints, base: base, dropped: dropped };
  }

  /* בשורה עצמה — משפט אחד קצר. הפירוט המלא נפתח בסימן השאלה. */
  function shortWhy(full) {
    const t = String(full || '');
    if (/סגור|כבוי|יומן פעיל/.test(t)) return 'הסניף סגור';
    if (/אינו מספק|מטפל מוסמך|אין בסניף/.test(t)) return 'לא מתאים לשירות שנבחר';
    if (/מגדר|מטפלת|מטפל גבר/.test(t)) return 'אין מטפל/ת בהעדפה שנבחרה';
    if (/אין מועד/.test(t)) return 'אין מועד פנוי';
    return 'לא מתאים לקריטריונים שנבחרו';
  }

  /* חסימה מבנית — לא באשמת מה שנבחר, ולכן מנוסחת אחרת */
  function structuralWhy(key, v) {
    if (key === 'branch') {
      const b = (typeof cBranch === 'function') ? cBranch(v) : null;
      if (b && b.on === false) return 'הסניף סגור כרגע — אין לו יומן פעיל';
      if (b && b.active === false) return 'הסניף כבוי בהגדרות';
      return 'אין יומן פעיל בסניף הזה';
    }
    if (key === 'timeOfDay') return 'אין משבצות בשעות האלה באף סניף';
    if (key === 'gender') return 'אין מטפל/ת בהעדפה הזו עם יומן פעיל';
    return 'אין מועד ביומן לאפשרות הזו';
  }

  /* ---------- סימן שאלה + פופ-אפ צף עם ההסבר המלא ---------- */
  function closeTip() { const t = document.getElementById('cfxTip'); if (t) t.remove(); }
  function openTip(anchor, text, title) {
    closeTip();
    const t = document.createElement('div'); t.className = 'cfx-tip'; t.id = 'cfxTip';
    t.innerHTML = `<div class="cfx-tip-h">${ic('lock')} <b>${esc(title || 'למה האפשרות נעולה')}</b>
      <button class="cfx-tip-x" aria-label="סגור">${ic('close')}</button></div>
      <p>${esc(text)}</p>`;
    document.body.appendChild(t);
    const rc = anchor.getBoundingClientRect();
    const tw = t.offsetWidth || 260, th = t.offsetHeight || 90;
    let left = Math.min(window.innerWidth - tw - 8, Math.max(8, rc.left + rc.width / 2 - tw / 2));
    let top = rc.bottom + 8;
    if (top + th > window.innerHeight - 8) top = Math.max(8, rc.top - th - 8);
    t.style.left = left + 'px'; t.style.top = top + 'px';
    t.querySelector('.cfx-tip-x').addEventListener('click', closeTip);
    setTimeout(() => document.addEventListener('mousedown', function out(e) {
      if (!e.target.closest('#cfxTip') && !e.target.closest('.cfx-q')) { closeTip(); document.removeEventListener('mousedown', out); }
    }), 0);
  }
  /* מוסיפים את הסימן לכל אפשרות נעולה אחרי הרינדור */
  function addQMarks(root) {
    (root || document).querySelectorAll('.needs-opt.blocked').forEach(b => {
      if (b.querySelector('.cfx-q')) return;
      const why = b.dataset.nwhy || b.getAttribute('title'); if (!why) return;
      b.removeAttribute('title');
      const q = document.createElement('span');
      q.className = 'cfx-q'; q.textContent = '?'; q.setAttribute('role', 'button');
      q.setAttribute('aria-label', 'למה נעול');
      const label = (b.childNodes[0] && b.childNodes[0].textContent || '').trim();
      q.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
        openTip(q, why, label || 'האפשרות נעולה'); });
      b.appendChild(q);
    });
  }

  let lastMark = null;

  function barHTML() {
    if (!lastMark || (!lastMark.locked && !(lastMark.dropped || []).length)) return '';
    const b = lastMark.base || {};
    const drop = lastMark.dropped || [];
    const dropBar = drop.length ? `<div class="cfx-bar drop">${ic('alert')}
      <div><b>בחירה קיימת שאינה אפשרית — נוטרלה כדי לא לנעול את כל המסך</b>
      <small>שאר האפשרויות מחושבות בלעדיה. בחר ערך אחר בשאלה הזו, או נקה אותה.</small>
      <div class="cfx-rel">${drop.map(d => `<button class="cfx-relbtn bad" data-cfxdrop="${esc(d.k)}">
        ${ic('close')} נקה ${esc(labelOf(d.k))} · ${esc(valLabel(d.k, d.v))}
        <small>${esc(d.why)}</small></button>`).join('')}</div></div></div>` : '';
    if (!lastMark.locked) return dropBar;
    return dropBar + `<div class="cfx-bar">${ic('lock')}
      <div><b>${lastMark.locked} אפשרויות ננעלו — אין להן מועד פנוי ביומן</b>
      <small>הן מסומנות באפור עם קו. הצירוף הנוכחי יגיע למסך תיאום עם מועדים אמיתיים.</small></div>
      ${lastMark.hints.length ? `<div class="cfx-rel">${lastMark.hints.map(k =>
        `<button class="cfx-relbtn" data-cfxrel="${esc(k)}">${ic('sync')} שחרר ${esc(labelOf(k))}
          <small>${esc(valLabel(k, b[k]))}</small></button>`).join('')}</div>` : ''}</div>`;
  }

  CBX.register({
    key: 'critfx', label: 'קריטריונים — נעילת מה שאין', icon: 'lock',
    desc: 'כל אפשרות בבירור הצורך נבדקת מול היומן. אפשרות שאין לה אף מועד פנוי בצירוף שנבחר ננעלת ומסומנת, עם כפתור לשחרור הקריטריון שחוסם אותה — כדי לא להגיע למסך תיאום ריק.',
    files: ['js/ext/crit-feasible.js', 'css/ext/crit-feasible.css'],
    install() {
      document.body.classList.add('cbx-critfx');
      CBX._remember('critfx', () => document.body.classList.remove('cbx-critfx'));

      if (typeof needsQuestions === 'function') CBX.wrap('critfx', 'needsQuestions', o => function (r) {
        const qs = o.apply(this, arguments);
        try { lastMark = markQuestions(r, qs); } catch (e) { console.error('[critfx]', e); lastMark = null; }
        return qs;
      });

      if (typeof openNeedsClarify === 'function') CBX.wrap('critfx', 'openNeedsClarify', o => function (r, after) {
        const out = o.apply(this, arguments);
        try {
          const body = document.querySelector('#modal .needs-body');
          if (body) addQMarks(body);
          const html = barHTML();
          if (!body || !html) return out;
          const d = document.createElement('div'); d.innerHTML = html;
          const anchor = body.querySelector('.needs-q');
          const bars = [];
          while (d.firstElementChild) { const el = d.firstElementChild; bars.push(el);
            anchor ? body.insertBefore(el, anchor) : body.appendChild(el); }
          const clear = k => {
            const nt = document.getElementById('needsNoteM'); if (nt) r.needs.note = nt.value;
            delete r.needs[k];
            toast('נוקה: ' + labelOf(k) + ' — האפשרויות נפתחו מחדש');
            openNeedsClarify(r, after);
          };
          bars.forEach(el => {
            el.querySelectorAll('[data-cfxrel]').forEach(b => b.addEventListener('click', () => clear(b.dataset.cfxrel)));
            el.querySelectorAll('[data-cfxdrop]').forEach(b => b.addEventListener('click', () => clear(b.dataset.cfxdrop)));
          });
          addQMarks(body);
        } catch (e) { console.error('[critfx] bar', e); }
        return out;
      });
    },
  });

  window.CRITFX = { candidates, countFor, mark: markQuestions, last: () => lastMark };
})();
