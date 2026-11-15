import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startServer} from '../packages/server/index.mjs';

const token = 'a-very-long-secret-token-for-local-server';
const report = {timeline: [1], hypotheses: [2], events: [3], gaps: [4], summary: {count: 1}, decision: {status: 'x'}, reportId: 'inc_x', foo: 'bar'};
async function withServer(fn) {
  const server = await startServer({report, token});
  try { await fn(server.address().port, server); } finally { await new Promise(r => server.close(r)); }
}
const req = (port, p, {method = 'GET', headers = {}} = {}) => new Promise((resolve, reject) => {
  const q = http.request({host: '127.0.0.1', port, path: p, method, headers}, res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: b})); });
  q.on('error', reject); q.end();
});
const auth = {authorization: `Bearer ${token}`};

test('requires a strong token', () => { assert.throws(() => startServer({report: {}, token: 'abc'}), /strong/); assert.throws(() => startServer({report: {}}), /strong/); });
test('binds to loopback only', () => withServer((port, s) => assert.equal(s.address().address, '127.0.0.1')));
test('rejects missing and wrong credentials', () => withServer(async port => {
  assert.equal((await req(port, '/v1/report')).status, 401);
  assert.equal((await req(port, '/v1/report', {headers: {authorization: 'Bearer wrong'}})).status, 401);
  assert.equal((await req(port, '/v1/report', {headers: {authorization: token}})).status, 401);
}));
test('serves authorised endpoints as JSON', () => withServer(async port => {
  for (const [p, key] of [['/v1/report', 'foo'], ['/health', 'ok']]) { const r = await req(port, p, {headers: auth}); assert.equal(r.status, 200); assert.match(r.headers['content-type'], /json/); assert.ok(key in JSON.parse(r.body)); }
  for (const p of ['/v1/timeline', '/v1/hypotheses', '/v1/events', '/v1/gaps', '/v1/summary']) assert.equal((await req(port, p, {headers: auth})).status, 200);
}));
test('ignores query strings and trailing slashes', () => withServer(async port => assert.equal((await req(port, '/v1/report/?x=1', {headers: auth})).status, 200)));
test('blocks every write verb', () => withServer(async port => { for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) { const r = await req(port, '/v1/report', {method: m, headers: auth}); assert.equal(r.status, 405); assert.equal(r.headers.allow, 'GET'); } }));
test('does not expose arbitrary or traversal paths', () => withServer(async port => {
  for (const p of ['/private.json', '/etc/passwd', '/v1/../package.json', '/__proto__', '/constructor', '/toString']) assert.equal((await req(port, p, {headers: auth})).status, 404, p);
}));
test('rejects forged Host headers (DNS rebinding)', () => withServer(async port => assert.equal((await req(port, '/v1/report', {headers: {...auth, host: 'evil.example'}})).status, 403)));
test('sets hardening headers', () => withServer(async port => {
  const h = (await req(port, '/health', {headers: auth})).headers;
  assert.equal(h['cache-control'], 'no-store'); assert.equal(h['x-content-type-options'], 'nosniff'); assert.match(h['content-security-policy'], /default-src 'none'/);
}));
