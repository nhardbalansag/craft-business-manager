# Phase 3.1B — Composition Graph Integrity & Cycle Prevention

## Status

**COMPLETE**

Implementation PR: `#63`

Feature branch: `feature/phase-3-1b-composition-graph`

Authoritative implementation base:

`develop` @ `85731ab76110419fc8f11e7f4bbdecd0dd159e33`

Implementation merge commit:

`5bcaa40d983c1838f6f3fd975ef3b78081e446cb`

Validation evidence:

- feature CI run `34910508714` — SUCCESS;
- post-merge `develop` CI run `34910649113` — SUCCESS.

## Objective

Protect product-backed Phase 3 composition from duplicate source lines and direct/transitive cycles before repository CRUD is introduced in 3.1C.

The graph layer consumes the authoritative `ProductComponent` source records from 3.1A. It does not persist data and does not implement source existence/active-state checks.

## Graph semantics

Only product-backed component lines create directed graph edges:

```text
parent Product -> child Product
```

Material-backed component lines remain discrete composition requirements but do not create Product graph edges.

Examples:

```text
Gift Box -> Candle -> Handmade Pot
```

is valid when no path returns to an ancestor.

These are invalid:

```text
A -> A
A -> B -> A
A -> B -> C -> A
```

## Duplicate source policy

Before cycle traversal, the collection-level source identity rule from 3.1A is enforced:

```text
parentProductId + sourceType + sourceId
```

Comparison is trimmed and case-insensitive through the existing deterministic source key.

Role and quantity do not create a second legitimate source identity.

## Deterministic graph traversal

Product IDs are canonicalized as trimmed lowercase values for graph comparison and error paths.

Adjacency and root traversal are sorted with locale-independent lexical comparison so the same graph produces the same first reported cycle regardless of input array order.

Example error path:

```text
a -> b -> c -> a
```

## Direct self-reference

The full graph validator reports direct Product self-reference using the specific error code:

```text
DIRECT_SELF_REFERENCE
```

and exposes the canonical cycle path:

```text
[product, product]
```

## Transitive cycles

Transitive cycles report:

```text
CYCLE_DETECTED
```

with the closed canonical path that caused the cycle.

The validator supports arbitrary finite acyclic nesting depth; there is no business-level maximum depth introduced in 3.1B.

## Safe recursive traversal helper

`getProductCompositionDescendants()` provides deterministic depth-first descendant traversal for later recursive cost/capacity services.

It maintains its own active traversal path rather than trusting write-time validation. This is intentional: future imported or corrupted storage data must not be able to create an infinite recursion even if it bypassed the normal save validator.

A cycle that is unrelated to the requested traversal root does not block traversal of the safe root. A reachable cycle fails immediately with `CYCLE_DETECTED`.

## Error contract

3.1B introduced `ProductCompositionGraphError` with:

```text
INVALID_ROOT_PRODUCT_ID
DUPLICATE_COMPONENT_SOURCE
DIRECT_SELF_REFERENCE
CYCLE_DETECTED
```

Context can include component IDs, duplicate component IDs, parent/source IDs, the deterministic source key, and cycle path.

## Explicit deferrals

Not implemented in 3.1B:

- component repositories/CRUD;
- source Product/Material existence checks;
- active-state relationship rules;
- archive dependency guards;
- `BusinessDataset.productComponents`;
- ProductStock;
- recursive component cost roll-up;
- assembly capacity;
- React composition UI.

Those responsibilities begin in 3.1C and later Phase 3 sections.

## Validation coverage

Tests cover:

- deep finite acyclic nesting;
- direct self-reference;
- two-product cycles;
- deeper transitive cycles;
- deterministic first-cycle reporting independent of input ordering;
- duplicate source identity across roles/quantities;
- valid same source IDs across different parents/source kinds;
- material-backed lines excluded from graph-cycle edges;
- deterministic depth-first descendant order;
- reachable corrupted-cycle traversal guard;
- unrelated corrupted cycles not blocking a safe root;
- blank traversal-root validation.

## Completion gate result

Passed:

- feature-head typecheck;
- complete regression tests;
- production build;
- implementation PR merge to `develop`;
- exact post-merge `develop` CI.

## Next task

**3.1C — Component Repository & Application Services**
