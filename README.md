# QueryTube

QueryTube is a React/Vite app with an Express backend and Firebase persistence.

## Local development

Install dependencies with the repository's Bun lockfile, copy `.env.example` to `.env`, and provide the required local credentials:

```sh
bun install
cp .env.example .env
bun run dev
```

The dev server keeps Vite middleware and Express in one local process. `bun run start` preserves the existing Express listener command; with `NODE_ENV=production` it serves the Vite build from `public/`, and otherwise it uses Vite middleware as before.

## Build and type check

```sh
bun run lint
bun run build
```

The Vite build writes static files to `public/`. Vercel uses the Vite preset to publish those files through its CDN. Requests that do not match a static file are rewritten to the Express app exported by `api/index.ts`, preserving the existing API and documentation URLs.

## Vercel deployment

Import the repository into Vercel and configure the project to use Node.js 22. The repository `vercel.json` selects the Vite preset, runs `bun run build`, publishes `public/`, and includes the OpenAPI YAML and SPA entry file in the `api/index.ts` Function bundle. Function duration follows the Vercel project and plan settings; confirm those settings allow the longest expected streaming search before production cutover.

Configure these variables in each Vercel environment that needs backend access:

```text
FIREBASE_PROJECT_ID
FIRESTORE_DATABASE_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
USER_API_KEY_ENCRYPTION_KEY
```

Set the Firebase identifiers to the existing project and named Firestore database. Set the Admin service account values in Vercel's environment variable settings only. Keep `USER_API_KEY_ENCRYPTION_KEY` identical to the key that encrypted the existing YouTube API-key documents. Never commit the value to Git or expose it with a `VITE_` prefix. The Firebase Web configuration in `firebase-applet-config.json` is client configuration and remains available to the frontend.

In Firebase Console, add each Vercel hostname that will be used for Google Sign-In under **Authentication → Settings → Authorized domains**. Preview deployments should use the Firebase project intended for previews; do not point them at production unless that is the current project policy.

Use `vercel dev` or a Preview deployment to verify nested API routes, `/openapi.json`, `/api-docs/`, and SSE streaming before production cutover.

Keep the existing Cloud Run deployment available until the Vercel deployment has passed the migration smoke checks. No Firestore data migration is required.
