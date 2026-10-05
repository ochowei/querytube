# Proposal

## Why

Large YAML Search Definitions and Search Results expand the Search page, separating users from validation, execution, and export controls. A bounded, collapsible workspace will make large Search Requests easier to edit and inspect while preserving the existing mobile flow.

## What Changes

- Bound the desktop Search workspace to the available viewport with independent scrolling for input, output, and execution feedback.
- Keep editor actions and result export controls outside the long-content scroll areas.
- Allow either panel to collapse and the other to consume the released desktop space, without losing input, results, or local presentation state.
- Preserve stacked panels on narrow screens, with bounded content areas, wrapping controls, and accessible expand/collapse buttons.

## Capabilities

### New Capabilities

- `search-workspace`: Responsive editing and inspection of large YAML Search Definitions and Search Results, including panel collapse and action access.

### Modified Capabilities

None. Existing canonical specs cover the Public Read API, not the Search workspace.

## Impact

Affects `src/App.tsx`, Search presentation components, layout CSS, focused browser regression checks, and current Code/Software View documentation. No API, persistence, search execution, YAML semantics, dependencies, or deployment changes are intended. Virtualization, panel resizing, persistent layout preferences, and a broad visual redesign are out of scope.
