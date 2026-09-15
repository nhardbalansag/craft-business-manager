import {
  ExpectedBatchFinancialsServiceError,
  type ExpectedBatchFinancialsResult,
  type ExpectedBatchFinancialsServiceErrorCode,
} from './ExpectedBatchFinancialsService';
import type {
  AssemblyCapacityTraceResult,
  LimitingResource,
} from './AssemblyCapacityTraceService';

export type PlannedBatchCapacityFeasibilityStatus = 'ready' | 'partial' | 'not-ready';

export type CapacityFeasibilityStatus =
  | 'within-current-capacity'
  | 'over-current-capacity'
  | 'capacity-unresolved';

export type PlannedBatchCapacityWarningCode =
  | 'OVER_CURRENT_CAPACITY'
  | 'CAPACITY_UNRESOLVED'
  | 'LIMITING_RESOURCE_EXPLANATION_INCOMPLETE';

export interface PlannedBatchCapacityWarning {
  code: PlannedBatchCapacityWarningCode;
  message: string;
  productId: string;
  plannedQuantity: number;
  currentAssemblyCapacity: number | null;
  overageQuantity?: number;
}

export type PlannedBatchCapacityFeasibilityIssueCode =
  | 'FINANCIALS_PARTIAL'
  | 'FINANCIALS_NOT_READY'
  | 'CAPACITY_TRACE_PARTIAL'
  | 'CAPACITY_TRACE_NOT_READY'
  | 'CAPACITY_SYNTHESIS_PARTIAL'
  | 'CAPACITY_SYNTHESIS_NOT_READY'
  | 'FINANCIAL_CAPACITY_PRODUCT_MISMATCH'
  | 'PRODUCT_ACTIVE_STATE_MISMATCH'
  | 'TRACE_SYNTHESIS_PRODUCT_MISMATCH'
  | 'TRACE_SYNTHESIS_ACTIVE_STATE_MISMATCH'
  | 'TRACE_SYNTHESIS_STATUS_MISMATCH'
  | 'TRACE_SYNTHESIS_CAPACITY_MISMATCH'
  | 'CURRENT_CAPACITY_INVALID'
  | 'READY_TRACE_LIMITERS_MISSING'
  | 'LIMITER_CAPACITY_MISMATCH'
  | 'DERIVED_OVERAGE_INVALID'
  | 'READY_STATE_INCONSISTENT';

export interface PlannedBatchCapacityFeasibilityIssue {
  code: PlannedBatchCapacityFeasibilityIssueCode;
  message: string;
  productId: string;
  componentId?: string;
  sourceId?: string;
  underlyingCode?: string;
}

export interface PlannedBatchCapacityFeasibilityResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: PlannedBatchCapacityFeasibilityStatus;
  plannedQuantity: number;
  financials: ExpectedBatchFinancialsResult;
  capacityTrace: AssemblyCapacityTraceResult;
  feasibility: CapacityFeasibilityStatus;
  currentAssemblyCapacity: number | null;
  overageQuantity: number | null;
  limitingResources: LimitingResource[];
  warnings: PlannedBatchCapacityWarning[];
  issues: PlannedBatchCapacityFeasibilityIssue[];
}

export type PlannedBatchCapacityFeasibilityServiceErrorCode =
  ExpectedBatchFinancialsServiceErrorCode;

export class PlannedBatchCapacityFeasibilityServiceError extends Error {
  readonly code: PlannedBatchCapacityFeasibilityServiceErrorCode;
  readonly productId: string;
  readonly plannedQuantity: number;
  readonly underlyingCode?: string;

  constructor(
    code: PlannedBatchCapacityFeasibilityServiceErrorCode,
    message: string,
    context: {
      productId: string;
      plannedQuantity: number;
      underlyingCode?: string;
    },
  ) {
    super(message);
    this.name = 'PlannedBatchCapacityFeasibilityServiceError';
    this.code = code;
    this.productId = context.productId;
    this.plannedQuantity = context.plannedQuantity;
    this.underlyingCode = context.underlyingCode;
  }
}

export interface PlannedBatchCapacityFinancialsProvider {
  projectBatch(
    productId: string,
    plannedQuantity: number,
  ): Promise<ExpectedBatchFinancialsResult>;
}

