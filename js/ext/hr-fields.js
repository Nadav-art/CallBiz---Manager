/* ============================================================
   הרחבה: שדות תיק עובד מלאים  ·  key = 'hrx'
   ------------------------------------------------------------
   מרחיבה את תיק העובד למבנה שבשימוש בפועל: פרטים כלליים עם גיל
   מחושב, דרכי התקשרות, אילוצים וזמינות, פרטים נוספים, תיעוד
   הדרכות, ביצועים ומשובים לנציג.
   אותה שיטת סכימה כמו בגיוס — הוספת שדה היא שורה אחת.
   ============================================================ */
(function () {

  const EMP_ST = ['עובד פעיל', 'בהקפאה', 'בחופשת לידה', 'לפני סיום', 'סיים עבודה'];
  const GENDER = ['זכר', 'נקבה', 'אחר'];
  const CAME = ['מודעה', 'המלצת עובד', 'לינקדאין', 'פייסבוק', 'חברת השמה', 'פנייה יזומה'];
  const LANGS = ['עברית', 'אנגלית', 'רוסית', 'ערבית', 'צרפתית', 'ספרדית', 'אמהרית'];
  const SCORE = ['— בחר —', '1 — חלש', '2 — מתחת לממוצע', '3 — סביר', '4 — טוב', '5 — מצוין'];
  const TRAIN_ST = ['טרם החל', 'בתהליך', 'הושלם', 'נדרש רענון'];

  /* ---------------- סכימה ---------------- */
  const SECTIONS = {
    file: [
      { title: 'פרטים כלליים', fields: [
        { k: 'empNo', l: 'מס׳ עובד', t: 'lock' },
        { k: 'first', l: 'שם פרטי', t: 'text', req: true },
        { k: 'last', l: 'שם משפחה', t: 'text' },
        { k: 'status', l: 'סטטוס', t: 'sel', o: EMP_ST, tag: 'green' },
        { k: 'dept', l: 'מחלקה', t: 'sel', o: () => (typeof DEPARTMENTS !== 'undefined' ? DEPARTMENTS : []), tag: 'amber' },
        { k: 'roleCo', l: 'תפקיד בחברה', t: 'text' },
        { k: 'roleIn', l: 'תפקיד פנימי', t: 'text' },
        { k: 'birth', l: 'תאריך לידה', t: 'date' },
        { k: 'age', l: 'גיל', t: 'age', from: 'birth' },
        { k: 'idnum', l: 'ת.ז', t: 'text' },
        { k: 'gender', l: 'מגדר', t: 'sel', o: GENDER, tag: 'cyan' },
        { k: 'came', l: 'מהיכן הגעת אלינו?', t: 'sel', o: CAME },
        { k: 'start', l: 'תאריך תחילת עבודה', t: 'date', w: 'full' },
      ] },
      { title: 'דרכי התקשרות', fields: [
        { k: 'phone', l: 'טלפון ראשי', t: 'tel' },
        { k: 'mail', l: 'דואר אלקטרוני', t: 'mail' },
        { k: 'area', l: 'אזור מגורים', t: 'geo' },
      ] },
      { title: 'אילוצים', fields: [
        { k: 'weekend', l: 'כולל עבודה בסופי שבוע', t: 'chk' },
        { k: 'vacNotes', l: 'הערות לחופשה', t: 'area', w: 'full' },
        { k: 'limits', l: 'אילוצים', t: 'area', w: 'full' },
      ] } ],
    extra: [
      { title: 'נתונים נוספים', fields: [
        { k: 'langs', l: 'שפות', t: 'multi', o: LANGS },
        { k: 'exp', l: 'ניסיון', t: 'text' },
        { k: 'skills', l: 'יכולות', t: 'text' },
        { k: 'notes', l: 'הערות', t: 'area', w: 'full' },
        { k: 'religion', l: 'דת', t: 'text' },
        { k: 'jobExp', l: 'ניסיון תעסוקתי', t: 'area', w: 'full', hint: 'רקע תעסוקתי קודם — משמש גם לשיבוץ וגם לפיתוח' },
      ] } ],
    training: [
      { title: 'תיעוד הדרכות', list: 'trainings' } ],
    perf: [
      { title: 'ביצועים', fields: [
        { k: 'pQuota', l: 'יעד חודשי', t: 'num' },
        { k: 'pDone', l: 'ביצוע בפועל', t: 'num' },
        { k: 'pRate', l: 'אחוז עמידה ביעד', t: 'ratio', a: 'pDone', b: 'pQuota' },
        { k: 'pCsat', l: 'שביעות רצון לקוחות', t: 'score' },
        { k: 'pNotes', l: 'הערות ביצועים', t: 'area', w: 'full' },
      ] } ],
    feedback: [
      { title: 'משובים לנציג', fields: [
        { k: 'fTotal', l: 'ציון כללי', t: 'calc', from: ['fPro', 'fService', 'fTeam', 'fLearn', 'fDisc'] },
        { k: 'fPro', l: 'מקצועיות ושליטה בתפקיד', t: 'score' },
        { k: 'fService', l: 'שירותיות ויחס ללקוח', t: 'score' },
        { k: 'fTeam', l: 'עבודת צוות', t: 'score' },
        { k: 'fLearn', l: 'למידה והשתפרות', t: 'score' },
        { k: 'fDisc', l: 'עמידה בנהלים ובמשמעת', t: 'score' },
        { k: 'fKeep', l: 'נקודות לשימור', t: 'area', w: 'full' },
        { k: 'fImprove', l: 'נקודות לשיפור', t: 'area', w: 'full' },
        { k: 'fBy', l: 'ניתן על ידי', t: 'sel', o: () => (typeof STAFF !== 'undefined' ? STAFF.map(s => s.name) : []) },
        { k: 'fDate', l: 'תאריך המשוב', t: 'date' },
      ] } ],
  };

  const opts = f => typeof f.o === 'function' ? (f.o() || []) : (f.o || []);
  const hx = e => (e.hx = e.hx || {});
  const v = (e, k) => { const x = e.hx || {}; return x[k] == null ? '' : x[k]; };

  /* גיל מחושב בשפה של השדה המקורי: "לפני 27 שנים, 11 חודשים" */
  function ageText(birth) {
    if (!birth) return '—';
    const b = Date.parse(birth), t = Date.parse((typeof clockTodayISO === 'function') ? clockTodayISO() : '');
    if (isNaN(b) || isNaN(t) || t < b) return '—';
    const d1 = new Date(b), d2 = new Date(t);
    let y = d2.getFullYear() - d1.getFullYear(), m = d2.getMonth() - d1.getMonth();
    if (d2.getDate() < d1.getDate()) m--;
    if (m < 0) { y--; m += 12; }
    return 'לפני ' + y + ' שנים, ' + m + ' חודשים';
  }
  function calc(e, f) {
    const n = f.from.map(k => parseInt(v(e, k), 10)).filter(x => !isNaN(x) && x > 0);
    return n.length ? Math.round(n.reduce((a, b) => a + b, 0) / n.length * 10) / 10 : '';
  }

  function fieldHTML(emp, f) {
    const val = v(emp, f.k);
    const wrap = inner => `<label class="ax-f ${f.w === 'full' ? 'full' : ''}">
      <span>${esc(f.l)}${f.req ? ' <i class="ax-req">*</i>' : ''}</span>${inner}
      ${f.hint ? `<i class="ax-hint">${esc(f.hint)}</i>` : ''}</label>`;
    if (f.t === 'lock') return `<div class="ax-f"><span>${esc(f.l)}</span>
      <div class="ax-lock">${ic('lock')} <b>${esc(val || emp.id)}</b></div></div>`;
    if (f.t === 'age') return `<div class="ax-f"><span>${esc(f.l)}</span>
      <div class="ax-lock calc">${ic('history')} <b>${esc(ageText(v(emp, f.from)))}</b></div></div>`;
    if (f.t === 'ratio') { const a = +v(emp, f.a) || 0, b = +v(emp, f.b) || 0;
      const p = b ? Math.round(a / b * 100) : 0;
      return `<div class="ax-f"><span>${esc(f.l)}</span>
        <div class="ax-lock calc"><b class="${p >= 100 ? 'good' : p >= 70 ? '' : 'bad'}">${b ? p + '%' : '—'}</b></div>
        <span class="ax-bar"><i style="width:${Math.min(100, p)}%" class="${p >= 100 ? 'good' : p >= 70 ? 'mid' : 'bad'}"></i></span></div>`; }
    if (f.t === 'calc') { const n = calc(emp, f);
      return `<div class="ax-f ax-calc"><span>${esc(f.l)}</span>
        <b class="${n >= 4 ? 'good' : n && n < 3 ? 'bad' : ''}">${n === '' ? '—' : n}</b>
        <i>ממוצע ${f.from.length} קריטריונים</i></div>`; }
    if (f.t === 'score') return wrap(`<select class="cc-inp" data-hx="${f.k}">
      ${SCORE.map((s, i) => `<option value="${i}" ${String(val) === String(i) ? 'selected' : ''}>${s}</option>`).join('')}</select>`);
    if (f.t === 'sel') return wrap(`<select class="cc-inp ${f.tag && val ? 'ax-tag ' + f.tag : ''}" data-hx="${f.k}">
      <option value="">— בחר —</option>
      ${opts(f).map(o => `<option ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`);
    if (f.t === 'multi') { const cur = String(val || '').split(',').filter(Boolean);
      return `<div class="ax-f ${f.w === 'full' ? 'full' : ''}"><span>${esc(f.l)}</span>
        <div class="ax-multi">${opts(f).map(o => `<button type="button" class="fx-chip ${cur.indexOf(o) >= 0 ? 'on' : ''}"
          data-hxm="${f.k}|${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`; }
    if (f.t === 'chk') return `<label class="ax-f ax-chk"><input type="checkbox" data-hx="${f.k}" ${val ? 'checked' : ''}>
      <span>${esc(f.l)}</span></label>`;
    if (f.t === 'area') return wrap(`<textarea class="cc-inp" rows="3" data-hx="${f.k}">${esc(val)}</textarea>`);
    if (f.t === 'geo') return wrap(`<div class="ax-geo">${ic('target')}<input class="cc-inp" data-hx="${f.k}" value="${esc(val)}"></div>`);
    if (f.t === 'num') return wrap(`<input class="cc-inp" type="number" min="0" data-hx="${f.k}" value="${esc(val)}">`);
    const type = f.t === 'date' ? 'date' : f.t === 'tel' ? 'tel' : f.t === 'mail' ? 'email' : 'text';
    return wrap(`<input class="cc-inp" type="${type}" data-hx="${f.k}" value="${esc(val)}">`);
  }

  /* הדרכות — רשימה ולא שדות */
  function trainHTML(emp) {
    const list = (emp.hx && emp.hx.trainings) || [];
    return `<div class="ax-train">${list.map((t, i) => `<div class="ax-tr">
        <input class="cc-inp sm" value="${esc(t.name)}" data-hxtn="${i}" placeholder="שם ההדרכה">
        <select class="cc-inp sm" data-hxts="${i}">${TRAIN_ST.map(s => `<option ${t.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input class="cc-inp sm" type="date" value="${esc(t.at || '')}" data-hxtd="${i}">
        <button class="btn xs" data-hxtx="${i}">${ic('close')}</button>
      </div>`).join('') || '<p class="fx-none">טרם תועדו הדרכות</p>'}
      <button class="btn sm" id="hxTrAdd">${ic('plus')} הוסף הדרכה</button></div>`;
  }

  function sectionsHTML(emp, key) {
    const secs = SECTIONS[key] || [];
    return secs.map(g => `<section class="ax-group">
      <div class="ax-g-h">${ic('layers')} <b>${esc(g.title)}</b></div>
      ${g.list === 'trainings' ? trainHTML(emp) : `<div class="ax-grid">${g.fields.map(f => fieldHTML(emp, f)).join('')}</div>`}
    </section>`).join('');
  }

  function bindSections(emp, RR) {
    $$('[data-hx]').forEach(e => e.addEventListener('change', () => {
      hx(emp)[e.dataset.hx] = e.type === 'checkbox' ? e.checked : e.value;
      const live = ['birth', 'first', 'last', 'status', 'dept', 'gender', 'pDone', 'pQuota'];
      if (live.indexOf(e.dataset.hx) >= 0 || /^f[A-Z]/.test(e.dataset.hx)) RR();
    }));
    $$('[data-hxm]').forEach(b => b.addEventListener('click', () => {
      const [k, o] = b.dataset.hxm.split('|');
      const cur = String(v(emp, k) || '').split(',').filter(Boolean);
      const i = cur.indexOf(o); if (i >= 0) cur.splice(i, 1); else cur.push(o);
      hx(emp)[k] = cur.join(','); RR(); }));
    const tr = () => (hx(emp).trainings = hx(emp).trainings || []);
    $$('[data-hxtn]').forEach(i => i.addEventListener('change', () => { tr()[+i.dataset.hxtn].name = i.value; }));
    $$('[data-hxts]').forEach(i => i.addEventListener('change', () => { tr()[+i.dataset.hxts].st = i.value; RR(); }));
    $$('[data-hxtd]').forEach(i => i.addEventListener('change', () => { tr()[+i.dataset.hxtd].at = i.value; }));
    $$('[data-hxtx]').forEach(b => b.addEventListener('click', () => { tr().splice(+b.dataset.hxtx, 1); RR(); }));
    const ad = $('#hxTrAdd'); if (ad) ad.addEventListener('click', () => {
      tr().push({ name: '', st: TRAIN_ST[0], at: '' }); RR(); });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'hrx', label: 'שדות תיק עובד מלאים', icon: 'user',
    desc: 'תיק עובד במבנה העבודה בפועל: פרטים כלליים עם גיל מחושב, אילוצים וזמינות, פרטים נוספים, תיעוד הדרכות, ביצועים ומשובים לנציג.',
    files: ['js/ext/hr-fields.js'],
    install() {
      /* לשוניות נוספות בתיק העובד */
      if (typeof HR_TABS !== 'undefined') CBX.push('hrx', HR_TABS, [
        { key: 'extra', label: 'פרטים נוספים', icon: 'docs' },
        { key: 'training', label: 'תיעוד הדרכות', icon: 'check' },
        { key: 'perf', label: 'ביצועים', icon: 'reports' },
        { key: 'feedback', label: 'משובים לנציג', icon: 'note' },
      ]);
      /* מחליף את לשונית "תיק עובד" בסכימה המלאה, ומספק את החדשות */
      if (typeof hrTabHTML === 'function') CBX.wrap('hrx', 'hrTabHTML', o => function (tab, emp, h) {
        if (SECTIONS[tab]) {
          /* מזריעים מהשדות הקיימים כדי שלא יתחיל ריק */
          const x = hx(emp);
          if (x.first === undefined) {
            const parts = String(emp.name || '').trim().split(/\s+/);
            x.first = parts[0] || ''; x.last = parts.slice(1).join(' ');
            x.empNo = emp.id; x.status = EMP_ST[0]; x.dept = emp.dept || '';
            x.roleCo = emp.role || ''; x.phone = emp.phone || ''; x.mail = emp.mail || '';
          }
          return sectionsHTML(emp, tab);
        }
        return o.apply(this, arguments);
      });
      if (typeof hrPanelHTML === 'function') CBX.wrap('hrx', 'hrPanelHTML', o => function () {
        const r = o.apply(this, arguments);
        setTimeout(() => {
          const emp = (typeof STAFF !== 'undefined' && typeof hrEmp !== 'undefined')
            ? STAFF.find(s => s.id === hrEmp) : null;
          if (emp) bindSections(emp, () => {
            if (typeof renderSettingsView === 'function') renderSettingsView();
          });
        }, 0);
        return r;
      });
      /* השדות החדשים זמינים גם לניהול השדות ולדוחות */
      CBX.on('hrx', 'fx:staffTabs', ev => { ev.tabs = ev.tabs.concat(
        [{ key: 'extra', label: 'פרטים נוספים' }, { key: 'perf', label: 'ביצועים' }, { key: 'feedback', label: 'משובים לנציג' }]); });
    },
  });

  window.HRX = { sections: SECTIONS, html: sectionsHTML, bind: bindSections, age: ageText, val: v };
})();
