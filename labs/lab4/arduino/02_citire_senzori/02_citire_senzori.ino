/*
 * Lucrarea 4 – Exemplul 2: citirea LM35 și NTC 10k (β = 3950)
 *  LM35 : pin A0 (Vcc la 5 V, GND). 10 mV/°C.
 *  NTC  : divizor între 5 V și GND: 10 kΩ la 5 V, NTC la GND, mijlocul pe A2.
 * Mediere pe N eșantioane + filtru exponențial. Cu USE_INTERNAL_REF rezoluția LM35
 * devine ≈ 0,11 °C/bit (domeniu 0…110 °C), dar NTC-ul din divizorul de 5 V saturează:
 * folosiți atunci doar LM35.
 */
// #define USE_INTERNAL_REF

const uint8_t PIN_LM35 = A0;
const uint8_t PIN_NTC  = A2;
const uint8_t N_MEDIE  = 16;
const float   R_FIX    = 10000.0;
const float   BETA     = 3950.0;
const float   T0K      = 298.15;     // 25 °C
const float   R0       = 10000.0;

#ifdef USE_INTERNAL_REF
  const float VREF = 1.1;
#else
  const float VREF = 5.0;            // măsurați cu un multimetru tensiunea reală de pe pinul 5V
#endif

float filtrat = NAN;
unsigned long ultima = 0;

int citeste_medie(uint8_t pin) {
  long s = 0;
  for (uint8_t i = 0; i < N_MEDIE; i++) s += analogRead(pin);
  return (int)(s / N_MEDIE);
}

float temperatura_lm35() {
  return citeste_medie(PIN_LM35) * VREF / 1023.0 * 100.0;
}

float temperatura_ntc() {
  int a = citeste_medie(PIN_NTC);
  if (a <= 0 || a >= 1023) return NAN;           // fir întrerupt / scurtcircuit
  float R = R_FIX * a / (1023.0 - a);
  return 1.0 / (1.0 / T0K + log(R / R0) / BETA) - 273.15;
}

void setup() {
  Serial.begin(9600);
#ifdef USE_INTERNAL_REF
  analogReference(INTERNAL);
  analogRead(PIN_LM35);                          // prima citire după schimbarea referinței se ignoră
#endif
  Serial.println(F("t[s];LM35;NTC;LM35_filtrat"));
}

void loop() {
  if (millis() - ultima >= 1000) {
    ultima += 1000;
    float t1 = temperatura_lm35();
    float t2 = temperatura_ntc();
    filtrat = isnan(filtrat) ? t1 : 0.8 * filtrat + 0.2 * t1;
    Serial.print(millis() / 1000); Serial.print(';');
    Serial.print(t1, 2);           Serial.print(';');
    Serial.print(t2, 2);           Serial.print(';');
    Serial.println(filtrat, 2);
  }
}
