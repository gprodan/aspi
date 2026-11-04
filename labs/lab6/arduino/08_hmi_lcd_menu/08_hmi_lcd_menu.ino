/*
 * Lucrarea 6 – Exemplul 8: HMI local cu LCD 16x2 (HD44780) și patru butoane
 * Aceeași mașină de stări ca în emulatorul web (fila 3): HOME -> [CODE] -> MENU -> EDIT / INFO.
 *
 * Cablaj (LiquidCrystal, mod 4 biți):  RS=12  E=11  D4=5  D5=4  D6=3  D7=2   (RW la GND, V0 la potențiometru 10 kΩ)
 * Butoane către GND, INPUT_PULLUP:     SUS=A1  JOS=A2  OK=A3  ÎNAPOI=A4
 * LM35 pe A0, releu/LED pe D8.
 * Funcții: termostat ON/OFF cu histerezis, mod Auto/Man ON/Man OFF, alarmă la T > prag (confirmare cu OK),
 *          cod de acces 1234 pentru modificări, ieșire automată în HOME după 20 s, setări păstrate în EEPROM.
 */
#include <LiquidCrystal.h>
#include <EEPROM.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
const uint8_t PIN_BTN[4] = {A1, A2, A3, A4};   // 0=SUS 1=JOS 2=OK 3=ÎNAPOI
const uint8_t PIN_RELEU = 8;
const unsigned long TIMEOUT_MS = 20000;
const char *COD = "1234";

struct Setari { uint16_t magic; float sp; float banda; uint8_t mod; float alarmaH; };
Setari cfg = {0xA55A, 38.0, 1.0, 0, 41.0};

enum Stare { HOME, CODE, MENU, EDIT, INFO } stare = HOME;
const char *ITEMS[] = {"Consemn", "Histerezis", "Mod", "Alarma H", "Info"};
const uint8_t N_ITEMS = 5;
const char *MODURI[] = {"Auto", "Man ON", "Man OFF"};

uint8_t cursor_m = 0, cod_i = 0;
char cod_d[5] = {'0', '0', '0', '0', 0};
float edit_v = 0;
bool blocat = true, alarma_conf = false, releu = false;
float T = 0;
unsigned long ultima_tasta = 0, t_msg = 0, t_citire = 0, t_lcd = 0;
const char *msg = nullptr;

// ---- butoane cu antirevenire și repetare ----
bool stare_b[4] = {false, false, false, false};
unsigned long t_schimb[4] = {0, 0, 0, 0}, t_apas[4] = {0, 0, 0, 0}, t_rep[4] = {0, 0, 0, 0};

// întoarce -1 sau indexul butonului: la apăsare, iar pentru SUS/JOS și la repetare
int citeste_taste() {
  unsigned long acum = millis();
  for (uint8_t i = 0; i < 4; i++) {
    bool apasat = digitalRead(PIN_BTN[i]) == LOW;
    if (apasat != stare_b[i] && acum - t_schimb[i] > 30) {           // debounce 30 ms
      t_schimb[i] = acum; stare_b[i] = apasat;
      if (apasat) { t_apas[i] = acum; t_rep[i] = acum + 500; return i; }
    }
    if (stare_b[i] && i < 2 && acum >= t_rep[i]) {                   // repetare accelerată
      t_rep[i] = acum + ((acum - t_apas[i] > 2500) ? 50 : 140);
      return i;
    }
  }
  return -1;
}

void linie(uint8_t r, const char *s) {                              // scrie exact 16 caractere
  lcd.setCursor(0, r);
  uint8_t n = 0;
  while (s[n] && n < 16) lcd.write(s[n++]);
  while (n++ < 16) lcd.write(' ');
}

void salveaza() { EEPROM.put(0, cfg); }

void termostat() {
  if (cfg.mod == 1) releu = true;
  else if (cfg.mod == 2) releu = false;
  else if (T < cfg.sp - cfg.banda / 2) releu = true;
  else if (T > cfg.sp + cfg.banda / 2) releu = false;
  if (T > 48.0) releu = false;                                       // protecție locală, independentă de meniu
  digitalWrite(PIN_RELEU, releu ? HIGH : LOW);
}

void afiseaza() {
  char a[40], b[40], s[16];
  if (msg && millis() < t_msg) { linie(0, msg); linie(1, ""); return; }
  msg = nullptr;
  switch (stare) {
    case HOME: {
      bool alarma = T > cfg.alarmaH;
      dtostrf(T, 4, 1, s);  snprintf(a, sizeof a, "T=%sC", s);
      dtostrf(cfg.sp, 4, 1, s); snprintf(a + strlen(a), sizeof a - strlen(a), " SP=%s", s);
      if (alarma && !alarma_conf) snprintf(b, sizeof b, "%s", (millis() / 500) % 2 ? "!ALARMA T RIDIC." : "");
      else if (alarma)            snprintf(b, sizeof b, "Alarma confirmata");
      else                        snprintf(b, sizeof b, "Releu:%s %s", releu ? "ON " : "OFF", MODURI[cfg.mod]);
      linie(0, a); linie(1, b); break; }
    case CODE:
      linie(0, "Cod acces:");
      snprintf(b, sizeof b, "  ");
      for (uint8_t i = 0; i < 4; i++) { char t[4] = { i == cod_i ? '[' : ' ', cod_d[i], i == cod_i ? ']' : ' ', 0 }; strcat(b, t); }
      linie(1, b); break;
    case MENU:
      snprintf(a, sizeof a, "MENIU        %u/%u", cursor_m + 1, N_ITEMS);
      snprintf(b, sizeof b, ">%s", ITEMS[cursor_m]);
      linie(0, a); linie(1, b); break;
    case EDIT:
      linie(0, ITEMS[cursor_m]);
      if (cursor_m == 2) snprintf(s, sizeof s, "%s", MODURI[(int)edit_v]);
      else { dtostrf(edit_v, 4, 1, s); strcat(s, " C"); }
      snprintf(b, sizeof b, "<  %s  >", s);
      linie(1, b); break;
    case INFO:
      linie(0, "Info  proces");
      snprintf(b, sizeof b, "t=%lus", millis() / 1000);
      linie(1, b); break;
  }
}

