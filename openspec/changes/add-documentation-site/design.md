# Design

## Context

See [proposal.md](proposal.md) for motivation and [the spec delta](specs/documentation-site/spec.md) for requirements. The repository uses Bun, React/Vite, an Express API, and the spec-driven OpenSpec schema. `openspec/specs/` currently has only `.gitkeep`; the existing active change opts out of spec deltas. There are no archived changes yet. Architecture Markdown includes relative links to other viewpoints, the glossary, source code, ADRs, and historical documents.

## Goals / Non-Goals

**Goals:** Read original Markdown directly, retain repository-relative relationships, discover navigation from files, show honest empty states, and validate rendered links.

**Non-Goals:** Deploying a documentation service, importing application Vite configuration, changing application architecture, or promoting an active change's delta into canonical specs before review/integration.

## Decisions

### Use the repository as VitePress's source directory

Keep configuration at `docs-site/.vitepress/config.ts` and use VitePress's supported `srcDir: '../'`. Include only Architecture Markdown, OpenSpec specs/changes, `CONTEXT.md`, and small site index pages through source exclusions derived from the top-level structure. Keep documentation URLs aligned with repository paths; rewrite only `docs-site/index.md` to the site root. Disable application public assets and discovery of the application Vite config.

This reads Markdown in place with normal VitePress development watching. No symlinks, generated mounts, or committed copies are needed; all filesystem paths resolve relative to configuration. Alternatives: symlinks introduce traversal/realpath concerns; generated copies require a watcher and synchronization; one include-wrapper per document duplicates the document inventory. The supported source-directory setting avoids those moving parts.

### Discover navigation and lightweight index content from disk

A small presentation helper enumerates Markdown recursively and deterministically under the authoritative directories, using headings and repository-relative paths. It separates active changes from `archive/`. Minimal wrappers render the discovered spec/change lists and empty states; they own no requirement or architecture content. Navigation is refreshed on restart/build; ordinary existing document edits use VitePress HMR. Adding/removing/renaming documents or changing sidebar titles requires a restart during development.

Alternative: manually list every spec/change in configuration. That would drift and make configuration define documentation structure.

### Adapt links only during rendering

Keep original documentation-to-documentation paths intact. A Markdown presentation hook sends links to existing files outside the rendered set (code, ADRs, history, YAML) to `ochowei/querytube` on `main`. Missing repository targets must fail validation rather than silently become external URLs. Public API gets a small reference wrapper linking directly to the authoritative YAML on GitHub, requiring no generated API copy.

Alternative: edit every original link to use site URLs. That would reduce GitHub readability and make authoritative sources depend on the presentation layer.

### Label all change routes independently

Inject a prominent planning warning before content on every `openspec/changes/` page, including nested spec deltas and archived records, and put the same warning on change index pages. Use separate Architecture, Specifications, Changes, and Reference navigation. Never infer current architecture from change status or task checkboxes.

### Keep infrastructure separate from application architecture

Add only `docs:*` scripts and a VitePress dev dependency to the existing Bun setup. Place output/cache under ignored `.vitepress` directories. No application runtime or deployment unit changes, domain terminology changes, or contract changes are introduced; therefore no architecture-view or glossary update is required.

## Risks / Trade-offs

- [Empty canonical spec collection cannot demonstrate an existing canonical spec] → Show an explicit empty state, test discovery with isolated fixtures, and verify the real new spec delta only under Changes; do not invent canonical content.
- [Root source discovery accidentally publishes unrelated Markdown/assets] → Exclude all unrelated top-level sources and non-architecture docs, disable public-directory copying, and verify built page inventory.
- [Source-code links are not local documentation routes] → Resolve existing non-rendered targets to GitHub `main`, preserving source Markdown and fragments.
- [New/renamed documentation is absent from a running sidebar] → Document restarting `docs:dev`; rebuild always discovers the current tree.
- [Existing Mermaid fences are displayed as code by stock VitePress] → Preserve the source diagrams without modifying them; diagram rendering can be a separate presentation enhancement.

## Migration Plan

Install the development dependency with Bun, add the isolated configuration and presentation wrappers, then validate OpenSpec, documentation links, and existing application commands. No deployment or data migration is needed. Rollback removes documentation presentation/configuration and reverts package/lockfile changes. Leave this change active for review and normal post-integration archive/spec synchronization.
