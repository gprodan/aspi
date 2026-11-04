# Automatizarea Sistemelor și Proceselor Industriale (MSP2101)

- `index.html` – pagina de start (date despre disciplină + lista laboratoarelor)
- `labs/labN/index.html` – aplicația lucrării N
- Pentru a lega o aplicație: pune-o în `labs/labN/` și completează `href` (și `d`) în lista `LABS` din `index.html`.
- Publicare: Settings → Pages → ramura `main`, folder `/ (root)`.

- `labs/lab2/` – simulator PLC (SCL/Ladder) + Modbus; `labs/lab2/arduino/rtu_biogaz/` – sketch Arduino (slave Modbus RTU); `labs/lab2/gateway/modbus_gateway.py` – gateway Modbus TCP→RTU (pip install pyserial)
- `labs/lab4/` – Arduino: calculator Timer1/PWM, ADC și senzori, mini-interpretor C++ cu placă virtuală (`arduino.js`, `tools.js`); `labs/lab4/arduino/01…07_*/` – sketch-uri pentru Arduino Uno (millis, senzori, histerezis, Timer1, INT0, PI, Modbus RTU)
