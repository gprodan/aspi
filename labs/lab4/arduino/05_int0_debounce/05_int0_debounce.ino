/*
 * Lucrarea 4 – Exemplul 5: întrerupere externă INT0 (pin D2) cu și fără antirevenire
 * Butonul se leagă între D2 și GND (INPUT_PULLUP). Contactul mecanic „sare" câteva ms:
 * numărătorul brut crește cu 2…10 la o apăsare, cel cu debounce cu exact 1.
 */
const uint8_t PIN_BTN = 2;
const unsigned long DEBOUNCE_MS = 50;

volatile uint16_t brut = 0;
volatile uint16_t curat = 0;
volatile unsigned long tUltim = 0;

void onButon() {
  brut++;
  unsigned long acum = millis();
  if (acum - tUltim > DEBOUNCE_MS) {
    curat++;
    tUltim = acum;
  }
}

uint16_t brut_afisat = 0, curat_afisat = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_BTN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN), onButon, FALLING);
  Serial.println(F("Apasati butonul de pe D2"));
}

void loop() {
  noInterrupts();
  uint16_t b = brut, c = curat;
  interrupts();
  if (b != brut_afisat || c != curat_afisat) {
    brut_afisat = b; curat_afisat = c;
    Serial.print(F("brut = "));  Serial.print(b);
    Serial.print(F("   cu debounce = ")); Serial.println(c);
  }
}
