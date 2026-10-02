# Tasks

## 1. Repository audit

- [x] 1.1 Read repository context, OpenSpec config/relevant changes, manifest, developer and architecture docs, deployment/tooling configuration, and agent instructions; record Node/npm versions and classify all Bun references before implementation.

## 2. Package-manager migration

- [x] 2.1 Declare `npm@10.9.7`, generate `package-lock.json` with npm, compare every resolved name/version to the original Bun baseline, preserve constraints/scripts/overrides, and remove `bun.lock`; verify no unintended upgrades or competing lockfiles.

## 3. Repository/tooling integration and documentation synchronization

- [x] 3.1 Update Vercel's build command and docs-check diagnostic to npm; verify the unchanged Vite/Node deployment shape and normal lockfile-based npm install detection without a custom install command.
- [x] 3.2 Update README and the affected Deployment View, label retained historical planning/validation references, and make the existing docs scenario use the canonical lockfile; verify current instructions against manifest/config/source and audit agent/CI/script assumptions.

## 4. Clean-install verification

- [x] 4.1 Remove `node_modules`, run `npm ci` using the final lockfile, verify lockfile stability, and run `npm run lint`, `npm test`, and `npm run build`; investigate any failures without weakening checks.
- [x] 4.2 Run `npm run docs:build` followed by `npm run docs:check`, verify `npm run dev` starts and serves the app where practical, and stop its process afterward; record results and material warnings.

## 5. Final integration audit

- [x] 5.1 Repeat the full Bun/competing-lockfile audit, classify remaining historical/change-context references, validate OpenSpec strictly and diff whitespace, and verify the final implementation/docs match proposal/design without application changes; record archive readiness and leave the change unarchived.

## Audit and resolution record

- Observed Node.js `v22.22.2` and npm `10.9.7`; `engines.node` remains `22.x`. Read `CONTEXT.md`, OpenSpec configuration and both existing changes, manifest, README, deployment source/config, architecture views, and repository agent skills. No CI workflow or Bun-specific agent instructions exist in the checkout.
- Current Bun assumptions were README commands, Vercel's build command, the Deployment View, and the docs-check diagnostic. Older documentation-site planning/validation and the archived Vercel migration plan retain explicitly labeled historical context. The existing documentation-site installation scenario now refers to the canonical lockfile.
- Added `.npmrc` with `legacy-peer-deps=true`: npm's default resolver rejects the pre-existing Vite 8 / root esbuild 0.25 peer conflict and warns on older DocSearch/Swagger React peer ranges. This compatibility setting avoids dependency constraint changes; ordinary npm commands read it automatically, including in deployment.
- The original lock contains 871 package entries / 818 distinct name-version pairs. npm generated a v3 lock with 870 package entries / 817 distinct pairs. There are no added versions or integrity changes. The only removed pair is `search-insights@2.17.3`, an automatically installed optional DocSearch peer omitted by npm's legacy peer resolution; no direct dependency changes. Existing `jose@5.10.0` override is preserved.
- Generated a complete lock from the original locked resolution via temporary npm v1 input, allowing npm to fetch metadata and write v3. The first installed-tree-derived candidate lacked foreign native entries and was discarded. The final lock retains Linux/macOS/Windows optional dependencies for esbuild, Rolldown, Rollup, Tailwind, Lightning CSS, and TypeScript. Temporary conversion alias-metadata warnings did not alter the three alias targets, their versions, resolved tarballs, dependencies, or integrity hashes.

## Validation record

- Removed `node_modules` after final lockfile generation and ran plain `npm ci`: passed, installing 703 packages. SHA-256 verification confirmed the committed lockfile was unchanged. npm reported pre-existing deprecated packages and 9 audit advisories (4 moderate, 5 high); no audit fixes or dependency upgrades were applied.
- `npm run lint`: passed. `npm test`: passed all 20 tests, no skips or failures.
- `npm run build`: passed. Existing Vite warnings about `__dirname` and bundle size remain; no unrelated configuration/refactoring was performed.
- `npm run docs:build`: passed with strict link checking. `npm run docs:check`: passed; the final documentation build validated 31 HTML pages and 1,557 internal links/fragments, navigation, source inventory, planning warnings, and the empty canonical-spec state.
- `npm run dev`: started on temporary port 43127, returned HTTP 200 with the application entrypoint, and was stopped with SIGINT afterward. This verifies startup and frontend serving, not authenticated Firebase/YouTube operations or a live Vercel deployment.
- Structural comparison confirmed `package.json` differs only by `packageManager`, including identical scripts, dependency ranges, engines, and override; `vercel.json` differs only by its build command.
- Final repository-wide audit, including hidden agent/config files: remaining actual Bun references are confined to this migration's baseline/removal record, the explicitly labeled historical documentation-site proposal/design/tasks, and the archived Vercel migration plan. No executable Bun/bunx commands or current Bun setup instructions remain. Other literal case-insensitive matches are ordinary words such as bundle/bundling and an incidental lockfile integrity-hash substring. Third-party installed packages and ignored generated outputs are not repository instructions.
- Only `package-lock.json` remains as a repository dependency lockfile; no `bun.lock`, `bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, or `npm-shrinkwrap.json`. Strict validation passed for this change and the updated documentation-site change; `git diff --check` passed. The dev test port was confirmed closed after SIGINT.
- All seven tasks are complete; implementation matches proposal/design and affected architecture documentation matches resulting source. Ready for OpenSpec archive after review/integration; left active and unarchived. No application source, tests, contracts, persistence, authentication, or domain model edits. No commits or pushes.
