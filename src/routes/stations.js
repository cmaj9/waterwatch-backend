const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { recalculateStationReadings } = require('../services/readingService');

// ── GET /api/stations ─────────────────────────────────────────────
// Returns all stations with their latest reading joined
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT
        s.station_id,
        s.station_name,
        s.station_type,
        s.location_name,
        s.latitude,
        s.longitude,
        s.status,
        s.sensor_to_ref_distance,
        COALESCE(NULLIF(TRIM(s.reference_point_name), ''), 'จุดอ้างอิง') AS reference_point_name,
        s.blind_zone_offset,
        s.tilt_compensation_enabled,
        s.warning_level,
        s.critical_level,
        s.max_level,
        s.normal_max,
        g.gateway_name,
        g.status AS gateway_status,
        -- Latest reading (subquery)
        lr.timestamp        AS last_reading_time,
        lr.raw_distance,
        -- Dynamically calculate relative water_level based on current sensor_to_ref_distance
        COALESCE(
          CASE
            WHEN lr.raw_distance IS NOT NULL THEN
              ROUND((
                s.sensor_to_ref_distance - (
                  CASE
                    WHEN s.tilt_compensation_enabled = true AND (lr.tilt_x IS NOT NULL OR lr.tilt_y IS NOT NULL)
                    THEN lr.raw_distance * COS(SQRT(COALESCE(lr.tilt_x, 0)^2 + COALESCE(lr.tilt_y, 0)^2) * PI() / 180)
                    ELSE lr.raw_distance
                  END
                )
              )::numeric, 3)
            ELSE lr.water_level
          END,
          0
        ) AS water_level,
        lr.is_blind_zone,
        lr.temperature,
        lr.humidity,
        lr.battery_voltage,
        lr.battery_percent,
        lr.rssi,
        lr.snr,
        lr.tilt_x,
        lr.tilt_y,
        -- Derive status from calculated relative water_level vs thresholds (if configured)
        CASE
          WHEN lr.raw_distance IS NULL AND lr.water_level IS NULL THEN 'unknown'
          WHEN s.critical_level IS NOT NULL AND (
            COALESCE(
              CASE
                WHEN lr.raw_distance IS NOT NULL THEN
                  ROUND((
                    s.sensor_to_ref_distance - (
                      CASE
                        WHEN s.tilt_compensation_enabled = true AND (lr.tilt_x IS NOT NULL OR lr.tilt_y IS NOT NULL)
                        THEN lr.raw_distance * COS(SQRT(COALESCE(lr.tilt_x, 0)^2 + COALESCE(lr.tilt_y, 0)^2) * PI() / 180)
                        ELSE lr.raw_distance
                      END
                    )
                  )::numeric, 3)
                ELSE lr.water_level
              END,
              0
            ) >= s.critical_level
          ) THEN 'critical'
          WHEN s.warning_level IS NOT NULL AND (
            COALESCE(
              CASE
                WHEN lr.raw_distance IS NOT NULL THEN
                  ROUND((
                    s.sensor_to_ref_distance - (
                      CASE
                        WHEN s.tilt_compensation_enabled = true AND (lr.tilt_x IS NOT NULL OR lr.tilt_y IS NOT NULL)
                        THEN lr.raw_distance * COS(SQRT(COALESCE(lr.tilt_x, 0)^2 + COALESCE(lr.tilt_y, 0)^2) * PI() / 180)
                        ELSE lr.raw_distance
                      END
                    )
                  )::numeric, 3)
                ELSE lr.water_level
              END,
              0
            ) >= s.warning_level
          ) THEN 'warning'
          ELSE 'normal'
        END AS water_status
      FROM station s
      JOIN gateway g ON g.gateway_id = s.gateway_id
      LEFT JOIN LATERAL (
        SELECT * FROM readings r
        WHERE r.station_id = s.station_id
        ORDER BY r.timestamp DESC
        LIMIT 1
      ) lr ON true
      ORDER BY s.station_name
    `;
    const result = await db.query(sql);
    res.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('[API /stations] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch stations' });
  }
});

// ── GET /api/stations/:stationId ──────────────────────────────────
// Returns single station detail with last reading
router.get('/:stationId', async (req, res) => {
  const { stationId } = req.params;
  try {
    const sql = `
      SELECT
        s.*,
        COALESCE(NULLIF(TRIM(s.reference_point_name), ''), 'จุดอ้างอิง') AS reference_point_name,
        g.gateway_name,
        g.ip_address,
        g.status AS gateway_status,
        m.mcu_id, m.model, m.firmware_version, m.signal_strength, m.battery_level,
        lr.timestamp AS last_reading_time,
        lr.raw_distance,
        COALESCE(
          CASE
            WHEN lr.raw_distance IS NOT NULL THEN
              ROUND((
                s.sensor_to_ref_distance - (
                  CASE
                    WHEN s.tilt_compensation_enabled = true AND (lr.tilt_x IS NOT NULL OR lr.tilt_y IS NOT NULL)
                    THEN lr.raw_distance * COS(SQRT(COALESCE(lr.tilt_x, 0)^2 + COALESCE(lr.tilt_y, 0)^2) * PI() / 180)
                    ELSE lr.raw_distance
                  END
                )
              )::numeric, 3)
            ELSE lr.water_level
          END,
          0
        ) AS water_level,
        lr.is_blind_zone,
        lr.temperature, lr.humidity,
        lr.battery_voltage, lr.battery_percent,
        lr.rssi, lr.snr, lr.tilt_x, lr.tilt_y,
        lr.latitude AS reading_lat, lr.longitude AS reading_lng,
        CASE
          WHEN lr.raw_distance IS NULL AND lr.water_level IS NULL THEN 'unknown'
          WHEN s.critical_level IS NOT NULL AND (
            COALESCE(
              CASE
                WHEN lr.raw_distance IS NOT NULL THEN
                  ROUND((
                    s.sensor_to_ref_distance - (
                      CASE
                        WHEN s.tilt_compensation_enabled = true AND (lr.tilt_x IS NOT NULL OR lr.tilt_y IS NOT NULL)
                        THEN lr.raw_distance * COS(SQRT(COALESCE(lr.tilt_x, 0)^2 + COALESCE(lr.tilt_y, 0)^2) * PI() / 180)
                        ELSE lr.raw_distance
                      END
                    )
                  )::numeric, 3)
                ELSE lr.water_level
              END,
              0
            ) >= s.critical_level
          ) THEN 'critical'
          WHEN s.warning_level IS NOT NULL AND (
            COALESCE(
              CASE
                WHEN lr.raw_distance IS NOT NULL THEN
                  ROUND((
                    s.sensor_to_ref_distance - (
                      CASE
                        WHEN s.tilt_compensation_enabled = true AND (lr.tilt_x IS NOT NULL OR lr.tilt_y IS NOT NULL)
                        THEN lr.raw_distance * COS(SQRT(COALESCE(lr.tilt_x, 0)^2 + COALESCE(lr.tilt_y, 0)^2) * PI() / 180)
                        ELSE lr.raw_distance
                      END
                    )
                  )::numeric, 3)
                ELSE lr.water_level
              END,
              0
            ) >= s.warning_level
          ) THEN 'warning'
          ELSE 'normal'
        END AS water_status
      FROM station s
      JOIN gateway g ON g.gateway_id = s.gateway_id
      LEFT JOIN mcu m ON m.station_id = s.station_id
      LEFT JOIN LATERAL (
        SELECT * FROM readings r
        WHERE r.station_id = s.station_id
        ORDER BY r.timestamp DESC
        LIMIT 1
      ) lr ON true
      WHERE s.station_id = $1
    `;
    const result = await db.query(sql, [stationId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(`[API /stations/${stationId}] Error:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch station' });
  }
});

