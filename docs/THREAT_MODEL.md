# Threat model (v0.2.2)

Scope: the local CLI, the report generators and the loopback API. Live connectors and a team server do not exist yet.

| # | Threat | Control implemented | Evidence | Residual risk |
|---|---|---|---|---|
| T1 | Malicious or oversized input | 2 MB per file, 5,000 events, 100 files, depth cap, per-record errors | `ingest.test.mjs`, audit A12 | Memory use up to the caps |
| T2 | Symlink escape | symlinks skipped and reported; direct symlink input rejected | audit A13, ingest tests | Skipped on hosts that forbid symlink creation |
| T3 | Secret or PII leakage in outputs | best-effort redaction at ingest, counts reported | audit A06, security tests | Known gaps: IPv6, names, addresses, unprefixed secrets, non-US IDs |
| T4 | Prompt injection in logs or runbooks | text is data; never executed; decision fixed to HUMAN_REVIEW_REQUIRED; verifier rejects "confirmed" | audit A08, benchmark C19 | A downstream LLM that reads the report may still be influenced; skills tell it not to |
| T5 | XSS or markup injection in reports | HTML escaping, CSP with no scripts, Markdown cell sanitising | audit A07 | Viewer bugs outside this project |
| T6 | Timestamp confusion and clock skew | explicit offsets only, UTC normalisation, mixed-offset gap, skew marked unassessed | ingest tests, benchmark C04/C05 | Real skew is not measured |
| T7 | Report tampering | digest in `reportId`, `verify`, source re-hash | audit A10 | Anyone can recompute the digest; not a signature |
| T8 | False root-cause certainty | status always unconfirmed, confidence undetermined, contradictions listed | analysis tests, schema constants | Human over-reading |
| T9 | Unauthorized production action | no network or exec in product code; diagnostics flagged `executed:false` | audit A09, A19 | None in code; humans act outside the tool |
| T10 | Local API token theft or DNS rebinding | loopback bind, bearer token of 24+ chars, constant-time compare, Host allowlist, GET only | server tests, audit A11 | Any local process that knows the token can read the report |
| T11 | Supply-chain compromise | zero dependencies; npm provenance via OIDC release workflow | audit A18 | Node.js itself and GitHub Actions |
| T12 | SSRF, credential theft, cross-tenant access | not applicable: no connectors or multi-user server exist | n/a | Must be designed before any connector ships |

Consult an independent security reviewer before any networked deployment.
