import PDFDocument from 'pdfkit';
import { csvCell } from './domain.mjs';
export function exportRows(store, company, reportId) {
  return store.q(
    'SELECT c.*,r.name report_name,p.number page_number FROM claims c JOIN reports r ON r.id=c.report_id JOIN chunks k ON k.id=c.chunk_id JOIN pages p ON p.id=k.page_id WHERE c.company_id=?' +
      (reportId ? ' AND c.report_id=?' : '') +
      ' ORDER BY r.created_at DESC,p.number',
    ...[company, ...(reportId ? [reportId] : [])],
  );
}
export function csvExport(rows) {
  const keys = [
    'report_name',
    'page_number',
    'text',
    'metric',
    'value',
    'unit',
    'year',
    'baseline_year',
    'boundary',
    'claimed_change',
    'status',
    'review_state',
    'method',
  ];
  return [
    keys.map(csvCell).join(','),
    ...rows.map((row) => keys.map((k) => csvCell(row[k])).join(',')),
  ].join('\r\n');
}
export function writePdf(res, rows, companyName, isExample) {
  const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true });
  res.type('application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="carbonx-review.pdf"');
  doc.pipe(res);
  doc.fontSize(22).fillColor('#133f34').text('CarbonX evidence review');
  doc.moveDown(0.4);
  doc
    .fontSize(10)
    .fillColor('#52675c')
    .text(companyName + ' | ' + new Date().toISOString().slice(0, 10));
  if (isExample) doc.text('EXAMPLE WORKSPACE - Synthetic source data');
  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor('#223e31')
    .text(
      'Statuses describe consistency with recorded evidence. They are review aids and do not constitute independent assurance, certification or fraud findings.',
    );
  doc.moveDown();
  if (!rows.length) doc.text('No claims have been processed in this workspace.');
  for (const row of rows) {
    if (doc.y > 650) doc.addPage();
    doc
      .fontSize(12)
      .fillColor('#133f34')
      .text(row.report_name + ' - Source ' + row.page_number);
    doc.fontSize(10).fillColor('#243c30').text(row.text);
    doc.moveDown(0.4);
    doc
      .fontSize(9)
      .text(
        'Status: ' +
          row.status.replaceAll('_', ' ') +
          ' | Review: ' +
          row.review_state.replaceAll('_', ' '),
      );
    doc.text('Mapped SDGs: ' + JSON.parse(row.sdgs_json).join(', ') + ' | Method: ' + row.method);
    doc.text(
      'Scope: ' +
        (row.boundary || 'Missing') +
        ' | Year: ' +
        (row.year || 'Missing') +
        ' | Baseline: ' +
        (row.baseline_year || 'Missing'),
    );
    for (const reason of JSON.parse(row.reason_json)) doc.text(reason);
    const comparison = JSON.parse(row.comparison_json);
    if (comparison.computedChange !== undefined)
      doc.text(
        'Reported change: ' +
          comparison.claimedChange +
          '%; computed change: ' +
          comparison.computedChange.toFixed(2) +
          '%; difference: ' +
          comparison.differencePercentagePoints.toFixed(2) +
          ' percentage points.',
      );
    doc.moveDown(1.1);
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#6b7a70')
      .text('CarbonX | ' + (i + 1) + ' / ' + range.count, 46, 790, { lineBreak: false });
  }
  doc.end();
}
