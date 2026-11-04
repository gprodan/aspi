/*
 * Lucrarea 4 – Exemplul 6: regulator PI digital cu anti-windup
 *  LM35 pe A0, MOSFET/LED pe D9 (PWM ≈ 490 Hz). Perioada de eșantionare Ts = 1 s.
 * Comenzi pe monitorul serial (terminate cu Enter, „Newline"):
 *   SP=38.5     valoarea dorită, °C        KP=12     KI=0.2      MAN=40  (comandă manuală, %)    AUTO
 * Telemetrie CSV: t;T;SP;u;P;I   (poate fi trasată în Serial Plotter sau în Excel)
 */
float SP = 38.0;        // °C
float KP = 15.0;        // % per °C
float KI = 0.25;        // % per (°C·s)
const float TS = 1.0;   // s
const float U_MIN = 0, U_MAX = 100;

float T = NAN, I = 0, u = 0;
bool manual = false;
float uManual = 0;
unsigned long ultima = 0;

char linie[24];
uint8_t n = 0;

float citesteT() {
  long s = 0;
  for (uint8_t i = 0; i < 16; i++) s += analogRead(A0);
  return (s / 16.0) * 5.0 / 1023.0 * 100.0;
}

void executa(char *l) {
  for (char *p = l; *p; p++) if (*p >= 'a' && *p <= 'z') *p -= 32;       // majuscule
  if      (!strncmp(l, "SP=", 3))  { float v = atof(l + 3); if (v >= 15 && v <= 60) SP = v; }
  else if (!strncmp(l, "KP=", 3))  { KP = atof(l + 3); }
  else if (!strncmp(l, "KI=", 3))  { KI = atof(l + 3); }
  else if (!strncmp(l, "MAN=", 4)) { manual = true; uManual = constrain(atof(l + 4), U_MIN, U_MAX); }
  else if (!strcmp(l, "AUTO"))     { manual = false; I = u; }            // preluare fără salt (bumpless)
  else Serial.println(F("? comenzi: SP= KP= KI= MAN= AUTO"));
}

void citeste_serial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { if (n) { linie[n] = 0; executa(linie); n = 0; } }
    else if (n < sizeof(linie) - 1) linie[n++] = c;
  }
}

void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
  Serial.println(F("t;T;SP;u;P;I"));
}

void loop() {
  citeste_serial();
  if (millis() - ultima >= (unsigned long)(TS * 1000)) {
    ultima += (unsigned long)(TS * 1000);
    float brut = citesteT();
    T = isnan(T) ? brut : 0.7 * T + 0.3 * brut;           // filtru exponențial pe măsurare
    float e = SP - T;
    float P = KP * e;
    if (manual) {
      u = uManual;
    } else {
      float uNesat = P + I + KI * e * TS;
      // anti-windup prin „clamping": integrăm doar dacă ieșirea nu este saturată în sensul erorii
      if (!((uNesat > U_MAX && e > 0) || (uNesat < U_MIN && e < 0))) I += KI * e * TS;
      I = constrain(I, U_MIN, U_MAX);
      u = constrain(P + I, U_MIN, U_MAX);
    }
    analogWrite(9, (int)(u * 2.55 + 0.5));
    Serial.print(millis() / 1000); Serial.print(';');
    Serial.print(T, 2);            Serial.print(';');
    Serial.print(SP, 1);           Serial.print(';');
    Serial.print(u, 1);            Serial.print(';');
    Serial.print(P, 1);            Serial.print(';');
    Serial.println(I, 1);
  }
}
