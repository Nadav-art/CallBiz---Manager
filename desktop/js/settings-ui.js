/* ============================================================
   CallBiz Desktop · מסך ההגדרות
   ------------------------------------------------------------
   ההבדל מסופטפון רגיל: שם מציגים שדות טכניים ומשאירים את הנציג
   לבד. כאן כל שדה מלווה בהסבר מה הוא עושה, יש בדיקת מוכנות
   שאומרת בדיוק מה חסר ואיך לתקן, ובדיקות חיות למיקרופון,
   לרמקול ולקישוריות — כדי שלא צריך לנחש.

   ההגדרות הטכניות מוסתרות כברירת מחדל. במצב "מנוהל" הנציג לא
   רואה אותן בכלל — פרטי החיבור מגיעים מהמנג׳ר.
   ============================================================ */
(function () {

  const T = [
    { k: 'conn',  label: 'חיבור',      icon: 'wifi'  },
    { k: 'audio', label: 'שמע',        icon: 'phone' },
    { k: 'dial',  label: 'חיוג וצלצול', icon: 'pad'   },
    { k: 'net',   label: 'רשת ואיכות',  icon: 'chart' },
    { k: 'me',    label: 'זהות והרשאות', icon: 'user' },
    { k: 'adv',   label: 'מתקדם',       icon: 'tools' },
  ];
  let tab = 'conn', micStop = null, devCache = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = k => (window.ic ? window.ic(k) : '');
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* ---------------- מעטפת ---------------- */
  function render() {
    stopMic();
    const st = SIPCFG.status();
    $('#stage').innerHTML = `
      <div class="set">
        ${head(st)}
        <div class="set-body">
          <nav class="set-tabs">${T.map(t => `<button class="st ${tab === t.k ? 'on' : ''}" data-t="${t.k}">
            ${ic(t.icon)}<span>${esc(t.label)}</span></button>`).join('')}</nav>
          <div class="set-pane" id="setPane"></div>
        </div>
      </div>`;
    $$('#stage [data-t]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; render(); }));
    bindHead();
    pane();
  }

  /* ---------------- כותרת עם מצב חיבור חי ---------------- */
  function head(st) {
    const c = SIPCFG.get();
    const cls = { registered: 'ok', connecting: 'mid', registering: 'mid', failed: 'bad', offline: 'off' }[st.state] || 'off';
    const live = st.state === 'registered';
    return `<header class="set-h">
      <div class="set-h-t"><b>${ic('gear')} הגדרות</b>
        <small>${c.mode === 'managed' ? 'החיבור מנוהל על ידי המערכת' : 'חיבור ידני למרכזייה'}</small></div>
      <div class="conn ${cls}">
        <i class="conn-d"></i>
        <div class="conn-t"><b>${esc(SIPCFG.label(st.state))}</b>
          <small>${esc(st.error || (live ? 'שלוחה ' + (c.user || '—') + ' · ' + (c.domain || '') : 'לא מחובר למרכזייה'))}</small></div>
        <button class="btn ${live ? 'ghost' : 'pri'}" id="cBtn">${live ? 'התנתק' : 'התחבר'}</button>
        <button class="btn ghost" id="pBtn">${ic('check')} בדיקת מוכנות</button>
      </div>
    </header>`;
  }
  function bindHead() {
    const b = $('#cBtn'); if (b) b.addEventListener('click', async () => {
      if (SIPCFG.connected()) { SIPCFG.disconnect(); return; }
      b.disabled = true; b.textContent = 'מתחבר…';
      await SIPCFG.connect();
      b.disabled = false;
    });
    const p = $('#pBtn'); if (p) p.addEventListener('click', preflight);
  }

  /* ---------------- לשוניות ---------------- */
  function pane() {
    const h = $('#setPane'); if (!h) return;
    if (tab === 'conn') return conn(h);
    if (tab === 'audio') return audio(h);
    if (tab === 'dial') return dial(h);
    if (tab === 'net') return net(h);
    if (tab === 'me') return me(h);
    if (tab === 'adv') return adv(h);
  }

  /* עזרי שדה — כל שדה עם הסבר, לא רק תווית */
  const field = (o) => `
    <label class="fld ${o.wide ? 'wide' : ''}">
      <span class="fld-l">${esc(o.label)}${o.req ? '<i class="req">חובה</i>' : ''}</span>
      <input class="in" id="${o.id}" type="${o.type || 'text'}" value="${esc(o.value == null ? '' : o.value)}"
        placeholder="${esc(o.ph || '')}" ${o.dir ? 'dir="' + o.dir + '"' : ''} ${o.ro ? 'readonly' : ''} ${o.attrs || ''}>
      ${o.hint ? `<small class="fld-h">${o.hint}</small>` : ''}
    </label>`;
  const sel = (o) => `
    <label class="fld ${o.wide ? 'wide' : ''}">
      <span class="fld-l">${esc(o.label)}</span>
      <select class="in" id="${o.id}">${o.opts.map(x =>
        `<option value="${esc(x.v)}" ${String(x.v) === String(o.value) ? 'selected' : ''}>${esc(x.t)}</option>`).join('')}</select>
      ${o.hint ? `<small class="fld-h">${o.hint}</small>` : ''}
    </label>`;
  const sw = (o) => `
    <label class="swx"><input type="checkbox" id="${o.id}" ${o.on ? 'checked' : ''}><i></i>
      <span><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span></label>`;

  /* בינדינג גנרי — כל שדה עם data-k נשמר לתוך ההגדרות */
  function bindFields(root) {
    $$((root || '#setPane') + ' [data-k]').forEach(el => {
      const k = el.dataset.k, num = el.dataset.num != null;
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        const v = el.type === 'checkbox' ? el.checked : (num ? Number(el.value) : el.value);
        SIPCFG.set(k, v);
        if (el.dataset.re) pane();
      });
    });
  }

  /* ============================================================
     1 · חיבור
     ============================================================ */
  function conn(h) {
    const c = SIPCFG.get();
    const req = PROV.requirement();
    const p = PROV.profile();
    /* מי רשאי להגדיר את המרכזייה: מנהל, או מי שמתקין ראשון על
       עמדה שעדיין אין בה פרופיל — אחרת אף אחד לא יוכל להתחיל. */
    const perms = (window.CRM && CRM.session() && CRM.session().perms) || {};
    const isAdmin = !!perms.admin || !PROV.hasProfile();

    /* מה שהנציג רואה: רק מה שהוא באמת צריך למלא */
    const agentCard = {
      nothing: `
        <div class="crd hero">
          <div class="hero-i ok">${ic('check')}</div>
          <b>אין מה להגדיר</b>
          <p>פרטי החיבור מגיעים מהמערכת לפי העובד המחובר. לחצו "התחבר" למעלה — או הפעילו
            חיבור אוטומטי בהפעלה, וזה יקרה לבד.</p>
          <div id="mgd" class="mgd"><div class="skel"></div></div>
        </div>`,
      ext: `
        <div class="crd hero">
          <div class="hero-i">${ic('phone')}</div>
          <b>הזינו את מספר השלוחה שלכם</b>
          <p>המרכזייה של ${esc(p.name || 'העסק')} כבר מוגדרת. כל מה שנשאר זה מי אתם.</p>
          <div class="one">
            <input class="in big" id="q_ext" dir="ltr" inputmode="numeric" placeholder="201"
              value="${esc(c.user || '')}" autocomplete="off">
            <button class="btn pri lg" id="q_go">התחבר</button>
          </div>
          <div class="steps" id="q_steps"></div>
        </div>`,
      'ext+pass': `
        <div class="crd hero">
          <div class="hero-i">${ic('phone')}</div>
          <b>חיבור למרכזייה</b>
          <p>המרכזייה של ${esc(p.name || 'העסק')} מוגדרת במערכת. הזינו את השלוחה והסיסמה שקיבלתם.</p>
          <div class="one two">
            <input class="in big" id="q_ext" dir="ltr" inputmode="numeric" placeholder="שלוחה"
              value="${esc(c.user || '')}" autocomplete="off">
            <input class="in big" id="q_pass" dir="ltr" type="password" placeholder="סיסמה"
              value="${esc(c.pass || '')}" autocomplete="off">
            <button class="btn pri lg" id="q_go">התחבר</button>
          </div>
          <div class="steps" id="q_steps"></div>
        </div>`,
      all: `
        <div class="crd hero">
          <div class="hero-i warn">${ic('alert')}</div>
          <b>המרכזייה עדיין לא מוגדרת</b>
          <p>הגדרה חד-פעמית של מנהל. אחרי שהיא נעשית — כל נציג יזין רק את מספר השלוחה שלו.</p>
          ${isAdmin ? '<button class="btn pri lg" id="q_setup">הגדרת המרכזייה</button>'
            : '<p class="note">פנו למנהל המערכת כדי שיגדיר את המרכזייה.</p>'}
        </div>`,
    }[req.need];

    h.innerHTML = agentCard + (isAdmin ? `
      <details class="crd fold" ${req.need === 'all' ? 'open' : ''} id="admFold">
        <summary><b>${ic('tools')} הגדרת המרכזייה של העסק</b>
          <span class="crd-x">חד-פעמי · למנהל בלבד</span></summary>

        <div class="grid">
          ${field({ id: 'p_name', label: 'שם המרכזייה', value: p.name, ph: 'המרכזייה של קולביז',
            hint: 'שם לתצוגה בלבד' })}
          ${field({ id: 'p_dom', label: 'כתובת המרכזייה (SIP)', value: p.domain, req: 1, dir: 'ltr',
            ph: 'pbx.callbiz.co.il',
            hint: 'רק הדומיין. בלי פורט, בלי נתיב, בלי https. את השאר המערכת מוצאת לבד.' })}
        </div>
        <div class="row2">
          <button class="btn" id="p_find">${ic('wifi')} אתר את החיבור</button>
          <span class="find-out" id="p_out">${p.wss
            ? `<b class="ok">נמצא ${esc(p.pbx || '')}</b> <code dir="ltr">${esc(p.wss)}</code>`
            : 'לוחצים, והמערכת סורקת את הכתובות המקובלות ומוצאת את המאזין הפעיל'}</span>
        </div>

        <div class="grid mt">
          ${sel({ id: 'p_pm', label: 'איך הנציגים מזדהים', value: p.passMode, opts: [
            { v: 'agent', t: 'כל נציג עם סיסמה משלו (מומלץ)' },
            { v: 'shared', t: 'סיסמה אחת לכל השלוחות' },
            { v: 'server', t: 'הסיסמה מגיעה מהשרת — הנציג לא רואה אותה' }],
            hint: 'ב"סיסמה משלו" הנציג מקליד שלוחה + סיסמה. בשתי האפשרויות האחרות — רק שלוחה.' })}
          ${p.passMode === 'shared' ? field({ id: 'p_sp', label: 'הסיסמה המשותפת', value: p.sharedPass,
            type: 'password', dir: 'ltr', hint: 'נשמרת בעמדה הזו. עדיף להשתמש בסיסמה לכל נציג.' }) : ''}
          ${field({ id: 'p_cid', label: 'מזהה מתקשר לכולם', value: p.callerId, dir: 'ltr', ph: '03-1234567',
            hint: 'המספר שיוצג אצל הלקוח. ריק — המרכזייה תחליט.' })}
          ${field({ id: 'p_pre', label: 'קידומת ליציאה החוצה', value: p.outPrefix, dir: 'ltr', ph: '9',
            hint: 'רק אם המרכזייה דורשת ספרה לפני מספר חיצוני. ברוב המרכזיות בישראל — ריק.' })}
        </div>
        <div class="row2 mt">
          <button class="btn pri" id="p_save">שמור והחל על כל הנציגים</button>
          ${p.setAt ? `<span class="crd-x">עודכן ${esc(new Date(p.setAt).toLocaleString('he-IL'))}</span>` : ''}
        </div>
      </details>` : '')

      + `<div class="crd">
        <div class="crd-h"><b>התנהגות בהפעלה</b></div>
        ${sw({ id: 'f_auto', label: 'להתחבר אוטומטית כשפותחים את המערכת',
          on: c.autoStart, hint: 'בלי זה תצטרכו ללחוץ "התחבר" בכל פעם' })}
      </div>`;

    map({ f_auto: 'autoStart' });
    if (req.need === 'nothing') loadManaged();

    /* חיבור מהיר */
    const go = $('#q_go');
    if (go) go.addEventListener('click', quickConnect);
    const ex = $('#q_ext');
    if (ex) ex.addEventListener('keydown', e => { if (e.key === 'Enter') quickConnect(); });
    const pw = $('#q_pass');
    if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') quickConnect(); });
    const su = $('#q_setup');
    if (su) su.addEventListener('click', () => { const f = $('#admFold'); if (f) { f.open = true; f.scrollIntoView({ behavior: 'smooth' }); } });

    /* פרופיל ארגוני */
    ['p_name:name', 'p_dom:domain', 'p_cid:callerId', 'p_pre:outPrefix', 'p_sp:sharedPass'].forEach(s => {
      const [id, k] = s.split(':'); const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => PROV.setProfile({ [k]: el.value }));
    });
    const pm = $('#p_pm'); if (pm) pm.addEventListener('change', () => { PROV.setProfile({ passMode: pm.value }); conn(h); });
    const find = $('#p_find'); if (find) find.addEventListener('click', findPbx);
    const sv = $('#p_save'); if (sv) sv.addEventListener('click', () => {
      const d = ($('#p_dom') || {}).value;
      if (!d) return window.UIX && UIX.toast('חסרה כתובת מרכזייה');
      PROV.setProfile({ domain: PROV.clean(d) });
      window.UIX && UIX.toast('הפרופיל נשמר · נציגים יזינו רק שלוחה');
      render();
    });
  }

  /* חיבור בלחיצה — מגלה, מזדהה, ומדווח כל שלב */
  async function quickConnect() {
    const ext = ($('#q_ext') || {}).value, pass = ($('#q_pass') || {}).value;
    const steps = $('#q_steps'), btn = $('#q_go');
    if (btn) { btn.disabled = true; btn.textContent = 'מתחבר…'; }
    if (steps) steps.innerHTML = '';
    const r = await PROV.autoConnect({ ext, pass }, s => {
      if (!steps) return;
      steps.insertAdjacentHTML('beforeend',
        `<div class="stp ${s.err ? 'bad' : s.ok ? 'ok' : ''}">${ic(s.err ? 'x' : s.ok ? 'check' : 'refresh')} ${esc(s.t)}</div>`);
    });
    if (btn) { btn.disabled = false; btn.textContent = 'התחבר'; }
    if (r.ok && window.UIX) UIX.toast('מחובר למרכזייה');
    if (!r.ok && steps) steps.insertAdjacentHTML('beforeend',
      `<div class="stp hint">נסו "בדיקת מוכנות" למעלה — היא תגיד בדיוק מה חסם</div>`);
  }

  /* איתור המרכזייה — סריקה חיה עם דיווח */
  async function findPbx() {
    const d = ($('#p_dom') || {}).value, out = $('#p_out');
    if (!d) { if (out) out.innerHTML = '<span class="bad">הזינו קודם כתובת</span>'; return; }
    let done = 0, total = 0;
    if (out) out.innerHTML = 'סורק…';
    const r = await PROV.discover(d, { fresh: true, onStep: s => {
      if (s.total) { total = s.total; return; }
      done++; if (out) out.innerHTML = `סורק ${done}/${total} כתובות…`;
    } });
    if (!out) return;
    if (r.ok) {
      PROV.setProfile({ domain: PROV.clean(d), wss: r.url, pbx: r.pbx });
      out.innerHTML = `<b class="ok">${ic('check')} נמצא ${esc(r.pbx)}</b> <code dir="ltr">${esc(r.url)}</code>`;
    } else {
      out.innerHTML = `<b class="bad">${ic('x')} ${esc(r.why)}</b>
        <span>בדקו שהמרכזייה חושפת WSS ושהתעודה תקפה. אפשר גם להזין כתובת מלאה ידנית בלשונית "מתקדם".</span>`;
    }
  }
  /* קישור שדות לפי מזהה → מפתח בהגדרות */
  function map(m) {
    Object.keys(m).forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => SIPCFG.set(m[id], el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value)));
    });
  }
  async function loadManaged() {
    const h = $('#mgd'); if (!h) return;
    h.innerHTML = '<div class="skel"></div>';
    let d = null;
    try { d = window.CRM && CRM.pbxCreds ? await CRM.pbxCreds() : null; } catch (e) {}
    if (!d) { h.innerHTML = `<div class="empty2">${ic('alert')} לא התקבלו פרטי חיבור.
      <span>ודאו שהנציג פעיל ומשויך לשלוחה במנג׳ר.</span></div>`; return; }
    h.innerHTML = [
      ['שרת', d.wss], ['דומיין', d.domain], ['שלוחה', d.user],
      ['מזהה מתקשר', d.callerId], ['סיסמה', d.pass ? '•••••••• (מנוהלת)' : '—'],
    ].map(r => `<div class="li"><span>${esc(r[0])}</span><b dir="ltr">${esc(r[1] || '—')}</b></div>`).join('');
  }

  /* ============================================================
     2 · שמע
     ============================================================ */
  async function audio(h) {
    const c = SIPCFG.get();
    h.innerHTML = `
      <div class="crd"><div class="crd-h"><b>מכשירים</b>
        <button class="btn xs ghost" id="devR">${ic('refresh')} רענן רשימה</button></div>
        <div class="grid" id="devs"><div class="skel"></div></div>
      </div>
      <div class="crd"><div class="crd-h"><b>בדיקה</b></div>
        <div class="test">
          <div class="test-b">
            <button class="btn" id="micT">${ic('phone')} בדיקת מיקרופון</button>
            <div class="meter"><i id="mtr"></i></div>
            <small id="micMsg">לחצו ודברו — הפס אמור לזוז</small>
          </div>
          <div class="test-b">
            <button class="btn" id="spkT">${ic('phone')} בדיקת רמקול</button>
            <small>אמור להישמע צליל חיוג קצר במכשיר שנבחר</small>
          </div>
        </div>
      </div>
      <div class="crd"><div class="crd-h"><b>עיבוד קול</b>
        <span class="crd-x">מופעל כברירת מחדל — כבו רק אם יש בעיה</span></div>
        ${sw({ id: 'f_aec', label: 'ביטול הד', on: c.aec, hint: 'מונע מהצד השני לשמוע את עצמו חוזר. הכרחי בדיבורית.' })}
        ${sw({ id: 'f_ns', label: 'הפחתת רעשי רקע', on: c.ns, hint: 'מסנן מזגן, מקלדת ורעש משרד' })}
        ${sw({ id: 'f_agc', label: 'איזון עוצמה אוטומטי', on: c.agc, hint: 'משווה את עוצמת הדיבור כשמתרחקים מהמיקרופון' })}
      </div>`;
    map({ f_aec: 'aec', f_ns: 'ns', f_agc: 'agc' });
    const r = $('#devR'); if (r) r.addEventListener('click', () => { devCache = null; audio(h); });
    $('#micT').addEventListener('click', toggleMic);
    $('#spkT').addEventListener('click', () => SIPCFG.spkTest());
    drawDevs();
  }
  async function drawDevs() {
    const c = SIPCFG.get();
    const d = devCache || (devCache = await SIPCFG.devices());
    const host = $('#devs'); if (!host) return;
    if (d.denied || (!d.in.length && !d.out.length)) {
      host.innerHTML = `<div class="empty2">${ic('alert')} אין גישה למכשירי שמע
        <span>לחצו "בדיקת מיקרופון" ואשרו את הבקשה, ואז רעננו את הרשימה.</span></div>`;
      return;
    }
    const nm = (x, i, k) => x.label || (k + ' ' + (i + 1));
    host.innerHTML =
      sel({ id: 'f_mic', label: 'מיקרופון', value: c.micId, hint: 'המכשיר שממנו תדברו',
        opts: [{ v: '', t: 'ברירת המחדל של המערכת' }].concat(d.in.map((x, i) => ({ v: x.deviceId, t: nm(x, i, 'מיקרופון') }))) }) +
      sel({ id: 'f_spk', label: 'רמקול / אוזניות', value: c.spkId, hint: 'שם תשמעו את הצד השני',
        opts: [{ v: '', t: 'ברירת המחדל של המערכת' }].concat(d.out.map((x, i) => ({ v: x.deviceId, t: nm(x, i, 'פלט') }))) }) +
      sel({ id: 'f_ring', label: 'צלצול נשמע דרך', value: c.ringId, hint: 'אפשר שהצלצול יישמע ברמקול המחשב גם כשהאוזניות עליכם',
        opts: [{ v: '', t: 'אותו מכשיר כמו השיחה' }].concat(d.out.map((x, i) => ({ v: x.deviceId, t: nm(x, i, 'פלט') }))) });
    map({ f_mic: 'micId', f_spk: 'spkId', f_ring: 'ringId' });
  }
  async function toggleMic() {
    const btn = $('#micT'), msg = $('#micMsg'), mtr = $('#mtr');
    if (micStop) { stopMic(); btn.innerHTML = ic('phone') + ' בדיקת מיקרופון'; return; }
    try {
      micStop = await SIPCFG.micTest(v => { if (mtr) mtr.style.width = v + '%'; }, 20000);
      btn.innerHTML = ic('x') + ' עצור בדיקה';
      msg.textContent = 'מדברים… הפס מראה את עוצמת הקליטה בפועל';
      devCache = null; drawDevs();      /* עכשיו יש שמות למכשירים */
    } catch (e) {
      msg.textContent = e.name === 'NotAllowedError' ? 'ההרשאה נדחתה — אשרו מיקרופון בסמל המנעול שבשורת הכתובת'
        : 'לא נמצא מיקרופון מחובר';
    }
  }
  function stopMic() { if (micStop) { try { micStop(); } catch (e) {} micStop = null; } const m = document.getElementById('mtr'); if (m) m.style.width = '0%'; }

  /* ============================================================
     3 · חיוג וצלצול
     ============================================================ */
  function dial(h) {
    const c = SIPCFG.get();
    h.innerHTML = `
      <div class="crd"><div class="crd-h"><b>צלצול</b></div>
        <div class="grid">
          ${sel({ id: 'f_rng', label: 'צליל צלצול', value: c.ring, opts: [
            { v: 'classic', t: 'קלאסי' }, { v: 'soft', t: 'עדין' }, { v: 'digital', t: 'דיגיטלי' }, { v: 'none', t: 'ללא צליל' }] })}
          ${field({ id: 'f_rvol', label: 'עוצמת צלצול', type: 'range', value: c.ringVol,
            attrs: 'min="0" max="100" step="5"', hint: 'לא משפיע על עוצמת השיחה עצמה' })}
          ${sel({ id: 'f_aa', label: 'מענה אוטומטי', value: c.autoAnswer, hint: 'לשימוש במוקד יוצא בלבד — שיחות נענות בלי לחיצה', opts: [
            { v: 0, t: 'כבוי — עונים ידנית' }, { v: 1, t: 'אחרי שנייה' }, { v: 3, t: 'אחרי 3 שניות' }, { v: 5, t: 'אחרי 5 שניות' }] })}
        </div>
        ${sw({ id: 'f_cw', label: 'שיחה ממתינה', on: c.callWaiting, hint: 'לקבל שיחה נוספת בזמן שיחה פעילה. כבוי — הצד השני ישמע תפוס.' })}
      </div>

      <div class="crd"><div class="crd-h"><b>הקשות בזמן שיחה (DTMF)</b></div>
        <div class="pick sm">
          ${[['rfc2833', 'RFC 2833 (מומלץ)', 'ההקשה נשלחת כאירוע נפרד בערוץ הקול. עובד עם כמעט כל מרכזייה.'],
             ['info', 'SIP INFO', 'ההקשה נשלחת כהודעת איתות. נדרש כשמרכזייה ותיקה לא קולטת RFC 2833.']]
            .map(o => `<label class="pk ${c.dtmfMode === o[0] ? 'on' : ''}">
              <input type="radio" name="dtmf" value="${o[0]}" ${c.dtmfMode === o[0] ? 'checked' : ''}>
              <b>${esc(o[1])}</b><small>${esc(o[2])}</small></label>`).join('')}
        </div>
        <p class="note">אם בתפריט קולי ההקשות לא נקלטות — זה השדה שצריך לשנות.</p>
      </div>

      <div class="crd"><div class="crd-h"><b>כללי חיוג</b>
        <button class="btn xs ghost" id="addRule">${ic('plus') || '+'} כלל חדש</button></div>
        <p class="note">מתקנים מספרים לפני החיוג — למשל להסיר קידומת בינלאומית או להוסיף 9 ליציאה החוצה.
          הכלל הראשון שמתאים הוא זה שפועל.</p>
        <div class="rules">${(c.rewrite || []).map((r, i) => `
          <div class="rule ${r.on ? '' : 'off'}" data-i="${i}">
            <label class="swx tiny"><input type="checkbox" data-ron="${i}" ${r.on ? 'checked' : ''}><i></i></label>
            <input class="in mono" dir="ltr" data-rm="${i}" value="${esc(r.match)}" placeholder="^\\+972(\\d+)$">
            <span class="arw">←</span>
            <input class="in mono" dir="ltr" data-rt="${i}" value="${esc(r.to)}" placeholder="0$1">
            <input class="in note-in" data-rn="${i}" value="${esc(r.note || '')}" placeholder="למה הכלל הזה">
            <button class="btn xs ghost" data-rd="${i}">${ic('x')}</button>
          </div>`).join('') || '<div class="empty2">אין כללים — המספר נשלח כמו שהוא</div>'}
        </div>
        <div class="tryit">
          <label class="fld"><span class="fld-l">בדקו מספר</span>
            <input class="in" id="tryN" dir="ltr" placeholder="+972501234567" value="+972501234567"></label>
          <div class="try-out" id="tryOut"></div>
        </div>
      </div>`;
    map({ f_rng: 'ring', f_rvol: 'ringVol', f_aa: 'autoAnswer', f_cw: 'callWaiting' });
    $$('#setPane input[name=dtmf]').forEach(r => r.addEventListener('change', () => { SIPCFG.set('dtmfMode', r.value); dial(h); }));
    /* כללי חיוג */
    const upd = (i, k, v) => { const c2 = SIPCFG.get(); c2.rewrite[i][k] = v; SIPCFG.save(); tryIt(); };
    $$('[data-ron]').forEach(e => e.addEventListener('change', () => { upd(+e.dataset.ron, 'on', e.checked); dial(h); }));
    $$('[data-rm]').forEach(e => e.addEventListener('input', () => upd(+e.dataset.rm, 'match', e.value)));
    $$('[data-rt]').forEach(e => e.addEventListener('input', () => upd(+e.dataset.rt, 'to', e.value)));
    $$('[data-rn]').forEach(e => e.addEventListener('input', () => upd(+e.dataset.rn, 'note', e.value)));
    $$('[data-rd]').forEach(e => e.addEventListener('click', () => { SIPCFG.get().rewrite.splice(+e.dataset.rd, 1); SIPCFG.save(); dial(h); }));
    const a = $('#addRule'); if (a) a.addEventListener('click', () => {
      SIPCFG.get().rewrite.push({ on: true, match: '', to: '', note: '' }); SIPCFG.save(); dial(h);
    });
    const t = $('#tryN'); if (t) { t.addEventListener('input', tryIt); tryIt(); }
  }
  function tryIt() {
    const el = $('#tryN'), out = $('#tryOut'); if (!el || !out) return;
    const r = SIPCFG.testRewrite(el.value);
    out.innerHTML = r.error ? `<span class="bad">${esc(r.error)}</span>`
      : `<b dir="ltr">${esc(r.out)}</b> <span>${r.rule < 0 ? 'לא הופעל אף כלל — נשלח כמו שהוא' : 'לפי כלל ' + (r.rule + 1) + (r.note ? ' · ' + esc(r.note) : '')}</span>`;
  }

  /* ============================================================
     4 · רשת ואיכות
     ============================================================ */
  function net(h) {
    const c = SIPCFG.get();
    h.innerHTML = `
      <div class="crd"><div class="crd-h"><b>איכות קול</b></div>
        <p class="note">המערכת מנסה מלמעלה למטה ובוחרת את הראשון שהמרכזייה מסכימה לו.
          גררו לפי סדר עדיפות, או כבו קודק שגורם בעיות.</p>
        <div class="codecs">${c.codecs.map((k, i) => `
          <div class="cdc ${k.on ? '' : 'off'}" data-c="${i}">
            <span class="cdc-n">${i + 1}</span>
            <div class="cdc-t"><b>${esc(k.label)}</b><small>${esc(k.note)}</small></div>
            <span class="chip ${k.band === 'רחב-פס' ? 'good' : ''}">${esc(k.band)}</span>
            <div class="cdc-a">
              <button class="btn xs ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="btn xs ghost" data-dn="${i}" ${i === c.codecs.length - 1 ? 'disabled' : ''}>▼</button>
              <label class="swx tiny"><input type="checkbox" data-con="${i}" ${k.on ? 'checked' : ''}><i></i></label>
            </div>
          </div>`).join('')}</div>
      </div>

      <div class="crd"><div class="crd-h"><b>מעבר רשתות</b>
        <span class="crd-x">נדרש כשעובדים מהבית או מרשת עם חומת אש</span></div>
        <div class="grid">
          ${field({ id: 'f_stun', label: 'שרת STUN', value: c.stun, dir: 'ltr', ph: 'stun:stun.l.google.com:19302',
            hint: 'מגלה את הכתובת החיצונית שלכם. ברירת המחדל מספיקה ברוב המקרים.' })}
          ${field({ id: 'f_turn', label: 'שרת TURN', value: c.turn, dir: 'ltr', ph: 'turn:turn.example.co.il:3478',
            hint: 'מעביר את הקול דרך שרת מתווך כשחיבור ישיר חסום. נדרש ברשתות ארגוניות נוקשות.' })}
          ${field({ id: 'f_tu', label: 'משתמש TURN', value: c.turnUser, dir: 'ltr' })}
          ${field({ id: 'f_tp', label: 'סיסמת TURN', value: c.turnPass, type: 'password', dir: 'ltr' })}
        </div>
      </div>

      <div class="crd"><div class="crd-h"><b>בחירת מסלול אוטומטית</b></div>
        ${sw({ id: 'f_qauto', label: 'להחליף מסלול לבד כשהאיכות יורדת',
          on: window.TEL ? TEL.auto() : true,
          hint: 'המערכת מודדת איבוד חבילות והשהיה בזמן אמת, ועוברת למסלול יציב יותר בלי לנתק' })}
        <div class="li"><span>מסלול נוכחי</span><b>${window.TEL ? esc(TEL.transportOf(TEL.transport()).label) : '—'}</b></div>
      </div>`;
    map({ f_stun: 'stun', f_turn: 'turn', f_tu: 'turnUser', f_tp: 'turnPass' });
    const q = $('#f_qauto'); if (q) q.addEventListener('change', () => window.TEL && TEL.auto(q.checked));
    const mv = (i, d2) => { const a = SIPCFG.get().codecs; if (i + d2 < 0 || i + d2 >= a.length) return;
      const t = a[i]; a[i] = a[i + d2]; a[i + d2] = t; SIPCFG.save(); net(h); };
    $$('[data-up]').forEach(b => b.addEventListener('click', () => mv(+b.dataset.up, -1)));
    $$('[data-dn]').forEach(b => b.addEventListener('click', () => mv(+b.dataset.dn, 1)));
    $$('[data-con]').forEach(b => b.addEventListener('change', () => {
      SIPCFG.get().codecs[+b.dataset.con].on = b.checked; SIPCFG.save(); net(h);
    }));
  }

  /* ============================================================
     5 · זהות והרשאות (קריאה בלבד — מקורן ב-CRM)
     ============================================================ */
  function me(h) {
    const s = (window.CRM && CRM.session()) || {}, p = s.perms || {}, e = s.employee || {};
    const LBL = { call: 'חיוג', transfer: 'העברה', conference: 'ועידה', record: 'הקלטה',
      viewCrm: 'צפייה ב-CRM', editCrm: 'עריכה ב-CRM', diagnostics: 'אבחון', analytics: 'ביצועים', admin: 'ניהול' };
    h.innerHTML = `
      <div class="crd"><div class="crd-h"><b>מי מחובר</b><span class="crd-x">מגיע מהמנג׳ר — לא ניתן לעריכה כאן</span></div>
        <div class="li"><span>עובד</span><b>${esc(e.name || '—')}</b></div>
        <div class="li"><span>תפקיד</span><b>${esc(e.role || '—')}</b></div>
        <div class="li"><span>שלוחה</span><b dir="ltr">${esc(e.ext || '—')}</b></div>
        <div class="li"><span>סטטוס</span><b class="${s.active ? 'ok' : 'bad'}">${s.active ? 'פעיל' : 'לא פעיל'}</b></div>
        <div class="li"><span>שיוך לפעילות</span><b>${esc((s.activities || []).join(' · ') || '—')}</b></div>
        <div class="li"><span>מקור הנתונים</span><b>${window.CRM ? (CRM.mode() === 'demo' ? 'הדגמה מקומית' : CRM.mode() === 'embedded' ? 'CallBiz Manager' : 'שרת') : '—'}</b></div>
      </div>
      <div class="crd"><div class="crd-h"><b>מה מותר לנציג</b></div>
        <div class="perms">${Object.keys(p).map(k => `<span class="pm ${p[k] ? 'on' : ''}">
          ${ic(p[k] ? 'check' : 'x')} ${esc(LBL[k] || k)}</span>`).join('') || '<span class="pm">—</span>'}</div>
        <p class="note">ההרשאות נקבעות במנג׳ר, במסך ההרשאות של העובד. כך אין שתי מערכות הרשאות שסותרות זו את זו —
          וכשעובד מסיים תפקיד, ביטול אחד במנג׳ר מנתק אותו גם כאן.</p>
      </div>`;
  }

  /* ============================================================
     6 · מתקדם
     ============================================================ */
  function adv(h) {
    const c = SIPCFG.get(), st = SIPCFG.status();
    h.innerHTML = `
      <div class="crd"><div class="crd-h"><b>פרמטרים טכניים</b>
        <span class="crd-x">שנו רק אם ספק המרכזייה ביקש</span></div>
        <div class="grid">
          ${field({ id: 'f_auth', label: 'שם משתמש לאימות', value: c.authUser, dir: 'ltr',
            hint: 'רק אם הוא שונה משם המשתמש. ברוב המרכזיות זהה — השאירו ריק.' })}
          ${field({ id: 'f_exp', label: 'תוקף רישום (שניות)', value: c.expires, type: 'number', dir: 'ltr',
            attrs: 'min="60" max="3600"', hint: 'כל כמה זמן המערכת מחדשת את הרישום. ברירת מחדל 600.' })}
          ${field({ id: 'f_ka', label: 'שמירת חיבור (שניות)', value: c.keepAlive, type: 'number', dir: 'ltr',
            attrs: 'min="10" max="120"', hint: 'פינג שמונע מהראוטר לסגור את החיבור. הקטינו אם השיחות נופלות אחרי דקות.' })}
        </div>
      </div>

      <div class="crd"><div class="crd-h"><b>יומן איתות</b>
        <span class="crd-x">${st.trace.length} הודעות</span>
        <button class="btn xs ghost" id="trC">נקה</button>
        <button class="btn xs ghost" id="trX">${ic('down') || ''} ייצוא</button></div>
        <p class="note">כשמשהו לא עובד — זה מה שספק המרכזייה יבקש לראות. כל הודעת SIP שנשלחה והתקבלה.</p>
        <div class="trace" id="trace">${traceRows(st.trace)}</div>
      </div>

      <div class="crd"><div class="crd-h"><b>נתונים במחשב הזה</b></div>
        <div class="row2">
          <button class="btn ghost" id="expS">ייצוא הגדרות</button>
          <button class="btn ghost" id="impS">ייבוא הגדרות</button>
          <button class="btn danger ghost" id="rstS">איפוס להגדרות ברירת מחדל</button>
        </div>
        <p class="note">הייצוא לא כולל סיסמאות. מתאים להתקנת אותה תצורה על עמדה נוספת.</p>
      </div>

      <div class="crd"><div class="crd-h"><b>גרסה</b></div>
        <div class="li"><span>גרסה מותקנת</span><b dir="ltr">${esc(window.APP_VERSION || '—')}</b></div>
        <div class="li"><span>מזהה עמדה</span><b dir="ltr" class="mono">${esc((localStorage.getItem('cbd_instance') || '—').slice(0, 18))}</b></div>
        <button class="btn ghost" id="updC">${ic('refresh')} בדוק עדכונים</button>
      </div>`;
    map({ f_auth: 'authUser', f_exp: 'expires', f_ka: 'keepAlive' });
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    on('trC', () => { SIPCFG.status().trace.length = 0; adv(h); });
    on('trX', exportTrace);
    on('expS', exportCfg);
    on('impS', importCfg);
    on('rstS', () => { if (confirm('לאפס את כל ההגדרות?')) { SIPCFG.reset(); render(); } });
    on('updC', () => window.UPDATER && UPDATER.check(true));
  }
  const traceRows = t => t.length ? t.slice(-60).reverse().map(x =>
    `<div class="tr ${x.dir}"><i>${x.dir === 'out' ? '↑' : '↓'}</i>
      <b dir="ltr">${esc(x.line)}</b>
      <span>${new Date(x.t).toLocaleTimeString('he-IL')}</span></div>`).join('')
    : '<div class="empty2">אין עדיין תעבורה — התחברו כדי לראות</div>';

  function dl(name, text, type) {
    const b = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function exportTrace() {
    const t = SIPCFG.status().trace;
    dl('callbiz-sip-trace.txt', t.map(x => (x.dir === 'out' ? '>>> ' : '<<< ') +
      new Date(x.t).toISOString() + '\n' + x.raw).join('\n\n'));
  }
  function exportCfg() {
    const c = Object.assign({}, SIPCFG.get()); delete c.pass; delete c.turnPass;
    dl('callbiz-desktop-settings.json', JSON.stringify(c, null, 2), 'application/json');
  }
  function importCfg() {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
    i.onchange = () => {
      const f = i.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { const o = JSON.parse(r.result); delete o.pass; SIPCFG.set(o); render();
          window.UIX && UIX.toast('ההגדרות יובאו'); }
        catch (e) { window.UIX && UIX.toast('הקובץ אינו תקין'); }
      };
      r.readAsText(f);
    };
    i.click();
  }

  /* ============================================================
     בדיקת מוכנות — התשובה ל"למה זה לא עובד"
     ============================================================ */
  async function preflight() {
    if (!window.UIX) return;
    UIX.modal('בדיקת מוכנות', '<div id="pfBody"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>');
    const rows = await SIPCFG.preflight();
    const b = document.getElementById('pfBody'); if (!b) return;
    const bad = rows.filter(r => !r.ok).length;
    b.innerHTML = `
      <div class="pf-sum ${bad ? 'bad' : 'ok'}">${ic(bad ? 'alert' : 'check')}
        <b>${bad ? bad + ' דברים חוסמים שיחות' : 'הכול תקין — אפשר לדבר'}</b></div>
      <div class="pf">${rows.map(r => `<div class="pf-r ${r.ok ? 'ok' : 'bad'}">
        <i>${ic(r.ok ? 'check' : 'x')}</i>
        <div><b>${esc(r.t)}</b>${r.ok ? '' : `<small>${esc(r.why)}</small><small class="fix">${esc(r.fix)}</small>`}</div>
      </div>`).join('')}</div>`;
  }

  /* עדכון חי של הכותרת בלי לצייר מחדש את כל המסך */
  if (window.SIPCFG) {
    SIPCFG.on('state', () => {
      if (!document.querySelector('.set')) return;
      const st = SIPCFG.status();
      const el = document.querySelector('.set-h');
      if (el) { el.outerHTML = head(st); bindHead(); }
    });
    SIPCFG.on('trace', () => {
      const t = document.getElementById('trace');
      if (t) t.innerHTML = traceRows(SIPCFG.status().trace);
    });
  }

  window.SETUI = { render, preflight, tab: k => { tab = k; render(); } };
})();
