# Tasks

## 1. Documentation infrastructure

- [x] 1.1 Add VitePress as a Bun development dependency, preserve existing scripts, add docs development/build/preview commands, and ignore site output/cache; verify installation and lockfile consistency.

## 2. Source presentation and navigation

- [x] 2.1 Add isolated VitePress configuration, direct cross-directory rendering, discovered sidebar/index navigation, change warnings, and source-link adaptation; verify a documentation build with strict internal link checking and focused routing/discovery tests, including nested canonical spec and archive fixtures.
- [x] 2.2 Add a concise README documentation-development section explaining commands, authoritative sources, and navigation refresh; verify commands match package scripts and confirm that no architecture-view update is required for this infrastructure-only change.

## 3. Integrated verification

- [x] 3.1 Add and run built-site validation for section navigation, every internal page/fragment link, change warnings, source-page inventory, and API source link; verify real Architecture, active change list/spec delta, glossary, and API reference, explicitly recording the currently empty canonical spec collection.
- [x] 3.2 Run OpenSpec validation and the existing lint, tests, and application build; review the final diff for application/runtime/deployment changes and leave the change active for review.

## Validation record

- Bun installed VitePress 1.6.4; `bun install --frozen-lockfile` passed. All pre-existing locked package versions remain present; Bun adjusted dependency hoisting for shared packages.
- `bun run docs:build` passed with strict dead-link checking.
- `bun run docs:check` validated 28 HTML pages and 1,320 internal links/fragments, section navigation, source inventory, planning warnings, and the authoritative API link.
- `bun run lint`, `bun run test` (20 tests), and `bun run build` passed. The application build reported warnings about its existing `__dirname` use and bundle size.
- `openspec validate add-documentation-site --strict` and `git diff --check` passed.
- Live dev and preview smoke checks returned HTTP 200 for 14 section-route requests. A temporary original-glossary edit appeared in the dev server; the file was restored exactly afterward. Browser navigation to System View rendered successfully.
- There is no canonical OpenSpec spec yet: the real documentation-site spec delta is rendered under Changes, the canonical Specs index shows an empty state, and isolated tests cover nested canonical spec discovery. No existing source was promoted prematurely.
- No architecture-view update was required: application runtime, deployment, API contract, domain boundaries, and glossary are unchanged. The change remains active for review/integration.
