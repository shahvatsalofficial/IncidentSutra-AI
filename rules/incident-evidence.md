# Incident Evidence Rules
1. Store source hash, file and record index for each observed event.
2. Use RFC3339 with timezone and normalize to UTC; reject missing time zone.
3. Temporal correlation does not confirm cause.
4. Rank hypotheses only with a documented, calibrated methodology; starter reports confidence undetermined.
5. Record contradicting observations and missing signals.
6. No production mutation, shell execution or status-page posting without explicit human approval.
7. Redact user secrets and remove customer PII before any export.
