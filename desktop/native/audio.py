# -*- coding: utf-8 -*-
"""
============================================================
 CallBiz Desktop · שמע דו-כיווני
------------------------------------------------------------
 מיקרופון → רשת, ורשת → אוזניות. שני הכיוונים במקביל.

 עובד ישירות מול WinMM — ממשק השמע של Windows — דרך ctypes.
 בלי pyaudio, בלי ספריות חיצוניות, בלי הידור. זה מה שמאפשר
 להריץ את המערכת על עמדה בלי להתקין עליה כלום.

 הזרימה בשיחה:

   waveIn  →  PCM 16bit 8kHz  →  μ-law  →  RTP  →  המרכזייה
   המרכזייה  →  RTP  →  μ-law  →  PCM  →  waveOut

 למה 8kHz ו-μ-law: זה בדיוק מה ש-G.711 דורש, וזה מה שהמרכזייה
 מסכימה לו. חבילה כל 20ms = 160 דגימות = 160 בייט.

 שני דברים שחשוב שיהיו נכונים, אחרת השיחה נשמעת רע:
   · מאגר יציב — אם הפלט מתרוקן נשמע קטיעות. מחזיקים תור קצר.
   · שליחה בקצב אחיד — לא "כשמתחשק", אלא כל 20ms בדיוק.
============================================================
"""
import ctypes, ctypes.wintypes as wt, threading, time, collections, struct, math

winmm = ctypes.windll.winmm

RATE, WIDTH, CH = 8000, 16, 1
FRAME = 160                      # 20ms ב-8kHz
FRAME_BYTES = FRAME * 2
WAVE_FORMAT_PCM = 1
WHDR_DONE = 0x00000001
CALLBACK_NULL = 0


class WAVEFORMATEX(ctypes.Structure):
    _fields_ = [('wFormatTag', wt.WORD), ('nChannels', wt.WORD),
                ('nSamplesPerSec', wt.DWORD), ('nAvgBytesPerSec', wt.DWORD),
                ('nBlockAlign', wt.WORD), ('wBitsPerSample', wt.WORD),
                ('cbSize', wt.WORD)]


class WAVEHDR(ctypes.Structure):
    pass


WAVEHDR._fields_ = [
    ('lpData', ctypes.c_char_p), ('dwBufferLength', wt.DWORD),
    ('dwBytesRecorded', wt.DWORD), ('dwUser', ctypes.POINTER(wt.DWORD)),
    ('dwFlags', wt.DWORD), ('dwLoops', wt.DWORD),
    ('lpNext', ctypes.POINTER(WAVEHDR)), ('reserved', ctypes.POINTER(wt.DWORD))]


def _fmt():
    f = WAVEFORMATEX()
    f.wFormatTag = WAVE_FORMAT_PCM
    f.nChannels = CH
    f.nSamplesPerSec = RATE
    f.wBitsPerSample = WIDTH
    f.nBlockAlign = CH * WIDTH // 8
    f.nAvgBytesPerSec = RATE * f.nBlockAlign
    f.cbSize = 0
    return f


# ---------------------------------------------------------- G.711 μ-law

def _build_tables():
    """טבלאות המרה — מחושבות פעם אחת, כי קידוד לכל דגימה בזמן
    אמת בפייתון יקר מדי."""
    enc = bytearray(65536)
    BIAS, CLIP = 0x84, 32635
    for i in range(65536):
        s = i - 32768
        sign = 0x80 if s < 0 else 0
        if sign:
            s = -s
        s = min(s, CLIP) + BIAS
        exp, mask = 7, 0x4000
        while exp > 0 and not (s & mask):
            exp -= 1
            mask >>= 1
        mant = (s >> (exp + 3)) & 0x0F
        enc[i] = ~(sign | (exp << 4) | mant) & 0xFF
    dec = []
    for u in range(256):
        u = ~u & 0xFF
        sign, exp, mant = u & 0x80, (u >> 4) & 0x07, u & 0x0F
        v = ((mant << 3) + BIAS) << exp
        v -= BIAS
        dec.append(-v if sign else v)
    return bytes(enc), dec


ENC, DEC = _build_tables()
_DEC_STRUCT = struct.Struct('<160h')


def pcm_to_ulaw(pcm):
    """PCM 16 ליטל-אנדיאן → μ-law."""
    n = len(pcm) // 2
    vals = struct.unpack_from('<%dh' % n, pcm)
    return bytes(ENC[(v + 32768) & 0xFFFF] for v in vals)


