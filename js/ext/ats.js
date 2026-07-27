/* ============================================================
   הרחבה: גיוס ומועמדים (ATS)  ·  key = 'ats'
   ------------------------------------------------------------
   משרות פתוחות, מאגר מועמדים, פייפליין ראיונות ותיאום ראיון
   מתוך היומן הקיים. מועמד שמתקבל נקלט ישירות לצוות — בלי
   להקליד מחדש את הפרטים.
   ============================================================ */
(function () {

  const STAGES = [
    { key: 'new', label: 'מועמדות חדשה' },
    { key: 'screen', label: 'סינון טלפוני' },
    { key: 'interview', label: 'ראיון' },
    { key: 'test', label: 'מבחן / התנסות' },
    { key: 'offer', label: 'הצעה' },
    { key: 'hired', label: 'התקבל' },
    { key: 'rejected', label: 'נדחה' },
  ];
  const SOURCES = ['אתר החברה', 'לינקדאין', 'המלצת עובד', 'לוח דרושים', 'פנייה יזומה'];

  function seedJobs() {
    const D = (typeof DEPARTMENTS !== 'undefined') ? DEPARTMENTS : ['תפעול'];
    const B = (typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES.filter(b => b.active !== false) : [];
    return [
      { id: 'J1', title: 'נציג/ת מוקד', dept: D[0], branch: (B[0] || {}).key, open: 2, on: true,
        req: 'ניסיון במוקד · עברית ברמת שפת אם · זמינות למשמרות', scope: 'משרה מלאה' },
      { id: 'J2', title: 'מטפל/ת קוסמטי/ת', dept: D[1] || D[0], branch: (B[1] || {}).key, open: 1, on: true,
        req: 'תעודת קוסמטיקאית · ניסיון בלייזר יתרון', scope: 'משרה חלקית' },
      { id: 'J3', title: 'מנהל/ת סניף', dept: D[0], branch: (B[2] || {}).key, open: 1, on: false,
        req: 'ניסיון ניהולי · אחריות על יעדים', scope: 'משרה מלאה' },
    ];
  }
  function seedCands() {
    return [
      { id: 'C1', name: 'נועה ברק', phone: '052-3334444', mail: 'noa@mail.com', job: 'J1', stage: 'interview',
        src: 'לינקדאין', at: '2024-05-18', rating: 4, notes: 'ניסיון 3 שנים במוקד רפואי. מרשימה בטלפון.',
        interview: { date: '2024-05-24', time: '11:00', with: 'מיכל רוזן' } },
      { id: 'C2', name: 'עידן שלו', phone: '054-7778888', mail: 'idan@mail.com', job: 'J1', stage: 'screen',
        src: 'אתר החברה', at: '2024-05-21', rating: 3, notes: 'ללא ניסיון ישיר, אבל רושם טוב.' },
      { id: 'C3', name: 'רותם כץ', phone: '053-1112222', mail: 'rotem@mail.com', job: 'J2', stage: 'offer',
        src: 'המלצת עובד', at: '2024-05-12', rating: 5, notes: 'קוסמטיקאית מוסמכת, 6 שנות ניסיון בלייזר.' },
      { id: 'C4', name: 'דור אביב', phone: '050-9990000', mail: 'dor@mail.com', job: 'J2', stage: 'new',
        src: 'לוח דרושים', at: '2024-05-23', rating: 0, notes: '' },
    ];
  }

  let JOBS = CBX.load('ats_jobs', null) || seedJobs();
  let CANDS = CBX.load('ats_cands', null) || seedCands();
  const saveJ = () => CBX.store('ats_jobs', JOBS);
  const saveC = () => CBX.store('ats_cands', CANDS);

  const job = id => JOBS.find(j => j.id === id) || null;
  const jobLabel = id => { const j = job(id); return j ? j.title : '—'; };
  const brLabel = k => { const b = (typeof cBranch === 'function' && k) ? cBranch(k) : null; return b ? (b.short || b.label) : '—'; };
  const inStage = s => CANDS.filter(c => c.stage === s);
  const active = () => CANDS.filter(c => c.stage !== 'hired' && c.stage !== 'rejected');

  /* ---------------- ממשק ---------------- */
  let atsTab = 'pipe', atsJob = 'all', atsOpen = null;

  function atsHTML() {
    const openJobs = JOBS.filter(j => j.on);
    return `<div class="bill-wrap">
      <div class="inv-kpis">
        <div class="inv-kpi"><b>${openJobs.length}</b><small>משרות פתוחות</small></div>
        <div class="inv-kpi"><b>${openJobs.reduce((a, j) => a + (+j.open || 0), 0)}</b><small>תקנים לאיוש</small></div>
        <div class="inv-kpi"><b>${active().length}</b><small>מועמדים בתהליך</small></div>
        <div class="inv-kpi"><b>${inStage('hired').length}</b><small>התקבלו</small></div>
      </div>
      <div class="inv-tabs">
        <button class="inv-tab ${atsTab === 'pipe' ? 'on' : ''}" data-atstab="pipe">${ic('layers')} פייפליין מועמדים</button>
        <button class="inv-tab ${atsTab === 'jobs' ? 'on' : ''}" data-atstab="jobs">${ic('org')} משרות</button>
        <button class="inv-tab ${atsTab === 'pool' ? 'on' : ''}" data-atstab="pool">${ic('clients')} מאגר מועמדים</button>
      </div>
      ${atsOpen ? candHTML() : atsTab === 'pipe' ? pipeHTML() : atsTab === 'jobs' ? jobsHTML() : poolHTML()}
    </div>`;
  }

  function pipeHTML() {
    const list = atsJob === 'all' ? CANDS : CANDS.filter(c => c.job === atsJob);
    const cols = STAGES.filter(s => s.key !== 'rejected');
    return `<div class="inv-bar">
        <select class="cc-inp sm" id="atsJobSel">
          <option value="all">כל המשרות</option>
          ${JOBS.map(j => `<option value="${j.id}" ${atsJob === j.id ? 'selected' : ''}>${esc(j.title)}</option>`).join('')}
        </select>
        <button class="btn sm primary" id="atsAddC">${ic('plus')} מועמד חדש</button>
      </div>
      <p class="inv-lead">גוררים מועמד קדימה בעזרת החצים. מועמד שמגיע ל"התקבל" נקלט ישירות לצוות.</p>
      <div class="ats-board">${cols.map(s => { const inC = list.filter(c => c.stage === s.key);
        return `<div class="ats-col">
          <div class="ats-col-h"><b>${s.label}</b><span>${inC.length}</span></div>
          <div class="ats-col-b">${inC.map(c => `<div class="ats-cand">
            <button class="ats-cand-n" data-atsopen="${c.id}"><b>${esc(c.name)}</b>
              <small>${esc(jobLabel(c.job))}</small></button>
            <div class="ats-cand-f">
              <span class="ats-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</span>
              <span class="ats-src">${esc(c.src)}</span>
            </div>
            <div class="ats-move">
              <button class="btn xs" data-atsmv="${c.id}|-1" title="אחורה">${ic('chevronR')}</button>
              <button class="btn xs" data-atsmv="${c.id}|1" title="קדימה">${ic('chevronL')}</button>
            </div>
          </div>`).join('') || '<p class="ats-empty">—</p>'}</div>
        </div>`; }).join('')}</div>
      ${inStage('rejected').length ? `<details class="ats-rej"><summary>${ic('close')} נדחו (${inStage('rejected').length})</summary>
        <div class="ats-rej-b">${inStage('rejected').map(c => `<span>${esc(c.name)} · ${esc(jobLabel(c.job))}
          <button class="btn xs" data-atsmv="${c.id}|-1">החזר לתהליך</button></span>`).join('')}</div></details>` : ''}`;
  }

  function jobsHTML() {
    return `<p class="inv-lead">משרה סגורה לא מופיעה בפייפליין ולא מקבלת מועמדים חדשים.</p>
      <div class="ats-jobs">${JOBS.map((j, i) => `<div class="ats-job ${j.on ? '' : 'off'}">
        <div class="ats-job-h"><b>${esc(j.title)}</b>
          <span class="fx-tag">${esc(j.dept)}</span><span class="fx-tag">${esc(brLabel(j.branch))}</span>
          <span class="fx-tag">${esc(j.scope)}</span>
          <button class="btn xs ${j.on ? 'primary' : ''}" data-atsjon="${i}">${j.on ? 'פתוחה' : 'סגורה'}</button></div>
        <div class="ats-job-b">
          <label class="inv-f"><span>תקנים לאיוש</span><input class="cc-inp sm" type="number" min="0" value="${+j.open || 0}" data-atsjn="${i}"></label>
          <label class="inv-f"><span>דרישות</span><input class="cc-inp sm" value="${esc(j.req)}" data-atsjr="${i}"></label>
        </div>
        <div class="ats-job-f">${CANDS.filter(c => c.job === j.id).length} מועמדים ·
          ${CANDS.filter(c => c.job === j.id && c.stage === 'hired').length} התקבלו</div>
      </div>`).join('')}</div>
      <div class="tk-kbadd">
        <input class="cc-inp sm" id="atsJT" placeholder="שם המשרה">
        <select class="cc-inp sm" id="atsJD">${(typeof DEPARTMENTS !== 'undefined' ? DEPARTMENTS : ['תפעול']).map(d => `<option>${esc(d)}</option>`).join('')}</select>
        <button class="btn sm primary" id="atsJAdd">${ic('plus')} משרה חדשה</button>
      </div>`;
  }

  function poolHTML() {
    return `<p class="inv-lead">כל מי שפנה אי פעם — גם מי שנדחה. שימושי כשנפתחת משרה דומה.</p>
      <div class="inv-table-wrap"><table class="inv-table">
        <thead><tr><th>מועמד</th><th>משרה</th><th>שלב</th><th>מקור</th><th>דירוג</th><th>הוגש</th><th></th></tr></thead>
        <tbody>${CANDS.map(c => `<tr>
          <td><b>${esc(c.name)}</b><br><small>${esc(c.phone)}</small></td>
          <td>${esc(jobLabel(c.job))}</td>
          <td>${esc((STAGES.find(s => s.key === c.stage) || {}).label)}</td>
          <td>${esc(c.src)}</td><td class="ats-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</td>
          <td><small>${esc(c.at)}</small></td>
          <td><button class="btn xs" data-atsopen="${c.id}">${ic('eye')}</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  let candExt = null;   /* גוף מורחב מהרחבת השדות, אם היא פעילה */
  function candHTML() {
    const c = CANDS.find(x => x.id === atsOpen); if (!c) return '<p class="fx-none">המועמד לא נמצא</p>';
    /* אם הרחבת השדות המלאים פעילה — היא מספקת את הגוף */
    const ev = { cand: c, handled: false, html: '', bind: null };
    CBX.emit('ats:card', ev);
    if (ev.handled) { candExt = ev;
      const slots0 = (typeof coordPool === 'function')
        ? coordPool().filter(s => !s.booked && !s.held && !(typeof coordIsPast === 'function' && coordIsPast(s))).slice(0, 8) : [];
      return `<div class="ats-one">
        <div class="rep-open-h"><button class="btn sm" id="atsBack">${ic('chevronR')} חזרה</button>
          <b>${esc(c.name)}</b><span class="muted">${esc(jobLabel(c.job))}</span></div>
        ${ev.html}
        <div class="ats-int">
          <div class="ats-int-h">${ic('calendar')} <b>תיאום ראיון</b>
            ${c.interview ? `<span class="fx-tag mine">${esc(c.interview.date)} · ${esc(c.interview.time)} · ${esc(c.interview.with)}</span>` : ''}</div>
          <p class="ats-int-p">המועדים שמוצגים הם זמנים שבאמת פנויים ביומן — בדיוק כמו בתיאום תור.</p>
          <div class="shop-slot-grid">${slots0.map(s => `<button class="shop-slot" data-atsslot="${s.date}|${s.h}">
            <b>${esc(s.date)}</b><small>${typeof fmtH === 'function' ? fmtH(s.h) : s.h}</small></button>`).join('')
            || '<p class="ats-empty">אין מועדים פנויים</p>'}</div>
        </div>
        <div class="ats-stagebar">
          <label class="inv-f"><span>שלב בתהליך</span><select class="cc-inp" id="acStage">
            ${STAGES.map(s => `<option value="${s.key}" ${c.stage === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
        </div>
        ${c.stage === 'offer' ? `<div class="ats-hire">
          <b>${ic('check')} המועמד בשלב הצעה</b>
          <small>קליטה תיצור כרטיס עובד מלא עם כל הפרטים שמולאו כאן — בלי הקלדה מחדש.</small>
          <button class="btn sm primary" id="acHire">${ic('user')} קלוט לצוות</button></div>` : ''}`;
    }
    candExt = null;
    const slots = (typeof coordPool === 'function')
      ? coordPool().filter(s => !s.booked && !s.held && !(typeof coordIsPast === 'function' && coordIsPast(s))).slice(0, 8) : [];
    return `<div class="ats-one">
      <div class="rep-open-h"><button class="btn sm" id="atsBack">${ic('chevronR')} חזרה</button>
        <b>${esc(c.name)}</b><span class="muted">${esc(jobLabel(c.job))}</span></div>
      <div class="tk-one-grid">
        <label class="inv-f"><span>משרה</span><select class="cc-inp" id="acJob">
          ${JOBS.map(j => `<option value="${j.id}" ${c.job === j.id ? 'selected' : ''}>${esc(j.title)}</option>`).join('')}</select></label>
        <label class="inv-f"><span>שלב</span><select class="cc-inp" id="acStage">
          ${STAGES.map(s => `<option value="${s.key}" ${c.stage === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
        <label class="inv-f"><span>מקור</span><select class="cc-inp" id="acSrc">
          ${SOURCES.map(s => `<option ${c.src === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <label class="inv-f"><span>דירוג</span><select class="cc-inp" id="acRate">
          ${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${c.rating === n ? 'selected' : ''}>${n ? '★'.repeat(n) : 'טרם דורג'}</option>`).join('')}</select></label>
        <label class="inv-f"><span>טלפון</span><input class="cc-inp" id="acPhone" value="${esc(c.phone)}"></label>
        <label class="inv-f"><span>דוא״ל</span><input class="cc-inp" id="acMail" value="${esc(c.mail)}"></label>
      </div>
      <label class="inv-f"><span>הערות מהראיון</span><textarea class="cc-inp" rows="3" id="acNotes">${esc(c.notes)}</textarea></label>
      <div class="ats-int">
        <div class="ats-int-h">${ic('calendar')} <b>תיאום ראיון</b>
          ${c.interview ? `<span class="fx-tag mine">${esc(c.interview.date)} · ${esc(c.interview.time)} · ${esc(c.interview.with)}</span>` : ''}</div>
        <p class="ats-int-p">המועדים שמוצגים הם זמנים שבאמת פנויים ביומן — בדיוק כמו בתיאום תור.</p>
        <div class="shop-slot-grid">${slots.map(s => `<button class="shop-slot" data-atsslot="${s.date}|${s.h}">
          <b>${esc(s.date)}</b><small>${typeof fmtH === 'function' ? fmtH(s.h) : s.h}</small></button>`).join('')
          || '<p class="ats-empty">אין מועדים פנויים</p>'}</div>
      </div>
      ${c.stage === 'offer' ? `<div class="ats-hire">
        <b>${ic('check')} המועמד בשלב הצעה</b>
        <small>קליטה תיצור כרטיס עובד מלא עם השם, הטלפון, הדוא״ל, המחלקה והסניף מהמשרה — בלי הקלדה מחדש.</small>
        <button class="btn sm primary" id="acHire">${ic('user')} קלוט לצוות</button></div>` : ''}`;
  }

  function atsBind(RR) {
    $$('[data-atstab]').forEach(b => b.addEventListener('click', () => { atsTab = b.dataset.atstab; atsOpen = null; RR(); }));
    $$('[data-atsopen]').forEach(b => b.addEventListener('click', () => { atsOpen = b.dataset.atsopen; RR(); }));
    const bk = $('#atsBack'); if (bk) bk.addEventListener('click', () => { atsOpen = null; RR(); });
    const js = $('#atsJobSel'); if (js) js.addEventListener('change', () => { atsJob = js.value; RR(); });
    $$('[data-atsmv]').forEach(b => b.addEventListener('click', () => {
      const [id, d] = b.dataset.atsmv.split('|');
      const c = CANDS.find(x => x.id === id); if (!c) return;
      const order = STAGES.map(s => s.key);
      let i = order.indexOf(c.stage) + (+d);
      i = Math.max(0, Math.min(order.length - 1, i));
      c.stage = order[i]; saveC(); RR();
      toast(c.name + ' → ' + (STAGES.find(s => s.key === c.stage) || {}).label); }));
    const ac = $('#atsAddC'); if (ac) ac.addEventListener('click', () => {
      CANDS.unshift({ id: 'C' + (CANDS.length + 1), name: 'מועמד חדש', phone: '', mail: '',
        job: (JOBS[0] || {}).id, stage: 'new', src: SOURCES[0],
        at: (typeof clockTodayISO === 'function') ? clockTodayISO() : '', rating: 0, notes: '' });
      saveC(); atsOpen = CANDS[0].id; RR(); });
    /* משרות */
    $$('[data-atsjon]').forEach(b => b.addEventListener('click', () => { const j = JOBS[+b.dataset.atsjon]; j.on = !j.on; saveJ(); RR(); }));
    $$('[data-atsjn]').forEach(i => i.addEventListener('change', () => { JOBS[+i.dataset.atsjn].open = +i.value || 0; saveJ(); RR(); }));
    $$('[data-atsjr]').forEach(i => i.addEventListener('change', () => { JOBS[+i.dataset.atsjr].req = i.value; saveJ(); }));
    const ja = $('#atsJAdd'); if (ja) ja.addEventListener('click', () => {
      const t = ($('#atsJT').value || '').trim(); if (!t) { toast('נא להזין שם משרה'); return; }
      JOBS.push({ id: 'J' + (JOBS.length + 1), title: t, dept: $('#atsJD').value, branch: '', open: 1, on: true, req: '', scope: 'משרה מלאה' });
      saveJ(); RR(); toast('המשרה נוספה ✓'); });
    /* כרטיס מועמד */
    const c = CANDS.find(x => x.id === atsOpen);
    if (c && candExt && candExt.bind) {
      candExt.bind(RR);
      const st = $('#acStage'); if (st) st.addEventListener('change', () => { c.stage = st.value; saveC(); RR(); });
      $$('[data-atsslot]').forEach(b => b.addEventListener('click', () => {
        const [date, h] = b.dataset.atsslot.split('|');
        c.interview = { date, time: (typeof fmtH === 'function') ? fmtH(+h) : h,
          with: (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : 'מראיין' };
        if (c.stage === 'new' || c.stage === 'screen') c.stage = 'interview';
        saveC(); RR(); toast('הראיון נקבע ל' + date + ' ✓'); }));
      const hr2 = $('#acHire'); if (hr2) hr2.addEventListener('click', () => doHire(c, RR));
      saveC();
    }
    else if (c) {
      const map = [['acJob', 'job'], ['acStage', 'stage'], ['acSrc', 'src'], ['acPhone', 'phone'], ['acMail', 'mail'], ['acNotes', 'notes']];
      map.forEach(([id, k]) => { const e = $('#' + id); if (e) e.addEventListener('change', () => { c[k] = e.value; saveC(); RR(); }); });
      const rt = $('#acRate'); if (rt) rt.addEventListener('change', () => { c.rating = +rt.value || 0; saveC(); RR(); });
      $$('[data-atsslot]').forEach(b => b.addEventListener('click', () => {
        const [date, h] = b.dataset.atsslot.split('|');
        c.interview = { date, time: (typeof fmtH === 'function') ? fmtH(+h) : h,
          with: (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : 'מראיין' };
        if (c.stage === 'new' || c.stage === 'screen') c.stage = 'interview';
        saveC(); RR(); toast('הראיון נקבע ל' + date + ' ✓'); }));
      const hr = $('#acHire'); if (hr) hr.addEventListener('click', () => doHire(c, RR));
    }
  }
  /* קליטה לצוות — מעבירה גם את השדות המורחבים לכרטיס העובד */
  function doHire(c, RR) {
      const j = job(c.job) || {};
        if (typeof STAFF !== 'undefined') {
          /* מזהי הצוות הם ראשי תיבות (yk, ml…) — שומרים על אותו פורמט
             במקום להמציא מספר שלא מתאים לשאר המערכת */
          const init = c.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toLowerCase() || 'nn';
          let id = init, n = 2;
          while (STAFF.some(s => String(s.id) === id)) { id = init + n; n++; }
          const x = c.x || {};
          const emp = { id, name: c.name, role: j.title || 'עובד',
            dept: x.dept || j.dept || (typeof DEPARTMENTS !== 'undefined' ? DEPARTMENTS[0] : ''),
            perm: 'נציג', phone: c.phone, mail: c.mail, branches: j.branch ? [j.branch] : [] };
          /* מה שמולא בגיוס עובר לתיק העובד — לא מקלידים פעמיים */
          emp.hx = { empNo: id, first: x.first || String(c.name).split(' ')[0],
            last: x.last || String(c.name).split(' ').slice(1).join(' '),
            status: 'עובד פעיל', dept: emp.dept, roleCo: j.title || '', phone: c.phone, mail: c.mail,
            area: x.lives || '', exp: x.jobExp || '', notes: x.expSum || '',
            came: x.origin || '', limits: x.limits || '', start: x.startEta || '' };
          STAFF.push(emp);
        }
        c.stage = 'hired'; saveC();
        if (j.open) { j.open = Math.max(0, j.open - 1); saveJ(); }
        CBX.emit('ats:hired', { cand: c, job: j });
        atsOpen = null; if (RR) RR();
        toast(c.name + ' נקלט/ה לצוות ✓ — כרטיס העובד נוצר');
  }

  /* ---------------- רישום ---------------- */
  CBX.register({
    key: 'ats', label: 'גיוס ומועמדים', icon: 'user',
    desc: 'משרות פתוחות, מאגר מועמדים, פייפליין ראיונות ותיאום ראיון מהיומן. מועמד שמתקבל נקלט ישירות לצוות.',
    files: ['js/ext/ats.js'],
    install() {
      let atsMode = false;
      if (typeof SET_GROUPS !== 'undefined') {
        /* נכנס לקבוצת "אנשים והרשאות" הקיימת — הגיוס שייך לשם */
        const g = SET_GROUPS.find(x => x.key === 'people');
        if (g) CBX.push('ats', g.items, [{ m: 'ats', label: 'גיוס ומועמדים', icon: 'user', desc: 'משרות · מועמדים · ראיונות' }]);
      }
      CBX.wrap('ats', 'applySetMode', o => function (m) { atsMode = m === 'ats'; return o.apply(this, arguments); });
      CBX.wrap('ats', 'currentSetModeKey', o => function () { return atsMode ? 'ats' : o.apply(this, arguments); });
      CBX.wrap('ats', 'renderSettingsView', o => function () {
        if (!atsMode) return o.apply(this, arguments);
        document.getElementById('viewHost').innerHTML =
          (typeof settingsHeader === 'function' ? settingsHeader() : '') + atsHTML();
        if (typeof bindSettingsHeader === 'function') bindSettingsHeader();
        atsBind(() => renderSettingsView());
      });
      if (typeof runGlobalSearchWide === 'function') CBX.wrap('ats', 'runGlobalSearchWide', o => function (q, res) {
        o.call(this, q, res);
        CANDS.forEach(c => { if ((c.name + ' ' + c.phone).toLowerCase().includes(q))
          res.push({ type: 'מועמד', label: c.name, goto: 'cand', entId: c.id,
            sub: jobLabel(c.job) + ' · ' + (STAGES.find(s => s.key === c.stage) || {}).label }); });
        JOBS.forEach(j => { if (j.title.toLowerCase().includes(q))
          res.push({ type: 'משרה', label: j.title, goto: 'job', sub: j.dept + ' · ' + (j.on ? 'פתוחה' : 'סגורה') }); });
      });
      if (typeof gotoEntity === 'function') CBX.wrap('ats', 'gotoEntity', o => function (where, id) {
        if (where === 'cand' || where === 'job') { navActive = 'settings';
          if (typeof applySetMode === 'function') applySetMode('ats');
          atsTab = where === 'job' ? 'jobs' : 'pipe'; atsOpen = where === 'cand' ? id : null;
          renderSettingsView(); return; }
        return o.call(this, where, id);
      });
      CBX._remember('ats', () => { atsMode = false; });
    },
  });

  window.ATS = { jobs: () => JOBS, cands: () => CANDS, stages: () => STAGES };
})();
