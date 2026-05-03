# Supabase Setup

Project URL:

```text
https://qortxdtzoeprjzsijtwn.supabase.co
```

Project ref:

```text
qortxdtzoeprjzsijtwn
```

Local CLI setup:

```powershell
supabase login
supabase init
supabase link --project-ref qortxdtzoeprjzsijtwn
```

Backend `.env` needs:

```env
SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=postgresql://postgres:<DB_PASSWORD>@db.qortxdtzoeprjzsijtwn.supabase.co:5432/postgres
```

Frontend `.env.local` may use only public values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://qortxdtzoeprjzsijtwn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x2_OBpo1IkJw6nWhgm4A9Q_loJ1UuL7
```

Never commit `SUPABASE_SERVICE_ROLE_KEY`, the direct DB URL password, or `.env` files.
