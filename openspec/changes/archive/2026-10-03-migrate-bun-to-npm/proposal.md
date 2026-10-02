# Proposal

## Why

Standardize QueryTube dependency management and development tooling on Node.js + npm. QueryTube already targets Node.js 22, but its lockfile, developer commands, and Vercel build configuration assume Bun.

## What Changes

- Keep Node.js as the runtime and make npm the canonical package manager.
- Declare the observed npm version in `package.json`; replace `bun.lock` with npm-generated `package-lock.json` as the only committed dependency lockfile.
- Preserve dependency constraints, the `jose` override, and existing locked versions wherever npm compatibility allows.
- Use npm consistently in development, clean-install/CI verification, developer documentation, docs tooling, and deployment.
- Preserve application behavior and the existing deployment topology.

## Capabilities

### New Capabilities

None. This is a tooling/infrastructure migration without new product behavior.

### Modified Capabilities

None. No canonical behavior specifications change. The change opts out of spec deltas with `skip_specs: true` in `.openspec.yaml`, following the existing behavior-preserving change convention.

## Impact

Affects `package.json`, dependency lockfiles, `vercel.json`, `README.md`, the docs-check command diagnostic, and the Deployment View's tooling assumptions. Existing planning/validation records may retain explicitly labeled historical Bun references. No CI configuration exists in this checkout; deterministic verification will use `npm ci`.

Out of scope: application architecture refactoring, domain restructuring, unrelated dependency upgrades, HTTP/OpenAPI contract changes, Firestore schema/path changes, authorization changes, credential format changes, YAML behavior changes, and JSON/SSE semantic changes.
