import time
import serial
import snap7
from snap7.util import set_real

# ================= CONFIGURARE PLC =================
PLC_IP = "192.168.0.10"  # IP-ul PLC-ului (sau IP-ul VM1 cu NetToPLCSim)
RACK = 0
SLOT = 1
DB_NUMBER = 1            # Numărul Data Block-ului din TIA Portal (ex: DB1)

# ================= CONFIGURARE SERIALĂ =============
# Pentru Hyper-V Named Pipe folosești calea conductei, altfel pui 'COM1', 'COM2' etc.
SERIAL_PORT = r"\\.\pipe\ArduinoPipe" 
BAUD_RATE = 9600

# Maparea etichetelor text primite de la Arduino către offset-ul (adresa) din DB
# Exemplu: În TIA Portal în DB1 ai 'temperatura' la offset 0.0 și 'presiune' la offset 4.0
DB_MAPPING = {
    "temperatura": 0,  # Va scrie la DB1.DBD0 (Real)
    "presiune": 4      # Va scrie la DB1.DBD4 (Real)
}

def connect_plc():
    plc = snap7.client.Client()
    try:
        plc.connect(PLC_IP, RACK, SLOT)
        if plc.get_connected():
            print(f"[PLC] Conectat cu succes la {PLC_IP}")
            return plc
    except Exception as e:
        print(f"[PLC] Eroare la conectare: {e}")
    return None

def write_float_to_db(plc, db_num, start_offset, value):
    try:
        # Citim cele 4 bage-uri curente de la adresa respectivă pentru a nu corupe restul datelor
        reading = plc.db_read(db_num, start_offset, 4)
        # Setați valoarea float (REAL) în buffer
        set_real(reading, 0, float(value))
        # Scriem bufferul înapoi în PLC
        plc.db_write(db_num, start_offset, reading)
        print(f"[PLC] Scris valoarea {value} la DB{db_num}.DBD{start_offset}")
    except Exception as e:
        print(f"[PLC] Eroare la scrierea în DB: {e}")

def main():
    plc = connect_plc()
    
    print(f"[SERIAL] Se deschide portul: {SERIAL_PORT}...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    except Exception as e:
        print(f"[SERIAL] Nu s-a putut deschide portul: {e}")
        return

    print("[SYSTEM] Aplicația rulează. Se așteaptă date...")
    
    while True:
        # Ne asigurăm că PLC-ul este în continuare conectat
        if plc is None or not plc.get_connected():
            print("[PLC] Conexiune pierdută. Reîncercare...")
            time.sleep(2)
            plc = connect_plc()
            continue

        try:
            if ser.in_waiting > 0:
                # Citim linia de text venită de la simulator
                raw_line = ser.readline().decode('utf-8').strip()
                if not raw_line:
                    continue
                
                print(f"[SERIAL REC] {raw_line}")
                
                # Parsăm linia (Ex: "temperatura: 24.5, presiune: 1012.3")
                perechi = raw_line.split(",")
                for pereche in perechi:
                    if ":" in pereche:
                        cheie, valoare = pereche.split(":")
                        cheie = cheie.strip().lower()
                        valoare = valoare.strip()
                        
                        # Dacă eticheta există în maparea noastră, o trimitem în PLC
                        if cheie in DB_MAPPING:
                            offset = DB_MAPPING[cheie]
                            write_float_to_db(plc, DB_NUMBER, offset, valoare)
                            
        except Exception as e:
            print(f"[LOOP ERROR] {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()