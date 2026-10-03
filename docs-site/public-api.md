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
