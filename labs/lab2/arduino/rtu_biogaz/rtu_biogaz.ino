/*
 * Lucrarea 2 – RTU Modbus pentru fermentatorul de biogaz (Arduino Uno)
 * Automatizarea Sistemelor și Proceselor Industriale (MSP2101)
 *
 * Slave Modbus RTU scris "de mână" (fără biblioteci), pentru a vedea cum
 * arată un cadru: [adresă][funcție][date...][CRC16 lo][CRC16 hi].
 * Funcții implementate: 01, 02, 03, 04, 05, 06, 15 (0x0F), 16 (0x10).
 *
 * Legătura fizică:
 *   - varianta A (implicit): modul RS485-TTL (MAX485) pe SoftwareSerial
 *       RX  = pin 10  ->  RO (receiver output) al MAX485
 *       TX  = pin 11  ->  DI (driver input)
 *       DE+RE legate împreună la pin 2 (HIGH = transmite)
 *       A/B la convertorul RS485-USB al calculatorului; 9600 baud, 8N1
 *     Monitorul serial USB rămâne liber pentru mesaje de depanare.
 *   - varianta B: fără MAX485, direct pe USB (Serial). Definiți USE_USB_SERIAL.
 *     Atenție: atunci nu mai puteți folosi Serial Monitor în paralel.
 *
 * Procesul (temperatura fermentatorului) este simulat în Arduino, accelerat 30x.
 */

#include <stdint.h>
#include <math.h>

// ---------------- configurare ----------------
#define SLAVE_ID 1
#define BAUD 9600UL
#define TIME_SCALE 30.0f        // secunde simulate pe secundă reală
// #define USE_USB_SERIAL       // decomentați pentru varianta B
// #define TEMP_FROM_POT        // decomentați pentru a citi T de la un potențiometru pe A0 (0..60 °C)

// ---------------- harta de registre (adrese în cadru, de la 0) ----------------
// Coils (00001..)         : 0 = comandă încălzitor, 1 = comandă pompă
// Discrete inputs (10001..): 0 = termostat de siguranță declanșat, 1 = pierdere comunicație (watchdog)
// Input registers (30001..): 0 = temperatură x10 [°C], 1 = debit biogaz x10 [m3/h], 2 = contor cereri valide
// Holding registers (40001..): 0 = consemn x10, 1 = histerezis x10, 2 = mod (0 = comandă de la PLC, 1 = reglare locală),
//                              3 = watchdog [s] (0 = dezactivat), 4 = temperatură exterioară x10
#define N_COIL 2
#define N_DI   2
#define N_IR   3
#define N_HR   5

static uint8_t  coil[N_COIL];
static uint8_t  di[N_DI];
static uint16_t ir[N_IR];
static uint16_t hr[N_HR] = {380, 5, 0, 10, 100};

static float    Tproc = 22.0f;     // temperatura reală a procesului [°C]
static uint8_t  valid_req = 0;     // setat când s-a primit o cerere cu CRC corect, adresată acestui slave

// ---------------- Modbus: CRC și procesare cadru ----------------
uint16_t mb_crc16(const uint8_t *b, uint16_t n) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < n; i++) {
    crc ^= b[i];
    for (uint8_t k = 0; k < 8; k++)
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
  }
  return crc;
}

static uint16_t be16(const uint8_t *p) { return ((uint16_t)p[0] << 8) | p[1]; }

static uint16_t finish(uint8_t *resp, uint16_t n) {     // adaugă CRC (lo, hi)
  uint16_t c = mb_crc16(resp, n);
  resp[n] = c & 0xFF; resp[n + 1] = c >> 8;
  return n + 2;
}
static uint16_t exception(uint8_t *resp, uint8_t id, uint8_t fc, uint8_t code) {
  resp[0] = id; resp[1] = fc | 0x80; resp[2] = code;
  return finish(resp, 3);
}

static uint8_t hr_value_ok(uint16_t a, uint16_t v) {      // verificare "illegal data value"
  if (a == 0) return v <= 600;      // consemn 0..60.0 °C
  if (a == 1) return v <= 100;      // histerezis 0..10.0 °C
  if (a == 2) return v <= 1;        // mod
  if (a == 3) return v <= 3600;     // watchdog
  if (a == 4) return v <= 600;      // exterior 0..60.0 (valoare pozitivă)
  return 0;
}

/* Procesează o cerere. Returnează lungimea răspunsului, 0 dacă nu se răspunde
   (cadru pentru alt slave, CRC greșit sau difuzare). */
