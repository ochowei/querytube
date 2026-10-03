# Proposal

## Why

External consumers such as notebooklm-yt need an explicit URL version for the stable Public Search Run contract. Main at `fc24013` already contains the completed, unarchived `stabilize-public-search-run-contract` implementation: independent public DTOs/mappers, OpenAPI 1.0.1, and credential-free contract tests. That change deliberately retained unversioned URLs; this separate additive change introduces URL versioning without reopening its completed scope.

## What Changes

- Add `/api/v1/public/users/{userId}/search-runs`, its `/{runId}` detail path, and `/api/v1/public/users/{userId}/query-sets/{querySetId}/search-runs`.
- Keep the corresponding `/api/public/...` paths as backward-compatible aliases with identical JSON, status codes, access rules, parameters, and a shared rate-limit budget.
- Share Search Run route registration and existing service/mapper logic across both prefixes.
- Publish v1 Search Run paths as the preferred OpenAPI contract; mark their legacy operations deprecated while preserving operation IDs and documenting continued support without a removal date.
- Protect equivalence with credential-free HTTP contract tests and update Public API and architecture documentation.

## Capabilities

### New Capabilities

- `public-api-url-versioning`: Explicit v1 Search Run URLs, legacy aliases, route equivalence, and deprecation policy.

### Modified Capabilities

- `public-search-runs`: Clarify that retained unversioned paths are backward-compatible aliases of the preferred explicit v1 URLs. This canonical capability is established by archiving the completed stable contract dependency first; the original implementation baseline had no canonical specifications. Its historical delta remains unchanged.

## Impact

Touches public router composition, OpenAPI paths/policy, contract tests, and affected documentation. Existing UI/shared URLs continue working. No response schema, pagination, visibility, Firestore/Firebase configuration, credentials, NotebookLM integration, external repository, deployment, or broad routing refactor is in scope. Query Set definition list/detail endpoints remain at their existing paths.
