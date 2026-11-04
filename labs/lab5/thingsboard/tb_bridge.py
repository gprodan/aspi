#!/usr/bin/env python3
"""
Lucrarea 5 – punte Modbus RTU/TCP -> ThingsBoard (MQTT)
Interoghează RTU-ul Arduino (sketch 07_rtu_regulator din lucrarea 4 sau rtu_biogaz din lucrarea 2),
publică telemetria și execută comenzi RPC de la dashboard.

Surse de date (alegeți una):
  --serial COM5         direct pe portul serial (RS485-USB), 9600 8N1       (pip install pyserial)
  --tcp 127.0.0.1:502   prin gateway-ul Modbus TCP din lucrarea 2

Registre (07_rtu_regulator):  IR0 = T×10 [°C]   IR1 = comandă u×10 [%]   HR0 = consemn×10 [°C]
ThingsBoard:  telemetrie temperature, output, setpoint, comm_ok;  RPC: setSetpoint(params = °C), getSetpoint
Test fără ThingsBoard:  --dry-run  (afișează JSON-ul care ar fi publicat)
"""
import argparse, json, socket, struct, sys, time

def crc16(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc

class Modbus:
    """Client Modbus minimal (FC03, FC04, FC06) pe serial (RTU) sau TCP."""
    def __init__(self, serial=None, tcp=None, unit=1, baud=9600, timeout=1.0):
        self.unit, self.tid, self.timeout = unit, 0, timeout
        self.ser = self.sock = None
        if serial:
            import serial as pyserial
            self.ser = pyserial.Serial(serial, baud, timeout=timeout)
        else:
            host, port = tcp.rsplit(':', 1)
            self.addr = (host, int(port))
    def _tcp(self, pdu: bytes) -> bytes:
        self.tid = (self.tid + 1) & 0xFFFF
        with socket.create_connection(self.addr, timeout=self.timeout) as s:
            s.sendall(struct.pack('>HHHB', self.tid, 0, len(pdu) + 1, self.unit) + pdu)
            hdr = s.recv(7)
            if len(hdr) < 7: raise IOError('răspuns TCP incomplet')
            n = struct.unpack('>H', hdr[4:6])[0] - 1
            data = b''
            while len(data) < n:
                chunk = s.recv(n - len(data))
                if not chunk: raise IOError('conexiune închisă')
                data += chunk
            return data
    def _rtu(self, pdu: bytes) -> bytes:
        frame = bytes([self.unit]) + pdu
        frame += struct.pack('<H', crc16(frame))
        self.ser.reset_input_buffer(); self.ser.write(frame)
        time.sleep(0.02)
        r = self.ser.read(256)
        if len(r) < 5: raise IOError('fără răspuns (timeout)')
        if crc16(r[:-2]) != struct.unpack('<H', r[-2:])[0]: raise IOError('CRC greșit în răspuns')
        if r[0] != self.unit: raise IOError('adresă de slave diferită')
        return r[1:-2]
    def call(self, pdu: bytes) -> bytes:
        r = self._rtu(pdu) if self.ser else self._tcp(pdu)
        if r[0] & 0x80: raise IOError('excepție Modbus %02X la funcția %02X' % (r[1], r[0] & 0x7F))
        return r
    def read(self, fc, addr, n):
        r = self.call(struct.pack('>BHH', fc, addr, n))
        return list(struct.unpack('>%dH' % n, r[2:2 + 2 * n]))
    def write_reg(self, addr, value):
        self.call(struct.pack('>BHH', 6, addr, value & 0xFFFF))

def poll(mb):
    ir = mb.read(4, 0, 2)
    hr = mb.read(3, 0, 1)
    return {'temperature': ir[0] / 10.0, 'output': ir[1] / 10.0, 'setpoint': hr[0] / 10.0, 'comm_ok': True}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--serial'); src.add_argument('--tcp')
    ap.add_argument('--unit', type=int, default=1); ap.add_argument('--baud', type=int, default=9600)
    ap.add_argument('--host', default='localhost'); ap.add_argument('--mqtt-port', type=int, default=1883)
    ap.add_argument('--token', default='');  ap.add_argument('--period', type=float, default=2.0)
    ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--count', type=int, default=0, help='oprește după N cicluri (test)')
    a = ap.parse_args()
    mb = Modbus(a.serial, a.tcp, a.unit, a.baud)

    client = None
    if not a.dry_run:
        import paho.mqtt.client as mqtt
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)   # paho-mqtt 2.x
        except AttributeError:
            client = mqtt.Client()                                     # paho-mqtt 1.x
        client.username_pw_set(a.token)
        def on_msg(c, userdata, msg):
            rid = msg.topic.rsplit('/', 1)[-1]
            try:
                req = json.loads(msg.payload)
                m, p = req.get('method'), req.get('params')
                if m == 'setSetpoint':
                    v = float(p)
                    if not 15.0 <= v <= 60.0: raise ValueError('consemn în afara domeniului 15…60 °C')
                    mb.write_reg(0, int(round(v * 10))); resp = {'ok': True, 'setpoint': v}
                elif m == 'getSetpoint':
                    resp = mb.read(3, 0, 1)[0] / 10.0
                else:
                    resp = {'ok': False, 'error': 'metodă necunoscută'}
            except Exception as e:
                resp = {'ok': False, 'error': str(e)}
            c.publish('v1/devices/me/rpc/response/' + rid, json.dumps(resp))
        client.on_message = on_msg
        client.connect(a.host, a.mqtt_port, 60)
        client.subscribe('v1/devices/me/rpc/request/+')
        client.loop_start()

    n = 0
    while True:
        try:
            data = poll(mb)
        except Exception as e:
            data = {'comm_ok': False}
            print('eroare Modbus:', e, file=sys.stderr)
        data['ts_pc'] = int(time.time())
        payload = json.dumps(data)
        if a.dry_run: print(payload, flush=True)
        else: client.publish('v1/devices/me/telemetry', payload)
        n += 1
        if a.count and n >= a.count: break
        time.sleep(a.period)

if __name__ == '__main__':
    main()
