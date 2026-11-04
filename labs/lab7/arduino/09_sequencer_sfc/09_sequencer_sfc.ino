/* Lucrarea 7 – Secvențiator GRAFCET pe Arduino Uno (rezervor agitat)
   Nucleul seqScan() este generat de editorul GRAFCET din aplicația web (model implicit).
   Intrări (întrerupătoare către GND, activ pe 0): D2 START, D3 STOP/RESET, D4 ES (oprire urgență),
   D5 LSL (nivel minim), D6 LSH (nivel maxim); temperatură: LM35 pe A0.
   Ieșiri (LED-uri cu rezistor): D8 XV101, D9 XV102, D10 M101, D11 EH101, D12 HL101 (avarie).
   Serial 9600: pasul, nivelul logic al ieșirilor și temperatura la fiecare schimbare de pas. */
#define PB101_PIN 2
#define PB102_PIN 3
#define ES101_PIN 4
#define LSL101_PIN 5
#define LSH101_PIN 6
#define TT101_PIN A0
#define XV101_PIN 8
#define XV102_PIN 9
#define M101_PIN 10
#define EH101_PIN 11
#define HL101_PIN 12

bool ES101 = false;
bool PB101 = false;
bool LSL101 = false;
bool LSH101 = false;
float TT101 = 0;
bool PB102 = false;
bool XV101 = false;
bool XV102 = false;
bool M101 = false;
bool EH101 = false;
bool HL101 = false;

int step = 0;
unsigned long tEntry = 0;
float t = 0;
float SP = 37.0f;
float HOLD = 20.0f;

void seqScan() {
  t = (millis() - tEntry) / 1000.0f;
  int next = step;
  if ((ES101) && step != 5) next = 5;  // → S9
  if (next == step) {
    switch (step) {
      case 0:  // S0 Repaus
        if (PB101 && !LSL101) next = 1;  // → S1
        break;
      case 1:  // S1 Umplere
        if (LSH101) next = 2;  // → S2
        else if (PB102) next = 4;  // → S4
        else if (t > 24.0f) next = 5;  // timeout
        break;
      case 2:  // S2 Încălzire
        if (TT101 >= SP) next = 3;  // → S3
        else if (PB102) next = 4;  // → S4
        else if (t > 60.0f) next = 5;  // timeout
        break;
      case 3:  // S3 Menținere
        if (t >= HOLD) next = 4;  // → S4
        else if (PB102) next = 4;  // → S4
        break;
      case 4:  // S4 Golire
        if (!LSL101) next = 0;  // → S0
        else if (t > 60.0f) next = 5;  // timeout
        break;
      case 5:  // S9 Avarie
        if (PB102 && !ES101) next = 0;  // → S0
        break;
    }
  }
  if (next != step) { step = next; tEntry = millis(); t = 0; }
  XV101 = false;
  XV102 = false;
  M101 = false;
  EH101 = false;
  HL101 = false;
  switch (step) {
    case 1:  // S1 Umplere
      XV101 = true;
      break;
    case 2:  // S2 Încălzire
      M101 = true;
      EH101 = (TT101 < SP);
      break;
    case 3:  // S3 Menținere
      M101 = true;
      EH101 = (TT101 < SP - 0.5);
      break;
    case 4:  // S4 Golire
      XV102 = true;
      M101 = true;
      break;
    case 5:  // S9 Avarie
      HL101 = true;
      break;
  }
}

bool rd(uint8_t pin) { return digitalRead(pin) == LOW; }   // INPUT_PULLUP, activ pe 0

void readInputs() {
  PB101 = rd(PB101_PIN);
  PB102 = rd(PB102_PIN);
  ES101 = rd(ES101_PIN);
  LSL101 = rd(LSL101_PIN);
  LSH101 = rd(LSH101_PIN);
  TT101 = analogRead(TT101_PIN) * (5.0f / 1023.0f) * 100.0f;   // LM35: 10 mV/°C
}

void writeOutputs() {
  digitalWrite(XV101_PIN, XV101);
  digitalWrite(XV102_PIN, XV102);
  digitalWrite(M101_PIN, M101);
  digitalWrite(EH101_PIN, EH101);
  digitalWrite(HL101_PIN, HL101);
}

void setup() {
  pinMode(PB101_PIN, INPUT_PULLUP);
  pinMode(PB102_PIN, INPUT_PULLUP);
  pinMode(ES101_PIN, INPUT_PULLUP);
  pinMode(LSL101_PIN, INPUT_PULLUP);
  pinMode(LSH101_PIN, INPUT_PULLUP);
  pinMode(XV101_PIN, OUTPUT);
  pinMode(XV102_PIN, OUTPUT);
  pinMode(M101_PIN, OUTPUT);
  pinMode(EH101_PIN, OUTPUT);
  pinMode(HL101_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println(F("Secvențiator rezervor – pornit, pas S0"));
}

void loop() {
  static int lastStep = -1;
  readInputs();
  seqScan();
  writeOutputs();
  if (step != lastStep) {
    lastStep = step;
    Serial.print(F("pas S")); Serial.print(step);
    Serial.print(F("  XV101=")); Serial.print(XV101);
    Serial.print(F(" XV102=")); Serial.print(XV102);
    Serial.print(F(" M101=")); Serial.print(M101);
    Serial.print(F(" EH101=")); Serial.print(EH101);
    Serial.print(F(" HL101=")); Serial.print(HL101);
    Serial.print(F("  TT101=")); Serial.println(TT101, 1);
  }
  delay(20);   // ciclu de scanare ≈ 20 ms
}
