#!/usr/bin/env python3
"""
Lucrarea 6 – HMI web pentru stația de biogaz (stdlib Python, fără framework)
Servește pagina hmi.html (adaptivă: telefon/calculator) și un API JSON:
  GET  /api/state      valori, calitate, alarme
  POST /api/setpoint   {"value": 40.0, "pin": "1234"}   (scrie HR0 = consemn×10, FC06)
  POST /api/ack        confirmă alarmele

Surse (alegeți una):
  --demo                proces simulat, fără echipament
  --serial COM5         RTU Arduino (sketch 07_rtu_regulator): IR0 = T×10, IR1 = comandă×10, HR0 = consemn×10
  --tcp host:port       prin gateway-ul Modbus TCP din lucrarea 2

Securitate: implicit serverul ascultă doar pe 127.0.0.1. Pentru acces de pe telefon în rețeaua de laborator
folosiți --host 0.0.0.0. Nu îl expuneți pe internet (nu are TLS, iar PIN-ul este o protecție minimă).
"""
import argparse, json, math, os, socket, struct, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))

def crc16(d):
    c = 0xFFFF
    for b in d:
        c ^= b
        for _ in range(8): c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c

class Modbus:
    def __init__(self, serial=None, tcp=None, unit=1, baud=9600, timeout=1.0):
        self.unit, self.tid, self.timeout, self.ser = unit, 0, timeout, None
        self.lock = threading.Lock()
        if serial:
            import serial as ps
            self.ser = ps.Serial(serial, baud, timeout=timeout)
        else:
            h, p = tcp.rsplit(':', 1); self.addr = (h, int(p))
    def _call(self, pdu):
        with self.lock:
            if self.ser:
                f = bytes([self.unit]) + pdu; f += struct.pack('<H', crc16(f))
                self.ser.reset_input_buffer(); self.ser.write(f); time.sleep(0.02); r = self.ser.read(256)
                if len(r) < 5 or crc16(r[:-2]) != struct.unpack('<H', r[-2:])[0]: raise IOError('fără răspuns valid')
                r = r[1:-2]
            else:
                self.tid = (self.tid + 1) & 0xFFFF
                with socket.create_connection(self.addr, timeout=self.timeout) as s:
                    s.sendall(struct.pack('>HHHB', self.tid, 0, len(pdu) + 1, self.unit) + pdu)
                    h = s.recv(7)
                    if len(h) < 7: raise IOError('răspuns TCP incomplet')
                    n = struct.unpack('>H', h[4:6])[0] - 1; r = b''
                    while len(r) < n:
                        ch = s.recv(n - len(r))
                        if not ch: raise IOError('conexiune închisă')
                        r += ch
        if r[0] & 0x80: raise IOError('excepție Modbus %02X' % r[1])
        return r
    def read(self, fc, a, n):
        r = self._call(struct.pack('>BHH', fc, a, n)); return list(struct.unpack('>%dH' % n, r[2:2 + 2 * n]))
    def write(self, a, v): self._call(struct.pack('>BHH', 6, a, v & 0xFFFF))

class Demo:
    """Proces simulat (același model ca în lucrările anterioare), accelerat 20×."""
    def __init__(s): s.T, s.L, s.P, s.SP, s.htr, s.pump, s.t = 22.0, 60.0, 8.0, 38.0, False, False, time.time()
    def step(s):
        now = time.time(); dt = (now - s.t) * 20; s.t = now
        for _ in range(max(1, int(dt / 0.5))):
            h = 0.5
            if s.T < s.SP - 0.5: s.htr = True
            elif s.T > s.SP + 0.5: s.htr = False
            if s.L < 50: s.pump = True
            elif s.L > 80: s.pump = False
            s.T += h * (8000 * s.htr - 120 * (s.T - 20)) / 3e5
            s.L = max(0, min(100, s.L + h * ((0.2 if s.pump else 0) - 0.02)))
            F = 12 * math.exp(-((s.T - 38) / 6) ** 2) * s.L / 100
            s.P = max(0, min(40, s.P + h * 0.004 * (F - (24 if s.P > 28 else 4))))
            s.F = F

