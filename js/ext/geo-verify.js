/* ============================================================
   הרחבה: אימות יישוב תוך כדי הקלדה  ·  key = 'geoverify'
   ------------------------------------------------------------
   רשימה נפתחת קבועה לא מתאימה — מקלידים, והמערכת מציעה ומאמתת
   תוך כדי. ההשלמה מנרמלת כתיב (גרשיים, מקפים, "קרית"/"קריית",
   רווחים) ומחזירה את השם ה*רשמי* כפי שהוא במרשם היישובים —
   כך שמה שנשמר בליד זהה למה שרשום בתעודה.

   מקור הנתונים ניתן להחלפה בנקודה אחת:
       GEOV.setProvider(async q => [{ name, official, region }])
   כרגע רץ מרשם מקומי (IL_CITIES + כינויים). ספק חיצוני — Google
   Places או data.gov.il — נרשם באותה שורה בלי לגעת בממשק.
   שים לב: בגרסה שרצה כקובץ בודד אין קריאות רשת, ולכן ההשלמה
   עובדת מול המרשם המקומי בלבד עד שיחובר ספק.
   ============================================================ */
(function () {

  /* שמות רשמיים וכינויים נפוצים — מה שמוקלד מול מה שרשום */
  const ALIAS = {
    'תל אביב': 'תל אביב-יפו', 'תל-אביב': 'תל אביב-יפו', 'ת״א': 'תל אביב-יפו', 'תא': 'תל אביב-יפו',
    'ירושלים': 'ירושלים', 'באר שבע': 'באר שבע', 'באר-שבע': 'באר שבע', 'ב״ש': 'באר שבע',
    'פתח תקווה': 'פתח תקווה', 'פתח תקוה': 'פתח תקווה', 'פ״ת': 'פתח תקווה',
    'ראשון לציון': 'ראשון לציון', 'ראשל״צ': 'ראשון לציון',
    'קרית שמונה': 'קריית שמונה', 'קריות': 'קריית ביאליק', 'רמת גן': 'רמת גן', 'רמת-גן': 'רמת גן',
    'הרצליה': 'הרצליה', 'כפר סבא': 'כפר סבא', 'בית שמש': 'בית שמש', 'מודיעין': 'מודיעין-מכבים-רעות',
  };

  /* נרמול: גרשיים, מקפים, רווחים כפולים, יו״ד/וי״ו כפולות */
  function norm(s) {
    return String(s || '').trim()
      .replace(/["'״׳`]/g, '').replace(/[-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^קרית /, 'קריית ')
      /* כתיב מלא/חסר — "תקוה" ו"תקווה" הם אותו יישוב */
      .replace(/וו/g, 'ו').replace(/יי/g, 'י')
      .toLowerCase();
  }

  function registry() {
    /* המרשם המורחב קודם — הוא נושא את הכתיב הרשמי; רשימת הדמו
       מוסיפה רק את מה שאינו קיים בו. */
    const base = (window.IL_CITIES_EXT || []).map(c => ({
      name: c.name, official: c.official, region: c.region || '' }));
    const seen = {}; base.forEach(c => { seen[norm(c.official)] = 1; });
    (typeof IL_CITIES !== 'undefined' ? IL_CITIES : []).forEach(c => {
      const off = ALIAS[c.name] || c.name;
      if (seen[norm(off)]) return; seen[norm(off)] = 1;
      base.push({ name: c.name, official: off, region: c.region || '' });
    });
    /* כינויים שאינם ברשימה עצמה — כדי שהקלדה "ת״א" תמצא */
    Object.keys(ALIAS).forEach(k => {
      if (!base.some(x => norm(x.name) === norm(k))) base.push({ name: k, official: ALIAS[k], region: '', alias: true });
    });
    return base;
  }

  let provider = null;
  const setProvider = fn => { provider = typeof fn === 'function' ? fn : null; };

  /* חיפוש מקומי מדורג: התאמה מלאה → תחילית → הכלה */
  function localLookup(q) {
    const n = norm(q); if (!n) return [];
    const all = registry();
    const score = c => {
      const a = norm(c.name), b = norm(c.official);
      if (a === n || b === n) return 0;
      if (a.indexOf(n) === 0 || b.indexOf(n) === 0) return 1;
      if (a.indexOf(n) >= 0 || b.indexOf(n) >= 0) return 2;
      return 9;
    };
    const seen = {};
    return all.map(c => ({ c, s: score(c) })).filter(x => x.s < 9)
      .sort((x, y) => x.s - y.s || x.c.official.length - y.c.official.length)
      .filter(x => { const k = x.c.official; if (seen[k]) return false; seen[k] = 1; return true; })
      .slice(0, 8).map(x => Object.assign({ match: x.s }, x.c));
  }
  async function lookup(q) {
    if (provider) { try { const res = await provider(q); if (Array.isArray(res) && res.length) return res.slice(0, 8); } catch (e) { console.warn('[geoverify] provider', e); } }
    return localLookup(q);
  }
  /* האם מה שהוקלד מאומת — ומהו השם הרשמי */
  function verify(q) {
    const n = norm(q); if (!n) return { state: 'empty' };
    const hit = registry().find(c => norm(c.name) === n || norm(c.official) === n);
    if (!hit) return { state: 'unknown' };
    return { state: norm(hit.official) === n ? 'exact' : 'alias', official: hit.official, region: hit.region };
  }

  /* ---------------- הרכבת ההשלמה על שדה קיים ---------------- */
  function attach(inp, onPick) {
    if (!inp || inp.__geov) return; inp.__geov = true;
    inp.removeAttribute('list');
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('placeholder', 'התחילו להקליד עיר / יישוב…');

    const wrap = document.createElement('div'); wrap.className = 'gv-wrap';
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    const list = document.createElement('div'); list.className = 'gv-list'; wrap.appendChild(list);
    const flag = document.createElement('div'); flag.className = 'gv-flag'; wrap.appendChild(flag);

    let items = [], idx = -1, seq = 0;

    const paintFlag = () => {
      const v = verify(inp.value);
      wrap.classList.remove('ok', 'warn', 'alias');
      if (v.state === 'empty') { flag.innerHTML = ''; return; }
      if (v.state === 'exact') { wrap.classList.add('ok');
        flag.innerHTML = `${ic('check')} מאומת מול מרשם היישובים${v.region ? ' · ' + esc(v.region) : ''}`; return; }
      if (v.state === 'alias') { wrap.classList.add('alias');
        flag.innerHTML = `${ic('sync')} הכתיב הרשמי: <b>${esc(v.official)}</b>
          <button type="button" class="gv-fix">החלף</button>`;
        const b = flag.querySelector('.gv-fix');
        if (b) b.addEventListener('click', () => { setVal(v.official); });
        return; }
      wrap.classList.add('warn');
      flag.innerHTML = `${ic('alert')} לא נמצא ב${provider ? 'מקור החיצוני' : 'מרשם המקומי'}
        (${registry().length} יישובים) — יישמר בדיוק כפי שהוקלד`;
    };
    const setVal = val => {
      inp.value = val; close(); paintFlag();
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof onPick === 'function') onPick(val);
    };
    const close = () => { list.classList.remove('open'); list.innerHTML = ''; items = []; idx = -1; };
    const draw = () => {
      if (!items.length) { close(); return; }
      list.innerHTML = items.map((c, i) => `<button type="button" class="gv-i ${i === idx ? 'on' : ''}" data-gvi="${i}">
        ${ic('org')}<span><b>${esc(c.official)}</b>${c.name !== c.official ? `<small>הוקלד: ${esc(c.name)}</small>` : (c.region ? `<small>${esc(c.region)}</small>` : '')}</span>
        ${c.match === 0 ? `<em>${ic('check')} מדויק</em>` : ''}</button>`).join('');
      list.classList.add('open');
      list.querySelectorAll('[data-gvi]').forEach(b => b.addEventListener('mousedown', e => {
        e.preventDefault(); setVal(items[+b.dataset.gvi].official); }));
    };
    const search = async () => {
      const my = ++seq, q = inp.value;
      if (norm(q).length < 1) { close(); paintFlag(); return; }
      const res = await lookup(q);
      if (my !== seq) return;            // תשובה שאיחרה — מתעלמים
      items = res; idx = -1; draw(); paintFlag();
    };

    inp.addEventListener('input', search);
    inp.addEventListener('focus', () => { if (inp.value) search(); });
    inp.addEventListener('blur', () => setTimeout(() => { close(); paintFlag(); }, 120));
    inp.addEventListener('keydown', e => {
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
      else if (e.key === 'Enter') { if (idx >= 0) { e.preventDefault(); setVal(items[idx].official); } }
      else if (e.key === 'Escape') close();
    });
    paintFlag();
  }

  CBX.register({
    key: 'geoverify', label: 'אימות יישוב תוך כדי הקלדה', icon: 'org',
    desc: 'שדה העיר הפך להשלמה חיה: מקלידים, המערכת מציעה ומאמתת מול מרשם היישובים, מתקנת כתיב לשם הרשמי ומסמנת בבירור כשלא נמצאה התאמה. מקור הנתונים ניתן להחלפה לספק חיצוני בשורה אחת.',
    files: ['js/ext/geo-verify.js', 'css/ext/geo.css'],
    install() {
      /* כתובת הלקוח נדרשת רק כשמבקשים את הסניף הקרוב לביתו —
         אחרת היא רק תופסת את ראש המסך. */
      if (typeof leadAddrHTML === 'function') CBX.wrap('geoverify', 'leadAddrHTML', o => function (r) {
        const n = (r && r.needs) || {};
        if (n.branch !== '__near' && n.nearBranch !== '1') return '';
        return o.apply(this, arguments);
      });
      /* וכשהיא כן מוצגת — היא יושבת מתחת לשאלת הסניף, לא מעל הכול */
      if (typeof openNeedsClarify === 'function') CBX.wrap('geoverify', 'openNeedsClarify', o => function (r) {
        const out = o.apply(this, arguments);
        try {
          const box = document.querySelector('#modal .geo-box');
          const bq = document.querySelector('#modal [data-nq="branch"]');
          const q = bq && bq.closest('.needs-q');
          if (box && q && q.nextElementSibling !== box) q.parentNode.insertBefore(box, q.nextSibling);
        } catch (e) {}
        return out;
      });
      if (typeof bindLeadAddr === 'function') CBX.wrap('geoverify', 'bindLeadAddr', o => function (r, after) {
        const out = o.apply(this, arguments);
        try {
          document.querySelectorAll('[data-geo="city"]').forEach(inp => attach(inp, val => {
            r.addr = r.addr || {}; r.addr.city = val;
            if (typeof after === 'function') after();
          }));
        } catch (e) { console.error('[geoverify]', e); }
        return out;
      });
    },
  });

  window.GEOV = { lookup, verify, norm, registry, setProvider, attach };
})();
