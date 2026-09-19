import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import type { ComponentCapacityResult } from '../productComponents/ComponentCapacityService';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import type { AssemblyCapacitySynthesisResult } from './AssemblyCapacitySynthesisService';
import {
  AssemblyCapacityTraceService,
  type AssemblyCapacityTraceProvider,
} from './AssemblyCapacityTraceService';
import type {
  MaterialProductionCapacity,
  ProductionCapacityResult,
} from './ProductionCapacityService';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'PROD-PARENT',
    name: 'Gift Box',
    category: 'candle',
    safetyWasteRate: 0,
    isActive: true,
    ...overrides,
  };
}

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 1,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

function materialCapacity(
  overrides: Partial<MaterialProductionCapacity> = {},
): MaterialProductionCapacity {
  return {
    materialId: 'MAT-PLASTER',
    baseUnit: 'g',
    normalizedOnHandBaseQuantity: 1000,
    plannedBaseQuantityPerProduct: 100,
    capacityPieces: 10,
    isLimiting: true,
    enteredOnHandQuantity: 1,
    enteredOnHandUnit: 'kg',
    inventoryConversionSource: 'standard',
    inventoryCalibrationId: null,
    ...overrides,
  };
}

function directCapacity(overrides: Partial<ProductionCapacityResult> = {}): ProductionCapacityResult {
  return {
    productId: 'PROD-PARENT',
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
    limitingMaterialIds: ['MAT-PLASTER'],
    materials: [materialCapacity()],
    issues: [],
    ...overrides,
  };
}

function componentCapacity(
  overrides: Partial<ComponentCapacityResult> = {},
): ComponentCapacityResult {
  return {
    componentId: 'COMP-JAR',
    parentProductId: 'PROD-PARENT',
    role: 'vessel',
    sourceType: 'material',
    sourceId: 'MAT-JAR',
    quantityPerParent: 1,
    status: 'ready',
    availableQuantity: 10,
    unit: 'pc',
    capacityPieces: 10,
    sourceAvailability: null,
    issues: [],
    ...overrides,
  };
}

function synthesis(
  overrides: Partial<AssemblyCapacitySynthesisResult> = {},
): AssemblyCapacitySynthesisResult {
  return {
    productId: 'PROD-PARENT',
    productIsActive: true,
    status: 'ready',
    directMaterialApplicable: true,
    directMaterialCapacity: directCapacity(),
    componentCapacities: [],
    overallAssemblyCapacity: 10,
    issues: [],
    ...overrides,
  };
}

function provider(value: AssemblyCapacitySynthesisResult): AssemblyCapacityTraceProvider {
  return {
    async estimate() {
      return value;
    },
  };
}

function traceService(
  value: AssemblyCapacitySynthesisResult,
  products: Product[] = [product()],
  materials: Material[] = [
    material(),
    material({
      id: 'MAT-JAR',
      name: 'Glass Jar',
      group: 'container',
      baseUnit: 'pc',
      purchaseQuantity: 1,
      purchaseUnit: 'pc',
      packageCost: 12,
      onHandQuantity: 10,
      onHandUnit: 'pc',
    }),
  ],
) {
  return new AssemblyCapacityTraceService(
    provider(value),
    new InMemoryProductRepository(products),
    new InMemoryMaterialRepository(materials),
  );
}

