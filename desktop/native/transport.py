# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · בחירת מסלול תקשורת
------------------------------------------------------------
 השאלה "UDP או TLS" אין לה תשובה כללית — יש לה תשובה לכל רשת.
 לכן המערכת לא מחליטה מראש: היא מודדת, ובוחרת.

 מה נבדק בפועל, במקביל:

   SIP · UDP 5060    הכי יעיל. חבילה קטנה, בלי לחיצת יד, בלי
                     תקורה. עובד ברוב הרשתות הביתיות.
   SIP · TCP 5060    כשחומת אש חוסמת UDP אבל לא TCP.
   SIP · TLS 5061    מוצפן, ונראה לחומת אש כתעבורת HTTPS. עובר
                     כמעט בכל רשת ארגונית.
   SIP · WSS 443     המוצא האחרון. עובד גם דרך proxy.
   RTP · UDP גבוה    זה הקריטי. הקול חייב UDP, ואין לו תחליף
                     שלא פוגע באיכות.

 ההיגיון בבחירה — לפי סדר, הראשון שמתקיים מנצח:

   1. אם UDP עובד ומגיב מהר         → UDP.  הכי טוב לקול.
   2. אם UDP חסום אך TLS עובד       → TLS.  איתות עובר, ואם גם
                                       RTP חסום נדע להתריע.
   3. אם רק TCP עובד                → TCP.
   4. אם רק WSS עובר                → WSS.  ומזהירים על איכות.

 ולמה לא תמיד TLS "ליתר ביטחון": כי TLS מוסיף לחיצת יד לכל
 חיבור מחדש, וכשהרשת מגמגמת זה מאריך את זמן ההתאוששות. UDP
 מתאושש מיידית. אז TLS נבחר כשצריך אותו, לא כברירת מחדל.

 החלטה נשמרת ל-24 שעות ונבדקת מחדש אם החיבור נופל — כדי שלא
 נסרוק בכל הפעלה, אבל גם לא ניתקע על בחירה שכבר לא נכונה.
