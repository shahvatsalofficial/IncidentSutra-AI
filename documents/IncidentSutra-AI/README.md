# IncidentSutra AI documentation

**Observe precisely. Reason cautiously. Recover responsibly.** Created by Vatsal Shah. Apache-2.0.

This folder is the complete reference for IncidentSutra AI v0.2.0. Every page exists as Markdown (source) and HTML (generated, styled, light and dark, print-ready). Rebuild HTML with `npm run build:docs`; CI fails if it is stale.

## Read in this order

| Audience | Start here |
|---|---|
| Executives, managers, procurement | [01 Executive summary](01-executive-summary.md) |
| Product and incident commanders | [02 Functional specification](02-functional-spec.md) |
| Engineers and contributors | [03 Technical specification](03-technical-spec.md), [04 Architecture](04-architecture.md) |
| On-call users | [05 User guide](05-user-guide.md) |
| Security, privacy, legal, compliance reviewers | [06 Security, privacy and legal](06-security-privacy-legal.md) |
| Anyone deciding whether to trust it | [07 Independent audit and evidence](07-independent-audit.md), [Test results](test-results.md) |
| People using AI coding tools | [08 Agent catalogue](08-agent-catalog.md) |
| Quick answers | [09 FAQ](09-faq.md) |

## Evidence folder

`evidence/` holds machine-written artifacts: `test-results.json`, `benchmark.json`, `audit/audit-report.{html,md,json}`, and `samples/` (a full synthetic incident report in HTML, Markdown and JSON). None of it is edited by hand. Regenerate with `npm run test:report`, `npx incidentsutra audit --out ...`, `npx incidentsutra benchmark --out ...` and `npm run demo`.

## Ground rules this documentation follows

- Claims are limited to what the code does and a test or audit check demonstrates.
- Anything not built is labelled planned, never implied.
- The project is advisory tooling. It does not replace a human incident commander, and nothing here is legal, compliance or security certification.
