import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  componentAwareProductCostService,
  materialService,
  plannedBatchCapacityFeasibilityService,
  productService,
  productionRequirementService,
} from '../../application/session';
import type { ComponentAwareProductCostResult } from '../../application/productComponents/ComponentAwareProductCostService';
import type { AssemblyCapacityTraceResult } from '../../application/production/AssemblyCapacityTraceService';
import type { PlannedBatchCapacityFeasibilityResult } from '../../application/production/PlannedBatchCapacityFeasibilityService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import {
  buildComponentCostBreakdownRows,
  buildComponentRequirementRows,
  buildLimitingResourceRows,
  buildProductionIssueRows,
} from './componentAwareProductionView';
import { ProductionFinancialSummary } from './ProductionFinancialSummary';
import { ProductionProductSearchPicker } from './ProductionProductSearchPicker';
import { capacityPlan, parsePlannedQuantity, stockShortfall } from './productionPlanningView';
import { AppIcon } from '../icons/AppIcon';
import './production.css';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

function number(value: number, maximumFractionDigits = 4): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Production estimate could not be calculated.';
}

function statusLabel(status: 'ready' | 'partial' | 'not-ready'): string {
  return status === 'not-ready' ? 'Not ready' : status[0].toUpperCase() + status.slice(1);
}

function roleLabel(role: string): string {
  return role.replaceAll('-', ' ');
}

function sourceTypeLabel(sourceType: 'material' | 'product'): string {
  return sourceType === 'material' ? 'Material component' : 'Product component';
}

