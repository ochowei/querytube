# QueryTube Architecture

These documents describe the current architecture on `main`. They are organized by viewpoint:

- [System View](system-view.md) — actors, QueryTube, and surrounding external systems.
- [Software View](software-view.md) — QueryTube's C4 Container and Component structure.
- [Domain View](domain-view/README.md) — business responsibilities, bounded contexts, and their relationships.
- [Code View](code-view.md) — physical source modules and the Domain-to-Code Mapping.
- [Deployment View](deployment-view.md) — environments and the runtime nodes where the software runs.

> Architecture documents are organized by viewpoints and do not form one strict hierarchy.

> Everything under `docs/architecture/` describes the current architecture on `main`.

Future architecture changes belong in OpenSpec changes, not in a permanent target architecture document. The [domain module boundary proposal](../../openspec/changes/align-domain-module-boundaries/proposal.md) is planning material and does not describe current architecture or authorize implementation.

Important architecture decisions can be recorded under [ADR](../adr/README.md). Domain boundaries are logical responsibilities; they do not need a one-to-one match with C4 Components, source modules, or deployable units.
