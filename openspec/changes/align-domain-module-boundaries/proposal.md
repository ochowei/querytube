# Proposal

## Why

The current implementation places several logical responsibilities together in `server/app.ts` and `server/firestoreService.ts`, making changes across QueryTube capabilities harder to isolate. An incremental, behavior-preserving path can clarify source ownership when a concrete change selects a cohesive extraction seam, without turning logical domain boundaries into mandatory deployable or package boundaries.

## What Changes

- Apply the incremental approach to one selected seam: YouTube Credential Management currently embedded in `server/app.ts`.
- Extract key verification, encryption/decryption, the per-UID session cache, and user-token Firestore credential operations into `server/youtubeCredentials.ts`, with high-level lookup, configure, and remove APIs.
- Keep Express routes, HTTP input/response handling, authentication, and search orchestration in `server/app.ts`; add focused regression tests.
- Keep the current React/Vite web application and Express API deployment shape.
- Preserve existing external behavior and data contracts while any internal extraction is made.
- Update the Code View and Domain-to-Code Mapping as actual source boundaries change.
- Defer other domain extractions to later concrete changes; do not introduce a module per bounded context.

## Capabilities

### New Capabilities

None. This change concerns internal source organization and does not add system behavior.

### Modified Capabilities

None. There are no current OpenSpec behavior specs to modify, and this proposal does not change observable behavior. The change opts out of spec deltas with `skip_specs: true` in `.openspec.yaml`.

## Impact

The selected extraction touches `server/app.ts`, adds `server/youtubeCredentials.ts` and focused tests, and synchronizes Code View, Software View, and credential source references in Domain View. Firebase runtime configuration remains in `server/firebaseAdmin.ts`; browser code, other domains, Public Read API, API contracts, Firestore schema, dependencies, and deployment configuration remain unchanged. This is internal production-source reorganization with no new observable behavior.
