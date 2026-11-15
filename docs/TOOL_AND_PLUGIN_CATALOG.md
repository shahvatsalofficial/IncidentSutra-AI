# IncidentSutra AI — Plugins, Skills, Tools, MCP and Integration Catalog

**Creator:** Vatsal Shah · **Default:** no-key, offline, read-only. This is a planning catalog, not an installation record.

## Installation policy

Inventory existing local tools and active Claude Code skills/plugins/MCP servers first. Research currently maintained **official** SDKs, pin versions, verify permission scopes, assess licenses and advisories, prefer project-local dependencies, and request permission for global installs, external connectors, log export, production telemetry queries, paid APIs or cloud services. Never let a third-party tool grant production remediation rights automatically.

## Tier 0 — Core, already included

| Capability | Technology | Purpose | Status |
|---|---|---|---|
| Local CLI | Node.js 20+ | Zero-key portable program | Implemented |
| Evidence & hashes | Node `crypto`, `fs` | Deterministic local event IDs, input hashes | Implemented |
| Tests | Node `node:test` | Unit and security smoke tests | Implemented |
| Local read API | Node `http` | Localhost bearer-token report endpoints | Implemented (not Internet-ready) |
| Portable Agent Skills | `skills/*/SKILL.md` | Host-neutral role instructions | Implemented as files; native IDE activation untested |
| CI | GitHub Actions matrix | Windows/macOS/Linux with Node 20/22 | Configured; remote run unverified |

## Tier 1 — High-value optional read-only observability integrations

| Tool | Source | Data | Integration notes |
|---|---|---|---|
| OpenTelemetry / OTLP | https://opentelemetry.io/docs/collector/ | Traces, logs, metrics | Match Timestamp vs ObservedTimestamp; preserve trace/span linkage; no remote export by default |
| Prometheus HTTP API | https://prometheus.io/docs/prometheus/latest/querying/api/ | Metrics and SLO baselines | Restrict query range, step/series cardinality, authentication and timeouts; prefer metric read-only credentials |
| Grafana Loki | https://grafana.com/docs/loki/latest/reference/loki-http-api/ | Logs | Query-only endpoint, small windows and redaction; Loki itself expects external authorization controls |
| Grafana APIs | https://grafana.com/docs/grafana/latest/developers/http_api/ | Dashboards, service context | Auth scope, folder boundaries and rate limits; no public dashboard publishing |
| Jaeger | https://www.jaegertracing.io/docs/ | Trace/span data | Trace sampling caveat, search query limits, service matching |
| Grafana Tempo | https://grafana.com/docs/tempo/latest/ | Traces | Verify API version and separate trace storage from logs |
| Sentry | https://docs.sentry.io/ | Errors, releases and issues | Read-only project scope, pagination, rate budget and secret masking |
| Git + GitHub | https://git-scm.com/ | Commits, tags and release changes | Read-only release diff; no automatic rollback or user messaging |
| OpenSearch | https://opensearch.org/docs/latest/ | Indexed telemetry | Restrict indices/tenants, time and query volume; check deployment licensing |

## Tier 2 — Development security, policy, and engineering

| Tool | Source | Purpose | Guardrail |
|---|---|---|---|
| JSON Schema / Ajv | https://ajv.js.org/ | Validate strict normalized event/report contracts | Optional dependency; schema versioning and malformed input tests |
| Gitleaks | https://github.com/gitleaks/gitleaks | Detect secrets in sources and fixtures | Scan before public release and contributor PRs |
| OSV Scanner | https://github.com/google/osv-scanner | Dependency vulnerability detection | Check policy and pinned dependency versions |
| Open Policy Agent / Conftest | https://www.openpolicyagent.org/ | Policy-as-code for connector privileges | Read-only default; human-reviewed exceptions |
| Docker / Testcontainers | https://testcontainers.com/ | Local mock observability services and connector tests | Avoid privileged containers or mounting production secrets |
| Playwright / axe-core | https://playwright.dev/ | Responsive accessible dashboard tests | Only after UI implementation; test keyboard/assistive states |
| Mermaid | https://mermaid.js.org/ | Explain incident timelines/dependencies | Encode untrusted event labels |
| OpenTelemetry for self | https://opentelemetry.io/ | Profile parser and server behavior | Opt-in telemetry, never leak user incident payloads |

## Tier 3 — IDEs and agent collaboration

| Target | Portable skill location (subject to host version) | Capability to verify |
|---|---|---|
| Claude Code | `.claude/skills/` | Skills discovery, tool-permission boundaries, role invocation |
| Cursor | `.cursor/skills/` | Skill loading, fallback and instructions precedence |
| Codex | `.agents/skills/` | Skill discovery and approved tool use |
| Gemini CLI | `.gemini/skills/` | Skill discovery and local-only behavior |
| GitHub Copilot | `.github/skills/` | Support in targeted editor/version; never assume universal activation |
| Windsurf, Kiro, others | Explicit host adapters only after research | Actual interface/version and permissions compatibility tests |
| MCP adapter (future) | Official MCP SDKs | Read-only, bounded analysis tools with clear schemas and auth |
| Optional Ollama | https://ollama.com/ | Local AI summarization with no provider API key | GPU/memory budget, local endpoint only; not required for CLI |

## Suggested Claude Code project plugins/skills (optional)

Use maintained installed capabilities for repository navigation, test-first development, code review, security guidance, Git integration, Playwright where needed, Context7 for version-specific documentation, and MCP Inspector for adapter verification. These are **recommendations**, not claims of official distribution names/availability. Claude must verify actual plugin publisher and command before proposing installation; no blanket global install.

## Proposed integration order

1. **P0:** Keep core deterministic parser, evidence, report, unit tests secure. Improve DLP beyond regex and schemas.
2. **P1:** Read-only Prometheus or Loki mock adapter with bounded queries and auth tests.
3. **P2:** OpenTelemetry Collector ingest adapter, metric/tracing normalization, clock skew and sampled trace uncertainty.
4. **P3:** Grafana/Sentry/Jaeger read-only connectors and portable integration tests.
5. **P4:** Optional local AI hypothesis synthesis with falsification and evidence scoring; calibrated testing.
6. **P5:** Audited team server, accessible interface, retention controls and immutable/signable evidence exports.

## Hard boundaries

No live connector is implemented in the starter. User supplies sanitized fixture exports. The local API is a private loopback report reader, not a secure production SaaS. IncidentSutra must not execute restarts, rollbacks, deployments, destructive queries, alert-suppression actions, external paging or status-page publication without an independently secured, explicitly approved later action path.
