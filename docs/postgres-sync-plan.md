# Supabase PostgreSQL Sync Plan

Firebase Realtime Database remains the live source for the conductor/POS app and realtime admin screens.

Supabase PostgreSQL is the structured/archive database. Firebase SQL Connect is not used for the main SQL database.

## Current Implementation

The backend can read Supabase structured tables and can sync Firebase `AdminRoutes` into:

- `routes`
- `route_stops`
- `route_waypoints`
- `firebase_sync_logs`

Endpoints:

- `GET /api/sync/status`
- `POST /api/sync/firebase-to-supabase`
- `POST /api/routes/:id/sync-to-supabase`

If Supabase backend env values are missing, sync reports `not-configured` and the app continues using Firebase Realtime Database.

## Live Source vs Structured Copy

- Firebase RTDB stays live for `POS_Devices`, `AssistanceRequests`, `messages`, `Expenses`, and `AdminRoutes`.
- Supabase stores structured records for reporting, admin CRUD, and future history/archive workflows.

## Future Sync Targets

- `POS_Devices` -> `pos_device_status`
- `AssistanceRequests` -> `critical_alerts` and `notifications`
- `messages` -> `chat_messages` and `notifications`
- `Expenses` -> `expenses`
- ticket/payment records -> `tickets` and `payments`
