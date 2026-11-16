# IncidentSutra AI — Incident Evidence Report

**Report:** `inc_e95e3ae334e5f1390998`  
**Schema:** incidentsutra.report.v2 · **Tool:** undefined 0.2.1 · **Rules:** 2026.11-r2  
**Mode:** offline / read-only  
**Review:** HUMAN_REVIEW_REQUIRED  
**Data:** SYNTHETIC demonstration data  

> Advisory only. Timing is not causation. Nothing was executed against any system.

## Summary

- Events: 9; services: checkout, notifications, payments
- Errors/alerts: 3; deployments/changes: 3; metrics: 2
- Window: 2026-11-10T19:40:00.000Z to 2026-11-10T20:02:00.000Z
- Root cause: **unconfirmed** (confidence: undetermined)

## How to read this report

- **observed**: present in an imported record (has an evidence ID).
- **inferred**: a hypothesis built from observed records; never confirmed here.
- **unknown**: data that was not supplied; absence is not evidence of health.
- **not run**: checks this tool deliberately did not execute.

## Auditable timeline

| Time (UTC) | Observation | Service | Type | Evidence |
|---|---|---|---|---|
| 2026-11-10T19:40:00.000Z | Baseline checkout p95 latency 220ms, error rate 0.1% | checkout | metric | evt_969c8550e1b83b9d6d92 (observations.jsonl:1) |
| 2026-11-10T19:45:00.000Z | Checkout release 2.7.0 rollout started | checkout | deploy | evt_9a1ec8c4509bf193501e (observations.jsonl:2) |
| 2026-11-10T19:49:00.000Z | Intermittent checkout payment dependency timeout before second deployment | checkout | error | evt_5cc6ce3f88bbe686a2b1 (observations.jsonl:3) |
| 2026-11-10T19:52:00.000Z | Checkout release 2.7.1 rolled out | checkout | deploy | evt_cc4992c8882161412b0a (observations.jsonl:4) |
| 2026-11-10T19:54:00.000Z | Checkout error budget burn above threshold | checkout | alert | evt_9a8cc244ee051d5ad97a (observations.jsonl:5) |
| 2026-11-10T19:55:00.000Z | Checkout p95 latency 2100ms, error rate 8% | checkout | metric | evt_591427918bf4b89155c4 (observations.jsonl:6) |
| 2026-11-10T19:56:00.000Z | Payment gateway timeout; Bearer [REDACTED] should be hidden; contact [REDACTED_EMAIL] | checkout | error | evt_5ef4f8aad618256ca464 (observations.jsonl:7) |
| 2026-11-10T19:57:00.000Z | Unrelated notifications release | notifications | deploy | evt_4c27901e059d268cdfc4 (deployments.csv:1) |
| 2026-11-10T20:02:00.000Z | External payment processor increased latency | payments | log | evt_4db866928afb7dadea76 (observations.jsonl:8) |

## Competing hypotheses

### Change "checkout-2.7.0" may be related to checkout errors
Family: deployment-change · Status: **unconfirmed** · Confidence: **undetermined** · Review: pending_human_review

The change and error signals occur close in time. Timing alone cannot establish causality.

Would need to be true:
- Error rate for checkout rises after 2026-11-10T19:45:00.000Z and not before
- Cohorts still on the previous version stay healthy

Supporting evidence: evt_9a1ec8c4509bf193501e, evt_5cc6ce3f88bbe686a2b1, evt_9a8cc244ee051d5ad97a, evt_5ef4f8aad618256ca464  
Contradicting evidence: none

Contradictions:
- Other services changed in the same window without error signals (weakly informative). (evt_4c27901e059d268cdfc4)

Would disconfirm:
- Errors found before the change in unsupplied data
- Rolling back or disabling the change in a canary does not change the error rate (not run)

Read-only checks proposed (**not executed**):
- Compare error rate and latency for the affected service in matching windows before and after the change — permission `read:metrics`, cost low
- Review the release diff and feature-flag changes for the affected code path — permission `read:source-control`, cost low
- Compare an unchanged region, cohort or canary on the prior version — permission `read:metrics`, cost low

### Change "checkout-2.7.1" may be related to checkout errors
Family: deployment-change · Status: **unconfirmed** · Confidence: **undetermined** · Review: pending_human_review

The change and error signals occur close in time. Timing alone cannot establish causality.

Would need to be true:
- Error rate for checkout rises after 2026-11-10T19:52:00.000Z and not before
- Cohorts still on the previous version stay healthy

Supporting evidence: evt_cc4992c8882161412b0a, evt_9a8cc244ee051d5ad97a, evt_5ef4f8aad618256ca464  
Contradicting evidence: evt_5cc6ce3f88bbe686a2b1

