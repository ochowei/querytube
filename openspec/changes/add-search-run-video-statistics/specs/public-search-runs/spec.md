# Spec Delta

## Purpose

Expose recorded Video Statistics Snapshots as an optional addition to the stable v1 contract.

## ADDED Requirements

### Requirement: Optional historical statistics in v1

Public Search Run detail SHALL expose available snapshots at queryResults[].videos[].statistics through v1 and legacy aliases. When present, statistics SHALL contain viewCount, likeCount and commentCount as decimal strings or null, and fetchedAt as a date-time string. Unavailable snapshots SHALL be omitted. Existing fields, requiredness, types, routes, visibility, summary and list semantics SHALL remain unchanged. OpenAPI SHALL document this additive contract.

#### Scenario: Read a run with recorded statistics
- **WHEN** an anonymous client retrieves a Public Search Run through either prefix
- **THEN** available statistics match persisted historical counts and fetchedAt
- **AND** both prefixes return equivalent detail responses

#### Scenario: Read a legacy run or use an existing v1 client
- **WHEN** a run has no statistics or a consumer uses only established v1 video fields
- **THEN** the response remains valid and established fields are usable unchanged
- **AND** consumers tolerate omitted optional properties and unknown additive fields

#### Scenario: Projection isolation
- **WHEN** internal snapshot records contain unrelated properties
- **THEN** public statistics include only the four documented fields
