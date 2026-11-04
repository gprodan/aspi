/*
 * Lucrarea 4 – Exemplul 4: Timer1 în mod CTC, întrerupere la 1 Hz
 * Perioada de eșantionare a unui regulator trebuie să fie exactă; loop() are durată variabilă,
 * deci eșantionarea se leagă de un timer hardware.
 *   OCR1A = f_CPU / (prescaler · f) - 1 = 16 000 000 / (1024 · 1) - 1 = 15624
 * Atenție: Timer1 comandă și PWM-ul pinilor 9 și 10; dacă îl reconfigurați, analogWrite(9) nu mai merge normal.
 */
volatile bool tick = false;
volatile uint16_t secunde = 0;
volatile uint32_t t_isr_us = 0;          // momentul ultimei ISR, pentru măsurarea jitterului
uint32_t t_prev_us = 0;

ISR(TIMER1_COMPA_vect) {
  t_isr_us = micros();
  secunde++;
  tick = true;                           // ISR cât mai scurt: doar semnalizează
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
  noInterrupts();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1  = 0;
  OCR1A  = 15624;
  TCCR1B |= (1 << WGM12);                // CTC, TOP = OCR1A
  TCCR1B |= (1 << CS12) | (1 << CS10);   // prescaler 1024
  TIMSK1 |= (1 << OCIE1A);
  interrupts();
  Serial.println(F("secunda;perioada_us;T"));
}

void loop() {
  if (tick) {
    noInterrupts();                      // copiere atomică a variabilelor pe 16/32 biți
    tick = false;
    uint16_t s = secunde;
    uint32_t t = t_isr_us;
    interrupts();
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    float T = analogRead(A0) * 5.0 / 1023.0 * 100.0;
    Serial.print(s); Serial.print(';');
    Serial.print(t - t_prev_us); Serial.print(';');
    Serial.println(T, 1);
    t_prev_us = t;
  }
}
