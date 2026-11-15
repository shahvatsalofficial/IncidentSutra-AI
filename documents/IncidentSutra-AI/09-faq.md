# FAQ

## Basics

**What is IncidentSutra AI?** An offline CLI plus 20 agent skills that turn exported incident data into an evidence-backed timeline, competing hypotheses and a postmortem draft.

**Does it find the root cause?** No. It lists plausible, falsifiable explanations with counter-evidence. Every status stays `unconfirmed` and confidence `undetermined`.

**Does it need an API key, account or internet?** No.

**Why is confidence never a percentage?** No calibrated scoring exists. Inventing a number would be false precision.

**What file formats?** JSON, JSONL, NDJSON, CSV and OTLP log JSON.

## Trust

**Is it audited?** It has an automated self-audit (20 checks) and a reviewer-style write-up. It has not had a third-party audit.

**Where is the proof?** [07 audit](07-independent-audit.md), [test results](test-results.md), `evidence/`.

**Can I reproduce your numbers?** Yes: `npm test`, `npx incidentsutra audit`, `npx incidentsutra benchmark`.

**How accurate is it?** Unknown on real incidents. The benchmark is synthetic and self-authored, so no accuracy figure is published.

## Safety and privacy

**Can it change production?** No. Product code has no network client or process execution (audit A09).

**Does it send my data anywhere?** No.

**Is redaction reliable?** It is a best-effort safety net with published gaps. Sanitize upstream.

**What if a log tells the AI to run commands?** Log text is data. Tests with hostile payloads show decisions and statuses do not change. A separate LLM reading the report could still be swayed; the skills instruct it not to follow embedded instructions.

**Is the report digest a signature?** No. Anyone can recompute it. It catches accidents.

## Usage

**Why was my record rejected?** Open `ingestion-errors.json`. The usual cause is a timestamp without an offset.

**Why no hypothesis for my dependency outage?** Classification is keyword based. Check the gaps and the unknown-cause hypothesis; open an issue with a sanitized sample.

**What does `--synthetic` do?** Adds a banner so demo reports are never mistaken for a real incident.

**Which Node versions?** 20, 22 and 24.

**Will it work in Cursor, Codex, Gemini CLI or Copilot?** Skills are copied to each tool's project folder (tested). Whether the tool discovers them depends on its version and is untested here.

## Project

**Licence?** Apache-2.0.

**Who maintains it?** Vatsal Shah.

**How do I report a vulnerability?** GitHub private advisory; see `SECURITY.md`.

**What is planned?** Read-only Prometheus or Loki adapter, OTel ingest, calibrated scoring, accessible console, team server. See `ROADMAP.md`. None is built.
