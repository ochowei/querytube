# Design

## Context

The fetched main baseline is `fc24013`. `stabilize-public-search-run-contract` is implemented and validated but unarchived; it formalizes v1 at legacy URLs and explicitly defers URL migration. Its historical delta remains intact. A new change isolates this additive URL decision. Canonical OpenSpec specs are empty, so the new delta introduces `public-api-url-versioning` rather than modifying a nonexistent canonical specification.

`server/app.ts` mounts `createPublicApiRouter` at `/api/public`. Five anonymous GET operations exist; only the three Search Run operations need v1 aliases. Their handlers call authoritative `FirestoreService` reads and explicit public mappers. The module-level IP limiter is shared per process. OpenAPI YAML supplies `/openapi.json`, Swagger at `/api-docs/`, and the React API documentation viewer.

## Goals / Non-Goals

**Goals:** Explicit stable v1 URLs; unchanged legacy behavior and links; shared handlers and limiter state; identical statuses, schemas, parameters, and visibility; clear consumer migration and deprecation policy.

**Non-Goals:** Versioning Query Set definition endpoints, new DTO fields, pagination, persistence/authentication changes, distributed limiting, external consumer edits, major router architecture, deployment, or archiving pending changes.

## Decisions

### Reuse Search Run route registration

Extract the existing three registrations into one private `registerPublicSearchRunRoutes(router, firestoreService)` function in `server/publicApi.ts`. The legacy factory retains its Query Set routes and limiter, then calls that function. A small v1 factory installs the same limiter and calls the same function. Export a v1 mount constant alongside the existing legacy constant; production and HTTP tests mount those factories identically.

Both factories execute the same handler definitions and application logic. The shared module-level limiter retains one IP budget across both prefixes, preventing alias switching from granting another 100 requests. Each request passes the limiter once. No redirect, version-dependent mapping, or Query Set publication check is introduced.

### Publish additive URLs without changing schemas

Advance the OpenAPI contract to 1.1.0 for additive paths. Preserve all legacy operation IDs and add distinct `V1` IDs for new operations. Add full v1 operations following the existing YAML structure, reusing component schema references; keep parameters/responses equivalent. Mark only the three corresponding legacy Search Run operations `deprecated: true`. Query Set definition operations remain supported at legacy URLs and are outside this migration. YAML remains authoritative; existing Swagger and JSON loading require no new documentation pipeline.

### Deprecation and breaking changes

New external Search Run consumers should use `/api/v1/public/...`. Legacy Search Run URLs remain supported backward-compatible aliases with no removal date. Removal requires a separate OpenSpec change, consumer migration guidance and period, and explicit release/deprecation notice. Breaking changes require a new major URL version; v1 must remain stable and available during migration. Deprecation metadata does not cause redirects or runtime rejection.

### Verify both contracts through HTTP

Extend existing real-router/real-service tests with fake Admin storage to compare both routes at the same fixture state, validate both against OpenAPI, and check list/detail/convenience responses. Compare live JSON bodies across aliases rather than snapshots. Exercise list limit/filter behavior, public access independent of private/deleted Query Sets, private/absent detail 404, visibility revocation and list exclusion, 503 after prior reads, and 429 on every route. Alternate prefixes within one 100-request limiter budget. Protect legacy IDs, unique new IDs, parameter/response equivalence, deprecation metadata, and production mount composition.

## Risks / Trade-offs

- [Two documented path sets drift] → Compare parameters/responses in contract tests and route both through one registration function.
- [Aliases bypass limiting] → Share the existing limiter map and test mixed-prefix consumption.
- [Completed older change still describes the previous URL decision] → Preserve its history and explicitly record the newer additive policy here and in current architecture/OpenAPI.
- [No Firebase credentials in cloud] → Run fake-storage HTTP/unit tests and all available static/build/docs/OpenSpec checks; report live storage/deployment validation as unperformed without changing application behavior.

## Migration Plan

Deploy through the normal application workflow after validation. Consumers can adopt v1 incrementally; legacy links continue returning the same JSON directly. No data/configuration migration or removal date is needed. Rollback reverts additive routing/docs only. Leave this change unarchived for review and normal integration.
