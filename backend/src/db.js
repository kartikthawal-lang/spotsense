const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database file
const dbPath = path.join(dataDir, 'spotsense.db');
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('full', 'available')) NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
  );
`);

/**
 * Get all lots with computed current status.
 * Status logic:
 * - Looks at the most recent report for each lot.
 * - If the report is within 45 minutes, status is 'full' or 'available'.
 * - If older than 45 minutes (or no report exists), status is 'unknown'.
 */
function getAllLotsWithStatus() {
  const query = `
    SELECT 
      l.id,
      l.name,
      l.location,
      r.status AS latest_status,
      r.timestamp AS last_report_timestamp
    FROM lots l
    LEFT JOIN (
      SELECT r1.lot_id, r1.status, r1.timestamp
      FROM reports r1
      INNER JOIN (
        SELECT lot_id, MAX(timestamp) AS max_timestamp
        FROM reports
        GROUP BY lot_id
      ) r2 ON r1.lot_id = r2.lot_id AND r1.timestamp = r2.max_timestamp
    ) r ON l.id = r.lot_id
    ORDER BY l.id ASC
  `;

  const rows = db.prepare(query).all();
  const now = Date.now();
  const STALE_THRESHOLD_MINUTES = 45;

  return rows.map((lot) => {
    let computedStatus = 'unknown';
    let minutesAgo = null;

    if (lot.last_report_timestamp) {
      const reportTime = new Date(lot.last_report_timestamp).getTime();
      const diffMinutes = Math.floor((now - reportTime) / (1000 * 60));
      minutesAgo = diffMinutes >= 0 ? diffMinutes : 0;

      if (diffMinutes >= 0 && diffMinutes <= STALE_THRESHOLD_MINUTES) {
        computedStatus = lot.latest_status;
      }
    }

    return {
      id: lot.id,
      name: lot.name,
      location: lot.location,
      status: computedStatus,
      last_report_timestamp: lot.last_report_timestamp || null,
      minutes_ago: minutesAgo,
      insight: computeLotInsight(lot.id)
    };
  });
}

/**
 * Computes an insight string like "Usually full by 9 AM on weekdays"
 * when enough historical reports exist (at least 3 reports).
 */
function computeLotInsight(lotId) {
  const query = `
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
      COUNT(*) AS total_reports,
      SUM(CASE WHEN status = 'full' THEN 1 ELSE 0 END) AS full_reports,
      ROUND(AVG(CASE WHEN status = 'full' THEN 1.0 ELSE 0.0 END) * 100, 1) AS fullness_percentage
    FROM reports
    WHERE lot_id = ?
    GROUP BY hour
    ORDER BY hour ASC
  `;
  const rows = db.prepare(query).all(lotId);
  const total = rows.reduce((acc, r) => acc + r.total_reports, 0);

  // Require at least 3 reports to claim a pattern
  if (total < 3) {
    return null;
  }

  // Look for peak hours (>= 60% full with >= 2 reports)
  const peakHourRow = rows.find(r => r.fullness_percentage >= 60 && r.total_reports >= 2);
  if (peakHourRow) {
    const h = peakHourRow.hour;
    const formattedHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    return `Usually full by ${formattedHour} on weekdays`;
  }

  // If mostly available
  const availableRow = rows.find(r => r.fullness_percentage <= 35 && r.total_reports >= 2);
  if (availableRow) {
    return 'Usually has open spots during daytime hours';
  }

  return 'Mixed historical availability';
}

/**
 * Endpoint helper for GET /api/lots/:id/patterns
 * Returns average fullness by hour of day for a specific lot.
 */
function getLotPatterns(lotId) {
  const lot = getLotById(lotId);
  if (!lot) return null;

  const query = `
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
      COUNT(*) AS total_reports,
      SUM(CASE WHEN status = 'full' THEN 1 ELSE 0 END) AS full_reports,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_reports,
      ROUND(AVG(CASE WHEN status = 'full' THEN 1.0 ELSE 0.0 END) * 100, 1) AS fullness_percentage
    FROM reports
    WHERE lot_id = ?
    GROUP BY hour
    ORDER BY hour ASC
  `;
  const rows = db.prepare(query).all(lotId);
  const totalReports = rows.reduce((sum, r) => sum + r.total_reports, 0);

  const formattedHourly = rows.map(r => {
    const h = r.hour;
    const formattedHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    return {
      hour: r.hour,
      hour_label: formattedHour,
      total_reports: r.total_reports,
      full_reports: r.full_reports,
      available_reports: r.available_reports,
      fullness_percentage: r.fullness_percentage
    };
  });

  return {
    lot_id: lot.id,
    name: lot.name,
    location: lot.location,
    total_historical_reports: totalReports,
    hourly_fullness: formattedHourly,
    insight: computeLotInsight(lot.id)
  };
}

/**
 * Get all basic lots (id, name, location)
 */
function getAllLots() {
  return db.prepare('SELECT id, name, location FROM lots ORDER BY id ASC').all();
}

/**
 * Check if a lot exists by its ID
 */
function getLotById(lotId) {
  return db.prepare('SELECT * FROM lots WHERE id = ?').get(lotId);
}

/**
 * Insert a new parking report
 */
function addReport(lotId, status) {
  const timestamp = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO reports (lot_id, status, timestamp)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(lotId, status, timestamp);
  return {
    id: result.lastInsertRowid,
    lot_id: lotId,
    status,
    timestamp
  };
}

/**
 * Get summary of report counts grouped by lot and hour of day
 */
function getHistoricalHourSummary() {
  const query = `
    SELECT 
      l.name AS lot_name,
      CAST(strftime('%H', r.timestamp) AS INTEGER) AS hour_utc,
      SUM(CASE WHEN r.status = 'full' THEN 1 ELSE 0 END) AS full_count,
      SUM(CASE WHEN r.status = 'available' THEN 1 ELSE 0 END) AS available_count,
      COUNT(*) AS total_count
    FROM reports r
    JOIN lots l ON r.lot_id = l.id
    GROUP BY l.name, hour_utc
    ORDER BY l.name, hour_utc
  `;
  return db.prepare(query).all();
}

module.exports = {
  db,
  getAllLots,
  getAllLotsWithStatus,
  getLotById,
  addReport,
  getHistoricalHourSummary,
  getLotPatterns,
  computeLotInsight
};
