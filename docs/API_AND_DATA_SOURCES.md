# CarbonX API and data-source catalogue

Current configuration update: Grok/xAI replaces the local model as the default AI provider. Add XAI_API_KEY in the ignored .env file. Weather, modelled AQ and satellite endpoints are keyless and configured. Official station summaries still need DATA_GOV_IN_API_KEY. No local Ollama runtime is required for the selected configuration. Earlier local-model descriptions below are historical/optional; see ENV_SETUP.md for the active setup.

Update, 10 November 2026: the default website has been simplified at the user's request. Walkthroughs, the verification studio, simulations and duplicate comparison/source panels are no longer displayed in the main views. Core data, uploads, reviews, thresholds, alerts and administrative actions are preserved. Source/prototype descriptions below document the earlier implementation; reusable presentation components remain in the code only.

Scope: the actual implementation in this checkout, reviewed 10 November 2026. This file describes what is implemented, what has been exercised live, what is company supplied and what is synthetic. Credentials are never included.

The public website also exposes a readable source catalogue. Its copy lives in src/data/integrations.ts. Runtime availability is shown by the connection panels, timestamps and provider results; a catalogue description is not proof that a service is connected.

## Data-origin rules

| Origin                   | Meaning                                                                      | Use                                                                    |
| ------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Provider model           | A real response from a weather/atmosphere forecast service                   | Regional context, with source and valid/retrieved times                |
| Measured station summary | An official station record returned by the configured OGD source             | Display only until units, averaging periods and coverage are validated |
| Dated satellite scene    | Real Sentinel-2 metadata/raster bands from selected dates                    | Vegetation/water context, not factory emissions measurement            |
| Company-reported         | A report, history record, usage or emissions observation submitted by a user | Strict scoped comparisons and human review                             |
| Synthetic example        | Invented report/company/history or UI scenario                               | Presentation and testing, always labelled                              |
| Deterministic result     | Arithmetic/rule output from the supplied evidence                            | An operational assessment, not an AI or legal finding                  |

No public city reading is presented as a specific company's measured emissions.

## 1. Open-Meteo weather

- Official documentation: https://open-meteo.com/en/docs
- Endpoint: GET https://api.open-meteo.com/v1/forecast
- Parameters: latitude/longitude; current temperature_2m, relative_humidity_2m and wind_speed_10m. Site requests also include bounded hourly history.
- Typical units: °C, %, km/h, taken from this configured provider contract.
- Metro requests use the public city inventory in server/india.mjs. Facility requests use the user-selected facility record.
- No API key is required for the non-commercial endpoint.
- Source modules: server/india.mjs and server/environment.mjs.
- Live weather responses have been verified for all eight metros.
- These are provider model outputs. Weather is not company energy use, greenhouse-gas totals or independent claim verification.

## 2. Open-Meteo / CAMS global air quality

- Documentation: https://open-meteo.com/en/docs/air-quality-api
- Endpoint: GET https://air-quality-api.open-meteo.com/v1/air-quality
- Metro parameters include public coordinates, domains=cams_global, current pollutants, hourly PM₂.₅/PM₁₀, past_days=2 and UTC Unix timestamps.
- Metro fields: PM₂.₅, PM₁₀, NO₂, SO₂ and CO, with current model valid time and retrieval time.
- Facility context currently requests PM₂.₅, PM₁₀, NO₂ and CO.
- Pollutant concentrations are µg/m³ for the requested fields; this is not an Indian AQI number.
- India uses CAMS global atmospheric composition: approximately 45 km resolution, 3-hour native output, updated every 12 hours. The API's hourly series does not mean hourly independent measurements.
- A 24-hour mean is computed only from all 24 distinct completed past hourly outputs. Missing, duplicate, future or null outputs do not silently become a complete average.
- Model PM₂.₅/PM₁₀ advisories use ambient reference values of 60/100 µg/m³ only as regional context. They are explicitly not station-compliance or company-violation findings.
- Live output for all eight cities was verified. Future results depend on provider availability and forecast revision.
- Attribution: Open-Meteo and Copernicus Atmosphere Monitoring Service.
- Free-use terms: https://open-meteo.com/en/terms — non-commercial use only, with published quotas. A commercial deployment needs a separate terms assessment.

## 3. CPCB station summaries through data.gov.in

- Official resource: https://www.data.gov.in/resource/real-time-air-quality-index-various-locations
- API resource: GET https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69
- Configuration: DATA_GOV_IN_API_KEY in the ignored server .env file. Never browser code or Git.
- Adapter sends the key server-side to data.gov.in, filters city, requests JSON and paginates up to the configured 5,000-record safety bound.
- Fields include station/city/state, pollutant identifier, minimum/maximum/average, original last_update and parsed IST timestamp. Invalid values remain null.
- Units and averaging periods remain null unless the response explicitly supplies them. They are not guessed from pollutant names.
- Status: adapter and failure/provenance contracts tested. No personal key supplied, so live authenticated access, current coverage and metadata have not been verified.
- UI: not_configured/missing-key state; no invented station readings.
- No regulatory comparison is made from unknown unit or averaging metadata.

## 4. Earth Search and Sentinel-2 L2A

