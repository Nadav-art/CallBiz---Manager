/* ============================================================
   הרחבה: חיבור ל-CallBiz Desktop  ·  key = 'desklink'
   ------------------------------------------------------------
   הדסקטופ הוא פרויקט נפרד (desktop/). ההרחבה הזו היא הצד של
   המנג׳ר בחוזה — ולא יותר מזה:

     · טאב "שיחות" הופך לבית של הדסקטופ (משובץ, לא חלון נפרד)
     · עונה לבקשות הדסקטופ: זהות והרשאות, חיפוש לקוח לפי טלפון,
       רישום שיחה, ופתיחת כרטיס (screen-pop)
     · click-to-call: לחיצה על מספר טלפון בכל מקום במערכת מחייגת

   הדסקטופ ממשיך לעבוד גם בלי ההרחבה — אז הוא פשוט במצב הדגמה.
   ============================================================ */
(function () {

  const DESK = 'desktop/index.html';

  /* ---------------- הזהות שנשלחת לדסקטופ ---------------- */
  function session() {
    const me = (typeof STAFF !== 'undefined')
      ? STAFF.find(s => s.name === (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '')) : null;
    const perm = me ? me.perm : 'נציג';
    const mgr = perm === 'מנהל רשת' || perm === 'אדמין' || perm === 'מנהל סניף';
    return {
      employee: { id: me ? me.id : 'guest', name: me ? me.name : 'אורח',
        role: me ? me.role : '', avatar: me ? me.name[0] : '?', ext: me ? (me.ext || '') : '' },
      active: !!(me && me.on !== false && me.avail !== 'offline'),
      activities: me ? (me.occ || []) : [],
      role: mgr ? 'manager' : 'agent',
      perms: {
        call: !!me, transfer: !!me, conference: mgr, record: mgr,
        viewCrm: true, editCrm: mgr, diagnostics: true, analytics: mgr, admin: mgr,
      },
      tenant: 'callbiz',
    };
  }

  /* ---------------- חיפוש לקוח לפי טלפון ---------------- */
  function lookup(phone) {
    const d = String(phone || '').replace(/\D/g, '').slice(-9);
    if (!d || typeof RECORDS === 'undefined') return null;
    const r = RECORDS.find(x => String(x.phone || '').replace(/\D/g, '').slice(-9) === d);
    if (!r) return null;
    return { id: r.id, name: r.name, org: r.org || '', phone: r.phone,
      tags: [((typeof ENTITY_TYPES !== 'undefined' && ENTITY_TYPES[r.entity]) || {}).label,
        ((typeof JOURNEY_TYPES !== 'undefined' && JOURNEY_TYPES[r.journey]) || {}).label].filter(Boolean),
      lastCall: (r.next && r.next.at) || '', assignee: r.assignee || '' };
  }

  /* ---------------- רישום שיחה על הפנייה ---------------- */
  function logCall(c) {
    const rec = lookup(c.phone);
    if (!rec || typeof RECORDS === 'undefined') return;
    const r = RECORDS.find(x => x.id === rec.id); if (!r) return;
    r.commLog = r.commLog || [];
    r.commLog.unshift({ type: c.dir === 'in' ? 'call' : 'call', at: (typeof docStamp === 'function') ? docStamp() : '',
      by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''),
      text: (c.dir === 'in' ? 'שיחה נכנסת' : 'שיחה יוצאת') + ' · ' + fmt(c.seconds) +
        (c.outcome ? ' · ' + c.outcome : '') + (c.quality ? ' · איכות ' + c.quality : '') });
    if (typeof renderList === 'function') renderList();
    if (typeof selectedId !== 'undefined' && selectedId === r.id && typeof renderDrawerTab === 'function') renderDrawerTab(r);
  }
  const fmt = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------------- שרת ההודעות ---------------- */
  function frame() { const f = document.getElementById('deskFrame'); return f && f.contentWindow; }
  function reply(src, id, payload) { if (src) src.postMessage({ ns: 'callbiz', dir: 'crm→desk', id, payload }, '*'); }
  function push(type, payload) { const w = frame(); if (w) w.postMessage({ ns: 'callbiz', dir: 'crm→desk', type, payload }, '*'); }

  function onMsg(e) {
    const m = e.data;
    if (!m || m.ns !== 'callbiz' || m.dir !== 'desk→crm') return;
    if (m.type === 'session') return reply(e.source, m.id, session());
    if (m.type === 'lookup') return reply(e.source, m.id, lookup((m.payload || {}).phone));
    if (m.type === 'logCall') { logCall(m.payload || {}); return reply(e.source, m.id, { ok: true }); }
    if (m.type === 'screenPop') {
      const p = m.payload || {};
      const r = (typeof RECORDS !== 'undefined') ? RECORDS.find(x => x.id === p.id) : null;
      if (r && typeof openDrawer === 'function') { navActive = 'leads'; if (typeof renderUnifiedView === 'function') renderUnifiedView(); openDrawer(r); }
      return reply(e.source, m.id, { ok: !!r });
    }
  }

  /* ---------------- מסך "שיחות" ---------------- */
  function screen() {
    const host = document.getElementById('viewHost'); if (!host) return;
    host.innerHTML = `
      <div class="view-head">
        <div class="vh-title"><span class="num">${ic('phone')}</span> שיחות
          <span class="muted">· שולחן העבודה של הנציג — טלפוניה, אבחון וביצועים</span></div>
        <div class="vh-actions">
          <button class="btn sm" id="dkOpen">${ic('layers')} פתח בחלון נפרד</button>
          <button class="btn sm ghost" id="dkReload">${ic('sync')} רענן</button>
        </div>
      </div>
      <div class="dk-wrap"><iframe id="deskFrame" class="dk-frame" src="${DESK}"
        allow="microphone; autoplay" title="CallBiz Desktop"></iframe></div>`;
    const o = document.getElementById('dkOpen');
    if (o) o.addEventListener('click', () => window.open(DESK, 'cbdesk', 'width=1280,height=820'));
    const r = document.getElementById('dkReload');
    if (r) r.addEventListener('click', () => { const f = document.getElementById('deskFrame'); f.src = f.src; });
  }

  CBX.register({
    key: 'desklink', label: 'שולחן העבודה של הנציג (Desktop)', icon: 'phone',
    desc: 'טאב "שיחות" מארח את CallBiz Desktop המשובץ, ומספק לו זהות והרשאות מה-CRM, זיהוי לקוח לפי טלפון, רישום שיחות ופתיחת כרטיס. כולל click-to-call מכל מספר טלפון במערכת.',
    files: ['js/ext/desk-link.js', 'css/ext/desk.css', 'desktop/'],
    install() {
      window.addEventListener('message', onMsg);
      CBX._remember('desklink', () => window.removeEventListener('message', onMsg));

      /* טאב "שיחות" */
      CBX.delegate('desklink', '[data-nav="calls"]', () => setTimeout(screen, 0));

      /* click-to-call — כל מספר טלפון במערכת */
      CBX.delegate('desklink', '[data-dial]', el => {
        const ph = el.dataset.dial; if (!ph) return;
        navActive = 'calls';
        if (typeof renderNav === 'function') renderNav();
        screen();
        setTimeout(() => push('dial', { phone: ph }), 900);
        toast('מחייג ' + ph + ' משולחן העבודה');
      });
    },
  });

  window.DESKLINK = { session, lookup, logCall, push, screen };
})();
