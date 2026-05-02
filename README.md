# POS Bus Ticketing Simulation ADMIN SYSTEM

Modern full-stack web admin for a Philippine bus POS ticketing simulation. The new Web Admin is built as a command center for dashboard monitoring, live fleet status, sales analytics, transaction logs, route configuration, and admin account tools.

## Structure

```text
frontend/      Next.js + React + TypeScript admin UI
backend/       Express + TypeScript API using Firebase Admin SDK
packages/
  shared/      Shared types, constants, validators
docs/          Architecture, Firebase data map, deployment notes
legacy/        Old static HTML/CSS/JS admin kept only as reference
```

The original flat `index.html`, `dashboard.js`, `style.css`, and `admin_accounts.js` files were moved to `legacy/web-admin` as reference only. The root `index.html` is now only a launcher that points to the new full-stack system.

## Run Locally

```bash
npm install
npm run dev
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:4000/api/health`

Run individually:

```bash
npm run dev:admin
npm run dev:api
```

## Environment

Copy `.env.example` to your backend host or local `.env` and provide Firebase Admin credentials. The frontend only needs:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Never expose `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, or other Firebase Admin values in the frontend.
Set `SESSION_SECRET` to a long random value on the backend host so API-issued admin sessions can be verified securely.

## Firebase Compatibility

The API preserves the current Realtime Database shape:

- `POS_Devices/*/LiveStatus`
- `POS_Devices/*/Trips/*/Transactions`
- `Expenses`
- `Routes_Forward`
- `Routes_Reverse`
- `Users/Pending`
- `Users/Active`
- `SuperAdmins`

See `docs/firebase-data-map.md` for details.

## Bus Assets

The blue aircon bus images are treated as one bus model with multiple angles and copied into:

```text
frontend/public/assets/bus/blue-aircon/
  bus-blue-aircon-front-left.png
  bus-blue-aircon-rear-left.png
  bus-blue-aircon-rear-perspective.png
  bus-blue-aircon-side-rear.png
  bus-blue-aircon-top-rear.png
  bus-blue-aircon-idle.png
```

`BusMarker` selects the image and CSS transform based on bus status, speed, turning state, and SOS state.

## Scripts

```bash
npm run dev
npm run dev:admin
npm run dev:api
npm run build
npm run lint
npm run typecheck
```

## Deployment

The new Express backend cannot run on GitHub Pages. Deploy `frontend` to Vercel or Netlify and deploy `backend` to Render, Railway, Fly.io, or another Node.js host. Set `NEXT_PUBLIC_API_BASE_URL` in the frontend and `ADMIN_WEB_ORIGIN` in the backend.

## Known Limitations

- Local read-only demo data is used when Firebase Admin credentials are absent.
- Write endpoints require Firebase Admin credentials.
- The legacy static site remains available until the new frontend/backend pair is deployed.
