# Proposal

## Why

External consumers need a Public Search Run contract that survives internal model changes. The current OpenAPI identifies version 1.0.0, but nested DTOs reuse internal types, error/null/metadata schemas drift from implementation, and no tests protect the public wire contract.

## What Changes

- Formalize the existing `/api/public/...` endpoints as Public API v1 without route migration or response restructuring.
- Define compatibility and future major-version migration rules in the authoritative OpenAPI contract.
- Isolate public Search Run, Query Result, and Video Result types and explicit mappers from internal models, preserving existing fields and values.
- Correct documented 503 responses, OpenAPI 3.1 null types, empty legacy metadata, and existing limit behavior.
- Add credential-free HTTP contract tests against OpenAPI and focused checks for visibility, projections, and optional/additive compatibility.
- Update current architecture documentation to reflect the implemented boundary.

## Capabilities

### New Capabilities

- `public-search-runs`: Stable anonymous Search Run summaries/details, Video Results, access semantics, and version compatibility rules.

### Modified Capabilities

None. The canonical specification collection is currently empty. The completed, unarchived credential-module change preserves contracts, and the documentation-site delta already treats OpenAPI as authoritative; neither establishes this compatibility policy.

## Impact

Touches public DTOs, Search Run projection code, router composition, `openapi/public-api.yaml`, tests, and architecture documentation. Existing URLs (including links produced by the browser UI) and JSON shapes remain compatible. No Firestore schema, authentication, credentials, deployment, NotebookLM integration, or external repository changes are in scope. No new runtime dependencies or pagination infrastructure are planned.
