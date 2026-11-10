# Demo and reference data

Edit data/demo-data.json in VS Code for the invented Riverbend workspace: site coordinates, annual historical observations, report passages, submission and expected verification outcomes. The labelled demo endpoint reads this file. Restart the server and create a new example workspace to use changes; existing records are deliberately preserved.

The water claim is supported by its synthetic baseline. This is an evidence assessment, not government approval. The submission starts as submitted; a Government Oversight reviewer can review/accept it explicitly during a demo. No real company is given a fabricated approval.

Edit data/reference-data.json for published reference benchmarks shown in Settings → India reference data. Each record keeps organization, exact period, boundary, metric, unit, source URL/location and verification limitations.

Selected official sources, checked 10 November 2026:

- Infosys ESG Report 2023–24, ESG highlights (printed page 04): 67.5% renewable electricity for India operations. Official PDF: https://www.infosys.com/sustainability/documents/infosys-esg-report-2023-24.pdf. The indexed official report highlight was checked; downloading the full PDF through the browser tool exceeded its size limit.
- Infosys ESG Report 2024–25, ESG highlights: 77.7% renewable electricity for India operations. https://www.infosys.com/about/esg/reports/2024-25.html, also https://www.infosys.com/investors/reports-filings/annual-report/annual/documents/2024-25/delivering-value.pdf.

The two electricity-share values differ by 10.2 percentage points. They are company-reported historical benchmarks, not live factory readings or evidence of a corresponding emissions reduction. They are not inserted into Riverbend observations, emissions alerts, licence records or approval decisions. A company-wide India boundary must never be assigned to the Hyderabad sample point.

src/data/integrations.ts retains an unused synthetic simulation fixture for reusable components. The main simplified interface does not mount that simulator. Active demo records come from data/demo-data.json.

No changes to existing records or approvals are applied by updating these files. No data from the lost n8n workspace is contacted.
