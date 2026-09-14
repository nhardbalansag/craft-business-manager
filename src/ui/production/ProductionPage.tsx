import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  materialService,
  productService,
  productionCapacityService,
  productionRequirementService,
  recipeMaterialCostPreviewService,
} from '../../application/session';
import type { ProductionCapacityResult } from '../../application/production/ProductionCapacityService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { RecipeMaterialCostPreviewResult } from '../../application/recipeCosts/RecipeMaterialCostPreviewService';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
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

export function ProductionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productId, setProductId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('1');
  const [plan, setPlan] = useState<ProductionRequirementPlanResult | null>(null);
  const [capacity, setCapacity] = useState<ProductionCapacityResult | null>(null);
  const [costPreview, setCostPreview] = useState<RecipeMaterialCostPreviewResult | null>(null);
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
      setCapacity(null);
      setCostPreview(null);
      return;
    }

    let cancelled = false;
    setEstimating(true);
    setFeedback(null);

    void Promise.all([
      productionRequirementService.plan(productId, quantity),
      productionCapacityService.estimate(productId),
      recipeMaterialCostPreviewService.previewForProduct(productId),
    ])
      .then(([nextPlan, nextCapacity, nextCost]) => {
        if (cancelled) return;
        setPlan(nextPlan);
        setCapacity(nextCapacity);
        setCostPreview(nextCost);
      })
      .catch((error) => {
        if (cancelled) return;
        setPlan(null);
        setCapacity(null);
        setCostPreview(null);
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
  const capacityById = useMemo(
    () => new Map((capacity?.materials ?? []).map((entry) => [entry.materialId.toLocaleLowerCase(), entry])),
    [capacity],
  );
  const costById = useMemo(
    () => new Map((costPreview?.lines ?? []).map((line) => [line.materialId.toLocaleLowerCase(), line])),
    [costPreview],
  );

  const limitingNames = (capacity?.limitingMaterialIds ?? []).map((id) => materialById.get(id.toLocaleLowerCase())?.name ?? id);
  const exceedsCapacity =
    Boolean(capacity?.status === 'ready' && capacity.produciblePieces !== null && quantity > capacity.produciblePieces);

  const wasteAdjustedCostPerProduct =
    plan && costPreview ? costPreview.totalMaterialCostPerProduct * plan.safetyWasteMultiplier : null;
  const plannedBatchMaterialCost =
    wasteAdjustedCostPerProduct !== null ? wasteAdjustedCostPerProduct * quantity : null;

  const allIssues = [
    ...(plan?.issues.map((issue) => ({ source: 'Requirement', message: issue.message })) ?? []),
    ...(capacity?.issues.map((issue) => ({ source: 'Inventory', message: issue.message })) ?? []),
    ...(costPreview?.costIssues.map((issue) => ({ source: 'Cost', message: issue.message })) ?? []),
  ];

  return (
    <section className="materials-workspace production-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">PHASE 2 · PRODUCTION PLANNING</p>
          <h1>Production estimate</h1>
          <p className="page-lead">
            Compare a planned batch with waste-adjusted material requirements and current direct-material inventory before you start production.
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
          <small>Use 0 for a per-piece preview without a batch total.</small>
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
          Planned quantity exceeds current direct-material capacity. Reduce the batch or replenish the limiting material inventory.
        </div>
      )}

      <div className="production-summary-grid">
        <article className="panel production-summary-card">
          <span>Requirement status</span>
          <strong>{plan ? statusLabel(plan.status) : estimating ? 'Calculating…' : '—'}</strong>
          <small>{plan ? `${number(plan.safetyWastePercentage, 2)}% safety waste reserve` : 'Yield/fixed recipe readiness'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Producible now</span>
          <strong>{capacity?.produciblePieces ?? '—'}</strong>
          <small>{capacity?.status === 'ready' ? 'pieces from current direct-material stock' : capacity ? statusLabel(capacity.status) : 'Inventory-limited capacity'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Limiting material{limitingNames.length === 1 ? '' : 's'}</span>
          <strong className="summary-text">{limitingNames.length ? limitingNames.join(', ') : '—'}</strong>
          <small>{capacity?.status === 'ready' ? 'lowest direct-material capacity' : 'Published only when inventory picture is complete'}</small>
        </article>
        <article className="panel production-summary-card">
          <span>Planned material cost</span>
          <strong>{plannedBatchMaterialCost !== null ? peso.format(plannedBatchMaterialCost) : '—'}</strong>
          <small>{wasteAdjustedCostPerProduct !== null ? `${peso.format(wasteAdjustedCostPerProduct)} waste-adjusted / piece` : 'Direct materials only'}</small>
        </article>
      </div>

      <section className="panel material-list production-requirements-panel">
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">BATCH REQUIREMENTS</p><h2>Materials to prepare</h2></div>
          <div className="material-count"><strong>{plan?.requirements.length ?? 0}</strong><span>materials</span></div>
        </div>
        <div className="table-wrap">
          {estimating ? (
            <div className="empty-state"><p>Calculating production estimate…</p></div>
          ) : !plan || plan.requirements.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">▦</div><h3>No derivable production requirements</h3><p>Record yield evidence or add fixed recipe items before production planning.</p></div>
          ) : (
            <table className="materials-table production-table">
              <thead><tr><th>Material</th><th>Effective / piece</th><th>Waste reserve</th><th>Planned / piece</th><th>Batch required</th><th>On hand</th><th>Capacity</th><th>Batch cost</th></tr></thead>
              <tbody>{plan.requirements.map((requirement) => {
                const key = requirement.materialId.toLocaleLowerCase();
                const material = materialById.get(key);
                const inventory = capacityById.get(key);
                const cost = costById.get(key);
                const batchCost = cost ? cost.costPerBaseUnit * requirement.plannedBatchBaseQuantity : null;
                return (
                  <tr key={requirement.materialId} className={inventory?.isLimiting ? 'limiting-row' : ''}>
                    <td><strong>{material?.name ?? requirement.materialId}</strong><span className="material-id">{requirement.materialId} · {requirement.source}</span></td>
                    <td>{number(requirement.effectiveBaseQuantityPerProduct)} {requirement.baseUnit}</td>
                    <td>+{number(requirement.wasteReserveBaseQuantityPerProduct)} {requirement.baseUnit}</td>
                    <td><strong>{number(requirement.plannedBaseQuantityPerProduct)} {requirement.baseUnit}</strong></td>
                    <td><strong>{number(requirement.plannedBatchBaseQuantity)} {requirement.baseUnit}</strong></td>
                    <td>{inventory ? <>{number(inventory.normalizedOnHandBaseQuantity)} {inventory.baseUnit}<span className="material-id">entered {number(inventory.enteredOnHandQuantity)} {inventory.enteredOnHandUnit} · {inventory.inventoryConversionSource}</span></> : 'Unresolved'}</td>
                    <td>{inventory ? <><strong>{inventory.capacityPieces}</strong>{inventory.isLimiting && <span className="capacity-limiter">Limiting</span>}</> : '—'}</td>
                    <td>{batchCost !== null ? peso.format(batchCost) : 'Unpriced'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div className="list-footer">
          <span>Capacity covers direct materials only; vessels and nested molded components arrive in Phase 3.</span>
          <span>{plan?.effectiveYieldSampleId ? `Yield: ${plan.effectiveYieldSampleId}` : 'No effective yield sample'}</span>
        </div>
      </section>

      <div className="production-detail-grid">
        <section className="panel production-detail-card">
          <div className="panel-heading"><div><p className="panel-kicker">COST BASIS</p><h2>Direct material preview</h2></div></div>
          {costPreview?.lines.length ? (
            <div className="production-cost-list">
              {costPreview.lines.map((line) => (
                <div key={line.materialId} className="production-cost-row">
                  <span>{materialById.get(line.materialId.toLocaleLowerCase())?.name ?? line.materialId}</span>
                  <strong>{peso.format(line.materialCostPerProduct)} / piece</strong>
                  <small>{peso.format(line.costPerBaseUnit)} per {line.baseUnit} · {line.packageConversionSource}</small>
                </div>
              ))}
              <div className="production-cost-total"><span>Effective direct materials / piece</span><strong>{peso.format(costPreview.totalMaterialCostPerProduct)}</strong></div>
              {plan && <div className="production-cost-total"><span>With {number(plan.safetyWastePercentage, 2)}% safety reserve / piece</span><strong>{peso.format(costPreview.totalMaterialCostPerProduct * plan.safetyWasteMultiplier)}</strong></div>}
            </div>
          ) : <p className="yield-notice">No priceable direct-material requirements yet.</p>}
        </section>

        <section className="panel production-detail-card">
          <div className="panel-heading"><div><p className="panel-kicker">READINESS</p><h2>Issues to resolve</h2></div></div>
          {allIssues.length === 0 ? (
            <div className="production-ready"><strong>Ready</strong><span>No direct-material requirement, inventory, or costing issues are currently reported.</span></div>
          ) : (
            <ul className="production-issues">
              {allIssues.map((issue, index) => <li key={`${issue.source}-${index}`}><strong>{issue.source}</strong><span>{issue.message}</span></li>)}
            </ul>
          )}
          {capacity?.skippedInvalidYieldSampleIds.length ? (
            <p className="production-skipped">Skipped newer invalid yield samples: {capacity.skippedInvalidYieldSampleIds.join(', ')}</p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
