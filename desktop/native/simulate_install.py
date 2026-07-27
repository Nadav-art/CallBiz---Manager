# -*- coding: utf-8 -*-
"""
מדמה התקנה נקייה על מחשב חדש: מוחק את הכספת, ומריץ בדיוק את
מה שהאשף עושה כשהנציג מקליד מזהה ולוחץ "אתר".

זה לא בודק את הכפתורים — זה בודק שהלוגיקה שמאחוריהם עובדת.
"""
import sys, io, os, json, ssl, urllib.request, urllib.parse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())
import creds

CTX = ssl.create_default_context()


def api(base, key, path):
    url = base.rstrip('/') + path + '?' + urllib.parse.urlencode({'api_key': key})
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, headers={'User-Agent': 'CallBiz-Setup/1.0'}),
            timeout=15, context=CTX)
        return json.loads(r.read().decode('utf-8', 'replace'))
    except Exception as e:
        return {'success': False, 'msg': str(e)[:120]}


def main():
    user_id = sys.argv[1] if len(sys.argv) > 1 else '160477'
    keep_key = sys.argv[2] if len(sys.argv) > 2 else None

    print('=' * 58)
    print(' סימולציית התקנה על מחשב חדש')
    print('=' * 58)

    ORG = {k: v for k, v in json.load(open('org.json', encoding='utf-8')).items()
           if not k.startswith('_')}
    key = keep_key or ORG.get('api_key') or creds.load().get('api_key', '')

    print('\n[0] מוחק את הכספת — כאילו זה מחשב שלא הותקן עליו כלום')
    creds.clear()
    print('    נמחק. נשאר רק org.json שנוסע עם התיקייה:')
    print('        ארגון   %s' % ORG.get('org'))
    print('        שרת     %s' % ORG.get('base'))
    print('        דומיין  %s' % ORG.get('domain'))

    print('\n[1] הנציג מקליד מזהה: %s   (וזה כל מה שהוא מקליד)' % user_id)
    if not key:
        print('\n    אין מפתח API — הוסיפו אותו ל-org.json או העבירו כארגומנט שני.')
        return 2

    print('\n[2] המערכת שולפת את הנציג')
    r = api(ORG['base'], key, '/api/user/' + user_id)
    if not r.get('success'):
        print('    נכשל: %s' % r.get('msg'))
        return 1
    d = r['data']
    devs = d.get('devices') or []
    print('    שם            %s' % d.get('name'))
    print('    פעיל          %s' % ('כן' if d.get('active') in (1, True) else 'לא'))
    print('    שלוחה         %s' % (d.get('extensions') or ['—'])[0])
    print('    מספר מזוהה    %s' % (d.get('dids') or ['—'])[0])
    print('    מכשירים       %d' % len(devs))

    print('\n[3] בוחרת מכשיר לפי הכללים')
    web = d.get('web_device_id')
    pick = None
    for row in devs:
        nm = row[4] if len(row) > 4 else ''
        why = None
        if row[0] == web:
            why = 'מכשיר ווב — לא מתאים לחייגן מותקן'
        elif str(nm).startswith('Mob-'):
            why = 'מכשיר נייד'
        else:
            why = 'נבחר'
            if not pick:
                pick = row
        print('    %-8s %-38s %s' % (row[0], str(nm)[:36], why))
    if not pick:
        print('    לא נמצא מכשיר מתאים')
        return 1

    print('\n[4] שולפת את פרטי המכשיר — כולל הסיסמה')
    dr = api(ORG['base'], key, '/api/device/%s' % pick[0])
    if not dr.get('success'):
        print('    נכשל: %s' % dr.get('msg'))
        return 1
    dd = dr['data']
    pwd = dd.get('password') or ''
    print('    שם משתמש SIP  d%s' % pick[0])
    print('    סיסמה         %s  (נשלפה, הנציג לא הקליד אותה)'
          % ('•' * (len(pwd) - 4) + pwd[-4:] if pwd else 'לא נמצאה'))

    print('\n[5] שומרת מוצפן ב-DPAPI')
    creds.save(base=ORG['base'], domain=ORG['domain'], api_key=key,
               user_id=user_id, device_id=pick[0], sip_user='d%s' % pick[0],
               sip_pass=pwd, did=(d.get('dids') or [''])[0],
               web_device_id=web)
    saved = creds.load()
    raw = open(os.path.join(os.environ['LOCALAPPDATA'], 'CallBiz', 'creds.dat'), 'rb').read()
    print('    %d שדות · %d בייטים' % (len(saved), len(raw)))
    print('    הסיסמה מופיעה בקובץ כטקסט? %s' % ('כן — בעיה!' if pwd.encode() in raw else 'לא'))

    print('\n[6] בוחרת מסלול תקשורת')
    try:
        import transport
        m = transport.select(ORG['domain'], fresh=True)
        for k in ['udp', 'tls', 'tcp']:
            rr = m['results'].get(k) or {}
            print('    %s %-11s %s' % ('✓' if rr.get('ok') else '✗', rr.get('label', k),
                                       ('%sms' % rr['ms']) if rr.get('ok') else rr.get('why', '')))
        print('    → נבחר %s' % (m.get('choice') or 'אין'))
    except Exception as e:
        print('    דילוג: %s' % str(e)[:60])

    print('\n' + '=' * 58)
    print(' מוכן. הנציג הקליד מספר אחד — כל השאר נשלף.')
    print(' להתחברות מלאה:  python autoconnect.py')
    print('=' * 58)
    return 0


if __name__ == '__main__':
    sys.exit(main())
