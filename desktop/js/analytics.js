/* ============================================================
   CallBiz Desktop · ניתוח ביצועים
   ------------------------------------------------------------
   נשען על השיחות שנרשמו בפועל (CRM.calls) ועל דגימות האיכות
   שנאספו במהלכן — לא על נתוני דמו. כשאין עדיין היסטוריה, המסך
   אומר את זה במפורש במקום להציג מספרים מומצאים.
   ============================================================ */
(function () {

  const calls = () => (window.CRM ? CRM.calls() : []);

  function summary(range) {
    const list = calls();
    const answered = list.filter(c => c.outcome === 'נענתה' || (c.seconds || 0) > 0);
    const secs = list.reduce((s, c) => s + (c.seconds || 0), 0);
    const q = list.filter(c => c.quality > 0);
    const byT = {};
    list.forEach(c => { const k = c.transport || 'webrtc'; byT[k] = (byT[k] || 0) + 1; });
    return {
      total: list.length,
      answered: answered.length,
      answerRate: list.length ? Math.round(answered.length / list.length * 100) : 0,
      talkSec: secs,
      avgSec: answered.length ? Math.round(secs / answered.length) : 0,
      avgMos: q.length ? Math.round(q.reduce((s, c) => s + c.quality, 0) / q.length * 100) / 100 : 0,
      byTransport: byT,
      out: list.filter(c => c.dir === 'out').length,
      in: list.filter(c => c.dir === 'in').length,
      recorded: list.filter(c => c.recorded).length,
    };
  }

  /* התפלגות איכות — כמה שיחות בכל טווח MOS */
  function quality() {
    const b = [{ k: 'מצוינת', min: 4.2, n: 0 }, { k: 'טובה', min: 3.6, n: 0 },
      { k: 'סבירה', min: 3.0, n: 0 }, { k: 'ירודה', min: 0, n: 0 }];
    calls().filter(c => c.quality > 0).forEach(c => {
      const hit = b.find(x => c.quality >= x.min); if (hit) hit.n++;
    });
    return b;
  }

  /* סיבות הכשל המובילות */
  function issues() {
    const m = {};
    calls().forEach(c => {
      if (c.outcome && c.outcome !== 'נענתה') m[c.outcome] = (m[c.outcome] || 0) + 1;
      if (c.quality && c.quality < 3.4) m['איכות ירודה'] = (m['איכות ירודה'] || 0) + 1;
    });
    return Object.keys(m).map(k => ({ k, n: m[k] })).sort((a, b) => b.n - a.n).slice(0, 5);
  }

  const fmtSec = s => {
    s = Math.max(0, Math.round(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0');
  };

  window.STATS = { summary, quality, issues, fmtSec, calls };
})();