export interface PlannedBatchCapacityTraceProvider {
  trace(productId: string): Promise<AssemblyCapacityTraceResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function validCapacity(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && Number.isInteger(value);
}

function validOverage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Number.isInteger(value);
}

function allowedTraceSynthesisStatusPair(trace: AssemblyCapacityTraceResult): boolean {
  const synthesisStatus = trace.capacitySynthesis.status;

  if (trace.status === 'ready') return synthesisStatus === 'ready';
  if (trace.status === 'partial') {
    return synthesisStatus === 'ready' || synthesisStatus === 'partial';
  }
  return synthesisStatus === 'not-ready';
}

function cloneLimiters(resources: readonly LimitingResource[]): LimitingResource[] {
  return structuredClone(resources);
}

/**
 * Phase 4.4C authoritative planned-batch capacity feasibility synthesis.
 *
 * Financial math stays in 4.4B and capacity math stays in Phase 3. This service
 * only joins those completed boundaries, validates cross-source consistency,
 * classifies the unchanged requested quantity, and emits advisory warnings.
 */
export class PlannedBatchCapacityFeasibilityService {
  constructor(
    private readonly financialsProvider: PlannedBatchCapacityFinancialsProvider,
    private readonly capacityTraceProvider: PlannedBatchCapacityTraceProvider,
  ) {}

