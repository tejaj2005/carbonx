# CarbonX technology stack

Current configuration update: Grok/xAI replaces the local model as the default AI provider. Add XAI_API_KEY in the ignored .env file. Weather, modelled AQ and satellite endpoints are keyless and configured. Official station summaries still need DATA_GOV_IN_API_KEY. No local Ollama runtime is required for the selected configuration. Earlier local-model descriptions below are historical/optional; see ENV_SETUP.md for the active setup.

Update, 10 November 2026: the default website has been simplified at the user's request. Walkthroughs, the verification studio, simulations and duplicate comparison/source panels are no longer displayed in the main views. Core data, uploads, reviews, thresholds, alerts and administrative actions are preserved. Source/prototype descriptions below document the earlier implementation; reusable presentation components remain in the code only.

Current implementation, 10 November 2026. Version pins are in package.json/package-lock.json. This is a full-stack website served over HTTP, not a folder of standalone HTML screens.

| Layer              | Technology                                                     | Purpose                                                                                                       |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Frontend           | React 19.3.1, TypeScript 7.0.2                                 | Component-based portals, state, typed UI and role-specific workflows                                          |
| Build              | Vite 8.3.7, React Vite plugin                                  | Development integration and split production route/chart bundles                                              |
| Styling            | Project CSS, responsive grids, SVG/CSS motion                  | Readable data layouts, sidebar sections, visual verification, orbit and scan effects                          |
| Icons/charts       | Lucide React 1.70.0, Recharts 3.10.1                           | Consistent controls, historical and SDG charts                                                                |
| Backend            | Node.js >=22.13, Express 5.3.0                                 | Authentication, company isolation, document/evidence APIs, jobs and monitoring                                |
| Database           | Node built-in SQLite, persistent .data directory               | Accounts, reports/chunks/claims, observations, reviews, cases, thresholds, provider cache, notices and audits |
| Validation         | Zod 4.6.7                                                      | API input validation                                                                                          |
| API protection     | Helmet, express-rate-limit, cookie-parser, session/CSRF checks | Headers, bounded requests, protected state changes and scoped access                                          |
| PDF/text intake    | pdf-parse 2.4.5, Multer 2.5.0                                  | Protected uploads, signature checks, physical page text/tables                                                |
| Local OCR          | Tesseract.js 7.0.0                                             | Bounded English OCR on scanned PDF pages                                                                      |
| Chunking           | js-tiktoken 1.0.21                                             | 500-token passages with 80-token overlap                                                                      |
| Evidence retrieval | Lexical baseline; optional local embeddings                    | Company-scoped cited passages, optional hybrid ranking                                                        |
| AI default         | Ollama HTTP API                                                | Free local structured extraction, cited answers and advisory explanations                                     |
| Legacy AI adapter  | OpenAI SDK 7.54.0                                              | Optional support only; paid calls disabled by default                                                         |
| Imagery            | geotiff 3.0.5, proj4 2.22.0                                    | Approved COG range reads, coordinate transforms and local NDVI/NDWI                                           |
| CSV/PDF exports    | csv-parse 7.0.3, PDFKit 0.20.2                                 | Historical CSV import and protected findings exports                                                          |
| Tests              | Node test runner, Supertest 7.3.2                              | Real API workflows, role isolation, evidence arithmetic, provider contracts and monitoring                    |
| Formatting         | Prettier 3.9.10                                                | Consistent project source formatting                                                                          |
| Delivery           | Windows launcher, Dockerfile, GitHub Actions                   | Reproducible local start, container definition, test/build workflow                                           |

Node.js 24 LTS is the recommended deployment runtime. The Docker configuration uses Node 24. The launcher starts a detached local server on 127.0.0.1:8765 and reuses its healthy listener.

## Application layout

- src/App.tsx: public/company routing and the company shell.
- src/navigation.ts: six company sections and four government sections. Related views use section links; existing deep links remain valid.
- src/pages/: report, evidence, review, company and government functionality.
- src/Monitoring.tsx: city cards, readings/threshold overview, scoped inbox and monitoring controls.
- src/VerificationStudio.tsx: location-to-review visualisation, snapshot replay, isolated emissions simulation, public source catalogue and city comparison.
- src/data/integrations.ts: public API feature descriptions and explicit demo constants; no secrets.
- src/VisualJourney.tsx: presentation walkthrough and reusable SVG scenes.
- server/app.mjs: API wiring, protected routes and serving the compiled website.
- server/domain.mjs: deterministic metric/year/unit and evidence comparisons.
- server/pipeline.mjs: extraction, source chunks, retrieval and revalidation.
- server/environment.mjs and server/india.mjs: external environmental adapters.
- server/monitoring.mjs: persisted schedules/cache, facility assessments and in-app notifications.
- server/governance.mjs: Government Oversight capabilities and public projection.
- server/ai.mjs: local structured/embedding contracts and disabled-by-default legacy adapter.
- .data/: ignored SQLite, original documents and local caches.
- .local/: ignored logs, reference media, temporary checks and generated local files.

## Role model

Public users see published summaries and metropolitan context. Company owner/analyst/reviewer roles have distinct scoped permissions. Government authority is separately provisioned and cannot be requested through company registration. Government demo access is limited to one synthetic company. Administrative decisions update CarbonX records only.

## What runs without ChatGPT

Once deployed and configured, the Node service handles web requests, report jobs, deterministic checks, persisted monitoring schedules and in-app notifications itself. Browser polling only refreshes what is displayed. ChatGPT is not a production runtime dependency.

Local AI needs its own running Ollama host. Provider calls need network access and any configured free keys. Server restarts preserve SQLite data and metro due times; report processing currently uses a single-process queue and interrupted jobs need reprocessing.

## Proposed Supabase architecture: not implemented yet

Supabase can replace SQLite/auth/filesystem persistence with Postgres, Auth and private Storage. This requires schema/data migration, RLS policies, identity mapping, storage adapters and regression testing. It is not achieved by adding a URL/key to the current application.

Lightweight metro polling can move to Supabase Cron plus authenticated Edge Functions. OCR, large PDFs, satellite raster processing and local LLM inference should remain on a Node/AI worker host because of Edge execution limits.

See BACKEND_REQUIREMENTS.md for user inputs, free-tier limits and the email-last delivery plan. No Supabase project has been created or migrated, and email is not implemented in this UI cleanup.