class Hmi:
    def __init__(s, a):
        s.a, s.lock = a, threading.Lock()
        s.mb = None if a.demo else Modbus(a.serial, a.tcp, a.unit, a.baud)
        s.demo = Demo() if a.demo else None
        s.tags, s.last_ok, s.err, s.alarms, s.events = {}, 0, 0, {}, []
        s.bad_pin, s.lock_until, s.t0 = 0, 0, time.time()
    def log(s, m): s.events.insert(0, time.strftime('%H:%M:%S ') + m); del s.events[40:]
    def poll(s):
        now = time.time(); t = {}
        try:
            if s.demo:
                s.demo.step(); d = s.demo
                t = {'TT101': d.T, 'SP101': d.SP, 'LT101': d.L, 'PT101': d.P, 'FT101': d.F, 'HTR101': 1 if d.htr else 0}
            else:
                ir = s.mb.read(4, 0, 2); hr = s.mb.read(3, 0, 1)
                t = {'TT101': ir[0] / 10, 'OUT': ir[1] / 10, 'SP101': hr[0] / 10}
            s.last_ok = now; s.err = 0
        except Exception as e:
            s.err += 1
            if s.err == 3: s.log('PIERDERE COMUNICAȚIE: %s' % e)
        with s.lock:
            for k, v in t.items(): s.tags[k] = {'v': v, 'ts': now}
            s.eval_alarms(now)
    def eval_alarms(s, now):
        comm = s.err >= 3
        T = s.tags.get('TT101', {}).get('v')
        conds = {'COMM': (comm, 'Pierdere comunicație cu RTU', 1)}
        if T is not None and not comm:
            conds['TT.H'] = (T > 41, 'Temperatură ridicată (%.1f °C)' % T, 2)
            conds['TT.HH'] = (T > 45, 'Temperatură foarte ridicată (%.1f °C)' % T, 1)
        for k, (on, txt, pr) in conds.items():
            a = s.alarms.get(k)
            if on and not a: s.alarms[k] = {'k': k, 'txt': txt, 'pr': pr, 'st': 'A', 't0': now}; s.log('ALARMĂ ' + txt)
            elif a and on: a['txt'] = txt
            elif a and not on:
                if a['st'] == 'AA': del s.alarms[k]; s.log('REVENIRE ' + k)
                else: a['st'] = 'R'
    def state(s):
        now = time.time()
        with s.lock:
            tags = {}
            for k, v in s.tags.items():
                age = now - v['ts']; q = 'bad' if s.err >= 3 else ('stale' if age > 5 else 'good')
                tags[k] = {'v': round(v['v'], 2), 'q': q, 'age': round(age, 1)}
            al = sorted(s.alarms.values(), key=lambda a: (a['pr'], -a['t0']))
            return {'comm': s.err < 3, 'tags': tags, 'alarms': [dict(a, t0=time.strftime('%H:%M:%S', time.localtime(a['t0']))) for a in al], 'events': s.events[:10], 'pin_required': bool(s.a.pin)}
    def ack(s):
        with s.lock:
            for k in list(s.alarms):
                a = s.alarms[k]
                if a['st'] == 'A': a['st'] = 'AA'
                elif a['st'] == 'R': del s.alarms[k]
            s.log('CONFIRMARE alarme')
    def setpoint(s, v, pin):
        now = time.time()
        if now < s.lock_until: return 429, 'Prea multe încercări; reîncercați peste %d s' % (s.lock_until - now)
        if s.a.pin and pin != s.a.pin:
            s.bad_pin += 1
            if s.bad_pin >= 5: s.lock_until, s.bad_pin = now + 30, 0
            s.log('PIN GREȘIT la scrierea consemnului'); return 403, 'PIN greșit'
        s.bad_pin = 0
        try: v = float(v)
        except Exception: return 400, 'valoare invalidă'
        if not (15.0 <= v <= 60.0): return 400, 'în afara domeniului 15…60 °C'
        try:
            if s.demo: s.demo.SP = v
            else: s.mb.write(0, int(round(v * 10)))
        except Exception as e: return 502, 'RTU nu răspunde: %s' % e
        s.log('SCRIERE consemn = %.1f °C' % v); return 200, 'ok'

def make_handler(h):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def send(self, code, body, ctype='application/json'):
            b = body if isinstance(body, bytes) else body.encode('utf-8')
            self.send_response(code); self.send_header('Content-Type', ctype + '; charset=utf-8'); self.send_header('Content-Length', str(len(b))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            if self.path in ('/', '/index.html', '/hmi.html'):
                self.send(200, open(os.path.join(HERE, 'hmi.html'), 'rb').read(), 'text/html')
            elif self.path == '/api/state': self.send(200, json.dumps(h.state()))
            else: self.send(404, '{"error":"nu există"}')
        def do_POST(self):
            n = int(self.headers.get('Content-Length', 0) or 0)
            try: body = json.loads(self.rfile.read(min(n, 2048)) or b'{}')
            except Exception: return self.send(400, '{"error":"JSON invalid"}')
            if self.path == '/api/setpoint':
                c, m = h.setpoint(body.get('value'), str(body.get('pin', ''))); self.send(c, json.dumps({'ok': c == 200, 'msg': m}))
            elif self.path == '/api/ack': h.ack(); self.send(200, '{"ok":true}')
            else: self.send(404, '{"error":"nu există"}')
    return H

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--demo', action='store_true'); g.add_argument('--serial'); g.add_argument('--tcp')
    ap.add_argument('--unit', type=int, default=1); ap.add_argument('--baud', type=int, default=9600)
    ap.add_argument('--host', default='127.0.0.1'); ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--pin', default='1234', help='PIN pentru scrierea consemnului (gol = fără PIN)')
    a = ap.parse_args(); h = Hmi(a)
    def loop():
        while True: h.poll(); time.sleep(1)
    threading.Thread(target=loop, daemon=True).start()
    srv = ThreadingHTTPServer((a.host, a.port), make_handler(h))
    print('HMI web: http://%s:%d  (Ctrl+C pentru oprire)' % (a.host if a.host != '0.0.0.0' else 'adresa-pc', a.port), flush=True)
    try: srv.serve_forever()
    except KeyboardInterrupt: pass

if __name__ == '__main__': main()
