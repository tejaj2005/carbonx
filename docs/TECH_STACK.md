# CarbonX technology stack

Current status update: Supabase Auth and private Storage are implemented, enabled and live verified. Six evidence files were migrated and checksum checked. PostgreSQL persistence/migration code is implemented and locally tested, but hosted database activation is blocked by TLS negotiation from this network. Official CPCB public sample mode is now live-verified: ten station records for each of eight metros, with partial coverage. An initial HTTP 429 cleared on retry. See [BACKEND_STATUS.md](BACKEND_STATUS.md) for the current configuration and next steps; older observations below are historical.

Current configuration (10 November 2026): Groq is the default hosted AI provider, using GROQ_API_KEY and GROQ_MODEL=openai/gpt-oss-20b. Grok/xAI is a separate optional adapter. No local model is required. Open-Meteo and Earth Search remain keyless; the optional Copernicus Sentinel Hub adapter uses a personal OAuth Client ID/Secret. CPCB uses the official public sample mode; a personal DATA_GOV_IN_API_KEY provides broader access. See ENV_SETUP.md for active configuration and SUPABASE_SETUP.md for the active Auth/Storage configuration and remaining database import.

Update, 10 November 2026: the default website has been simplified at the user's request. Walkthroughs, the verification studio, simulations and duplicate comparison/source panels are no longer displayed in the main views. Core data, uploads, reviews, thresholds, alerts and administrative actions are preserved. Source/prototype descriptions below document the earlier implementation; reusable presentation components remain in the code only.

Current implementation, 10 November 2026. Version pins are in package.json/package-lock.json. This is a full-stack website served over HTTP, not a folder of standalone HTML screens.

| Layer                | Technology                                                     | Purpose                                                                                                       |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Frontend             | React 19.3.1, TypeScript 7.0.2                                 | Component-based portals, state, typed UI and role-specific workflows                                          |
| Build                | Vite 8.3.7, React Vite plugin                                  | Development integration and split production route/chart bundles                                              |
| Styling              | Project CSS, responsive grids, SVG/CSS motion                  | Readable data layouts, sidebar sections, visual verification, orbit and scan effects                          |
| Icons/charts         | Lucide React 1.70.0, Recharts 3.10.1                           | Consistent controls, historical and SDG charts                                                                |
| Backend              | Node.js >=22.13, Express 5.3.0                                 | Authentication, company isolation, document/evidence APIs, jobs and monitoring                                |
| Database             | Node built-in SQLite, persistent .data directory               | Accounts, reports/chunks/claims, observations, reviews, cases, thresholds, provider cache, notices and audits |
| Validation           | Zod 4.6.7                                                      | API input validation                                                                                          |
| API protection       | Helmet, express-rate-limit, cookie-parser, session/CSRF checks | Headers, bounded requests, protected state changes and scoped access                                          |
| PDF/text intake      | pdf-parse 2.4.5, Multer 2.5.0                                  | Protected uploads, signature checks, physical page text/tables                                                |
| Local OCR            | Tesseract.js 7.0.0                                             | Bounded English OCR on scanned PDF pages                                                                      |
| Chunking             | js-tiktoken 1.0.21                                             | 500-token passages with 80-token overlap                                                                      |
| Evidence retrieval   | Lexical baseline; optional local embeddings                    | Company-scoped cited passages, optional hybrid ranking                                                        |
| AI default           | Groq via OpenAI-compatible SDK 7.54.0                          | Hosted strict JSON extraction, cited answers, action plans and advisory explanations                          |
| Optional AI adapters | xAI/Grok, Ollama, legacy OpenAI                                | Explicit provider selection; no local model needed for Groq                                                   |
| Imagery              | geotiff 3.0.5, proj4 2.22.0                                    | Approved COG range reads, coordinate transforms and local NDVI/NDWI                                           |
| CSV/PDF exports      | csv-parse 7.0.3, PDFKit 0.20.2                                 | Historical CSV import and protected findings exports                                                          |
| Tests                | Node test runner, Supertest 7.3.2                              | Real API workflows, role isolation, evidence arithmetic, provider contracts and monitoring                    |
| Formatting           | Prettier 3.9.10                                                | Consistent project source formatting                                                                          |
| Delivery             | Windows launcher, Dockerfile, GitHub Actions                   | Reproducible local start, container definition, test/build workflow                                           |

Node.js 24 LTS is the recommended deployment runtime. The Docker configuration uses Node 24. The launcher starts a detached local server on 127.0.0.1:8765 and reuses its healthy listener.

## Application layout

