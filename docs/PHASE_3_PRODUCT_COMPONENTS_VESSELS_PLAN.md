# Craft Business Manager — Phase 3 Product Components, Vessels & Nested Molded Products Plan

## Status

**PLANNING COMPLETE — IMPLEMENTATION NOT STARTED**

Authoritative planning base:

`develop` @ `a3c10579231b04b5fab3698e62c9b1639b4b4f4a`

Phase 1 — Materials, Units & Calibration and Phase 2 — Product Recipes & Mold Yield are complete prerequisites.

---

# Phase 3 Objective

Extend the Phase 2 product model from direct-material production into real sellable product composition.

Phase 3 must answer these questions reliably:

- Which discrete components are required by one sellable parent product?
- Is a component a purchased stocked item or another product made by this business?
- Can a purchased glass/plastic/stainless vessel participate in the same composition as a handmade plaster pot?
- Can one parent contain several different molded child products and quantities?
- What is the component-aware material cost of one parent product?
- How many parents can currently be assembled from direct-material inventory plus discrete component inventory?
- Which material or component is the limiting resource?
- Can products be nested safely without direct or indirect circular composition?

The Phase 3 model must remain storage-agnostic. Excel persistence remains Phase 5.

---

# Business Cases Phase 3 Must Support

## Purchased vessel candle

```text
Scented Candle
├── Phase 2 direct requirements
│   ├── wax
│   ├── fragrance
│   └── wick
└── Phase 3 component
    └── glass cup × 1        [material-backed vessel]
```

The glass cup is a stocked Material, normally count-based, and is not flattened into the candle's consumable recipe.

## Handmade plaster-pot candle

```text
Candle Product
├── Phase 2 direct requirements
│   ├── wax
│   └── wick
└── Phase 3 component
    └── Plaster Pot × 1      [product-backed vessel]

Plaster Pot
└── its own Phase 2 recipe/yield/cost
```

The pot remains an independent Product. It can be sold separately, stocked as a finished component, and reused by one or many parent candles.

## Multi-component candle/display

```text
Event Candle Set
├── Glass Cup × 1            [material-backed vessel]
├── Mini Heart × 3           [product-backed molded component]
├── Mini Star × 2            [product-backed molded component]
└── Mini Flower × 4          [product-backed molded component]
```

Example component stock:

```text
Mini Heart  = 30 pc -> parent capacity 10
Mini Star   = 20 pc -> parent capacity 10
Mini Flower = 40 pc -> parent capacity 10
Glass Cup   = 50 pc -> parent capacity 50
```

All three molded components are tied limiting resources at 10 parent products before considering the parent's own Phase 2 direct-material capacity.

## Nested product depth

A product-backed component may itself contain components.

Example:

```text
Gift Box
└── Candle × 2
    └── Handmade Pot × 1
```

Recursive cost roll-up must support this safely. Composition cycles must never be allowed.

---

# Core Phase 3 Modeling Decision

Phase 3 needs a typed composition graph rather than another flat material recipe.

There are two component source kinds:

```text
material-backed component
- source is a Material
- typical use: purchased glass/plastic/stainless vessel
- availability comes from normalized Material on-hand inventory
- cost comes from Phase 1 material costing

product-backed component
- source is another Product
- typical use: handmade plaster pot, molded heart/star/flower, subassembly
- availability comes from explicit finished-product/component stock
- cost is recursively rolled up from the child Product
```

A component is discrete physical inventory. Phase 3 component quantities therefore use positive whole-piece counts.

Continuous consumables such as wax, plaster, paint, fragrance, or water remain Phase 2 recipe/yield requirements rather than Phase 3 component lines.

---

# Finished Component Stock Policy

Phase 3 introduces a lightweight count-based finished-product stock source for product-backed components.

Recommended source contract:

```text
ProductStock
- productId
- onHandQuantity: whole pc >= 0
- notes?
```

This is current-state source data, analogous to Material.onHandQuantity.

Initial Phase 3 capacity semantics are **assembly capacity**:

- material-backed component availability uses Material stock;
- product-backed component availability uses finished ProductStock;
- parent direct-material capacity continues to use Phase 2.4C;
- overall parent capacity is the minimum reliable capacity across both direct materials and components.

Phase 3 does **not** automatically manufacture missing child components from shared raw materials during the parent-capacity calculation.

That restriction is intentional because recursively adding child buildable capacity to child on-hand stock can double-count shared raw materials unless the entire nested production plan is exploded and consolidated first.

A future recursive make-to-order optimizer may add a separate "buildable from raw materials" view, but it must not be mixed silently with current assembly capacity.

Inventory reservation, transactions, and automatic stock deduction remain outside Phase 3.

---

# Cost Roll-Up Policy

Component cost is derived and must not be persisted as stale authoritative data.

