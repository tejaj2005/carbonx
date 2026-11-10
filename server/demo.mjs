import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { uuid, now } from './db.mjs';
import { extractBaseline, normalize, verifyClaim } from './domain.mjs';
import { evaluate } from './evaluation.mjs';
export const presentation = JSON.parse(
  fs.readFileSync(new URL('../data/demo-presentation.json', import.meta.url), 'utf8'),
);
const original = JSON.parse(
  fs.readFileSync(new URL('../data/demo-data.json', import.meta.url), 'utf8'),
);
const stable = (root, key) =>
  'demo_' +
  crypto
    .createHash('sha256')
    .update(root + ':' + key)
    .digest('hex')
    .slice(0, 28);
export async function demoCompanyIds(store, root) {
  const rows = await store.q(
    'SELECT m.company_id FROM demo_members m JOIN companies c ON c.id=m.company_id WHERE m.root_company_id=? AND c.is_example=1',
    root,
  );
  return [...new Set([root, ...rows.map((r) => r.company_id)])];
}
export function demoTools(store, config, work) {
  const pending = new Map();
  async function seed(root) {
    if (!config.allowDemo || (config.testing && !config.expandedDemo)) return;
    if (pending.has(root)) return pending.get(root);
    const task = populate(root).finally(() => pending.delete(root));
    pending.set(root, task);
    return task;
  }
  async function populate(root) {
    const company = await store.get('SELECT * FROM companies WHERE id=?', root);
    if (!company?.is_example) throw Error('Demo data can only be added to a synthetic workspace.');
    if (
      await store.get(
        'SELECT root_company_id FROM demo_seeds WHERE root_company_id=? AND version=?',
        root,
        presentation.schemaVersion,
      )
    )
      return;
    const owner = await store.get(
      'SELECT u.* FROM users u LEFT JOIN government_admins g ON g.user_id=u.id WHERE u.company_id=? ORDER BY CASE WHEN g.user_id IS NULL THEN 0 ELSE 1 END,u.created_at LIMIT 1',
      root,
    );
    if (!owner) throw Error('Synthetic workspace owner missing.');
    const stamp = now();
    const companies = presentation.companies.map((c, i) => ({
      ...c,
      id: i === 0 ? root : stable(root, c.key),
    }));
    await store.transaction(async () => {
      for (const c of companies) {
        if (c.id !== root)
          await store.run(
            'INSERT OR IGNORE INTO companies(id,name,is_example,created_at) VALUES(?,?,1,?)',
            c.id,
            c.name,
            stamp,
          );
        await store.run(
          'INSERT OR IGNORE INTO demo_members(company_id,root_company_id) VALUES(?,?)',
          c.id,
          root,
        );
        const existing = await store.get(
          'SELECT * FROM facilities WHERE company_id=? ORDER BY created_at LIMIT 1',
          c.id,
        );
        const facility = existing || {
          id: stable(c.id, 'facility'),
          company_id: c.id,
          name: c.city + ' demonstration works',
          latitude: c.latitude,
          longitude: c.longitude,
          boundary: c.city + ' example facility',
          created_at: stamp,
        };
        if (!existing) await store.insert('facilities', facility);
        const operator = c.id === root ? owner.id : stable(c.id, 'owner');
        if (c.id !== root)
          await store.insert('users', {
            id: operator,
            company_id: c.id,
            name: c.city + ' Example Owner',
            email: operator + '@carbonx.invalid',
            password_hash: owner.password_hash,
            role: 'owner',
            disabled: 0,
            created_at: stamp,
          });
        const reviewer = stable(c.id, 'reviewer'),
          analyst = stable(c.id, 'analyst');
        for (const [id, role, name] of [
          [reviewer, 'reviewer', 'Example Evidence Reviewer'],
          [analyst, 'analyst', 'Example Data Analyst'],
        ])
          await store.insert('users', {
            id,
            company_id: c.id,
            name,
            email: id + '@carbonx.invalid',
            password_hash: owner.password_hash,
            role,
            disabled: 0,
            created_at: stamp,
          });
        const registry = await store.get('SELECT * FROM company_registry WHERE company_id=?', c.id);
        const description =
          c.industry +
          ' presentation example in ' +
          c.city +
          '. All company usage, review decisions and thresholds are synthetic.';
        if (!registry)
          await store.insert('company_registry', {
            company_id: c.id,
            licence_number: 'CX-DEMO-' + c.key.toUpperCase() + '-' + c.id.slice(-5),
            licence_status: c.licence,
            licence_reason:
              c.licence === 'suspended'
                ? 'Simulated suspension scenario: an unresolved evidence discrepancy requires review.'
                : '',
            public_visible: 1,
            publish_environment: 0,
            public_description: description,
            updated_at: stamp,
          });
        else
          await store.run(
            'UPDATE company_registry SET public_description=? WHERE company_id=?',
            description,
            c.id,
          );
        for (const series of presentation.history)
          for (const [year, base] of series.values) {
            if (
              await store.get(
                'SELECT id FROM observations WHERE company_id=? AND facility_id=? AND metric=? AND year=? AND boundary=?',
                c.id,
                facility.id,
                series.metric,
                year,
                facility.boundary,
              )
            )
              continue;
            const value = +(base * (series.unit === '%' ? 1 : c.scale)).toFixed(2),
              n = normalize(value, series.unit, series.metric);
            await store.insert('observations', {
              id: stable(c.id, series.metric + year),
              company_id: c.id,
              facility_id: facility.id,
              metric: series.metric,
              value,
              unit: series.unit,
              normalized_value: n.value,
              normalized_unit: n.unit,
              year,
              boundary: facility.boundary,
              source:
                'Synthetic annual example · data/demo-presentation.json · not company telemetry',
              report_id: null,
              created_at: stamp,
            });
          }
        const templates = [...presentation.reports];
        if (!(await store.get('SELECT id FROM reports WHERE company_id=?', c.id)))
          templates.unshift({
            key: 'original',
            name: original.report.name,
            year: 2024,
            claims: original.report.text
              .replaceAll('Riverbend facility', facility.boundary)
              .split('\n')
              .filter(Boolean),
          });
        for (const template of templates) {
          const id = stable(c.id, template.key);
          if (await store.get('SELECT id FROM reports WHERE id=?', id)) continue;
          const replacements = {
            boundary: facility.boundary,
            water: 720 * c.scale,
            emissions: 3780 * c.scale,
            waste: 150 * c.scale,
            recycled: 230 * c.scale,
          };
          const sentences = template.claims.map((s) =>
            s.replace(/\{(\w+)\}/g, (_, key) => String(replacements[key] ?? key)),
          );
          const text =
            'CARBONX SYNTHETIC PRESENTATION SOURCE\n' +
            presentation.notice +
            '\n\n' +
            sentences.join('\n');
          const bytes = Buffer.from(text),
            stored = id + '.txt';
          fs.writeFileSync(path.join(config.dataDir, 'uploads', stored), bytes);
          const report = {
            id,
            company_id: c.id,
            facility_id: facility.id,
            name: template.name,
            year: template.year,
            boundary: facility.boundary,
            original_name: stored,
            stored_name: stored,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            mime: 'text/plain',
            size: bytes.length,
            status: 'ready',
            mode: 'synthetic-fixture',
            page_count: 1,
            chunk_count: 1,
            warning:
              'Bundled fictional source. Pre-extracted with the deterministic keyword baseline; not a live AI result.',
            archived: 0,
            created_at: stamp,
          };
          await store.insert('reports', report);
          const page = stable(id, 'page'),
            chunk = stable(id, 'chunk');
          await store.insert('pages', {
            id: page,
            company_id: c.id,
            report_id: id,
            number: 1,
            text,
            tables_json: '[]',
            ocr: 0,
          });
          await store.insert('chunks', {
            id: chunk,
            company_id: c.id,
            report_id: id,
            page_id: page,
            number: 1,
            text,
            embedding: null,
            embedding_model: null,
          });
          const observations = await store.q('SELECT * FROM observations WHERE company_id=?', c.id);
          for (const [i, claim] of extractBaseline(
            [{ id: chunk, text: sentences.join('\n') }],
            report,
          ).entries()) {
            const n = normalize(claim.value, claim.unit, claim.metric),
              result = verifyClaim(claim, observations),
              claimId = stable(id, 'claim' + i);
            await store.insert('claims', {
              id: claimId,
              company_id: c.id,
              report_id: id,
              chunk_id: chunk,
              text: claim.text,
              metric: claim.metric,
              value: claim.value,
              unit: claim.unit,
              normalized_value: n?.value,
              normalized_unit: n?.unit,
              year: claim.year,
              baseline_year: claim.baseline_year,
              boundary: claim.boundary,
              facility_id: claim.facility_id,
              claimed_change: claim.claimed_change,
              direction: claim.direction,
              sdgs_json: JSON.stringify(claim.sdgs),
              rationale: claim.rationale + ' Synthetic fixture source.',
              method: 'keyword-baseline',
              status: result.status,
              reason_json: JSON.stringify(result.reasons),
              comparison_json: JSON.stringify(result.comparison),
              review_state: 'unreviewed',
              created_at: stamp,
            });
            if (template.key === 'performance' && i < 3) {
              const decision = result.status === 'supported' ? 'accepted' : 'flagged';
              await store.insert('reviews', {
                id: stable(claimId, 'review'),
                company_id: c.id,
                claim_id: claimId,
                user_id: reviewer,
                decision,
                rationale:
                  'Preconfigured synthetic reviewer scenario for presentation only. No real government approval.',
                created_at: stamp,
              });
              await store.run('UPDATE claims SET review_state=? WHERE id=?', decision, claimId);
              await store.insert('evaluation_cases', {
                id: stable(claimId, 'case'),
                company_id: c.id,
                claim_id: claimId,
                expected_status: result.status,
                expected_sdgs: JSON.stringify(claim.sdgs),
                relevant_chunks: JSON.stringify([chunk]),
                split: 'test',
                created_at: stamp,
              });
            }
          }
          await store.insert('jobs', {
            id: stable(id, 'job'),
            company_id: c.id,
            report_id: id,
            type: 'demo_fixture',
            status: 'completed',
            progress: 100,
            stage: 'Bundled synthetic example prepared',
            error: null,
            created_at: stamp,
            updated_at: stamp,
          });
        }
        for (const s of presentation.submissions)
          await store.insert('submissions', {
            id: stable(c.id, s.key),
            company_id: c.id,
            text: s.text,
            year: 2025,
            source: s.source,
            status: s.status,
            review_note: s.note,
            submitted_by: operator,
            reviewed_by: reviewer,
            created_at: stamp,
            updated_at: stamp,
          });
        // Fixed monthly totals with real period labels; never presented as continuously sampled data.
        for (let month = 0; month < 6; month++)
          for (const [metric, unit, base] of [
            ['water_consumption', 'kL', 66],
            ['energy_consumption', 'MWh', 730],
            ['emissions', 'tCO2e', 340],
          ]) {
            const end = new Date(Date.UTC(2026, month + 1, 0, 18, 29, 59)).toISOString();
            await store.insert('meter_readings', {
              id: stable(c.id, metric + 'month' + month),
              company_id: c.id,
              facility_id: facility.id,
              metric,
              value: +((base - month * 2) * c.scale).toFixed(2),
              unit,
              recorded_at: end,
              source:
                'Synthetic monthly total · ' +
                new Date(end).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'Asia/Kolkata',
                }) +
                ' · data/demo-presentation.json',
              created_at: stamp,
            });
          }
        const end = new Date(Date.now() - 300000),
          start = new Date(end.getTime() - 3600000);
        for (const t of presentation.thresholds) {
          const rule = stable(c.id, t.metric + 'rule'),
            value = c.key === 'harbour' && t.metric === 'pm_stack' ? 61 : t.value;
          await store.insert('emission_rules', {
            id: rule,
            company_id: c.id,
            facility_id: facility.id,
            metric: t.metric,
            threshold: t.threshold,
            unit: t.unit,
            window_minutes: 60,
            max_age_minutes: 10080,
            measurement_basis: t.basis,
            source_reference:
              'Synthetic operational threshold · not a CPCB/legal limit · data/demo-presentation.json',
            active: 1,
            created_at: stamp,
          });
          await store.insert('emission_samples', {
            id: stable(c.id, t.metric + 'sample'),
            company_id: c.id,
            facility_id: facility.id,
            metric: t.metric,
            value,
            unit: t.unit,
            period_start: start.toISOString(),
            period_end: end.toISOString(),
            measurement_basis: t.basis,
            quality: 'valid',
            source_kind: 'synthetic_example',
            source_reference: 'Generated presentation sample at ' + stamp + ' · not a live sensor',
            created_at: stamp,
          });
        }
        await store.run(
          'INSERT OR IGNORE INTO city_watch(company_id,city_id) VALUES(?,?)',
          c.id,
          c.cityId,
        );
        for (const [key, type, status, note] of [
          [
            'request',
            'request_evidence',
            'open',
            'Synthetic request: provide calibrated meter records for the energy reduction discrepancy.',
          ],
          [
            'resolved',
            'notice',
            'closed',
            'Synthetic completed case: water baseline and reporting boundary checked.',
          ],
        ])
          await store.insert('oversight_actions', {
            id: stable(c.id, key),
            company_id: c.id,
            type,
            note,
            public_note: 'Presentation example only. ' + note,
            status,
            created_by: reviewer,
            created_at: stamp,
            updated_at: stamp,
          });
        for (const [key, title] of [
          ['review', 'Synthetic review: water claim accepted'],
          ['evidence', 'Synthetic follow-up: energy evidence needed'],
        ])
          await store.insert('notifications', {
            id: stable(c.id, key + 'notice'),
            user_id: operator,
            event_key: stable(c.id, key + 'event'),
            alert_id: null,
            title,
            message:
              'Fictional presentation scenario. Open Submissions to inspect the source and review note.',
            kind: 'workspace_event',
            created_at: stamp,
            read_at: null,
          });
        await store.audit(c.id, operator, 'demo.presentation_loaded', 'company', c.id, {
          fixtureVersion: presentation.schemaVersion,
          synthetic: true,
          city: c.city,
        });
      }
      for (const c of companies) await work.refresh(c.id);
      for (const c of companies) {
        const metrics = await evaluate(store, c.id);
        metrics.note =
          'Synthetic fixture consistency check using preconfigured labels; this is not an independent AI accuracy benchmark.';
        await store.insert('evaluation_runs', {
          id: stable(c.id, 'evaluation'),
          company_id: c.id,
          metrics_json: JSON.stringify(metrics),
          created_at: stamp,
        });
      }
      await store.run(
        'INSERT OR IGNORE INTO demo_seeds(root_company_id,version,created_at) VALUES(?,?,?)',
        root,
        presentation.schemaVersion,
        stamp,
      );
    });
  }
  return { seed };
}
