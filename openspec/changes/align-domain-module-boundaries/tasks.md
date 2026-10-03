# Tasks

## 1. Establish the credential extraction baseline

- [x] 1.1 Select YouTube Credential Management and record its source callers and module boundary in design; verify against `main` source and synchronize proposal before code edits.
- [x] 1.2 Record credential HTTP/auth, encryption, Firestore, cache/failure, status-alias, and missing-key JSON/SSE contracts in design; verify against routes, helpers, and Public Read API scope.
- [x] 1.3 Add focused credential GET/POST/DELETE, payload/cache/failure, and missing-key search HTTP/SSE regression tests; verify they pass against the pre-extraction implementation.

## 2. Make one narrow behavior-preserving extraction

- [x] 2.1 Move credential verification, encryption/decryption, UID cache, and user-token Firestore operations into `server/youtubeCredentials.ts` behind lookup/configure/remove APIs; verify routes use these APIs and local/Vercel entrypoints still compose the same app.
- [x] 2.2 Preserve affected response semantics, auth, payload compatibility, runtime configuration, and cache/persistence ordering; verify the same focused regression tests pass after extraction, with no other-domain changes.
- [x] 2.3 Update Code View, Software View component ownership/edges, and Domain View credential source links/caveat wording; verify documented paths and Mermaid components match the implemented source.

## 3. Verify the integrated result

- [x] 3.1 Run full tests, lint/typecheck, application build, and documentation build/link checks; verify each command succeeds.
- [x] 3.2 Review the final diff and all change artifacts for consistent scope, completed tasks, and absence of observable contract changes; verify `openspec validate align-domain-module-boundaries --strict` succeeds with `skip_specs: true` and leave the change unarchived.

## Verification evidence

- Baseline: `main` at `b286782`; 31 focused credential regression tests passed before and after extraction.
- Node.js 22 / npm 10.9.7: `npm test` passed all 51 tests; `npm run lint` passed the existing `tsc --noEmit` lint/typecheck; `npm run build` succeeded (existing Vite configuration and chunk-size warnings remain).
- `npm run docs:build` and `npm run docs:check` succeeded: 31 HTML pages and 1,555 internal links/fragments validated.
- `openspec validate align-domain-module-boundaries --strict` passed with `skip_specs: true`; no capability deltas were created. Proposal, design, tasks, and architecture views were reviewed against the resulting source.
- `git diff --check` passed. Moved credential helpers match the baseline except lifecycle exports; auth, other domain routes, search execution, and local/Vercel entrypoints remain unchanged. The change is complete and remains unarchived for review.
