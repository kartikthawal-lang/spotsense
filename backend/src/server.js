const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'spotsense.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS space_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    slot_number TEXT NOT NULL,
    status TEXT CHECK(status IN ('full', 'available')) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const lots = Array.from({ length: 5 }, (_, index) => index + 1);
const lotNames = {
  1: 'Main Gate Lot',
  2: 'Library Lot',
  3: 'Hostel Lot',
  4: 'Sports Complex Lot',
  5: 'Admin Block Lot'
};

try {
  const rowCheck = db.prepare('SELECT COUNT(*) as count FROM space_reports').get();
  if (rowCheck.count === 0) {
    console.log('Seeding visual parking slot layouts...');
    const insert = db.prepare('INSERT INTO space_reports (lot_id, slot_number, status) VALUES (?, ?, ?)');
    const sampleStatuses = ['full', 'available', 'full', 'available', 'available'];
    
    lots.forEach(lotId => {
      for (let i = 1; i <= 10; i++) {
        const randomStatus = sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)];
        insert.run(lotId, `P${i}`, randomStatus);
      }
    });
  }
} catch (e) {
  console.error("Seeding error:", e);
}

function getLatestLotState() {
  const rawReports = db.prepare('SELECT lot_id, slot_number, status FROM space_reports').all();
  return lots.map(id => {
    const slotsForLot = rawReports.filter(r => r.lot_id === id);
    const slotMap = {};
    for(let i = 1; i <= 10; i++) {
      const match = slotsForLot.reverse().find(s => s.slot_number === `P${i}`);
      slotMap[`P${i}`] = match ? match.status : 'available';
    }
    return { id, name: lotNames[id], slots: slotMap };
  });
}

app.get('/api/lots', (req, res) => {
  try { res.json(getLatestLotState()); } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/reports', (req, res) => {
  const { lot_id, slot_number, status } = req.body;
  try {
    const insert = db.prepare('INSERT INTO space_reports (lot_id, slot_number, status) VALUES (?, ?, ?)');
    insert.run(lot_id, slot_number, status);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Missing prompt." });

  try {
    const currentParkingState = getLatestLotState();
    let parkingContextSummary = "";
    currentParkingState.forEach(lot => {
      const total = Object.keys(lot.slots).length;
      const fullCount = Object.values(lot.slots).filter(s => s === 'full').length;
      const openCount = total - fullCount;
      parkingContextSummary += `- ${lot.name}: ${openCount} open spots out of ${total}.\n`;
    });

    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    const url = `https://googleapis.com`;
    
    const nativeResponse = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are SpotSense AI, an assistant tracking parking grid slot charts live.\n\nContext counts stats parameters summary:\n${parkingContextSummary}\n\nUser Question: "${question}"\n\nProvide a friendly 2 sentence campus parking recommendation answering their question directly using the data context parameters rows.`
          }]
        }]
      })
    });

    const payload = await nativeResponse.json();
    
    // SAFE PARSING EXTRACTOR: Captures the raw API output text strings array layout securely
    let aiMessageText = "";
    if (payload && payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts && payload.candidates[0].content.parts[0]) {
      aiMessageText = payload.candidates[0].content.parts[0].text;
    } else if (payload && payload.error) {
      aiMessageText = `Google API Error: ${payload.error.message}`;
    } else {
      aiMessageText = "AI was unable to parse the response text configuration parameters.";
    }
    
    res.json({ answer: aiMessageText });
  } catch (error) {
    console.error("Native request layer error:", error);
    res.status(500).json({ error: "Gemini server authentication connection handshake error block configuration." });
  }
});

app.listen(PORT, () => console.log(`Visual SpotSense AI server running on port ${PORT}`));
