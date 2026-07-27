/* ============================================================
   CallBiz Desktop · ספריית שלוחות ויעדי העברה
   ------------------------------------------------------------
   מאיפה זה מגיע: בהפעלה מתוך המנג׳ר — מרשימת העובדים ומהתורים
   של המרכזייה. בעצמאי — רשימת הדגמה מסומנת.

   כאן גם ההיגיון של "חיבור מקדים": אפשר לחייג לשלוחה, לדבר,
   ורק אז לחבר את הלקוח — או להעביר ישירות.
   ============================================================ */
(function () {

  const DEMO = [
    { ext: '201', name: 'יוסי כהן', role: 'שירות', status: 'available' },
    { ext: '202', name: 'מיכל רוזן', role: 'מכירות', status: 'busy' },
    { ext: '203', name: 'אבי זוהר', role: 'שירות', status: 'available' },
    { ext: '204', name: 'שרון אביב', role: 'גבייה', status: 'away' },
    { ext: '900', name: 'תור מכירות', role: 'תור', status: 'queue', queue: true, waiting: 2 },
    { ext: '901', name: 'תור שירות', role: 'תור', status: 'queue', queue: true, waiting: 0 },
    { ext: '999', name: 'תא קולי', role: 'מערכת', status: 'system' },
  ];

  let cache = null;
  async function list() {
    if (cache) return cache;
    /* TODO(server): GET /pbx/extensions */
    if (window.CRM && CRM.mode() === 'embedded') {
      const r = await CRM.extensions ? CRM.extensions() : null;
      if (r && r.length) { cache = r; return cache; }
    }
    cache = DEMO.slice();
    return cache;
  }
  const STATUS = {
    available: { label: 'פנוי', dot: 'ok' },
    busy: { label: 'בשיחה', dot: 'bad' },
    away: { label: 'לא זמין', dot: 'warn' },
    queue: { label: 'תור', dot: 'brand' },
    system: { label: 'מערכת', dot: 'off' },
  };
  const find = ext => (cache || DEMO).find(x => x.ext === String(ext)) || null;

  window.DIR = { list, find, STATUS, refresh: () => { cache = null; return list(); } };
})();
