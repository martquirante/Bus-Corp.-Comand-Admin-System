# Environment Setup

## Backend

Create `backend/.env` locally:

```env
PORT=5000
AUTH_MODE=dev
REQUIRE_FIREBASE_ID_TOKEN=false
ADMIN_WEB_ORIGIN=http://localhost:3000

FIREBASE_PROJECT_ID=santranspos
FIREBASE_DATABASE_URL=https://santranspos-default-rtdb.firebaseio.com
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=postgresql://postgres:<DB_PASSWORD>@db.qortxdtzoeprjzsijtwn.supabase.co:5432/postgres
```

`AUTH_MODE=dev` and `REQUIRE_FIREBASE_ID_TOKEN=false` allow local read endpoints to load without a browser Firebase ID token. Mutation endpoints still require a backend session or verified token.

## Frontend

Create `frontend/.env.local` locally:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x2_OBpo1IkJw6nWhgm4A9Q_loJ1UuL7
```

## Windows Local Run

Use two terminals:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Then open:

```text
http://localhost:3000
```