## Material-backed component

```text
component unit cost
= material cost per pc

parent contribution
= component unit cost × quantity per parent
```

The referenced material must resolve to a discrete count base unit (`pc`) for Phase 3 component semantics.

## Product-backed component

A child Product's component-aware cost is recursively derived from:

```text
child Phase 2 direct-material cost
+
child Phase 3 component costs
```

Then:

```text
parent child-product contribution
= child component-aware unit cost × quantity per parent
```

Safety waste remains a production-planning reserve, not a permanent markup on the child's base unit cost.

Labor, overhead, selling price, markup, margin, and profit remain Phase 4.

---

# Composition Graph Rules

Product-backed composition forms a directed graph.

Phase 3 must reject:

```text
A -> A
A -> B -> A
A -> B -> C -> A
```

Cycle detection must validate the proposed full graph before a relationship is saved.

The graph may otherwise have arbitrary finite acyclic depth. Recursive cost/tree traversal must keep a visited/path guard even after write-time validation so corrupted imported data cannot cause infinite recursion later.

An active parent may reference only active component sources.

Historical/archived parents may retain references to archived child products/materials for inspection.

Archiving a material or Product that is still required by an active parent component must be blocked until the active dependency is removed/replaced or the parent is archived.

---

# Product Component Contract

Recommended authoritative source contract:

```text
ProductComponent
- id
- parentProductId
- sourceType: material | product
- sourceId
- role
- quantityPerParent
- notes?
```

Recommended roles:

- `vessel`
- `molded-component`
- `decorative-component`
- `insert`
- `accessory`
- `other`

Rules:

- `quantityPerParent` must be a positive finite integer;
- parent/source IDs must be non-blank;
- a Product may not reference itself directly or indirectly;
- material-backed sources must be discrete/count-based (`pc`);
- product-backed sources reference a different Product;
- one active composition line per parent/source-kind/source identity is the Phase 3 baseline; combine quantities instead of storing duplicate lines;
- source data never stores derived cost or capacity.

Component role is structural/semantic and does not change cost mathematics by itself.

---

# Recommended Phase 3 Breakdown

```text
Phase 3 — Product Components, Vessels & Nested Molded Products
│
├── 3.1 — Composition Foundation
│   ├── 3.1A — Product Component Contract & Roles
│   ├── 3.1B — Composition Graph Integrity & Cycle Prevention
│   └── 3.1C — Component Repository & Application Services
│
├── 3.2 — Finished Component Stock
│   ├── 3.2A — Product Stock Contract & Validation
│   ├── 3.2B — Product Stock Repository & Services
│   └── 3.2C — Component Source Availability & Relationship Guards
│
├── 3.3 — Component-Aware Cost Roll-Up
│   ├── 3.3A — Material-Backed Component Cost
│   ├── 3.3B — Recursive Product-Backed Component Cost
│   └── 3.3C — Total Component-Aware Product Cost & Readiness
│
├── 3.4 — Component-Limited Assembly Capacity
│   ├── 3.4A — Per-Component Availability & Capacity
│   ├── 3.4B — Direct-Material + Component Capacity Synthesis
│   └── 3.4C — Limiting Resource Trace & Readiness
│
├── 3.5 — Component / Stock / Production UI
│   ├── 3.5A — Product Composition Editor
│   ├── 3.5B — Finished Component Stock UI
│   └── 3.5C — Component-Aware Production Estimate UI
│
└── 3.6 — Integration & Completion Gate
    ├── 3.6A — Integrated Multi-Component Workflow
    └── 3.6B — Regression, Build & Phase 3 Completion
```

The split is recommended. No deeper split is required before implementation unless a sub-phase exposes a new domain constraint.

---

# 3.1 — Composition Foundation

## 3.1A — Product Component Contract & Roles

Create the dedicated `ProductComponent` domain contract and runtime validator.

Deliver:

- source-kind union (`material | product`);
- structural roles;
- positive whole-count `quantityPerParent`;
- normalized IDs/notes;
- deterministic clone/equality helpers as needed;
- duplicate-source identity policy;
- tests for malformed source/type/quantity/role records.

Do not implement recursion/cost/capacity yet.

### Completion gate

- component source facts are explicit and storage-agnostic;
- derived cost/capacity is excluded;
- count/discrete semantics are enforced;
- Phase 2 recipe materials remain separate.

---

## 3.1B — Composition Graph Integrity & Cycle Prevention

Implement graph-level product relationship validation.

Deliver:

- direct self-reference rejection;
- transitive cycle detection;
- deterministic traversal/path reporting;
- duplicate source protection across a parent composition;
- corrupted-data traversal guard for future recursive services;
- tests for deep acyclic and cyclic graphs.

Example rejected graph:

```text
A -> B
B -> C
C -> A   X
```

