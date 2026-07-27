/* ============================================================
   CallBiz Desktop · מסך ניתוח התקשורת
   ------------------------------------------------------------
   שלוש שכבות על מסך אחד:

   1. המסקנה — משפט אחד למעלה. איפה זה נשבר ומה לעשות.
   2. השרשרת — כל חוליה בדרך שהקול עושה, צבועה לפי מצבה, עם
      הצינור ביניהן שמראה אם משהו באמת זורם. לחיצה על חוליה
      פותחת את הפירוט שלה.
   3. ציר הזמן — מה קרה ומתי. תקלה שנעלמה עדיין מופיעה כאן,
      וזה מה שמאפשר לענות על "זה קרה לי לפני חצי שעה".
   ============================================================ */
(function () {

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = k => (window.ic ? window.ic(k) : '');
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  let open = null;      /* חוליה פתוחה לפירוט */
  let live = true;

  const SIDES = [
    { k: 'me',  label: 'אצלך' },
    { k: 'net', label: 'ברשת' },
    { k: 'far', label: 'בצד השני' },
  ];
  const STATE_HE = { ok: 'תקין', warn: 'לתשומת לב', bad: 'תקלה', idle: 'לא נבדק' };

  function render() {
    const host = $('#stage'); if (!host) return;
    host.innerHTML = `
      <div class="pa">
        <header class="pa-h">
          <div><b>${ic('tools')} ניתוח תקשורת</b>
            <small>מראה בדיוק באיזו חוליה הקול נעצר — ולא רק שהוא נעצר</small></div>
          <div class="pa-h-a">
            <label class="swx tiny live"><input type="checkbox" id="paLive" ${live ? 'checked' : ''}><i></i>
              <span><b>מדידה חיה</b></span></label>
            <button class="btn ghost xs" id="paNow">${ic('refresh')} בדוק עכשיו</button>
            <button class="btn ghost xs" id="paRep">${ic('down') || ''} דוח לתמיכה</button>
          </div>
        </header>
        <div class="pa-body">
          <div id="paVerdict"></div>
          <div id="paChain"></div>
          <div id="paDetail"></div>
          <div class="pa-tl"><div class="pa-tl-h"><b>ציר זמן</b>
            <span>אירועים מהפעלת המערכת</span></div>
            <div class="tl" id="paTl"></div></div>
        </div>
      </div>`;
    $('#paLive').addEventListener('change', e => {
      live = e.target.checked;
      live ? PATH.start(2000) : PATH.stop();
    });
    $('#paNow').addEventListener('click', () => PATH.run());
    $('#paRep').addEventListener('click', report);
    draw();
    timeline();
    if (live) PATH.start(2000); else PATH.run();
  }

  /* ---------------- המסקנה ---------------- */
  function verdict() {
    const v = PATH.verdict(); const h = $('#paVerdict'); if (!h) return;
    if (!v) { h.innerHTML = '<div class="skel"></div>'; return; }
    const where = v.where ? (PATH.LINKS.find(l => l.k === v.where) || {}).label : '';
    h.innerHTML = `
      <div class="vd ${v.sev}">
        <div class="vd-i">${ic(v.sev === 'ok' ? 'check' : 'alert')}</div>
        <div class="vd-t">
          <b>${esc(v.t)}</b>
          ${where ? `<span class="vd-w">החוליה: ${esc(where)}</span>` : ''}
          <p>${esc(v.why)}</p>
          ${v.fix ? `<div class="vd-f"><b>מה עושים</b> ${esc(v.fix)}</div>` : ''}
        </div>
      </div>`;
  }

  /* ---------------- השרשרת ---------------- */
  function chain() {
    const links = PATH.links(); const h = $('#paChain'); if (!h) return;
    const v = PATH.verdict();
    h.innerHTML = SIDES.map(side => {
      const items = PATH.LINKS.filter(l => l.side === side.k);
      return `<div class="zone">
        <div class="zone-l">${esc(side.label)}</div>
        <div class="zone-c">${items.map((l, i) => {
          const d = links[l.k] || { state: 'idle', value: '…' };
          const isCulprit = v && v.where === l.k;
          return `${i ? pipe(links, items[i - 1].k, l.k) : ''}
            <button class="nd ${d.state} ${isCulprit ? 'culprit' : ''} ${open === l.k ? 'open' : ''}" data-l="${l.k}">
              <span class="nd-i">${ic(l.icon)}</span>
              <b>${esc(l.label)}</b>
              <small>${esc(d.value)}</small>
              ${d.extra && d.extra.level != null ? `<span class="nd-m"><i style="width:${Math.min(100, d.extra.level * 3)}%"></i></span>` : ''}
              ${isCulprit ? '<span class="nd-flag">כאן</span>' : ''}
            </button>`;
        }).join('')}</div>
      </div>`;
    }).join('<div class="zone-gap"></div>');
    $$('#paChain [data-l]').forEach(b => b.addEventListener('click', () => {
      open = open === b.dataset.l ? null : b.dataset.l; chain(); detail();
    }));
  }
  /* הצינור בין שתי חוליות — צבעו לפי החלשה מביניהן */
  function pipe(links, a, b) {
    const s = [links[a] && links[a].state, links[b] && links[b].state];
    const cls = s.includes('bad') ? 'bad' : s.includes('warn') ? 'warn' : s.includes('idle') ? 'idle' : 'ok';
    return `<span class="pipe ${cls}"><i></i></span>`;
  }

  /* ---------------- פירוט חוליה ---------------- */
  function detail() {
    const h = $('#paDetail'); if (!h) return;
    if (!open) { h.innerHTML = ''; return; }
    const d = PATH.links()[open] || {};
    const meta = PATH.LINKS.find(l => l.k === open) || {};
    const s = PATH.snap() || {};
    h.innerHTML = `
      <div class="dt ${d.state}">
        <div class="dt-h"><b>${ic(meta.icon)} ${esc(meta.label)}</b>
          <span class="dt-s ${d.state}">${STATE_HE[d.state] || ''}</span>
          <button class="btn xs ghost" id="dtX">${ic('x')}</button></div>
        <div class="dt-v">${esc(d.value)}</div>
        ${d.why ? `<p class="dt-w">${esc(d.why)}</p>` : ''}
        ${d.fix ? `<div class="dt-f"><b>מה עושים</b> ${esc(d.fix)}</div>` : ''}
        ${raw(open, s)}
      </div>`;
    const x = $('#dtX'); if (x) x.addEventListener('click', () => { open = null; chain(); detail(); });
  }
  /* המספרים הגולמיים — למי שכן רוצה אותם, ורק כשפותחים */
  function raw(k, s) {
    const rows = {
      mic: () => [['התקני קלט', (window.PATH && PATH.snap() ? '' : '') + ((s.micTrack && s.micTrack.label) || '—')],
        ['מצב ה-track', s.micTrack ? s.micTrack.state : '—'],
        ['מושתק במכשיר', s.micTrack ? (s.micTrack.muted ? 'כן' : 'לא') : '—'],
        ['עוצמת קלט', Math.round((s.rtp && s.rtp.lvlOut || 0) * 100) + '%']],
      codec: () => [['קודק', (s.rtp && s.rtp.codec) || '—'],
        ['חבילות שנשלחו', (s.rtp && s.rtp.outPkts) || 0],
        ['בייטים שנשלחו', (s.rtp && s.rtp.outBytes) || 0]],
      fw: () => [['מועמדים מקומיים (host)', s.ice ? s.ice.host : 0],
        ['מועמדים חיצוניים (srflx)', s.ice ? s.ice.srflx : 0],
        ['מועמדי TURN (relay)', s.ice ? s.ice.relay : 0],
        ['פרוטוקול', (s.ice && s.ice.proto) || '—'],
        ['מצב ICE', (s.ice && s.ice.state) || '—']],
      rtp: () => [['חבילות יוצאות', (s.rtp && s.rtp.outPkts) || 0],
        ['חבילות נכנסות', (s.rtp && s.rtp.inPkts) || 0],
        ['אובדן', Math.round((s.rtp && s.rtp.loss || 0) * 10) / 10 + '%'],
        ['רעידה (jitter)', Math.round((s.rtp && s.rtp.jitter) || 0) + 'ms'],
        ['השהיה הלוך-חזור', Math.round((s.rtp && s.rtp.rtt) || 0) + 'ms']],
      sig: () => [['מצב', window.SIPCFG ? SIPCFG.status().state : '—'],
        ['שרת', window.SIPCFG ? (SIPCFG.get().wss || '—') : '—'],
        ['שלוחה', window.SIPCFG ? (SIPCFG.get().user || '—') : '—'],
        ['רישום אחרון', window.SIPCFG ? (SIPCFG.status().lastReg || '—') : '—']],
      lan: () => [['מקוון', s.online ? 'כן' : 'לא'],
        ['סוג רשת', (s.conn && s.conn.effectiveType) || '—'],
        ['השהיה משוערת', (s.conn && s.conn.rtt != null ? s.conn.rtt + 'ms' : '—')],
        ['רוחב פס', (s.conn && s.conn.downlink != null ? s.conn.downlink + 'Mb/s' : '—')]],
      far: () => [['אובדן שדווח מהם', s.rtp && s.rtp.remoteLoss != null ? Math.round(s.rtp.remoteLoss * 10) / 10 + '%' : '—']],
      queue: () => { const q = (window.CRM && CRM.session()) || {};
        return [['עובד', (q.employee || {}).name || '—'], ['פעיל', q.active ? 'כן' : 'לא'],
          ['פעילויות', (q.activities || []).join(', ') || '—']]; },
    }[k];
    if (!rows) return '';
    return `<table class="dt-r">${rows().map(r =>
      `<tr><th>${esc(r[0])}</th><td dir="ltr">${esc(r[1])}</td></tr>`).join('')}</table>`;
  }

  /* ---------------- ציר זמן ---------------- */
  function timeline() {
    const h = $('#paTl'); if (!h) return;
    const ev = PATH.events();
    if (!ev.length) { h.innerHTML = '<div class="empty2">עדיין לא נרשמו אירועים</div>'; return; }
    h.innerHTML = ev.slice(-40).reverse().map(e => `
      <div class="tl-r ${e.sev}">
        <span class="tl-t">${new Date(e.at).toLocaleTimeString('he-IL')}</span>
        <i class="tl-d"></i>
        <div class="tl-c"><b>${esc(e.t)}</b>${e.why ? `<small>${esc(e.why)}</small>` : ''}</div>
      </div>`).join('');
  }

  /* ---------------- דוח לתמיכה ---------------- */
  function report() {
    const r = PATH.report();
    const txt = [
      'CallBiz Desktop — דוח אבחון',
      'נוצר: ' + new Date(r.at).toLocaleString('he-IL'),
      'גרסה: ' + (r.app || '?'),
      '',
      'מסקנה: ' + (r.verdict ? r.verdict.t : '—'),
      r.verdict && r.verdict.why ? 'הסבר: ' + r.verdict.why : '',
      '',
      'חוליות:',
      ...r.links.map(l => '  ' + pad(l.k) + (STATE_HE[l.state] || l.state) + ' — ' + l.value),
      '',
      'מרכזייה: ' + JSON.stringify(r.sip),
      'מדיה: ' + JSON.stringify(r.rtp),
      'ICE: ' + JSON.stringify(r.ice),
      '',
      'אירועים:',
      ...r.events.map(e => '  ' + new Date(e.at).toLocaleTimeString('he-IL') + '  ' + e.t + (e.why ? ' — ' + e.why : '')),
    ].filter(x => x !== '').join('\n');
    const b = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'callbiz-אבחון.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (window.UIX) UIX.toast('הדוח נשמר — אפשר לשלוח לתמיכה');
  }
  const pad = s => (s + '            ').slice(0, 12);

  function draw() { verdict(); chain(); detail(); }

  /* עדכון חי — רק אם המסך פתוח */
  if (window.PATH) {
    PATH.on('update', () => { if ($('#paChain')) draw(); });
    PATH.on('event', () => { if ($('#paTl')) timeline(); });
  }

  window.PATHUI = { render, draw, timeline };
})();
