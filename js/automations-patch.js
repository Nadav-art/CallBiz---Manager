/* ============================================================
   עדכון במקום — בלי רינדור מחדש, בלי קפיצת מסך · מודול עצמאי
   ------------------------------------------------------------
   הדלקה/כיבוי של חוק והרצה ידנית עדכנו עד כה את כל המסך, ולכן
   הגלילה נזרקה למעלה. כאן מעדכנים רק את מה שבאמת השתנה:
   המתג, התווית, מוני התחומים, פס ההסבר ויומן ההרצות.
   ============================================================ */
function autoPatchRow(key, on) {
  const tog = document.querySelector('[data-autotog="' + key + '"]');
  if (!tog) { if (typeof renderAutomationsScreen === 'function') renderAutomationsScreen(); return; }
  tog.classList.toggle('on', !!on);
  tog.setAttribute('title', on ? 'החוק פעיל — רץ לבד כשהטריגר קורה' : 'החוק כבוי — לא ירוץ לבד');
  const item = tog.closest('.auto-item');
  if (item) {
    item.classList.toggle('is-on', !!on);
    const lbl = item.querySelector('.auto-swl'); if (lbl) lbl.textContent = on ? 'פעיל' : 'כבוי';
    const hook = item.querySelector('.auto-hook');
    if (hook && typeof autoStat === 'function') {
      const st = autoStat(key);
      let tag = hook.querySelector('.auto-tag.stat');
      if (st.runs) {
        if (!tag) { tag = document.createElement('span'); tag.className = 'auto-tag stat'; hook.appendChild(tag); }
        tag.innerHTML = ic('reports') + ' ' + st.runs + ' הרצות';
      } else if (tag) tag.remove();
    }
  }
  autoPatchCounters();
}
/* מוני הכותרת, מוני התחומים ופס ההסבר */
function autoPatchCounters() {
  const all = (typeof autoAll === 'function') ? autoAll() : [];
  const onCount = all.filter(a => autoIsOn(a.key)).length;
  const head = document.querySelector('.view-head .vh-title .muted');
  if (head) head.textContent = '· ' + onCount + ' מתוך ' + all.length + ' פעילות';
  document.querySelectorAll('.auto-area').forEach(sec => {
    const chip = sec.querySelector('.card-head .chip'); if (!chip) return;
    const keys = [...sec.querySelectorAll('[data-autotog]')].map(t => t.dataset.autotog);
    chip.textContent = keys.filter(k => autoIsOn(k)).length + '/' + keys.length + ' פעילות';
  });
  const note = document.querySelector('.auto-note');
  if (note) {
    note.classList.toggle('on', !!onCount);
    const b = note.querySelector('b');
    if (b) b.textContent = onCount ? onCount + ' חוקים פעילים ורצים בפועל' : 'כל החוקים כבויים — שום דבר לא רץ';
    let off = document.getElementById('autoAllOff');
    const acts = note.querySelector('.auto-note-acts');
    if (onCount && !off && acts) {
      off = document.createElement('button'); off.className = 'btn xs ghost'; off.id = 'autoAllOff';
      off.innerHTML = ic('close') + ' כבה הכל'; acts.appendChild(off);
      off.addEventListener('click', () => { autoAllOff(); renderAutomationsScreen(); toast('כל האוטומציות כובו'); });
    } else if (!onCount && off) off.remove();
  }
}
/* יומן ההרצות בלבד — שומר את גלילת היומן עצמו */
function autoPatchLog() {
  const box = document.querySelector('.auto-log'); if (!box) return;
  const top = box.scrollTop;
  box.innerHTML = AUTO_LOG.length ? AUTO_LOG.map(l =>
      '<div class="alog ' + (l.blocked ? 'blocked' : '') + ' ' + (l.dry ? 'dry' : '') + '">' +
      '<div class="alog-h"><b>' + esc(l.title) + '</b>' +
        (l.blocked ? '<span class="alog-by blk">נחסם</span>' : '') +
        (l.dry ? '<span class="alog-by dry">בדיקה</span>' : '') +
        '<span class="alog-by ' + (l.by === 'הרצה ידנית' ? 'manual' : '') + '">' + esc(l.by) + '</span></div>' +
      '<div class="alog-w">' + esc(l.what) + '</div>' +
      '<div class="alog-at">' + ic('clock') + ' ' + esc(l.at) + '</div></div>').join('')
    : '<div class="auto-empty">' + ic('history') + '<p>עדיין לא רצה אף אוטומציה</p>' +
      '<small>הדלק חוק או לחץ "הרץ" כדי לראות בדיוק מה קורה</small></div>';
  box.scrollTop = top;
}
