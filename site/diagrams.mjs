// Theme-aware inline SVG diagrams. Colours come from CSS variables in site.css, so one SVG serves light and dark.
let uid = 0;
const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svg = (w, h, label, body) => {
  const id = `ah${++uid}`;
  return `<div class="dia-scroll"><svg class="dia" viewBox="0 0 ${w} ${h}" role="img" aria-label="${e(label)}"><defs><marker id="${id}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path class="ah" d="M0,0 L9,4.5 L0,9 z"/></marker></defs>${body.replaceAll('#AH', `url(#${id})`)}</svg></div>`;
};
const box = (x, y, w, h, t1, t2 = '', cls = '') => `<rect class="bx ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text class="t1" x="${x + w / 2}" y="${y + (t2 ? h / 2 - 3 : h / 2 + 5)}" text-anchor="middle">${e(t1)}</text>${t2 ? `<text class="t2" x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle">${e(t2)}</text>` : ''}`;
const arrow = (d, dash = false) => `<path class="ln${dash ? ' dash' : ''}" d="${d}" marker-end="#AH"/>`;
const line = d => `<path class="ln dash" d="${d}"/>`;
const txt = (x, y, s, cls = 't2', anchor = 'middle') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${e(s)}</text>`;
const zone = (x, y, w, h, cls = 'zone') => `<rect class="bx ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
const chain = (items, y, w, gap, h) => items.map(([a, b, c], i) => { const x = 8 + i * (w + gap); return box(x, y, w, h, a, b, c || '') + (i ? arrow(`M${x - gap} ${y + h / 2} H${x}`) : ''); }).join('');

export const DIAGRAMS = {
  pipeline: () => svg(780, 190, 'Pipeline: exported telemetry files are parsed and normalised to UTC, secrets are masked, rules build hypotheses with contradictions, reports are written as HTML, Markdown and JSON, and a human decides.',
    chain([['Export', 'logs, deploys'], ['Parse', 'strict UTC'], ['Mask', 'secrets, PII', 'warn'], ['Reason', 'rules only', 'br'], ['Report', 'HTML MD JSON', 'ok'], ['Human', 'decides', 'br']], 55, 108, 23, 70) +
    txt(390, 28, 'offline: no network, no process execution, no API key', 't1') + txt(390, 166, 'every fact keeps its file, record number and SHA-256')),

  evidence: () => svg(780, 250, 'Four kinds of statement: observed facts come from imported records; inferred hypotheses are built from observed facts and are never confirmed; unknown means data was not supplied; not run means a check was deliberately not executed.',
    box(8, 20, 180, 80, 'OBSERVED', 'in an imported record', 'ok') + box(300, 20, 180, 80, 'INFERRED', 'hypothesis, unconfirmed', 'br') + box(592, 20, 180, 80, 'UNKNOWN', 'data not supplied', 'warn') +
    box(300, 160, 180, 70, 'NOT RUN', 'check not executed', 'bad') + arrow('M188 60 H300') + arrow('M592 60 H480', true) + arrow('M390 100 V160', true) +
    txt(244, 48, 'supports') + txt(536, 48, 'limits') + txt(400, 134, 'next check', 't2', 'start') + txt(98, 140, 'cites an evidence ID') + txt(682, 140, 'never filled in')),

  timezone: () => svg(780, 300, 'Time zone example: a deployment logged at 01:15 in India time is 19:45 UTC, which is four minutes before an error at 19:49 UTC. Reading the clock times without offsets would put the deployment after the error.',
    txt(12, 28, 'What the raw logs show', 't1', 'start') + box(8, 42, 240, 56, 'error   19:49', 'app log, UTC', 'bad') + box(280, 42, 240, 56, 'deploy  01:15', 'CI log, +05:30', 'br') + txt(655, 66, 'looks like the deploy', 'tr') + txt(655, 86, 'came hours later', 'tr') +
    arrow('M128 98 V150') + arrow('M400 98 V150') + txt(264, 130, 'convert both to UTC') +
    txt(12, 178, 'What happened, in UTC', 't1', 'start') + line('M30 232 H750') + box(110, 206, 180, 52, '19:45 deploy', 'release 2.7.0', 'br') + box(450, 206, 180, 52, '19:49 error', 'payment timeout', 'bad') + arrow('M290 232 H450') + txt(390, 286, 'Deploy came 4 minutes BEFORE the error. Timing is still not proof of cause.', 't1')),

  hypothesis: () => svg(780, 330, 'How hypotheses are built: for each service with errors, five candidate families are checked; each keeps supporting and contradicting evidence and read-only checks; a human reviews; the tool never confirms a cause.',
    box(290, 8, 200, 52, 'Error or alert', 'first signal per service', 'bad') + line('M390 60 V84 M78 84 H702') +
    [['Change', 'deploy near onset'], ['Dependency', 'timeouts'], ['Saturation', 'CPU, memory'], ['Datastore', 'pool, locks'], ['Latent', 'pre-existing']].map(([a, b], i) => box(8 + i * 156, 108, 140, 58, a, b, 'br') + arrow(`M${78 + i * 156} 84 V108`) + line(`M${78 + i * 156} 166 V188`)).join('') + line('M78 188 H702') + arrow('M390 188 V206') +
    box(210, 206, 360, 52, 'Support, contradictions, gaps', 'plus read-only checks, not run', 'warn') + arrow('M390 258 V276') + box(250, 276, 280, 48, 'Human review', 'status stays unconfirmed', 'ok')),

  architecture: () => svg(780, 290, 'Architecture: the command line calls ingest, then analyze, then the reporter; verify, audit, the loopback server and agent skills sit around them.',
    box(290, 8, 200, 48, 'CLI', 'packages/cli', 'br') + arrow('M390 56 V70 H118 V84') +
    chain([['ingest', 'parse, mask, sort', 'br'], ['analyze', 'hypotheses, gaps', 'br'], ['reporter', 'HTML, MD, JSON', 'br']], 84, 220, 52, 64) +
    line('M390 148 V176 M93 176 H690') + [['verify', 'digest, hashes'], ['audit', '20 checks'], ['serve', 'loopback, GET'], ['skills', '20 role files']].map(([a, b], i) => box([8, 208, 408, 608][i], 200, 164, 60, a, b) + arrow(`M${[90, 290, 490, 690][i]} 176 V200`, true)).join('') +
    txt(390, 284, 'zero dependencies: only Node.js built-in modules')),

  trust: () => svg(780, 240, 'Trust boundaries: untrusted logs, runbooks and tickets are treated as data inside a local process with no network; outputs go only to the folder you choose; decisions and actions happen outside the tool.',
    zone(8, 16, 220, 200) + txt(118, 44, 'UNTRUSTED', 'tr') + txt(118, 82, 'log messages') + txt(118, 108, 'tickets, runbooks') + txt(118, 134, '"ignore your rules"') + txt(118, 170, 'stays plain text', 't1') +
    zone(280, 16, 220, 200, 'br') + txt(390, 44, 'YOUR MACHINE', 'tb') + txt(390, 82, 'size and count limits') + txt(390, 108, 'masking, escaping') + txt(390, 134, 'no symlink following') + txt(390, 170, 'no network, no exec', 't1') +
    zone(552, 16, 220, 200) + txt(662, 44, 'PEOPLE', 'tg') + txt(662, 82, 'incident commander') + txt(662, 108, 'reviews the report') + txt(662, 134, 'approves any action') + txt(662, 170, 'outside the tool', 't1') + arrow('M228 116 H280') + arrow('M500 116 H552')),

  agents: () => svg(780, 280, 'Agent roles: Prime coordinates log, timeline, change and hypothesis roles; the evidence ledger and privacy guardian can block; then the postmortem writer drafts.',
    box(290, 8, 200, 52, 'Prime', 'coordinates', 'br') + arrow('M390 60 V72 H88 V86') +
    chain([['Log sentinel', 'input quality'], ['Timeline', 'UTC order'], ['Change', 'deploys'], ['Hypothesis', 'falsify']], 86, 160, 41, 60) +
    arrow('M691 146 V176') + box(540, 176, 232, 52, 'Evidence ledger', 'can block', 'bad') + arrow('M540 202 H506') + box(274, 176, 232, 52, 'Privacy guardian', 'can block', 'bad') + arrow('M274 202 H240') + box(8, 176, 232, 52, 'Postmortem writer', 'blameless draft', 'ok') + txt(390, 262, 'Roles are instructions for your AI tool, not twenty running models.')),
};

export const FLOWS = {
  oncall: {row: true, steps: [['Detect', 'Your alerting pages you'], ['Export', 'A small, sanitized window'], ['Analyze', 'Build the report'], ['Check', 'You run the read-only checks', 'warn'], ['Verify', 'Confirm nothing changed'], ['Learn', 'Finish the postmortem', 'ok']]},
  quick: {row: true, steps: [['Nothing to install', 'Node 20+ and `npx`'], ['Point at files', 'JSON, JSONL, CSV, OTLP'], ['Open the report', 'HTML in any browser'], ['Decide', 'People own the call', 'ok']]},
  read: {row: true, steps: [['Summary', 'Scope and counts'], ['Timeline', 'What was observed'], ['Contradictions', 'What does not fit', 'warn'], ['Gaps', 'What is unknown', 'warn'], ['Checks', 'What to run next', 'ok']]},
  ingest: {steps: [['Find files', 'No symlinks, up to 100 files of 2 MB'], ['Parse', 'Bad files and rows are reported, never silently dropped'], ['Check time', 'Explicit offset required; impossible dates rejected', 'warn'], ['Mask', 'Secrets and personal data, counted'], ['Order', 'Instant, nanoseconds, file, record', 'ok']]},
};

// Vertical versions shown on narrow screens, where a wide diagram would be unreadable.
export const NARROW = {
  pipeline: [['Export', 'Logs, alerts and deploys you choose'], ['Parse', 'Strict time zones, converted to UTC'], ['Mask', 'Secrets and personal data', 'warn'], ['Reason', 'Rules only, no model'], ['Report', 'HTML, Markdown and JSON', 'ok'], ['Human decides', 'Offline: no network, nothing executed']],
  evidence: [['Observed', 'In an imported record, with an evidence ID', 'ok'], ['Inferred', 'A hypothesis built from observations, never confirmed'], ['Unknown', 'Data not supplied, never filled in', 'warn'], ['Not run', 'A check that was proposed but not executed', 'bad']],
  timezone: [['Raw logs', 'Error at 19:49 UTC; deploy at 01:15 +05:30'], ['The trap', 'The deploy looks hours later', 'bad'], ['19:45 UTC: deploy', 'The same 01:15 +05:30, converted'], ['19:49 UTC: error', 'Four minutes after the deploy', 'warn'], ['Still not proof', 'Order in time does not establish cause']],
  hypothesis: [['Error or alert', 'The first signal for each service', 'bad'], ['Candidate families', 'Change, dependency, saturation, datastore, latent defect'], ['Weigh the evidence', 'Support, contradictions, gaps and read-only checks', 'warn'], ['Human review', 'Status stays unconfirmed', 'ok']],
  architecture: [['CLI', 'The command you run'], ['ingest', 'Parse, mask, sort'], ['analyze', 'Hypotheses and gaps'], ['reporter', 'HTML, Markdown, JSON', 'ok'], ['Around them', 'verify, audit, loopback server, 20 skills']],
  trust: [['Untrusted input', 'Logs, tickets and runbooks stay plain text', 'bad'], ['Your machine', 'Limits, masking, escaping; no network, no execution'], ['People', 'Review the report and approve any action outside the tool', 'ok']],
  agents: [['Prime', 'Coordinates the roles'], ['Specialists', 'Log sentinel, timeline, change, hypothesis'], ['Gatekeepers', 'Evidence ledger and privacy guardian can block', 'bad'], ['Postmortem writer', 'Drafts a blameless review', 'ok']]
};
