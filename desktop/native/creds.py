# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · אחסון מוצפן של פרטי גישה
------------------------------------------------------------
 סיסמת השלוחה ומפתח ה-API לא נשמרים כטקסט. הם מוצפנים ב-DPAPI
 של Windows — שירות ההצפנה המובנה של מערכת ההפעלה.

 מה זה נותן בפועל:
   המפתח שמצפין נגזר מחשבון המשתמש ומהמחשב. קובץ שיועתק
   למחשב אחר, או ייפתח על ידי משתמש אחר באותו מחשב, לא ניתן
   לפענוח. אין סוד בקוד שלנו שאפשר לחלץ.

 מה זה לא נותן:
   הגנה מפני המשתמש עצמו על המחשב שלו. אין מנגנון מקומי שנותן
   את זה, בשום תוכנה. לכן מפתח ה-API של החשבון כולו לא אמור
   לרדת למחשב הנציג מלכתחילה — הוא שייך לשרת. כאן נשמרים
   פרטים אישיים של הנציג בלבד.
============================================================
"""
import ctypes, ctypes.wintypes as wt, json, os, io, base64

CRYPTPROTECT_UI_FORBIDDEN = 0x01


class _BLOB(ctypes.Structure):
    _fields_ = [('cbData', wt.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]


def _blob(data):
    b = ctypes.create_string_buffer(data, len(data))
    return _BLOB(len(data), ctypes.cast(b, ctypes.POINTER(ctypes.c_char)))


def _out(blob):
    n = blob.cbData
    buf = ctypes.create_string_buffer(n)
    ctypes.memmove(buf, blob.pbData, n)
    ctypes.windll.kernel32.LocalFree(blob.pbData)
    return buf.raw


def protect(data, entropy=b'CallBizDesktop'):
    """הצפנה. entropy מוסיף שכבה — גם תוכנה אחרת של אותו משתמש
    לא תוכל לפענח בלי לדעת אותו."""
    if isinstance(data, str):
        data = data.encode('utf-8')
    out = _BLOB()
    ok = ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(_blob(data)), u'CallBiz', ctypes.byref(_blob(entropy)),
        None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out))
    if not ok:
        raise OSError('CryptProtectData failed')
    return _out(out)


def unprotect(blob, entropy=b'CallBizDesktop'):
    out = _BLOB()
    ok = ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(_blob(blob)), None, ctypes.byref(_blob(entropy)),
        None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out))
    if not ok:
        raise OSError('CryptUnprotectData failed — קובץ ממחשב או ממשתמש אחר')
    return _out(out).decode('utf-8')


# ---------------------------------------------------------- הכספת

def _path():
    d = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'CallBiz')
    if not os.path.isdir(d):
        os.makedirs(d)
    return os.path.join(d, 'creds.dat')


def save(**fields):
    """שומר/מעדכן שדות. מה שלא נשלח — נשאר כפי שהיה."""
    cur = load()
    cur.update({k: v for k, v in fields.items() if v is not None})
    with open(_path(), 'wb') as f:
        f.write(protect(json.dumps(cur, ensure_ascii=False)))
    return cur


def load():
    p = _path()
    if not os.path.exists(p):
        return {}
    try:
        with open(p, 'rb') as f:
            return json.loads(unprotect(f.read()))
    except Exception:
        return {}


def clear():
    p = _path()
    if os.path.exists(p):
        os.remove(p)
        return True
    return False


if __name__ == '__main__':
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'show'
    if cmd == 'set':
        save(**dict(a.split('=', 1) for a in sys.argv[2:]))
        print('נשמר מוצפן ב-%s' % _path())
    elif cmd == 'clear':
        print('נמחק' if clear() else 'אין מה למחוק')
    else:
        d = load()
        print('קובץ: %s' % _path())
        for k, v in d.items():
            print('  %-12s %s' % (k, ('•' * 8 + str(v)[-4:]) if len(str(v)) > 6 else '••••'))
        if not d:
            print('  (ריק)')
