# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. `package.json` targets Node.js `22.x`; the local environment reports Node.js `v22.22.2` and npm `10.9.7`. Scripts already invoke Node, tsx, Vite, TypeScript, and VitePress without depending on Bun. The repository has one Bun lockfile, an existing `jose: 5.10.0` override, no CI configuration, and a Vercel Vite preset with a Bun build command. The docs checker requires a documentation build before it runs.

## Goals / Non-Goals

**Goals:** Reproducible npm installation, preserved dependency constraints and locked versions, consistent current developer/deployment instructions, and a verified clean installation.

**Non-Goals:** See the proposal's exclusions. In particular, do not rewrite working scripts, introduce CI/deployment architecture, or reinterpret domain boundaries. Existing completed validation records remain historical evidence.

## Decisions

### Retain Node.js and declare the observed npm version

Keep `engines.node: 22.x` and all existing script bodies. Add `packageManager: npm@10.9.7`, using the actual local npm version; no repository constraint selects another npm version. Replacing Node/Vite/tsx commands or selecting a guessed npm version would add unnecessary change.

### Use one npm lockfile and preserve the dependency baseline

Generate `package-lock.json` with npm and remove `bun.lock` after comparing the resulting resolution. Preserve manifest dependency ranges and overrides. Use the existing locked/installed versions as the migration baseline; if npm would refresh ranges unnecessarily, carry forward the old resolution as input and let npm produce the final lockfile. Inspect every added, removed, or changed name/version and platform-specific optional package. Document necessary peer-resolution/hoisting differences instead of silently accepting dependency upgrades. Keeping competing lockfiles would leave the canonical installation ambiguous.

### Standardize commands without rewriting scripts

Implementation audit found that npm's default resolver rejects root esbuild `^0.25.0` alongside Vite 8's optional peer `^0.27.0 || ^0.28.0`; older DocSearch/Swagger packages also declare React peer ranges below React 19. Add repository-local `.npmrc` with `legacy-peer-deps=true` so plain `npm install` and `npm ci` preserve the existing dependency baseline. Changing dependency constraints or using `--force` would expand scope. This setting is an npm compatibility requirement, not a relaxation of application tests.

Use `npm install`, `npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npm run docs:build`, and `npm run docs:check`. Use `npm ci` for deterministic clean installation and CI verification; no CI workflow needs to be added. Document that `docs:check` follows `docs:build`, since it validates generated HTML rather than source Markdown.

### Keep normal Vercel package-manager detection

Replace only the existing build command with `npm run build`. Retain the Vite preset, `public/` output, Function include files, rewrites, and Node.js 22 runtime. Vercel [detects npm from package-lock.json](https://vercel.com/docs/package-managers); leave installation to its normal detection rather than adding a custom install command. This checkout cannot prove live dashboard overrides or deployment state.

### Synchronize current instructions and label historical context

Update README, the Deployment View's actual commands/toolchain, and the docs-check diagnostic. Audit agent instructions and config/scripts; change only real package-manager assumptions. Retain the older archived deployment plan and completed documentation-site proposal/design/validation record with explicit historical-context notices pointing to current instructions. Make the existing documentation-site scenario's installation wording package-manager-neutral so it remains applicable with the canonical lockfile; this changes no product requirement and creates no new spec delta. Other architecture views and `CONTEXT.md` need no edits because runtime/module/domain structure and language remain unchanged.

## Risks / Trade-offs

- [npm resolves peers or hoists packages differently] → Compare names/versions with the original lock and preserve the override; run all existing checks after `npm ci`.
- [An installed tree hides missing lockfile entries, especially native optional packages] → Remove `node_modules`, perform a clean install, inspect cross-platform lock entries, and verify builds.
- [Historical Bun instructions are mistaken for current setup] → Label historical records and direct readers to the npm README.
- [Docs checking sees stale generated pages] → Build documentation after adding/editing artifacts, then validate the built inventory and links.

## Migration Plan

1. Complete the audit and record environment versions before implementation.
2. Declare npm, generate and inspect the lockfile, and remove the Bun lockfile.
3. Update tooling/deployment commands and synchronize current documentation.
4. Remove installed dependencies and run `npm ci`; then lint, tests, application build, documentation build/check, and a bounded dev-server smoke check that stops the server.
5. Validate OpenSpec and the final diff/audit, record actual outcomes, and leave the completed change active for review/archive.

Rollback restores the prior manifest, lockfile, and tooling/documentation commands together, then reinstalls dependencies with the prior toolchain. No data or deployment-topology migration is required.