export function ProductionPage({ onOpenProducts }: { onOpenProducts: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productId, setProductId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('1');
  const [estimate, setEstimate] = useState<{
    productId: string;
    quantity: number;
    plan: ProductionRequirementPlanResult;
    cost: ComponentAwareProductCostResult;
    feasibility: PlannedBatchCapacityFeasibilityResult;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ productId: string; quantity: number; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<'overview' | 'preparation' | 'details'>('overview');
  const [showCalculations, setShowCalculations] = useState(false);

  const reloadMasters = useCallback(async () => {
    setLoading(true);
    setMasterError(null);
    try {
      const [nextProducts, nextMaterials] = await Promise.all([
        productService.listProducts(),
        materialService.listMaterials(),
      ]);
      setProducts(nextProducts);
      setMaterials(nextMaterials);
      setProductId((current) => {
        if (current && nextProducts.some((product) => product.id === current)) return current;
        return nextProducts.find((product) => product.isActive)?.id ?? nextProducts[0]?.id ?? '';
      });
    } catch (error) {
      setMasterError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadMasters();
  }, [reloadMasters]);

  const parsedQuantity = parsePlannedQuantity(plannedQuantity);
  const quantityValid = parsedQuantity !== null;
  const quantity = parsedQuantity ?? 0;
  // Match results to the visible request, including the render before its effect runs.
  const currentEstimate =
    quantityValid && estimate?.productId === productId && estimate.quantity === quantity ? estimate : null;
  const feedback =
    quantityValid && failure?.productId === productId && failure.quantity === quantity ? failure.message : null;
  const estimating = Boolean(productId && quantityValid && !currentEstimate && !feedback);
  const plan = currentEstimate?.plan ?? null;
  const componentCost = currentEstimate?.cost ?? null;
  const batchFeasibility = currentEstimate?.feasibility ?? null;
  const capacityTrace: AssemblyCapacityTraceResult | null = batchFeasibility?.capacityTrace ?? null;
  const currentCapacityPlan = capacityPlan(batchFeasibility);

  useEffect(() => {
    setEstimate(null);
    setFailure(null);
    if (!productId || !quantityValid) return;

    let cancelled = false;
    void Promise.all([
      productionRequirementService.plan(productId, quantity),
      componentAwareProductCostService.costProduct(productId),
      plannedBatchCapacityFeasibilityService.assessBatch(productId, quantity),
    ])
      .then(([nextPlan, nextCost, nextBatchFeasibility]) => {
        if (!cancelled)
          setEstimate({ productId, quantity, plan: nextPlan, cost: nextCost, feasibility: nextBatchFeasibility });
      })
      .catch((error) => {
        if (!cancelled) setFailure({ productId, quantity, message: errorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [productId, quantity, quantityValid, retry]);

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id.toLocaleLowerCase(), material])),
    [materials],
  );
  const directCapacity = capacityTrace?.capacitySynthesis.directMaterialCapacity ?? null;
  const directCost = componentCost?.directMaterialCost ?? null;
  const directCapacityById = useMemo(
    () => new Map((directCapacity?.materials ?? []).map((entry) => [entry.materialId.toLocaleLowerCase(), entry])),
    [directCapacity],
  );
  const directCostById = useMemo(
    () => new Map((directCost?.lines ?? []).map((line) => [line.materialId.toLocaleLowerCase(), line])),
    [directCost],
  );

  const componentRows = useMemo(
    () =>
      buildComponentRequirementRows(componentCost, capacityTrace, quantityValid ? quantity : 0, materials, products),
    [componentCost, capacityTrace, quantity, quantityValid, materials, products],
  );
  const costBreakdownRows = useMemo(
    () => buildComponentCostBreakdownRows(componentCost, materials, products),
    [componentCost, materials, products],
  );
  const limitingRows = useMemo(() => buildLimitingResourceRows(capacityTrace), [capacityTrace]);
  const allIssues = useMemo(
    () => buildProductionIssueRows(plan, componentCost, capacityTrace),
    [plan, componentCost, capacityTrace],
  );

  const directBatchKnownCost = plan
    ? plan.requirements.reduce((total, requirement) => {
        const cost = directCostById.get(requirement.materialId.toLocaleLowerCase());
        return total + (cost ? cost.costPerBaseUnit * requirement.plannedBatchBaseQuantity : 0);
      }, 0)
    : 0;
  const directBatchComplete = Boolean(
    plan &&
    directCost?.status === 'ready' &&
    plan.requirements.every((requirement) => directCostById.has(requirement.materialId.toLocaleLowerCase())),
  );
  const componentBatchKnownCost = componentRows.reduce((total, row) => total + (row.plannedCostContribution ?? 0), 0);
  const componentBatchComplete = componentRows.every(
    (row) => row.costStatus === 'ready' && row.plannedCostContribution !== null,
  );
  const plannedInputCost =
    plan && componentCost && componentCost.totalComponentAwareCost !== null
      ? directBatchKnownCost + componentBatchKnownCost
      : null;
  const plannedInputCostComplete = Boolean(
    plannedInputCost !== null && componentCost?.status === 'ready' && directBatchComplete && componentBatchComplete,
  );
  const componentOnlyParent = Boolean(
    plan &&
    plan.requirements.length === 0 &&
    capacityTrace &&
    !capacityTrace.capacitySynthesis.directMaterialApplicable &&
    capacityTrace.capacitySynthesis.componentCapacities.length > 0,
  );

  return (
    <section className="materials-workspace production-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">WORKSHOP / PRODUCTION</p>
          <h1>Plan your next batch</h1>
          <p className="page-lead">Choose a product, set your quantity, and see what it takes to make it.</p>
        </div>
        <div className="session-badge">Planning only - stock stays unchanged</div>
      </div>

      {loading ? (
        <div className="panel production-page-state" role="status">
          Loading products and materials...
        </div>
      ) : masterError ? (
        <div className="panel production-page-state" role="alert">
          <h2>Could not load your workshop</h2>
          <p>{masterError}</p>
          <button type="button" className="button button-primary" onClick={() => void reloadMasters()}>
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="panel production-page-state">
          <p className="panel-kicker">YOUR FIRST BATCH STARTS HERE</p>
          <h2>Add a product to start planning</h2>
          <p>Set up a product and its recipe or assembly components, then return here to check costs and stock.</p>
          <button type="button" className="button button-primary" onClick={onOpenProducts}>
            Go to Products
          </button>
        </div>
      ) : (
        <>
          <section className="panel production-controls" aria-label="Batch setup">
            <div className="production-controls-heading">
              <span className="production-step">01</span>
              <div>
                <h2>Set up your batch</h2>
                <p>Estimates update as you plan.</p>
              </div>
            </div>
            <ProductionProductSearchPicker
              products={products}
              selectedProductId={productId}
              disabled={loading || products.length === 0}
              onSelect={setProductId}
            />
            <label className="field">
              <span>Planned finished pieces</span>
              <input
                type="number"
                aria-invalid={!quantityValid}
                aria-describedby={quantityValid ? 'quantity-help' : 'quantity-help quantity-error'}
                min="0"
                step="1"
                value={plannedQuantity}
                disabled={!productId}
                onChange={(event) => setPlannedQuantity(event.target.value)}
              />
              <small id="quantity-help">Enter a whole number, including zero to explore costs.</small>
            </label>
            <div className="production-quantity-actions" aria-label="Quantity shortcuts">
              <span>Quick quantities</span>
              <div>
                {[10, 25, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={quantityValid && quantity === amount}
                    onClick={() => setPlannedQuantity(String(amount))}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <button
                className="production-capacity-action"
                type="button"
                disabled={!currentCapacityPlan}
                onClick={() => currentCapacityPlan && setPlannedQuantity(String(currentCapacityPlan.capacity))}
              >
                Use current capacity{currentCapacityPlan ? ` - ${number(currentCapacityPlan.capacity)} pc` : ''}
              </button>
            </div>
            <div className="production-context">
              <strong>{selectedProduct?.name ?? 'Select a product'}</strong>
              <span>
                {selectedProduct
                  ? `${selectedProduct.category} · ${selectedProduct.isActive ? 'active' : 'archived'}`
                  : 'Production estimates require a product.'}
              </span>
            </div>
          </section>

          {!quantityValid && productId && (
            <div id="quantity-error" role="alert" className="feedback feedback-error">
              Enter a non-negative whole number within the supported range.
            </div>
          )}
          {feedback && (
            <div className="feedback feedback-error" role="alert">
              {feedback}{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setFailure(null);
                  setRetry((value) => value + 1);
                }}
              >
                Retry estimate
              </button>
            </div>
          )}
          {selectedProduct && !selectedProduct.isActive && (
            <p className="production-warning">
              This product is archived. You can still explore its production estimate.
            </p>
          )}
          <p className="sr-only" role="status">
            {estimating
              ? 'Updating batch estimate.'
              : batchFeasibility
                ? `Estimate updated for ${batchFeasibility.productName}, ${batchFeasibility.plannedQuantity} pieces.`
                : 'Enter a valid quantity to see an estimate.'}
          </p>
          <nav className="production-view-nav" aria-label="Production plan views">
            {(
              [
                { id: 'overview', label: 'Batch overview', step: '02' },
                { id: 'preparation', label: 'Materials to prepare', step: '03' },
                { id: 'details', label: 'Cost details', step: '04' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                aria-controls={`production-${item.id}`}
                onClick={() => setView(item.id)}
              >
                <span>{item.step}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div id="production-overview" hidden={view !== 'overview'} aria-busy={estimating}>
            <ProductionFinancialSummary
              result={batchFeasibility}
              loading={estimating}
              onPrepare={() => setView('preparation')}
            />
          </div>
          <div
            id="production-details"
            className="production-view-content"
            hidden={view !== 'details'}
            aria-busy={estimating}
          >
            <div className="production-phase3-divider">
              <span>INPUT COST AT A GLANCE</span>
              <p>
                Material and component costs before labor, overhead, and pricing. Partial estimates are labeled below.
              </p>
            </div>

            <div className="production-summary-grid production-summary-grid-phase3">
              <article className="panel production-summary-card">
                <span>Production readiness</span>
                <strong>{capacityTrace ? statusLabel(capacityTrace.status) : estimating ? 'Calculating…' : '—'}</strong>
                <small>
                  {componentCost ? `Cost: ${statusLabel(componentCost.status)}` : 'Assembly capacity + cost readiness'}
                </small>
              </article>
              <article className="panel production-summary-card">
                <span>Assembly capacity</span>
                <strong>
                  {capacityTrace?.status === 'ready' ? (capacityTrace.overallAssemblyCapacity ?? '—') : '—'}
                </strong>
                <small>
                  {capacityTrace
                    ? `${statusLabel(capacityTrace.status)} · direct materials + current component stock`
                    : 'Current parent pieces assemblable'}
                </small>
              </article>
              <article className="panel production-summary-card">
                <span>Limiting resources</span>
                <strong className="summary-text">
                  {limitingRows.length ? limitingRows.map((row) => row.sourceName).join(', ') : '—'}
                </strong>
                <small>
                  {capacityTrace?.status === 'ready'
                    ? `${limitingRows.length} tied at the final minimum`
                    : 'Published only with reliable final assembly capacity'}
                </small>
              </article>
              <article className="panel production-summary-card">
                <span>Component-aware cost / product</span>
                <strong>
                  {componentCost?.totalComponentAwareCost !== null &&
                  componentCost?.totalComponentAwareCost !== undefined
                    ? peso.format(componentCost.totalComponentAwareCost)
                    : '—'}
                </strong>
                <small>
                  {componentCost
                    ? componentCost.status === 'ready'
                      ? 'Complete material + component input cost'
                      : `${statusLabel(componentCost.status)} · known subtotal only`
                    : 'Excludes labor, overhead, markup, and profit'}
                </small>
              </article>
              <article className="panel production-summary-card">
                <span>Planned input cost</span>
                <strong>{plannedInputCost !== null ? peso.format(plannedInputCost) : '—'}</strong>
                <small>
                  {plannedInputCost !== null
                    ? plannedInputCostComplete
                      ? 'Materials and components only'
                      : 'Known partial input subtotal'
                    : 'Excludes labor and overhead'}
                </small>
              </article>
            </div>

            <div className="production-detail-grid production-phase3-detail-grid">
              <section className="panel production-detail-card">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">COST BASIS</p>
                    <h2>Component-aware cost</h2>
                  </div>
                </div>
                {componentCost ? (
                  <div className="production-cost-list">
                    <div className="production-cost-total">
                      <span>Parent direct materials / product</span>
                      <strong>{peso.format(componentCost.directMaterialCostSubtotal)}</strong>
                    </div>
                    <div className="production-cost-total">
                      <span>Root discrete components / product</span>
                      <strong>{peso.format(componentCost.componentCostSubtotal)}</strong>
                    </div>
                    <div className="production-cost-total production-grand-total">
                      <span>Known component-aware total / product</span>
                      <strong>
                        {componentCost.totalComponentAwareCost !== null
                          ? peso.format(componentCost.totalComponentAwareCost)
                          : 'Unresolved'}
                      </strong>
                    </div>
                    <p className="production-cost-status">
                      Cost readiness: <strong>{statusLabel(componentCost.status)}</strong>
                      {componentCost.status === 'partial' ? ' — numeric totals are known partial subtotals.' : ''}
                    </p>
                  </div>
                ) : (
                  <p className="yield-notice">Component-aware cost has not been calculated yet.</p>
                )}
              </section>

              <section className="panel production-detail-card">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">READINESS</p>
                    <h2>Issues to resolve</h2>
                  </div>
                </div>
                {!currentEstimate ? (
                  <p className="yield-notice">
                    {estimating ? 'Checking requirements...' : 'Enter a valid batch to check readiness.'}
                  </p>
                ) : allIssues.length === 0 ? (
                  <div className="production-ready">
                    <strong>Ready</strong>
                    <span>No material, component, or stock issues were reported for this estimate.</span>
                  </div>
                ) : (
                  <ul className="production-issues">
                    {allIssues.map((issue, index) => (
                      <li key={`${issue.source}-${index}`}>
                        <strong>{issue.source}</strong>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {directCapacity?.skippedInvalidYieldSampleIds.length ? (
                  <p className="production-skipped">
                    Skipped newer invalid yield samples: {directCapacity.skippedInvalidYieldSampleIds.join(', ')}
                  </p>
                ) : null}
              </section>
            </div>

            <section className="panel production-nested-cost-panel">
              <div className="panel-heading list-heading">
                <div>
                  <p className="panel-kicker">RECURSIVE COST TRACE</p>
                  <h2>Nested component cost</h2>
                </div>
                <div className="material-count">
                  <strong>{costBreakdownRows.length}</strong>
                  <span>lines</span>
                </div>
              </div>
              <p className="production-section-help">
                Explore how each component contributes to this product input cost, including components used by other
                components.
              </p>
              {costBreakdownRows.length ? (
                <div className="nested-cost-list">
                  {costBreakdownRows.map((row, index) => (
                    <article
                      key={`${row.componentId}-${index}`}
                      className="nested-cost-row"
                      style={{ '--nested-depth': row.depth } as React.CSSProperties}
                    >
                      <div className="nested-cost-main">
                        <span className="component-kind-pill">{sourceTypeLabel(row.sourceType)}</span>
                        <strong>{row.sourceName}</strong>
                        <span className="component-role-pill">{roleLabel(row.role)}</span>
                      </div>
                      <span className="nested-cost-path">{row.pathLabel}</span>
                      <span>{number(row.quantityPerParent)} pc / parent</span>
                      <span>
                        {row.unitCost !== null ? `${peso.format(row.unitCost)} unit cost` : 'Unit cost unresolved'}
                      </span>
                      <strong>
                        {row.contribution !== null
                          ? `${peso.format(row.contribution)} contribution`
                          : 'Contribution unresolved'}
                      </strong>
                      <span className={`nested-status nested-status-${row.status}`}>{statusLabel(row.status)}</span>
                      {row.issues.length ? (
                        <small className="component-row-issue">{row.issues.join(' · ')}</small>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="yield-notice">No component cost breakdown is available for the selected Product.</p>
              )}
            </section>
          </div>
          <div
            id="production-preparation"
            className="production-view-content"
            hidden={view !== 'preparation'}
            aria-busy={estimating}
          >
            <div className="production-preparation-heading">
              <div>
                <p className="panel-kicker">PREPARATION LIST</p>
                <h2>Gather everything for your batch</h2>
                <p>
                  {quantityValid ? `${number(quantity)} finished pieces` : 'Enter a valid quantity'} - Check on-hand
                  stock and shortages before making.
                </p>
              </div>
              <label className="production-toggle">
                <input
                  type="checkbox"
                  checked={showCalculations}
                  onChange={(event) => setShowCalculations(event.target.checked)}
                />
                Show calculations
              </label>
            </div>
            <section className="panel material-list production-requirements-panel production-input-panel">
              <div className="production-section-marker direct-marker">DIRECT MATERIALS · MAKE THE PARENT</div>
              <div className="panel-heading list-heading">
                <div>
                  <p className="panel-kicker">PARENT-MAKING INPUTS</p>
                  <h2>Direct materials to prepare</h2>
                </div>
                <div className="material-count">
                  <strong>{plan?.requirements.length ?? 0}</strong>
                  <span>materials</span>
                </div>
              </div>
              <p className="production-section-help">
                Consumable recipe/yield requirements for making the parent. The parent Product&apos;s safety-waste
                reserve applies here.
              </p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable requirements table">
                {estimating ? (
                  <div className="empty-state">
                    <p>Calculating direct-material requirements…</p>
                  </div>
                ) : !plan || plan.requirements.length === 0 ? (
                  componentOnlyParent ? (
                    <div className="empty-state">
                      <div className="empty-icon" aria-hidden="true"><AppIcon name="check-circle" size={28} /></div>
                      <h3>No direct materials required for this parent</h3>
                      <p>Assembly depends on the discrete components in the next section.</p>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon" aria-hidden="true"><AppIcon name="materials" size={28} /></div>
                      <h3>No derivable direct-material requirements</h3>
                      <p>Review Cost details for recipe or yield issues if this product needs direct materials.</p>
                    </div>
                  )
                ) : (
                  <table role="table" className="responsive-table materials-table production-table">
                    <thead role="rowgroup">
                      <tr role="row">
                        <th role="columnheader" scope="col">Material</th>
                        {showCalculations && (
                          <>
                            <th role="columnheader" scope="col">Effective / piece</th>
                            <th role="columnheader" scope="col">Waste reserve</th>
                            <th role="columnheader" scope="col">Planned / piece</th>
                          </>
                        )}
                        <th role="columnheader" scope="col">Batch required</th>
                        <th role="columnheader" scope="col">On hand</th>
                        <th role="columnheader" scope="col">Still needed</th>
                        {showCalculations && <th role="columnheader" scope="col">Direct capacity</th>}
                        <th role="columnheader" scope="col">Batch cost</th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {plan.requirements.map((requirement) => {
                        const key = requirement.materialId.toLocaleLowerCase();
                        const material = materialById.get(key);
                        const inventory = directCapacityById.get(key);
                        const cost = directCostById.get(key);
                        const batchCost = cost ? cost.costPerBaseUnit * requirement.plannedBatchBaseQuantity : null;
                        return (
                          <tr role="row" key={requirement.materialId} className={inventory?.isLimiting ? 'limiting-row' : ''}>
                            <td role="cell" data-label="Material">
                              <strong>{material?.name ?? requirement.materialId}</strong>
                              <span className="material-id">
                                {requirement.materialId} · {requirement.source}
                              </span>
                            </td>
                            {showCalculations && (
                              <>
                                <td role="cell" data-label="Effective / piece">
                                  {number(requirement.effectiveBaseQuantityPerProduct)} {requirement.baseUnit}
                                </td>
                                <td role="cell" data-label="Waste reserve">
                                  +{number(requirement.wasteReserveBaseQuantityPerProduct)} {requirement.baseUnit}
                                </td>
                                <td role="cell" data-label="Planned / piece">
                                  <strong>
                                    {number(requirement.plannedBaseQuantityPerProduct)} {requirement.baseUnit}
                                  </strong>
                                </td>
                              </>
                            )}
                            <td role="cell" data-label="Batch required">
                              <strong>
                                {number(requirement.plannedBatchBaseQuantity)} {requirement.baseUnit}
                              </strong>
                            </td>
                            <td role="cell" data-label="On hand">
                              {inventory ? (
                                <>
                                  {number(inventory.normalizedOnHandBaseQuantity)} {inventory.baseUnit}
                                  <span className="material-id">
                                    entered {number(inventory.enteredOnHandQuantity)} {inventory.enteredOnHandUnit} ·{' '}
                                    {inventory.inventoryConversionSource}
                                  </span>
                                </>
                              ) : (
                                'Unresolved'
                              )}
                            </td>
                            <td role="cell" data-label="Still needed">
                              <StockShortfall
                                required={requirement.plannedBatchBaseQuantity}
                                available={inventory?.normalizedOnHandBaseQuantity}
                                unit={requirement.baseUnit}
                              />
                            </td>
                            {showCalculations && (
                              <td role="cell" data-label="Direct capacity">
                                {inventory ? (
                                  <>
                                    <strong>{inventory.capacityPieces}</strong>
                                    {inventory.isLimiting && <span className="capacity-limiter">Direct limiter</span>}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                            )}
                            <td role="cell" data-label="Batch cost">{batchCost !== null ? peso.format(batchCost) : 'Unpriced'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="list-footer">
                <span>Direct-material quantities include the parent safety-waste policy.</span>
                <span>
                  {plan?.effectiveYieldSampleId
                    ? `Yield: ${plan.effectiveYieldSampleId}`
                    : 'Fixed recipe or no effective yield sample'}
                </span>
              </div>
            </section>

            <section className="panel material-list production-requirements-panel production-input-panel component-input-panel">
              <div className="production-section-marker component-marker">
                DISCRETE COMPONENTS · ASSEMBLE THE PARENT
              </div>
              <div className="panel-heading list-heading">
                <div>
                  <p className="panel-kicker">ASSEMBLY INPUTS</p>
                  <h2>Components to prepare</h2>
                </div>
                <div className="material-count">
                  <strong>{componentRows.length}</strong>
                  <span>components</span>
                </div>
              </div>
              <p className="production-section-help">
                Whole-piece vessels, molded child Products, inserts, accessories, and other discrete inputs. Parent
                safety waste is not added to these counts.
              </p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable requirements table">
                {estimating ? (
                  <div className="empty-state">
                    <p>Calculating component requirements…</p>
                  </div>
                ) : !currentEstimate ? (
                  <div className="empty-state">
                    <h3>Requirements unavailable</h3>
                    <p>Enter a valid quantity or retry the estimate to check components.</p>
                  </div>
                ) : componentRows.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon" aria-hidden="true"><AppIcon name="component" size={28} /></div>
                    <h3>No discrete components</h3>
                    <p>This product has no assembly component requirements.</p>
                  </div>
                ) : (
                  <table role="table" className="responsive-table materials-table production-table component-requirements-table">
                    <thead role="rowgroup">
                      <tr role="row">
                        <th role="columnheader" scope="col">Component</th>
                        <th role="columnheader" scope="col">Role</th>
                        <th role="columnheader" scope="col">Per parent</th>
                        <th role="columnheader" scope="col">Planned batch</th>
                        <th role="columnheader" scope="col">Available</th>
                        <th role="columnheader" scope="col">Still needed</th>
                        {showCalculations && (
                          <>
                            <th role="columnheader" scope="col">Capacity</th>
                            <th role="columnheader" scope="col">Unit cost</th>
                          </>
                        )}
                        <th role="columnheader" scope="col">Planned component cost</th>
                        <th role="columnheader" scope="col">Readiness</th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {componentRows.map((row) => (
                        <tr role="row"
                          key={row.componentId}
                          className={
                            limitingRows.some(
                              (limiter) =>
                                limiter.sourceId.toLocaleLowerCase() === row.sourceId.toLocaleLowerCase() &&
                                limiter.resourceType !== 'material-requirement',
                            )
                              ? 'limiting-row'
                              : ''
                          }
                        >
                          <td role="cell" data-label="Component">
                            <strong>{row.sourceName}</strong>
                            <span className="material-id">{row.sourceId}</span>
                            <span className="component-kind-pill">{sourceTypeLabel(row.sourceType)}</span>
                          </td>
                          <td role="cell" data-label="Role">
                            <span className="component-role-pill">{roleLabel(row.role)}</span>
                          </td>
                          <td role="cell" data-label="Per parent">
                            <strong>{number(row.quantityPerParent)} pc</strong>
                          </td>
                          <td role="cell" data-label="Planned batch">
                            <strong>{number(row.plannedQuantity)} pc</strong>
                          </td>
                          <td role="cell" data-label="Available">
                            {row.availabilityState === 'missing' ? (
                              <strong className="component-state-missing">Stock not recorded</strong>
                            ) : row.availableQuantity !== null ? (
                              <strong>{number(row.availableQuantity)} pc</strong>
                            ) : (
                              <strong>Unresolved</strong>
                            )}
                            <span className="material-id">
                              {row.availabilityState === 'zero'
                                ? 'No stock on hand'
                                : statusLabel(row.availabilityStatus)}
                            </span>
                          </td>
                          <td role="cell" data-label="Still needed">
                            <StockShortfall
                              required={row.plannedQuantity}
                              available={row.availabilityStatus === 'ready' ? row.availableQuantity : null}
                              unit="pc"
                            />
                          </td>
                          {showCalculations && (
                            <>
                              <td role="cell" data-label="Capacity">
                                {row.capacityPieces !== null ? (
                                  <>
                                    <strong>{row.capacityPieces}</strong>
                                    <span className="material-id">parent pieces</span>
                                  </>
                                ) : (
                                  <>
                                    <strong>—</strong>
                                    <span className="material-id">{statusLabel(row.capacityStatus)}</span>
                                  </>
                                )}
                              </td>
                              <td role="cell" data-label="Unit cost">{row.unitCost !== null ? peso.format(row.unitCost) : 'Unpriced'}</td>
                            </>
                          )}
                          <td role="cell" data-label="Planned component cost">
                            {row.plannedCostContribution !== null
                              ? peso.format(row.plannedCostContribution)
                              : 'Unresolved'}
                          </td>
                          <td role="cell" data-label="Readiness">
                            <strong>{statusLabel(row.capacityStatus)}</strong>
                            <span className="material-id">Cost: {statusLabel(row.costStatus)}</span>
                            {row.issues.length ? <span className="component-row-issue">{row.issues[0]}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="list-footer">
                <span>Component availability is current stock only; Production does not reserve or deduct stock.</span>
                <span>Unrecorded stock is different from zero stock.</span>
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function StockShortfall({
  required,
  available,
  unit,
}: {
  required: number;
  available: number | null | undefined;
  unit: string;
}) {
  const shortfall = stockShortfall(required, available);
  return shortfall === null ? (
    <span className="stock-check">Check stock</span>
  ) : shortfall > 0 ? (
    <span className="stock-shortfall">
      {number(shortfall)} {unit} short
    </span>
  ) : (
    <span className="stock-covered">Covered</span>
  );
}
