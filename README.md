# CarbonX

Sustainability report intelligence with source citations, SDG mapping, historical comparison and human review.

CarbonX is a React/TypeScript application with an Express API and persistent SQLite storage. It replaces the earlier static presentation and does not depend on n8n. The old n8n Cloud workspace is not contacted or recovered.

## Run on Windows

Install Node.js 24 LTS, then double-click **Open CarbonX.cmd** in this folder. The launcher installs locked dependencies when missing, builds the application, starts the local server and opens:

http://127.0.0.1:8765/

The launcher leaves its server running after the command window closes. Opening the launcher again reuses a healthy CarbonX server. Logs and the process ID are in .local/server.log and .local/server.pid.

Do not open index.html directly with file://. It is the application build entry, and the API requires the running server. The old Open CarbonX Prototype.cmd is an alias for the new launcher.

For terminal development:

```powershell
cd C:\Users\TTEJA\Downloads\Desktop\CarbonX\carbonx
npm.cmd ci
npm.cmd run dev
```

For a production build on your machine:

```powershell
npm.cmd run build
npm.cmd start
```

Node.js 22.13 or newer is required. Node.js 24 LTS is recommended. The server prints its URL. Check /api/health if the browser cannot connect. A different application occupying port 8765 produces a startup error; CarbonX does not terminate other processes.

## Public, company and government portals

The default page is the anonymous public transparency register. Separate sign-in pages serve company users and Government Oversight administrators. Public summaries refresh every 30 seconds; annual usage is not presented as continuous meter telemetry.

Company owners control publication of reported usage and optional stored environmental summaries. Private reports, account details, internal review notes and exact site coordinates stay outside the public projection. Government administrators review submissions, manage licence records and cases, create company users and disable/restore access. Suspended or revoked CarbonX licences pause company changes while preserving read access.

For a project review, use the labelled demo buttons. The banner can switch between government and company perspectives within the same synthetic company, preserving its submissions and decisions. Real accounts cannot use demo role switching. The walkthrough includes floating evidence cards, a controllable satellite illustration and an air-quality simulation. Simulated values do not become stored observations.

Create a real government administrator from the project terminal with npm.cmd run admin:create. The interactive password prompt is hidden. Government privilege cannot be requested through company registration. Disable demos with ALLOW_DEMO=false for normal deployment.

See [the project-review walkthrough](docs/project-review.md) for the presentation sequence and administrator setup.

## First use

- Open the public page, then select Company portal or Government login for protected work.
- Create a company workspace with your own email and a password of at least 12 characters. Each company starts empty.
- Alternatively select **Open an example workspace** for a synthetic, isolated presentation workspace. This creates stored sample reports and observations and runs the actual processing pipeline. The example banner stays visible.
- Upload a PDF or UTF-8 text report. Record its year, facility scope and reporting boundary.
- Inspect extracted claims and their source passages. Add historical observations or preview and confirm a CSV import.
- Open a claim to inspect units, baseline and current year, comparison reasoning and source citations. Correct extraction fields when necessary and record a reviewer decision.
- Add a facility and explicitly load regional weather/air quality or compare Sentinel-2 observation windows.
- Export current findings as CSV, PDF or an evidence JSON package.

No real company reports, production credentials, pre-claimed benchmark results or copied hackathon findings are seeded.

## Capabilities

| Area                  | Implemented behaviour                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Workspaces            | Company registration, session login, owner/reviewer/analyst roles, team creation, password changes and company-scoped access   |
| Ingestion             | PDF text and tables, physical page references, local English OCR for scanned pages, UTF-8 text and versioned reprocessing      |
| Retrieval             | 500-token passages with 80-token overlap; lexical search; optional persisted embeddings and hybrid retrieval                   |
| Claims and SDGs       | Source-quoted extraction, 17-goal reference, explicit processing mode, optional structured local AI extraction                 |
| Historical evidence   | Canonical units, metric/facility/year/boundary matching, CSV preview and atomic import, scoped year-over-year graphs           |
| Review                | Supported / needs review / insufficient evidence, reasons, comparison arithmetic, independent human decisions and activity log |
| Environmental context | Open-Meteo weather and air quality; Earth Search Sentinel-2 L2A imagery, selected-site NDVI and NDWI                           |
| Action plans          | Deterministic gap recommendations; optional cited local AI action planning; action status tracking                             |
| Evaluation            | Human gold labels, development/test split, measured precision/recall/F1, status confusion matrix and lexical Recall@5          |
| Export                | Protected CSV/PDF/JSON exports with the actual recorded findings and evidence                                                  |

A supported claim means consistency with the supplied historical evidence and implemented rules. It is not an independent assurance, fraud verdict, SDG certification or carbon-credit validation.

## Grok AI setup

The default AI provider is Grok/xAI. The ignored .env file is prepared: add XAI_API_KEY and optionally DATA_GOV_IN_API_KEY, then restart CarbonX. The public weather, modelled air-quality and Sentinel-2 endpoints are already configured without keys. No local AI model is required.

Grok supports structured report extraction, cited evidence answers, action plans and alert explanations. It uses your xAI API credits/billing and sends selected report evidence to xAI when requested. Evidence retrieval remains lexical; no Grok embedding service is assumed. Missing credentials keep the labelled baseline active.

