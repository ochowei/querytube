# Proposal

## Why

Search Runs retain video metadata but cannot show the popularity counts observed during execution. Recording Video Statistics Snapshots makes historical results useful without replacing them with later YouTube values.

## What Changes

- Fetch YouTube video statistics during Search Requests and persist each snapshot with its Video Result.
- Include viewCount, likeCount, commentCount and fetchedAt; represent unavailable counts explicitly without inventing zeroes.
- Expose optional recorded statistics in Public API v1 and its legacy aliases, owner history, JSON/SSE and Output YAML.
- Preserve legacy records and existing v1 fields, paths, visibility and list semantics.
- Add credential-free fetching, persistence and HTTP contract tests and update architecture/API documentation.
- No live-statistics API, comment-content fetching, backfill, UI redesign or new major API version.

## Capabilities

### New Capabilities

- `video-statistics-snapshots`: Capture and retain historical statistics within Search Runs.

### Modified Capabilities

- `public-search-runs`: Add an optional historical statistics projection to recorded Video Results.

## Impact

YouTube search execution/orchestration, shared domain models, Firestore REST conversion and Admin/owner readers, public DTOs/mappers, OpenAPI, glossary, architecture and documentation site. Existing Firestore paths and authorization remain unchanged. No new dependency.
