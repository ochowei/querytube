# Code View

This view connects logical domain responsibilities to their current source locations and describes the main physical module boundaries. For actors and external systems, see the [System View](system-view.md); for C4 Containers and Components, see the [Software View](software-view.md); for bounded contexts, see the [Domain View](domain-view/README.md) and [Context Map](domain-view/context-map.md); for runtime nodes, see the [Deployment View](deployment-view.md).

## Physical / Module Structure

```text
src/
├── main.tsx, App.tsx       React bootstrap and application coordinator
├── context/, firebase.ts   browser auth and Firebase setup
├── components/             feature views and presentation
├── utils/                  authenticated HTTP helper and YAML validation
└── types/                  internal models and independent publicApi.ts DTOs

server/
├── app.ts                  Express app, routes, auth and search orchestration
├── youtubeCredentials.ts   credential lifecycle, crypto, UID cache and REST storage
├── firestoreService.ts     shared persistence, public projections, and caches
├── publicApi.ts            legacy/v1 routers with shared Search Run handlers
├── publicApiMapper.ts      explicit Search Run v1 projections
├── firebaseAdmin.ts        Admin SDK and runtime configuration
├── yamlValidator.ts        parsed YAML validation
└── dev.ts                  local Vite/Express startup and listener

api/index.ts                Vercel Function adapter
openapi/                    published public HTTP contract
tests/                      Node unit, credential routes/SSE, public contract and docs tests
```

The source is organized by runtime and technical module, not one directory per bounded context. `server/app.ts` and `server/firestoreService.ts` currently span multiple logical responsibilities. `api/index.ts` and `server/dev.ts` are entrypoints around the same Express app rather than separate application implementations.

## Domain-to-Code Mapping

The statuses describe the current implementation boundary and are not quality scores. They indicate where a logical responsibility is visibly grouped in source, not whether the design is good or bad.

| Domain | Responsibility | Current code locations | Boundary status | Known coupling |
|---|---|---|---|---|
| [Identity and Access](domain-view/contexts/identity-and-access.md) | Establish Firebase identity and scope protected operations to the verified UID. | `src/context/AuthContext.tsx`, `src/firebase.ts`, `src/utils/authenticatedFetch.ts`, `src/App.tsx`, `server/app.ts`, `server/firebaseAdmin.ts`, `firestore.rules` | `MIXED` | Browser session, token refresh, per-user UI coordination, server verification, and direct-client authorization span browser, server, and infrastructure files. |
| [YouTube Credential Management](domain-view/contexts/youtube-credentials.md) | Verify, encrypt, persist, retrieve, and remove a user's YouTube API key. | `server/youtubeCredentials.ts`, `server/app.ts`, `server/firebaseAdmin.ts`, `src/App.tsx`, `src/components/ApiKeySettings.tsx`, `firestore.rules` | `PARTIAL` | Server key lifecycle, crypto, YouTube verification, user-token Firestore REST calls, and the plaintext per-UID cache have a cohesive module. HTTP/auth handling and browser UI remain in their layers; credential persistence still bypasses `FirestoreService`. |
| [Query Management](domain-view/contexts/query-management.md) | Validate YAML search definitions and manage saved Query Sets. | `src/utils/yamlValidator.ts`, `server/yamlValidator.ts`, `src/App.tsx`, `src/components/YamlEditor.tsx`, `src/components/SaveQuerySetModal.tsx`, `src/components/QueriesView.tsx`, `server/app.ts`, `server/firestoreService.ts`, `src/types/index.ts` | `MIXED` | Browser text parsing and server parsed-object validation are separate; route handlers live in `server/app.ts`; storage and public projections share `FirestoreService`. |
| [YouTube Search](domain-view/contexts/youtube-search.md) | Execute YAML queries against YouTube and return JSON or SSE results. | `src/App.tsx`, `src/components/QueryStatusList.tsx`, `src/components/YamlViewer.tsx`, `src/components/VideoCardsPreview.tsx`, `src/utils/yamlValidator.ts`, `server/app.ts`, `server/yamlValidator.ts`, `server/firestoreService.ts` | `MIXED` | UI request/progress handling, validation, concurrency, YouTube calls, result mapping, and Search Run writes meet in `App.tsx` and `server/app.ts`. |
| [Search History](domain-view/contexts/search-history.md) | Persist, list, load, update, and delete Search Runs and their nested outcomes/videos. | `src/App.tsx`, `src/components/HistoryView.tsx`, `src/components/SearchRunDetailModal.tsx`, `server/app.ts`, `server/firestoreService.ts`, `src/types/index.ts` | `MIXED` | Search execution creates and updates history directly; routes and persistence share broad modules; process-local caches sit beside Firestore-backed reads. |
| [Public Read API](domain-view/contexts/public-read-api.md) | Serve anonymous projections for explicitly published Query Sets and Search Runs. | `server/publicApi.ts`, `server/publicApiMapper.ts`, `server/firestoreService.ts`, `server/app.ts`, `openapi/public-api.yaml`, `src/components/QueriesView.tsx`, `src/components/HistoryView.tsx`, `src/components/ApiDocsView.tsx`, `src/types/publicApi.ts` | `PARTIAL` | Independent public DTOs and Search Run mappers isolate the wire shape; authoritative filtering still shares `FirestoreService` with owner persistence, and publication controls remain in private routes. |

