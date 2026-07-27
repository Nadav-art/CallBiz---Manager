/* ============================================================
   CallBiz Desktop · ממשק
   ------------------------------------------------------------
   מעטפת אחת עם רצועת ניווט, במה מתחלפת, והתראות בזמן אמת.
   המסכים החיצוניים (המנג׳ר, פורטל הנציגים) נטענים כלוחות בתוך
   המעטפת ולא נפתחים בדפדפן נפרד.
   ============================================================ */
(function () {

  const VIEWS = [
    { key: 'phone', label: 'טלפון',  icon: 'phone' },
    { key: 'diag',  label: 'אבחון',  icon: 'tools' },
    { key: 'stats', label: 'ביצועים', icon: 'chart' },
    { key: 'crm',   label: 'CRM',    icon: 'crm', web: true },
    { key: 'wa',    label: 'וואטסאפ', icon: 'wa', web: true },
    { key: 'mail',  label: 'מייל',   icon: 'mail', web: true },
    { key: 'cal',   label: 'יומן',   icon: 'cal', web: true },
    { key: 'set',   label: 'הגדרות', icon: 'gear' },
  ];
  const UI = { view: 'phone', dial: '', badges: { wa: 3, mail: 1, cal: 2 }, checks: [], checking: false };

  /* ============================================================
     רצועת הניווט
     ============================================================ */
  function rail() {
    const s = CRM.session() || {}, e = s.employee || {};
    const dot = CRM.isActive() ? 'ok' : 'off';
    $('#rail').innerHTML = `
      <div class="me">
        <span class="ava">${esc((e.name || '?')[0])}<i class="dot ${dot}"></i></span>
        <div class="me-t"><b>${esc(e.name || 'לא מזוהה')}</b>
          <small>${CRM.isActive() ? 'זמין' : 'לא פעיל'}${e.ext ? ' · שלוחה ' + esc(e.ext) : ''}</small></div>
      </div>
      <nav class="nav">${VIEWS.map(v => `<button class="nv ${UI.view === v.key ? 'on' : ''}" data-v="${v.key}">
        ${ic(v.icon)}<span>${esc(v.label)}</span>
        ${UI.badges[v.key] ? `<i class="bdg">${UI.badges[v.key]}</i>` : ''}</button>`).join('')}</nav>
      <div class="rail-foot">
        <div class="src ${CRM.mode()}">${ic(CRM.mode() === 'demo' ? 'alert' : 'check')}
          <span>${CRM.mode() === 'embedded' ? 'מחובר ל-CRM' : CRM.mode() === 'server' ? 'מחובר לשרת' : 'מצב הדגמה · ללא CRM'}</span></div>
      </div>`;
    $$('#rail [data-v]').forEach(b => b.addEventListener('click', () => go(b.dataset.v)));
  }
  function go(v) { UI.view = v; rail(); stage(); }

  /* ============================================================
     הבמה
     ============================================================ */
  function stage() {
    const host = $('#stage');
    const v = VIEWS.find(x => x.key === UI.view) || VIEWS[0];
    if (v.web) return webPane(v);
    if (v.key === 'phone') return phone();
    if (v.key === 'diag') return diag();
    if (v.key === 'stats') return stats();
    if (v.key === 'set') return settings();
    host.innerHTML = '';
  }

  /* ---------------- טלפון ---------------- */
  function phone() {
    const c = TEL.call(), st = TEL.stats(), t = TEL.transportOf(TEL.transport());
    const contact = c && c.contact;
    $('#stage').innerHTML = `
      <div class="ph">
        <section class="ph-main">
          ${c ? `
            <div class="live">
              <div class="live-h"><i class="rec-dot ${c.state === 'active' ? 'on' : ''}"></i>
                ${c.state === 'ringing' ? 'שיחה נכנסת' : c.state === 'dialing' ? 'מחייג…' : 'שיחה פעילה'}
                ${c.recorded ? `<span class="rec">${ic('rec')} מוקלט</span>` : ''}</div>
              <div class="live-who">
                <span class="live-ava">${esc(((contact && contact.name) || c.phone || '?')[0])}</span>
                <div><b>${esc((contact && contact.name) || 'מספר לא מזוהה')}</b>
                  <span class="num">${esc(c.phone)}</span>
                  ${contact ? `<span class="tags">${(contact.tags || []).map(x => `<i>${esc(x)}</i>`).join('')}</span>` : ''}
                </div>
                <div class="live-time">${STATS.fmtSec(c.seconds)}</div>
              </div>
              <div class="live-acts">
                ${c.state === 'ringing' ? `<button class="act big ok" data-a="answer">${ic('phoneIn')}<span>ענה</span></button>` : ''}
                <button class="act ${c.muted ? 'on' : ''}" data-a="mute">${ic(c.muted ? 'micOff' : 'mic')}<span>${c.muted ? 'בטל השתקה' : 'השתק'}</span></button>
                <button class="act ${c.held ? 'on' : ''}" data-a="hold">${ic('pause')}<span>${c.held ? 'חזרה' : 'המתנה'}</span></button>
                <button class="act" data-a="transfer">${ic('transfer')}<span>העבר</span></button>
                <button class="act" data-a="conf">${ic('users')}<span>ועידה</span></button>
                <button class="act ${c.recorded ? 'on' : ''}" data-a="rec">${ic('rec')}<span>הקלטה</span></button>
                <button class="act big bad" data-a="hangup">${ic('hangup')}<span>נתק</span></button>
              </div>
              ${contact ? `<button class="pop" data-a="pop">${ic('crm')} פתח את הכרטיס ב-CRM</button>` : ''}
            </div>`
          : `<div class="idle">
              <div class="idle-ic">${ic('phone')}</div>
              <b>אין שיחה פעילה</b>
              <small>חייגו מספר, או המתינו לשיחה נכנסת</small>
              <button class="btn ghost" data-a="sim">${ic('phoneIn')} הדמיית שיחה נכנסת</button>
            </div>`}

          <div class="qual">
            <div class="q-h">${ic('pulse')} <b>איכות החיבור</b>
              <span class="q-t ${t.tier === 1 ? 'ok' : t.tier === 2 ? 'warn' : 'bad'}">${esc(t.label)}</span></div>
            <div class="q-grid">
              ${qBox('MOS', st.mos || '—', st.mos >= 4 ? 'ok' : st.mos >= 3.4 ? 'warn' : st.mos ? 'bad' : '')}
              ${qBox('איבוד', (st.loss || 0) + '%', st.loss <= 1.5 ? 'ok' : st.loss <= 3 ? 'warn' : 'bad')}
              ${qBox('ריצוד', (st.jitter || 0) + 'ms', st.jitter <= 15 ? 'ok' : st.jitter <= 30 ? 'warn' : 'bad')}
              ${qBox('השהיה', (st.rtt || 0) + 'ms', st.rtt <= 120 ? 'ok' : st.rtt <= 250 ? 'warn' : 'bad')}
            </div>
            <div class="q-foot">
              <label class="sw"><input type="checkbox" id="autoT" ${TEL.auto() ? 'checked' : ''}>
                <span>בחירת מסלול אוטומטית לפי איכות</span></label>
              <div class="q-tr">${TEL.transports().map(x => `<button class="trb ${TEL.transport() === x.key ? 'on' : ''}"
                data-t="${x.key}" title="${esc(x.why)}">${esc(x.label)}</button>`).join('')}</div>
            </div>
          </div>
        </section>

        <aside class="ph-side">
          <div class="pad">
            <div class="pad-h">${ic('grid')} חייג מספר</div>
            <input class="pad-in" id="padIn" value="${esc(UI.dial)}" placeholder="הקלידו מספר" inputmode="tel">
            <div class="pad-k">${['1','2','3','4','5','6','7','8','9','*','0','#'].map(k =>
              `<button class="k" data-k="${k}">${k}</button>`).join('')}</div>
            <button class="pad-call" data-a="call">${ic('phone')} חייג</button>
          </div>
          <div class="info">
            <div class="info-h">${ic('clock')} שיחות אחרונות</div>
            ${(CRM.calls() || []).slice(0, 6).map(x => `<button class="rec-row" data-redial="${esc(x.phone)}">
              <span class="rr-d ${x.dir === 'in' ? 'in' : 'out'}">${ic(x.dir === 'in' ? 'phoneIn' : 'phone')}</span>
              <span class="rr-t"><b>${esc(x.phone)}</b><small>${esc(x.outcome || '')} · ${STATS.fmtSec(x.seconds)}</small></span>
              ${x.quality ? `<span class="rr-q ${x.quality >= 4 ? 'ok' : x.quality >= 3.4 ? 'warn' : 'bad'}">${x.quality}</span>` : ''}
            </button>`).join('') || '<p class="empty">אין עדיין שיחות</p>'}
          </div>
        </aside>
      </div>`;
    bindPhone();
  }
  const qBox = (l, v, s) => `<div class="q-b ${s || ''}"><span>${l}</span><b>${v}</b></div>`;

  function bindPhone() {
    const act = a => ({
      answer: () => TEL.answer(),
      mute: () => TEL.mute(), hold: () => TEL.hold(), rec: () => TEL.record(),
      hangup: () => TEL.hangup(),
      transfer: () => askTransfer(),
      conf: () => toast('ועידה — מחייב שרת שיחות. המתאם מוכן.'),
      pop: () => { const c = TEL.call(); if (c && c.contact) { CRM.screenPop(c.contact); go('crm'); } },
      sim: () => TEL.incoming(['052-1234567', '053-7654321', '054-1112222'][Math.floor(Math.random() * 3)]),
      call: () => { const v = ($('#padIn') || {}).value; if (v) TEL.dial(v); },
    }[a]);
    $$('#stage [data-a]').forEach(b => b.addEventListener('click', () => { const f = act(b.dataset.a); if (f) f(); }));
    $$('#stage [data-k]').forEach(b => b.addEventListener('click', () => {
      const inp = $('#padIn'); inp.value += b.dataset.k; UI.dial = inp.value;
      if (TEL.call()) return; }));
    const inp = $('#padIn');
    if (inp) { inp.addEventListener('input', () => { UI.dial = inp.value; });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value) TEL.dial(inp.value); }); }
    $$('#stage [data-t]').forEach(b => b.addEventListener('click', () => { TEL.setTransport(b.dataset.t, true); phone(); }));
    const au = $('#autoT'); if (au) au.addEventListener('change', () => { TEL.auto(au.checked); phone(); });
    $$('#stage [data-redial]').forEach(b => b.addEventListener('click', () => TEL.dial(b.dataset.redial)));
  }
  function askTransfer() {
    modal('העברת שיחה', `<p class="m-l">למי להעביר?</p>
      <div class="m-list">${['מיכל רוזן · 202', 'אבי זוהר · 203', 'תור המכירות'].map(x =>
        `<button class="m-i" data-tr="${esc(x)}">${esc(x)}</button>`).join('')}</div>`,
      w => $$('[data-tr]', w).forEach(b => b.addEventListener('click', () => { TEL.transfer(b.dataset.tr); close(); })));
  }

  /* ---------------- אבחון ---------------- */
  function diag() {
    $('#stage').innerHTML = `
      <div class="pane">
        <div class="pane-h"><b>${ic('tools')} אבחון ופתרון תקלות</b>
          <button class="btn" id="runD">${ic('refresh')} הרץ בדיקה</button></div>
        <p class="pane-l">הבדיקה בודקת את מה שבאמת משפיע על שיחה: מיקרופון, התקנים, רשת, מעבר חומת אש ואיכות משוערת.</p>
        <div class="dl" id="dl">${UI.checks.length ? UI.checks.map(row).join('')
          : '<p class="empty">טרם הורצה בדיקה</p>'}</div>
      </div>`;
    $('#runD').addEventListener('click', run);
    if (!UI.checks.length && !UI.checking) run();
    async function run() {
      UI.checking = true; UI.checks = [];
      $('#dl').innerHTML = DIAG.CHECKS.map(c => row({ key: c.key, label: c.label, state: 'run' })).join('');
      await DIAG.runAll(r => {
        const i = UI.checks.findIndex(x => x.key === r.key);
        i >= 0 ? UI.checks[i] = r : UI.checks.push(r);
        const el = $('#dl [data-c="' + r.key + '"]');
        if (el) el.outerHTML = row(r);
      });
      UI.checking = false;
    }
    function row(r) {
      const s = r.state;
      return `<div class="d-row ${s}" data-c="${r.key}">
        <span class="d-ic">${s === 'run' ? '<i class="spin"></i>' : ic(s === 'ok' ? 'check' : s === 'warn' ? 'alert' : 'x')}</span>
        <div class="d-t"><b>${esc(r.label)}</b><small>${esc(r.detail || 'בודק…')}</small></div>
        ${r.fix ? `<div class="d-fix">${ic('alert')} ${esc(r.fix)}</div>` : ''}
      </div>`;
    }
  }

  /* ---------------- ביצועים ---------------- */
  function stats() {
    const s = STATS.summary(), q = STATS.quality(), iss = STATS.issues();
    const tot = q.reduce((a, b) => a + b.n, 0);
    $('#stage').innerHTML = `
      <div class="pane">
        <div class="pane-h"><b>${ic('chart')} ניתוח ביצועים</b></div>
        ${!s.total ? '<p class="empty">אין עדיין שיחות שנרשמו — הנתונים ייבנו מהשיחות בפועל</p>' : `
        <div class="kpis">
          ${kpi('שיחות', s.total)} ${kpi('נענו', s.answerRate + '%')}
          ${kpi('זמן דיבור', STATS.fmtSec(s.talkSec))} ${kpi('ממוצע לשיחה', STATS.fmtSec(s.avgSec))}
          ${kpi('MOS ממוצע', s.avgMos || '—', s.avgMos >= 4 ? 'ok' : s.avgMos >= 3.4 ? 'warn' : 'bad')}
          ${kpi('הוקלטו', s.recorded)}
        </div>
        <div class="two">
          <div class="card"><b>${ic('pulse')} התפלגות איכות</b>
            ${q.map(x => `<div class="bar"><span>${x.k}</span>
              <i style="width:${tot ? Math.round(x.n / tot * 100) : 0}%"></i><em>${x.n}</em></div>`).join('')}</div>
          <div class="card"><b>${ic('alert')} סיבות מובילות</b>
            ${iss.length ? iss.map(x => `<div class="li"><span>${esc(x.k)}</span><b>${x.n}</b></div>`).join('')
              : '<p class="empty sm">אין תקלות שנרשמו</p>'}</div>
        </div>
        <div class="card"><b>${ic('wifi')} פילוח לפי מסלול חיבור</b>
          ${Object.keys(s.byTransport).map(k => `<div class="li">
            <span>${esc(TEL.transportOf(k).label)}</span><b>${s.byTransport[k]}</b></div>`).join('') || '<p class="empty sm">—</p>'}</div>`}
      </div>`;
  }
  const kpi = (l, v, s) => `<div class="kpi ${s || ''}"><span>${l}</span><b>${v}</b></div>`;

  /* ---------------- לוחות ווב ---------------- */
  const WEB = {
    crm:  { url: '../index.html', label: 'CallBiz Manager' },
    wa:   { url: '../index.html#whatsapp', label: 'וואטסאפ' },
    mail: { url: '../index.html#mail', label: 'דוא״ל' },
    cal:  { url: '../index.html#meetings', label: 'יומן' },
  };
  function webPane(v) {
    const w = WEB[v.key] || { url: '', label: v.label };
    $('#stage').innerHTML = `<div class="web">
      <div class="web-h">${ic(v.icon)} <b>${esc(w.label)}</b>
        <span class="web-u">${esc(w.url)}</span>
        <button class="btn xs" id="webR">${ic('refresh')} רענן</button></div>
      <iframe class="web-f" id="webF" src="${esc(w.url)}" title="${esc(w.label)}"></iframe>
    </div>`;
    const f = $('#webF');
    $('#webR').addEventListener('click', () => { f.src = f.src; });
  }

  /* ---------------- הגדרות ---------------- */
  function settings() {
    const s = CRM.session() || {}, p = s.perms || {};
    $('#stage').innerHTML = `
      <div class="pane">
        <div class="pane-h"><b>${ic('gear')} הגדרות</b></div>
        <div class="card"><b>${ic('user')} זהות והרשאות</b>
          <p class="pane-l sm">הזהות וההרשאות מגיעות מה-CRM ואינן ניתנות לעריכה כאן — כך אין שתי מערכות הרשאות.</p>
          <div class="li"><span>עובד</span><b>${esc((s.employee || {}).name || '—')}</b></div>
          <div class="li"><span>תפקיד</span><b>${esc((s.employee || {}).role || '—')}</b></div>
          <div class="li"><span>סטטוס</span><b class="${s.active ? 'ok' : 'bad'}">${s.active ? 'פעיל' : 'לא פעיל'}</b></div>
          <div class="li"><span>שיוך לפעילות</span><b>${esc((s.activities || []).join(' · ') || '—')}</b></div>
          <div class="li"><span>מקור</span><b>${CRM.mode() === 'demo' ? 'הדגמה מקומית' : 'CRM'}</b></div>
          <div class="perms">${Object.keys(p).map(k => `<span class="pm ${p[k] ? 'on' : ''}">
            ${ic(p[k] ? 'check' : 'x')} ${esc(PERM_LBL[k] || k)}</span>`).join('')}</div>
        </div>
        <div class="card"><b>${ic('wifi')} טלפוניה</b>
          <label class="sw"><input type="checkbox" id="sAuto" ${TEL.auto() ? 'checked' : ''}>
            <span>בחירת מסלול אוטומטית לפי איכות</span></label>
          <p class="pane-l sm">כשהאיכות יורדת מתחת לסף, המערכת עוברת למסלול יציב יותר בלי לנתק את השיחה.</p>
        </div>
        <div class="card"><b>${ic('alert')} מה עדיין מחייב שרת</b>
          <ul class="todo">
            <li>איתות SIP וגשר PSTN — חיוג אמיתי החוצה</li>
            <li>תורים, זמינות נציגים והפצת שיחות</li>
            <li>הקלטות — אחסון והרשאות גישה</li>
            <li>דחיפת שיחות נכנסות (WebSocket)</li>
          </ul>
          <p class="pane-l sm">כל אלה מאחורי מתאם אחד — המעבר לשרת אמיתי לא ידרוש שינוי בממשק.</p>
        </div>
      </div>`;
    const a = $('#sAuto'); if (a) a.addEventListener('change', () => TEL.auto(a.checked));
  }
  const PERM_LBL = { call: 'חיוג', transfer: 'העברה', conference: 'ועידה', record: 'הקלטה',
    viewCrm: 'צפייה ב-CRM', editCrm: 'עריכה ב-CRM', diagnostics: 'אבחון', analytics: 'ביצועים', admin: 'ניהול' };

  /* ============================================================
     התראות וחלונות
     ============================================================ */
  function alert2(a) {
    const host = $('#alerts');
    const el = document.createElement('div');
    el.className = 'al ' + (a.kind || 'warn');
    el.innerHTML = `<span class="al-i">${ic(a.icon || 'alert')}</span>
      <div><b>${esc(a.t)}</b>${a.why ? `<small>${esc(a.why)}</small>` : ''}
      ${a.fix ? `<small class="fix">${esc(a.fix)}</small>` : ''}</div>
      ${a.action ? `<button class="al-b">${esc(a.action)}</button>` : ''}
      <button class="al-x">${ic('x')}</button>`;
    host.appendChild(el);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    el.querySelector('.al-x').addEventListener('click', kill);
    const b = el.querySelector('.al-b');
    if (b) b.addEventListener('click', () => { if (a.onAction) a.onAction(); kill(); });
    setTimeout(kill, a.sticky ? 30000 : 9000);
  }
  function toast(t) { alert2({ t, kind: 'info', icon: 'check' }); }
  function modal(title, body, bind) {
    const host = $('#modalHost');
    host.innerHTML = `<div class="mw"><div class="mb">
      <div class="mh"><b>${esc(title)}</b><button class="mx">${ic('x')}</button></div>
      <div class="mc">${body}</div></div></div>`;
    host.classList.add('on');
    host.querySelector('.mx').addEventListener('click', close);
    host.querySelector('.mw').addEventListener('mousedown', e => { if (e.target.classList.contains('mw')) close(); });
    if (bind) bind(host);
  }
  function close() { const h = $('#modalHost'); h.classList.remove('on'); h.innerHTML = ''; }

  window.UIX = { rail, stage, go, phone, alert2, toast, modal, close, state: UI };
})();
