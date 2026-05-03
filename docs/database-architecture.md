# Database Architecture

## Firebase Realtime Database

Firebase RTDB remains the live source because the Java POS/conductor app already writes there.

Live paths currently supported:

- `POS_Devices`
- `AssistanceRequests`
- `Expenses`
- `Routes_Forward`
- `Routes_Reverse`
- `SuperAdmins`
- `Users`
- `messages`
- `AdminRoutes`

`AdminRoutes/{routeId}/waypoints` and `AdminRoutes/{routeId}/stops` are the source for actual mapped route lines when present.

## Supabase PostgreSQL

Supabase is the SQL/structured database. The backend supports these tables:

- `app_users`
- `employees`
- `buses`
- `pos_device_status`
- `routes`
- `route_stops`
- `route_waypoints`
- `tickets`
- `payments`
- `expenses`
- `critical_alerts`
- `notifications`
- `conversations`
- `chat_messages`
- `firebase_sync_logs`

Do not use Firebase SQL Connect as the main SQL database anymore.

## Security

The frontend never receives `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, Firebase Admin private keys, or service account JSON files. Those belong only in local backend `.env`.
