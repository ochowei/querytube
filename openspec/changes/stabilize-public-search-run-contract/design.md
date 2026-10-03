# Design

## Context

See proposal.md for motivation. Baseline was refreshed to remote `main` at `8b92d32` after an initial inspection at `b286782`. The intervening commit extracted YouTube Credential Management and left Public Read API routes, projections, and OpenAPI unchanged. Source inspection finds five anonymous GET routes mounted at `/api/public`; three concern Search Runs. OpenAPI already advertises 1.0.0. The UI generates existing unprefixed public links. No external consumer inventory is available in this checkout, so route migration would carry unquantified cost. Canonical OpenSpec specs are empty; existing changes concern documentation and behavior-preserving module boundaries.

FirestoreService already selects run/query/video properties explicitly. Top-level public DTOs nevertheless refer to internal status/visibility and Query Result types. Public errors actually return 503, while OpenAPI says 500. Optional strings use OpenAPI 3.0 `nullable` in a 3.1 document. Legacy video metadata and query timestamps can be empty strings. Lists are capped arrays, not cursor pages. The six existing test files (including credential HTTP/SSE regression tests) do not exercise public responses.

## Goals / Non-Goals

**Goals:** Preserve established wire behavior, make public types independently owned, correct contract drift, and verify anonymous HTTP contracts without credentials.

**Non-Goals:** New result endpoints, flattened `results`, cursor pagination, new fields, global limiting, persistence normalization, major-version infrastructure, or the unrelated pending module refactor.

## Decisions

### Formalize v1 on current URLs

Retain paths, operation IDs, existing required fields, and all selected fields. Advance the contract patch version to 1.0.1 for documentation corrections and formalization. Put normative compatibility policy in the YAML description; architecture documentation links to it rather than duplicating schemas. Moving routes would break generated/shared links without improving model isolation.

### Independent public types and pure projections

Use `src/types/publicApi.ts` for standalone public interfaces and literals; re-export previous public types from `src/types/index.ts` to preserve import compatibility. Extract only existing Search Run mappings to `server/publicApiMapper.ts`. Public methods retain authoritative reads and visibility checks before mapping. Query Set mappings stay in place. Avoid deriving DTOs with `Pick`/`Omit` from domain models or spreading raw nested objects.

### Correct documentation, preserve responses

Use JSON Schema string/null union types. Describe 503 storage failures for all existing public routes. Permit empty string alongside formatted legacy query timestamps, video publication time, and thumbnail URL. Document title as a required string that can be empty, the current limit parsing, and the absence of cursors. Keep watch URL and all other field semantics unchanged; no flat result array is added. The consumer extracts sources from `queryResults.flatMap(q => q.videos)` and deduplicates by videoId if desired.

### Test the actual router with authoritative reads replaced

Reuse the existing Node/tsx test runner, with a small test-only validator for the JSON Schema vocabulary used by this contract. Fail on unsupported validation keywords so constraints cannot be silently ignored. Resolve YAML refs and validate required fields, enums, nulls, array/object shape, formats, and alternatives. Keep a small independent baseline of established endpoint paths and required fields so editing implementation and YAML together does not erase compatibility protection. Accept unknown additive response fields. Exercise the real router and FirestoreService with a deterministic fake Admin Firestore tree, including visibility revocation, URL fallback, missing metadata, unavailable storage, limit/filter ordering, and error responses. Use one exported mount path in production and tests.

## Risks / Trade-offs

- [Manually maintained TypeScript and YAML may diverge] → Response tests enforce schema alignment; public types contain no domain dependencies.
- [Schema corrections widen legacy metadata acceptance] → Preserve actual empty-string behavior and existing requiredness; do not normalize persisted data in this change.
- [No live storage or deployment validation] → Exercise real service mapping with fake snapshots, run all credential-free checks, and report this limit explicitly.
- [List cap cannot enumerate all history] → State no cursor support rather than inventing a pagination guarantee.
- [Current visibility and operational limits can change availability] → Stable contract does not promise permanent sharing, a completed run, unique sources, ordering within results, or a globally exact rate-limit budget.

## Migration Plan

No consumer/data migration is necessary. Existing routes and JSON remain intact. Deploy normal application artifacts after validation; rollback is the ordinary code rollback, with no persistence/configuration changes. Future incompatible semantics require a separately reviewed major contract and explicit coexistence/deprecation plan; do not repurpose the current v1 URLs.
