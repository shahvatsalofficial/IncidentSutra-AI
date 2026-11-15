import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEvents, normalizeRecord} from '../packages/core/ingest.mjs';
import {analyzeIncident, toMarkdown, toHTML, toPostmortem, toHypothesisRegister, verifyReport, verifySources, compareReports} from '../packages/core/analyze.mjs';
import {validate} from '../packages/core/schema.mjs';
import {readFileSync} from 'node:fs';

const get = async (f, o) => analyzeIncident(await loadEvents(f), o);
const SRC = {file: 'x', sha256: 'c'.repeat(64)};
const mk = rows => ({events: rows.map((r, i) => normalizeRecord(r, SRC, i + 1))});
const D = '2026-11-10T';

test('creates a timestamp-sorted observed timeline', async () => {
  const r = await get('fixtures/example-incident');
  assert.equal(r.summary.count, 9);
  assert.ok(r.timeline.every((e, i, a) => !i || e.timestamp >= a[i - 1].timestamp));
  assert.ok(r.timeline.every(t => t.verification === 'observed'));
});
test('never claims causality: all hypotheses unconfirmed, confidence undetermined, review pending', async () => {
  const r = await get('fixtures/example-incident');
  assert.ok(r.hypotheses.every(h => h.status === 'unconfirmed' && h.confidence === 'undetermined' && h.reviewStatus === 'pending_human_review'));
  assert.equal(r.methodology.causalInference, 'none');
});
test('a deployment near the alert stays correlation only', async () => {
  const r = await get('fixtures/example-incident');
  const tc = r.hypotheses.filter(h => h.kind === 'temporal-correlation');
  assert.ok(tc.length >= 1);
  assert.ok(tc.every(h => /may be related/.test(h.title) && h.status === 'unconfirmed'));
});
test('pre-existing error before the later deployment is recorded as counter-evidence', async () => {
  const r = await get('fixtures/example-incident');
  assert.ok(r.contradictions.some(c => c.kind === 'errors_before_change'));
  const withContra = r.hypotheses.filter(h => h.kind === 'temporal-correlation' && h.contradictingEventIds.length);
  assert.ok(withContra.length >= 1);
});
test('fixture offers at least two competing explanation families', async () => {
  const kinds = new Set((await get('fixtures/example-incident')).hypotheses.map(h => h.kind));
  assert.ok(kinds.size >= 3);
  assert.ok(kinds.has('temporal-correlation') && kinds.has('alternative-explanation') && kinds.has('insufficient-evidence'));
});
test('dependency signal after onset is flagged as possible effect', async () => {
  const r = await get('fixtures/example-incident');
  const dep = r.hypotheses.find(h => h.kind === 'dependency-failure');
  assert.ok(dep);
  assert.ok(dep.supportingEventIds.length >= 1);
});
test('each hypothesis has falsifiable content and unexecuted read-only checks', async () => {
  const r = await get('fixtures/example-incident');
  for (const h of r.hypotheses.filter(x => x.kind !== 'insufficient-evidence')) {
    assert.ok(h.mustBeTrue.length >= 1, h.id);
    assert.ok(h.disconfirmingObservations.length >= 1, h.id);
  }
  for (const h of r.hypotheses) for (const d of h.diagnostics) { assert.equal(d.executed, false); assert.equal(d.class, 'read-only'); assert.match(d.permission, /^read:/); }
});
test('absent metrics are unknown, not fabricated', async () => {
  const r = await get('fixtures/edge-cases/missing-metrics.json');
  assert.ok(r.gaps.some(g => g.kind === 'missing_metrics' && g.status === 'unknown'));
  assert.equal(r.metricSeries.length, 0);
  assert.equal(r.checks.metrics, 'not_provided');
});
test('missing traces and changes are flagged', () => {
  const r = analyzeIncident(mk([{timestamp: `${D}10:00:00Z`, type: 'error', service: 'a', severity: 'error'}]));
  assert.ok(r.gaps.some(g => g.kind === 'missing_traces'));
  assert.ok(r.gaps.some(g => g.kind === 'missing_changes'));
});
test('mixed offsets produce an explicit clock-skew gap', async () => assert.ok((await get('fixtures/example-incident')).gaps.some(g => g.kind === 'mixed_time_offsets')));
test('numeric metric series are summarised from observed values only', async () => {
  const s = (await get('fixtures/example-incident')).metricSeries.find(m => m.name === 'checkout/error_rate_pct');
  assert.ok(s);
  assert.equal(s.first.value, 0.1);
  assert.equal(s.last.value, 8);
  assert.equal(s.classification, 'observed');
});
test('no production operation is represented as run', async () => {
  const r = await get('fixtures/example-incident');
  assert.equal(r.checks.productionDiagnostics, 'not_run');
  assert.equal(r.checks.productionMutations, 'not_run');
  assert.equal(r.decision.status, 'HUMAN_REVIEW_REQUIRED');
});
test('reusable agent contract is complete and validates', async () => {
  const r = await get('fixtures/example-incident');
  const schema = JSON.parse(readFileSync('schemas/agent-output.schema.json', 'utf8'));
  const c = r.contract;
  assert.equal(validate(schema, {scope: c.scope, observed: [], inferred: [], unknowns: c.unknowns, notRun: c.notRun, evidenceIds: c.evidenceIds, contradictions: [], nextChecks: c.nextChecks, permissionsRequired: c.permissionsRequired, privacyReview: c.privacyReview, humanApproval: c.humanApproval}).ok, true);
});
test('claims separate observed, inferred, unknown and not-run', async () => {
  const c = (await get('fixtures/example-incident')).claims;
  assert.ok(c.observed.length === 9 && c.inferred.length >= 1 && c.unknown.length >= 1 && c.notRun.length >= 3);
});
test('every hypothesis reference exists in the event evidence', async () => assert.equal(verifyReport(await get('fixtures/example-incident')).ok, true));
test('report validates against the v2 schema', async () => {
  const schema = JSON.parse(readFileSync('schemas/incident-report.schema.json', 'utf8'));
  const v = validate(schema, await get('fixtures/example-incident'));
  assert.deepEqual(v.errors, []);
});
test('stable report IDs for identical input', async () => assert.equal((await get('fixtures/example-incident')).reportId, (await get('fixtures/example-incident')).reportId));
test('report ID changes when the window changes', async () => assert.notEqual((await get('fixtures/example-incident', {windowMinutes: 5})).reportId, (await get('fixtures/example-incident', {windowMinutes: 30})).reportId));
for (const [name, mut] of [
  ['summary tamper', r => { r.summary.count = 22; }],
  ['unknown evidence reference', r => { r.hypotheses[0].supportingEventIds.push('evt_fake'); }],
  ['forced confirmed root cause', r => { r.hypotheses[0].status = 'confirmed'; }],
  ['approved decision', r => { r.decision.status = 'APPROVED'; }],
  ['claimed production mutation', r => { r.checks.productionMutations = 'run'; }],
  ['forged event text', r => { r.events[0].message = 'forged'; }],
  ['timeline pointing nowhere', r => { r.timeline[0].eventId = 'evt_nope'; }]
]) {
  test(`verification fails on ${name}`, async () => { const r = await get('fixtures/example-incident'); mut(r); assert.equal(verifyReport(r).ok, false); });
}
test('verification rejects non-reports', () => { for (const bad of [null, {}, {schema: 'x'}, []]) assert.equal(verifyReport(bad).ok, false); });
test('legacy v1 schema id is still recognised', async () => { const r = await get('fixtures/example-incident'); r.schema = 'incidentsutra.report.v1'; assert.ok(verifyReport(r).issues.includes('Report integrity digest mismatch')); });
test('source re-hash passes for untouched input and fails for changed input', async () => {
  const r = await get('fixtures/example-incident');
  assert.equal((await verifySources(r, 'fixtures/example-incident')).ok, true);
  r.sources[0].sha256 = '0'.repeat(64);
  assert.equal((await verifySources(r, 'fixtures/example-incident')).ok, false);
});
test('markdown report has evidence IDs, human approval and legend', async () => {
  const m = toMarkdown(await get('fixtures/example-incident'));
  assert.match(m, /evt_/); assert.match(m, /HUMAN_REVIEW_REQUIRED/); assert.match(m, /observed.*inferred.*unknown.*not run/s); assert.match(m, /not executed/);
});
test('postmortem draft is blameless and leaves human sections open', async () => {
  const p = toPostmortem(await get('fixtures/example-incident'));
  assert.match(p, /TODO \(human\)/); assert.match(p, /Blameless/); assert.match(p, /DRAFT/);
});
test('hypothesis register lists reviewer decision placeholders', async () => assert.match(toHypothesisRegister(await get('fixtures/example-incident')), /Reviewer decision: _pending_/));
test('HTML report escapes untrusted text and carries a CSP with no script', async () => {
  const d = await loadEvents('fixtures/edge-cases/missing-metrics.json');
  d.events[0].message = '<script>alert(1)</script>';
  const h = toHTML(analyzeIncident(d));
  assert.ok(!h.includes('<script>alert')); assert.ok(h.includes('&lt;script&gt;')); assert.match(h, /Content-Security-Policy/); assert.ok(!/<script/i.test(h));
});
test('HTML report is accessible: lang, viewport, landmarks, svg title, skip of colour-only meaning', async () => {
  const h = toHTML(await get('fixtures/example-incident', {synthetic: true}));
  assert.match(h, /<html lang="en"/); assert.match(h, /name="viewport"/); assert.match(h, /<svg role="img"/); assert.match(h, /<title id="tl-t">/); assert.match(h, /SYNTHETIC DATA/); assert.match(h, /prefers-color-scheme:dark/); assert.match(h, /@media print/);
});
test('synthetic flag appears only when requested', async () => { assert.ok(!toHTML(await get('fixtures/example-incident')).includes('SYNTHETIC DATA')); });
test('markdown table cells cannot be broken by pipes or newlines', () => {
  const r = analyzeIncident(mk([{timestamp: `${D}10:00:00Z`, type: 'error', service: 'a|b', severity: 'error', message: 'x | y\nz'}]));
  const rows = toMarkdown(r).split('\n').filter(l => l.startsWith('| 2026'));
  assert.equal(rows.length, 1); assert.equal(rows[0].split('|').length, 7);
});
test('comparison recognises added, removed and same-content events', async () => {
  const a = await get('fixtures/example-incident'), b = await get('fixtures/edge-cases/missing-metrics.json');
  const d = compareReports(a, b);
  assert.ok(d.added.length > 0 && d.removed.length > 0); assert.equal(d.deltaEvents, b.summary.count - a.summary.count); assert.ok(d.hypothesisKinds.baseline.length > 0);
});
test('comparing a report with itself reports no change', async () => {
  const a = await get('fixtures/example-incident'), d = compareReports(a, a);
  assert.deepEqual([d.added, d.removed, d.deltaEvents], [[], [], 0]);
});
test('rejects an out-of-range correlation window', async () => { const d = await loadEvents('fixtures/example-incident'); for (const w of [0, 121, 900]) assert.throws(() => analyzeIncident(d, {windowMinutes: w}), /windowMinutes/); });
test('requires at least one event', () => assert.throws(() => analyzeIncident({events: []}), /At least one/));
test('no incident signals yields only the unknown-cause hypothesis', () => {
  const r = analyzeIncident(mk([{timestamp: `${D}10:00:00Z`, type: 'metric', service: 'x'}]));
  assert.deepEqual(r.hypotheses.map(h => h.kind), ['insufficient-evidence']);
});
test('alert storms are detected', () => {
  const r = analyzeIncident(mk(Array.from({length: 6}, (_, i) => ({timestamp: `${D}10:00:0${i}Z`, type: 'alert', service: 'a', severity: 'critical', message: `a${i}`}))));
  assert.equal(r.alertStorms.length, 1); assert.equal(r.alertStorms[0].count, 6);
});
test('rollback counts as a change', () => assert.equal(analyzeIncident(mk([{timestamp: `${D}10:00:00Z`, type: 'rollback', service: 'a'}, {timestamp: `${D}10:01:00Z`, type: 'error', service: 'a', severity: 'error'}])).summary.deployments, 1));
