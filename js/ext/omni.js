/* ============================================================
   הרחבה: אומניצ׳אנל — ניהול ערוצי תקשורת  ·  key = 'omni'
   ------------------------------------------------------------
   ארכיטקטורת מחברים (Connector Architecture): כל ערוץ הוא מחבר
   עצמאי שמצהיר על היכולות שלו, ונרשם בשורה אחת:

       OMNI.registerConnector({
         key: 'telegram', label: 'Telegram', icon: 'chat',
         auth: 'oauth', caps: { media: true, read: true, templates: false },
         webhook: true, docs: '…',
       });

   הליבה לא יודעת דבר על ערוץ מסוים — היא עובדת מול המודל האחיד
   (Unified Message Model) שמוגדר כאן, ולכן הוספת ערוץ חדש אינה
   דורשת שינוי בשום מסך.

   רב-דיירות: כל חיבור נשמר תחת מזהה הלקוח (tenant). אין גישה
   לחיבורים של דייר אחר — לא בקריאה ולא בכתיבה.

   הערה חשובה: אין כאן שרת. תהליך ה-OAuth, יצירת ה-Webhook
   ובדיקות ה-API מדמים את הזרימה ושומרים מטא-דאטה בלבד — לעולם
   לא טוקן אמיתי. נקודות החיבור לשרת מסומנות ב-TODO(server).
   ============================================================ */
