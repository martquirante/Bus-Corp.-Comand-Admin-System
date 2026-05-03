# Deployment

## Frontend

Deploy `frontend` to Vercel, Netlify, or another Next.js host.

Required frontend variables:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com
NEXT_PUBLIC_SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x2_OBpo1IkJw6nWhgm4A9Q_loJ1UuL7
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

`NEXT_PUBLIC_API_BASE_URL` may include `/api`, but it does not have to. The frontend normalizes both forms.

## Backend

Deploy `backend` to Render, Railway, Fly.io, or another Node.js host.

Required backend variables:

```bash
PORT=5000
ADMIN_WEB_ORIGIN=https://your-admin-host.example.com
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

Firebase Admin private keys, Supabase service role keys, and direct PostgreSQL URLs must stay in backend secret storage. Do not put them in `NEXT_PUBLIC_*` values.

## Build Commands

Root workspace:

```bash
npm install
npm run build
```

Development:

```bash
npm run dev
npm run dev:admin
npm run dev:api
```

## Hosting Notes

GitHub Pages can serve the old static admin, but it cannot run the Express backend. The full-stack admin needs a Next.js frontend host plus a Node.js backend host.

Set `ADMIN_WEB_ORIGIN` to the exact frontend origin to keep CORS restricted.
