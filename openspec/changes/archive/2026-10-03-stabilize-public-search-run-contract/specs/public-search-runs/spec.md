# Spec Delta

## Purpose

Provide anonymous consumers with a stable, versioned contract for explicitly shared Search Runs and their recorded Video Results, independent of internal history models.

## ADDED Requirements

### Requirement: Preserve existing v1 paths

The Public Read API SHALL define the existing `/api/public/...` paths as v1. It SHALL retain user Search Run list/detail paths and the Query Set Search Run list convenience path without requiring a version prefix or authentication token.

#### Scenario: Existing consumer requests a Search Run
- **WHEN** an anonymous consumer calls `GET /api/public/users/{userId}/search-runs/{runId}` for a Public Search Run
- **THEN** the response is 200 with the documented detail object
- **AND** no migration to `/api/v1/...` is required

### Requirement: Stable summaries and bounded lists

Search Run lists SHALL return `{ items: PublicSearchRunSummary[] }`, newest `startedAt` first, filtered by the run's own visibility and optional Query Set association. The default limit SHALL be 50, clamped to 1–100 after integer parsing, with invalid input falling back to 50. v1 SHALL NOT promise cursor pagination, total counts, or snapshot consistency.

#### Scenario: Filter by a deleted or private Query Set
- **WHEN** either list path requests an association with a Query Set that is private or no longer exists
- **THEN** matching public runs are returned without consulting Query Set publication
- **AND** summaries omit input YAML and Query Results

#### Scenario: Limit a list
- **WHEN** the consumer supplies no limit, a non-numeric limit, or an out-of-range limit
- **THEN** the existing default or clamping behavior is preserved
- **AND** the response contains only `items`, with no required cursor metadata

### Requirement: Stable recorded Video Results

Search Run detail SHALL retain the OpenAPI-required fields and nested `queryResults[].videos[]` shape. Each Video Result SHALL provide string `videoId`, `url`, and `title`; title MAY be empty when unavailable. v1 SHALL preserve other existing documented fields and optional nullable metadata, without exposing additional internal fields automatically.

#### Scenario: Extract YouTube sources
- **WHEN** a consumer fetches a Public Search Run
- **THEN** its identifier is `id` and Video Results are under `queryResults[].videos[]`
- **AND** the consumer can use `videoId`, `url`, and `title` without depending on persistence fields or Output YAML
- **AND** duplicate videos across queries and empty arrays are valid

#### Scenario: Read legacy metadata
- **WHEN** a recorded Video Result lacks a title, publication timestamp, or thumbnail
- **THEN** the existing empty-string representation is valid
- **AND** missing stored watch URLs are reconstructed from the video identifier

### Requirement: Authoritative visibility and failures

Public reads SHALL use current persisted visibility, independently of Query Set publication or existence. Absent/private detail SHALL return 404 with `error` and `message`; unavailable storage SHALL return 503 rather than cached public data. Requests rejected by the limiter SHALL return the documented 429 error shape.

#### Scenario: Revoke a previously public run
- **WHEN** the owner changes a previously read run to private
- **THEN** subsequent public detail returns 404 and lists exclude it

#### Scenario: Storage read fails
- **WHEN** authoritative storage is unavailable after a successful public read
- **THEN** the response is 503 with `error` and `message`, without serving the cached run

### Requirement: OpenAPI authority and compatibility policy

`openapi/public-api.yaml` SHALL be the v1 source of truth for wire paths, fields, parameters, responses, and compatibility policy. Compatible evolution SHALL preserve existing valid requests and responses. Breaking changes SHALL require a separate major contract, an OpenSpec change, migration guidance, and an explicit deprecation plan while retaining v1 during migration.

#### Scenario: Add an optional response field
- **WHEN** a new optional field, endpoint, or query parameter preserves existing behavior
- **THEN** it can be added within v1
- **AND** consumers are instructed to tolerate unknown fields and omitted optional fields

#### Scenario: Change an established field or endpoint meaning
- **WHEN** a proposed change removes/renames a field, changes its type or nullability, changes requiredness incompatibly, removes an enum value, restructures a response, or changes access/list semantics
- **THEN** it is treated as breaking and is not silently applied to v1
- **AND** response enum additions require compatibility review for exhaustive consumers

### Requirement: Verify the public wire contract

Credential-free tests SHALL compare public HTTP responses to the authoritative OpenAPI schemas and protect established paths, required consumer fields, statuses, list shape, optional/null behavior, and additive-field tolerance. Tests SHALL verify public projections and visibility without snapshotting entire internal models.

#### Scenario: Internal models gain fields
- **WHEN** internal run, query, or video records acquire unrelated properties
- **THEN** public responses continue to satisfy v1 and do not automatically include those properties

#### Scenario: Contract drift is introduced
- **WHEN** an endpoint or required field no longer matches the v1 OpenAPI contract
- **THEN** the contract tests fail without requiring live Firebase credentials
