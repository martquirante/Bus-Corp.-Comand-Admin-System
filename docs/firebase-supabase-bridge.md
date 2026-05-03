# Firebase to Supabase Bridge

The backend bridge reads live Firebase RTDB data and can copy selected structured records into Supabase PostgreSQL.

## Services

- `backend/src/services/firebase.service.ts`: reads and writes Firebase RTDB using Firebase Admin SDK or RTDB REST fallback.
- `backend/src/services/supabase.service.ts`: reads and writes Supabase structured tables using service role or direct PostgreSQL URL.
- `backend/src/services/databaseBridge.service.ts`: combines Firebase live status with Supabase structured status for dashboard and health views.
- `backend/src/services/routeSync.service.ts`: syncs Firebase `AdminRoutes` records into Supabase `routes`, `route_stops`, and `route_waypoints`.

## Sync Endpoints

- `GET /api/sync/status`
- `POST /api/sync/firebase-to-supabase`
- `POST /api/routes/:id/sync-to-supabase`

The sync copies route data only. It does not delete or rename Firebase RTDB paths.
