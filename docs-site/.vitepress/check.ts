import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeWarning, inventory, pageLink, repositoryUrl } from './content.ts';

const output = fileURLToPath(new URL('./dist/', import.meta.url));
assert.ok(existsSync(path.join(output, 'index.html')), 'Run npm run docs:build before docs:check.');

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

function decodeAttribute(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

const pages = new Map(htmlFiles(output).map((file) => [file, readFileSync(file, 'utf8')]));
let checkedLinks = 0;
for (const [file, html] of pages) {
  const relative = path.relative(output, file).split(path.sep).join('/');
  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = decodeAttribute(match[1]);
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
    const url = new URL(href, `https://docs.invalid/${relative}`);
    let target = decodeURIComponent(url.pathname).slice(1);
    if (!target || target.endsWith('/')) target += 'index.html';
    const absolute = path.resolve(output, target);
    assert.ok(absolute.startsWith(output), `Link escapes output: ${relative} -> ${href}`);
    assert.ok(existsSync(absolute), `Broken internal link: ${relative} -> ${href}`);
    if (url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      const ids = [...(pages.get(absolute) ?? '').matchAll(/\bid="([^"]+)"/g)].map((item) => decodeAttribute(item[1]));
      assert.ok(ids.includes(id), `Broken fragment: ${relative} -> ${href}`);
    }
    checkedLinks++;
  }
}

const sources = inventory();
const expectedPages = [...sources.architecture, ...sources.specs, ...sources.active, ...sources.history, ...sources.wrappers, 'CONTEXT.md'];
const expected = new Set(expectedPages.map((file) => pageLink(file) === '/' ? 'index.html' : pageLink(file).slice(1)));
assert.deepEqual(new Set([...pages.keys()].map((file) => path.relative(output, file).split(path.sep).join('/')).filter((file) => file !== '404.html')), expected, 'Built page inventory must match the intended original sources and wrappers.');

const home = pages.get(path.join(output, 'index.html'))!;
for (const file of ['docs/architecture/system-view.md', 'docs-site/specifications.md', 'docs-site/changes.md', 'CONTEXT.md', 'docs-site/public-api.md']) {
  assert.ok(home.includes(`href="${pageLink(file)}"`), `Missing home navigation: ${file}`);
}
const activeIndex = pages.get(path.join(output, 'docs-site/changes.html'))!;
for (const file of sources.active) assert.ok(activeIndex.includes(`href="${pageLink(file)}"`), `Active change missing from list: ${file}`);
for (const file of [...sources.active, ...sources.history]) {
  const html = pages.get(path.join(output, pageLink(file).slice(1)))!;
  assert.ok(html.includes(changeWarning), `Missing planning warning: ${file}`);
  assert.ok(html.indexOf('warning custom-block') < html.indexOf('<h1'), `Warning must precede content: ${file}`);
}
for (const file of ['docs-site/changes.html', 'docs-site/history.html']) {
  assert.ok(pages.get(path.join(output, file))!.includes(changeWarning), `Missing listing warning: ${file}`);
}
assert.ok(pages.get(path.join(output, 'docs-site/public-api.html'))!.includes(`${repositoryUrl}openapi/public-api.yaml`), 'Public API must link to the authoritative YAML.');
if (!sources.specs.length) {
  assert.ok(pages.get(path.join(output, 'docs-site/specifications.html'))!.includes('No canonical OpenSpec specifications have been integrated yet.'), 'Empty canonical specification collection must be explicit.');
}
console.log(`Validated ${pages.size} HTML pages and ${checkedLinks} internal links/fragments, section navigation, source inventory, and change warnings.`);
console.log(sources.specs.length ? `Rendered ${sources.specs.length} canonical specification pages.` : 'Canonical specs are currently empty; verified the empty state. Change spec deltas remain separate from canonical specifications.');
