# Verification record

Performed locally on 10 November 2026. These are implementation checks, not a production assurance, model-quality benchmark or reproduction of the reference deck's results.

## Automated checks

- npm test: 26 checks passed, zero failures.
- npm run build: TypeScript checking and Vite production build passed.
- Production frontend is split into route and chart chunks; no oversized-chunk warning in the final build.
- npm audit --omit=dev: zero reported vulnerabilities at the time checked. Advisory databases change over time.

Coverage includes actual stored report processing, source quote/page references, physical-page PDF parsing, company isolation, CSRF/origin checks, analyst/reviewer restrictions, recorded review decisions, atomic CSV import and duplicate handling, CSV/PDF/JSON exports, password verification and other-session revocation, held-out evaluation calculations, metric and unit separation, missing/ambiguous baselines, percentage tolerances, provider failures, cloud masking, approved imagery URLs and model quote validation.

A browser-observed defect was fixed: GET requests for stored environmental results no longer consume the new-provider-job rate limit. Background polling now reads job status and refreshes the workspace when jobs finish. A regression check confirms repeated reads remain available while new jobs are limited with a JSON 429 response.

## Local application and browser

- Windows launcher installed/built as needed, started a detached CarbonX process and printed the HTTP URL.
- GET http://127.0.0.1:8765/api/health returned HTTP 200 with app carbonx and database ready.
- The production application was exercised through the browser.
- Synthetic example creation ran the actual ingestion pipeline and persisted one report, two source sections, five claims and four historical observations.
- Claim source and historical comparison views showed the recorded quotation, baseline 1,000 m3, current 800 m3 and computed 20% decrease.
- Lexical evidence search returned the relevant report passage.
- Report upload controls and report detail/source controls were inspected.
- History rendered the scoped line chart; settings exposed actual provider configuration and account controls; evaluation showed no fabricated benchmark values.
- Desktop layout was inspected at 1366 by 900. Narrow layout was inspected at the browser's default approximately 397 by 604 viewport, including navigation, cards and environmental views. No document-level horizontal overflow was observed in the inspected views.
- The temporary viewport override was reset and the user-facing Overview tab was retained.
- After the polling fix and owned-server restart, the application reloaded successfully and restored its stored session and findings.

## Public provider requests

Live requests were made for public Hyderabad-area coordinates (17.385, 78.4867) assigned only to a synthetic example facility. These checks do not establish facts about a real company.

- Open-Meteo weather and air quality both returned available results.
- Earth Search selected Sentinel-2 L2A scenes for January 2025 and January 2026.
- COG reads computed NDVI/NDWI over the intended local 1 km window with masked clear pixels.
- Earlier scene: S2B_43QHV_20250107_0_L2A; mean NDVI approximately 0.373, NDWI approximately -0.428; clear sample approximately 73.5%.
- Later scene: S2C_43QHV_20260107_0_L2A; mean NDVI approximately 0.309, NDWI approximately -0.466; clear sample approximately 52.3%.
- The browser's real API job stored the comparison and displayed both loaded scene thumbnails, dates, coverage and contextual limitations.
- No call was made to the old n8n Cloud workspace.

These provider responses are time-, location- and availability-dependent. Future requests can differ or fail; the UI stores availability and does not substitute invented measurements.

## Local OCR

A generated image-only PDF was processed through the actual local Tesseract OCR path. The expected water-consumption sentence was recognised, usedOCR was true and the page did not remain flagged as requiring OCR. This verifies the local English OCR path on that fixture, not arbitrary report OCR accuracy.

OCR was disabled in the automated test configuration to keep CI deterministic and avoid a language-model download during tests. The manual check used an isolated ignored local cache.

## Legacy credential investigation

The separate credential-audit document records ZIP-to-Git equality, all eight reachable commits, text/signature inspection and media sampling. No usable provider secret was recovered. Credential references are not authentication material. Neither the old workflow nor its email nodes were executed.

## Not live-verified

- Hosted OpenAI extraction, embeddings, grounded answering and action-plan generation: implemented but not exercised against a provider because no new key/model configuration was supplied.
- Hosted-model generalisation, RAG answer faithfulness or achieved research F1/recall: not measured.
- A real-company evaluation corpus, independent gold annotation or the reference deck's dataset totals: not supplied.
- Public production deployment, multi-instance scaling, enterprise SSO, account-recovery delivery, malware scanning and load/security testing: not completed by these local checks.
- Docker execution and GitHub Actions execution: configuration supplied; local automated commands passed.

For the remaining deployment and ingestion limits, see architecture.md and the root README.