Run npm.cmd run integrations:check for connection statuses. Add -- --ai only for an explicit small synthetic inference test. No live Grok inference has been verified while the key is blank.

See [simple environment setup](docs/ENV_SETUP.md). Supabase migration and email remain separate later work. Optional legacy providers are not selected by the default configuration.

## India metropolitan monitoring

Open http://127.0.0.1:8765/#india for Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Pune and Ahmedabad. The server polls real Open-Meteo/CAMS model outputs and weather every 30 minutes, persists the last good response and exposes timestamps, provider errors and stale states. The display reads the cache every 30 seconds.

India atmospheric values are regional model estimates at approximately 45 km resolution, with 3-hour native output and 12-hour model updates. They are not local live sensors. Completed 24-hour model means can generate regional advisories; they cannot attribute a company's emissions or establish a legal breach.

A CPCB/data.gov.in station-summary adapter is implemented. Add a free personal DATA_GOV_IN_API_KEY in .env and restart to validate live access. No key was supplied, so measured station readings are not claimed. Units and averaging periods remain unknown unless supplied by the provider; no compliance comparison is made from unknown metadata.

Government Oversight can configure facility-specific operational thresholds with a unit, reporting window, maximum age, measurement basis and reference. Company users can submit observed emissions periods. Matching valid observations produce durable, deduplicated in-app notifications for the company and authorised government users. Missing, stale or mismatched evidence is not assessed. There is no automatic licence suspension.

Continuous industrial OCEMS/CEMS data is not connected. Current factory observations are company-reported, not independently measured telemetry. Email and SMS delivery are not configured. Background work requires the server to remain running.

Open-Meteo's free endpoint is for non-commercial use under its provider terms. The presentation/research pilot uses that endpoint; commercial deployment requires a separate terms review. See [India integrations and production readiness](docs/production-readiness.md) for verified capabilities and remaining inputs.

## Configuration

See [.env.example](.env.example). Main options:

| Variable           | Default          | Purpose                                                 |
| ------------------ | ---------------- | ------------------------------------------------------- |
| HOST / PORT        | 127.0.0.1 / 8765 | Local listener                                          |
| DATA_DIR           | .data            | SQLite, original reports and local OCR cache            |
| COOKIE_SECURE      | false            | Set true behind HTTPS                                   |
| TRUST_PROXY        | unset            | Set true only behind a trusted reverse proxy            |
| ALLOW_REGISTRATION | true             | Allow new company accounts                              |
| ALLOW_DEMO         | true             | Allow synthetic example workspaces                      |
| MAX_UPLOAD_MB      | 25               | Upload size limit                                       |
| ENABLE_OCR         | true             | Local English OCR; downloads language data on first use |
| OCR_LANG_PATH      | unset            | Optional trusted local Tesseract language-data location |

PDF ingestion is bounded to 500 pages; OCR is bounded to 20 scanned pages per processing job. Pages still requiring OCR are flagged. Complex layouts, charts, handwriting and other languages can require manual correction. OCR does not silently invent missing content.

## Storage, backup and deployment

All application data remains in DATA_DIR, separate from source control. Back up the complete directory consistently, including SQLite WAL state when active; a stopped-server backup is the simplest local procedure. Original reports may contain sensitive information. Apply appropriate disk permissions, encrypted storage and backup controls.

A Dockerfile is included for a Node.js 24 container with a persistent /app/.data volume. Bind the volume writable by the container's node user. HTTPS, trusted reverse proxy configuration, backups, operational monitoring and an account recovery process are deployment responsibilities. The application has not been deployed to a public production host.

The in-process job queue is suitable for a single application instance. Interrupted jobs are marked at startup and reports can be reprocessed. Multiple replicas, durable distributed jobs, enterprise SSO, email reset delivery, malware scanning and formal assurance controls require further deployment engineering.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd audit
```

The CI workflow repeats tests and the production build on Node.js 24. See [validation](docs/validation.md) for the checks actually performed, [architecture](docs/architecture.md) for implementation boundaries, and the [credential audit](docs/credential-audit.md) for the legacy repository investigation.

## Legacy API audit

No reusable API key was found in the supplied ZIP, its reachable public Git history or inspected media. The OpenAI and Gmail exports contain n8n credential references only.

The three HTTP integrations were ISS orbital position, Open-Meteo air quality and Open-Meteo weather. ISS position is not site satellite imagery; weather is not measured company energy use. CarbonX uses an actual Sentinel-2 imagery implementation for site context and requires historical company records for numerical comparisons.

## Presentation, data and backend reference

The simplified interface groups related views into six company sections and four government sections. Main views show city readings, emissions summaries, reports, alerts and site data. Presentation walkthroughs and simulations are not displayed. Existing view links remain usable.

- [API features, data origins and demo inventory](docs/API_AND_DATA_SOURCES.md)
- [Technology stack and runtime responsibilities](docs/TECH_STACK.md)
- [Hackathon video analysis and interpretation](docs/VIDEO_REVIEW.md)
- [Supabase deployment proposal and required inputs](docs/BACKEND_REQUIREMENTS.md)

The UI simulation does not create monitoring observations or send email. Backend migration and government email are later implementation stages.

The [UI review record](docs/UI_REVIEW.md) lists route, control, mobile and provider checks performed for the presentation cleanup.
