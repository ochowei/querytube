import { defineConfig } from 'vitepress';
import { configureMarkdown, inventory, navigation, sourceExclusions } from './content';

const sources = inventory();

export default defineConfig({
  title: 'QueryTube Documentation',
  description: 'Architecture, specifications, change proposals, and reference documentation for QueryTube.',
  lang: 'en-US',
  srcDir: '../',
  srcExclude: sourceExclusions(),
  outDir: './.vitepress/dist',
  cacheDir: './.vitepress/cache',
  rewrites: { 'docs-site/index.md': 'index.md' },
  ignoreDeadLinks: false,
  vite: { configFile: false, publicDir: false },
  markdown: { config: configureMarkdown },
  themeConfig: {
    nav: [
      { text: 'Architecture', link: '/docs/architecture/README.html' },
      { text: 'Specifications', link: '/docs-site/specifications.html' },
      { text: 'Changes', link: '/docs-site/changes.html' },
      { text: 'Reference', link: '/CONTEXT.html' },
    ],
    sidebar: [
      { text: 'Architecture · Current on main', items: navigation(sources.architecture, 'docs/architecture') },
      { text: 'Specifications', items: [
        { text: 'OpenSpec Specs', link: '/docs-site/specifications.html' },
        ...navigation(sources.specs, 'openspec/specs'),
      ] },
      { text: 'Changes · Planning records', items: [
        { text: 'Active Changes', link: '/docs-site/changes.html' },
        ...navigation(sources.active, 'openspec/changes'),
        { text: 'Change History', link: '/docs-site/history.html' },
        ...navigation(sources.history, 'openspec/changes/archive'),
      ] },
      { text: 'Reference', items: [
        { text: 'Domain Glossary', link: '/CONTEXT.html' },
        { text: 'Public API', link: '/docs-site/public-api.html' },
      ] },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: ({ filePath }) => `https://github.com/ochowei/querytube/edit/main/${filePath}`,
      text: 'Edit the source on GitHub',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/ochowei/querytube' }],
    docFooter: { prev: false, next: false },
  },
});
