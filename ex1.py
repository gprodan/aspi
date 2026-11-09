import snap7
from snap7.util import get_bool, get_int, get_real

# Connect to PLC
plc = snap7.client.Client()
plc.connect('192.168.0.1', 0, 1)  # IP, rack, slot

# Read 1 byte from DB1 starting at byte 10
data = plc.db_read(db_number=2, start=0, size=1)

# Example: interpret the first bit of that byte
bit_value = get_bool(data, 0, 1)  # byte index 0, bit index 0
print("Bit value:", bit_value)

# Example: interpret as unsigned integer
int_value = int.from_bytes(data, byteorder='big', signed=False)
print("Integer value:", int_value)

plc.disconnect()