/* ============================================================
   הרחבה: שדות גיוס מלאים  ·  key = 'atsx'
   ------------------------------------------------------------
   מרחיבה את כרטיס המועמד למבנה שבשימוש בפועל: לשוניות, קבוצות
   שדות, משובי גיוס מדורגים, משוב איכות שיחה למגייס/ת, ניתוח
   התאמה מקו״ח ומוטיבציה.
   בנויה כסכימה ולא כ-HTML קשיח — הוספת שדה היא שורה אחת,
   וגם ניהול השדות של המערכת יכול להוסיף לכאן.
   ============================================================ */
(function () {

  /* ---------------- ערכי בחירה ---------------- */
  const SCORE = ['לא רלוונטי', '1 — חלש', '2 — מתחת לממוצע', '3 — סביר', '4 — טוב', '5 — מצוין'];
  const YESNO = ['כן', 'לא', 'חלקית'];
  const FIT = ['מתאים מאוד', 'מתאים', 'מתאים בהסתייגות', 'לא מתאים'];
  const LANG = ['שפת אם', 'טובה מאוד', 'טובה', 'בסיסית', 'ללא'];
  const CAND_ST = ['חדש', 'ממתין לקשר ראשוני', 'בתהליך', 'ממתין למועמד', 'הוקפא', 'נפסל', 'התקבל'];
  const SUB_ST = ['ממתין לקשר ראשוני', 'נקבעה שיחה', 'בוצעה שיחה', 'הועבר לראיון', 'ממתין למבחן', 'ממתין להצעה'];
  const REC_TYPE = ['פייג', 'ישיר', 'חברת השמה', 'פנימי', 'המלצת עובד'];
  const ORIGIN = ['פייסבוק', 'לינקדאין', 'אתר החברה', 'לוח דרושים', 'המלצה', 'פנייה יזומה', 'אינסטגרם'];
  const QUALITY = ['A — איכות גבוהה', 'B — בינונית', 'C — נמוכה'];
  const SECTORS = ['מכירות', 'שירות', 'גבייה', 'תפעול', 'ניהול'];

  /* ---------------- סכימת השדות ----------------
     t: סוג · l: תווית · w:'full' תופס שורה מלאה */
  const TABS = [
    { key: 'main', label: 'פרטי מועמד', icon: 'user', groups: [
      { title: 'פרטי מועמד', fields: [
        { k: 'first', l: 'שם פרטי', t: 'text' },
        { k: 'last', l: 'שם משפחה', t: 'text' },
        { k: 'phone', l: 'טלפון', t: 'tel' },
        { k: 'mail', l: 'מייל', t: 'mail' },
        { k: 'dept', l: 'מחלקה', t: 'sel', o: () => (typeof DEPARTMENTS !== 'undefined' ? DEPARTMENTS : []) },
        { k: 'candSt', l: 'סטטוס מועמד', t: 'sel', o: CAND_ST, tag: 'green' },
        { k: 'subSt', l: 'סטטוס משני', t: 'sel', o: SUB_ST },
        { k: 'recType', l: 'סוג גיוס', t: 'sel', o: REC_TYPE },
        { k: 'quality', l: 'איכות המועמד', t: 'sel', o: QUALITY },
        { k: 'recruiter', l: 'מגייס/ת', t: 'sel', o: () => (typeof STAFF !== 'undefined' ? STAFF.map(s => s.name) : []) },
        { k: 'origin', l: 'מקור הגעה', t: 'sel', o: ORIGIN },
        { k: 'forJob', l: 'מועמד לתפקיד', t: 'job' },
        { k: 'salary', l: 'ציפיות שכר', t: 'text' },
        { k: 'followUp', l: 'תאריך Follow Up', t: 'date' },
        { k: 'salesExp', l: 'האם יש לך ניסיון במכירות?', t: 'sel', o: YESNO },
        { k: 'cv', l: 'קורות חיים', t: 'text' },
        { k: 'cvLink', l: 'קישור לקו״ח', t: 'url', w: 'full' },
        { k: 'about', l: 'קצת על עצמי', t: 'area', w: 'full' },
      ] },
      { title: 'ניתוח התאמה — קורות חיים', fields: [
        { k: 'fitPct', l: 'אחוז התאמה מספרי', t: 'num', suffix: '%', bar: true },
        { k: 'fitType', l: 'סוג התאמה', t: 'sel', o: FIT },
        { k: 'sugRole', l: 'תפקיד מוצע', t: 'text' },
        { k: 'english', l: 'אנגלית ברמת שפת אם / טובה מאוד?', t: 'sel', o: LANG },
        { k: 'expSum', l: 'סיכום ניסיון מקצועי', t: 'area', w: 'full' },
        { k: 'fitWhy', l: 'הסבר', t: 'area', w: 'full' },
      ] } ] },

    { key: 'data', label: 'נתוני מועמד', icon: 'docs', groups: [
      { title: 'זמינות והתאמה תפעולית', fields: [
        { k: 'jobExp', l: 'ניסיון תעסוקתי', t: 'text' },
        { k: 'lives', l: 'מגורים', t: 'text' },
        { k: 'hoursDay', l: 'שעות יומיות', t: 'text' },
        { k: 'hoursRange', l: 'טווח שעות', t: 'text' },
        { k: 'limits', l: 'מגבלות', t: 'text' },
        { k: 'startEta', l: 'צפי לתחילת עבודה', t: 'date' },
      ] } ],
      actions: [
        { k: 'didTech', l: 'בוצע מבדק טכני', color: 'green' },
        { k: 'didFirst', l: 'בוצעה שיחה ראשונית', color: 'orange' },
        { k: 'didCall', l: 'בוצעה שיחה עם מועמד', color: 'amber' },
      ] },

    { key: 'motiv', label: 'מוטיבציה', icon: 'bolt', groups: [
      { title: 'מוטיבציה', fields: [
        { k: 'whyNew', l: 'למה מחפש עבודה חדשה?', t: 'area', w: 'full', max: 255 },
        { k: 'whySales', l: 'למה דווקא מכירות / שירות?', t: 'area', w: 'full', max: 255 },
      ] } ] },

    { key: 'fb', label: 'משוב גיוס', icon: 'check', groups: [
      { title: 'משובים גיוס', fields: [
        { k: 'fbFit', l: 'התאמה מקצועית ונתוני סף', t: 'score' },
        { k: 'fbMotiv', l: 'מוטיבציה אמיתית לתפקיד', t: 'score' },
        { k: 'fbAvail', l: 'זמינות, רצינות וגמישות', t: 'score' },
        { k: 'fbComm', l: 'יכולת ביטוי ותקשורת', t: 'score' },
        { k: 'fbHard', l: 'התמודדות עם שאלות מאתגרות', t: 'score' },
        { k: 'fbTotal', l: 'ציון כללי — משוב גיוס', t: 'calc', from: ['fbFit', 'fbMotiv', 'fbAvail', 'fbComm', 'fbHard'] },
        { k: 'fbStatus', l: 'סטטוס התאמה להמשך', t: 'sel', o: FIT },
        { k: 'fbWhy', l: 'פירוט סיבת התאמה', t: 'area', w: 'full', max: 9999 },
        { k: 'fbSum', l: 'סיכום משוב גיוס', t: 'area', w: 'full', max: 9999 },
        { k: 'rolePrio', l: 'תיעדוף תפקיד', t: 'text' },
        { k: 'secRec', l: 'המלצה לסקטור', t: 'sel', o: SECTORS },
      ] } ] },

    { key: 'call', label: 'משוב שיחה', icon: 'phone', groups: [
      { title: 'משוב — מגייס/ת', fields: [
        { k: 'cScore', l: 'ציון כללי', t: 'calc', from: ['cOpen', 'cFit', 'cMotiv', 'cAvail', 'cPresent', 'cQuest', 'cObj', 'cLead', 'cClose'] },
        { k: 'cOpen', l: 'פתיחה ויצירת חיבור', t: 'score' },
        { k: 'cFit', l: 'בירור נתוני סף והתאמה מקצועית', t: 'score' },
        { k: 'cMotiv', l: 'בירור מוטיבציה', t: 'score' },
        { k: 'cAvail', l: 'בירור זמינות וגמישות', t: 'score' },
        { k: 'cPresent', l: 'הצגת התפקיד והחברה', t: 'score' },
        { k: 'cQuest', l: 'שימוש בשאלות פתוחות ורלוונטיות', t: 'score' },
        { k: 'cObj', l: 'ניהול והתמודדות עם התנגדויות', t: 'score' },
        { k: 'cLead', l: 'מקצועיות, הקשבה והובלת השיחה', t: 'score' },
        { k: 'cClose', l: 'סגירת השיחה וקביעת המשך תהליך', t: 'score' },
        { k: 'cKeep', l: 'נקודות לשימור', t: 'area', w: 'full', max: 999 },
        { k: 'cImprove', l: 'נקודות לשיפור', t: 'area', w: 'full', max: 999 },
        { k: 'cSum', l: 'סיכום משוב', t: 'area', w: 'full', max: 999 },
        { k: 'cRec', l: 'קישור להקלטה', t: 'url', w: 'full' },
      ] } ] },
  ];

  const opts = f => typeof f.o === 'function' ? (f.o() || []) : (f.o || []);
  const v = (c, k) => (c.x || {})[k] == null ? '' : (c.x || {})[k];
  function calc(c, f) {
    const nums = f.from.map(k => parseInt(v(c, k), 10)).filter(n => !isNaN(n) && n > 0);
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 10) / 10 : '';
  }

  /* ---------------- רינדור שדה ---------------- */
  function fieldHTML(c, f) {
    const val = v(c, f.k), id = 'ax_' + f.k;
    const wrap = inner => `<label class="ax-f ${f.w === 'full' ? 'full' : ''}">
      <span>${esc(f.l)}</span>${inner}${f.max ? `<i class="ax-max">${f.max} נותרו</i>` : ''}</label>`;
    if (f.t === 'calc') { const n = calc(c, f);
      return `<div class="ax-f ax-calc"><span>${esc(f.l)}</span>
        <b class="${n >= 4 ? 'good' : n && n < 3 ? 'bad' : ''}">${n === '' ? '—' : n}</b>
        <i>ממוצע ${f.from.length} קריטריונים</i></div>`; }
    if (f.t === 'score') return wrap(`<select class="cc-inp" data-ax="${f.k}" id="${id}">
      ${SCORE.map((s, i) => `<option value="${i}" ${String(val) === String(i) ? 'selected' : ''}>${i ? s : '— בחר —'}</option>`).join('')}</select>`);
    if (f.t === 'sel') return wrap(`<select class="cc-inp ${f.tag && val ? 'ax-tag' : ''}" data-ax="${f.k}" id="${id}">
      <option value="">— בחר —</option>
      ${opts(f).map(o => `<option ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`);
    if (f.t === 'job') return wrap(`<select class="cc-inp" data-axjob="1" id="${id}">
      ${(window.ATS ? window.ATS.jobs() : []).map(j => `<option value="${j.id}" ${c.job === j.id ? 'selected' : ''}>${esc(j.title)}</option>`).join('')}</select>`);
    if (f.t === 'area') return wrap(`<textarea class="cc-inp" rows="3" data-ax="${f.k}" id="${id}">${esc(val)}</textarea>`);
    if (f.t === 'num') return wrap(`<div class="ax-num"><input class="cc-inp" type="number" min="0" max="100" data-ax="${f.k}" id="${id}" value="${esc(val)}">
      ${f.suffix ? `<span>${f.suffix}</span>` : ''}</div>
      ${f.bar ? `<span class="ax-bar"><i style="width:${Math.max(0, Math.min(100, +val || 0))}%" class="${(+val || 0) >= 70 ? 'good' : (+val || 0) >= 40 ? 'mid' : 'bad'}"></i></span>` : ''}`);
    const type = f.t === 'date' ? 'date' : f.t === 'tel' ? 'tel' : f.t === 'mail' ? 'email' : f.t === 'url' ? 'url' : 'text';
    return wrap(`<input class="cc-inp" type="${type}" data-ax="${f.k}" id="${id}" value="${esc(val)}">`);
  }

  /* ---------------- כרטיס המועמד ---------------- */
  let axTab = 'main';
  function cardHTML(c) {
    const T = TABS.find(t => t.key === axTab) || TABS[0];
    const jobT = (window.ATS ? (window.ATS.jobs().find(j => j.id === c.job) || {}) : {});
    const st = v(c, 'candSt') || 'חדש';
    return `<div class="ax-card">
      <div class="ax-head">
        <div class="ax-h-n"><b>${esc((v(c, 'first') + ' ' + v(c, 'last')).trim() || c.name)}</b>
          <small>${esc(jobT.title || '')}${v(c, 'origin') ? ' · ' + esc(v(c, 'origin')) : ''}</small></div>
        <span class="ax-st">${esc(st)}</span>
        ${v(c, 'quality') ? `<span class="ax-q">${esc(v(c, 'quality'))}</span>` : ''}
        ${v(c, 'fitPct') ? `<span class="ax-fit ${+v(c, 'fitPct') >= 70 ? 'good' : +v(c, 'fitPct') >= 40 ? 'mid' : 'bad'}">${esc(v(c, 'fitPct'))}% התאמה</span>` : ''}
      </div>
      <div class="ax-tabs">${TABS.map(t => `<button class="ax-tab ${axTab === t.key ? 'on' : ''}" data-axtab="${t.key}">${ic(t.icon)} ${t.label}</button>`).join('')}</div>
      ${(T.actions || []).length ? `<div class="ax-actions">${T.actions.map(a => `
        <button class="ax-act ${a.color} ${v(c, a.k) ? 'done' : ''}" data-axact="${a.k}">
          ${ic(v(c, a.k) ? 'check' : 'phone')} ${esc(a.l)}${v(c, a.k) ? ' ✓' : ''}</button>`).join('')}</div>` : ''}
      ${T.groups.map(g => `<section class="ax-group">
        <div class="ax-g-h">${ic('layers')} <b>${esc(g.title)}</b></div>
        <div class="ax-grid">${g.fields.map(f => fieldHTML(c, f)).join('')}</div>
      </section>`).join('')}
    </div>`;
  }

  function bindCard(c, RR) {
    $$('[data-axtab]').forEach(b => b.addEventListener('click', () => { axTab = b.dataset.axtab; RR(); }));
    $$('[data-ax]').forEach(e => e.addEventListener('change', () => {
      c.x = c.x || {}; c.x[e.dataset.ax] = e.value;
      /* שדות שמשפיעים על הכותרת או על ציון מחושב — מרעננים */
      const live = ['candSt', 'quality', 'fitPct', 'first', 'last', 'origin'];
      if (live.indexOf(e.dataset.ax) >= 0 || /^(fb|c)[A-Z]/.test(e.dataset.ax)) RR(); else save();
    }));
    const jb = $('[data-axjob]'); if (jb) jb.addEventListener('change', () => { c.job = jb.value; RR(); });
    $$('[data-axact]').forEach(b => b.addEventListener('click', () => {
      c.x = c.x || {}; c.x[b.dataset.axact] = !c.x[b.dataset.axact]; RR();
      toast(c.x[b.dataset.axact] ? 'סומן כבוצע ✓' : 'הסימון בוטל'); }));
  }
  function save() { if (window.ATS) CBX.store('ats_cands', window.ATS.cands()); }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'atsx', label: 'שדות גיוס מלאים', icon: 'docs',
    desc: 'כרטיס מועמד במבנה העבודה בפועל: פרטי מועמד, נתוני זמינות, ניתוח התאמה מקו״ח, מוטיבציה, משוב גיוס מדורג ומשוב איכות שיחה למגייס/ת.',
    files: ['js/ext/ats-fields.js'],
    install() {
      /* מחליף את גוף כרטיס המועמד בתוך הרחבת הגיוס */
      CBX.on('atsx', 'ats:card', ev => { ev.handled = true; ev.html = cardHTML(ev.cand); ev.bind = RR => bindCard(ev.cand, RR); });
      /* ציון המשוב מזין את הדירוג בפייפליין, כדי שלא יהיו שני מספרים סותרים */
      CBX.on('atsx', 'ats:rating', ev => {
        const f = TABS.find(t => t.key === 'fb').groups[0].fields.find(x => x.k === 'fbTotal');
        const n = calc(ev.cand, f); if (n) ev.rating = Math.round(n);
      });
      /* שדות המשוב זמינים גם לדוחות */
      CBX.on('atsx', 'ats:dims', ev => {
        ev.dims.push({ key: 'quality', label: 'איכות המועמד', get: c => v(c, 'quality') || '—' });
        ev.dims.push({ key: 'origin', label: 'מקור הגעה', get: c => v(c, 'origin') || '—' });
        ev.dims.push({ key: 'recruiter', label: 'מגייס/ת', get: c => v(c, 'recruiter') || '—' });
        ev.dims.push({ key: 'fitType', label: 'סוג התאמה', get: c => v(c, 'fitType') || '—' });
      });
    },
  });

  window.ATSX = { tabs: TABS, card: cardHTML, bind: bindCard, val: v, calc };
})();
