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
- `AdminCriticalAlertState`
- `AdminNotificationReads`
- `AdminChatConversations`

`AdminRoutes/{routeId}/waypoints` and `AdminRoutes/{routeId}/stops` are the source for actual mapped route lines when present.

`POS_Devices.LiveStatus.totalCash` and `totalGcash` are treated as Live Session Revenue only. Official revenue comes from Supabase `payments`.

## Supabase PostgreSQL

Supabase is the SQL/structured database. The backend supports these tables:

- `app_users`
- `employees`
- `buses`
- `pos_device_status`
- `routes`
- `route_stops`
- `route_waypoints`
- `trips`
- `tickets`
- `payments`
- `expenses`
- `critical_alerts`
- `notifications`
- `conversations`
- `chat_messages`
- `firebase_sync_logs`

Dashboard official totals are computed from Supabase:

- `payments` for revenue and payment split
- `tickets` for transaction count
- `expenses` for net profit

Do not use Firebase SQL Connect as the main SQL database anymore.

## Security

The frontend never receives `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, Firebase Admin private keys, or service account JSON files. Those belong only in local backend `.env`.
