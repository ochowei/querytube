# Deployment View

This view describes where the current software runs. QueryTube's system relationships are in the [System View](system-view.md), its containers/components in the [Software View](software-view.md), domain responsibilities in the [Domain View](domain-view/README.md), and source locations in the [Code View](code-view.md).

## Local Development

`bun run dev` starts `tsx server/dev.ts`. That entrypoint imports the shared Express application from `server/app.ts`, attaches Vite in middleware mode, and listens on the configured port. The browser UI and API are therefore served through one local Node process during development.

```text
Developer computer
└── Node process: server/dev.ts
    ├── Express application: server/app.ts
    └── Vite development middleware
```

`bun run start` uses the same entrypoint. With `NODE_ENV=production`, it serves the built `public/` output from Express instead of attaching Vite middleware.

## Vercel Preview

Preview deployments use the repository's Vercel Vite configuration. Vite builds static files into `public/`; Vercel serves those files and rewrites requests not served as static files to the `api/index.ts` Node Function, which exports the shared Express application in `server/app.ts`.

```text
Vercel Preview
├── Vite static output: public/ (CDN)
└── Node Function: api/index.ts
    └── Express application: server/app.ts
```

Preview uses its Vercel environment variables and Firebase project/service account configuration. The repository does not establish which values are configured in a live Preview project.

## Vercel Production

Production uses the same repository topology and entrypoints as Preview, with the Production Vercel environment and its configured variables:

```text
Vercel Production
├── Vite static output: public/ (CDN)
└── Node Function: api/index.ts
    └── Express application: server/app.ts
```

`vercel.json` selects the Vite framework, runs `bun run build`, publishes `public/`, includes the OpenAPI YAML and SPA entry file in the Function bundle, and rewrites unmatched requests to `/api/index`. `server/app.ts` also has a Vercel-mode SPA fallback for unmatched GET paths after the API routes, including unknown API paths. No `maxDuration` is specified in the repository; Function duration comes from the Vercel project/plan configuration.

The repository establishes this deployment configuration, but cannot establish whether Preview or Production deployments are active, which environment variables they contain, or whether a production cutover has occurred. The earlier migration plan and its repository-state assessment are preserved in the [archive](../archive/vercel-migration-implementation-plan.md).

## Runtime dependencies and configuration

The API runtime depends on Firebase Authentication, Cloud Firestore, and YouTube Data API v3. Firebase Admin Auth/Firestore are initialized by `server/firebaseAdmin.ts`; key verification and searches call YouTube Data API directly. The browser initializes Firebase from `firebase-applet-config.json`.

There is a configuration discrepancy in the checked-in defaults: the browser config names Firebase project `querytube-c1947`, while `server/firebaseAdmin.ts` falls back to project `sapient-spark-z83d0` and the named database `ai-studio-youtubeyamlsearc-83e4e646-42fd-44b9-a9a0-7af77ee13b93`. The browser calls `getFirestore(app)` without a database ID, which selects its project's default database; current QueryTube records are read and written by the backend. Vercel runtime startup requires explicit `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `USER_API_KEY_ENCRYPTION_KEY`; local values can override the server fallbacks. The checked-in files do not establish whether local or deployed values align the browser and server with the intended project/database. Confirming the live values and existing encrypted-key compatibility is an operations task, not inferable from this source checkout.
