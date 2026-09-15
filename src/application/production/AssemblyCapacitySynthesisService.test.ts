import { describe, expect, it } from 'vitest';
import type { ProductComponent } from '../../domain/productComponents';
import type {
  ComponentCapacityResult,
} from '../productComponents/ComponentCapacityService';
import type { ProductionCapacityResult } from './ProductionCapacityService';
import {
  AssemblyCapacitySynthesisService,
  type DirectMaterialCapacityProvider,
  type PerComponentCapacityProvider,
  type ProductComponentCapacityListProvider,
} from './AssemblyCapacitySynthesisService';

function directCapacity(
  overrides: Partial<ProductionCapacityResult> = {},
): ProductionCapacityResult {
  return {
    productId: 'PARENT',
    productIsActive: true,
    status: 'ready',
    requirementStatus: 'ready',
    effectiveYieldSampleId: null,
    skippedInvalidYieldSampleIds: [],
    safetyWasteRate: 0,
    safetyWastePercentage: 0,
    safetyWasteMultiplier: 1,
    observedDefectRateIncluded: false,
    produciblePieces: 10,
    limitingMaterialIds: ['MAT-DIRECT'],
    materials: [
      {
        materialId: 'MAT-DIRECT',
        baseUnit: 'g',
        normalizedOnHandBaseQuantity: 100,
        plannedBaseQuantityPerProduct: 10,
        capacityPieces: 10,
        isLimiting: true,
        enteredOnHandQuantity: 100,
        enteredOnHandUnit: 'g',
        inventoryConversionSource: 'standard',
        inventoryCalibrationId: null,
      },
    ],
    issues: [],
    ...overrides,
  };
}

function neutralNoDirectCapacity(): ProductionCapacityResult {
  return directCapacity({
    status: 'not-ready',
    requirementStatus: 'not-ready',
    produciblePieces: null,
    limitingMaterialIds: [],
    materials: [],
    issues: [
      {
        code: 'UPSTREAM_REQUIREMENT_ISSUE',
        sourceCode: 'NO_REQUIREMENTS',
        message: 'No direct-material requirements.',
      },
    ],
  });
}

function component(
  id: string,
  sourceType: 'material' | 'product',
  sourceId: string,
  quantityPerParent = 1,
): ProductComponent {
  return {
    id,
    parentProductId: 'PARENT',
    sourceType,
    sourceId,
    role: sourceType === 'material' ? 'vessel' : 'molded-component',
    quantityPerParent,
  };
}

function componentCapacity(
  source: ProductComponent,
  capacityPieces: number | null,
  status: 'ready' | 'partial' | 'not-ready' = 'ready',
): ComponentCapacityResult {
  const availableQuantity =
    capacityPieces === null ? null : capacityPieces * source.quantityPerParent;

  return {
    componentId: source.id,
    parentProductId: source.parentProductId,
    role: source.role,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    quantityPerParent: source.quantityPerParent,
    status,
    availableQuantity,
    unit: 'pc',
    capacityPieces,
    sourceAvailability:
      status === 'ready'
        ? {
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            status: 'ready',
            availableQuantity,
            unit: 'pc',
            issues: [],
          }
        : null,
    issues:
      status === 'ready'
        ? []
        : [
            {
              code:
                status === 'partial'
                  ? 'SOURCE_AVAILABILITY_PARTIAL'
                  : 'SOURCE_AVAILABILITY_NOT_READY',
              message: `${source.id} unresolved.`,
            },
          ],
  };
}

class DirectProvider implements DirectMaterialCapacityProvider {
  readonly calls: string[] = [];

  constructor(readonly value: ProductionCapacityResult) {}

  async estimate(productId: string): Promise<ProductionCapacityResult> {
    this.calls.push(productId);
    return this.value;
  }
}

class ComponentListProvider implements ProductComponentCapacityListProvider {
  readonly calls: string[] = [];

  constructor(readonly values: ProductComponent[]) {}

  async listComponentsByParent(parentProductId: string): Promise<ProductComponent[]> {
    this.calls.push(parentProductId);
    return this.values;
  }
}

class CapacityProvider implements PerComponentCapacityProvider {
  readonly calls: string[] = [];

  constructor(readonly values: Map<string, ComponentCapacityResult>) {}

  async capacityForComponent(value: ProductComponent): Promise<ComponentCapacityResult> {
    this.calls.push(value.id);
    const result = this.values.get(value.id);
    if (!result) throw new Error(`Missing capacity fixture for ${value.id}.`);
    return result;
  }
}

