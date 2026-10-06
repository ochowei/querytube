# Public API

The [OpenAPI YAML contract](../openapi/public-api.yaml) is the authoritative machine-readable Public API contract. It defines paths, parameters, schemas, and responses.

Public API **v1** is the current stable Search Run version. New external consumers, including notebooklm-yt, should use:

```text
GET /api/v1/public/users/{userId}/search-runs
GET /api/v1/public/users/{userId}/search-runs/{runId}
GET /api/v1/public/users/{userId}/query-sets/{querySetId}/search-runs
```

The corresponding `/api/public/...` Search Run URLs remain supported backward-compatible aliases. Both prefixes return the same JSON contract directly, use the same visibility rules, and share the per-process IP rate-limit budget. Existing UI and shared links continue working. Query Set definition list/detail URLs remain at `/api/public/...`.

Legacy Search Run operations are marked deprecated in OpenAPI, with **no scheduled removal date**. Any future removal requires a separate OpenSpec change, migration guidance and period, and an explicit release/deprecation notice. Breaking contract changes require a new major URL version; v1 remains available during migration. Compatible additions can evolve within v1 under the YAML compatibility policy.

The running application exposes the same contract as `/openapi.json` and Swagger at `/api-docs/`.

For architectural context, see [Public Read API](../docs/architecture/domain-view/contexts/public-read-api.md). This documentation site does not change API behavior or replace the YAML contract.

## Historical video statistics

Contract version **1.2.0** adds an optional `statistics` object to each Video Result
at `queryResults[].videos[]`. Both v1 and legacy URLs expose the stored snapshot:

```json
{
  "statistics": {
    "viewCount": "9007199254740993",
    "likeCount": "0",
    "commentCount": null,
    "fetchedAt": "2026-10-06T02:00:00.000Z"
  }
}
```

Counts are non-negative decimal **strings**, preserving YouTube count precision.
A `null` count means YouTube did not provide a valid value; it does not mean zero.
`fetchedAt` records when the statistics response was fetched during execution, in
UTC. It is distinct from video publication time and Search Run start time.

Snapshots are historical: reading a run never refreshes them. A new Search Run
fetches a new snapshot. Repeated videos within a run reuse the same snapshot.
Older runs, inaccessible videos and failed statistics requests omit `statistics`;
there is no backfill. A failed enrichment request leaves successful search results
successful. Available snapshots also appear in owner history, search JSON/SSE
results and Output YAML (with the same nested camel-case fields).

This is an additive v1 change. Existing required fields, routes, visibility and
list semantics are preserved. Clients should tolerate unknown response fields and
absent optional snapshots. There is no live-statistics endpoint or comment-content
fetching. Search adds `videos.list(part=statistics)` calls, batched up to 50 IDs and
deduplicated within each run. History child writes retain the existing best-effort
behavior; execution completion alone does not guarantee every Firestore write.
