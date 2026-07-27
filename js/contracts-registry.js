/* ============================================================
   מרשם הסכמים — מעקב מלא על כל הסכם שהופק (מודול עצמאי)
   סטטוס · תוקף · טוקן · מסלול ביקורת (audit) · תזכורות · גרסת תבנית
   ============================================================ */
const CT_STATUS = {
  draft:     { label: 'טיוטה',        color: 'gray' },
  sent:      { label: 'נשלח לחתימה',  color: 'blue' },
  viewed:    { label: 'נצפה',         color: 'amber' },
  signed:    { label: 'נחתם',         color: 'green' },
  expired:   { label: 'פג תוקף',      color: 'red' },
  cancelled: { label: 'בוטל',         color: 'red' },
};
let CONTRACT_REGISTRY = (function () { try { return JSON.parse(localStorage.getItem('cb_ctReg')) || []; } catch (e) { return []; } })();
function ctRegSave() { try { localStorage.setItem('cb_ctReg', JSON.stringify(CONTRACT_REGISTRY)); } catch (e) {} }
let CT_SEQ = (function () { try { return +localStorage.getItem('cb_ctSeq') || 11400; } catch (e) { return 11400; } })();
function ctNextNo() { CT_SEQ++; try { localStorage.setItem('cb_ctSeq', String(CT_SEQ)); } catch (e) {} return CT_SEQ; }
function ctStamp() { return (typeof docStamp === 'function') ? docStamp() : ''; }

/* הגדרות מנהל: תוקף קישור החתימה + תזכורת אוטומטית */
function ctValidDays() { try { return +localStorage.getItem('cb_ctValid') || 14; } catch (e) { return 14; } }
function ctSetValidDays(d) { try { localStorage.setItem('cb_ctValid', String(Math.max(1, +d || 14))); } catch (e) {} }
function ctRemindDays() { try { return +localStorage.getItem('cb_ctRemind') || 3; } catch (e) { return 3; } }
function ctSetRemindDays(d) { try { localStorage.setItem('cb_ctRemind', String(Math.max(0, +d || 3))); } catch (e) {} }

/* יצירת רשומת הסכם + מסלול ביקורת. נוסח ההסכם וגרסת התבנית "ננעלים" ברגע ההפקה. */
function ctRegisterIssue(tpl, lead, opts) {
  opts = opts || {};
  const rec = {
    no: ctNextNo(), tplId: tpl.id, tplName: tpl.name, tplVer: tpl.ver || 1,
    textSnapshot: (typeof contractMerge === 'function') ? contractMerge(tpl.text, lead) : tpl.text,
    leadId: lead ? lead.id : null, client: lead ? lead.name : '', phone: lead ? (lead.phone || '') : '',
    amount: (lead && lead.services && typeof svcTotals === 'function') ? svcTotals(lead.services).price : 0,
    status: 'sent', at: ctStamp(), by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''),
    validDays: opts.validDays || ctValidDays(), token: null, signedAt: null,
    audit: [{ act: 'הופק ונשלח לחתימה', by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''), at: ctStamp() }],
  };
  CONTRACT_REGISTRY.unshift(rec); ctRegSave();
  return rec;
}
function ctRegFind(no) { return CONTRACT_REGISTRY.find(function (x) { return x.no === no; }); }
function ctRegSetStatus(no, status, extra) {
  const rec = ctRegFind(no); if (!rec) return null;
  rec.status = status;
  if (status === 'signed' && typeof autoFire === 'function') {
    const _r = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => x.name === rec.client) : null;
    autoFire('h8', { rec: _r, contract: rec });
  }
  if (status === 'signed') { rec.signedAt = ctStamp(); rec.token = rec.token || ('tok_' + (rec.no % 10000) + '_' + ((rec.no * 37) % 9000 + 1000)); }
  Object.assign(rec, extra || {});
  rec.audit.push({ act: (CT_STATUS[status] || {}).label || status, by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''), at: ctStamp() });
  ctRegSave(); return rec;
}

