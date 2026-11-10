# Live integration verification — 10 November 2026

Checks ran from the CarbonX checkout. Secret values are excluded from this record.

| Integration                       | Observed result                                   | What this verifies                                                                                   |
| --------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Groq, openai/gpt-oss-20b          | Model listed; live structured inference succeeded | Saved key works with the selected Groq model                                                         |
| AI claim extraction               | Passed live synthetic fixture                     | Expected Scope 1 quantity extracted with an exact source quote                                       |
| AI cited answer                   | Passed live synthetic fixture                     | Answer contains the supplied value and valid passage ID                                              |
| AI evidence actions               | Passed live synthetic fixture                     | Structured suggestions reference only the supplied claim                                             |
| AI monitoring explanation         | Passed live synthetic fixture                     | Structured summary and cautions returned                                                             |
| Open-Meteo weather/CAMS AQ        | Connected                                         | Current public model endpoints responded; not company meter readings                                 |
| Earth Search Sentinel-2 catalogue | Connected                                         | Historical catalogue available; this is not a real-time feed                                         |
| EUMETSAT India IR image           | Fetched valid PNG and rendered in the website     | Provider capture 2026-11-10T15:00:00Z, retrieved approximately 15:21Z; 15-minute advertised interval |
| Supabase Data API                 | HTTP 200                                          | Existing saved server key accepted over HTTPS                                                        |
| Supabase Auth health              | HTTP 200                                          | Auth service reachable; this does not verify app login integration                                   |
| Supabase session-pooler database  | Connection timed out                              | Password not yet authenticated; no database migration applied                                        |
| CPCB/data.gov.in                  | Not configured                                    | Personal DATA_GOV_IN_API_KEY still required                                                          |
| Copernicus Sentinel Hub OAuth     | Optional, not selected                            | No client ID/secret supplied                                                                         |

The initial standalone EUMETSAT check had a transient failure; a subsequent fetch and the website succeeded. The adapter caches for 15 minutes, retains a last-good frame on refresh failures, marks old/failed refresh results stale and never substitutes demo imagery. Capture timestamps remain attached to the exact cached image.

AI checks used small synthetic fixtures only. They verify request/response, schema and selected evidence constraints; they do not establish general model accuracy or production readiness. No real company report was transmitted for these tests.

## Repeat checks

- npm.cmd run integrations:check — model access plus public environmental endpoints; no inference.
- npm.cmd run integrations:check -- --ai — adds a small synthetic inference.
- npm.cmd run ai:verify — four live AI task checks using synthetic evidence.
- npm.cmd run supabase:check — read-only database/TLS and HTTPS API checks; exits nonzero while a required connection fails.

The supplied Groq key and Supabase credentials are saved only in ignored .env. No VITE_ secret variables are used. The temporary local credential transfer helper was stopped and removed. No database password was reset and no new Supabase keys were generated.

Application records still live in SQLite, uploaded evidence on the local filesystem, and login uses CarbonX sessions. Supabase Auth, PostgreSQL persistence and Storage migration remain separate implementation work. Email delivery remains deferred. This installation is not production ready.

Final local validation: 84 automated tests passed; production build, formatting and Git whitespace checks passed. Website returned HTTP 200 and the real 640×640 satellite image loaded without horizontal overflow in the current narrow viewport.

Additional review display: live ISS coordinates verified from Where the ISS at? (HTTP 200); animation and timestamped imagery are together on Site verification. Animation is illustrative, with pause/reduced-motion support; orbital data refreshes every 15 seconds.

Geolocation display: bundled Natural Earth coastline map plots the current ISS position and selected saved facility coordinates on the existing page. No map key or external tile request is used.
