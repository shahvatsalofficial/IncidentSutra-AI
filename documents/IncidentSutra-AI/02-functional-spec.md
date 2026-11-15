# Functional specification

## Users

On-call SREs, incident commanders, release engineers, support escalation, students of observability, open-source maintainers.

## Commands

| Command | Purpose | Output | Exit codes |
|---|---|---|---|
| `analyze --input <file or dir> --out <dir> [--window-minutes N] [--synthetic]` | Build the evidence report | 8 files, see below | 0 / 1 |
| `verify --report <json> [--input <telemetry>]` | Check integrity, references, guard fields, optionally re-hash sources | JSON verdict | 0 / 2 |
| `compare --baseline <a> --candidate <b>` | Diff two verified reports | JSON diff | 0 / 1 |
| `redact --input <file or dir>` | Show counts of masked values, never the values | JSON counts | 0 / 1 |
| `audit [--out <dir>]` | Run 20 automated checks | `audit-report.html`, `.md`, `.json` | 0 / 2 |
| `benchmark [--out <dir>]` | Run 26 synthetic case families | `benchmark.json` | 0 / 2 |
| `skills list`, `skills install --host H --project D` | Project-local Agent Skills | file copies | 0 / 1 |
| `serve --report <json> [--port N]` | Loopback read-only API; needs `INCIDENTSUTRA_TOKEN` of 24 or more characters | HTTP JSON | 0 / 1 |
| `doctor`, `--version`, `help` | Environment, version, usage | text/JSON | 0 |

## Inputs

JSON (array, `{events}`, `{records}` or OTLP `resourceLogs`), JSONL/NDJSON and CSV. Required: `timestamp` (or `time`, `timeISO`, OTLP `timeUnixNano`). Recognised fields: `type`/`eventType`/`eventName`, `service`/`serviceName`, `severity`/`severityText`, `message`/`body`, `traceId`, `spanId`, `deploymentId`/`releaseId`, `environment`, `value`/`metricValue`, `attributes`. Unknown scalar columns become `dimensions`.

Limits: 2 MB per file, 5,000 events, 100 files, nesting depth 8, 80 keys per object. Symlinks are never followed. Unsupported file types are skipped and reported.

Time rules: RFC3339 with `Z` or `±HH:MM` only. Invalid calendar dates, hour 24, second 60 and offsets beyond 23:59 are rejected per record. Event time wins over collector observed time; observed-only events carry a warning. OTLP `timeUnixNano` of `0` means unset. Sub-millisecond precision is kept in `timestampNs`.

## Outputs of `analyze`

| File | Content |
|---|---|
| `incident-report.html` | Single-file report: summary, SVG and table timeline, hypotheses, gaps, quality, sources, limits. No scripts, strict CSP, light/dark, print styles |
| `incident-report.md` | Same content as Markdown |
| `incident-report.json` | Machine contract (schema `incidentsutra.report.v2`) |
| `postmortem-draft.md` | Blameless template; facts from evidence, `TODO (human)` elsewhere |
| `hypothesis-register.md` | One block per hypothesis with reviewer decision placeholder |
| `normalized-events.jsonl` | One normalised event per line (schema v2) |
| `incident-timeline.json` | Timeline only |
| `provenance.json` | Tool version, input hashes, output hashes, limits notice |
| `ingestion-errors.json` | Only when records were rejected, files skipped or duplicates dropped |

## Analysis behaviour

Classification is rule-based: a **change** is an event whose type or severity contains deploy, release, rollout, rollback, config-change or flag; an **issue** contains error, alert, incident, critical, failure, outage or fatal; a **metric** has a metric type or a numeric value.

Hypothesis families, produced only when evidence supports them (the unknown family is always present):

| Kind | Trigger | Counter-evidence recorded |
|---|---|---|
| `temporal-correlation` (change) | change within the window of the first error, up to 3 per service | errors before the change; no errors after; unaffected services that changed too |
| `dependency-failure` | timeout, upstream, provider, gateway, DNS, 502-504 wording near onset | dependency signals appearing after onset |
| `resource-saturation` | CPU, OOM, pool, queue, throttling wording | none by rule; gaps listed |
| `datastore-issue` | database, deadlock, replica lag, migration wording | none by rule; gaps listed |
| `latent-defect` | errors precede the nearest change, or no change exists | nearby changes |
| `alternative-explanation` | always per affected service | nearby changes |
| `insufficient-evidence` | always | n/a |

Every hypothesis: `status: unconfirmed`, `confidence: undetermined`, `reviewStatus: pending_human_review`, `mustBeTrue`, supporting and contradicting evidence IDs, `disconfirmingObservations`, `knownGaps`, and `diagnostics` (read-only, `executed: false`, permission, cost, expected result).

Other derived data: observed `metricSeries` (first, last, min, max), `alertStorms` (5 or more signals within 5 minutes), quality notes (offsets, precisions, clock skew **unassessed**), gaps (`missing_metrics`, `missing_incident_signals`, `missing_traces`, `missing_changes`, `invalid_records`, `mixed_time_offsets`, `skipped_inputs`).

## Acceptance criteria (from the product brief) and where they are tested

| Criterion | Test |
|---|---|
| Events in two time zones sort correctly | `ingest.test.mjs`, benchmark C04, C05, audit A05 |
| Deployment near an alert stays correlation only | `analysis.test.mjs`, audit A05 |
| Every claim links to a source ID | audit A05, schema validation |
| Absent metrics recorded unknown | benchmark C06, audit A05 |
| Two competing hypotheses, none confirmed | fixture test, `verify` rejects `confirmed` |

## Out of scope in 0.2.0

Live connectors, LLM synthesis, calibrated scoring, interactive console, multi-user server, signed evidence, status-page or paging integrations.
