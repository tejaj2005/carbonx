import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  Footer,
  PageNumber,
  BorderStyle,
  TableLayoutType,
} from 'docx';
const label = (s) => s.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const text = (v) =>
  v == null || v === ''
    ? 'Not recorded'
    : typeof v === 'boolean'
      ? v
        ? 'Yes'
        : 'No'
      : Array.isArray(v)
        ? v.map(text).join('; ')
        : typeof v === 'object'
          ? Object.entries(v)
              .map(([k, x]) => label(k) + ': ' + text(x))
              .join('; ')
          : String(v);
const names = {
  companies: 'Company status',
  reports: 'Reports',
  claims: 'Report findings',
  submissions: 'Submitted claims',
  actions: 'Government actions',
  observations: 'Historical usage',
  readings: 'Usage readings',
  samples: 'Emissions observations',
  rules: 'Monitoring thresholds',
  alerts: 'Recorded alerts',
  reviews: 'Review history',
  recommendations: 'Recommended actions',
};
const columns = {
  companies: [
    'name',
    'licence_status',
    'active_reports',
    'pending_submissions',
    'open_cases',
    'open_alerts',
  ],
  reports: ['name', 'year', 'status', 'archived'],
  claims: ['report_name', 'page_number', 'text', 'status', 'review_state'],
  submissions: ['year', 'text', 'status', 'review_note'],
  actions: ['type', 'note', 'status', 'updated_at'],
  observations: ['facility_name', 'metric', 'year', 'value', 'unit', 'source'],
  readings: ['metric', 'value', 'unit', 'recorded_at', 'source'],
  samples: [
    'facility_name',
    'metric',
    'value',
    'unit',
    'period_start',
    'period_end',
    'source_reference',
  ],
  rules: ['facility_name', 'metric', 'threshold', 'unit', 'window_minutes', 'source_reference'],
  alerts: ['title', 'message', 'status', 'updated_at'],
  reviews: ['decision', 'rationale', 'created_at'],
  recommendations: ['title', 'action', 'priority', 'status'],
};
export function officeSections(report) {
  const groups = [];
  const summary = [];
  for (const [k, v] of Object.entries(report.summary || {})) {
    if (v && typeof v === 'object')
      for (const [sub, n] of Object.entries(v))
        summary.push({ measure: label(k) + ' / ' + label(sub), value: n });
    else summary.push({ measure: label(k), value: v });
  }
  groups.push({ key: 'summary', title: 'Summary', rows: summary, columns: ['measure', 'value'] });
  if (report.company)
    groups.push({
      key: 'licence',
      title: 'Company and licence',
      rows: Object.entries({ ...report.company, ...(report.registry || {}) })
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => ({ field: label(k), value: v })),
      columns: ['field', 'value'],
    });
  for (const key of Object.keys(names))
    if (report[key])
      groups.push({ key, title: names[key], rows: report[key], columns: columns[key] });
  return groups;
}
const palette = { dark: '174F3E', light: 'EDF4EF', muted: '52675C', line: 'DCE5DF' };
export async function wordReport(report) {
  const p = (value, options = {}) =>
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: text(value),
          size:
            options.style === 'Title'
              ? 36
              : options.heading === HeadingLevel.HEADING_1
                ? 28
                : options.heading === HeadingLevel.HEADING_2
                  ? 24
                  : 22,
          font: 'Arial',
          color: '000000',
        }),
      ],
      ...options,
    });
  const heading = (value) =>
    p(value, {
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      spacing: { before: 240, after: 120 },
    });
  const cell = (value, width, header = false) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 110, bottom: 110, left: 120, right: 120 },
      shading: header ? { fill: 'EEF0F2' } : undefined,
      children: [
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({
              text: text(value),
              font: 'Arial',
              size: 20,
              color: '000000',
              bold: header,
            }),
          ],
        }),
      ],
    });
  function table(rows, keys) {
    const sizes = {
      field: 1.25,
      detail: 3.5,
      measure: 3,
      value: 1,
      name: 2.5,
      licence_status: 1.4,
      active_reports: 0.9,
      pending_submissions: 1.1,
      open_cases: 0.9,
      open_alerts: 0.9,
      facility_name: 2.5,
      metric: 2.7,
      year: 1,
      value: 1,
      unit: 0.9,
      source: 2.7,
    };
    const weights = keys.map(
      (k) =>
        sizes[k] ||
        ([
          'text',
          'note',
          'action',
          'rationale',
          'message',
          'review_note',
          'source_reference',
          'report_name',
          'title',
        ].includes(k)
          ? 3
          : 1.4),
    );
    const total = weights.reduce((a, b) => a + b, 0),
      widths = weights.map((w) => Math.floor((w / total) * 9360));
    widths[widths.length - 1] += 9360 - widths.reduce((a, b) => a + b, 0);
    const header = new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: keys.map((k, i) =>
        cell(
          {
            pending_submissions: 'Pending',
            active_reports: 'Reports',
            open_cases: 'Open cases',
            open_alerts: 'Alerts',
            licence_status: 'Licence',
            facility_name: 'Facility',
            source_reference: 'Source',
            window_minutes: 'Window min',
          }[k] || label(k),
          widths[i],
          true,
        ),
      ),
    });
    return new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      borders: Object.fromEntries(
        ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].map((k) => [
          k,
          { style: BorderStyle.SINGLE, size: 4, color: 'D8DEE3' },
        ]),
      ),
      rows: [
        header,
        ...rows.map(
          (r) =>
            new TableRow({
              cantSplit: true,
              children: keys.map((k, i) =>
                cell(
                  ['status', 'licence_status', 'metric', 'review_state', 'decision'].includes(k) &&
                    r[k] != null
                    ? label(String(r[k]))
                    : r[k],
                  widths[i],
                ),
              ),
            }),
        ),
      ],
    });
  }
  const body = [
    p(report.title.replace(/[^A-Za-z0-9 ]/g, ''), { style: 'Title' }),
    p(report.company?.name || report.audience),
    p(
      'Generated ' +
        new Date(report.generatedAt).toISOString().replace('T', ' ').slice(0, 16) +
        ' UTC',
    ),
    p(report.notice),
  ];
  if (report.company?.is_example) body.push(p('Synthetic demonstration company'));
  const empty = [];
  for (const group of officeSections(report)) {
    if (!group.rows.length) {
      empty.push(group.title);
      continue;
    }
    body.push(heading(group.title));
    if (['samples', 'rules', 'readings', 'alerts'].includes(group.key)) {
      for (const [index, row] of group.rows.entries()) {
        body.push(
          p(group.title + ' ' + (index + 1), { heading: HeadingLevel.HEADING_2, keepNext: true }),
        );
        body.push(
          table(
            Object.entries(row)
              .filter(([key]) => key !== 'id' && !key.endsWith('_id'))
              .map(([key, value]) => ({ field: label(key), detail: value })),
            ['field', 'detail'],
          ),
        );
      }
    } else if (group.key === 'claims') {
      for (const [i, row] of group.rows.entries()) {
        body.push(p('Finding ' + (i + 1), { heading: HeadingLevel.HEADING_2, keepNext: true }));
        body.push(
          table(
            [
              { field: 'Statement', detail: row.text },
              {
                field: 'Source',
                detail:
                  (row.report_name || 'Report') + ' / page ' + (row.page_number || 'not recorded'),
              },
              { field: 'Evidence status', detail: label(row.status || 'not assessed') },
              { field: 'Human review', detail: label(row.review_state || 'unreviewed') },
              {
                field: 'Metric and period',
                detail: [
                  row.metric,
                  row.value,
                  row.unit,
                  row.year ? 'FY' + row.year : null,
                  row.baseline_year ? 'Baseline FY' + row.baseline_year : null,
                ]
                  .filter((v) => v != null)
                  .map(text)
                  .join(' / '),
              },
              { field: 'Reporting boundary', detail: row.boundary },
              { field: 'Evidence notes', detail: row.reasons },
              { field: 'Suggested SDGs', detail: row.sdgs },
            ],
            ['field', 'detail'],
          ),
        );
      }
    } else {
      let keys = group.columns;
      if (keys.length > 6)
        keys = keys.filter((k) => !['period_start', 'source_reference'].includes(k));
      body.push(table(group.rows, keys));
    }
  }
  if (empty.length) body.push(heading('Sections with no records'), p(empty.join(', ')));
  const document = new Document({
    creator: 'CarbonX',
    title: report.title,
    description: 'Role scoped sustainability review snapshot',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: '000000' },
          paragraph: { spacing: { after: 140 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          run: { font: 'Arial', size: 36, bold: true, color: '000000' },
          paragraph: { spacing: { after: 180 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 28, bold: true, color: '000000' },
          paragraph: { keepNext: true },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 23, bold: true, color: '000000' },
          paragraph: { keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'CarbonX  |  Page ', size: 18, color: '52675C' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
  return Packer.toBuffer(document);
}
export async function excelReport(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CarbonX';
  wb.created = new Date(report.generatedAt);
  wb.calcProperties.fullCalcOnLoad = true;
  const groups = officeSections(report);
  for (const group of groups) {
    const ws = wb.addWorksheet(group.title.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 6, xSplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: group.key === 'summary' ? palette.dark : '6F967E' } },
      pageSetup: {
        paperSize: 9,
        orientation: group.columns.length > 5 ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '6:6',
      },
    });
    ws.getCell('A2').value = group.title;
    ws.getCell('A2').font = { name: 'Arial', size: 16, bold: true, color: { argb: '172B22' } };
    ws.getCell('A3').value = report.company?.name || report.audience;
    ws.getCell('A4').value = new Date(report.generatedAt);
    ws.getCell('A4').numFmt = 'yyyy-mm-dd hh:mm "UTC"';
    const rows = group.rows;
    const rawKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter(
      (k) => k !== 'evidence',
    );
    const keys = [...group.columns, ...rawKeys.filter((k) => !group.columns.includes(k))];
    if (!keys.length) keys.push('status');
    ws.columns = keys.map((k) => ({
      key: k,
      width: [
        'text',
        'note',
        'message',
        'action',
        'rationale',
        'review_note',
        'source',
        'source_reference',
        'reasons',
      ].includes(k)
        ? 52
        : ['id', 'claim_id', 'report_id', 'facility_id'].includes(k)
          ? 38
          : ['value', 'year', 'page_number', 'threshold'].includes(k)
            ? 15
            : 28,
      hidden: k === 'id' || k.endsWith('_id'),
    }));
    ws.getRow(6).values = keys.map(label);
    ws.getRow(6).height = 32;
    ws.getRow(6).eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.dark } };
      c.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    if (!rows.length) {
      ws.getCell('A7').value = 'No records';
      ws.getCell('A7').font = { name: 'Arial', size: 11, color: { argb: palette.muted } };
    }
    for (const [i, row] of rows.entries()) {
      const excelRow = ws.getRow(i + 7);
      keys.forEach((k, j) => {
        const cell = excelRow.getCell(j + 1),
          v = row[k];
        // Strings are explicit strings, never formula objects. Preserve source text.
        cell.value =
          v == null
            ? null
            : typeof v === 'number' || typeof v === 'boolean'
              ? v
              : typeof v === 'object'
                ? text(v)
                : String(v);
        cell.font = { name: 'Arial', size: 11, color: { argb: '172B22' } };
        cell.alignment = {
          vertical: 'top',
          wrapText: true,
          horizontal: typeof v === 'number' ? 'right' : 'left',
        };
        if (typeof v === 'number')
          cell.numFmt = ['year', 'baseline_year', 'page_number'].includes(k)
            ? '0'
            : Number.isInteger(v)
              ? '#,##0'
              : '#,##0.00';
        if (i % 2 === 1)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F6F3' } };
      });
      const longest = Math.max(
        1,
        ...keys.map((k) =>
          Math.ceil(
            text(row[k]).length /
              ([
                'text',
                'note',
                'message',
                'action',
                'rationale',
                'review_note',
                'source',
                'source_reference',
                'reasons',
              ].includes(k)
                ? 48
                : 25),
          ),
        ),
      );
      excelRow.height = Math.min(409, Math.max(26, longest * 16 + 8));
    }
    ws.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: Math.max(7, rows.length + 6), column: keys.length },
    };
    const statusIndex = keys.indexOf('status') + 1;
    if (statusIndex > 0 && rows.length) {
      const letter = ws.getColumn(statusIndex).letter,
        ref = letter + '7:' + letter + (rows.length + 6);
      ws.addConditionalFormatting({
        ref,
        rules: [
          {
            type: 'expression',
            formulae: [
              'OR(' +
                letter +
                '7="needs_review",' +
                letter +
                '7="follow_up",' +
                letter +
                '7="suspended",' +
                letter +
                '7="rejected")',
            ],
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FDE7E4' } },
              font: { color: { argb: '9C3027' } },
            },
          },
          {
            type: 'expression',
            formulae: [
              'OR(' + letter + '7="supported",' + letter + '7="accepted",' + letter + '7="active")',
            ],
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'E2F0E7' } },
              font: { color: { argb: '21543C' } },
            },
          },
        ],
      });
    }
    if (group.key === 'summary') {
      const end = rows.length + 9;
      ws.getCell('A' + end).value = 'Scope and interpretation';
      ws.getCell('A' + end).font = { name: 'Arial', size: 11, bold: true };
      ws.mergeCells(end + 1, 1, end + 3, 4);
      ws.getCell('A' + (end + 1)).value = report.notice;
      ws.getCell('A' + (end + 1)).alignment = { wrapText: true, vertical: 'top' };
      ws.getCell('A' + (end + 1)).font = {
        name: 'Arial',
        size: 11,
        color: { argb: palette.muted },
      };
      ws.getColumn(1).width = 48;
      ws.getColumn(2).width = 24;
      ws.getColumn(3).width = 20;
      ws.getColumn(4).width = 20;
    }
    ws.headerFooter.oddFooter = 'CarbonX | Page &P of &N';
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function sendOfficeReport(res, report, format, filename) {
  const buffer = format === 'docx' ? await wordReport(report) : await excelReport(report);
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Disposition', 'attachment; filename="' + filename + '.' + format + '"');
  res
    .type(
      format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    .send(buffer);
}
