import fs from 'node:fs/promises';
import path from 'node:path';
import { getEncoding } from 'js-tiktoken';
import { uuid } from './db.mjs';
const encoding = getEncoding('cl100k_base');
export function chunkPages(pages, companyId, reportId, size = 500, overlap = 80) {
  const lines = new Map();
  for (const p of pages) {
    const ls = p.text.split('\n').map((x) => x.trim());
    for (const line of new Set([...ls.slice(0, 2), ...ls.slice(-2)])) {
      if (line.length > 3 && line.length < 180) lines.set(line, (lines.get(line) || 0) + 1);
    }
  }
  const repeated = new Set(
    [...lines]
      .filter(([, count]) => pages.length >= 3 && count / pages.length >= 0.6)
      .map(([line]) => line),
  );
  const chunks = [];
  for (const p of pages) {
    const clean = p.text
      .split('\n')
      .filter((l) => !repeated.has(l.trim()))
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    const ids = encoding.encode(clean);
    for (let start = 0; start < ids.length; start += size - overlap) {
      const text = encoding.decode(ids.slice(start, start + size)).trim();
      if (text.length >= 20)
        chunks.push({
          id: uuid('chk_'),
          company_id: companyId,
          report_id: reportId,
          page_id: p.id,
          number: chunks.length + 1,
          text,
        });
      if (start + size >= ids.length) break;
    }
  }
  return chunks;
}
export async function parseReport(file, config, onProgress = () => {}) {
  const buffer = await fs.readFile(file),
    ext = path.extname(file).toLowerCase();
  const warnings = [];
  let pages = [];
  if (ext === '.pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
    let worker;
    try {
      const text = await parser.getText({ first: 500, pageJoiner: '' });
      if (text.total > 500)
        throw new Error(
          'Reports are limited to 500 pages per upload. Split this report into volumes.',
        );
      let tables;
      try {
        tables = await parser.getTable({ first: 500 });
      } catch {
        warnings.push(
          'Table extraction was incomplete. Review table-based claims against the source PDF.',
        );
      }
      pages = text.pages.map((p) => ({
        number: p.num,
        text: p.text,
        tables: tables?.pages.find((t) => t.num === p.num)?.tables || [],
        ocr: false,
      }));
      const scanned = pages.filter((p) => p.text.trim().length < 40);
      if (scanned.length && config.ocrEnabled) {
        const { createWorker } = await import('tesseract.js');
        const options = { cachePath: path.join(config.dataDir, 'ocr-cache') };
        await fs.mkdir(options.cachePath, { recursive: true });
        if (process.env.OCR_LANG_PATH) options.langPath = process.env.OCR_LANG_PATH;
        worker = await createWorker('eng', 1, options);
        for (const p of scanned.slice(0, 20)) {
          onProgress('OCR page ' + p.number);
          const screenshots = await parser.getScreenshot({
            partial: [p.number],
            desiredWidth: 1600,
            imageDataUrl: false,
            imageBuffer: true,
          });
          const r = await worker.recognize(screenshots.pages[0].data);
          p.text = r.data.text;
          p.ocr = true;
        }
        if (scanned.length > 20)
          warnings.push(
            'OCR processed 20 scanned pages; remaining scanned pages require a separate volume.',
          );
      }
      const unread = pages.filter((p) => p.text.trim().length < 40).length;
      if (unread)
        warnings.push(
          unread +
            ' page(s) lack extractable text. Enable OCR and reprocess a new version, or supply a text PDF.',
        );
      return { pages, warnings, needsOcr: unread > 0 };
    } finally {
      if (worker) await worker.terminate();
      await parser.destroy();
    }
  }
  if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ buffer });
    const parts = r.value.split(/\n\n+/);
    let text = '';
    for (const part of parts) {
      if (text.length + part.length > 6000 && text) {
        pages.push({ number: pages.length + 1, text, tables: [], ocr: false });
        text = '';
      }
      text += part + '\n\n';
    }
    if (text) pages.push({ number: pages.length + 1, text, tables: [], ocr: false });
    warnings.push(
      'DOCX citations use logical sections, not Word page numbers. Upload the PDF for physical page references.',
    );
  } else if (ext === '.txt') {
    pages = buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split('\f')
      .map((text, i) => ({ number: i + 1, text, tables: [], ocr: false }));
    warnings.push('Text-file citations use form-feed sections.');
  } else throw new Error('Supported report formats are PDF, DOCX and UTF-8 TXT.');
  if (!pages.some((p) => p.text.trim().length >= 20))
    throw new Error('This report contains no usable text.');
  return { pages, warnings, needsOcr: false };
}
