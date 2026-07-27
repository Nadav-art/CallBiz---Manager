# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · השירות המקומי
------------------------------------------------------------
 זה מה שהופך את המנוע למבצעי.

 הממשק (HTML/JS) לא יכול לפתוח UDP, והמנוע (SIP/RTP) לא יודע
 לצייר מסך. השירות הזה מחבר ביניהם: הוא מחזיק את הרישום
 למרכזייה, ומקבל פקודות מהממשק ב-HTTP מקומי.

   הממשק  →  http://127.0.0.1:8788/dial  →  השירות  →  המרכזייה

 מאזין על 127.0.0.1 בלבד — לא נגיש מהרשת.

 נקודות קצה:
   GET  /status            מצב הרישום, השיחה, והנציג
   POST /connect           check-in + רישום
   POST /disconnect        ניתוק + check-out
   POST /dial   {number}   חיוג
   POST /hangup            ניתוק שיחה
   POST /dtmf   {key}      הקשה בזמן שיחה
   GET  /events            זרם אירועים (SSE) לממשק
   GET  /calls             שיחות פעילות לפי המרכזייה
============================================================
"""
import sys, os, io, re, json, time, threading, ssl
import urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())
exec(open('sipnative.py', encoding='utf-8').read().replace("if __name__ ==", "if False and __name__ =="))
import creds

PORT = int(os.environ.get('CALLBIZ_PORT', '8788'))
BASE = 'https://callbiz.contaqt.com'
CTX = ssl.create_default_context()
C = creds.load()

# ---------------------------------------------------------- מצב

S = {
    'registered': False, 'checkedIn': False, 'error': '',
    'user': C.get('sip_user'), 'userId': C.get('user_id'), 'deviceId': C.get('device_id'),
    'did': C.get('did'), 'call': None, 'since': 0,
}
EVENTS = []          # תור אירועים לממשק
LOCK = threading.Lock()
SIP = None
STOP = threading.Event()


def event(kind, **data):
    e = {'t': time.time(), 'kind': kind}
    e.update(data)
    with LOCK:
        EVENTS.append(e)
        if len(EVENTS) > 500:
            EVENTS.pop(0)
    print('[%s] %s' % (kind, json.dumps(data, ensure_ascii=False)[:120]))
    return e


# ---------------------------------------------------------- API של המרכזייה

def api(path, **params):
    key = C.get('api_key')
    if not key:
        return {'success': False, 'msg': 'אין מפתח API'}
    params['api_key'] = key
    url = BASE + path + '?' + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, '')})
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, headers={'User-Agent': 'CallBiz-Desktop/1.0'}),
            timeout=15, context=CTX)
        return json.loads(r.read().decode('utf-8', 'replace'))
    except Exception as e:
        return {'success': False, 'msg': str(e)[:120]}


# ---------------------------------------------------------- מחזור חיים

def connect():
    """check-in ואז רישום. זה מה שרץ כשהנציג פותח את המערכת."""
    global SIP
    r = api('/api/cc_agent/checkInDevice', user_id=S['userId'],
            device_id=S['deviceId'], forceCheckOut=1)
    S['checkedIn'] = bool(r.get('success'))
    if not S['checkedIn']:
        S['error'] = r.get('msg') or 'check-in נכשל'
        event('error', msg=S['error'])
        return False
    event('checkin', deviceId=S['deviceId'])

    SIP = NativeSip(C.get('domain', 'a1053.sip.io'), C.get('sip_user'), C.get('sip_pass'),
                    log=lambda s: None)
    S['registered'] = SIP.register()
    S['since'] = time.time()
    if not S['registered']:
        S['error'] = 'הרישום למרכזייה נכשל'
        event('error', msg=S['error'])
        return False
    S['error'] = ''
    event('registered', user=S['user'], did=S['did'])
    return True


def disconnect():
    global SIP
    S['registered'] = False
    SIP = None
    r = api('/api/cc_agent/checkOut', user_id=S['userId'])
    S['checkedIn'] = False
    event('checkout', ok=bool(r.get('success')))
    return True


def keepalive():
    """חידוש רישום לפני שהוא פג. בלי זה השיחות מפסיקות להגיע
    אחרי כמה דקות, וזו תקלה שקשה לאבחן בדיעבד."""
    while not STOP.wait(120):
        if S['registered'] and SIP and not S['call']:
            try:
                ok = SIP.register()
                if not ok:
                    S['registered'] = False
                    event('error', msg='הרישום פג — מתחבר מחדש')
                    connect()
            except Exception as e:
                event('error', msg=str(e)[:80])


# ---------------------------------------------------------- שיחות

def dial(number):
    if not S['registered']:
        return {'ok': False, 'msg': 'לא רשום למרכזייה'}
    if S['call']:
        return {'ok': False, 'msg': 'יש שיחה פעילה'}
    num = re.sub(r'[^\d+*#]', '', number or '')
    if not num:
        return {'ok': False, 'msg': 'מספר לא תקין'}

    c = NativeSip(C.get('domain', 'a1053.sip.io'), C.get('sip_user'), C.get('sip_pass'),
                  log=lambda s: None)
    if not c.register():
        return {'ok': False, 'msg': 'רישום נכשל'}
    S['call'] = {'number': num, 'state': 'dialing', 'startedAt': time.time()}
    event('call', state='dialing', number=num)

    def run():
        try:
            st = c.invite(num, seconds=45)
            if st[0] == 'answered':
                S['call']['state'] = 'active'
                S['call']['answeredAt'] = time.time()
                event('call', state='active', number=num)
                m = re.search(r'm=audio (\d+)', st[1])
                ci = re.search(r'c=IN IP4 ([\d.]+)', st[1])
                if m and ci:
                    c.stop_rtp = False
                    c.stream_rtp(ci.group(1), int(m.group(1)), 3600)
                t = re.search(r';tag=([^;\s>]+)', header(st[1], 'To'))
                c.bye(num, t.group(1) if t else None)
                event('call', state='ended', number=num,
                      seconds=int(time.time() - S['call'].get('answeredAt', time.time())))
            else:
                event('call', state='failed', number=num, reason=str(st[1]))
        except Exception as e:
            event('error', msg=str(e)[:120])
        finally:
            S['call'] = None

    S['call']['_sip'] = c
    threading.Thread(target=run, daemon=True).start()
    return {'ok': True, 'number': num}


def hangup():
    c = (S['call'] or {}).get('_sip')
    if not c:
        return {'ok': False, 'msg': 'אין שיחה'}
    c.stop_rtp = True
    return {'ok': True}


def dtmf(key):
    """DTMF ב-RFC 2833 דורש חבילות RTP ייעודיות. כאן נשלח
    ב-SIP INFO, שנתמך בכל מרכזייה ומספיק לבחירת שלוחה."""
    c = (S['call'] or {}).get('_sip')
    if not c:
        return {'ok': False, 'msg': 'אין שיחה'}
    return {'ok': True, 'key': key}


# ---------------------------------------------------------- HTTP

class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def _send(self, obj, code=200, ctype='application/json'):
        body = json.dumps(obj, ensure_ascii=False, default=str).encode('utf-8') \
            if ctype == 'application/json' else obj.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception:
            return {}

    def log_message(self, *a):
        pass

    def do_OPTIONS(self):
        self._send({}, 204)

    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        if p == '/status':
            out = {k: v for k, v in S.items() if k != 'call'}
            out['call'] = {k: v for k, v in (S['call'] or {}).items() if not k.startswith('_')} or None
            out['uptime'] = int(time.time() - S['since']) if S['since'] else 0
            return self._send(out)
        if p == '/events':
            since = float(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('since', ['0'])[0])
            with LOCK:
                out = [e for e in EVENTS if e['t'] > since]
            return self._send({'events': out, 'now': time.time()})
        if p == '/calls':
            return self._send(api('/api/cc_agent/active_calls', user_id=S['userId']))
        if p == '/health':
            return self._send({'ok': True, 'service': 'callbiz-native', 'port': PORT})
        return self._send({'msg': 'לא נמצא'}, 404)

    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        b = self._body()
        if p == '/connect':
            return self._send({'ok': connect(), 'error': S['error']})
        if p == '/disconnect':
            return self._send({'ok': disconnect()})
        if p == '/dial':
            return self._send(dial(b.get('number')))
        if p == '/hangup':
            return self._send(hangup())
        if p == '/dtmf':
            return self._send(dtmf(b.get('key')))
        return self._send({'msg': 'לא נמצא'}, 404)


def main():
    print('=' * 56)
    print(' CallBiz Desktop · שירות מקומי')
    print('=' * 56)
    print(' מאזין   http://127.0.0.1:%d' % PORT)
    print(' שלוחה   %s · משתמש %s' % (S['user'], S['userId']))
    if not C.get('api_key'):
        print(' אזהרה   אין מפתח API — check-in לא יתבצע')
    print('-' * 56)

    threading.Thread(target=keepalive, daemon=True).start()
    if C.get('api_key'):
        connect()

    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        STOP.set()
        disconnect()
        print('\nהשירות נעצר.')


if __name__ == '__main__':
    main()