uint16_t mb_process(const uint8_t *req, uint16_t len, uint8_t *resp) {
  if (len < 4) return 0;
  uint16_t crc = mb_crc16(req, len - 2);
  if ((req[len - 2] | ((uint16_t)req[len - 1] << 8)) != crc) return 0;   // CRC greșit: tăcere
  uint8_t id = req[0], fc = req[1];
  uint8_t bcast = (id == 0);
  if (id != SLAVE_ID && !bcast) return 0;
  uint16_t reply = 0;
  valid_req = 1;                                      // alimentează watchdog-ul de comunicație
  if (ir[2] < 65535) ir[2]++;                         // contor cereri valide

  uint16_t a = (len >= 6) ? be16(req + 2) : 0;
  uint16_t q = (len >= 8) ? be16(req + 4) : 0;

  switch (fc) {
    case 0x01: case 0x02: {                          // citire biți
      if (len != 8) { reply = exception(resp, id, fc, 3); break; }
      uint8_t *src = (fc == 1) ? coil : di; uint16_t n = (fc == 1) ? N_COIL : N_DI;
      if (q < 1 || q > 2000) { reply = exception(resp, id, fc, 3); break; }
      if ((uint32_t)a + q > n) { reply = exception(resp, id, fc, 2); break; }
      uint8_t nb = (q + 7) / 8;
      resp[0] = id; resp[1] = fc; resp[2] = nb;
      for (uint8_t i = 0; i < nb; i++) resp[3 + i] = 0;
      for (uint16_t i = 0; i < q; i++) if (src[a + i]) resp[3 + i / 8] |= (1 << (i % 8));
      reply = finish(resp, 3 + nb);
      break; }
    case 0x03: case 0x04: {                          // citire registre
      if (len != 8) { reply = exception(resp, id, fc, 3); break; }
      uint16_t *src = (fc == 3) ? hr : ir; uint16_t n = (fc == 3) ? N_HR : N_IR;
      if (q < 1 || q > 125) { reply = exception(resp, id, fc, 3); break; }
      if ((uint32_t)a + q > n) { reply = exception(resp, id, fc, 2); break; }
      resp[0] = id; resp[1] = fc; resp[2] = q * 2;
      for (uint16_t i = 0; i < q; i++) { resp[3 + 2 * i] = src[a + i] >> 8; resp[4 + 2 * i] = src[a + i] & 0xFF; }
      reply = finish(resp, 3 + 2 * q);
      break; }
    case 0x05: {                                     // scriere un coil
      if (len != 8) { reply = exception(resp, id, fc, 3); break; }
      if (q != 0xFF00 && q != 0x0000) { reply = exception(resp, id, fc, 3); break; }
      if (a >= N_COIL) { reply = exception(resp, id, fc, 2); break; }
      coil[a] = (q == 0xFF00);
      for (uint8_t i = 0; i < 6; i++) resp[i] = req[i];
      reply = finish(resp, 6);
      break; }
    case 0x06: {                                     // scriere un registru
      if (len != 8) { reply = exception(resp, id, fc, 3); break; }
      if (a >= N_HR) { reply = exception(resp, id, fc, 2); break; }
      if (!hr_value_ok(a, q)) { reply = exception(resp, id, fc, 3); break; }
      hr[a] = q;
      for (uint8_t i = 0; i < 6; i++) resp[i] = req[i];
      reply = finish(resp, 6);
      break; }
    case 0x0F: {                                     // scriere mai mulți coils
      if (len < 10) { reply = exception(resp, id, fc, 3); break; }
      uint8_t bc = req[6];
      if (q < 1 || q > 1968 || bc != (q + 7) / 8 || len != (uint16_t)(9 + bc)) { reply = exception(resp, id, fc, 3); break; }
      if ((uint32_t)a + q > N_COIL) { reply = exception(resp, id, fc, 2); break; }
      for (uint16_t i = 0; i < q; i++) coil[a + i] = (req[7 + i / 8] >> (i % 8)) & 1;
      for (uint8_t i = 0; i < 6; i++) resp[i] = req[i];
      reply = finish(resp, 6);
      break; }
    case 0x10: {                                     // scriere mai multe registre
      if (len < 11) { reply = exception(resp, id, fc, 3); break; }
      uint8_t bc = req[6];
      if (q < 1 || q > 123 || bc != q * 2 || len != (uint16_t)(9 + bc)) { reply = exception(resp, id, fc, 3); break; }
      if ((uint32_t)a + q > N_HR) { reply = exception(resp, id, fc, 2); break; }
      for (uint16_t i = 0; i < q; i++) if (!hr_value_ok(a + i, be16(req + 7 + 2 * i))) { reply = exception(resp, id, fc, 3); return bcast ? 0 : reply; }
      for (uint16_t i = 0; i < q; i++) hr[a + i] = be16(req + 7 + 2 * i);
      for (uint8_t i = 0; i < 6; i++) resp[i] = req[i];
      reply = finish(resp, 6);
      break; }
    default:
      reply = exception(resp, id, fc, 1);            // illegal function
  }
  return bcast ? 0 : reply;                           // difuzarea nu primește răspuns
}

