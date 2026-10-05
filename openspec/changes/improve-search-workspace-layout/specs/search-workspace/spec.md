# Spec Delta

## Purpose

Make large YAML Search Definitions and Search Results manageable in the responsive Search workspace while retaining access to editing, execution, and export actions.

## ADDED Requirements

### Requirement: Bounded desktop workspace
The Search workspace SHALL bound desktop panel height by the viewport, allowing input, raw Output YAML, card previews, and execution feedback to scroll without growing the page with their content. Short desktop windows SHALL retain access through page scrolling rather than clipping controls.

#### Scenario: Large input and output
- **WHEN** a desktop user loads thousands of YAML lines and a large Search Result
- **THEN** input and output scroll independently, and their content length does not increase page height
- **AND** line numbers remain aligned with their associated YAML while scrolling

#### Scenario: Search execution feedback
- **WHEN** a Search Run has many Query Outcomes
- **THEN** its execution feedback remains bounded and Cancel search is accessible during execution

### Requirement: Accessible primary actions
Expanded panels SHALL keep Validate, Run Search, Copy YAML, and Download YAML outside their long-content scroll regions, preserving their existing availability rules. Supplemental help and validation errors SHALL be bounded so they cannot displace the primary actions indefinitely.

#### Scenario: Long content and feedback
- **WHEN** a user scrolls long YAML, opens schema help, or receives many validation errors
- **THEN** primary actions remain reachable without scrolling to the end of the YAML or feedback

### Requirement: Collapsible Search panels
Each panel SHALL provide a keyboard-operable, named expand/collapse control exposing its expanded state. Collapsing a panel SHALL remove its content from interaction without losing input, results, ongoing execution, or local presentation state, and release desktop width to the other expanded panel.

#### Scenario: Collapse and restore
- **WHEN** the user collapses either or both panels and then expands them
- **THEN** each restore control remains accessible, and YAML values and selected result presentation are retained
- **AND** collapsing a panel does not cancel a running Search Request

### Requirement: Narrow viewport flow
Narrow viewports SHALL retain stacked panels and page scrolling with bounded input and result content, wrapping action controls without horizontal page overflow. Collapse controls SHALL remain usable with touch and keyboard after viewport changes.

#### Scenario: Phone with large results
- **WHEN** a user edits a large definition or views raw YAML or cards on a narrow viewport
- **THEN** content scrolls inside its panel, actions remain reachable, and the page can scroll between panels

#### Scenario: Resize with collapsed panel
- **WHEN** the viewport switches between desktop and mobile while a panel is collapsed
- **THEN** the collapsed state and an accessible restore control are preserved