============================================================
"""
import socket, ssl, time, json, os, sys, io, threading, random, string

CANDIDATES = [
    {'key': 'udp', 'proto': 'UDP', 'port': 5060, 'tls': False, 'rank': 1,
     'label': 'UDP 5060',
     'why': 'התקורה הנמוכה ביותר והתאוששות מיידית מנפילות רשת'},
    {'key': 'tcp', 'proto': 'TCP', 'port': 5060, 'tls': False, 'rank': 3,
     'label': 'TCP 5060',
     'why': 'עובר כשחומת אש חוסמת UDP, אך מתאושש לאט יותר'},
    {'key': 'tls', 'proto': 'TCP', 'port': 5061, 'tls': True, 'rank': 2,
     'label': 'TLS 5061',
     'why': 'מוצפן ונראה כתעבורת HTTPS — עובר ברשתות ארגוניות'},
    {'key': 'wss', 'proto': 'TCP', 'port': 443, 'tls': True, 'rank': 4,
     'label': 'WSS 443', 'path': '/ws',
     'why': 'עובר גם דרך proxy, אך מוסיף תקורה'},
]

CACHE = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
                     'CallBiz', 'transport.json')
TTL = 24 * 3600


def _rnd(n=8):
    return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(n))


def _probe_msg(domain, transport, contact):
    """REGISTER ולא OPTIONS.

    שרתים רבים — וזה כולל את המרכזייה הזו — מתעלמים מ-OPTIONS
    שמגיע ממקור לא מוכר, ואז מסלול פתוח נראה חסום. REGISTER
    חייב לקבל תשובה לפי התקן (401 בדרך כלל). איננו מנסים
    להירשם, רק לוודא שיש מענה ולמדוד כמה זמן הוא לוקח.
    """
    return '\r\n'.join([
        'REGISTER sip:%s SIP/2.0' % domain,
        'Via: SIP/2.0/%s %s;branch=z9hG4bK%s;rport' % (transport, contact, _rnd(10)),
        'Max-Forwards: 70',
        'From: <sip:probe@%s>;tag=%s' % (domain, _rnd(8)),
        'To: <sip:probe@%s>' % domain,
        'Call-ID: %s@probe' % _rnd(12),
        'CSeq: 1 REGISTER',
        'Contact: <sip:probe@%s>' % contact,
        'Expires: 0',
        'Content-Length: 0', '', ''])


# ---------------------------------------------------------- בדיקות

def probe_udp(host, ip, port, timeout=4):
    t0 = time.perf_counter()
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.bind(('0.0.0.0', 0))
        msg = _probe_msg(host, 'UDP', '%s:%d' % (_local_ip(), s.getsockname()[1]))
        s.sendto(msg.encode(), (ip, port))
        data, _ = s.recvfrom(4096)
        ms = (time.perf_counter() - t0) * 1000
        return {'ok': data.startswith(b'SIP/2.0'), 'ms': round(ms, 1),
                'code': data[8:11].decode('ascii', 'replace')}
    except socket.timeout:
        return {'ok': False, 'why': 'אין מענה', 'blocked': True}
    except Exception as e:
        return {'ok': False, 'why': 'שגיאת בדיקה: ' + type(e).__name__, 'bug': True}
    finally:
        s.close()


def probe_tcp(host, ip, port, use_tls, timeout=5):
    t0 = time.perf_counter()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((ip, port))
        connect_ms = (time.perf_counter() - t0) * 1000
        if use_tls:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            s = ctx.wrap_socket(s, server_hostname=host)
            handshake_ms = (time.perf_counter() - t0) * 1000
        else:
            handshake_ms = connect_ms
        lp = s.getsockname()[1]
        msg = _probe_msg(host, 'TLS' if use_tls else 'TCP', '%s:%d' % (_local_ip(), lp))
        s.sendall(msg.encode())
        data = s.recv(4096)
        ms = (time.perf_counter() - t0) * 1000
        return {'ok': data.startswith(b'SIP/2.0'), 'ms': round(ms, 1),
                'connect': round(connect_ms, 1), 'handshake': round(handshake_ms, 1),
                'code': data[8:11].decode('ascii', 'replace')}
    except (socket.timeout, ConnectionRefusedError, OSError) as e:
        return {'ok': False, 'why': 'אין מענה', 'blocked': True}
    except Exception as e:
        return {'ok': False, 'why': 'שגיאת בדיקה: ' + type(e).__name__, 'bug': True}
    finally:
        try:
            s.close()
        except Exception:
            pass


def probe_rtp(ip, timeout=3):
    """האם UDP על פורטים גבוהים יוצא בכלל. זה הקריטי — הקול
    לא יכול לעבור בשום דרך אחרת בלי לאבד איכות."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.bind(('0.0.0.0', 0))
        # STUN Binding Request — שרת ציבורי, פורט גבוה
        req = b'\x00\x01\x00\x00\x21\x12\xa4\x42' + bytes(range(12))
        t0 = time.perf_counter()
        s.sendto(req, (socket.gethostbyname('stun.l.google.com'), 19302))
        data, _ = s.recvfrom(2048)
        ms = (time.perf_counter() - t0) * 1000
        ext = None
        if len(data) > 20 and data[0:2] == b'\x01\x01':
            i = 20
            while i + 4 <= len(data):
                t, ln = int.from_bytes(data[i:i + 2], 'big'), int.from_bytes(data[i + 2:i + 4], 'big')
                if t == 0x0020 and ln >= 8:      # XOR-MAPPED-ADDRESS
                    port = int.from_bytes(data[i + 6:i + 8], 'big') ^ 0x2112
                    o = data[i + 8:i + 12]
                    ext = '%d.%d.%d.%d:%d' % (o[0] ^ 0x21, o[1] ^ 0x12, o[2] ^ 0xa4, o[3] ^ 0x42, port)
                    break
                i += 4 + ln + ((4 - ln % 4) % 4)
        return {'ok': True, 'ms': round(ms, 1), 'external': ext}
    except Exception as e:
        return {'ok': False, 'why': type(e).__name__}
    finally:
        s.close()


def _local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    finally:
        s.close()


# ---------------------------------------------------------- ההחלטה

def measure(domain, on_step=None):
    ip = socket.gethostbyname(domain)
    out = {'domain': domain, 'ip': ip, 'at': time.time(), 'results': {}}
    lock = threading.Lock()

    def run(c):
        r = probe_udp(domain, ip, c['port']) if c['proto'] == 'UDP' \
            else probe_tcp(domain, ip, c['port'], c['tls'])
        with lock:
            out['results'][c['key']] = dict(r, label=c['label'], rank=c['rank'], why=c['why'])
        if on_step:
            on_step(c['label'], r)

    ts = [threading.Thread(target=run, args=(c,)) for c in CANDIDATES]
    ts.append(threading.Thread(target=lambda: out.update(rtp=probe_rtp(ip))))
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    return out


