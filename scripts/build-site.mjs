// Copies the built documentation website to _site/ for GitHub Pages, plus redirects for the former /docs/ URLs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'documents/IncidentSutra-AI'), out = path.join(root, '_site');

fs.rmSync(out, {recursive: true, force: true});
fs.cpSync(src, out, {recursive: true});
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.copyFileSync(path.join(root, 'llms.txt'), path.join(out, 'llms.txt'));

let redirects = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!e.name.endsWith('.html') || e.name === '404.html') continue;
    const rel = path.relative(src, f).replaceAll('\\', '/'), old = path.join(out, 'docs', rel);
    const target = '../'.repeat(rel.split('/').length) + rel;
    fs.mkdirSync(path.dirname(old), {recursive: true});
    fs.writeFileSync(old, `<!doctype html><meta charset="utf-8"><title>Moved</title><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${target}"><a href="${target}">This page moved</a>\n`);
    redirects++;
  }
})(src);
console.log(`site built in _site/ with ${redirects} redirects`);
