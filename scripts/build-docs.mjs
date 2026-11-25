#!/usr/bin/env node
// Builds the documentation website into documents/IncidentSutra-AI from its Markdown. Dependency-free.
// Light theme by default; dark by toggle. Numbers come from evidence/, scenario results from real analysis runs.
// Directives (HTML comments, invisible on GitHub): <!-- svg:name --> <!-- flow:name --> <!-- chart:name --> <!-- scenario:folder -->
// `--check` fails when committed output differs from what the sources would produce.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DIAGRAMS, FLOWS, NARROW} from '../site/diagrams.mjs';
import {loadEvents} from '../packages/core/ingest.mjs';
import {analyzeIncident, toHTML} from '../packages/core/analyze.mjs';
import {SECRET_CORPUS, KNOWN_REDACTION_GAPS} from '../packages/core/audit.mjs';
import {svgTimeline} from '../packages/reporter/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(root, 'documents/IncidentSutra-AI');
const check = process.argv.includes('--check');
const GH = 'https://github.com/shahvatsalofficial/IncidentSutra-AI';
const SITE = 'https://shahvatsalofficial.github.io/IncidentSutra-AI';
const NPM = 'https://www.npmjs.com/package/incidentsutra';
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));
const V = json('package.json').version;
const tests = json('documents/IncidentSutra-AI/evidence/test-results.json');
const audit = json('documents/IncidentSutra-AI/evidence/audit/audit-report.json');
const bench = json('documents/IncidentSutra-AI/evidence/benchmark.json');
const skills = json('agents/manifest.json').agents.length;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const headingId = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const GROUPS = [
  ['Start here', ['01-executive-summary', '11-visual-guide', '05-user-guide', '10-real-world-scenarios']],
  ['Reference', ['02-functional-spec', '03-technical-spec', '08-agent-catalog', '12-glossary']],
  ['Design and trust', ['04-architecture', '06-security-privacy-legal', '07-independent-audit', 'test-results']],
  ['Help', ['09-faq', 'README']]
];
const ORDER = GROUPS.flatMap(g => g[1]);
const SCENARIOS = [
  ['deploy-blamed', '"It was the deploy!"', 'The errors started before the release did.', 'k-bad'],
  ['timezone-mixup', 'The time zone trap', 'Two clocks make a cause look like an effect.', 'k-warn'],
  ['payment-provider', 'Provider slow, search shipped', 'The innocent release is about to be rolled back.', 'k-info'],
  ['database-pool', 'The connection pool', 'A metric moves from 40 to 200 connections.', 'k-info'],
  ['night-alert-storm', '3 a.m. alert storm', 'One storm, one first signal, secrets masked.', 'k-bad'],
  ['thin-evidence', 'Almost no evidence', 'The tool refuses to guess and says what is missing.', 'k-warn']
];