- src/App.tsx: public/company routing and the company shell.
- src/navigation.ts: six company sections and four government sections. Related views use section links; existing deep links remain valid.
- src/pages/: report, evidence, review, company and government functionality.
- src/Monitoring.tsx: city cards, readings/threshold overview, scoped inbox and monitoring controls.
- src/VerificationStudio.tsx: retained reusable prototype; not mounted in the simplified website.
- src/data/integrations.ts: public API feature descriptions and explicit demo constants; no secrets.
- src/VisualJourney.tsx: retained reusable prototype; not mounted in the simplified website.
- server/app.mjs: API wiring, protected routes and serving the compiled website.
- server/domain.mjs: deterministic metric/year/unit and evidence comparisons.
- server/pipeline.mjs: extraction, source chunks, retrieval and revalidation.
- server/environment.mjs and server/india.mjs: public environmental adapters.
- server/sentinelhub.mjs: optional Copernicus OAuth, catalogue and cloud-masked daily statistics.
- server/prompts.mjs: central evidence-only AI policy and task prompts.
- data/demo-data.json: original synthetic report extraction example.
- data/demo-presentation.json: four-company presentation dataset covering history, usage, claims, reviews and thresholds.
- server/demo.mjs: transactional, versioned demo population and scoped synthetic membership; bundled originals are checksum checked.
- src/UsageTrend.tsx: facility/metric-specific monthly charts with units and IST period endings.
- data/reference-data.json: sourced historical India reference benchmarks, displayed in Settings.
- server/monitoring.mjs: persisted schedules/cache, facility assessments and in-app notifications.
- server/governance.mjs: Government Oversight capabilities and public projection.
- server/ai.mjs: local structured/embedding contracts and disabled-by-default legacy adapter.
- .data/: ignored SQLite, original documents and local caches.
- .local/: ignored logs, reference media, temporary checks and generated local files.

## Role model

Public users see published summaries and metropolitan context. Company owner/analyst/reviewer roles have distinct scoped permissions. Government authority is separately provisioned and cannot be requested through company registration. Government demo access is limited to its own four fictional companies; other sandboxes and real company records remain inaccessible. Administrative decisions update CarbonX records only.

## What runs without ChatGPT

Once deployed and configured, the Node service handles web requests, report jobs, deterministic checks, persisted monitoring schedules and in-app notifications itself. Browser polling only refreshes what is displayed. ChatGPT is not a production runtime dependency.

The optional local AI adapter needs its own running Ollama host; Groq does not. Provider calls need network access and any configured free keys. Server restarts preserve SQLite data and metro due times; report processing currently uses a single-process queue and interrupted jobs need reprocessing.

## Supabase architecture and remaining database activation

Supabase Auth and private Storage are implemented and active. The PostgreSQL adapter and private-schema migration are implemented and locally tested; hosted record migration awaits a working database TLS connection.

Lightweight metro polling can move to Supabase Cron plus authenticated Edge Functions. OCR, large PDFs, satellite raster processing and local LLM inference should remain on a Node/AI worker host because of Edge execution limits.

See BACKEND_REQUIREMENTS.md for user inputs, free-tier limits and the email-last delivery plan. The supplied Supabase project is connected for Auth and private Storage; email delivery remains skipped.

## Active hosted AI and backend preparation

Groq and optional xAI use the existing OpenAI-compatible HTTP client; the dependency name does not choose the service. Strict JSON responses are validated with Zod, and exact report quotes/citation IDs are checked before use. Hosted AI has no assumed embeddings API; lexical retrieval remains available. All AI tasks share server/prompts.mjs.

Optional Copernicus site context uses fixed CDSE OAuth/Catalog/Statistics endpoints, projected UTM bounds via proj4, 10 m daily mosaic sampling and explicit coverage rejection. The previous Earth Search/GeoTIFF implementation stays the default until OAuth credentials are supplied.

See BACKEND_STATUS.md for the verified Auth/Storage integration and pending PostgreSQL activation. In-app notices persist; email is skipped.

Role-based Word, Excel, PDF, CSV and JSON exports are implemented for overall government status, individual companies and selected reports. Word uses structured tables; Excel uses filtered sheets with typed values and clear provenance. See docs/REPORT_EXPORTS.md (REPORT_EXPORTS.md from this docs folder). Runtime template libraries: docx 9.15.3 and ExcelJS 4.4.0; ExcelJS uuid is pinned to 11.1.1 to resolve its advisory.

## Current integration additions, 10 November 2026

- server/live-satellite.mjs: fixed EUMETSAT WMS, regional India infrared PNGs, provider timestamps, 15-minute shared cache and stale fallback.
- server/supabase.mjs: pg PostgreSQL driver, verified TLS, read-only connectivity/schema checks and bounded HTTPS Data API/Auth health checks. It is not a persistence/Auth migration.
- scripts/check-ai-features.mjs: repeatable live Groq tests for extraction, cited answers, evidence actions and advisory explanations using synthetic fixtures only.
- docs/INTEGRATION_VERIFICATION.md: observed results and limitations.

- server/orbit.mjs: public ISS position feed, validated coordinates/time, 10-second shared cache and last-known stale fallback; React refreshes every 15 seconds. Existing SatelliteScene supplies a pausable illustrative CSS/SVG animation beside the current image.

## Current backend implementation

- server/db.mjs and server/sqlite.mjs: asynchronous store interface and serialized SQLite transactions.
- server/pg-store.mjs and migrations/001_carbonx.sql: PostgreSQL pool, verified TLS, parameter binding, rollback, advisory migration lock and private RLS-enabled schema.
- server/cloud-services.mjs: fixed-project Supabase Auth and private Storage HTTP adapters; credential errors are sanitized.
- scripts/migrate-database.mjs and scripts/migrate-storage.mjs: preserved-source migration and verification.
- src/SatelliteView.tsx, src/GovernmentVerification.tsx, src/ProfileSettings.tsx and src/TrendChart.tsx: shared verification, scoped government site checks, account settings and timestamp/unit-labelled charts.
- @electric-sql/pglite is a development-only PostgreSQL validation engine, not a local AI model or the active database.