- Official project: https://github.com/Element84/earth-search
- STAC search: POST https://earth-search.aws.element84.com/v1/search
- Collection: sentinel-2-l2a.
- Search geometry: selected facility point; two explicit earlier/later date windows.
- Selection: required red/NIR/green/scene-classification assets and tile cloud coverage at or below 20%; select a suitable returned scene.
- Asset access: bounded HTTP range reads from approved Sentinel public S3 hosts only.
- Processing: selected local 1 km sample, 64 × 64 raster samples; scene classes 4/5/6; per-asset scaling; NDVI=(NIR-red)/(NIR+red), NDWI=(green-NIR)/(green+NIR). Invalid denominators/pixels are excluded.
- Display: scene dates/IDs/source links, thumbnails, clear sampled fraction, cloud cover, mean indices and index changes.
- No key is needed for the implemented public endpoint.
- Live Hyderabad-area comparison was previously verified with dated January 2025/January 2026 scenes; details are in validation.md.
- Limitations: cloud/scene availability, seasonality, sampling and spatial attribution. Not live video, a real-time spacecraft track, a CO₂ meter or an independent carbon-credit validation.

## 5. Local Ollama AI

- Generation: POST http://127.0.0.1:11434/api/generate
- Embeddings: POST http://127.0.0.1:11434/api/embed
- Documentation: https://docs.ollama.com/api/generate and https://docs.ollama.com/api/embed
- Configuration: AI_PROVIDER=ollama, OLLAMA_MODEL and optional OLLAMA_EMBEDDING_MODEL.
- Features: structured JSON claim extraction, exact source-quote validation, optional persisted embeddings/hybrid search, cited answers, recommendations and alert explanations.
- No external paid key is required. An installed compatible local model and running service are required.
- Default state here: unconfigured; actual inference has not been verified. Adapter request contracts pass automated tests. Rules and lexical search remain active.
- Prompts treat report text as untrusted evidence. Model suggestions do not execute administrative actions.
- The OpenAI dependency remains for legacy optional support, disabled by default behind ALLOW_PAID_AI. No paid AI request is made by the free pilot configuration.
- Ollama is a separate runtime. Supabase cannot run the local model on its own.

## 6. Company records and facility operational checks

These are internal authenticated APIs, not third-party measured feeds:

- POST /api/company/emissions: owner/analyst submits facility, metric, value, unit, period, basis, quality and source reference. Provenance is forced to company_reported.
- POST /api/monitoring/rules: Government Oversight supplies an applicable operational threshold, metric, unit, duration, data age, basis and policy/permit reference.
- PATCH /api/monitoring/rules/:id: government pauses/enables the rule.
- GET /api/monitoring: scoped rules/assessments, alert history, source state and the current user's inbox.
- PATCH /api/notifications/:id/read: current user marks its own notice read.
- POST /api/monitoring/watch: company owner chooses metro advisory subscriptions.
- POST /api/monitoring/alerts/:id/explain: optional local AI explanation of an authorised alert.

GHG totals use tCO2e over the reporting period. Stack PM/SO₂/NOx/CO use mg/Nm3 and the declared gas basis. There is no universal factory limit prefilled. All comparison dimensions must match. Invalid/stale/missing observations remain unassessed and do not clear an existing exceedance. Repeated exceedances update the ongoing alert without repeated notification spam.

Notifications are currently in-app only. No external government licence or email is changed by these APIs. Real continuous OCEMS/CEMS feeds remain unconnected.

## 7. Refresh, caching and public projection

GET /api/public/india returns city context only, without company private observations or inboxes. Eight metros: Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad. Public coordinates are listed in server/india.mjs.

The Node server checks persistent due times; metro provider polling defaults to 30 minutes, with two cities processed concurrently. The browser reads cached results every 30 seconds. UI refresh does not promise a new independent provider measurement. Last-good data, update times and failures are retained. Server availability is required.

## 8. Demo inventory and simulation boundaries

- Example workspace: Riverbend Example Company, invented report statements, history, facility and review records created through the labelled demo flow.
- Existing synthetic browser checks may include a one-hour GHG operational rule and a reported observation. Both references explicitly identify synthetic testing.
- src/data/integrations.ts exports demoVerification (demo-verification-v1): public Hyderabad coordinates, invented demo manufacturing facility, PM₂.₅ 42 µg/m³, stack particulate matter 65 mg/Nm³, illustrative threshold 50 mg/Nm³ over 60 minutes, NDVI 0.52→0.36.
- The emissions slider ranges from 0–100 mg/Nm³, with 30/75 preset examples. It changes local React state only.
- The orbit, scan beam, map pattern and particles are illustrations. Playback replays a stored snapshot; it does not execute APIs.
- No simulator value enters emission_samples, monitoring_alerts, the public company summary or an email.
- Selecting Provider data restores the actual stored result view. Missing source values remain missing.

## 9. Legacy n8n sources

The recording/export used ISS position (https://api.wheretheiss.at), Open-Meteo AQ and Open-Meteo weather. Old node names suggested satellite, emission history and energy usage, but the endpoints do not establish those measurements. OpenAI/Gmail credential references were found; no reusable plaintext secret was recovered.

The workflow was not executed, the lost n8n workspace was not contacted, and recipients from the old export were not reused. Gmail delivery is not part of the current app. See credential-audit.md and VIDEO_REVIEW.md.
