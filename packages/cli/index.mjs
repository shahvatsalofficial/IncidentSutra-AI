#!/usr/bin/env node
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEvents, redact, newRedactionStats, sha256} from '../core/ingest.mjs';
import {analyzeIncident, toMarkdown, toHTML, toPostmortem, toHypothesisRegister, verifyReport, verifySources, compareReports} from '../core/analyze.mjs';
import {runBenchmark} from '../core/benchmark.mjs';
import {runAudit} from '../core/audit.mjs';
import {auditToMarkdown, auditToHTML} from '../reporter/audit.mjs';
import {startServer} from '../server/index.mjs';
import {TOOL} from '../core/meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const value = (key, dflt) => { const i = args.indexOf(key); return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : dflt; };
const flag = key => args.includes(key);
export const HOSTS = {claude: '.claude/skills', cursor: '.cursor/skills', codex: '.agents/skills', agents: '.agents/skills', gemini: '.gemini/skills', copilot: '.github/skills'};

function usage() {
  console.log(`IncidentSutra AI ${TOOL.version} — evidence-first, offline incident intelligence

Usage:
  incidentsutra doctor
  incidentsutra analyze --input <file-or-folder> --out <directory> [--window-minutes 15] [--synthetic]
  incidentsutra verify --report <incident-report.json> [--input <original-telemetry>]
  incidentsutra compare --baseline <report.json> --candidate <report.json>
  incidentsutra redact --input <file-or-folder>          preview what would be masked (prints counts only)
  incidentsutra audit [--out <directory>]                run the automated self-audit (writes JSON, MD, HTML)
  incidentsutra benchmark [--out <directory>]            run the 26-case synthetic benchmark
  incidentsutra skills list
  incidentsutra skills install --host claude|cursor|codex|gemini|copilot|agents --project <directory>
  incidentsutra serve --report <incident-report.json> [--port 0]   (needs INCIDENTSUTRA_TOKEN, >= 24 chars)
  incidentsutra --version

Exit codes: 0 ok · 1 usage or runtime error · 2 verification, audit or benchmark failed.
Offline and read-only: no network, no command execution, no production access.`);
}
const json = async file => JSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
const contained = (root, target) => { const r = path.relative(root, target); return !r.startsWith('..') && !path.isAbsolute(r); };
const write = async (dir, name, content) => { await fs.writeFile(path.join(dir, name), content); return {file: name, sha256: sha256(content), bytes: Buffer.byteLength(content)}; };

async function installSkills(host, project) {
  if (!host || !Object.hasOwn(HOSTS, host)) throw new Error('Unsupported host. Choose ' + Object.keys(HOSTS).join(', '));
  if (!project) throw new Error('--project is required');
  const abs = path.resolve(project), st = await fs.lstat(abs);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('Project must be a real directory');
  const targetRoot = path.join(abs, HOSTS[host]); let count = 0;
  for (const ent of (await fs.readdir(path.join(ROOT, 'skills'), {withFileTypes: true})).filter(x => x.isDirectory())) {
    if (!/^incidentsutra-[a-z0-9-]+$/.test(ent.name)) continue;
    const parent = path.join(targetRoot, ent.name), dest = path.join(parent, 'SKILL.md');
    if (!contained(abs, dest)) throw new Error('Install path escapes project');
    await fs.mkdir(parent, {recursive: true});
    const stat = await fs.lstat(dest).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (stat) throw new Error(`Refusing to overwrite existing skill: ${dest}`);
    await fs.copyFile(path.join(ROOT, 'skills', ent.name, 'SKILL.md'), dest, fs.constants.COPYFILE_EXCL); count++;
  }
  console.log(JSON.stringify({host, project: abs, installed: count, directory: HOSTS[host]}, null, 2));
}

