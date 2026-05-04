# POS Bus Admin Architecture

The Web Admin now uses a hybrid data model:

- Firebase Realtime Database is the live NoSQL source for POS device status, live bus movement, current LiveStatus revenue counters, assistance requests, messages, legacy fare matrix data, and editable `AdminRoutes`.
- Supabase PostgreSQL is the structured SQL store for employees, buses, routes, route stops, route waypoints, tickets, payments, expenses, notifications, critical alerts, and sync logs.
- The Node.js API is the secure bridge. Admin-sensitive frontend requests go through Express before touching Firebase or Supabase.
- The Next.js admin frontend renders the command center UI and calls the backend API.

## Data Flow

```mermaid
flowchart LR
  Admin["Web Admin (Next.js)"] --> API["Express API"]
  API --> Firebase["Firebase RTDB live paths"]
  API --> Supabase["Supabase PostgreSQL structured tables"]
  Firebase --> API
  API --> Admin
```

## Runtime Folders

- `frontend/` contains the Next.js command center.
- `backend/` contains Express routes, Firebase Admin/RTDB REST access, Supabase access, sync services, validation, and middleware.
- `packages/shared/` contains shared TypeScript types, constants, and validators.
- `legacy/web-admin/` is retained only as reference for old Firebase behavior.

## Important Rule

`Routes_Forward` and `Routes_Reverse` are legacy fare matrix/reference paths only. Production Live Map and Route Config use `AdminRoutes` and/or Supabase `route_waypoints` for route lines.

Dashboard accounting uses Supabase PostgreSQL:

- Total Revenue = sum of Supabase `payments.amount`
- Transactions = count of Supabase `tickets`
- Net Profit = Supabase payments minus Supabase expenses

Firebase `POS_Devices.LiveStatus.totalCash` and `totalGcash` are live session counters only. They are labeled Live Session Revenue and are not treated as official accounting totals.
