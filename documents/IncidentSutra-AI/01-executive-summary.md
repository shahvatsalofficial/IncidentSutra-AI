# Executive summary

## The problem

During an outage, teams build a story fast: "the 14:02 deploy broke it". Common failure modes are over-trusting deploy timing, mixing time zones, reading missing data as "all clear", and writing postmortems from memory. The cost is longer incidents, misdirected fixes and blame.

## What IncidentSutra AI does

IncidentSutra AI is a command-line tool and a set of 20 agent skills. You give it exported, sanitized logs, metrics, alerts and deployment records. It returns:

1. an **auditable UTC timeline** where every line points to a source file, record and SHA-256;
2. several **competing hypotheses**, each with what must be true, what supports it, what **contradicts** it and what would disprove it;
3. an explicit list of **unknowns** (missing metrics, traces, change records) and checks that were **not run**;
4. a **blameless postmortem draft** with human-only sections left open;
5. reports as **HTML, Markdown and JSON**, and an automated **audit report** of the tool itself.

<!-- svg:pipeline -->

## What makes it different

| Typical tooling | IncidentSutra AI |
|---|---|
| Names one probable cause | Keeps several unconfirmed causes and refuses to confirm any |
| Hides gaps | Reports gaps as `unknown` |
| Needs cloud and keys | Offline, zero dependencies, no API key |
| Can act on production | Cannot: no network or process execution in product code |
| Claims accuracy | Publishes limits; benchmark labelled synthetic and self-authored |

<!-- flow:quick -->

## Business value

- **Faster, safer triage**: a defensible timeline in seconds from exports you already have.
- **Lower risk**: nothing leaves the machine; no production credentials are involved.
- **Better learning**: postmortems start from evidence, not recollection, and stay blameless.
- **Auditability**: report integrity digest, source re-hash (`verify --input`), provenance manifest.
- **Cost**: free, Apache-2.0, no vendor lock-in.

## Trust summary

| Question | Answer | Where to verify |
|---|---|---|
| Does it run? | Yes: automated tests on Windows, Linux, macOS in CI | [test results](test-results.md) |
| Does it leak secrets? | 14 synthetic secret classes masked; known gaps published | [06](06-security-privacy-legal.md), audit A06 |
| Can hostile logs steer it? | 6 injection payloads change nothing | audit A08 |
| Can it touch production? | No code path exists | audit A09 |
| Is it independently certified? | **No.** Self-audit only | [07](07-independent-audit.md) |

## Status and limits

Shipped: file-based analysis, reports, verification, audit, benchmark, loopback API, skill installer. Planned: live connectors (Prometheus, Loki, Grafana, Sentry, OTel), calibrated scoring, team server, signed provenance, verified IDE activation. It is not a production incident controller and not an automatic root-cause engine.

## Decision guidance

Adopt it as an **evidence companion** for on-call and postmortems. Do not adopt it as an autonomous responder, a compliance control or a DLP product.
