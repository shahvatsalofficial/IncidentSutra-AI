# User guide

## 1. Install

Nothing to install for a one-off run:

```bash
npx incidentsutra --version
```

Or clone: `git clone https://github.com/shahvatsalofficial/IncidentSutra-AI`, then `npm run doctor`. Node.js 20 or newer is required. No API key, no network.

## 2. Prepare your data

1. Export a **small, relevant window** of logs, alerts, metrics and deployment records (JSON, JSONL or CSV).
2. **Sanitize upstream.** Remove credentials and personal data at the source. Built-in redaction is a safety net only.
3. Make sure every record has an RFC3339 timestamp with an offset, for example `2026-11-10T19:52:00Z` or `2026-11-11T01:22:00+05:30`.
4. Put the files in one folder. Do not include symlinks.

Example JSONL:

```jsonl
{"timestamp":"2026-11-10T19:52:00Z","type":"deploy","service":"checkout","message":"release 2.7.1","deploymentId":"checkout-2.7.1"}
{"timestamp":"2026-11-10T19:54:00Z","type":"alert","service":"checkout","severity":"critical","message":"error budget burn"}
{"timestamp":"2026-11-10T19:55:00Z","type":"metric","service":"checkout","message":"p95","attributes":{"p95_ms":2100,"error_rate_pct":8}}
```

## 3. Analyze

```bash
npx incidentsutra analyze --input ./export --out ./report
```

Add `--window-minutes 30` to widen the change-to-error window (1 to 120, default 15). Add `--synthetic` for demos so the HTML shows a banner.

Open `report/incident-report.html`. Read in this order: Summary, Timeline, Hypotheses, **Evidence gaps**, Ingestion quality.

## 4. How to read the report

| Chip | Meaning |
|---|---|
| observed | Present in an imported record; has an evidence ID |
| inferred | A hypothesis from observed records; never confirmed |
| unknown | Data not supplied; absence is not evidence of health |
| not run | A check deliberately not executed |

For each hypothesis ask: What would have to be true? What contradicts it? Which read-only check separates it from the others? Click an evidence ID to jump to the timeline row.

## 5. Verify before sharing

```bash
npx incidentsutra verify --report report/incident-report.json --input ./export
```

Exit code 2 means a changed report or changed source files. The digest catches accidents, not a determined forger.

## 6. Check what was masked

```bash
npx incidentsutra redact --input ./export
```

Counts only. Then read the HTML yourself for names, addresses, IPv6 and unprefixed secrets, which are **not** masked.

## 7. Write the postmortem

Open `postmortem-draft.md`. Fill every `TODO (human)`: impact, what responders did, lessons, action items with owners. Keep it blameless.

## 8. Compare two runs

```bash
npx incidentsutra compare --baseline before/incident-report.json --candidate after/incident-report.json
```

## 9. Use the skills in your AI coding tool

```bash
npx incidentsutra skills install --host claude --project .
```

Hosts: `claude`, `cursor`, `codex`, `gemini`, `copilot`, `agents`. Existing files are never overwritten. Ask the assistant to start with `incidentsutra-prime`. Whether the host auto-discovers the skills depends on its version and is not verified here.

## 10. Read the report over HTTP (optional, local)

```bash
export INCIDENTSUTRA_TOKEN="$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")"
npx incidentsutra serve --report report/incident-report.json
curl -H "Authorization: Bearer $INCIDENTSUTRA_TOKEN" http://127.0.0.1:<port>/v1/summary
```

Loopback only, GET only. Do not expose it.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Timestamp must be RFC3339 with explicit Z or +/-HH:MM timezone` | Add an offset to the record. The tool never guesses a zone |
| `Invalid calendar date` | The date does not exist (for example Feb 30). Fix the source |
| `Input too large` | Split the file under 2 MB |
| `Event limit exceeded (5000)` | Narrow the time window |
| Many `invalid_records` gaps | Open `ingestion-errors.json` |
| `Refusing to overwrite existing skill` | Skills are already installed; delete the old copy first if you want to replace it |
| Symlink input rejected | Copy real files into a plain folder |

## Do and do not

Do review every hypothesis, collect disconfirming evidence, and let your incident commander decide. Do not paste the report into a public ticket without review. Do not treat "no gaps" as "complete data".
