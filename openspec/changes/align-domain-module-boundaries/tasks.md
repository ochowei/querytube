# Tasks

## 1. Establish the extraction baseline

- [ ] 1.1 Select one responsibility exposed by a concrete feature change and record its current source callers; verify the selected callers and modules against the source tree.
- [ ] 1.2 Record the applicable HTTP/OpenAPI behavior, authorization path, Firestore paths and fields, credential payload, YAML expectations, and JSON/SSE behavior; verify each recorded contract against its current source or contract file.

## 2. Make one narrow behavior-preserving extraction

- [ ] 2.1 Move only the selected responsibility behind a cohesive source boundary while keeping the existing browser and Express deployment units; verify current entrypoints still compose the same application.
- [ ] 2.2 Preserve affected routes, response semantics, authorization modes, Firestore representation, and runtime configuration; verify the applicable focused behavior tests pass.
- [ ] 2.3 Add or update focused tests alongside the extracted module; verify the new or updated tests pass.
- [ ] 2.4 Update Code View and, only if C4 Components changed, Software View to match the resulting source; verify linked code paths exist and Mermaid nodes correspond to implemented components.

## 3. Verify the integrated result

- [ ] 3.1 Run the relevant project validation (tests, lint, and build); verify each command succeeds.
- [ ] 3.2 Review the final diff for contract changes or unnecessary indirection; verify any observable behavior change has its own reviewed OpenSpec change.
