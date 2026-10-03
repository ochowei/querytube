# Tasks

## 1. Define and implement additive URL versioning

- [x] 1.1 Inspect fetched main, completed stable contract, OpenSpec workflow, router, handlers, DTO/mappers, tests, OpenAPI/Swagger, and architecture; record the decision to create a separate change.
- [x] 1.2 Extract shared Search Run registrations and add v1 routing without changing JSON, visibility, legacy Query Set routes, or limiter behavior.
- [x] 1.3 Publish preferred v1 OpenAPI operations and deprecated legacy Search Run aliases with matching parameters/responses and a non-dated migration policy.
- [x] 1.4 Extend credential-free contract tests for both prefixes, limit/filter/visibility equivalence, private/absent 404, storage 503, and shared-budget 429.
- [x] 1.5 Update Public API documentation and affected architecture views; verify statements against resulting source.

## 2. Verify before completion

- [x] 2.1 Run typecheck/lint, all unit/contract tests, application build, docs build/link validation, strict OpenSpec validation, and diff checks; record outcomes and environment limitations.
- [x] 2.2 Review scope and compatibility; report environment-dependent checks and leave changes unarchived.

## Verification evidence

- Baseline: refreshed remote main and switched the clean checkout from `work` to local `main` tracking `origin/main` at `fc24013`. The completed `stabilize-public-search-run-contract` change is present and remains unchanged/unarchived. This change is also left unarchived.
- `npx --no-install tsc --noEmit` and `npm run lint` passed; the repository lint script is the TypeScript typecheck and does not define a separate ESLint check.
- `npm test` passed 64/64 tests with zero skips, including 11 public contract tests and 2 mapper tests. Two contract tests were added (OpenAPI alias metadata/equivalence and production app/OpenAPI JSON/Swagger composition); existing HTTP tests now compare both prefixes for list/detail/convenience, limits/filtering, private/deleted Query Set associations, current visibility/revocation, absent/unset-visibility records, absent owners, 404/503, and a mixed-prefix 100-request budget followed by 429 for all three routes. No full-response snapshots were introduced.
- `npm run build`, `npm run docs:build`, and `npm run docs:check` passed. Documentation validation covered 39 HTML pages and 2,274 internal links/fragments plus inventory/navigation/planning warnings. Application build retains existing Vite native-config and large-chunk warnings.
- The cloud default runtime is Node 24.19.0. The repository targets Node 22; lint/typecheck, all 64 tests, application build, docs build, and docs link checks also passed under Node 22.23.3 supplied temporarily through npm's Node package. No package/lockfile/runtime configuration was changed.
- `OPENSPEC_TELEMETRY=0 npm_config_cache=/tmp/querytube-npm-cache npx --yes @fission-ai/openspec@latest validate --all --strict` passed all 4 active changes. `git diff --check` passed. The CLI cache is confined to `/tmp`; no repository tooling dependency was added.
- A direct comparison against baseline OpenAPI verified that all component schemas, legacy operation IDs, parameters, and responses are unchanged, with exactly three new paths. Both prefixes share the same Search Run registration function and the original module-level limiter map. DTOs, mappers, Firestore service/schema, Firebase configuration, UI links, and external repositories are unchanged.
- HTTP tests use deterministic fake Admin reads for the real service; the production composition smoke test stubs service reads and fetches the actual `/openapi.json` and Swagger initialization. No live Firebase credentials were required or fabricated. Live Firestore connectivity, actual-record visibility/security, and deployed Firebase/Vercel end-to-end validation were not run because the cloud environment has no configured Firebase credentials. No repository tests were skipped.
- No breaking change: existing URLs continue returning direct JSON with the same visibility, shape, parameters, and status semantics. The OpenAPI version moves from 1.0.1 to 1.1.0 for additive URLs; only legacy Search Run deprecation metadata/policy changes. Removal is unscheduled and requires OpenSpec, migration guidance/period, and explicit release/deprecation notice; breaking changes require a new major URL version.
