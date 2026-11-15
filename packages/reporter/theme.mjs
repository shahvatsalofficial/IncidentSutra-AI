export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const mdCell = s => String(s ?? '').replace(/[|\n\r]/g, ' ').replace(/</g, '&lt;').slice(0, 160);

export const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

export const CSS = `
:root{--bg:#f5f7fa;--card:#fff;--fg:#14202e;--mut:#506072;--bd:#dbe3ec;--ac:#0b5c7a;--ok:#0f7a4d;--warn:#9a5b00;--bad:#b3261e;--info:#2b4fa3;--chip:#eaf0f6;--code:#eef2f6}
@media(prefers-color-scheme:dark){:root{--bg:#0d141c;--card:#141e29;--fg:#e6edf5;--mut:#9db0c4;--bd:#243445;--ac:#6cc4e6;--ok:#52d39b;--warn:#f0b24a;--bad:#ff8a80;--info:#8fb0ff;--chip:#1c2a39;--code:#1a2735}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--ac)}code{background:var(--code);padding:.1em .35em;border-radius:5px;font:.85em ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
.wrap{max-width:1160px;margin:0 auto;padding:20px 16px 72px}
header.hero{background:linear-gradient(135deg,#0b3d52,#0b5c7a 60%,#12806f);color:#fff;border-radius:16px;padding:28px 24px;margin-bottom:20px}
header.hero h1{margin:0 0 4px;font-size:1.9rem;line-height:1.2}header.hero p{margin:4px 0;opacity:.92}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:600;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);color:#fff}
.banner{border:2px dashed var(--warn);background:var(--card);border-radius:10px;padding:10px 14px;margin:0 0 16px;color:var(--warn);font-weight:600}
nav.toc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}nav.toc a{padding:4px 12px;border:1px solid var(--bd);border-radius:999px;background:var(--card);text-decoration:none;font-size:.85rem}
section{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:18px 20px;margin:0 0 18px}
h2{margin:0 0 10px;font-size:1.25rem}h3{margin:14px 0 6px;font-size:1.02rem}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi{border:1px solid var(--bd);border-radius:12px;padding:12px;background:var(--bg)}.kpi b{display:block;font-size:1.6rem}.kpi span{color:var(--mut);font-size:.82rem}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{padding:8px 10px;border-bottom:1px solid var(--bd);text-align:left;vertical-align:top}th{background:var(--chip);position:sticky;top:0}
tr:target{outline:3px solid var(--ac)}
.chip{display:inline-block;padding:1px 8px;border-radius:6px;font-size:.74rem;font-weight:700;background:var(--chip);border:1px solid var(--bd)}
.chip.observed{border-style:solid;color:var(--ok)}.chip.inferred{border-style:dashed;color:var(--info)}.chip.unknown{color:var(--mut)}.chip.notrun{color:var(--warn);border-style:dotted}
.chip.pass{color:var(--ok)}.chip.fail{color:var(--bad)}.chip.warn{color:var(--warn)}.sev-critical,.sev-error,.sev-fatal{color:var(--bad);font-weight:700}.sev-warning{color:var(--warn);font-weight:700}
.legend{display:flex;flex-wrap:wrap;gap:12px;color:var(--mut);font-size:.85rem}
.hyp{border:1px solid var(--bd);border-radius:12px;padding:14px;margin:10px 0;background:var(--bg)}.hyp h3{margin-top:0}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.pro{border-left:4px solid var(--ok);padding-left:10px}.con{border-left:4px solid var(--bad);padding-left:10px}
ul{padding-left:20px;margin:6px 0}svg{max-width:100%;height:auto}.mut{color:var(--mut)}
footer{color:var(--mut);font-size:.82rem;margin-top:24px}
:focus-visible{outline:3px solid var(--ac);outline-offset:2px}
@media(max-width:640px){header.hero{padding:20px 16px}header.hero h1{font-size:1.5rem}section{padding:14px}}
@media print{body{background:#fff}nav.toc{display:none}section,.hyp{break-inside:avoid}header.hero{background:#0b3d52;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

export function page({title, description, body}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>\n`;
}
