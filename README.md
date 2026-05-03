# POS Bus Ticketing Simulation ADMIN SYSTEM

Modern Web Admin Command Center for a Philippine bus POS ticketing simulation.

The active system is now full-stack:

- `frontend`: Next.js + React + TypeScript command center UI.
- `backend`: Node.js + Express + TypeScript API using Firebase Admin SDK/RTDB REST plus Supabase PostgreSQL.
- Firebase Realtime Database remains the live legacy database and is used through the backend API.
- Supabase PostgreSQL is the SQL/structured database for employees, buses, routes, tickets, payments, expenses, alerts, notifications, and sync logs.
- Firebase SQL Connect is no longer used as the main SQL database.

## Structure

```text
frontend/      Web Admin UI
backend/       Express API and Firebase Admin access
packages/
  shared/      Shared types, constants, validators
docs/          Architecture, Firebase, route, map, deployment docs
legacy/        Old static admin kept as reference only
dataconnect/   Old SQL Connect workspace reference only
```

The old flat files are no longer the app entrypoint. They live in `legacy/web-admin` for reference. Use `frontend` and `backend` for development.

## Run Locally

```bash
npm install
```

On Windows, prefer separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:3000`  
Backend health: `http://localhost:5000/api/health`

Run separately:

```bash
npm run dev:admin
npm run dev:api
```

## Environment

Frontend `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x2_OBpo1IkJw6nWhgm4A9Q_loJ1UuL7
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Backend `.env`:

```bash
PORT=5000
ADMIN_WEB_ORIGIN=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-string
FIREBASE_PROJECT_ID=santranspos
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_DATABASE_URL=https://santranspos-default-rtdb.firebaseio.com
SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=postgresql://postgres:<DB_PASSWORD>@db.qortxdtzoeprjzsijtwn.supabase.co:5432/postgres
ENABLE_DEMO_FALLBACK=false
```

Never put Firebase Admin private keys, Supabase service role keys, or direct database URLs in the frontend. If backend Firebase Admin credentials are missing locally, read endpoints use Firebase Realtime Database REST through `FIREBASE_DATABASE_URL`. Demo fallback is disabled by default.

## Firebase Realtime Compatibility

The backend keeps compatibility with:

- `AssistanceRequests`
- `Config`
- `Expenses`
- `POS_Devices`
- `Routes_Forward`
- `Routes_Reverse`
- `SuperAdmins`
- `Users`
- `Users/Pending`
- `Users/Active`
- `messages`
- `AdminRoutes`

Editable admin routes are saved to `AdminRoutes` so legacy `Routes_Forward` and `Routes_Reverse` are not accidentally broken.

`Routes_Forward` and `Routes_Reverse` are legacy fare matrix/reference paths only. Live Map and Route Config use `AdminRoutes` waypoints/stops, with Supabase `routes`, `route_stops`, and `route_waypoints` as the structured copy.

## Supabase Sync

Supabase PostgreSQL sync/status is available through:

```text
GET  /api/sync/status
POST /api/sync/firebase-to-supabase
POST /api/routes/:id/sync-to-supabase
```

Set `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_URL` in `backend/.env` to enable backend SQL access. Firebase RTDB remains the live source; Supabase stores structured copies.

## Live Map

The fleet map uses the same public map services found in the legacy dashboard:

- Leaflet
- OpenStreetMap tiles
- Google traffic tile overlay
- Esri satellite tiles
- Nominatim location search

Live markers use `POS_Devices.*.LiveStatus.lat/lng` when available.

Route polylines are drawn from `AdminRoutes/{routeId}/waypoints` or Supabase `route_waypoints`. Google Maps links are stored as references only.

## Bus Assets

The blue aircon images represent one bus with different angles/states:

```text
frontend/public/assets/bus/blue-aircon/
  map-only-blue-bus.png
  bus-blue-aircon-idle.png
  bus-blue-aircon-front-left.png
  bus-blue-aircon-rear-left.png
  bus-blue-aircon-rear-perspective.png
  bus-blue-aircon-side-rear.png
  bus-blue-aircon-top-rear.png
```

`BusMarker` uses `map-only-blue-bus.png` when moving/fast, idle/front-visible images when stopped/loading/offline, and a pulse ring for SOS.

## Scripts

```bash
npm run dev
npm run dev:admin
npm run dev:api
npm run build
npm run lint
npm run typecheck
```

## Docs

- `docs/architecture.md`
- `docs/database-architecture.md`
- `docs/firebase-supabase-bridge.md`
- `docs/supabase-setup.md`
- `docs/realtime-routes.md`
- `docs/env-setup.md`
- `docs/firebase-realtime-legacy-map.md`
- `docs/admin-command-center-data-flow.md`
- `docs/route-management.md`
- `docs/map-api-setup.md`
- `docs/bus-marker-behavior.md`
- `docs/deployment.md`

## Deployment

GitHub Pages cannot run the Express backend. Deploy the frontend to Vercel/Netlify and the backend to Render/Railway/Fly.io or another Node.js host. Set `NEXT_PUBLIC_API_BASE_URL` in the frontend and `ADMIN_WEB_ORIGIN` in the backend.

## Current Limitations

- Supabase write/sync needs backend `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_URL`.
- Google Maps short links are stored as references, not parsed into coordinates.
- Realtime Database remains active even after SQL snapshots are written.
