import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMarkdownRenderer } from 'vitepress';
import { changeWarning, configureMarkdown, inventory, navigation, presentationMarkdown, repositoryLink } from '../docs-site/.vitepress/content.ts';

function fixture(t: test.TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'querytube-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  write('CONTEXT.md', '# Domain Language\n');
  write('docs/architecture/domain-view/README.md', '# Domain View\n');
  write('server/app.ts', '// Source\n');
  write('openapi/public-api.yaml', 'openapi: 3.1.0\n');
  return { root, write };
}

test('discovers nested canonical specs and separates archived planning from active changes', (t) => {
  const { root, write } = fixture(t);
  assert.match(presentationMarkdown('<!-- docs:specs -->', 'docs-site/specifications.md', root), /No canonical/);
  write('openspec/specs/reference/nested/spec.md', '# Nested specification\n');
  write('openspec/changes/current/specs/reference/spec.md', '# Proposed delta\n');
  write('openspec/changes/archive/2026-10-03-previous/proposal.md', '# Historical proposal\n');
  const sources = inventory(root);
  assert.deepEqual(sources.specs, ['openspec/specs/reference/nested/spec.md']);
  assert.deepEqual(sources.active, ['openspec/changes/current/specs/reference/spec.md']);
  assert.equal(sources.history.length, 1);
  assert.match(JSON.stringify(navigation(sources.specs, 'openspec/specs', root)), /Nested specification/);
  assert.match(presentationMarkdown('<!-- docs:specs -->', 'docs-site/specifications.md', root), /\/openspec\/specs\/reference\/nested\/spec.html/);
  const active = presentationMarkdown('<!-- docs:active -->', 'docs-site/changes.md', root);
  assert.match(active, /current/);
  assert.doesNotMatch(active, /previous/);
});

test('adapts cross-source links without losing fragments and rejects missing repository targets', (t) => {
  const { root } = fixture(t);
  const file = 'docs/architecture/domain-view/README.md';
  assert.equal(repositoryLink('../../../CONTEXT.md#domain-language', file, root), '/CONTEXT.html#domain-language');
  assert.equal(repositoryLink('../../../server/app.ts#L1', file, root), 'https://github.com/ochowei/querytube/blob/main/server/app.ts#L1');
  assert.equal(repositoryLink('../../../openapi/public-api.yaml', file, root), 'https://github.com/ochowei/querytube/blob/main/openapi/public-api.yaml');
  assert.throws(() => repositoryLink('../../../server/missing.ts', file, root), /Missing repository link/);
  assert.equal(repositoryLink('https://example.com/?a=1#fragment', file, root), 'https://example.com/?a=1#fragment');
});

test('renders original edits and warnings on direct active, delta, and archived routes', async (t) => {
  const { root, write } = fixture(t);
  const md = await createMarkdownRenderer(root, { config: (renderer) => configureMarkdown(renderer, root) });
  const routes = ['openspec/changes/current/design.md', 'openspec/changes/current/specs/documentation-site/spec.md', 'openspec/changes/archive/2026-10-03-old/tasks.md'];
  for (const relativePath of routes) {
    const html = md.render('---\ntitle: Planning\n---\n# Proposed work\n', { relativePath });
    assert.match(html, /warning custom-block/);
    assert.ok(html.indexOf(changeWarning) < html.indexOf('<h1'));
  }
  const file = 'docs/architecture/domain-view/README.md';
  const render = () => md.render(presentationMarkdown('# Original\n[Glossary](../../../CONTEXT.md)\n', file, root), { relativePath: file });
  assert.match(render(), /href="\/CONTEXT.html"/);
  const home = md.render('[Architecture](../docs/architecture/domain-view/README.md)', {
    relativePath: 'index.md', path: path.join(root, 'index.md'), realPath: path.join(root, 'docs-site/index.md'),
  });
  assert.match(home, /href="\/docs\/architecture\/domain-view\/README.html"/);
  write('openspec/specs/example/spec.md', '# First source title\n');
  const index = () => md.render('<!-- docs:specs -->', { relativePath: 'docs-site/specifications.md' });
  assert.match(index(), /First source title/);
  write('openspec/specs/example/spec.md', '# Edited source title\n');
  assert.match(index(), /Edited source title/);
  assert.match(md.render(readFileSync(path.join(root, 'openspec/specs/example/spec.md'), 'utf8'), {
    relativePath: 'openspec/specs/example/spec.md',
  }), /Edited source title/);
});
