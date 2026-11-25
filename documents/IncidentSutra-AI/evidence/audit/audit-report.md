# IncidentSutra AI — Automated Audit Report

**Verdict:** PASS_WITH_NOTES · **Tool:** incidentsutra 0.2.1 (rules 2026.11-r2) · **Node:** v24.15.0 on win32/x64  
**Nature:** automated self-audit by the project; not a third-party certification

| Checks | Pass | Fail | Skipped | Warn |
|---|---|---|---|---|
| 20 | 19 | 0 | 1 | 0 |

## Results

| ID | Area | Check | Result | Observed |
|---|---|---|---|---|
| A01 | agents | Agent manifest, skills and Claude role files agree (20 roles) | **PASS** | 20 manifest entries, 20 SKILL.md files, 20 role files; frontmatter and 7 required sections present in each |
| A02 | agents | Every skill forbids autonomous production action and defers to humans | **PASS** | all 20 skills contain the no-autonomy, human-owner and untrusted-input rules |
| A03 | contracts | Schemas parse; generated report and every event validate | **PASS** | report + 9 events + agent contract validate |
| A04 | determinism | Identical input produces an identical report ID and bytes | **PASS** | reportId inc_08ab6bbd890e21fe62bd |
| A05 | acceptance | Spec acceptance: time zones sort, correlation stays unconfirmed, absent metrics stay unknown, claims cite sources | **PASS** | {"sorted":true,"mixedOffsetsPresent":true,"unconfirmed":true,"claimsCiteSources":true,"absentMetricsUnknown":true} |
| A06 | privacy | Redaction corpus: 14 synthetic secret classes never reach any output | **PASS** | 14/14 masked in JSON, Markdown, HTML, postmortem, register and JSONL; 0 redactions applied |
| A07 | security | Hostile markup is escaped in HTML and cannot break Markdown tables | **PASS** | rawTags=false, csp=true, brokenMarkdownRows=0 |
| A08 | security | Prompt-injection corpus (6 payloads): no state change, nothing executed | **PASS** | decision=HUMAN_REVIEW_REQUIRED; executedFlags=false; verifies=true |
| A09 | security | Static scan: no process spawn, outbound network, eval or dynamic code in product code | **PASS** | 10 source files scanned; node:http confined to packages/server |
| A10 | integrity | Tampering with a report is detected by verification | **PASS** | 6/6 mutations detected; untouched report verifies |
| A11 | server | Local API: loopback only, bearer required, GET only, host-checked, allowlisted paths | **PASS** | {"addr":"127.0.0.1","noAuth":401,"wrongAuth":401,"ok":200,"notFound":404,"post":405,"hostBad":403,"weakTokenRejected":true} |
| A12 | ingest | Input limits and timestamp strictness | **PASS** | oversizeRejected=true; invalidTimestampsRejected=6/6; leapDayAccepted=true; maxEvents=5000 |
| A13 | ingest | Symlinks are never followed | **SKIPPED** | host forbids symlink creation (EPERM); covered on Linux/macOS CI |
| A14 | algorithm | Synthetic benchmark: 26 case families | **PASS** | 26/26 cases, 36/36 expectations. self-authored synthetic labels; not independently validated; measures internal consistency, not real-world accuracy |
| A15 | legal | Licence, notices and policy files present and consistent | **PASS** | Apache-2.0 text verified; 0 runtime dependencies; all policy files present |
| A16 | legal | Documentation does not overclaim (security, accuracy, compliance, readiness) | **PASS** | 133 documents scanned; no unqualified overclaims |
| A17 | secrets | No credentials committed to the repository | **PASS** | pattern scan (GitHub, AWS, Slack, npm tokens, private keys) found nothing outside intentional synthetic fixtures |
| A18 | supply-chain | Zero runtime and dev dependencies; engines and bin declared | **PASS** | dependencies=0; engines.node=>=20; bin=packages/cli/index.mjs |
| A19 | safety | Read-only policy file denies network, exec, mutation and auto-mitigation | **PASS** | {"mode":"read-only","network":false,"exec":false,"remoteWrite":false,"autoMitigation":false} |
| A20 | safety | Redaction helper handles nested secrets and keeps benign data | **PASS** | {"authorization":"[REDACTED]","nested":{"apiKey":"[REDACTED]","list":["ok","token=[REDACTED]"]},"latency_ms":220,"note":"v2.7.0 deployed"} |

## Known redaction gaps (not covered)

- IPv6 addresses
- personal names and free-text identifiers
- street addresses
- secrets without a recognizable prefix or key name
- non-US phone and national-ID formats
- secrets split across fields

## Limitations of this audit

- Checks are written by the same project they audit; they find regressions, not unknown unknowns.
- Benchmark labels are synthetic and self-authored; no accuracy or precision claim is made.
- No real production telemetry, live connector, or multi-tenant server was exercised.
- Host IDE skill activation (Claude Code, Cursor, Codex, Gemini CLI, Copilot) is untested by this audit.
- A passing audit is not a certification of security, privacy compliance or production readiness.

Regenerate: `npx incidentsutra audit --out audit` (writes `audit-report.json`, `.md`, `.html`).
