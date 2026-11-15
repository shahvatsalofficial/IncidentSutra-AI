import {sha256, loadEvents} from './ingest.mjs';
import {TOOL, REPORT_SCHEMA, LEGACY_REPORT_SCHEMAS} from './meta.mjs';
export {toMarkdown, toHTML, toPostmortem, toHypothesisRegister} from '../reporter/index.mjs';

const has = (e, terms) => terms.some(t => e.type.includes(t) || e.severity.includes(t));
export const isDeployment = e => has(e, ['deploy', 'release', 'rollout', 'rollback', 'config-change', 'flag']);
export const isIssue = e => has(e, ['error', 'alert', 'incident', 'critical', 'failure', 'outage', 'fatal']);
export const isMetric = e => has(e, ['metric', 'latency', 'cpu', 'memory', 'slo', 'saturation']) || e.metricValue !== undefined;

const SIGNALS = {
  dependency: /time(?:d)?[ -]?out|upstream|downstream|third[- ]party|dependency|gateway|processor|provider|connection (?:refused|reset)|dns|unreachable|\b50[234]\b/i,
  saturation: /\bcpu\b|out of memory|\boom\b|saturat|pool exhaust|throttl|queue (?:depth|backlog)|disk (?:full|pressure)|rate limit|memory pressure/i,
  datastore: /database|\bdb\b|postgres|mysql|redis|mongo|deadlock|replica lag|migration|connection pool|slow quer|lock wait/i
};
export const signalsOf = e => Object.entries(SIGNALS).filter(([, re]) => re.test(`${e.message} ${e.type}`)).map(([k]) => k);
const ms = e => Date.parse(e.timestamp);
const ids = (list, n = 8) => list.slice(0, n).map(e => e.id);
const uniq = a => [...new Set(a)];

const DIAG = {
  deploy: [
    {description: 'Compare error rate and latency for the affected service in matching windows before and after the change', permission: 'read:metrics', cost: 'low', expected: 'If related: step change at the change time; if not: no change or earlier onset'},
    {description: 'Review the release diff and feature-flag changes for the affected code path', permission: 'read:source-control', cost: 'low', expected: 'A code or config path touching the failing operation'},
    {description: 'Compare an unchanged region, cohort or canary on the prior version', permission: 'read:metrics', cost: 'low', expected: 'If related: unchanged cohort stays healthy'}
  ],
  dependency: [
    {description: 'Check upstream dependency health, latency and status notices for the same window', permission: 'read:metrics', cost: 'low', expected: 'Elevated dependency latency or errors preceding the onset'},
    {description: 'Join failing requests by trace ID to dependency spans', permission: 'read:traces', cost: 'medium', expected: 'Failing traces share a slow or failing dependency span'}
  ],
  saturation: [
    {description: 'Inspect CPU, memory, connection-pool and queue saturation for the service', permission: 'read:metrics', cost: 'low', expected: 'A resource near its limit at or before onset'},
    {description: 'Compare request volume with the previous week at the same hour', permission: 'read:metrics', cost: 'low', expected: 'Traffic above baseline if load-driven'}
  ],
  datastore: [
    {description: 'Check datastore connection counts, lock waits, replica lag and recent schema migrations', permission: 'read:metrics', cost: 'low', expected: 'Connection exhaustion, lock contention or lag at onset'}
  ],
  latent: [
    {description: 'Search for the same error signature in the 7 days before the incident', permission: 'read:logs', cost: 'medium', expected: 'Prior occurrences indicate a latent defect rather than a new change'}
  ],
  generic: [
    {description: 'Check traffic volume, capacity headroom and external provider notices', permission: 'read:metrics', cost: 'low', expected: 'Traffic spike or provider incident coincident with onset'},
    {description: 'Collect affected-service SLO and error-budget data', permission: 'read:metrics', cost: 'low', expected: 'Quantifies impact and onset'}
  ],
  unknown: [
    {description: 'Collect error and alert data and identify affected services and SLO impact', permission: 'read:metrics', cost: 'low', expected: 'Enough signal to form a testable explanation'}
  ]
};
const diag = (hid, key) => DIAG[key].map((d, i) => ({id: `${hid}_chk${i + 1}`, class: 'read-only', executed: false, rollback: 'not applicable (read-only)', ...d}));

