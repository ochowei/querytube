# Search History

## Purpose

Retain completed and in-progress search executions so an owner can inspect, rerun from saved input, change public visibility, or delete past work.

## Responsibilities

- Store a Search Run summary and its input YAML.
- Store one Query Result per executed YAML query and nested video records.
- Track run status, query/result counts, timestamps, and optional Query Set association.
- List runs, load full details, reconstruct output YAML, change visibility, and recursively delete a run and its subcollections.
- Provide public summaries/details for runs that the owner marked public.

## Out of Scope

- Calling YouTube Data API or deciding how the search is executed.
- Owning saved Query Set content or its publication setting.
- Owning the identity provider.

## Ubiquitous Language

- **Search Run**: one invocation of a search request, whether based on a saved Query Set or unsaved YAML.
- **Query Result**: the success or failure record for one source YAML query.
- **Stored video**: normalized YouTube video data nested under a Query Result.
- **Visibility**: the Search Run's own `private` or `public` setting.
- **Output YAML**: a normalized representation reconstructed from the stored run, query outcomes, and videos.

## Core Concepts

- `SearchRun`: run ID, optional Query Set ID/name, status, counts, input YAML, timestamps, visibility.
- `QueryResultItem`: source query, success/failure, count, error fields, execution times, videos.
- `StoredVideoItem`: YouTube video identifiers, title, channel metadata, publication time, description, URL, and thumbnail.
- Firestore path `users/{uid}/searchRuns/{runId}/queryResults/{queryResultId}/videos/{videoId}`.

## Business Rules / Invariants

- Every authenticated Search Run is stored below its owner's UID.
- A new Search Run starts with status `running` and defaults to private visibility.
- Run visibility is independent of the referenced Query Set's `publicApiEnabled` flag.
- Deleting a Query Set does not delete the Search Runs that refer to it; the run stores its optional Query Set ID/name as association data.
- Deleting a Search Run recursively removes its query-result and video documents.
- Public Search Run reads require the run's own `visibility` to be `public`; the referenced Query Set need not still exist or be public.

**Observed persistence caveat:** query-result/video writes and summary updates catch and log failures in the orchestration path. The stream/JSON response can complete even when an individual Firestore persistence call did not succeed. Firestore service caches are process-local and are not durable history.

## Inputs

- Search Run creation data and per-query outcomes from YouTube Search.
- Verified UID and ID token for owner reads and writes.
- Owner changes to run visibility or deletion requests.
- Firestore records when loading history/details.

## Outputs

- Owner-scoped Search Run summaries and details.
- Reconstructed output YAML.
- Public run summaries/details when the run itself is public.
- Updated run status, visibility, and deletion results.

## Dependencies

- YouTube Search creates the run before executing queries, then submits per-query outcomes and a final summary.
- Identity and Access supplies the owner UID for protected operations.
- Firestore stores the run hierarchy.
- Public Read API exposes filtered projections but does not own run facts.

## Related Code

- [Search Run HTTP routes and execution orchestration](../../server/app.ts).
- [Search Run, query result, video persistence, history reads, and deletion](../../server/firestoreService.ts).
- [Shared Search Run and result types](../../src/types/index.ts).
- [History list and detail UI](../../src/components/HistoryView.tsx), [run detail modal](../../src/components/SearchRunDetailModal.tsx), and [application handlers](../../src/App.tsx).

## Related Specifications

No BDD feature files or Search History ADRs were found. The [Public API OpenAPI specification](../../openapi/public-api.yaml) describes the anonymous projections, not the owner-only history API.

