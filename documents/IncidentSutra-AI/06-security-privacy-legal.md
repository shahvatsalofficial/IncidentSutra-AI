# Security, privacy and legal

> This page describes how the software behaves. It is not legal advice and not a compliance certification. Have your own counsel and security team review any use with regulated data.

## 1. Security posture

| Area | Behaviour | Verification |
|---|---|---|
| Network | Product code opens no outbound connection | audit A09 static scan |
| Process execution | None | audit A09 |
| Dynamic code | No `eval` or `new Function` | audit A09 |
| Dependencies | 0 runtime and dev | audit A18 |
| Input handling | size, count, depth caps; symlinks never followed | audit A12, A13, ingest tests |
| Output safety | HTML escaped; no scripts; CSP; Markdown cells sanitised | audit A07 |
| Prompt injection | Log text is data; decision fixed; verifier blocks "confirmed" | audit A08 |
| Local API | loopback, token, GET only, Host check | audit A11 |
| Supply chain | npm provenance through OIDC trusted publishing; no stored npm token | `release.yml` |

Full list of threats and residual risks: `docs/THREAT_MODEL.md`.

## 2. Privacy

- **Data flow**: input files are read locally; outputs are written only to the directory you choose. No telemetry, analytics or remote calls.
- **Redaction (best effort)** masks: private keys, JWTs, URL credentials, `key=value` secrets, bearer tokens, common API-key prefixes, AWS keys, emails, IPv4, Luhn-valid card numbers, US SSNs, US-style and `+` phone numbers.
- **Not masked**: IPv6, personal names, street addresses, secrets without a recognisable prefix or key name, non-US phone and national IDs, secrets split across fields. These are listed in every audit report.
- **Retention**: the tool keeps nothing between runs. Reports contain redacted text and source file hashes, not raw files.
- **Personal data**: you remain the controller or processor of anything you feed in. Sanitize at the source. If you suspect a real credential reached a report, rotate it.
- **GDPR, HIPAA, PCI**: the software makes no compliance claim. Local-only processing can simplify data-transfer analysis, but that conclusion is yours to reach.

## 3. Licence

Apache License 2.0 (`LICENSE`, verified by audit A15). You may use, modify and distribute it commercially, keep the licence and NOTICE, and mark changes. It includes a patent grant. Sections 7 and 8 disclaim warranty and limit liability: the software is provided **as is**.

## 4. Third-party content and trademarks

No third-party code is bundled (`THIRD_PARTY_NOTICES.md`). OpenTelemetry, Prometheus, Grafana, Loki, Sentry, Claude, Cursor, Codex, Gemini, GitHub Copilot and other names are trademarks of their owners and appear only as references. No affiliation, sponsorship or endorsement is claimed.

## 5. Name

"IncidentSutra" and `incidentsutra` were chosen by the author. No trademark search or registration has been performed. Do not read the name as a claim of exclusivity. Check availability before commercial rebranding.

## 6. Liability and reliance

Output is advisory evidence. It can be wrong, incomplete or misleading, especially when inputs are partial. Do not rely on it as the sole basis for production, safety, financial, legal or compliance decisions. The authors accept no responsibility for actions taken from its output beyond what the licence requires by law.

## 7. Responsible disclosure

Report vulnerabilities privately through GitHub security advisories (`SECURITY.md`). Do not send real logs.

## 8. Claims policy

The repository avoids unqualified superlatives about security, accuracy and compliance. Audit check A16 scans documentation for such wording.