`ALIGNED` can describe a responsibility with a principally identifiable implementation boundary; `PARTIAL` a boundary that covers only part of the responsibility; `MIXED` responsibility spread across or combined within modules; and `LEGACY` a retained implementation not serving as the current owner. The current map uses `MIXED` and `PARTIAL`; no context is currently marked `ALIGNED` or `LEGACY`.

## Boundary notes

- `src/components/SearchWorkspace.tsx` owns transient panel collapse state and accessible controls; it keeps hidden children mounted. `src/App.tsx` retains YAML, Search Request/SSE, Query Set, and Search Result state and composes Execution Monitor inside the result panel. `src/index.css` bounds the desktop Search shell and panel flex chain, preserves stacked narrow-screen flow, and contains supplemental notices/feedback. `YamlEditor.tsx` separates scrolling input/help/validation feedback from its action toolbar and synchronizes its gutter to the textarea; `YamlViewer.tsx` keeps export controls outside raw YAML/card scrolling, with raw YAML and line numbers sharing a scroll container. `QueryStatusList.tsx` keeps its existing capped list outside Search; within the workspace, execution feedback uses the monitor scroller.

- `server/app.ts` owns the API composition, protected route handlers, HTTP input/response handling, YouTube search execution, and Search Run orchestration. Credential settings, status aliases, and search lookup delegate to `server/youtubeCredentials.ts`. The search route calls `FirestoreService` directly for run lifecycle and child-result writes.
- `FirestoreService` covers Query Set operations, Search Run lifecycle/details/deletion, public reads and DTO projections, Firestore conversion, and process-local maps. Query Set/Search Run lists and public reads use Firebase Admin SDK; several owner writes and individual/detail reads use Firestore REST with the user's ID token.
- `server/youtubeCredentials.ts` owns YouTube Credential Management through `getUserYouTubeApiKey`, `configureUserYouTubeApiKey`, and `removeUserYouTubeApiKey`. Crypto, verification, the single per-UID session cache, and credential Firestore REST field representations stay inside that module. It uses the existing project/database configuration and user token rather than `FirestoreService`. `server/app.ts` retains compatibility re-exports of the existing crypto helpers/type; routes use only the lifecycle APIs.
- Credential persistence remains best effort: configuration caches the key before awaiting REST PATCH; removal evicts before REST DELETE. Storage failures are absorbed, and a success response does not guarantee a durable write or deletion. Credential read/decryption failures still resolve as an absent key.
- Search Run child-result and summary writes are awaited by the search route, but persistence helpers can catch and log Firestore failures. A completed JSON/SSE response therefore does not prove every history document was persisted.
- The browser and server each have YAML validation code. This is a current source boundary; it does not establish that their accepted YAML rules are identical.
- `openapi/public-api.yaml` is loaded by `server/app.ts` and exposed as `/openapi.json` and `/api-docs/`; the React `ApiDocsView` also fetches `/openapi.json`.
- `server/app.ts` mounts the legacy public router at `/api/public` and the v1 Search Run router at `/api/v1/public`. Both use `registerPublicSearchRunRoutes` in `server/publicApi.ts`, existing service/mappers, and the same module-level per-IP limiter map. Query Set definition list/detail remain in the legacy router. Existing UI-generated URLs continue working as direct JSON responses.
- Independent public DTOs in `src/types/publicApi.ts` do not derive from domain types; `src/types/index.ts` re-exports existing public type names for import compatibility. `FirestoreService` checks persisted visibility before calling the explicit Search Run mappers. Contract tests validate both prefixes against the YAML, compare alias responses/statuses/visibility and shared limiting, and retain a baseline of established fields.
- New external Search Run consumers should use v1 URLs. Legacy Search Run paths are documented as deprecated aliases without a removal date; removal requires a separate OpenSpec change, migration guidance and period, and explicit release/deprecation notice. Breaking contracts require a new major URL version while retaining v1 during migration. The authoritative policy is in OpenAPI.
- Domain-to-code mapping records where logical responsibilities live today. It does not imply that those responsibilities should become separate services, packages, directories, or deployment units.
