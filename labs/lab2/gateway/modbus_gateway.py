#!/usr/bin/env python3
"""
Gateway Modbus TCP -> Modbus RTU (Lucrarea 2, MSP2101)

PLC-ul S7-1215C (MB_CLIENT) vorbește Modbus TCP către acest calculator;
gateway-ul reîmpachetează cererea în cadru RTU (adresă + PDU + CRC16) și o trimite
pe RS-485 (convertor RS485-USB) către Arduino. Răspunsul face drumul invers.

  PLC  --(TCP:502, cadru MBAP)-->  PC gateway  --(RS-485, cadru RTU)-->  Arduino RTU

Instalare:   pip install pyserial
Rulare:      python modbus_gateway.py --com COM5 --baud 9600 --unit 1
             (Linux: --com /dev/ttyUSB0 ; portul 502 poate cere drepturi de administrator,
              alternativ --port 1502 și același port în configurarea MB_CLIENT)

Observație: unitatea (adresa RTU) se fixează aici (--unit); identificatorul de unitate
din cadrul TCP este ignorat, deoarece depinde de versiunea blocului MB_CLIENT.
"""
import argparse, socket, struct, threading, time, sys

def crc16(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc

def hx(b: bytes) -> str:
    return ' '.join('%02X' % x for x in b)

class RtuLink:
    """Trimite o cerere RTU și așteaptă răspunsul (sfârșit de cadru = pauză)."""
    def __init__(self, ser, unit, timeout=1.0):
        self.ser, self.unit, self.timeout = ser, unit, timeout
        self.lock = threading.Lock()

    def transact(self, pdu: bytes):
        req = bytes([self.unit]) + pdu
        req += struct.pack('<H', crc16(req))            # CRC: octetul mic întâi
        with self.lock:
            self.ser.reset_input_buffer()
            self.ser.write(req)
            self.ser.flush()
            buf, deadline, got = b'', time.time() + self.timeout, False
            while time.time() < deadline:
                chunk = self.ser.read(64)
                if chunk:
                    buf += chunk; got = True
                elif got:
                    break                                # pauză după octeți = sfârșit de cadru
        return req, buf

def handle_client(conn, addr, link, verbose):
    with conn:
        while True:
            hdr = recv_exact(conn, 7)
            if not hdr: return
            tid, pid, length, unit = struct.unpack('>HHHB', hdr)
            pdu = recv_exact(conn, length - 1) if length > 1 else b''
            if pdu is None: return
            req, rsp = link.transact(pdu)
            if verbose:
                print('TCP<-PLC  tid=%d unit=%d pdu=%s' % (tid, unit, hx(pdu)))
                print('RTU->     ' + hx(req))
                print('RTU<-     ' + (hx(rsp) if rsp else '(fără răspuns)'))
            ok = len(rsp) >= 5 and rsp[0] == link.unit and crc16(rsp[:-2]) == struct.unpack('<H', rsp[-2:])[0]
            if ok:
                rpdu = rsp[1:-2]
            else:                                        # 0x0B = Gateway Target Device Failed to Respond
                rpdu = bytes([pdu[0] | 0x80, 0x0B])
                print('! RTU: timeout sau CRC greșit -> excepție 0x0B către PLC')
            out = struct.pack('>HHHB', tid, 0, len(rpdu) + 1, unit) + rpdu
            conn.sendall(out)
            if verbose: print('TCP->PLC  ' + hx(out))

def recv_exact(conn, n):
    data = b''
    while len(data) < n:
        try:
            chunk = conn.recv(n - len(data))
        except OSError:
            return None
        if not chunk: return None
        data += chunk
    return data

def serve(link, host, port, verbose=True):
    srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((host, port)); srv.listen(5)
    print('Gateway activ: TCP %s:%d  ->  RTU unit %d' % (host, port, link.unit))
    while True:
        c, a = srv.accept()
        print('Conexiune de la', a)
        threading.Thread(target=handle_client, args=(c, a, link, verbose), daemon=True).start()

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--com', required=True, help='port serial (COM5, /dev/ttyUSB0)')
    ap.add_argument('--baud', type=int, default=9600)
    ap.add_argument('--unit', type=int, default=1, help='adresa slave RTU (implicit 1)')
    ap.add_argument('--listen', default='0.0.0.0')
    ap.add_argument('--port', type=int, default=502)
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    import serial
    ser = serial.Serial(a.com, a.baud, bytesize=8, parity='N', stopbits=1, timeout=0.02)
    serve(RtuLink(ser, a.unit), a.listen, a.port, not a.quiet)

if __name__ == '__main__':
    main()
