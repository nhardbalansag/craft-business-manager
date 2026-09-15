import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assemblyCapacityTraceService,
  componentAwareProductCostService,
  materialService,
  productService,
  productionRequirementService,
} from '../../application/session';
import type { ComponentAwareProductCostResult } from '../../application/productComponents/ComponentAwareProductCostService';
import type { AssemblyCapacityTraceResult } from '../../application/production/AssemblyCapacityTraceService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import {
  buildComponentCostBreakdownRows,
  buildComponentRequirementRows,
  buildLimitingResourceRows,
  buildProductionIssueRows,
} from './componentAwareProductionView';
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

export function ProductionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productId, setProductId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('1');
  const [plan, setPlan] = useState<ProductionRequirementPlanResult | null>(null);
  const [capacityTrace, setCapacityTrace] = useState<AssemblyCapacityTraceResult | null>(null);
  const [componentCost, setComponentCost] = useState<ComponentAwareProductCostResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reloadMasters = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadMasters();
  }, [reloadMasters]);

  const quantity = Number(plannedQuantity);
  const quantityValid =
    plannedQuantity.trim() !== '' && Number.isFinite(quantity) && Number.isInteger(quantity) && quantity >= 0;

  useEffect(() => {
    if (!productId || !quantityValid) {
      setPlan(null);
      setCapacityTrace(null);
      setComponentCost(null);
      return;
    }

    let cancelled = false;
    setEstimating(true);
    setFeedback(null);

    void Promise.all([
      productionRequirementService.plan(productId, quantity),
      componentAwareProductCostService.costProduct(productId),
      assemblyCapacityTraceService.trace(productId),
    ])
      .then(([nextPlan, nextCost, nextTrace]) => {
        if (cancelled) return;
        setPlan(nextPlan);
        setComponentCost(nextCost);
        setCapacityTrace(nextTrace);
      })
      .catch((error) => {
        if (cancelled) return;
        setPlan(null);
        setCapacityTrace(null);
        setComponentCost(null);
        setFeedback(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, quantity, quantityValid]);

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
    () => buildComponentRequirementRows(componentCost, capacityTrace, quantityValid ? quantity : 0, materials, products),
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

  const exceedsCapacity = Boolean(
    capacityTrace?.status === 'ready' &&
    capacityTrace.overallAssemblyCapacity !== null &&
    quantity > capacityTrace.overallAssemblyCapacity,
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
  const componentBatchKnownCost = componentRows.reduce(
    (total, row) => total + (row.plannedCostContribution ?? 0),
    0,
  );
  const componentBatchComplete = componentRows.every(
    (row) => row.costStatus === 'ready' && row.plannedCostContribution !== null,
  );
  const plannedInputCost = plan && componentCost?.totalComponentAwareCost !== null
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
          <p className="eyebrow">PHASE 3 · PRODUCTION PLANNING</p>
          <h1>Component-aware production estimate</h1>
          <p className="page-lead">
            Plan the parent&apos;s direct materials and discrete assembly components together, including current stock, component-aware cost, assembly capacity, tied limiters, and nested cost readiness.
          </p>
        </div>
        <div className="session-badge"><span className="status-dot" />Live derived estimate</div>
      </div>

      <section className="panel production-controls">
        <label className="field">
          <span>Product</span>
          <select value={productId} disabled={loading || products.length === 0} onChange={(event) => setProductId(event.target.value)}>
            {products.length === 0 ? <option value="">No products available</option> : products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}{product.isActive ? '' : ' (archived)'}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Planned finished pieces</span>
          <input
            type="number"
            min="0"
            step="1"
            value={plannedQuantity}
            disabled={!productId}
            onChange={(event) => setPlannedQuantity(event.target.value)}
          />
          <small>Direct-material safety waste applies only to parent-making materials, not discrete component counts.</small>
        </label>
        <div className="production-context">
          <strong>{selectedProduct?.name ?? 'Select a product'}</strong>
          <span>{selectedProduct ? `${selectedProduct.category} · ${selectedProduct.isActive ? 'active' : 'archived'}` : 'Production estimates require a product.'}</span>
        </div>
      </section>

      {!quantityValid && productId && <div className="feedback feedback-error">Planned quantity must be a non-negative whole number.</div>}
      {feedback && <div className="feedback feedback-error">{feedback}</div>}
      {exceedsCapacity && (
        <div className="production-warning">
          Planned quantity exceeds current assembly capacity. Reduce the batch or replenish the limiting resources shown below.
        </div>
      )}

      <div className="production-summary-grid production-summary-grid-phase3">
        <article className="panel production-summary-card">
          <span>Production readiness</span>
          <strong>{capacityTrace ? statusLabel(capacityTrace.status) : estimating ? 'Calculating…' : '—'}</strong>
          <small>{componentCost ? `Cost: ${statusLabel(componentCost.status)}` : 'Assembly capacity + cost readiness'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Assembly capacity</span>
          <strong>{capacityTrace?.status === 'ready' ? capacityTrace.overallAssemblyCapacity ?? '—' : '—'}</strong>
          <small>{capacityTrace ? `${statusLabel(capacityTrace.status)} · direct materials + current component stock` : 'Current parent pieces assemblable'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Limiting resources</span>
          <strong className="summary-text">{limitingRows.length ? limitingRows.map((row) => row.sourceName).join(', ') : '—'}</strong>
          <small>{capacityTrace?.status === 'ready' ? `${limitingRows.length} tied at the final minimum` : 'Published only with reliable final assembly capacity'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Component-aware cost / product</span>
          <strong>{componentCost?.totalComponentAwareCost !== null && componentCost?.totalComponentAwareCost !== undefined ? peso.format(componentCost.totalComponentAwareCost) : '—'}</strong>
          <small>{componentCost ? (componentCost.status === 'ready' ? 'Complete material + component input cost' : `${statusLabel(componentCost.status)} · known subtotal only`) : 'Excludes labor, overhead, markup, and profit'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Planned input cost</span>
          <strong>{plannedInputCost !== null ? peso.format(plannedInputCost) : '—'}</strong>
          <small>{plannedInputCost !== null ? (plannedInputCostComplete ? 'Complete waste-adjusted direct + discrete component inputs' : 'Known partial subtotal · unresolved inputs excluded') : 'Calculated from currently priceable input evidence'}</small>
        </article>
      </div>

      <section className="panel material-list production-requirements-panel production-input-panel">
        <div className="production-section-marker direct-marker">DIRECT MATERIALS · MAKE THE PARENT</div>
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">PARENT-MAKING INPUTS</p><h2>Direct materials to prepare</h2></div>
          <div className="material-count"><strong>{plan?.requirements.length ?? 0}</strong><span>materials</span></div>
        </div>
        <p className="production-section-help">Consumable recipe/yield requirements for making the parent. The parent Product&apos;s safety-waste reserve applies here.</p>
        <div className="table-wrap">
          {estimating ? (
            <div className="empty-state"><p>Calculating direct-material requirements…</p></div>
          ) : !plan || plan.requirements.length === 0 ? (
            componentOnlyParent ? (
              <div className="empty-state"><div className="empty-icon">✓</div><h3>No direct materials required for this parent</h3><p>Assembly depends on the discrete components in the next section.</p></div>
            ) : (
              <div className="empty-state"><div className="empty-icon">▦</div><h3>No derivable direct-material requirements</h3><p>Resolve the direct requirement readiness issues below if this Product should have a parent recipe.</p></div>
            )
          ) : (
            <table className="materials-table production-table">
              <thead><tr><th>Material</th><th>Effective / piece</th><th>Waste reserve</th><th>Planned / piece</th><th>Batch required</th><th>On hand</th><th>Direct capacity</th><th>Batch cost</th></tr></thead>
              <tbody>{plan.requirements.map((requirement) => {
                const key = requirement.materialId.toLocaleLowerCase();
                const material = materialById.get(key);
                const inventory = directCapacityById.get(key);
                const cost = directCostById.get(key);
                const batchCost = cost ? cost.costPerBaseUnit * requirement.plannedBatchBaseQuantity : null;
                return (
                  <tr key={requirement.materialId} className={inventory?.isLimiting ? 'limiting-row' : ''}>
                    <td><strong>{material?.name ?? requirement.materialId}</strong><span className="material-id">{requirement.materialId} · {requirement.source}</span></td>
                    <td>{number(requirement.effectiveBaseQuantityPerProduct)} {requirement.baseUnit}</td>
                    <td>+{number(requirement.wasteReserveBaseQuantityPerProduct)} {requirement.baseUnit}</td>
                    <td><strong>{number(requirement.plannedBaseQuantityPerProduct)} {requirement.baseUnit}</strong></td>
                    <td><strong>{number(requirement.plannedBatchBaseQuantity)} {requirement.baseUnit}</strong></td>
                    <td>{inventory ? <>{number(inventory.normalizedOnHandBaseQuantity)} {inventory.baseUnit}<span className="material-id">entered {number(inventory.enteredOnHandQuantity)} {inventory.enteredOnHandUnit} · {inventory.inventoryConversionSource}</span></> : 'Unresolved'}</td>
                    <td>{inventory ? <><strong>{inventory.capacityPieces}</strong>{inventory.isLimiting && <span className="capacity-limiter">Direct limiter</span>}</> : '—'}</td>
                    <td>{batchCost !== null ? peso.format(batchCost) : 'Unpriced'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div className="list-footer">
          <span>Direct-material quantities include the parent safety-waste policy.</span>
          <span>{plan?.effectiveYieldSampleId ? `Yield: ${plan.effectiveYieldSampleId}` : 'No effective yield sample'}</span>
        </div>
      </section>

      <section className="panel material-list production-requirements-panel production-input-panel component-input-panel">
        <div className="production-section-marker component-marker">DISCRETE COMPONENTS · ASSEMBLE THE PARENT</div>
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">ASSEMBLY INPUTS</p><h2>Components to prepare</h2></div>
          <div className="material-count"><strong>{componentRows.length}</strong><span>components</span></div>
        </div>
        <p className="production-section-help">Whole-piece vessels, molded child Products, inserts, accessories, and other discrete inputs. Parent safety waste is not added to these counts.</p>
        <div className="table-wrap">
          {estimating ? (
            <div className="empty-state"><p>Calculating component requirements…</p></div>
          ) : componentRows.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">◇</div><h3>No discrete components</h3><p>This Product currently has no Phase 3 assembly component requirements.</p></div>
          ) : (
            <table className="materials-table production-table component-requirements-table">
              <thead><tr><th>Component</th><th>Role</th><th>Per parent</th><th>Planned batch</th><th>Available</th><th>Capacity</th><th>Unit cost</th><th>Planned component cost</th><th>Readiness</th></tr></thead>
              <tbody>{componentRows.map((row) => (
                <tr key={row.componentId} className={limitingRows.some((limiter) => limiter.sourceId.toLocaleLowerCase() === row.sourceId.toLocaleLowerCase() && limiter.resourceType !== 'material-requirement') ? 'limiting-row' : ''}>
                  <td><strong>{row.sourceName}</strong><span className="material-id">{row.sourceId}</span><span className="component-kind-pill">{sourceTypeLabel(row.sourceType)}</span></td>
                  <td><span className="component-role-pill">{roleLabel(row.role)}</span></td>
                  <td><strong>{number(row.quantityPerParent)} pc</strong></td>
                  <td><strong>{number(row.plannedQuantity)} pc</strong></td>
                  <td>
                    {row.availabilityState === 'missing' ? <strong className="component-state-missing">Missing ProductStock</strong> : row.availableQuantity !== null ? <strong>{number(row.availableQuantity)} pc</strong> : <strong>Unresolved</strong>}
                    <span className="material-id">{row.availabilityState === 'zero' ? 'Explicit known zero' : statusLabel(row.availabilityStatus)}</span>
                  </td>
                  <td>{row.capacityPieces !== null ? <><strong>{row.capacityPieces}</strong><span className="material-id">parent pieces</span></> : <><strong>—</strong><span className="material-id">{statusLabel(row.capacityStatus)}</span></>}</td>
                  <td>{row.unitCost !== null ? peso.format(row.unitCost) : 'Unpriced'}</td>
                  <td>{row.plannedCostContribution !== null ? peso.format(row.plannedCostContribution) : 'Unresolved'}</td>
                  <td><strong>{statusLabel(row.capacityStatus)}</strong><span className="material-id">Cost: {statusLabel(row.costStatus)}</span>{row.issues.length ? <span className="component-row-issue">{row.issues[0]}</span> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="list-footer">
          <span>Component availability is current stock only; Production does not reserve or deduct stock.</span>
          <span>Missing ProductStock ≠ explicit 0 pc.</span>
        </div>
      </section>

      <section className="panel production-limiter-panel">
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">CURRENT ASSEMBLY BOTTLENECK</p><h2>Limiting resources</h2></div>
          <div className="material-count"><strong>{limitingRows.length}</strong><span>tied</span></div>
        </div>
        {capacityTrace?.status === 'ready' && limitingRows.length ? (
          <div className="production-limiter-grid">
            {limitingRows.map((limiter) => (
              <article key={`${limiter.resourceType}-${limiter.sourceId}`} className="production-limiter-card">
                <div><span className="component-kind-pill">{limiter.typeLabel}</span><strong>{limiter.sourceName}</strong></div>
                <span className="limiter-capacity">Capacity {limiter.capacityPieces} parent pieces</span>
                <small>{limiter.evidence}</small>
                <small className="limiter-path">{limiter.pathLabel}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="yield-notice">{capacityTrace ? `Final limiter identity is not published while assembly capacity is ${statusLabel(capacityTrace.status).toLocaleLowerCase()}.` : 'Select a Product to resolve current limiting resources.'}</p>
        )}
      </section>

      <div className="production-detail-grid production-phase3-detail-grid">
        <section className="panel production-detail-card">
          <div className="panel-heading"><div><p className="panel-kicker">COST BASIS</p><h2>Component-aware cost</h2></div></div>
          {componentCost ? (
            <div className="production-cost-list">
              <div className="production-cost-total"><span>Parent direct materials / product</span><strong>{peso.format(componentCost.directMaterialCostSubtotal)}</strong></div>
              <div className="production-cost-total"><span>Root discrete components / product</span><strong>{peso.format(componentCost.componentCostSubtotal)}</strong></div>
              <div className="production-cost-total production-grand-total"><span>Known component-aware total / product</span><strong>{componentCost.totalComponentAwareCost !== null ? peso.format(componentCost.totalComponentAwareCost) : 'Unresolved'}</strong></div>
              <p className="production-cost-status">Cost readiness: <strong>{statusLabel(componentCost.status)}</strong>{componentCost.status === 'partial' ? ' — numeric totals are known partial subtotals.' : ''}</p>
            </div>
          ) : <p className="yield-notice">Component-aware cost has not been calculated yet.</p>}
        </section>

        <section className="panel production-detail-card">
          <div className="panel-heading"><div><p className="panel-kicker">READINESS</p><h2>Issues to resolve</h2></div></div>
          {allIssues.length === 0 ? (
            <div className="production-ready"><strong>Ready</strong><span>No direct-requirement, component-cost, current assembly-capacity, or component-availability issues are currently reported.</span></div>
          ) : (
            <ul className="production-issues">
              {allIssues.map((issue, index) => <li key={`${issue.source}-${index}`}><strong>{issue.source}</strong><span>{issue.message}</span></li>)}
            </ul>
          )}
          {directCapacity?.skippedInvalidYieldSampleIds.length ? (
            <p className="production-skipped">Skipped newer invalid yield samples: {directCapacity.skippedInvalidYieldSampleIds.join(', ')}</p>
          ) : null}
        </section>
      </div>

      <section className="panel production-nested-cost-panel">
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">RECURSIVE COST TRACE</p><h2>Nested component cost</h2></div>
          <div className="material-count"><strong>{costBreakdownRows.length}</strong><span>lines</span></div>
        </div>
        <p className="production-section-help">Read-only cost paths from the completed recursive Product/component costing services. Current ProductStock does not change cost mathematics.</p>
        {costBreakdownRows.length ? (
          <div className="nested-cost-list">
            {costBreakdownRows.map((row, index) => (
              <article key={`${row.componentId}-${index}`} className="nested-cost-row" style={{ '--nested-depth': row.depth } as React.CSSProperties}>
                <div className="nested-cost-main">
                  <span className="component-kind-pill">{sourceTypeLabel(row.sourceType)}</span>
                  <strong>{row.sourceName}</strong>
                  <span className="component-role-pill">{roleLabel(row.role)}</span>
                </div>
                <span className="nested-cost-path">{row.pathLabel}</span>
                <span>{number(row.quantityPerParent)} pc / parent</span>
                <span>{row.unitCost !== null ? `${peso.format(row.unitCost)} unit cost` : 'Unit cost unresolved'}</span>
                <strong>{row.contribution !== null ? `${peso.format(row.contribution)} contribution` : 'Contribution unresolved'}</strong>
                <span className={`nested-status nested-status-${row.status}`}>{statusLabel(row.status)}</span>
                {row.issues.length ? <small className="component-row-issue">{row.issues.join(' · ')}</small> : null}
              </article>
            ))}
          </div>
        ) : <p className="yield-notice">No component cost breakdown is available for the selected Product.</p>}
      </section>
    </section>
  );
}
