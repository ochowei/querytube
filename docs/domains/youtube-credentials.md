# YouTube Credential Management

## Purpose

Let each user provide a YouTube Data API key that QueryTube can verify and use for that user's searches without returning the raw key through the settings API.

## Responsibilities

- Accept and validate the shape of a submitted key.
- Check the key against YouTube Data API v3 before accepting it.
- Encrypt the key for persistence, store its suffix and verification timestamps, and retrieve/decrypt it for server-side use.
- Report configuration status without returning the raw key.
- Remove the key document and evict its per-UID in-memory cache entry.

## Out of Scope

- Firebase sign-in and user identity verification.
- Executing search queries or owning Search Run records.
- Managing Google Cloud quota or restrictions for the user's YouTube project.

## Ubiquitous Language

- **YouTube API key**: a user's credential for YouTube Data API v3.
- **Configured key**: a key accepted after a verification request and available to the current server process or retrievable from Firestore.
- **Suffix**: the final four characters returned to the UI as a masked identifier.
- **Verified at**: time recorded when a key passed the key-validation request.

## Core Concepts

- Per-user YouTube integration document.
- Encrypted key payload (`encryptedApiKey`, `iv`, `authTag`, `keyVersion`).
- Warm-process cache indexed by Firebase UID.

## Business Rules / Invariants

- A key submitted through the settings endpoint is trimmed and must contain at least five characters before the server attempts verification.
- The server verifies a submitted key using the YouTube Data API categories endpoint before encryption and persistence.
- The persisted key is encrypted with AES-256-GCM and `keyVersion: 1`; the configured `USER_API_KEY_ENCRYPTION_KEY` is required by the encryption helper.
- A search resolves and uses the YouTube API key stored for the UID verified on that request. The document is scoped to `users/{uid}/integrations/youtube`; this flow does not use a shared QueryTube API key.
- Status responses expose `configured`, suffix, and verification time; they do not return the raw key.

**Observed persistence caveat:** `persistUserIntegration` logs and absorbs REST failures, and the POST route updates the process cache before persistence. A success response therefore does not prove that the encrypted document was written durably. The DELETE helper also absorbs REST failures after clearing the process cache.

## Inputs

- The authenticated user's submitted API key.
- A verified UID and ID token.
- Firestore integration document fields when restoring a key.

## Outputs

- Key status and masked suffix.
- An encrypted Firestore document at `users/{uid}/integrations/youtube`.
- The decrypted key to the internal YouTube Search flow.
- A validation error when YouTube rejects the key or the outbound request fails.

## Dependencies

- Identity and Access for UID and ID token.
- YouTube Data API v3 for key verification.
- Firestore REST API, authorized with the user's Firebase ID token.
- Process-local memory cache in the Express runtime.

## Related Code

- [Key routes, AES-GCM helpers, verification, persistence, and cache](../../server/app.ts).
- [Firebase project/database and Admin configuration](../../server/firebaseAdmin.ts).
- [Key settings UI](../../src/components/ApiKeySettings.tsx) and [application handlers](../../src/App.tsx).
- [Firestore rules](../../firestore.rules) limits direct integration access to its owner.

## Related Specifications

There is no separate credential API specification or ADR. Credential routes are authenticated application endpoints documented in code; the machine-readable [Public API specification](../../openapi/public-api.yaml) covers anonymous read access, not key management.
