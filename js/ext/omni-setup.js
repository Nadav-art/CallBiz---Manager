/* ============================================================
   הרחבה: מדריך הקמה לכל ערוץ + תשתית  ·  key = 'omnisetup'
   ------------------------------------------------------------
   שני דברים:

   1) מדריך מובנה, שלב אחר שלב, להקמה הראשונית של כל ערוץ —
      מה צריך להכין מראש, מה עושים אצל הספק, ומה מזינים כאן.
      כל שלב מסומן כבוצע ונשמר, כך שאפשר לעצור באמצע ולחזור.

   2) רשימת התשתית שנדרשת בצד השרת כדי שהחיבורים יעבדו באמת.
      חשוב שיהיה כתוב במפורש: את שלב החלפת הטוקן (token exchange)
      אי-אפשר לבצע בדפדפן — הוא מחייב סוד אפליקציה, ולכן חייב
      לרוץ בשרת. מה שכאן מכין את כל מה שאפשר להכין מראש.

   דוא״ל: בנוסף ל-OAuth יש מסלול IMAP/SMTP עם סיסמת אפליקציה,
   שהוא הדרך המהירה לחבר תיבה בלי אישור ספק. גם הוא מחייב שרת
   שיחזיק את הפרטים ויבצע את הסנכרון — הטופס כאן אוסף בדיוק את
   מה שהשרת יצטרך.
   ============================================================ */
