/* ============================================================
   הרחבה: תיק אדם מאוחד  ·  key = 'person'
   ------------------------------------------------------------
   אותו אדם משאיר פניות שוב ושוב — לפעמים באותו נושא ולפעמים
   בנושאים שונים. עד היום כל פנייה חיה בנפרד, ואף אחד לא ראה
   את התמונה המלאה.
   כאן שני דברים:
     1) בכרטיס הפנייה — חיווי "כבר פנה בעבר", מקובץ לפי נושא.
     2) במסך הלקוחות — תיק מאוחד לכל אדם: כל הפניות, הכרטיסים,
        ההזמנות והחיובים שלו על ציר זמן אחד.
   הזיהוי לפי טלפון, ואם אין — לפי דוא״ל ואז לפי שם.
   ============================================================ */
(function () {

  /* ---------------- זיהוי אדם ---------------- */
  const digits = s => String(s || '').replace(/\D/g, '');
  function idOf(r) {
    const p = digits(r.phone);
    if (p.length >= 9) return 'p:' + p.slice(-9);
    if (r.mail) return 'm:' + String(r.mail).toLowerCase().trim();
    return 'n:' + String(r.name || '').trim();
  }
  /* כל האנשים במערכת, עם כל מה שקשור אליהם */
  function people() {
    const map = {};
    ((typeof RECORDS !== 'undefined') ? RECORDS : []).forEach(r => {
      const k = idOf(r);
      const p = map[k] = map[k] || { key: k, name: r.name, phone: r.phone, mail: r.mail, org: r.org,
        recs: [], tickets: [], orders: [], docs: [] };
      /* השם והפרטים נלקחים מהפנייה העדכנית ביותר שיש בה מידע */
      if (!p.mail && r.mail) p.mail = r.mail;
      if (!p.org && r.org) p.org = r.org;
      p.recs.push(r);
    });
    if (window.TKT && CBX.isOn('tkt')) window.TKT.list().forEach(t => {
      const k = idOf({ phone: t.phone, name: t.cust });
      const p = map[k] = map[k] || { key: k, name: t.cust, phone: t.phone, recs: [], tickets: [], orders: [], docs: [] };
      p.tickets.push(t);
    });
    if (window.SHOPX && CBX.isOn('shop')) window.SHOPX.orders().forEach(o => {
      const k = idOf({ phone: o.phone, mail: o.mail, name: o.name });
      const p = map[k] = map[k] || { key: k, name: o.name, phone: o.phone, mail: o.mail, recs: [], tickets: [], orders: [], docs: [] };
      p.orders.push(o);
    });
    if (window.BILL && CBX.isOn('bill')) window.BILL.docs().forEach(d => {
      const k = idOf({ phone: d.phone, name: d.cust });
      const p = map[k]; if (p) p.docs.push(d);
    });
    return Object.values(map);
  }
  function personOf(r) { const k = idOf(r); return people().find(p => p.key === k) || null; }

  /* ---------------- קיבוץ לפי נושא ----------------
     נושא = השירות שנבחר, ואם אין — כותרת הפנייה. כך אפשר לראות
     "שלוש פניות על לייזר" ולא רק "שלוש פניות". */
  function topicOf(r) {
    const s = (r.services || [])[0];
    const t = (typeof cTreat === 'function' && s) ? cTreat(s) : null;
    if (t) return t.label;
    if (r.subject) return String(r.subject).replace(/\s*·.*$/, '').trim();
    return 'ללא נושא';
  }
  function byTopic(recs) {
    const m = {};
    recs.forEach(r => { const t = topicOf(r); (m[t] = m[t] || []).push(r); });
    return Object.keys(m).map(t => ({ topic: t, recs: m[t] })).sort((a, b) => b.recs.length - a.recs.length);
  }
  const isOpen = r => !r.done;
  /* עברית תקינה גם כשהמספר הוא 1 — "פנייה אחת", לא "1 פניות" */
  const cnt = (n, one, many) => n === 1 ? one : n + ' ' + many;

  /* ---------------- החלטות הנציג ----------------
     אחרי שהנציג החליט — איחד או דחה — החיווי לא חוזר. */
  let PS_DONE = CBX.load('ps_done', {});
  const saveDone = () => CBX.store('ps_done', PS_DONE);
  const isDone = k => !!PS_DONE[k];
  function dismiss(k, why) { PS_DONE[k] = { at: (typeof autoStamp === 'function') ? autoStamp() : '', why: why || 'נדחה' }; saveDone(); }

  /* ---------------- חיווי בכרטיס הפנייה ---------------- */
  function priorHTML(rec) {
    const p = personOf(rec); if (!p || isDone(p.key)) return '';
    const others = p.recs.filter(r => r !== rec && !r.mergedInto);
    const tk = p.tickets || [], od = p.orders || [];
    if (!others.length && !tk.length && !od.length) return '';
    const groups = byTopic(others);
    const same = groups.find(g => g.topic === topicOf(rec));
    return `<div class="ps-prior pop">
      <div class="ps-prior-h">${ic('history')} <b>כבר פנה אלינו בעבר</b>
        <span class="ps-count">${cnt(others.length, 'פנייה קודמת אחת', 'פניות קודמות')}</span>
        ${same ? `<span class="ps-same">${same.recs.length === 1 ? 'אחת מהן באותו נושא' : same.recs.length + ' מהן באותו נושא'}</span>` : ''}
      </div>
      <div class="ps-topics">${groups.map(g => `<div class="ps-topic ${g.topic === topicOf(rec) ? 'same' : ''}">
        <span class="ps-t-n">${esc(g.topic)}</span>
        <span class="ps-t-c">${g.recs.length}</span>
        <span class="ps-t-l">${g.recs.filter(isOpen).length ? cnt(g.recs.filter(isOpen).length, 'פתוחה אחת', 'פתוחות') : 'סגורות'}</span>
      </div>`).join('')}</div>
      ${(tk.length || od.length) ? `<div class="ps-also">
        ${tk.length ? `<span>${ic('ticket')} ${cnt(tk.length, 'פניית שירות אחת', 'פניות שירות')}</span>` : ''}
        ${od.length ? `<span>${ic('org')} ${cnt(od.length, 'הזמנה אחת', 'הזמנות')}</span>` : ''}
      </div>` : ''}
      <div class="ps-acts">
        ${others.length ? `<button class="btn sm primary" data-psmerge="${esc(p.key)}|${esc(String(rec.id))}">${ic('sync')} אחד פניות</button>` : ''}
        <button class="btn sm" data-psopen="${esc(p.key)}">${ic('expand')} תיק מאוחד</button>
        <button class="btn sm ghost" data-psdismiss="${esc(p.key)}">${ic('close')} זה אדם אחר</button>
      </div>
    </div>`;
  }

  /* ---------------- תיק מאוחד ---------------- */
  let psOpen = null;
  function fileHTML(p) {
    const groups = byTopic(p.recs);
    const spent = (p.docs || []).filter(d => !d.void).reduce((a, d) => a + (+d.paid || 0), 0);
    const owed = (window.BILL && CBX.isOn('bill'))
      ? (p.docs || []).filter(d => !d.void).reduce((a, d) => a + window.BILL.balance(d), 0) : 0;
    /* ציר זמן מאוחד — הכול יחד, לא כל מקור בנפרד */
    const tl = []
      .concat(p.recs.map(r => ({ kind: 'פנייה', t: r.subject || topicOf(r), sub: (r.status || {}).label || '',
        when: (r.meeting && r.meeting.date) || '', open: isOpen(r), rec: r })))
      .concat((p.tickets || []).map(t => ({ kind: 'שירות', t: t.subj, sub: t.cat, when: t.opened, open: t.state !== 'done' })))
      .concat((p.orders || []).map(o => ({ kind: 'הזמנה', t: o.no + ' · ' + (o.lines.length === 1 ? 'פריט אחד' : o.lines.length + ' פריטים'),
        sub: CBX.money(o.totals.total), when: o.t, open: o.status === 'new' })))
      .concat((p.docs || []).filter(d => !d.void).map(d => ({ kind: 'חיוב', t: d.no, sub: CBX.money(d.total), when: d.t,
        open: window.BILL && window.BILL.balance(d) > 0 })));
    return `<div class="ps-file">
      <div class="rep-open-h"><button class="btn sm" id="psBack">${ic('chevronR')} חזרה</button>
        <b>${esc(p.name)}</b><span class="muted">${esc(p.phone || p.mail || '')}${p.org ? ' · ' + esc(p.org) : ''}</span></div>
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${p.recs.length}</b><small>סה״כ פניות</small></div>
        <div class="inv-kpi"><b>${p.recs.filter(isOpen).length}</b><small>פתוחות עכשיו</small></div>
        <div class="inv-kpi"><b>${groups.length}</b><small>נושאים שונים</small></div>
        ${owed ? `<div class="inv-kpi warn"><b>${CBX.money(owed)}</b><small>יתרה לתשלום</small></div>`
          : `<div class="inv-kpi"><b>${CBX.money(spent)}</b><small>שילם עד היום</small></div>`}
      </div>
      <div class="ps-sec-h">${ic('layers')} <b>לפי נושא</b>
        <small>כך רואים מיד אם מדובר בבעיה חוזרת או בפניות לא קשורות</small></div>
      <div class="ps-groups">${groups.map(g => `<div class="ps-group">
        <div class="ps-g-h"><b>${esc(g.topic)}</b><span class="ps-count">${g.recs.length}</span>
          ${g.recs.length > 1 ? '<span class="ps-repeat">נושא חוזר</span>' : ''}</div>
        <div class="ps-g-list">${g.recs.map(r => `<button class="ps-rec ${isOpen(r) ? 'open' : ''}" data-psrec="${esc(String(r.id))}">
          <b>${esc(r.subject || topicOf(r))}</b>
          <small>${esc((r.status || {}).label || '')} · ${esc(r.assignee || 'לא משויך')}</small>
        </button>`).join('')}</div>
      </div>`).join('') || '<p class="fx-none">אין פניות</p>'}</div>
      <div class="ps-sec-h">${ic('history')} <b>כל הפעילות</b><small>פניות, שירות, הזמנות וחיובים על ציר אחד</small></div>
      <div class="ps-tl">${tl.map(x => `<div class="ps-tl-row ${x.open ? 'open' : ''}">
        <span class="ps-tl-k">${esc(x.kind)}</span>
        <span class="ps-tl-t"><b>${esc(x.t)}</b><small>${esc(x.sub || '')}</small></span>
        <span class="ps-tl-w">${esc(x.when || '')}</span>
      </div>`).join('') || '<p class="fx-none">אין פעילות</p>'}</div>`;
  }

  function listHTML() {
    const ps = people().filter(p => p.recs.length + (p.tickets || []).length + (p.orders || []).length > 1)
      .sort((a, b) => (b.recs.length + (b.tickets || []).length) - (a.recs.length + (a.tickets || []).length));
    return `<div class="ps-wrap">
      <div class="ps-sec-h">${ic('clients')} <b>אנשים שפנו יותר מפעם אחת</b>
        <small>${cnt(ps.length, 'אדם אחד', 'אנשים')} · לחיצה פותחת תיק מאוחד עם כל ההיסטוריה</small></div>
      <div class="ps-people">${ps.map(p => { const g = byTopic(p.recs);
        return `<button class="ps-person" data-psopen="${esc(p.key)}">
          <span class="ps-p-n"><b>${esc(p.name)}</b><small>${esc(p.phone || p.mail || '')}</small></span>
          <span class="ps-p-s">
            <span>${cnt(p.recs.length, 'פנייה אחת', 'פניות')}</span>
            <span>${cnt(g.length, 'נושא אחד', 'נושאים')}</span>
            ${g.some(x => x.recs.length > 1) ? '<span class="ps-repeat">נושא חוזר</span>' : ''}
            ${p.recs.filter(isOpen).length ? `<span class="ps-openn">${cnt(p.recs.filter(isOpen).length, 'פתוחה אחת', 'פתוחות')}</span>` : ''}
          </span>${ic('chevronL')}</button>`; }).join('')
        || '<p class="fx-none">אין כרגע אדם עם יותר מפנייה אחת</p>'}</div>
    </div>`;
  }

  function bindList(RR) {
    $$('[data-psopen]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); psOpen = b.dataset.psopen; RR(); }));
    const bk = $('#psBack'); if (bk) bk.addEventListener('click', () => { psOpen = null; RR(); });
    $$('[data-psrec]').forEach(b => b.addEventListener('click', () => {
      const r = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => String(x.id) === b.dataset.psrec) : null;
      if (r && typeof openDrawer === 'function') { psOpen = null; openDrawer(r); } }));
  }

  /* החיווי יושב מעל התקציר בראש הפנייה — שם העין נופלת ראשונה,
     ולא בתוך גוף הפנייה שבו הוא נבלע. */
  /* אחרי איחוד — מה שנשמר כערך חלופי חייב להיות גלוי, אחרת "לא נמחק"
     הוא הבטחה ריקה. זו הרצועה שמראה את זה בתוך הפנייה. */
  function mergedHTML(rec) {
    const alts = rec.alts || {}, hist = rec.mergedHistory || [];
    const keys = Object.keys(alts);
    if (!keys.length && !hist.length) return '';
    return `<div class="ps-merged">
      <div class="ps-merged-h">${ic('sync')} <b>פנייה מאוחדת</b>
        <span class="ps-count">${cnt(hist.length, 'פנייה אחת אוחדה', 'פניות אוחדו')}</span></div>
      ${keys.length ? `<div class="ps-alts">${keys.map(k => `<span class="ps-alt-row">
        <i>${esc(alts[k].label)}:</i> ${alts[k].values.map(v2 => `<span class="ps-alt">${esc(v2)}</span>`).join('')}
      </span>`).join('')}
      <small class="ps-alt-note">${ic('lock')} ערכים שנשמרו מהפניות שאוחדו — לא נמחקו, רק אינם המוצגים.</small></div>` : ''}
      ${hist.length ? `<div class="ps-hist">${hist.map(x => `<span>${ic('history')} ${esc(x.subject)}
        <i>${esc(x.status)}${x.assignee ? ' · ' + esc(x.assignee) : ''}</i></span>`).join('')}</div>` : ''}
    </div>`;
  }

  function mountPrior(rec) {
    const drawer = document.getElementById('drawer'); if (!drawer || !rec) return;
    drawer.querySelectorAll('.ps-prior, .ps-merged').forEach(e => e.remove());
    /* רצועת "מאוחדת" — מוצגת במקום החיווי, מעל התקציר */
    const mg = mergedHTML(rec);
    if (mg) { const meta0 = drawer.querySelector('.head-meta');
      const d0 = document.createElement('div'); d0.innerHTML = mg;
      if (meta0 && meta0.parentNode) meta0.parentNode.insertBefore(d0.firstElementChild, meta0); }
    const html = priorHTML(rec); if (!html) return;
    const meta = drawer.querySelector('.head-meta');
    const d = document.createElement('div'); d.innerHTML = html;
    const el = d.firstElementChild;
    if (meta && meta.parentNode) meta.parentNode.insertBefore(el, meta);
    else { const body = document.getElementById('drawerBody'); if (body) body.insertBefore(el, body.firstChild); }
    requestAnimationFrame(() => el.classList.add('in'));
    $$('[data-psopen]', el).forEach(b => b.addEventListener('click', () => {
      psOpen = b.dataset.psopen;
      if (typeof closeDrawer === 'function') closeDrawer();
      navActive = 'clients'; renderClientsView();
    }));
    $$('[data-psmerge]', el).forEach(b => b.addEventListener('click', () => {
      const [k, id] = b.dataset.psmerge.split('|'); openMerge(k, id);
    }));
    $$('[data-psdismiss]', el).forEach(b => b.addEventListener('click', () => {
      dismiss(b.dataset.psdismiss, 'סומן כאדם אחר');
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
      toast('הבנתי — לא נציג את זה שוב עבור הפנייה הזו');
    }));
  }

  /* ---------------- איחוד פניות ----------------
     העיקרון: שום דבר לא נמחק. הפנייה הראשית מקבלת את כל המידע,
     וכל ערך חלופי נשמר לצדה כדי שאפשר יהיה לחזור אליו. */
  const M_FIELDS = [
    { k: 'name', l: 'שם' }, { k: 'phone', l: 'טלפון' }, { k: 'mail', l: 'דוא״ל' },
    { k: 'org', l: 'חברה' }, { k: 'idnum', l: 'ת.ז' }, { k: 'subject', l: 'נושא' },
    { k: 'assignee', l: 'נציג מטפל' }, { k: 'source', l: 'מקור' },
    { k: 'priority', l: 'עדיפות', fmt: v => ({ high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' })[v] || v },
  ];
  const mVal = (r, f) => { const v = r[f.k]; return v == null || v === '' ? '' : (f.fmt ? f.fmt(v) : String(v)); };

  let mgState = null;   /* { recs, primary, pick:{field:recId} } */

  function openMerge(pKey, recId) {
    const p = people().find(x => x.key === pKey); if (!p) return;
    const recs = p.recs.filter(r => !r.mergedInto);
    if (recs.length < 2) { toast('אין פניות לאיחוד'); return; }
    const primary = recs.find(r => String(r.id) === String(recId)) || recs[0];
    mgState = { pKey, recs, primary, pick: {} };
    /* ברירת מחדל לכל שדה: הערך הראשון שאינו ריק */
    M_FIELDS.forEach(f => { const src = recs.find(r => mVal(r, f)); if (src) mgState.pick[f.k] = String(src.id); });
    render();

    function render() {
      const old2 = document.getElementById('psMerge'); if (old2) old2.remove();
      const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'psMerge';
      const st = mgState;
      const union = k => { const out = []; st.recs.forEach(r => (r[k] || []).forEach(x => { if (out.indexOf(x) < 0) out.push(x); })); return out; };
      const svcs = union('services');
      const conflicts = M_FIELDS.filter(f => new Set(st.recs.map(r => mVal(r, f)).filter(Boolean)).size > 1);
      w.innerHTML = `<div class="cbc-box ps-merge">
        <div class="cbc-head"><span class="cbc-ic">${ic('sync')}</span><b>איחוד פניות · ${esc(p.name)}</b></div>
        <p class="ps-m-lead">${ic('lock')} <b>שום דבר לא נמחק.</b>
          הפנייה הראשית תרכז את כל המידע, וכל ערך חלופי יישמר לצדה וניתן יהיה לחזור אליו.
          הפניות האחרות לא נמחקות — הן נסגרות ומקושרות לראשית.</p>

        <div class="ps-m-sec">${ic('target')} <b>איזו פנייה תהיה הראשית?</b>
          <small>אליה יתווסף כל השאר. בדרך כלל הוותיקה או המלאה ביותר.</small></div>
        <div class="ps-m-recs">${st.recs.map(r => `<label class="ps-m-rec ${String(r.id) === String(st.primary.id) ? 'on' : ''}">
          <input type="radio" name="psPrim" value="${esc(String(r.id))}" ${String(r.id) === String(st.primary.id) ? 'checked' : ''}>
          <span><b>${esc(r.subject || topicOf(r))}</b>
            <small>${esc((r.status || {}).label || '')} · ${esc(r.assignee || 'לא משויך')} · ${esc(String(r.id))}</small></span>
        </label>`).join('')}</div>

        ${conflicts.length ? `<div class="ps-m-sec">${ic('alert')} <b>ערכים שונים בין הפניות</b>
          <small>בחרו מה יוצג. מה שלא נבחר יישמר כערך חלופי ולא ייעלם.</small></div>
          <div class="ps-m-fields">${conflicts.map(f => `<div class="ps-m-field">
            <span class="ps-m-l">${esc(f.l)}</span>
            <div class="ps-m-vals">${st.recs.filter(r => mVal(r, f)).map(r => `
              <button class="ps-m-v ${st.pick[f.k] === String(r.id) ? 'on' : ''}" data-psv="${esc(f.k)}|${esc(String(r.id))}">
                ${esc(mVal(r, f))}</button>`).join('')}</div>
          </div>`).join('')}</div>` : `<div class="ps-m-ok">${ic('check')} אין ערכים סותרים — האיחוד פשוט</div>`}

        <div class="ps-m-sec">${ic('plus')} <b>מה מתווסף לפנייה הראשית</b>
          <small>הכול מצטבר. אין כאן בחירה — זה נוסף ממילא.</small></div>
        <div class="ps-m-add">
          <div><span>שירותים</span><b>${svcs.length ? esc(svcs.map(k2 => (typeof cTreat === 'function' && cTreat(k2)) ? cTreat(k2).label : k2).join(' · ')) : '—'}</b></div>
          <div><span>פניות שיאוחדו</span><b>${st.recs.length - 1}</b></div>
          <div><span>נושאים</span><b>${esc(byTopic(st.recs).map(g => g.topic).join(' · '))}</b></div>
          <div><span>היסטוריה</span><b>נשמרת במלואה משתי הפניות</b></div>
        </div>

        <div class="cbc-actions">
          <button class="btn primary" id="psMgo">${ic('check')} אחד ${st.recs.length} פניות</button>
          <button class="btn ghost" id="psMx">ביטול</button>
        </div>
      </div>`;
      $$('[name="psPrim"]', w).forEach(r2 => r2.addEventListener('change', () => {
        st.primary = st.recs.find(x => String(x.id) === r2.value) || st.primary; render(); }));
      $$('[data-psv]', w).forEach(b => b.addEventListener('click', () => {
        const [k, id] = b.dataset.psv.split('|'); st.pick[k] = id; render(); }));
      $('#psMx', w).addEventListener('click', () => { w.remove(); mgState = null; });
      $('#psMgo', w).addEventListener('click', () => { doMerge(); w.remove(); });
      w.addEventListener('mousedown', e => { if (e.target === w) { w.remove(); mgState = null; } });
      document.body.appendChild(w);
    }
  }

  /* הביצוע בפועל — הוספה בלבד */
  function doMerge() {
    const st = mgState; if (!st) return;
    const main = st.primary, others = st.recs.filter(r => r !== main);
    main.alts = main.alts || {};      /* ערכים חלופיים ששמורים לצד הנבחר */
    main.mergedIds = main.mergedIds || [];
    M_FIELDS.forEach(f => {
      const chosenId = st.pick[f.k];
      const src = st.recs.find(r => String(r.id) === String(chosenId));
      const vals = st.recs.map(r => ({ id: r.id, v: mVal(r, f) })).filter(x => x.v);
      if (src && mVal(src, f)) main[f.k] = src[f.k];
      const alt = vals.filter(x => String(x.id) !== String(chosenId)).map(x => x.v)
        .filter((v, i2, a) => a.indexOf(v) === i2 && v !== mVal(main, f));
      if (alt.length) main.alts[f.k] = { label: f.l, values: alt };
    });
    /* מערכים — איחוד, לא החלפה */
    ['services'].forEach(k => {
      const out = (main[k] || []).slice();
      others.forEach(r => (r[k] || []).forEach(x => { if (out.indexOf(x) < 0) out.push(x); }));
      main[k] = out;
    });
    /* ההיסטוריה של כל פנייה נשמרת ומקושרת */
    main.mergedHistory = (main.mergedHistory || []).concat(others.map(r => ({
      id: r.id, subject: r.subject || topicOf(r), topic: topicOf(r),
      status: (r.status || {}).label || '', assignee: r.assignee || '',
      at: (typeof autoStamp === 'function') ? autoStamp() : '' })));
    others.forEach(r => {
      r.mergedInto = main.id; r.done = true;
      r.status = { label: 'אוחדה', color: 'blue' };
      main.mergedIds.push(r.id);
    });
    dismiss(st.pKey, 'אוחד');
    if (window.AUDIT && CBX.isOn('audit'))
      window.AUDIT.rec('lead', 'איחוד פניות', main.name + ' · ' + others.length + ' פניות אוחדו ל-' + main.id);
    mgState = null;
    toast('אוחדו ' + (others.length === 1 ? 'פנייה אחת' : others.length + ' פניות') + ' — שום מידע לא נמחק ✓');
    if (typeof renderList === 'function') renderList();
    if (typeof openDrawer === 'function') openDrawer(main);
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'person', label: 'תיק אדם מאוחד', icon: 'history',
    desc: 'מזהה שאותו אדם פנה כמה פעמים, מקבץ את הפניות לפי נושא, ומרכז במקום אחד גם פניות שירות, הזמנות וחיובים.',
    files: ['js/ext/person.js'],
    install() {
      /* 1) מסך הלקוחות — רשימת אנשים חוזרים + תיק מאוחד */
      if (typeof renderClientsView === 'function') CBX.wrap('person', 'renderClientsView', o => function () {
        if (psOpen) {
          const p = people().find(x => x.key === psOpen);
          const host = document.getElementById('viewHost');
          host.innerHTML = `<div class="view-head"><div class="vh-title"><span class="num">${ic('clients')}</span>
            תיק מאוחד</div></div>` + (p ? fileHTML(p) : '<p class="fx-none">לא נמצא</p>');
          bindList(() => renderClientsView());
          return;
        }
        const r = o.apply(this, arguments);
        const host = document.getElementById('viewHost');
        if (host && !document.querySelector('.ps-wrap')) {
          const d = document.createElement('div'); d.innerHTML = listHTML();
          host.appendChild(d.firstElementChild);
          bindList(() => renderClientsView());
        }
        return r;
      });
      /* 2) כרטיס הפנייה — חיווי על פניות קודמות */
      if (typeof renderDrawerTab === 'function') CBX.wrap('person', 'renderDrawerTab', o => function (rec) {
        const r = o.apply(this, arguments);
        try { mountPrior(rec); } catch (e) { console.error('[person] drawer', e); }
        return r;
      });
      /* 3) חיפוש: אדם עם כמה פניות מופיע כישות אחת */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('person', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        people().filter(p => p.recs.length > 1).forEach(p => {
          if ((p.name + ' ' + (p.phone || '')).toLowerCase().includes(q))
            res.push({ type: 'תיק מאוחד', label: p.name, goto: 'person', entId: p.key,
              sub: cnt(p.recs.length, 'פנייה אחת', 'פניות') + ' · ' + cnt(byTopic(p.recs).length, 'נושא אחד', 'נושאים') });
        });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('person', 'gotoEntity', o => function (where, id) {
        if (where === 'person') { navActive = 'clients'; psOpen = id; renderClientsView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('person', () => { psOpen = null; });
    },
  });

  window.PERSON = { people, of: personOf, byTopic, topicOf, idOf, merge: openMerge, dismiss, done: () => PS_DONE };
})();
