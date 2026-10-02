import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DefaultTheme, MarkdownRenderer } from 'vitepress';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const repositoryUrl = 'https://github.com/ochowei/querytube/blob/main/';
export const changeWarning = 'OpenSpec changes describe proposed future work and do not represent the current architecture until implemented and integrated.';

export function markdownFiles(root: string, directory: string): string[] {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      if (entry.name.startsWith('.')) return [];
      const file = path.posix.join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(root, file)
        : entry.isFile() && file.endsWith('.md') ? [file] : [];
    });
}

export function inventory(root = repositoryRoot) {
  const changes = markdownFiles(root, 'openspec/changes');
  return {
    architecture: markdownFiles(root, 'docs/architecture'),
    specs: markdownFiles(root, 'openspec/specs'),
    active: changes.filter((file) => !file.startsWith('openspec/changes/archive/')),
    history: changes.filter((file) => file.startsWith('openspec/changes/archive/')),
    wrappers: markdownFiles(root, 'docs-site'),
  };
}

export function pageLink(file: string): string {
  return file === 'docs-site/index.md' ? '/' : `/${file.replace(/\.md$/, '.html')}`;
}

function label(name: string): string {
  return name.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function title(root: string, file: string): string {
  const heading = readFileSync(path.join(root, file), 'utf8').match(/^#\s+(.+)$/m)?.[1];
  return heading ?? label(path.basename(file, '.md'));
}

export function navigation(files: string[], directory: string, root = repositoryRoot): DefaultTheme.SidebarItem[] {
  const entries = [...new Set(files.map((file) => file.slice(directory.length + 1).split('/')[0]))];
  const architectureOrder = ['README.md', 'system-view.md', 'software-view.md', 'domain-view', 'code-view.md', 'deployment-view.md'];
  if (directory === 'docs/architecture') {
    entries.sort((a, b) => (architectureOrder.indexOf(a) + 1 || 100) - (architectureOrder.indexOf(b) + 1 || 100));
  }
  return entries.map((entry) => {
    const file = `${directory}/${entry}`;
    if (files.includes(file)) return { text: entry === 'README.md' ? 'Overview' : title(root, file), link: pageLink(file) };
    return {
      text: label(entry), collapsed: true,
      items: navigation(files.filter((item) => item.startsWith(`${file}/`)), file, root),
    };
  });
}

// Exclude unrelated sources rather than mounting/copying documentation into docs-site.
export function sourceExclusions(root = repositoryRoot): string[] {
  const excludeSiblings = (directory: string, allowed: string[]) =>
    readdirSync(path.join(root, directory), { withFileTypes: true })
      .filter((entry) => !allowed.includes(entry.name))
      .map((entry) => path.posix.join(directory, entry.name, entry.isDirectory() ? '**' : ''));
  return [
    '**/node_modules/**', '**/.*/**',
    ...excludeSiblings('', ['docs', 'openspec', 'docs-site', 'CONTEXT.md']),
    ...excludeSiblings('docs', ['architecture']),
    ...excludeSiblings('openspec', ['specs', 'changes']),
  ];
}

function list(files: string[], empty: string, root: string): string {
  return files.length ? files.map((file) => `- [${file.replace(/\.md$/, '')}: ${title(root, file)}](${pageLink(file)})`).join('\n') : empty;
}

export function presentationMarkdown(source: string, file: string, root = repositoryRoot): string {
  const sources = inventory(root);
  const lists: Record<string, string> = {
    specs: list(sources.specs, 'No canonical OpenSpec specifications have been integrated yet.', root),
    active: list(sources.active, 'No active OpenSpec changes.', root),
    history: list(sources.history, 'No archived OpenSpec changes yet.', root),
  };
  source = source.replace(/<!-- docs:(specs|active|history) -->/g, (_, name: string) => lists[name]);
  if (file.startsWith('openspec/changes/')) {
    // Insert after frontmatter so metadata remains valid on future change pages.
    const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0] ?? '';
    source = `${frontmatter}\n::: warning OpenSpec change record\n${changeWarning}\n:::\n\n${source.slice(frontmatter.length)}`;
  }
  return source;
}

export function repositoryLink(href: string, file: string, root = repositoryRoot): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const [, target, suffix] = href.match(/^([^?#]*)(.*)$/s)!;
  // Site URLs (including generated index links) are checked by VitePress/the output checker.
  if (!target || target.endsWith('.html') || target.endsWith('/')) return href;
  const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(target)));
  if (resolved.startsWith('../') || !existsSync(path.join(root, resolved))) {
    throw new Error(`Missing repository link in ${file}: ${href}`);
  }
  const sources = inventory(root);
  const rendered = [...sources.architecture, ...sources.specs, ...sources.active, ...sources.history, ...sources.wrappers, 'CONTEXT.md'];
  if (rendered.includes(resolved)) return `${pageLink(resolved)}${suffix}`;
  return `${repositoryUrl}${resolved.split('/').map(encodeURIComponent).join('/')}${suffix}`;
}

export function configureMarkdown(md: MarkdownRenderer, root = repositoryRoot): void {
  md.core.ruler.before('block', 'querytube-presentation', (state) => {
    if (!state.env.relativePath || state.inlineMode) return;
    const sourcePath = state.env.realPath ?? state.env.path;
    const file = sourcePath ? path.relative(root, sourcePath).split(path.sep).join('/') : state.env.relativePath;
    state.src = presentationMarkdown(state.src, file, root);
  });
  md.core.ruler.after('inline', 'querytube-source-links', (state) => {
    if (!state.env.relativePath) return;
    const sourcePath = state.env.realPath ?? state.env.path;
    const file = sourcePath ? path.relative(root, sourcePath).split(path.sep).join('/') : state.env.relativePath;
    for (const token of state.tokens) {
      for (const child of token.children ?? []) {
        if (child.type !== 'link_open') continue;
        const href = child.attrGet('href');
        if (href) child.attrSet('href', repositoryLink(href, file, root));
      }
    }
  });
}
