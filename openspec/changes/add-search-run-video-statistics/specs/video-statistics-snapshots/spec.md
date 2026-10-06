# Spec Delta

## Purpose

Capture YouTube video statistics during Search Runs and retain their historical values.

## ADDED Requirements

### Requirement: Capture statistics during Search Requests

Each Search Run SHALL attempt to capture YouTube statistics for returned Video Results during execution. A snapshot SHALL contain viewCount, likeCount and commentCount as non-negative decimal strings or null when unavailable, and fetchedAt as the UTC timestamp when the statistics response was fetched. JSON, SSE and Output YAML SHALL include available snapshots. Empty results SHALL require no statistics lookup.

#### Scenario: Execute a search with available statistics
- **WHEN** YouTube returns statistics for a Video Result
- **THEN** the Search Run retains its three counts and fetchedAt with that Video Result
- **AND** the execution output includes that snapshot in either JSON or SSE mode

#### Scenario: Missing counts or inaccessible video
- **WHEN** YouTube omits a count or does not return a requested video
- **THEN** omitted counts in an available snapshot are null, while an unavailable snapshot is omitted
- **AND** no missing value is fabricated as zero

#### Scenario: Statistics request fails
- **WHEN** statistics fetching times out, fails or returns an invalid response
- **THEN** successful search Video Results remain successful without that snapshot
- **AND** errors do not expose the user's API key

### Requirement: Historical snapshots belong to a Search Run

Recorded snapshots SHALL be retained under the Search Run's Video Results and SHALL NOT be refreshed during history or public reads. Repeated appearances of a video within one run SHALL reuse the same snapshot; a new run SHALL fetch a new snapshot. Existing records without statistics SHALL remain readable without backfill or YouTube calls.

#### Scenario: YouTube counts change after execution
- **WHEN** a run is read after its video's counts change on YouTube
- **THEN** its persisted counts and fetchedAt remain unchanged
- **AND** a new Search Run can record different values without changing the older run

#### Scenario: Read old history
- **WHEN** an owner loads an older Search Run with no statistics
- **THEN** detail and reconstructed Output YAML remain readable
- **AND** Video Results omit statistics without querying YouTube

#### Scenario: Duplicate video across queries
- **WHEN** several queries in a Search Run return the same video
- **THEN** their Video Results retain the same counts and fetchedAt
