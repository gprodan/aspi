# Program PLC (S7-1215C) – FB_Sequencer

`FB_Sequencer.scl` este generat din modelul GRAFCET implicit al aplicației (fila 3, „SCL”).
Neverificat pe CPU-ul laboratorului. Verificați compilarea în TIA Portal și comportamentul pe PLCSIM sau pe CPU.

## Pași în TIA Portal
1. Proiect nou, CPU 1215C DC/DC/DC; Add new external file → `FB_Sequencer.scl` → Generate blocks from source.
2. Tabela de etichete: adresele din `../docs/lista_IO.csv` (PB101 `%I0.0`, … TT101_raw `%IW64`).
3. Bloc de date de instanță `DB_Seq` (instanță a lui `FB_Sequencer`).
4. În OB1 (SCL), după scalarea analogică și copierea intrărilor:

```
"TT101" := SCALE_X(MIN := 0.0, MAX := 100.0,
                   VALUE := NORM_X(MIN := 5530, MAX := 27648, VALUE := "TT101_raw"));  // 4–20 mA

"DB_Seq"(PB101 := "PB101", PB102 := "PB102", ES101 := "ES101",
         LSL101 := "LSL101", LSH101 := "LSH101", TT101 := "TT101");

"XV101" := "DB_Seq".XV101;  "XV102" := "DB_Seq".XV102;
"M101"  := "DB_Seq".M101;   "EH101" := "DB_Seq".EH101;  "HL101" := "DB_Seq".HL101;
```
(`"TT101"` din exemplu este o variabilă de tip Real, distinctă de `"TT101_raw"` de tip Int.)

5. Tabel de observare: `DB_Seq.Step`, intrările forțate (LSL, LSH, ES), `DB_Seq.t`.
6. Comparați momentele de tranziție cu simularea web.

## De verificat
- `TIME_TCK` există în S7-1200; dacă versiunea dumneavoastră nu o suportă, folosiți un TON pe fiecare pas.
- Blocul trebuie apelat în fiecare ciclu (OB1 sau OB cu întrerupere ciclică de 100 ms).
- ES101 în program înseamnă „apăsat”: cu contact NC cablat, inversați semnalul la intrare.
