# Bus Corp Security Hardening Guide

This document outlines the whole-system security architecture and defensive controls implemented across the Drive&Go POS Bus Ticketing Simulation Admin Web & Backend system.

---

## 1. Brute-Force Defense & temporary Lockout System

To protect administrative accounts against dictionary attacks and credential stuffing, the authentication module is equipped with an automated IP/User-based brute-force tracker.

- **Threshold**: Maximum of **5 consecutive failed login attempts** per email address.
- **Penalty**: A temporary **15-minute lockout penalty timer** is enforced immediately.
- **Fail-safe Lockout Check**: Any login attempts made during a lockout period will immediately reject with a `429 Too Many Requests` error containing the remaining penalty seconds.
- **Database Backend**: Locked counters and penalty timestamps are tracked inside Supabase PostgreSQL pool for absolute accuracy, persistent across server restarts.
- **Audit Logging**: Any failed attempt, successful attempt, or lockout trigger fires an immutable security log event recorded in `system_audit_logs`.

---

## 2. Dynamic Role-Based Access Control (RBAC)

The system enforces strict multi-layered backend role checks. Route boundaries use the `requireAuth` middleware to inspect standard JWT headers. Additional endpoint mutations (like triggering bulk recalculations or manual retries) enforce role boundaries using:

- **SuperAdmin / Admin Roles**: Authorized to synchronize, recalculate, re-anchor, and view the raw Security Ledger logs.
- **Cashier / Coordinator Roles**: Restricted to operational entrypoints (e.g. clearing daily remittance sheets or updating bus statuses).
- **Service-Role Keys**: Sealed inside backend environment files. No private Supabase roles or service keys are exposed to the client.

---

## 3. Storage Upload Cryptographic Integrity

Whenever files are uploaded to the simulation system (Conductor profile pictures, signatures, bus document PDFs, registration documents), they are cryptographically audited:

1. **On-Upload Hashing**: The backend immediately calculates a SHA-256 file hash before streaming the binary to Supabase/Firebase storage.
2. **Anchor Registration**: A `file_upload` audit log record is saved to the ledger containing:
   - File name, mime-type, and size in bytes.
   - Cryptographic SHA-256 hash digest.
   - Associated record ID and type (e.g., employee or bus ID).
   - Timestamp and actor email who uploaded the asset.
3. **Immutability**: Once registered, any change or replacement of the asset file can be detected by re-running the verification re-hash check in the Security Ledger.

---

## 4. Environment Variables Checklist

Ensure these values are configured in your production environment:
- `LOCKOUT_MAX_ATTEMPTS`: defaults to `5`
- `LOCKOUT_COOLDOWN_MINUTES`: defaults to `15`
- `SUPABASE_DB_URL`: native Postgres connection string for direct pool operations (required for lockouts)
- `SUPABASE_KEY` / `SUPABASE_URL`: Supabase Client credentials
