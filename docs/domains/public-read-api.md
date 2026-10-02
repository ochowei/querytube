# Public Read API

## Purpose

Let owners share selected Query Sets and Search Runs through a stable, anonymous, read-only HTTP API.

## Responsibilities

- Serve public Query Set summaries and details.
- Serve public Search Run summaries and details.
- Enforce the owning context's publication field before returning a public projection.
- Apply request parameter limits and the current per-IP in-memory rate limiter.
- Maintain the documented external JSON contract.

## Out of Scope

- Owning Query Set contents or deciding the owner's Query Set `publicApiEnabled` value.
- Owning Search Run contents or deciding the owner's Search Run `visibility` value.
- Any public write, search-execution, account, or credential operation.
- Authentication of owners; consumers can call this API anonymously.

## Ubiquitous Language

- **Public Query Set**: a Query Set whose `publicApiEnabled` flag is true.
- **Public Search Run**: a Search Run whose own `visibility` is `public`.
- **Public projection**: the explicit DTO returned to an anonymous caller, rather than a raw Firestore document.
- **Consumer**: an anonymous HTTP client using the published API.

## Core Concepts

- Query Set summary and detail projections.
- Search Run summary and detail projections.
- Read-only OpenAPI contract.

## Business Rules / Invariants

- Public Query Set lists/details require `publicApiEnabled === true`.
- Search Run lists/details require the Search Run's own `visibility === 'public'`, independently of its Query Set.
- A public Search Run does not require its Query Set to exist or be public.
- Public list endpoints return projections. Query Set summaries omit `rawYaml`; a Query Set detail includes it. Search Run list responses omit input YAML and video lists; details include the documented run/query/video fields.
- The current router allows 100 requests per IP per minute per process instance. This is not a distributed/global limit.

## Inputs

- Anonymous GET requests with owner UID and resource IDs in the URL.
- Optional Search Run list parameters (`limit`, `querySetId`).
- Current Query Set and Search Run records from Firestore.

## Outputs

- JSON public DTOs described by OpenAPI.
- 404 when a resource is absent or not public, 429 when the local limiter rejects a request, and service errors when Firestore reads fail.

## Dependencies

- Query Management for Query Set data and publication flags.
- Search History for Search Run data and visibility.
- Firebase Admin Firestore reads; public access does not use the caller's Firebase token.
- OpenAPI document and anonymous API consumers.

## Related Code

- [Public route handlers and in-memory rate limit](../../server/publicApi.ts).
- [Admin Firestore reads and public DTO projections](../../server/firestoreService.ts).
- [Query Set and Search Run publication controls](../../server/app.ts), [shared DTO types](../../src/types/index.ts), and [API documentation UI](../../src/components/ApiDocsView.tsx).
- [OpenAPI specification](../../openapi/public-api.yaml).

## Related Specifications

- The [OpenAPI 3.1 YAML](../../openapi/public-api.yaml) is the detailed machine-readable contract and remains authoritative for paths, parameters, schemas, and responses.
- No BDD feature files or Public Read API ADRs were found.