### Completion gate

- no saved active composition can introduce a cycle;
- validation identifies the problematic path/source;
- deep valid nesting remains supported.

---

## 3.1C — Component Repository & Application Services

Follow the existing repository/service architecture.

Deliver operations:

- create/update/remove component lines;
- get/list by parent;
- search/filter where useful;
- parent/source identity validation;
- active relationship validation;
- dependency guards for Product/Material archive operations;
- defensive cloning;
- shared application-session wiring.

`BusinessDataset` gains `productComponents` as source data.

### Completion gate

- component CRUD is testable without React;
- active parents cannot depend on invalid/archived sources;
- source archive cannot silently break active parent compositions;
- storage implementation does not leak into domain logic.

---

# 3.2 — Finished Component Stock

## 3.2A — Product Stock Contract & Validation

Introduce current finished-product/component stock.

Recommended contract:

```text
ProductStock
- productId
- onHandQuantity
- notes?
```

Rules:

- one stock record per Product;
- `onHandQuantity` is a finite non-negative integer;
- unit is implicitly `pc` and is not user-selectable;
- stock is source data, not derived from raw-material capacity;
- archived Product stock remains inspectable but is not valid for new active parent dependencies.

### Completion gate

- zero stock is valid;
- fractional/negative/non-finite stock is rejected;
- Product identity is validated.

---

## 3.2B — Product Stock Repository & Services

Deliver:

- set/update current on-hand quantity;
- retrieve by Product;
- list/filter;
- preserve stock when Product is archived for history;
- defensive repository behavior;
- shared session wiring.

`BusinessDataset` gains `productStocks`.

No stock transactions, reservations, automatic deductions, or production history are introduced.

---

## 3.2C — Component Source Availability & Relationship Guards

Define one application resolver that answers current availability for either source type.

Material-backed component:

- reference active Material;
- require canonical base unit `pc`;
- normalize on-hand through Phase 1 inventory rules;
- preserve inventory conversion/readiness evidence.

Product-backed component:

- reference active child Product;
- retrieve `ProductStock.onHandQuantity`;
- missing ProductStock means unresolved availability, not silently zero, unless an explicit zero stock record exists.

### Completion gate

- availability has one controlled ready/partial/not-ready contract;
- zero stock is distinguishable from missing stock data;
- active dependency guards work across source types.

---

# 3.3 — Component-Aware Cost Roll-Up

## 3.3A — Material-Backed Component Cost

Use Phase 1 material costing for purchased discrete components.

Deliver per line:

- source material identity/name;
- quantity per parent;
- cost per pc;
- component cost contribution;
- package/cost conversion source traceability;
- readiness/issues.

Reject material-backed components whose current Material cost basis cannot be resolved.

---

## 3.3B — Recursive Product-Backed Component Cost

Derive child Product cost recursively.

For each child:

```text
child component-aware unit cost
= child Phase 2 direct-material cost
+ child Phase 3 component cost
```

Then multiply by the quantity required by the parent.

Deliver:

- recursive breakdown tree;
- child Product IDs/names;
- quantity multiplier at each edge;
- leaf material/component costs;
- path/cycle guard even for corrupted data;
- readiness propagation from unresolved child direct requirements/components.

No labor/overhead/selling-price rules are introduced.

---

## 3.3C — Total Component-Aware Product Cost & Readiness

Create one derived cost view:

```text
Phase 2 direct-material cost
+
Phase 3 component contributions
=
component-aware product material/component cost
```

Support `ready`, `partial`, and `not-ready` states consistent with Phase 2.

The result is derived only and must not be persisted as an authoritative cached cost.

This becomes the material/component cost input for Phase 4 pricing.

---

# 3.4 — Component-Limited Assembly Capacity

## 3.4A — Per-Component Availability & Capacity

For each component line:

```text
component parent capacity
= floor(available component quantity / quantityPerParent)
```

Material-backed availability comes from Material inventory.

Product-backed availability comes from ProductStock.

Report exact source, current available quantity, quantity per parent, capacity, and readiness.

---

## 3.4B — Direct-Material + Component Capacity Synthesis

Combine:

1. Phase 2.4C direct-material capacity; and
2. all Phase 3 component capacities.

When every required resource is reliable:

```text
overall assembly capacity
= min(direct-material capacity, all component capacities)
```

A product with valid component-only composition may still have an assembly capacity even if it has no Phase 2 direct-material requirements.

If any required resource is unresolved, retain diagnostic known capacities but do not publish a misleading final overall capacity.

---

## 3.4C — Limiting Resource Trace & Readiness

Report every resource tied at the minimum.

Limiting resources require typed identity rather than only a Material ID:

```text
material requirement
material-backed component
product-backed component
```

Example:

