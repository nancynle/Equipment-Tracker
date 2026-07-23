# Equipment Tracker

Interactive building safety equipment tracking system with real-time collaboration, Excel sync, and offline support.

Tracks **jam poles**, **ladders**, and **Cottermans** across building floors with map visualization, issue reporting, and multi-user real-time editing.

## Features

- **Data Table**: Searchable, filterable, inline-editable equipment grid
- **Interactive Map**: Drag-and-drop equipment positioning per floor, touch-friendly for Kindle
- **Excel Sync**: All data stored in `data/equipment.xlsx` — editable externally (SharePoint, local)
- **Real-Time Collaboration**: WebSocket-based live sync for ~10 concurrent users
- **Issue Reporting**: Auto-report problems with severity levels and assignee notifications
- **Offline Support**: PWA with service worker — works offline, queues changes for sync
- **Responsive**: Works on laptops and Kindle Fire tablets
- **Midway Auth**: Ready for Amazon Midway SSO integration

## Quick Start

```bash
# Install dependencies
npm install

# Start development (server + client)
npm run dev

# Or start server and client separately
npm run dev:server  # Backend on port 3001
npm run dev:client  # Frontend on port 3000
```

Open http://localhost:3000 in your browser.

## Architecture

```
equipment-tracker/
├── server/           # Express + Socket.IO backend
│   ├── index.ts      # Server entry, WebSocket handlers
│   ├── excel-sync.ts # Excel read/write layer (exceljs)
│   └── routes.ts     # REST API endpoints
├── src/              # React frontend (Vite + PWA)
│   ├── App.tsx       # Main app with table/map/split views
│   ├── components/   # UI components
│   ├── hooks/        # useSocket, useOffline
│   └── types/        # TypeScript interfaces
├── data/             # Excel data file (auto-created)
└── public/           # Static assets
```

## Data Model

| Field | Description |
|-------|-------------|
| ID | Auto-generated UUID |
| Type | jam_pole / ladder / cotterman |
| Identification Number | Physical tag number (e.g., JP-001) |
| Floor | Building floor |
| Zone | Area/section on that floor |
| Map Position | X/Y coordinates for map display |
| Condition | good / fair / poor / out_of_service |
| Quantity | Count at location |
| Last Inspection Date | ISO date |
| Notes | Free text |
| Last Modified By | User who made last change |
| Last Modified At | Timestamp |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/equipment | List all equipment |
| POST | /api/equipment | Add new equipment |
| PUT | /api/equipment/:id | Update equipment |
| DELETE | /api/equipment/:id | Remove equipment |
| GET | /api/issues | List all issues |
| POST | /api/issues | Report an issue |
| PUT | /api/issues/:id | Update issue status |
| POST | /api/sync/refresh | Force re-read from Excel |

## Excel Integration

The `data/equipment.xlsx` file is the single source of truth. It has two sheets:
- **Equipment** — all tracked items
- **Issues** — all reported problems

You can:
1. Edit the Excel file directly (e.g., in SharePoint or locally)
2. The app re-reads from disk on every GET request to pick up external changes
3. Changes made in the app are immediately written to the Excel file

## Offline Mode

The app is a PWA (Progressive Web App):
- Installs on devices for app-like experience
- Works without network — shows offline banner
- Queues changes in localStorage
- Flushes queue automatically when connection returns

## Midway Authentication (TODO)

To enable Midway auth, the server needs to validate requests via `mcscli curl` integration. The app is structured to pass user aliases through the `lastModifiedBy` field.

## Deployment

For production:
```bash
npm run build
NODE_ENV=production npm start
```

The built frontend is served by the Express server on port 3001 (configurable via `PORT` env var).

## Configuration

| Env Variable | Default | Description |
|--------------|---------|-------------|
| PORT | 3001 | Server port |
| EXCEL_PATH | ./data/equipment.xlsx | Path to Excel file |
| NODE_ENV | development | Set to production for static serving |
