# Blameless postmortem — DRAFT for human review

> Generated from report `inc_e95e3ae334e5f1390998`. Sections marked **TODO (human)** need the incident team. No individual blame; focus on systems and conditions.

## Summary

TODO (human): one-paragraph summary. Imported data covers 2026-11-10T19:40:00.000Z to 2026-11-10T20:02:00.000Z across checkout, notifications, payments.

## Impact

TODO (human): customer impact, duration, SLO/error-budget effect. Metrics supplied: 2. 

## Detection

First error/alert signal in the data: 2026-11-10T19:49:00.000Z (checkout, `evt_5cc6ce3f88bbe686a2b1`).

## Timeline (observed)

- 2026-11-10T19:40:00.000Z — checkout: Baseline checkout p95 latency 220ms, error rate 0.1% (`evt_969c8550e1b83b9d6d92`)
- 2026-11-10T19:45:00.000Z — checkout: Checkout release 2.7.0 rollout started (`evt_9a1ec8c4509bf193501e`)
- 2026-11-10T19:49:00.000Z — checkout: Intermittent checkout payment dependency timeout before second deployment (`evt_5cc6ce3f88bbe686a2b1`)
- 2026-11-10T19:52:00.000Z — checkout: Checkout release 2.7.1 rolled out (`evt_cc4992c8882161412b0a`)
- 2026-11-10T19:54:00.000Z — checkout: Checkout error budget burn above threshold (`evt_9a8cc244ee051d5ad97a`)
- 2026-11-10T19:55:00.000Z — checkout: Checkout p95 latency 2100ms, error rate 8% (`evt_591427918bf4b89155c4`)
- 2026-11-10T19:56:00.000Z — checkout: Payment gateway timeout; Bearer [REDACTED] should be hidden; contact [REDACTED_EMAIL] (`evt_5ef4f8aad618256ca464`)
- 2026-11-10T19:57:00.000Z — notifications: Unrelated notifications release (`evt_4c27901e059d268cdfc4`)
- 2026-11-10T20:02:00.000Z — payments: External payment processor increased latency (`evt_4db866928afb7dadea76`)

## Contributing factors (candidates, unconfirmed)

- Change "checkout-2.7.0" may be related to checkout errors — supporting evt_9a1ec8c4509bf193501e, evt_5cc6ce3f88bbe686a2b1, evt_9a8cc244ee051d5ad97a, evt_5ef4f8aad618256ca464; contradicting none
- Change "checkout-2.7.1" may be related to checkout errors — supporting evt_cc4992c8882161412b0a, evt_9a8cc244ee051d5ad97a, evt_5ef4f8aad618256ca464; contradicting evt_5cc6ce3f88bbe686a2b1
- Dependency or third-party failure may be affecting checkout — supporting evt_5cc6ce3f88bbe686a2b1; contradicting evt_5ef4f8aad618256ca464, evt_4db866928afb7dadea76
- Independent service or dependency problem affecting checkout — supporting evt_5cc6ce3f88bbe686a2b1, evt_9a8cc244ee051d5ad97a, evt_5ef4f8aad618256ca464; contradicting evt_9a1ec8c4509bf193501e, evt_cc4992c8882161412b0a

## Mitigations performed by humans

TODO (human): record what responders actually did and when. This tool executed nothing.

## What went well / what went poorly / where we got lucky

TODO (human)

## Action items

| Action | Owner | Due | Evidence |
|---|---|---|---|
| TODO (human) | | | |

## Evidence gaps

- Sources use different UTC offsets; all were converted to UTC, but clock skew between sources was not measured.

## Review

Status: **DRAFT — not reviewed**. Reviewer: _____ Date: _____
