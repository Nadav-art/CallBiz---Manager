/* ============================================================
   הרחבה: סיווג קריטריונים — העדפה מול קריטי  ·  key = 'critkind'
   ------------------------------------------------------------
   לא כל הקריטריונים שווים:

     העדפה  — "הייתי מעדיף בוקר", "הייתי מעדיפה מטפלת". אם אין —
              מתאמים בכל זאת. ברירת המחדל שלהם היא "אין העדפה",
              כלומר הם נחשבים כנענו גם בלי לגעת בהם.
     קריטי  — תנאי סף: הסדר קופה, גיל, אישור רפואי. בלעדיו אי-אפשר
              לתאם, ולכן הוא חייב מענה מפורש.

   הסיווג מוצג ליד כל קריטריון גם במסך ההגדרות וגם בבירור הצורך,
   וניתן לשינוי משם. בנוסף — "גמיש" בהעדפת זמן ביום הוא בדיוק
   "אין העדפה", ולכן אוחד לניסוח אחד בכל המערכת.
   ============================================================ */
(function () {

  const KINDS = {
    pref: { label: 'העדפה', icon: 'target', desc: 'אם אין — מתאמים בכל זאת. ברירת מחדל: אין העדפה' },
    crit: { label: 'קריטי', icon: 'lock', desc: 'תנאי סף — בלעדיו לא ניתן לתאם' },
  };
  /* המובנים הם העדפות; קריטריון שהוגדר כחובה הוא קריטי מעצם הגדרתו */
  const BUILTIN_PREF = ['branch', 'timeOfDay', 'gender', 'nearBranch'];

  function kindOf(key) {
    const cfg = (typeof NEEDS_CFG !== 'undefined' && NEEDS_CFG[key]) || {};
    if (cfg.kind === 'pref' || cfg.kind === 'crit') return cfg.kind;
    if (BUILTIN_PREF.indexOf(key) >= 0) return 'pref';
    const def = (typeof needsDefOf === 'function') ? needsDefOf(key) : null;
    if (def && typeof needsCfgOf === 'function' && needsCfgOf(def).required) return 'crit';
    return 'crit';
  }
  function setKind(key, k) {
    if (typeof NEEDS_CFG === 'undefined') return;
    NEEDS_CFG[key] = Object.assign({}, NEEDS_CFG[key], { kind: k });
    if (typeof needsSave === 'function') needsSave();
  }
  const isPref = key => kindOf(key) === 'pref';

  /* "אין העדפה" — ניסוח אחיד לכל אפשרות ריקה של קריטריון העדפה */
  const NO_PREF = 'אין העדפה';

  /* ברירת המחדל אינה בחירה: כל עוד הנציג לא אישר, שום אפשרות אינה
     מסומנת. רק לחיצה על "שמור והמשך" מקבעת את ההעדפות שלא נגעו
     בהן כ"אין העדפה" — ומאז הן מוצגות כנבחרות. */
  function seedPrefs(r) {
    if (!r) return;
    r.needs = r.needs || {};
    (typeof needsQuestions === 'function' ? needsQuestions(r) : []).forEach(q => {
      if (!isPref(q.key)) return;
      if (!Object.prototype.hasOwnProperty.call(r.needs, q.key)) r.needs[q.key] = '';
    });
  }

  /* קיבוע ההעדפות מתבצע רק בלחיצה על "שמור והמשך" — בשלב לכידה,
     לפני כל מטפל אחר, כדי שמה שנשמר יכלול אותן. */
  let lastRec = null;
  function armSave(modKey) {
    const fn = e => {
      const b = e.target && e.target.closest ? e.target.closest('#needsSave') : null;
      if (!b || !lastRec) return;
      try { seedPrefs(lastRec); } catch (err) {}
    };
    document.addEventListener('click', fn, true);
    CBX._remember(modKey, () => document.removeEventListener('click', fn, true));
  }

  CBX.register({
    key: 'critkind', label: 'סיווג קריטריונים — העדפה / קריטי', icon: 'target',
    desc: 'כל קריטריון מסווג כהעדפה או כתנאי סף. העדפה מקבלת "אין העדפה" כברירת מחדל ואינה נחשבת חסרה, וקריטריון קריטי חייב מענה. "גמיש" בהעדפת זמן אוחד ל"אין העדפה" בכל המערכת.',
    files: ['js/ext/crit-kind.js'],
    install() {
      armSave('critkind');
      /* ניסוח אחיד + סימון הסיווג על השאלה */
      if (typeof needsQuestions === 'function') CBX.wrap('critkind', 'needsQuestions', o => function (r) {
        const qs = o.apply(this, arguments);
        try {
          qs.forEach(q => {
            q.kind = kindOf(q.key);
            if (q.kind !== 'pref') return;
            (q.opts || []).forEach(op => {
              if (op.v === '' && op.t !== NO_PREF && !/הקרוב/.test(op.t)) op.t = NO_PREF;
            });
          });
        } catch (e) { console.error('[critkind]', e); }
        return qs;
      });

      /* העדפה שלא נענתה אינה "חסרה" */
      if (typeof needsMissingRequired === 'function') CBX.wrap('critkind', 'needsMissingRequired', o => function (r) {
        const miss = o.apply(this, arguments);
        try {
          const byLabel = {};
          (typeof needsQuestions === 'function' ? needsQuestions(r) : []).forEach(q => {
            byLabel[q.label.replace(/\s*\*$/, '')] = q.key;
          });
          return miss.filter(m => !isPref(byLabel[m] || ''));
        } catch (e) { return miss; }
      });

      /* פתיחת בירור הצורך — העדפות מסומנות מראש כ"אין העדפה" */
      if (typeof openNeedsClarify === 'function') CBX.wrap('critkind', 'openNeedsClarify', o => function (r, after) {
        lastRec = r || null;
        const out = o.apply(this, arguments);
        try {
          /* תגית הסיווג ליד כל שאלה */
          const body = document.querySelector('#modal .needs-body');
          if (body) (typeof needsQuestions === 'function' ? needsQuestions(r) : []).forEach(q => {
            const btn = body.querySelector(`[data-nq="${CSS.escape(q.key)}"]`);
            const wrap = btn && btn.closest('.needs-q');
            const lbl = wrap && wrap.querySelector('.needs-lbl');
            if (!lbl || lbl.querySelector('.ck-tag')) return;
            const k = KINDS[kindOf(q.key)];
            const s = document.createElement('span');
            s.className = 'ck-tag ' + kindOf(q.key);
            s.title = k.desc;
            s.innerHTML = ic(k.icon) + ' ' + k.label;
            lbl.appendChild(s);
          });
        } catch (e) { console.error('[critkind] tag', e); }
        return out;
      });

      /* מסך ההגדרות — סיווג גלוי וניתן לשינוי */
      if (typeof renderFieldsManagerView === 'function') CBX.wrap('critkind', 'renderFieldsManagerView', o => function () {
        const out = o.apply(this, arguments);
        try { paintSettings(); } catch (e) { console.error('[critkind] settings', e); }
        return out;
      });
      CBX.delegate('critkind', '[data-ckkind]', el => {
        const p = el.dataset.ckkind.split('|');
        setKind(p[0], p[1] === 'pref' ? 'crit' : 'pref');
        toast(p[1] === 'pref' ? 'סווג כקריטריון קריטי — חייב מענה' : 'סווג כהעדפה — ברירת מחדל "אין העדפה"');
        if (typeof renderFieldsManagerView === 'function') renderFieldsManagerView();
      });

      function paintSettings() {
        document.querySelectorAll('[data-critrow], .crit-row, .fx-crit').forEach(row => {
          const key = row.dataset.critrow || row.dataset.crit || row.getAttribute('data-critkey');
          if (!key || row.querySelector('.ck-tag')) return;
          const k = kindOf(key), meta = KINDS[k];
          const b = document.createElement('button');
          b.className = 'ck-tag btn-like ' + k;
          b.setAttribute('data-ckkind', key + '|' + k);
          b.title = meta.desc + ' · לחצו להחלפה';
          b.innerHTML = ic(meta.icon) + ' ' + meta.label;
          const host = row.querySelector('.crit-name, .fx-name, b') || row;
          host.appendChild(b);
        });
      }
    },
  });

  window.CRITKIND = { kindOf, setKind, isPref, seed: seedPrefs, KINDS, NO_PREF };
})();
