import { describe, expect, it, vi } from 'vitest';
import {
  BatchProductionRequestPrintError,
  printBatchProductionRequest,
  renderBatchProductionRequestHtml,
  type BatchPrintWindow,
} from './batchProductionRequestPrint';
import type { BatchProductionRequestView } from './batchProductionRequestView';

function view(): BatchProductionRequestView {
  return {
    requestReference: 'PR-20260917-010203Z-CANDLE',
    generatedAtIso: '2026-09-17T01:02:03.000Z',
    product: {
      id: 'CANDLE',
      name: 'Workshop <Candle>',
      category: 'candle',
      categoryLabel: 'Candle',
      isActive: true,
      notes: 'Keep wick <centered> & pour slowly.',
    },
    plannedQuantity: 12,
    safetyWastePercentage: 5,
    effectiveYieldSampleId: 'YIELD-7',
    readinessStatus: 'ready',
    feasibility: 'within-current-capacity',
    currentAssemblyCapacity: 20,
    overageQuantity: 0,
    materials: [
      {
        materialId: 'WAX',
        materialName: 'Soy wax',
        requiredQuantity: 120,
        baseUnit: 'g',
        normalizedOnHandQuantity: 200,
        shortageQuantity: 0,
        capacityPieces: 20,
        status: 'covered',
      },
    ],
    components: [
      {
        componentId: 'VESSEL',
        sourceType: 'product',
        sourceId: 'POT',
        sourceName: 'Handmade pot',
        role: 'vessel',
        quantityPerParent: 1,
        plannedQuantity: 12,
        availableQuantity: 20,
        capacityPieces: 20,
        status: 'ready',
        issues: [],
      },
    ],
    limitingResources: [],
    warnings: ['Check curing time before packaging.'],
    issues: [{ source: 'Availability', message: 'Confirm vessel stock before starting.' }],
    financials: {
      status: 'ready',
      plannedProductionCost: 480,
      expectedRevenue: 960,
      expectedProfit: 480,
      batchMargin: 0.5,
      averageCostPerFinishedUnit: 40,
      sellingPrice: 80,
      profitPerUnit: 40,
    },
  };
}

function fakeWindow(): BatchPrintWindow {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

describe('batch production request print document', () => {
  it('renders an A4 production request with preparation, financial, actual-result and sign-off sections', () => {
    const html = renderBatchProductionRequestHtml(view());

    expect(html).toContain('@page { size: A4;');
    expect(html).toContain('Production Request / Batch Sheet');
    expect(html).toContain('Materials to Prepare');
    expect(html).toContain('Soy wax');
    expect(html).toContain('Components / Vessels / Nested Products');
    expect(html).toContain('Handmade pot');
    expect(html).toContain('Financial Summary');
    expect(html).toContain('Actual Production Results');
    expect(html).toContain('Actual good pieces');
    expect(html).toContain('Rejected / damaged pieces');
    expect(html).toContain('Prepared by');
    expect(html).toContain('Produced by');
    expect(html).toContain('Checked by');
    expect(html).toContain('Save as PDF');
    expect(html).toContain('Printing does not reserve, decrement, or otherwise change stock');
  });

  it('escapes business data before placing it in printable HTML', () => {
    const html = renderBatchProductionRequestHtml(view());

    expect(html).toContain('Workshop &lt;Candle&gt;');
    expect(html).toContain('Keep wick &lt;centered&gt; &amp; pour slowly.');
    expect(html).not.toContain('Workshop <Candle>');
    expect(html).not.toContain('Keep wick <centered> & pour slowly.');
  });

  it('writes the document and invokes the browser print boundary', () => {
    const printWindow = fakeWindow();
    printBatchProductionRequest(view(), () => printWindow);

    expect(printWindow.document.open).toHaveBeenCalledOnce();
    expect(printWindow.document.write).toHaveBeenCalledOnce();
    expect(printWindow.document.close).toHaveBeenCalledOnce();
    expect(printWindow.focus).toHaveBeenCalledOnce();
    expect(printWindow.print).toHaveBeenCalledOnce();
    expect(vi.mocked(printWindow.document.write).mock.calls[0]?.[0]).toContain(
      'Production Request / Batch Sheet',
    );
  });

  it('fails explicitly when the browser blocks the print window', () => {
    expect(() => printBatchProductionRequest(view(), () => null)).toThrowError(
      BatchProductionRequestPrintError,
    );
    try {
      printBatchProductionRequest(view(), () => null);
    } catch (error) {
      expect(error).toMatchObject({ code: 'POPUP_BLOCKED' });
    }
  });
});
