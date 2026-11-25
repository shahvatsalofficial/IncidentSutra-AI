# Glossary

> Plain-language definitions of the terms used in the reports and documentation.

| Term | Meaning |
|---|---|
| Alert storm | Five or more error or alert signals within five minutes |
| Blameless postmortem | A review that studies systems and conditions, not individual fault |
| Change | A deployment, release, rollout, rollback, configuration or feature-flag event |
| Chain of custody | A verifiable record of who handled evidence. This tool does **not** provide one |
| Clock skew | Difference between the clocks of two machines. Marked unassessed here |
| Confidence | Always "undetermined": no calibrated scoring exists |
| Contradiction | An observation that weakens a hypothesis |
| Correlation | Two things happening close in time. It is not causation |
| DLP | Data-loss prevention. The built-in masking is not DLP |
| Evidence ID | `evt_` plus 20 hex characters identifying one imported record |
| Gap | Information the investigation needs but did not receive |
| Hypothesis | A testable explanation that is not confirmed |
| Incident commander | The human who owns decisions during an incident |
| Not run | A check that was proposed but deliberately not executed |
| OTLP | OpenTelemetry protocol; the log JSON form is supported |
| Provenance | Where a fact came from: file, record number, source hash |
| Redaction | Masking secrets and personal data, on a best-effort basis |
| Report digest | A hash inside `reportId` that detects accidental change. Not a signature |
| RFC3339 | The timestamp format required here, with an explicit offset |
| Skill | A `SKILL.md` instruction file an AI coding tool can load |
| SLO | Service level objective, a reliability target |
| UTC | Coordinated Universal Time, the common clock used in reports |
