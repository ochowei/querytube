# Query Management

## Purpose

Define search input in YAML and let an authenticated user save reusable definitions as Query Sets.

## Responsibilities

- Validate YAML syntax and the supported query/default fields for search.
- Represent a query as an ID, search text, and optional YouTube search parameters.
- Create, read, update, rename, publish, and delete a user's Query Sets.
- Keep the raw YAML that the user can load and edit in the search workspace.

## Out of Scope

- Calling YouTube Data API or interpreting returned videos.
- Owning Search Run outcomes or the historical result set.
- Owning Google sign-in or the user's YouTube API key.
- Anonymous API request handling; Query Management owns the Query Set publication setting, while Public Read API applies it.

## Ubiquitous Language

- **YAML search definition**: raw YAML containing a `queries` list and optional defaults.
- **Query**: one YAML item with an ID (`id`) and search text (`q`), plus optional search parameters.
- **Query Set**: a user's named, persisted YAML definition with a cached query count and a `publicApiEnabled` flag.
- **Default**: shared search parameters that a query can override when executed.

## Core Concepts

- `QuerySet`: `id`, `name`, `rawYaml`, `queryCount`, `publicApiEnabled`, and timestamps.
- `QueryItem` / `QueryConfig`: `id`, `q`, optional `max_results`, `order`, locale, date range, and safe-search settings.
- Built-in YAML examples shown by the editor.

## Business Rules / Invariants

- A search YAML root must be a mapping containing a non-empty `queries` list.
- Every query must have a non-empty ID and search text; query IDs are unique after trimming whitespace.
- `max_results` must be an integer from 1 to 50. `order` and `safe_search` must use the enumerated values in the validators.
- Query Sets are stored below `users/{uid}/querySets`; creation defaults `publicApiEnabled` to false.
- Deleting a Query Set deletes that document only; it does not cascade to historical Search Runs.
- Search can run from unsaved YAML. A Query Set reference on a Search Run is optional.

**Boundary observation:** the browser validator parses raw YAML in `src/utils/yamlValidator.ts`; the server has a separate parsed-object validator in `server/yamlValidator.ts`. Query Set create/update routes only check that `rawYaml` is a string; search and UI validation supply the stronger YAML checks. These independent validators can drift.

**Configuration observation:** `defaults.type` appears in the YAML type and built-in examples, while the YouTube executor currently hard-codes `type=video`. The implementation does not currently offer a working non-video type choice.

## Inputs

- Raw YAML and optional Query Set name from the browser.
- Authenticated UID and ID token for persistence.
- `publicApiEnabled` changes from the owner.

## Outputs

- A parsed and validated search definition for the search flow.
- A persisted Query Set and list/detail responses.
- Query Set public summaries/details when `publicApiEnabled` is true, through Public Read API.

## Dependencies

- Identity and Access for ownership and authenticated operations.
- Firestore for persisted Query Sets.
- YouTube Search consumes raw YAML; it does not require that YAML to have been loaded from a Query Set.
- Public Read API consumes Query Set fields to create safe public DTOs.

## Related Code

- [Browser YAML validator and samples](../../src/utils/yamlValidator.ts).
- [Server parsed-YAML validator](../../server/yamlValidator.ts).
- [Query Set routes and search routes](../../server/app.ts).
- [Query Set persistence and public projections](../../server/firestoreService.ts).
- [Search workspace](../../src/App.tsx), [YAML editor](../../src/components/YamlEditor.tsx), and [saved Query Set view](../../src/components/QueriesView.tsx).
- [Shared TypeScript models](../../src/types/index.ts).

## Related Specifications

No BDD feature files or Query Management ADRs were found. The YAML examples in `src/utils/yamlValidator.ts` are executable product examples, not a standalone schema contract.

