# Presentation demo data

The active presentation bundle is **data/demo-presentation.json**. It supplies four fictional companies in Hyderabad, Mumbai, Bengaluru and Delhi. Edit this file in VS Code to change the examples. The original extraction example remains in **data/demo-data.json**; official historical benchmarks stay separate in **data/reference-data.json**.

Each fresh sandbox includes:

- Four isolated example companies and representative city-centre coordinates. These are illustrative locations, not verified factory sites.
- Three reports per company, with downloadable source text, passage citations and deterministic evidence assessments.
- 22 annual observations per company across six metrics and FY2022–FY2025. Emissions deliberately have no FY2023 baseline, so that missing-evidence scenario remains visible.
- 18 monthly period totals per company for January–June 2026: water in kL, energy in MWh and greenhouse gases in tCO2e. A selectable chart retains one metric, unit and facility per series.
- Three facility thresholds per company and generated one-hour samples: greenhouse gas totals, stack particulate matter and nitrogen oxides. Thresholds are invented operational examples, not legal CPCB limits. Sample periods are anchored at seed time and expire honestly after seven days; there is no fake live sensor loop.
- Submitted, accepted, under-review, follow-up and rejected examples, open/closed cases, public notices, reviewer/analyst users and in-app notifications.
- Preconfigured reviewer decisions and an actual deterministic fixture consistency check. These labels and scores are synthetic, not independent human ground truth or measured AI accuracy.

The main company keeps the original report, plus two additional reports. Companion companies get the original and both additions. Existing user changes are preserved. Seeding is additive, transactional and versioned in demo_seeds; demo_members limits the government demo to its own four-company sandbox. A second demo cannot read or mutate the first demo's private records.

The public register is populated before anyone logs in. It displays one published example per fictional company name so repeated demo sessions do not create duplicate cards. Hiding examples removes them from the public list. Real companies still require explicit publication.

Existing example sessions receive missing presentation records on their next page reload. New demo logins get the full bundle immediately. Once seeded, refreshing does not reset reviews, read states or user edits. Restart after source edits; use a new demo workspace to inspect changed fixture values.

Bundled synthetic report originals are local, checksum-checked files. Real uploads continue to use private Supabase Storage when enabled. Reprocessing a bundled source uses the normal extraction pipeline and preserves its original bytes.

Live CPCB station samples, Open-Meteo model readings, EUMETSAT imagery and ISS coordinates continue to use their real providers and source timestamps. No fixture readings are inserted into the city caches, satellite feeds or real company accounts. Email remains disabled.

## Published reference benchmarks

Selected official sources, checked 10 November 2026:

- Infosys ESG Report 2023–24, ESG highlights (printed page 04): 67.5% renewable electricity for India operations. Official PDF: https://www.infosys.com/sustainability/documents/infosys-esg-report-2023-24.pdf. The indexed official report highlight was checked; downloading the full PDF through the browser tool exceeded its size limit.
- Infosys ESG Report 2024–25, ESG highlights: 77.7% renewable electricity for India operations. https://www.infosys.com/about/esg/reports/2024-25.html, also https://www.infosys.com/investors/reports-filings/annual-report/annual/documents/2024-25/delivering-value.pdf.

The two electricity-share values differ by 10.2 percentage points. They are company-reported historical benchmarks, not live factory readings or evidence of a corresponding emissions reduction. They are not inserted into Riverbend observations, emissions alerts, licence records or approval decisions. A company-wide India boundary must never be assigned to the Hyderabad sample point.

src/data/integrations.ts retains an unused synthetic simulation fixture for reusable components. The main simplified interface does not mount that simulator. Active demo records come from data/demo-data.json and data/demo-presentation.json.

Existing user decisions and publication preferences are preserved; only missing synthetic presentation records are added. No data from the lost n8n workspace is contacted.
