import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { ProductComponent } from '../../domain/productComponents';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { ComponentSourceAvailabilityService } from './ComponentSourceAvailabilityService';
import { MaterialBackedComponentCostService } from './MaterialBackedComponentCostService';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'glass-cup',
    name: 'Glass Cup',
    group: 'container',
    baseUnit: 'pc',
    purchaseQuantity: 1,
    purchaseUnit: 'pc',
    packageCost: 12,
    onHandQuantity: 10,
    onHandUnit: 'pc',
    isActive: true,
    ...overrides,
  };
}

function component(overrides: Partial<ProductComponent> = {}): ProductComponent {
  return {
    id: 'component-1',
    parentProductId: 'parent-1',
    sourceType: 'material',
    sourceId: 'glass-cup',
    role: 'vessel',
    quantityPerParent: 1,
    ...overrides,
  };
}

function setup(materials: Material[] = []) {
  const materialRepository = new InMemoryMaterialRepository(materials);
  const availability = new ComponentSourceAvailabilityService(
    materialRepository,
    new InMemoryProductRepository(),
    new InMemoryProductStockRepository(),
  );
  const service = new MaterialBackedComponentCostService(materialRepository, availability);
  return { materialRepository, availability, service };
}

describe('MaterialBackedComponentCostService', () => {
  it('derives direct pc purchase cost through the Phase 1 standard conversion', async () => {
    const { service } = setup([
      material({ purchaseQuantity: 10, purchaseUnit: 'pc', packageCost: 60 }),
    ]);

    const result = await service.costComponent(component());

    expect(result).toMatchObject({
      status: 'ready',
      sourceMaterialId: 'glass-cup',
      sourceMaterialName: 'Glass Cup',
      quantityPerParent: 1,
      costPerPc: 6,
      componentCostContribution: 6,
      issues: [],
      costingTrace: {
        packageCost: 60,
        purchaseQuantity: 10,
        purchaseUnit: 'pc',
        baseUnit: 'pc',
        standardBaseUnitsPerPurchaseUnit: 1,
        effectiveBaseUnitsPerPurchaseUnit: 1,
        packageBaseQuantity: 10,
        packageConversionSource: 'standard',
        costingCalibrationId: null,
      },
    });
  });

  it('uses Phase 1 manual package conversion for packaged count Material', async () => {
    const { service } = setup([
      material({
        id: 'boxed-cups',
        name: 'Boxed Cups',
        purchaseQuantity: 1,
        purchaseUnit: 'box',
        packageCost: 250,
        manualBaseUnitsPerPurchaseUnit: 50,
        onHandQuantity: 50,
        onHandUnit: 'pc',
      }),
    ]);

    const result = await service.costComponent(component({ sourceId: 'boxed-cups' }));

    expect(result).toMatchObject({
      status: 'ready',
      costPerPc: 5,
      componentCostContribution: 5,
      costingTrace: {
        manualBaseUnitsPerPurchaseUnit: 50,
        effectiveBaseUnitsPerPurchaseUnit: 50,
        packageBaseQuantity: 50,
        packageConversionSource: 'manual',
      },
    });
  });

  it('multiplies cost per pc by quantity required per parent', async () => {
    const { service } = setup([
      material({ purchaseQuantity: 10, packageCost: 25 }),
    ]);

    const result = await service.costComponent(component({ quantityPerParent: 4 }));

    expect(result.costPerPc).toBe(2.5);
    expect(result.componentCostContribution).toBe(10);
  });

  it('keeps legitimate zero package cost as a ready zero-cost component', async () => {
    const { service } = setup([material({ packageCost: 0 })]);

    expect(await service.costComponent(component({ quantityPerParent: 3 }))).toMatchObject({
      status: 'ready',
      costPerPc: 0,
      componentCostContribution: 0,
      issues: [],
    });
  });

  it('preserves Phase 1 manual conversion precedence over standard conversion', async () => {
    const { service } = setup([
      material({
        purchaseQuantity: 1,
        purchaseUnit: 'pc',
        packageCost: 100,
        manualBaseUnitsPerPurchaseUnit: 20,
      }),
    ]);

    const result = await service.costComponent(component());

    expect(result).toMatchObject({
      status: 'ready',
      costPerPc: 5,
      costingTrace: {
        standardBaseUnitsPerPurchaseUnit: 1,
        manualBaseUnitsPerPurchaseUnit: 20,
        effectiveBaseUnitsPerPurchaseUnit: 20,
        packageConversionSource: 'manual',
      },
    });
  });

  it('preserves canonical Material identity and display name from the repository', async () => {
    const { service } = setup([
      material({ id: 'Cup-A', name: 'Premium Glass Cup' }),
    ]);

    const result = await service.costComponent(component({ sourceId: ' cup-a ' }));

    expect(result).toMatchObject({
      status: 'ready',
      sourceMaterialId: 'Cup-A',
      sourceMaterialName: 'Premium Glass Cup',
    });
  });

  it('allows costing to remain ready when 3.2C availability is only partial', async () => {
    const { service } = setup([
      material({
        purchaseQuantity: 10,
        packageCost: 50,
        onHandQuantity: -2,
      }),
    ]);

    const result = await service.costComponent(component());

    expect(result).toMatchObject({
      status: 'ready',
      costPerPc: 5,
      componentCostContribution: 5,
      sourceAvailability: {
        status: 'partial',
        availableQuantity: null,
        issues: [{ code: 'SOURCE_MATERIAL_NEGATIVE_ON_HAND' }],
      },
      issues: [],
    });
  });

  it('returns not-ready when the Material source is missing according to 3.2C', async () => {
    const { service } = setup();

    expect(await service.costComponent(component())).toMatchObject({
      status: 'not-ready',
      sourceMaterialName: null,
      costPerPc: null,
      componentCostContribution: null,
      issues: [
        {
          code: 'SOURCE_MATERIAL_NOT_READY',
          underlyingCode: 'SOURCE_MATERIAL_NOT_FOUND',
        },
      ],
    });
  });

  it('returns not-ready for an inactive Material and keeps its name for diagnostics', async () => {
    const { service } = setup([material({ isActive: false })]);

    expect(await service.costComponent(component())).toMatchObject({
      status: 'not-ready',
      sourceMaterialName: 'Glass Cup',
      issues: [
        {
          code: 'SOURCE_MATERIAL_NOT_READY',
          underlyingCode: 'SOURCE_MATERIAL_INACTIVE',
        },
      ],
    });
  });

  it('returns not-ready for a non-count Material source through 3.2C eligibility', async () => {
    const { service } = setup([
      material({
        name: 'Wax',
        group: 'wax',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        onHandQuantity: 500,
        onHandUnit: 'g',
      }),
    ]);

    expect(await service.costComponent(component())).toMatchObject({
      status: 'not-ready',
      issues: [
        {
          code: 'SOURCE_MATERIAL_NOT_READY',
          underlyingCode: 'SOURCE_MATERIAL_NOT_COUNT_BASED',
        },
      ],
    });
  });

  it('rejects Product-backed components without entering recursive Product costing', async () => {
    const { service } = setup();

    expect(
      await service.costComponent(
        component({
          sourceType: 'product',
          sourceId: 'child-product',
          role: 'molded-component',
        }),
      ),
    ).toMatchObject({
      status: 'not-ready',
      issues: [{ code: 'NOT_MATERIAL_BACKED_COMPONENT' }],
    });
  });

  it('returns controlled not-ready output for an invalid ProductComponent contract', async () => {
    const { service } = setup([material()]);

    expect(await service.costComponent(component({ quantityPerParent: 1.5 }))).toMatchObject({
      status: 'not-ready',
      issues: [
        {
          code: 'INVALID_COMPONENT',
          underlyingCode: 'NON_INTEGER_QUANTITY',
        },
      ],
    });
  });

  it('returns Phase 1 costing evidence when package conversion is unresolved', async () => {
    const { service } = setup([
      material({
        purchaseQuantity: 1,
        purchaseUnit: 'box',
        packageCost: 100,
        manualBaseUnitsPerPurchaseUnit: undefined,
        onHandQuantity: 5,
        onHandUnit: 'pc',
      }),
    ]);

    expect(await service.costComponent(component())).toMatchObject({
      status: 'not-ready',
      costPerPc: null,
      costingTrace: null,
      issues: [
        {
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          underlyingCode: 'MISSING_PACKAGE_CONVERSION',
        },
      ],
    });
  });

  it('returns Phase 1 costing evidence for invalid package cost', async () => {
    const { service } = setup([material({ packageCost: -1 })]);

    expect(await service.costComponent(component())).toMatchObject({
      status: 'not-ready',
      issues: [
        {
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          underlyingCode: 'NEGATIVE_PACKAGE_COST',
        },
      ],
    });
  });

  it('returns Phase 1 costing evidence for invalid purchase quantity', async () => {
    const { service } = setup([material({ purchaseQuantity: 0 })]);

    expect(await service.costComponent(component())).toMatchObject({
      status: 'not-ready',
      issues: [
        {
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          underlyingCode: 'NON_POSITIVE_PURCHASE_QUANTITY',
        },
      ],
    });
  });

  it('does not mutate ProductComponent or Material source records', async () => {
    const sourceMaterial = material({ notes: ' keep material ' });
    const sourceComponent = component({ notes: ' keep component ' });
    const originalMaterial = { ...sourceMaterial };
    const originalComponent = { ...sourceComponent };
    const { service } = setup([sourceMaterial]);

    await service.costComponent(sourceComponent);

    expect(sourceMaterial).toEqual(originalMaterial);
    expect(sourceComponent).toEqual(originalComponent);
  });
});
