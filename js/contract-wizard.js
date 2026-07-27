/* ============================================================
   אשף חתימת חוזה — רב-שלבי (סיכום → תנאים → פרטי מנוי → תשלום → חתימה)
   שני מצבים: 'preview' (העסק, פתוח) · 'client' (הלקוח, נעול, ממלא אשראי+פרטים וחותם).
   פרטי האשראי אינם נשמרים — נוצר טוקן מאובטח לחיוב.
   ============================================================ */
const CONTRACT_TERM_SECTIONS = [
  { icon: 'phone', cat: 'שירות', title: '1. השירות הניתן', text:
    '1.1 החברה תספק ללקוח שירותי מענה טלפוני לעסקים/פרטי, שירותי טלמרקטינג, שירותי טלמיטינג, צ׳אט ומוקדי אינטרנט ו/או כל שירות אחר אשר יינתן על ידי החברה, כפי שנקבע בין הצדדים בהסכם השירות ובנספחיו (להלן: "השירות").\n' +
    '1.2 היקף השירות, סוג המענה, שעות וימי הפעילות ומספר הדקות/הפניות ייקבעו לפי החבילה הנבחרת המפורטת בהסכם. חריגה מהיקף הדקות/הפניות תחויב בתעריף הנקוב בהסכם.\n' +
    '1.3 החברה תפעל במיומנות ובמקצועיות סבירה למתן השירות, אך אינה מתחייבת לתוצאה עסקית מסוימת. השירות ניתן על בסיס "AS IS" בהתאם למגבלות טכנולוגיות סבירות.\n' +
    '1.4 הלקוח מתחייב למסור לחברה את כל המידע, ההנחיות והתסריטים הדרושים לאספקת השירות, ולעדכנם מעת לעת. החברה לא תישא באחריות לשירות שסופק על בסיס מידע שגוי או חלקי שמסר הלקוח.' },
  { icon: 'check', cat: 'תשלום', title: '2. תנאי תשלום', text:
    '2.1 הלקוח ישלם לחברה את התמורה הקבועה בהסכם, מדי חודש, מראש. המחירים אינם כוללים מע"מ אלא אם צוין אחרת, ויתווסף להם מע"מ כדין.\n' +
    '2.2 התשלום יתבצע באמצעות כרטיס אשראי או הוראת קבע. פרטי האשראי אינם נשמרים במערכת החברה — נוצר טוקן חיוב מאובטח (Tokenization) מטעם חברת הסליקה, המשמש לחיוב בלבד בהתאם להרשאה שנתן הלקוח.\n' +
    '2.3 איחור בתשלום מעל 14 יום ממועד הפירעון יזכה את החברה בריבית פיגורים כדין, ורשאית החברה להשעות את השירות עד להסדרת התשלום, מבלי לגרוע מכל סעד אחר.\n' +
    '2.4 חיובים בגין חריגות, שירותים נוספים והתאמות יתווספו לחשבונית החודשית. הלקוח יהיה רשאי להשיג על חיוב תוך 30 יום ממועד קבלת החשבונית.' },
  { icon: 'lock', cat: 'אבטחת מידע', title: '3. סודיות ואבטחת מידע', text:
    '3.1 כל צד מתחייב לשמור בסודיות מוחלטת על כל מידע סודי של הצד השני שהגיע לידיעתו עקב ההתקשרות, ולא לעשות בו כל שימוש שאינו לצורך קיום ההסכם.\n' +
    '3.2 החברה תעבד מידע אישי בהתאם לחוק הגנת הפרטיות, התשמ"א-1981 ותקנותיו (לרבות תקנות אבטחת מידע), ותנקוט באמצעים סבירים לאבטחת המידע מפני גישה, שימוש או חשיפה בלתי מורשים.\n' +
    '3.3 הלקוח מצהיר כי קיבל את הסכמת מושאי המידע הנדרשת ככל שנדרש, וכי מסירת המידע לחברה נעשית כדין. הלקוח ישפה את החברה בגין כל תביעה הנובעת מהפרת התחייבות זו.\n' +
    '3.4 החברה רשאית לעשות שימוש במידע סטטיסטי ואנונימי לצורכי שיפור השירות, ובלבד שאינו מאפשר זיהוי אישי.' },
  { icon: 'alert', cat: 'אחריות', title: '4. אחריות והגבלתה', text:
    '4.1 החברה תפעל במיומנות ובזהירות סבירה. מובהר כי אין החברה אחראית לנזקים עקיפים, תוצאתיים, מיוחדים או עונשיים, לרבות אובדן רווחים, אובדן הזדמנות עסקית או פגיעה במוניטין.\n' +
    '4.2 אחריות החברה, ככל שתחול, מוגבלת בכל מקרה לגובה התשלומים ששולמו בפועל על ידי הלקוח בשלושת החודשים שקדמו למועד קרות האירוע נשוא התביעה.\n' +
    '4.3 החברה לא תישא באחריות לתקלות הנובעות מכוח עליון, מתקלות רשת/חשמל/ספקי צד ג׳, או ממעשה/מחדל של הלקוח.\n' +
    '4.4 הלקוח מתחייב לשפות את החברה בגין כל נזק, הוצאה או תביעה שייגרמו לה עקב הפרת ההסכם על ידי הלקוח או עקב תוכן/הנחיות שמסר.' },
  { icon: 'sync', cat: 'שירות', title: '5. תקופת ההסכם, חידוש וסיום', text:
    '5.1 ההסכם ייכנס לתוקף במועד החתימה ויעמוד בתוקפו לתקופה הנקובה בהסכם. בתום התקופה יתחדש ההסכם אוטומטית לתקופות זהות, אלא אם הודיע צד אחד למשנהו על אי-חידוש 30 יום מראש ובכתב.\n' +
    '5.2 כל צד רשאי להביא את ההסכם לסיום בהודעה מוקדמת ובכתב של 30 יום. לקוח שיבטל טרם תום התקופה בגין נקודת יציאה שאינה במועד — יחויב ביתרת התקופה בהתאם לתנאים.\n' +
    '5.3 הפרה יסודית שלא תוקנה תוך 14 יום מקבלת הודעה בכתב, מזכה את הצד הנפגע בביטול מיידי של ההסכם, מבלי לגרוע מכל סעד אחר.\n' +
    '5.4 עם סיום ההסכם יחזיר כל צד לצד השני, או ישמיד, כל מידע סודי שברשותו, למעט מידע שחובה לשומרו על פי דין.' },
  { icon: 'docs', cat: 'כללי', title: '6. הוראות כלליות', text:
    '6.1 על הסכם זה יחול הדין הישראלי בלבד, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים במחוז תל אביב-יפו.\n' +
    '6.2 שינוי או ויתור על זכות לפי הסכם זה לא יהיו תקפים אלא אם נעשו בכתב ונחתמו על ידי שני הצדדים. ויתור על הפרה לא ייחשב כוויתור על הפרה אחרת.\n' +
    '6.3 הודעות לפי הסכם זה יישלחו לכתובות ולכתובות הדוא"ל המפורטות במסמך זה, וייחשבו כמתקבלות תוך 3 ימי עסקים ממשלוחן.\n' +
    '6.4 מקום שבו נמצא סעיף מסעיפי ההסכם בטל או בלתי אכיף, לא יהיה בכך כדי לפגוע בתוקף יתר הוראות ההסכם.\n' +
    '6.5 חתימת הלקוח על הסכם זה מהווה אישור כי קרא, הבין והסכים לכלל התנאים המפורטים לעיל ובנספחי ההסכם.' },
];
const CT_WIZ_STEPS = [
  { key: 'summary', label: 'סיכום העסקה', icon: 'check' },
  { key: 'terms', label: 'תנאים כלליים', icon: 'docs' },
  { key: 'details', label: 'פרטי מנוי', icon: 'user' },
  { key: 'payment', label: 'תשלום', icon: 'check' },
  { key: 'sign', label: 'אישור וחתימה', icon: 'lock' },
];
let ctWiz = null;

