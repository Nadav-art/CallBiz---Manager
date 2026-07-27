# -*- coding: utf-8 -*-
"""
Check-in ואז חיוג — שני שלבים ברצף.
שימוש:  python checkin.py **7436 0535317347
"""
import sys, io, re, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
exec(open('sipnative.py', encoding='utf-8').read().replace("if __name__ ==", "if False and __name__ =="))

DOMAIN, USER, PWD = 'a1053.sip.io', 'd146106', 'h6PYEs8WdYsuCIvTo'
code = sys.argv[1] if len(sys.argv) > 1 else None
dest = sys.argv[2] if len(sys.argv) > 2 else None


def run(target, rtp_seconds, label):
    c = NativeSip(DOMAIN, USER, PWD)
    if not c.register():
        print('  רישום נכשל')
        return None
    print('--- %s : %s ---' % (label, target))
    st = c.invite(target, seconds=25)
    print('  => %s %s' % (st[0], st[1] if isinstance(st[1], str) else ''))
    if st[0] == 'answered':
        m = re.search(r'm=audio (\d+)', st[1])
        ci = re.search(r'c=IN IP4 ([\d.]+)', st[1])
        if m and ci:
            print('  משדר RTP ל-%s:%s למשך %ds' % (ci.group(1), m.group(1), rtp_seconds))
            c.stream_rtp(ci.group(1), int(m.group(1)), rtp_seconds)
        t = re.search(r';tag=([^;\s>]+)', header(st[1], 'To'))
        c.bye(target, t.group(1) if t else None)
    return st[0]


if code:
    run(code, 8, 'check-in')
    time.sleep(2)
if dest:
    run(dest, 15, 'חיוג')