/* ---------------- UI: מרשם ההסכמים ---------------- */
let ctRegFilter = 'all';
function ctRegistryCardHTML() {
  /* סינון לפי קהל (לקוחות / עובדים) — רשומה ללא audience נחשבת ללקוח */
  const aud = (typeof ctAud !== 'undefined') ? ctAud : 'client';
  const inAud = function (x) { return (x.audience || 'client') === aud; };
  const pool = CONTRACT_REGISTRY.filter(inAud);
  const rows = pool.filter(function (x) { return ctRegFilter === 'all' || x.status === ctRegFilter; });
  const counts = {}; pool.forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
  const filters = '<button class="ctreg-f ' + (ctRegFilter === 'all' ? 'on' : '') + '" data-ctregf="all">הכל</button>' +
    Object.keys(CT_STATUS).map(function (k) {
      return '<button class="ctreg-f ' + (ctRegFilter === k ? 'on' : '') + '" data-ctregf="' + k + '">' + CT_STATUS[k].label + (counts[k] ? ' (' + counts[k] + ')' : '') + '</button>';
    }).join('');
  const body = rows.length
    ? '<div class="table-wrap"><table class="mini-table ctreg-table">' +
      '<thead><tr><th>מס׳</th><th>' + (aud === 'employee' ? 'עובד' : 'לקוח') + '</th><th>תבנית</th><th>סכום</th><th>סטטוס</th><th>הופק</th><th>נחתם</th><th>טוקן</th><th>פעולות</th></tr></thead><tbody>' +
      rows.map(function (x) {
        const st = CT_STATUS[x.status] || CT_STATUS.draft;
        const live = (x.status === 'sent' || x.status === 'viewed');
        return '<tr><td><b>' + x.no + '</b></td><td>' + esc(x.client) + '</td>' +
          '<td><small>' + esc(x.tplName) + ' <span class="muted">v' + (x.tplVer || 1) + '</span></small></td>' +
          '<td>' + (x.amount ? x.amount + ' ₪' : '—') + '</td>' +
          '<td><span class="badge ' + st.color + ' sm">' + st.label + '</span></td>' +
          '<td><small class="muted">' + esc(x.at) + '<br>' + esc(x.by) + '</small></td>' +
          '<td><small class="muted">' + (x.signedAt ? esc(x.signedAt) : '—') + '</small></td>' +
          '<td><small class="muted" dir="ltr">' + (x.token || '—') + '</small></td>' +
          '<td class="ctreg-acts">' +
            '<button class="btn xs" data-ctregview="' + x.no + '" title="צפה בנוסח שנשלח">' + ic('eye') + '</button>' +
            (live ? '<button class="btn xs" data-ctregremind="' + x.no + '" title="שלח תזכורת">' + ic('whatsapp') + '</button>' +
              '<button class="btn xs primary" data-ctregsign="' + x.no + '" title="סמן כנחתם">' + ic('check') + '</button>' +
              '<button class="btn xs" data-ctregcancel="' + x.no + '" title="בטל הסכם">' + ic('close') + '</button>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table></div>'
    : '<p class="muted" style="font-size:12.5px;margin:0">' + (aud === 'employee' ? 'טרם הופקו הסכמי העסקה. ההפקה מתבצעת מתוך תיק העובד ב-HR.' : 'טרם הופקו הסכמים. הפקת הסכם מתבצעת מתוך הליד.') + '</p>';
  return '<section class="card set-card wide ctreg-card" style="margin-top:18px">' +
    '<div class="card-head"><div class="title">' + ic('flag') + ' מרשם ' + (aud === 'employee' ? 'הסכמי העסקה' : 'הסכמי לקוחות') + ' <span class="ctreg-count">' + pool.length + '</span></div>' +
      '<div class="ctreg-filters">' + filters + '</div></div>' +
    '<div class="set-body">' + body +
      '<div class="ctreg-settings">' +
        '<label class="ctreg-set">תוקף קישור חתימה (ימים)<input class="cc-inp" type="number" id="ctValidInp" min="1" max="365" value="' + ctValidDays() + '"></label>' +
        '<label class="ctreg-set">תזכורת אוטומטית אם לא נחתם (ימים)<input class="cc-inp" type="number" id="ctRemindInp" min="0" max="60" value="' + ctRemindDays() + '"></label>' +
        '<span class="muted" style="font-size:11.5px">' + ic('lock') + ' כל פעולה נרשמת במסלול ביקורת (מי · מתי) לצורכי קבילות משפטית.</span>' +
      '</div></div></section>';
}
function bindCtRegistry() {
  $$('[data-ctregf]').forEach(function (b) { b.addEventListener('click', function () { ctRegFilter = b.dataset.ctregf; renderContractsView(); }); });
  $$('[data-ctregview]').forEach(function (b) { b.addEventListener('click', function () { ctRegOpenView(+b.dataset.ctregview); }); });
  $$('[data-ctregremind]').forEach(function (b) { b.addEventListener('click', function () {
    const rec = ctRegFind(+b.dataset.ctregremind); if (!rec) return;
    rec.audit.push({ act: 'תזכורת נשלחה', by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''), at: ctStamp() }); ctRegSave();
    renderContractsView(); toast('תזכורת נשלחה ל' + rec.client + ' בוואטסאפ');
  }); });
  $$('[data-ctregsign]').forEach(function (b) { b.addEventListener('click', function () {
    const rec = ctRegSetStatus(+b.dataset.ctregsign, 'signed');
    renderContractsView(); toast('ההסכם ' + rec.no + ' סומן כנחתם ✓ · טוקן: ' + rec.token);
  }); });
  $$('[data-ctregcancel]').forEach(function (b) { b.addEventListener('click', function () {
    const no = +b.dataset.ctregcancel;
    const doIt = function () { ctRegSetStatus(no, 'cancelled'); renderContractsView(); toast('ההסכם בוטל'); };
    if (typeof cbConfirm === 'function') cbConfirm({ title: 'ביטול הסכם', danger: true, confirmLabel: 'בטל הסכם',
      message: 'לבטל את הסכם מס׳ <b>' + no + '</b>? הקישור לחתימה יפסיק לעבוד.', onConfirm: doIt });
    else doIt();
  }); });
  const vi = $('#ctValidInp'); if (vi) vi.addEventListener('change', function () { ctSetValidDays(vi.value); toast('תוקף קישור: ' + ctValidDays() + ' ימים'); });
  const ri = $('#ctRemindInp'); if (ri) ri.addEventListener('change', function () { ctSetRemindDays(ri.value); toast('תזכורת אוטומטית: ' + ctRemindDays() + ' ימים'); });
}
/* צפייה בנוסח שנשלח בפועל + מסלול ביקורת */
function ctRegOpenView(no) {
  const rec = ctRegFind(no); if (!rec) return;
  const old = document.getElementById('ctRegView'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'ctRegView';
  const st = CT_STATUS[rec.status] || CT_STATUS.draft;
  w.innerHTML = '<div class="cbc-box" style="max-width:560px;text-align:start">' +
    '<div class="cbc-head"><span class="cbc-ic">' + ic('docs') + '</span><b>הסכם ' + rec.no + ' · ' + esc(rec.client) + '</b></div>' +
    '<div class="ctreg-meta"><span class="badge ' + st.color + ' sm">' + st.label + '</span>' +
      '<small class="muted">' + esc(rec.tplName) + ' v' + (rec.tplVer || 1) + ' · הופק ' + esc(rec.at) + ' · ' + esc(rec.by) + (rec.token ? ' · טוקן ' + rec.token : '') + '</small></div>' +
    '<pre class="ctreg-snap">' + esc(rec.textSnapshot || '') + '</pre>' +
    '<div class="ctreg-audit"><b>' + ic('history') + ' מסלול ביקורת</b>' +
      (rec.audit || []).map(function (a) { return '<div class="ctreg-audit-row"><span>' + esc(a.act) + '</span><small class="muted">' + esc(a.by) + ' · ' + esc(a.at) + '</small></div>'; }).join('') +
    '</div>' +
    '<div class="cbc-actions"><button class="btn ghost" id="ctRegClose">סגור</button></div></div>';
  document.body.appendChild(w); requestAnimationFrame(function () { w.classList.add('open'); });
  $('#ctRegClose').addEventListener('click', function () { w.remove(); });
  w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
}
