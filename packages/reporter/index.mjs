import {escapeHtml as h, mdCell, page} from './theme.mjs';

const list = a => (a && a.length ? a.join(', ') : 'none');

export function svgTimeline(report) {
  const ev = report.timeline;
  if (ev.length < 2) return '';
  const t0 = Date.parse(ev[0].timestamp), t1 = Date.parse(ev.at(-1).timestamp), span = Math.max(1, t1 - t0);
  const services = [...new Set(ev.map(e => e.service))].sort().slice(0, 10);
  const W = 920, left = 130, laneH = 34, H = 40 + services.length * laneH;
  const dep = new Set(report.events.filter(e => /deploy|release|rollout|rollback|flag|config-change/.test(e.type)).map(e => e.id));
  const iss = new Set(report.events.filter(e => /error|alert|incident|critical|failure|outage|fatal/.test(e.type + ' ' + e.severity)).map(e => e.id));
  let s = `<svg role="img" aria-labelledby="tl-t tl-d" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><title id="tl-t">Event timeline by service</title><desc id="tl-d">${ev.length} observed events between ${h(ev[0].timestamp)} and ${h(ev.at(-1).timestamp)}. Diamonds are changes, filled circles are error or alert signals, squares are other observations. A table with the same data follows.</desc>`;
  services.forEach((sv, i) => {
    const y = 28 + i * laneH;
    s += `<line x1="${left}" y1="${y}" x2="${W - 12}" y2="${y}" stroke="currentColor" opacity=".18"/><text x="4" y="${y + 4}" font-size="12" fill="currentColor">${h(sv.slice(0, 18))}</text>`;
  });
  for (const e of ev) {
    const i = services.indexOf(e.service); if (i < 0) continue;
    const x = left + ((Date.parse(e.timestamp) - t0) / span) * (W - left - 24), y = 28 + i * laneH;
    const tip = `<title>${h(e.timestamp)} ${h(e.type)}: ${h(String(e.description).slice(0, 80))}</title>`;
    if (dep.has(e.eventId)) s += `<path d="M${x} ${y - 8}l8 8l-8 8l-8 -8z" fill="#2b4fa3">${tip}</path>`;
    else if (iss.has(e.eventId)) s += `<circle cx="${x}" cy="${y}" r="6" fill="#b3261e">${tip}</circle>`;
    else s += `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#6b7d8f">${tip}</rect>`;
  }
  s += `<text x="${left}" y="${H - 6}" font-size="11" fill="currentColor">${h(ev[0].timestamp)}</text><text x="${W - 12}" y="${H - 6}" font-size="11" text-anchor="end" fill="currentColor">${h(ev.at(-1).timestamp)}</text></svg>`;
  return s;
}

