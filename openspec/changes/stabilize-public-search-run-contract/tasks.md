# Tasks

## 1. Stabilize the public boundary and contract together

- [x] 1.1 Add independent public DTOs and extract existing Search Run mappers without changing response fields; update affected architecture views and verify projections, optional defaults, and non-leakage with focused unit tests and typecheck.
- [x] 1.2 Formalize v1 and compatibility policy in OpenAPI, correct error/null/legacy-format/limit drift, and add schema/baseline/optional-compatibility tests; verify all examples and established public fields against YAML.
- [x] 1.3 Exercise existing mounted HTTP routes with the real router/service and fake Firestore reads; verify statuses, result/list shapes, limit/filter ordering, anonymous access, visibility revocation, storage failures, and convenience path equivalence without credentials.

## 2. Verify the integrated result

- [x] 2.1 Run typecheck/lint, all unit/contract tests, application build, documentation build/link check, and strict OpenSpec validation; record outcomes and any unavailable live Firebase validation.
- [x] 2.2 Review the final diff for unchanged routes/JSON/access semantics and excluded scope; verify the consumer extraction example and report stable fields, limitations, and future breaking-change workflow without archiving this change.

## Verification evidence

- Baseline: local `main` was fast-forwarded from `b286782` to fetched `origin/main` at `8b92d32`; overlapping app/documentation changes preserve the upstream credential extraction. No credential/authentication modules or external repositories were modified.
- `npm run lint` passed the repository's `tsc --noEmit` typecheck. `npm test` passed 62/62 tests with no skips, including 9 new schema/HTTP contract tests and 2 mapper tests. The final optional-field/nested-shape baseline additions were rechecked with all 9 contract tests and typecheck passing.
- All OpenAPI response examples and local references validate against the supported schema vocabulary; unsupported validation keywords cause test failure. Optional omitted/null fields and unknown additive fields are accepted, while missing required IDs, invalid video IDs, private visibility, and invalid populated metadata formats fail.
- HTTP tests exercise the real router/service with fake Admin reads, including video-ID/URL fallback, missing metadata, capped lists, historical associations, visibility revocation, and 404/429/503. Local listener tests required execution outside the filesystem/network sandbox; no live Firebase credentials were used or fabricated.
- `npm run build` passed with the existing Vite native-config and large-chunk warnings. `npm run docs:build` and `npm run docs:check` passed (35 pages, 1,900 links/fragments at the initial integrated check).
- `openspec validate --all --strict` passed all 3 active changes. `git diff --check` passed. The diff preserves all public route strings, operation IDs, existing selected fields, storage paths, and visibility/limit semantics; documentation corrects existing wire drift rather than changing responses.
- The HTTP test extracts `{ videoId, url, title }` via `queryResults.flatMap(...)` and confirms the stable run `id`. The authoritative YAML defines compatibility rules, opaque owner-scoped IDs, no cursor guarantee, empty/duplicate sources, and future major-contract coexistence/deprecation requirements.
- Live Firebase/Firestore, production visibility against actual records, and deployment checks were not run; no existing repository tests were skipped. The completed change remains unarchived, with its delta separate from the still-empty canonical spec collection.
