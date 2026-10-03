# Spec Delta

## MODIFIED Requirements

### Requirement: Preserve existing v1 paths

The Public Read API SHALL retain the existing `/api/public/...` user Search Run list/detail paths and Query Set Search Run list convenience path as backward-compatible aliases of the stable v1 contract. These paths SHALL remain anonymous and SHALL NOT require existing consumers to migrate to a version prefix. New Search Run consumers SHOULD use the corresponding `/api/v1/public/...` URLs, which SHALL expose the same contract and access semantics.

#### Scenario: Existing consumer requests a Search Run
- **WHEN** an anonymous consumer calls `GET /api/public/users/{userId}/search-runs/{runId}` for a Public Search Run
- **THEN** the response is 200 with the documented detail object
- **AND** no migration to `/api/v1/...` is required

#### Scenario: New consumer selects the explicit v1 URL
- **WHEN** a new consumer chooses a public Search Run list, detail, or Query Set Search Run list endpoint
- **THEN** the documented preferred URL uses `/api/v1/public/...`
- **AND** corresponding legacy URLs remain compatible aliases without redirects or a scheduled removal date