def decide(m):
    """הכללים, לפי סדר. הראשון שמתקיים מנצח."""
    R = m['results']
    rtp_ok = (m.get('rtp') or {}).get('ok')
    ok = {k: v for k, v in R.items() if v.get('ok')}

    if not ok:
        return {'choice': None, 'level': 'bad',
                'reason': 'אף מסלול איתות לא נענה — הרשת חוסמת את המרכזייה לגמרי',
                'fix': 'בדקו חיבור לאינטרנט, ואם ברשת ארגונית — בקשו לפתוח את הדומיין'}

    u = R.get('udp', {})
    if u.get('ok') and u.get('ms', 9999) < 400:
        return {'choice': 'udp', 'level': 'ok' if rtp_ok else 'warn',
                'reason': 'UDP עובד ומגיב תוך %sms — התקורה הנמוכה ביותר וההתאוששות המהירה ביותר' % u['ms'],
                'fix': '' if rtp_ok else 'הקול עלול לא לעבור — UDP על פורטים גבוהים חסום'}

    t = R.get('tls', {})
    if t.get('ok'):
        return {'choice': 'tls', 'level': 'ok' if rtp_ok else 'bad',
                'reason': 'UDP חסום ברשת הזו. TLS עובר (%sms, לחיצת יד %sms) ונראה לחומת האש כ-HTTPS'
                          % (t.get('ms'), t.get('handshake')),
                'fix': '' if rtp_ok else 'האיתות יעבור אבל הקול לא — צריך לפתוח UDP יוצא לפורטים גבוהים'}

    c = R.get('tcp', {})
    if c.get('ok'):
        return {'choice': 'tcp', 'level': 'warn',
                'reason': 'רק TCP עובר. יעבוד, אך התאוששות מנפילות רשת תהיה איטית יותר',
                'fix': 'עדיף לבקש פתיחת UDP 5060 או TLS 5061'}

    w = R.get('wss', {})
    if w.get('ok'):
        return {'choice': 'wss', 'level': 'warn',
                'reason': 'רק WSS על 443 עובר — רשת מוגבלת מאוד',
                'fix': 'איכות הקול עלולה להיפגע. שווה לבקש פתיחת UDP.'}
    return {'choice': None, 'level': 'bad', 'reason': 'לא נמצא מסלול', 'fix': ''}


def select(domain, fresh=False, on_step=None):
    if not fresh:
        try:
            with open(CACHE, encoding='utf-8') as f:
                c = json.load(f)
            if c.get('domain') == domain and time.time() - c.get('at', 0) < TTL:
                c['cached'] = True
                return c
        except Exception:
            pass
    m = measure(domain, on_step)
    m.update(decide(m))
    try:
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE, 'w', encoding='utf-8') as f:
            json.dump(m, f, ensure_ascii=False)
    except Exception:
        pass
    return m


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    dom = sys.argv[1] if len(sys.argv) > 1 else None
    if not dom:
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            import creds
            dom = creds.load().get('domain', 'a1053.sip.io')
        except Exception:
            dom = 'a1053.sip.io'
    print('=' * 58)
    print(' בחירת מסלול · %s' % dom)
    print('=' * 58)
    m = select(dom, fresh=True)
    print('\nמסלולי איתות:')
    for k in ['udp', 'tls', 'tcp', 'wss']:
        r = m['results'].get(k) or {}
        mark = '✓' if r.get('ok') else '✗'
        det = ('%sms · תשובה %s' % (r.get('ms'), r.get('code'))) if r.get('ok') else r.get('why', '')
        print('  %s %-12s %s' % (mark, r.get('label', k), det))
    rtp = m.get('rtp') or {}
    print('\nערוץ קול (UDP פורטים גבוהים):')
    print('  %s %s' % ('✓' if rtp.get('ok') else '✗',
                       ('עובר · %sms · כתובת חיצונית %s' % (rtp.get('ms'), rtp.get('external')))
                       if rtp.get('ok') else 'חסום — ' + str(rtp.get('why'))))
    print('\n' + '-' * 58)
    print(' נבחר: %s' % (m.get('choice') or 'אין'))
    print(' %s' % m.get('reason'))
    if m.get('fix'):
        print(' → %s' % m['fix'])
    print('=' * 58)
