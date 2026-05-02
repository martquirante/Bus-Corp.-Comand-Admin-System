# Deployment

## Frontend

`frontend` can deploy to Vercel, Netlify, or another Next.js host.

Required frontend environment variable:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com/api
```

The current GitHub Pages site can keep serving the legacy static admin, but GitHub Pages cannot run the Express backend. The new admin should be deployed to a Next.js-capable platform.

## Backend

`backend` can deploy to Render, Railway, Fly.io, or another Node.js host.

Required backend environment variables:

```bash
PORT=4000
ADMIN_WEB_ORIGIN=https://your-admin-host.example.com
SESSION_SECRET=replace-with-a-long-random-string
FIREBASE_PROJECT_ID=santranspos
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@santranspos.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://santranspos-default-rtdb.firebaseio.com
ENABLE_DEMO_FALLBACK=false
```

## Build Commands

Root workspace:

```bash
npm install
npm run build
```

Frontend only:

```bash
npm run dev:admin
```

Backend only:

```bash
npm run dev:api
```

## Production Notes

- Set `ENABLE_DEMO_FALLBACK=false` in production.
- Store Firebase Admin values in the backend host secret manager.
- Configure CORS through `ADMIN_WEB_ORIGIN`.
- Do not put Firebase Admin credentials into `NEXT_PUBLIC_*` variables.