```text
capacity = 10
limiting resources:
- Mini Heart product component
- Mini Star product component
- Mini Flower product component
```

For nested cost/composition inspection, preserve a component path such as:

```text
Gift Box > Candle > Handmade Pot
```

Overall capacity is based on the parent's current assembly inputs, not recursive manufacture of missing child stock.

---

# 3.5 — Component / Stock / Production UI

## 3.5A — Product Composition Editor

Extend the Products workspace with a Components view.

Support:

- add/edit/remove component lines;
- choose Material or Product source type;
- source selector filtered to valid active candidates;
- role selector;
- positive whole quantity per parent;
- readable composition summary;
- cycle/error feedback;
- nested composition preview.

Do not let the UI bypass ComponentService validation.

---

## 3.5B — Finished Component Stock UI

Expose current ProductStock for products used as child components.

Support:

- product selector/list;
- current finished `pc` on hand;
- edit/set stock;
- explicit missing-vs-zero state;
- active/archive visibility;
- no transaction history yet.

---

## 3.5C — Component-Aware Production Estimate UI

Extend Production with:

- component-aware total cost;
- purchased/material component requirements;
- child-product component requirements;
- component stock/availability;
- per-component capacity;
- overall direct-material + component assembly capacity;
- all limiting resources;
- nested cost path/breakdown;
- readiness issues.

The screen must clearly distinguish:

```text
Direct materials required to make the parent
vs
Discrete components required to assemble the parent
```

---

# 3.6 — Integration & Completion Gate

## 3.6A — Integrated Multi-Component Workflow

Validate at least these end-to-end scenarios:

### Scenario A — Purchased vessel candle

```text
Candle direct recipe + Glass Cup ×1
```

Verify:

- glass inventory/cost integration;
- total cost roll-up;
- parent capacity limited by cup stock when appropriate.

### Scenario B — Handmade pot candle

```text
Candle + Plaster Pot Product ×1
```

Verify:

- child product cost roll-up;
- child ProductStock capacity;
- parent direct materials and child stock combine correctly.

### Scenario C — Multi-mold event set

```text
Glass Cup ×1
Mini Heart ×3
Mini Star ×2
Mini Flower ×4
```

Verify tied limiting child components and total cost.

### Scenario D — Nested composition

```text
Gift Set > Candle > Handmade Pot
```

Verify recursive cost and cycle-safe traversal.

### Scenario E — invalid cycle

Ensure a proposed relationship that closes a transitive cycle is rejected before persistence.

---

## 3.6B — Regression, Build & Phase 3 Completion

Final gate:

- all Phase 1/2 regressions remain green;
- all Phase 3 domain/application/integration tests pass;
- React smoke coverage includes component and component-aware Production paths;
- TypeScript typecheck passes;
- production build passes;
- exact merged `develop` CI passes;
- global roadmap/documentation is reconciled.

---

# Explicit Phase Boundaries

Phase 3 DOES include:

- purchased discrete vessels/components;
- handmade/product-backed components;
- nested product composition;
- cycle prevention;
- finished component stock counts;
- recursive component-aware cost roll-up;
- assembly capacity limited by direct materials and current component stock;
- component-aware UI and Production estimates.

Phase 3 DOES NOT include:

- labor or overhead costing;
- selling price, markup, margin, revenue, or profit — Phase 4;
- Excel persistence/import/export — Phase 5;
- Tauri filesystem integration — Phase 6;
- inventory reservations or automatic stock deductions;
- stock movement/transaction history;
- recursive automatic manufacturing of missing child components from shared raw materials;
- procurement/reorder automation.

---

# Locked Phase 3 Rules

1. A component is discrete and its quantity per parent is a positive whole piece count.
2. Component sources are explicitly typed as Material-backed or Product-backed.
3. Material-backed component sources must resolve to `pc` inventory.
4. Product-backed components use explicit finished ProductStock for assembly availability.
5. Missing ProductStock is unresolved; an explicit `0` record means zero available.
6. Active parents may reference only active sources.
7. Direct and transitive product-composition cycles are prohibited.
8. Recursive readers still retain cycle/path guards for corrupted/imported data.
9. Child-product cost is recursively derived; no derived component cost is persisted.
10. Phase 2 direct-material cost and Phase 3 component cost remain distinguishable and then synthesize into one component-aware product cost.
11. Parent assembly capacity uses current direct-material availability plus current component availability.
12. Overall assembly capacity is published only when every required resource is reliable.
13. All tied limiting resources are preserved with typed identity.
14. Parent assembly capacity does not silently include hypothetical manufacture of missing child stock.
15. Inventory reservation/deduction is not part of Phase 3.

---

# First Implementation Task After Planning

**3.1A — Product Component Contract & Roles**

Do not begin 3.1B until 3.1A is merged and post-merge `develop` CI is green.
