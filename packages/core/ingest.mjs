import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {EVENT_SCHEMA} from './meta.mjs';

export const MAX_FILE_BYTES = 2_000_000;
export const MAX_EVENTS = 5000;
export const MAX_FILES = 100;
const MAX_DEPTH = 8;
const allowedExtensions = new Set(['.json', '.jsonl', '.ndjson', '.csv']);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const clamp = (value, n = 1000) => String(value ?? '').slice(0, n);

// ---------------------------------------------------------------- redaction
// Best-effort masking only. It is NOT data-loss prevention: sanitize exports upstream.
const SENSITIVE_KEY = /(secret|passw(?:or)?d|passwd|pwd|token|api[_-]?key|apikey|authorization|cookie|credential|private[_-]?key|access[_-]?key|session[_-]?id)/i;
const luhn = digits => {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};
const RULES = [
  ['private_key', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED_PRIVATE_KEY]'],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '[REDACTED_JWT]'],
  ['url_credentials', /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1[REDACTED]@'],
  ['key_value', /\b(?:password|passwd|pwd|secret|client[_-]?secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|authorization|cookie|session[_-]?id)\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?[^\s,;&]+/gi, m => m.replace(/([:=]\s*)(?:(?:Bearer|Basic)\s+)?[^\s,;&]+$/i, '$1[REDACTED]')],
  ['bearer', /\bBearer\s+[A-Za-z0-9_.~+/=-]{8,}/gi, 'Bearer [REDACTED]'],
  ['token_prefix', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk_(?:live|test)_[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|npm_[A-Za-z0-9]{30,})/g, '[REDACTED_TOKEN]'],
  ['aws_key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]'],
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]'],
  ['card', /\b(?:\d[ -]?){13,19}\b/g, (m) => { const d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d) ? '[REDACTED_CARD]' : m; }],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]'],
  ['ipv4', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, '[REDACTED_IP]'],
  ['phone', /(?<![\w.])(?:\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]\d{3}[ -]\d{4}(?![\w])|\+\d{8,15}\b/g, '[REDACTED_PHONE]']
];
export const REDACTION_KINDS = RULES.map(r => r[0]).concat('sensitive_key');

export function newRedactionStats() { return {count: 0, byKind: {}}; }
const bump = (stats, kind) => { if (stats) { stats.count++; stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1; } };

export function redactString(text, stats) {
  let out = String(text);
  for (const [kind, re, rep] of RULES) {
    out = out.replace(re, (...a) => {
      const r = typeof rep === 'function' ? rep(a[0]) : a[0].replace(new RegExp(re.source, re.flags.replace('g', '')), rep);
      if (r !== a[0]) bump(stats, kind);
      return r;
    });
  }
  return out;
}

export function redact(value, stats, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[TRUNCATED_DEPTH]';
  if (Array.isArray(value)) return value.slice(0, 100).map(v => redact(v, stats, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 80).map(([k, v]) => {
      if (SENSITIVE_KEY.test(k)) { bump(stats, 'sensitive_key'); return [k, '[REDACTED]']; }
      return [k, redact(v, stats, depth + 1)];
    }));
  }
  if (typeof value !== 'string') return value;
  return redactString(value, stats);
}

// ---------------------------------------------------------------- time
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/i;
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const TZ_MSG = 'Timestamp must be RFC3339 with explicit Z or +/-HH:MM timezone';

export function parseTimestampDetailed(raw) {
  const m = typeof raw === 'string' ? ISO.exec(raw.trim()) : null;
  if (!m) throw new Error(TZ_MSG);
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) throw new Error('Invalid calendar date');
  if (h > 23 || mi > 59) throw new Error('Invalid time of day');
  if (s > 59) throw new Error('Leap seconds / second 60 are not supported; supply a normalized time');
  let offsetMin = 0;
  if (m[8].toUpperCase() !== 'Z') {
    const sign = m[8][0] === '-' ? -1 : 1;
    const oh = Number(m[8].slice(1, 3)), om = Number(m[8].slice(4, 6));
    if (oh > 23 || om > 59) throw new Error('Invalid UTC offset');
    offsetMin = sign * (oh * 60 + om);
  }
  const frac = (m[7] ?? '').padEnd(9, '0');
  const epochMs = Date.UTC(y, mo - 1, d, h, mi, s) - offsetMin * 60_000;
  if (!Number.isFinite(epochMs)) throw new Error('Timestamp out of range');
  const ns = (BigInt(epochMs) * 1_000_000n + BigInt(frac || '0')).toString();
  const len = (m[7] ?? '').length;
  return {
    iso: new Date(epochMs + Number(frac.slice(0, 3))).toISOString(),
    ns,
    precision: len === 0 ? 's' : len <= 3 ? 'ms' : len <= 6 ? 'us' : 'ns',
    offset: m[8].toUpperCase() === 'Z' ? 'Z' : m[8]
  };
}
export const parseTimestamp = raw => parseTimestampDetailed(raw).iso;

