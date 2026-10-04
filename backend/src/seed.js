const { db } = require('./db');

console.log('Seeding SpotSense database...');

// Clear existing records to ensure a fresh test environment
db.exec('DELETE FROM reports');
db.exec('DELETE FROM lots');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('lots', 'reports')");

// 1. Insert 5 realistic campus parking lots
const insertLot = db.prepare(`
  INSERT INTO lots (name, location)
  VALUES (?, ?)
`);

const lotsData = [
  { name: 'Main Gate Lot', location: 'Near East Entrance & Visitors Pavilion' },
  { name: 'Library Lot', location: 'Behind Central Library & Study Commons' },
  { name: 'Hostel Lot', location: 'Near North Residence Halls 3 & 4' },
  { name: 'Sports Complex Lot', location: 'Beside Gymnasium & Athletic Track' },
  { name: 'Admin Block Lot', location: 'Opposite University Administrative Building' },
];

const insertedLots = [];
for (const lot of lotsData) {
  const result = insertLot.run(lot.name, lot.location);
  insertedLots.push({ id: result.lastInsertRowid, ...lot });
}

console.log(`Created ${insertedLots.length} campus parking lots.`);

// 2. Helpers to generate ISO timestamps
const minutesAgo = (mins) => new Date(Date.now() - mins * 60 * 1000).toISOString();
const hoursAgo = (hrs) => new Date(Date.now() - hrs * 60 * 60 * 1000).toISOString();
const daysAgoAtHour = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

// 3. Insert sample reports with varied timestamps
// - Includes recent reports (< 45m) and older reports for current status
// - Includes historical weekday patterns (e.g. 9 AM peaks for Library Lot)
const reportsData = [
  // Lot 1: Main Gate Lot (Recent: available; Pattern: full by 8 AM)
  { lot_id: 1, status: 'available', timestamp: minutesAgo(8) },
  { lot_id: 1, status: 'full', timestamp: minutesAgo(42) },
  { lot_id: 1, status: 'available', timestamp: minutesAgo(90) },
  { lot_id: 1, status: 'full', timestamp: daysAgoAtHour(1, 8) },
  { lot_id: 1, status: 'full', timestamp: daysAgoAtHour(2, 8) },
  { lot_id: 1, status: 'full', timestamp: daysAgoAtHour(3, 8) },
  { lot_id: 1, status: 'available', timestamp: daysAgoAtHour(1, 14) },

  // Lot 2: Library Lot (Recent: full; Pattern: full by 9 AM on weekdays)
  { lot_id: 2, status: 'full', timestamp: minutesAgo(15) },
  { lot_id: 2, status: 'available', timestamp: minutesAgo(50) },
  { lot_id: 2, status: 'full', timestamp: daysAgoAtHour(1, 9) },
  { lot_id: 2, status: 'full', timestamp: daysAgoAtHour(2, 9) },
  { lot_id: 2, status: 'full', timestamp: daysAgoAtHour(3, 9) },
  { lot_id: 2, status: 'full', timestamp: daysAgoAtHour(4, 9) },
  { lot_id: 2, status: 'available', timestamp: daysAgoAtHour(2, 17) },

  // Lot 3: Hostel Lot (Recent: stale > 45 min -> status: unknown)
  { lot_id: 3, status: 'full', timestamp: minutesAgo(62) },
  { lot_id: 3, status: 'available', timestamp: minutesAgo(140) },
  { lot_id: 3, status: 'full', timestamp: hoursAgo(5) },

  // Lot 4: Sports Complex Lot (Recent: available; Pattern: usually open spots)
  { lot_id: 4, status: 'available', timestamp: minutesAgo(28) },
  { lot_id: 4, status: 'available', timestamp: minutesAgo(80) },
  { lot_id: 4, status: 'available', timestamp: daysAgoAtHour(1, 10) },
  { lot_id: 4, status: 'available', timestamp: daysAgoAtHour(2, 10) },
  { lot_id: 4, status: 'available', timestamp: daysAgoAtHour(3, 14) },
  { lot_id: 4, status: 'available', timestamp: daysAgoAtHour(4, 15) },

  // Lot 5: Admin Block Lot (Recent: stale > 45 min -> status: unknown; Pattern: full by 10 AM)
  { lot_id: 5, status: 'full', timestamp: minutesAgo(115) },
  { lot_id: 5, status: 'available', timestamp: minutesAgo(230) },
  { lot_id: 5, status: 'full', timestamp: daysAgoAtHour(1, 10) },
  { lot_id: 5, status: 'full', timestamp: daysAgoAtHour(2, 10) },
  { lot_id: 5, status: 'full', timestamp: daysAgoAtHour(3, 10) },
];

const insertReport = db.prepare(`
  INSERT INTO reports (lot_id, status, timestamp)
  VALUES (?, ?, ?)
`);

for (const report of reportsData) {
  insertReport.run(report.lot_id, report.status, report.timestamp);
}

console.log(`Created ${reportsData.length} sample reports with varied timestamps.`);
console.log('Seeding completed successfully!');