(function () {

  const O = () => window.OMNI;
  const KEY = 'cb_omniSetup';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const tkey = k => ((O() ? O().tenant() : 'demo') + '|' + k);
  const doneOf = k => (load()[tkey(k)] || {});
  function markStep(k, i, on) {
    const all = load(); const m = all[tkey(k)] = all[tkey(k)] || {};
    on ? m[i] = 1 : delete m[i]; save(all);
  }

  /* ============================================================
     המדריכים
     ============================================================ */
  const GUIDES = {
    whatsapp: {
      who: 'Meta · WhatsApp Business Platform',
      time: '20–40 דקות (ואישור עסקי שעשוי לקחת ימים)',
      prereq: ['חשבון Meta Business מאומת', 'מספר טלפון שאינו רשום כרגע לוואטסאפ רגיל', 'גישה לקבלת SMS/שיחה למספר'],
      steps: [
        { t: 'פתיחת חשבון Meta Business', d: 'business.facebook.com → יצירת עסק, מילוי פרטי החברה ואימות בעלות.' },
        { t: 'יצירת אפליקציה מסוג Business', d: 'developers.facebook.com → My Apps → Create App → Business → הוספת מוצר WhatsApp.' },
        { t: 'הוספת מספר הטלפון', d: 'WhatsApp → API Setup → Add phone number → אימות ב-SMS או בשיחה.' },
        { t: 'אימות עסקי (Business Verification)', d: 'מסמכי חברה + כתובת. בלי זה נשארים במגבלת הודעות נמוכה.' },
        { t: 'אישור תבניות הודעה', d: 'כל פנייה יזומה מחוץ לחלון 24 השעות חייבת תבנית מאושרת. מגישים לאישור מראש.' },
        { t: 'חיבור למערכת', d: 'חוזרים לכאן, "חבר חשבון", ובוחרים את המספר שאושר.' },
      ],
      needs: ['App ID + App Secret', 'Permanent Access Token (System User)', 'Phone Number ID', 'WABA ID', 'Webhook Verify Token'],
      review: 'נדרש אימות עסקי ואישור תבניות מצד Meta.',
    },
    messenger: {
      who: 'Meta · Messenger Platform',
      time: '15–30 דקות',
      prereq: ['עמוד פייסבוק עסקי', 'הרשאת מנהל בעמוד'],
      steps: [
        { t: 'אפליקציית Meta', d: 'developers.facebook.com → Create App → Business → הוספת המוצר Messenger.' },
        { t: 'קישור העמוד', d: 'Messenger → Settings → Add or Remove Pages → בחירת העמוד העסקי.' },
        { t: 'הרשאות', d: 'pages_messaging ו-pages_manage_metadata.' },
        { t: 'Webhook', d: 'הרשמה לאירועי messages ו-messaging_postbacks.' },
        { t: 'App Review', d: 'לשימוש מחוץ לצוות הפיתוח נדרש אישור להרשאת pages_messaging.' },
        { t: 'חיבור למערכת', d: '"חבר חשבון" ← בחירת העמוד מהרשימה.' },
      ],
      needs: ['App ID + App Secret', 'Page Access Token', 'Page ID', 'Webhook Verify Token'],
      review: 'App Review נדרש לפני שימוש מסחרי.',
    },
    instagram: {
      who: 'Meta · Instagram Messaging',
      time: '15–30 דקות',
      prereq: ['חשבון Instagram מסוג Business או Creator', 'קישור החשבון לעמוד פייסבוק', 'הפעלת "Allow access to messages" באפליקציה'],
      steps: [
        { t: 'המרת החשבון ל-Business', d: 'באפליקציית Instagram: Settings → Account → Switch to professional account.' },
        { t: 'קישור לעמוד פייסבוק', d: 'Settings → Business → Linked accounts.' },
        { t: 'הרשאת גישה להודעות', d: 'Settings → Privacy → Messages → Connected tools → Allow access to messages.' },
        { t: 'הרשאות באפליקציה', d: 'instagram_manage_messages + pages_show_list.' },
        { t: 'חיבור למערכת', d: '"חבר חשבון" ← בחירת חשבון האינסטגרם.' },
      ],
      needs: ['אותה אפליקציית Meta', 'Page Access Token', 'Instagram Business Account ID'],
      review: 'נדרש אישור להרשאת instagram_manage_messages.',
    },
    gmail: {
      who: 'Google Workspace / Gmail',
      time: '10–20 דקות',
      prereq: ['חשבון Gmail או Workspace', 'אימות דו-שלבי מופעל (למסלול סיסמת אפליקציה)'],
      steps: [
        { t: 'בחירת מסלול', d: 'OAuth — מומלץ לארגונים, דורש אישור Google לסקופים רגישים. IMAP/SMTP — מהיר, מתאים לתיבה בודדת.' },
        { t: 'הפעלת IMAP', d: 'Gmail → הגדרות → העברה ו-POP/IMAP → הפעלת IMAP.' },
        { t: 'יצירת סיסמת אפליקציה', d: 'myaccount.google.com → אבטחה → אימות דו-שלבי → סיסמאות אפליקציה.' },
        { t: 'הזנת הפרטים כאן', d: 'שרת imap.gmail.com:993 (SSL) · שליחה smtp.gmail.com:587 (TLS).' },
        { t: 'בדיקת חיבור', d: 'המערכת מושכת הודעה אחת לאימות, ואז מתחילה סנכרון.' },
      ],
      needs: ['כתובת התיבה', 'סיסמת אפליקציה (נשמרת מוצפנת בשרת בלבד)', 'שרתי IMAP/SMTP'],
      review: 'במסלול OAuth: Google דורשת אימות אפליקציה לסקופים של Gmail.',
      direct: 'imap',
    },
    outlook: {
      who: 'Microsoft 365 / Outlook',
      time: '10–20 דקות',
      prereq: ['תיבת Microsoft 365 או Outlook.com', 'הרשאת מנהל ב-Entra ID (למסלול OAuth)'],
      steps: [
        { t: 'בחירת מסלול', d: 'OAuth (Microsoft Graph) — מומלץ לארגון. IMAP/SMTP — מהיר לתיבה בודדת, אם המנהל אפשר אותו.' },
        { t: 'רישום אפליקציה', d: 'portal.azure.com → Entra ID → App registrations → New registration.' },
        { t: 'הרשאות Graph', d: 'Mail.ReadWrite + Mail.Send, ואישור מנהל (Admin consent).' },
        { t: 'למסלול IMAP', d: 'outlook.office365.com:993 (SSL) · smtp.office365.com:587 (TLS) + סיסמת אפליקציה.' },
        { t: 'בדיקת חיבור', d: 'משיכת הודעה אחת לאימות ואז סנכרון מלא.' },
      ],
      needs: ['Tenant ID', 'Client ID + Secret', 'הרשאות Graph מאושרות'],
      review: 'נדרש Admin consent בארגון.',
      direct: 'imap',
    },
    webchat: {
      who: 'CallBiz · צ׳אט באתר',
      time: '5 דקות',
      prereq: ['גישה לעריכת קוד האתר או מנהל תגיות'],
      steps: [
        { t: 'יצירת ווידג׳ט', d: 'לוחצים "חבר חשבון" ומקבלים מזהה ווידג׳ט לאתר.' },
        { t: 'הטמעת הסקריפט', d: 'מדביקים את שורת ההטמעה לפני תגית הסגירה של body.' },
        { t: 'עיצוב', d: 'צבע, מיקום והודעת פתיחה — מתוך הגדרות הערוץ.' },
        { t: 'בדיקה', d: 'נכנסים לאתר, שולחים הודעה, ובודקים שהיא מגיעה לרשימת השיחות.' },
      ],
      needs: ['מזהה אתר', 'דומיינים מורשים'],
      review: 'לא נדרש אישור ספק.',
    },
  };

  /* ============================================================
     תשתית שנדרשת בצד השרת — רשימה כנה
     ============================================================ */
  const INFRA = [
    { t: 'רישום אפליקציה אצל כל ספק', d: 'Meta / Google / Microsoft — App ID וסוד אפליקציה. הסוד לעולם לא בדפדפן.', must: true },
    { t: 'Redirect URI ייעודי', d: 'כתובת חזרה מאושרת לכל ספק, למשל /api/oauth/{channel}/callback.', must: true },
    { t: 'החלפת קוד בטוקן בשרת', d: 'ה-OAuth מסתיים בקוד; החלפתו בטוקן מחייבת את סוד האפליקציה ולכן חייבת לרוץ בשרת.', must: true },
    { t: 'אחסון טוקנים מוצפן + חידוש אוטומטי', d: 'שמירה מוצפנת פר-דייר, ריענון לפני פקיעה, והתראה כשנכשל.', must: true },
    { t: 'נקודת Webhook לכל ספק', d: 'קבלת הודעות נכנסות, אימות חתימה (X-Hub-Signature / HMAC) ותשובת אימות ראשונית.', must: true },
    { t: 'תור עיבוד וניסיונות חוזרים', d: 'ספקים שולחים כפילויות ומצפים ל-200 מהיר. נדרש תור, ניסיון חוזר ו-dead-letter.', must: true },
    { t: 'אחסון מדיה', d: 'קבצים מגיעים כקישור זמני — יש להוריד ולשמור אצלנו לפני שהקישור פג.', must: true },
    { t: 'מיפוי למודל האחיד', d: 'כל ספק ל-Unified Message Model, כולל מזהי שיחה יציבים וזיהוי הלקוח.', must: true },
    { t: 'שליחה יוצאת + מגבלות קצב', d: 'Rate limits שונים לכל ספק, חלון 24 שעות בוואטסאפ, ותבניות מאושרות.', must: true },
    { t: 'בידוד בין דיירים', d: 'כל שאילתה מסוננת לפי מזהה הדייר, כולל בלוגים ובקבצים.', must: true },
    { t: 'ניטור ובריאות חיבור', d: 'בדיקה תקופתית של טוקן ו-Webhook, וסימון "דורש חידוש" לפני שנשבר.', must: false },
    { t: 'מחיקה ופרטיות', d: 'מחיקת שיחות לפי בקשה, שמירת נתונים מוגבלת בזמן, ותיעוד מי ניגש למה.', must: false },
    { t: 'אישורי ספק', d: 'Meta: אימות עסקי ו-App Review. Google: אימות אפליקציה לסקופים רגישים. יש לתכנן זמן.', must: false },
  ];

  /* ============================================================
     מסך המדריך
     ============================================================ */
  function openGuide(key) {
    const g = GUIDES[key]; if (!g) return;
    const c = (O() ? O().connectors() : []).find(x => x.key === key) || { label: key, color: '#5B4CE6', icon: 'chat' };
    const done = doneOf(key);
    const total = g.steps.length, n = Object.keys(done).length;
    const old = document.getElementById('osGuide'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'osGuide';
    w.innerHTML = `<div class="cbc-box os-box" style="max-width:560px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic" style="background:${c.color}1f;color:${c.color}">${ic(c.icon)}</span>
        <div><b>איך מחברים ${esc(c.label)}</b><small class="os-sub">${esc(g.who)} · ${esc(g.time)}</small></div></div>
      <div class="os-body">
        <div class="os-prog"><div class="os-bar"><i style="width:${Math.round(n / total * 100)}%"></i></div>
          <span>${n}/${total} שלבים</span></div>

        <div class="os-sec">${ic('check')} <b>מה להכין מראש</b></div>
        <ul class="os-pre">${g.prereq.map(p => `<li>${ic('check')} ${esc(p)}</li>`).join('')}</ul>

        <div class="os-sec">${ic('layers')} <b>השלבים</b></div>
        <ol class="os-steps">${g.steps.map((s, i) => `<li class="${done[i] ? 'on' : ''}">
          <button class="os-ck" data-osck="${esc(key)}|${i}">${done[i] ? ic('check') : i + 1}</button>
          <div><b>${esc(s.t)}</b><small>${esc(s.d)}</small></div></li>`).join('')}</ol>

        ${g.direct === 'imap' ? `<div class="os-alt">${ic('bolt')}
          <div><b>מסלול מהיר לדוא״ל</b><small>חיבור תיבה עם סיסמת אפליקציה — בלי אישור ספק.</small></div>
          <button class="btn sm primary" data-osimap="${esc(key)}">הגדרת IMAP/SMTP</button></div>` : ''}

        <details class="os-tech"><summary>${ic('lock')} מה השרת יצטרך (למנהל CallBiz)</summary>
          <ul>${g.needs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <p>${ic('alert')} ${esc(g.review)}</p></details>
      </div>
      <div class="cbc-actions">
        <button class="btn ghost" data-osx>סגור</button>
        <button class="btn primary" data-osgo="${esc(key)}">${ic('check')} התחל חיבור</button>
      </div></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-osx]').addEventListener('click', () => w.remove());
    w.querySelectorAll('[data-osck]').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.osck.split('|'); const cur = doneOf(p[0])[p[1]];
      markStep(p[0], p[1], !cur); openGuide(key);
    }));
    const im = w.querySelector('[data-osimap]');
    if (im) im.addEventListener('click', () => { w.remove(); openImap(key); });
    w.querySelector('[data-osgo]').addEventListener('click', () => {
      w.remove();
      if (window.OMNIUI) OMNIUI.connect(key);
    });
  }

  /* ============================================================
     חיבור תיבת דואר — IMAP/SMTP
     ============================================================ */
  const IMAP_DEFAULTS = {
    gmail: { host: 'imap.gmail.com', port: 993, smtp: 'smtp.gmail.com', sport: 587 },
    outlook: { host: 'outlook.office365.com', port: 993, smtp: 'smtp.office365.com', sport: 587 },
  };
  function openImap(key) {
    const d = IMAP_DEFAULTS[key] || { host: '', port: 993, smtp: '', sport: 587 };
    const c = (O() ? O().connectors() : []).find(x => x.key === key) || { label: key, color: '#5B4CE6', icon: 'mail' };
    const old = document.getElementById('osImap'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'osImap';
    w.innerHTML = `<div class="cbc-box os-box" style="max-width:500px;text-align:start">
      <div class="cbc-head"><span class="cbc-ic" style="background:${c.color}1f;color:${c.color}">${ic('mail')}</span>
        <b>חיבור תיבת דואר · ${esc(c.label)}</b></div>
      <p class="os-l">מזינים את פרטי התיבה. הפרטים נשלחים לשרת ונשמרים מוצפנים — הם לא נשמרים בדפדפן.</p>
      <div class="os-grid2">
        <label class="os-f"><span>כתובת הדוא״ל</span><input class="cc-inp" id="osMail" placeholder="service@company.co.il"></label>
        <label class="os-f"><span>סיסמת אפליקציה</span><input class="cc-inp" type="password" id="osPass" placeholder="••••••••"></label>
        <label class="os-f"><span>שרת נכנס (IMAP)</span><input class="cc-inp" id="osHost" value="${esc(d.host)}"></label>
        <label class="os-f"><span>פורט</span><input class="cc-inp" type="number" id="osPort" value="${d.port}"></label>
        <label class="os-f"><span>שרת יוצא (SMTP)</span><input class="cc-inp" id="osSmtp" value="${esc(d.smtp)}"></label>
        <label class="os-f"><span>פורט</span><input class="cc-inp" type="number" id="osSport" value="${d.sport}"></label>
      </div>
      <label class="os-sw"><input type="checkbox" id="osSsl" checked><span>חיבור מוצפן (SSL/TLS)</span></label>
      <p class="os-warn">${ic('alert')} בגרסה הזו אין שרת — הפרטים נשמרים כטיוטה מקומית לצורך הדגמה,
        והסיסמה אינה נשמרת כלל. בהשקה השדות האלה נשלחים ל-<code>/api/channels/{tenant}/email</code>.</p>
      <div class="cbc-actions">
        <button class="btn ghost" data-osix>ביטול</button>
        <button class="btn primary" data-osisave="${esc(key)}">${ic('check')} שמור וחבר</button>
      </div></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-osix]').addEventListener('click', () => w.remove());
    w.querySelector('[data-osisave]').addEventListener('click', () => {
      const g = id => (w.querySelector('#' + id) || {}).value;
      const mail = g('osMail');
      if (!mail) { toast('נא להזין כתובת דוא״ל'); return; }
      /* TODO(server): POST /api/channels/{tenant}/email  — הסיסמה נשלחת פעם אחת ונשמרת מוצפנת */
      if (O()) {
        O().connect(key, mail);
        const s = O().state(); const n = s.conns[key];
        n.transport = { kind: 'imap', host: g('osHost'), port: +g('osPort'), smtp: g('osSmtp'), sport: +g('osSport'),
          ssl: !!(w.querySelector('#osSsl') || {}).checked, secretRef: 'srv:' + O().tenant() + ':' + key };
        try { const all = JSON.parse(localStorage.getItem('cb_omni')) || {}; all[O().tenant()] = s; localStorage.setItem('cb_omni', JSON.stringify(all)); } catch (e) {}
      }
      w.remove(); toast('התיבה חוברה · ' + mail);
      if (window.OMNIUI) OMNIUI.render();
    });
  }

  /* ============================================================
     מסך התשתית — לצד הטכני
     ============================================================ */
  function infraHTML() {
    const must = INFRA.filter(x => x.must), nice = INFRA.filter(x => !x.must);
    const row = x => `<div class="os-infra-i"><span class="os-i-d ${x.must ? 'must' : ''}"></span>
      <div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div></div>`;
    return `<section class="om-panel">
      <div class="om-p-h">${ic('lock')} <b>תשתית נדרשת בצד השרת</b>
        <small>מה שחייב להתקיים כדי שחיבור אמיתי יעבוד</small></div>
      <div class="os-infra">${must.map(row).join('')}</div>
      <div class="om-p-h sub">${ic('bolt')} <b>מומלץ אך לא חוסם</b></div>
      <div class="os-infra">${nice.map(row).join('')}</div>
      <p class="om-note">${ic('alert')} החלפת קוד ה-OAuth בטוקן מחייבת סוד אפליקציה ולכן אינה יכולה לרוץ בדפדפן.
        כל מה שאפשר להכין מראש — מדריכים, שדות, מיפוי ומודל — מוכן כאן.</p>
    </section>`;
  }

  CBX.register({
    key: 'omnisetup', label: 'מדריך הקמת ערוצים ותשתית', icon: 'docs',
    desc: 'מדריך מובנה שלב אחר שלב לכל ערוץ — מה להכין מראש, מה עושים אצל הספק ומה מזינים כאן, עם סימון התקדמות שנשמר. כולל חיבור תיבת דואר ב-IMAP/SMTP ורשימת התשתית שנדרשת בצד השרת.',
    files: ['js/ext/omni-setup.js', 'css/ext/omni-setup.css'],
    install() {
      /* כפתור "איך מחברים" בכל כרטיס ערוץ */
      if (window.OMNIUI) CBX.delegate('omnisetup', '[data-osguide]', el => openGuide(el.dataset.osguide));
      const paint = () => {
        document.querySelectorAll('.ou-card').forEach(card => {
          const btn = card.querySelector('[data-oucon], [data-oucfg]');
          const key = btn && (btn.dataset.oucon || btn.dataset.oucfg);
          if (!key || !GUIDES[key] || card.querySelector('[data-osguide]')) return;
          const acts = card.querySelector('.ou-c-acts'); if (!acts) return;
          const b = document.createElement('button');
          b.className = 'btn sm ghost os-guide-btn';
          b.setAttribute('data-osguide', key);
          b.innerHTML = ic('docs') + ' איך מחברים';
          acts.appendChild(b);
        });
      };
      /* צביעה דטרמיניסטית אחרי כל רינדור של מסך הניהול — משקיף
         על ה-DOM התברר כלא אמין כשהמסך נבנה מחדש במלואו. */
      if (typeof renderChatPlatform === 'function') CBX.wrap('omnisetup', 'renderChatPlatform', o => function () {
        const out = o.apply(this, arguments);
        try { paint(); } catch (e) {}
        return out;
      });
      if (window.OMNIUI) {
        const orig = OMNIUI.render;
        OMNIUI.render = function () { const r = orig.apply(this, arguments); try { paint(); } catch (e) {} return r; };
        CBX._remember('omnisetup', () => { OMNIUI.render = orig; });
      }
      paint();

      /* לשונית התשתית במסך המנהל — נדבקת אחרי כל מעבר ללשונית
         "ניהול חיבורים", כולל כשהמסך מרונדר מבפנים. */
      const addInfra = () => {
        const host = document.querySelector('#viewHost .om');
        if (!host || host.querySelector('.os-infra')) return;
        if (!document.querySelector('[data-omtab="conns"].on')) return;
        host.insertAdjacentHTML('beforeend', infraHTML());
      };
      CBX.delegate('omnisetup', '[data-omtab]', () => setTimeout(addInfra, 30));
      CBX.wrap('omnisetup', 'renderSettingsView', o => function () {
        const out = o.apply(this, arguments); setTimeout(addInfra, 30); return out;
      });
    },
  });

  window.OMNISETUP = { GUIDES, INFRA, open: openGuide, imap: openImap, infraHTML };
})();