function setup(
  direct: ProductionCapacityResult,
  components: ProductComponent[],
  capacities: ComponentCapacityResult[],
) {
  const directProvider = new DirectProvider(direct);
  const componentProvider = new ComponentListProvider(components);
  const capacityProvider = new CapacityProvider(
    new Map(capacities.map((entry) => [entry.componentId, entry])),
  );
  const service = new AssemblyCapacitySynthesisService(
    directProvider,
    componentProvider,
    capacityProvider,
  );

  return { service, directProvider, componentProvider, capacityProvider };
}

describe('AssemblyCapacitySynthesisService', () => {
  it('publishes direct-material capacity for a direct-only Product', async () => {
    const { service } = setup(directCapacity({ produciblePieces: 8 }), [], []);

    const result = await service.estimate(' PARENT ');

    expect(result).toMatchObject({
      productId: 'PARENT',
      status: 'ready',
      directMaterialApplicable: true,
      overallAssemblyCapacity: 8,
      componentCapacities: [],
    });
  });

  it('supports a valid component-only Product when NO_REQUIREMENTS is the sole direct issue', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const insert = component('C-INSERT', 'product', 'PROD-INSERT');
    const { service } = setup(
      neutralNoDirectCapacity(),
      [jar, insert],
      [componentCapacity(jar, 12), componentCapacity(insert, 7)],
    );

    const result = await service.estimate('PARENT');

    expect(result).toMatchObject({
      status: 'ready',
      directMaterialApplicable: false,
      overallAssemblyCapacity: 7,
    });
    expect(result.issues).toEqual([]);
  });

  it('uses the direct-material capacity when it is the mixed Product minimum', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(
      directCapacity({ produciblePieces: 4 }),
      [jar],
      [componentCapacity(jar, 9)],
    );

    expect((await service.estimate('PARENT')).overallAssemblyCapacity).toBe(4);
  });

  it('uses a Material-backed component capacity when it is the mixed Product minimum', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(
      directCapacity({ produciblePieces: 10 }),
      [jar],
      [componentCapacity(jar, 3)],
    );

    expect((await service.estimate('PARENT')).overallAssemblyCapacity).toBe(3);
  });

  it('uses a Product-backed component capacity when it is the mixed Product minimum', async () => {
    const child = component('C-CHILD', 'product', 'PROD-CHILD');
    const { service } = setup(
      directCapacity({ produciblePieces: 10 }),
      [child],
      [componentCapacity(child, 2)],
    );

    expect((await service.estimate('PARENT')).overallAssemblyCapacity).toBe(2);
  });

  it('preserves an authoritative zero direct-material capacity', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(
      directCapacity({ produciblePieces: 0 }),
      [jar],
      [componentCapacity(jar, 5)],
    );

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'ready',
      overallAssemblyCapacity: 0,
    });
  });

  it('preserves an authoritative zero component capacity', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(
      directCapacity({ produciblePieces: 5 }),
      [jar],
      [componentCapacity(jar, 0)],
    );

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'ready',
      overallAssemblyCapacity: 0,
    });
  });

  it('selects the minimum across several ready component capacities', async () => {
    const a = component('C-A', 'material', 'MAT-A');
    const b = component('C-B', 'material', 'MAT-B');
    const c = component('C-C', 'product', 'PROD-C');
    const { service } = setup(
      neutralNoDirectCapacity(),
      [a, b, c],
      [componentCapacity(a, 20), componentCapacity(b, 6), componentCapacity(c, 11)],
    );

    expect((await service.estimate('PARENT')).overallAssemblyCapacity).toBe(6);
  });

  it('returns component capacities in deterministic source order', async () => {
    const productZ = component('C-Z', 'product', 'PROD-Z');
    const materialB = component('C-B', 'material', 'MAT-B');
    const materialA = component('C-A', 'material', 'MAT-A');
    const { service, capacityProvider } = setup(
      neutralNoDirectCapacity(),
      [productZ, materialB, materialA],
      [
        componentCapacity(productZ, 4),
        componentCapacity(materialB, 5),
        componentCapacity(materialA, 6),
      ],
    );

    const result = await service.estimate('PARENT');

    expect(result.componentCapacities.map((entry) => entry.componentId)).toEqual([
      'C-A',
      'C-B',
      'C-Z',
    ]);
    expect(capacityProvider.calls).toEqual(['C-A', 'C-B', 'C-Z']);
  });

  it('returns not-ready when the Product has no direct or component capacity resources', async () => {
    const { service } = setup(neutralNoDirectCapacity(), [], []);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'not-ready',
      directMaterialApplicable: false,
      overallAssemblyCapacity: null,
      issues: [{ code: 'NO_CAPACITY_RESOURCES' }],
    });
  });

  it('returns partial without final capacity when Phase 2 direct capacity is partial', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const direct = directCapacity({
      status: 'partial',
      requirementStatus: 'partial',
      produciblePieces: null,
      limitingMaterialIds: [],
      issues: [
        {
          code: 'UPSTREAM_REQUIREMENT_ISSUE',
          sourceCode: 'FIXED_ITEM_NOT_DERIVABLE',
          message: 'Broken direct requirement.',
        },
      ],
    });
    const { service } = setup(direct, [jar], [componentCapacity(jar, 8)]);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'partial',
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'DIRECT_MATERIAL_CAPACITY_PARTIAL' })],
    });
  });

  it('does not treat broken direct requirements as neutral NO_REQUIREMENTS', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const direct = neutralNoDirectCapacity();
    direct.issues.push({
      code: 'UPSTREAM_REQUIREMENT_ISSUE',
      sourceCode: 'YIELD_HISTORY_NOT_DERIVABLE',
      message: 'Broken yield evidence.',
    });
    const { service } = setup(direct, [jar], [componentCapacity(jar, 8)]);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'partial',
      directMaterialApplicable: true,
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'DIRECT_MATERIAL_CAPACITY_NOT_READY' })],
    });
  });

  it('returns not-ready when unresolved direct capacity has no diagnostic capacity evidence', async () => {
    const direct = directCapacity({
      status: 'not-ready',
      requirementStatus: 'ready',
      produciblePieces: null,
      limitingMaterialIds: [],
      materials: [],
      issues: [{ code: 'INVENTORY_NOT_DERIVABLE', materialId: 'MAT-A', message: 'No inventory.' }],
    });
    const { service } = setup(direct, [], []);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'not-ready',
      overallAssemblyCapacity: null,
    });
  });

  it('returns partial when direct capacity is ready but one component is partial', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(
      directCapacity({ produciblePieces: 5 }),
      [jar],
      [componentCapacity(jar, null, 'partial')],
    );

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'partial',
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'COMPONENT_CAPACITY_PARTIAL' })],
    });
  });

  it('returns partial when direct capacity is ready but one component is not-ready', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(
      directCapacity({ produciblePieces: 5 }),
      [jar],
      [componentCapacity(jar, null, 'not-ready')],
    );

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'partial',
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'COMPONENT_CAPACITY_NOT_READY' })],
    });
  });

  it('returns partial for a component-only Product with both known and unresolved component capacity', async () => {
    const a = component('C-A', 'material', 'MAT-A');
    const b = component('C-B', 'product', 'PROD-B');
    const { service } = setup(
      neutralNoDirectCapacity(),
      [a, b],
      [componentCapacity(a, 5), componentCapacity(b, null, 'partial')],
    );

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'partial',
      overallAssemblyCapacity: null,
    });
  });

  it('returns not-ready for a component-only Product when all components are unresolved', async () => {
    const a = component('C-A', 'material', 'MAT-A');
    const b = component('C-B', 'product', 'PROD-B');
    const { service } = setup(
      neutralNoDirectCapacity(),
      [a, b],
      [componentCapacity(a, null, 'partial'), componentCapacity(b, null, 'not-ready')],
    );

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'not-ready',
      overallAssemblyCapacity: null,
    });
  });

  it('blocks duplicate component-source corruption before capacity arithmetic', async () => {
    const a = component('C-A', 'material', 'MAT-SAME');
    const b = component('C-B', 'material', 'MAT-SAME', 2);
    const { service, capacityProvider } = setup(
      neutralNoDirectCapacity(),
      [a, b],
      [componentCapacity(a, 10), componentCapacity(b, 5)],
    );

    const result = await service.estimate('PARENT');

    expect(result).toMatchObject({
      status: 'not-ready',
      overallAssemblyCapacity: null,
      componentCapacities: [],
      issues: [expect.objectContaining({ code: 'COMPONENT_GRAPH_INVALID' })],
    });
    expect(capacityProvider.calls).toEqual([]);
  });

  it('surfaces malformed component corruption through the existing graph validator', async () => {
    const invalid = component('C-BAD', 'material', 'MAT-A', 0);
    const { service } = setup(neutralNoDirectCapacity(), [invalid], []);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'not-ready',
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'COMPONENT_GRAPH_INVALID' })],
    });
  });

  it('downgrades a corrupted ready direct candidate instead of publishing it', async () => {
    const direct = directCapacity({
      produciblePieces: Number.NaN,
      materials: [],
      limitingMaterialIds: [],
    });
    const { service } = setup(direct, [], []);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'not-ready',
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'CAPACITY_CANDIDATE_INVALID' })],
    });
  });

  it('downgrades a corrupted ready component candidate instead of publishing it', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const bad = componentCapacity(jar, 4);
    bad.capacityPieces = Number.POSITIVE_INFINITY;
    const { service } = setup(directCapacity({ produciblePieces: 7 }), [jar], [bad]);

    expect(await service.estimate('PARENT')).toMatchObject({
      status: 'partial',
      overallAssemblyCapacity: null,
      issues: [expect.objectContaining({ code: 'CAPACITY_CANDIDATE_INVALID' })],
    });
  });

  it('preserves Phase 2 direct-material diagnostic capacity evidence', async () => {
    const direct = directCapacity({
      status: 'partial',
      requirementStatus: 'partial',
      produciblePieces: null,
      limitingMaterialIds: [],
      issues: [
        {
          code: 'UPSTREAM_REQUIREMENT_ISSUE',
          sourceCode: 'FIXED_ITEM_NOT_DERIVABLE',
          message: 'One broken line.',
        },
      ],
    });
    const { service } = setup(direct, [], []);

    const result = await service.estimate('PARENT');

    expect(result.status).toBe('partial');
    expect(result.overallAssemblyCapacity).toBeNull();
    expect(result.directMaterialCapacity.materials[0]).toMatchObject({
      materialId: 'MAT-DIRECT',
      capacityPieces: 10,
    });
  });

  it('preserves complete 3.4A source availability evidence', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR', 2);
    const line = componentCapacity(jar, 4);
    line.sourceAvailability = {
      sourceType: 'material',
      sourceId: 'MAT-JAR',
      status: 'ready',
      availableQuantity: 8,
      unit: 'pc',
      issues: [],
      materialInventoryNormalization: {
        enteredQuantity: 1,
        enteredUnit: 'box',
        baseUnit: 'pc',
        baseUnitsPerOnHandUnit: 8,
        normalizedBaseQuantity: 8,
        conversionSource: 'purchase-package',
        purchasePackageConversionSource: 'manual',
        calibrationId: null,
      },
    };
    const { service } = setup(neutralNoDirectCapacity(), [jar], [line]);

    expect((await service.estimate('PARENT')).componentCapacities[0].sourceAvailability).toMatchObject({
      sourceId: 'MAT-JAR',
      availableQuantity: 8,
      materialInventoryNormalization: {
        normalizedBaseQuantity: 8,
        purchasePackageConversionSource: 'manual',
      },
    });
  });

  it('does not mutate upstream direct or component capacity results', async () => {
    const direct = directCapacity();
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const line = componentCapacity(jar, 4);
    const { service } = setup(direct, [jar], [line]);

    const result = await service.estimate('PARENT');
    result.directMaterialCapacity.materials[0].capacityPieces = 999;
    result.componentCapacities[0].sourceId = 'CHANGED';

    expect(direct.materials[0].capacityPieces).toBe(10);
    expect(line.sourceId).toBe('MAT-JAR');
  });

  it('preserves archived Product activity state from Phase 2', async () => {
    const { service } = setup(directCapacity({ productIsActive: false }), [], []);

    expect((await service.estimate('PARENT')).productIsActive).toBe(false);
  });

  it('uses the canonical Product ID returned by Phase 2 for component enumeration', async () => {
    const { service, directProvider, componentProvider } = setup(directCapacity(), [], []);

    await service.estimate(' parent ');

    expect(directProvider.calls).toEqual(['parent']);
    expect(componentProvider.calls).toEqual(['PARENT']);
  });

  it('does not expose Phase 3.4C typed overall limiting-resource synthesis', async () => {
    const jar = component('C-JAR', 'material', 'MAT-JAR');
    const { service } = setup(directCapacity(), [jar], [componentCapacity(jar, 5)]);

    const result = await service.estimate('PARENT');

    expect(result).not.toHaveProperty('limitingResources');
    expect(result).not.toHaveProperty('limitingResourceIds');
    expect(result.directMaterialCapacity).toHaveProperty('limitingMaterialIds');
  });
});
