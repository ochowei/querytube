# Code View

This view connects logical domain responsibilities to their current source locations and describes the main physical module boundaries. For actors and external systems, see the [System View](system-view.md); for C4 Containers and Components, see the [Software View](software-view.md); for bounded contexts, see the [Domain View](domain-view/README.md) and [Context Map](domain-view/context-map.md); for runtime nodes, see the [Deployment View](deployment-view.md).

## Physical / Module Structure

```text
src/
├── main.tsx, App.tsx       React bootstrap and application coordinator
├── context/, firebase.ts   browser auth and Firebase setup
├── components/             feature views and presentation
├── utils/                  authenticated HTTP helper and YAML validation
└── types/                  shared TypeScript models

server/
├── app.ts                  Express app, routes, auth and search orchestration
├── firestoreService.ts     shared persistence, public projections, and caches
├── publicApi.ts            anonymous public API router
├── firebaseAdmin.ts        Admin SDK and runtime configuration
├── yamlValidator.ts        parsed YAML validation
└── dev.ts                  local Vite/Express startup and listener

api/index.ts                Vercel Function adapter
openapi/                    published public HTTP contract
tests/                      Node test files for auth fetch and YAML validation
```

The source is organized by runtime and technical module, not one directory per bounded context. `server/app.ts` and `server/firestoreService.ts` currently span multiple logical responsibilities. `api/index.ts` and `server/dev.ts` are entrypoints around the same Express app rather than separate application implementations.

## Domain-to-Code Mapping

The statuses describe the current implementation boundary and are not quality scores. They indicate where a logical responsibility is visibly grouped in source, not whether the design is good or bad.

| Domain | Responsibility | Current code locations | Boundary status | Known coupling |
|---|---|---|---|---|
| [Identity and Access](domain-view/contexts/identity-and-access.md) | Establish Firebase identity and scope protected operations to the verified UID. | `src/context/AuthContext.tsx`, `src/firebase.ts`, `src/utils/authenticatedFetch.ts`, `src/App.tsx`, `server/app.ts`, `server/firebaseAdmin.ts`, `firestore.rules` | `MIXED` | Browser session, token refresh, per-user UI coordination, server verification, and direct-client authorization span browser, server, and infrastructure files. |
| [YouTube Credential Management](domain-view/contexts/youtube-credentials.md) | Verify, encrypt, persist, retrieve, and remove a user's YouTube API key. | `server/app.ts`, `server/firebaseAdmin.ts`, `src/App.tsx`, `src/components/ApiKeySettings.tsx`, `firestore.rules` | `MIXED` | Key lifecycle, crypto, YouTube validation, user-token Firestore REST calls, route handlers, UI, and a plaintext process cache are combined across layers. Credential persistence bypasses `FirestoreService`. |
| [Query Management](domain-view/contexts/query-management.md) | Validate YAML search definitions and manage saved Query Sets. | `src/utils/yamlValidator.ts`, `server/yamlValidator.ts`, `src/App.tsx`, `src/components/YamlEditor.tsx`, `src/components/SaveQuerySetModal.tsx`, `src/components/QueriesView.tsx`, `server/app.ts`, `server/firestoreService.ts`, `src/types/index.ts` | `MIXED` | Browser text parsing and server parsed-object validation are separate; route handlers live in `server/app.ts`; storage and public projections share `FirestoreService`. |
| [YouTube Search](domain-view/contexts/youtube-search.md) | Execute YAML queries against YouTube and return JSON or SSE results. | `src/App.tsx`, `src/components/QueryStatusList.tsx`, `src/components/YamlViewer.tsx`, `src/components/VideoCardsPreview.tsx`, `src/utils/yamlValidator.ts`, `server/app.ts`, `server/yamlValidator.ts`, `server/firestoreService.ts` | `MIXED` | UI request/progress handling, validation, concurrency, YouTube calls, result mapping, and Search Run writes meet in `App.tsx` and `server/app.ts`. |
| [Search History](domain-view/contexts/search-history.md) | Persist, list, load, update, and delete Search Runs and their nested outcomes/videos. | `src/App.tsx`, `src/components/HistoryView.tsx`, `src/components/SearchRunDetailModal.tsx`, `server/app.ts`, `server/firestoreService.ts`, `src/types/index.ts` | `MIXED` | Search execution creates and updates history directly; routes and persistence share broad modules; process-local caches sit beside Firestore-backed reads. |
| [Public Read API](domain-view/contexts/public-read-api.md) | Serve anonymous projections for explicitly published Query Sets and Search Runs. | `server/publicApi.ts`, `server/firestoreService.ts`, `server/app.ts`, `openapi/public-api.yaml`, `src/components/QueriesView.tsx`, `src/components/HistoryView.tsx`, `src/components/ApiDocsView.tsx`, `src/types/index.ts` | `PARTIAL` | Anonymous routes have a dedicated router, but publication controls remain in private routes and projection/filter methods share `FirestoreService` with owner persistence. |

`ALIGNED` can describe a responsibility with a principally identifiable implementation boundary; `PARTIAL` a boundary that covers only part of the responsibility; `MIXED` responsibility spread across or combined within modules; and `LEGACY` a retained implementation not serving as the current owner. The current map uses `MIXED` and `PARTIAL`; no context is currently marked `ALIGNED` or `LEGACY`.

## Boundary notes

- `server/app.ts` currently owns the API composition, protected route handlers, key encryption/verification, YouTube search execution, and Search Run orchestration. The search route calls `FirestoreService` directly for run lifecycle and child-result writes.
- `FirestoreService` covers Query Set operations, Search Run lifecycle/details/deletion, public reads and DTO projections, Firestore conversion, and process-local maps. Query Set/Search Run lists and public reads use Firebase Admin SDK; several owner writes and individual/detail reads use Firestore REST with the user's ID token.
- YouTube Credential Management has its own route/key functions in `server/app.ts`; its credential document persistence is implemented there through Firestore REST rather than through `FirestoreService`.
- Search Run child-result and summary writes are awaited by the search route, but persistence helpers can catch and log Firestore failures. A completed JSON/SSE response therefore does not prove every history document was persisted.
- The browser and server each have YAML validation code. This is a current source boundary; it does not establish that their accepted YAML rules are identical.
- `openapi/public-api.yaml` is loaded by `server/app.ts` and exposed as `/openapi.json` and `/api-docs/`; the React `ApiDocsView` also fetches `/openapi.json`.
- Domain-to-code mapping records where logical responsibilities live today. It does not imply that those responsibilities should become separate services, packages, directories, or deployment units.
