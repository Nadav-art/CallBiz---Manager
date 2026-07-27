# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · מחסנית SIP מקורית (UDP + RTP רגיל)
------------------------------------------------------------
 זה מה שהופך את החייגן ל"מכשיר" ולא ל"אתר".

 למה זה קיים:
   מנוע דפדפן חייב להצפין את המדיה (DTLS-SRTP), ולכן מכשיר
   שמוגדר במרכזייה כטלפון רגיל דוחה אותו ב-488. טלפון פיזי,
   וגם סופטפון מותקן, פותחים UDP בעצמם ושולחים RTP פשוט —
   וזה בדיוק מה שהקוד הזה עושה.

 התפקיד שלו בארכיטקטורה:
   הוא ה"סרוויס" המקומי של האפליקציה. הממשק נשאר כפי שהוא,
   ובמקום לדבר ישירות עם המרכזייה הוא מדבר עם התהליך הזה.
   כך המשתמש רואה אפליקציה אחת, והמרכזייה רואה מכשיר רגיל.

 מה ממומש:
   · REGISTER עם אתגר Digest (MD5, qop=auth)
   · INVITE עם SDP של G.711 μ-law — הקודק שכל מרכזייה מקבלת
   · טיפול ב-401 מהרשם וב-407 מה-proxy
   · ACK, BYE, וטיפול ב-Via/rport לזיהוי הכתובת החיצונית
   · שידור RTP אמיתי (צליל 440Hz מקודד μ-law) כדי שגם
     המדיה תיבדק ולא רק האיתות
