# Architecture and evidence model

## Runtime

A same-origin React/TypeScript client calls an Express JSON API. The Node server serves either Vite development middleware or the production dist directory. SQLite stores company data, sessions, reports, passages, claims, observations, reviews, provider results and evaluation runs.

The application runs independently of n8n. No legacy workflow is executed, and the lost Cloud workspace is excluded from recovery or integration.

## Processing path

1. Authenticate the company user and validate the upload metadata, extension, byte signature and size.
2. Store the original report under a generated filename outside the public frontend.
3. Queue a processing job with persistent state and progress.
4. Extract PDF text and tables by physical page. Scanned pages can use local English OCR. Text reports use form-feed sections.
5. Remove repeated page headers and split into 500-token passages with 80-token overlap, retaining page and passage IDs.
6. With hosted AI configured, embed passages and extract schema-constrained claims from batches of cited passages. Otherwise run the labelled keyword baseline.
7. Validate that each hosted claim's quote exists in its supplied passage. Reject unsupported quotes and record fallback warnings where applicable.
8. Store metric, value, unit, current and baseline years, change direction, scope, SDGs and extraction method.
9. Compare against company observations using deterministic rules. Generate evidence-gap actions.
10. Keep automated status separate from human acceptance, rejection or follow-up.

Reprocessing creates a new report version, retaining the previous version's claims and decisions. Processing errors and interrupted jobs remain observable. The current job runner is serial and in-process; a durable worker service is a future scaling change.

## Scope and comparison rules

Historical evidence matches only when metric, facility, boundary and year agree. Boundary matching trims and collapses whitespace and ignores case; different boundary wording does not silently match. Units are converted within their compatible families.

Separate metrics distinguish water consumption, withdrawal and recycling; energy use and generation; total and scope 1/2/3 emissions; generated and recycled waste; renewable share; and land area.

A percentage-change claim needs an explicit earlier baseline year and direction. A zero baseline, missing record, duplicate record, incompatible unit or ambiguous scope yields insufficient evidence. A difference exceeding two percentage points between claimed and historical change yields needs review. Direct quantities use a 0.5% rounding tolerance.

These tolerances are documented application rules, not a declaration of regulatory materiality or verification standards. Historical records are user-supplied evidence, not independently authenticated measurements.

Keyword extraction cannot reliably interpret all prose. Multi-metric sentences, fiscal-year conventions, complex tables and other ambiguous statements require source inspection and field corrections. Hosted extraction remains subject to review as well.

## Retrieval and model boundaries

Passages belong to the authenticated company. Lexical retrieval uses weighted term overlap. Optional embeddings are persisted and combined with lexical ranks for hybrid top-five retrieval. The answer API accepts only IDs in the retrieved evidence set and rejects invalid IDs or uncited answers when passages exist.

Source citation validation establishes that a quotation occurs in its passage. It does not establish that the report itself is true, that an interpretation is correct or that an answer entails every cited passage. Reviewers inspect the original evidence.

Report passages are untrusted content. Model instructions explicitly exclude following embedded instructions and prohibit fabricated quantities and final fraud/compliance judgments. Server credentials and filesystem access are not model tools.

## Environmental providers

Open-Meteo provides regional modelled weather and air-quality context. The UI records source times, retrieval times and partial/unavailable responses. No sample readings replace a failure.

Earth Search is queried for Sentinel-2 L2A scenes covering the selected coordinates in two non-overlapping windows. Selection filters tile cloud cover at or below 20%. Approved public S3 COG assets are read over a selected 1 km square, resampled to 64 by 64 pixels. Each band uses its own pixel window and STAC scale/offset.

Scene classification masks retain vegetation, bare ground and water classes. NDVI = (NIR - red) / (NIR + red); NDWI = (green - NIR) / (green + NIR). A minimum clear-pixel count and coverage are required. Scene IDs, dates, cloud cover, clear coverage, means and differences are stored. Thumbnails show tile overviews; the calculated sample is the local window, not the full tile.

Season, crop cycles, surface conditions, sampling, clouds and acquisition differences affect indices. NDVI/NDWI do not measure facility emissions or prove a carbon-credit claim. Regional air quality does not establish facility-attributed pollution. The old ISS API is intentionally not used as environmental imagery.

## Evaluation

Reviewer-labelled claims store expected SDGs, expected status, relevant passage IDs and a development or test split. Evaluation uses only test labels and stores the measured result and timestamp.

The app computes multilabel SDG precision/recall/F1, status accuracy/macro F1/confusion and lexical Recall@5 where relevance labels exist. Stored pipeline output may be baseline or hosted; evaluation does not pretend both are independent AI systems. Small or synthetic labelled sets do not establish generalisation.

No datasets, achieved metrics or benchmark totals from the reference presentation are claimed as reproduced. A real held-out corpus and independent annotation remain necessary for research-quality evaluation.

## Access and storage

Company IDs are resolved from the authenticated session rather than trusted request bodies. All report, claim, observation and provider-result access is company-scoped.