export function toMarkdown(report) {
  const s = report.summary;
  const L = [
    '# IncidentSutra AI — Incident Evidence Report', '',
    `**Report:** \`${report.reportId}\`  `, `**Schema:** ${report.schema} · **Tool:** ${report.tool?.cli} ${report.tool?.version} · **Rules:** ${report.tool?.ruleVersion}  `,
    '**Mode:** offline / read-only  ', '**Review:** HUMAN_REVIEW_REQUIRED  ',
    ...(report.synthetic ? ['**Data:** SYNTHETIC demonstration data  '] : []),
    '', '> Advisory only. Timing is not causation. Nothing was executed against any system.', '',
    '## Summary', '',
    `- Events: ${s.count}; services: ${s.services.join(', ')}`,
    `- Errors/alerts: ${s.errorsAndAlerts}; deployments/changes: ${s.deployments}; metrics: ${s.metrics}`,
    `- Window: ${s.start} to ${s.end}`,
    `- Root cause: **unconfirmed** (confidence: undetermined)`, '',
    '## How to read this report', '',
    '- **observed**: present in an imported record (has an evidence ID).',
    '- **inferred**: a hypothesis built from observed records; never confirmed here.',
    '- **unknown**: data that was not supplied; absence is not evidence of health.',
    '- **not run**: checks this tool deliberately did not execute.', '',
    '## Auditable timeline', '', '| Time (UTC) | Observation | Service | Type | Evidence |', '|---|---|---|---|---|'
  ];
  for (const t of report.timeline) L.push(`| ${t.timestamp} | ${mdCell(t.description).slice(0, 130)} | ${mdCell(t.service)} | ${mdCell(t.type)} | ${t.eventId} (${mdCell(t.source.file)}:${t.source.record}) |`);
  L.push('', '## Competing hypotheses', '');
  for (const x of report.hypotheses) {
    L.push(`### ${x.title}`, `Family: ${x.family} · Status: **${x.status}** · Confidence: **${x.confidence}** · Review: ${x.reviewStatus}`, '', x.reason, '');
    if (x.mustBeTrue?.length) L.push('Would need to be true:', ...x.mustBeTrue.map(m => `- ${m}`), '');
    L.push(`Supporting evidence: ${list(x.supportingEventIds)}  `, `Contradicting evidence: ${list(x.contradictingEventIds)}`, '');
    if (x.contradictions?.length) L.push('Contradictions:', ...x.contradictions.map(c => `- ${c.note} (${list(c.eventIds)})`), '');
    if (x.disconfirmingObservations?.length) L.push('Would disconfirm:', ...x.disconfirmingObservations.map(m => `- ${m}`), '');
    L.push('Read-only checks proposed (**not executed**):', ...x.diagnostics.map(d => `- ${d.description} — permission \`${d.permission}\`, cost ${d.cost}`), '');
  }
  if (report.alertStorms?.length) L.push('## Alert storms', '', ...report.alertStorms.map(a => `- ${a.count} signals between ${a.start} and ${a.end} (${a.services.join(', ')})`), '');
  if (report.metricSeries?.length) L.push('## Observed metric series', '', '| Series | Points | First | Last | Min | Max |', '|---|---|---|---|---|---|', ...report.metricSeries.map(m => `| ${mdCell(m.name)} | ${m.points} | ${m.first.value} | ${m.last.value} | ${m.min} | ${m.max} |`), '');
  L.push('## Evidence gaps (unknown)', '', ...(report.gaps.length ? report.gaps.map(g => `- **${g.kind}**: ${g.message}`) : ['- none detected by the built-in checks']), '');
  L.push('## Ingestion quality and privacy', '',
    `- Files: ${report.sources.length}; rejected records: ${report.ingestionErrors.length}; skipped inputs: ${report.skippedInputs.length}; cross-file duplicates dropped: ${report.duplicatesDropped.length}`,
    `- UTC offsets seen: ${Object.entries(report.quality.utcOffsets).map(([k, v]) => `${k}×${v}`).join(', ') || 'n/a'}; precisions: ${Object.entries(report.quality.timePrecisions).map(([k, v]) => `${k}×${v}`).join(', ') || 'n/a'}`,
    `- Clock skew between sources: ${report.quality.clockSkew}. ${report.quality.note}`,
    `- Redactions applied: ${report.privacy.redactions}. ${report.privacy.policy}.`, '');
  L.push('## Sources', '', '| File | SHA-256 | Records |', '|---|---|---|', ...report.sources.map(f => `| ${mdCell(f.file)} | \`${f.sha256}\` | ${f.records} |`), '');
  L.push('## Not run', '', ...report.claims.notRun.map(x => `- ${x}`), '');
  L.push('## Recommended human-led next steps', '', ...report.guidance.map(x => '- ' + x), '');
  L.push('## Limitations', '', 'No production diagnostics or remediations were executed. Temporal correlation is not causation. Missing data does not imply a clean environment. Redaction is best-effort. The report digest detects accidental change only; it is not a signature or chain of custody.', '');
  return L.join('\n');
}

export function toHypothesisRegister(report) {
  const L = ['# Hypothesis register', '', `Report \`${report.reportId}\` · all hypotheses **unconfirmed**; confidence **undetermined**; human review pending.`, ''];
  for (const x of report.hypotheses) {
    L.push(`## ${x.title}`, `- ID: \`${x.id}\` · family: ${x.family}`, `- Why: ${x.reason}`, `- Supporting: ${list(x.supportingEventIds)}`, `- Contradicting: ${list(x.contradictingEventIds)}`,
      `- Known gaps: ${list(x.knownGaps)}`, `- Next read-only checks: ${list(x.proposedChecks)}`, `- Reviewer decision: _pending_`, '');
  }
  return L.join('\n');
}