(function () {

  /* ============================================================
     1. המודל האחיד — כל ערוץ ממופה אליו
     ============================================================ */
  const MESSAGE_MODEL = {
    id: 'string', tenant: 'string', channel: 'string', accountId: 'string',
    conversationId: 'string', direction: 'in|out',
    from: '{ id, name, avatar }', to: '{ id, name }',
    type: 'text|image|video|audio|file|location|template|system',
    body: 'string', media: '[{ url, mime, name, size }]',
    replyTo: 'messageId|null', reactions: '[{ by, emoji }]',
    status: 'queued|sent|delivered|read|failed',
    at: 'ISO', raw: 'object (payload מקורי לצורכי דיבוג)',
  };

  /* ============================================================
     2. מרשם המחברים
     ============================================================ */
  const CONNECTORS = [];
  function registerConnector(def) {
    if (!def || !def.key || CONNECTORS.some(c => c.key === def.key)) return;
    CONNECTORS.push(Object.assign({
      auth: 'oauth', webhook: true, color: '#5B4CE6',
      caps: { media: true, read: false, reactions: false, templates: false, voice: false },
      scopes: [], note: '',
    }, def));
  }
  const connectorOf = k => CONNECTORS.find(c => c.key === k);

  registerConnector({ key: 'whatsapp', label: 'WhatsApp Business', icon: 'whatsapp', color: '#25D366',
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    caps: { media: true, read: true, reactions: true, templates: true, voice: true },
    note: 'תבניות מאושרות בלבד מחוץ לחלון 24 השעות' });
  registerConnector({ key: 'messenger', label: 'Facebook Messenger', icon: 'chat', color: '#0084FF',
    scopes: ['pages_messaging', 'pages_manage_metadata'],
    caps: { media: true, read: true, reactions: true, templates: false, voice: true } });
  registerConnector({ key: 'instagram', label: 'Instagram', icon: 'chat', color: '#E1306C',
    scopes: ['instagram_manage_messages', 'pages_show_list'],
    caps: { media: true, read: true, reactions: true, templates: false, voice: true },
    note: 'דורש חשבון מקושר לעמוד פייסבוק' });
  registerConnector({ key: 'gmail', label: 'Gmail', icon: 'mail', color: '#EA4335',
    scopes: ['gmail.readonly', 'gmail.send'],
    caps: { media: true, read: false, reactions: false, templates: true, voice: false },
    note: 'סטטוס "נקרא" אינו נתמך בדוא״ל' });
  registerConnector({ key: 'outlook', label: 'Outlook · Microsoft 365', icon: 'mail', color: '#0078D4',
    scopes: ['Mail.ReadWrite', 'Mail.Send'],
    caps: { media: true, read: false, reactions: false, templates: true, voice: false } });
  /* מוכן להרחבה — נרשם באותה שורה בדיוק */
  registerConnector({ key: 'webchat', label: 'צ׳אט באתר', icon: 'chat', color: '#6B7085', auth: 'apikey',
    caps: { media: true, read: true, reactions: false, templates: false, voice: false },
    note: 'לא נדרש OAuth — מפתח API והטמעת סקריפט' });

  /* ============================================================
     3. רב-דיירות ואחסון
     ============================================================ */
  const TKEY = 'cb_tenant', SKEY = 'cb_omni';
  const tenant = () => { try { return localStorage.getItem(TKEY) || 'callbiz-demo'; } catch (e) { return 'callbiz-demo'; } };
  function store() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } }
  function save(all) { try { localStorage.setItem(SKEY, JSON.stringify(all)); } catch (e) {} }
  function state() { const all = store(); return (all[tenant()] = all[tenant()] || { conns: {}, log: [] }); }
  function commit(st) { const all = store(); all[tenant()] = st; save(all); }
  const connOf = k => state().conns[k] || null;

  function logAdd(act, ch, extra) {
    const st = state();
    st.log.unshift(Object.assign({ act, ch, by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''),
      at: (typeof docStamp === 'function') ? docStamp() : '' }, extra || {}));
    st.log = st.log.slice(0, 80);
    commit(st);
  }

  /* ============================================================
     4. הרשאות
     ============================================================ */
  const ROLES = {
    cbadmin: { label: 'מנהל CallBiz', can: { view: true, logs: true, diag: true, connect: false, settings: false, content: false } },
    owner:   { label: 'מנהל הלקוח',   can: { view: true, logs: true, diag: true, connect: true,  settings: true,  content: true  } },
    agent:   { label: 'נציג',          can: { view: false, logs: false, diag: false, connect: false, settings: false, content: true } },
  };
  function myRole() {
    const me = (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '')) : null;
    const p = me ? me.perm : 'נציג';
    if (p === 'אדמין') return 'cbadmin';
    if (p === 'מנהל רשת' || p === 'מנהל סניף') return 'owner';
    return 'agent';
  }
  const can = k => !!(ROLES[myRole()].can[k]);

  /* ============================================================
     5. פעולות החיבור  —  TODO(server): כאן מתחברים לשרת אמיתי
     ============================================================ */
  const nowStamp = () => (typeof docStamp === 'function') ? docStamp() : '';
  function connect(key, account) {
    const c = connectorOf(key); if (!c) return;
    const st = state();
    st.conns[key] = {
      key, status: 'connected', account: account || demoAccount(c),
      accountId: c.key + '_' + Math.abs(hash(tenant() + key)).toString(36).slice(0, 8),
      at: nowStamp(), by: (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : ''),
      scopes: (c.scopes || []).slice(),
      /* לעולם לא נשמר טוקן אמיתי בצד לקוח — רק מטא-דאטה */
      token: { kind: c.auth, expiresIn: c.auth === 'oauth' ? 60 : null, ref: 'srv:' + tenant() + ':' + key },
      webhook: c.webhook ? { url: '/api/hooks/' + tenant() + '/' + key, ok: true, at: nowStamp() } : null,
      cfg: st.conns[key] && st.conns[key].cfg ? st.conns[key].cfg : defaultCfg(),
    };
    commit(st); logAdd('חובר', key, { account: st.conns[key].account });
  }
  function disconnect(key) {
    const st = state(); if (!st.conns[key]) return;
    const acc = st.conns[key].account;
    st.conns[key].status = 'disconnected';
    st.conns[key].token = null; st.conns[key].webhook = null;
    commit(st); logAdd('נותק', key, { account: acc });
  }
  function refresh(key) {
    const st = state(); const c = st.conns[key]; if (!c) return;
    c.status = 'connected'; c.at = nowStamp();
    c.token = Object.assign({}, c.token, { expiresIn: 60, refreshedAt: nowStamp() });
    commit(st); logAdd('רענון הרשאות', key);
  }
  function testHook(key) {
    const st = state(); const c = st.conns[key]; if (!c || !c.webhook) return { ok: false, msg: 'אין Webhook לערוץ הזה' };
    c.webhook.ok = true; c.webhook.at = nowStamp(); commit(st); logAdd('בדיקת Webhook', key, { result: 'תקין' });
    return { ok: true, msg: 'ה-Webhook הגיב · ' + c.webhook.url };
  }
  function testApi(key) {
    const c = connOf(key);
    if (!c || c.status !== 'connected') return { ok: false, msg: 'הערוץ אינו מחובר' };
    logAdd('בדיקת API', key, { result: 'תקין' });
    return { ok: true, msg: 'קריאת API הצליחה · ' + (c.account || '') };
  }
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  function demoAccount(c) {
    return ({ whatsapp: '+972-50-0000000', messenger: 'CallBiz · עמוד עסקי', instagram: '@callbiz',
      gmail: 'service@callbiz.co.il', outlook: 'service@callbiz.co.il', webchat: 'callbiz.co.il' })[c.key] || c.label;
  }
  function defaultCfg() {
    return { agents: [], team: '', hours: { from: '08:00', to: '18:00', days: [0, 1, 2, 3, 4] },
      greeting: 'שלום! הגעתם ל-CallBiz. נציג יענה בהקדם.',
      offHours: 'קיבלנו את פנייתכם מחוץ לשעות הפעילות ונחזור אליכם עם פתיחת המשרד.',
      tags: [], sla: 30, notify: true };
  }

  /* ============================================================
     6. המסך
     ============================================================ */
  const ST = { connected: { label: 'מחובר', color: 'ok' }, disconnected: { label: 'מנותק', color: 'off' },
    pending: { label: 'דורש הרשאה', color: 'warn' }, error: { label: 'שגיאה', color: 'bad' } };
  let omTab = 'channels', omSettings = null;

  function screenHTML() {
    const role = myRole();
    return `<div class="om">
      <div class="om-head">
        <div><b>${ic('chat')} ערוצי תקשורת · אומניצ׳אנל</b>
          <small>כל הערוצים של הלקוח במקום אחד · דייר: <code>${esc(tenant())}</code> · תפקידך: ${esc(ROLES[role].label)}</small></div>
        <div class="om-tabs">
          <button class="om-tab ${omTab === 'channels' ? 'on' : ''}" data-omtab="channels">${ic('layers')} ערוצים</button>
          ${can('logs') ? `<button class="om-tab ${omTab === 'conns' ? 'on' : ''}" data-omtab="conns">${ic('lock')} ניהול חיבורים</button>` : ''}
          <button class="om-tab ${omTab === 'model' ? 'on' : ''}" data-omtab="model">${ic('docs')} מודל ומחברים</button>
        </div>
      </div>
      ${!can('connect') ? `<div class="om-perm">${ic('lock')} ${role === 'agent'
        ? 'כנציג — אפשר לעבוד על השיחות בלבד. חיבור וניתוק ערוצים שמורים למנהל הלקוח.'
        : 'כמנהל CallBiz — צפייה, לוגים ואבחון בלבד. אין גישה אוטומטית לתוכן שיחות של לקוחות.'}</div>` : ''}
      ${omTab === 'channels' ? channelsHTML() : omTab === 'conns' ? connsHTML() : modelHTML()}
    </div>`;
  }

  function channelsHTML() {
    return `<div class="om-grid">${CONNECTORS.map(c => {
      const n = connOf(c.key), st = ST[(n && n.status) || 'disconnected'];
      return `<section class="om-card ${st.color}">
        <div class="om-c-h"><span class="om-ic" style="--ch:${c.color}">${ic(c.icon)}</span>
          <div class="om-c-t"><b>${esc(c.label)}</b>
            <small>${c.auth === 'oauth' ? 'OAuth' : 'מפתח API'}${c.webhook ? ' · Webhook' : ''}</small></div>
          <span class="om-st ${st.color}">${st.label}</span></div>
        ${n && n.status === 'connected' ? `<div class="om-c-b">
          <div class="om-kv"><span>חשבון</span><b>${esc(n.account || '')}</b></div>
          <div class="om-kv"><span>מזהה</span><b class="mono">${esc(n.accountId || '')}</b></div>
          <div class="om-kv"><span>חובר</span><b>${esc(n.at || '')}</b></div>
          <div class="om-kv"><span>ע״י</span><b>${esc(n.by || '')}</b></div>
          ${n.token && n.token.expiresIn ? `<div class="om-kv"><span>תוקף הרשאה</span><b>${n.token.expiresIn} ימים</b></div>` : ''}
        </div>` : `<p class="om-none">${esc(c.note || 'לא מחובר — חיבור פותח את מסך ההרשאות של הספק.')}</p>`}
        <div class="om-caps">${Object.keys(c.caps).filter(k => c.caps[k]).map(k => `<span>${esc(CAPS[k] || k)}</span>`).join('')}</div>
        <div class="om-acts">
          ${n && n.status === 'connected'
            ? `${can('settings') ? `<button class="btn xs" data-omcfg="${c.key}">${ic('settings')} הגדרות</button>` : ''}
               ${can('connect') ? `<button class="btn xs" data-omref="${c.key}">${ic('sync')} רענון הרשאות</button>
               <button class="btn xs" data-omdis="${c.key}">${ic('close')} ניתוק</button>` : ''}`
            : `${can('connect') ? `<button class="btn xs primary" data-omcon="${c.key}">${ic('check')} חבר</button>` : '<span class="om-lock">אין הרשאה לחבר</span>'}`}
        </div>
      </section>`;
    }).join('')}</div>`;
  }
  const CAPS = { media: 'מדיה', read: 'נקרא/נמסר', reactions: 'תגובות', templates: 'תבניות', voice: 'הודעות קול' };

  function connsHTML() {
    const st = state(), rows = Object.keys(st.conns).map(k => st.conns[k]);
    return `<section class="om-panel">
      <div class="om-p-h">${ic('lock')} <b>חשבונות מחוברים</b><small>${rows.length} חיבורים · דייר ${esc(tenant())}</small></div>
      <div class="om-tbl-wrap"><table class="om-tbl">
        <thead><tr><th>ערוץ</th><th>חשבון</th><th>סטטוס</th><th>תוקף</th><th>Webhook</th><th>פעולות</th></tr></thead>
        <tbody>${rows.length ? rows.map(n => { const c = connectorOf(n.key) || {}; const s = ST[n.status] || ST.disconnected;
          return `<tr><td><b>${esc(c.label || n.key)}</b></td><td>${esc(n.account || '')}</td>
            <td><span class="om-st ${s.color}">${s.label}</span></td>
            <td>${n.token && n.token.expiresIn ? n.token.expiresIn + ' ימים' : '—'}</td>
            <td>${n.webhook ? `<span class="om-hook ${n.webhook.ok ? 'ok' : 'bad'}">${n.webhook.ok ? 'תקין' : 'שגיאה'}</span>` : '—'}</td>
            <td class="om-row-acts">
              <button class="btn xs" data-omhook="${n.key}">בדיקת Webhook</button>
              <button class="btn xs" data-omapi="${n.key}">בדיקת API</button>
              ${can('connect') ? `<button class="btn xs" data-omref="${n.key}">חידוש</button>
              <button class="btn xs" data-omdis="${n.key}">ניתוק</button>` : ''}
            </td></tr>`; }).join('')
          : '<tr><td colspan="6" class="om-empty">אין עדיין חיבורים</td></tr>'}</tbody>
      </table></div>
      <div class="om-p-h sub">${ic('history')} <b>לוג חיבורים</b></div>
      <div class="om-log">${st.log.length ? st.log.map(l => `<div class="om-log-i">
        <b>${esc(l.act)}</b><span>${esc((connectorOf(l.ch) || {}).label || l.ch)}</span>
        <small>${esc(l.by || '')} · ${esc(l.at || '')}${l.result ? ' · ' + esc(l.result) : ''}${l.account ? ' · ' + esc(l.account) : ''}</small>
      </div>`).join('') : '<p class="om-empty">אין רשומות</p>'}</div>
    </section>`;
  }

  function modelHTML() {
    return `<section class="om-panel">
      <div class="om-p-h">${ic('docs')} <b>מודל ההודעות האחיד</b>
        <small>כל מחבר ממפה את ה-payload שלו למבנה הזה — הליבה לא מכירה ערוץ מסוים</small></div>
      <div class="om-model">${Object.keys(MESSAGE_MODEL).map(k => `<div class="om-m-r">
        <code>${esc(k)}</code><span>${esc(MESSAGE_MODEL[k])}</span></div>`).join('')}</div>
      <div class="om-p-h sub">${ic('layers')} <b>מחברים רשומים</b>
        <small>הוספת ערוץ = רישום מחבר, בלי לגעת במסכים</small></div>
      <div class="om-conn-list">${CONNECTORS.map(c => `<div class="om-conn">
        <span class="om-ic sm" style="--ch:${c.color}">${ic(c.icon)}</span>
        <div><b>${esc(c.label)}</b><small>${esc(c.auth)}${c.webhook ? ' · webhook' : ''} · ${(c.scopes || []).join(', ') || 'ללא scopes'}</small></div>
      </div>`).join('')}</div>
      <pre class="om-code">OMNI.registerConnector({
  key: 'telegram', label: 'Telegram', icon: 'chat', color: '#229ED9',
  auth: 'oauth', webhook: true,
  caps: { media: true, read: true, reactions: true, templates: false },
  scopes: ['bot'],
});</pre>
      <p class="om-note">${ic('alert')} אין שרת בגרסה הזו: תהליך ההרשאה, ה-Webhook ובדיקות ה-API מדמים את הזרימה
        ושומרים מטא-דאטה בלבד. הטוקן עצמו לעולם אינו נשמר בצד הלקוח — רק הפניה אליו בשרת.</p>
    </section>`;
  }

  /* ---------- מסך ההרשאה (מדמה OAuth) ---------- */
  function oauthFlow(key) {
    const c = connectorOf(key); if (!c) return;
    const old = document.getElementById('omAuth'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'omAuth';
    w.innerHTML = `<div class="cbc-box om-auth" style="max-width:460px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic" style="background:${c.color}22;color:${c.color}">${ic(c.icon)}</span>
        <b>חיבור ${esc(c.label)}</b></div>
      <p class="om-auth-l">${c.auth === 'oauth'
        ? 'ייפתח מסך ההרשאה של הספק. לאחר האישור המערכת תשמור את מזהה החשבון, תיצור Webhook ותעדכן את הסטטוס.'
        : 'הזינו את מפתח ה-API של הערוץ. המפתח נשמר בשרת בלבד.'}</p>
      <div class="om-scopes">${(c.scopes || []).map(s => `<span>${esc(s)}</span>`).join('') || '<span>ללא scopes</span>'}</div>
      <label class="om-f"><span>חשבון לחיבור</span>
        <input class="cc-inp" id="omAcc" value="${esc(demoAccount(c))}"></label>
      <p class="om-warn">${ic('alert')} בגרסה הזו אין שרת — התהליך מדומה ונשמרת מטא-דאטה בלבד, בלי טוקן אמיתי.</p>
      <div class="cbc-actions">
        <button class="btn ghost" id="omAuthX">ביטול</button>
        <button class="btn primary" id="omAuthGo">${ic('check')} ${c.auth === 'oauth' ? 'אשר והתחבר' : 'שמור מפתח'}</button>
      </div></div>`;
    document.body.appendChild(w);
    w.querySelector('#omAuthX').addEventListener('click', () => w.remove());
    w.querySelector('#omAuthGo').addEventListener('click', () => {
      connect(key, (w.querySelector('#omAcc') || {}).value);
      w.remove(); toast(c.label + ' חובר בהצלחה'); render();
    });
  }

  /* ---------- הגדרות ערוץ ---------- */
  const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  function cfgPanel(key) {
    const c = connectorOf(key), n = connOf(key); if (!c || !n) return;
    const cfg = n.cfg = n.cfg || defaultCfg();
    const old = document.getElementById('omCfg'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'omCfg';
    const staff = (typeof STAFF !== 'undefined') ? STAFF.filter(s => s.on !== false) : [];
    const teams = (typeof DEPARTMENTS !== 'undefined') ? DEPARTMENTS : [];
    w.innerHTML = `<div class="cbc-box om-cfg" style="max-width:560px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic" style="background:${c.color}22;color:${c.color}">${ic(c.icon)}</span>
        <b>הגדרות ${esc(c.label)}</b></div>
      <div class="om-cfg-b">
        <div class="om-f"><span>${ic('clients')} מי יכול לענות</span>
          <div class="om-chips">${staff.map(s => `<button class="om-chip ${cfg.agents.indexOf(s.id) >= 0 ? 'on' : ''}" data-omag="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div></div>
        <label class="om-f"><span>${ic('layers')} ניתוב לצוות</span>
          <select class="cc-inp" id="omTeam"><option value="">ללא ניתוב</option>
            ${teams.map(t => `<option ${cfg.team === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <div class="om-f"><span>${ic('clock')} שעות פעילות</span>
          <div class="om-hours">
            <input type="time" class="cc-inp" id="omFrom" value="${esc(cfg.hours.from)}">
            <span>עד</span>
            <input type="time" class="cc-inp" id="omTo" value="${esc(cfg.hours.to)}">
          </div>
          <div class="om-chips days">${DAYS.map((d, i) => `<button class="om-chip ${cfg.hours.days.indexOf(i) >= 0 ? 'on' : ''}" data-omday="${i}">${d}</button>`).join('')}</div></div>
        <label class="om-f"><span>${ic('chat')} הודעת פתיחה אוטומטית</span>
          <textarea class="cc-inp" id="omGreet" rows="2">${esc(cfg.greeting)}</textarea></label>
        <label class="om-f"><span>${ic('clock')} הודעה מחוץ לשעות הפעילות</span>
          <textarea class="cc-inp" id="omOff" rows="2">${esc(cfg.offHours)}</textarea></label>
        <label class="om-f"><span>${ic('flag')} תגיות ברירת מחדל</span>
          <input class="cc-inp" id="omTags" value="${esc((cfg.tags || []).join(', '))}" placeholder="לדוגמה: נכנס, ${esc(c.label)}"></label>
        <div class="om-f2">
          <label class="om-f"><span>${ic('alert')} SLA (דקות)</span>
            <input type="number" class="cc-inp" id="omSla" min="1" max="1440" value="${+cfg.sla || 30}"></label>
          <label class="om-sw"><input type="checkbox" id="omNotify" ${cfg.notify ? 'checked' : ''}>
            <span>התראות לנציג בהודעה חדשה</span></label>
        </div>
      </div>
      <div class="cbc-actions">
        <button class="btn ghost" id="omCfgX">ביטול</button>
        <button class="btn primary" id="omCfgS">${ic('check')} שמור הגדרות</button>
      </div></div>`;
    document.body.appendChild(w);
    w.querySelectorAll('[data-omag]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.omag, i = cfg.agents.indexOf(id);
      i >= 0 ? cfg.agents.splice(i, 1) : cfg.agents.push(id);
      b.classList.toggle('on');
    }));
    w.querySelectorAll('[data-omday]').forEach(b => b.addEventListener('click', () => {
      const d = +b.dataset.omday, i = cfg.hours.days.indexOf(d);
      i >= 0 ? cfg.hours.days.splice(i, 1) : cfg.hours.days.push(d);
      b.classList.toggle('on');
    }));
    w.querySelector('#omCfgX').addEventListener('click', () => w.remove());
    w.querySelector('#omCfgS').addEventListener('click', () => {
      const g = id => (w.querySelector('#' + id) || {}).value;
      cfg.team = g('omTeam'); cfg.hours.from = g('omFrom'); cfg.hours.to = g('omTo');
      cfg.greeting = g('omGreet'); cfg.offHours = g('omOff');
      cfg.tags = String(g('omTags') || '').split(',').map(x => x.trim()).filter(Boolean);
      cfg.sla = +g('omSla') || 30;
      cfg.notify = !!(w.querySelector('#omNotify') || {}).checked;
      const st = state(); st.conns[key].cfg = cfg; commit(st);
      logAdd('עודכנו הגדרות', key);
      w.remove(); toast('הגדרות ' + c.label + ' נשמרו'); render();
    });
  }

  /* ---------- רינדור וקישור ---------- */
  let omMode = false;
  function render() {
    if (!omMode) return;
    const host = document.getElementById('viewHost'); if (!host) return;
    host.innerHTML = (typeof settingsHeader === 'function' ? settingsHeader() : '') + screenHTML();
    if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
    bind();
  }
  function bind() {
    const q = s => Array.prototype.slice.call(document.querySelectorAll(s));
    q('[data-omtab]').forEach(b => b.addEventListener('click', () => { omTab = b.dataset.omtab; render(); }));
    q('[data-omcon]').forEach(b => b.addEventListener('click', () => oauthFlow(b.dataset.omcon)));
    q('[data-omdis]').forEach(b => b.addEventListener('click', () => {
      disconnect(b.dataset.omdis); toast('הערוץ נותק'); render(); }));
    q('[data-omref]').forEach(b => b.addEventListener('click', () => {
      refresh(b.dataset.omref); toast('ההרשאות רועננו'); render(); }));
    q('[data-omcfg]').forEach(b => b.addEventListener('click', () => cfgPanel(b.dataset.omcfg)));
    q('[data-omhook]').forEach(b => b.addEventListener('click', () => { const r = testHook(b.dataset.omhook); toast(r.msg); render(); }));
    q('[data-omapi]').forEach(b => b.addEventListener('click', () => { const r = testApi(b.dataset.omapi); toast(r.msg); render(); }));
  }

  CBX.register({
    key: 'omni', label: 'אומניצ׳אנל — ניהול ערוצים', icon: 'chat',
    desc: 'מסך ניהול לכל ערוצי התקשורת: WhatsApp, Messenger, Instagram, Gmail, Outlook וצ׳אט באתר. חיבור וניתוק, רענון הרשאות, הגדרות ניתוב ושעות פעילות, ניהול חיבורים עם לוג ובדיקות Webhook/API, רב-דיירות והרשאות לפי תפקיד. ארכיטקטורת מחברים — ערוץ חדש נרשם בשורה אחת.',
    files: ['js/ext/omni.js', 'css/ext/omni.css'],
    install() {
      if (typeof SET_GROUPS === 'undefined' || typeof applySetMode !== 'function') return;
      const g = SET_GROUPS.find(x => x.key === 'manage');
      if (g && !g.items.some(i => i.m === 'omni'))
        CBX.push('omni', g.items, { m: 'omni', label: 'ערוצי תקשורת', icon: 'chat', desc: 'אומניצ׳אנל · חיבורים, ניתוב והרשאות' });

      CBX.wrap('omni', 'applySetMode', o => function (m) { omMode = m === 'omni'; return o.apply(this, arguments); });
      if (typeof currentSetModeKey === 'function')
        CBX.wrap('omni', 'currentSetModeKey', o => function () { return omMode ? 'omni' : o.apply(this, arguments); });
      if (typeof renderSettingsView === 'function')
        CBX.wrap('omni', 'renderSettingsView', o => function () {
          if (!omMode) return o.apply(this, arguments);
          render();
        });

      /* חיווי הערוץ ברשימת השיחות הקיימת — בלי לשכפל את המסך */
      if (typeof renderChatPlatform === 'function') CBX.wrap('omni', 'renderChatPlatform', o => function () {
        const out = o.apply(this, arguments);
        try {
          const host = document.querySelector('.plat-pills');
          if (!host || host.querySelector('.om-src')) return out;
          const on = CONNECTORS.filter(c => (connOf(c.key) || {}).status === 'connected');
          const d = document.createElement('div'); d.className = 'om-src';
          d.innerHTML = `${ic('chat')} <b>ערוצים מחוברים:</b>
            ${on.length ? on.map(c => `<span class="om-src-c" style="--ch:${c.color}">${ic(c.icon)} ${esc(c.label)}</span>`).join('')
              : '<span class="om-src-n">אין ערוצים מחוברים — הגדרות › ערוצי תקשורת</span>'}`;
          host.parentNode.insertBefore(d, host.nextSibling);
        } catch (e) {}
        return out;
      });
    },
  });

  window.OMNI = { registerConnector, connectors: () => CONNECTORS.slice(), MESSAGE_MODEL,
    tenant, state, connect, disconnect, refresh, testHook, testApi, role: myRole, can, ROLES };
})();