function hypo({kind, family, title, service, reason, mustBeTrue, supporting, contradicting, disconfirming, gaps, diagKey, seed, contradictions = []}) {
  const id = 'hyp_' + sha256(`${kind}:${service}:${seed ?? ''}`).slice(0, 12);
  const diagnostics = diag(id, diagKey);
  return {
    id, title, kind, family, status: 'unconfirmed', confidence: 'undetermined', reviewStatus: 'pending_human_review',
    reason, mustBeTrue, affectedScope: {services: [service]},
    supportingEventIds: uniq(supporting), contradictingEventIds: uniq(contradicting), contradictions,
    disconfirmingObservations: disconfirming, knownGaps: gaps,
    proposedChecks: diagnostics.map(d => d.description), diagnostics
  };
}

function metricSeries(events) {
  const series = {};
  for (const e of events) {
    const nums = Object.entries(e.attributes ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
    if (e.metricValue !== undefined) nums.push([e.type === 'metric' ? 'value' : e.type, e.metricValue]);
    for (const [k, v] of nums) (series[`${e.service}/${k}`] ??= []).push({eventId: e.id, timestamp: e.timestamp, value: v});
  }
  return Object.entries(series).sort(([a], [b]) => a.localeCompare(b)).map(([name, pts]) => ({name, points: pts.length, first: pts[0], last: pts.at(-1), min: Math.min(...pts.map(p => p.value)), max: Math.max(...pts.map(p => p.value)), classification: 'observed'}));
}

function alertStorms(issues, windowMs = 5 * 60_000, min = 5) {
  const storms = []; let i = 0;
  while (i < issues.length) {
    let j = i; while (j + 1 < issues.length && ms(issues[j + 1]) - ms(issues[i]) <= windowMs) j++;
    if (j - i + 1 >= min) { storms.push({start: issues[i].timestamp, end: issues[j].timestamp, count: j - i + 1, services: uniq(issues.slice(i, j + 1).map(e => e.service)).sort(), eventIds: ids(issues.slice(i, j + 1), 10)}); i = j + 1; } else i++;
  }
  return storms;
}

export function analyzeIncident(data, opts = {}) {
  const events = data.events ?? [];
  if (!Array.isArray(events) || !events.length) throw new Error('At least one event is required');
  const windowMinutes = Number.isFinite(opts.windowMinutes) ? opts.windowMinutes : 15;
  if (windowMinutes < 1 || windowMinutes > 120) throw new Error('windowMinutes must be 1..120');
  const win = windowMinutes * 60_000;
  const deployments = events.filter(isDeployment), issues = events.filter(isIssue), metrics = events.filter(isMetric);
  const timeline = events.map(e => ({timestamp: e.timestamp, eventId: e.id, type: e.type, service: e.service, severity: e.severity, description: e.message || e.type, verification: 'observed', timePrecision: e.timePrecision, source: e.source}));
  const hypotheses = [];
  const services = uniq(issues.map(e => e.service)).sort();
  const signalEvents = kind => events.filter(e => signalsOf(e).includes(kind));

  for (const service of services) {
    const si = issues.filter(e => e.service === service), first = si[0];
    const sdep = deployments.filter(d => d.service === service);
    const near = sdep.filter(d => Math.abs(ms(first) - ms(d)) <= win);
    for (const d of near.slice(0, 3)) {
      const after = si.filter(e => ms(e) >= ms(d)), before = si.filter(e => ms(e) < ms(d));
      const label = d.deployment || d.message.slice(0, 60);
      const contradictions = [];
      if (before.length) contradictions.push({kind: 'errors_before_change', eventIds: ids(before, 5), note: `${before.length} error/alert signal(s) precede this change; the problem pre-dates it.`});
      if (!after.length) contradictions.push({kind: 'no_errors_after_change', eventIds: [d.id], note: 'No error/alert signal follows this change in the supplied data.'});
      const unaffected = deployments.filter(o => o.service !== service && !services.includes(o.service) && Math.abs(ms(o) - ms(d)) <= win);
      if (unaffected.length) contradictions.push({kind: 'unaffected_services_changed', eventIds: ids(unaffected, 5), note: 'Other services changed in the same window without error signals (weakly informative).'});
      hypotheses.push(hypo({
        kind: 'temporal-correlation', family: 'deployment-change', service, seed: d.id,
        title: `Change "${label}" may be related to ${service} errors`,
        reason: 'The change and error signals occur close in time. Timing alone cannot establish causality.',
        mustBeTrue: [`Error rate for ${service} rises after ${d.timestamp} and not before`, 'Cohorts still on the previous version stay healthy'],
        supporting: [d.id, ...ids(after, 5)], contradicting: [...ids(before, 5), ...(!after.length ? [d.id] : [])], contradictions,
        disconfirming: [before.length ? `Observed: errors before the change (${ids(before, 3).join(', ')})` : 'Errors found before the change in unsupplied data', 'Rolling back or disabling the change in a canary does not change the error rate (not run)'],
        gaps: ['Release diff not supplied', 'No canary or per-cohort data supplied'], diagKey: 'deploy'
      }));
    }
    // dependency / third-party
    const dep = signalEvents('dependency').filter(e => Math.abs(ms(e) - ms(first)) <= win);
    if (dep.length) {
      const preceding = dep.filter(e => ms(e) <= ms(first)), following = dep.filter(e => ms(e) > ms(first));
      hypotheses.push(hypo({
        kind: 'dependency-failure', family: 'dependency-or-third-party', service, seed: 'dep',
        title: `Dependency or third-party failure may be affecting ${service}`,
        reason: 'Messages near the onset mention timeouts, upstream, provider or gateway problems.',
        mustBeTrue: ['The dependency degraded at or before onset', 'Failing requests traverse the dependency'],
        supporting: ids(preceding.length ? preceding : dep, 6), contradicting: ids(following, 5),
        contradictions: following.length ? [{kind: 'dependency_signal_after_onset', eventIds: ids(following, 5), note: 'Dependency signals appear after the first error, so they may be effects rather than causes.'}] : [],
        disconfirming: ['Dependency health is normal at onset (not run)', 'Failing traces do not touch the dependency (no trace join run)'],
        gaps: events.some(e => e.traceId) ? ['Trace-to-dependency join not run'] : ['No trace IDs supplied; dependency linkage unchecked'], diagKey: 'dependency'
      }));
    }
    const sat = signalEvents('saturation').filter(e => Math.abs(ms(e) - ms(first)) <= win);
    if (sat.length) hypotheses.push(hypo({
      kind: 'resource-saturation', family: 'saturation-or-traffic', service, seed: 'sat',
      title: `Resource saturation or traffic shift may be affecting ${service}`,
      reason: 'Messages near the onset mention CPU, memory, pool, queue or throttling pressure.',
      mustBeTrue: ['A resource approached its limit at or before onset', 'Errors scale with load'],
      supporting: ids(sat, 6), contradicting: [], disconfirming: ['Resource headroom was ample at onset (not run)', 'Traffic was at baseline (not run)'],
      gaps: metrics.length ? [] : ['No metrics supplied to quantify saturation'], diagKey: 'saturation'
    }));
    const ds = signalEvents('datastore').filter(e => Math.abs(ms(e) - ms(first)) <= win);
    if (ds.length) hypotheses.push(hypo({
      kind: 'datastore-issue', family: 'data-store-or-migration', service, seed: 'ds',
      title: `Datastore connection or migration issue may be affecting ${service}`,
      reason: 'Messages near the onset mention database, pool, lock or migration problems.',
      mustBeTrue: ['The datastore degraded at or before onset', 'Failing operations touch the datastore'],
      supporting: ids(ds, 6), contradicting: [], disconfirming: ['Datastore metrics normal at onset (not run)'], gaps: ['Datastore-side metrics not supplied'], diagKey: 'datastore'
    }));
    const firstNear = near.length ? Math.min(...near.map(ms)) : Infinity;
    if (!near.length || ms(first) < firstNear) hypotheses.push(hypo({
      kind: 'latent-defect', family: 'pre-existing-or-coincidental', service, seed: 'latent',
      title: `Pre-existing defect or coincidental alert noise for ${service}`,
      reason: near.length ? 'Errors begin before the nearest supplied change, so a latent problem is plausible.' : 'No change was supplied near the onset.',
      mustBeTrue: ['The same failure signature existed before the incident window'],
      supporting: ids(si, 5), contradicting: ids(near, 5), disconfirming: ['No prior occurrences of the signature (not run)'], gaps: ['History before the supplied window not supplied'], diagKey: 'latent'
    }));
    hypotheses.push(hypo({
      kind: 'alternative-explanation', family: 'other-or-unmodeled', service, seed: 'alt',
      title: `Independent service or dependency problem affecting ${service}`,
      reason: 'Observed errors may come from dependencies, traffic, capacity or prior latent defects rather than a release.',
      mustBeTrue: ['A cause independent of the supplied changes exists'],
      supporting: ids(si, 5), contradicting: ids(near, 5), disconfirming: ['Evidence tying the errors to a specific supplied change'], gaps: ['Traffic, capacity and external provider status not supplied'], diagKey: 'generic'
    }));
  }
  hypotheses.push(hypo({
    kind: 'insufficient-evidence', family: 'unknown', service: services.join(',') || 'unknown', seed: 'unknown',
    title: 'Root cause remains undetermined',
    reason: services.length ? 'The supplied data cannot rule out causes outside the modeled families.' : 'Insufficient incident-specific error signals to generate an evidence-backed explanation.',
    mustBeTrue: [], supporting: [], contradicting: [], disconfirming: [], gaps: ['See evidence gaps'], diagKey: 'unknown'
  }));

  const gaps = [];
  if (!metrics.length) gaps.push({kind: 'missing_metrics', status: 'unknown', message: 'No metrics were supplied; cannot quantify incident severity, error-rate shift, or SLO impact.'});
  if (!issues.length) gaps.push({kind: 'missing_incident_signals', status: 'unknown', message: 'No error/alert signals were supplied; impact and causality are unknown.'});
  if (!events.some(e => e.traceId)) gaps.push({kind: 'missing_traces', status: 'unknown', message: 'No trace identifiers were supplied; cross-service trace linkage was not checked.'});
  if (!deployments.length) gaps.push({kind: 'missing_changes', status: 'unknown', message: 'No deployment or change records were supplied; change correlation was not assessed.'});
  if (data.ingestionErrors?.length) gaps.push({kind: 'invalid_records', status: 'unknown', message: `${data.ingestionErrors.length} records were rejected; evidence may be incomplete.`});
  if (data.quality?.mixedOffsets) gaps.push({kind: 'mixed_time_offsets', status: 'unknown', message: 'Sources use different UTC offsets; all were converted to UTC, but clock skew between sources was not measured.'});
  if (data.skipped?.length) gaps.push({kind: 'skipped_inputs', status: 'unknown', message: `${data.skipped.length} input file(s) were skipped (symlinks or unsupported types).`});

  const contradictions = hypotheses.flatMap(h => h.contradictions.map(c => ({hypothesisId: h.id, ...c})));
  const summary = {count: events.length, services: uniq(events.map(e => e.service)).sort(), deployments: deployments.length, errorsAndAlerts: issues.length, metrics: metrics.length, start: events[0].timestamp, end: events.at(-1).timestamp};
  const guidance = ['Confirm scope/impact and incident commander contact', 'Check SLOs and metrics before inferring root cause', 'Review each hypothesis and seek disconfirming evidence', 'Approve any operational action through the normal incident-management process', 'Complete blameless postmortem after human review'];
  const evidence = Object.fromEntries(events.map(e => [e.id, {timestamp: e.timestamp, source: e.source, service: e.service, traceId: e.traceId, verification: 'observed'}]));
  const nextChecks = uniq(hypotheses.flatMap(h => h.diagnostics.map(d => d.description)));
  const core = {
    schema: REPORT_SCHEMA, product: TOOL.name, creator: TOOL.creator, tool: {name: TOOL.cli, version: TOOL.version, ruleVersion: TOOL.ruleVersion},
    mode: 'offline-read-only', synthetic: Boolean(opts.synthetic), summary,
    sources: (data.files ?? []).map(x => ({...x})), events, timeline, evidence,
    metricSeries: metricSeries(events), alertStorms: alertStorms(issues),
    hypotheses, contradictions, gaps,
    claims: {
      observed: events.map(e => ({eventId: e.id, statement: `${e.service} ${e.type}: ${e.message || e.type}`.slice(0, 200)})),
      inferred: hypotheses.filter(h => h.kind === 'temporal-correlation').map(h => ({hypothesisId: h.id, statement: h.title, basis: 'temporal proximity only', supportingEventIds: h.supportingEventIds})),
      unknown: gaps.map(g => ({kind: g.kind, statement: g.message})),
      notRun: ['production diagnostics', 'production mutations', 'trace joins', 'baseline comparison against historical windows', 'calibrated confidence scoring']
    },
    ingestionErrors: data.ingestionErrors ?? [], skippedInputs: data.skipped ?? [], duplicatesDropped: data.duplicates ?? [],
    quality: data.quality ?? {utcOffsets: {}, timePrecisions: {}, mixedOffsets: false, clockSkew: 'unassessed', note: 'No loader quality data.'},
    privacy: {redactions: data.redaction?.count ?? 0, byKind: data.redaction?.byKind ?? {}, policy: 'best-effort masking; not a DLP guarantee; sanitize exports upstream'},
    guidance,
    contract: {
      scope: {services: summary.services, window: {start: summary.start, end: summary.end}, correlationWindowMinutes: windowMinutes},
      observed: events.length, inferred: hypotheses.length, unknowns: gaps.map(g => g.kind), notRun: ['production diagnostics', 'production mutations'],
      evidenceIds: events.map(e => e.id), contradictions: contradictions.length, nextChecks,
      permissionsRequired: uniq(hypotheses.flatMap(h => h.diagnostics.map(d => d.permission))).sort(),
      privacyReview: 'pending_human_review', humanApproval: 'required'
    },
    decision: {status: 'HUMAN_REVIEW_REQUIRED', reason: 'Telemetry analysis is advisory. No mitigation, deployment rollback, production command, or cause confirmation was executed.'},
    checks: {timeline: 'verified_from_imported_records', rootCause: 'unconfirmed', productionDiagnostics: 'not_run', productionMutations: 'not_run', metrics: metrics.length ? 'available_as_events' : 'not_provided'},
    methodology: {correlationWindowMinutes: windowMinutes, causalInference: 'none', confidence: 'undetermined (no calibrated scoring)', timestampPolicy: 'explicit timezone required; normalized to UTC; sub-millisecond precision kept in timestampNs'}
  };
  return {...core, reportId: 'inc_' + sha256(JSON.stringify(core)).slice(0, 20)};
}

export function verifyReport(report) {
  const known = [REPORT_SCHEMA, ...LEGACY_REPORT_SCHEMAS];
  if (!known.includes(report?.schema) || !Array.isArray(report?.timeline) || !Array.isArray(report?.hypotheses)) return {ok: false, issues: ['Invalid report schema']};
  const issues = [], idSet = new Set((report.events ?? []).map(e => e.id));
  for (const e of report.timeline) if (!idSet.has(e.eventId)) issues.push(`Timeline references missing evidence: ${e.eventId}`);
  for (const h of report.hypotheses) {
    for (const id of [...(h.supportingEventIds ?? []), ...(h.contradictingEventIds ?? [])]) if (!idSet.has(id)) issues.push(`Hypothesis ${h.id} references missing evidence: ${id}`);
    if (h.status === 'confirmed') issues.push(`Hypothesis ${h.id} cannot be marked confirmed by static evaluator`);
  }
  if (report.decision?.status !== 'HUMAN_REVIEW_REQUIRED') issues.push('Decision status must remain HUMAN_REVIEW_REQUIRED');
  if (report.checks?.productionMutations !== 'not_run' || report.checks?.productionDiagnostics !== 'not_run') issues.push('Report claims production actions ran');
  const clone = {...report}; delete clone.reportId;
  if (report.reportId !== 'inc_' + sha256(JSON.stringify(clone)).slice(0, 20)) issues.push('Report integrity digest mismatch');
  return {ok: issues.length === 0, issues, note: 'The digest detects accidental change; anyone can recompute it, so it is not a signature or chain of custody.'};
}

export async function verifySources(report, input) {
  const data = await loadEvents(input);
  const now = new Map(data.files.map(f => [f.file, f.sha256]));
  const issues = [];
  for (const s of report.sources ?? []) {
    if (!now.has(s.file)) issues.push(`Source file missing: ${s.file}`);
    else if (now.get(s.file) !== s.sha256) issues.push(`Source hash changed: ${s.file}`);
  }
  return {ok: issues.length === 0, issues, checked: (report.sources ?? []).length};
}

const contentKey = e => [e.timestamp, e.service, e.type, e.message].join('|');
export function compareReports(base, candidate) {
  const a = new Set(base.events.map(e => e.id)), b = new Set(candidate.events.map(e => e.id));
  const ak = new Set(base.events.map(contentKey)), bk = new Set(candidate.events.map(contentKey));
  const kinds = r => uniq(r.hypotheses.map(h => h.kind)).sort();
  const gk = r => uniq(r.gaps.map(g => g.kind)).sort();
  return {
    schema: 'incidentsutra.comparison.v1', baseline: base.reportId, candidate: candidate.reportId,
    added: [...b].filter(x => !a.has(x)), removed: [...a].filter(x => !b.has(x)),
    sameContentDifferentSource: [...bk].filter(x => ak.has(x)).length,
    deltaEvents: candidate.summary.count - base.summary.count,
    hypothesisKinds: {baseline: kinds(base), candidate: kinds(candidate)}, gaps: {baseline: gk(base), candidate: gk(candidate)},
    notes: ['Comparisons reflect imported records, not confirmed production recovery.']
  };
}