export function toPostmortem(report) {
  const s = report.summary, first = report.timeline.find(t => /error|alert|critical|incident|failure|outage/.test(`${t.type} ${t.severity}`));
  return [
    '# Blameless postmortem — DRAFT for human review', '',
    `> Generated from report \`${report.reportId}\`. Sections marked **TODO (human)** need the incident team. No individual blame; focus on systems and conditions.`, '',
    '## Summary', '', `TODO (human): one-paragraph summary. Imported data covers ${s.start} to ${s.end} across ${s.services.join(', ')}.`, '',
    '## Impact', '', 'TODO (human): customer impact, duration, SLO/error-budget effect. Metrics supplied: ' + s.metrics + '. ' + (s.metrics ? '' : 'None — impact is unknown.'), '',
    '## Detection', '', first ? `First error/alert signal in the data: ${first.timestamp} (${first.service}, \`${first.eventId}\`).` : 'No error or alert signal was supplied.', '',
    '## Timeline (observed)', '', ...report.timeline.map(t => `- ${t.timestamp} — ${mdCell(t.service)}: ${mdCell(t.description).slice(0, 120)} (\`${t.eventId}\`)`), '',
    '## Contributing factors (candidates, unconfirmed)', '', ...report.hypotheses.filter(x => x.kind !== 'insufficient-evidence').map(x => `- ${x.title} — supporting ${list(x.supportingEventIds)}; contradicting ${list(x.contradictingEventIds)}`), '',
    '## Mitigations performed by humans', '', 'TODO (human): record what responders actually did and when. This tool executed nothing.', '',
    '## What went well / what went poorly / where we got lucky', '', 'TODO (human)', '',
    '## Action items', '', '| Action | Owner | Due | Evidence |', '|---|---|---|---|', '| TODO (human) | | | |', '',
    '## Evidence gaps', '', ...report.gaps.map(g => `- ${g.message}`), '',
    '## Review', '', 'Status: **DRAFT — not reviewed**. Reviewer: _____ Date: _____', ''
  ].join('\n');
}

