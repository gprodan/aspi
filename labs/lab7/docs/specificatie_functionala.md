# Specificație funcțională – rezervor agitat cu încălzire

Versiune 0.1 · autor: ________ · data: ________ · stare: ciornă

## 1. Scop
Prepararea automată a unei șarje: umplere, încălzire la temperatura impusă, menținere, golire.

## 2. Cerințe (fiecare cerință este testabilă)
| Nr. | Cerință | Test |
|---|---|---|
| C1 | La START, cu rezervorul gol, se deschide XV101 până la LSH101 | T1 |
| C2 | Încălzirea pornește numai cu agitatorul M101 pornit și lichid peste LSL101 | T7 |
| C3 | Temperatura nu depășește SP + 2 °C în regim normal | T1 |
| C4 | Temperatura se menține HOLD secunde | T1 |
| C5 | La ES101 toate ieșirile comandate se opresc într-un ciclu și se aprinde HL101 | T3 |
| C6 | Dacă LSH101 nu răspunde, umplerea se oprește prin timeout, fără preaplin | T2 |
| C7 | Dacă TT101 nu variază, încălzirea se oprește prin timeout, sub 60 °C | T4 |
| C8 | Din avarie se iese numai cu RESET (PB102) după eliberarea ES101 | T5 |
| C9 | STOP (PB102) în funcționare golește rezervorul și revine în repaus | T6 |

## 3. Secvența (GRAFCET)
S0 Repaus → S1 Umplere → S2 Încălzire → S3 Menținere → S4 Golire → S0; S9 Avarie.
Tranzițiile și acțiunile sunt cele din modelul `model_grafcet.json` exportat din aplicație.

## 4. Parametri
SP = 37 °C, HOLD = 20 s, timeout S1 = 24 s, S2 = 60 s, S4 = 60 s.

## 5. Lista I/E
Vezi `lista_IO.csv`.

## 6. Istoric modificări
Vezi `CHANGELOG.md`.