Owners manage team members; analysts upload reports, facilities and observations; reviewers and owners correct claims, record review decisions and evaluation labels. Server checks enforce roles even if a client attempts a hidden action.

Passwords use salted scrypt. Session tokens are random, stored hashed, expire after 24 hours and use HttpOnly/SameSite cookies. Mutations require a CSRF token and same-origin checks. Password changes revoke other sessions. Login and provider requests have rate limits. Upload names never determine disk paths. CSV cells with formula prefixes are neutralised on export.

SQLite, source documents, OCR caches, .env and local audit materials are ignored by Git and excluded from the Docker build. The event log records application actions and review history; it is not an externally sealed, tamper-proof compliance ledger.

## Source layout

| Path                                | Responsibility                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| server/app.mjs                      | API routes, tenancy, input validation, role enforcement               |
| server/auth.mjs / db.mjs            | Authentication and persistent schema                                  |
| server/documents.mjs / pipeline.mjs | Parsing, OCR, passage construction, processing jobs                   |
| server/domain.mjs                   | SDG baseline, unit conversion, comparison and lexical retrieval       |
| server/ai.mjs                       | Optional structured model requests, embedding and citation validation |
| server/environment.mjs              | Public context, STAC and COG index computation                        |
| server/evaluation.mjs / exports.mjs | Measured evaluation and evidence exports                              |
| src/pages                           | Dashboard, report library, evidence, review and settings views        |
| tests                               | Workflow, isolation, role, parser and domain regression checks        |
| scripts/launch.mjs                  | Persistent Windows local launch and readiness checks                  |

## Deployment limits

Verified as a local single-instance application. No claim is made of a public deployment, load-tested capacity, disaster recovery, penetration test, real-company benchmark, legal compliance certification or live hosted AI without fresh credentials. Production operation needs HTTPS, trusted proxy configuration, managed identity/account recovery, secure document handling and an operational backup/monitoring plan.

## Government, company and public separation

Government authority is a separate government_admins association, resolved from the database for every request. Existing company owner/reviewer/analyst roles are preserved. Government endpoints use a dedicated guard; company endpoints reject government sessions. Company self-registration never grants government authority.

Government administrators can manage the company registry, inspect protected reports, review separately submitted claims, record cases/notices, update licence state with an expected prior state, create company users, disable/re-enable accounts and export the register. Licence changes, review decisions and access mutations are transactional and audited. A suspended or revoked licence blocks company writes immediately; authentication and appropriate read access remain available.

The public API is registered before authentication and returns an explicit projection only for published companies. It exposes approved company identity/licence metadata, reported usage by scope, time-stamped company readings, optional projected environmental summaries and explicitly public notice text. It excludes account details, report files/passages, private case/review notes, internal source references and exact coordinates. Public polling reads stored results and does not trigger provider requests.

Recent reading submission validates compatible canonical units, company/facility ownership and observation time. These are company-submitted values; continuous meter telemetry is not connected.

Real government admins are provisioned interactively through scripts/create-admin.mjs. This database connection disables startup job recovery. A government demo is restricted to one exact synthetic company. Its role switch creates a scoped demo perspective and rotates the session within that company; real accounts are rejected. Generation checks discard stale workspace responses after account switches.

Presentation effects are SVG/CSS illustrations with reduced-motion support. Air-quality slider values and satellite scanning animations are labelled simulations and do not change evidence or administrative decisions.

## India monitoring extension

server/india.mjs defines the eight-city public coordinate inventory, Open-Meteo/CAMS model adapter, optional CPCB/data.gov.in station adapter, IST timestamp parsing, complete past 24-hour model windows and strict operational threshold matching.

server/monitoring.mjs persists metro_cache, city_watch, emission_rules, emission_samples, monitoring_alerts, monitoring_state, notifications and notification_audit_checkpoint in SQLite. Poll due-times and three-minute leases survive restart. A single process runs two city requests concurrently; this is not a distributed durable job service. Last successful data survives provider failures. No unavailable data is replaced by fixtures.

Public GET /api/public/india projects city context only. Authenticated GET /api/monitoring scopes facility data, rules, alerts and inboxes by company/authority. Government demo access remains confined to its exact synthetic company. Inboxes belong to individual users, including read state. Synthetic role switching reuses existing identities so presentation handoffs preserve their inboxes.

Government configures operational thresholds; companies submit observations forced to source_kind company_reported. Matching requires company/facility, metric, unit, measurement basis, reporting duration, age and quality. Deterministic assessments cannot change licence status. Repeated above-threshold readings update an ongoing alert instead of spamming notifications. Invalid or stale evidence never resolves a breach. Regional model advisories have legalFinding=false and are distinct from reported facility alerts.

Audit events for claim submission, review, licence updates and follow-up actions generate deduplicated in-app notifications. Email and SMS delivery remain absent. The server must be running for background processing.

The free AI default is a fixed loopback Ollama endpoint with structured JSON and optional embeddings. No model is bundled and no live inference is verified. Missing AI uses explicit rules/lexical fallbacks. Legacy paid hosted AI is off unless separately opted in. AI explanations are advisory and cannot execute actions.
