# Design

See [proposal.md](proposal.md) for motivation. This change selects one internal extraction; it keeps `skip_specs: true` because no spec-level behavior changes.

## Context

Baseline verified against `main` at `b286782` before implementation:

- `server/app.ts` owns Express composition, authentication, credential crypto/verification/cache/REST operations, Query Set routes, YouTube Search, and Search Run orchestration.
- Credential lookup callers are GET settings, GET `/api/config`, GET `/api/youtube/status`, and POST search. POST settings verifies, encrypts, caches, and persists; DELETE settings evicts and deletes.
- `server/firebaseAdmin.ts` supplies project/database configuration and Firebase Admin authentication. Credential storage uses the user's ID token with Firestore REST, bypassing `FirestoreService`.
- `server/publicApi.ts` and `openapi/public-api.yaml` describe the anonymous Public Read API, not credential settings. No Public Read API contract is affected.
- The Domain View is now [a directory](../../../docs/architecture/domain-view/README.md), not `domain-view.md`. [Code View](../../../docs/architecture/code-view.md) and [Software View](../../../docs/architecture/software-view.md) must track implemented ownership.

## Goals / Non-Goals

**Goals:**

- Isolate the existing credential lifecycle in one cohesive server-side module, so routes and search callers do not know crypto, cache, or Firestore field representations.
- Retain one Express application and the current local/Vercel entrypoints.
- Use focused tests to demonstrate preservation of both successful and failure behavior.

**Non-Goals:**

- Extracting other domains, changing browser UX, Public Read API, deployment units, dependencies, or runtime configuration.
- Introducing repositories, domain service hierarchies, or one module per bounded context.
- Correcting existing best-effort persistence or error handling during this internal move.

## Decisions

### Select the credential seam now

The concrete source-boundary request selects YouTube Credential Management without requiring an unrelated feature change. Move its implementation into `server/youtubeCredentials.ts`:

- `getUserYouTubeApiKey(idToken, uid)` returns the cached/restored internal key and metadata or `null`.
- `configureUserYouTubeApiKey(idToken, uid, apiKey)` accepts the route's validated, trimmed string; verifies, encrypts, caches, and awaits best-effort persistence; returns a configuration result with suffix or the existing verification error.
- `removeUserYouTubeApiKey(idToken, uid)` evicts the cache and performs best-effort deletion.

Keep crypto helpers available from the credential module and retain existing `app.ts` named crypto exports as compatibility re-exports. Routes call only the high-level APIs. Keep persistence helpers, YouTube verification, and the single per-process cache private. Import existing Firebase project/database configuration; do not introduce dependency injection or another storage abstraction.

Alternative: expose encryption/cache/payload primitives to routes or move only crypto. Rejected because it leaves lifecycle ownership mixed in `app.ts`.

### Freeze the affected observable contracts

| Surface | Behavior to preserve |
|---|---|
| Authentication | Existing `requireAuth` runs first, verifies the Firebase bearer ID token, and scopes all operations to its UID; rejected/missing tokens return 401 with `Authentication required`. |
| GET settings | `/api/settings/youtube-api-key`: 200 `{ configured: false }` when absent/unreadable; otherwise `{ configured: true, suffix, verifiedAt }`, with absent verification time represented as `null`. Never expose the key. Keep existing unexpected-error 500 response. |
| POST settings | Same path; missing/non-string/trimmed-shorter-than-five key returns 400 `Please provide a valid YouTube API key.` before outbound calls. Verify the trimmed key before encryption; rejection returns 400 with the existing reason mapping. Success is 200 `{ success: true, suffix }`. Preserve propagation of encryption errors rather than adding a new HTTP error contract. |
| DELETE settings | Same path; clear cache before REST deletion. Return 200 `{ success: true, message: 'YouTube API key removed successfully.' }` even on REST failure; retain existing unexpected-error 500 response. |
| Status aliases | `/api/config` and `/api/youtube/status` keep `{ hasApiKey, suffix, configured }`, with `suffix: null` when absent. |
| Search without a key | POST `/api/youtube/search` resolves credentials before YAML validation or Search Run creation. JSON is HTTP 428 with `YOUTUBE_API_KEY_REQUIRED` and the existing message. `?stream=true` or exact `Accept: text/event-stream` returns HTTP 200 with existing SSE headers, one `fatal_error` data frame, and ends the stream. |
| YAML / search / Public Read API | Validators, result shapes, concurrency, Search Run writes, and `openapi/public-api.yaml` remain untouched. |

Verification remains GET `https://www.googleapis.com/youtube/v3/videoCategories` with `part=snippet`, `regionCode=US`, the trimmed key, JSON Accept header, and a 10-second timeout. Preserve reason precedence and existing invalid/disabled/quota/restriction/fallback/timeout/network messages.

Firestore remains `projects/{firebaseProjectId}/databases/{firestoreDatabaseId || '(default)'}/documents/users/{uid}/integrations/youtube`, using bearer user tokens for GET/PATCH/DELETE. PATCH retains exactly `encryptedApiKey`, `iv`, `authTag`, `keyVersion` (Firestore integer string), `keySuffix`, `verifiedAt`, and `updatedAt` (Firestore strings). Encryption remains AES-256-GCM with SHA-256 of `USER_API_KEY_ENCRYPTION_KEY`, random 12-byte IV, base64 cipher/IV/tag, and version 1. Reads still accept an omitted key version, derive a missing suffix from the plaintext, and do not reverify loaded keys.

The cache remains plaintext, per process, indexed by UID with no new TTL. Configure updates cache before awaiting persistence; PATCH errors are logged and absorbed. GET failures, incomplete payloads, or decryption errors yield `null`. DELETE evicts before REST and absorbs failures; failed durable deletion can restore the old key on a later read. Preserve these caveats and ordering.

Alternative: normalize failures or guarantee durable storage now. Rejected because it changes response semantics and requires a separate behavioral change.

### Synchronize views from the implementation

Update Code View's physical structure, domain mapping, and boundary notes. Update Software View's component diagram/text because credential ownership and external-call edges now reside in a distinct source module inside the same Express application. Update Domain View's credential source links and persistence caveat wording; logical bounded contexts and deployment stay the same.

Alternative: update only Code View. Rejected because Software View and credential source references would still attribute implementation to `app.ts`.

## Risks / Trade-offs

- [Storage failures appear successful] → Preserve and test the existing cache-before-write and eviction-before-delete semantics; keep the caveat visible in Domain View.
- [A moved cache is accidentally duplicated or keyed differently] → Use one module-local map and test warm-cache hits, UID isolation, and eviction.
- [Existing encrypted documents become unreadable] → Test a payload generated independently with the baseline algorithm and assert unchanged Firestore fields and token/path usage.
- [Route or SSE behavior drifts] → Run the same focused Express tests before and after extraction, mocking only auth and external requests.
- [Other responsibilities remain mixed] → Accept the incremental state; select another narrow seam only in later work.

## Migration Plan

1. Reconcile proposal/design/tasks with this source-verified seam before implementation.
2. Add focused credential and missing-key HTTP/SSE regression tests and run against the baseline.
3. Extract the module, retain route handling and entrypoints, then rerun focused tests and update architecture views.
4. Run `npm test`, `npm run lint` (the existing `tsc --noEmit` typecheck), `npm run build`, `npm run docs:build`, and `npm run docs:check`. Validate this change with OpenSpec strict validation and review task/artifact consistency.
5. Mark verified tasks complete. Keep the change active for review; do not archive automatically. No data migration is required; rollback is reverting this extraction. Deployment, when requested separately, uses the existing topology.
