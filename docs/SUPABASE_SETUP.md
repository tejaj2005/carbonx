# Supabase setup for CarbonX

Current status update: Supabase Auth and private Storage are implemented, enabled and live verified. Six evidence files were migrated and checksum checked. PostgreSQL persistence/migration code is implemented and locally tested, but hosted database activation is blocked by TLS negotiation from this network. Official CPCB public sample mode is now live-verified: ten station records for each of eight metros, with partial coverage. An initial HTTP 429 cleared on retry. See [BACKEND_STATUS.md](BACKEND_STATUS.md) for the current configuration and next steps; older observations below are historical.

The project's existing URL, server secret key, session-pooler connection URI and supplied database password are saved in the ignored root .env. They are backend configuration; no credentials or setup form are displayed in CarbonX.

The existing server key was accepted by the project's Data API and Auth health endpoint (HTTP 200). PostgreSQL on the dashboard's session-pooler port timed out before authentication. The database password is therefore unverified. No remote tables, passwords, policies, keys or records were changed.

## Active environment entries

| Variable                 | Purpose and status                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| SUPABASE_URL             | Configured project HTTPS URL                                                                            |
| SUPABASE_SECRET_KEY      | Configured existing server-only key; HTTPS API access verified                                          |
| SUPABASE_DB_URL          | Dashboard session-pooler URI with encoded supplied password; network timeout                            |
| SUPABASE_DB_PASSWORD     | Optional separate local password record; checker uses the URI                                           |
| SUPABASE_PUBLISHABLE_KEY | Not needed by today's server-only connection checks; leave blank until an Auth/browser adapter needs it |

Do not put a secret key, password or database URL in frontend code, VITE_ variables, Git, report exports or screenshots.

## Verify and resolve the database timeout

1. Run npm.cmd run supabase:check from the CarbonX folder. Output contains only status, TLS/schema counts and timestamps, never credentials.
2. Confirm the deployment/network can reach the dashboard's session-pooler host on port 5432. A timeout is not proof of an incorrect password.
3. Keep the exact host, project username and port from Dashboard → Connect. Session pooling supports IPv4. Percent-encode reserved password characters in the password part of the URI.
4. Certificate and hostname validation remain enabled. If a trusted CA needs to be installed, use the official Supabase certificate instructions; do not disable verification.
5. Once reachable, rerun the check. It performs a read-only transaction and schema count; it does not install or alter anything.

## Application backend status

CarbonX still uses SQLite for records, CarbonX password/session authentication and local private upload storage. Successful Supabase connection checks do not migrate these systems.

The remaining migration work is a PostgreSQL persistence adapter and repeatable schema/data migrations; an Auth/account-linking decision; private Storage access; company ownership/RLS and Government Oversight regression tests; backup/import and deployment verification. Preserve .data until a migration is verified.

Supabase alone does not start this Express service, OCR/report queue or scheduled monitoring worker. A continuously running Node host or worker deployment is still required. Email is the final phase and remains unconfigured.

No organization ID, personal access token, JWT signing secret or additional chat password is required for the current checks. A publishable key can be added later if the chosen Auth design needs it.

Official references:

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/getting-started/api-keys
