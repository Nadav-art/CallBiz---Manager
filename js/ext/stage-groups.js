/* ============================================================
   הרחבה: ציר הטיפול מרוכז בקטגוריות  ·  key = 'stgroup'
   ------------------------------------------------------------
   במקום רשימה ארוכה של שלבים בודדים, השלבים מתקבצים לקטגוריות
   (תהליך-העל שכבר מוגדר במערכת: קליטה · יצירת קשר · טיפול ותיאום ·
   ביצוע · סיכום · סגירה). בחוץ רואים רק את מה שחשוב — מה מצב כל
   קטגוריה ומה השלב הפעיל בתוכה. מי שרוצה לרדת לפרטים פותח.

   הקטגוריה של הטיפול והתיאום מכבדת את המבנה החדש: כשהלקוח יודע
   מה הוא רוצה מוצג קודם השירות ואז הקריטריונים, וכשלא — הפוך.
   ============================================================ */
(function () {

  const metaTitle = k => ((typeof META_STAGES !== 'undefined' ? META_STAGES : []).find(m => m.key === k) || {}).title || k;
  const metaIcon = k => ((typeof META_STAGES !== 'undefined' ? META_STAGES : []).find(m => m.key === k) || {}).icon || 'layers';
  const CRIT_KEYS = ['qualify', 'need', 'needs', 'classify', 'diagnose'];
  const SVC_KEYS = ['service', 'svc', 'services'];

  /* סדר פנימי לפי המסלול שנבחר בליד */
  function orderIn(items, rec) {
    const mode = rec && rec.flowMode ? rec.flowMode : ((rec && (rec.services || []).length) ? 'known' : '');
    if (!mode) return items;
    const rank = el => {
      const k = el.getAttribute('data-key');
      if (CRIT_KEYS.indexOf(k) >= 0) return mode === 'known' ? 1 : 0;
      if (SVC_KEYS.indexOf(k) >= 0) return mode === 'known' ? 0 : 1;
      return 2;
    };
    return items.slice().sort((a, b) => rank(a) - rank(b));
  }

  function groupState(items) {
    const cls = items.map(el => el.className);
    if (cls.some(c => /st-overdue/.test(c))) return { k: 'overdue', label: 'באיחור', color: 'red' };
    if (cls.some(c => /st-active/.test(c))) return { k: 'active', label: 'פעיל עכשיו', color: 'brand' };
    if (cls.every(c => /st-done/.test(c))) return { k: 'done', label: 'הושלם', color: 'green' };
    if (cls.every(c => /st-todo/.test(c))) return { k: 'todo', label: 'ממתין', color: 'gray' };
    return { k: 'part', label: 'חלקי', color: 'amber' };
  }

  /* השורה שרואים בחוץ: מה פעיל, ואם הכל הושלם — מה התוצאה */
  function headline(items) {
    const act = items.find(el => /st-active|st-overdue/.test(el.className)) || null;
    const pick = act || items.slice().reverse().find(el => /st-done/.test(el.className));
    if (!pick) return { title: '', sum: '' };
    const lbl = pick.querySelector('.label');
    const sum = pick.querySelector('.acc-summary');
    return { title: lbl ? lbl.textContent.trim() : '', sum: sum ? sum.textContent.replace(/^\s*/, '').trim() : '' };
  }

  function modeTag(rec, metaKey, items) {
    const hasBoth = items.some(el => CRIT_KEYS.indexOf(el.getAttribute('data-key')) >= 0)
      && items.some(el => SVC_KEYS.indexOf(el.getAttribute('data-key')) >= 0);
    if (!hasBoth || !rec) return '';
    const mode = rec.flowMode || ((rec.services || []).length ? 'known' : '');
    if (!mode) return `<span class="sg-mode none">${ic('alert')} טרם נקבע אם הלקוח יודע מה הוא רוצה</span>`;
    return mode === 'known'
      ? `<span class="sg-mode">${ic('target')} הלקוח יודע — שירות ואז קריטריונים</span>`
      : `<span class="sg-mode">${ic('search')} הלקוח לא יודע — קריטריונים ואז שירות</span>`;
  }

  function regroup(html, rec) {
    const t = document.createElement('div');
    t.innerHTML = html;
    const acc = t.querySelector('#accordion'); if (!acc) return html;

    /* מבטלים את מכולת "שלבים שהושלמו" — הקיבוץ מחליף אותה */
    acc.querySelectorAll('.flow-done-wrap').forEach(d => {
      d.querySelectorAll('.acc-item').forEach(it => acc.appendChild(it));
      d.remove();
    });

    let items = Array.prototype.slice.call(acc.querySelectorAll('.acc-item'));
    if (items.length < 3) return html;

    /* סדר אמיתי לפי המסלול — שלבים שהוצאו מ"שלבים שהושלמו" איבדו את מקומם */
    const seq = {};
    try { (computeStages(rec) || []).forEach((s, i) => { seq[s.key] = i; }); } catch (e) {}
    items = items.slice().sort((a, b) => {
      const ia = seq[a.getAttribute('data-key')], ib = seq[b.getAttribute('data-key')];
      return (ia === undefined ? 999 : ia) - (ib === undefined ? 999 : ib);
    });

    /* קיבוץ לפי תהליך-העל. חריג: בירור צורך, בחירת שירות והתיאום הם
       שלושת הצעדים של אותו מהלך ולכן יושבים תמיד באותה קטגוריה. */
    const metaFor = k => {
      if (CRIT_KEYS.indexOf(k) >= 0 || SVC_KEYS.indexOf(k) >= 0) return 'handle';
      return (typeof metaOf === 'function') ? metaOf(k) : 'handle';
    };
    const order = [], byMeta = {};
    items.forEach(el => {
      const k = metaFor(el.getAttribute('data-key'));
      if (!byMeta[k]) { byMeta[k] = []; order.push(k); }
      byMeta[k].push(el);
    });

    acc.innerHTML = '';
    order.forEach(mk => {
      const list = orderIn(byMeta[mk], rec);
      const st = groupState(list);
      const hl = headline(list);
      const doneN = list.filter(el => /st-done/.test(el.className)).length;
      const open = st.k === 'active' || st.k === 'overdue';

      const g = document.createElement('details');
      g.className = 'sg-group st-' + st.k;
      if (open) g.open = true;
      const s = document.createElement('summary');
      s.className = 'sg-head';
      s.innerHTML = `<span class="sg-ic">${ic(metaIcon(mk))}</span>
        <span class="sg-t"><b>${esc(metaTitle(mk))}</b>
          ${hl.title ? `<small class="sg-now">${st.k === 'done' ? ic('check') : ic('chevronL')} ${esc(hl.title)}${hl.sum ? ' · ' + esc(hl.sum) : ''}</small>` : ''}
          ${modeTag(rec, mk, list)}</span>
        <span class="sg-prog">${doneN}/${list.length}</span>
        <span class="badge ${st.color} sm">${st.label}</span>
        <span class="sg-chev">${ic('chevron')}</span>`;
      g.appendChild(s);
      const body = document.createElement('div');
      body.className = 'sg-body';
      list.forEach(el => body.appendChild(el));
      g.appendChild(body);
      acc.appendChild(g);
    });
    return t.innerHTML;
  }

  CBX.register({
    key: 'stgroup', label: 'ציר הטיפול מרוכז בקטגוריות', icon: 'layers',
    desc: 'השלבים מתקבצים לקטגוריות תהליך-העל. בחוץ מוצג מצב הקטגוריה והשלב הפעיל בלבד, והקטגוריה הפעילה נפתחת לבד. סדר הקריטריונים והשירות בתוך קטגוריית הטיפול נקבע לפי המסלול — הלקוח יודע או לא יודע.',
    files: ['js/ext/stage-groups.js', 'css/ext/stage-groups.css'],
    install() {
      if (typeof flowHTML === 'function') CBX.wrap('stgroup', 'flowHTML', o => function (r) {
        const html = o.apply(this, arguments);
        try { return regroup(html, r); } catch (e) { console.error('[stgroup]', e); return html; }
      });
    },
  });

  window.STGROUP = { regroup };
})();