describe('AssemblyCapacityTraceService', () => {
  it('reports a direct Material requirement as a typed limiting resource', async () => {
    const result = await traceService(synthesis()).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.overallAssemblyCapacity).toBe(10);
    expect(result.limitingResources).toEqual([
      expect.objectContaining({
        resourceType: 'material-requirement',
        capacityPieces: 10,
        materialId: 'MAT-PLASTER',
        materialName: 'Plaster',
        baseUnit: 'g',
        normalizedOnHandBaseQuantity: 1000,
        plannedBaseQuantityPerProduct: 100,
      }),
    ]);
    expect(result.limitingResources[0]?.path).toEqual([
      { kind: 'product', id: 'PROD-PARENT', name: 'Gift Box' },
      { kind: 'material', id: 'MAT-PLASTER', name: 'Plaster' },
    ]);
  });

  it('preserves every direct Material tied at the direct minimum', async () => {
    const water = material({
      id: 'MAT-WATER',
      name: 'Water',
      group: 'liquid',
      baseUnit: 'mL',
      purchaseQuantity: 1,
      purchaseUnit: 'L',
      packageCost: 1,
      onHandQuantity: 1,
      onHandUnit: 'L',
    });
    const value = synthesis({
      directMaterialCapacity: directCapacity({
        limitingMaterialIds: ['MAT-WATER', 'MAT-PLASTER'],
        materials: [
          materialCapacity(),
          materialCapacity({
            materialId: 'MAT-WATER',
            baseUnit: 'mL',
            normalizedOnHandBaseQuantity: 500,
            plannedBaseQuantityPerProduct: 50,
            enteredOnHandQuantity: 0.5,
            enteredOnHandUnit: 'L',
          }),
        ],
      }),
    });

    const result = await traceService(value, [product()], [material(), water]).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.limitingResources.map((entry) => entry.resourceType)).toEqual([
      'material-requirement',
      'material-requirement',
    ]);
    expect(result.limitingResources.map((entry) =>
      entry.resourceType === 'material-requirement' ? entry.materialId : '',
    )).toEqual(['MAT-PLASTER', 'MAT-WATER']);
  });

  it('reports a Material-backed component tied at the overall minimum', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, limitingMaterialIds: ['MAT-PLASTER'], materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity()],
      overallAssemblyCapacity: 10,
    });

    const result = await traceService(value).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.limitingResources).toEqual([
      expect.objectContaining({
        resourceType: 'material-backed-component',
        componentId: 'COMP-JAR',
        materialId: 'MAT-JAR',
        materialName: 'Glass Jar',
        capacityPieces: 10,
        availableQuantity: 10,
        quantityPerParent: 1,
        role: 'vessel',
      }),
    ]);
  });

  it('reports a Product-backed component tied at the overall minimum', async () => {
    const child = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [
        componentCapacity({
          componentId: 'COMP-CANDLE',
          sourceType: 'product',
          sourceId: child.id,
          role: 'molded-component',
          quantityPerParent: 2,
          availableQuantity: 20,
          capacityPieces: 10,
        }),
      ],
    });

    const result = await traceService(value, [product(), child]).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.limitingResources).toEqual([
      expect.objectContaining({
        resourceType: 'product-backed-component',
        componentId: 'COMP-CANDLE',
        productId: 'PROD-CANDLE',
        productName: 'Candle',
        capacityPieces: 10,
        availableQuantity: 20,
        quantityPerParent: 2,
      }),
    ]);
    expect(result.limitingResources[0]?.path).toEqual([
      { kind: 'product', id: 'PROD-PARENT', name: 'Gift Box' },
      { kind: 'product', id: 'PROD-CANDLE', name: 'Candle' },
    ]);
  });

  it('preserves a cross-category tie between direct Material and Material-backed component', async () => {
    const value = synthesis({ componentCapacities: [componentCapacity()] });
    const result = await traceService(value).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.limitingResources.map((entry) => entry.resourceType)).toEqual([
      'material-requirement',
      'material-backed-component',
    ]);
  });

  it('preserves multiple component ties', async () => {
    const candle = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [
        componentCapacity(),
        componentCapacity({ componentId: 'COMP-CANDLE', sourceType: 'product', sourceId: 'PROD-CANDLE' }),
      ],
    });

    const result = await traceService(value, [product(), candle]).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.limitingResources).toHaveLength(2);
    expect(result.limitingResources.map((entry) => entry.resourceType)).toEqual([
      'material-backed-component',
      'product-backed-component',
    ]);
  });

  it('preserves a three-resource-type tie', async () => {
    const candle = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const value = synthesis({
      componentCapacities: [
        componentCapacity({ componentId: 'COMP-CANDLE', sourceType: 'product', sourceId: 'PROD-CANDLE' }),
        componentCapacity(),
      ],
    });

    const result = await traceService(value, [product(), candle]).trace('PROD-PARENT');

    expect(result.status).toBe('ready');
    expect(result.limitingResources.map((entry) => entry.resourceType)).toEqual([
      'material-requirement',
      'material-backed-component',
      'product-backed-component',
    ]);
  });

  it('treats zero direct-material capacity as an authoritative tied limiter', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({
        produciblePieces: 0,
        materials: [materialCapacity({ capacityPieces: 0, normalizedOnHandBaseQuantity: 0 })],
      }),
      overallAssemblyCapacity: 0,
    });

    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('ready');
    expect(result.limitingResources[0]).toMatchObject({ resourceType: 'material-requirement', capacityPieces: 0 });
  });

  it('treats zero component capacity as an authoritative tied limiter', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity({ availableQuantity: 0, capacityPieces: 0 })],
      overallAssemblyCapacity: 0,
    });

    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('ready');
    expect(result.limitingResources[0]).toMatchObject({ resourceType: 'material-backed-component', capacityPieces: 0 });
  });

  it('preserves all zero-capacity cross-category ties', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({
        produciblePieces: 0,
        materials: [materialCapacity({ capacityPieces: 0, normalizedOnHandBaseQuantity: 0 })],
      }),
      componentCapacities: [componentCapacity({ availableQuantity: 0, capacityPieces: 0 })],
      overallAssemblyCapacity: 0,
    });

    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('ready');
    expect(result.limitingResources.map((entry) => entry.resourceType)).toEqual([
      'material-requirement',
      'material-backed-component',
    ]);
  });

  it('excludes direct Materials when the direct side is not tied at the final minimum', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity({ capacityPieces: 5, availableQuantity: 5 })],
      overallAssemblyCapacity: 5,
    });

    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.limitingResources).toHaveLength(1);
    expect(result.limitingResources[0]?.resourceType).toBe('material-backed-component');
  });

  it('excludes components above the final minimum', async () => {
    const value = synthesis({ componentCapacities: [componentCapacity({ capacityPieces: 25, availableQuantity: 25 })] });
    const result = await traceService(value).trace('PROD-PARENT');

    expect(result.limitingResources).toHaveLength(1);
    expect(result.limitingResources[0]?.resourceType).toBe('material-requirement');
  });

  it('orders tied resources deterministically by type then canonical source identity', async () => {
    const candleB = product({ id: 'PROD-B', name: 'B Candle' });
    const candleA = product({ id: 'PROD-A', name: 'A Candle' });
    const jarB = material({ id: 'MAT-JAR-B', name: 'Jar B', group: 'container', baseUnit: 'pc', purchaseUnit: 'pc', onHandUnit: 'pc' });
    const jarA = material({ id: 'MAT-JAR-A', name: 'Jar A', group: 'container', baseUnit: 'pc', purchaseUnit: 'pc', onHandUnit: 'pc' });
    const water = material({ id: 'MAT-WATER', name: 'Water', group: 'liquid', baseUnit: 'mL', purchaseUnit: 'L', onHandUnit: 'L' });
    const value = synthesis({
      directMaterialCapacity: directCapacity({
        limitingMaterialIds: ['MAT-WATER', 'MAT-PLASTER'],
        materials: [
          materialCapacity({ materialId: 'MAT-WATER', baseUnit: 'mL', enteredOnHandUnit: 'L' }),
          materialCapacity(),
        ],
      }),
      componentCapacities: [
        componentCapacity({ componentId: 'CP-B', sourceType: 'product', sourceId: 'PROD-B' }),
        componentCapacity({ componentId: 'CM-B', sourceId: 'MAT-JAR-B' }),
        componentCapacity({ componentId: 'CP-A', sourceType: 'product', sourceId: 'PROD-A' }),
        componentCapacity({ componentId: 'CM-A', sourceId: 'MAT-JAR-A' }),
      ],
    });

    const result = await traceService(
      value,
      [product(), candleB, candleA],
      [material(), water, jarB, jarA],
    ).trace('PROD-PARENT');

    expect(result.limitingResources.map((entry) => {
      if (entry.resourceType === 'material-requirement') return `${entry.resourceType}:${entry.materialId}`;
      if (entry.resourceType === 'material-backed-component') return `${entry.resourceType}:${entry.materialId}`;
      return `${entry.resourceType}:${entry.productId}`;
    })).toEqual([
      'material-requirement:MAT-PLASTER',
      'material-requirement:MAT-WATER',
      'material-backed-component:MAT-JAR-A',
      'material-backed-component:MAT-JAR-B',
      'product-backed-component:PROD-A',
      'product-backed-component:PROD-B',
    ]);
  });

  it('preserves direct requirement quantity and inventory evidence on a limiter', async () => {
    const result = await traceService(synthesis()).trace('PROD-PARENT');
    expect(result.limitingResources[0]).toMatchObject({
      resourceType: 'material-requirement',
      normalizedOnHandBaseQuantity: 1000,
      plannedBaseQuantityPerProduct: 100,
      baseUnit: 'g',
    });
  });

  it('preserves component role, quantity, and availability evidence on a limiter', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity({ role: 'insert', quantityPerParent: 2, availableQuantity: 20 })],
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.limitingResources[0]).toMatchObject({
      resourceType: 'material-backed-component',
      role: 'insert',
      quantityPerParent: 2,
      availableQuantity: 20,
    });
  });

  it('preserves ProductStock evidence inside the nested 3.4B/3.4A snapshot', async () => {
    const child = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const component = componentCapacity({
      componentId: 'COMP-CANDLE',
      sourceType: 'product',
      sourceId: child.id,
      sourceAvailability: {
        sourceType: 'product',
        sourceId: child.id,
        status: 'ready',
        availableQuantity: 10,
        unit: 'pc',
        issues: [],
        productStock: { productId: child.id, onHandQuantity: 10, notes: 'finished stock' },
      },
    });
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [component],
    });

    const result = await traceService(value, [product(), child]).trace('PROD-PARENT');
    expect(result.capacitySynthesis.componentCapacities[0]?.sourceAvailability?.productStock).toEqual({
      productId: 'PROD-CANDLE',
      onHandQuantity: 10,
      notes: 'finished stock',
    });
  });

  it('returns partial without authoritative limiters when upstream 3.4B is partial', async () => {
    const value = synthesis({
      status: 'partial',
      overallAssemblyCapacity: null,
      issues: [{ code: 'COMPONENT_CAPACITY_PARTIAL', message: 'Missing stock.', productId: 'PROD-PARENT' }],
    });
    const result = await traceService(value).trace('PROD-PARENT');

    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues[0]).toMatchObject({ code: 'UPSTREAM_CAPACITY_PARTIAL' });
    expect(result.capacitySynthesis.issues[0]).toMatchObject({ code: 'COMPONENT_CAPACITY_PARTIAL' });
  });

  it('returns not-ready without authoritative limiters when upstream 3.4B is not-ready', async () => {
    const value = synthesis({
      status: 'not-ready',
      overallAssemblyCapacity: null,
      issues: [{ code: 'NO_CAPACITY_RESOURCES', message: 'No resources.', productId: 'PROD-PARENT' }],
    });
    const result = await traceService(value).trace('PROD-PARENT');

    expect(result.status).toBe('not-ready');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues[0]).toMatchObject({ code: 'UPSTREAM_CAPACITY_NOT_READY' });
  });

  it('downgrades a ready synthesis with null overall capacity to partial', async () => {
    const result = await traceService(synthesis({ overallAssemblyCapacity: null })).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'OVERALL_CAPACITY_INVALID' }));
  });

  it('downgrades a ready synthesis with fractional overall capacity to partial', async () => {
    const result = await traceService(synthesis({ overallAssemblyCapacity: 10.5 })).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'OVERALL_CAPACITY_INVALID' }));
  });

  it('downgrades to partial when the parent Product cannot be resolved', async () => {
    const result = await traceService(synthesis(), [], [material()]).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.productName).toBeNull();
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'PARENT_PRODUCT_NOT_FOUND' }));
  });

  it('downgrades to partial when a direct limiting Material ID has no capacity line', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ limitingMaterialIds: ['MAT-MISSING'] }),
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DIRECT_LIMITER_LINE_MISSING', materialId: 'MAT-MISSING' }));
  });

  it('downgrades to partial when a direct limiter line does not equal the final minimum', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ materials: [materialCapacity({ capacityPieces: 9 })] }),
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DIRECT_LIMITER_CAPACITY_MISMATCH' }));
  });

  it('downgrades to partial when a direct limiting Material source disappears', async () => {
    const result = await traceService(synthesis(), [product()], []).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'LIMITER_SOURCE_NOT_FOUND', sourceId: 'MAT-PLASTER' }));
  });

  it('downgrades to partial when a limiting Material component source disappears', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity()],
    });
    const result = await traceService(value, [product()], [material()]).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'LIMITER_SOURCE_NOT_FOUND', sourceId: 'MAT-JAR' }));
  });

  it('downgrades to partial when a limiting Product component source disappears', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity({ sourceType: 'product', sourceId: 'PROD-MISSING' })],
    });
    const result = await traceService(value, [product()]).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'LIMITER_SOURCE_NOT_FOUND', sourceId: 'PROD-MISSING' }));
  });

  it('downgrades to partial when a limiting component has invalid availability evidence', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity({ availableQuantity: null })],
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'LIMITER_CAPACITY_INVALID', componentId: 'COMP-JAR' }));
  });

  it('downgrades a ready synthesis containing any invalid component capacity candidate', async () => {
    const value = synthesis({
      componentCapacities: [componentCapacity({ capacityPieces: null, status: 'ready' })],
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'LIMITER_CAPACITY_INVALID' }));
  });

  it('downgrades a ready synthesis with no derivable limiter to partial', async () => {
    const value = synthesis({
      directMaterialApplicable: false,
      directMaterialCapacity: directCapacity({
        status: 'not-ready',
        requirementStatus: 'not-ready',
        produciblePieces: null,
        limitingMaterialIds: [],
        materials: [],
        issues: [{ code: 'UPSTREAM_REQUIREMENT_ISSUE', sourceCode: 'NO_REQUIREMENTS', message: 'No requirements.' }],
      }),
      componentCapacities: [],
      overallAssemblyCapacity: 10,
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('partial');
    expect(result.issues).toEqual([expect.objectContaining({ code: 'NO_LIMITING_RESOURCES' })]);
  });

  it('matches direct limiting Material identity case-insensitively', async () => {
    const value = synthesis({
      directMaterialCapacity: directCapacity({ limitingMaterialIds: ['mat-plaster'] }),
    });
    const result = await traceService(value).trace('PROD-PARENT');
    expect(result.status).toBe('ready');
    expect(result.limitingResources[0]).toMatchObject({ materialId: 'MAT-PLASTER', materialName: 'Plaster' });
  });

  it('preserves canonical Product identity and activity from the upstream synthesis', async () => {
    const archived = product({ isActive: false });
    const value = synthesis({ productIsActive: false, directMaterialCapacity: directCapacity({ productIsActive: false }) });
    const result = await traceService(value, [archived]).trace('  PROD-PARENT  ');

    expect(result.productId).toBe('PROD-PARENT');
    expect(result.productName).toBe('Gift Box');
    expect(result.productIsActive).toBe(false);
  });

  it('does not mutate the upstream synthesis or source repositories', async () => {
    const value = synthesis({ componentCapacities: [componentCapacity()] });
    const before = JSON.stringify(value);
    const products = new InMemoryProductRepository([product()]);
    const materials = new InMemoryMaterialRepository([
      material(),
      material({ id: 'MAT-JAR', name: 'Glass Jar', group: 'container', baseUnit: 'pc', purchaseUnit: 'pc', onHandUnit: 'pc' }),
    ]);
    const service = new AssemblyCapacityTraceService(provider(value), products, materials);

    await service.trace('PROD-PARENT');

    expect(JSON.stringify(value)).toBe(before);
    expect(await products.findById('PROD-PARENT')).toEqual(product());
  });

  it('defensively clones nested upstream evidence in the returned trace', async () => {
    const child = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const value = synthesis({
      componentCapacities: [
        componentCapacity({
          componentId: 'COMP-CANDLE',
          sourceType: 'product',
          sourceId: child.id,
          sourceAvailability: {
            sourceType: 'product',
            sourceId: child.id,
            status: 'ready',
            availableQuantity: 10,
            unit: 'pc',
            issues: [],
            productStock: { productId: child.id, onHandQuantity: 10 },
          },
        }),
      ],
    });
    const result = await traceService(value, [product(), child]).trace('PROD-PARENT');

    result.capacitySynthesis.directMaterialCapacity.materials[0]!.capacityPieces = 999;
    result.capacitySynthesis.componentCapacities[0]!.capacityPieces = 999;
    if (result.capacitySynthesis.componentCapacities[0]!.sourceAvailability?.productStock) {
      result.capacitySynthesis.componentCapacities[0]!.sourceAvailability!.productStock!.onHandQuantity = 999;
    }
    if (result.limitingResources[0]) result.limitingResources[0].path[0]!.name = 'Changed';

    expect(value.directMaterialCapacity.materials[0]?.capacityPieces).toBe(10);
    expect(value.componentCapacities[0]?.capacityPieces).toBe(10);
    expect(value.componentCapacities[0]?.sourceAvailability?.productStock?.onHandQuantity).toBe(10);
  });

  it('keeps Product-backed limiter paths on the immediate current assembly edge', async () => {
    const candle = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const pot = product({ id: 'PROD-POT', name: 'Handmade Pot', category: 'candle-pot' });
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [componentCapacity({ sourceType: 'product', sourceId: candle.id })],
    });

    const result = await traceService(value, [product(), candle, pot]).trace('PROD-PARENT');
    expect(result.status).toBe('ready');
    expect(result.limitingResources[0]?.path.map((node) => node.name)).toEqual(['Gift Box', 'Candle']);
    expect(result.limitingResources[0]?.path.map((node) => node.name)).not.toContain('Handmade Pot');
  });

  it('does not replace explicit ProductStock-based component evidence with recursive manufacture capacity', async () => {
    const candle = product({ id: 'PROD-CANDLE', name: 'Candle' });
    const value = synthesis({
      directMaterialCapacity: directCapacity({ produciblePieces: 20, materials: [materialCapacity({ capacityPieces: 20 })] }),
      componentCapacities: [
        componentCapacity({
          sourceType: 'product',
          sourceId: candle.id,
          availableQuantity: 0,
          capacityPieces: 0,
          sourceAvailability: {
            sourceType: 'product',
            sourceId: candle.id,
            status: 'ready',
            availableQuantity: 0,
            unit: 'pc',
            issues: [],
            productStock: { productId: candle.id, onHandQuantity: 0 },
          },
        }),
      ],
      overallAssemblyCapacity: 0,
    });

    const result = await traceService(value, [product(), candle]).trace('PROD-PARENT');
    expect(result.status).toBe('ready');
    expect(result.limitingResources[0]).toMatchObject({
      resourceType: 'product-backed-component',
      productId: 'PROD-CANDLE',
      availableQuantity: 0,
      capacityPieces: 0,
    });
    expect(result.capacitySynthesis.componentCapacities[0]?.sourceAvailability?.productStock?.onHandQuantity).toBe(0);
  });
});
