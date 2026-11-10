# Supabase setup for CarbonX

Status: preparation only. Today's backend stores records in SQLite and files locally. Adding the values below does not migrate data, connect Supabase Auth or install storage policies. Do not delete .data.

## Values to save manually in the ignored root .env

| Variable                 | Where to find it                                                      | Purpose                                                                 |
| ------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SUPABASE_URL             | Project Dashboard → Connect, or Project Settings → Data API / API URL | Project API URL, usually https://PROJECT_REF.supabase.co                |
| SUPABASE_PUBLISHABLE_KEY | Project Settings → API Keys → Publishable key                         | Client identity for future Auth/data access under user identity and RLS |
| SUPABASE_SECRET_KEY      | Project Settings → API Keys → Secret key                              | Server-only privileged operations; bypasses RLS                         |
| SUPABASE_DB_URL          | Dashboard → Connect → connection string                               | PostgreSQL URL containing DB password for server/migrations             |

Use current publishable and secret keys where offered. Legacy anon/service_role keys are the older equivalents; do not add both sets unless an adapter specifically needs them. Never put the secret key or DB URL in VITE_ variables, frontend code or Git.

## Steps

1. Confirm you are in the intended project, then copy the project URL and API keys into the four existing blank .env entries. Keep the values out of chat.
2. In Connect, choose a connection mode supported by your deployment. A persistent Node server on IPv4 can use the session pooler; direct connections may require IPv6. Use the dashboard's exact user/host/port, not guessed values.
3. Replace the password placeholder locally with your database password. Percent-encode URI-reserved characters in the password component (for example @, :, /, #, ? and %); do not encode the entire connection string. If the dashboard provides separate connection fields, a future adapter can avoid manual URI construction.
4. Keep production database access private. Future browser queries need table-specific RLS; a publishable key is not authorization by itself.
5. When the adapter/migrations are implemented, use a staging project first, apply schema, ownership/role/RLS policies and private Storage buckets, then verify company isolation and government permissions before importing production records.

## IDs you do not need to supply separately yet

The project reference is already in SUPABASE_URL/connection information. Organization ID, personal access token, JWT signing secret, user IDs and DB password as a separate chat value are not needed for this setup.

## Work still required to connect it

- PostgreSQL persistence adapter and repeatable migrations for current SQLite tables.
- Supabase Auth/session decision with account linking and role checks.
- Private Storage adapter for uploads and controlled evidence downloads.
- RLS/company separation and bounded Government Oversight authority tests.
- Backup/import verification, deployment configuration and a continuously running monitoring worker.

Supabase will not run this Express process or polling worker merely because keys are present. Email/SMTP is the final phase, as requested; do not configure recipient delivery now.

References:

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/connecting-to-postgres
