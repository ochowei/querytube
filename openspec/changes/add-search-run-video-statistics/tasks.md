# Tasks

## 1. Capture and record snapshots

- [x] 1.1 Define the snapshot model/glossary, implement run-scoped YouTube enrichment and JSON/SSE integration; add fetch/orchestration tests and update YouTube Search/code architecture documentation; verify search snapshot tests pass.
- [x] 1.2 Persist nested snapshots and restore them through REST, Admin and Output YAML paths; add round-trip, legacy and immutability tests and update Search History documentation; verify persistence tests pass.

## 2. Evolve Public API v1

- [x] 2.1 Add explicit optional public snapshot DTO/projection and OpenAPI schema; add mapper/HTTP/legacy-client compatibility tests and update public API and architecture documentation; verify contract tests pass.

## 3. Integration verification

- [x] 3.1 Run the complete test suite, TypeScript checks, application build, documentation checks/build and strict OpenSpec validation; review the diff and record results without commit, push, deploy or archive.

## Verification results

- `npm test`: 77/77 passed, including JSON/SSE capture, durable nested-map round trips, cold REST/Admin history reads, immutable older runs, v1/legacy alias equivalence and existing client projections.
- `npm run lint`, `npm run build`: passed. Build retains Vite configuration/chunk-size warnings.
- `npm run docs:build` followed by `npm run docs:check`: passed (51 pages and 3589 internal links/fragments).
- `openspec validate add-search-run-video-statistics --strict`, `git diff --check`: passed.
- External YouTube, Firestore and Firebase authentication are mocked; no live credentials or production calls were used. HTTP tests require a localhost listener.
- Base: latest fetched origin/main `73b2a64`. Changes remain uncommitted and unarchived for review; no push or deployment.
