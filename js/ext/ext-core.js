/* ============================================================
   CBX — מארח ההרחבות
   ------------------------------------------------------------
   כל מה שנבנה כ"הרחבה" יושב ב-js/ext/ ו-css/ext/ ולא נוגע
   באף קובץ ליבה. החיבור נעשה בזמן ריצה בלבד:
     CBX.wrap()   — עוטף פונקציה קיימת ושומר את המקור
     CBX.push()   — מוסיף פריטים למערך קיים ויודע להוציא אותם
     CBX.assign() — מוסיף מפתחות לאובייקט ויודע למחוק אותם
     CBX.on()     — מאזין לאירוע פנימי בין הרחבות
   כיבוי הרחבה מחזיר את המערכת בדיוק למצב שלפניה.
   הסרה מלאה = מחיקת הבלוק המסומן ב-index.html. שום קובץ ליבה
   לא מזכיר את ההרחבות, ולכן שום דבר לא יישבר.
   ============================================================ */

const CBX = {
  VERSION: '1.0',
  mods: [],
  _undo: {},      // modKey -> [fn]  (מבוצע בסדר הפוך בכיבוי)
  _hooks: {},     // event -> [{ modKey, fn }]

  state: (function () { try { return JSON.parse(localStorage.getItem('cb_ext')) || {}; } catch (e) { return {}; } })(),
  save() { try { localStorage.setItem('cb_ext', JSON.stringify(CBX.state)); } catch (e) {} },

  /* ---------------- רישום ---------------- */
  register(mod) {
    if (CBX.mods.some(m => m.key === mod.key)) return;
    CBX.mods.push(mod);
    if (CBX.state[mod.key] === undefined) CBX.state[mod.key] = mod.defaultOn !== false;
  },
  isOn(key) { return CBX.state[key] !== false && CBX.mods.some(m => m.key === key); },
  def(key) { return CBX.mods.find(m => m.key === key) || null; },

  /* ---------------- התקנה / כיבוי ---------------- */
  boot() { CBX.mods.forEach(m => { if (CBX.isOn(m.key)) CBX._install(m); }); CBX.save(); },
  _install(m) {
    if (m._installed) return;
    CBX._undo[m.key] = CBX._undo[m.key] || [];
    try { if (typeof m.install === 'function') m.install(); m._installed = true; }
    catch (e) { console.error('[CBX] install ' + m.key, e); CBX._revert(m.key); }
  },
  _revert(key) {
    (CBX._undo[key] || []).slice().reverse().forEach(fn => { try { fn(); } catch (e) { console.error('[CBX] undo ' + key, e); } });
    CBX._undo[key] = [];
    Object.keys(CBX._hooks).forEach(ev => { CBX._hooks[ev] = CBX._hooks[ev].filter(h => h.modKey !== key); });
    const m = CBX.def(key);
    if (m) { try { if (typeof m.uninstall === 'function') m.uninstall(); } catch (e) {} m._installed = false; }
  },
  setOn(key, on) {
    const m = CBX.def(key); if (!m) return;
    CBX.state[key] = !!on; CBX.save();
    if (on) CBX._install(m); else CBX._revert(key);
    if (typeof toast === 'function') toast(m.label + (on ? ' — הופעלה' : ' — כובתה'));
    CBX.redraw();
  },
  redraw() {
    const map = { settings: 'renderSettingsView', contracts: 'renderContractsView', automation: 'renderAutomationView' };
    const f = window[map[typeof navActive !== 'undefined' ? navActive : ''] || 'renderUnifiedView'];
    try { if (typeof f === 'function') f(); } catch (e) {}
  },

  /* ---------------- כלי חיבור ---------------- */
  _remember(modKey, fn) { (CBX._undo[modKey] = CBX._undo[modKey] || []).push(fn); },

  /* עוטף פונקציה גלובלית.
     חשוב: לא עוטפים פיזית אחד מעל השני — כי אז אי אפשר להסיר הרחבה
     שנעטפה מתחת לאחרת. במקום זה מותקן "מנתב" יציב אחד לכל שם פונקציה,
     והשכבות יושבות ברשימה. הסרה = הוצאה מהרשימה, בכל סדר שהוא. */
  _disp: {},
  wrap(modKey, name, factory) {
    let d = CBX._disp[name];
    if (!d) {
      const orig = window[name];
      if (typeof orig !== 'function') { console.warn('[CBX] אין פונקציה לעטוף: ' + name); return; }
      d = CBX._disp[name] = { orig, layers: [], chain: orig };
      window[name] = function () { return d.chain.apply(this, arguments); };
      window[name].__cbx = name;
    }
    const layer = { modKey, factory };
    d.layers.push(layer);
    CBX._rebuild(name);
    CBX._remember(modKey, () => {
      const i = d.layers.indexOf(layer); if (i >= 0) d.layers.splice(i, 1);
      if (!d.layers.length) { window[name] = d.orig; delete CBX._disp[name]; }
      else CBX._rebuild(name);
    });
  },
  _rebuild(name) {
    const d = CBX._disp[name]; if (!d) return;
    let fn = d.orig;
    d.layers.forEach(L => { fn = L.factory(fn); });
    d.chain = fn;
  },
  /* מוסיף פריטים למערך קיים */
  push(modKey, arr, items) {
    if (!Array.isArray(arr)) return;
    const list = [].concat(items);
    list.forEach(it => arr.push(it));
    CBX._remember(modKey, () => list.forEach(it => { const i = arr.indexOf(it); if (i >= 0) arr.splice(i, 1); }));
  },
  /* מוסיף מפתחות לאובייקט קיים (כמו AUTO_IMPL) */
  assign(modKey, obj, patch) {
    if (!obj) return;
    const keys = Object.keys(patch), had = {};
    keys.forEach(k => { had[k] = Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined; obj[k] = patch[k]; });
    CBX._remember(modKey, () => keys.forEach(k => { if (had[k] === undefined) delete obj[k]; else obj[k] = had[k]; }));
  },
  /* טוען גיליון סגנון של הרחבה — ומסיר אותו בכיבוי */
  css(modKey, id, text) {
    if (document.getElementById(id)) return;
    const st = document.createElement('style'); st.id = id; st.textContent = text;
    document.head.appendChild(st);
    CBX._remember(modKey, () => { const e = document.getElementById(id); if (e) e.remove(); });
  },

  /* מאזין מואצל ברמת המסמך.
     כפתור שנבנה ע"י הרחבה עלול לאבד את המאזין שלו אם הצומת מוחלף
     בין הנגיעה ללחיצה (קורה במגע). מאזין מואצל לא תלוי בצומת ולכן
     תמיד עובד. אם מאזין קיים כבר טיפל ועצר את ההתפשטות — זה לא ירוץ. */
  delegate(modKey, selector, handler) {
    const fn = e => {
      const el = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (!el || !document.body.contains(el)) return;
      handler(el, e);
    };
    document.addEventListener('click', fn);
    CBX._remember(modKey, () => document.removeEventListener('click', fn));
  },

  /* אירועים פנימיים */
  on(modKey, ev, fn) { (CBX._hooks[ev] = CBX._hooks[ev] || []).push({ modKey, fn }); },
  emit(ev, data) { (CBX._hooks[ev] || []).forEach(h => { try { h.fn(data); } catch (e) { console.error('[CBX] hook ' + ev, e); } }); },

  /* אחסון פר-הרחבה */
  load(key, fallback) { try { const v = JSON.parse(localStorage.getItem('cbx_' + key)); return v == null ? fallback : v; } catch (e) { return fallback; } },
  store(key, val) { try { localStorage.setItem('cbx_' + key, JSON.stringify(val)); } catch (e) {} },

  /* עזר: כסף */
  money(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('he-IL') + ' ₪'; },
};

