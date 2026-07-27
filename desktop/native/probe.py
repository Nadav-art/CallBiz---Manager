# -*- coding: utf-8 -*-
"""בידוד סיבת ה-480: מזהה מתקשר, קידומת יציאה, או היעד עצמו."""
import sys, io, re, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
src = open('sipnative.py', encoding='utf-8').read().replace("if __name__ ==", "if False and __name__ ==")
exec(src)

DOMAIN, USER, PWD = 'a1053.sip.io', 'd146106', 'h6PYEs8WdYsuCIvTo'


class Probe(NativeSip):
    """מאפשר להחליף את מזהה המתקשר בכותרת From."""
    from_user = None

    def _from(self):
        return '<sip:%s@%s>;tag=%s' % (self.from_user or self.user, self.domain, self.ftag)

    def invite(self, dest, seconds=15):
        uri = 'sip:%s@%s' % (dest, self.domain)
        sdp = self._sdp()
        branch = 'z9hG4bK' + rnd()
        auth, proxy, icseq = None, False, None
        for _ in (1, 2, 3):
            self.cseq += 1
            icseq = self.cseq
            h = ['INVITE %s SIP/2.0' % uri,
                 'Via: ' + self._via(branch), 'Max-Forwards: 70',
                 'From: ' + self._from(), 'To: <%s>' % uri,
                 'Call-ID: ' + self.call_id, 'CSeq: %d INVITE' % icseq,
                 'Contact: ' + self._contact(), 'User-Agent: CallBiz-Native/1.0',
                 'Allow: INVITE,ACK,CANCEL,BYE,OPTIONS,INFO']
            if auth:
                h.append(('Proxy-Authorization: ' if proxy else 'Authorization: ') + auth)
            h += ['Content-Type: application/sdp', 'Content-Length: %d' % len(sdp), '', sdp]
            self.send('\r\n'.join(h))
            retry = False
            for msg in self.recv(seconds):
                code, reason = status_of(msg)
                if code in (401, 407):
                    self._ack(uri, msg, icseq, branch)
                    proxy = (code == 407)
                    ch = parse_auth(header(msg, 'Proxy-Authenticate' if proxy else 'WWW-Authenticate'))
                    auth = digest(ch, self.user, PWD, 'INVITE', uri)
                    branch = 'z9hG4bK' + rnd()
                    retry = True
                    break
                if code == 180:
                    self.log('   *** מצלצל ***')
                if code == 200:
                    self._ack(uri, msg, icseq, branch, in_dialog=True)
                    return ('answered', msg)
                if code and code >= 300:
                    self._ack(uri, msg, icseq, branch)
                    return ('failed', '%d %s' % (code, reason), msg)
            if not retry:
                return ('timeout', None, '')
        return ('failed', 'auth', '')


TESTS = [
    ('מזהה DID 0779577969', '0779577969', '0535317347'),
    ('מזהה DID 0779555100', '0779555100', '0535317347'),
    ('מזהה 972535317347', None, '972535317347'),
    ('קידומת יציאה 9',     None, '90535317347'),
    ('קידומת יציאה 0',     None, '00535317347'),
    ('שלוחה פנימית 100',   None, '100'),
    ('תא קולי *97',        None, '*97'),
]

for name, cid, dest in TESTS:
    p = Probe(DOMAIN, USER, PWD, log=lambda s: None)
    if not p.register():
        print('%-24s רישום נכשל' % name)
        continue
    p.from_user = cid
    r = p.invite(dest)
    detail = ''
    if len(r) > 2 and r[2]:
        for hdr in ('Reason', 'Warning', 'X-Reason'):
            v = header(r[2], hdr)
            if v:
                detail += '  [%s: %s]' % (hdr, v)
    print('%-24s → %-14s %s%s' % (name, dest, r[1], detail))
    time.sleep(1)