def ulaw_to_pcm(u):
    return struct.pack('<%dh' % len(u), *(DEC[b] for b in u))


# ---------------------------------------------------------- פלט

class Speaker(object):
    """ניגון רציף. כותבים אליו מסגרות, והוא דואג שהזרימה תישאר
    חלקה גם כשהרשת מגמגמת."""

    N = 8          # מספר מאגרים במחזור

    def __init__(self, device=-1):
        self.h = wt.HANDLE()
        f = _fmt()
        r = winmm.waveOutOpen(ctypes.byref(self.h), device, ctypes.byref(f),
                              0, 0, CALLBACK_NULL)
        if r:
            raise OSError('waveOutOpen נכשל (%d) — אין התקן פלט' % r)
        self.bufs, self.hdrs = [], []
        for _ in range(self.N):
            b = ctypes.create_string_buffer(FRAME_BYTES)
            hd = WAVEHDR()
            hd.lpData = ctypes.cast(b, ctypes.c_char_p)
            hd.dwBufferLength = FRAME_BYTES
            hd.dwFlags = 0
            winmm.waveOutPrepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            hd.dwFlags |= WHDR_DONE
            self.bufs.append(b)
            self.hdrs.append(hd)
        self.i = 0
        self.underruns = 0

    def write(self, pcm):
        hd = self.hdrs[self.i]
        if not (hd.dwFlags & WHDR_DONE):
            self.underruns += 1        # המאגר עוד מנוגן — מדלגים
            return False
        b = self.bufs[self.i]
        pcm = pcm[:FRAME_BYTES].ljust(FRAME_BYTES, b'\x00')
        ctypes.memmove(b, pcm, FRAME_BYTES)
        hd.dwFlags &= ~WHDR_DONE
        hd.dwBufferLength = FRAME_BYTES
        winmm.waveOutWrite(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
        self.i = (self.i + 1) % self.N
        return True

    def close(self):
        try:
            winmm.waveOutReset(self.h)
            for hd in self.hdrs:
                winmm.waveOutUnprepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            winmm.waveOutClose(self.h)
        except Exception:
            pass


# ---------------------------------------------------------- קלט

class Mic(object):
    """קליטה רציפה מהמיקרופון. read() מחזיר מסגרת או None."""

    N = 8

    def __init__(self, device=-1):
        self.h = wt.HANDLE()
        f = _fmt()
        r = winmm.waveInOpen(ctypes.byref(self.h), device, ctypes.byref(f),
                             0, 0, CALLBACK_NULL)
        if r:
            raise OSError('waveInOpen נכשל (%d) — אין מיקרופון' % r)
        self.bufs, self.hdrs = [], []
        for _ in range(self.N):
            b = ctypes.create_string_buffer(FRAME_BYTES)
            hd = WAVEHDR()
            hd.lpData = ctypes.cast(b, ctypes.c_char_p)
            hd.dwBufferLength = FRAME_BYTES
            hd.dwFlags = 0
            winmm.waveInPrepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            winmm.waveInAddBuffer(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            self.bufs.append(b)
            self.hdrs.append(hd)
        self.i = 0
        winmm.waveInStart(self.h)
        self.level = 0

    def read(self):
        hd = self.hdrs[self.i]
        if not (hd.dwFlags & WHDR_DONE):
            return None
        data = self.bufs[self.i].raw[:FRAME_BYTES]
        hd.dwFlags &= ~WHDR_DONE
        winmm.waveInPrepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
        winmm.waveInAddBuffer(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
        self.i = (self.i + 1) % self.N
        # עוצמה — לזיהוי "מיקרופון מחובר אבל שקט"
        try:
            vals = struct.unpack_from('<%dh' % (len(data) // 2), data)
            self.level = max(abs(v) for v in vals) / 32768.0
        except Exception:
            pass
        return data

    def close(self):
        try:
            winmm.waveInStop(self.h)
            winmm.waveInReset(self.h)
            for hd in self.hdrs:
                winmm.waveInUnprepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            winmm.waveInClose(self.h)
        except Exception:
            pass


# ---------------------------------------------------------- RTP דו-כיווני

class RtpSession(object):
    """מחבר בין הסוקט לבין כרטיס הקול. שני חוטים: שליחה בקצב
    קבוע, וקליטה שמנגנת מיד."""

    def __init__(self, sock, host, port, mic=True, spk=True, tone=None):
        self.sock, self.host, self.port = sock, host, port
        self.stop = threading.Event()
        self.tone = tone                       # במקום מיקרופון, לבדיקות
        self.stats = {'sent': 0, 'recv': 0, 'lost': 0, 'underruns': 0,
                      'micLevel': 0.0, 'rxLevel': 0.0, 'jitter': 0.0}
        self.mic = Mic() if mic else None
        self.spk = Speaker() if spk else None
        self._seq = 0
        self._ts = 0
        self._ssrc = int(time.time()) & 0x7FFFFFFF
        self._last_seq = None
        self._phase = 0

    def _pack(self, payload):
        hdr = struct.pack('!BBHII', 0x80, 0, self._seq & 0xFFFF,
                          self._ts & 0xFFFFFFFF, self._ssrc)
        self._seq += 1
        self._ts += FRAME
        return hdr + payload

    def _tx(self):
        """שולח כל 20ms. הקצב חייב להיות אחיד — אחרת הצד השני
        שומע גמגום גם אם כל החבילות הגיעו."""
        nxt = time.perf_counter()
        silence = b'\xff' * FRAME
        while not self.stop.is_set():
            pcm = self.mic.read() if self.mic else None
            if pcm:
                payload = pcm_to_ulaw(pcm)
                self.stats['micLevel'] = self.mic.level
            elif self.tone:
                payload, self._phase = self._tone_frame(self._phase)
            else:
                payload = silence
            try:
                self.sock.sendto(self._pack(payload), (self.host, self.port))
                self.stats['sent'] += 1
            except Exception:
                break
            nxt += 0.02
            d = nxt - time.perf_counter()
            if d > 0:
                time.sleep(d)
            else:
                nxt = time.perf_counter()

    def _tone_frame(self, phase):
        buf = bytearray()
        for i in range(FRAME):
            v = int(math.sin(2 * math.pi * self.tone * (phase + i) / RATE) * 8000)
            buf.append(ENC[(v + 32768) & 0xFFFF])
        return bytes(buf), phase + FRAME

    def _rx(self):
        self.sock.settimeout(0.5)
        while not self.stop.is_set():
            try:
                data, _ = self.sock.recvfrom(2048)
            except Exception:
                continue
            if len(data) < 13:
                continue
            seq = struct.unpack_from('!H', data, 2)[0]
            if self._last_seq is not None:
                gap = (seq - self._last_seq - 1) & 0xFFFF
                if 0 < gap < 100:
                    self.stats['lost'] += gap
            self._last_seq = seq
            payload = data[12:]
            self.stats['recv'] += 1
            if self.spk:
                pcm = ulaw_to_pcm(payload[:FRAME])
                self.spk.write(pcm)
                self.stats['underruns'] = self.spk.underruns
                try:
                    vals = struct.unpack_from('<%dh' % (len(pcm) // 2), pcm)
                    self.stats['rxLevel'] = max(abs(v) for v in vals) / 32768.0
                except Exception:
                    pass

    def start(self):
        threading.Thread(target=self._tx, daemon=True).start()
        threading.Thread(target=self._rx, daemon=True).start()
        return self

    def close(self):
        self.stop.set()
        time.sleep(0.05)
        if self.mic:
            self.mic.close()
        if self.spk:
            self.spk.close()


# ---------------------------------------------------------- בדיקה

def devices():
    return {'out': winmm.waveOutGetNumDevs(), 'in': winmm.waveInGetNumDevs()}


if __name__ == '__main__':
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    d = devices()
    print('התקני פלט: %d · התקני קלט: %d' % (d['out'], d['in']))
    print('טבלאות μ-law: %d ערכי קידוד, %d ערכי פענוח' % (len(ENC), len(DEC)))
    # בדיקת נאמנות ההמרה — הלוך ושוב
    import random
    err = 0
    for _ in range(2000):
        v = random.randint(-32000, 32000)
        pcm = struct.pack('<h', v)
        back = struct.unpack('<h', ulaw_to_pcm(pcm_to_ulaw(pcm)))[0]
        err = max(err, abs(back - v))
    print('שגיאת המרה מרבית: %d מתוך 32768 (%.2f%%)' % (err, err / 327.68))
