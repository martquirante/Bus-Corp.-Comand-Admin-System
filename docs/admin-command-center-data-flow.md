# Admin Command Center Data Flow

## Runtime Flow

```text
Next.js pages/components
  -> frontend/src/services/api.ts
  -> Express routes/controllers
  -> backend services
  -> Firebase Admin SDK
  -> Firebase Realtime Database
```

The frontend uses `NEXT_PUBLIC_API_BASE_URL`. The API service accepts either `http://localhost:5000` or `http://localhost:5000/api`.

## Dashboard Summary

`GET /api/dashboard/summary` returns ready-to-display values:

- total POS devices
- online/offline POS devices
- assistance request counts
- message count and recent messages
- expense total
- route count
- recent assistance requests
- device health panel
- important alerts
- notification summary
- live route/map status
- last updated timestamp

Null, missing, object-map, and array-like Firebase shapes are normalized into empty states instead of frontend crashes.

## Notifications

Notifications are derived from:

- `messages`
- `AssistanceRequests`
- `POS_Devices` SOS/offline status
- high-value `Expenses`

Because there is no confirmed legacy notifications path, read/unread state is stored separately in `AdminNotificationReads`. This avoids mutating `messages`, `AssistanceRequests`, or POS device data.

## Sensitive Writes

Sensitive admin writes use role middleware and audit logging:

- `AdminRoutes` changes
- admin account changes
- legacy config patches
- message and assistance patches

Audit records go to `AuditLogs/AdminActions`.
