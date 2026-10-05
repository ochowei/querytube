# Design

## Context

See proposal.md for motivation. App currently owns Search state and renders a one-column grid below 1024px and two columns above it. The grid and panels have minimum heights only. YAML gutters render one element per line; flex automatic minimum sizes propagate that length upward, defeating overflow. The editor footer contains validation and run controls; the viewer header contains export controls. Execution Monitor currently sits above both panels. Existing phone CSS provides 44px touch targets.

## Goals / Non-Goals

Goals: establish a complete height/min-size chain, keep actions outside content scrolling, preserve local child state during collapse, and keep the existing color/spacing conventions.
Non-goals: change request coordination, persist presentation preferences, or introduce browser test dependencies into the application.

## Decisions

- Give the authenticated Search shell a desktop dynamic-viewport height and a 720px minimum height. Header and ancillary notices do not grow with content; the remaining main/workspace flex chain uses min-height: 0. Short windows can page-scroll to avoid clipped controls. Other tabs retain their current flow. A fixed pixel panel height was rejected because it wastes large windows and overflows smaller ones.
- Add a SearchWorkspace presentation component with independent local collapse booleans and labelled panel controls. Keep children mounted behind the HTML hidden attribute to preserve text/scroll/tab state and prevent hidden keyboard interaction. Desktop uses a shared horizontal toolbar with labelled Show/Hide controls. Collapsed sections occupy no desktop grid space, so the other panel takes the full available width; vertical rails are rejected after UI review because their reading direction and restore affordance are awkward. Mobile retains each panel's horizontal header. Both panels may collapse; the desktop toolbar remains visible with a short empty-state hint. No persistence is needed for this transient preference.
- Move the existing Execution Monitor into the result panel with a bounded scroll area. Cancellation stays above its feedback scroller. It continues to update when hidden; App retains all execution ownership.
- Keep panel headers and primary action rows as non-shrinking flex siblings; use min-height/min-width: 0 on content. Bound help and validation feedback; allow them to shrink under crowded conditions while preserving a 48px desktop input area and the primary action row. On narrow screens use fixed content area heights (350px editor / 360px output), preserving page navigation between panels while avoiding content-sized growth.
- Synchronize the editor gutter to textarea scrollTop. For raw output put gutter and code in one scroll container with matching line metrics. This avoids incorrect line labels after scrolling without a new editor library.
- Verify actual components with a credential-free Vite browser fixture and a browser regression runner using an externally supplied Playwright installation. This avoids production auth bypasses or real Search Requests. Existing Node tests remain unchanged.

## Risks / Trade-offs

- Nested scroll regions require clear boundaries → preserve panel borders and visible scrollbar styling; primary actions sit outside scrollers.
- Very short desktop windows cannot fit every control comfortably → 720px shell minimum permits page scrolling.
- Thousands of gutter elements/cards still have rendering cost → height containment solves navigation; virtualization remains a separate performance improvement.
- Collapse preferences reset when leaving Search → intentional transient presentation state; input/results remain in App.

## Migration Plan

No data migration or deployment changes. Review the uncommitted change, run regression checks, and later deploy through the existing pipeline. Reverting the presentation changes restores the previous layout without affecting persisted data.
