# Domain-to-Code Map

This is the bridge between the logical model in [Domain Map](../domain-map.md) and the implementation in [Current Architecture](current.md). `ALIGNED`, `PARTIAL`, `MIXED`, and `LEGACY` are descriptive labels, not quality scores. Most logical contexts are not independent source modules today.

## Summary

| Domain | Responsibility | Current code locations | Boundary status | Known coupling |
|---|---|---|---|---|
| Identity and Access | Establish signed-in identity and scope protected requests by UID. | `src/context/AuthContext.tsx`, `src/firebase.ts`, `src/utils/authenticatedFetch.ts`, `src/App.tsx`, `server/app.ts`, `server/firebaseAdmin.ts`, `firestore.rules` | `MIXED` | Browser session, token refresh, application state, server verification, and UID scoping span browser/server/infrastructure files. |
| YouTube Credential Management | Verify, encrypt, persist, retrieve, and remove a user's YouTube API key. | `server/app.ts`, `server/firebaseAdmin.ts`, `src/App.tsx`, `src/components/ApiKeySettings.tsx`, `server/firestoreService.ts` (shared data layer), `firestore.rules` | `MIXED` | Key lifecycle, crypto, YouTube validation, Firestore REST, route handlers, UI, and process cache are combined across layers; persistence bypasses `FirestoreService`. |
| Query Management | Validate YAML search definitions and manage saved Query Sets. | `src/utils/yamlValidator.ts`, `server/yamlValidator.ts`, `src/App.tsx`, `src/components/YamlEditor.tsx`, `src/components/SaveQuerySetModal.tsx`, `src/components/QueriesView.tsx`, `server/app.ts`, `server/firestoreService.ts`, `src/types/index.ts` | `MIXED` | Separate browser/server validators; Query Set route handlers are in the main API file; storage methods share a service with Search Runs and Public Read API. |
| YouTube Search | Execute YAML queries against YouTube and return JSON/SSE results. | `src/App.tsx`, `src/utils/yamlValidator.ts`, `server/app.ts`, `server/yamlValidator.ts`, `server/firestoreService.ts` | `MIXED` | UI request/progress handling, validation, concurrency, external API calls, result mapping, and Search Run persistence meet in `App.tsx` and `server/app.ts`. |
| Search History | Persist and manage Search Runs and nested query/video results. | `src/App.tsx`, `src/components/HistoryView.tsx`, `src/components/SearchRunDetailModal.tsx`, `server/app.ts`, `server/firestoreService.ts`, `src/types/index.ts` | `MIXED` | Search execution creates and updates history directly; route handlers, persistence, cache, detail reconstruction, and UI workflows are split across broad files. |
| Public Read API | Serve anonymous projections for explicitly published Query Sets and Search Runs. | `server/publicApi.ts`, `server/firestoreService.ts`, `server/app.ts`, `openapi/public-api.yaml`, `src/components/QueriesView.tsx`, `src/components/HistoryView.tsx`, `src/components/ApiDocsView.tsx`, `src/types/index.ts` | `PARTIAL` | Routes are in a dedicated router, but flag changes live with private CRUD routes and projection/filter logic shares `FirestoreService` with owner persistence. |

## Identity and Access

### Logical owner

[Identity and Access](../domains/identity-and-access.md) owns Firebase session interpretation and authenticated UID scope.

### Current implementation

`src/context/AuthContext.tsx` observes auth state and provides Firebase actions. `src/firebase.ts` initializes the browser SDK. `src/utils/authenticatedFetch.ts` adds the bearer token and one refresh retry. `server/app.ts` exports `requireAuth`; `server/firebaseAdmin.ts` initializes Admin Auth; `firestore.rules` handles direct client authorization.

### Boundary observations

Identity behavior is not one module. `src/App.tsx` coordinates per-user data loading, clears user-specific UI state on UID changes, and supplies callbacks that bind API requests to the expected UID. Server route handlers combine token verification with domain use cases. The public router does not use `requireAuth`; it relies on its separate publication checks.

### Change risk

Changes to sign-in, token refresh, or UID switching can affect every protected feature and stale-response handling. Changes to server auth middleware can change access for all `/api` routes that use it. Inspect the route middleware list and Firestore rules together.

## YouTube Credential Management

### Logical owner

[YouTube Credential Management](../domains/youtube-credentials.md) owns a user's YouTube key lifecycle and its safe availability to search.

### Current implementation

`server/app.ts` holds AES-GCM helpers, the YouTube key test request, direct Firestore REST persistence, decryption, and `userSessionKeyMap`. The routes are in the same file. `src/App.tsx` coordinates status/save/delete requests; `ApiKeySettings.tsx` presents the form.

