# CarbonX production-readiness assessment

Current configuration (10 November 2026): Groq is the default hosted AI provider, using GROQ_API_KEY and GROQ_MODEL=openai/gpt-oss-20b. Grok/xAI is a separate optional adapter. No local model is required. Open-Meteo and Earth Search remain keyless; the optional Copernicus Sentinel Hub adapter uses a personal OAuth Client ID/Secret. CPCB requires DATA_GOV_IN_API_KEY. See ENV_SETUP.md for active configuration and SUPABASE_SETUP.md for the reserved backend migration placeholders.

Assessed locally on 10 November 2026. Status: functional full-stack India review pilot; not production-ready for continuous industrial enforcement or an internet-facing service.

## What runs now

- React/TypeScript website, Express API and persistent SQLite database served over HTTP.
- Separate company and Government Oversight access, owner/reviewer/analyst permissions, protected administration, claims/reports, history, evidence, SDGs, cases, licence records and opt-in public transparency.
- PDF/TXT ingestion, bounded English OCR, source citations, report reprocessing, canonical comparisons, human reviews, activity logging and exports.
- Eight-city India observatory: Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Pune and Ahmedabad.
- Background provider polling every 30 minutes; persistent cache, source timestamps, last-good retention and visible missing/stale states.
- Configurable facility operational thresholds, company-reported observations, strict matching and durable in-app company/government notifications.
- Groq adapter for structured extraction, cited answers, action plans and alert explanations. Provider credentials remain blank here; the running app uses its labelled baseline.
- Simplified company/government/public UI. Synthetic company records and historical published reference benchmarks remain distinct from actual provider output.

## API inventory and evidence

| Integration                   | What it provides                                                           | Current verification                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-Meteo forecast           | Current provider weather output                                            | Live responses verified for all eight metros on 10 November 2026                                                                                  |
| Open-Meteo / CAMS global AQ   | Regional atmospheric model estimates and completed 24-hour model summaries | All eight cities returned current model output; retrieved approximately 14:01 IST, valid at 13:30 IST on 10 November 2026                         |
| CPCB via data.gov.in          | Official station-summary adapter                                           | Implemented and contract-tested; not live authenticated because no personal key was supplied; metadata and coverage still require live validation |
| Earth Search / Sentinel-2 L2A | Dated imagery and selected-site NDVI/NDWI context                          | Prior live Hyderabad-area comparison stored and displayed; scene IDs and dates in validation.md                                                   |
| Ollama localhost              | Free local model inference and embeddings                                  | Adapter contract tested; no installed model/service inference was verified                                                                        |
| In-app notifications          | Persisted scoped alerts and review/government-event notices                | Automated and synthetic browser handoff checks; no external messages                                                                              |
| Legacy OpenAI/Gmail           | n8n credential references in the old export                                | No reusable secrets recovered; no legacy account or workflow used                                                                                 |
| Where The ISS At              | Orbital position                                                           | Found in legacy workflow; not used as environmental/site imagery                                                                                  |

Open-Meteo India AQ uses CAMS global modelled data: approximately 45 km, 3-hour native steps, updated every 12 hours. Fetching its hourly output every 30 minutes does not turn it into measured station telemetry. Providers may be unavailable or return older data. All values are time-dependent.

Official station values are preserved with provider timestamps. Units or averaging periods absent from the payload remain unknown. The adapter does not infer an Indian AQI category or legal breach from such fields.

## What the recovered project actually contained

The ZIP, reachable public Git history and inspected media yielded no reusable plaintext API key. n8n OpenAI and Gmail credential names/IDs are references, not secrets. The three HTTP integrations were ISS orbital position, Open-Meteo AQ and Open-Meteo weather. Weather was labelled EnergyUsage in the old workflow but is not industrial energy measurement. No recovery was attempted against the lost n8n Cloud workspace.

See credential-audit.md for scope and evidence.

