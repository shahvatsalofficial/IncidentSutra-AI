# Architecture

## Principles

1. **Observed, inferred, unknown, not run** are separate types, not prose style.
2. **Offline and read-only by construction**: product code has no network client, no process spawn, no eval.
3. **Deterministic**: same input, same bytes.
4. **Humans decide**: the decision field is fixed to `HUMAN_REVIEW_REQUIRED`.
5. **Untrusted input**: logs, runbooks and tickets are data.

## Data flow

```
telemetry files (json / jsonl / csv / OTLP)
        |
        v
  enumerate (no symlinks, size and count caps)
        |
        v
  parse -> normalise -> redact -> deduplicate -> sort      [packages/core/ingest.mjs]
        |
        v
  classify -> hypotheses + contradictions + gaps + series  [packages/core/analyze.mjs]
        |
        +--> incident-report.json  (digest = reportId)
        +--> reporter: .md  .html  postmortem  register    [packages/reporter]
        +--> provenance.json (hashes of inputs and outputs)
        |
        v
  verify  (integrity, references, guards, optional source re-hash)
  serve   (loopback, read-only)
```

## Component boundaries

| Component | May | May not |
|---|---|---|
| ingest | read files under the given path, hash, redact | follow symlinks, write, use network |
| analyze | compute from events in memory | read files (except `verifySources`), set confidence, confirm causes |
| reporter | render strings | execute, fetch, include scripts |
| cli | read inputs, write the chosen output directory, start server | spawn processes, call out |
| server | answer GET on loopback with a token | write, bind elsewhere, serve files |
| audit | read the repo, run checks, open a loopback socket | change any file except the chosen output |

## Trust boundaries

```
 [ user-supplied telemetry ]  untrusted
            |  parse + limits + redaction
 [ normalised events ]        observed, still data
            |  rules (no model, no network)
 [ report ]                   advisory, unconfirmed
            |  human review
 [ decisions and actions ]    outside the tool
```

## Evidence model

See `docs/EVIDENCE_MODEL.md`. An evidence ID ties a statement to a file, a record and a source hash. Hypotheses reference IDs only; the verifier rejects dangling references.

## Hypothesis engine

Per affected service: candidate changes within the window (up to 3), then dependency, saturation, datastore, latent-defect and alternative families when their wording or ordering conditions hold. A global unknown-cause hypothesis is always appended. No scoring or ranking is applied; order is by construction.

## Agent layer

20 skills encode roles (timeline builder, change detector, hypothesis tester, evidence ledger, privacy guardian, and others). Prime orchestrates but cannot override Privacy Guardian blocks or Evidence Ledger rejections. Without subagent support, run roles sequentially in the documented order. 13 roles map to CLI behaviour; 7 are guidance-only.

## Future architecture (not built)

Adapter boundary for read-only Prometheus or Loki queries with bounded ranges, allowlisted endpoints, TLS verification, redirect and SSRF controls and audit events; calibrated scoring against an independently labelled benchmark; authenticated team server with RBAC and retention. Each requires a threat-model update before code.

## Decisions

| ADR | Decision | Reason |
|---|---|---|
| 1 | Keep plain `.mjs`, zero dependencies | smallest supply-chain surface, fast install |
| 2 | Rule-based hypotheses, confidence `undetermined` | no calibration data; avoids false precision |
| 3 | Digest in `reportId`, explicitly not a signature | honest about what a hash proves |
| 4 | Skills generated from one table | prevents drift and template copy-paste |
| 5 | No scripts in HTML reports | strict CSP; safe to open untrusted data |
| 6 | `node --test` without a glob | works on Windows with Node 20 |
