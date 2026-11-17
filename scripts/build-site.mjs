// Builds _site/ for GitHub Pages: landing page + documents/IncidentSutra-AI under /docs/, sitemap and robots.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const BASE = 'https://shahvatsalofficial.github.io/IncidentSutra-AI/';

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(path.join(out, 'docs'), {recursive: true});
fs.cpSync(path.join(root, 'documents/IncidentSutra-AI'), path.join(out, 'docs'), {recursive: true});
fs.copyFileSync(path.join(root, 'site/index.html'), path.join(out, 'index.html'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.html')) pages.push(path.relative(out, f).replaceAll('\\', '/'));
  }
})(out);
pages.sort();
const urls = pages.map(p => (p === 'index.html' ? BASE : BASE + p));
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
console.log(`site built: ${pages.length} pages in _site/`);