export function otelNanosDetailed(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('OpenTelemetry timestamp must be a string of digits (JSON numbers lose nanosecond precision)');
  const s = String(value ?? '');
  if (!/^\d{1,21}$/.test(s)) throw new Error('Invalid OpenTelemetry timestamp nanoseconds');
  const ms = Number(BigInt(s) / 1_000_000n);
  if (!Number.isSafeInteger(ms) || !Number.isFinite(new Date(ms).getTime())) throw new Error('OpenTelemetry timestamp out of range');
  return {iso: new Date(ms).toISOString(), ns: BigInt(s).toString(), precision: 'ns', offset: 'Z'};
}
export const otelNanosecondsToISO = value => otelNanosDetailed(value).iso;

// ---------------------------------------------------------------- normalization
const KNOWN = new Set(['timestamp', 'time', 'timeISO', 'observedTimestamp', 'timeUnixNano', 'observedTimeUnixNano', 'type', 'eventType', 'eventName', 'service', 'serviceName', 'resource', 'severity', 'severityText', 'severityNumber', 'message', 'body', 'traceId', 'trace_id', 'spanId', 'span_id', 'deploymentId', 'releaseId', 'environment', 'env', 'metricValue', 'value', 'attributes', 'dimensions']);

function otelAttrs(list) {
  if (!Array.isArray(list)) return list && typeof list === 'object' ? list : {};
  return Object.fromEntries(list.filter(a => a && typeof a.key === 'string').slice(0, 80).map(a => {
    const v = a.value ?? {};
    return [a.key, v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? (typeof v === 'string' ? v : '')];
  }));
}
function bodyText(body) {
  if (typeof body === 'string') return body;
  if (body?.stringValue !== undefined) return body.stringValue;
  if (typeof body?.value === 'string') return body.value;
  return body === undefined ? '' : JSON.stringify(body).slice(0, 1500);
}
const nonEmpty = v => v !== undefined && v !== null && v !== '';

