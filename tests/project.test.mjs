import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {runBenchmark, CASES} from '../packages/core/benchmark.mjs';
import {runAudit} from '../packages/core/audit.mjs';
import {auditToMarkdown, auditToHTML} from '../packages/reporter/audit.mjs';
import {validate} from '../packages/core/schema.mjs';

const manifest = JSON.parse(readFileSync('agents/manifest.json', 'utf8'));

test('benchmark has 26 case families, each with expectations', () => { assert.equal(CASES.length, 26); assert.ok(CASES.every(c => c.expect.length >= 1)); assert.equal(new Set(CASES.map(c => c.id)).size, 26); });
test('every benchmark case passes', () => { const b = runBenchmark(); assert.deepEqual(b.results.filter(r => !r.pass).map(r => r.id), []); assert.match(b.labelProvenance, /not independently validated/); });
test('benchmark detects a deliberately wrong expectation', () => {
  const b = runBenchmark([{id: 'X', family: 'f', title: 't', rows: [{timestamp: '2026-11-10T10:00:00Z', type: 'error', service: 'a', severity: 'error'}], expect: [['impossible', () => false]]}]);
  assert.equal(b.casesPassed, 0);
});
test('automated audit passes on this repository', async () => {
  const a = await runAudit({root: process.cwd()});
  assert.deepEqual(a.checks.filter(c => c.status === 'fail').map(c => `${c.id} ${c.detail}`), []);
  assert.ok(a.checks.length >= 20); assert.match(a.nature, /not a third-party/);
});
test('audit renders MD and HTML with every check and an honest disclaimer', async () => {
  const a = await runAudit({root: process.cwd()}), md = auditToMarkdown(a), html = auditToHTML(a);
  for (const c of a.checks) { assert.ok(md.includes(c.id)); assert.ok(html.includes(c.id)); }
  assert.match(md, /Limitations/); assert.match(html, /not a certification/); assert.ok(!/<script/i.test(html));
});
test('audit fails when a required file is missing (negative control)', async () => {
  const a = await runAudit({root: process.cwd() + '/fixtures'});
  assert.equal(a.verdict, 'FAIL');
});
test('mini schema validator catches type, const, enum, pattern, required and nested errors', () => {
  const s = {type: 'object', required: ['a'], properties: {a: {type: 'string', pattern: '^x'}, b: {const: 1}, c: {enum: [1, 2]}, d: {type: 'array', items: {type: 'number'}}}};
  assert.equal(validate(s, {a: 'xy', b: 1, c: 2, d: [1]}).ok, true);
  for (const bad of [{}, {a: 'y'}, {a: 'x', b: 2}, {a: 'x', c: 3}, {a: 'x', d: ['s']}, {a: 5}]) assert.equal(validate(s, bad).ok, false);
});
test('manifest lists 20 unique agents with matching skill and role files', () => {
  assert.equal(manifest.agents.length, 20); assert.equal(new Set(manifest.agents.map(a => a.id)).size, 20);
  for (const a of manifest.agents) { assert.ok(existsSync(a.skill), a.skill); assert.ok(existsSync(a.claude), a.claude); assert.ok(a.backing); }
});
test('skills directory contains exactly the manifest skills', () => assert.deepEqual(readdirSync('skills').sort(), manifest.agents.map(a => a.id).sort()));
for (const a of manifest.agents) {
  test(`${a.id}: valid frontmatter, required sections and guardrails`, () => {
    const t = readFileSync(a.skill, 'utf8'), fm = /^---\r?\nname: (.+?)\r?\ndescription: (.+?)\r?\n---/.exec(t);
    assert.ok(fm, 'frontmatter'); assert.equal(fm[1], a.id); assert.ok(fm[2].length >= 40 && fm[2].length <= 400);
    for (const h of ['## Mission', '## When to use', '## Inputs', '## Workflow', '## Output contract', '## Hard rules', '## Escalate']) assert.ok(t.includes(h), h);
    assert.match(t, /No autonomous/); assert.match(t, /untrusted/); assert.match(t, /schemas\/agent-output\.schema\.json/);
  });
}
test('skills are role specific, not one template with a swapped line', () => {
  const steps = manifest.agents.map(a => /## Workflow\r?\n([\s\S]*?)\r?\n\r?\n## Output/.exec(readFileSync(a.skill, 'utf8'))[1]);
  assert.equal(new Set(steps).size, 20);
});
test('generated skills are in sync with scripts/build-skills.mjs', async () => {
  const {spawnSync} = await import('node:child_process');
  const r = spawnSync(process.execPath, ['scripts/build-skills.mjs', '--check'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
});
test('plugin manifest version matches package.json', () => {
  const p = JSON.parse(readFileSync('package.json', 'utf8')), c = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
  assert.equal(c.version, p.version); assert.equal(c.name, 'incidentsutra');
});
test('compatibility matrix never marks host activation as tested without evidence', () => {
  const m = JSON.parse(readFileSync('compatibility-matrix.json', 'utf8'));
  for (const h of m.hosts) { assert.ok(['tested', 'not-tested', 'unsupported', 'experimental'].includes(h.activation)); if (h.activation === 'tested') assert.ok(h.evidence, h.host); }
});