// ── PATCH /api/stations/:stationId/status ──────────────────────────
// Quick toggle station status ('active' / 'offline' / 'maintenance')
router.patch('/:stationId/status', async (req, res) => {
  const { stationId } = req.params;
  const { status } = req.body;

  const validStatuses = ['active', 'offline', 'maintenance'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `สถานะไม่ถูกต้อง (ต้องเป็น ${validStatuses.join(', ')})`,
    });
  }

  try {
    const result = await db.query(
      `UPDATE station SET status = $1 WHERE station_id = $2 RETURNING station_id, station_name, status`,
      [status, stationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const row = result.rows[0];
    console.log(`[API /stations] Station ${stationId} status changed to '${status}'`);
    res.json({
      success: true,
      data: row,
      message: status === 'active' ? 'เปิดให้บริการสถานีเรียบร้อยแล้ว' : 'ปรับสถานะสถานีเป็นออฟไลน์เรียบร้อยแล้ว',
    });
  } catch (err) {
    console.error(`[API /stations/${stationId}/status] Error:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to update station status' });
  }
});

// ── PUT /api/stations/:stationId/calibration ──────────────────────
// Update calibration and reference point parameters for a station
router.put('/:stationId/calibration', async (req, res) => {
  const { stationId } = req.params;
  const {
    sensor_to_ref_distance,
    reference_point_name,
    warning_level,
    critical_level,
    blind_zone_offset,
    tilt_compensation_enabled,
  } = req.body;

  try {
    const refName = reference_point_name && reference_point_name.trim() !== ''
      ? reference_point_name.trim()
      : 'จุดอ้างอิง';

    const sql = `
      UPDATE station
      SET
        sensor_to_ref_distance    = COALESCE($1, sensor_to_ref_distance),
        reference_point_name      = $2,
        warning_level             = $3,
        critical_level            = $4,
        blind_zone_offset         = COALESCE($5, blind_zone_offset),
        tilt_compensation_enabled = COALESCE($6, tilt_compensation_enabled)
      WHERE station_id = $7
      RETURNING *
    `;

    const values = [
      sensor_to_ref_distance != null && !isNaN(Number(sensor_to_ref_distance)) ? Number(sensor_to_ref_distance) : null,
      refName,
      warning_level != null && !isNaN(Number(warning_level)) ? Number(warning_level) : null,
      critical_level != null && !isNaN(Number(critical_level)) ? Number(critical_level) : null,
      blind_zone_offset != null && !isNaN(Number(blind_zone_offset)) ? Number(blind_zone_offset) : null,
      tilt_compensation_enabled != null ? Boolean(tilt_compensation_enabled) : null,
      stationId,
    ];

    const result = await db.query(sql, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const updated = result.rows[0];
    const newSensorToRef = Number(updated.sensor_to_ref_distance);
    const tiltEnabled = updated.tilt_compensation_enabled;
    const blindZone = updated.blind_zone_offset;

    // Recalculate all historical and latest readings in database immediately
    let recalculatedCount = 0;
    try {
      recalculatedCount = await recalculateStationReadings(stationId, newSensorToRef, tiltEnabled, blindZone);
    } catch (recalcErr) {
      console.warn(`[API /stations/${stationId}/calibration] Recalculate warning:`, recalcErr.message);
    }

    console.log(`[API /stations] Station ${stationId} calibrated: D_ref=${newSensorToRef}m, Ref='${updated.reference_point_name}', Recalculated=${recalculatedCount} readings`);
    res.json({
      success: true,
      data: updated,
      recalculatedCount,
      message: 'บันทึกการตั้งค่าจุดอ้างอิงและคำนวณค่าระดับน้ำทั้งหมดสำเร็จ',
    });
  } catch (err) {
    console.error(`[API /stations/${stationId}/calibration] Error:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to update calibration' });
  }
});

// ── PUT /api/stations/:stationId ──────────────────────────────────
// Update full station data including metadata and calibration
router.put('/:stationId', async (req, res) => {
  const { stationId } = req.params;
  const {
    station_name,
    station_type,
    location_name,
    latitude,
    longitude,
    status,
    sensor_to_ref_distance,
    reference_point_name,
    warning_level,
    critical_level,
    max_level,
    normal_max,
    blind_zone_offset,
    tilt_compensation_enabled,
  } = req.body;

  try {
    const refName = reference_point_name && reference_point_name.trim() !== ''
      ? reference_point_name.trim()
      : 'จุดอ้างอิง';

    const sql = `
      UPDATE station
      SET
        station_name              = COALESCE($1, station_name),
        station_type              = COALESCE($2, station_type),
        location_name             = COALESCE($3, location_name),
        latitude                  = COALESCE($4, latitude),
        longitude                 = COALESCE($5, longitude),
        status                    = COALESCE($6, status),
        sensor_to_ref_distance    = COALESCE($7, sensor_to_ref_distance),
        reference_point_name      = $8,
        warning_level             = $9,
        critical_level            = $10,
        max_level                 = COALESCE($11, max_level),
        normal_max                = COALESCE($12, normal_max),
        blind_zone_offset         = COALESCE($13, blind_zone_offset),
        tilt_compensation_enabled = COALESCE($14, tilt_compensation_enabled)
      WHERE station_id = $15
      RETURNING *
    `;

    const values = [
      station_name,
      station_type,
      location_name,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      status,
      sensor_to_ref_distance != null ? Number(sensor_to_ref_distance) : null,
      refName,
      warning_level != null && !isNaN(Number(warning_level)) ? Number(warning_level) : null,
      critical_level != null && !isNaN(Number(critical_level)) ? Number(critical_level) : null,
      max_level != null ? Number(max_level) : null,
      normal_max != null ? Number(normal_max) : null,
      blind_zone_offset != null ? Number(blind_zone_offset) : null,
      tilt_compensation_enabled != null ? Boolean(tilt_compensation_enabled) : null,
      stationId,
    ];

    const result = await db.query(sql, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    const updated = result.rows[0];
    if (sensor_to_ref_distance != null || tilt_compensation_enabled != null || blind_zone_offset != null) {
      const newSensorToRef = Number(updated.sensor_to_ref_distance);
      const tiltEnabled = updated.tilt_compensation_enabled;
      const blindZone = updated.blind_zone_offset;
      try {
        await recalculateStationReadings(stationId, newSensorToRef, tiltEnabled, blindZone);
      } catch (recalcErr) {
        console.warn(`[API /stations/${stationId}] Recalculate warning:`, recalcErr.message);
      }
    }

    res.json({ success: true, data: updated, message: 'อัปเดตข้อมูลสถานีสำเร็จ' });
  } catch (err) {
    console.error(`[API /stations/${stationId}] Error:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to update station' });
  }
});

// ── PATCH /api/stations/:stationId/status ─────────────────────────
// Quickly toggle station status: 'active', 'offline', 'maintenance'
router.patch('/:stationId/status', async (req, res) => {
  const { stationId } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'offline', 'inactive', 'maintenance'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status. Must be active, offline, or maintenance',
    });
  }

  // Normalize: 'inactive' -> 'offline'
  const dbStatus = status === 'inactive' ? 'offline' : status;

  try {
    const result = await db.query(
      `UPDATE station SET status = $1 WHERE station_id = $2 RETURNING *`,
      [dbStatus, stationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Station not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `เปลี่ยนสถานะสถานีเป็น ${dbStatus} สำเร็จ`,
    });
  } catch (err) {
    console.error(`[API PATCH /stations/${stationId}/status] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to update station status' });
  }
});

// ── POST /api/stations ─────────────────────────────────────────────
// Create new station
router.post('/', async (req, res) => {
  const {
    station_id,
    gateway_id,
    station_name,
    station_type,
    location_name,
    latitude,
    longitude,
    sensor_to_ref_distance,
    reference_point_name,
    warning_level,
    critical_level,
    max_level,
    normal_max,
    blind_zone_offset,
    tilt_compensation_enabled,
  } = req.body;

  if (!station_id || !station_name || !gateway_id) {
    return res.status(400).json({ success: false, error: 'station_id, station_name, gateway_id are required' });
  }

  try {
    const refName = reference_point_name && reference_point_name.trim() !== ''
      ? reference_point_name.trim()
      : 'จุดอ้างอิง';

    const sql = `
      INSERT INTO station (
        station_id, gateway_id, station_name, station_type,
        location_name, latitude, longitude, install_date, status,
        sensor_to_ref_distance, reference_point_name,
        warning_level, critical_level, max_level, normal_max,
        blind_zone_offset, tilt_compensation_enabled
      ) VALUES (
        $1, $2, $3, COALESCE($4, 'river'),
        $5, $6, $7, NOW(), 'active',
        COALESCE($8, 2.0), $9,
        $10, $11, COALESCE($12, 10.0), COALESCE($13, 3.0),
        COALESCE($14, 0.28), COALESCE($15, true)
      )
      RETURNING *
    `;

    const values = [
      station_id,
      gateway_id,
      station_name,
      station_type,
      location_name,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      sensor_to_ref_distance != null ? Number(sensor_to_ref_distance) : 2.0,
      refName,
      warning_level != null && !isNaN(Number(warning_level)) ? Number(warning_level) : null,
      critical_level != null && !isNaN(Number(critical_level)) ? Number(critical_level) : null,
      max_level != null ? Number(max_level) : 10.0,
      normal_max != null ? Number(normal_max) : 3.0,
      blind_zone_offset != null ? Number(blind_zone_offset) : 0.28,
      tilt_compensation_enabled != null ? Boolean(tilt_compensation_enabled) : true,
    ];

    const result = await db.query(sql, values);
    res.status(201).json({ success: true, data: result.rows[0], message: 'เพิ่มสถานีสำเร็จ' });
  } catch (err) {
    console.error('[API POST /stations] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create station' });
  }
});

module.exports = router;
