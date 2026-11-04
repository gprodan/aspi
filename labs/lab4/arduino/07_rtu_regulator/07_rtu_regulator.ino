/*
 * Lucrarea 4 – Exemplul 7: regulator PI cu interfață Modbus RTU (legătura cu Lucrarea 2)
 * Arduino Uno = RTU slave (id 1, 9600 8N1) pe Serial (USB sau modul RS485-USB/TTL).
 * Un master (S7-1215C prin gateway, Modbus Poll, scriptul Python) citește temperatura și scrie referința.
 *
 *  Holding registers (FC03 citire, FC06 scriere):  HR0 = SP×10 [°C]  HR1 = KP×10  HR2 = KI×100  HR3 = mod (0 auto, 1 manual)  HR4 = u manual×10 [%]
 *  Input registers   (FC04):                       IR0 = T×10 [°C]   IR1 = u×10 [%]  IR2 = contor cereri valide
 * Fără Serial.print: portul serial aparține magistralei. Pentru depanare folosiți LED-ul D13.
 * Pe magistrală directă RS485 (MAX485) adăugați comanda pinului DE/RE în jurul transmisiei.
 */
#include <stdint.h>

#define SLAVE_ID 1
const uint8_t PIN_PWM = 9;
const uint32_t T35_US = 4000;               // ≈ 3,5 caractere la 9600 baud (3,6 ms) + marjă

uint16_t hr[5] = {380, 150, 25, 0, 0};
uint16_t ir[3] = {0, 0, 0};

float T = NAN, I = 0, u = 0;
uint32_t tEsant = 0;

uint16_t crc16(const uint8_t *b, uint8_t n) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < n; i++) {
    crc ^= b[i];
    for (uint8_t k = 0; k < 8; k++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  return crc;
}
uint16_t be16(const uint8_t *p) { return ((uint16_t)p[0] << 8) | p[1]; }

uint8_t raspuns_eroare(uint8_t *r, uint8_t fc, uint8_t cod) {
  r[0] = SLAVE_ID; r[1] = fc | 0x80; r[2] = cod;
  uint16_t c = crc16(r, 3); r[3] = c & 0xFF; r[4] = c >> 8; return 5;
}

// Procesează o cerere; întoarce lungimea răspunsului (0 = niciun răspuns)
uint8_t mb_process(const uint8_t *q, uint8_t len, uint8_t *r) {
  if (len < 8) return 0;
  uint16_t c = crc16(q, len - 2);
  if ((c & 0xFF) != q[len - 2] || (c >> 8) != q[len - 1]) return 0;      // CRC greșit: tăcere
  if (q[0] != SLAVE_ID) return 0;
  ir[2]++;
  uint8_t fc = q[1];
  uint16_t a = be16(q + 2), v = be16(q + 4);
  if (fc == 3 || fc == 4) {
    uint16_t nmax = (fc == 3) ? 5 : 3;
    if (v < 1 || v > 125)       return raspuns_eroare(r, fc, 3);
    if (a + v > nmax)           return raspuns_eroare(r, fc, 2);
    r[0] = SLAVE_ID; r[1] = fc; r[2] = v * 2;
    for (uint16_t i = 0; i < v; i++) {
      uint16_t x = (fc == 3) ? hr[a + i] : ir[a + i];
      r[3 + 2 * i] = x >> 8; r[4 + 2 * i] = x & 0xFF;
    }
    uint8_t l = 3 + 2 * v; uint16_t k = crc16(r, l); r[l] = k & 0xFF; r[l + 1] = k >> 8; return l + 2;
  }
  if (fc == 6) {
    if (a >= 5)                 return raspuns_eroare(r, fc, 2);
    if ((a == 0 && (v < 150 || v > 600)) || (a == 3 && v > 1) || (a == 4 && v > 1000)) return raspuns_eroare(r, fc, 3);
    hr[a] = v;
    if (a == 3 && v == 0) I = u;                                       // revenire în automat fără salt
    for (uint8_t i = 0; i < 6; i++) r[i] = q[i];
    uint16_t k = crc16(r, 6); r[6] = k & 0xFF; r[7] = k >> 8; return 8;
  }
  return raspuns_eroare(r, fc, 1);                                      // funcție nesuportată
}

void regleaza() {                                                       // o dată pe secundă
  long s = 0;
  for (uint8_t i = 0; i < 16; i++) s += analogRead(A0);
  float brut = (s / 16.0) * 5.0 / 1023.0 * 100.0;
  T = isnan(T) ? brut : 0.7 * T + 0.3 * brut;
  float SP = hr[0] / 10.0, KP = hr[1] / 10.0, KI = hr[2] / 100.0;
  float e = SP - T, P = KP * e;
  if (hr[3] == 1) u = hr[4] / 10.0;
  else {
    float un = P + I + KI * e;
    if (!((un > 100 && e > 0) || (un < 0 && e < 0))) I += KI * e;
    I = constrain(I, 0, 100);
    u = constrain(P + I, 0, 100);
  }
  analogWrite(PIN_PWM, (int)(u * 2.55 + 0.5));
  ir[0] = (uint16_t)(T * 10 + 0.5);
  ir[1] = (uint16_t)(u * 10 + 0.5);
}

uint8_t rx[32], tx[40], nrx = 0;
uint32_t tUltimulOctet = 0;

void setup() {
  pinMode(PIN_PWM, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  while (Serial.available()) {                       // colectează octeții cadrului
    if (nrx < sizeof(rx)) rx[nrx++] = Serial.read(); else Serial.read();
    tUltimulOctet = micros();
  }
  if (nrx && (micros() - tUltimulOctet) > T35_US) {  // tăcere ≥ 3,5 caractere: cadru complet
    uint8_t l = mb_process(rx, nrx, tx);
    if (l) { Serial.write(tx, l); digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); }
    nrx = 0;
  }
  if (millis() - tEsant >= 1000) { tEsant += 1000; regleaza(); }
}
