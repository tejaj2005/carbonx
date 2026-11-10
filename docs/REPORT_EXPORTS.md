# Role based report exports

Government Oversight:

- Overview / Companies → Export overall status: all companies available to the signed-in authority.
- Open a company → Export company report: its licence, reports, source-linked findings, submission decisions, historical usage, facility observations, rules, cases, alerts, reviewer decisions and recommended actions.
- Company reports → Download source report: original uploaded file.
- Company reports → Export findings: only the selected uploaded report.

Company owner, analyst and reviewer:

- Submissions → Export company report: own-company status and records.
- Reports → open a report → Export findings: the selected report.
- Existing CSV/PDF findings downloads remain available.
- Suspended/revoked companies retain read/export access; new submissions remain paused.

Formats:

- Word (.docx): editable template with summary and licence tables, report inventory, source-linked finding tables and relevant record sections. Repeated table headers and page numbers support printing.
- Excel (.xlsx): summary first, separate labelled sheets for record types, filters, frozen headers/identity column, typed numbers, explicit units and periods, status formatting. Trace IDs are retained in hidden columns. Source strings are literal text, never executable formula objects.
- PDF: paginated printable record snapshot.
- CSV: long-form section/company/record/field/value data for complete status reports; selected report findings retain their existing column format. Formula-leading cells are neutralized.
- JSON: structured snapshot for technical use.

All exports identify generation time and source limitations. Historic records and archived report inventory are included and labelled. Missing readings are not zero. Measurements across incompatible units, facilities and periods are never summed. Regional city pollution is not attributed to a factory. Government approval, evidence support and company reviewer decisions remain separate.

Exports require an authenticated session. Company IDs supplied in query parameters cannot change own-company scope. Demo government accounts are limited to their assigned synthetic company. Files contain no password hashes, sessions, provider keys, account directory or upload storage paths. Export activity is recorded in the audit log.

Generation is server-side using local libraries; no document or spreadsheet SaaS account is needed. See server/office-exports.mjs for Word/Excel templates and server/status-exports.mjs for the shared status snapshot.