### Boundary observations

Key persistence bypasses `FirestoreService`; encryption and integration-specific REST field encoding live beside all application routes. The process cache stores plaintext and is separate from persisted state. Persistence helpers catch errors, and the save flow puts the key in memory before writing Firestore.

### Change risk

Changes can affect authenticated search, existing encrypted documents, key verification/quota behavior, and warm/cold instance behavior. Preserve the AES-GCM payload fields and Firestore path unless data compatibility is deliberately addressed.

## Query Management

### Logical owner

[Query Management](../domains/query-management.md) owns YAML search-definition rules and saved Query Sets.

### Current implementation

The browser validator and samples are in `src/utils/yamlValidator.ts`; server validation is in `server/yamlValidator.ts`. Query Set routes are in `server/app.ts`; persistence and public projections are in `server/firestoreService.ts`. `src/App.tsx` owns save/load/rename/delete/publication workflows and `QueriesView.tsx` displays saved sets.

### Boundary observations

The browser parses YAML text and the server validates an already parsed object in two separate implementations. Query Set write routes verify `rawYaml` is a string but do not invoke the search validator. `FirestoreService` mixes owner CRUD with public projection reads. The `defaults.type` field appears in model/sample YAML but search execution fixes video type.

### Change risk

Validation changes can affect both editor feedback and server acceptance. Query Set field changes can affect search loading, public DTO mapping, and the UI. The public flag also changes anonymous exposure; inspect both the private toggle route and public read filters.

## YouTube Search

### Logical owner

[YouTube Search](../domains/youtube-search.md) owns execution semantics and result delivery.

### Current implementation

The browser run action and SSE parser are in `src/App.tsx`. `server/app.ts` handles YAML parsing/validation, key lookup, concurrency, YouTube HTTP requests, JSON/SSE responses, output YAML, and history writes. The server validator is in `server/yamlValidator.ts`; query outcome storage uses `server/firestoreService.ts`.

### Boundary observations

Search execution and Search History lifecycle are intertwined: the same route creates the run, writes child results/videos, and finalizes the summary. JSON and SSE flows duplicate much of this orchestration. The UI contains substantial request and stream-state behavior inside the top-level app component.

### Change risk

Search changes can affect YouTube API parameters, key handling, request duration, SSE event ordering, Search Run status/counts, stored result shape, and browser progress state. Review `src/App.tsx`, the complete `/api/youtube/search` route, and `FirestoreService` writes together.

## Search History

### Logical owner

[Search History](../domains/search-history.md) owns the retained run, its child outcomes/videos, and run visibility.

### Current implementation

Owner routes are in `server/app.ts`. `server/firestoreService.ts` creates runs, writes query results/videos, updates summaries/visibility, lists/loads details, reconstructs YAML, and deletes descendants. Shared DTOs are in `src/types/index.ts`; UI behavior is in `src/App.tsx`, `HistoryView.tsx`, and `SearchRunDetailModal.tsx`.

### Boundary observations

Run summary and detail data are cached in process-local maps. Owner detail reads use Firestore REST and reconstruct nested results; public detail reads use an Admin SDK loader. Writes and reads for this context are therefore not isolated behind one storage implementation. Search execution directly calls persistence methods.

### Change risk

Changes can affect Search completion, history sorting/limits, detail reconstruction, recursive deletion, public projection, and legacy stored fields. Preserve `querySetId`/`querySetName` as optional snapshots; Query Set deletion does not cascade to runs.

## Public Read API

### Logical owner

[Public Read API](../domains/public-read-api.md) owns anonymous routing, public projections, and the published HTTP contract; Query Sets and Search Runs retain ownership of their publication fields and data.

### Current implementation

`server/publicApi.ts` defines anonymous routes and rate limiting. It delegates reads to `server/firestoreService.ts`, which uses Admin SDK and builds DTOs. Publication toggles are in `server/app.ts`. `openapi/public-api.yaml` describes the contract; the React views display public URLs and `ApiDocsView` renders the spec.

### Boundary observations

The router file is a partial code boundary. The service it calls combines public reads with authenticated persistence and caches. Public Query Set and Search Run projections are separate code paths inside that service. Vercel/local deployment routing is infrastructure, not this context.

### Change risk

Changes can expose private YAML/results or break consumer schemas. For visibility changes, inspect the owner toggle path, Admin SDK filter, detail 404 behavior, and OpenAPI at the same time. The current rate limiter is per Function/process instance.