function openContractWizard(c, lead, mode) {
  if (!c) return;
  ctWiz = { c, lead, mode: mode || 'preview', step: 0, agreed: false, termFilter: 'all', payMode: 'card', token: null, signed: false,
    fields: { name: lead ? (lead.org || lead.name || '') : '', contact: lead ? (lead.name || '') : '', id: lead ? (lead.idnum || '') : '', phone: lead ? (lead.phone || '') : '', mail: lead ? (lead.mail || '') : '', card: '', exp: '', cvv: '', cardName: lead ? (lead.name || '') : '' } };
  let ov = document.getElementById('ctWizOv');
  if (!ov) { ov = document.createElement('div'); ov.id = 'ctWizOv'; ov.className = 'ctw-overlay'; document.body.appendChild(ov); }
  ctWizRender(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
}
function closeContractWizard() { const ov = document.getElementById('ctWizOv'); if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); } }
function ctwPrice(lead) { return (lead && lead.services && typeof svcTotals === 'function') ? (svcTotals(lead.services).price || 550) : 550; }

function ctWizRender(ov) {
  const W = ctWiz, c = W.c, lead = W.lead, client = W.mode === 'client';
  const stepKey = CT_WIZ_STEPS[W.step].key;
  ov.innerHTML =
    '<div class="ctw-window" role="dialog" aria-modal="true">' +
      '<header class="ctw-head">' +
        '<div class="ctw-brand">' + ic('docs') + ' <b>' + (client ? 'חתימה על הסכם' : 'הפקת הסכם — תצוגת עורך') + '</b>' +
          '<small>' + esc(c.name) + (lead ? ' · ' + esc(lead.name) : '') + '</small></div>' +
        '<div class="ctw-head-actions">' +
          (!client ? '<button class="btn sm" id="ctwAsClient">' + ic('eye') + ' צפה כפי שהלקוח רואה</button>' : '<span class="ctw-lockbadge">' + ic('lock') + ' תצוגת לקוח מאובטחת</span>') +
          '<button class="ctw-x" id="ctwClose">' + ic('close') + '</button></div>' +
      '</header>' +
      '<div class="ctw-steps">' +
        CT_WIZ_STEPS.map(function (s, i) { return '<div class="ctw-step ' + (i < W.step ? 'done' : '') + ' ' + (i === W.step ? 'active' : '') + '" data-ctwstep="' + i + '"><span class="ctw-step-ic">' + (i < W.step ? ic('check') : ic(s.icon)) + '</span><span class="ctw-step-lbl">' + s.label + '</span></div>'; }).join('') +
      '</div>' +
      '<div class="ctw-body"><aside class="ctw-side">' + ctwSummaryCard(c, lead, client) + '</aside>' +
        '<main class="ctw-main">' + ctwStepContent(stepKey) + '</main></div>' +
      '<footer class="ctw-foot">' +
        '<button class="btn ghost" id="ctwBack" ' + (W.step === 0 ? 'disabled' : '') + '>' + ic('chevronR') + ' חזור</button>' +
        (stepKey === 'terms' && client ? '<label class="ctw-agree"><input type="checkbox" id="ctwAgree" ' + (W.agreed ? 'checked' : '') + '> קראתי והבנתי את ההסכם</label>' : '<span></span>') +
        (W.step < CT_WIZ_STEPS.length - 1
          ? '<button class="btn primary" id="ctwNext">המשך לשלב הבא ' + ic('chevronL') + '</button>'
          : '<button class="btn primary" id="ctwFinish">' + (client ? ic('check') + ' חתום ושלח' : ic('mail') + ' שלח ללקוח לחתימה') + '</button>') +
      '</footer></div>';
  $('#ctwClose').addEventListener('click', closeContractWizard);
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeContractWizard(); });
  var asC = $('#ctwAsClient'); if (asC) asC.addEventListener('click', function () { W.mode = 'client'; W.step = 0; ctWizRender(ov); });
  $$('[data-ctwstep]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.ctwstep; if (i <= W.step) { W.step = i; ctWizRender(ov); } }); });
  var back = $('#ctwBack'); if (back) back.addEventListener('click', function () { if (W.step > 0) { ctwSyncFields(); W.step--; ctWizRender(ov); } });
  var ag = $('#ctwAgree'); if (ag) ag.addEventListener('change', function () { W.agreed = ag.checked; });
  var next = $('#ctwNext'); if (next) next.addEventListener('click', function () {
    // אישור "קראתי והבנתי" נדרש מהלקוח בלבד — למנהל/עורך אין צורך לאשר כדי להתקדם
    if (stepKey === 'terms' && client && !W.agreed) { toast('יש לאשר "קראתי והבנתי את ההסכם" כדי להמשיך'); return; }
    ctwSyncFields(); W.step++; ctWizRender(ov);
  });
  var fin = $('#ctwFinish'); if (fin) fin.addEventListener('click', function () {
    ctwSyncFields();
    if (client) {
      if (!W.signed) { toast('נא לחתום דיגיטלית לפני שליחה'); return; }
      toast('ההסכם נחתם ✓ · טוקן חיוב מאובטח נוצר · פרטי האשראי לא נשמרו'); closeContractWizard();
    } else { closeContractWizard(); if (typeof openContractSend === 'function') openContractSend(c, lead); }
  });
  ctwBindStep(stepKey, ov);
}
function ctwSummaryCard(c, lead, client) {
  var price = ctwPrice(lead);
  var svc = lead && lead.services && lead.services.length && typeof cTreat === 'function' ? lead.services.map(function (k) { return cTreat(k) ? cTreat(k).label : k; }).join(' · ') : (lead && lead.subject) || 'מענה אנושי';
  return '<div class="ctw-sum">' +
      '<div class="ctw-sum-head">' + ic('docs') + ' סיכום העסקה <span class="ctw-sum-badge">' + (client ? 'לחתימה' : 'טיוטה') + '</span></div>' +
      '<div class="ctw-sum-prod"><div class="ctw-sum-price"><b>' + price + '₪</b><small>לחודש · כולל מע״מ</small></div><div class="ctw-sum-pname">' + esc(svc) + '</div></div>' +
      '<div class="ctw-sum-rows">' +
        '<div class="ctw-sum-row"><span>' + ic('org') + ' שם החברה</span><b>' + (lead ? esc(lead.org || lead.name) : 'סיגלוב ניקטור') + '</b></div>' +
        '<div class="ctw-sum-row"><span>' + ic('user') + ' איש קשר</span><b>' + (lead ? esc(lead.name) : '—') + '</b></div>' +
        '<div class="ctw-sum-row"><span>' + ic('clock') + ' שעות שירות</span><b>א׳–ה׳ 08:00–17:00</b></div>' +
        '<div class="ctw-sum-row"><span>' + ic('calendar') + ' תוקף</span><b>' + (typeof COORD_TODAY !== 'undefined' ? COORD_TODAY : '') + ' +12ח׳</b></div>' +
        '<div class="ctw-sum-row"><span>' + ic('flag') + ' מס׳ הסכם</span><b>' + (11400 + (CONTRACT_TEMPLATES.length * 7) % 99) + '</b></div>' +
      '</div>' +
      (!client ? '<div class="ctw-sum-actions"><div class="ctw-sum-actions-t">' + ic('bolt') + ' פעולות מהירות למסמך</div><div class="ctw-sum-btns"><button class="ctw-sa" id="ctwAddClause">' + ic('plus') + ' סעיף</button><button class="ctw-sa" id="ctwAddAppendix">' + ic('docs') + ' נספח</button><button class="ctw-sa" id="ctwAddNote">' + ic('note') + ' הערה</button></div></div>' : '') +
    '</div>';
}
function ctwStepContent(k) {
  var W = ctWiz, c = W.c, lead = W.lead, F = W.fields, client = W.mode === 'client';
  if (k === 'details') {
    var cc = $('#ctwCorp'); if (cc) cc.addEventListener('change', function () { ctwSyncFields(); ctWiz.isCorp = cc.checked; ctWizRender(ov); });
    var st = $('#ctwStamp'); if (st) st.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { ctwSyncFields(); ctWiz.clientStamp = rd.result; ctWizRender(ov); toast('החותמת התקבלה ✓'); }; rd.readAsDataURL(f);
    });
    var sdl = $('#ctwStampDel'); if (sdl) sdl.addEventListener('click', function () { ctwSyncFields(); ctWiz.clientStamp = null; ctWizRender(ov); });
  }
  if (k === 'summary') {
    const auto = (typeof ctCollectedTerms === 'function') ? ctCollectedTerms(lead) : [];
    const extra = (typeof CONTRACT_EXTRA_CLAUSES !== 'undefined') ? CONTRACT_EXTRA_CLAUSES : [];
    const svcRows = (lead && lead.services && lead.services.length && typeof cTreat === 'function') ? lead.services.map(function (kk) { const t = cTreat(kk) || {}; return { label: t.label || kk, dur: t.dur || 0, price: t.price || 0, dep: t.deposit || 0 }; }) : [];
    return '<div class="ctw-doc-view"><h2 class="ctw-title">סיכום העסקה</h2><p class="ctw-sub">נא לעבור על כל הפרטים ולאשר את נכונותם.</p>' +
      (svcRows.length ? '<div class="ctw-pkg"><div class="ctw-pkg-h">' + ic('tasks') + ' מה כוללת החבילה</div>' +
        svcRows.map(function (s) { return '<div class="ctw-pkg-row"><span class="ctw-pkg-n">' + esc(s.label) + '</span><span class="ctw-pkg-d">' + s.dur + ' דק׳</span><span class="ctw-pkg-p">' + (s.price ? s.price + ' ₪' : 'ללא עלות') + '</span>' + (s.dep ? '<span class="ctw-pkg-dep">מקדמה ' + s.dep + '₪</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
      ((auto.length || extra.length) ? '<div class="ctw-terms-box"><div class="ctw-terms-h">' + ic('alert') + ' תנאים והערות' + (client ? '' : ' <button class="ctw-terms-edit" id="ctwEditClauses">' + ic('settings') + ' נהל סעיפים</button>') + '</div>' +
        auto.map(function (t2) { return '<div class="ctw-term-row"><span class="ctw-term-src">' + esc(t2.title) +
          (client ? '' : ' <small class="ctw-term-int" title="כותרת פנימית — לא מוצגת ללקוח">' + ic('lock') + ' ' + esc(t2.src) + '</small>') + '</span><span>' + esc(t2.text) + '</span></div>'; }).join('') +
        extra.map(function (t2) { return '<div class="ctw-term-row added"><span class="ctw-term-src">' + esc(t2.title) + '</span><span>' + esc(t2.text) + '</span></div>'; }).join('') + '</div>'
        : (!client ? '<button class="btn sm" id="ctwEditClauses" style="margin-bottom:14px">' + ic('plus') + ' הוסף סעיפים ותנאים</button>' : '')) +
      '<pre class="ctw-agreement">' + esc(contractMerge(c.text, lead)) + '</pre>' +
      (ctWiz.clientStamp ? '<div class="ctv-stamp"><img src="' + ctWiz.clientStamp + '" alt="חותמת"><small>חותמת החברה של הלקוח</small></div>'
        : (c.stamp ? '<div class="ctv-stamp"><img src="' + c.stamp + '" alt="חותמת"><small>חותמת החברה</small></div>' : '')) + '</div>';
  }
  if (k === 'terms') {
    var cats = ['all'].concat(CONTRACT_TERM_SECTIONS.map(function (s) { return s.cat; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    var list = CONTRACT_TERM_SECTIONS.filter(function (s) { return W.termFilter === 'all' || s.cat === W.termFilter; });
    return '<div class="ctw-terms"><div class="ctw-terms-top"><h2 class="ctw-title">תנאים כלליים להתקשרות</h2><div class="ctw-term-filters">' +
      cats.map(function (cat) { return '<button class="ctw-tf ' + (W.termFilter === cat ? 'on' : '') + '" data-ctwtf="' + cat + '">' + (cat === 'all' ? 'הכל' : cat) + '</button>'; }).join('') + '</div></div>' +
      '<div class="ctw-acc">' + list.map(function (s, i) { return '<details class="ctw-acc-item" ' + (i === 0 ? 'open' : '') + '><summary><span class="ctw-acc-n">' + (CONTRACT_TERM_SECTIONS.indexOf(s) + 1) + '</span><span class="ctw-acc-ic">' + ic(s.icon) + '</span><b>' + s.title + '</b><span class="ctw-acc-ok">' + ic('check') + '</span><span class="ctw-acc-chev">' + ic('chevron') + '</span></summary><div class="ctw-acc-body">' + esc(s.text) + '</div></details>'; }).join('') + '</div>' +
      '<div class="ctw-secure-note">' + ic('lock') + ' פרטי האשראי אינם נשמרים במערכת — נוצר טוקן מאובטח לחיוב.</div></div>';
  }
  if (k === 'details') return '<div class="ctw-form"><h2 class="ctw-title">פרטי מנוי</h2><p class="ctw-sub">' + (client ? 'נא למלא ולאמת את הפרטים.' : 'הפרטים מוזגו אוטומטית מהליד.') + '</p><div class="ctw-fgrid">' +
      '<div class="ctw-fcol"><h4>פרטי חברה</h4><label>שם חברה / לקוח<input class="cc-inp" data-ctwf="name" value="' + esc(F.name) + '" ' + (client ? '' : 'readonly') + '></label><label>ח.פ / ע.מ<input class="cc-inp" data-ctwf="id" value="' + esc(F.id) + '" ' + (client ? '' : 'readonly') + '></label><label>טלפון<input class="cc-inp" data-ctwf="phone" value="' + esc(F.phone) + '" ' + (client ? '' : 'readonly') + '></label></div>' +
      '<div class="ctw-fcol"><h4>פרטי מזמין</h4><label>שם איש קשר *<input class="cc-inp" data-ctwf="contact" value="' + esc(F.contact) + '"></label><label>דוא״ל *<input class="cc-inp" data-ctwf="mail" value="' + esc(F.mail) + '"></label></div></div>' +
      ctwCorpHTML(client) + '</div>';
  if (k === 'payment') return '<div class="ctw-form"><h2 class="ctw-title">תנאי תשלום</h2><p class="ctw-sub">באפשרותך לשלם בכרטיס אשראי או בהוראת קבע.</p>' +
      '<div class="ctw-paytabs"><button class="ctw-paytab ' + (W.payMode === 'card' ? 'on' : '') + '" data-ctwpay="card">כרטיס אשראי</button><button class="ctw-paytab ' + (W.payMode === 'debit' ? 'on' : '') + '" data-ctwpay="debit">הוראת קבע</button></div>' +
      (W.payMode === 'card' ? '<div class="ctw-card-form"><div class="ctw-cardvisual">' + ic('org') + ' <span>CallBiz</span><div class="ctw-cardnum">' + (F.card ? '•••• •••• •••• ' + F.card.replace(/\D/g, '').slice(-4) : '•••• •••• •••• ••••') + '</div></div>' +
        '<label>שם בעל הכרטיס<input class="cc-inp" data-ctwf="cardName" value="' + esc(F.cardName) + '"></label>' +
        '<label>מספר כרטיס<input class="cc-inp" data-ctwf="card" value="' + esc(F.card) + '" placeholder="0000 0000 0000 0000" ' + (client ? '' : 'disabled') + '></label>' +
        '<div class="ctw-card-row"><label>תוקף<input class="cc-inp" data-ctwf="exp" value="' + esc(F.exp) + '" placeholder="MM/YY" ' + (client ? '' : 'disabled') + '></label><label>CVV<input class="cc-inp" data-ctwf="cvv" value="' + esc(F.cvv) + '" placeholder="•••" ' + (client ? '' : 'disabled') + '></label></div>' +
        '<div class="ctw-secure-note ' + (W.token ? 'ok' : '') + '">' + ic('lock') + ' ' + (W.token ? 'נוצר טוקן מאובטח: ' + W.token + ' · הכרטיס לא נשמר' : 'פרטי האשראי אינם נשמרים — יופק טוקן מאובטח לחיוב בעת האישור.') + '</div>' +
        (client ? '<button class="btn sm" id="ctwGenToken">' + ic('lock') + ' הפק טוקן חיוב מאובטח</button>' : '<p class="ctw-note-dim">בתצוגת לקוח הלקוח ימלא את פרטי האשראי; הם לא ייחשפו ולא יישמרו.</p>') +
      '</div>' : '<div class="ctw-card-form"><label>מספר בנק<input class="cc-inp" placeholder="___"></label><label>מספר סניף<input class="cc-inp" placeholder="___"></label><label>מספר חשבון<input class="cc-inp" placeholder="______"></label><div class="ctw-secure-note">' + ic('lock') + ' הרשאה לחיוב חשבון תופק דיגיטלית בעת החתימה.</div></div>') +
    '</div>';
  if (k === 'sign') return '<div class="ctw-form"><h2 class="ctw-title">אישור וחתימה</h2><p class="ctw-sub">' + (client ? 'חתום דיגיטלית לאישור ההסכם.' : 'כאן הלקוח יחתום. שלח את ההסכם לקבלת חתימה.') + '</p>' +
      '<div class="ctw-signbox"><label>חתימה דיגיטלית מאושרת לפי חוק:</label><canvas class="ctv-canvas ctw-canvas" width="500" height="140"></canvas><div class="ctv-sign-actions"><button class="btn xs" id="ctwSigClear">' + ic('close') + ' נקה</button><span class="ctv-legal">' + ic('lock') + ' קבילה משפטית · חוק חתימה אלקטרונית</span></div></div>' +
      '<label class="ctw-agree big"><input type="checkbox" id="ctwFinalAgree" ' + (W.agreed ? 'checked' : '') + '> אני מאשר/ת שקראתי, הבנתי ואני מסכים/ה לכלל תנאי ההסכם</label></div>';
  return '';
}
/* חברה בע"מ — הלקוח מסמן, ואז מתבקשת חותמת. לא המנהל מעלה אותה. */
function ctwCorpHTML(client) {
  var W = ctWiz, c = (W && W.c) || {};
  if (!c.reqStamp) return '';
  if (!client) return '<div class="ctw-corp dim">' + ic('org') + ' <b>חותמת חברה</b>' +
    '<small>אם הלקוח יסמן בטופס שהוא חברה בע״מ — הוא יתבקש להעלות את חותמת החברה שלו כאן. אין צורך להעלות אותה מראש.</small></div>';
  return '<div class="ctw-corp">' +
    '<label class="ctw-corp-chk"><input type="checkbox" id="ctwCorp" ' + (W.isCorp ? 'checked' : '') + '> ' +
      '<span><b>אני חותם/ת בשם חברה בע״מ</b><small>אם כן — נדרשת חותמת החברה על ההסכם.</small></span></label>' +
    (W.isCorp ? '<div class="ctw-corp-body">' +
      '<label>ח.פ החברה *<input class="cc-inp" data-ctwf="corpId" value="' + esc(W.fields.corpId || '') + '" placeholder="514XXXXXX"></label>' +
      '<div class="ctw-stamp-row">' +
        '<div class="ctw-stamp-prev ' + (W.clientStamp ? 'has' : '') + '">' + (W.clientStamp ? '<img src="' + W.clientStamp + '" alt="חותמת">' : ic('org')) + '</div>' +
        '<label class="btn sm">' + ic('plus') + ' ' + (W.clientStamp ? 'החלף חותמת' : 'העלה את חותמת החברה') +
          '<input type="file" id="ctwStamp" accept="image/*" hidden></label>' +
        (W.clientStamp ? '<button class="btn sm" id="ctwStampDel">' + ic('close') + ' הסר</button>' : '') +
      '</div>' +
      '<p class="ctw-note-dim">' + ic('lock') + ' החותמת תוצמד לתחתית ההסכם לצד החתימה.</p>' +
    '</div>' : '') + '</div>';
}
function ctwSyncFields() { $$('[data-ctwf]').forEach(function (inp) { ctWiz.fields[inp.dataset.ctwf] = inp.value; }); }
function ctwBindStep(k, ov) {
  var W = ctWiz;
  if (k === 'terms') $$('[data-ctwtf]').forEach(function (b) { b.addEventListener('click', function () { ctWiz.termFilter = b.dataset.ctwtf; ctWizRender(ov); }); });
  if (k === 'payment') {
    $$('[data-ctwpay]').forEach(function (b) { b.addEventListener('click', function () { ctwSyncFields(); ctWiz.payMode = b.dataset.ctwpay; ctWizRender(ov); }); });
    var gt = $('#ctwGenToken'); if (gt) gt.addEventListener('click', function () {
      ctwSyncFields(); var card = (ctWiz.fields.card || '').replace(/\D/g, '');
      if (card.length < 8) { toast('נא להזין מספר כרטיס תקין'); return; }
      ctWiz.token = 'tok_' + card.slice(-4) + '_' + (card.length * 137 % 9000 + 1000);
      ctWiz.fields.card = ''; ctWiz.fields.cvv = '';
      ctWizRender(ov); toast('טוקן חיוב מאובטח הופק ✓ · פרטי הכרטיס לא נשמרו');
    });
  }
  if (k === 'sign') {
    if (typeof ctInitSignature === 'function') ctInitSignature(ov);
    var cv = ov.querySelector('.ctw-canvas');
    if (cv) { cv.addEventListener('mouseup', function () { ctWiz.signed = true; }); cv.addEventListener('touchend', function () { ctWiz.signed = true; }); }
    var fa = $('#ctwFinalAgree'); if (fa) fa.addEventListener('change', function () { ctWiz.agreed = fa.checked; });
  }
  if (k === 'details') {
    var cc = $('#ctwCorp'); if (cc) cc.addEventListener('change', function () { ctwSyncFields(); ctWiz.isCorp = cc.checked; ctWizRender(ov); });
    var st = $('#ctwStamp'); if (st) st.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { ctwSyncFields(); ctWiz.clientStamp = rd.result; ctWizRender(ov); toast('החותמת התקבלה ✓'); }; rd.readAsDataURL(f);
    });
    var sdl = $('#ctwStampDel'); if (sdl) sdl.addEventListener('click', function () { ctwSyncFields(); ctWiz.clientStamp = null; ctWizRender(ov); });
  }
  if (k === 'summary') {
    const openCl = function () { if (typeof openClausesPanel === 'function') openClausesPanel(W.lead, function () { ctWizRender(ov); }); };
    ['ctwAddClause', 'ctwAddNote', 'ctwEditClauses'].forEach(function (id) { var b = $('#' + id); if (b) b.addEventListener('click', openCl); });
    var ap = $('#ctwAddAppendix'); if (ap) ap.addEventListener('click', function () { toast('צירוף נספח — דרך טאב "מסמכים" בליד'); });
  }
}

/* ============================================================
   סיכום עסקה — "פריטים נבחרים להסכם"
   מרכז את כל נתוני הקטלוג של הפריטים שנבחרו (מחיר/מקדמה/משך/סליקה/הנחיות/מסמכים)
   לטבלה אחת + סיכום כספי, ומעביר ישירות למערכת החוזים — ללא הזנה כפולה.
   ============================================================ */
function openDealSummary(lead) {
  if (!lead) return;
  var svcs = (lead.services || []).slice();
  var ov = document.getElementById('dealSumOv');
  if (!ov) { ov = document.createElement('div'); ov.id = 'dealSumOv'; ov.className = 'ctw-overlay'; document.body.appendChild(ov); }
  function treat(k) { return (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k) : { label: k, kind: '—', dur: 0, price: 0, deposit: 0 }; }
  function render() {
    var rows = svcs.map(function (k) {
      var t = treat(k);
      return '<tr>' +
        '<td class="ds-name"><b>' + esc(t.label) + '</b><span class="badge blue sm">' + esc(t.kind || '') + '</span></td>' +
        '<td>' + (t.kind || '—') + '</td>' +
        '<td>' + (t.dur || 0) + ' דק׳</td>' +
        '<td>' + (t.price || 0) + ' ₪</td>' +
        '<td>' + (t.deposit ? t.deposit + ' ₪' : '—') + '</td>' +
        '<td>' + (t.requiresBilling ? '<span class="badge red sm">נדרש חיוב</span>' : '<span class="badge gray sm">ללא סליקה</span>') + '</td>' +
        '<td><span class="badge green sm">' + ic('check') + ' פעיל</span></td>' +
        '<td class="ds-notes">' + (t.pre ? '<span title="' + esc(t.pre) + '">' + ic('note') + '</span>' : '') + '<button class="ds-rm" data-dsrm="' + k + '" title="הסר">' + ic('close') + '</button></td>' +
      '</tr>';
    }).join('');
    var tot = (typeof svcTotals === 'function') ? svcTotals(svcs) : { price: 0, dur: 0, deposit: 0 };
    var balance = (tot.price || 0) - (tot.deposit || 0);
    ov.innerHTML =
      '<div class="ctw-window ds-window"><header class="ctw-head">' +
        '<div class="ctw-brand">' + ic('docs') + ' <b>פריטים נבחרים להסכם</b><small>' + esc(lead.name) + ' · ' + esc(JOURNEY_TYPES && JOURNEY_TYPES[lead.journey] ? JOURNEY_TYPES[lead.journey].label : 'עסקה') + '</small></div>' +
        '<button class="ctw-x" id="dsClose">' + ic('close') + '</button></header>' +
      '<div class="ds-body">' +
        (svcs.length ? '<div class="ds-tablewrap"><table class="ds-table"><thead><tr><th>שם הפריט</th><th>קטגוריה</th><th>משך</th><th>מחיר</th><th>מקדמה</th><th>סליקה / חיוב</th><th>סטטוס</th><th>הערות/מסמכים</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="muted" style="padding:20px;text-align:center">אין פריטים נבחרים</div>') +
        '<button class="ds-additem" id="dsAdd">' + ic('plus') + ' הוספת פריט נוסף</button>' +
        '<div class="ds-cards">' +
          '<div class="ds-card ds-fin"><div class="ds-card-h">' + ic('check') + ' סיכום כספי</div><div class="ds-fin-grid">' +
            '<div><b>' + svcs.length + '</b><small>פריטים</small></div>' +
            '<div><b>' + (tot.dur || 0) + ' דק׳</b><small>זמן כולל</small></div>' +
            '<div><b>' + (tot.price || 0) + ' ₪</b><small>סה״כ מחיר</small></div>' +
            '<div><b>' + (tot.deposit || 0) + ' ₪</b><small>מקדמה כוללת</small></div>' +
            '<div class="ds-bal"><b>' + balance + ' ₪</b><small>יתרה לחיוב</small></div>' +
          '</div></div>' +
          '<div class="ds-card"><div class="ds-card-h">' + ic('user') + ' מה יופיע ללקוח בהסכם</div><ul class="ds-list">' +
            '<li>' + ic('check') + ' פירוט השירותים, המשך והמחיר בטבלה</li><li>' + ic('check') + ' תנאי תשלום ומקדמה</li><li>' + ic('check') + ' מדיניות ביטול: 24 שעות מראש</li><li>' + ic('check') + ' ללא שיווק/שנוי 14 יום לפני</li></ul></div>' +
          '<div class="ds-card"><div class="ds-card-h">' + ic('lock') + ' הנחיות פנימיות (איש מכירות)</div><ul class="ds-list">' +
            svcs.map(function (k) { var t = treat(k); return t.pre ? '<li>' + ic('note') + ' ' + esc(t.label) + ': ' + esc(t.pre) + '</li>' : ''; }).join('') +
            '<li>' + ic('check') + ' לוודא מסמכים רלוונטיים מהלקוח</li><li>' + ic('check') + ' לבצע אימות טלפוני לפני יצירת ההסכם</li></ul></div>' +
          '<div class="ds-card"><div class="ds-card-h">' + ic('docs') + ' נספחים / מסמכים</div>' +
            ((lead.docs || []).length ? '<div class="ds-docs">' + lead.docs.map(function (d) { return '<span class="ds-doc">' + ic('docs') + ' ' + esc(d.name) + '</span>'; }).join('') + '</div>' : '<p class="muted" style="font-size:12px">טרם צורפו מסמכים</p>') +
            '<button class="btn sm" id="dsAttach">' + ic('plus') + ' צרף מסמך</button></div>' +
        '</div>' +
      '</div>' +
      '<footer class="ctw-foot"><button class="btn ghost" id="dsEdit">' + ic('settings') + ' עריכת פריטים</button>' +
        '<span class="muted" style="font-size:11.5px">' + ic('lock') + ' המידע יעבור ישירות למערכת החוזים — ללא הזנה כפולה</span>' +
        '<button class="btn primary" id="dsToContract">' + ic('chevronL') + ' המשך ליצירת ההסכם</button></footer></div>';
    $('#dsClose').addEventListener('click', close);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    $$('[data-dsrm]').forEach(function (b) { b.addEventListener('click', function () { var i = svcs.indexOf(b.dataset.dsrm); if (i >= 0) svcs.splice(i, 1); lead.services = svcs.slice(); render(); }); });
    var add = $('#dsAdd'); if (add) add.addEventListener('click', function () { close(); if (typeof openServiceSelect === 'function') openServiceSelect(lead); });
    var edit = $('#dsEdit'); if (edit) edit.addEventListener('click', function () { close(); if (typeof openServiceSelect === 'function') openServiceSelect(lead); });
    var att = $('#dsAttach'); if (att) att.addEventListener('click', function () { toast('צירוף מסמך — דרך טאב "מסמכים" בליד'); });
    $('#dsToContract').addEventListener('click', function () { lead.services = svcs.slice(); close(); if (typeof openContractForLead === 'function') openContractForLead(lead); });
  }
  function close() { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180); }
  render();
  requestAnimationFrame(function () { ov.classList.add('open'); });
}

/* ============================================================
   סעיפים, תנאים והערות נוספים להסכם
   נאספים אוטומטית מ: כרטיס השירות (הנחיות/מקדמה/סליקה) · הסניף (נגישות/מידע חובה)
   + ניתן להוסיף פרטנית כאן או במערכת החוזים (CONTRACT_EXTRA_CLAUSES).
   ============================================================ */
let CONTRACT_EXTRA_CLAUSES = (function () { try { return JSON.parse(localStorage.getItem('cb_ctClauses')) || []; } catch (e) { return []; } })();
function ctClausesSave() { try { localStorage.setItem('cb_ctClauses', JSON.stringify(CONTRACT_EXTRA_CLAUSES)); } catch (e) {} }
/* דריסות קבועות לכותרת/נוסח/הצגה של סעיף שנאסף — נשמרות במערכת החוזים (חלות על כל ההסכמים) */
let CONTRACT_TERM_OVERRIDES = (function () { try { return JSON.parse(localStorage.getItem('cb_ctTermOv')) || {}; } catch (e) { return {}; } })();
function ctTermOvSave() { try { localStorage.setItem('cb_ctTermOv', JSON.stringify(CONTRACT_TERM_OVERRIDES)); } catch (e) {} }
function ctTermOvSet(key, patch) { CONTRACT_TERM_OVERRIDES[key] = Object.assign({}, CONTRACT_TERM_OVERRIDES[key], patch); ctTermOvSave(); }
/* איסוף אוטומטי מהמערכת — "התנאים וההגבלות" (הריבוע האדום)
   src   = הכותרת הפנימית (מה שאיש המכירות רואה — מאיפה זה בא)
   title = הכותרת שהלקוח יראה בהסכם (ניתנת לעריכה ולשינוי קבוע)
   hidden= לא מוצג ללקוח בכלל */
function ctCollectedTerms(lead, includeHidden) {
  const raw = [];
  const svcs = (lead && lead.services) || [];
  svcs.forEach(function (k) {
    const t = (typeof cTreat === 'function') ? cTreat(k) : null; if (!t) return;
    if (t.pre) raw.push({ key: 'pre|' + k, src: 'הכנה · ' + t.label, def: 'הכנה לטיפול', text: t.pre });
    if (t.instr) raw.push({ key: 'instr|' + k, src: 'הנחיות ביצוע · ' + t.label, def: 'מהלך הטיפול', text: t.instr });
    if (t.deposit) raw.push({ key: 'dep|' + k, src: 'מקדמה · ' + t.label, def: 'מקדמה', text: 'נדרשת מקדמה בסך ' + t.deposit + ' ₪ לשריון התור.' });
    if (t.requiresBilling) raw.push({ key: 'bill|' + k, src: 'תשלום · ' + t.label, def: 'תנאי תשלום', text: 'שירות זה דורש סליקה' + (t.canScheduleWithoutBilling ? ' (ניתן לתאם לפני התשלום, בכפוף לנעילה זמנית).' : ' לפני קביעת המועד.') });
    if (t.approval) raw.push({ key: 'appr|' + k, src: 'אישור · ' + t.label, def: 'אישור מוקדם', text: 'ביצוע השירות כפוף לאישור מוקדם.' });
  });
  const bKey = (lead && lead.needs && lead.needs.branch) || null;
  const b = (bKey && bKey !== '__near' && typeof COORD_BRANCHES !== 'undefined') ? COORD_BRANCHES.find(function (x) { return x.key === bKey; }) : null;
  if (b) {
    const attrs = [];
    if (typeof BR_ATTRS !== 'undefined') BR_ATTRS.forEach(function (a) { if (b.attrs && b.attrs[a.key]) attrs.push(a.label); });
    if (attrs.length) raw.push({ key: 'brattr|' + b.key, src: 'סניף ' + (b.short || b.label), def: 'נגישות ומאפייני המקום', text: 'מאפייני הסניף: ' + attrs.join(' · ') + '.' });
    (b.infoCriteria || []).forEach(function (c, i) { raw.push({ key: 'brinfo|' + b.key + '|' + i, src: 'מידע חובה · ' + (b.short || b.label), def: 'מידע חשוב', text: c }); });
    if (b.city) raw.push({ key: 'brloc|' + b.key, src: 'מיקום', def: 'מקום הטיפול', text: 'הטיפול יינתן בסניף ' + (b.short || b.label) + (b.street ? ', ' + b.street + ' ' + (b.num || '') : '') + ', ' + b.city + '.' });
  }
  // תנאים קבועים שהוגדרו פעם אחת במערכת החוזים
  if (typeof ctSvcTermsRaw === 'function') ctSvcTermsRaw(lead, (typeof ctWiz !== 'undefined' && ctWiz) ? ctWiz.c : null)
    .forEach(function (x) { raw.push(x); });
  // החלת הדריסות: כותרת ללקוח + נוסח + הצגה. תנאי נעול אינו ניתן לדריסה.
  return raw.map(function (x) {
    const ov = x.locked ? {} : (CONTRACT_TERM_OVERRIDES[x.key] || {});
    return { key: x.key, src: x.src, title: ov.title || x.def, text: ov.text || x.text,
      hidden: !!ov.hidden, edited: !!(ov.title || ov.text), locked: !!x.locked };
  }).filter(function (x) { return includeHidden || !x.hidden; });
}
/* פאנל ניהול הסעיפים — נפתח מ"פעולות מהירות למסמך" */
function openClausesPanel(lead, onDone) {
  const old = document.getElementById('clausePanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'clausePanel';
  const render = function () {
    const auto = ctCollectedTerms(lead, true);   // כולל מוסתרים — כדי שניתן להחזיר אותם
    w.innerHTML = '<div class="cbc-box clause-box" style="max-width:560px;text-align:start">' +
      '<div class="cbc-head"><span class="cbc-ic">' + ic('docs') + '</span><b>סעיפים, תנאים והערות להסכם</b></div>' +
      '<div class="clause-sec"><div class="clause-h">' + ic('bolt') + ' נאסף אוטומטית מהמערכת <small class="muted">(שירות · סניף · הכנה) — הכותרת שהלקוח יראה ניתנת לעריכה</small></div>' +
        (auto.length ? '<div class="clause-list">' + auto.map(function (c) {
            return '<div class="clause-item auto ' + (c.hidden ? 'hidden-t' : '') + '">' +
              '<div class="clause-top"><span class="clause-src" title="כותרת פנימית — לא מוצגת ללקוח">' + ic('lock') + ' ' + esc(c.src) + '</span>' +
                (c.locked ? '<span class="clause-locked" title="תנאי קבוע שהוגדר במערכת החוזים — לא ניתן לשינוי בעסקה בודדת">' + ic('lock') + ' קבוע</span>' :
                '<button class="clause-eye ' + (c.hidden ? 'off' : '') + '" data-ctov-hide="' + esc(c.key) + '" title="' + (c.hidden ? 'מוסתר מהלקוח — לחץ להצגה' : 'מוצג ללקוח — לחץ להסתרה') + '">' + ic('eye') + '</button>') + '</div>' +
              (c.locked ? '<div class="clause-ro"><b>' + esc(c.title) + '</b><span>' + esc(c.text) + '</span></div>' :
              '<label class="clause-cl">כותרת ללקוח' + (c.edited ? ' <span class="clause-edited">שונה</span>' : '') +
                '<input class="cc-inp sm" data-ctov-title="' + esc(c.key) + '" value="' + esc(c.title) + '" placeholder="כותרת שתוצג בהסכם"></label>' +
              '<label class="clause-cl">נוסח ללקוח<textarea class="cc-inp sm" rows="2" data-ctov-text="' + esc(c.key) + '">' + esc(c.text) + '</textarea></label>') +
              '</div>';
          }).join('') + '</div><p class="hint" style="margin:8px 0 0">' + ic('alert') + ' שינוי כאן נשמר <b>קבוע במערכת החוזים</b> ויחול על כל ההסכמים העתידיים.</p>'
          : '<p class="muted" style="font-size:12px;margin:0">אין תנאים אוטומטיים — בחר שירות/סניף בליד.</p>') + '</div>' +
      '<div class="clause-sec st-link-sec"><button class="btn sm" id="clsSvcTerms">' + ic('docs') + ' נהל תנאים קבועים בהסכם</button>' +
        '<small class="muted">התנאים שחייבים להופיע בכל הסכם — ביטול, אחריות, איחור. מוגדרים פעם אחת ומשפיעים על כל ההסכמים.</small></div>' +
      '<div class="clause-sec"><div class="clause-h">' + ic('plus') + ' סעיפים שהוספת <small class="muted">(פרטני להסכם זה ולכל ההסכמים)</small></div>' +
        (CONTRACT_EXTRA_CLAUSES.length ? '<div class="clause-list">' + CONTRACT_EXTRA_CLAUSES.map(function (c, i) {
            return '<div class="clause-item"><span class="clause-src">' + esc(c.title || 'סעיף') + '</span><span>' + esc(c.text) + '</span>' +
              '<button class="whs-del" data-clsdel="' + i + '" title="הסר">' + ic('close') + '</button></div>'; }).join('') + '</div>' : '') +
        '<div class="clause-add"><input class="cc-inp" id="clsTitle" placeholder="כותרת הסעיף (למשל: מדיניות ביטול)">' +
          '<textarea class="cc-inp" id="clsText" rows="2" placeholder="נוסח הסעיף / התנאי / ההערה…"></textarea>' +
          '<button class="btn sm primary" id="clsAdd">' + ic('plus') + ' הוסף סעיף</button></div></div>' +
      '<div class="cbc-actions"><button class="btn ghost" id="clsClose">סגור</button>' +
        '<button class="btn primary" id="clsApply">' + ic('check') + ' החל על ההסכם</button></div></div>';
    $('#clsClose').addEventListener('click', function () { w.remove(); });
    $('#clsAdd').addEventListener('click', function () {
      const ti = ($('#clsTitle') || {}).value || '', tx = ($('#clsText') || {}).value || '';
      if (!tx.trim()) { toast('נא להזין נוסח סעיף'); return; }
      CONTRACT_EXTRA_CLAUSES.push({ title: ti.trim() || 'סעיף', text: tx.trim() }); ctClausesSave(); render(); toast('הסעיף נוסף');
    });
    var svt = $('#clsSvcTerms', w); if (svt) svt.addEventListener('click', function () {
      if (typeof openSvcTermsPanel === 'function') openSvcTermsPanel(function () { render(); });
    });
    $$('[data-clsdel]', w).forEach(function (b) { b.addEventListener('click', function () { CONTRACT_EXTRA_CLAUSES.splice(+b.dataset.clsdel, 1); ctClausesSave(); render(); }); });
    // דריסות: כותרת ללקוח / נוסח / הסתרה — נשמרות קבוע במערכת החוזים
    $$('[data-ctov-title]', w).forEach(function (inp) { inp.addEventListener('change', function () { ctTermOvSet(inp.dataset.ctovTitle, { title: inp.value }); toast('הכותרת ללקוח עודכנה (קבוע)'); }); });
    $$('[data-ctov-text]', w).forEach(function (ta) { ta.addEventListener('change', function () { ctTermOvSet(ta.dataset.ctovText, { text: ta.value }); toast('הנוסח ללקוח עודכן (קבוע)'); }); });
    $$('[data-ctov-hide]', w).forEach(function (b) { b.addEventListener('click', function () {
      const k = b.dataset.ctovHide, cur = (CONTRACT_TERM_OVERRIDES[k] || {}).hidden;
      ctTermOvSet(k, { hidden: !cur }); render(); toast(!cur ? 'הסעיף הוסתר מהלקוח' : 'הסעיף יוצג ללקוח');
    }); });
    $('#clsApply').addEventListener('click', function () { w.remove(); toast('הסעיפים הוחלו על ההסכם'); if (typeof onDone === 'function') onDone(); });
  };
  document.body.appendChild(w); render();
  requestAnimationFrame(function () { w.classList.add('open'); });
  w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
}
