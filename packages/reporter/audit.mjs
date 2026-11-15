import {escapeHtml as h, mdCell, page} from './theme.mjs';

const label = s => ({pass: 'PASS', fail: 'FAIL', skipped: 'SKIPPED', warn: 'WARN'}[s] ?? s);

export function auditToMarkdown(a) {
  const L = [
    '# IncidentSutra AI — Automated Audit Report', '',
    `**Verdict:** ${a.verdict} · **Tool:** ${a.tool.name} ${a.tool.version} (rules ${a.tool.ruleVersion}) · **Node:** ${a.environment.node} on ${a.environment.platform}/${a.environment.arch}  `,
    `**Nature:** ${a.nature}`, '',
    `| Checks | Pass | Fail | Skipped | Warn |`, `|---|---|---|---|---|`, `| ${a.counts.total} | ${a.counts.pass} | ${a.counts.fail} | ${a.counts.skipped} | ${a.counts.warn} |`, '',
    '## Results', '', '| ID | Area | Check | Result | Observed |', '|---|---|---|---|---|',
    ...a.checks.map(c => `| ${c.id} | ${c.area} | ${mdCell(c.title)} | **${label(c.status)}** | ${mdCell(c.detail).slice(0, 220)} |`), '',
    '## Known redaction gaps (not covered)', '', ...a.knownRedactionGaps.map(x => `- ${x}`), '',
    '## Limitations of this audit', '', ...a.limitations.map(x => `- ${x}`), '',
    'Regenerate: `npx incidentsutra audit --out audit` (writes `audit-report.json`, `.md`, `.html`).', ''
  ];
  return L.join('\n');
}

export function auditToHTML(a) {
  const rows = a.checks.map(c => `<tr><td>${h(c.id)}</td><td>${h(c.area)}</td><td>${h(c.title)}</td><td><span class="chip ${c.status === 'pass' ? 'pass' : c.status === 'fail' ? 'fail' : 'warn'}">${label(c.status)}</span></td><td>${h(c.detail)}${c.evidence.length ? `<br><span class="mut">${h(c.evidence.join(' · '))}</span>` : ''}</td></tr>`).join('');
  const body = `<header class="hero"><h1>IncidentSutra AI — Automated Audit</h1><p>Every check runs real code against this repository and records what it observed.</p><div class="badges"><span class="badge">verdict: ${h(a.verdict)}</span><span class="badge">${h(a.tool.name)} ${h(a.tool.version)}</span><span class="badge">Node ${h(a.environment.node)}</span><span class="badge">${h(a.environment.platform)}/${h(a.environment.arch)}</span></div></header>
<div class="banner" role="note">${h(a.nature)}. A passing audit is not a certification of security, privacy compliance or production readiness.</div>
<section><h2>Summary</h2><div class="kpis"><div class="kpi"><b>${a.counts.total}</b><span>checks</span></div><div class="kpi"><b>${a.counts.pass}</b><span>pass</span></div><div class="kpi"><b>${a.counts.fail}</b><span>fail</span></div><div class="kpi"><b>${a.counts.skipped}</b><span>skipped</span></div></div></section>
<section><h2>Results</h2><div class="tw"><table><thead><tr><th>ID</th><th>Area</th><th>Check</th><th>Result</th><th>Observed</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section><h2>Known redaction gaps</h2><ul>${a.knownRedactionGaps.map(x => `<li>${h(x)}</li>`).join('')}</ul></section>
<section><h2>Limitations of this audit</h2><ul>${a.limitations.map(x => `<li>${h(x)}</li>`).join('')}</ul></section>
<footer>IncidentSutra AI · Apache-2.0 · Created by Vatsal Shah · schema ${h(a.schema)}</footer>`;
  return page({title: `IncidentSutra Audit ${a.verdict}`, description: 'Automated self-audit results for IncidentSutra AI.', body});
}
