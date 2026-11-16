# Changelog

## 0.2.1 — 2026-11-16 — maintenance

- CI and release workflows moved to the latest GitHub Action majors (checkout v7, setup-node v7, upload-artifact v7).
- Version metadata (package, plugin manifest, citation, status docs) aligned at 0.2.1; first npm release was 0.2.0.
- Evidence (tests, audit, benchmark, samples) regenerated for this version.

## 0.2.0 — 2026-11-11 — audit reports, hardening, public release

**Added**
- `audit` command: 20 automated checks, written as `audit-report.html`, `.md` and `.json`.
- `benchmark` command: 26 synthetic incident case families with self-authored expectations.
- `redact` preview, `verify --input` source re-hash, `--version`, `--synthetic` banner.
- Reports now come as HTML, Markdown and JSON (`incident-report.*`), plus a separate `postmortem-draft.md` (blameless template with human TODOs), `hypothesis-register.md`, `provenance.json`.
- Hypothesis families: change, dependency, saturation, datastore, latent defect, alternative, unknown; each with must-be-true, contradictions, disconfirming observations and unexecuted read-only diagnostics.
- Event schema v2: `timestampNs`, `timePrecision`, `originalTimestamp`, `originalOffset`, `observedTimestamp`, `timeBasis`, `dimensions`, `ingestionWarnings`, `sensitivityClass`.
- Report schema v2, agent output schema, observed/inferred/unknown/not-run `claims`, reusable `contract`.
- 20 role-specific skills generated from one table (`scripts/build-skills.mjs`), necessity catalogue, compatibility matrix.
- Documentation set in `documents/IncidentSutra-AI` (Markdown + HTML), evidence, `llms.txt`, `CITATION.cff`, `NOTICE`, `SUPPORT.md`.

**Fixed**
- CI failed on Windows with Node 20 (`node --test tests/*.test.mjs` is not glob-expanded); now `node --test`.
- Symlink tests failed with `EPERM` on hosts that forbid symlinks; they now return early there.
- Timestamps: calendar-invalid dates, hour 24, second 60 and oversized offsets are rejected explicitly; nanosecond precision kept as an integer string; OTLP `timeUnixNano` of `0` treated as unset; JSON numbers beyond 2^53 rejected.
- Equal timestamps now sort by sub-millisecond value, then source file, then record (stable, deterministic).
- Unparseable files no longer abort the whole run; they are reported as ingestion errors.
- Redaction extended: JWT, private keys, URL credentials, token prefixes, IPv4, Luhn cards, SSN, phone; `Authorization: Bearer x` no longer leaves a dangling scheme.
- Server: forged `Host` headers rejected (DNS-rebinding), request timeouts, extra read-only routes.
- Skills were one template with one swapped sentence; now role-specific.

**Packaging**: `private` removed, `files`, `exports`, provenance-enabled `publishConfig`, zero dependencies.

## 0.1.0 — initial local starter

Local CLI with read-only event ingestion, source hashes, timeline and competing hypothesis reports, verification, report comparison, Agent Skills, localhost server, fixtures and automated tests.
