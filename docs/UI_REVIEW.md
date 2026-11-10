# UI and presentation review

Reviewed locally on 10 November 2026. This records observed checks and limits; it is not a claim that every possible interaction, credential flow or production deployment has been certified.

## Changes

- Reduced the company sidebar from 12 choices to six sections; government sidebar from seven choices to four. Related views use section links. Existing deep links remain valid and activate their owning section.
- Added a visual verification studio: coordinates → atmospheric context → dated satellite imagery → emissions comparison → human review.
- Added provider-snapshot playback, scan/orbit effects and a separate clearly labelled synthetic emissions simulation. The slider and presets do not call APIs, create database records, notify users or send email.
- Added an eight-city pollutant comparison and a visible API/source feature catalogue.
- Added a facility readings/threshold overview with independent per-row ratios, units, time windows and unassessed counts. Different pollutants and units are not summed.
- Improved contrast, text size, card spacing, mobile navigation and narrow-screen data layouts.
- Fixed the historical-chart selector forcing mobile page width to 548px; the corrected view is 375px in a 375px viewport.
- Fixed evidence answer citations navigating away from the app; citation buttons scroll to the source passage.
- Reset page scroll when navigating between views so the previous page's position does not open the next view in its middle.
- Added a recoverable render-error screen with working reload and public-observatory navigation.
- Removed role-inappropriate upload/facility entry points, restricted evaluation controls and replaced an unavailable AI action-plan button with a working setup link. Alert AI-explanation actions are absent when no model is configured.
- Assigned unique SVG gradient/clip IDs so multiple satellite illustrations cannot share conflicting definitions.

## Route/layout inspection

Company: overview, reports, claims, evidence, history, environment, monitoring, submissions, recommendations, evaluations, audit, settings.

Government: government overview, registry, users, submissions, actions, audit and monitoring.

Public: transparency, India observatory, government sign-in and company sign-in.

All 23 routes were inspected on the narrow viewport. Company/government desktop views and the public observatory were also inspected at 1366×900. The history defect was corrected and rechecked. Final inspected narrow views had document width equal to viewport width; data tables retain their own horizontal scroll areas when needed.

The mobile sidebar opened, exposed all six main company sections and navigated to a selected section. Government section links activated their intended views. Public/login pages remained readable without page-width overflow.

## Working interactions observed

- City selector changed both coordinates and actual cached provider concentration.
- PM₂.₅/PM₁₀ comparison selector changed displayed values and bar proportions.
- Source catalogue disclosure expanded to show features, connection requirements, limitations and official links.
- Verification playback advanced to the review stage and stopped.
- Scan effect pause/play changed the illustration state.
- Demo emissions presets and slider changed the value, threshold feedback and next-step preview; keyboard End reached 100 mg/Nm³.
- Government threshold configuration opened with scoped company/facility and the required unit/basis/reference controls.
- Report-upload and historical-observation dialogs opened and closed correctly; no real credentials were changed during browser QA.
- The unavailable action-plan control opened the actual AI setup view. No unconfigured alert-explanation button remained.
- Evidence search returned a real stored passage from the synthetic report, with an original-source link.
- Actual site atmosphere and satellite buttons queued backend jobs and displayed the completed results.

## Provider results in this review

A real request used the public Hyderabad coordinates on the labelled synthetic facility. Open-Meteo weather and AQ returned available results. The visual studio updated from missing data to the actual stored response.

A real Sentinel-2 comparison completed: January 7, 2025 and January 7, 2026; NDVI approximately 0.373→0.309; NDWI approximately -0.428→-0.466. The UI showed scene dates, metadata links, thumbnails and clear-pixel coverage. These dated values are contextual, not real-time factory emissions.

Live metropolitan readings remain provider models. Official station summaries still require the personal data.gov.in key. Local AI inference and continuous factory telemetry remain unconfigured.

## Automated checks and deployment boundary

The existing complete backend suite passed 53 checks with zero failures during this review. TypeScript checks and the final production build passed. Formatting and Git patch checks are recorded at commit time.

No backend/database migration, email integration, n8n recovery or public deployment was performed. The local server remains usable without ChatGPT while running. Supabase planning, free-tier limits, required secure configuration and later email work are documented in BACKEND_REQUIREMENTS.md.

API_AND_DATA_SOURCES.md records the implementation, provenance, refresh behaviour and demo constants. TECH_STACK.md records the deployed/local technologies and separate runtime responsibilities. VIDEO_REVIEW.md records what the supplied clip actually shows.
