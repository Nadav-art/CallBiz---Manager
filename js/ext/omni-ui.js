/* ============================================================
   הרחבה: מסך הערוצים — חוויית מוצר  ·  key = 'omniui'
   ------------------------------------------------------------
   מנהל עסק שלא מכיר OAuth צריך לחבר ערוץ בפחות מדקה. לכן:

     · "ערוצים" הוא פריט בתפריט הראשי, לא מסך בעומק ההגדרות
     · כל ערוץ הוא כרטיס עם סטטוס בצבע *ובטקסט* ופעולות מהירות
     · החיבור מתבצע בחלון אחד: הסבר → אישור → בחירת נכס →
       הצלחה → המשך להגדרות. בלי לצאת מהחלון ובלי מסך חדש
     · פרטים טכניים (Token, Webhook, App ID) אינם מוצגים ללקוח —
       הם שמורים למסך של מנהל CallBiz בלבד
     · בפעם הראשונה נפתח אשף בן חמישה שלבים; מרגע שחובר ערוץ
       אחד — נכנסים תמיד למסך הכרטיסים

   שכבת הנתונים והמחברים היא OMNI (js/ext/omni.js). כאן רק חוויה.
   ============================================================ */
(function () {

  const O = () => window.OMNI;
  const conns = () => O() ? O().connectors() : [];
  const st = () => O() ? O().state() : { conns: {}, log: [] };
  const connOf = k => st().conns[k] || null;
  const isOn = k => (connOf(k) || {}).status === 'connected';

  /* סטטוס — צבע *וגם* טקסט */
  const STATUS = {
    connected:    { dot: 'ok',   label: 'מחובר' },
    expiring:     { dot: 'warn', label: 'דורש חידוש הרשאה' },
    disconnected: { dot: 'off',  label: 'לא מחובר' },
    error:        { dot: 'bad',  label: 'מנותק — נדרשת התחברות מחדש' },
  };
  function statusOf(k) {
    const n = connOf(k);
    if (!n || n.status === 'disconnected') return 'disconnected';
    if (n.status === 'error') return 'error';
    if (n.token && n.token.expiresIn != null && n.token.expiresIn <= 7) return 'expiring';
    return 'connected';
  }
  /* חיבור שהוגדר לו ניתוב? אחרת מוצג "נותר שלב אחד" */
  const routed = k => { const c = (connOf(k) || {}).cfg; return !!(c && (c.team || (c.agents || []).length)); };

  const WKEY = 'cb_omniWiz';
  const wizDone = () => { try { return localStorage.getItem(WKEY) === '1'; } catch (e) { return false; } };
  const setWizDone = () => { try { localStorage.setItem(WKEY, '1'); } catch (e) {} };

  /* ============================================================
     נכסים לבחירה — עמודים / חשבונות / תיבות דואר
     ============================================================ */
  const ASSETS = {
    messenger: ['מרפאת כהן', 'מרפאת לוי', 'קליניקת ABC'],
    instagram: ['@callbiz', '@callbiz.clinic'],
    gmail: ['service@callbiz.co.il', 'info@callbiz.co.il'],
    outlook: ['service@callbiz.co.il'],
    whatsapp: ['052-1234567', '053-7654321'],
    webchat: ['callbiz.co.il'],
  };
  const assetLabel = k => ({ messenger: 'עמוד', instagram: 'חשבון', gmail: 'תיבת דואר',
    outlook: 'תיבת דואר', whatsapp: 'מספר', webchat: 'אתר' })[k] || 'נכס';

  /* ============================================================
     מסך הכרטיסים
     ============================================================ */
  function screenHTML() {
    const list = conns();
    const done = list.filter(c => isOn(c.key));
    const needRoute = done.filter(c => !routed(c.key));
    return `<div class="ou">
      <div class="view-head">
        <div class="vh-title"><span class="num">${ic('chat')}</span> ערוצים
          <span class="muted">· כל דרכי התקשורת עם הלקוחות במקום אחד</span></div>
        <div class="vh-actions">
          ${done.length ? `<button class="btn sm" data-ouwiz>${ic('bolt')} אשף חיבור</button>` : ''}
          ${O() && O().can('logs') ? `<button class="btn sm ghost" data-ouadmin>${ic('lock')} תצוגת מנהל CallBiz</button>` : ''}
        </div>
      </div>

      ${done.length ? `<div class="ou-prog">
        <div class="ou-prog-h"><b>${done.length} מתוך ${list.length} ערוצים מחוברים</b>
          <span>${Math.round(done.length / list.length * 100)}%</span></div>
        <div class="ou-bar"><i style="width:${Math.round(done.length / list.length * 100)}%"></i></div>
        <div class="ou-prog-l">${list.map(c => `<span class="${isOn(c.key) ? 'on' : ''}">
          ${isOn(c.key) ? ic('check') : '○'} ${esc(c.label)}</span>`).join('')}</div>
      </div>` : ''}

      ${needRoute.length ? needRoute.map(c => `<div class="ou-todo">
        ${ic('alert')}<div><b>נותר שלב אחד ב${esc(c.label)}</b><small>בחרו מי יקבל את ההודעות מהערוץ הזה.</small></div>
        <button class="btn sm primary" data-oucfg="${c.key}">הגדר עכשיו</button></div>`).join('') : ''}

      <div class="ou-grid">${list.map(c => cardHTML(c)).join('')}</div>

      ${!done.length ? `<div class="ou-first">${ic('bolt')}
        <div><b>עוד לא חיברתם ערוץ</b><small>האשף מחבר את הערוץ הראשון בכמה קליקים — בלי הגדרות טכניות.</small></div>
        <button class="btn primary" data-ouwiz>${ic('check')} התחילו כאן</button></div>` : ''}
    </div>`;
  }

  function cardHTML(c) {
    const s = statusOf(c.key), S = STATUS[s], n = connOf(c.key);
    return `<section class="ou-card ${S.dot}">
      <div class="ou-c-top">
        <span class="ou-ic" style="--ch:${c.color}">${ic(c.icon)}</span>
        <div class="ou-c-t"><b>${esc(c.label)}</b>
          <span class="ou-status"><i class="ou-dot ${S.dot}"></i>${S.label}</span></div>
      </div>
      ${s === 'disconnected' ? `<p class="ou-c-sub">חיבור בלחיצה אחת — נפתח חלון ההתחברות הרשמי של הספק.</p>`
        : `<div class="ou-c-acc">${ic('user')} <b>${esc((n && n.account) || '')}</b>
            <small>${esc(assetLabel(c.key))} מחובר${n && n.at ? ' · מ-' + esc(String(n.at).split(' ')[0]) : ''}</small></div>`}
      <div class="ou-c-acts">
        ${s === 'disconnected'
          ? `<button class="btn sm primary block" data-oucon="${c.key}">${ic('check')} חבר חשבון</button>`
          : `<button class="btn sm" data-oucfg="${c.key}">${ic('settings')} הגדרות</button>
             <button class="btn sm" data-outest="${c.key}">${ic('sync')} בדוק חיבור</button>
             ${s === 'expiring' ? `<button class="btn sm primary" data-ouref="${c.key}">${ic('lock')} חדש הרשאה</button>` : ''}
             <button class="btn sm ghost" data-oudis="${c.key}">נתק</button>`}
      </div>
    </section>`;
  }

  /* ============================================================
     חלון החיבור — הכל בחלון אחד
     ============================================================ */
  let flow = null;   // { key, step: 'ask'|'assets'|'done', asset }
  function openConnect(key, fromWiz) {
    flow = { key, step: 'ask', asset: null, wiz: !!fromWiz };
    drawFlow();
  }
  function drawFlow() {
    const c = conns().find(x => x.key === flow.key); if (!c) return;
    const old = document.getElementById('ouFlow'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'ouFlow';
    let body = '', foot = '';
    if (flow.step === 'ask') {
      body = `<p class="ou-f-l">בלחיצה על "המשך" ייפתח חלון ההתחברות הרשמי של ${esc(providerOf(c))}.
        מתחברים לחשבון, מאשרים — וחוזרים לכאן.</p>
        <div class="ou-f-safe">${ic('lock')} החיבור מאובטח. אנחנו לא רואים את הסיסמה שלכם ולא שומרים אותה.</div>`;
      foot = `<button class="btn ghost" data-oux>ביטול</button>
        <button class="btn primary" data-ougo>${ic('check')} המשך</button>`;
    } else if (flow.step === 'assets') {
      const list = ASSETS[c.key] || [c.label];
      body = `<p class="ou-f-l">איזה ${esc(assetLabel(c.key))} לחבר?</p>
        <div class="ou-assets">${list.map((a, i) => `<button class="ou-asset ${flow.asset === a || (!flow.asset && i === 0) ? 'on' : ''}" data-ouasset="${esc(a)}">
          <span class="ou-a-r"></span><b>${esc(a)}</b></button>`).join('')}</div>`;
      foot = `<button class="btn ghost" data-oux>ביטול</button>
        <button class="btn primary" data-ouasave>${ic('check')} חבר</button>`;
    } else {
      const n = connOf(c.key) || {};
      body = `<div class="ou-ok">${ic('check')}
          <div><b>${esc(c.label)} חובר בהצלחה</b>
            <small>${esc(assetLabel(c.key))}: ${esc(n.account || '')}</small></div></div>
        <div class="ou-next-h">מה תרצו להגדיר עכשיו?</div>
        <ul class="ou-next">
          <li>${ic('clients')} מי יקבל את ההודעות</li>
          <li>${ic('clock')} שעות פעילות</li>
          <li>${ic('chat')} הודעת פתיחה אוטומטית</li>
          <li>${ic('flag')} תגיות ו-SLA</li>
        </ul>`;
      foot = `<button class="btn ghost" data-oulater>אחר כך</button>
        <button class="btn primary" data-oucfgnow>${ic('settings')} המשך להגדרות</button>`;
    }
    w.innerHTML = `<div class="cbc-box ou-flow" style="max-width:440px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic" style="background:${c.color}1f;color:${c.color}">${ic(c.icon)}</span>
        <b>${flow.step === 'done' ? 'החיבור הושלם' : 'חיבור ' + esc(c.label)}</b></div>
      ${body}
      <div class="cbc-actions">${foot}</div></div>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s);
    if (q('[data-oux]')) q('[data-oux]').addEventListener('click', () => { w.remove(); flow = null; });
    if (q('[data-ougo]')) q('[data-ougo]').addEventListener('click', () => {
      /* TODO(server): כאן נפתח חלון ה-OAuth האמיתי של הספק */
      flow.step = 'assets'; drawFlow();
    });
    w.querySelectorAll('[data-ouasset]').forEach(b => b.addEventListener('click', () => {
      flow.asset = b.dataset.ouasset; drawFlow(); }));
    if (q('[data-ouasave]')) q('[data-ouasave]').addEventListener('click', () => {
      const list = ASSETS[c.key] || [c.label];
      O().connect(c.key, flow.asset || list[0]);
      flow.step = 'done'; drawFlow(); render();
    });
    if (q('[data-oulater]')) q('[data-oulater]').addEventListener('click', () => {
      const wiz = flow.wiz; w.remove(); flow = null; setWizDone(); render();
      if (wiz) toast('אפשר להגדיר ניתוב בכל רגע מכרטיס הערוץ');
    });
    if (q('[data-oucfgnow]')) q('[data-oucfgnow]').addEventListener('click', () => {
      const k = flow.key; w.remove(); flow = null; setWizDone(); render(); openCfg(k);
    });
  }
  const providerOf = c => ({ whatsapp: 'Meta', messenger: 'Meta', instagram: 'Meta',
    gmail: 'Google', outlook: 'Microsoft', webchat: 'CallBiz' })[c.key] || c.label;

  /* ============================================================
     אשף ראשון — בחירת ערוץ ואז זרימת החיבור
     ============================================================ */
  function openWizard() {
    const old = document.getElementById('ouWiz'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'ouWiz';
    const list = conns();
    w.innerHTML = `<div class="cbc-box ou-wiz" style="max-width:520px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic">${ic('bolt')}</span><b>חיבור ערוץ ראשון</b></div>
      <div class="ou-steps">${['בחירת ערוץ', 'התחברות', 'בחירת נכס', 'מי מקבל', 'סיום']
        .map((s, i) => `<span class="${i === 0 ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
      <p class="ou-f-l">באיזה ערוץ מגיעות אליכם הכי הרבה פניות? מתחילים ממנו.</p>
      <div class="ou-wiz-grid">${list.map(c => `<button class="ou-wiz-c ${isOn(c.key) ? 'done' : ''}" data-ouwch="${c.key}" ${isOn(c.key) ? 'disabled' : ''}>
        <span class="ou-ic" style="--ch:${c.color}">${ic(c.icon)}</span>
        <b>${esc(c.label)}</b>${isOn(c.key) ? `<small>${ic('check')} כבר מחובר</small>` : ''}</button>`).join('')}</div>
      <div class="cbc-actions"><button class="btn ghost" data-ouwx>סגור</button></div></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-ouwx]').addEventListener('click', () => { w.remove(); setWizDone(); render(); });
    w.querySelectorAll('[data-ouwch]').forEach(b => b.addEventListener('click', () => {
      w.remove(); openConnect(b.dataset.ouwch, true);
    }));
  }

  /* ============================================================
     הגדרות הערוץ — שכבה נקייה, בלי טכני
     ============================================================ */
  function openCfg(key) {
    if (window.OMNI && OMNI.can && !OMNI.can('settings')) { toast('אין לך הרשאה לשנות הגדרות ערוץ'); return; }
    const c = conns().find(x => x.key === key), n = connOf(key); if (!c || !n) return;
    const cfg = n.cfg = n.cfg || {};
    cfg.agents = cfg.agents || []; cfg.hours = cfg.hours || { from: '08:00', to: '18:00', days: [0, 1, 2, 3, 4] };
    const staff = (typeof STAFF !== 'undefined') ? STAFF.filter(s => s.on !== false) : [];
    const teams = (typeof DEPARTMENTS !== 'undefined') ? DEPARTMENTS : [];
    const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    const old = document.getElementById('ouCfg'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'ouCfg';
    w.innerHTML = `<div class="cbc-box ou-cfg" style="max-width:540px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic" style="background:${c.color}1f;color:${c.color}">${ic(c.icon)}</span>
        <div><b>${esc(c.label)}</b><small class="ou-cfg-sub">${esc(n.account || '')}</small></div></div>
      <div class="ou-cfg-b">
        <div class="ou-f"><span>${ic('clients')} מי יקבל את ההודעות</span>
          <div class="ou-chips">${staff.map(s => `<button class="ou-chip ${cfg.agents.indexOf(s.id) >= 0 ? 'on' : ''}" data-ouag="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div></div>
        <label class="ou-f"><span>${ic('layers')} או ניתוב לצוות שלם</span>
          <select class="cc-inp" id="ouTeam"><option value="">ללא</option>
            ${teams.map(t => `<option ${cfg.team === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <div class="ou-f"><span>${ic('clock')} שעות מענה</span>
          <div class="ou-hours"><input type="time" class="cc-inp" id="ouFrom" value="${esc(cfg.hours.from)}">
            <span>עד</span><input type="time" class="cc-inp" id="ouTo" value="${esc(cfg.hours.to)}"></div>
          <div class="ou-chips days">${DAYS.map((d, i) => `<button class="ou-chip ${cfg.hours.days.indexOf(i) >= 0 ? 'on' : ''}" data-ouday="${i}">${d}</button>`).join('')}</div></div>
        <label class="ou-f"><span>${ic('chat')} הודעת פתיחה אוטומטית</span>
          <textarea class="cc-inp" id="ouGreet" rows="2">${esc(cfg.greeting || '')}</textarea></label>
        <label class="ou-f"><span>${ic('clock')} מחוץ לשעות המענה</span>
          <textarea class="cc-inp" id="ouOff" rows="2">${esc(cfg.offHours || '')}</textarea></label>
        <div class="ou-f2">
          <label class="ou-f"><span>${ic('alert')} זמן מענה יעד (דק׳)</span>
            <input type="number" class="cc-inp" id="ouSla" min="1" max="1440" value="${+cfg.sla || 30}"></label>
          <label class="ou-sw"><input type="checkbox" id="ouNotify" ${cfg.notify !== false ? 'checked' : ''}>
            <span>התראה לנציג בהודעה חדשה</span></label>
        </div>
      </div>
      <div class="cbc-actions">
        <button class="btn ghost" data-oucx>ביטול</button>
        <button class="btn primary" data-oucs>${ic('check')} שמור</button></div></div>`;
    document.body.appendChild(w);
    w.querySelectorAll('[data-ouag]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.ouag, i = cfg.agents.indexOf(id);
      i >= 0 ? cfg.agents.splice(i, 1) : cfg.agents.push(id); b.classList.toggle('on'); }));
    w.querySelectorAll('[data-ouday]').forEach(b => b.addEventListener('click', () => {
      const d = +b.dataset.ouday, i = cfg.hours.days.indexOf(d);
      i >= 0 ? cfg.hours.days.splice(i, 1) : cfg.hours.days.push(d); b.classList.toggle('on'); }));
    w.querySelector('[data-oucx]').addEventListener('click', () => w.remove());
    w.querySelector('[data-oucs]').addEventListener('click', () => {
      const g = id => (w.querySelector('#' + id) || {}).value;
      cfg.team = g('ouTeam'); cfg.hours.from = g('ouFrom'); cfg.hours.to = g('ouTo');
      cfg.greeting = g('ouGreet'); cfg.offHours = g('ouOff'); cfg.sla = +g('ouSla') || 30;
      cfg.notify = !!(w.querySelector('#ouNotify') || {}).checked;
      const s = st(); s.conns[key].cfg = cfg;
      try { const all = JSON.parse(localStorage.getItem('cb_omni')) || {}; all[OMNI.tenant()] = s; localStorage.setItem('cb_omni', JSON.stringify(all)); } catch (e) {}
      w.remove(); toast('ההגדרות נשמרו'); render();
    });
  }

  /* ============================================================
     רינדור
     ============================================================ */
  let inView = false;
  function render() {
    if (!inView) return;
    const host = document.getElementById('viewHost'); if (!host) return;
    host.innerHTML = screenHTML();
    bind();
  }
  function bind() {
    const q = s => Array.prototype.slice.call(document.querySelectorAll(s));
    q('[data-oucon]').forEach(b => b.addEventListener('click', () => openConnect(b.dataset.oucon)));
    q('[data-oucfg]').forEach(b => b.addEventListener('click', () => openCfg(b.dataset.oucfg)));
    q('[data-oudis]').forEach(b => b.addEventListener('click', () => {
      const c = conns().find(x => x.key === b.dataset.oudis);
      const go = () => { O().disconnect(b.dataset.oudis); toast(c.label + ' נותק'); render(); };
      if (typeof cbConfirm === 'function') cbConfirm({ title: 'ניתוק ' + c.label, icon: 'alert', danger: true,
        confirmLabel: 'נתק', message: 'הודעות חדשות מהערוץ הזה יפסיקו להיכנס. אפשר לחבר מחדש בכל רגע.', onConfirm: go });
      else go();
    }));
    q('[data-ouref]').forEach(b => b.addEventListener('click', () => { O().refresh(b.dataset.ouref); toast('ההרשאה חודשה'); render(); }));
    q('[data-outest]').forEach(b => b.addEventListener('click', () => {
      const r1 = O().testApi(b.dataset.outest), r2 = O().testHook(b.dataset.outest);
      toast(r1.ok && r2.ok ? 'החיבור תקין — הודעות נכנסות ויוצאות כרגיל' : (r1.msg || r2.msg));
      render();
    }));
    q('[data-ouwiz]').forEach(b => b.addEventListener('click', () => openWizard()));
    q('[data-ouadmin]').forEach(b => b.addEventListener('click', () => {
      if (typeof applySetMode === 'function') { navActive = 'settings'; applySetMode('omni'); renderSettingsView(); }
    }));
  }

  CBX.register({
    key: 'omniui', label: 'מסך הערוצים — חוויית מוצר', icon: 'chat',
    desc: '"ערוצים" בתפריט הראשי: כרטיס לכל ערוץ עם סטטוס בצבע ובטקסט, חיבור בחלון אחד (הסבר → אישור → בחירת נכס → הצלחה → הגדרות), פס התקדמות, כרטיס "נותר שלב אחד" וכפתורי פעולה מהירים. פרטים טכניים מוסתרים ושמורים למסך מנהל CallBiz.',
    files: ['js/ext/omni-ui.js', 'css/ext/omni-ui.css'],
    install() {
      if (typeof NAV === 'undefined') return;
      if (!NAV.some(n => n.key === 'omni'))
        CBX.push('omniui', NAV, { key: 'omni', label: 'ערוצים', icon: 'chat' });

      /* כניסה לתפריט */
      CBX.delegate('omniui', '[data-nav="omni"]', () => {
        inView = true;
        if (!wizDone() && !conns().some(c => isOn(c.key))) { render(); setTimeout(openWizard, 60); return; }
        render();
      });
      /* יציאה מהמסך כשעוברים לטאב אחר */
      CBX.delegate('omniui', '[data-nav]', el => { if (el.dataset.nav !== 'omni') inView = false; });

      if (typeof renderNav === 'function') CBX.wrap('omniui', 'renderNav', o => function () {
        const out = o.apply(this, arguments);
        try {
          const b = document.querySelector('[data-nav="omni"]');
          if (b && !b.querySelector('.ou-badge')) {
            const need = conns().filter(c => isOn(c.key) && !routed(c.key)).length;
            if (need) { const s = document.createElement('span'); s.className = 'ou-badge'; s.textContent = need; b.appendChild(s); }
          }
        } catch (e) {}
        return out;
      });
    },
  });

  window.OMNIUI = { render: () => { inView = true; render(); }, wizard: openWizard, connect: openConnect, cfg: openCfg, statusOf };
})();
