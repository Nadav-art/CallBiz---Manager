/* ============================================================
   תנאים קבועים בהסכם — מודול עצמאי (תוספת בלבד)
   ------------------------------------------------------------
   מה שהסניף והשירות תורמים הוא משתנה ותלוי-עסקה. כאן מגדירים
   פעם אחת את התנאים ה>קבועים< שחייבים להופיע בהסכם (ביטול,
   אחריות, איחור, תוקף מחיר) — לא את הנוסח המשפטי המלא.
   תנאי "נעול" נכנס לכל הסכם ולא ניתן לשנות או להסיר אותו בעסקה
   בודדת מחלון הצעת המחיר. תנאי לא-נעול הוא ברירת מחדל בלבד.
   ============================================================ */

const CT_TERM_SEED = [
  { id: 't1', title: 'מדיניות ביטול ושינוי מועד', svcs: [], types: [], on: true, locked: true,
    text: 'ביטול או שינוי מועד ייעשו עד 48 שעות לפני המועד שנקבע. ביטול מאוחר יותר עשוי לחייב בדמי ביטול.' },
  { id: 't2', title: 'תוקף המחיר', svcs: [], types: ['הצעת מחיר מחייבת'], on: true, locked: true,
    text: 'המחיר בתוקף ל-14 יום ממועד ההצעה, ואינו כולל מע״מ אלא אם צוין אחרת.' },
  { id: 't3', title: 'אחריות על הטיפול', svcs: ['facial', 'laser'], types: [], on: true, locked: true,
    text: 'ניתנת אחריות של 30 יום ממועד הטיפול על תיקון או השלמה, בכפוף לעמידה בהנחיות שניתנו בסיומו.' },
  { id: 't4', title: 'סדרת טיפולים', svcs: ['laser'], types: [], on: true, locked: false,
    text: 'תוצאות הטיפול מושגות בסדרה. מספר המפגשים משתנה בין מטופלים ואינו מובטח מראש.' },
  { id: 't5', title: 'אישור רפואי נדרש', svcs: ['injection'], types: [], on: true, locked: true,
    text: 'ביצוע הטיפול מותנה באישור רפואי ובהצהרת בריאות מלאה ועדכנית שנחתמה על ידי הלקוח.' },
  { id: 't6', title: 'איחור והיעדרות', svcs: [], types: [], on: true, locked: true,
    text: 'איחור של מעל 15 דקות עשוי לקצר את משך הטיפול או לחייב קביעת מועד חדש.' },
];
let CT_SVC_TERMS = (function () {
  try { const raw = JSON.parse(localStorage.getItem('cb_ctSvcTerms')); return Array.isArray(raw) ? raw : CT_TERM_SEED.slice(); }
  catch (e) { return CT_TERM_SEED.slice(); }
})();
function ctSvcTermsSave() { try { localStorage.setItem('cb_ctSvcTerms', JSON.stringify(CT_SVC_TERMS)); } catch (e) {} }

/* לאיזה שירותים / סוגי הסכם התנאי חל — טקסט קריא */
function ctTermScope(t) {
  const s = (t.svcs || []).length
    ? (t.svcs.map(k => (typeof cTreat === 'function' && cTreat(k)) ? cTreat(k).label : k).join(' · '))
    : 'כל השירותים';
  const y = (t.types || []).length ? (t.types || []).join(' · ') : 'כל סוגי ההסכם';
  return { svc: s, type: y };
}
/* התנאים שחלים על ליד מסוים (ואם ידוע — גם על סוג ההסכם) */
function ctSvcTermsFor(lead, contract) {
  const svcs = (lead && lead.services) || [];
  const type = contract && contract.type;
  return CT_SVC_TERMS.filter(t => t.on !== false)
    .filter(t => !(t.types || []).length || !type || t.types.indexOf(type) >= 0)
    .filter(t => !(t.svcs || []).length || t.svcs.some(k => svcs.indexOf(k) >= 0));
}
/* בפורמט שמערכת הסעיפים יודעת לצרוך (src פנימי · def כותרת ללקוח · text נוסח) */
function ctSvcTermsRaw(lead, contract) {
  return ctSvcTermsFor(lead, contract).map(t => {
    const sc = ctTermScope(t);
    return { key: 'svcterm|' + t.id, src: (t.locked !== false ? 'תנאי קבוע · ' : 'ברירת מחדל · ') + sc.svc,
      def: t.title, text: t.text, locked: t.locked !== false };
  });
}

/* ---------------- ניהול הספרייה ---------------- */
let ctTermEdit = null;   // התנאי שנמצא בעריכה, או null

