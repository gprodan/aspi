/*
 * Lucrarea 4 – Exemplul 3: termostat ON/OFF cu histerezis și protecție releu
 *  LM35 pe A0, releu (sau LED/MOSFET) pe D8, LED de stare D13.
 *  - histerezis: pornește sub SP - BANDA/2, oprește peste SP + BANDA/2
 *  - timp minim între comutări (anti short-cycle), important pentru un releu mecanic
 *  - protecție: dacă citirea e în afara 0…110 °C (senzor defect) încălzitorul se oprește
 */
// #define RELEU_ACTIV_LOW        // multe module cu releu se activează cu LOW

const uint8_t PIN_RELEU = 8;
const float   SP    = 38.0;       // °C
const float   BANDA = 2.0;        // °C
const unsigned long T_MIN_MS = 10000;     // 10 s între două comutări

bool pornit = false;
unsigned long tComutare = 0;
unsigned long tPrint = 0;
unsigned int  nComutari = 0;

float citesteT() {
  long s = 0;
  for (uint8_t i = 0; i < 16; i++) s += analogRead(A0);
  return (s / 16.0) * 5.0 / 1023.0 * 100.0;
}

void comanda(bool on) {
#ifdef RELEU_ACTIV_LOW
  digitalWrite(PIN_RELEU, on ? LOW : HIGH);
#else
  digitalWrite(PIN_RELEU, on ? HIGH : LOW);
#endif
  digitalWrite(LED_BUILTIN, on);
}

void setup() {
  pinMode(PIN_RELEU, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  comanda(false);
  Serial.begin(9600);
  Serial.println(F("t[s];T;releu;comutari"));
}

void loop() {
  float T = citesteT();
  bool dorit = pornit;
  if (T < 0 || T > 110)        dorit = false;                 // senzor defect: stare sigură
  else if (T < SP - BANDA / 2) dorit = true;
  else if (T > SP + BANDA / 2) dorit = false;

  bool permis = (millis() - tComutare >= T_MIN_MS) || (dorit == false && (T < 0 || T > 110));
  if (dorit != pornit && permis) {
    pornit = dorit;
    tComutare = millis();
    nComutari++;
    comanda(pornit);
  }

  if (millis() - tPrint >= 2000) {
    tPrint += 2000;
    Serial.print(millis() / 1000); Serial.print(';');
    Serial.print(T, 2);            Serial.print(';');
    Serial.print(pornit);          Serial.print(';');
    Serial.println(nComutari);
  }
}
