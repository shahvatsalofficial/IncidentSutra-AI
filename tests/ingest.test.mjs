import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {loadEvents, parseTimestamp, parseTimestampDetailed, otelNanosecondsToISO, parseRecords, normalizeRecord, MAX_EVENTS} from '../packages/core/ingest.mjs';
import {withTmp, trySymlink} from './helpers.mjs';

const SRC = {file: 't.json', sha256: 'f'.repeat(64)};
const fixture = 'fixtures/example-incident';

test('normalizes +05:30 to UTC', () => assert.equal(parseTimestamp('2026-11-11T01:15:00+05:30'), '2026-11-10T19:45:00.000Z'));
test('normalizes negative offsets', () => assert.equal(parseTimestamp('2026-11-10T10:00:00-08:00'), '2026-11-10T18:00:00.000Z'));
test('midnight rollover across the date line', () => assert.equal(parseTimestamp('2026-11-11T00:30:00+05:30'), '2026-11-10T19:00:00.000Z'));
test('accepts a leap day', () => assert.equal(parseTimestamp('2028-02-29T00:00:00Z'), '2028-02-29T00:00:00.000Z'));
for (const bad of ['2026-11-11T01:15:00', 'tomorrow', '2026-02-30T00:00:00Z', '2027-02-29T00:00:00Z', '2026-13-01T00:00:00Z', '2026-11-10T24:00:00Z', '2026-11-10T10:60:00Z', '2026-11-10T10:00:60Z', '2026-11-10T10:00:00+25:00', '2026-11-10 10:00:00Z', '', null, 12345]) {
  test(`rejects timestamp ${JSON.stringify(bad)}`, () => assert.throws(() => parseTimestamp(bad)));
}
test('precision classification', () => {
  assert.equal(parseTimestampDetailed('2026-11-10T10:00:00Z').precision, 's');
  assert.equal(parseTimestampDetailed('2026-11-10T10:00:00.123Z').precision, 'ms');
  assert.equal(parseTimestampDetailed('2026-11-10T10:00:00.123456Z').precision, 'us');
  assert.equal(parseTimestampDetailed('2026-11-10T10:00:00.123456789Z').precision, 'ns');
});
test('nanosecond remainder is preserved as an integer string', () => assert.equal(parseTimestampDetailed('2026-11-10T10:00:00.123456789Z').ns.slice(-9), '123456789'));
test('OTel ns converts without float loss', () => assert.equal(otelNanosecondsToISO('1794354000000000000'), new Date(1794354000000).toISOString()));
test('OTel rejects non-numeric and unsafe JSON numbers', () => {
  assert.throws(() => otelNanosecondsToISO('foo'));
  assert.throws(() => normalizeRecord({timeUnixNano: 1794354000000000001, type: 'x'}, SRC, 1), /string of digits/);
});
test('OTel timeUnixNano "0" means unset and falls back to observed time with a warning', () => {
  const e = normalizeRecord({timeUnixNano: '0', observedTimeUnixNano: '1794354000000000000', type: 'x'}, SRC, 1);
  assert.equal(e.timeBasis, 'observed');
  assert.ok(e.ingestionWarnings.some(w => /observed time/.test(w)));
});
test('event time wins over observed time and both are kept', () => {
  const e = normalizeRecord({timestamp: '2026-11-10T10:00:00Z', observedTimestamp: '2026-11-10T10:00:05Z', type: 'x'}, SRC, 1);
  assert.equal(e.timeBasis, 'event');
  assert.equal(e.observedTimestamp, '2026-11-10T10:00:05.000Z');
});
test('event ids are stable and content-addressed', () => {
  const a = normalizeRecord({timestamp: '2026-11-10T10:00:00Z', type: 'x'}, SRC, 1);
  const b = normalizeRecord({timestamp: '2026-11-10T10:00:00Z', type: 'x'}, SRC, 1);
  const c = normalizeRecord({timestamp: '2026-11-10T10:00:00Z', type: 'x'}, SRC, 2);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.match(a.id, /^evt_[0-9a-f]{20}$/);
});
test('rejects non-object events', () => { for (const bad of [null, [], 'x', 5]) assert.throws(() => normalizeRecord(bad, SRC, 1), /JSON object/); });
test('rejects missing timestamp', () => assert.throws(() => normalizeRecord({type: 'error'}, SRC, 1), /Missing timestamp/));
test('OTel attribute arrays are flattened', () => {
  const e = normalizeRecord({timestamp: '2026-11-10T10:00:00Z', attributes: [{key: 'http.status', value: {intValue: 503}}, {key: 'k', value: {stringValue: 'v'}}]}, SRC, 1);
  assert.equal(e.attributes['http.status'], 503);
  assert.equal(e.attributes.k, 'v');
});
test('metric value captured from numeric value field', () => assert.equal(normalizeRecord({timestamp: '2026-11-10T10:00:00Z', type: 'metric', value: 12.5}, SRC, 1).metricValue, 12.5));
test('extra CSV-style columns become dimensions', () => assert.equal(normalizeRecord({timestamp: '2026-11-10T10:00:00Z', region: 'eu-west-1'}, SRC, 1).dimensions.region, 'eu-west-1'));
test('prototype pollution keys do not alter Object', () => {
  const e = normalizeRecord(JSON.parse('{"timestamp":"2026-11-10T10:00:00Z","attributes":{"__proto__":{"polluted":true}}}'), SRC, 1);
  assert.equal({}.polluted, undefined);
  assert.ok(e);
});
test('deeply nested attributes are truncated, not recursed forever', () => {
  let o = {}; const root = o; for (let i = 0; i < 40; i++) { o.n = {}; o = o.n; }
  assert.ok(JSON.stringify(normalizeRecord({timestamp: '2026-11-10T10:00:00Z', attributes: root}, SRC, 1).attributes).includes('TRUNCATED_DEPTH'));
});
test('CSV quoting, commas, escaped quotes and CRLF', () => assert.deepEqual(parseRecords('message,type\r\n"hello, ""world""",alert\r\nline,error\r\n', '.csv'), [{message: 'hello, "world"', type: 'alert'}, {message: 'line', type: 'error'}]));
test('CSV handles BOM and embedded newline', () => assert.equal(parseRecords('﻿message,type\n"a\nb",x\n', '.csv')[0].message, 'a\nb'));
test('CSV rejects unclosed quote', () => assert.throws(() => parseRecords('message,type\n"unclosed', '.csv'), /Unclosed/));
test('JSONL reports the failing line number', () => assert.throws(() => parseRecords('{"a":1}\nnot json\n', '.jsonl'), /line 2/));
test('loads mixed JSONL+CSV, sorted by instant', async () => {
  const d = await loadEvents(fixture);
  assert.equal(d.events.length, 9);
  assert.equal(d.events[1].timestamp, '2026-11-10T19:45:00.000Z');
  assert.equal(d.files.length, 2);
  assert.ok(d.events.every((e, i, a) => !i || a[i - 1].timestamp <= e.timestamp));
});
test('every event carries source hash, file and record', async () => {
  const d = await loadEvents(fixture);
  assert.ok(d.events.every(e => e.source.sha256.length === 64 && e.id.startsWith('evt_') && e.source.record >= 1 && e.source.file));
});
test('fixture secrets are redacted in loaded events', async () => {
  const s = JSON.stringify((await loadEvents(fixture)).events);
  assert.ok(!s.includes('jane@example.org'));
  assert.ok(!s.includes('sk_live_test_AbCd1234567890Token'));
});
test('quality reports mixed offsets for the fixture', async () => {
  const q = (await loadEvents(fixture)).quality;
  assert.equal(q.mixedOffsets, true);
  assert.equal(q.clockSkew, 'unassessed');
});
test('parses OTLP resourceLogs with service name and severity', async () => {
  const d = await loadEvents('fixtures/edge-cases/otel.json');
  assert.equal(d.events[0].service, 'gateway');
  assert.equal(d.events[0].type, 'error');
  assert.equal(d.events[0].timePrecision, 'ns');
});
test('identical timestamps sort deterministically by source then record', () => withTmp(async t => {
  await writeFile(path.join(t, 'b.json'), JSON.stringify([{timestamp: '2026-11-10T10:00:00Z', type: 'alert', service: 'b'}]));
  await writeFile(path.join(t, 'a.json'), JSON.stringify([{timestamp: '2026-11-10T10:00:00Z', type: 'alert', service: 'a'}]));
  const d = await loadEvents(t);
  assert.deepEqual(d.events.map(e => e.service), ['a', 'b']);
}));
test('cross-file duplicates are dropped and reported', () => withTmp(async t => {
  const rec = {timestamp: '2026-11-10T10:00:00Z', type: 'alert', service: 's', message: 'm'};
  await writeFile(path.join(t, 'a.json'), JSON.stringify([rec]));
  await writeFile(path.join(t, 'b.json'), JSON.stringify([rec]));
  const d = await loadEvents(t);
  assert.equal(d.events.length, 1);
  assert.equal(d.duplicates.length, 1);
}));
test('same-file repeats are kept (separate occurrences)', () => withTmp(async t => {
  const rec = {timestamp: '2026-11-10T10:00:00Z', type: 'alert', service: 's', message: 'm'};
  await writeFile(path.join(t, 'a.json'), JSON.stringify([rec, rec]));
  assert.equal((await loadEvents(t)).events.length, 2);
}));
test('malformed record is an ingestion error, valid ones survive', () => withTmp(async t => {
  await writeFile(path.join(t, 'e.json'), JSON.stringify([{timestamp: '2026-11-10T20:00:00Z', type: 'alert'}, {timestamp: '2026-11-10', type: 'alert'}]));
  const d = await loadEvents(t);
  assert.equal(d.events.length, 1);
  assert.equal(d.ingestionErrors.length, 1);
}));
test('an unparseable file is reported, other files still load', () => withTmp(async t => {
  await writeFile(path.join(t, 'bad.json'), '{not json');
  await writeFile(path.join(t, 'ok.json'), JSON.stringify([{timestamp: '2026-11-10T20:00:00Z', type: 'alert'}]));
  const d = await loadEvents(t);
  assert.equal(d.events.length, 1);
  assert.ok(d.ingestionErrors.some(e => e.record === 0 && /could not be parsed/.test(e.error)));
}));
test('input with no valid events throws', () => withTmp(async t => { await writeFile(path.join(t, 'e.json'), '[]'); await assert.rejects(loadEvents(t), /No valid/); }));
test('unsupported extensions are skipped and reported', () => withTmp(async t => {
  await writeFile(path.join(t, 'notes.txt'), 'x');
  await writeFile(path.join(t, 'ok.json'), JSON.stringify([{timestamp: '2026-11-10T20:00:00Z', type: 'alert'}]));
  const d = await loadEvents(t);
  assert.ok(d.skipped.some(s => s.file === 'notes.txt'));
}));
test('rejects oversized file', () => withTmp(async t => { await writeFile(path.join(t, 'big.json'), ' '.repeat(2_000_001)); await assert.rejects(loadEvents(t), /too large/); }));
test('enforces the event limit', () => withTmp(async t => {
  const rows = Array.from({length: MAX_EVENTS + 1}, (_, i) => ({timestamp: '2026-11-10T20:00:00Z', type: 'log', service: 's', message: `m${i}`}));
  await writeFile(path.join(t, 'many.json'), JSON.stringify(rows));
  await assert.rejects(loadEvents(t), /Event limit/);
}));
test('rejects a directory with too many files', () => withTmp(async t => {
  for (let i = 0; i < 101; i++) await writeFile(path.join(t, `f${i}.json`), '[]');
  await assert.rejects(loadEvents(t), /Too many/);
}));
test('missing input path fails clearly', async () => { await assert.rejects(loadEvents('definitely/not/here'), /ENOENT/); });
test('skips nested symlinks and records them', () => withTmp(async t => {
  await mkdir(path.join(t, 'dir'));
  await writeFile(path.join(t, 'dir', 'one.json'), JSON.stringify({timestamp: '2026-11-10T20:00:00Z', type: 'alert'}));
  if (!(await trySymlink(path.resolve('fixtures/edge-cases/otel.json'), path.join(t, 'dir', 'link.json')))) return;
  const d = await loadEvents(path.join(t, 'dir'));
  assert.equal(d.events.length, 1);
  assert.ok(d.skipped.some(s => s.reason === 'symlink'));
}));
test('rejects a symlink given directly as input', () => withTmp(async t => {
  if (!(await trySymlink(path.resolve('fixtures/edge-cases/otel.json'), path.join(t, 'link.json')))) return;
  await assert.rejects(loadEvents(path.join(t, 'link.json')), /Symlink/);
}));
