import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {redact, redactString, newRedactionStats, normalizeRecord} from '../packages/core/ingest.mjs';
import {analyzeIncident, toHTML, toMarkdown, toPostmortem, verifyReport} from '../packages/core/analyze.mjs';
import {SECRET_CORPUS, INJECTION_CORPUS} from '../packages/core/audit.mjs';

const SRC = {file: 'x', sha256: 'd'.repeat(64)};
for (const [name, text, needle] of SECRET_CORPUS) {
  test(`redacts ${name}`, () => assert.ok(!redactString(text).includes(needle), `${name} leaked`));
}
test('redaction counts are tracked by kind', () => {
  const s = newRedactionStats();
  redactString('mail a@b.io and 203.0.113.9', s);
  assert.equal(s.count, 2);
  assert.equal(s.byKind.email, 1);
  assert.equal(s.byKind.ipv4, 1);
});
test('authorization header value is fully masked (no dangling scheme)', () => assert.equal(redactString('Authorization: Bearer abcdefghij123'), 'Authorization: [REDACTED]'));
test('benign text is preserved', () => {
  const t = 'p95 latency 2100ms, error rate 8%, release v2.7.0 on pod web-3 at 10:04';
  assert.equal(redactString(t), t);
});
test('non-Luhn long numbers are not treated as cards', () => assert.equal(redactString('id 1234 5678 9012 3456'), 'id 1234 5678 9012 3456'));
test('sensitive object keys are masked at any depth', () => {
  const o = redact({a: {b: {password: 'x', apiKey: 'y', session_id: 'z', keep: 1}}});
  assert.deepEqual(o.a.b, {password: '[REDACTED]', apiKey: '[REDACTED]', session_id: '[REDACTED]', keep: 1});
});
test('secrets inside arrays are masked', () => assert.ok(!JSON.stringify(redact(['ok', 'token=abcdef123456'])).includes('abcdef123456')));
test('secrets in service, type and message fields are masked', () => {
  const e = normalizeRecord({timestamp: '2026-11-10T10:00:00Z', service: 'svc password=hunter2xx', type: 'err', message: 'mail bob@x.io'}, SRC, 1);
  assert.ok(!e.service.includes('hunter2xx'));
  assert.ok(!e.message.includes('bob@x.io'));
});
test('redaction is idempotent', () => { const once = redactString('mail a@b.io token=zzzzzz1234'); assert.equal(redactString(once), once); });
test('redaction survives very long hostile input quickly', () => {
  const t0 = Date.now(); redactString('a'.repeat(200000) + ' ' + '1 '.repeat(50000));
  assert.ok(Date.now() - t0 < 3000, 'regex backtracking too slow');
});
test('no secret from the corpus reaches JSON, Markdown, HTML or postmortem outputs', () => {
  const events = SECRET_CORPUS.map(([, text], i) => normalizeRecord({timestamp: `2026-11-10T10:0${i % 10}:00Z`, type: 'error', service: 'api', severity: 'error', message: text, attributes: {n: text}}, SRC, i + 1));
  const r = analyzeIncident({events});
  const all = [JSON.stringify(r), toMarkdown(r), toHTML(r), toPostmortem(r)].join('\n');
  for (const [name, , needle] of SECRET_CORPUS) assert.ok(!all.includes(needle), `${name} leaked`);
});
test('prompt-injection payloads change nothing and verify cleanly', () => {
  const events = INJECTION_CORPUS.map((m, i) => normalizeRecord({timestamp: `2026-11-10T10:0${i}:00Z`, type: 'error', service: 'api', severity: 'error', message: m}, SRC, i + 1));
  const r = analyzeIncident({events});
  assert.equal(r.decision.status, 'HUMAN_REVIEW_REQUIRED');
  assert.ok(r.hypotheses.every(h => h.status === 'unconfirmed'));
  assert.ok(!/"executed":true/.test(JSON.stringify(r)));
  assert.equal(verifyReport(r).ok, true);
});
test('hostile markup is escaped in HTML', () => {
  const events = INJECTION_CORPUS.map((m, i) => normalizeRecord({timestamp: `2026-11-10T10:0${i}:00Z`, type: 'error', service: '<b>x</b>', severity: 'error', message: m}, SRC, i + 1));
  const h = toHTML(analyzeIncident({events}));
  assert.ok(!/<(script|img)\b/i.test(h)); assert.ok(!h.includes('<b>x</b>'));
});

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) { const f = path.join(dir, n); if (statSync(f).isDirectory()) walk(f, out); else if (f.endsWith('.mjs')) out.push(f); }
  return out;
}
test('product code never spawns processes, opens outbound sockets or evaluates dynamic code', () => {
  const bad = [];
  for (const f of walk('packages').filter(x => !x.endsWith(path.join('core', 'audit.mjs')))) {
    const src = readFileSync(f, 'utf8');
    for (const re of [/child_process/, /node:net['"]/, /node:https/, /\bfetch\s*\(/, /\beval\s*\(/, /new Function\s*\(/]) if (re.test(src)) bad.push(`${f}: ${re}`);
    if (/node:http['"]/.test(src) && !f.endsWith(path.join('server', 'index.mjs'))) bad.push(`${f}: http`);
  }
  assert.deepEqual(bad, []);
});
test('policy file denies network, exec, remote writes and auto-mitigation', () => {
  const p = JSON.parse(readFileSync('policies/default.json', 'utf8'));
  assert.deepEqual([p.mode, p.network, p.exec, p.remoteWrite, p.autoMitigation, p.statusPagePublishing], ['read-only', false, false, false, false, false]);
});
test('package has zero dependencies', () => {
  const p = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.deepEqual(Object.keys({...p.dependencies, ...p.devDependencies}), []);
  assert.notEqual(p.private, true);
});
