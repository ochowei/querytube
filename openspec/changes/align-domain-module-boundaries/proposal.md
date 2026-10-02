# Proposal

## Why

The current implementation places several logical responsibilities together in `server/app.ts` and `server/firestoreService.ts`, making changes across QueryTube capabilities harder to isolate. An incremental, behavior-preserving path can clarify source ownership when concrete feature work justifies extraction, without turning logical domain boundaries into mandatory deployable or package boundaries.

## What Changes

- Define a change-driven approach for gradually aligning source modules with logical responsibilities.
- Keep the current React/Vite web application and Express API deployment shape.
- Preserve existing external behavior and data contracts while any internal extraction is made.
- Update the Code View and Domain-to-Code Mapping as actual source boundaries change.
- Treat proposed module names as optional examples, not components that exist today.

## Capabilities

### New Capabilities

None. This change concerns internal source organization and does not add system behavior.

### Modified Capabilities

None. There are no current OpenSpec behavior specs to modify, and this proposal does not change observable behavior. The change opts out of spec deltas with `skip_specs: true` in `.openspec.yaml`.

## Impact

Potential future implementation work may touch `src/App.tsx`, `server/app.ts`, `server/firestoreService.ts`, `server/publicApi.ts`, `server/firebaseAdmin.ts`, and nearby tests. This proposal does not change production code, API contracts, Firestore schema, dependencies, or deployment configuration.
