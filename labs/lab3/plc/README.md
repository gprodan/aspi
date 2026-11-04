# Regulatoare în PLC (S7-1215C)

Două variante, de comparat:

1. **PID_Compact** (instrucțiune tehnologică din TIA Portal).
2. **FB_PI.scl** (implementare proprie, aceeași structură ca în simulatorul web).

Neverificate pe CPU-ul laboratorului. Verificați compilarea și comportamentul înainte de utilizare.

## PID_Compact
1. Proiect cu CPU 1215C; adăugați un OB cu întrerupere ciclică (Cyclic interrupt, 100 ms).
2. Technology objects → Add new object → PID → PID_Compact; instanță `PID_Temp`.
3. Configurare: tip de mărime (Temperature/Level), mărimea de măsură (`Input`) scalată în unități inginerești, ieșirea `Output_PWM` (comutare cu perioadă) sau `Output` (analogic), limitele ieșirii 0…100 %.
4. Optimizare: *Commissioning* → *Pretuning* (determină K, T, L), apoi *Fine tuning*; verificați parametrii obținuți față de formulele ZN/IMC din aplicație.
5. Apel: `"PID_Temp"(Setpoint := "SP", Input := "TT101", Output := "U");`.

## FB_PI
1. Add new external file → `FB_PI.scl` → Generate blocks from source.
2. Instanță `DB_PI`, apelată în OB30:
```
"DB_PI"(SP := "SP", PV := "TT101", Kp := 1.2, Ti := 25.0, Td := 0.0, Ts := 0.1,
        Auto := "AUTO");
"U" := "DB_PI".Out;
```
3. Comparați răspunsul la o treaptă de consemn cu cel din simulator (fila 3) și cu PID_Compact: depășire, timp de stabilire, comportarea la saturație (reduceți OutMax la 30 %).
4. Atenție la scalarea intrării analogice (NORM_X/SCALE_X) și la perioada reală a OB-ului: Ts din apel trebuie să fie egal cu perioada ciclică setată.
