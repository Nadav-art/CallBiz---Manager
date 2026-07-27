# -*- coding: utf-8 -*-
"""הטמעת האייקונים שנוצרו בתחקוּת מקובצי המקור.
   העיבוי נעשה ב-stroke באותו צבע על הצורה הממולאת (התרחבות סימטרית).
   מעבים רק את המבנה החיצוני; פרטים פנימיים נשארים בעובי המקורי:
     settings — הגלגל והטבור מעובים · המיני-אייקון לא
     manage   — הלוח, התפס, הראש והכתפיים מעובים · העיגולים, השורות והעניבה לא
     copy     — הכול מעובה"""
import io, os, json, re

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
d = json.load(io.open('_ref/paths.json', encoding='utf-8'))
W = json.load(io.open('_ref/weights.json', encoding='utf-8'))

def loops(path):
    return [seg + 'Z' for seg in path.split('Z') if seg.strip()]

def bbox(loop):
    pts = [(float(a), float(b)) for a, b in re.findall(r'[ML]([\d.]+) ([\d.]+)', loop)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

def split(path, is_detail):
    thick_l, thin_l = [], []
    for lp in loops(path):
        (thin_l if is_detail(*bbox(lp)) else thick_l).append(lp)
    return ''.join(thick_l), ''.join(thin_l), len(thick_l), len(thin_l)

# settings — המיני-אייקון (עיגול המחוונים) נשאר דק
settings_detail = lambda x0, y0, x1, y1: ((x0 + x1) / 2 > 11.5 and (y0 + y1) / 2 > 11.5)
# manage — פרטים פנימיים: תבליטי הרשימה, השורות, הנקודה בתפס והעניבה
def manage_detail(x0, y0, x1, y1):
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if w < 3.2 and h < 3.2 and cx < 15 and 7.0 < cy < 19:   # עיגולי הרשימה + הנקודה בתפס
        return True
    if h < 1.2 and w > 3 and cx < 15:                        # שורות הרשימה
        return True
    if cx > 15.5 and cy > 17.5 and w < 3.2:                  # העניבה
        return True
    return False

def svg(cls, thick_path, thin_path, w):
    parts = ''
    if thick_path:
        parts += ('<path d="%s" stroke="currentColor" stroke-width="%s" stroke-linejoin="round"/>' % (thick_path, w))
    if thin_path:
        parts += '<path d="%s"/>' % thin_path
    return ('<svg class="%s" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">%s</svg>'
            % (cls, parts))

st_thick, st_thin, a1, b1 = split(d['settings'], settings_detail)
mg_thick, mg_thin, a2, b2 = split(d['manage'], manage_detail)

icons = {
    'settings': svg('ic-settings', st_thick, st_thin, W['settings']),
    'manage':   svg('ic-manage',   mg_thick, mg_thin, W['manage']),
    'copy':     svg('ic-copy',     d['copy'], '',     W['copy']),
}

src = io.open('js/data.js', encoding='utf-8').read()
for name in ('settings', 'manage', 'copy'):
    i = src.index('  %s:' % name)
    j = src.index("',\n", i)
    src = src[:i] + "  %s: '" % name + icons[name] + src[j:]
io.open('js/data.js', 'w', encoding='utf-8').write(src)
print('settings: %d מעובות / %d דקות · manage: %d / %d · weights %s' % (a1, b1, a2, b2, W))
