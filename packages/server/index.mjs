import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';

function secureEqual(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
const HOST_OK = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/i;

// Loopback-only, bearer-token, GET-only report reader. Not an Internet-facing service.
export function startServer({report, port = 0, token}) {
  if (!token || token.length < 24) throw new Error('A strong local server token is required');
  const routes = {
    '/health': () => ({ok: true, mode: 'localhost-read-only'}),
    '/v1/report': () => report,
    '/v1/summary': () => ({reportId: report.reportId, summary: report.summary, decision: report.decision}),
    '/v1/timeline': () => report.timeline,
    '/v1/events': () => report.events,
    '/v1/hypotheses': () => report.hypotheses,
    '/v1/gaps': () => report.gaps
  };
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (req.method !== 'GET') { res.writeHead(405, {Allow: 'GET'}); res.end('Method not allowed'); return; }
    if (!HOST_OK.test(String(req.headers.host ?? ''))) { res.writeHead(403); res.end('Forbidden host'); return; }
    if (!secureEqual(String(req.headers.authorization ?? ''), `Bearer ${token}`)) { res.writeHead(401, {'WWW-Authenticate': 'Bearer'}); res.end('Unauthorized'); return; }
    const key = (req.url ?? '').split('?')[0].replace(/\/+$/, '') || '/';
    const route = Object.hasOwn(routes, key) ? routes[key] : null;
    if (!route) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify(route()));
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 50;
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}