  async assessBatch(
    productId: string,
    plannedQuantity: number,
  ): Promise<PlannedBatchCapacityFeasibilityResult> {
    const requestedProductId = productId.trim();

    let financials: ExpectedBatchFinancialsResult;
    try {
      financials = await this.financialsProvider.projectBatch(requestedProductId, plannedQuantity);
    } catch (error) {
      if (error instanceof ExpectedBatchFinancialsServiceError) {
        throw new PlannedBatchCapacityFeasibilityServiceError(error.code, error.message, {
          productId: error.productId,
          plannedQuantity: error.plannedQuantity,
          underlyingCode: error.underlyingCode,
        });
      }
      throw error;
    }

    const canonicalProductId = financials.productId;
    const capacityTrace = await this.capacityTraceProvider.trace(canonicalProductId);
    const issues: PlannedBatchCapacityFeasibilityIssue[] = [];
    let contradiction = false;

    const addIssue = (issue: PlannedBatchCapacityFeasibilityIssue) => issues.push(issue);

    if (financials.status === 'partial') {
      addIssue({
        code: 'FINANCIALS_PARTIAL',
        message: `Product ${canonicalProductId} has only partial expected batch financial evidence.`,
        productId: canonicalProductId,
        underlyingCode: financials.issues[0]?.code,
      });
    } else if (financials.status === 'not-ready') {
      addIssue({
        code: 'FINANCIALS_NOT_READY',
        message: `Product ${canonicalProductId} does not have ready expected batch financial evidence.`,
        productId: canonicalProductId,
        underlyingCode: financials.issues[0]?.code,
      });
    }

    if (capacityTrace.status === 'partial') {
      addIssue({
        code: 'CAPACITY_TRACE_PARTIAL',
        message: `Product ${canonicalProductId} has only partial limiting-resource trace evidence.`,
        productId: canonicalProductId,
        underlyingCode: capacityTrace.issues[0]?.underlyingCode ?? capacityTrace.issues[0]?.code,
      });
    } else if (capacityTrace.status === 'not-ready') {
      addIssue({
        code: 'CAPACITY_TRACE_NOT_READY',
        message: `Product ${canonicalProductId} does not have ready current capacity trace evidence.`,
        productId: canonicalProductId,
        underlyingCode: capacityTrace.issues[0]?.underlyingCode ?? capacityTrace.issues[0]?.code,
      });
    }

    if (capacityTrace.capacitySynthesis.status === 'partial') {
      addIssue({
        code: 'CAPACITY_SYNTHESIS_PARTIAL',
        message: `Product ${canonicalProductId} has only partial authoritative assembly-capacity synthesis evidence.`,
        productId: canonicalProductId,
        underlyingCode:
          capacityTrace.capacitySynthesis.issues[0]?.underlyingCode ??
          capacityTrace.capacitySynthesis.issues[0]?.code,
      });
    } else if (capacityTrace.capacitySynthesis.status === 'not-ready') {
      addIssue({
        code: 'CAPACITY_SYNTHESIS_NOT_READY',
        message: `Product ${canonicalProductId} does not have ready authoritative assembly-capacity synthesis evidence.`,
        productId: canonicalProductId,
        underlyingCode:
          capacityTrace.capacitySynthesis.issues[0]?.underlyingCode ??
          capacityTrace.capacitySynthesis.issues[0]?.code,
      });
    }

    if (comparable(financials.productId) !== comparable(capacityTrace.productId)) {
      contradiction = true;
      addIssue({
        code: 'FINANCIAL_CAPACITY_PRODUCT_MISMATCH',
        message: `Expected batch financials belong to Product ${financials.productId}, but capacity trace belongs to ${capacityTrace.productId}.`,
        productId: canonicalProductId,
      });
    }

    if (financials.productIsActive !== capacityTrace.productIsActive) {
      contradiction = true;
      addIssue({
        code: 'PRODUCT_ACTIVE_STATE_MISMATCH',
        message: `Expected batch financials and capacity trace disagree on active state for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (
      comparable(capacityTrace.productId) !==
      comparable(capacityTrace.capacitySynthesis.productId)
    ) {
      contradiction = true;
      addIssue({
        code: 'TRACE_SYNTHESIS_PRODUCT_MISMATCH',
        message: `Capacity trace Product ${capacityTrace.productId} does not match its retained synthesis Product ${capacityTrace.capacitySynthesis.productId}.`,
        productId: canonicalProductId,
      });
    }

    if (
      capacityTrace.productIsActive !== capacityTrace.capacitySynthesis.productIsActive
    ) {
      contradiction = true;
      addIssue({
        code: 'TRACE_SYNTHESIS_ACTIVE_STATE_MISMATCH',
        message: `Capacity trace and retained synthesis disagree on active state for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (!allowedTraceSynthesisStatusPair(capacityTrace)) {
      contradiction = true;
      addIssue({
        code: 'TRACE_SYNTHESIS_STATUS_MISMATCH',
        message: `Capacity trace status ${capacityTrace.status} is inconsistent with retained synthesis status ${capacityTrace.capacitySynthesis.status} for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    let currentAssemblyCapacity: number | null = null;
    if (capacityTrace.capacitySynthesis.status === 'ready') {
      const traceCapacity = capacityTrace.overallAssemblyCapacity;
      const synthesisCapacity = capacityTrace.capacitySynthesis.overallAssemblyCapacity;

      if (!validCapacity(traceCapacity) || !validCapacity(synthesisCapacity)) {
        contradiction = true;
        addIssue({
          code: 'CURRENT_CAPACITY_INVALID',
          message: `Ready assembly-capacity evidence for Product ${canonicalProductId} does not contain a valid finite, non-negative whole capacity.`,
          productId: canonicalProductId,
        });
      } else if (traceCapacity !== synthesisCapacity) {
        contradiction = true;
        addIssue({
          code: 'TRACE_SYNTHESIS_CAPACITY_MISMATCH',
          message: `Capacity trace reports ${traceCapacity} pieces while retained synthesis reports ${synthesisCapacity} for Product ${canonicalProductId}.`,
          productId: canonicalProductId,
        });
      } else {
        currentAssemblyCapacity = traceCapacity;
      }
    }

    let limitingResources: LimitingResource[] = [];
    if (capacityTrace.status === 'ready') {
      if (capacityTrace.limitingResources.length === 0) {
        contradiction = true;
        addIssue({
          code: 'READY_TRACE_LIMITERS_MISSING',
          message: `Ready capacity trace for Product ${canonicalProductId} did not provide any typed limiting resources.`,
          productId: canonicalProductId,
        });
      } else if (currentAssemblyCapacity !== null) {
        for (const resource of capacityTrace.limitingResources) {
          if (!validCapacity(resource.capacityPieces) || resource.capacityPieces !== currentAssemblyCapacity) {
            contradiction = true;
            addIssue({
              code: 'LIMITER_CAPACITY_MISMATCH',
              message: `Limiting resource capacity ${resource.capacityPieces} does not match current assembly capacity ${currentAssemblyCapacity} for Product ${canonicalProductId}.`,
              productId: canonicalProductId,
              componentId:
                resource.resourceType === 'material-requirement'
                  ? undefined
                  : resource.componentId,
              sourceId:
                resource.resourceType === 'product-backed-component'
                  ? resource.productId
                  : resource.materialId,
            });
          }
        }

        if (!contradiction) {
          limitingResources = cloneLimiters(capacityTrace.limitingResources);
        }
      }
    }

    let feasibility: CapacityFeasibilityStatus = 'capacity-unresolved';
    let overageQuantity: number | null = null;

    if (!contradiction && currentAssemblyCapacity !== null) {
      if (plannedQuantity <= currentAssemblyCapacity) {
        feasibility = 'within-current-capacity';
        overageQuantity = 0;
      } else {
        const derivedOverage = plannedQuantity - currentAssemblyCapacity;
        if (!validOverage(derivedOverage)) {
          contradiction = true;
          addIssue({
            code: 'DERIVED_OVERAGE_INVALID',
            message: `Product ${canonicalProductId} produced an invalid/non-finite capacity overage.`,
            productId: canonicalProductId,
          });
        } else {
          feasibility = 'over-current-capacity';
          overageQuantity = derivedOverage;
        }
      }
    }

    if (contradiction) {
      currentAssemblyCapacity = null;
      feasibility = 'capacity-unresolved';
      overageQuantity = null;
      limitingResources = [];
    }

    const warnings: PlannedBatchCapacityWarning[] = [];

    if (feasibility === 'over-current-capacity' && currentAssemblyCapacity !== null && overageQuantity !== null) {
      warnings.push({
        code: 'OVER_CURRENT_CAPACITY',
        message: `Requested batch ${plannedQuantity} exceeds current assembly capacity ${currentAssemblyCapacity} by ${overageQuantity}. The full requested batch is not currently feasible; increase availability of the tied limiting resources or manually choose a lower requested quantity. The requested quantity has not been changed automatically.`,
        productId: canonicalProductId,
        plannedQuantity,
        currentAssemblyCapacity,
        overageQuantity,
      });
    }

    if (feasibility === 'capacity-unresolved') {
      warnings.push({
        code: 'CAPACITY_UNRESOLVED',
        message: `Current assembly capacity for Product ${canonicalProductId} is unresolved, so requested batch feasibility cannot yet be trusted. Complete or correct the capacity evidence before relying on this feasibility result.`,
        productId: canonicalProductId,
        plannedQuantity,
        currentAssemblyCapacity: null,
      });
    }

    if (
      !contradiction &&
      currentAssemblyCapacity !== null &&
      capacityTrace.status === 'partial' &&
      capacityTrace.capacitySynthesis.status === 'ready'
    ) {
      warnings.push({
        code: 'LIMITING_RESOURCE_EXPLANATION_INCOMPLETE',
        message: `Current assembly capacity ${currentAssemblyCapacity} is authoritative for Product ${canonicalProductId}, but the exact typed limiting-resource explanation is incomplete. Numeric feasibility remains available; review the Phase 3 trace issues before acting on limiter details.`,
        productId: canonicalProductId,
        plannedQuantity,
        currentAssemblyCapacity,
      });
    }

    let status: PlannedBatchCapacityFeasibilityStatus;
    if (
      contradiction ||
      financials.status === 'not-ready' ||
      capacityTrace.status === 'not-ready' ||
      capacityTrace.capacitySynthesis.status === 'not-ready'
    ) {
      status = 'not-ready';
    } else if (
      financials.status === 'partial' ||
      capacityTrace.status === 'partial' ||
      capacityTrace.capacitySynthesis.status === 'partial'
    ) {
      status = 'partial';
    } else if (
      financials.status === 'ready' &&
      capacityTrace.status === 'ready' &&
      capacityTrace.capacitySynthesis.status === 'ready' &&
      feasibility !== 'capacity-unresolved'
    ) {
      status = 'ready';
    } else {
      status = 'not-ready';
      addIssue({
        code: 'READY_STATE_INCONSISTENT',
        message: `Product ${canonicalProductId} did not produce the complete evidence required for a ready capacity-feasibility synthesis.`,
        productId: canonicalProductId,
      });
    }

    return {
      productId: canonicalProductId,
      productName: financials.productName,
      productIsActive: financials.productIsActive,
      status,
      plannedQuantity,
      financials: structuredClone(financials),
      capacityTrace: structuredClone(capacityTrace),
      feasibility,
      currentAssemblyCapacity,
      overageQuantity,
      limitingResources: cloneLimiters(limitingResources),
      warnings: warnings.map((warning) => ({ ...warning })),
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