// ---------------- procesul simulat și regulatorul local ----------------
static void process_step(float dt_sim) {              // dt_sim în secunde simulate
  float Ta = hr[4] / 10.0f;
  uint8_t u = coil[0] && !di[0];
#ifdef TEMP_FROM_POT
  Tproc = 60.0f * analogRead(A0) / 1023.0f;
#else
  Tproc += dt_sim * (8.0f * u - 0.12f * (Tproc - Ta)) / 432.0f;
#endif
  if (Tproc > 48.0f) di[0] = 1; else if (Tproc < 46.0f) di[0] = 0;   // termostat de siguranță cu histerezis
  float x = (Tproc - 38.0f) / 6.0f;
  ir[0] = (uint16_t)(Tproc * 10.0f + 0.5f);
  ir[1] = (uint16_t)(120.0f * expf(-x * x) + 0.5f);
}

static void control_step(uint32_t nowMs, uint32_t lastReqMs) {
  if (hr[2] == 1) {                                   // reglare locală ON-OFF
    float sp = hr[0] / 10.0f, h = hr[1] / 10.0f;
    if (Tproc < sp - h) coil[0] = 1; else if (Tproc > sp + h) coil[0] = 0;
    di[1] = 0;
  } else if (hr[3] > 0 && (nowMs - lastReqMs) > (uint32_t)hr[3] * 1000UL) {
    coil[0] = 0; di[1] = 1;                           // pierdere comunicație: stare sigură
  } else di[1] = 0;
}

// ---------------- partea specifică Arduino ----------------
#ifdef ARDUINO
#include <Arduino.h>
#ifndef USE_USB_SERIAL
#include <SoftwareSerial.h>
SoftwareSerial rs485(10, 11);   // RX, TX
#define BUS rs485
#else
#define BUS Serial
#endif
#define PIN_DE 2

static uint8_t rxbuf[64], txbuf[64];
static uint16_t rxlen = 0;
static uint32_t lastByteUs = 0, lastTickMs = 0, lastReqMs = 0;
static const uint32_t T35_US = (uint32_t)(38500000UL / BAUD) + 500UL;   // 3,5 caractere + marjă

void setup() {
  pinMode(PIN_DE, OUTPUT); digitalWrite(PIN_DE, LOW);
  pinMode(LED_BUILTIN, OUTPUT);
  BUS.begin(BAUD);
#ifndef USE_USB_SERIAL
  Serial.begin(115200);
  Serial.println(F("RTU biogaz pregatit (slave 1, 9600 8N1)"));
#endif
  lastReqMs = millis();
}

void loop() {
  // 1. recepție: un cadru se încheie după o pauză de >= 3,5 caractere
  while (BUS.available()) {
    uint8_t b = BUS.read();
    if (rxlen < sizeof(rxbuf)) rxbuf[rxlen++] = b;
    lastByteUs = micros();
  }
  if (rxlen && (micros() - lastByteUs) > T35_US) {
    uint16_t n = mb_process(rxbuf, rxlen, txbuf);
    if (valid_req) { lastReqMs = millis(); valid_req = 0; }
    if (n) {
      digitalWrite(PIN_DE, HIGH);
      BUS.write(txbuf, n);
      BUS.flush();
      delayMicroseconds(T35_US / 2);
      digitalWrite(PIN_DE, LOW);
    }
    rxlen = 0;
  }
  // 2. proces + regulator o dată pe secundă reală
  uint32_t now = millis();
  if (now - lastTickMs >= 1000) {
    lastTickMs = now;
    process_step(TIME_SCALE);
    control_step(now, lastReqMs);
    digitalWrite(LED_BUILTIN, coil[0] && !di[0]);
#ifndef USE_USB_SERIAL
    Serial.print(F("T=")); Serial.print(Tproc, 1);
    Serial.print(F(" C  heater=")); Serial.print(coil[0] && !di[0]);
    Serial.print(F("  mod=")); Serial.print(hr[2]);
    Serial.print(F("  cereri=")); Serial.println(ir[2]);
#endif
  }
}
#endif
