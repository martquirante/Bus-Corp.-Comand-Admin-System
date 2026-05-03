# Critical Alerts

The React admin preserves the legacy behavior where emergency/trouble reports automatically interrupt the current admin screen.

## Data Sources

Critical alerts are derived from these Firebase Realtime Database paths:

- `POS_Devices`
- `AssistanceRequests`
- `messages`

The parser is intentionally flexible because legacy records use mixed field names. It checks fields such as `type`, `issueType`, `status`, `priority`, `reason`, `message`, `remarks`, `emergencyStatus`, `trouble`, and `alert`.

## Detection Rules

An alert is critical when the source record contains values like:

- `SOS`, `sos`, `S.O.S`
- `Emergency`
- `critical`
- `urgent`
- `Bus Emergency`
- `breakdown`
- `accident`
- `trouble`
- POS device `LiveStatus.emergencyStatus === true`

Assistance records with active help/pending/urgent wording are also surfaced as command attention items.

## Backend Endpoints

- `GET /api/critical-alerts`
- `GET /api/critical-alerts/active`
- `GET /api/realtime/critical-alerts/stream`
- `PATCH /api/critical-alerts/:id/acknowledge`
- `PATCH /api/critical-alerts/:id/resolve`
- `PATCH /api/critical-alerts/:id/dismiss`

Realtime streaming uses Server-Sent Events with the admin session token passed as a query parameter because native `EventSource` cannot attach custom authorization headers.

## Frontend Behavior

`CriticalAlertProvider` is mounted globally under `AuthProvider`, so the modal can appear on Dashboard, Live Fleet Map, Sales & Analytics, Transaction Logs, Route Config, Bus Fleet, Employee, and Admin Tools.

The modal supports:

- Locate bus on map
- Acknowledge
- Mark resolved
- Dismiss for now
- Queue display when multiple alerts are active
- Professional sound cue if browser autoplay policy allows it
- Vibration if supported by device/browser

The modal never deletes legacy records. Admin action state is stored in:

- `AdminCriticalAlertState`

This avoids breaking the Java conductor/POS app and legacy Firebase data flow.
