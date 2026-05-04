# Auth Dev Mode

Local development can run without a Firebase bearer token for read-only admin screens.

## Environment

```env
AUTH_MODE=dev
REQUIRE_FIREBASE_ID_TOKEN=false
```

With those values, the backend assigns a temporary `Local Dev Admin` identity to `GET`, `HEAD`, and `OPTIONS` requests. This lets Dashboard, Live Map, Routes, Transactions, Analytics, Notifications, Critical Alerts, Employees, Buses, and Sync Status load while developing locally.

Mutation endpoints remain protected. Route edits, Supabase sync runs, alert acknowledge/resolve actions, admin account writes, employee writes, and bus writes still require a valid backend session token or production bearer token.

## Production

For production:

```env
AUTH_MODE=production
REQUIRE_FIREBASE_ID_TOKEN=true
```

The frontend should then send `Authorization: Bearer <token>`, and the backend should verify the Firebase Auth ID token or Supabase Auth JWT before checking the user role from `app_users` or `employees`.

## Why This Exists

The Web Admin backend uses Firebase Admin SDK or RTDB REST to read Firebase securely. The browser does not need to provide a Firebase bearer token just to preview local dashboard/live data. This avoids the local blocker:

```text
A valid Firebase bearer token is required.
```
