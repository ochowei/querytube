# Public Read API

Part of the [Domain View](../README.md). Navigate to the [Context Map](../context-map.md), [System View](../../system-view.md), [Software View](../../software-view.md), [Code View](../../code-view.md), and [Deployment View](../../deployment-view.md).

## Purpose

Let owners share selected Query Sets and Search Runs through a stable, anonymous, read-only HTTP API.

## Responsibilities

- Serve public Query Set summaries and details.
- Serve public Search Run summaries and details.
- Enforce Query Set publication or Search Run visibility before returning the corresponding public projection.
- Apply request parameter limits and the current per-IP in-memory rate limiter.
- Maintain the documented external JSON contract.

## Out of Scope

- Owning Query Set contents or deciding the owner's Query Set `publicApiEnabled` value.
- Owning Search Run contents or deciding the owner's Search Run `visibility` value.
- Any public write, search-execution, account, or credential operation.
- Authentication of owners; consumers can call this API anonymously.

## Ubiquitous Language

Shared product terms follow the [canonical glossary](../../../../CONTEXT.md).

- **Public Query Set**: a Query Set whose owner has enabled anonymous read access through the Public Read API.
- **Public Search Run**: a Search Run whose own visibility is public, whether or not its associated Query Set still exists or is public.
- **Public projection**: the explicit DTO returned to an anonymous caller, rather than a raw Firestore document.
- **Consumer**: an anonymous HTTP client using the published API.

## Core Concepts

- Query Set summary and detail projections.
- Search Run summary and detail projections.
- Read-only OpenAPI contract.
- Public API v1 Search Run operations use `/api/v1/public/...`; corresponding `/api/public/...` paths remain supported deprecated aliases with identical JSON and access semantics. Query Set definition list/detail remain at their existing unversioned URLs. OpenAPI defines the contract and compatibility policy.
- New external Search Run consumers should use v1 URLs. No legacy removal date is scheduled. Future removal requires a separate OpenSpec change, migration guidance and period, and explicit release/deprecation notice; breaking contract changes require a new major URL version, keeping v1 available during migration.

## Business Rules / Invariants

- Public Query Set lists/details require `publicApiEnabled === true`.
- Search Run lists/details require the Search Run's own `visibility === 'public'`, independently of its Query Set.
- A public Search Run does not require its Query Set to exist or be public.
- Public list endpoints return projections. Query Set summaries omit `rawYaml`; a Query Set detail includes it. Search Run list responses omit input YAML and video lists; details include the documented run/query/video fields.
- Search Run lists use `{ items }`, newest `startedAt` first, default limit 50 and maximum 100. They offer no cursor or full-history enumeration guarantee.
- Detail Video Results remain at `queryResults[].videos[]`, with required `videoId`, `url`, and string `title` (possibly empty). There is no flat `results` field or separate results endpoint. Optional properties may be omitted or null as specified in OpenAPI; consumers tolerate unknown added fields.
- Internal record fields, Output YAML, persistence paths, per-query/video ordering, video uniqueness, and the identifier's encoding are not public guarantees. All existing fields documented in OpenAPI remain part of v1, including fields beyond the minimum needed by source-import consumers.
- The routers share one 100-request-per-IP-per-minute budget per process instance across legacy and v1 prefixes. This is not a distributed/global limit.

## Inputs

- Anonymous GET requests with owner UID and resource IDs in the URL.
- Optional Search Run list parameters (`limit`, `querySetId`).
- Current Query Set and Search Run records from Firestore.

## Outputs

- JSON public DTOs described by OpenAPI.
- 404 when a resource is absent or not public, 429 when the local limiter rejects a request, and 503 when authoritative Firestore reads fail. Prior cached public data does not replace those reads.

## Dependencies

- Query Management for Query Set data and publication flags.
- Search History for Search Run data and visibility.
- Firebase Admin Firestore reads; public access does not use the caller's Firebase token.
- OpenAPI document and anonymous API consumers.

## Related Code

- [Public route handlers and in-memory rate limit](../../../../server/publicApi.ts).
- [Admin Firestore reads and visibility filtering](../../../../server/firestoreService.ts), [Search Run public mappers](../../../../server/publicApiMapper.ts), and [independent public DTO types](../../../../src/types/publicApi.ts).
- [Query Set publication and Search Run visibility controls](../../../../server/app.ts) and [API documentation UI](../../../../src/components/ApiDocsView.tsx).
- [OpenAPI specification](../../../../openapi/public-api.yaml).

## Related Specifications

- The [OpenAPI 3.1 YAML](../../../../openapi/public-api.yaml) is the detailed machine-readable contract and remains authoritative for paths, parameters, schemas, and responses.
- [Public contract tests](../../../../tests/publicApiContract.test.ts) validate the real anonymous router and service with fake authoritative storage; [mapper tests](../../../../tests/publicApiMapper.test.ts) protect projection boundaries. These tests do not establish live Firebase connectivity.
- No BDD feature files or Public Read API ADRs were found.