async function main() {
  if (command === '--version' || command === '-v' || command === 'version') return console.log(TOOL.version);
  if (command === 'help' || flag('--help') || flag('-h')) return usage();
  if (command === 'doctor') {
    return console.log(JSON.stringify({
      name: TOOL.name, version: TOOL.version, ruleVersion: TOOL.ruleVersion, runtime: process.version, offline: true, aiApiKeyRequired: false, platform: process.platform,
      capabilities: ['json/jsonl/csv and OTLP log JSON importer', 'strict RFC3339 + nanosecond-preserving UTC timeline', 'competing hypotheses with contradictions', 'read-only diagnostics catalogue (never executed)', 'MD, HTML, JSON and postmortem reports', 'report verification and source re-hash', 'redaction preview', 'automated self-audit', '26-case synthetic benchmark', 'read-only loopback API', '20 project-local Agent Skills'],
      notImplemented: ['live observability connectors', 'LLM inference', 'production remediation', 'multi-tenant server', 'signed provenance', 'verified native activation in every IDE']
    }, null, 2));
  }
  if (command === 'analyze') {
    const input = value('--input'), out = value('--out');
    if (!input || !out) throw new Error('--input and --out are required');
    const wm = Number(value('--window-minutes', '15'));
    if (!Number.isFinite(wm)) throw new Error('--window-minutes must be a number');
    const data = await loadEvents(input), report = analyzeIncident(data, {windowMinutes: wm, synthetic: flag('--synthetic')});
    const output = path.resolve(out); await fs.mkdir(output, {recursive: true});
    const outputs = [];
    outputs.push(await write(output, 'incident-report.json', JSON.stringify(report, null, 2) + '\n'));
    outputs.push(await write(output, 'incident-report.md', toMarkdown(report)));
    outputs.push(await write(output, 'incident-report.html', toHTML(report)));
    outputs.push(await write(output, 'normalized-events.jsonl', report.events.map(e => JSON.stringify(e)).join('\n') + '\n'));
    outputs.push(await write(output, 'incident-timeline.json', JSON.stringify(report.timeline, null, 2) + '\n'));
    outputs.push(await write(output, 'hypothesis-register.md', toHypothesisRegister(report)));
    outputs.push(await write(output, 'postmortem-draft.md', toPostmortem(report)));
    if (report.ingestionErrors.length || report.skippedInputs.length || report.duplicatesDropped.length) outputs.push(await write(output, 'ingestion-errors.json', JSON.stringify({rejected: report.ingestionErrors, skipped: report.skippedInputs, duplicatesDropped: report.duplicatesDropped}, null, 2) + '\n'));
    await write(output, 'provenance.json', JSON.stringify({schema: 'incidentsutra.provenance.v1', reportId: report.reportId, tool: report.tool, inputs: report.sources, outputs, notice: 'SHA-256 hashes detect accidental change. They are not a signature, attestation or chain of custody.'}, null, 2) + '\n');
    console.log(JSON.stringify({out: output, reportId: report.reportId, ...report.summary, hypotheses: report.hypotheses.length, contradictions: report.contradictions.length, gaps: report.gaps.map(g => g.kind), redactions: report.privacy.redactions, decision: report.decision.status}, null, 2));
    return;
  }
  if (command === 'verify') {
    const rp = value('--report'); if (!rp) throw new Error('--report is required');
    const report = await json(rp), result = verifyReport(report);
    if (result.ok && value('--input')) { const s = await verifySources(report, value('--input')); result.sources = s; if (!s.ok) { result.ok = false; result.issues.push(...s.issues); } }
    console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 2; return;
  }
  if (command === 'compare') {
    const base = value('--baseline'), cand = value('--candidate'); if (!base || !cand) throw new Error('--baseline and --candidate are required');
    const [a, b] = await Promise.all([json(base), json(cand)]);
    if (!verifyReport(a).ok || !verifyReport(b).ok) throw new Error('Invalid baseline or candidate report');
    return console.log(JSON.stringify(compareReports(a, b), null, 2));
  }
  if (command === 'redact') {
    const input = value('--input'); if (!input) throw new Error('--input is required');
    const data = await loadEvents(input), stats = newRedactionStats();
    for (const e of data.events) redact(e.message, stats);
    return console.log(JSON.stringify({events: data.events.length, redactionsAppliedAtIngest: data.redaction.count, byKind: data.redaction.byKind, policy: data.redaction.policy, note: 'Counts only; no raw values printed. Review the generated report before sharing.'}, null, 2));
  }
  if (command === 'benchmark') {
    const b = runBenchmark(), out = value('--out');
    if (out) { const d = path.resolve(out); await fs.mkdir(d, {recursive: true}); await fs.writeFile(path.join(d, 'benchmark.json'), JSON.stringify(b, null, 2) + '\n'); }
    console.log(JSON.stringify({cases: b.cases, casesPassed: b.casesPassed, expectations: b.expectations, expectationsPassed: b.expectationsPassed, labelProvenance: b.labelProvenance, failed: b.results.filter(r => !r.pass).map(r => r.id)}, null, 2));
    if (b.casesPassed !== b.cases) process.exitCode = 2; return;
  }
  if (command === 'audit') {
    const a = await runAudit({root: ROOT}), out = value('--out');
    if (out) {
      const d = path.resolve(out); await fs.mkdir(d, {recursive: true});
      await fs.writeFile(path.join(d, 'audit-report.json'), JSON.stringify(a, null, 2) + '\n');
      await fs.writeFile(path.join(d, 'audit-report.md'), auditToMarkdown(a));
      await fs.writeFile(path.join(d, 'audit-report.html'), auditToHTML(a));
    }
    console.log(JSON.stringify({verdict: a.verdict, ...a.counts, failed: a.checks.filter(c => c.status === 'fail').map(c => `${c.id}: ${c.detail}`), out: out ? path.resolve(out) : null}, null, 2));
    if (a.verdict === 'FAIL') process.exitCode = 2; return;
  }
  if (command === 'skills') {
    const action = args[1];
    if (action === 'list') return console.log((await fs.readdir(path.join(ROOT, 'skills'))).sort().join('\n'));
    if (action === 'install') return installSkills(value('--host'), value('--project'));
    throw new Error('Choose skills list or skills install');
  }
  if (command === 'serve') {
    const rp = value('--report'), port = Number(value('--port', '0')); if (!rp) throw new Error('--report is required');
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
    const report = await json(rp); if (!verifyReport(report).ok) throw new Error('Invalid report');
    const token = process.env.INCIDENTSUTRA_TOKEN;
    if (!token || token.length < 24) throw new Error('Set INCIDENTSUTRA_TOKEN with at least 24 random characters');
    const server = await startServer({report, port, token}); console.log(`IncidentSutra read-only API: http://127.0.0.1:${server.address().port}`); return;
  }
  throw new Error(`Unknown command ${command}`);
}
main().catch(e => { console.error('IncidentSutra error:', e.message); process.exitCode = 1; });
