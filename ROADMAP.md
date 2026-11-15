# Roadmap

Honest status: **shipped** means implemented and covered by tests; **planned** means not started.

| Phase | Scope | Status |
|---|---|---|
| P0 | JSON/JSONL/CSV/OTLP-log ingest, UTC timeline, hypotheses, MD/HTML/JSON reports, verify, redaction, audit, benchmark, loopback API, skill installer | shipped (0.2.0) |
| P1 | Prometheus *or* Loki read-only adapter with bounded queries and mock-server tests; IPv6 and configurable PII detectors; streaming ingest for larger files | planned |
| P2 | OTel collector ingest, sampled-trace uncertainty, trace joins | planned |
| P3 | Grafana, Sentry, Jaeger read-only connectors | planned |
| P4 | Optional local-model hypothesis synthesis with calibration against an independently labelled benchmark | planned |
| P5 | Accessible investigation console tested with Playwright and axe-core | planned |
| P6 | Authenticated team server (RBAC, retention, audit log), signed evidence export, independent security review | planned |
| P7 | Verified native activation per IDE and version; published compatibility evidence | planned |

No connector, model call or server beyond loopback exists today.