void tasta(int k) {
  switch (stare) {
    case HOME:
      if (k == 2) {
        if (T > cfg.alarmaH && !alarma_conf) alarma_conf = true;      // prima apăsare confirmă alarma
        else if (blocat) { stare = CODE; strcpy(cod_d, "0000"); cod_i = 0; }
        else { stare = MENU; cursor_m = 0; }
      }
      break;
    case CODE:
      if (k == 0) cod_d[cod_i] = (cod_d[cod_i] == '9') ? '0' : cod_d[cod_i] + 1;
      else if (k == 1) cod_d[cod_i] = (cod_d[cod_i] == '0') ? '9' : cod_d[cod_i] - 1;
      else if (k == 2) {
        if (cod_i < 3) cod_i++;
        else if (!strcmp(cod_d, COD)) { blocat = false; stare = MENU; cursor_m = 0; }
        else { msg = "Cod gresit"; t_msg = millis() + 1000; stare = HOME; }
      } else if (k == 3) { if (cod_i > 0) cod_i--; else stare = HOME; }
      break;
    case MENU:
      if (k == 0) cursor_m = (cursor_m + N_ITEMS - 1) % N_ITEMS;
      else if (k == 1) cursor_m = (cursor_m + 1) % N_ITEMS;
      else if (k == 3) stare = HOME;
      else if (k == 2) {
        if (cursor_m == 4) stare = INFO;
        else {
          stare = EDIT;
          edit_v = cursor_m == 0 ? cfg.sp : cursor_m == 1 ? cfg.banda : cursor_m == 2 ? cfg.mod : cfg.alarmaH;
        }
      }
      break;
    case EDIT:
      if (k == 0 || k == 1) {
        int s = (k == 0) ? 1 : -1;
        if (cursor_m == 2) edit_v = (int)(edit_v + s + 3) % 3;
        else {
          edit_v += s * (cursor_m == 1 ? 0.1 : 0.5);
          edit_v = round(edit_v * 10) / 10.0;
          if (cursor_m == 0) edit_v = constrain(edit_v, 15.0, 60.0);
          if (cursor_m == 1) edit_v = constrain(edit_v, 0.2, 5.0);
          if (cursor_m == 3) edit_v = constrain(edit_v, 30.0, 48.0);
        }
      } else if (k == 2) {
        if (cursor_m == 0) cfg.sp = edit_v; else if (cursor_m == 1) cfg.banda = edit_v;
        else if (cursor_m == 2) cfg.mod = (uint8_t)edit_v; else cfg.alarmaH = edit_v;
        salveaza(); msg = "Salvat!"; t_msg = millis() + 900; stare = MENU;
      } else if (k == 3) stare = MENU;
      break;
    case INFO:
      if (k == 2 || k == 3) stare = MENU;
      break;
  }
}

void setup() {
  for (uint8_t i = 0; i < 4; i++) pinMode(PIN_BTN[i], INPUT_PULLUP);
  pinMode(PIN_RELEU, OUTPUT);
  lcd.begin(16, 2);
  Setari tmp; EEPROM.get(0, tmp);
  if (tmp.magic == 0xA55A && tmp.sp >= 15 && tmp.sp <= 60) cfg = tmp;   // setări valide din EEPROM
  linie(0, "HMI biogaz"); linie(1, "Lucrarea 6");
  delay(800);
}

void loop() {
  unsigned long acum = millis();
  if (acum - t_citire >= 250) {                                      // măsurare 4 Hz
    t_citire = acum;
    long s = 0;
    for (uint8_t i = 0; i < 8; i++) s += analogRead(A0);
    float brut = (s / 8.0) * 5.0 / 1023.0 * 100.0;
    T = (T == 0) ? brut : 0.8 * T + 0.2 * brut;
    termostat();
    if (T < cfg.alarmaH - 0.5) alarma_conf = false;
  }
  int k = citeste_taste();
  if (k >= 0) { ultima_tasta = acum; tasta(k); }
  if (stare != HOME && acum - ultima_tasta > TIMEOUT_MS) { stare = HOME; blocat = true; }
  if (acum - t_lcd >= 100) { t_lcd = acum; afiseaza(); }
}
