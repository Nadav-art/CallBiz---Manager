/* ============================================================
   הרחבה: גבייה וחשבוניות  ·  key = 'bill'
   ------------------------------------------------------------
   מה שהיה חסר: מסמכי חובה (חשבונית / קבלה / זיכוי / דרישת
   תשלום), כרטסת לקוח עם יתרה, תשלומים חלקיים, דוח גיול חובות,
   ומסלול גבייה מדורג (Dunning) שרץ אוטומטית.
   מקבלת קלט מהחנות ומהלידים — ולא נוגעת בהם.
   ============================================================ */
(function () {

  const VAT = 0.17;
  const KINDS = [
    { key: 'proforma', label: 'דרישת תשלום', short: 'ד.ת' },
    { key: 'invoice', label: 'חשבונית מס', short: 'חש׳' },
    { key: 'invrec', label: 'חשבונית מס קבלה', short: 'חש׳/קבלה' },
    { key: 'receipt', label: 'קבלה', short: 'קבלה' },
    { key: 'credit', label: 'חשבונית זיכוי', short: 'זיכוי' },
  ];
  /* ---- התהליך החשבונאי: איזה מסמך מופק, ומתי ----
     כל עסק עובד אחרת, ולכן זו הגדרה ולא הנחה קשיחה. */
  const FLOWS = [
    { key: 'invrec', label: 'חשבונית מס קבלה', desc: 'מסמך אחד שמשמש גם כחשבונית וגם כקבלה, מופק בעת התשלום. הנפוץ ביותר בעסקים קטנים.' },
    { key: 'inv_then_rec', label: 'חשבונית מס ואז קבלה', desc: 'חשבונית מס מופקת בעת המכירה, והקבלה מופקת בנפרד כשהכסף מתקבל בפועל.' },
    { key: 'proforma_then', label: 'דרישת תשלום ואז חשבונית מס קבלה', desc: 'קודם נשלחת דרישת תשלום שאינה מסמך מס, ורק כשמשלמים מופקת חשבונית מס קבלה.' },
    { key: 'rec_only', label: 'קבלה בלבד', desc: 'מתאים לעוסק פטור — אין חשבונית מס, רק קבלה על התקבול.' },
    { key: 'debit', label: 'הוראה לחיוב חשבון', desc: 'חיוב חוזר בהוראת קבע או באשראי. בכל מחזור חיוב מופקת חשבונית מס קבלה אוטומטית.' },
  ];
  const BILL_CFG_DEF = { flow: 'invrec', autoOnSale: true, autoOnPay: true, vat: 17,
    biz: 'CallBiz בע״מ', bizId: '514789123', allocate: true };
  let CFG = Object.assign({}, BILL_CFG_DEF, CBX.load('bill_cfg', {}));
  const saveCfg = () => CBX.store('bill_cfg', CFG);
  /* איזה מסמך מופק במכירה, ואיזה בתשלום — נגזר מהתהליך שנבחר */
  function docOnSale() {
    return { invrec: null, inv_then_rec: 'invoice', proforma_then: 'proforma',
      rec_only: null, debit: null }[CFG.flow] || null;
  }
  function docOnPay() {
    return { invrec: 'invrec', inv_then_rec: 'receipt', proforma_then: 'invrec',
      rec_only: 'receipt', debit: 'invrec' }[CFG.flow] || 'receipt';
  }
  /* מסלול גבייה מדורג — כל שלב לפי ימי פיגור */
  const DUN_DEF = [
    { days: 3, action: 'תזכורת ידידותית', how: 'וואטסאפ' },
    { days: 14, action: 'התראה לפני הקפאה', how: 'דוא״ל + טלפון' },
    { days: 30, action: 'הקפאת שירות', how: 'התראה למנהל' },
    { days: 60, action: 'העברה לטיפול משפטי', how: 'התראה למנהל' },
  ];

  let DOCS = CBX.load('bill_docs', null) || seedDocs();
  let DUN = CBX.load('bill_dun', null) || JSON.parse(JSON.stringify(DUN_DEF));
  let billMode = false, billTab = 'docs', billFilter = 'all';

  const save = () => CBX.store('bill_docs', DOCS);
  const saveDun = () => CBX.store('bill_dun', DUN);

  function seedDocs() {
    const recs = (typeof RECORDS !== 'undefined') ? RECORDS.slice(0, 4) : [];
    return recs.map((r, i) => {
      const sub = [1200, 550, 3400, 890][i] || 500;
      const total = Math.round(sub * (1 + VAT));
      const paid = [total, 0, 1000, 0][i] || 0;
      /* תמהיל מציאותי: שולם · פיגור קל · פיגור בינוני · טרם הגיע מועד */
      const issued = ['2024-03-10', '2024-04-28', '2024-03-25', '2024-05-20'][i];
      const due = ['2024-04-10', '2024-05-05', '2024-04-01', '2024-06-05'][i];
      return { no: 'INV-' + (2401 + i), kind: 'invoice', cust: r.name, recId: r.id, phone: r.phone,
        lines: [{ d: r.subject || 'שירות', qty: 1, price: sub }],
        sub, vat: total - sub, total, paid, t: issued, due,
        pays: paid ? [{ t: issued, sum: paid, how: 'אשראי' }] : [] };
    });
  }

  /* ---------------- לוגיקה ---------------- */
  const balOf = d => Math.max(0, (+d.total || 0) - (+d.paid || 0));
  function today() { return (typeof clockTodayISO === 'function') ? clockTodayISO() : '2024-05-23'; }
  function daysLate(d) {
    if (!d.due || balOf(d) <= 0) return 0;
    const a = Date.parse(d.due), b = Date.parse(today());
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function docStatus(d) {
    if (d.void) return 'void';
    if (balOf(d) <= 0) return 'paid';
    return daysLate(d) > 0 ? 'overdue' : 'open';
  }
  const ST = { open: 'פתוחה', paid: 'שולמה', overdue: 'באיחור', void: 'בוטלה' };
  /* כרטסת לקוח — כל המסמכים והיתרה */
  function ledger() {
    const m = {};
    DOCS.filter(d => !d.void).forEach(d => {
      const k = d.cust; m[k] = m[k] || { cust: k, phone: d.phone, recId: d.recId, docs: [], billed: 0, paid: 0, open: 0, late: 0 };
      m[k].docs.push(d); m[k].billed += +d.total || 0; m[k].paid += +d.paid || 0;
      m[k].open += balOf(d); m[k].late = Math.max(m[k].late, daysLate(d));
    });
    return Object.values(m).sort((a, b) => b.open - a.open);
  }
  /* גיול חובות — 0-30 / 31-60 / 61-90 / 90+ */
  function aging() {
    const b = { cur: 0, d30: 0, d60: 0, d90: 0, over: 0 };
    DOCS.filter(d => !d.void && balOf(d) > 0).forEach(d => {
      const n = daysLate(d), v = balOf(d);
      if (n <= 0) b.cur += v; else if (n <= 30) b.d30 += v; else if (n <= 60) b.d60 += v;
      else if (n <= 90) b.d90 += v; else b.over += v;
    });
    return b;
  }
  function dunStage(d) {
    const n = daysLate(d); let cur = null;
    DUN.slice().sort((a, b2) => a.days - b2.days).forEach(s => { if (n >= s.days) cur = s; });
    return cur;
  }
  function billAdd(doc) {
    const seq = 2401 + DOCS.length;
    const PFX = { receipt: 'REC-', credit: 'CRD-', proforma: 'PRO-', invoice: 'INV-', invrec: 'TRX-' };
    const d = Object.assign({ no: (PFX[doc.kind] || 'INV-') + seq,
      kind: 'invoice', cust: '', lines: [], paid: 0, pays: [], t: today(), due: today() }, doc);
    d.sub = d.lines.reduce((a, l) => a + (+l.qty || 1) * (+l.price || 0), 0);
    d.vat = Math.round(d.sub * VAT); d.total = d.sub + d.vat;
    DOCS.unshift(d); save(); CBX.emit('bill:doc', d);
    return d;
  }
  function billPay(no, sum, how) {
    const d = DOCS.find(x => x.no === no); if (!d) return { ok: false };
    const s = Math.min(+sum || 0, balOf(d));
    if (s <= 0) return { ok: false, why: 'אין יתרה לתשלום' };
    d.paid = (+d.paid || 0) + s; d.pays = d.pays || [];
    d.pays.push({ t: today(), sum: s, how: how || 'אשראי' });
    save(); CBX.emit('bill:pay', { doc: d, sum: s });
    const left = balOf(d);
    /* סולק במלואו → קבלה מופקת מיד. אותה התנהגות מהממשק ומקוד. */
    if (left === 0 && CFG.autoOnPay && !d.settles && d.kind !== 'receipt' && d.kind !== 'invrec') {
      const kind = docOnPay(), k = KINDS.find(x => x.key === kind) || {};
      billAdd({ kind, cust: d.cust, recId: d.recId, phone: d.phone, settles: d.no,
        lines: [{ d: (k.label || 'תקבול') + ' עבור ' + d.no, qty: 1, price: Math.round((+d.total || 0) / (1 + VAT)) }],
        paid: d.total, due: today() });
    }
    return { ok: true, left };
  }

  /* ---------------- מסך הגבייה ---------------- */
  function billHTML() {
    const ag = aging(), led = ledger();
    const openTotal = DOCS.filter(d => !d.void).reduce((a, d) => a + balOf(d), 0);
    const lateTotal = DOCS.filter(d => docStatus(d) === 'overdue').reduce((a, d) => a + balOf(d), 0);
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${CBX.money(DOCS.filter(d => !d.void).reduce((a, d) => a + d.total, 0))}</b><small>סה״כ חויב</small></div>
        <div class="inv-kpi"><b>${CBX.money(openTotal)}</b><small>יתרה פתוחה</small></div>
        <div class="inv-kpi ${lateTotal ? 'warn' : ''}"><b>${CBX.money(lateTotal)}</b><small>בפיגור</small></div>
        <div class="inv-kpi"><b>${led.length}</b><small>לקוחות בכרטסת</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${billTab === 'docs' ? 'on' : ''}" data-billtab="docs">${ic('docs')} מסמכים</button>
        <button class="inv-tab ${billTab === 'ledger' ? 'on' : ''}" data-billtab="ledger">${ic('clients')} כרטסת לקוחות</button>
        <button class="inv-tab ${billTab === 'aging' ? 'on' : ''}" data-billtab="aging">${ic('clock')} גיול חובות</button>
        <button class="inv-tab ${billTab === 'dun' ? 'on' : ''}" data-billtab="dun">${ic('bolt')} מסלול גבייה</button>
        <button class="inv-tab ${billTab === 'cfg' ? 'on' : ''}" data-billtab="cfg">${ic('settings')} תהליך חשבונאי</button>
      </div>
      ${billTab === 'docs' ? docsHTML() : billTab === 'ledger' ? ledgerHTML(led)
        : billTab === 'aging' ? agingHTML(ag) : billTab === 'cfg' ? acctCfgHTML() : dunHTML()}
    </div>`;
  }

  const FILTERS = [{ k: 'all', l: 'הכל' }, { k: 'open', l: 'פתוחות' }, { k: 'overdue', l: 'באיחור' }, { k: 'paid', l: 'שולמו' }];
  function docsHTML() {
    const list = DOCS.filter(d => billFilter === 'all' || docStatus(d) === billFilter);
    return `<div class="inv-bar">
        <span class="ap-filters">${FILTERS.map(f => `<button class="ap-f ${billFilter === f.k ? 'on' : ''}" data-billf="${f.k}">${f.l}</button>`).join('')}</span>
        <button class="btn sm primary" id="billNew">${ic('plus')} מסמך חדש</button>
      </div>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>מסמך</th><th>לקוח</th><th>תאריך</th><th>לתשלום עד</th><th>סכום</th><th>שולם</th><th>יתרה</th><th>סטטוס</th><th></th></tr></thead>
        <tbody>${list.map(d => { const st = docStatus(d), late = daysLate(d), stage = dunStage(d);
          return `<tr class="${st === 'overdue' ? 'low' : ''}">
            <td class="mono"><b>${esc(d.no)}</b><br><small>${esc((KINDS.find(k => k.key === d.kind) || {}).label || d.kind)}</small></td>
            <td>${esc(d.cust)}</td><td><small>${esc(d.t)}</small></td>
            <td><small>${esc(d.due || '—')}</small>${late ? `<br><span class="bill-late">${late} ימי פיגור</span>` : ''}</td>
            <td><b>${CBX.money(d.total)}</b></td><td>${CBX.money(d.paid)}</td>
            <td><b>${balOf(d) ? CBX.money(balOf(d)) : '—'}</b></td>
            <td><span class="bill-st ${st}">${ST[st]}</span>${stage ? `<br><small class="bill-stage">${esc(stage.action)}</small>` : ''}</td>
            <td class="inv-acts">
              ${balOf(d) > 0 && !d.void ? `<button class="btn xs primary" data-billpay="${esc(d.no)}">תשלום</button>` : ''}
              <button class="btn xs" data-billview="${esc(d.no)}">${ic('eye')}</button>
            </td></tr>`; }).join('') || `<tr><td colspan="9" class="inv-empty">אין מסמכים בסינון זה</td></tr>`}
        </tbody></table></div>`;
  }

  function ledgerHTML(led) {
    return `<p class="inv-lead">מי חייב כמה, ומאיזה תאריך. לחיצה על לקוח פותחת את כל המסמכים שלו.</p>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>לקוח</th><th>מסמכים</th><th>חויב</th><th>שולם</th><th>יתרה פתוחה</th><th>פיגור מקסימלי</th></tr></thead>
        <tbody>${led.map(l => `<tr class="${l.late > 30 ? 'low' : ''}">
          <td><b>${esc(l.cust)}</b>${l.phone ? '<br><small>' + esc(l.phone) + '</small>' : ''}</td>
          <td>${l.docs.length}</td><td>${CBX.money(l.billed)}</td><td>${CBX.money(l.paid)}</td>
          <td><b>${l.open ? CBX.money(l.open) : '—'}</b></td>
          <td>${l.late ? '<span class="bill-late">' + l.late + ' ימים</span>' : '—'}</td>
        </tr>`).join('') || `<tr><td colspan="6" class="inv-empty">אין נתוני כרטסת</td></tr>`}</tbody></table></div>`;
  }

  function agingHTML(ag) {
    const tot = ag.cur + ag.d30 + ag.d60 + ag.d90 + ag.over || 1;
    const rows = [['שוטף — טרם הגיע מועד', ag.cur, 'ok'], ['1–30 ימי פיגור', ag.d30, 'w1'],
      ['31–60 ימי פיגור', ag.d60, 'w2'], ['61–90 ימי פיגור', ag.d90, 'w3'], ['מעל 90 ימים', ag.over, 'w4']];
    return `<p class="inv-lead">חלוקת החוב הפתוח לפי ותק. ככל שהחוב ותיק יותר — הסיכוי לגבות אותו קטן.</p>
      <div class="bill-aging">${rows.map(([l, v, c]) => `<div class="bill-age-row">
        <span class="bar-l">${l}</span>
        <span class="bar-t"><span class="bar-f ${c}" style="width:${Math.round(v / tot * 100)}%"></span></span>
        <b>${CBX.money(v)}</b></div>`).join('')}</div>`;
  }

  function dunHTML() {
    return `<p class="inv-lead">מה קורה כשלקוח לא משלם — שלב אחרי שלב, אוטומטית.
      האוטומציה "מסלול גבייה" מריצה את השלבים לפי ימי הפיגור.</p>
      <div class="bill-dun">${DUN.sort((a, b) => a.days - b.days).map((s, i) => `
        <div class="bill-dun-step">
          <span class="bd-n">${i + 1}</span>
          <div class="bd-body">
            <div class="bd-row"><span>אחרי</span>
              <input class="cc-inp sm" type="number" min="1" max="365" value="${s.days}" data-dund="${i}"><span>ימי פיגור</span></div>
            <input class="cc-inp sm" value="${esc(s.action)}" data-duna="${i}" placeholder="מה עושים">
            <input class="cc-inp sm" value="${esc(s.how)}" data-dunh="${i}" placeholder="באיזה ערוץ">
          </div>
          <button class="btn xs" data-dundel="${i}">${ic('close')}</button>
        </div>`).join('')}</div>
      <button class="btn sm" id="dunAdd">${ic('plus')} הוסף שלב</button>`;
  }

  function acctCfgHTML() {
    const set = (typeof apSet === 'function') ? apSet
      : (l, h, c) => '<div class="ap-set"><div class="ap-set-h"><b>' + l + '</b><small>' + h + '</small></div><div class="ap-set-c">' + c + '</div></div>';
    const onSale = docOnSale(), onPay = docOnPay();
    const lbl = k => (KINDS.find(x => x.key === k) || {}).label || '';
    return `<div class="ap-wrap">
      ${set('איך מפיקים מסמכים אחרי רכישה?', 'כל עסק עובד אחרת. הבחירה כאן קובעת איזה מסמך מופק, ומתי — במכירה או כשהכסף מתקבל בפועל.',
        `<div class="rt-methods">${FLOWS.map(x => `<button class="rt-m ${CFG.flow === x.key ? 'on' : ''}" data-bflow="${x.key}">
          <b>${x.label}</b><small>${x.desc}</small></button>`).join('')}</div>`)}
      <div class="bill-flow-map">
        <div class="bfm-h">${ic('bolt')} <b>כך זה יעבוד אצלכם</b></div>
        <div class="bfm-steps">
          <div class="bfm-step"><span>1</span><b>הלקוח רוכש</b>
            <small>${onSale ? 'מופקת ' + lbl(onSale) : 'לא מופק מסמך מס בשלב זה'}</small></div>
          <div class="bfm-arrow">${ic('chevronL')}</div>
          <div class="bfm-step"><span>2</span><b>הכסף מתקבל</b>
            <small>מופקת ${lbl(onPay)}</small></div>
          <div class="bfm-arrow">${ic('chevronL')}</div>
          <div class="bfm-step"><span>3</span><b>תיוק אוטומטי</b>
            <small>המסמך נכנס לכרטסת הלקוח ולתיק הפנייה</small></div>
        </div></div>
      ${set('להפיק מסמך אוטומטית בעת המכירה', 'ברגע שמתקבלת הזמנה מהחנות — המערכת מפיקה את המסמך המתאים בלי התערבות.',
        `<label class="rt-row"><input type="checkbox" id="bcSale" ${CFG.autoOnSale ? 'checked' : ''}><span>כן</span></label>`)}
      ${set('להפיק מסמך אוטומטית בעת התשלום', 'כשחוב מסולק במלואו — מופק מסמך התקבול לפי התהליך שנבחר.',
        `<label class="rt-row"><input type="checkbox" id="bcPay" ${CFG.autoOnPay ? 'checked' : ''}><span>כן</span></label>`)}
      ${set('שיעור מע״מ', 'משמש לפיצול בין הסכום לפני מע״מ לסכום הכולל על המסמך.',
        `<div class="ap-hours"><input class="cc-inp sm" type="number" min="0" max="30" id="bcVat" value="${CFG.vat}"><span>%</span></div>`)}
      ${set('פרטי העוסק על המסמך', 'השם והח.פ שמודפסים על כל מסמך מס.',
        `<div class="inv-f2"><label class="inv-f"><span>שם העוסק</span><input class="cc-inp" id="bcBiz" value="${esc(CFG.biz)}"></label>
         <label class="inv-f"><span>ח.פ / ע.מ</span><input class="cc-inp" id="bcBizId" value="${esc(CFG.bizId)}"></label></div>`)}
      ${set('מספר הקצאה מרשות המסים', 'נדרש בישראל לחשבוניות מעל הסף שנקבע. במערכת חיה המספר נמשך אוטומטית מול הרשות בעת ההפקה.',
        `<label class="rt-row"><input type="checkbox" id="bcAlloc" ${CFG.allocate ? 'checked' : ''}><span>לבקש מספר הקצאה בעת ההפקה</span></label>`)}
      <p class="cr-hint">${ic('alert')} זהו אב-טיפוס: המספור כאן הוא הדגמה. בהפעלה אמיתית ההפקה, המספור והדיווח
        מתבצעים מול ספק חשבוניות מאושר.</p>
    </div>`;
  }

  function billBind(RR) {
    $$('[data-billtab]').forEach(b => b.addEventListener('click', () => { billTab = b.dataset.billtab; RR(); }));
    $$('[data-billf]').forEach(b => b.addEventListener('click', () => { billFilter = b.dataset.billf; RR(); }));
    $$('[data-billpay]').forEach(b => b.addEventListener('click', () => openPay(b.dataset.billpay, RR)));
    $$('[data-billview]').forEach(b => b.addEventListener('click', () => openDoc(b.dataset.billview, RR)));
    const nb = $('#billNew'); if (nb) nb.addEventListener('click', () => openNewDoc(RR));
    $$('[data-dund]').forEach(i => i.addEventListener('change', () => { DUN[+i.dataset.dund].days = +i.value || 1; saveDun(); RR(); }));
    $$('[data-duna]').forEach(i => i.addEventListener('change', () => { DUN[+i.dataset.duna].action = i.value; saveDun(); }));
    $$('[data-dunh]').forEach(i => i.addEventListener('change', () => { DUN[+i.dataset.dunh].how = i.value; saveDun(); }));
    $$('[data-dundel]').forEach(b => b.addEventListener('click', () => { DUN.splice(+b.dataset.dundel, 1); saveDun(); RR(); }));
    const da = $('#dunAdd'); if (da) da.addEventListener('click', () => { DUN.push({ days: 90, action: 'שלב חדש', how: 'התראה למנהל' }); saveDun(); RR(); });
    /* הגדרות התהליך החשבונאי */
    $$('[data-bflow]').forEach(b => b.addEventListener('click', () => { CFG.flow = b.dataset.bflow; saveCfg(); RR(); }));
    const gv = id => document.getElementById(id);
    ['bcSale', 'bcPay', 'bcAlloc'].forEach(id => { const e = gv(id); if (!e) return;
      e.addEventListener('change', () => { CFG.autoOnSale = gv('bcSale').checked; CFG.autoOnPay = gv('bcPay').checked;
        CFG.allocate = gv('bcAlloc').checked; saveCfg(); }); });
    ['bcVat', 'bcBiz', 'bcBizId'].forEach(id => { const e = gv(id); if (!e) return;
      e.addEventListener('change', () => { CFG.vat = +gv('bcVat').value || 17; CFG.biz = gv('bcBiz').value;
        CFG.bizId = gv('bcBizId').value; saveCfg(); }); });
  }

  function panel(id, html, bind) {
    const old = document.getElementById(id); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = id;
    w.innerHTML = html;
    w.addEventListener('mousedown', e => { if (e.target === w) w.remove(); });
    document.body.appendChild(w); if (bind) bind(w); return w;
  }
  function openPay(no, done) {
    const d = DOCS.find(x => x.no === no); if (!d) return;
    panel('billPayPanel', `<div class="cbc-box bill-pay">
      <div class="cbc-head"><span class="cbc-ic">${ic('shekel')}</span><b>רישום תשלום · ${esc(d.no)}</b></div>
      <div class="bill-pay-sum"><span>${esc(d.cust)}</span><b>יתרה: ${CBX.money(balOf(d))}</b></div>
      <div class="inv-f2">
        <label class="inv-f"><span>סכום</span><input class="cc-inp" type="number" min="0" id="pySum" value="${balOf(d)}"></label>
        <label class="inv-f"><span>אמצעי</span><select class="cc-inp" id="pyHow">
          <option>אשראי</option><option>העברה בנקאית</option><option>מזומן</option><option>צ׳ק</option><option>הוראת קבע</option></select></label>
      </div>
      ${(d.pays || []).length ? `<div class="bill-pays"><b>תשלומים קודמים</b>${d.pays.map(p => `<span>${esc(p.t)} · ${CBX.money(p.sum)} · ${esc(p.how)}</span>`).join('')}</div>` : ''}
      <div class="cbc-actions"><button class="btn primary" id="pyOk">${ic('check')} רשום תשלום</button>
        <button class="btn ghost" id="pyX">ביטול</button></div></div>`, w => {
      $('#pyX', w).addEventListener('click', () => w.remove());
      $('#pyOk', w).addEventListener('click', () => {
        const r = billPay(no, $('#pySum', w).value, $('#pyHow', w).value);
        if (!r.ok) { toast(r.why || 'לא ניתן לרשום'); return; }
        w.remove(); if (done) done();
        toast(r.left === 0 ? 'שולם במלואו — הופקה קבלה ✓' : 'נרשם תשלום · נותרו ' + CBX.money(r.left));
      });
    });
  }
  function openDoc(no, done) {
    const d = DOCS.find(x => x.no === no); if (!d) return;
    const st = docStatus(d);
    panel('billDocPanel', `<div class="cbc-box bill-doc">
      <div class="cbc-head"><span class="cbc-ic">${ic('docs')}</span><b>${esc((KINDS.find(k => k.key === d.kind) || {}).label)} ${esc(d.no)}</b></div>
      <div class="bill-doc-top"><span><i>לקוח</i><b>${esc(d.cust)}</b></span>
        <span><i>תאריך</i><b>${esc(d.t)}</b></span><span><i>לתשלום עד</i><b>${esc(d.due || '—')}</b></span>
        <span><i>סטטוס</i><b class="bill-st ${st}">${ST[st]}</b></span></div>
      <table class="inv-table"><thead><tr><th>תיאור</th><th>כמות</th><th>מחיר</th><th>סה״כ</th></tr></thead>
        <tbody>${d.lines.map(l => `<tr><td>${esc(l.d)}</td><td>${l.qty}</td><td>${CBX.money(l.price)}</td>
          <td>${CBX.money((l.qty || 1) * l.price)}</td></tr>`).join('')}</tbody></table>
      <div class="shop-sum"><div><span>לפני מע״מ</span><b>${CBX.money(d.sub)}</b></div>
        <div><span>מע״מ 17%</span><b>${CBX.money(d.vat)}</b></div>
        <div class="tot"><span>סה״כ</span><b>${CBX.money(d.total)}</b></div>
        ${d.paid ? `<div><span>שולם</span><b>${CBX.money(d.paid)}</b></div>` : ''}
        ${balOf(d) ? `<div class="disc"><span>יתרה</span><b>${CBX.money(balOf(d))}</b></div>` : ''}</div>
      <div class="cbc-actions">
        ${!d.void && st !== 'paid' ? `<button class="btn" id="dcVoid">${ic('close')} בטל מסמך</button>` : ''}
        <button class="btn primary" id="dcX">${ic('check')} סגור</button></div></div>`, w => {
      $('#dcX', w).addEventListener('click', () => w.remove());
      const v = $('#dcVoid', w); if (v) v.addEventListener('click', () => {
        d.void = true; save(); w.remove(); if (done) done(); toast('המסמך בוטל'); });
    });
  }
  function openNewDoc(done) {
    const recs = (typeof RECORDS !== 'undefined') ? RECORDS : [];
    panel('billNewPanel', `<div class="cbc-box bill-new">
      <div class="cbc-head"><span class="cbc-ic">${ic('plus')}</span><b>מסמך חדש</b></div>
      <div class="inv-f2">
        <label class="inv-f"><span>סוג המסמך</span><select class="cc-inp" id="ndKind">${KINDS.map(k => `<option value="${k.key}">${k.label}</option>`).join('')}</select></label>
        <label class="inv-f"><span>לקוח</span><select class="cc-inp" id="ndCust">${recs.map(r => `<option value="${esc(String(r.id))}">${esc(r.name)}</option>`).join('')}</select></label>
        <label class="inv-f"><span>תיאור</span><input class="cc-inp" id="ndDesc" placeholder="למשל: טיפול לייזר · מאי"></label>
        <label class="inv-f"><span>סכום לפני מע״מ</span><input class="cc-inp" type="number" min="0" id="ndSum" value="0"></label>
        <label class="inv-f"><span>לתשלום עד</span><input class="cc-inp" type="date" id="ndDue"></label>
      </div>
      <div class="cbc-actions"><button class="btn primary" id="ndOk">${ic('check')} הפק מסמך</button>
        <button class="btn ghost" id="ndX">ביטול</button></div></div>`, w => {
      $('#ndX', w).addEventListener('click', () => w.remove());
      $('#ndOk', w).addEventListener('click', () => {
        const sum = +$('#ndSum', w).value || 0;
        if (sum <= 0) { toast('נא להזין סכום'); return; }
        const r = recs.find(x => String(x.id) === $('#ndCust', w).value) || {};
        billAdd({ kind: $('#ndKind', w).value, cust: r.name || 'לקוח', recId: r.id, phone: r.phone,
          lines: [{ d: $('#ndDesc', w).value || 'שירות', qty: 1, price: sum }],
          due: $('#ndDue', w).value || today() });
        w.remove(); if (done) done(); toast('המסמך הופק ✓');
      });
    });
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'bill', label: 'גבייה וחשבוניות', icon: 'shekel',
    desc: 'מסמכי חובה, כרטסת לקוח עם יתרות, תשלומים חלקיים, דוח גיול חובות ומסלול גבייה מדורג אוטומטי.',
    files: ['js/ext/billing.js'],
    install() {
      /* מסך משלו בניווט ההגדרות */
      if (typeof SET_GROUPS !== 'undefined') CBX.push('bill', SET_GROUPS, [{
        key: 'billing', label: 'גבייה', icon: 'shekel', desc: 'חשבוניות, כרטסת ויתרות פתוחות',
        items: [{ m: 'billing', label: 'גבייה וחשבוניות', icon: 'shekel', desc: 'מסמכים · כרטסת · גיול · מסלול גבייה' }] }]);
      CBX.wrap('bill', 'applySetMode', o => function (m) { billMode = m === 'billing'; return o.apply(this, arguments); });
      CBX.wrap('bill', 'currentSetModeKey', o => function () { return billMode ? 'billing' : o.apply(this, arguments); });
      CBX.wrap('bill', 'renderSettingsView', o => function () {
        if (!billMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + billHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        billBind(() => renderSettingsView());
      });
      /* אוטומציה: מסלול גבייה */
      if (typeof AUTOMATIONS !== 'undefined') CBX.push('bill', AUTOMATIONS,
        [{ key: 'x_dunning', trigger: 'חוב בפיגור', title: 'מסלול גבייה מדורג', desc: 'תזכורת → התראה → הקפאה → משפטי, לפי ימי הפיגור', on: false }]);
      if (typeof AUTO_IMPL !== 'undefined') CBX.assign('bill', AUTO_IMPL, {
        x_dunning: {
          what: 'עובר על כל החובות הפתוחים ומפעיל את שלב הגבייה שמתאים לוותק החוב — תזכורת רכה בהתחלה, ועד העברה לטיפול משפטי. השלבים ניתנים לעריכה במסך הגבייה.',
          run: () => {
            const late = DOCS.filter(d => !d.void && docStatus(d) === 'overdue');
            if (!late.length) return 'אין חובות בפיגור — לא בוצע';
            const done = [];
            late.slice(0, 6).forEach(d => { const s = dunStage(d); if (!s) return;
              done.push(d.no + ' → ' + s.action);
              if (typeof autoNotify === 'function')
                autoNotify('גבייה · ' + s.action, d.cust + ' · ' + CBX.money(balOf(d)) + ' · ' + daysLate(d) + ' ימי פיגור · ' + s.how, 'reminder'); });
            return done.length ? 'הופעלו ' + done.length + ' שלבי גבייה: ' + done.join(' · ') : 'אין חוב שהגיע לשלב הראשון';
          } } });
      /* הזמנה מהחנות → דרישת תשלום אוטומטית */
      CBX.on('bill', 'shop:order', o => {
        if (!CFG.autoOnSale) return;
        const lines = o.lines.map(l => ({ d: l.name, qty: l.qty, price: Math.round(l.price / (1 + VAT)) }));
        const saleKind = docOnSale();
        /* יש תהליכים שבהם לא מופק מסמך במכירה אלא רק כשהכסף מתקבל */
        const d = billAdd({ kind: saleKind || docOnPay(), cust: o.name, phone: o.phone, recId: o.recId,
          lines, due: today(), paid: saleKind ? 0 : o.totals.total });
        if (!saleKind) { d.pays = [{ t: today(), sum: o.totals.total, how: 'אשראי · חנות' }]; save(); }
      });
      /* חשבוניות בחיפוש */
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('bill', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        DOCS.forEach(d => { if ((d.no + ' ' + d.cust).toLowerCase().includes(q))
          res.push({ type: 'מסמך גבייה', label: d.no + ' · ' + d.cust, goto: 'billing',
            sub: CBX.money(d.total) + ' · ' + ST[docStatus(d)] }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('bill', 'gotoEntity', o => function (where, id) {
        if (where === 'billing') { navActive = 'settings'; applySetMode('billing'); renderSettingsView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('bill', () => { billMode = false; });
    },
  });

  window.BILL = { cfg: () => CFG, flows: () => FLOWS, onSale: docOnSale, onPay: docOnPay, docs: () => DOCS, add: billAdd, pay: billPay, ledger, aging, balance: balOf, status: docStatus };
})();
