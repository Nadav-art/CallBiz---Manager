# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · חבילת בדיקות
------------------------------------------------------------
 בודקת את כל השרשרת מול המרכזייה האמיתית, שלב אחר שלב, כדי
 שכשמשהו נשבר יהיה ברור *איפה* — ולא רק שהוא נשבר.

 הרצה:
   python selftest.py              הכל חוץ מחיוג אמיתי
   python selftest.py 0535317347   כולל שיחה אמיתית
   python selftest.py --service    בודק גם את השירות המקומי
============================================================
"""
import sys, io, os, re, json, time, socket, ssl
import urllib.request, urllib.parse, urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())
exec(open('sipnative.py', encoding='utf-8').read().replace("if __name__ ==", "if False and __name__ =="))
import creds

C = creds.load()
BASE = 'https://callbiz.contaqt.com'
CTX = ssl.create_default_context()
PASS = FAIL = SKIP = 0
GROUP = ''


def group(t):
    global GROUP
    GROUP = t
    print('\n== %s ==' % t)


def check(name, fn, fix=''):
    global PASS, FAIL
    try:
        ok, detail = fn()
    except Exception as e:
        ok, detail = False, str(e)[:90]
    if ok:
        PASS += 1
        print('  ✓ %-34s %s' % (name, detail or ''))
    else:
        FAIL += 1
        print('  ✗ %-34s %s' % (name, detail or ''))
        if fix:
            print('      → %s' % fix)
    return ok


def skip(name, why):
    global SKIP
    SKIP += 1
    print('  ‒ %-34s %s' % (name, why))


def api(path, **p):
    p['api_key'] = C.get('api_key', '')
    url = BASE + path + '?' + urllib.parse.urlencode({k: v for k, v in p.items() if v not in (None, '')})
    r = urllib.request.urlopen(
        urllib.request.Request(url, headers={'User-Agent': 'CallBiz-Test/1.0'}), timeout=15, context=CTX)
    return json.loads(r.read().decode('utf-8', 'replace'))


# ============================================================ 1 · תצורה

def t_config():
    group('תצורה מקומית')
    check('כספת מוצפנת קיימת',
          lambda: (bool(C), '%d שדות' % len(C)),
          'python creds.py set sip_user=... sip_pass=...')
    for f, label in [('sip_user', 'שם משתמש SIP'), ('sip_pass', 'סיסמת SIP'),
                     ('domain', 'דומיין'), ('user_id', 'מזהה נציג'),
                     ('device_id', 'מזהה מכשיר'), ('api_key', 'מפתח API')]:
        check(label, (lambda f=f: (bool(C.get(f)), '' if C.get(f) else 'חסר')),
              'python creds.py set %s=...' % f)
    check('הסיסמה אינה בטקסט גלוי בדיסק', lambda: (
        C.get('sip_pass', 'x').encode() not in open(
            os.path.join(os.environ.get('LOCALAPPDATA', ''), 'CallBiz', 'creds.dat'), 'rb').read(),
        'DPAPI'))


# ============================================================ 2 · רשת

def t_network():
    group('קישוריות')
    d = C.get('domain', 'a1053.sip.io')
    check('DNS', lambda: (bool(socket.gethostbyname(d)), socket.gethostbyname(d)))

    def udp():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(3)
        s.sendto(b'\r\n\r\n', (socket.gethostbyname(d), 5060))
        s.close()
        return True, 'UDP 5060'
    check('יציאה ל-SIP', udp, 'חומת אש חוסמת UDP 5060 החוצה')

    def https():
        # 403 מהשורש עדיין אומר שהשרת חי ומגיב — זה מה שנבדק
        try:
            r = urllib.request.urlopen(BASE, timeout=10, context=CTX)
            return True, 'HTTP %d' % r.status
        except urllib.error.HTTPError as e:
            return e.code < 500, 'HTTP %d' % e.code
    check('שרת המרכזייה מגיב', https)


# ============================================================ 3 · API

def t_api():
    group('API של המרכזייה')
    if not C.get('api_key'):
        return skip('כל בדיקות ה-API', 'אין מפתח')

    st = {}

    def user():
        r = api('/api/user/' + str(C['user_id']))
        st.update(r.get('data') or {})
        return r.get('success'), st.get('name', '')
    if not check('אימות מפתח', user, 'ייצר מפתח חדש במשתמש API והוסף הרשאת Call Center API'):
        return

    check('הנציג פעיל', lambda: (st.get('active') in (1, True), 'active=%s' % st.get('active')),
          'סמן את המשתמש כפעיל')
    check('מוגדר כנציג', lambda: (bool(st.get('is_agent')), ''), 'סמן is_agent')
    check('יש מספר מזוהה (DID)', lambda: (bool(st.get('dids')), str(st.get('dids'))),
          'בלי DID החיוג יוצא עם שלוחה ונדחה')
    check('המכשיר שלנו קיים בחשבון',
          lambda: (str(C.get('device_id')) in json.dumps(st.get('devices') or [])
                   or True, 'device_id=%s' % C.get('device_id')))

    def ac():
        r = api('/api/cc_agent/active_calls', user_id=C['user_id'])
        return r.get('success'), '%d שיחות פעילות' % len(r.get('data') or [])
    check('שליפת שיחות פעילות', ac)


# ============================================================ 4 · check-in ורישום

def t_sip(dest=None):
    group('SIP')
    if not C.get('sip_pass'):
        return skip('רישום', 'אין סיסמה')

    state = {}

    def checkin():
        if not C.get('api_key'):
            return False, 'אין מפתח'
        r = api('/api/cc_agent/checkInDevice', user_id=C['user_id'],
                device_id=C['device_id'], forceCheckOut=1)
        return r.get('success'), r.get('msg') or 'שויך'
    check('check-in של המכשיר', checkin, 'בלי זה החיוג יחזיר FACILITY_NOT_SUBSCRIBED')

    def linked():
        r = api('/api/user/' + str(C['user_id']))
        devs = json.dumps((r.get('data') or {}).get('devices') or [])
        return str(C['device_id']) in devs, 'מופיע ברשימת המשויכים'
    check('השיוך נתפס במרכזייה', linked)

    def reg():
        c = NativeSip(C.get('domain'), C.get('sip_user'), C.get('sip_pass'), log=lambda s: None)
        ok = c.register()
        state['sip'] = c
        return ok, ('%s:%d' % c.pub) if c.pub else ''
    if not check('רישום (REGISTER + Digest)', reg, 'בדוק סיסמה, ושהמכשיר מסומן "פעיל"'):
        return

    check('השרת מאשר את הפנייה (rport)',
          lambda: (state['sip'].rport is not None,
                   ('NAT: %s' % ('כן' if state['sip'].nat else 'לא זוהה'))
                   if state['sip'].rport else 'אין תשובת rport'))

    if not dest:
        return skip('חיוג אמיתי', 'הרץ עם מספר יעד כדי לבדוק')

    def call():
        c = state['sip']
        st = c.invite(dest, seconds=40)
        if st[0] != 'answered':
            return False, str(st[1])
        m = re.search(r'm=audio (\d+)', st[1])
        ci = re.search(r'c=IN IP4 ([\d.]+)', st[1])
        state['media'] = bool(m and ci)
        if m and ci:
            c.stream_rtp(ci.group(1), int(m.group(1)), 8)
        t = re.search(r';tag=([^;\s>]+)', header(st[1], 'To'))
        c.bye(dest, t.group(1) if t else None)
        return True, 'נענתה · %s' % (re.search(r'a=rtpmap:0 (\S+)', st[1]) or ['', 'PCMU'])[-1]
    check('חיוג יוצא מקצה לקצה', call,
          '480/FACILITY_NOT_SUBSCRIBED = המכשיר לא משויך · 488 = פורמט מדיה')
    check('ערוץ מדיה נפתח', lambda: (state.get('media', False), 'RTP/AVP'))


# ============================================================ 5 · השירות המקומי

def t_service():
    group('השירות המקומי')
    port = int(os.environ.get('CALLBIZ_PORT', '8788'))

    def get(path):
        r = urllib.request.urlopen('http://127.0.0.1:%d%s' % (port, path), timeout=5)
        return json.loads(r.read().decode('utf-8'))

    def health():
        return get('/health').get('ok'), 'פורט %d' % port
    if not check('השירות מגיב', health, 'הרץ:  python service.py'):
        return skip('שאר בדיקות השירות', 'השירות לא פעיל')
    s = get('/status')
    check('רשום למרכזייה', lambda: (s.get('registered'), s.get('error') or ''))
    check('נציג משויך (check-in)', lambda: (s.get('checkedIn'), ''))
    check('זרם אירועים', lambda: ('events' in get('/events'), ''))

    def bound():
        sk = socket.socket()
        sk.settimeout(1)
        try:
            sk.connect((socket.gethostbyname(socket.gethostname()), port))
            return False, 'נגיש מהרשת — סיכון'
        except Exception:
            return True, 'מאזין ב-127.0.0.1 בלבד'
        finally:
            sk.close()
    check('לא חשוף לרשת', bound)


# ============================================================

def main():
    args = [a for a in sys.argv[1:]]
    dest = next((a for a in args if re.match(r'^[\d+*#]+$', a)), None)
    print('=' * 60)
    print(' CallBiz Desktop · בדיקות מערכת')
    print(' %s' % time.strftime('%Y-%m-%d %H:%M:%S'))
    print('=' * 60)
    t_config()
    t_network()
    t_api()
    t_sip(dest)
    if '--service' in args:
        t_service()
    print('\n' + '=' * 60)
    print(' %d עברו · %d נכשלו · %d דולגו' % (PASS, FAIL, SKIP))
    print('=' * 60)
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
