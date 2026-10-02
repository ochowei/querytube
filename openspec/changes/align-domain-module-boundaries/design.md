# Design

See [proposal.md](proposal.md) for the motivation and intended scope. There are no behavior-spec deltas because the change is limited to internal source organization.

## Context

The current implementation is organized around runtime and technical modules:

- `src/App.tsx` coordinates browser state, authenticated API calls, YAML validation, and search/SSE behavior; `src/components/` contains feature views and presentation.
- `server/app.ts` contains the Express application, authentication middleware, routes, YouTube credential lifecycle, YouTube search execution, and Search Run orchestration.
- `server/firestoreService.ts` handles Query Set and Search Run persistence, public projections, Firestore conversion, and process-local caches.
- `server/publicApi.ts` is a separate anonymous read router, while public access controls remain in protected routes in `server/app.ts`.
- `api/index.ts` adapts the Express app to Vercel Functions; `server/dev.ts` starts the same app for local development.

The [Software View](../../../docs/architecture/software-view.md), [Domain View](../../../docs/architecture/domain-view/README.md), and [Code View](../../../docs/architecture/code-view.md) describe the current structure and logical responsibilities. They remain the source for current architecture; this change proposes possible future work only.

## Goals / Non-Goals

**Goals:**

- Reduce mixed implementation responsibilities when a concrete feature change provides a useful extraction point.
- Make ownership and interactions between logical responsibilities easier to locate in source.
- Preserve current behavior and keep architecture documentation synchronized with the resulting code.

**Non-Goals:**

- A big-bang rewrite or an immediate reorganization of every module.
- Microservices, additional deployables, separate databases, or a new deployment topology.
- A one-to-one mapping between bounded contexts and C4 Components, directories, packages, services, or runtime units.
- Creating empty abstractions such as `QueryService`, `SearchService`, or `HistoryService` before an actual change demonstrates their value.
- Changing route contracts, Firestore paths or fields, authorization semantics, encryption compatibility, YAML behavior, or JSON/SSE behavior.

## Decisions

### Extract in response to concrete change pressure

Keep existing code in place until a feature change exposes a repeated coupling or a responsibility that can be moved with a clear benefit. At that point, make the smallest behavior-preserving extraction and keep the resulting module cohesive. Module names may follow responsibilities such as identity/access, YouTube credentials, Query Sets, search execution, Search Runs, public reads, or infrastructure, but the repository is not required to create one module for every bounded context.

Alternative considered: create a complete set of context-named modules before feature work requires them. This is rejected because it would add abstractions without evidence that each boundary improves change isolation.

### Preserve one Express application and its deployment shape

Keep `server/app.ts` as the application composition point while route handlers or workflows move only where that reduces real coupling. Keep the React/Vite browser application, Express API application, Vercel adapter, and local development entrypoint as they are unless another reviewed change explicitly changes them.

Alternative considered: split the Express API into separately deployed services. This is out of scope because the proposal is about source ownership and does not establish a need for additional runtime units.

### Make persistence and authorization seams explicit

If `FirestoreService` is split, move only the operations whose ownership and callers form a useful boundary. Preserve the existing distinction between Firebase Admin SDK access and Firestore REST calls authenticated with the user's ID token. Keep owner checks, public visibility filtering, Firestore document paths, and field representations intact.

Alternative considered: introduce one repository per entity or bounded context. This is not required; a split should follow real access patterns and change ownership rather than naming symmetry.

### Preserve contracts during internal moves

Before an extraction, identify the affected route behavior and response shape, OpenAPI contract, Firestore access paths, credential encryption payload, YAML validation expectations, and JSON/SSE lifecycle. Keep these stable for this change. Any proposed observable behavior change needs its own reviewed OpenSpec change and corresponding spec delta.

Alternative considered: combine an extraction with contract cleanup. Defer that work to a separate reviewed change so internal movement can be evaluated independently.

### Update views from implemented structure

After an extraction, update the Code View's physical structure and Domain-to-Code Mapping, and update the Software View only when the implemented C4 Component structure changes. Keep Domain View boundaries logical; do not infer a module boundary from a bounded context name.

Alternative considered: copy the proposed module organization into current architecture documents before it exists. This is rejected because those viewpoints describe code on `main`.

## Risks / Trade-offs

- [Incremental extraction leaves other responsibilities mixed in `server/app.ts` or `server/firestoreService.ts`] → Accept the transitional state until a later concrete change justifies another narrow move.
- [Moving persistence or route logic changes authorization modes, error handling, or partial-write behavior] → Record the affected access path and failure behavior before each move, then validate them afterward.
- [Moving either YAML validator silently changes accepted inputs] → Keep browser and server validation expectations visible and verify the moved code against the existing focused tests.
- [New modules add indirection without improving change isolation] → Extract only where current callers and a concrete change provide a cohesive seam.

## Migration Plan

Apply this plan only when a concrete feature change selects an extraction:

1. Record the current behavior and source callers at the chosen seam.
2. Move one cohesive responsibility while retaining the existing Express application, Firestore representation, and request semantics.
3. Run the relevant focused tests and project validation for that implementation change; review affected routes and storage paths.
4. Update the Code View and, if the actual C4 component structure changed, the Software View.
5. Deploy through the existing local, preview, and production topology. Since this change introduces no data migration or contract change, rollback is to revert the extraction commit.
