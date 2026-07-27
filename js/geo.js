/* ============================================================
   גאו — תעדוף סניף לפי קרבה לכתובת הלקוח (מודול עצמאי)
   ------------------------------------------------------------
   • כתובת הלקוח נשמרת על הליד (r.addr) וניתנת להזנה כבר במסך הקריטריונים
   • מרחק אווירי (Haversine) בין כתובת הלקוח לקואורדינטות הסניף
   • קואורדינטות הסניף מגיעות מאימות הכתובת (branch-settings) — b.lat/b.lng
   • בהשקה: להחליף geoCoords() בקריאה ל-Google Geocoding לקבלת קואורדינטות אמיתיות
   ============================================================ */
const IL_CITY_COORDS = {
  'קרית שמונה': [33.2075, 35.5695], 'צפת': [32.9646, 35.4960], 'טבריה': [32.7922, 35.5312],
  'נהריה': [33.0058, 35.0948], 'עכו': [32.9281, 35.0818], 'כרמיאל': [32.9186, 35.2951],
  'עפולה': [32.6078, 35.2897], 'חיפה': [32.7940, 34.9896], 'קריות': [32.8340, 35.0800],
  'נשר': [32.7680, 35.0430], 'חדרה': [32.4340, 34.9196], 'נתניה': [32.3215, 34.8532],
  'הרצליה': [32.1624, 34.8447], 'רעננה': [32.1848, 34.8713], 'כפר סבא': [32.1750, 34.9070],
  'הוד השרון': [32.1500, 34.8880], 'פתח תקווה': [32.0840, 34.8878], 'תל אביב': [32.0853, 34.7818],
  'רמת גן': [32.0684, 34.8248], 'גבעתיים': [32.0722, 34.8106], 'חולון': [32.0117, 34.7742],
  'בת ים': [32.0171, 34.7457], 'ראשון לציון': [31.9730, 34.7925], 'ירושלים': [31.7683, 35.2137],
  'בית שמש': [31.7497, 34.9886], 'מעלה אדומים': [31.7767, 35.2983], 'מודיעין': [31.8928, 35.0104],
  'רחובות': [31.8928, 34.8113], 'נס ציונה': [31.9293, 34.7986], 'לוד': [31.9515, 34.8953],
  'רמלה': [31.9288, 34.8667], 'אשדוד': [31.8014, 34.6435], 'אשקלון': [31.6688, 34.5743],
  'קרית גת': [31.6100, 34.7642], 'באר שבע': [31.2530, 34.7915], 'דימונה': [31.0686, 35.0333],
  'ערד': [31.2589, 35.2137], 'אילת': [29.5577, 34.9519], 'גני תקווה': [32.0640, 34.8720],
};
/* קואורדינטות לכתובת — טבלת ערים; נפילה חזרה לפיזור דטרמיניסטי (דמו). בהשקה: Google Geocoding */
function geoCoords(city, street) {
  const c = IL_CITY_COORDS[(city || '').trim()];
  if (c) {
    // הסחה קטנה לפי הרחוב כדי שכתובות שונות באותה עיר לא יהיו זהות לחלוטין
    const off = street ? ((String(street).length * 7) % 20 - 10) / 1000 : 0;
    return { lat: c[0] + off, lng: c[1] + off / 2 };
  }
  if (!city) return null;
  return { lat: 31.4 + (city.length * 7 % 33) / 10, lng: 34.5 + ((street || '').length * 5 % 22) / 10 };
}
function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
/* קואורדינטות סניף — מהאימות (b.lat/b.lng) או מהעיר */
function branchCoords(b) {
  if (b && b.lat && b.lng) { const la = parseFloat(b.lat), ln = parseFloat(b.lng); if (!isNaN(la) && !isNaN(ln)) return { lat: la, lng: ln }; }
  return geoCoords(b && b.city, b && b.street);
}
/* כתובת הלקוח מהליד */
function leadCoords(r) { const a = (r && r.addr) || null; return a && a.city ? geoCoords(a.city, a.street) : null; }
function leadAddrText(r) { const a = (r && r.addr) || null; return a && a.city ? (a.city + (a.street ? ' · ' + a.street + ' ' + (a.num || '') : '')).trim() : ''; }
/* סניפים מדורגים לפי קרבה לכתובת הלקוח — [{b, km}] */
function nearestBranches(r) {
  const from = leadCoords(r);
  const list = (typeof COORD_BRANCHES !== 'undefined' ? COORD_BRANCHES : []).filter(b => b.active !== false);
  if (!from) return list.map(b => ({ b, km: null }));
  return list.map(b => ({ b, km: haversineKm(from, branchCoords(b)) }))
    .sort((x, y) => (x.km == null ? 1e9 : x.km) - (y.km == null ? 1e9 : y.km));
}
/* הסניף הקרוב ביותר */
function nearestBranchKey(r) { const n = nearestBranches(r); return (n.length && n[0].km != null) ? n[0].b.key : null; }

/* ---------- UI: הזנת כתובת הלקוח + תעדוף סניף קרוב (בתוך מסך הקריטריונים) ---------- */
function leadAddrHTML(r) {
  r.addr = r.addr || { city: '', street: '', num: '' };
  const a = r.addr, near = a.city ? nearestBranches(r) : [];
  const prefer = (r.needs || {}).nearBranch === '1';
  return `<div class="geo-box">
    <div class="geo-head">${ic('org')} כתובת הלקוח <small class="muted">— לתעדוף הסניף הקרוב לביתו · נשמר בפרטי הליד</small></div>
    <div class="geo-row">
      <input class="cc-inp" list="geoCities" data-geo="city" value="${esc(a.city)}" placeholder="עיר / יישוב">
      <input class="cc-inp" list="geoStreets" data-geo="street" value="${esc(a.street)}" placeholder="רחוב">
      <input class="cc-inp geo-num" data-geo="num" value="${esc(a.num)}" placeholder="מס׳">
    </div>
    <datalist id="geoCities">${(typeof IL_CITIES !== 'undefined' ? IL_CITIES : []).map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
    <datalist id="geoStreets">${(typeof IL_STREETS !== 'undefined' ? IL_STREETS : []).map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    ${near.length ? `<div class="geo-list">${near.slice(0, 4).map((x, i) => `<span class="geo-chip ${i === 0 ? 'best' : ''}">${i === 0 ? ic('check') + ' ' : ''}${esc(x.b.short || x.b.label)}${x.km != null ? ` · ${x.km} ק״מ` : ''}</span>`).join('')}</div>
      <small class="geo-tip">${ic('target')} לתעדוף לפי מרחק — בחר <b>"📍 הקרוב לבית הלקוח"</b> ברשימת הסניפים למטה.</small>` : ''}
  </div>`;
}
function bindLeadAddr(r, after) {
  r.addr = r.addr || { city: '', street: '', num: '' };
  $$('[data-geo]').forEach(inp => inp.addEventListener('change', () => {
    r.addr[inp.dataset.geo] = inp.value;
    if (typeof after === 'function') after();
  }));
  const nb = $('[data-geonear]'); if (nb) nb.addEventListener('change', () => {
    r.needs = r.needs || {};
    r.needs.nearBranch = nb.checked ? '1' : '';
    if (nb.checked) { const k = nearestBranchKey(r); if (k) r.needs.branch = k; }   // מסנכרן את בחירת הסניף לקרוב ביותר
    if (typeof after === 'function') after();
  });
}
