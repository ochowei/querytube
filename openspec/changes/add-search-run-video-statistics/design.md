# Design

## Context

See proposal.md for motivation. Search execution currently calls search.list in server/app.ts, maps snake-case execution videos to StoredVideoItem and writes query/video documents through Firestore REST. The converter currently handles only scalar fields. Owner detail uses REST (and process-local cache); public detail uses authoritative Admin SDK reads and explicit independent DTO projections. Existing v1 policy permits optional response fields.

## Goals / Non-Goals

**Goals:** preserve execution/history correspondence, precision and legacy read behavior; reuse a video's snapshot within a run; keep credential-free tests realistic.

**Non-Goals:** live reads, comment contents, backfill, changes to visibility/list behavior or existing best-effort history write semantics.

## Decisions

- Add optional statistics to each Video Result, with three required string-or-null counts and required fetchedAt. Decimal strings preserve YouTube unsigned count precision beyond JavaScript safe integers; null distinguishes unavailable from zero. Omit the whole object for older/unavailable snapshots, rather than fabricate timestamps or rewrite old records.
- Call videos.list with part=statistics and comma-separated IDs after search.list. Use batches of at most 50 and the owner's existing key, with 15-second timeout. A per-run promise cache deduplicates concurrent/overlapping queries and expires at the end of the request. Separate runs never share it. Capture fetchedAt after decoding the response.
- Statistics enrichment is best effort: request/network/malformed-response failure omits snapshots and preserves successful search results. A returned statistics object with missing/invalid counters records null for those counters. Missing videos remain search results without snapshots. No credential-bearing error logging.
- Extract query execution to a focused module so fetching can be tested without initializing routes/Firebase. Keep concurrency and orchestration in app.ts. JSON/SSE and reconstructed YAML expose the same nested camel-case statistics object while established metadata stays snake-case in execution/YAML.
- Persist statistics as a nested Firestore map on existing video documents. Extend REST map conversion recursively and map statistics in both readers. Public projection selects each documented field explicitly, including nested fields; summary DTOs do not change.
- Keep OpenAPI v1 paths, operations and required video fields. Add a reusable statistics schema and optional Video.statistics. Extend the test schema validator to enforce count patterns and test against established consumer projections.

## Risks / Trade-offs

- Additional quota and latency → batch IDs and deduplicate only within a run; empty results skip fetching.
- YouTube omits counts/videos or enrichment fails → explicit null counts or absent snapshot; search success remains meaningful.
- Existing history child writes catch failures → retain and document this existing persistence caveat; mocked durable round-trip tests validate successful writes, without claiming live Firestore verification.
- Timestamps differ between batches → fetchedAt is observation time per response, not an atomic YouTube-wide observation or Search Run startedAt.

## Migration Plan

No migration/backfill is needed. Existing scalar fields and document paths stay intact; deploy code and additive contract together after review. Rolling back simply ignores the new stored field. Keep the completed OpenSpec change unarchived for review.
