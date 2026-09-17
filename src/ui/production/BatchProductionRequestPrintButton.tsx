import { useState } from 'react';
import {
  componentAwareProductCostService,
  materialService,
  plannedBatchCapacityFeasibilityService,
  productService,
  productionRequirementService,
} from '../../application/session';
import type { PlannedBatchCapacityFeasibilityResult } from '../../application/production/PlannedBatchCapacityFeasibilityService';
import {
  buildComponentRequirementRows,
  buildLimitingResourceRows,
  buildProductionIssueRows,
} from './componentAwareProductionView';
import {
  BatchProductionRequestPrintError,
  printBatchProductionRequest,
  type BatchPrintWindow,
  type BatchPrintWindowOpener,
} from './batchProductionRequestPrint';
import {
  buildBatchProductionRequestView,
  type BatchProductionRequestView,
} from './batchProductionRequestView';

export interface BatchProductionRequestPrintButtonProps {
  result: PlannedBatchCapacityFeasibilityResult;
  openPrintWindow?: BatchPrintWindowOpener;
  onPrint?: (view: BatchProductionRequestView, printWindow: BatchPrintWindow) => void;
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function browserPrintWindow(): BatchPrintWindow | null {
  return window.open('', '_blank') as unknown as BatchPrintWindow | null;
}

function failureMessage(error: unknown): string {
  if (error instanceof BatchProductionRequestPrintError) return error.message;
  return error instanceof Error
    ? error.message
    : 'The batch sheet could not be prepared for printing.';
}

/**
 * Refreshes the same authoritative production services used by the workspace, then
 * prints a presentation-only snapshot. The window is opened synchronously from the
 * user click so browser popup protection does not misclassify the later print step.
 */
export function BatchProductionRequestPrintButton({
  result,
  openPrintWindow = browserPrintWindow,
  onPrint = (view, printWindow) => printBatchProductionRequest(view, () => printWindow),
}: BatchProductionRequestPrintButtonProps) {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepareAndPrint = async () => {
    if (preparing) return;
    setPreparing(true);
    setError(null);

    const printWindow = openPrintWindow();
    if (!printWindow) {
      setPreparing(false);
      setError(
        'The batch sheet could not be opened. Allow pop-ups for this app, then try printing again.',
      );
      return;
    }

    try {
      const [products, materials, plan, cost, feasibility] = await Promise.all([
        productService.listProducts(),
        materialService.listMaterials(),
        productionRequirementService.plan(result.productId, result.plannedQuantity),
        componentAwareProductCostService.costProduct(result.productId),
        plannedBatchCapacityFeasibilityService.assessBatch(
          result.productId,
          result.plannedQuantity,
        ),
      ]);

      const product = products.find(
        (candidate) => canonical(candidate.id) === canonical(feasibility.productId),
      );
      if (!product) {
        throw new Error(
          `Product ${feasibility.productId} is no longer available, so the batch sheet cannot be prepared.`,
        );
      }

      const componentRows = buildComponentRequirementRows(
        cost,
        feasibility.capacityTrace,
        feasibility.plannedQuantity,
        materials,
        products,
      );
      const limitingRows = buildLimitingResourceRows(feasibility.capacityTrace);
      const productionIssues = buildProductionIssueRows(plan, cost, feasibility.capacityTrace);
      const view = buildBatchProductionRequestView({
        product,
        materials,
        plan,
        feasibility,
        componentRows,
        limitingRows,
        productionIssues,
      });

      onPrint(view, printWindow);
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className="panel production-print-panel" aria-label="Production request sheet" aria-busy={preparing}>
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">SHOP-FLOOR DOCUMENT</p>
          <h3>Production request / batch sheet</h3>
          <p>
            Open an A4 planning sheet with materials, components, capacity, costs, blank actual-result fields,
            and sign-off lines. Use the browser print dialog for paper or Save as PDF.
          </p>
          <div className="production-print-format" aria-label="Batch sheet format">
            <span>A4 portrait</span>
            <span>16 mm side margins</span>
            <span>18 mm top &amp; bottom</span>
          </div>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={preparing}
          onClick={() => void prepareAndPrint()}
        >
          {preparing ? 'Preparing batch sheet…' : 'Print / Save Batch Sheet'}
        </button>
      </div>
      <small>Printing does not reserve or deduct stock and does not create a persisted production order.</small>
      {error && (
        <div className="feedback feedback-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
