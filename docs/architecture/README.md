# QueryTube Architecture

These documents describe the current architecture on `main`. They are organized by viewpoint:

- [System View](system-view.md) — actors, QueryTube, and surrounding external systems.
- [Software View](software-view.md) — QueryTube's C4 Container and Component structure.
- [Domain View](domain-view/README.md) — business responsibilities, bounded contexts, and their relationships.
- [Code View](code-view.md) — physical source modules and the Domain-to-Code Mapping.
- [Deployment View](deployment-view.md) — environments and the runtime nodes where the software runs.

> Architecture documents are organized by viewpoints and do not form one strict hierarchy.

> Everything under `docs/architecture/` describes the current architecture on `main`.

For milestones that predate the current architecture views, see the retrospective [Architecture History](../architecture-history.md).

Future architecture changes belong in OpenSpec changes, not in a permanent target architecture document. The [domain module boundary proposal](../../openspec/changes/align-domain-module-boundaries/proposal.md) is planning material and does not describe current architecture or authorize implementation.

## Architecture change lifecycle

Use this lifecycle when a change affects the architecture:

1. Treat the architecture documented here as the current truth on `main`.
2. Describe the proposed architecture delta in the OpenSpec change's `design.md`; record behavior or requirement deltas in that change's spec artifacts when needed.
3. Implement the approved change and update the affected architecture views after the implementation settles. Track the documentation update as a task in the same change.
4. Review the implementation and updated architecture documentation together before merge, verifying current-state statements against the resulting source.
5. Merge the implementation and documentation together. The updated architecture views then describe the new current truth; archive the completed OpenSpec change with the rest of its change record.

Important architecture decisions can be recorded under [ADR](../adr/README.md). Domain boundaries are logical responsibilities; they do not need a one-to-one match with C4 Components, source modules, or deployable units.
