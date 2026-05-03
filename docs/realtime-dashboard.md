# Realtime Dashboard

The dashboard uses a backend-supported realtime flow:

```text
Frontend EventSource -> Express SSE endpoint -> Firebase Admin SDK / RTDB REST -> Firebase Realtime Database
```

## Endpoint

- `GET /api/realtime/dashboard/stream`

The endpoint emits `dashboard` events with the same envelope shape as normal API responses. It also sends heartbeat events when data has not changed.

## Frontend

`frontend/src/hooks/useRealtimeDashboard.ts`:

- loads initial dashboard summary through `GET /api/dashboard/summary`
- opens the SSE stream
- updates dashboard state automatically
- keeps manual refresh as fallback

Animated counters are handled by `AnimatedNumber`, which respects reduced motion and adds a short glow when values change.

## Fallback

If the SSE stream disconnects, the dashboard still has the manual Refresh button and other live resource polling hooks. The UI does not crash when Firebase or PostgreSQL is unavailable; it reports backend health through the signal indicator.
