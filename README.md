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

## First use

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
| Claims and SDGs       | Source-quoted extraction, 17-goal reference, explicit processing mode, optional structured hosted model extraction             |
| Historical evidence   | Canonical units, metric/facility/year/boundary matching, CSV preview and atomic import, scoped year-over-year graphs           |
| Review                | Supported / needs review / insufficient evidence, reasons, comparison arithmetic, independent human decisions and activity log |
| Environmental context | Open-Meteo weather and air quality; Earth Search Sentinel-2 L2A imagery, selected-site NDVI and NDWI                           |
| Action plans          | Deterministic gap recommendations; optional cited hosted AI action planning; action status tracking                            |
| Evaluation            | Human gold labels, development/test split, measured precision/recall/F1, status confusion matrix and lexical Recall@5          |
| Export                | Protected CSV/PDF/JSON exports with the actual recorded findings and evidence                                                  |

A supported claim means consistency with the supplied historical evidence and implemented rules. It is not an independent assurance, fraud verdict, SDG certification or carbon-credit validation.

## Optional hosted AI

Copy .env.example to .env and configure these variables on the server:

```dotenv
ENABLE_HOSTED_AI=true
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Supply a fresh provider key and a model supporting Responses structured outputs. Restart the server. Keys are never entered in the browser or committed to Git.

Without this configuration, the application works using an explicitly labelled keyword extraction/mapping baseline and lexical retrieval. A failed hosted extraction records a warning and falls back to the baseline. Invalid source quotes are rejected. Configuration status alone is not proof of a successful model request.

Hosted processing sends extracted report passages and selected report metadata to the configured provider. Public environmental requests send the selected facility coordinates/date windows to their named providers. Review provider terms and your organisation's data policy for the intended deployment.

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
