# Verification record

Performed locally on 10 November 2026. These are implementation checks, not a production assurance, model-quality benchmark or reproduction of the reference deck's results.

## Automated checks

- npm test: 53 checks passed, zero failures.
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

- Free local Ollama extraction, embeddings, grounded answering, action plans and explanations: adapter contracts tested; no running local service/model inference was verified. Legacy paid AI remains disabled by default.
- Hosted-model generalisation, RAG answer faithfulness or achieved research F1/recall: not measured.
- A real-company evaluation corpus, independent gold annotation or the reference deck's dataset totals: not supplied.
- Public production deployment, multi-instance scaling, enterprise SSO, account-recovery delivery, malware scanning and load/security testing: not completed by these local checks.
- Docker execution and GitHub Actions execution: configuration supplied; local automated commands passed.

For the remaining deployment and ingestion limits, see architecture.md and the root README.

## Portal and presentation extension

The final automated suite passed 53 checks. New coverage verifies company registration cannot grant government access; anonymous public reads; separate government/company login enforcement; protected government routes; submission/review handoff; transactional licence actions; stale-status rejection; immediate suspension restrictions; opt-in publication and private-field exclusion; canonical reading units; company-user creation and disable/restore behaviour; revocation of government capability on existing sessions; exact-company government demo isolation; same-company demo role switching with rejection of real accounts; and provisioning without interrupting active jobs.

Browser verification used the running production build at 1366 by 900 and the default approximately 396 by 604 narrow viewport. It exercised the government overview, registry, protected evidence view, licence suspension and restoration, public licence status, follow-up decision, oversight case creation and user-creation form.

The same synthetic company was switched into its company perspective. Its government review note and case were visible. A synthetic usage reading and another claim were submitted; switching back showed the new claim in the government queue. The public company detail showed the published reading without its private source reference.

The animated walkthrough played and advanced through stages. Satellite scan animation could be started/paused. The air-quality simulation slider changed both the labelled invented concentration and the displayed particle count. These interactions did not issue provider requests or store simulation readings.

Mobile navigation, scrollable lower company links, responsive public/registry views and document widths were checked. No document-level horizontal overflow was observed in the inspected final views. The temporary viewport override was reset, no browser console errors were returned in the final check, and the public tab was retained.

Only synthetic presentation records were changed during UI checks. The demo licence was restored to Active. No external government licence, government service, n8n workspace or real company account was changed. A real production government administrator has not been provisioned; use the protected setup command.

The public page remains a local anonymous route. No internet-facing production deployment or continuous meter integration was completed by this extension.

## India monitoring and readiness audit

Final suite: 53 passed, zero failed. Production build, TypeScript checks and production dependency audit passed. npm audit --omit=dev reported zero known vulnerabilities at this check.

New coverage verifies eight-city model provenance; missing station credentials; IST provider timestamp conversion; complete 24-hour past-window coverage; no invented station units; provider failure retention; persistent due-time scheduling; company/facility/unit/basis/period/quality/age matching; government-only threshold configuration; forced company-reported provenance; durable deduplicated company and government notifications; notification read isolation; local Ollama request contracts and rejection of explicitly cloud-labelled models.

Additional regressions corrected combined percentage-plus-quantity assertions, Indian fiscal-year ending-year extraction, renewable shares over 100%, stale reviewer decisions after evidence changes, and recommendation provenance after deterministic refresh. Existing stored claims are revalidated at startup.

The running production server returned HTTP 200 with SQLite ready after its owned idle process was restarted. Actual Open-Meteo weather and CAMS global AQ requests succeeded for all eight metropolitan cities. The checked atmospheric output was valid at 13:30 IST on 10 November 2026 and fetched at approximately 14:01 IST. No station key was present, so all eight official station sources correctly remained not_configured. Neither continuous factory telemetry nor local AI inference was claimed.

Browser checks exercised the anonymous India observatory and Delhi detail, source/resolution labels, model-window coverage, missing-key state, company monitoring page, government threshold creation, company observation submission, notification read state and government inbox handoff. Threshold pause and re-enable both worked. A browser-observed defect was fixed: synthetic role switching now reuses each role's existing identity so its inbox survives switching back.

Only a synthetic demonstration facility was used for the threshold/observation UI test: 60 tCO2e against a synthetic 50 tCO2e one-hour policy. The company source and policy text explicitly identify the test. It is not a real company breach or a statutory threshold. No external notification or licence action was sent.

Responsive inspection covered desktop and 390 by 844 mobile override. The mobile India view had 375px document width and 375px viewport width, without horizontal overflow. The final updated build returned no new browser console errors in the checked interval. One earlier stale lazy-module error occurred when the old page remained open across a build; reloading loaded the current assets successfully.

The viewport override was reset. The India observatory tab remains open as the deliverable, and the local server remains running. The screenshot artifact is a visual check, not proof of independent sensor accuracy or production deployment.

See production-readiness.md for missing credentials/data and deployment requirements. Full production readiness is not claimed.

## Presentation cleanup follow-up

See [UI review](UI_REVIEW.md) for the 23-route desktop/mobile inspection, visual studio checks, real site-provider requests, observed mobile overflow and scroll-position fixes, and the 53-test regression run after navigation consolidation.

## Grok and environment integration

The complete suite passed 59 checks after adding xAI/Grok request, configuration, citation, error-redaction and authorised alert-explanation tests. Production build and TypeScript checks passed. Live keyless checks returned connected for Open-Meteo weather, atmospheric model output and the Earth Search Sentinel-2 collection. Official CPCB stations and Grok correctly reported key required. No live Grok inference or paid request was made. The ignored .env was created with blank secret fields; .env.example is the tracked template. The restarted HTTP server returned 200 and reported provider xai, configured false, eight cities and stationConfigured false. See ENV_SETUP.md for the two key fields and manual connection check.

## Groq / Copernicus / sourced reference update, 10 November 2026

- npm.cmd test: 68 tests passed, including provider credential routing, strict JSON validation/redaction, OAuth token sharing/refresh, coordinate search, UTM site statistics and coverage abstention.
- npm.cmd run build: TypeScript and Vite production build passed.
- npm.cmd run integrations:check: live weather, air-quality model and Earth Search catalogue connected. CPCB and Groq report key required; Copernicus is optional and not selected. No AI inference or authenticated Copernicus imagery was claimed.
- Active demo data moved to data/demo-data.json. Historical Infosys India electricity-share references added in data/reference-data.json with source URLs and explicit scope. No real company approval or facility monitoring record was fabricated.
