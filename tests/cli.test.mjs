import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {cli, withTmp} from './helpers.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));

test('--version prints the package version', () => { const r = cli('--version'); assert.equal(r.status, 0); assert.equal(r.stdout.trim(), pkg.version); });
test('help lists every command', () => { const r = cli('help'); assert.equal(r.status, 0); for (const c of ['doctor', 'analyze', 'verify', 'compare', 'redact', 'audit', 'benchmark', 'skills', 'serve']) assert.match(r.stdout, new RegExp(c)); });
test('doctor reports offline, key-free operation and honest gaps', () => {
  const j = JSON.parse(cli('doctor').stdout);
  assert.equal(j.offline, true); assert.equal(j.aiApiKeyRequired, false); assert.equal(j.version, pkg.version); assert.ok(j.notImplemented.includes('live observability connectors'));
});
test('skills list shows all 20 roles', () => { const r = cli('skills', 'list'); assert.equal(r.stdout.trim().split(/\r?\n/).length, 20); assert.match(r.stdout, /incidentsutra-prime/); });
test('unknown command exits 1', () => { const r = cli('danger'); assert.equal(r.status, 1); assert.match(r.stderr, /Unknown command/); });
test('analyze requires --input and --out', () => { assert.equal(cli('analyze').status, 1); assert.equal(cli('analyze', '--input', 'fixtures/example-incident').status, 1); });
test('analyze rejects a non-numeric window', () => withTmp(async t => assert.equal(cli('analyze', '--input', 'fixtures/example-incident', '--out', t, '--window-minutes', 'abc').status, 1)));
test('analyze writes MD, HTML, JSON, postmortem, register, JSONL, timeline and provenance', () => withTmp(async t => {
  const r = cli('analyze', '--input', 'fixtures/example-incident', '--out', t);
  assert.equal(r.status, 0, r.stderr);
  const files = await readdir(t);
  for (const f of ['incident-report.json', 'incident-report.md', 'incident-report.html', 'normalized-events.jsonl', 'incident-timeline.json', 'hypothesis-register.md', 'postmortem-draft.md', 'provenance.json']) assert.ok(files.includes(f), f);
  const v = cli('verify', '--report', path.join(t, 'incident-report.json'));
  assert.equal(v.status, 0, v.stderr);
  const prov = JSON.parse(await readFile(path.join(t, 'provenance.json'), 'utf8'));
  assert.match(prov.notice, /not a signature/); assert.ok(prov.outputs.length >= 7);
}));
test('analyze output is byte-identical across runs', () => withTmp(async t => {
  const a = path.join(t, 'a'), b = path.join(t, 'b');
  cli('analyze', '--input', 'fixtures/example-incident', '--out', a); cli('analyze', '--input', 'fixtures/example-incident', '--out', b);
  for (const f of ['incident-report.json', 'incident-report.html', 'incident-report.md']) assert.equal(await readFile(path.join(a, f), 'utf8'), await readFile(path.join(b, f), 'utf8'));
}));
test('analyze --synthetic labels the HTML report', () => withTmp(async t => { cli('analyze', '--input', 'fixtures/example-incident', '--out', t, '--synthetic'); assert.match(await readFile(path.join(t, 'incident-report.html'), 'utf8'), /SYNTHETIC DATA/); }));
test('analyze writes ingestion-errors.json when records are rejected', () => withTmp(async t => {
  const inDir = path.join(t, 'in'); await mkdir(inDir);
  await writeFile(path.join(inDir, 'e.json'), JSON.stringify([{timestamp: '2026-11-10T20:00:00Z', type: 'alert'}, {timestamp: 'bad', type: 'alert'}]));
  const r = cli('analyze', '--input', inDir, '--out', path.join(t, 'o')); assert.equal(r.status, 0, r.stderr);
  assert.ok((await readdir(path.join(t, 'o'))).includes('ingestion-errors.json'));
}));
test('verify fails (exit 2) on a tampered report', () => withTmp(async t => {
  cli('analyze', '--input', 'fixtures/example-incident', '--out', t);
  const f = path.join(t, 'incident-report.json'), j = JSON.parse(await readFile(f, 'utf8')); j.summary.count = 99; await writeFile(f, JSON.stringify(j));
  const v = cli('verify', '--report', f); assert.equal(v.status, 2); assert.match(v.stdout, /digest mismatch/);
}));
test('verify --input detects changed source telemetry', () => withTmp(async t => {
  const inDir = path.join(t, 'in'); await mkdir(inDir);
  await writeFile(path.join(inDir, 'e.json'), JSON.stringify([{timestamp: '2026-11-10T20:00:00Z', type: 'alert', service: 's'}]));
  cli('analyze', '--input', inDir, '--out', path.join(t, 'o'));
  const ok = cli('verify', '--report', path.join(t, 'o/incident-report.json'), '--input', inDir); assert.equal(ok.status, 0, ok.stdout);
  await writeFile(path.join(inDir, 'e.json'), JSON.stringify([{timestamp: '2026-11-10T20:00:01Z', type: 'alert', service: 's'}]));
  assert.equal(cli('verify', '--report', path.join(t, 'o/incident-report.json'), '--input', inDir).status, 2);
}));
test('compare works on two verified reports and rejects invalid ones', () => withTmp(async t => {
  cli('analyze', '--input', 'fixtures/example-incident', '--out', path.join(t, 'a')); cli('analyze', '--input', 'fixtures/edge-cases/missing-metrics.json', '--out', path.join(t, 'b'));
  const r = cli('compare', '--baseline', path.join(t, 'a/incident-report.json'), '--candidate', path.join(t, 'b/incident-report.json')); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).schema, 'incidentsutra.comparison.v1');
  await writeFile(path.join(t, 'bad.json'), '{"schema":"x"}'); assert.equal(cli('compare', '--baseline', path.join(t, 'bad.json'), '--candidate', path.join(t, 'a/incident-report.json')).status, 1);
}));
test('redact preview prints counts but never raw values', () => {
  const r = cli('redact', '--input', 'fixtures/example-incident'); assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout).redactionsAppliedAtIngest >= 2); assert.ok(!r.stdout.includes('jane@example.org'));
});
test('benchmark passes all 26 cases', () => { const r = cli('benchmark'); assert.equal(r.status, 0, r.stdout); assert.equal(JSON.parse(r.stdout).cases, 26); });
test('audit passes, writes JSON, MD and HTML', () => withTmp(async t => {
  const r = cli('audit', '--out', t); const j = JSON.parse(r.stdout);
  assert.equal(r.status, 0, r.stdout); assert.notEqual(j.verdict, 'FAIL');
  const files = await readdir(t); for (const f of ['audit-report.json', 'audit-report.md', 'audit-report.html']) assert.ok(files.includes(f), f);
}));
test('skill installer requires host and project', () => { assert.equal(cli('skills', 'install', '--host', 'cursor').status, 1); assert.equal(cli('skills', 'install', '--project', '.').status, 1); });
test('skill installer rejects unknown hosts', () => withTmp(async t => assert.equal(cli('skills', 'install', '--host', 'vim', '--project', t).status, 1)));
for (const [host, dir] of [['claude', '.claude/skills'], ['cursor', '.cursor/skills'], ['codex', '.agents/skills'], ['gemini', '.gemini/skills'], ['copilot', '.github/skills']]) {
  test(`skill installer installs 20 skills project-locally for ${host}`, () => withTmp(async t => {
    const r = cli('skills', 'install', '--host', host, '--project', t); assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).installed, 20); assert.match(await readFile(path.join(t, dir, 'incidentsutra-prime/SKILL.md'), 'utf8'), /IncidentSutra/);
  }));
}
test('skill installer refuses to overwrite', () => withTmp(async t => {
  assert.equal(cli('skills', 'install', '--host', 'codex', '--project', t).status, 0);
  const r = cli('skills', 'install', '--host', 'codex', '--project', t); assert.equal(r.status, 1); assert.match(r.stderr, /overwrite/);
}));
test('serve requires a strong token and a valid report', () => withTmp(async t => {
  cli('analyze', '--input', 'fixtures/example-incident', '--out', t);
  const r = cli('serve', '--report', path.join(t, 'incident-report.json')); assert.equal(r.status, 1); assert.match(r.stderr, /TOKEN/);
  assert.equal(cli('serve', '--report', path.join(t, 'incident-report.json'), '--port', '99999').status, 1);
}));