export function toHTML(report) {
  const s = report.summary;
  const dep = new Set(report.events.filter(e => /deploy|release|rollout|rollback|flag|config-change/.test(e.type)).map(e => e.id));
  const rows = report.timeline.map(t => `<tr id="${h(t.eventId)}"><td><code>${h(t.timestamp)}</code></td><td>${h(t.service)}</td><td><span class="chip observed">${h(t.type)}</span></td><td class="sev-${h(t.severity)}">${h(t.severity)}</td><td>${h(String(t.description).slice(0, 220))}</td><td><code>${h(t.eventId)}</code><br><span class="mut">${h(t.source.file)}:${t.source.record}</span></td></tr>`).join('');
  const link = id => `<a href="#${h(id)}"><code>${h(id)}</code></a>`;
  const hyps = report.hypotheses.map(x => `<article class="hyp"><h3>${h(x.title)}</h3><p><span class="chip inferred">inferred</span> <span class="chip">${h(x.family)}</span> <span class="chip">${h(x.status)}</span> <span class="chip">confidence: ${h(x.confidence)}</span> <span class="chip notrun">review: ${h(x.reviewStatus)}</span></p><p>${h(x.reason)}</p>${x.mustBeTrue.length ? `<h4>Would need to be true</h4><ul>${x.mustBeTrue.map(m => `<li>${h(m)}</li>`).join('')}</ul>` : ''}<div class="cols"><div class="pro"><b>Supporting</b><br>${x.supportingEventIds.map(link).join(' ') || '<span class="mut">none</span>'}</div><div class="con"><b>Contradicting</b><br>${x.contradictingEventIds.map(link).join(' ') || '<span class="mut">none</span>'}${x.contradictions.length ? `<ul>${x.contradictions.map(c => `<li>${h(c.note)}</li>`).join('')}</ul>` : ''}</div></div>${x.disconfirmingObservations.length ? `<h4>Would disconfirm</h4><ul>${x.disconfirmingObservations.map(m => `<li>${h(m)}</li>`).join('')}</ul>` : ''}<h4>Read-only checks <span class="chip notrun">not run</span></h4><ul>${x.diagnostics.map(d => `<li>${h(d.description)} <span class="mut">(${h(d.permission)}, cost ${h(d.cost)})</span></li>`).join('')}</ul></article>`).join('');
  const gaps = report.gaps.length ? report.gaps.map(g => `<li><span class="chip unknown">unknown</span> ${h(g.message)}</li>`).join('') : '<li>No gaps detected by the built-in checks.</li>';
  const metrics = report.metricSeries.length ? `<div class="tw"><table><thead><tr><th>Series</th><th>Points</th><th>First</th><th>Last</th><th>Min</th><th>Max</th></tr></thead><tbody>${report.metricSeries.map(m => `<tr><td>${h(m.name)}</td><td>${m.points}</td><td>${m.first.value}</td><td>${m.last.value}</td><td>${m.min}</td><td>${m.max}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">No numeric metrics supplied — impact is unknown.</p>';
  const body = `<header class="hero"><h1>IncidentSutra AI</h1><p>Incident evidence report · created by Vatsal Shah · <em>Observe precisely. Reason cautiously. Recover responsibly.</em></p><div class="badges"><span class="badge">${h(report.reportId)}</span><span class="badge">HUMAN REVIEW REQUIRED</span><span class="badge">offline · read-only</span><span class="badge">root cause: unconfirmed</span><span class="badge">${h(report.tool?.cli)} ${h(report.tool?.version)}</span></div></header>
${report.synthetic ? '<div class="banner" role="note">SYNTHETIC DATA — this report was generated from fictional demonstration records, not a real incident.</div>' : ''}
<nav class="toc" aria-label="Sections"><a href="#summary">Summary</a><a href="#timeline">Timeline</a><a href="#hypotheses">Hypotheses</a><a href="#gaps">Gaps</a><a href="#quality">Quality &amp; privacy</a><a href="#sources">Sources</a><a href="#limits">Limits</a></nav>
<section id="summary"><h2>Summary</h2><div class="kpis"><div class="kpi"><b>${s.count}</b><span>observed events</span></div><div class="kpi"><b>${s.errorsAndAlerts}</b><span>error/alert signals</span></div><div class="kpi"><b>${s.deployments}</b><span>changes</span></div><div class="kpi"><b>${s.metrics}</b><span>metric events</span></div><div class="kpi"><b>${report.hypotheses.length}</b><span>competing hypotheses</span></div><div class="kpi"><b>${report.gaps.length}</b><span>evidence gaps</span></div></div><p class="mut">Window ${h(s.start)} → ${h(s.end)} · services: ${h(s.services.join(', '))}</p>
<div class="legend"><span><span class="chip observed">observed</span> in an imported record</span><span><span class="chip inferred">inferred</span> hypothesis, never confirmed</span><span><span class="chip unknown">unknown</span> data not supplied</span><span><span class="chip notrun">not run</span> deliberately not executed</span></div></section>
<section id="timeline"><h2>Auditable timeline (UTC)</h2>${svgTimeline(report)}<p class="mut">Diamonds: changes (${dep.size}). Circles: error/alert signals. Squares: other observations.</p><div class="tw"><table><thead><tr><th>Time</th><th>Service</th><th>Type</th><th>Severity</th><th>Observation</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section id="hypotheses"><h2>Competing hypotheses</h2><p>None is confirmed. Each lists what would have to be true, what contradicts it, and read-only checks that would discriminate between them.</p>${hyps}</section>
${report.alertStorms.length ? `<section><h2>Alert storms</h2><ul>${report.alertStorms.map(a => `<li>${a.count} signals from ${h(a.start)} to ${h(a.end)} (${h(a.services.join(', '))})</li>`).join('')}</ul></section>` : ''}
<section><h2>Observed metric series</h2>${metrics}</section>
<section id="gaps"><h2>Evidence gaps</h2><ul>${gaps}</ul></section>
<section id="quality"><h2>Ingestion quality &amp; privacy</h2><ul><li>Files ${report.sources.length}; rejected records ${report.ingestionErrors.length}; skipped inputs ${report.skippedInputs.length}; cross-file duplicates dropped ${report.duplicatesDropped.length}</li><li>UTC offsets: ${h(Object.entries(report.quality.utcOffsets).map(([k, v]) => `${k}×${v}`).join(', ') || 'n/a')} · precisions: ${h(Object.entries(report.quality.timePrecisions).map(([k, v]) => `${k}×${v}`).join(', ') || 'n/a')}</li><li>Clock skew: ${h(report.quality.clockSkew)}. ${h(report.quality.note)}</li><li>Redactions applied: ${report.privacy.redactions}. ${h(report.privacy.policy)}.</li></ul>${report.ingestionErrors.length ? `<h3>Rejected records</h3><ul>${report.ingestionErrors.slice(0, 20).map(e => `<li>${h(e.file)}#${e.record}: ${h(e.error)}</li>`).join('')}</ul>` : ''}</section>
<section id="sources"><h2>Sources</h2><div class="tw"><table><thead><tr><th>File</th><th>SHA-256</th><th>Records</th></tr></thead><tbody>${report.sources.map(f => `<tr><td>${h(f.file)}</td><td><code>${h(f.sha256)}</code></td><td>${f.records}</td></tr>`).join('')}</tbody></table></div></section>
<section id="limits"><h2>Approval status and limitations</h2><p><span class="chip notrun">not run</span> ${h(report.claims.notRun.join(' · '))}</p><p>No mitigation, rollback, diagnostic query or production mutation was executed. Temporal correlation does not establish causality. Redaction is best-effort, not DLP. The report digest detects accidental change only; it is not a signature or chain of custody.</p></section>
<footer>IncidentSutra AI · Apache-2.0 · Created by Vatsal Shah · schema ${h(report.schema)}</footer>`;
  return page({title: `IncidentSutra Evidence Report ${report.reportId}`, description: 'Offline, read-only incident evidence report with auditable timeline and competing hypotheses.', body});
}
