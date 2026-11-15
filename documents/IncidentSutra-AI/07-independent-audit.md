# Independent-style audit and evidence

**Reviewer stance.** This is a skeptical review of the v0.1.0 starter and the v0.2.0 result, written from the evidence in the repository. It was prepared by the project's own tooling and author session, so it is **not independent in the third-party sense** and is not a certification. Where it says "verified", a command in this repository reproduces the result.

## 1. Method

1. Baseline the inherited starter: run its tests and demo, read all source.
2. Compare behaviour with the written specification (master prompt, tool catalogue, skill file).
3. Probe edge cases directly (timestamps, secrets, hostile text, tampering, local API).
4. Fix defects, add regression tests, add an automated audit that re-checks them on every run.
5. Publish what is not covered.

## 2. Defects found in the starter and their resolution

| # | Finding | Evidence | Severity | Resolution |
|---|---|---|---|---|
| F1 | `Date.parse` accepted impossible dates: `2026-02-30T00:00:00Z` parsed as 2026-03-02; `T24:00:00Z` rolled to next day | direct Node probe | High (timeline integrity) | Explicit calendar validation; 13 rejection tests |
| F2 | Millisecond-only time; no precision field; nanosecond order lost; OTLP `timeUnixNano` of `0` treated as a real time | code review | Medium | `timestampNs` BigInt string, `timePrecision`, observed-time fallback with warning |
| F3 | CI ran `node --test tests/*.test.mjs`; Windows shells do not expand the glob on Node 20 | CI failure report | High (broken CI) | `node --test` |
| F4 | Symlink tests threw `EPERM` on hosts that forbid symlinks | local run | Medium | helper returns early when creation is denied |
| F5 | All 20 skills were one template with a changed sentence | file comparison | Medium (misleading) | Role-specific skills; uniqueness test; necessity catalogue |
| F6 | Redaction covered only bearer, a few `key=value`, email, AWS key | code review | High (privacy) | 12 rules, 14-class corpus, counts, known gaps published |
| F7 | `Authorization: Bearer x` left a dangling `Bearer` after masking | probe | Low | single combined rule; test |
| F8 | One unparseable file aborted the whole run | code review | Medium | reported as ingestion error; others continue |
| F9 | Nested symlinks skipped silently | code review | Low (hidden gap) | listed in `skippedInputs` and a gap |
| F10 | Hypotheses ignored errors preceding a change and unaffected services | fixture review | High (causal safety) | contradictions recorded per hypothesis |
| F11 | Only temporal and generic hypotheses; no dependency, saturation, datastore, latent families | spec comparison | Medium | families added with counter-evidence |
| F12 | Reports: HTML plus a Markdown file mislabelled `postmortem-draft.md`; no MD/HTML audit report | feedback | Medium | `incident-report.md`, real postmortem template, `audit` writes MD, HTML and JSON |
| F13 | Local API accepted any Host header | code review | Medium (DNS rebinding) | Host allowlist, timeouts |
| F14 | Package marked `private`, no `files`, no repository metadata | package.json | Medium (not publishable) | publish-ready metadata, provenance |
| F15 | Equal timestamps ordered by random-looking ID | code review | Low | sort by ns, file, record |

## 3. Automated audit (20 checks)

Run `npx incidentsutra audit --out audit`. The committed run is in [`evidence/audit/audit-report.html`](evidence/audit/audit-report.html) (also `.md`, `.json`). Latest committed verdict: **PASS_WITH_NOTES** (19 pass, 1 skipped, 0 fail). The skipped check (A13, symlinks) is skipped on Windows hosts that forbid symlink creation; Linux and macOS CI exercise it.

| Area | Checks |
|---|---|
| agents | A01 manifest, skills and role files agree; A02 guardrail wording in all 20 |
| contracts | A03 report, events and agent contract validate against schemas |
| determinism | A04 identical bytes for identical input |
| acceptance | A05 time zones, correlation-only, unknown metrics, claims cite sources |
| privacy | A06 14 secret classes never reach any output |
| security | A07 hostile markup, A08 injection corpus, A09 static scan, A11 local API |
| integrity | A10 six tamper mutations detected |
| ingest | A12 limits and strict timestamps, A13 symlinks |
| algorithm | A14 26-case benchmark |
| legal | A15 licence and notices, A16 overclaim scan |
| secrets | A17 repository secret scan |
| supply chain | A18 zero dependencies |
| safety | A19 read-only policy, A20 redaction helper |

## 4. Benchmark

26 synthetic incident families, 36 expectations, all pass on the committed run ([`evidence/benchmark.json`](evidence/benchmark.json)). **Caveat:** labels are written by the author and not independently validated. The result shows internal consistency, not accuracy on real incidents. No precision or recall figure is claimed.

## 5. Tests

See [test-results.md](test-results.md): machine-written results from `npm run test:report`, including Node version, platform and commit. CI additionally runs the suite on Ubuntu and Windows (Node 20, 22, 24) and macOS (Node 24).

## 6. Sample proof

[`evidence/samples/incident-report.html`](evidence/samples/incident-report.html) is a full report from the synthetic fixture. It shows a deployment 2.7.0, an error before deployment 2.7.1, an alert, a dependency warning that appears **after** onset, and a metric rising from 0.1% to 8% errors. Hypotheses remain unconfirmed; contradictions are listed.

## 7. What was not tested (read this)

- Real production telemetry of any kind.
- Live connectors (none exist).
- Native skill discovery and activation in Claude Code, Cursor, Codex, Gemini CLI and Copilot.
- Redaction false-negative rate on real data. Only a synthetic corpus was used.
- Hypothesis usefulness to responders (no user study).
- Performance beyond the 5,000-event cap.
- Third-party penetration test or code audit.

## 8. Residual risks

| Risk | Effect | Mitigation |
|---|---|---|
| Redaction misses a secret | Leak in a shared report | sanitize upstream; review before sharing |
| Keyword classification misses unusual wording | Missing hypothesis family | the unknown family is always present; read the gaps |
| Over-reading hypotheses | Wrong fix | wording ("may be related"), legend, human review status |
| Digest forged | Undetected edit | do not treat as a signature; compare source hashes |
| Local token disclosure | Local read of report | loopback only, short-lived token |

## 9. Verdict

For its stated scope (offline, read-only evidence assistant), the implementation meets its own acceptance criteria and has no known open defect after the fixes above. Suitability for production incident work depends on your data hygiene and process. A third-party review is recommended before any networked or multi-user extension.
