# Spec Delta

## Purpose

Provide coherent browser access to QueryTube's existing documentation while preserving authoritative source locations and distinguishing current architecture from proposed changes.

## ADDED Requirements

### Requirement: Preserve authoritative documentation sources

The site SHALL present existing documentation without moving or committing duplicate authoritative content. Current architecture SHALL come from `docs/architecture/`, canonical specifications from `openspec/specs/`, proposals from `openspec/changes/`, domain language from `CONTEXT.md`, and the Public API contract from `openapi/public-api.yaml`. `docs-site/` SHALL contain presentation and configuration only.

#### Scenario: Edit a source document
- **WHEN** an existing authoritative Markdown document is edited
- **THEN** its next site render reflects that original file without maintaining a second committed copy

#### Scenario: Follow the Public API reference
- **WHEN** a reader opens the Public API reference entry
- **THEN** the page links to the authoritative machine-readable YAML rather than a hand-maintained duplicate contract

### Requirement: Navigate actual documentation

The site SHALL provide Architecture viewpoints, OpenSpec Specs, Active Changes, Domain Glossary, and Public API navigation derived from actual files. It SHALL expose archived changes separately when present and explicitly describe empty specification or change collections.

#### Scenario: Browse the current repository
- **WHEN** a reader uses the site navigation
- **THEN** existing Architecture viewpoints, active changes, the glossary, and the API reference are reachable
- **AND** the canonical specification section honestly reports that it is empty until canonical specs exist

#### Scenario: Add a nested canonical specification
- **WHEN** an original specification is added anywhere under `openspec/specs/` and the site is restarted or rebuilt
- **THEN** navigation includes the specification at its existing nested path

#### Scenario: Archive a change through the normal workflow
- **WHEN** a change is moved to `openspec/changes/archive/` and the site is restarted or rebuilt
- **THEN** it appears in Change History and no longer appears in Active Changes

### Requirement: Distinguish proposals from current architecture

Every rendered OpenSpec change page and change listing SHALL prominently state that OpenSpec changes describe proposed future work and do not represent current architecture until implemented and integrated. Archived records SHALL remain separate from current architecture.

#### Scenario: Open a change directly
- **WHEN** a reader follows a direct URL to a proposal, design, task list, or change spec delta
- **THEN** the planning warning appears before the document content, even without visiting the change index

### Requirement: Preserve useful cross-source links

Links between rendered documentation SHALL resolve within the site while original Markdown remains usable in GitHub. Links to repository files outside the rendered documentation SHALL resolve to their repository source. Documentation builds SHALL fail on broken internal documentation links.

#### Scenario: Navigate from Domain View to shared language and code
- **WHEN** a reader follows the Domain View's glossary and source-code links
- **THEN** the glossary opens within the site and the code opens at its repository source

### Requirement: Support separate local documentation commands

Developers SHALL be able to run documentation development, build, and preview commands using the repository's package manager on macOS/Linux and in CI. These commands SHALL remain separate from application commands and SHALL NOT change application runtime, deployment, or Public API behavior.

#### Scenario: Build documentation in a clean checkout
- **WHEN** dependencies are installed from the Bun lockfile and the documentation build command runs
- **THEN** the site is generated in ignored documentation output with working section links
- **AND** application build and deployment commands retain their existing behavior
