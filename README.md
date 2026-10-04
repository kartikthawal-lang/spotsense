# SpotSense 🚗📍

> **Crowd-sourced campus parking availability app with AI features.**

SpotSense helps university students, faculty, and visitors find campus parking quickly. Parking lot statuses are computed dynamically from crowd-sourced user reports. Reports older than 45 minutes are marked as stale (`unknown`). SpotSense also incorporates Gemini AI to parse natural-language reports and provide smart parking advice.

---

## 🏗️ Project Architecture

```
spacescope/
├── backend/                  # Node.js + Express + SQLite (better-sqlite3)
│   ├── .env.example          # Environment variables template
│   ├── .gitignore            # Ignores .env and SQLite DB
│   ├── package.json          # Backend dependencies and scripts
│   ├── data/                 # SQLite database storage (spotsense.db)
│   └── src/
│       ├── db.js             # SQLite schema, queries, 45-min staleness logic
│       ├── seed.js           # Seed data with 5 lots & varied reports
│       └── server.js         # Express server & API endpoints (Port 3001)
├── frontend/                 # Vite + React (Phase 2)
│   └── ...
├── .gitignore
└── README.md
```

---

## 🚀 Quickstart & Run Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm

### 1. Backend Setup

1. Open your terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

3. Install dependencies:
   ```bash
   npm install
   ```

4. Seed the database with 5 campus lots and 20+ realistic sample reports:
   ```bash
   npm run seed
   ```

5. Start the backend server:
   ```bash
   npm start
   # Or for auto-reloading during development:
   npm run dev
   ```

The server will be running at **`http://localhost:3001`**.

### 2. Frontend Setup

1. In a new terminal window, navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to **`http://localhost:5173`**.
   - The UI will display all 5 parking lots with live color-coded status badges.
   - Status updates automatically sync every 30 seconds.
   - Tapping **"Report Available"** or **"Report Full"** immediately updates the lot status and refreshes the feed.


## 📡 API Endpoints (Phase 1)

### `GET /api/lots`
Returns all parking lots with their computed current status:
- `"available"`: reported available within the last 45 minutes
- `"full"`: reported full within the last 45 minutes
- `"unknown"`: no reports or last report is older than 45 minutes

**Sample Response:**
```json
[
  {
    "id": 1,
    "name": "Main Gate Lot",
    "location": "Near East Entrance & Visitors Pavilion",
    "status": "available",
    "last_report_timestamp": "2026-09-28T13:24:27.989Z",
    "minutes_ago": 8
  }
]
```

### `POST /api/reports`
Submits a new parking status report.

**Request Body:**
```json
{
  "lot_id": 3,
  "status": "available"
}
```

**Validation Rules:**
- `lot_id` must be an integer matching an existing lot in the database.
- `status` must be either `"full"` or `"available"`.

**Success Response (HTTP 201):**
```json
{
  "message": "Report submitted successfully",
  "report": {
    "id": 23,
    "lot_id": 3,
    "status": "available",
    "timestamp": "2026-09-28T13:33:33.877Z"
  }
}
```

---

## 🤖 AI Endpoints (Phase 3)

### `POST /api/reports/ai`
Accepts a natural-language description from the user, forwards it to Google Gemini (`gemini-2.5-flash`), strictly validates the output, and updates the database.

**Prerequisite:** Add your Gemini API key in `backend/.env`:
```bash
GEMINI_API_KEY=your_actual_key_here
```

**Request Body:**
```json
{
  "text": "library lot is packed"
}
```

**Success Response (High confidence, valid lot):**
```json
{
  "success": true,
  "message": "Report recorded for Library Lot: marked as full.",
  "lot": { "id": 2, "name": "Library Lot", "location": "Behind Central Library & Study Commons" },
  "report": { "id": 24, "lot_id": 2, "status": "full", "timestamp": "..." },
  "ai_parsed": { "lot_id": 2, "status": "full", "confidence": "high" }
}
```

**Clarification Response (Ambiguous input - no bad data saved):**
```json
{
  "success": false,
  "clarification_needed": true,
  "message": "We couldn't clearly tell which lot or status you meant. Could you clarify with the lot name (e.g. 'Library lot is packed' or 'Admin lot has spots')?",
  "ai_parsed": { "lot_id": null, "status": "full", "confidence": "low" }
}
```

---

## 🧭 Parking Advisor Endpoint (Phase 4)

### `POST /api/ask`
Accepts a natural-language question from a driver, gathers current lot statuses (with 45-minute staleness threshold) and historical hourly report distributions from SQLite, prompts Gemini (`gemini-2.5-flash`), and returns a concise, friendly 2-3 sentence recommendation.

**Request Body:**
```json
{
  "question": "I'm heading to the library, where should I park?"
}
```

**Success Response (HTTP 200):**
```json
{
  "question": "I'm heading to the library, where should I park?",
  "answer": "The Library Lot is currently full based on recent reports. I recommend trying the Main Gate Lot or Sports Complex Lot instead, as both currently have available spaces."
}
```

---

## 📈 Historical Patterns Endpoint (Phase 5)

### `GET /api/lots/:id/patterns`
Returns the average fullness grouped by hour of the day (0–23) for a specific parking lot, along with an automated insight string when sufficient historical reports exist (at least 3 reports).

**Sample Request:**
```bash
curl http://localhost:3001/api/lots/2/patterns
```

**Success Response (HTTP 200):**
```json
{
  "lot_id": 2,
  "name": "Library Lot",
  "location": "Behind Central Library & Study Commons",
  "total_historical_reports": 7,
  "hourly_fullness": [
    {
      "hour": 9,
      "hour_label": "9 AM",
      "total_reports": 4,
      "full_reports": 4,
      "available_reports": 0,
      "fullness_percentage": 100
    },
    {
      "hour": 13,
      "hour_label": "1 PM",
      "total_reports": 2,
      "full_reports": 1,
      "available_reports": 1,
      "fullness_percentage": 50
    }
  ],
  "insight": "Usually full by 9 AM on weekdays"
}
```

Each lot card in the UI displays this insight badge (e.g. `📊 Usually full by 9 AM on weekdays`) to help drivers anticipate lot availability before arriving.