function openSvcTermsPanel(onDone) {
  const old = document.getElementById('svcTermsPanel'); if (old) old.remove();
  const w = document.createElement('div'); w.className = 'cbc-wrap'; w.id = 'svcTermsPanel';
  const treats = (typeof COORD_TREATMENTS !== 'undefined') ? COORD_TREATMENTS : [];
  const types = (typeof CONTRACT_TYPES !== 'undefined') ? CONTRACT_TYPES : [];

  const render = () => {
    const e = ctTermEdit;
    w.innerHTML = `<div class="cbc-box st-box">
      <div class="cbc-head"><span class="cbc-ic">${ic('docs')}</span>
        <b>תנאים קבועים בהסכם</b></div>
      <p class="st-lead">התנאים הקצרים שחייבים להופיע בכל הסכם — ביטול, אחריות, איחור, תוקף מחיר.
        מגדירים אותם פעם אחת כאן והם נכנסים לכל הסכם אוטומטית.
        <b>תנאי נעול</b> לא ניתן לשינוי או להסרה בעסקה בודדת מחלון הצעת המחיר.
        הנוסח המשפטי המלא נשאר בתבנית ההסכם; מה שהסניף והשירות מוסיפים ממשיך להתווסף בנפרד.</p>

      <div class="st-list">
        ${CT_SVC_TERMS.length ? CT_SVC_TERMS.map(t => { const sc = ctTermScope(t); return `
          <div class="st-item ${t.on === false ? 'off' : ''}">
            <div class="st-item-top">
              <b>${esc(t.title)}</b>
              ${t.locked !== false ? `<span class="st-lock">${ic('lock')} נעול</span>` : `<span class="st-lock open">ניתן לשינוי בעסקה</span>`}
              <div class="st-item-btns">
                <button class="btn xs" data-sted="${t.id}">${ic('settings')} עריכה</button>
                <button class="btn xs" data-stlock="${t.id}">${t.locked !== false ? 'שחרר נעילה' : 'נעל'}</button>
                <button class="btn xs" data-sttog="${t.id}">${t.on === false ? 'הפעל' : 'השבת'}</button>
                <button class="btn xs" data-stdel="${t.id}" title="מחק">${ic('close')}</button>
              </div>
            </div>
            <div class="st-item-text">${esc(t.text)}</div>
            <div class="st-scope"><span class="st-tag">${ic('layers')} ${esc(sc.svc)}</span>
              <span class="st-tag dim">${ic('docs')} ${esc(sc.type)}</span></div>
          </div>`; }).join('')
        : `<p class="st-empty">${ic('alert')} עדיין לא הוגדרו תנאים נלווים.</p>`}
      </div>

      <div class="st-form">
        <div class="st-form-h">${ic(e ? 'settings' : 'plus')} <b>${e ? 'עריכת תנאי' : 'תנאי חדש'}</b></div>
        <label class="st-f"><span>כותרת שהלקוח יראה</span>
          <input class="cc-inp" id="stTitle" placeholder="למשל: מדיניות ביטול" value="${esc((e && e.title) || '')}"></label>
        <label class="st-f"><span>הנוסח</span>
          <textarea class="cc-inp" id="stText" rows="3" placeholder="משפט או שניים בשפה פשוטה…">${esc((e && e.text) || '')}</textarea></label>

        <div class="st-f"><span>על אילו שירותים זה חל?</span>
          <div class="st-chips">
            <button class="st-chip ${!((e && e.svcs) || []).length ? 'on' : ''}" data-stsvc="">כל השירותים</button>
            ${treats.map(t => `<button class="st-chip ${(((e && e.svcs) || []).indexOf(t.key) >= 0) ? 'on' : ''}" data-stsvc="${t.key}">${esc(t.label)}</button>`).join('')}
          </div></div>

        <div class="st-f"><span>על אילו סוגי הסכם?</span>
          <div class="st-chips">
            <button class="st-chip ${!((e && e.types) || []).length ? 'on' : ''}" data-sttype="">כל סוגי ההסכם</button>
            ${types.map(t => `<button class="st-chip ${(((e && e.types) || []).indexOf(t) >= 0) ? 'on' : ''}" data-sttype="${esc(t)}">${esc(t)}</button>`).join('')}
          </div></div>

        <label class="st-lockrow"><input type="checkbox" id="stLock" ${(!e || e.locked !== false) ? 'checked' : ''}>
          <span><b>תנאי קבוע — נעול</b><small>יופיע בכל הסכם תואם, ולא ניתן להסיר או לערוך אותו בעסקה בודדת.</small></span></label>

        <div class="st-form-btns">
          <button class="btn sm primary" id="stSave">${ic('check')} ${e ? 'שמור שינויים' : 'הוסף תנאי'}</button>
          ${e ? `<button class="btn sm" id="stCancel">ביטול</button>` : ''}
        </div>
      </div>

      <div class="cbc-actions"><button class="btn primary" id="stClose">${ic('check')} סיום</button></div>
    </div>`;

    /* ------- קישורים ------- */
    const draft = () => {
      if (!ctTermEdit) ctTermEdit = { id: '', title: '', text: '', svcs: [], types: [], on: true };
      const ti = $('#stTitle', w), tx = $('#stText', w), lk = $('#stLock', w);
      if (ti) ctTermEdit.title = ti.value; if (tx) ctTermEdit.text = tx.value;
      if (lk) ctTermEdit.locked = lk.checked;
      return ctTermEdit;
    };
    $$('[data-stsvc]', w).forEach(b => b.addEventListener('click', () => {
      const d = draft(), k = b.dataset.stsvc;
      if (!k) d.svcs = []; else { const i = d.svcs.indexOf(k); if (i >= 0) d.svcs.splice(i, 1); else d.svcs.push(k); }
      render();
    }));
    $$('[data-sttype]', w).forEach(b => b.addEventListener('click', () => {
      const d = draft(), k = b.dataset.sttype;
      if (!k) d.types = []; else { const i = d.types.indexOf(k); if (i >= 0) d.types.splice(i, 1); else d.types.push(k); }
      render();
    }));
    $$('[data-sted]', w).forEach(b => b.addEventListener('click', () => {
      const t = CT_SVC_TERMS.find(x => x.id === b.dataset.sted);
      ctTermEdit = t ? JSON.parse(JSON.stringify(t)) : null; render();
    }));
    $$('[data-stlock]', w).forEach(b => b.addEventListener('click', () => {
      const t = CT_SVC_TERMS.find(x => x.id === b.dataset.stlock); if (!t) return;
      t.locked = t.locked === false; ctSvcTermsSave(); render();
      toast(t.locked ? 'התנאי נעול — יופיע בכל הסכם' : 'התנאי ניתן לשינוי בעסקה בודדת');
    }));
    $$('[data-sttog]', w).forEach(b => b.addEventListener('click', () => {
      const t = CT_SVC_TERMS.find(x => x.id === b.dataset.sttog); if (!t) return;
      t.on = t.on === false; ctSvcTermsSave(); render();
    }));
    $$('[data-stdel]', w).forEach(b => b.addEventListener('click', () => {
      const i = CT_SVC_TERMS.findIndex(x => x.id === b.dataset.stdel);
      if (i >= 0) { CT_SVC_TERMS.splice(i, 1); ctSvcTermsSave(); if (ctTermEdit && ctTermEdit.id === b.dataset.stdel) ctTermEdit = null; render(); toast('התנאי נמחק'); }
    }));
    const sv = $('#stSave', w); if (sv) sv.addEventListener('click', () => {
      const d = draft();
      if (!(d.title || '').trim() || !(d.text || '').trim()) { toast('נא למלא כותרת ונוסח'); return; }
      if (d.id) {
        const t = CT_SVC_TERMS.find(x => x.id === d.id);
        if (t) Object.assign(t, { title: d.title.trim(), text: d.text.trim(), svcs: d.svcs, types: d.types, locked: d.locked !== false });
        toast('התנאי עודכן ✓');
      } else {
        CT_SVC_TERMS.push({ id: 'ct' + (Date.parse('2024-05-23') + CT_SVC_TERMS.length * 7 + CT_SVC_TERMS.length), title: d.title.trim(), text: d.text.trim(), svcs: d.svcs, types: d.types, on: true, locked: d.locked !== false });
        toast('התנאי נוסף ✓');
      }
      ctSvcTermsSave(); ctTermEdit = null; render();
    });
    const cn = $('#stCancel', w); if (cn) cn.addEventListener('click', () => { ctTermEdit = null; render(); });
    const cl = $('#stClose', w); if (cl) cl.addEventListener('click', () => {
      ctTermEdit = null; w.remove(); if (typeof onDone === 'function') onDone();
    });
  };

  render();
  w.addEventListener('mousedown', e => { if (e.target === w) { ctTermEdit = null; w.remove(); if (typeof onDone === 'function') onDone(); } });
  document.body.appendChild(w);
}


/* ============================================================
   כניסה לפאנל התנאים הקבועים — מאזין מואצל ברמת המסמך.
   שני הכפתורים (במסך החוזים ובעורך התבנית) נבנים מחדש בכל
   רינדור, והמאזין שהוצמד לצומת אבד כשהצומת הוחלף. מאזין מואצל
   אינו תלוי בצומת ולכן תמיד עובד.
   ============================================================ */
(function ctTermsDelegate() {
  if (window.__ctTermsBound) return; window.__ctTermsBound = true;
  document.addEventListener('click', e => {
    const t = e.target; if (!t || !t.closest) return;
    if (t.closest('#ctSvcTerms') || t.closest('#ctOpenTerms')) {
      e.preventDefault(); e.stopPropagation();
      if (typeof openSvcTermsPanel === 'function') openSvcTermsPanel();
    }
  });
})();
