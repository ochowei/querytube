# Identity and Access

Part of the [Domain View](../README.md). Navigate to the [Context Map](../context-map.md), [System View](../../system-view.md), [Software View](../../software-view.md), [Code View](../../code-view.md), and [Deployment View](../../deployment-view.md).

## Purpose

Give QueryTube a Firebase-backed user identity and ensure protected operations are scoped to the signed-in user's UID.

## Responsibilities

- Sign users in and out with Google through Firebase Authentication.
- Restore the browser's local Firebase session.
- Provide Firebase ID tokens to authenticated API requests.
- Verify bearer tokens on protected Express routes and attach the verified UID to the request.
- Apply the user's UID to owner-scoped Firestore paths.

## Out of Scope

- Managing YouTube API keys or deciding whether a search key is usable.
- Defining Query Set or Search Run behavior.
- Anonymous publication. Public Read API requests do not require an authenticated user and use publication rules from the owning contexts.

## Ubiquitous Language

- **User**: a Firebase-authenticated person interacting with QueryTube.
- **UID**: Firebase's stable user identifier; used as the owner path in Firestore.
- **ID token**: Firebase credential sent as a bearer token to protected API routes.
- **Authenticated request**: a request whose ID token has been verified by the server.

## Core Concepts

- Firebase user session in the browser.
- Verified server request identity (`req.user.uid`).
- Owner-scoped resource access.

## Business Rules / Invariants

- Protected API operations require a non-empty bearer ID token that Firebase Admin can verify; missing or invalid tokens receive HTTP 401.
- The UID used for protected operations comes from the verified token, not from a caller-selected owner ID.
- Firestore rules allow direct client access under `users/{userId}` only when `request.auth.uid == userId`.
- The Public Read API is intentionally outside this authenticated flow; it must enforce each resource's explicit publication setting.

## Inputs

- Google sign-in and sign-out actions in the browser.
- Firebase auth state and ID tokens.
- Bearer ID tokens on protected `/api/...` requests.

## Outputs

- Browser `User` and auth state (`loading`, `authenticated`, `unauthenticated`).
- A verified UID and token attached to protected Express requests.
- HTTP 401 when a protected request cannot be authenticated.

## Dependencies

- Firebase Authentication in the browser.
- Firebase Admin Auth in the Express application.
- Firestore security rules for direct client access.
- YouTube Credential Management, Query Management, YouTube Search, and Search History consume the verified UID on protected requests.

## Related Code

- [AuthContext](../../../../src/context/AuthContext.tsx) observes Firebase auth and provides sign-in, sign-out, token, and session-expiration actions.
- [Firebase client setup](../../../../src/firebase.ts) initializes Firebase Auth and the client Firestore instance.
- [Authenticated fetch](../../../../src/utils/authenticatedFetch.ts) retries one protected request after a 401 with one forced token refresh.
- [`requireAuth` and Express routes](../../../../server/app.ts) verify ID tokens and use `req.user.uid`.
- [Firebase Admin setup](../../../../server/firebaseAdmin.ts) initializes Admin Auth and Firestore.
- [Firestore rules](../../../../firestore.rules) constrain direct client reads and writes to the authenticated user's UID.

## Related Specifications

No BDD feature files or identity-specific ADRs were found. The Firebase client and server configuration are current implementation facts, not a record of why Firebase was chosen.

