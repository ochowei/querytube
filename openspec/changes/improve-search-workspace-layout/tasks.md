# Tasks

## 1. Search workspace presentation

- [x] 1.1 Implement bounded responsive panels, collapse/restore controls, contained execution feedback, and YAML scrolling with aligned gutters; verify with a credential-free browser regression fixture covering large input/output, primary actions, collapse state, keyboard access, cards, feedback, and desktop/mobile resize.
- [x] 1.2 Update Code View and Software View to describe the resulting presentation boundary and verify the documentation against source.

## 2. Integrated verification

- [x] 2.1 Run existing Node tests, TypeScript check, application build, documentation checks/build, and strict OpenSpec validation; record results and inspect desktop/mobile screenshots and short-window behavior before completing the change.

## Verification record

- Base: latest origin/main `e110d33`, fast-forwarded from a clean checkout on 2026-10-05.
- `npm test`: 64/64 passed. HTTP tests required loopback permission; the initial sandbox run failed with `listen EPERM`, then the unrestricted local run passed.
- `npm run lint`, `npm run build`, and `git diff --check`: passed. Build retains Vite's existing config-loader and large-chunk warnings.
- `npm run docs:build` followed by `npm run docs:check`: passed (46 HTML pages and 3,014 internal links/fragments). The initial check saw stale generated documentation before the rebuild.
- `openspec validate improve-search-workspace-layout --strict`: passed.
- `tests/browser/search-workspace.mjs`: passed with bundled Playwright and existing Chromium. Covered 2,402 input lines, 6,000 output lines, 120 card groups, 1,200 execution entries, independent scrolling and aligned gutters, Copy/Download byte equality, keyboard collapse, both panels collapsed, restored scroll/tab/input state, running/cancel availability, and empty/invalid/missing-key states. Actual App/Header and Search SSE composition were exercised with mock auth/API responses, including 1,200 completion events and navigation away from/back to Search with retained input/results. The final run had no console or page errors.
- Viewports: desktop 1440x900, 1280x720, 1024x768; short window 1440x480; narrow widths 320, 390, 768, and 1023; desktop/mobile resizing with collapsed panels. Inspected desktop/mobile, collapse, cards/monitor, short-window, and crowded help/validation/setup screenshots. Final crowded App check also covers the manual Validate notice at 1024x720.
- No real Firebase session or YouTube request was used by the runner. No commit, push, or deployment. Change remains completed and unarchived for review, following existing completed active-change precedent; canonical spec synchronization belongs to later finalization.