## Alert boundaries

A regional air-quality advisory concerns ambient model conditions. It cannot identify the polluting company or prove that a factory crossed its permit conditions.

Facility monitoring currently accepts company-reported data, forced to that provenance even when a client submits a different label. A matching observation must have the configured facility, metric, unit, basis, complete reporting duration, valid quality and acceptable age. Otherwise the result is not assessed.

Exceedances create operational alerts, not automated legal findings. Government Oversight can review evidence and record its own CarbonX administrative decision. CarbonX does not change an external government licence.

## Inputs needed for the next stage

1. A free personal data.gov.in API key saved as DATA_GOV_IN_API_KEY in this project's ignored .env file. Do not send the value in chat. Restart CarbonX, then validate actual station coverage, timestamps, units and averaging metadata.
2. For true continuous factory monitoring: an authorised facility OCEMS/CEMS or meter feed, its API/export specification and permitted credentials. Supply applicable consent/permit limits, units, averaging periods and normalisation conditions. Public city AQ cannot substitute for this.
3. For free AI: an installed local Ollama model compatible with structured JSON, sufficient local memory and a running service. Optional local embedding model. Model licence, reliability, quality and actual end-to-end requests need validation. No paid API calls are enabled by default.
4. In-app alerts already work. Email/SMS would need a separately configured free-tier delivery service, verified sender and explicit recipients; no such credentials or recipients were supplied.
5. GitHub authentication for tejaj2005 or write access to that repository. The cached teja-rp identity previously received HTTP 403. Source is committed locally; do not interpret a local commit as a push.

## Deployment work still required

- Public HTTPS hosting with persistent storage and an always-running server. This is currently loopback-only and has no public deployment.
- Real administrator provisioning and disabling example workspaces for normal operation.
- Validated backup/restore, account recovery, operational alerting and log retention.
- Load/concurrency/security testing, upload malware controls and independent penetration testing appropriate to deployment.
- A durable worker/queue for report processing before multi-instance operation. The existing report queue is in-process; interrupted jobs are flagged for reprocessing.
- Verified live station and factory connectors, data-quality handling and provider quotas/terms.
- Real-company test evidence and independently annotated AI evaluation. No benchmark quality or fraud-detection accuracy is claimed.
- Email/SMS delivery, if required; these are absent rather than silently simulated.

## Official sources

- [Open-Meteo AQ model coverage](https://open-meteo.com/en/docs/air-quality-api)
- [Open-Meteo free-use terms](https://open-meteo.com/en/terms)
- [CPCB station resource on data.gov.in](https://www.data.gov.in/resource/real-time-air-quality-index-various-locations)
- [OGD platform help and API access](https://www.data.gov.in/help)
- [CPCB/NCAP report containing NAAQS averaging periods](https://prana.cpcb.gov.in/ncapDashboard/download_public_portal_file/NCAP_Report.pdf)
- [Government description of OCEMS and automated alerts](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1813174&lang=2&reg=48)
- [Earth Search public imagery](https://github.com/Element84/earth-search/blob/main/README.md)
- [Ollama generation API](https://docs.ollama.com/api/generate)
- [Ollama embedding API](https://docs.ollama.com/api/embed)

## Latest connection status

Groq/Copernicus contract checks and the 68-test suite passed. The production build passed. The live connection checker returned weather, air model and Earth Search catalogue connected; Groq and CPCB need keys, and Copernicus remains unselected pending OAuth credentials. No model accuracy, real-company fraud finding, authenticated imagery result or Supabase migration was verified by those tests. The exposed chat key was not copied to .env or sent to a provider; use a rotated key.

10 November 2026 update: Auth and private Storage are active and verified. PostgreSQL migration code is implemented, but hosted database activation remains blocked by network/TLS negotiation; current records still use SQLite. Public CPCB sample mode is rate-limited. See BACKEND_STATUS.md. No production-ready claim is made.
