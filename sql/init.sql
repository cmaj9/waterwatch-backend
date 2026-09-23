-- Water Level Monitoring System - Database Initialization
-- Run: psql -U postgres -d water_monitor -f sql/init.sql

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "GatewayStatus" AS ENUM ('online', 'offline', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StationType" AS ENUM ('river', 'canal', 'reservoir', 'urban');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StationStatus" AS ENUM ('active', 'inactive', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AlertType" AS ENUM ('water_level', 'battery', 'offline', 'tilt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AlertStatus" AS ENUM ('active', 'acknowledged', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: gateway
-- ============================================================
CREATE TABLE IF NOT EXISTS gateway (
  gateway_id   VARCHAR(20) PRIMARY KEY,
  gateway_name VARCHAR(100),
  ip_address   VARCHAR(50),
  last_update  TIMESTAMP,
  status       "GatewayStatus" DEFAULT 'offline'
);

-- ============================================================
-- TABLE: station
-- ============================================================
CREATE TABLE IF NOT EXISTS station (
  station_id    VARCHAR(20) PRIMARY KEY,
  gateway_id    VARCHAR(20) NOT NULL REFERENCES gateway(gateway_id) ON DELETE RESTRICT,
  station_name  VARCHAR(100),
  station_type  "StationType" DEFAULT 'river',
  location_name VARCHAR(150),
  latitude      DECIMAL(10, 6),
  longitude     DECIMAL(10, 6),
  install_date  DATE,
  status        "StationStatus" DEFAULT 'active',
  -- reference and calibration fields
  sensor_to_ref_distance FLOAT DEFAULT 2.0,
  reference_point_name   VARCHAR(100) DEFAULT 'จุดอ้างอิง',
  blind_zone_offset      FLOAT DEFAULT 0.28,
  tilt_compensation_enabled BOOLEAN DEFAULT true,
  -- threshold fields for alert logic (optional / relative to reference point)
  warning_level   FLOAT,
  critical_level  FLOAT,
  max_level       FLOAT,
  normal_max      FLOAT
);

-- ============================================================
-- TABLE: mcu
-- ============================================================
CREATE TABLE IF NOT EXISTS mcu (
  mcu_id           VARCHAR(20) PRIMARY KEY,
  station_id       VARCHAR(20) NOT NULL REFERENCES station(station_id) ON DELETE CASCADE,
  model            VARCHAR(100),
  firmware_version VARCHAR(50),
  signal_strength  FLOAT,
  battery_level    FLOAT,
  last_update      TIMESTAMP
);

-- ============================================================
-- TABLE: readings
-- ============================================================
CREATE TABLE IF NOT EXISTS readings (
  reading_id      BIGSERIAL PRIMARY KEY,
  station_id      VARCHAR(20) NOT NULL REFERENCES station(station_id) ON DELETE CASCADE,
  timestamp       TIMESTAMP NOT NULL DEFAULT NOW(),
  raw_distance    FLOAT,
  water_level     FLOAT,
  is_blind_zone   BOOLEAN DEFAULT false,
  temperature     FLOAT,
  humidity        FLOAT,
  battery_voltage FLOAT,
  battery_percent FLOAT,
  rssi            FLOAT,
  snr             FLOAT,
  tilt_x          FLOAT,
  tilt_y          FLOAT,
  latitude        DECIMAL(10, 6),
  longitude       DECIMAL(10, 6)
);

-- Index for fast queries by station + time
CREATE INDEX IF NOT EXISTS idx_readings_station_time ON readings (station_id, timestamp DESC);

-- ============================================================
-- TABLE: alerts
-- ============================================================

-- Sequence สำหรับ auto-generate alert_id
CREATE SEQUENCE IF NOT EXISTS alert_id_seq START 1;

-- Trigger function สร้าง alert_id แบบ 'AL-001'
CREATE OR REPLACE FUNCTION generate_alert_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.alert_id IS NULL OR NEW.alert_id = '' THEN
    NEW.alert_id := 'AL-' || LPAD(nextval('alert_id_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS alerts (
  alert_id   VARCHAR(20) PRIMARY KEY,
  station_id VARCHAR(20) NOT NULL REFERENCES station(station_id) ON DELETE CASCADE,
  timestamp  TIMESTAMP NOT NULL DEFAULT NOW(),
  alert_type "AlertType",
  value      FLOAT,
  threshold  FLOAT,
  message    VARCHAR(255),
  status     "AlertStatus" DEFAULT 'active'
);

-- ติด trigger กับ table alerts
DROP TRIGGER IF EXISTS trg_alert_id ON alerts;
CREATE TRIGGER trg_alert_id
  BEFORE INSERT ON alerts
  FOR EACH ROW EXECUTE FUNCTION generate_alert_id();

-- ============================================================
-- TABLE: station_mapping
-- Maps payload station_id (number from sensor) → station_id (VARCHAR in DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS station_mapping (
  payload_station_id  INTEGER PRIMARY KEY,
  station_id          VARCHAR(20) NOT NULL REFERENCES station(station_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: gateway_mapping
-- Maps ChirpStack gateway ID (hex) → gateway_id (VARCHAR in DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS gateway_mapping (
  chirpstack_gateway_id  VARCHAR(20) PRIMARY KEY,
  gateway_id             VARCHAR(20) NOT NULL REFERENCES gateway(gateway_id) ON DELETE CASCADE
);

-- ============================================================
-- SEED DATA (ข้อมูลเริ่มต้นทดสอบระบบ)
-- ============================================================

-- 1. Gateway
INSERT INTO gateway (gateway_id, gateway_name, ip_address, status) VALUES
  ('GW-001', 'Gateway_01', '192.168.1.100', 'online')
ON CONFLICT (gateway_id) DO NOTHING;

-- 2. Station
INSERT INTO station (
  station_id, gateway_id, station_name, station_type,
  location_name, latitude, longitude, install_date, status,
  sensor_to_ref_distance, reference_point_name,
  warning_level, critical_level, max_level, normal_max
) VALUES
  ('ST-001', 'GW-001', 'มหาวิทยาลัยราชมงคลธัญบุรี', 'river',
   'อ.คลองหก จ.ปทุมธานี', 14.03593, 100.72516, '2024-01-15', 'active',
   2.0, 'ขอบตลิ่ง', -0.5, 0.0, 1.0, -1.0),
  ('ST-002', 'GW-001', 'สถานีคลองรังสิต', 'canal',
   'อ.ธัญบุรี จ.ปทุมธานี', 14.0208, 100.7594, '2024-02-10', 'active',
   2.5, 'ขอบตลิ่ง', -0.6, 0.0, 1.0, -1.2)
ON CONFLICT (station_id) DO NOTHING;

-- 3. MCU
INSERT INTO mcu (mcu_id, station_id, model, firmware_version, signal_strength, battery_level) VALUES
  ('65bcbb52145372b1', 'ST-001', 'a01nyub-sensor',            'v1.2.0', -65.0, 100.0),
  ('a1b2c3d4e5f60001', 'ST-001', 'Heltec-WiFi-LoRa-32(V3)',    'v1.2.0', -85.0, 94.5),
  ('a1b2c3d4e5f60002', 'ST-002', 'Heltec-WiFi-LoRa-32(V3)',    'v1.2.0', -91.3, 78.0)
ON CONFLICT (mcu_id) DO NOTHING;

-- 4. Station Mapping (payload station_id → DB station_id)
INSERT INTO station_mapping (payload_station_id, station_id) VALUES
  (1, 'ST-001'),
  (2, 'ST-002')
ON CONFLICT (payload_station_id) DO UPDATE SET station_id = EXCLUDED.station_id;

-- 5. Gateway Mapping (ChirpStack hex ID → DB gateway_id)
INSERT INTO gateway_mapping (chirpstack_gateway_id, gateway_id) VALUES
  ('0016c001f1225893', 'GW-001'),
  ('aa555a0000000000', 'GW-001')
ON CONFLICT (chirpstack_gateway_id) DO UPDATE SET gateway_id = EXCLUDED.gateway_id;

-- 6. Readings
-- ไม่ใส่ข้อมูล mock: ข้อมูลจริงจะถูกบันทึกผ่าน ChirpStack MQTT โดยอัตโนมัติ

SELECT 'Database initialized successfully!' AS message;
