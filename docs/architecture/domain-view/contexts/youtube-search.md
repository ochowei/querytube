# YouTube Search

Part of the [Domain View](../README.md). Navigate to the [Context Map](../context-map.md), [System View](../../system-view.md), [Software View](../../software-view.md), [Code View](../../code-view.md), and [Deployment View](../../deployment-view.md).

## Purpose

Turn a valid YAML Search Definition into a Search Result and deliver it to the signed-in user, with progress available as a stream.

## Responsibilities

- Parse and validate the submitted YAML on the server.
- Apply query-level parameters over YAML defaults and call YouTube Data API v3.
- Execute multiple query items with a maximum of three concurrent workers.
- Return either one JSON response or Server-Sent Events (SSE) for start, per-query progress, and completion.
- Convert YouTube response items into Video Results within Query Outcomes and fetch Video Statistics Snapshots during execution.
- Start historical recording and send each Query Outcome to Search History.

## Out of Scope

- Managing the user's Google identity or API key lifecycle.
- Saving or editing reusable Query Sets.
- Owning long-term Search Run browsing and deletion.
- Publishing results to anonymous consumers.

## Ubiquitous Language

Shared product terms follow the [canonical glossary](../../../../CONTEXT.md).

- **Search Request**: a request to execute a YAML Search Definition, with optional Query Set association.
- **Query Outcome**: success with zero or more Video Results, or failure, for one Query.
- **Search Result**: the request-level output made up of Query Outcomes and a summary.
- **SSE event**: a JSON event carried over a streaming HTTP response.

## Core Concepts

Executing a Query sends its search instruction to the YouTube search endpoint, then enriches returned videos through `videos.list(part=statistics)`. This describes a process rather than a separate shared domain entity.

- `QueryConfig` and `YamlDefaults`.
- `QuerySuccessResult` / `QueryErrorResult`.
- JSON and SSE response modes for `/api/youtube/search`.

## Business Rules / Invariants

- Search requires a verified Firebase identity and a configured YouTube API key for that UID.
- The server parses and validates YAML before creating the Search Run or calling YouTube.
- Search parameters resolve from each query first, then YAML defaults, then executor defaults (`max_results: 10`, `order: relevance`, `safe_search: moderate`). The request currently fixes YouTube `type` to `video`.
- Statistics are requested in batches of at most 50 IDs using the owner's key. A request-scoped promise cache reuses snapshots for repeated videos across concurrent queries; new Search Runs fetch independently. `fetchedAt` records when the statistics response was decoded, not the Search Run start time.
- Counts are decimal strings or null when unavailable. Missing videos and failed statistics requests leave snapshots absent without turning successful searches into failures. Empty searches do not request statistics.
- No more than three query executions are active in the server's concurrency runner at once.
- Query failures are retained alongside successful outcomes; the final status is `completed` if none failed, `partial` if at least one succeeded and one failed, or `failed` if all failed.
- A search may use unsaved YAML; `querySetId` and `querySetName` are optional association metadata.

## Inputs

- Authenticated UID and ID token.
- Raw YAML and optional Query Set association.
- The user's decrypted YouTube API key.
- YouTube search responses or request errors.

## Outputs

- JSON containing `runId`, `outputYaml`, and result data, or SSE events (`start`, `query_start`, `query_success`, `query_error`, `fatal_error`, `complete`).
- Query Outcomes and their Video Results plus final counts/status for Search History.

## Dependencies

- Identity and Access for authenticated requests.
- YouTube Credential Management for the key.
- Query Management for the YAML language; the request can also be independent of saved Query Sets.
- YouTube Data API v3 for search results.
- Search History for durable execution records and result persistence.

## Related Code

- [YouTube query execution](../../../../server/youtubeSearch.ts) and [run-scoped statistics fetching](../../../../server/youtubeStatistics.ts).
- [Search validation and execution routes](../../../../server/app.ts).
- [Server YAML validator](../../../../server/yamlValidator.ts) and [browser validator](../../../../src/utils/yamlValidator.ts).
- [Search Run/result persistence](../../../../server/firestoreService.ts).
- [Search UI, request handling, and SSE event parsing](../../../../src/App.tsx).
- [Progress and result views](../../../../src/components/QueryStatusList.tsx), [YAML output view](../../../../src/components/YamlViewer.tsx), and [video cards](../../../../src/components/VideoCardsPreview.tsx).

## Related Specifications

No BDD feature files or search-specific ADRs were found. `openapi/public-api.yaml` specifies the anonymous read API, not the authenticated YouTube search endpoint.
