/* ============================================================
   הרחבה: יומנים לפי תפקיד  ·  key = 'calrole'
   ------------------------------------------------------------
   מה היה: מסך הפגישות הציג מתג עובד/מנהל/מנהל-על, אבל תצוגת
   האירועים עצמה נשלטה בנפרד ע״י מתג "מנהל ראשי" — ולכן מנהל
   ראה "תפוס" ביומני הצוות שלו, בניגוד למה שנכתב במסך.

   מה עכשיו — פתוח, לא מוסתר:
     • עובד     — היומן שלו.
     • מנהל     — היומן שלו + יומני הצוות שלו, בפירוט מלא.
     • מנהל-על  — יומני כל מנהלי הצוותים והצוותים שלהם, בפירוט מלא.

   הצוות נגזר מהמערכת ולא מוגדר ידנית: אותה מחלקה, או סניף שהעובד
   רשום בו כמנהל הסניף.
   ============================================================ */
(function () {

  const staffByName = n => (typeof STAFF !== 'undefined') ? STAFF.find(s => s.name === n) : null;
  const isSuperPerm = p => p === 'מנהל רשת' || p === 'אדמין';
  const isMgrPerm = p => p === 'מנהל סניף' || isSuperPerm(p);

  /* הסניפים שהעובד מנהל */
  function branchesManagedBy(s) {
    if (!s || typeof COORD_BRANCHES === 'undefined') return [];
    return COORD_BRANCHES.filter(b => b.mgr === s.id).map(b => b.key);
  }
  /* הצוות של מנהל — אותה מחלקה או סניף שהוא מנהל */
  function teamOf(name) {
    const me = staffByName(name); if (!me) return [];
    if (isSuperPerm(me.perm)) return (typeof STAFF !== 'undefined' ? STAFF : []).filter(s => s.name !== name).map(s => s.name);
    const mine = branchesManagedBy(me);
    return (typeof STAFF !== 'undefined' ? STAFF : []).filter(s => {
      if (s.name === name) return false;
      if (mine.length && (s.branches || [s.branch]).some(b => mine.indexOf(b) >= 0)) return true;
      return s.dept === me.dept;
    }).map(s => s.name);
  }
  /* מנהלי הצוותים — לתצוגת מנהל-על */
  const teamManagers = () => (typeof STAFF !== 'undefined' ? STAFF : []).filter(s => isMgrPerm(s.perm)).map(s => s.name);

  /* התפקיד האפקטיבי: המתג במסך הפגישות, ובתוך גבולות ההרשאה */
  function effRole() {
    const me = staffByName(typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : '');
    const perm = me ? me.perm : 'נציג';
    let role = (typeof meetRole !== 'undefined') ? meetRole : 'emp';
    if (role === 'super' && !isSuperPerm(perm)) role = isMgrPerm(perm) ? 'mgr' : 'emp';
    if (role === 'mgr' && !isMgrPerm(perm)) role = 'emp';
    return role;
  }

  /* מי גלוי לי בפירוט מלא */
  function canSee(owner) {
    if (!owner || owner === CURRENT_USER) return true;
    if (typeof calManagerView !== 'undefined' && calManagerView) return true;   // מתג "מנהל ראשי" הקיים
    const role = effRole();
    if (role === 'super') return true;                       // כל מנהלי הצוותים והצוותים שלהם
    if (role === 'mgr') return teamOf(CURRENT_USER).indexOf(owner) >= 0;
    return false;
  }

  CBX.register({
    key: 'calrole', label: 'יומנים לפי תפקיד', icon: 'clients',
    desc: 'מנהל רואה את היומן שלו ואת יומני הצוות שלו בפירוט מלא, ומנהל-על רואה את כל מנהלי הצוותים והצוותים שלהם — פתוח, לא "תפוס". הצוות נגזר מהמחלקה ומניהול הסניף.',
    files: ['js/ext/cal-roles.js'],
    install() {
      /* התצוגה עצמה — האירוע נפתח למי שמורשה */
      if (typeof calEvHTML === 'function') CBX.wrap('calrole', 'calEvHTML', o => function (ev, weekMode, owner) {
        if (owner && canSee(owner)) {
          /* קריאה בלי owner מחזירה את הכרטיס המלא — ומחזירים את השיוך למקומו */
          const full = o.call(this, ev, weekMode, null);
          return full.replace('data-owner=""', 'data-owner="' + String(owner).replace(/"/g, '&quot;') + '"');
        }
        return o.apply(this, arguments);
      });
      /* מסך הפגישות — אותה החלטה בדיוק */
      if (typeof meetCanSeeDetail === 'function') CBX.wrap('calrole', 'meetCanSeeDetail', () => function (owner) {
        return canSee(owner);
      });
      /* חיווי גלוי: מי בדיוק פתוח לי */
      if (typeof meetTeamHTML === 'function') CBX.wrap('calrole', 'meetTeamHTML', o => function () {
        const html = o.apply(this, arguments);
        const role = effRole();
        const list = role === 'super' ? teamManagers() : (role === 'mgr' ? teamOf(CURRENT_USER) : []);
        const note = role === 'super'
          ? `<div class="cr-note">${ic('eye')} <b>מנהל-על — פתוח לחלוטין</b>
             <small>כל מנהלי הצוותים והצוותים שלהם מוצגים בפירוט מלא:
             ${list.map(esc).join(' · ') || 'אין מנהלי צוות מוגדרים'}</small></div>`
          : role === 'mgr'
          ? `<div class="cr-note">${ic('eye')} <b>מנהל — היומן שלך + הצוות שלך, בפירוט מלא</b>
             <small>${list.length ? 'הצוות שלך: ' + list.map(esc).join(' · ') : 'לא שויכו לך עובדים'}
             · הצוות נגזר מהמחלקה ומהסניפים שאתה מנהל.</small></div>`
          : `<div class="cr-note">${ic('lock')} <b>עובד — היומן שלך בלבד</b>
             <small>יומנים של אחרים מוצגים כ"תפוס" ללא פרטים.</small></div>`;
        return html.replace(/<div class="mp-note">[\s\S]*?<\/div>/, note);
      });
    },
  });

  window.CALROLE = { canSee, teamOf, managers: teamManagers, role: effRole };
})();
