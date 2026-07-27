# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · אשף התקנה
------------------------------------------------------------
 מה שהנציג ממלא: מזהה נציג. זהו.

 כל השאר נשלף מהמרכזייה — שם, שלוחה, מכשיר, מספר מזוהה. אם
 חסר משהו שאי אפשר לשלוף (סיסמת המכשיר אינה נחשפת ב-API),
 האשף מבקש רק אותו, ורק אם הוא באמת חסר.

 הפרטים נשמרים מוצפנים ב-DPAPI של Windows, לא בקובץ טקסט
 ולא בקוד.

 רץ על Tkinter שמגיע עם Python — בלי התקנות נוספות.
============================================================
"""
import sys, os, io, json, ssl, threading, re
import urllib.request, urllib.parse
import tkinter as tk
from tkinter import ttk, messagebox

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())
import creds


def org():
    """תצורת הארגון — נוסעת עם התיקייה ואינה סודית.
    בזכותה הנציג מזין מזהה בלבד."""
    try:
        with open('org.json', encoding='utf-8') as f:
            return {k: v for k, v in json.load(f).items() if not k.startswith('_')}
    except Exception:
        return {}


ORG = org()

CTX = ssl.create_default_context()
BG, CARD, FG, MUTED, ACC = '#f4f5f7', '#ffffff', '#111827', '#6b7280', '#2563eb'
OK, BAD = '#16a34a', '#dc2626'


def api(base, key, path, **p):
    p['api_key'] = key
    url = base.rstrip('/') + path + '?' + urllib.parse.urlencode(
        {k: v for k, v in p.items() if v not in (None, '')})
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, headers={'User-Agent': 'CallBiz-Setup/1.0'}),
            timeout=15, context=CTX)
        return json.loads(r.read().decode('utf-8', 'replace'))
    except Exception as e:
        return {'success': False, 'msg': str(e)[:140]}


class Setup(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title('CallBiz Desktop · התקנה')
        self.configure(bg=BG)
        self.geometry('560x640')
        self.resizable(False, False)
        self.C = creds.load()
        self.profile = None
        self._build()
        self._prefill()

    # ---------------- עזרי עיצוב ----------------
    def _card(self, parent, title, subtitle=None):
        f = tk.Frame(parent, bg=CARD, bd=0, highlightthickness=1,
                     highlightbackground='#e5e7eb')
        f.pack(fill='x', padx=18, pady=(0, 12))
        tk.Label(f, text=title, bg=CARD, fg=FG, font=('Segoe UI', 11, 'bold'),
                 anchor='e', justify='right').pack(fill='x', padx=14, pady=(12, 0))
        if subtitle:
            tk.Label(f, text=subtitle, bg=CARD, fg=MUTED, font=('Segoe UI', 9),
                     anchor='e', justify='right', wraplength=470).pack(fill='x', padx=14, pady=(2, 0))
        return f

    def _field(self, parent, label, hint='', show=None, width=32):
        row = tk.Frame(parent, bg=CARD)
        row.pack(fill='x', padx=14, pady=(10, 0))
        tk.Label(row, text=label, bg=CARD, fg=FG, font=('Segoe UI', 9, 'bold'),
                 anchor='e').pack(fill='x')
        e = tk.Entry(row, font=('Consolas', 11), justify='left', width=width,
                     relief='solid', bd=1, show=show)
        e.pack(fill='x', pady=(3, 0), ipady=4)
        if hint:
            tk.Label(row, text=hint, bg=CARD, fg=MUTED, font=('Segoe UI', 8),
                     anchor='e', justify='right', wraplength=470).pack(fill='x', pady=(2, 0))
        return e

    # ---------------- מבנה ----------------
    def _build(self):
        head = tk.Frame(self, bg=BG)
        head.pack(fill='x', pady=(16, 12))
        tk.Label(head, text='CallBiz Desktop', bg=BG, fg=FG,
                 font=('Segoe UI', 17, 'bold')).pack()
        tk.Label(head, text='חיבור לשולחן העבודה של הנציג', bg=BG, fg=MUTED,
                 font=('Segoe UI', 10)).pack()

        c1 = self._card(self, 'פרטי הנציג',
                        'הזינו את מזהה הנציג שקיבלתם. את השאר המערכת תשלוף לבד.')
        self.e_user = self._field(c1, 'מזהה נציג', 'המספר שמופיע בכרטיס העובד במרכזייה')
        tk.Frame(c1, bg=CARD, height=10).pack()

        adv = tk.Frame(c1, bg=CARD)
        adv.pack(fill='x')
        self.show_adv = tk.BooleanVar(value=False)
        tk.Checkbutton(adv, text='הגדרות ארגון (למנהל, פעם אחת)', variable=self.show_adv,
                       command=self._toggle_adv, bg=CARD, fg=MUTED, font=('Segoe UI', 9),
                       activebackground=CARD, anchor='e', selectcolor=CARD).pack(fill='x', padx=10, pady=(0, 8))

        self.adv_box = tk.Frame(c1, bg=CARD)
        self.e_base = self._field(self.adv_box, 'כתובת המרכזייה', 'לדוגמה https://callbiz.contaqt.com')
        self.e_key = self._field(self.adv_box, 'מפתח API', 'נוצר במשתמש API ייעודי · אבטחה → API Auth Key', show='•')
        self.e_domain = self._field(self.adv_box, 'דומיין SIP', 'ה-FS Domain של החשבון')
        tk.Frame(self.adv_box, bg=CARD, height=10).pack()

        btns = tk.Frame(self, bg=BG)
        btns.pack(fill='x', padx=18)
        self.b_fetch = tk.Button(btns, text='אתר את הנציג', command=self._fetch,
                                 bg=ACC, fg='white', font=('Segoe UI', 10, 'bold'),
                                 relief='flat', padx=18, pady=7, cursor='hand2')
        self.b_fetch.pack(side='right')
        self.lbl_status = tk.Label(btns, text='', bg=BG, fg=MUTED, font=('Segoe UI', 9),
                                   anchor='e', justify='right', wraplength=340)
        self.lbl_status.pack(side='right', padx=(0, 12))

        self.c2 = self._card(self, 'מה נמצא', None)
        self.found = tk.Frame(self.c2, bg=CARD)
        self.found.pack(fill='x', padx=14, pady=(6, 12))
        tk.Label(self.found, text='טרם בוצע איתור', bg=CARD, fg=MUTED,
                 font=('Segoe UI', 9), anchor='e').pack(fill='x')

        self.c3 = self._card(self, 'סיסמת המכשיר',
                             'הסיסמה אינה נחשפת ב-API ולכן צריך להזין אותה פעם אחת. '
                             'היא תישמר מוצפנת במחשב הזה בלבד.')
        self.e_pass = self._field(self.c3, 'סיסמה', '', show='•')
        tk.Frame(self.c3, bg=CARD, height=12).pack()

        foot = tk.Frame(self, bg=BG)
        foot.pack(fill='x', padx=18, pady=(4, 16))
        self.b_save = tk.Button(foot, text='שמור והתחבר', command=self._save,
                                bg=OK, fg='white', font=('Segoe UI', 10, 'bold'),
                                relief='flat', padx=18, pady=7, cursor='hand2', state='disabled')
        self.b_save.pack(side='right')
        tk.Button(foot, text='בדיקת מערכת', command=self._selftest, bg='#e5e7eb', fg=FG,
                  font=('Segoe UI', 9), relief='flat', padx=14, pady=7,
                  cursor='hand2').pack(side='right', padx=(0, 8))

    def _toggle_adv(self):
        if self.show_adv.get():
            self.adv_box.pack(fill='x')
        else:
            self.adv_box.pack_forget()

    def _prefill(self):
        # סדר העדיפות: מה שכבר נשמר במחשב, ואז תצורת הארגון
        self.e_base.insert(0, self.C.get('base') or ORG.get('base', 'https://callbiz.contaqt.com'))
        self.e_domain.insert(0, self.C.get('domain') or ORG.get('domain', ''))
        key = self.C.get('api_key') or ORG.get('api_key', '')
        if key:
            self.e_key.insert(0, key)
        if self.C.get('user_id'):
            self.e_user.insert(0, str(self.C['user_id']))
        if self.C.get('sip_pass'):
            self.e_pass.insert(0, self.C['sip_pass'])
        # פותחים את הגדרות הארגון רק כשבאמת חסר משהו
        if not (self.C.get('api_key') or ORG.get('api_key')):
            self.show_adv.set(True)
            self._toggle_adv()

    # ---------------- איתור ----------------
    def _status(self, text, color=MUTED):
        self.lbl_status.config(text=text, fg=color)
        self.update_idletasks()

    def _fetch(self):
        uid = self.e_user.get().strip()
        key = self.e_key.get().strip()
        base = self.e_base.get().strip() or 'https://callbiz.contaqt.com'
        if not uid:
            return self._status('הזינו מזהה נציג', BAD)
        if not key:
            self.show_adv.set(True); self._toggle_adv()
            return self._status('חסר מפתח API — פתחו את הגדרות הארגון', BAD)
        self.b_fetch.config(state='disabled')
        self._status('מאתר…')
        threading.Thread(target=self._fetch_bg, args=(base, key, uid), daemon=True).start()

    def _fetch_bg(self, base, key, uid):
        r = api(base, key, '/api/user/' + uid)
        self.after(0, lambda: self._fetch_done(base, key, uid, r))

    def _fetch_done(self, base, key, uid, r):
        self.b_fetch.config(state='normal')
        for w in self.found.winfo_children():
            w.destroy()
        if not r.get('success'):
            self._status(r.get('msg') or 'הנציג לא נמצא', BAD)
            tk.Label(self.found, text='לא נמצא נציג עם המזהה הזה, או שהמפתח אינו תקף.',
                     bg=CARD, fg=BAD, font=('Segoe UI', 9), anchor='e').pack(fill='x')
            return
        d = r.get('data') or {}
        devs = d.get('devices') or []
        # המכשיר המועדף: לא מכשיר הווב ולא הנייד
        web = d.get('web_device_id')
        pick = None
        for row in devs:
            if row[0] != web and not str(row[4] if len(row) > 4 else '').startswith('Mob-'):
                pick = row
                break
        pick = pick or (devs[0] if devs else None)

        self.profile = {
            'base': base, 'api_key': key, 'user_id': uid,
            'name': d.get('name'), 'dids': d.get('dids') or [],
            'extensions': d.get('extensions') or [],
            'device_id': pick[0] if pick else None,
            'device_name': (pick[4] if pick and len(pick) > 4 else ''),
            'sip_user': 'd%s' % pick[0] if pick else '',
            'web_device_id': web, 'active': d.get('active'),
        }
        dom = self.e_domain.get().strip() or self.C.get('domain', '')
        self.profile['domain'] = dom

        # שליפת סיסמת המכשיר — נקודת הקצה של המכשירים חושפת אותה,
        # ולכן הנציג לא צריך להקליד כלום.
        if pick:
            dr = api(base, key, '/api/device/%s' % pick[0])
            if dr.get('success'):
                dd = dr.get('data') or {}
                self.profile['sip_pass'] = dd.get('password') or ''
                self.profile['device_active'] = dd.get('active')
                if dd.get('name'):
                    self.profile['device_name'] = dd['name']

        rows = [
            ('נציג', d.get('name')),
            ('פעיל', 'כן' if d.get('active') in (1, True) else 'לא'),
            ('שלוחה', ', '.join(map(str, self.profile['extensions'])) or '—'),
            ('מספר מזוהה', ', '.join(self.profile['dids']) or '— חסר, החיוג ייכשל'),
            ('מכשיר', '%s (%s)' % (self.profile['device_name'], self.profile['device_id'])
             if pick else '— לא נמצא מכשיר'),
            ('שם משתמש SIP', self.profile['sip_user'] or '—'),
            ('סיסמה', 'נשלפה אוטומטית' if self.profile.get('sip_pass') else 'לא נשלפה — נדרשת הזנה'),
        ]
        for k, v in rows:
            line = tk.Frame(self.found, bg=CARD)
            line.pack(fill='x', pady=1)
            tk.Label(line, text=str(v), bg=CARD, fg=FG, font=('Segoe UI', 9),
                     anchor='w').pack(side='left')
            tk.Label(line, text=k, bg=CARD, fg=MUTED, font=('Segoe UI', 9),
                     anchor='e').pack(side='right')

        if not dom:
            self.show_adv.set(True); self._toggle_adv()
            self._status('חסר דומיין SIP — הוסיפו בהגדרות הארגון', BAD)
            return
        if not pick:
            return self._status('לנציג אין מכשיר מתאים במרכזייה', BAD)
        if self.profile.get('sip_pass'):
            # אין מה למלא — מסתירים את שדה הסיסמה לגמרי
            self.e_pass.delete(0, 'end')
            self.e_pass.insert(0, self.profile['sip_pass'])
            self.c3.pack_forget()
            self._status('הכל נשלף אוטומטית · אפשר לשמור', OK)
        else:
            self.c3.pack(fill='x', padx=18, pady=(0, 12))
            self._status('נמצא · חסרה רק סיסמה', OK)
        self.b_save.config(state='normal')

    # ---------------- שמירה ----------------
    def _save(self):
        if not self.profile:
            return
        pwd = self.e_pass.get().strip()
        if not pwd:
            return messagebox.showwarning('חסר', 'הזינו את סיסמת המכשיר')
        creds.save(base=self.profile['base'], api_key=self.profile['api_key'],
                   user_id=self.profile['user_id'], device_id=self.profile['device_id'],
                   sip_user=self.profile['sip_user'], sip_pass=pwd,
                   domain=self.profile['domain'],
                   did=(self.profile['dids'] or [''])[0],
                   web_device_id=self.profile['web_device_id'])
        self._status('נשמר מוצפן · מתחבר…', OK)
        threading.Thread(target=self._connect_bg, daemon=True).start()

    def _connect_bg(self):
        import subprocess
        r = subprocess.run([sys.executable, 'autoconnect.py'], capture_output=True,
                           text=True, encoding='utf-8', errors='replace', timeout=120)
        out = (r.stdout or '') + (r.stderr or '')
        good = 'רשום' in out
        self.after(0, lambda: self._connect_done(good, out))

    def _connect_done(self, good, out):
        if good:
            self._status('מחובר למרכזייה', OK)
            messagebox.showinfo('הושלם', 'החיבור הצליח. אפשר לסגור את החלון ולהפעיל את המערכת.')
        else:
            self._status('החיבור נכשל', BAD)
            self._log(out)

    def _selftest(self):
        self._status('מריץ בדיקות…')
        threading.Thread(target=self._selftest_bg, daemon=True).start()

    def _selftest_bg(self):
        import subprocess
        r = subprocess.run([sys.executable, 'selftest.py'], capture_output=True,
                           text=True, encoding='utf-8', errors='replace', timeout=180)
        self.after(0, lambda: self._log((r.stdout or '') + (r.stderr or '')))

    def _log(self, text):
        w = tk.Toplevel(self)
        w.title('תוצאות')
        w.geometry('720x520')
        t = tk.Text(w, font=('Consolas', 9), wrap='none', bg='#0f1115', fg='#d7dae0')
        t.pack(fill='both', expand=True)
        t.insert('1.0', text)
        t.config(state='disabled')
        self._status('הסתיים')


if __name__ == '__main__':
    Setup().mainloop()
