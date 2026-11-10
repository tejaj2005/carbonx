import path from 'node:path';
import { uuid, now } from './db.mjs';
import { parseReport, chunkPages } from './documents.mjs';
import { SDGS, extractBaseline, normalize, verifyClaim, lexicalSearch, cosine } from './domain.mjs';
export function pipeline(store, config, ai) {
  const queue = [];
  let working = false;
  const progress = (job, stage, percent) =>
    store.run(
      'UPDATE jobs SET status=?,stage=?,progress=?,updated_at=? WHERE id=?',
      'running',
      stage,
      percent,
      now(),
      job.id,
    );
  function refresh(company) {
    const observations = store.q('SELECT * FROM observations WHERE company_id=?', company);
    for (const claim of store.q('SELECT * FROM claims WHERE company_id=?', company)) {
      const r = verifyClaim(claim, observations);
      store.run(
        'UPDATE claims SET status=?,reason_json=?,comparison_json=? WHERE id=? AND company_id=?',
        r.status,
        JSON.stringify(r.reasons),
        JSON.stringify(r.comparison),
        claim.id,
        company,
      );
      const existing = store.get(
        'SELECT id FROM recommendations WHERE company_id=? AND claim_id=?',
        company,
        claim.id,
      );
      const title =
        r.status === 'needs_review'
          ? 'Resolve the reported discrepancy'
          : r.status === 'insufficient_evidence'
            ? 'Complete the evidence trail'
            : 'Maintain supporting evidence';
      const action =
        r.reasons.join(' ') +
        ' Preserve matching units, years, facility and reporting boundary. Record reviewer rationale before closing this item.';
      if (existing)
        store.run(
          'UPDATE recommendations SET title=?,action=?,priority=? WHERE id=?',
          title,
          action,
          r.status === 'needs_review'
            ? 'high'
            : r.status === 'insufficient_evidence'
              ? 'medium'
              : 'low',
          existing.id,
        );
      else
        store.insert('recommendations', {
          id: uuid('rec_'),
          company_id: company,
          claim_id: claim.id,
          title,
          action,
          priority:
            r.status === 'needs_review'
              ? 'high'
              : r.status === 'insufficient_evidence'
                ? 'medium'
                : 'low',
          status: 'open',
          created_at: now(),
        });
    }
  }
  async function processReport(job, report) {
    const warnings = [];
    try {
      progress(job, 'Extracting text and tables', 10);
      const parsed = await parseReport(
        path.join(config.dataDir, 'uploads', report.stored_name),
        config,
        (stage) => progress(job, stage, 20),
      );
      warnings.push(...parsed.warnings);
      const pages = parsed.pages.map((p) => ({ ...p, id: uuid('pg_') }));
      const chunks = chunkPages(pages, report.company_id, report.id);
      if (chunks.length > 5000)
        throw new Error(
          'Report exceeds the 5,000-passage processing limit. Split it into volumes.',
        );
      store.transaction(() => {
        for (const p of pages)
          store.insert('pages', {
            id: p.id,
            company_id: report.company_id,
            report_id: report.id,
            number: p.number,
            text: p.text,
            tables_json: JSON.stringify(p.tables),
            ocr: p.ocr ? 1 : 0,
          });
        for (const c of chunks)
          store.insert('chunks', { ...c, embedding: null, embedding_model: null });
      });
      progress(job, 'Building evidence index', 35);
      if (ai.available) {
        try {
          for (let i = 0; i < chunks.length; i += 32) {
            const batch = chunks.slice(i, i + 32),
              vectors = await ai.embed(batch.map((c) => c.text));
            for (let j = 0; j < batch.length; j++)
              store.run(
                'UPDATE chunks SET embedding=?,embedding_model=? WHERE id=?',
                JSON.stringify(vectors[j]),
                config.embeddingModel,
                batch[j].id,
              );
          }
        } catch {
          warnings.push(
            'Embedding service unavailable. Lexical evidence retrieval remains available.',
          );
        }
      }
      progress(job, 'Extracting claims and mapping SDGs', 60);
      let claims,
        mode = 'keyword-baseline';
      if (ai.available) {
        try {
          claims = await ai.extract(chunks, report, SDGS);
          mode = 'hosted-rag';
          if (claims.rejectedQuotes)
            warnings.push(
              claims.rejectedQuotes +
                ' model proposals lacked a valid source quote and were excluded.',
            );
        } catch {
          warnings.push(
            'Hosted claim extraction failed. Results use the keyword baseline and require reviewer confirmation.',
          );
          claims = extractBaseline(chunks, report);
        }
      } else claims = extractBaseline(chunks, report);
      const seen = new Set();
      store.transaction(() => {
        for (const c of claims) {
          if (seen.has(c.text)) continue;
          seen.add(c.text);
          const n = normalize(c.value, c.unit, c.metric);
          store.insert('claims', {
            id: uuid('clm_'),
            company_id: report.company_id,
            report_id: report.id,
            chunk_id: c.chunk_id,
            text: c.text,
            metric: c.metric,
            value: c.value,
            unit: c.unit,
            normalized_value: n?.value,
            normalized_unit: n?.unit,
            year: c.year,
            baseline_year: c.baseline_year,
            boundary: c.boundary,
            facility_id: c.facility_id,
            claimed_change: c.claimed_change,
            direction: c.direction,
            sdgs_json: JSON.stringify(c.sdgs),
            rationale: c.rationale,
            method: c.method,
            status: 'insufficient_evidence',
            reason_json: '[]',
            comparison_json: '{}',
            review_state: 'unreviewed',
            created_at: now(),
          });
        }
      });
      progress(job, 'Comparing historical evidence', 90);
      refresh(report.company_id);
      store.run(
        'UPDATE reports SET status=?,mode=?,page_count=?,chunk_count=?,warning=? WHERE id=?',
        parsed.needsOcr ? 'needs_ocr' : 'ready',
        mode,
        pages.length,
        chunks.length,
        warnings.join(' '),
        report.id,
      );
      store.run(
        'UPDATE jobs SET status=?,stage=?,progress=?,updated_at=? WHERE id=?',
        'completed',
        parsed.needsOcr ? 'Completed with unread pages' : 'Completed',
        100,
        now(),
        job.id,
      );
      store.audit(report.company_id, null, 'report.processed', 'report', report.id, {
        pages: pages.length,
        passages: chunks.length,
        claims: seen.size,
        mode,
        warnings,
      });
    } catch (error) {
      const safe = String(error.message || 'Processing failed')
        .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
        .slice(0, 500);
      store.run('UPDATE reports SET status=?,warning=? WHERE id=?', 'failed', safe, report.id);
      store.run(
        'UPDATE jobs SET status=?,stage=?,error=?,updated_at=? WHERE id=?',
        'failed',
        'Processing failed',
        safe,
        now(),
        job.id,
      );
    }
  }
  async function drain() {
    if (working) return;
    working = true;
    try {
      while (queue.length) {
        const item = queue.shift();
        await processReport(item.job, item.report);
      }
    } finally {
      working = false;
    }
  }
  function enqueue(report) {
    const job = {
      id: uuid('job_'),
      company_id: report.company_id,
      report_id: report.id,
      type: 'ingestion',
      status: 'queued',
      progress: 0,
      stage: 'Queued',
      error: null,
      created_at: now(),
      updated_at: now(),
    };
    store.insert('jobs', job);
    queue.push({ job, report });
    setImmediate(drain);
    return job;
  }
  async function retrieve(company, query, reportId = null, k = 5, useAI = true) {
    const chunks = store.q(
      'SELECT c.*,p.number page_number,r.name report_name,r.mime FROM chunks c JOIN pages p ON p.id=c.page_id JOIN reports r ON r.id=c.report_id WHERE c.company_id=? AND r.archived=0' +
        (reportId ? ' AND c.report_id=?' : ''),
      ...[company, ...(reportId ? [reportId] : [])],
    );
    const lexical = lexicalSearch(query, chunks, Math.max(k, 20));
    if (!useAI || !ai.available || !chunks.some((c) => c.embedding))
      return { mode: 'lexical', passages: lexical.slice(0, k).map(({ embedding, ...c }) => c) };
    try {
      const [vector] = await ai.embed([query]);
      const semantic = chunks
        .filter((c) => c.embedding && c.embedding_model === config.embeddingModel)
        .map((c) => ({ ...c, score: cosine(vector, JSON.parse(c.embedding)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      const fused = new Map();
      for (const list of [lexical, semantic])
        list.forEach((c, i) => {
          const old = fused.get(c.id);
          fused.set(c.id, { ...c, score: (old?.score || 0) + 1 / (60 + i + 1) });
        });
      return {
        mode: 'hybrid',
        passages: [...fused.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, k)
          .map(({ embedding, ...c }) => c),
      };
    } catch {
      return {
        mode: 'lexical-fallback',
        passages: lexical.slice(0, k).map(({ embedding, ...c }) => c),
      };
    }
  }
  return { enqueue, refresh, retrieve, isIdle: () => !working && !queue.length };
}
