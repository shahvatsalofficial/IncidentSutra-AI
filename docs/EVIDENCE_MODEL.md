# Evidence model (v0.2.1)

Every event is observed **only from user-supplied input**. Four classes are first-class in the report (`claims`):

- **observed**: present in an imported record. Has an evidence ID (`evt_` + 20 hex of SHA-256 over source hash, file, record index and normalised time), source file, record number and source SHA-256.
- **inferred**: a hypothesis built from observed records. Always `unconfirmed`, confidence `undetermined`, review `pending_human_review`.
- **unknown**: data that was not supplied (metrics, traces, change records) or could not be parsed. Never filled in.
- **not run**: checks deliberately not executed (production diagnostics, trace joins, baselines, calibrated scoring).

Time: RFC3339 with explicit offset only. `timestamp` is UTC to the millisecond; `timestampNs` keeps the full integer nanosecond value; `originalTimestamp` and `originalOffset` are preserved; `timeBasis` says whether event time or collector observed time was used. Order is by instant, then sub-millisecond value, then source file, then record. Wall-clock order across hosts is not proof of causal order.

Integrity: `reportId` is `inc_` + 20 hex of SHA-256 over the report. It detects accidental or naive change. It is **not** a signature, attestation or chain of custody because anyone can recompute it. `provenance.json` lists SHA-256 of every output for the same limited purpose.

Privacy: masking is best effort and counted in `privacy`; it is not DLP.