Contradictions:
- 1 error/alert signal(s) precede this change; the problem pre-dates it. (evt_5cc6ce3f88bbe686a2b1)
- Other services changed in the same window without error signals (weakly informative). (evt_4c27901e059d268cdfc4)

Would disconfirm:
- Observed: errors before the change (evt_5cc6ce3f88bbe686a2b1)
- Rolling back or disabling the change in a canary does not change the error rate (not run)

Read-only checks proposed (**not executed**):
- Compare error rate and latency for the affected service in matching windows before and after the change — permission `read:metrics`, cost low
- Review the release diff and feature-flag changes for the affected code path — permission `read:source-control`, cost low
- Compare an unchanged region, cohort or canary on the prior version — permission `read:metrics`, cost low

### Dependency or third-party failure may be affecting checkout
Family: dependency-or-third-party · Status: **unconfirmed** · Confidence: **undetermined** · Review: pending_human_review

Messages near the onset mention timeouts, upstream, provider or gateway problems.

Would need to be true:
- The dependency degraded at or before onset
- Failing requests traverse the dependency

Supporting evidence: evt_5cc6ce3f88bbe686a2b1  
Contradicting evidence: evt_5ef4f8aad618256ca464, evt_4db866928afb7dadea76

Contradictions:
- Dependency signals appear after the first error, so they may be effects rather than causes. (evt_5ef4f8aad618256ca464, evt_4db866928afb7dadea76)

Would disconfirm:
- Dependency health is normal at onset (not run)
- Failing traces do not touch the dependency (no trace join run)

Read-only checks proposed (**not executed**):
- Check upstream dependency health, latency and status notices for the same window — permission `read:metrics`, cost low
- Join failing requests by trace ID to dependency spans — permission `read:traces`, cost medium

### Independent service or dependency problem affecting checkout
Family: other-or-unmodeled · Status: **unconfirmed** · Confidence: **undetermined** · Review: pending_human_review

Observed errors may come from dependencies, traffic, capacity or prior latent defects rather than a release.

Would need to be true:
- A cause independent of the supplied changes exists

Supporting evidence: evt_5cc6ce3f88bbe686a2b1, evt_9a8cc244ee051d5ad97a, evt_5ef4f8aad618256ca464  
Contradicting evidence: evt_9a1ec8c4509bf193501e, evt_cc4992c8882161412b0a

Would disconfirm:
- Evidence tying the errors to a specific supplied change

Read-only checks proposed (**not executed**):
- Check traffic volume, capacity headroom and external provider notices — permission `read:metrics`, cost low
- Collect affected-service SLO and error-budget data — permission `read:metrics`, cost low

### Root cause remains undetermined
Family: unknown · Status: **unconfirmed** · Confidence: **undetermined** · Review: pending_human_review

The supplied data cannot rule out causes outside the modeled families.

Supporting evidence: none  
Contradicting evidence: none

Read-only checks proposed (**not executed**):
- Collect error and alert data and identify affected services and SLO impact — permission `read:metrics`, cost low

## Observed metric series

| Series | Points | First | Last | Min | Max |
|---|---|---|---|---|---|
| checkout/error_rate_pct | 2 | 0.1 | 8 | 0.1 | 8 |
| checkout/p95_ms | 2 | 220 | 2100 | 220 | 2100 |

## Evidence gaps (unknown)

- **mixed_time_offsets**: Sources use different UTC offsets; all were converted to UTC, but clock skew between sources was not measured.

## Ingestion quality and privacy

- Files: 2; rejected records: 0; skipped inputs: 0; cross-file duplicates dropped: 0
- UTC offsets seen: Z×8, +05:30×1; precisions: s×9
- Clock skew between sources: unassessed. Wall-clock ordering across hosts and regions is not proof of causal order; clock skew between sources was not measured.
- Redactions applied: 2. best-effort masking; not a DLP guarantee; sanitize exports upstream.

## Sources

| File | SHA-256 | Records |
|---|---|---|
| deployments.csv | `529732004d8da13a70b348e7ae95d315fee0018cab187e0df49f3ad1dd7789ad` | 1 |
| observations.jsonl | `31a737fee9d579b9173ffeb3ea2cb37d957b4dce92e54085ff896a85d122be05` | 8 |

## Not run

- production diagnostics
- production mutations
- trace joins
- baseline comparison against historical windows
- calibrated confidence scoring

## Recommended human-led next steps

- Confirm scope/impact and incident commander contact
- Check SLOs and metrics before inferring root cause
- Review each hypothesis and seek disconfirming evidence
- Approve any operational action through the normal incident-management process
- Complete blameless postmortem after human review

## Limitations

No production diagnostics or remediations were executed. Temporal correlation is not causation. Missing data does not imply a clean environment. Redaction is best-effort. The report digest detects accidental change only; it is not a signature or chain of custody.