============================================================
"""
import socket, hashlib, random, string, time, re, sys, struct, math, threading, io

# ---------------------------------------------------------- כלים

def rnd(n=10):
    return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(n))

def md5(s):
    if isinstance(s, str):
        s = s.encode('utf-8')
    return hashlib.md5(s).hexdigest()

def parse_auth(v):
    """ערכים מגיעים מצוטטים ולא־מצוטטים — שניהם חייבים לעבוד."""
    out = {}
    for m in re.finditer(r'([\w-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))', v or ''):
        out[m.group(1).lower()] = m.group(2) if m.group(2) is not None else m.group(3)
    return out

def digest(ch, user, pwd, method, uri, nc=1):
    ha1 = md5('%s:%s:%s' % (user, ch['realm'], pwd))
    ha2 = md5('%s:%s' % (method, uri))
    if ch.get('qop') and 'auth' in ch['qop']:
        cnonce, ncs = rnd(8), '%08x' % nc
        resp = md5('%s:%s:%s:%s:auth:%s' % (ha1, ch['nonce'], ncs, cnonce, ha2))
        extra = ', qop=auth, nc=%s, cnonce="%s"' % (ncs, cnonce)
    else:
        resp = md5('%s:%s:%s' % (ha1, ch['nonce'], ha2))
        extra = ''
    return ('Digest username="%s", realm="%s", nonce="%s", uri="%s", response="%s"%s%s'
            % (user, ch['realm'], ch['nonce'], uri, resp,
               ', opaque="%s"' % ch['opaque'] if ch.get('opaque') else '',
               (', algorithm=%s' % ch['algorithm'] if ch.get('algorithm') else '') + extra))

def status_of(msg):
    m = re.match(r'SIP/2\.0 (\d{3}) (.*)', msg.split('\r\n')[0])
    return (int(m.group(1)), m.group(2)) if m else (None, None)

def header(msg, name):
    m = re.search(r'^%s\s*:\s*(.+)$' % name, msg, re.I | re.M)
    return m.group(1).strip() if m else ''


# ---------------------------------------------------------- קידוד μ-law

def ulaw(sample):
    """PCM 16 ביט → G.711 μ-law. זה מה שנשלח על החוט."""
    BIAS, CLIP = 0x84, 32635
    sign = 0x80 if sample < 0 else 0
    if sign:
        sample = -sample
    sample = min(sample, CLIP) + BIAS
    exp = 7
    mask = 0x4000
    while exp > 0 and not (sample & mask):
        exp -= 1
        mask >>= 1
    mant = (sample >> (exp + 3)) & 0x0F
    return ~(sign | (exp << 4) | mant) & 0xFF

def tone_frame(phase, freq=440.0, n=160, rate=8000.0):
    """20 מילישניות של צליל — 160 דגימות ב-8kHz."""
    buf = bytearray()
    for i in range(n):
        v = int(math.sin(2 * math.pi * freq * (phase + i) / rate) * 8000)
        buf.append(ulaw(v))
    return bytes(buf), phase + n


# ---------------------------------------------------------- הלקוח

class NativeSip(object):

    def __init__(self, domain, user, pwd, port=5060, log=None):
        self.domain, self.user, self.pwd, self.port = domain, user, pwd, port
        self.log = log or (lambda s: sys.stdout.write(s + '\n'))
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(0.4)
        self.sock.bind(('0.0.0.0', 0))
        self.lport = self.sock.getsockname()[1]
        self.lip = self._local_ip()
        self.pub = None                    # הכתובת החיצונית, מתוך received/rport
        self.rport = None
        self.nat = None
        self.ip = socket.gethostbyname(domain)
        self.cseq = random.randint(100, 999)
        self.call_id = rnd(16) + '@callbiz-native'
        self.ftag = rnd(8)
        self.rtp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.rtp.bind(('0.0.0.0', 0))
        self.rtp_port = self.rtp.getsockname()[1]
        self.stop_rtp = False

    def _local_ip(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
        finally:
            s.close()

    # ---- תעבורה ----
    def send(self, msg):
        self.log('>>> ' + msg.split('\r\n')[0])
        self.sock.sendto(msg.encode('utf-8'), (self.ip, self.port))

    def recv(self, seconds=6):
        """אוסף תשובות עד שמגיעה סופית (>=200) או שנגמר הזמן."""
        end = time.time() + seconds
        out = []
        while time.time() < end:
            try:
                data, _ = self.sock.recvfrom(65535)
            except socket.timeout:
                continue
            msg = data.decode('utf-8', 'replace')
            code, reason = status_of(msg)
            if code:
                self.log('<<< SIP/2.0 %d %s' % (code, reason))
                out.append(msg)
                if code >= 200:
                    return out
            else:
                self.log('<<< ' + msg.split('\r\n')[0])
                out.append(msg)
        return out

    def _via(self, branch):
        return 'SIP/2.0/UDP %s:%d;branch=%s;rport' % (self.lip, self.lport, branch)

    def _contact(self):
        return '<sip:%s@%s:%d>' % (self.user, self.lip, self.lport)

    # ---- רישום ----
    def register(self, expires=300):
        uri = 'sip:' + self.domain
        for attempt in (1, 2):
            self.cseq += 1
            h = ['REGISTER %s SIP/2.0' % uri,
                 'Via: ' + self._via('z9hG4bK' + rnd()),
                 'Max-Forwards: 70',
                 'From: <sip:%s@%s>;tag=%s' % (self.user, self.domain, self.ftag),
                 'To: <sip:%s@%s>' % (self.user, self.domain),
                 'Call-ID: ' + self.call_id,
                 'CSeq: %d REGISTER' % self.cseq,
                 'Contact: ' + self._contact(),
                 'User-Agent: CallBiz-Native/1.0',
                 'Expires: %d' % expires]
            if attempt == 2:
                h.append('Authorization: ' + self.auth)
            h += ['Content-Length: 0', '', '']
            self.send('\r\n'.join(h))
            for msg in self.recv():
                code, _ = status_of(msg)
                if code == 401 and attempt == 1:
                    self._learn_public(msg)
                    ch = parse_auth(header(msg, 'WWW-Authenticate'))
                    self.auth = digest(ch, self.user, self.pwd, 'REGISTER', uri)
                    break
                if code == 200:
                    self._learn_public(msg)
                    return True
                if code and code >= 400:
                    return False
        return False

    def _learn_public(self, msg):
        """מגלה איך אנחנו נראים מבחוץ, מתוך ה-Via שחוזר.

        לא כל שרת מוסיף `received`. כשהוא חסר אין דרך לדעת את
        הכתובת החיצונית — וזה בסדר: אנחנו שולחים RTP ראשונים,
        והמרכזייה נועלת את היעד לפי מקור החבילות (symmetric RTP).
        מה שחשוב הוא לא לפרש היעדר `received` כתקלה.
        """
        v = header(msg, 'Via')
        r = re.search(r'received=([\d.]+)', v)
        p = re.search(r'rport=(\d+)', v)
        self.rport = int(p.group(1)) if p else None
        if r:
            self.pub = (r.group(1), self.rport or self.lport)
            self.nat = (r.group(1) != self.lip)
        elif p:
            # השרת ענה אך לא זיהה תרגום כתובת
            self.nat = False

    # ---- SDP ----
    def _sdp(self):
        ip = self.pub[0] if self.pub else self.lip
        return '\r\n'.join([
            'v=0',
            'o=- %d %d IN IP4 %s' % (int(time.time()), int(time.time()), ip),
            's=CallBiz',
            'c=IN IP4 %s' % ip,
            't=0 0',
            'm=audio %d RTP/AVP 0 101' % self.rtp_port,   # RTP רגיל — לא מוצפן
            'a=rtpmap:0 PCMU/8000',
            'a=rtpmap:101 telephone-event/8000',
            'a=fmtp:101 0-16',
            'a=ptime:20',
            'a=sendrecv', '']).replace('\r\n', '\r\n')

    # ---- חיוג ----
    def invite(self, dest, seconds=20):
        uri = 'sip:%s@%s' % (dest, self.domain)
        sdp = self._sdp()
        branch = 'z9hG4bK' + rnd()
        auth = None
        proxy = False
        icseq = None
        for attempt in (1, 2, 3):
            self.cseq += 1
            icseq = self.cseq
            h = ['INVITE %s SIP/2.0' % uri,
                 'Via: ' + self._via(branch),
                 'Max-Forwards: 70',
                 'From: <sip:%s@%s>;tag=%s' % (self.user, self.domain, self.ftag),
                 'To: <%s>' % uri,
                 'Call-ID: ' + self.call_id,
                 'CSeq: %d INVITE' % icseq,
                 'Contact: ' + self._contact(),
                 'User-Agent: CallBiz-Native/1.0',
                 'Allow: INVITE,ACK,CANCEL,BYE,OPTIONS,INFO',
                 'Supported: replaces']
            if auth:
                h.append(('Proxy-Authorization: ' if proxy else 'Authorization: ') + auth)
            h += ['Content-Type: application/sdp',
                  'Content-Length: %d' % len(sdp), '', sdp]
            self.send('\r\n'.join(h))

            final = None
            for msg in self.recv(seconds):
                code, reason = status_of(msg)
                if code in (401, 407):
                    self._ack(uri, msg, icseq, branch)
                    proxy = (code == 407)
                    ch = parse_auth(header(msg, 'Proxy-Authenticate' if proxy else 'WWW-Authenticate'))
                    auth = digest(ch, self.user, self.pwd, 'INVITE', uri)
                    branch = 'z9hG4bK' + rnd()
                    final = 'retry'
                    break
                if code == 180:
                    self.log('   *** הטלפון מצלצל ***')
                if code == 183:
                    self.log('   (מדיה מוקדמת)')
                if code == 200:
                    self._ack(uri, msg, icseq, branch, in_dialog=True)
                    return ('answered', msg)
                if code and code >= 300:
                    self._ack(uri, msg, icseq, branch)
                    return ('failed', '%d %s' % (code, reason))
            if final != 'retry':
                return ('timeout', None)
        return ('failed', 'auth')

    def _ack(self, uri, msg, cseq, branch, in_dialog=False):
        ttag = re.search(r';tag=([^;\s>]+)', header(msg, 'To'))
        to = '<%s>%s' % (uri, ';tag=' + ttag.group(1) if ttag else '')
        h = ['ACK %s SIP/2.0' % uri,
             'Via: ' + self._via(branch if not in_dialog else 'z9hG4bK' + rnd()),
             'Max-Forwards: 70',
             'From: <sip:%s@%s>;tag=%s' % (self.user, self.domain, self.ftag),
             'To: ' + to,
             'Call-ID: ' + self.call_id,
             'CSeq: %d ACK' % cseq,
             'Content-Length: 0', '', '']
        self.send('\r\n'.join(h))

    def bye(self, dest, to_tag):
        uri = 'sip:%s@%s' % (dest, self.domain)
        self.cseq += 1
        h = ['BYE %s SIP/2.0' % uri,
             'Via: ' + self._via('z9hG4bK' + rnd()),
             'Max-Forwards: 70',
             'From: <sip:%s@%s>;tag=%s' % (self.user, self.domain, self.ftag),
             'To: <%s>%s' % (uri, ';tag=' + to_tag if to_tag else ''),
             'Call-ID: ' + self.call_id,
             'CSeq: %d BYE' % self.cseq,
             'Content-Length: 0', '', '']
        self.send('\r\n'.join(h))
        self.recv(2)

    # ---- מדיה ----
    def stream_rtp(self, host, port, seconds=20):
        """שידור RTP אמיתי. שולחים ראשונים כדי שה-NAT ייפתח
        והמרכזייה תדע לאן להחזיר (symmetric RTP)."""
        ssrc = random.randint(0, 2 ** 31)
        seq = random.randint(0, 60000)
        ts = 0
        phase = 0
        end = time.time() + seconds
        while time.time() < end and not self.stop_rtp:
            payload, phase = tone_frame(phase)
            hdr = struct.pack('!BBHII', 0x80, 0, seq & 0xFFFF, ts & 0xFFFFFFFF, ssrc)
            try:
                self.rtp.sendto(hdr + payload, (host, port))
            except Exception:
                break
            seq += 1
            ts += 160
            time.sleep(0.02)


# ---------------------------------------------------------- הרצה

def main():
    domain = sys.argv[1] if len(sys.argv) > 1 else 'a1053.sip.io'
    user = sys.argv[2] if len(sys.argv) > 2 else ''
    pwd = sys.argv[3] if len(sys.argv) > 3 else ''
    dest = sys.argv[4] if len(sys.argv) > 4 else ''

    c = NativeSip(domain, user, pwd)
    print('מקומי  %s:%d   RTP:%d' % (c.lip, c.lport, c.rtp_port))
    print('שרת    %s (%s:%d)' % (domain, c.ip, c.port))
    print('-' * 52)

    if not c.register():
        print('\nהרישום נכשל.')
        return 1
    print('\n*** רשום למרכזייה ***')
    if c.pub:
        print('הכתובת החיצונית שלנו: %s:%d' % c.pub)
    if not dest:
        return 0

    print('\nמחייג ל-%s ...\n' % dest)
    state, info = c.invite(dest)
    if state != 'answered':
        print('\nהשיחה לא נענתה: %s' % (info,))
        return 1

    print('\n*** נענתה ***')
    m = re.search(r'm=audio (\d+)', info)
    ci = re.search(r'c=IN IP4 ([\d.]+)', info)
    if m and ci:
        print('שולח RTP ל-%s:%s' % (ci.group(1), m.group(1)))
        c.stream_rtp(ci.group(1), int(m.group(1)), 15)
    ttag = re.search(r';tag=([^;\s>]+)', header(info, 'To'))
    c.bye(dest, ttag.group(1) if ttag else None)
    print('\nהשיחה הסתיימה.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
