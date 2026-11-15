# Implementation status (v0.2.0)

Source of truth for what works. Test and audit numbers are machine-written to `documents/IncidentSutra-AI/test-results.md` and `evidence/`.

**Working and tested:** offline JSON, JSONL, CSV and OTLP log ingestion; strict RFC3339 parsing with nanosecond retention; deterministic evidence IDs and SHA-256 source hashes; duplicate, symlink and size handling; best-effort redaction with counts; rule-based competing hypotheses with contradictions and unexecuted read-only diagnostics; MD, HTML and JSON reports; blameless postmortem draft; report verification and source re-hash; comparison; automated self-audit; 26-case synthetic benchmark; loopback bearer-token GET-only API; 20 generated role-specific skills and project-local installer.

**Limited:** correlation is rule-based and keyword-driven; there is no causal inference and no calibrated confidence (always `undetermined`). Redaction is best effort (known gaps listed in the audit). Benchmark labels are self-authored and synthetic. The report digest detects accidental change only.

**Not implemented:** live observability connectors, LLM inference, multi-tenant server, signed provenance, tested native skill activation in each IDE, accessible interactive console.

Do not describe this as a production incident controller or an automatic root-cause engine.
