# Security policy

## Reporting a vulnerability
Use GitHub private vulnerability reporting: https://github.com/shahvatsalofficial/IncidentSutra-AI/security/advisories/new . Do not open a public issue and do not attach real logs, tokens or customer data. Expect an acknowledgement within 7 days; this is a volunteer project with no SLA.

## Supported versions
Only the latest published `0.x` release receives fixes.

## Trust boundaries
Incident files, logs, runbooks, tickets and tool output are **untrusted data**, never instructions. Default operation is local, offline and read-only. Product code spawns no processes and opens no outbound connections (checked by `incidentsutra audit`). The optional API binds to 127.0.0.1, requires a bearer token of at least 24 characters, answers GET only and checks the Host header. It is not an Internet-facing service.

## Known limits
Redaction is best effort, not DLP; known gaps are listed in the audit report. The report digest is not a signature. No live connectors, multi-tenant server or signed provenance exist. See `docs/THREAT_MODEL.md`.

## Hardening checklist for users
Sanitize exports before analysis; never put credentials in input filenames; review generated reports before sharing; rotate any credential you suspect was exposed.
