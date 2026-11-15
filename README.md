# IncidentSutra AI

> **Observe precisely. Reason cautiously. Recover responsibly.**

**Offline, read-only incident investigation CLI** that turns exported logs, metrics, alerts and deployment records into an **auditable UTC timeline**, **competing root-cause hypotheses with counter-evidence**, and a **blameless postmortem draft**, as **Markdown, HTML and JSON**. It also ships **20 portable Agent Skills** for Claude Code, Cursor, Codex, Gemini CLI and GitHub Copilot.

[![CI](https://github.com/shahvatsalofficial/IncidentSutra-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/shahvatsalofficial/IncidentSutra-AI/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/incidentsutra.svg)](https://www.npmjs.com/package/incidentsutra)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)

Created and maintained by **Vatsal Shah** ([@shahvatsalofficial](https://github.com/shahvatsalofficial)). No API key, no network, no telemetry, no dependencies.

---

## Try it in 30 seconds

```bash
npx incidentsutra analyze --input fixtures/example-incident --out report --synthetic
npx incidentsutra verify  --report report/incident-report.json
```

Open `report/incident-report.html` in a browser. Prefer a checkout? `git clone https://github.com/shahvatsalofficial/IncidentSutra-AI && cd IncidentSutra-AI && npm run demo`.

A pre-generated sample (synthetic data) is committed in [`examples/reports/demo`](examples/reports/demo): [HTML](examples/reports/demo/incident-report.html) · [Markdown](examples/reports/demo/incident-report.md) · [JSON](examples/reports/demo/incident-report.json) · [postmortem draft](examples/reports/demo/postmortem-draft.md).

## What it does (and refuses to do)

| It does | It will not |
|---|---|
| Parse JSON, JSONL, CSV and OTLP log JSON; require RFC3339 with explicit offset; sort by instant, keep nanoseconds | Guess a time zone, or claim wall-clock order proves causal order |
| Give every fact an evidence ID, source file, record number and SHA-256 | Present a hash as a signature or chain of custody |
| Offer several unconfirmed hypotheses (change, dependency, saturation, datastore, latent defect, unknown), each with *what must be true*, support, **contradictions**, and what would disconfirm it | Say a deployment "caused" an outage because it happened first |
| Record missing metrics, traces and change records as **unknown**, never fabricate them | Invent impact numbers, probabilities or "97% root cause" scores |
| List read-only diagnostics with permission, cost and expected result, all marked **not run** | Restart, roll back, page, post to a status page, or touch production |
| Mask common secrets and personal data (best effort) and report counts | Claim to be DLP, or promise nothing sensitive remains |

## Reports you get

`analyze` writes: `incident-report.html` · `incident-report.md` · `incident-report.json` · `postmortem-draft.md` · `hypothesis-register.md` · `normalized-events.jsonl` · `incident-timeline.json` · `provenance.json` (+ `ingestion-errors.json` when records are rejected). The HTML report is a single file with no scripts, a strict Content-Security-Policy, light/dark themes, print styles, an accessible SVG timeline with a table alternative, and a legend that separates **observed**, **inferred**, **unknown** and **not run**.

`audit` writes `audit-report.html`, `.md` and `.json`.

## Proof, not promises

Everything below is reproducible with one command. Numbers come from real runs, recorded in [`documents/IncidentSutra-AI/evidence`](documents/IncidentSutra-AI/evidence).

| Evidence | Result | Reproduce |
|---|---|---|
| Automated tests (`node:test`) | 192 pass, 0 fail on Node 24 / Windows ([test-results](documents/IncidentSutra-AI/test-results.md)) | `npm test` |
| Automated self-audit | 20 checks, see [audit report](documents/IncidentSutra-AI/evidence/audit/audit-report.html) | `npx incidentsutra audit --out audit` |
| Synthetic benchmark | 26 incident case families, see [07-independent-audit](documents/IncidentSutra-AI/07-independent-audit.md) | `npx incidentsutra benchmark` |
| Redaction corpus | 14 synthetic secret classes, none leak into any output | audit check A06 |
| Prompt-injection corpus | 6 hostile payloads change nothing | audit check A08 |
| Tamper detection | 6 of 6 mutations caught by `verify` | audit check A10 |
| Static scan | no process spawn, outbound network or `eval` in product code | audit check A09 |
| Dependencies | 0 runtime, 0 dev | `npm ls` |
| CI matrix | Ubuntu and Windows on Node 20, 22, 24; macOS on Node 24 | [Actions](https://github.com/shahvatsalofficial/IncidentSutra-AI/actions) |

**Honest limits of that proof.** The audit is an automated *self*-audit, not a third-party certification. Benchmark labels are synthetic and written by the author, so they show internal consistency, not real-world accuracy. No real production telemetry or live connector has been tested. Native skill activation in each IDE is untested. See [`documents/IncidentSutra-AI/07-independent-audit.md`](documents/IncidentSutra-AI/07-independent-audit.md) for the full reviewer-style write-up, including defects found and fixed.

## Commands

```text
incidentsutra analyze   --input <file|dir> --out <dir> [--window-minutes 15] [--synthetic]
incidentsutra verify    --report <incident-report.json> [--input <original telemetry>]
incidentsutra compare   --baseline <a.json> --candidate <b.json>
incidentsutra redact    --input <file|dir>            counts of masked values, never the values
incidentsutra audit     [--out <dir>]                 automated self-audit (JSON, MD, HTML)
incidentsutra benchmark [--out <dir>]                 26-case synthetic benchmark
incidentsutra skills list | install --host claude|cursor|codex|gemini|copilot|agents --project <dir>
incidentsutra serve     --report <json> [--port 0]    loopback, bearer-token, GET-only
incidentsutra doctor | --version
```

Exit codes: `0` ok · `1` usage or runtime error · `2` verification, audit or benchmark failed.

## Input format

One event per record; `timestamp` must be RFC3339 with `Z` or `±HH:MM`.

```jsonl
{"timestamp":"2026-11-10T19:52:00Z","type":"deploy","service":"checkout","message":"release 2.7.1","deploymentId":"checkout-2.7.1"}
{"timestamp":"2026-11-11T01:24:00+05:30","type":"alert","service":"checkout","severity":"critical","message":"error budget burn"}
```

OTLP log JSON (`resourceLogs`) is supported, including `timeUnixNano` parsed as an integer string so nanoseconds survive. Limits: 2 MB per file, 5,000 events, 100 files; symlinks are never followed.

## Agent Skills for your AI coding tool

20 role-specific skills (timeline builder, change detector, hypothesis tester, evidence ledger, privacy guardian, postmortem writer and more) install **project-locally** and never overwrite existing files:

```bash
npx incidentsutra skills install --host claude --project .
```

Roles are instructions, not 20 running models. 13 are backed by CLI behaviour; 7 are honest guidance-only procedures (see [`docs/AGENT_CATALOG.md`](docs/AGENT_CATALOG.md)). Copying files is tested; whether each IDE auto-discovers them is **not** tested (see [`compatibility-matrix.json`](compatibility-matrix.json)).

## Security, privacy and legal

- **Local only.** No network calls, no telemetry, no process execution in product code (enforced by audit check A09). Your data stays on your machine unless you share the output.
- **Untrusted input.** Logs, runbooks and tickets are treated as data. Hostile text is escaped in HTML and Markdown and cannot change decisions.
- **Redaction is best effort.** It masks bearer tokens, JWTs, private keys, URL credentials, common API-key prefixes, AWS keys, emails, IPv4, Luhn-valid card numbers, US SSN/phone and `key=value` secrets. It does **not** catch IPv6, personal names, street addresses, unprefixed secrets or non-US IDs. **Sanitize exports upstream.** Treat it as a safety net, not DLP.
- **Not a certification.** Output is advisory evidence for humans. It is not legal, compliance, security or SRE advice, and not a substitute for your incident commander.
- **Licence.** [Apache-2.0](LICENSE): free for personal and commercial use, provided *as is* without warranty (see sections 7 and 8). Third-party names are trademarks of their owners; no affiliation is claimed ([NOTICE](NOTICE), [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)).
- **Reporting vulnerabilities:** [SECURITY.md](SECURITY.md). **Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md).

## Status

Working and tested: ingestion, UTC timeline, rule-based hypotheses, reports, verification, redaction, audit, benchmark, loopback API, skill installer.
Not implemented: live observability connectors (Prometheus, Loki, Grafana, Sentry, OTel Collector), LLM inference, calibrated confidence scoring, multi-tenant server, signed provenance, verified native activation in every IDE. See [ROADMAP.md](ROADMAP.md) and [`docs/STATUS.md`](docs/STATUS.md). This is not a production incident controller and not an automatic root-cause engine.

## Documentation

Full documents live in [`documents/IncidentSutra-AI`](documents/IncidentSutra-AI/README.md), each as Markdown and styled HTML:
[Executive summary](documents/IncidentSutra-AI/01-executive-summary.md) · [Functional spec](documents/IncidentSutra-AI/02-functional-spec.md) · [Technical spec](documents/IncidentSutra-AI/03-technical-spec.md) · [Architecture](documents/IncidentSutra-AI/04-architecture.md) · [User guide](documents/IncidentSutra-AI/05-user-guide.md) · [Security, privacy and legal](documents/IncidentSutra-AI/06-security-privacy-legal.md) · [Independent audit](documents/IncidentSutra-AI/07-independent-audit.md) · [Agent catalogue](documents/IncidentSutra-AI/08-agent-catalog.md) · [Test results](documents/IncidentSutra-AI/test-results.md) · [FAQ](documents/IncidentSutra-AI/09-faq.md).

## FAQ

**Is this an AI that finds the root cause?** No. It builds evidence and *competing* explanations and refuses to confirm any. Confidence stays `undetermined`.
**Does it need an API key or internet?** No.
**Can it connect to Prometheus, Loki or Datadog?** Not yet. You export sanitized data; connectors are on the roadmap with a read-only design.
**How is this different from an observability platform?** It does not collect or store telemetry. It reasons carefully about an exported slice and shows what is unknown.
**Which Node versions?** 20, 22 and 24.

## Keywords

incident response, SRE, on-call, postmortem, blameless postmortem, root cause analysis, incident timeline, observability, OpenTelemetry, OTLP, deployment correlation, evidence-based, offline CLI, Agent Skills, Claude Code skills, Cursor, Codex, Gemini CLI, GitHub Copilot, privacy-first, no API key.

## Contributing

Evidence-backed issues and pull requests are welcome. Never include real logs, tokens or customer data. Run `npm run check` before opening a PR.

Apache-2.0 · © 2026 Vatsal Shah
