# Production planning UI and UX assessment

The React/TypeScript application already separates production rules from presentation through application services. Capacity, physical batch costs, pricing, and recursive component costs have extensive regression coverage. The production page, however, presented these layers as a long diagnostic report: repeated limiter panels, development-phase terminology, wide tables, and no actionable empty-workshop state.

The assessment also found that an invalid quantity could leave a cancelled estimate in a loading state, old figures could remain visible during a new request, and catalog loading errors had no recovery UI.

## Implemented experience

- A batch setup panel with quantity presets and an explicit **Use current capacity** action. Requests remain unchanged until the user edits them or chooses an action.
- Three views: **Batch overview**, **Materials to prepare**, and **Cost details**. Existing calculation evidence remains accessible without occupying the initial overview.
- Capacity status comes first, followed by cost, revenue, profit, and margin. Partial financial values are identified prominently; negative and unavailable values retain their meaning.
- Preparation tables show per-line stock shortages, distinguish unknown stock from zero, and reveal technical calculation columns on demand.
- Product setup guidance, catalog and estimate retries, accessible input errors, status announcements, keyboard focus styles, and responsive layouts.
- Request-matched results and cancellation prevent a prior request from being presented as the current estimate.

No domain formulas, persisted contracts, inventory writes, or production execution actions changed. This screen remains an advisory planner. The added jsdom development dependency enables real React interaction tests against the existing application services.

## Validation

- TypeScript check and production Vite build passed.
- Full regression suite: **112 test files / 1,312 tests passed**.
- Ten new tests cover setup and error recovery, view controls, shortage calculations, table column alignment, explicit capacity changes, unchanged source data, invalid and zero quantities, late responses, partial financials, and missing versus zero component stock.
- The production build reports a chunk-size warning (approximately 1,097 kB for the main JavaScript bundle); bundle splitting is outside this production-screen change.

The supplied ChatGPT share could not be retrieved, and no browser connection was available. Implementation therefore follows the assessed project workflow rather than claiming fidelity to that reference. DOM interaction checks passed; visual verification in a real browser remains outstanding.
