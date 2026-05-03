# Firebase Realtime Legacy Map

Realtime Database URL:

```text
https://santranspos-default-rtdb.firebaseio.com
```

## Legacy Paths

| Path | Observed Use | New API |
| --- | --- | --- |
| `POS_Devices` | Live bus device tree and trip transaction history | `/api/legacy/pos-devices`, `/api/fleet/live`, `/api/dashboard/summary` |
| `POS_Devices/*/LiveStatus` | `busNumber`, driver, conductor, `currentLoop`, cash/GCash totals, passenger counts, speed, lat/lng, `lastUpdate`, SOS | dashboard, fleet, notifications |
| `POS_Devices/*/Trips/*/Transactions` | ticket logs with origin, destination, passenger type/count, payment method, amount | `/api/transactions`, `/api/reports/revenue` |
| `Expenses` | expense records with `type`, `amount`, `bus`, `notes`, `timestamp`, `addedBy` | `/api/legacy/expenses`, `/api/dashboard/summary` |
| `Routes_Forward` | legacy forward fare route table | `/api/legacy/routes-forward`, `/api/routes/legacy/forward` |
| `Routes_Reverse` | legacy reverse fare route table | `/api/legacy/routes-reverse`, `/api/routes/legacy/reverse` |
| `SuperAdmins` | legacy admin login records | `/api/auth/session`, `/api/admin/accounts` |
| `Users/Pending` | pending conductor/workforce accounts | `/api/admin/accounts` |
| `Users/Active` | active conductor/workforce accounts | `/api/admin/accounts` |
| `Config/GlobalSettings` | legacy admin passcode | `/api/legacy/config` |
| `AssistanceRequests` | assistance/SOS request source when present | `/api/legacy/assistance-requests`, `/api/notifications` |
| `messages` | admin/dispatch message source when present | `/api/legacy/messages`, `/api/notifications` |
| `AdminRoutes` | new safer admin-managed route records | `/api/routes` writes |
| `AdminNotificationReads` | new read-state only for derived notifications | `/api/notifications/*` |
| `AuditLogs/AdminActions` | backend audit trail for sensitive writes | internal service writes |

## Legacy Dashboard Inspection

`legacy/web-admin/dashboard.js` was the main source of truth.

Reads:

- `.info/connected`
- `/`
- `SuperAdmins/{safeUser}`
- `Routes_Forward`
- `Routes_Reverse`

Writes:

- `Expenses` via `push`
- `Routes_Forward/{key}` and `Routes_Reverse/{key}` via `update`
- full `Routes_Forward` or `Routes_Reverse` replacement during sorted add/delete
- `Config/GlobalSettings` via `update`

`legacy/web-admin/admin_accounts.js` reads/writes:

- `SuperAdmins/{safeUser}` for login/signup
- `Users/Pending`
- `Users/Active`
- approve moves `Users/Pending/{key}` to `Users/Active/{key}`
- reject removes `Users/Pending/{key}`
- deactivate removes `Users/Active/{key}`

## Dashboard Formulas

- Online window: `Date.now() - LiveStatus.lastUpdate < 300000`.
- Revenue: `LiveStatus.totalCash + LiveStatus.totalGcash`.
- Passenger total: `regularCount + studentCount + seniorCount`.
- Expense total: sum of `Expenses.*.amount`.
- Active buses: unique bus numbers whose latest `LiveStatus` is online.
- Route display: latest transaction `origin -> destination`, fallback to `LiveStatus.currentLoop`, fallback to `Unassigned`.
- SOS alert: `LiveStatus.emergencyStatus === true`, reason from `emergencyReason` or `Driver pressed SOS`.
- Route analytics: passenger count grouped by transaction origin/destination.

The backend keeps these formulas in `dataTransform.service.ts` and `dashboard.service.ts`.

## Compatibility Decision

Legacy route paths are read but not mutated by the new route editor. Admin-managed route edits are saved to `AdminRoutes` so conductor/POS app route assumptions are not broken. Existing legacy route paths remain untouched unless a future migration explicitly confirms the shape.