/* ---------------- פאנל ניהול ההרחבות ---------------- */
function openExtPanel() {
  const old = document.getElementById('extPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'extPanel';
  const render = () => {
    w.innerHTML = `<div class="cbc-box cbx-box">
      <div class="cbc-head"><span class="cbc-ic">${ic('layers')}</span><b>הרחבות המערכת</b></div>
      <p class="cbx-lead">כל הרחבה היא מודול עצמאי שלא נוגע בקוד הליבה. כיבוי מחזיר את המערכת
        בדיוק למצב שלפניה — הנתונים נשמרים ושום מסך אחר לא מושפע.
        להסרה מוחלטת: מחיקת הבלוק המסומן <code>ext</code> ב־index.html.</p>
      <div class="cbx-list">${CBX.mods.map(m => `
        <div class="cbx-item ${CBX.isOn(m.key) ? 'on' : ''}">
          <span class="cbx-ic">${ic(m.icon || 'layers')}</span>
          <span class="cbx-t"><b>${esc(m.label)}</b><small>${esc(m.desc || '')}</small>
            ${(m.files || []).length ? `<span class="cbx-files">${esc(m.files.join(' · '))}</span>` : ''}</span>
          <label class="cbx-sw"><input type="checkbox" data-cbx="${m.key}" ${CBX.isOn(m.key) ? 'checked' : ''}><span></span></label>
        </div>`).join('') || '<p class="cbx-empty">לא נטענו הרחבות.</p>'}</div>
      <div class="cbc-actions"><button class="btn primary" id="cbxClose">${ic('check')} סיום</button></div>
    </div>`;
    $$('[data-cbx]', w).forEach(c => c.addEventListener('change', () => { CBX.setOn(c.dataset.cbx, c.checked); render(); }));
    $('#cbxClose', w).addEventListener('click', () => w.remove());
  };
  render();
  w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
  document.body.appendChild(w);
}

/* ============================================================
   רשת ביטחון: מסך האוטומציות מקבץ לפי רשימות מפתחות קבועות,
   ולכן כל חוק שהרחבה מוסיפה לא היה מופיע בו כלל — הוא רץ, אבל
   בלתי נראה. כאן נוסף אזור אוסף שתופס כל חוק שאינו משויך.
   ============================================================ */
(function () {
  if (typeof AUTO_AREAS === 'undefined' || typeof autoAreaList !== 'function') return;
  const EXTRA = { key: 'cbxExtra', label: 'תוספות והרחבות', icon: 'layers', keys: [] };
  if (!AUTO_AREAS.some(a => a.key === EXTRA.key)) AUTO_AREAS.push(EXTRA);
  const orig = autoAreaList;
  window.autoAreaList = function (ar) {
    if (ar && ar.key === EXTRA.key) {
      const claimed = {};
      AUTO_AREAS.forEach(a => { if (a.key !== EXTRA.key) (a.keys || []).forEach(k => { claimed[k] = 1; }); });
      return (typeof autoAll === 'function' ? autoAll() : []).filter(a => !claimed[a.key]);
    }
    return orig.apply(this, arguments);
  };
})();

/* ============================================================
   כניסה למסך ההרחבות — מקום אחד בלבד, בקבוצת "הגדרות מנהל".
   הכרטיס הקודם נדבק לתחתית כל מסך הגדרות והיה רק רעש.
   ============================================================ */
(function () {
  if (typeof SET_GROUPS === 'undefined' || typeof applySetMode !== 'function') return;
  let extMode = false;
  const g = SET_GROUPS.find(x => x.key === 'manage');
  if (g && !g.items.some(i2 => i2.m === 'cbxExt'))
    g.items.push({ m: 'cbxExt', label: 'הרחבות המערכת', icon: 'layers', desc: 'הפעלה וכיבוי של מודולים' });
  const origApply = applySetMode;
  window.applySetMode = function (m) { extMode = m === 'cbxExt'; return origApply.apply(this, arguments); };
  if (typeof currentSetModeKey === 'function') {
    const origCur = currentSetModeKey;
    window.currentSetModeKey = function () { return extMode ? 'cbxExt' : origCur.apply(this, arguments); };
  }
  if (typeof renderSettingsView === 'function') {
    const origRender = renderSettingsView;
    window.renderSettingsView = function () {
      if (!extMode) return origRender.apply(this, arguments);
      document.getElementById('viewHost').innerHTML =
        (typeof settingsHeader === 'function' ? settingsHeader() : '') + extScreenHTML();
      if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
      extScreenBind();
    };
  }
  window.extScreenHTML = function () {
    const on = CBX.mods.filter(m => CBX.isOn(m.key)).length;
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${on}</b><small>הרחבות פעילות</small></div>
        <div class="inv-kpi"><b>${CBX.mods.length - on}</b><small>כבויות</small></div>
        <div class="inv-kpi"><b>${CBX.mods.length}</b><small>סה״כ מודולים</small></div>
      </div>
      <p class="cbx-lead">כל הרחבה היא מודול עצמאי שלא נוגע בקוד הליבה. כיבוי מחזיר את המערכת
        בדיוק למצב שלפניה — הנתונים נשמרים ושום מסך אחר לא מושפע.</p>
      <div class="cbx-list">${CBX.mods.map(m => `
        <div class="cbx-item ${CBX.isOn(m.key) ? 'on' : ''}">
          <span class="cbx-ic">${ic(m.icon || 'layers')}</span>
          <span class="cbx-t"><b>${esc(m.label)}</b><small>${esc(m.desc || '')}</small>
            ${(m.files || []).length ? `<span class="cbx-files">${esc(m.files.join(' · '))}</span>` : ''}</span>
          <label class="cbx-sw"><input type="checkbox" data-cbx="${m.key}" ${CBX.isOn(m.key) ? 'checked' : ''}><span></span></label>
        </div>`).join('')}</div>
    </div>`;
  };
  window.extScreenBind = function () {
    $$('[data-cbx]').forEach(c => c.addEventListener('change', () => {
      CBX.setOn(c.dataset.cbx, c.checked);
      if (typeof renderSettingsView === 'function') renderSettingsView();
    }));
  };
})();