export function normalizeRecord(item, source, index, ctx = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Incident event must be a JSON object');
  const stats = ctx.stats;
  const warnings = [];
  let t, original, basis = 'event';
  const eventRaw = item.timestamp ?? item.time ?? item.timeISO;
  if (nonEmpty(eventRaw)) { t = parseTimestampDetailed(eventRaw); original = String(eventRaw); }
  else if (nonEmpty(item.timeUnixNano) && String(item.timeUnixNano) !== '0') { t = otelNanosDetailed(item.timeUnixNano); original = String(item.timeUnixNano); }
  else if (nonEmpty(item.observedTimestamp)) { t = parseTimestampDetailed(item.observedTimestamp); original = String(item.observedTimestamp); basis = 'observed'; }
  else if (nonEmpty(item.observedTimeUnixNano) && String(item.observedTimeUnixNano) !== '0') { t = otelNanosDetailed(item.observedTimeUnixNano); original = String(item.observedTimeUnixNano); basis = 'observed'; }
  else throw new Error('Missing timestamp');
  if (basis === 'observed') warnings.push('event time absent; collector observed time used (event may have occurred earlier)');
  if (t.precision === 'ns' || t.precision === 'us') warnings.push(`${t.precision} precision retained in timestampNs; ISO output is millisecond precision`);
  let observedTimestamp;
  if (basis === 'event' && nonEmpty(item.observedTimestamp)) { try { observedTimestamp = parseTimestampDetailed(item.observedTimestamp).iso; } catch { warnings.push('observedTimestamp invalid and ignored'); } }

  const rawAttrs = otelAttrs(item.attributes);
  const resAttrs = otelAttrs(item.resource?.attributes);
  const attrs = redact(rawAttrs, stats);
  const dimensions = {};
  for (const [k, v] of Object.entries(item)) {
    if (KNOWN.has(k) || Object.keys(dimensions).length >= 20) continue;
    if (['string', 'number', 'boolean'].includes(typeof v)) dimensions[clamp(k, 60)] = redact(typeof v === 'string' ? clamp(v, 200) : v, stats);
  }
  if (item.dimensions && typeof item.dimensions === 'object') Object.assign(dimensions, redact(item.dimensions, stats));
  const type = redactString(clamp(item.type ?? item.eventType ?? item.eventName ?? (item.severityNumber >= 17 ? 'error' : 'log'), 60), stats).toLowerCase();
  const service = redactString(clamp(item.service ?? item.serviceName ?? item.resource?.service?.name ?? resAttrs['service.name'] ?? rawAttrs['service.name'] ?? 'unknown', 80), stats);
  const message = redactString(clamp(item.message ?? bodyText(item.body) ?? '', 1200), stats);
  const rawValue = item.metricValue ?? (typeof item.value === 'number' ? item.value : undefined) ?? (typeof item.value === 'string' && item.value.trim() !== '' && Number.isFinite(Number(item.value)) ? Number(item.value) : undefined);
  const id = 'evt_' + sha256(`${source.sha256}:${source.file}:${index}:${t.iso}`).slice(0, 20);
  const ev = {
    id, schema: EVENT_SCHEMA, timestamp: t.iso, timestampNs: t.ns, timePrecision: t.precision, timeBasis: basis,
    originalTimestamp: redactString(clamp(original, 64), stats), originalOffset: t.offset,
    type, eventType: type, service,
    environment: redactString(clamp(item.environment ?? item.env ?? resAttrs['deployment.environment'] ?? rawAttrs['deployment.environment'] ?? '', 40), stats),
    severity: clamp(item.severity ?? item.severityText ?? 'info', 24).toLowerCase(),
    message,
    traceId: redactString(clamp(item.traceId ?? item.trace_id ?? '', 80), stats),
    spanId: redactString(clamp(item.spanId ?? item.span_id ?? '', 40), stats),
    deployment: redactString(clamp(item.deploymentId ?? item.releaseId ?? attrs?.deploymentId ?? '', 100), stats),
    releaseId: redactString(clamp(item.releaseId ?? '', 100), stats),
    attributes: attrs, dimensions,
    confidenceClass: 'observed',
    sensitivityClass: 'best-effort-redacted',
    ingestionWarnings: warnings,
    source: {...source, record: index}
  };
  if (observedTimestamp) ev.observedTimestamp = observedTimestamp;
  if (rawValue !== undefined && Number.isFinite(rawValue)) ev.metricValue = rawValue;
  return ev;
}

// ---------------------------------------------------------------- parsing
function parseCSV(text) {
  const records = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.length)) records.push(row); row = []; }
    else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quoted value');
  row.push(cell); if (row.some(x => x.length)) records.push(row);
  if (!records.length) return [];
  const columns = records.shift().map(c => c.replace(/^﻿/, '').trim());
  return records.map(r => Object.fromEntries(columns.map((name, i) => [name, r[i] ?? ''])));
}
function unwrapJson(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.records)) return data.records;
    if (Array.isArray(data.resourceLogs)) {
      const out = [];
      for (const r of data.resourceLogs) {
        const resourceAttrs = otelAttrs(r.resource?.attributes);
        for (const sl of r.scopeLogs ?? []) for (const log of sl.logRecords ?? []) out.push({...log, service: resourceAttrs['service.name'] ?? 'unknown', resource: {attributes: r.resource?.attributes}});
      }
      return out;
    }
  }
  return [data];
}
export function parseRecords(content, ext) {
  if (ext === '.jsonl' || ext === '.ndjson') return content.split(/\r?\n/).filter(x => x.trim()).map((s, i) => { try { return JSON.parse(s); } catch { throw new Error(`Invalid JSON line ${i + 1}`); } });
  if (ext === '.csv') return parseCSV(content);
  return unwrapJson(JSON.parse(content));
}

