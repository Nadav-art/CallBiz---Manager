# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · חיבור יזום מלא
------------------------------------------------------------
 מה שיקרה אצל נציג אמיתי כשיפתח את הדסקטופ בבוקר, בלי שיידע
 שמשהו מזה קורה:

   1. בדיקת מצב — האם המכשיר משויך לנציג
   2. אם לא — check-in יזום מול המרכזייה (forceCheckOut משחרר
      מכשיר קודם שנשאר תפוס)
   3. אימות שהשיוך נתפס
   4. רישום SIP והמערכת מוכנה לשיחות
   5. בסגירה — check-out, כדי שהמכשיר לא יישאר תפוס

 הרצה:
   python autoconnect.py                 — חיבור בלבד
   python autoconnect.py 0535317347      — חיבור ואז חיוג
============================================================
"""
import sys, io, os, re, json, time, ssl
import urllib.request, urllib.parse, urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open('sipnative.py', encoding='utf-8').read().replace("if __name__ ==", "if False and __name__ =="))
import creds

BASE = 'https://callbiz.contaqt.com'
CTX = ssl.create_default_context()
C = creds.load()
API_KEY = C.get('api_key') or os.environ.get('CALLBIZ_API_KEY', '')
USER_ID = C.get('user_id', '160477')
SIP_USER = C.get('sip_user', 'd146106')
SIP_PASS = C.get('sip_pass', '')
DOMAIN = C.get('domain', 'a1053.sip.io')


def api(path, **params):
    if not API_KEY:
        return {'success': False, 'msg': 'אין מפתח API'}
    params['api_key'] = API_KEY
    url = BASE + path + '?' + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, '')})
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, headers={'User-Agent': 'CallBiz-Desktop/1.0'}),
            timeout=15, context=CTX)
        return json.loads(r.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        return {'success': False, 'msg': 'HTTP %d' % e.code}
    except Exception as e:
        return {'success': False, 'msg': str(e)[:120]}


def step(n, text):
    print('\n[%d] %s' % (n, text))


def status():
    """מצב הנציג כפי שהמרכזייה רואה אותו."""
    r = api('/api/user/' + str(USER_ID))
    if not r.get('success'):
        return None
    d = r.get('data') or {}
    devs = d.get('devices') or []
    return {
        'name': d.get('name'), 'online': d.get('online'),
        'devices': [(x[0], x[4] if len(x) > 4 else '') for x in devs],
        'queues': d.get('queues') or [], 'dids': d.get('dids') or '',
        'web_device_id': d.get('web_device_id'), 'pause_id': d.get('pause_id'),
    }


def find_device(st):
    """מזהה המכשיר שלנו. כשהנציג מנותק המכשיר נעלם מרשימת
    המשויכים — ולכן המזהה השמור הוא המקור, לא הרשימה."""
    if C.get('device_id'):
        return C['device_id']
    for row in (st or {}).get('devices', []):
        if SIP_USER.lstrip('d') == str(row[0]):
            return row[0]
    devs = (st or {}).get('devices') or []
    return devs[0][0] if devs else None


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else None
    print('=' * 56)
    print(' CallBiz Desktop · חיבור יזום')
    print('=' * 56)
    print(' משתמש %s · שלוחה %s · %s' % (USER_ID, SIP_USER, DOMAIN))
    if not API_KEY:
        print('\n אין מפתח API. הוסף אותו מוצפן:')
        print('   python creds.py set api_key=XXXX')
        return 2
    if not SIP_PASS:
        print('\n אין סיסמת SIP. הוסף:  python creds.py set sip_pass=XXXX')
        return 2

    step(1, 'בודק מצב נוכחי במרכזייה')
    st = status()
    if st is None:
        print('    המפתח נדחה או שאין גישה ל-API')
        return 1
    print('    נציג: %s · מקוון: %s' % (st['name'], 'כן' if st['online'] else 'לא'))
    print('    מכשירים משויכים: %s' % (st['devices'] or 'אין'))
    print('    מספרים מזוהים: %s' % (st['dids'] or 'אין'))
    print('    תורים: %s' % (st['queues'] or 'אין'))

    dev = find_device(st)
    step(2, 'מבצע check-in יזום (device_id=%s)' % dev)
    r = api('/api/cc_agent/checkInDevice', user_id=USER_ID, device_id=dev, forceCheckOut=1)
    if not r.get('success'):
        print('    נכשל: %s' % r.get('msg'))
        print('    מנסה במסלול החלופי — קוד חיוג')
        r2 = api('/api/cc_agent/checkIn', user_id=USER_ID, forceCheckOut=1)
        code = r2.get('data')
        if not code:
            print('    גם זה נכשל: %s' % r2.get('msg'))
            return 1
        print('    התקבל קוד %s — מחייג אליו מהמכשיר' % code)
        c = NativeSip(DOMAIN, SIP_USER, SIP_PASS, log=lambda s: None)
        if not c.register():
            print('    רישום נכשל')
            return 1
        s = c.invite(code, seconds=20)
        print('    תוצאת החיוג לקוד: %s' % (s[0],))
        if s[0] == 'answered':
            m = re.search(r'm=audio (\d+)', s[1]); ci = re.search(r'c=IN IP4 ([\d.]+)', s[1])
            if m and ci:
                c.stream_rtp(ci.group(1), int(m.group(1)), 6)
            t = re.search(r';tag=([^;\s>]+)', header(s[1], 'To'))
            c.bye(code, t.group(1) if t else None)
        time.sleep(2)
    else:
        print('    בוצע')

    step(3, 'מאמת שהשיוך נתפס')
    st2 = status() or {}
    ok = bool(st2.get('devices'))
    print('    מכשירים משויכים: %s' % (st2.get('devices') or 'אין'))
    print('    מספרים מזוהים: %s' % (st2.get('dids') or 'אין'))
    if not ok:
        print('    השיוך לא נתפס — החיוג ייכשל')

    step(4, 'נרשם למרכזייה')
    c = NativeSip(DOMAIN, SIP_USER, SIP_PASS, log=lambda s: None)
    if not c.register():
        print('    הרישום נכשל')
        return 1
    print('    רשום · %s@%s' % (SIP_USER, DOMAIN))
    if c.pub:
        print('    כתובת חיצונית %s:%d' % c.pub)

    if dest:
        step(5, 'מחייג ל-%s' % dest)
        s = c.invite(dest, seconds=30)
        print('    %s %s' % (s[0], s[1] if isinstance(s[1], str) else ''))
        if s[0] == 'answered':
            m = re.search(r'm=audio (\d+)', s[1]); ci = re.search(r'c=IN IP4 ([\d.]+)', s[1])
            if m and ci:
                print('    שיחה פעילה — משדר קול 15 שניות')
                c.stream_rtp(ci.group(1), int(m.group(1)), 15)
            t = re.search(r';tag=([^;\s>]+)', header(s[1], 'To'))
            c.bye(dest, t.group(1) if t else None)
            print('    השיחה הסתיימה')

    step(6, 'משחרר את המכשיר (check-out)')
    r = api('/api/cc_agent/checkOut', user_id=USER_ID)
    print('    %s' % ('בוצע' if r.get('success') else r.get('msg')))
    print('\n' + '=' * 56)
    return 0


if __name__ == '__main__':
    sys.exit(main())
