#!/usr/bin/env bash
# ============================================================
#  CallBiz Manager — בנייה וסנכרון ל-GitHub
#  שימוש:  ./sync.sh "תיאור השינוי"
#  בלי תיאור — נוצרת הודעת commit אוטומטית לפי מספר הגרסה.
# ============================================================
set -e
cd "$(dirname "$0")"

# --- 1) בניית הקובץ המאוחד ---
python - <<'PY'
import io, re
html = io.open('index.html', encoding='utf-8').read()
miss = []
def css(m):
    p = m.group(1).split('?')[0]
    try: return '<style>\n' + io.open(p, encoding='utf-8').read() + '\n</style>'
    except Exception: miss.append(p); return m.group(0)
def js(m):
    p = m.group(1).split('?')[0]
    try: return '<script>\n' + io.open(p, encoding='utf-8').read() + '\n</script>'
    except Exception: miss.append(p); return m.group(0)
out = re.sub(r'<link rel="stylesheet" href="([^"]+)"\s*/?>', css, html)
out = re.sub(r'<script src="([^"]+)"></script>', js, out)
io.open('dist/callbiz-app.html', 'w', encoding='utf-8').write(out)
v = re.search(r'\?v=(\d+)', html).group(1)
io.open('.version', 'w', encoding='utf-8').write(v)
print('build ok · v' + v + ' · ' + str(len(out)) + ' bytes' + (' · MISSING: ' + str(miss) if miss else ''))
PY

VER=$(cat .version)
MSG="${1:-v$VER — עדכון אוטומטי}"

# --- 2) commit רק אם יש מה לשמור ---
if [ -z "$(git status --porcelain)" ]; then
  echo "אין שינויים לסנכרון."
  exit 0
fi

git add -A
git commit -m "$MSG

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

# --- 3) דחיפה ---
git push origin main
echo "סונכרן ל-GitHub · v$VER"