async function enumerate(input, skipped, base) {
  const st = await fs.lstat(input);
  if (st.isSymbolicLink()) throw new Error('Symlink input is not permitted');
  if (st.isFile()) return allowedExtensions.has(path.extname(input).toLowerCase()) ? [input] : [];
  if (!st.isDirectory()) throw new Error('Unsupported input type');
  const out = [];
  for (const ent of (await fs.readdir(input, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(input, ent.name), rel = path.relative(base, full).replaceAll('\\', '/');
    if (ent.isSymbolicLink()) { skipped.push({file: redactString(rel), reason: 'symlink'}); continue; }
    if (ent.isDirectory()) out.push(...await enumerate(full, skipped, base));
    else if (ent.isFile() && allowedExtensions.has(path.extname(ent.name).toLowerCase())) out.push(full);
    else if (ent.isFile()) skipped.push({file: redactString(rel), reason: 'unsupported extension'});
    if (out.length > MAX_FILES) throw new Error(`Too many telemetry files (max ${MAX_FILES})`);
  }
  return out;
}

const cmpBig = (a, b) => { const x = BigInt(a), y = BigInt(b); return x < y ? -1 : x > y ? 1 : 0; };
export const compareEvents = (a, b) => a.timestamp.localeCompare(b.timestamp) || cmpBig(a.timestampNs, b.timestampNs) || a.source.file.localeCompare(b.source.file) || a.source.record - b.source.record || a.id.localeCompare(b.id);

export async function loadEvents(input) {
  const base = path.resolve(input), skipped = [];
  const paths = await enumerate(base, skipped, base);
  if (!paths.length) throw new Error('No supported .json/.jsonl/.ndjson/.csv telemetry input');
  const out = [], files = [], errors = [], duplicates = [], seen = new Map(), stats = newRedactionStats();
  for (const file of paths) {
    const stat = await fs.stat(file);
    if (stat.size > MAX_FILE_BYTES) throw new Error(`Input too large: ${path.basename(file)}`);
    const bytes = await fs.readFile(file);
    const rel = paths.length === 1 ? path.basename(file) : path.relative(base, file).replaceAll('\\', '/');
    const source = {file: redactString(rel), sha256: sha256(bytes)};
    let records;
    try { records = parseRecords(bytes.toString('utf8'), path.extname(file).toLowerCase()); }
    catch (e) { errors.push({file: source.file, record: 0, error: `File could not be parsed: ${String(e.message).slice(0, 160)}`}); files.push({file: source.file, sha256: source.sha256, records: 0, parsed: false}); continue; }
    files.push({file: source.file, sha256: source.sha256, records: records.length, parsed: true});
    for (let i = 0; i < records.length; i++) {
      let ev;
      try { ev = normalizeRecord(records[i], source, i + 1, {stats}); }
      catch (e) { errors.push({file: source.file, record: i + 1, error: String(e.message).slice(0, 200)}); continue; }
      const key = [ev.timestampNs, ev.service, ev.type, ev.severity, ev.message, ev.traceId, ev.deployment].join('\u0001');
      const prior = seen.get(key);
      if (prior && prior.source.file !== ev.source.file) { duplicates.push({id: ev.id, duplicateOf: prior.id, file: ev.source.file, record: i + 1}); continue; }
      seen.set(key, ev); out.push(ev);
      if (out.length > MAX_EVENTS) throw new Error(`Event limit exceeded (${MAX_EVENTS})`);
    }
  }
  if (!out.length) throw new Error('No valid timestamped incident events in input');
  out.sort(compareEvents);
  const offsets = {}, precisions = {}, bases = {};
  for (const e of out) { offsets[e.originalOffset] = (offsets[e.originalOffset] ?? 0) + 1; precisions[e.timePrecision] = (precisions[e.timePrecision] ?? 0) + 1; bases[e.timeBasis] = (bases[e.timeBasis] ?? 0) + 1; }
  const quality = {
    utcOffsets: offsets, timePrecisions: precisions, timeBasis: bases,
    mixedOffsets: Object.keys(offsets).length > 1,
    clockSkew: 'unassessed',
    note: 'Wall-clock ordering across hosts and regions is not proof of causal order; clock skew between sources was not measured.'
  };
  return {events: out, files, ingestionErrors: errors, skipped, duplicates, quality, redaction: {...stats, policy: 'best-effort, not DLP'}};
}
