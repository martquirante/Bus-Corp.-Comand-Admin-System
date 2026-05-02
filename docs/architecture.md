# Architecture

## Scope

This refactor targets the Web Admin only. The Java/Gradle conductor POS app is not refactored. Its existing Firebase Realtime Database data flow is preserved by keeping the same RTDB paths consumed by the legacy dashboard.

## Workspace

The project is now organized as an npm workspace:

- `frontend`: Next.js, React, TypeScript web admin.
- `backend`: Express, TypeScript API boundary for secure Firebase Admin SDK access.
- `packages/shared`: shared types, constants, and Zod validators.
- `docs`: architecture, Firebase data map, and deployment notes.

The original flat HTML/CSS/JS files were moved to `legacy/web-admin` as reference only. They are no longer the active admin entrypoint.

## Data Flow

1. Admin signs in through `POST /api/auth/session`.
2. The frontend stores a local session token and calls the API.
3. The API verifies the session through middleware.
4. Services read or write Firebase using the Firebase Admin SDK.
5. Controllers return a consistent `{ data, source, generatedAt }` envelope.

When Firebase Admin credentials are missing locally, read endpoints use separated demo data from `backend/src/services/demoData.ts`. Write endpoints require Firebase Admin configuration so local preview cannot accidentally mutate a mock source and hide production issues.

## Frontend

The admin UI is split into feature pages:

- Dashboard overview
- Live Fleet Map
- Sales & Analytics
- Transaction Logs
- Route Config
- Admin Tools
- Login

Reusable components include `Sidebar`, `Topbar`, `StatCard`, `ChartCard`, `DataTable`, `ThemeToggle`, `LoadingScreen`, `BusMarker`, `MapControls`, `AlertPanel`, and `FilterBar`.

Light and dark modes are handled by `ThemeProvider`, stored in `localStorage`, and initialized from system preference on first load.

## Backend

The API is structured by route/controller/service layers:

- `routes`: URL composition and middleware.
- `controllers`: request parsing and response envelopes.
- `services`: Firebase reads, writes, transforms, and audit logging.
- `middleware`: auth, role checks, validation, errors, rate limiting.
- `config`: environment and Firebase Admin initialization.

Sensitive Firebase Admin credentials are only read by `backend`.
