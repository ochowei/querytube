# Proposal

> Historical tooling context: this completed change records the Bun toolchain used when documentation was added. Current package-manager instructions are in [README.md](../../../README.md); the npm migration is recorded in [migrate-bun-to-npm](../archive/2026-10-03-migrate-bun-to-npm/proposal.md).

## Why

QueryTube's architecture, specifications, glossary, and API contract are repository files that are inconvenient to browse as one documentation system. A browser presentation can connect these sources without changing their ownership or the existing OpenSpec workflow.

## What Changes

- Add a VitePress documentation presentation under `docs-site/`, with Bun development, build, and preview scripts.
- Browse the existing Architecture viewpoints, canonical OpenSpec Specs, Active Changes, available Change History, Domain Glossary, and Public API reference.
- Read original Markdown in place and derive navigation from the actual repository files. Keep small presentation indexes only in `docs-site/`.
- Prominently label every exposed OpenSpec change as future-work planning, distinct from current architecture.
- Keep `docs/architecture/` authoritative for current architecture, `openspec/specs/` for canonical specifications, `openspec/changes/` for proposals, `CONTEXT.md` for shared domain language, and `openapi/public-api.yaml` for the machine-readable Public API contract.

## Capabilities

### New Capabilities

- `documentation-site`: Browser navigation and rendering of QueryTube's existing authoritative documentation, preserving source ownership and planning/current-state distinctions.

### Modified Capabilities

None. `openspec/specs/` currently contains no specifications; application and Public API behavior are unchanged.

## Impact

Adds documentation configuration, lightweight index pages, focused routing validation, a VitePress development dependency, Bun lockfile entries, and a concise README section. Documentation builds remain separate from the React/Vite application build and existing deployment.

Out of scope: architecture redesign, bounded-context reorganization, moving existing documentation, committed copies of authoritative content, application behavior changes, API contract changes, and documentation deployment. No architecture-view change is expected because this introduces only developer documentation infrastructure.
