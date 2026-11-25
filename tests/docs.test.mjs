import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadEvents} from '../packages/core/ingest.mjs';
import {analyzeIncident} from '../packages/core/analyze.mjs';

// The scenario page makes claims about tool output; each claim is checked here.
const run = async n => analyzeIncident(await loadEvents(`fixtures/scenarios/${n}`), {synthetic: true});
const kinds = r => r.hypotheses.map(h => h.kind);
const page = n => readFileSync(`documents/IncidentSutra-AI/${n}`, 'utf8');

test('scenario 1: errors before the release are counter-evidence', async () => {
  const r = await run('deploy-blamed');
  assert.ok(r.contradictions.some(c => c.kind === 'errors_before_change'));
  assert.ok(kinds(r).includes('latent-defect'));
});
test('scenario 2: converted offset puts the deploy first', async () => {
  const r = await run('timezone-mixup');
  assert.equal(r.timeline[0].type, 'deploy');
  assert.equal(r.timeline[0].timestamp, '2026-11-10T19:45:00.000Z');
  assert.ok(r.gaps.some(g => g.kind === 'mixed_time_offsets'));
});
test('scenario 3: dependency raised, no change hypothesis against search', async () => {
  const r = await run('payment-provider');
  assert.ok(kinds(r).includes('dependency-failure'));
  assert.ok(!kinds(r).includes('temporal-correlation'));
});
test('scenario 4: release outside the window is not linked; datastore raised', async () => {
  const r = await run('database-pool');
  assert.ok(!kinds(r).includes('temporal-correlation'));
  assert.ok(kinds(r).includes('datastore-issue'));
  const m = r.metricSeries.find(s => s.name === 'accounts/db_connections');
  assert.deepEqual([m.first.value, m.last.value], [40, 200]);
});
test('scenario 5: one storm, saturation raised, secrets masked', async () => {
  const r = await run('night-alert-storm');
  assert.equal(r.alertStorms.length, 1);
  assert.ok(kinds(r).includes('resource-saturation'));
  const s = JSON.stringify(r);
  assert.ok(!s.includes('meera@example.com') && !s.includes('demo-not-a-real-token-123456'));
});
test('scenario 6: bad timestamp rejected and gaps stay unknown', async () => {
  const r = await run('thin-evidence');
  assert.equal(r.ingestionErrors.length, 1);
  for (const k of ['missing_metrics', 'missing_traces', 'missing_changes', 'invalid_records']) assert.ok(r.gaps.some(g => g.kind === k), k);
});
test('website is light by default with a dark toggle, search and mobile menu', () => {
  for (const f of ['index.html', '05-user-guide.html', '10-real-world-scenarios.html']) {
    const h = page(f);
    assert.match(h, /<html lang="en" data-theme="light">/);
    assert.ok(h.includes('theme-btn') && h.includes('id="q"') && h.includes('name="viewport"'), f);
    assert.ok(!h.includes('<!-- svg:') && !h.includes('<!-- scenario:'), `${f} has unexpanded directives`);
  }
});
test('every wide diagram ships a narrow-screen version', () => {
  const h = page('11-visual-guide.html');
  assert.equal(h.split('class="dia-wide"').length, h.split('dia-narrow"').length);
});
