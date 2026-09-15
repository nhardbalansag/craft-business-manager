# Phase 3.4B — Direct-Material + Component Capacity Synthesis Development Plan

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `b8ff28922219e5c9ddbc1d5e2dcd244e6eda3119`

Feature branch:

`feature/phase-3-4b-capacity-synthesis`

Implementation record:

`docs/PHASE_3_4B_DIRECT_MATERIAL_COMPONENT_CAPACITY_SYNTHESIS.md`

Implementation PR:

`#81 — MERGED`

Implementation merge:

`c598eb81b1521e63773c163f6aef1a3004cafbdb`

## Objective completed

3.4B now synthesizes authoritative Phase 2.4C direct-material capacity with all immediate Phase 3.4A component capacities.

When every actually-required capacity source is reliable:

```text
overall assembly capacity
= min(direct-material capacity, all component capacities)
```

## Split assessment

No deeper formal split was required. The task remained one cohesive Product-level synthesis boundary.

## Completed scope

The implementation:

- reuses `ProductionCapacityService` for direct-material capacity;
- reuses `ComponentCapacityService` for every immediate component line;
- uses the existing Product-component listing boundary;
- supports direct-material-only, component-only, and mixed Products;
- preserves `ready | partial | not-ready` readiness;
- preserves known diagnostic capacity evidence when final capacity cannot be published;
- protects against duplicate/corrupted component sources;
- preserves deterministic component ordering;
- wires `assemblyCapacitySynthesisService` into the shared application session.

No new repository or persisted derived-capacity source was added.

## Locked direct-material applicability contract

The direct-material side is neutral only for the strict Phase 2 no-requirements shape:

```text
materials.length = 0
produciblePieces = null
requirementStatus = not-ready
exactly one issue = UPSTREAM_REQUIREMENT_ISSUE(NO_REQUIREMENTS)
```

This permits legitimate component-only Products.

Any other direct-material failure remains blocking.

## Readiness contract

### Ready

All applicable resources are reliable, at least one capacity candidate exists, and all candidates are finite non-negative integers.

### Partial

Meaningful diagnostic capacity evidence exists but at least one required resource is unresolved. Final overall capacity remains `null`.

### Not ready

No reliable capacity evidence exists, or the Product has no capacity resources.

## Capacity candidate rules

- ready applicable Phase 2.4C `produciblePieces` is a candidate;
- each ready 3.4A `capacityPieces` is a candidate;
- neutral direct materials contribute no candidate and do not block readiness;
- zero is authoritative;
- invalid/non-finite candidates are rejected defensively;
- final overall capacity is published only when all required sources are reliable.

## Integrity contract

Immediate components use existing `validateProductComponentSourceUniqueness()` validation before synthesis. No graph rules are reimplemented.

## 3.4C boundary preserved

3.4B intentionally does not create final typed limiting-resource identities or tie output across:

```text
material requirement
material-backed component
product-backed component
```

Phase 2's nested `limitingMaterialIds` remains preserved as upstream evidence only.

Final cross-category limiting-resource trace remains 3.4C.

## Validation evidence

```text
Dedicated 3.4B tests        27
Repository test files        50 passed
Repository tests             551 passed
TypeScript typecheck         PASS
Production build             PASS

Fully wired feature CI       34920239411 — SUCCESS
Final feature-head CI        34920325840 — SUCCESS
PR #81 CI                    34920392445 — SUCCESS
Post-merge develop CI        34920455875 — SUCCESS
```

Exact post-merge validation commit:

`c598eb81b1521e63773c163f6aef1a3004cafbdb`

## Completion gate

All planning and implementation gates passed:

- dedicated scope review completed before coding;
- no deeper split required;
- strict scope maintained;
- direct/component synthesis implemented;
- component-only behavior established safely;
- unresolved-resource semantics validated;
- duplicate-source corruption guarded;
- 3.4C boundary preserved;
- focused/full tests, typecheck, and build passed;
- implementation PR merged;
- exact post-merge `develop` CI passed.

## Next task

**3.4C — Limiting Resource Trace & Readiness — NEXT / NOT STARTED**

Do not begin 3.4C until a dedicated development plan/scope review is established.
