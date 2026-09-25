# FloodGuard — Telemetry & Early Warning Backend

Node.js + Express backend ที่รับข้อมูลจาก **ChirpStack** ผ่าน **MQTT**,
บันทึกลง **PostgreSQL** และเปิด **REST API** ให้ Frontend Dashboard ดึงข้อมูล

## โครงสร้าง

```
Project_Backend/
├── .env                    ← ตั้งค่า DB + MQTT (แก้ค่านี้ก่อน!)
├── .env.example            ← template
├── package.json
├── sql/
│   └── init.sql            ← SQL script สร้าง tables
└── src/
    ├── server.js           ← Entry point
    ├── app.js              ← Express app
    ├── config/
    │   ├── database.js     ← PostgreSQL pool
    │   └── mqtt.js         ← MQTT subscriber
    ├── routes/
    │   ├── readings.js     ← GET /api/readings
    │   └── stations.js     ← GET /api/stations
    ├── services/
    │   └── readingService.js ← Parse payload + DB insert
    └── scripts/
        └── initDb.js       ← Script รัน init.sql
```

## การติดตั้งและใช้งาน

### 1. ตั้งค่า `.env`

```bash
# แก้ไขไฟล์ .env ตามสภาพแวดล้อมของคุณ
DB_HOST=localhost
DB_PORT=5432
DB_NAME=water_monitor
DB_USER=postgres
DB_PASSWORD=your_password

MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=           # ถ้ามี
MQTT_PASSWORD=           # ถ้ามี
MQTT_TOPIC=application/+/device/+/event/up
```

### 2. สร้าง Database (ครั้งแรกเท่านั้น)

```bash
# สร้าง database ก่อน (ใน psql)
createdb -U postgres water_monitor

# รัน init script
npm run db:init
```

### 3. เพิ่มข้อมูล Gateway และ Station

เพิ่มข้อมูลใน DB ให้ตรงกับ DevEUI ของอุปกรณ์ใน ChirpStack:

```sql
-- ============================================================
-- GATEWAY (2 เครื่อง)
-- ============================================================
INSERT INTO gateway (gateway_id, gateway_name, ip_address, status) VALUES
  ('GW-001', 'Gateway ฝั่งเหนือ', '192.168.1.100', 'online'),
  ('GW-002', 'Gateway ฝั่งใต้',  '192.168.1.101', 'online')
ON CONFLICT (gateway_id) DO NOTHING;

-- ============================================================
-- STATION (4 สถานี)
-- ============================================================
INSERT INTO station (
  station_id, gateway_id, station_name, station_type,
  location_name, latitude, longitude, install_date, status,
  warning_level, critical_level, max_level, normal_max
) VALUES
  ('ST-001', 'GW-001', 'สถานีแม่น้ำเจ้าพระยา ต้นน้ำ', 'river',
   'อ.บางปะอิน จ.พระนครศรีอยุธยา', 14.2322, 100.5781, '2024-01-15', 'active',
   4.5, 5.5, 7.0, 3.0),

  ('ST-002', 'GW-001', 'สถานีคลองรังสิต', 'canal',
   'อ.ธัญบุรี จ.ปทุมธานี', 14.0208, 100.7594, '2024-02-10', 'active',
   2.0, 3.0, 4.5, 1.2),

  ('ST-003', 'GW-002', 'สถานีอ่างเก็บน้ำห้วยมะเดื่อ', 'reservoir',
   'อ.เมือง จ.นครราชสีมา', 14.9798, 102.0978, '2024-03-01', 'active',
   6.0, 7.5, 10.0, 4.0),

  ('ST-004', 'GW-002', 'สถานีระบายน้ำเขตดอนเมือง', 'urban',
   'เขตดอนเมือง กรุงเทพมหานคร', 13.9125, 100.5974, '2024-03-20', 'maintenance',
   0.8, 1.2, 2.0, 0.3)
ON CONFLICT (station_id) DO NOTHING;

-- ============================================================
-- MCU (1 ตัวต่อสถานี, mcu_id = DevEUI จาก ChirpStack)
-- ============================================================
INSERT INTO mcu (mcu_id, station_id, model, firmware_version, signal_strength, battery_level) VALUES
  ('a1b2c3d4e5f60001', 'ST-001', 'ESP32-LoRa',    'v1.2.0', -85.0, 94.5),
  ('a1b2c3d4e5f60002', 'ST-002', 'ESP32-LoRa',    'v1.2.0', -91.3, 78.0),
  ('a1b2c3d4e5f60003', 'ST-003', 'RAK3172-LoRaWAN','v2.0.1', -78.6, 100.0),
  ('a1b2c3d4e5f60004', 'ST-004', 'RAK3172-LoRaWAN','v2.0.1', -95.1, 42.3)
ON CONFLICT (mcu_id) DO NOTHING;
```

### 4. รัน Backend

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### 5. ทดสอบ API

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/readings
curl http://localhost:3001/api/stations
```

## API Endpoints

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/health` | สถานะ server + MQTT |
| GET | `/api/readings` | ค่าล่าสุดทุกสถานี |
| GET | `/api/readings/:stationId` | ค่าล่าสุดของสถานีนั้น (paginated) |
| GET | `/api/readings/:stationId/range?start=&end=` | ค่าในช่วงเวลา (สำหรับกราฟ) |
| GET | `/api/stations` | รายการสถานีพร้อมข้อมูลล่าสุด |
| GET | `/api/stations/:stationId` | รายละเอียดสถานีเดียว |

## ChirpStack Payload Format

### แบบ JSON Decoded Object (ผ่าน Codec)
```json
{
  "deviceInfo": { "devEui": "a1b2c3d4e5f60001" },
  "object": {
    "water_level": 2.45,
    "temperature": 32.5,
    "humidity": 60.0,
    "battery_voltage": 3.9,
    "battery_percent": 85,
    "tilt_x": 0.1,
    "tilt_y": -0.2,
    "latitude": 14.2322,
    "longitude": 100.5781
  },
  "rxInfo": [{ "rssi": -85, "snr": 7.5 }],
  "time": "2026-08-01T10:00:00Z"
}
```

### แบบ Raw Base64 Bytes
```
Byte layout:
[0-1]   water_level   : int16 / 100 → meters
[2-3]   temperature   : int16 / 100 → °C
[4-5]   humidity      : uint16 / 100 → %
[6-7]   battery_volt  : uint16 / 1000 → V
[8]     battery_pct   : uint8 → %
[9-10]  tilt_x        : int16 / 100
[11-12] tilt_y        : int16 / 100
```
> หากรูปแบบต่างออกไป ให้แก้ไขใน `src/services/readingService.js` ส่วน "Format 2"
