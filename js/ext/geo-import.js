/* ============================================================
   הרחבה: ייבוא מרשם יישובים  ·  key = 'geoimport'
   ------------------------------------------------------------
   הרשימה המובנית לעולם לא תהיה מלאה — במרשם היישובים של הלמ״ס יש
   כ-1,270 יישובים (כולל קיבוצים, מושבים ויישובים קהילתיים).
   במקום לנחש, כאן יש נתיב ייבוא: מדביקים או מעלים קובץ עם עמודת
   שם (ואם יש — גם מחוז/אזור), והמרשם מוחלף במלואו ונשמר.

   מקורות מתאימים: קובץ היישובים של הלמ״ס, data.gov.il, או כל
   טבלה פנימית. תומך CSV / TSV / הדבקה מאקסל.
   ============================================================ */
(function () {

  const KEY = 'cb_geoRegistry';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const save = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  /* זיהוי העמודות לבד — שם היישוב הוא העמודה עם הכי הרבה טקסט עברי */
  function parse(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { rows: [], cols: 0 };
    const split = l => l.indexOf('\t') >= 0 ? l.split('\t') : l.split(',');
    const table = lines.map(split).map(a => a.map(c => c.replace(/^["']|["']$/g, '').trim()));
    const cols = Math.max.apply(null, table.map(a => a.length));
    const heb = s => /[֐-׿]/.test(s);
    /* עמודת השם: הכי הרבה תאים עבריים; עמודת המחוז: השנייה אחריה */
    let nameCol = 0, best = -1;
    for (let c = 0; c < cols; c++) {
      const n = table.filter(a => heb(a[c] || '')).length;
      if (n > best) { best = n; nameCol = c; }
    }
    let regCol = -1, bestR = -1;
    for (let c = 0; c < cols; c++) {
      if (c === nameCol) continue;
      const vals = table.map(a => a[c] || '').filter(heb);
      const uniq = new Set(vals).size;
      /* מחוז = הרבה חזרות על מעט ערכים */
      if (vals.length > table.length * 0.5 && uniq < Math.max(3, table.length / 5) && vals.length > bestR) { bestR = vals.length; regCol = c; }
    }
    const first = table[0][nameCol] || '';
    const start = /שם|יישוב|ישוב|city|name/i.test(first) ? 1 : 0;
    const seen = {}, rows = [];
    for (let i = start; i < table.length; i++) {
      const nm = (table[i][nameCol] || '').trim();
      if (!nm || !heb(nm)) continue;
      if (seen[nm]) continue; seen[nm] = 1;
      rows.push({ name: nm, official: nm, region: regCol >= 0 ? (table[i][regCol] || '') : '' });
    }
    return { rows, cols, nameCol, regCol };
  }

  function apply(rows) {
    if (!rows || !rows.length) return 0;
    save(rows);
    window.IL_CITIES_EXT = rows.slice();
    return rows.length;
  }

  /* ---------------- פאנל הייבוא ---------------- */
  function openImport() {
    const old = document.getElementById('geoImp'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'geoImp';
    const cur = (window.IL_CITIES_EXT || []).length;
    let parsed = null;
    const render = () => {
      w.innerHTML = `<div class="cbc-box gi-box" style="max-width:560px;text-align:start">
        <div class="cbc-head"><span class="cbc-ic">${ic('org')}</span><b>ייבוא מרשם יישובים</b></div>
        <p class="gi-lead">המרשם הנוכחי מכיל <b>${cur}</b> יישובים. הדביקו טבלה מאקסל או העלו CSV —
          המערכת תזהה לבד את עמודת השם ואת עמודת המחוז, ותחליף את המרשם כולו.</p>
        <div class="gi-row">
          <label class="gi-file">${ic('docs')} העלאת קובץ CSV / TXT
            <input type="file" id="giFile" accept=".csv,.txt,.tsv"></label>
          <button class="btn sm" id="giClear">${ic('sync')} חזרה למרשם המובנה</button>
        </div>
        <textarea class="cc-inp gi-ta" id="giText" rows="7"
          placeholder="שם יישוב,מחוז&#10;תל אביב-יפו,תל אביב&#10;כפר ורדים,צפון&#10;…"></textarea>
        ${parsed ? `<div class="gi-prev">
          <b>${ic('check')} זוהו ${parsed.rows.length} יישובים</b>
          <small>עמודת שם: ${parsed.nameCol + 1}${parsed.regCol >= 0 ? ' · עמודת מחוז: ' + (parsed.regCol + 1) : ' · לא זוהתה עמודת מחוז'}</small>
          <div class="gi-chips">${parsed.rows.slice(0, 8).map(r => `<span>${esc(r.official)}${r.region ? ' · ' + esc(r.region) : ''}</span>`).join('')}
            ${parsed.rows.length > 8 ? `<span class="more">+${parsed.rows.length - 8}</span>` : ''}</div>
        </div>` : ''}
        <div class="cbc-actions">
          <button class="btn ghost" id="giCancel">ביטול</button>
          <button class="btn" id="giCheck">${ic('eye')} בדיקה</button>
          <button class="btn primary" id="giSave" ${parsed && parsed.rows.length ? '' : 'disabled'}>${ic('check')} ייבוא והחלפה</button>
        </div></div>`;
      const ta = w.querySelector('#giText');
      w.querySelector('#giCheck').addEventListener('click', () => { parsed = parse(ta.value); render(); });
      w.querySelector('#giCancel').addEventListener('click', () => w.remove());
      w.querySelector('#giClear').addEventListener('click', () => {
        clear(); toast('חזרה למרשם המובנה — יש לרענן את הדף'); w.remove();
      });
      w.querySelector('#giSave').addEventListener('click', () => {
        const n = apply(parsed && parsed.rows);
        toast(n ? `יובאו ${n} יישובים · ההשלמה מעודכנת` : 'לא זוהו יישובים');
        w.remove();
      });
      const f = w.querySelector('#giFile');
      f.addEventListener('change', () => {
        const file = f.files && f.files[0]; if (!file) return;
        const rd = new FileReader();
        rd.onload = () => { ta.value = String(rd.result || ''); parsed = parse(ta.value); render(); };
        rd.readAsText(file, 'utf-8');
      });
    };
    render();
    document.body.appendChild(w);
    w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
  }

  CBX.register({
    key: 'geoimport', label: 'ייבוא מרשם יישובים', icon: 'org',
    desc: 'נתיב ייבוא לרשימת היישובים המלאה — הדבקה מאקסל או קובץ CSV. המערכת מזהה לבד את עמודת השם ואת המחוז, ומחליפה את המרשם שההשלמה עובדת מולו.',
    files: ['js/ext/geo-import.js'],
    install() {
      /* מרשם שיובא גובר על המובנה */
      const saved = load();
      if (saved && saved.length) window.IL_CITIES_EXT = saved;

      /* כפתור בתוך שדה הכתובת */
      if (typeof leadAddrHTML === 'function') CBX.wrap('geoimport', 'leadAddrHTML', o => function (r) {
        const html = o.apply(this, arguments);
        return html.replace('</div>\n  </div>', '</div>\n  </div>')
          .replace(/(<div class="geo-head">[\s\S]*?<\/div>)/,
            `$1<button class="btn xs gi-open" data-geoimp>${ic('org')} מרשם היישובים (${(window.IL_CITIES_EXT || []).length})</button>`);
      });
      CBX.delegate('geoimport', '[data-geoimp]', () => openImport());
    },
  });

  window.GEOIMP = { parse, apply, open: openImport, saved: load, clear };
})();
