# Firebase to Supabase Bridge

The backend bridge reads live Firebase RTDB data and can copy selected structured records into Supabase PostgreSQL.

## Services

- `backend/src/services/firebase.service.ts`: reads and writes Firebase RTDB using Firebase Admin SDK or RTDB REST fallback.
- `backend/src/services/supabase.service.ts`: reads and writes Supabase structured tables using service role or direct PostgreSQL URL.
- `backend/src/services/databaseBridge.service.ts`: combines Firebase live status with Supabase structured status for dashboard and health views.
- `backend/src/services/routeSync.service.ts`: syncs Firebase `AdminRoutes` records into Supabase `routes`, `route_stops`, and `route_waypoints`.
- `backend/src/services/sqlSync.service.ts`: syncs Firebase `POS_Devices/*/Trips/*/Transactions` into Supabase `trips`, `tickets`, and `payments`.

## Sync Endpoints

- `GET /api/sync/status`
- `POST /api/sync/firebase-to-supabase`
- `POST /api/routes/:id/sync-to-supabase`
- `POST /api/sync/transactions`

The sync copies route and transaction data. It does not delete or rename Firebase RTDB paths.

Transaction sync is idempotent:

- trips use Supabase `trips.trip_no`
- tickets use `tickets.ticket_no` and existing `firebase_ticket_key` when present
- payments use `payments.reference_number` and `firebase_payment_key`
