/* ============================================================
   הרחבה: לוח תיאום חי — סנכרון וסינון  ·  key = 'coordx'
   ------------------------------------------------------------
   שלוש בעיות בלוח:
     1) הלוח נפתח עם הסניפים שמסומנים ב-on, בעוד שאר המערכת
        עובדת לפי active. סניף שסגור במערכת הופיע בלוח.
     2) בחירת קריטריונים לא צמצמה את היומן — הנציג ראה משבצות
        שלא באמת מתאימות ללקוח.
     3) "ליד חדש" מתוך הלוח שמר את הליד הקודם כ-caller.
   ============================================================ */
(function () {

  /* ---------------- הסניפים הפעילים באמת ---------------- */
  const activeBranches = () => (typeof COORD_BRANCHES !== 'undefined')
    ? COORD_BRANCHES.filter(b => b.active !== false && b.on !== false) : [];

  /* ---------------- תרגום קריטריונים לסינון הלוח ---------------- */
  function applyCriteria(r, st) {
    if (!r || !st) return { changed: [], skipped: [] };
    const n = r.needs || {}, changed = [], skipped = [];

    /* סניף מועדף */
    if (n.branch && n.branch !== '__near' && typeof COORD_BRANCHES !== 'undefined') {
      const b = COORD_BRANCHES.find(x => x.key === n.branch);
      if (b && b.active !== false) { st.branches = new Set([b.key]); changed.push('סניף: ' + (b.short || b.label)); }
      else skipped.push('הסניף שנבחר אינו פעיל');
    }
    /* מגדר המטפל */
    if (n.gender === 'm' || n.gender === 'f') {
      st.gender = n.gender;
      const docs = (typeof COORD_DOCTORS !== 'undefined') ? COORD_DOCTORS.filter(d => d.gender === n.gender) : [];
      if (docs.length) { st.doctors = new Set(docs.filter(d => st.branches.has(d.branch)).map(d => d.key));
        if (!st.doctors.size) st.doctors = new Set(docs.map(d => d.key));
        changed.push('מטפל/ת: ' + (n.gender === 'm' ? 'גבר' : 'אישה')); }
      else skipped.push('אין מטפל בהעדפת המגדר');
    }
    /* שעה מועדפת */
    const T = { morning: [8, 12], noon: [12, 16], evening: [16, 18] };
    if (n.timeOfDay && T[n.timeOfDay]) {
      st.hourStart = T[n.timeOfDay][0]; st.hourEnd = T[n.timeOfDay][1];
      changed.push('שעות: ' + ({ morning: 'בוקר', noon: 'צהריים', evening: 'אחה״צ' })[n.timeOfDay]);
    }
    /* השירותים שנבחרו — רק סניפים שמספקים אותם */
    const svcs = (r.services || []).filter(Boolean);
    if (svcs.length) {
      st.treatments = new Set(svcs);
      if (typeof COORD_BRANCHES !== 'undefined') {
        const able = COORD_BRANCHES.filter(b => b.active !== false && b.on !== false
          && svcs.every(k => (b.treatments || []).indexOf(k) >= 0));
        if (able.length) {
          const keep = able.filter(b => st.branches.has(b.key));
          st.branches = new Set((keep.length ? keep : able).map(b => b.key));
          changed.push('רק סניפים שמספקים את השירות');
        } else skipped.push('אין סניף שמספק את כל השירותים שנבחרו');
      }
    }
    /* אזור שטח — כשההרחבה פעילה */
    if (window.TERR && CBX.isOn('terr')) {
      const z = window.TERR.zoneOf(r);
      if (z && typeof COORD_BRANCHES !== 'undefined') {
        const inZone = COORD_BRANCHES.filter(b => b.active !== false && window.TERR.zoneOfCity(b.city) === z);
        if (inZone.length) {
          const keep = inZone.filter(b => st.branches.has(b.key));
          if (keep.length) { st.branches = new Set(keep.map(b => b.key)); changed.push('אזור הלקוח'); }
        }
      }
    }
    return { changed, skipped };
  }

  /* ---------------- חיווי הסינון ---------------- */
  function bannerHTML(r, res) {
    if (!r) return '';
    const n = r.needs || {};
    const has = Object.keys(n).filter(k => n[k]).length;
    if (!has && !(r.services || []).length) return `<div class="cx-bar none">${ic('alert')}
      <b>לא הוזנו קריטריונים</b><small>היומן מציג הכול. בירור קריטריונים יצמצם למה שבאמת מתאים.</small>
      <button class="btn sm" id="cxCrit">${ic('settings')} לקריטריונים</button></div>`;
    return `<div class="cx-bar">${ic('target')}
      <b>היומן מסונן לפי הקריטריונים של ${esc(r.name)}</b>
      <span class="cx-chips">${res.changed.map(c => `<span class="cx-chip">${esc(c)}</span>`).join('')}</span>
      ${res.skipped.length ? `<small class="cx-skip">${ic('alert')} ${esc(res.skipped.join(' · '))}</small>` : ''}
      <button class="btn sm" id="cxCrit">${ic('settings')} עדכן</button>
      <button class="btn sm ghost" id="cxAll">הצג הכול</button></div>`;
  }

  let lastRes = { changed: [], skipped: [] }, muted = false;

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'coordx', label: 'לוח תיאום — סנכרון וסינון', icon: 'clock',
    desc: 'הלוח נפתח רק עם הסניפים הפעילים, מצטמצם אוטומטית לפי הקריטריונים של הליד הפתוח, ו"ליד חדש" מתוך הלוח באמת נפתח כחדש.',
    files: ['js/ext/coord-sync.js'],
    install() {
      /* 1) סניפים פעילים בלבד */
      if (typeof coordInit === 'function') CBX.wrap('coordx', 'coordInit', o => function () {
        const r = o.apply(this, arguments);
        try { if (typeof coordState !== 'undefined' && coordState)
          coordState.branches = new Set(activeBranches().map(b => b.key)); } catch (e) {}
        return r;
      });
      /* 2) סינון לפי הקריטריונים + חיווי */
      if (typeof renderCoordView === 'function') CBX.wrap('coordx', 'renderCoordView', o => function () {
        try {
          const st = (typeof coordState !== 'undefined') ? coordState : null;
          const r = st && st.caller;
          if (st && r && !muted && st.__critFor !== r.id) {
            st.branches = new Set(activeBranches().map(b => b.key));
            lastRes = applyCriteria(r, st);
            st.__critFor = r.id;
            if (typeof window.__coordPool !== 'undefined') window.__coordPool = null;
          }
        } catch (e) { console.error('[coordx] filter', e); }
        const out = o.apply(this, arguments);
        try {
          const st = coordState, r = st && st.caller;
          const host = (typeof coordViewHost === 'function') ? coordViewHost() : document.getElementById('viewHost');
          if (!host || host.querySelector('.cx-bar')) return out;
          if (!r) return out;
          const d = document.createElement('div'); d.innerHTML = bannerHTML(r, muted ? { changed: [], skipped: [] } : lastRes);
          const el = d.firstElementChild; if (!el) return out;
          host.insertBefore(el, host.firstChild);
          const cc = document.getElementById('cxCrit');
          if (cc) cc.addEventListener('click', () => {
            if (typeof openNeedsClarify === 'function') openNeedsClarify(r, () => {
              if (coordState) coordState.__critFor = null; muted = false; renderCoordView(); });
          });
          const ca = document.getElementById('cxAll');
          if (ca) ca.addEventListener('click', () => {
            muted = true; coordState.branches = new Set(activeBranches().map(b => b.key));
            coordState.doctors = new Set((typeof COORD_DOCTORS !== 'undefined' ? COORD_DOCTORS : []).map(x => x.key));
            coordState.hourStart = 8; coordState.hourEnd = 20; window.__coordPool = null;
            renderCoordView(); toast('הסינון הוסר — מוצג היומן המלא');
          });
        } catch (e) { console.error('[coordx] banner', e); }
        return out;
      });
      /* 3) "ליד חדש" מתוך הלוח — באמת חדש */
      if (typeof coordSelect === 'function') CBX.wrap('coordx', 'coordSelect', o => function (id) {
        const r = o.apply(this, arguments);
        try { if (coordState && !coordState.caller) { coordState.__critFor = null; muted = false; } } catch (e) {}
        return r;
      });
      /* איפוס הסינון כשמנקים את הליד */
      CBX._remember('coordx', () => { try { if (typeof coordState !== 'undefined' && coordState) coordState.__critFor = null; } catch (e) {} });
    },
  });

  window.COORDX = { apply: applyCriteria, active: activeBranches };
})();
