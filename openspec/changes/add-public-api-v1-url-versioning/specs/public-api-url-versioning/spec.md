# Spec Delta

## ADDED Requirements

### Requirement: Explicit v1 Search Run URLs

The Public Read API SHALL provide anonymous GET operations at `/api/v1/public/users/{userId}/search-runs`, `/api/v1/public/users/{userId}/search-runs/{runId}`, and `/api/v1/public/users/{userId}/query-sets/{querySetId}/search-runs`. These SHALL use the existing stable public JSON contract, parameters, list ordering and limit behavior.

#### Scenario: External consumer selects v1
- **WHEN** an anonymous consumer lists or retrieves Public Search Runs through any of the three v1 paths
- **THEN** it receives the same documented contract as the corresponding legacy path
- **AND** detail Video Results remain at `queryResults[].videos[]`

### Requirement: Backward-compatible aliases and shared logic

The corresponding `/api/public/...` Search Run paths SHALL remain functional aliases without redirects. Both prefixes SHALL use shared Search Run handler/application logic and the same process-local per-IP rate-limit budget. Existing Query Set definition routes and UI/shared links SHALL remain functional.

#### Scenario: Compare aliases
- **WHEN** list, detail, or Query Set Search Run list requests use identical parameters and persisted state through both prefixes
- **THEN** their status codes and JSON responses are equivalent

#### Scenario: Switch prefixes near the rate limit
- **WHEN** one IP consumes its 100-request budget through a mixture of legacy and v1 requests
- **THEN** subsequent requests through either prefix return the same documented 429 error shape

### Requirement: Preserve visibility and failure behavior

Both prefixes SHALL check authoritative Search Run visibility independently of Query Set publication or existence. Private or absent details SHALL return 404, lists SHALL exclude private runs, and storage failures SHALL return 503 without cached public fallback.

#### Scenario: Public run belongs to a private or deleted Query Set
- **WHEN** either prefix lists or retrieves the public run associated with that Query Set
- **THEN** access is permitted without consulting Query Set publication

#### Scenario: Revoke visibility or request absent detail
- **WHEN** a run becomes private or a requested run does not exist
- **THEN** both detail paths return equivalent 404 responses
- **AND** both list variants exclude private runs

#### Scenario: Authoritative storage becomes unavailable
- **WHEN** storage reads fail, including after successful previous reads
- **THEN** list, detail, and Query Set Search Run list return equivalent 503 error responses through both prefixes

### Requirement: Authoritative documentation and deprecation policy

`openapi/public-api.yaml` SHALL publish the explicit v1 Search Run paths as the current preferred version, retain legacy operations with their existing operation IDs and deprecated metadata, and document continued backward-compatible support without a removal date. New external Search Run consumers SHOULD use `/api/v1/public/...`. Legacy removal SHALL require a separate OpenSpec change, migration guidance and period, and explicit release/deprecation notice. Breaking contract changes SHALL require a new major URL version while preserving v1 during migration.

#### Scenario: Consumer reads API documentation
- **WHEN** the consumer reads YAML, `/openapi.json`, Swagger, or Public API documentation
- **THEN** the preferred v1 paths and supported deprecated aliases are documented with the same parameters and response schemas

#### Scenario: Propose removal or incompatible evolution
- **WHEN** legacy removal or a breaking contract change is proposed
- **THEN** it proceeds through a separate OpenSpec change and an explicit migration/deprecation process
- **AND** breaking changes are not silently applied to v1

### Requirement: Credential-free equivalence verification

Contract tests SHALL validate both prefixes against OpenAPI and compare list/detail/Query Set Search Run list responses, public visibility, private/absent 404, storage 503, and rate-limit 429 without requiring live Firebase credentials or full-response snapshots.

#### Scenario: Route or documentation drifts
- **WHEN** either prefix changes an established response, status, visibility rule, parameter, or schema independently
- **THEN** contract validation or alias equivalence tests fail
