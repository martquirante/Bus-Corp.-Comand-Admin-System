# Firebase Data Map

The legacy web admin read and wrote directly to Firebase Realtime Database from `dashboard.js` and `admin_accounts.js`. The new API keeps these paths compatible.

## Existing Paths

| Path | Purpose | New API Usage |
| --- | --- | --- |
| `POS_Devices/*/LiveStatus` | Live bus status, bus number, driver, conductor, coordinates, speed, cash, GCash, passenger counts, SOS | `GET /api/dashboard/stats`, `GET /api/fleet/live` |
| `POS_Devices/*/Trips/*/Transactions` | Ticket transaction history | `GET /api/transactions`, `GET /api/transactions/:id`, `GET /api/reports/revenue` |
| `Expenses` | Daily/operational expenses | `GET /api/dashboard/stats` |
| `Routes_Forward` | Forward fare route table | `GET /api/routes`, `POST /api/routes`, `PATCH /api/routes/:id` |
| `Routes_Reverse` | Reverse fare route table | `GET /api/routes`, `POST /api/routes`, `PATCH /api/routes/:id` |
| `Users/Pending` | Pending workforce signup requests | `GET /api/admin/accounts` |
| `Users/Active` | Approved workforce users | `GET /api/admin/accounts`, `POST /api/admin/accounts`, `PATCH /api/admin/accounts/:id` |
| `SuperAdmins` | Legacy super admin credentials | `POST /api/auth/session`, `GET /api/admin/accounts` |
| `Config/GlobalSettings` | Legacy admin passcode/settings | Reserved for future settings endpoint |
| `AuditLogs/AdminActions` | New backend audit trail | Created by sensitive admin and route writes |

## Compatibility Notes

- Route keys remain compatible with the legacy format: `route_fwd_01`, `route_rev_01`, and so on.
- Transactions keep their nested POS device and trip structure.
- `LiveStatus.lastUpdate` is treated as a millisecond timestamp. Buses older than five minutes are marked offline.
- The API normalizes display data, but it does not require a Firebase migration.

## Security Notes

The old browser Firebase web config and plaintext credential checks are no longer used by the new frontend. Firebase Admin SDK credentials belong in `apps/api/.env` or the backend host secret manager.
