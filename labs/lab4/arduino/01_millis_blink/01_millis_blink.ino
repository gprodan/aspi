/*
 * Lucrarea 4 – Exemplul 1: temporizare fără blocare cu millis()
 * Trei „sarcini" independente rulează în paralel: LED-ul de pe D13 (500 ms),
 * un LED extern pe D7 (130 ms) și un mesaj serial la 2 s.
 * Comparați cu varianta cu delay(): cu delay(500) celelalte sarcini ar fi blocate.
 */
const uint8_t LED1 = 13;
const uint8_t LED2 = 7;

struct Sarcina { unsigned long perioada; unsigned long ultima; };
Sarcina s1 = {500, 0}, s2 = {130, 0}, s3 = {2000, 0};

bool stare1 = false, stare2 = false;

// true dacă a trecut perioada; diferența fără semn rămâne corectă și la depășirea lui millis() (≈49,7 zile)
bool a_venit_timpul(Sarcina &s) {
  unsigned long acum = millis();
  if (acum - s.ultima >= s.perioada) {
    s.ultima += s.perioada;          // păstrează ritmul, fără derivă
    return true;
  }
  return false;
}

void setup() {
  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (a_venit_timpul(s1)) { stare1 = !stare1; digitalWrite(LED1, stare1); }
  if (a_venit_timpul(s2)) { stare2 = !stare2; digitalWrite(LED2, stare2); }
  if (a_venit_timpul(s3)) {
    Serial.print(F("t = ")); Serial.print(millis() / 1000.0, 1); Serial.println(F(" s"));
  }
}
