# Punte Modbus → ThingsBoard

`tb_bridge.py` citește RTU-ul Arduino (lucrările 2 și 4) și publică telemetria în ThingsBoard prin MQTT.

    pip install pyserial paho-mqtt
    python tb_bridge.py --serial COM5 --host thingsboard.local --token <ACCESS_TOKEN>
    python tb_bridge.py --tcp 127.0.0.1:502 --token <ACCESS_TOKEN>    # prin gateway-ul din lucrarea 2
    python tb_bridge.py --serial COM5 --dry-run                       # fără ThingsBoard

Telemetrie: `temperature`, `output`, `setpoint`, `comm_ok`. RPC: `setSetpoint` (°C, 15…60), `getSetpoint`.
Token-ul este secret: nu îl publicați în GitHub.