const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>'
};
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('')}</defs></svg>`;
const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// ---------- Markdown ----------
const href = u => {
  if (/^(https?:|mailto:|#)/i.test(u)) return u;
  if (!/^[\w./-]+(#[\w-]*)?$/.test(u) || u.startsWith('/')) return '#';
  if (u.startsWith('../')) return `${GH}/blob/main/${u.replace(/^(\.\.\/)+/, '')}`;
  return u.replace(/^([\w-]+)\.md(#|$)/, '$1.html$2');
};
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => { const h = href(u.replace(/&amp;/g, '&')); return `<a href="${esc(h)}"${/^https?:/.test(h) ? ' rel="noopener"' : ''}>${t}</a>`; })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}
function mdToHtml(md, directive) {
  const lines = md.split('\n'), out = [], toc = [], para = [];
  let i = 0, firstQuote = true;
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { flush(); i++; continue; }
    const fence = l.match(/^```(\w*)/);
    if (fence) { flush(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre class="code" data-lang="${esc(fence[1])}"><code>${esc(buf.join('\n'))}</code><button class="copy" type="button">Copy</button></pre>`); continue; }
    const dir = l.match(/^<!--\s*(svg|flow|chart|scenario):([\w-]+)\s*-->$/);
    if (dir) { flush(); out.push(directive(dir[1], dir[2])); i++; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush(); const id = headingId(h[2]), n = h[1].length;
      if (n === 2 || n === 3) toc.push({level: n, text: h[2].replace(/`/g, ''), id});
      out.push(n === 1 ? `<h1>${inline(h[2])}</h1>` : `<h${n} id="${id}">${inline(h[2])}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${n}>`); i++; continue;
    }
    if (/^---+\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(l)) {
      flush(); const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote class="${firstQuote ? 'lead-q' : 'callout-note'}">${inline(buf.join(' '))}</blockquote>`); firstQuote = false; continue;
    }
    if (/^\|.*\|\s*$/.test(l) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flush(); const cells = r => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const li = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flush(); const tag = /\d/.test(li[2]) ? 'ol' : 'ul', items = [];
      while (i < lines.length) { const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/); if (m) { items.push(m[3]); i++; } else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; } else break; }
      out.push(`<${tag}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${tag}>`); continue;
    }
    para.push(l.trim()); i++;
  }
  flush();
  return {html: out.join('\n'), toc};
}

// ---------- charts and scenarios ----------
const bars = rows => { const max = Math.max(1, ...rows.map(r => r[1])); return `<div class="bars">${rows.map(([l, v, c = '', label]) => `<div class="bar"><span class="lab">${esc(l)}</span><div class="trk"><div class="fill ${c}" style="width:${v ? Math.max(3, Math.round(100 * v / max)) : 0}%"></div></div><span class="val">${esc(label ?? v)}</span></div>`).join('')}</div>`; };
const chart = (title, body, note = '') => `<figure class="chart"><h4>${esc(title)}</h4>${body}${note ? `<p class="note">${esc(note)}</p>` : ''}</figure>`;
const stack = (parts, label) => `<div class="stack" role="img" aria-label="${esc(label)}">${parts.map(([v, c]) => `<i style="width:${v}%;background:var(${c})"></i>`).join('')}</div>`;
const legend = items => `<p class="legend">${items.map(([c, t]) => `<span><b style="background:var(${c})"></b>${esc(t)}</span>`).join('')}</p>`;
const CHARTS = {
  tests: () => chart(`Automated tests: ${tests.pass} of ${tests.total} pass`, stack([[100 * tests.pass / tests.total, '--ok'], [100 * tests.skipped / tests.total, '--warn'], [100 * tests.fail / tests.total, '--bad']], `${tests.pass} passed, ${tests.skipped} skipped, ${tests.fail} failed`) + legend([['--ok', `${tests.pass} passed`], ['--warn', `${tests.skipped} skipped`], ['--bad', `${tests.fail} failed`]]), `Recorded with Node ${tests.environment.node} on ${tests.environment.platform}. ${tests.skippedReason}`),
  audit: () => { const areas = {}; for (const c of audit.checks) { areas[c.area] ??= [0, 0]; areas[c.area][1]++; if (c.status === 'pass') areas[c.area][0]++; } return chart(`Self-audit: ${audit.counts.pass} of ${audit.counts.total} checks pass, ${audit.counts.skipped} skipped, ${audit.counts.fail} failed`, bars(Object.entries(areas).map(([a, [p, t]]) => [a, t, p === t ? 'ok' : 'warn', `${p}/${t}`])), `${audit.nature}. Verdict ${audit.verdict}. Bar length is the number of checks in the area.`); },
  redaction: () => chart(`Masking corpus: ${SECRET_CORPUS.length} synthetic secret classes`, `<div class="chips">${SECRET_CORPUS.map(([n]) => `<span>${esc(n)}</span>`).join('')}</div><h4 style="margin-top:1rem">Not covered</h4><div class="chips">${KNOWN_REDACTION_GAPS.map(n => `<span>${esc(n)}</span>`).join('')}</div>`, 'Best effort only. This is not data-loss prevention. Sanitize exports before analysis.'),
  benchmark: () => chart(`Synthetic benchmark: ${bench.casesPassed} of ${bench.cases} cases, ${bench.expectationsPassed} of ${bench.expectations} expectations`, `<div class="chips">${bench.results.map(r => `<span title="${esc(r.title)}">${r.pass ? '✓' : '✗'} ${esc(r.family)}</span>`).join('')}</div>`, bench.labelProvenance)
};

const outputs = new Map();
const scn = {};
for (const [name] of SCENARIOS) {
  const data = await loadEvents(path.join(root, 'fixtures/scenarios', name));
  scn[name] = analyzeIncident(data, {synthetic: true});
  outputs.set(`evidence/scenarios/${name}.html`, toHTML(scn[name]));
}
function scenario(name) {
  const r = scn[name]; if (!r) throw new Error('Unknown scenario ' + name);
  const hyps = r.hypotheses.map(x => `<div class="hcard"><b>${esc(x.title)}</b><p class="chips"><span>${esc(x.family)}</span><span>supports ${x.supportingEventIds.length}</span><span class="${x.contradictingEventIds.length ? 'against' : ''}">against ${x.contradictingEventIds.length}</span><span>unconfirmed</span></p>${x.contradictions.map(c => `<p class="why">${esc(c.note)}</p>`).join('')}</div>`).join('');
  const extra = [r.alertStorms.map(a => `Alert storm: ${a.count} signals`).join(', '), r.privacy.redactions ? `${r.privacy.redactions} values masked` : '', r.ingestionErrors.length ? `${r.ingestionErrors.length} record rejected: ${r.ingestionErrors[0].error}` : '', ...r.metricSeries.map(m => `${m.name}: ${m.first.value} to ${m.last.value}`)].filter(Boolean);
  return `<div class="scnbox"><div class="mock-cards four"><div><b>${r.summary.count}</b><span>events</span></div><div><b>${r.hypotheses.length}</b><span>hypotheses</span></div><div><b>${r.contradictions.length}</b><span>contradictions</span></div><div><b>${r.gaps.length}</b><span>gaps</span></div></div><ol class="vtl">${r.timeline.map(t => `<li class="${/deploy|release|rollout|rollback/.test(t.type) ? 'change' : /error|alert|critical|incident/.test(t.type + ' ' + t.severity) ? 'issue' : ''}"><time datetime="${t.timestamp}">${t.timestamp.slice(11, 19)} UTC</time><em>${esc(t.service)} ${esc(t.type)}</em>${esc(t.description)}</li>`).join('')}</ol><div class="dia-scroll tl">${svgTimeline(r)}</div><p class="legend"><span>◆ change</span><span>● error or alert</span><span>■ other</span></p>${extra.length ? `<div class="chips">${extra.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}<h4>What the report offers</h4><div class="hgrid">${hyps}</div>${r.gaps.length ? `<h4>Still unknown</h4><ul>${r.gaps.map(g => `<li>${esc(g.message)}</li>`).join('')}</ul>` : ''}<p><a class="btn" href="evidence/scenarios/${name}.html">Open the full report ${ic('arrow', 18)}</a></p></div>`;
}
const steps = (list, cls) => `<ol class="flow ${cls}">${list.map(([t, d, c]) => `<li class="${c || ''}"><b>${inline(t)}</b><span>${inline(d)}</span></li>`).join('')}</ol>`;
const diagram = name => `<figure class="dia"><div class="dia-wide">${DIAGRAMS[name]()}</div>${steps(NARROW[name], 'dia-narrow')}</figure>`;
const directive = (kind, name) => {
  if (kind === 'scenario') return scenario(name);
  if (kind === 'svg') { if (!DIAGRAMS[name]) throw new Error('Unknown diagram ' + name); return diagram(name); }
  if (kind === 'chart') { if (!CHARTS[name]) throw new Error('Unknown chart ' + name); return CHARTS[name](); }
  const f = FLOWS[name]; if (!f) throw new Error('Unknown flow ' + name);
  return `<ol class="flow${f.row ? ' row' : ''}" style="--n:${f.steps.length > 5 ? 3 : f.steps.length}">${f.steps.map(([t, d, c]) => `<li class="${c || ''}"><b>${inline(t)}</b><span>${inline(d)}</span></li>`).join('')}</ol>`;
};

// ---------- shell ----------
const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234338ca'/%3E%3Cpath d='M5 17h5l3-8 5 15 3-7h6' fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const logo = '<span class="logo" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 32 32"><path d="M4 17h6l3-9 6 16 3-7h6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="brand-name">Incident<b>Sutra</b> AI</span>';
const themeInit = "try{var t=localStorage.getItem('incidentsutra-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}";
const head = ({title, desc, canon, extra = ''}) => `<!DOCTYPE html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="keywords" content="incident response, SRE, on-call, postmortem, root cause analysis, incident timeline, OpenTelemetry, agent skills, Claude Code, Cursor, Codex, Gemini CLI, Copilot"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#4338ca"><meta name="author" content="Vatsal Shah"><link rel="canonical" href="${canon}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:site_name" content="IncidentSutra AI"><meta property="og:url" content="${canon}"><meta name="twitter:card" content="summary"><link rel="icon" href="${favicon}"><script>${themeInit}</script><link rel="stylesheet" href="assets/site.css">${extra}</head>`;
const NAV = [['05-user-guide', 'Guide'], ['10-real-world-scenarios', 'Scenarios'], ['11-visual-guide', 'Visuals'], ['04-architecture', 'Architecture'], ['07-independent-audit', 'Proof']];
const topbar = (home, cur) => `<header class="topbar"><div class="topbar-in"><button class="icon-btn menu-btn" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="sidebar">${ic('menu')}</button><a class="brand" href="${home ? '#top' : 'index.html'}">${logo}<span class="ver">v${V}</span></a><nav class="topnav" aria-label="Primary">${NAV.map(([s, t]) => `<a href="${s}.html"${cur === s ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav><div class="search" role="search">${ic('search', 18)}<label class="sr" for="q">Search the documentation</label><input id="q" type="search" placeholder="Search docs" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="results"><kbd aria-hidden="true">/</kbd><ul id="results" role="listbox" hidden></ul></div><a class="icon-btn gh" href="${GH}" rel="noopener" aria-label="IncidentSutra AI on GitHub">${ic('code')}</a><button class="icon-btn theme-btn" type="button" aria-pressed="false" aria-label="Switch to dark theme"><svg class="ic i-sun" width="20" height="20" aria-hidden="true"><use href="#i-sun"/></svg><svg class="ic i-moon" width="20" height="20" aria-hidden="true"><use href="#i-moon"/></svg></button></div></header>`;
const col = (title, links) => `<div><p class="foot-title">${title}</p><ul>${links.map(([u, t]) => `<li><a href="${u}"${/^http/.test(u) ? ' rel="noopener"' : ''}>${t}</a></li>`).join('')}</ul></div>`;
const footer = () => `<footer class="site-foot"><div class="foot-in"><div class="foot-brand"><a class="brand" href="index.html">${logo}</a><p>Observe precisely. Reason cautiously. Recover responsibly.</p><p class="fine">Created by Vatsal Shah. Apache-2.0.</p></div>${col('Start', [['01-executive-summary.html', 'Overview'], ['05-user-guide.html', 'User guide'], ['10-real-world-scenarios.html', 'Scenarios']])}${col('Reference', [['02-functional-spec.html', 'Functional spec'], ['03-technical-spec.html', 'Technical spec'], ['12-glossary.html', 'Glossary']])}${col('Trust', [['06-security-privacy-legal.html', 'Security and legal'], ['07-independent-audit.html', 'Audit'], ['test-results.html', 'Test results']])}${col('Project', [[GH, 'GitHub'], [NPM, 'npm'], [`${GH}/blob/main/CHANGELOG.md`, 'Changelog']])}</div><p class="legal">IncidentSutra AI ${V}. Advisory output for people: it does not determine root cause and is not legal, compliance or security certification. The audit is a self-audit. Product names belong to their owners; no endorsement is implied.</p></footer>`;

const pages = ORDER.map(slug => {
  const raw = read(`documents/IncidentSutra-AI/${slug}.md`);
  return {slug, raw, title: (raw.match(/^#\s+(.+)$/m) || [, slug])[1].replace(/`/g, ''), summary: (raw.match(/^>\s+(.+)$/m) || [, ''])[1].replace(/[*`]/g, '')};
});
const unknown = fs.readdirSync(DIR).filter(f => f.endsWith('.md') && !ORDER.includes(f.slice(0, -3)));
if (unknown.length) throw new Error(`Markdown files missing from GROUPS: ${unknown.join(', ')}`);
const plain = md => md.replace(/```[\s\S]*?```/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/[`*#>|_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
const index = pages.map(p => ({t: p.title, u: `${p.slug}.html`, x: plain(p.raw).slice(0, 2500)}));
const tail = () => `<script>window.__DOCS_INDEX__=${JSON.stringify(index).replace(/</g, '\\u003c')}</script><script src="assets/site.js" defer></script></body></html>\n`;
const side = cur => `<aside class="sidebar" id="sidebar" aria-label="Documentation"><a class="nav-home" href="index.html">Home</a>${GROUPS.map(([g, slugs]) => `<div class="nav-group"><p class="nav-title">${g}</p><ol>${slugs.map(s => `<li><a href="${s}.html"${s === cur ? ' aria-current="page"' : ''}>${esc(s === 'README' ? 'Documentation map' : pages.find(x => x.slug === s).title)}</a></li>`).join('')}</ol></div>`).join('')}</aside><div class="scrim" hidden></div>`;

pages.forEach((p, n) => {
  const {html, toc} = mdToHtml(p.raw, directive);
  const prev = pages[n - 1], next = pages[n + 1];
  const tocUl = `<ul>${toc.map(t => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul>`;
  const tocM = `<details class="toc-m"><summary>On this page</summary>${tocUl}</details>`;
  const body = html.replace('</blockquote>', () => '</blockquote>' + tocM).replace(/^<h1>/, `<p class="eyebrow">${esc(GROUPS.find(g => g[1].includes(p.slug))[0])}</p><h1>`);
  outputs.set(`${p.slug}.html`, `${head({title: `${p.title} · IncidentSutra AI`, desc: p.summary || `${p.title} for IncidentSutra AI, the offline incident evidence CLI.`, canon: `${SITE}/${p.slug}.html`})}<body><a class="skip" href="#content">Skip to content</a>${sprite}${topbar(false, p.slug)}<div class="layout">${side(p.slug)}<main class="content" id="content" tabindex="-1"><article class="prose">${body}<p class="edit"><a href="${GH}/blob/main/documents/IncidentSutra-AI/${p.slug}.md" rel="noopener">View this page source on GitHub</a></p><nav class="pager" aria-label="Pagination">${prev ? `<a class="prev" href="${prev.slug}.html"><span>Previous</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}${next ? `<a class="next" href="${next.slug}.html"><span>Next</span><b>${esc(next.title)}</b></a>` : '<span></span>'}</nav></article></main><nav class="toc" aria-label="On this page"><h2>On this page</h2>${tocUl}</nav></div>${footer()}${tail()}`);
});

// ---------- home ----------
const demo = scn['deploy-blamed'];
const mock = `<div class="mock" role="img" aria-label="Sample report: errors began before the release, so the report lists counter-evidence"><div class="mock-bar"><i></i><i></i><i></i><span>incident-report.html</span></div><div class="mock-in"><div class="mock-head"><b>orders: errors rising</b><span class="pill warn">HUMAN REVIEW</span></div><div class="mock-cards"><div><b>${demo.summary.count}</b><span>observed</span></div><div><b>${demo.hypotheses.length}</b><span>hypotheses</span></div><div><b>${demo.contradictions.length}</b><span>against</span></div></div><ul class="mock-list"><li><span class="pill bad">10:02</span> first error: before the release</li><li><span class="pill ok">10:06</span> release 4.2.0 rolled out</li><li><span class="pill warn">verdict</span> cause unconfirmed; pre-existing defect also possible</li></ul></div></div>`;
const feats = [['clock', 'An auditable timeline', 'Strict time zones, nanoseconds kept, every line traced to a file, record and SHA-256.'], ['layers', 'Competing explanations', 'Change, dependency, saturation, datastore, latent defect and unknown, side by side.'], ['eye', 'Counter-evidence first', 'Errors that started before a release are shown against it, not hidden.'], ['file', 'Reports people can read', 'Single-file HTML, Markdown, JSON and a blameless postmortem draft.'], ['lock', 'Stays on your machine', 'No network, no API key, no telemetry, no dependencies, nothing executed.'], ['shield', 'Checks itself', `${audit.counts.total} automated checks, written as HTML, Markdown and JSON.`]];
const faqs = [['Does it find the root cause?', 'No. It lists explanations you can disprove, with evidence for and against. Every one stays unconfirmed.'], ['Does it need an API key or internet?', 'No. It uses only Node.js built-ins.'], ['Can it change production?', 'There is no code path for it: no network client and no process execution in product code.'], ['Is my data safe?', 'It never leaves your machine unless you share it. Masking is best effort, so sanitize exports first.'], ['Is the audit a certification?', 'No. It is a self-audit that anyone can rerun.'], ['Can I use it commercially?', 'Yes, under Apache-2.0, provided as is.']];
const INSTALL = 'npx incidentsutra doctor';
const install = (cls = '') => `<div class="install ${cls}"><span class="prompt" aria-hidden="true">$</span><code>${INSTALL}</code><button class="copy-inline" type="button" aria-label="Copy command">${ic('copy', 16)}<span>Copy</span></button></div>`;
const sec = (alt, kicker, title, sub, body) => `<section class="sec${alt ? ' alt' : ''}"><div class="wrap"><p class="kicker">${kicker}</p><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}${body}</div></section>`;
const homeDesc = 'Offline, read-only incident investigation CLI: auditable UTC timelines, competing root-cause hypotheses with counter-evidence, blameless postmortems, HTML, Markdown and JSON reports, and 20 agent skills.';
const LD = JSON.stringify({'@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'IncidentSutra AI', applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows, macOS, Linux (Node.js 20+)', softwareVersion: V, license: 'https://www.apache.org/licenses/LICENSE-2.0', author: {'@type': 'Person', name: 'Vatsal Shah', url: 'https://github.com/shahvatsalofficial'}, url: SITE + '/', codeRepository: GH, description: homeDesc, offers: {'@type': 'Offer', price: '0', priceCurrency: 'USD'}});
outputs.set('index.html', `${head({title: 'IncidentSutra AI · Offline incident evidence and root-cause reasoning CLI', desc: homeDesc, canon: `${SITE}/`, extra: `<script type="application/ld+json">${LD}</script>`})}<body class="home-page" id="top"><a class="skip" href="#main">Skip to content</a>${sprite}${topbar(true, '')}<main id="main">
<section class="hero"><div class="wrap hero-grid"><div><p class="badge"><span class="dot"></span>v${V} · Apache-2.0 · zero dependencies</p><h1>Find what <span class="grad">really happened</span>, not the first guess.</h1><p class="lead">IncidentSutra AI turns exported logs, alerts, metrics and deployments into an auditable timeline, several competing explanations with the evidence against each, and a blameless postmortem draft. Offline. Read-only. Honest about what it does not know.</p><div class="cta"><a class="btn primary" href="05-user-guide.html">Get started ${ic('arrow', 18)}</a><a class="btn" href="10-real-world-scenarios.html">See real scenarios</a></div>${install()}<ul class="facts"><li>Node 20+</li><li>No API key</li><li>No network</li><li>HTML · MD · JSON</li></ul></div><div class="hero-art">${mock}</div></div></section>
<section class="statband" aria-label="Key facts"><div class="wrap"><ul><li><b>${tests.pass}</b><span>tests passing</span></li><li><b>${audit.counts.pass}/${audit.counts.total}</b><span>audit checks pass</span></li><li><b>${bench.casesPassed}</b><span>synthetic cases</span></li><li><b>${skills}</b><span>agent skills</span></li><li><b>0</b><span>dependencies</span></li></ul></div></section>
${sec(false, 'The problem', 'The first story of an outage is easy to believe', 'A recent deploy, mixed time zones and missing data all push a team toward one explanation. IncidentSutra keeps the alternatives and the gaps visible.', `<div class="feat-grid">${feats.map(([i, t, d]) => `<div class="feat"><div class="feat-ic">${ic(i, 22)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`)}
${sec(true, 'How it works', 'From exported files to a human decision', 'Six steps. Only the last one decides anything, and it is yours.', `${diagram('pipeline')}${directive('flow', 'oncall')}`)}
${sec(false, 'Honest by design', 'Four kinds of statement, never blurred', 'Observed facts, inferred hypotheses, unknown data and checks that were not run are different things in the report.', `${diagram('evidence')}`)}
${sec(true, 'Real-world scenarios', 'Six situations you will recognise', 'Each runs on a committed sample file, so the timeline and hypotheses you see are real tool output.', `<div class="scn-grid">${SCENARIOS.map(([n, t, d, k], i) => `<a class="scard ${k}" href="10-real-world-scenarios.html#${headingId(`Scenario ${i + 1}: ` + [...read('documents/IncidentSutra-AI/10-real-world-scenarios.md').matchAll(/^## Scenario \d+: (.+)$/gm)][i][1])}"><span class="snum">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p><span class="more">Read the scenario ${ic('arrow', 16)}</span></a>`).join('')}</div>`)}
${sec(false, 'The classic trap', 'Why time zones change the story', 'One offset decides which event came first.', `${diagram('timezone')}`)}
${sec(true, 'Proof, with limits', 'Measured, then shown', 'Numbers below are read from committed evidence files that anyone can regenerate.', `${CHARTS.tests()}${CHARTS.audit()}<div class="cta"><a class="btn" href="07-independent-audit.html">Read the audit ${ic('arrow', 18)}</a><a class="btn ghost" href="evidence/samples/incident-report.html">Open a sample report</a></div>`)}
${sec(false, 'Compare', 'What it is, and is not', '', `<div class="table-wrap"><table><thead><tr><th scope="col">Question</th><th scope="col">IncidentSutra AI</th><th scope="col">Not this</th></tr></thead><tbody><tr><td>Root cause</td><td>Several unconfirmed hypotheses</td><td>An automatic verdict</td></tr><tr><td>Data</td><td>Files you export and sanitize</td><td>A telemetry platform or live connector</td></tr><tr><td>Actions</td><td>Proposes read-only checks</td><td>Restarts, rollbacks or paging</td></tr><tr><td>Privacy</td><td>Local, best-effort masking</td><td>Data-loss prevention</td></tr><tr><td>Assurance</td><td>Reproducible self-audit</td><td>A certification</td></tr></tbody></table></div>`)}
${sec(true, 'Agent skills', `${skills} roles for your AI coding tool`, 'Install project-locally for Claude Code, Cursor, Codex, Gemini CLI or Copilot. Copying is tested; native activation per tool is not.', `${diagram('agents')}<pre class="code"><code>npx incidentsutra skills install --host claude --project .</code><button class="copy" type="button">Copy</button></pre>`)}
${sec(false, 'Who uses it', 'For the people in the room', '', '<div class="who"><div><b>On-call engineers</b><span>A timeline before the war room argues.</span></div><div><b>Incident commanders</b><span>See what is known, unknown and not run.</span></div><div><b>Support escalation</b><span>Turn reports into evidence with IDs.</span></div><div><b>Postmortem authors</b><span>Start from facts and stay blameless.</span></div></div>')}
${sec(true, 'Documentation', 'Everything, in order', '', `<div class="dgrid">${GROUPS.map(([g, slugs]) => `<div class="dgroup"><h3>${g}</h3><p>${slugs.length} pages</p><ul>${slugs.map(s => `<li><a href="${s}.html">${esc(s === 'README' ? 'Documentation map' : pages.find(x => x.slug === s).title)}</a></li>`).join('')}</ul></div>`).join('')}</div>`)}
<section class="sec"><div class="wrap narrow"><p class="kicker center">FAQ</p><h2 class="center">Quick answers</h2>${faqs.map(([q, a]) => `<details class="qa"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
<section class="cta-band"><div class="wrap"><h2>Bring evidence to your next incident</h2><p>Free, offline and open source.</p>${install('on-dark')}<div class="cta center"><a class="btn light" href="${GH}" rel="noopener">View on GitHub</a><a class="btn outline" href="05-user-guide.html">Read the guide</a></div></div></section></main>${footer()}${tail()}`);

outputs.set('404.html', `${head({title: 'Page not found · IncidentSutra AI', desc: 'Page not found', canon: `${SITE}/404.html`, extra: '<base href="/IncidentSutra-AI/">'})}<body>${sprite}<main class="wrap narrow center" style="padding:5rem 0"><h1>Page not found</h1><p class="lead">This page is unknown. We will not guess where it went.</p><p class="cta center"><a class="btn primary" href="index.html">Back to the home page</a></p></main><script src="assets/site.js" defer></script></body></html>\n`);
outputs.set('assets/site.css', ['site.css', 'extra.css', 'incident.css'].map(f => read(`site/${f}`)).join('\n'));
outputs.set('assets/site.js', read('site/site.js'));
const urls = ['', ...pages.map(p => p.slug + '.html'), ...SCENARIOS.map(([n]) => `evidence/scenarios/${n}.html`), 'evidence/samples/incident-report.html', 'evidence/audit/audit-report.html'];
outputs.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
outputs.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

const stale = [];
for (const [rel, content] of outputs) {
  const f = path.join(DIR, rel);
  if (check) { if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') !== content.replace(/\r\n/g, '\n')) stale.push(rel); }
  else { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, content); }
}
if (stale.length) { console.error('Stale site output (run npm run build:docs): ' + stale.join(', ')); process.exit(1); }
console.log(`${check ? 'checked' : 'built'} ${pages.length} pages, home, ${SCENARIOS.length} scenario reports`);
