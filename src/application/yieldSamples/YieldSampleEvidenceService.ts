import { isMixPresetCompatibleWithCategory } from '../../domain/mixPresets';
import { isMaterialCupWeightBridge } from '../../domain/materials';
import { areUnitsCompatible } from '../../domain/units';
import {
  cloneYieldSample,
  normalizeYieldSampleEvidence,
  validateYieldSampleContract,
  type YieldSample,
} from '../../domain/yieldSamples';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { MixPresetRepository } from '../mixPresets/MixPresetRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { YieldSampleRepository } from './YieldSampleRepository';

export interface YieldSampleListFilter {
  productId?: string;
  mixPresetId?: string;
  materialId?: string;
}

export type YieldSampleApplicationErrorCode =
  | 'DUPLICATE_YIELD_SAMPLE_ID'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'MIX_PRESET_NOT_FOUND'
  | 'MIX_PRESET_INACTIVE'
  | 'MIX_PRESET_CATEGORY_MISMATCH'
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_INACTIVE'
  | 'MATERIAL_UNIT_INCOMPATIBLE';

export class YieldSampleApplicationError extends Error {
  readonly code: YieldSampleApplicationErrorCode;
  readonly sampleId?: string;
  readonly productId?: string;
  readonly mixPresetId?: string;
  readonly materialId?: string;

  constructor(
    code: YieldSampleApplicationErrorCode,
    message: string,
    context: {
      sampleId?: string;
      productId?: string;
      mixPresetId?: string;
      materialId?: string;
    } = {},
  ) {
    super(message);
    this.name = 'YieldSampleApplicationError';
    this.code = code;
    Object.assign(this, context);
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

export class YieldSampleEvidenceService {
  constructor(
    private readonly repository: YieldSampleRepository,
    private readonly productRepository: ProductRepository,
    private readonly mixPresetRepository: MixPresetRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  async recordSample(input: YieldSample): Promise<YieldSample> {
    const sample = normalizeYieldSampleEvidence(input);
    validateYieldSampleContract(sample);

    const existing = await this.repository.findById(sample.id);
    if (existing) {
      throw new YieldSampleApplicationError(
        'DUPLICATE_YIELD_SAMPLE_ID',
        `Yield sample ID already exists: ${sample.id}.`,
        { sampleId: sample.id },
      );
    }

    await this.validateReferencesForNewSample(sample);
    await this.repository.insert(sample);
    return cloneYieldSample(sample);
  }

  async getSample(id: string): Promise<YieldSample | null> {
    const sample = await this.repository.findById(id);
    return sample ? cloneYieldSample(sample) : null;
  }

  async listSamples(filter: YieldSampleListFilter = {}): Promise<YieldSample[]> {
    const productKey = filter.productId ? comparable(filter.productId) : undefined;
    const mixKey = filter.mixPresetId ? comparable(filter.mixPresetId) : undefined;
    const materialKey = filter.materialId ? comparable(filter.materialId) : undefined;

    return (await this.repository.list())
      .filter((sample) => productKey === undefined || comparable(sample.productId) === productKey)
      .filter(
        (sample) =>
          mixKey === undefined ||
          (sample.mixPresetId !== undefined && comparable(sample.mixPresetId) === mixKey),
      )
      .filter(
        (sample) =>
          materialKey === undefined ||
          sample.materialInputs.some((input) => comparable(input.materialId) === materialKey),
      )
      .sort((a, b) => {
        const byRecordedAt = Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
        return byRecordedAt || a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
      })
      .map(cloneYieldSample);
  }

  private async validateReferencesForNewSample(sample: YieldSample): Promise<void> {
    const product = await this.productRepository.findById(sample.productId);
    if (!product) {
      throw new YieldSampleApplicationError(
        'PRODUCT_NOT_FOUND',
        `Product not found for yield sample ${sample.id}: ${sample.productId}.`,
        { sampleId: sample.id, productId: sample.productId },
      );
    }
    if (!product.isActive) {
      throw new YieldSampleApplicationError(
        'PRODUCT_INACTIVE',
        `New yield sample ${sample.id} requires an active product: ${product.id}.`,
        { sampleId: sample.id, productId: product.id },
      );
    }

    if (sample.mixPresetId !== undefined) {
      const preset = await this.mixPresetRepository.findById(sample.mixPresetId);
      if (!preset) {
        throw new YieldSampleApplicationError(
          'MIX_PRESET_NOT_FOUND',
          `Mix preset not found for yield sample ${sample.id}: ${sample.mixPresetId}.`,
          { sampleId: sample.id, mixPresetId: sample.mixPresetId },
        );
      }
      if (!preset.isActive) {
        throw new YieldSampleApplicationError(
          'MIX_PRESET_INACTIVE',
          `New yield sample ${sample.id} requires an active mix preset: ${preset.id}.`,
          { sampleId: sample.id, mixPresetId: preset.id },
        );
      }
      if (!isMixPresetCompatibleWithCategory(preset, product.category)) {
        throw new YieldSampleApplicationError(
          'MIX_PRESET_CATEGORY_MISMATCH',
          `Mix preset ${preset.id} is not compatible with product category ${product.category}.`,
          { sampleId: sample.id, mixPresetId: preset.id, productId: product.id },
        );
      }
    }

    for (const input of sample.materialInputs) {
      const material = await this.materialRepository.findById(input.materialId);
      if (!material) {
        throw new YieldSampleApplicationError(
          'MATERIAL_NOT_FOUND',
          `Material not found for yield sample ${sample.id}: ${input.materialId}.`,
          { sampleId: sample.id, materialId: input.materialId },
        );
      }
      if (!material.isActive) {
        throw new YieldSampleApplicationError(
          'MATERIAL_INACTIVE',
          `New yield sample ${sample.id} requires active material ${material.id}.`,
          { sampleId: sample.id, materialId: material.id },
        );
      }

      const compatible =
        areUnitsCompatible(input.unit, material.baseUnit) ||
        isMaterialCupWeightBridge(input.unit, material.baseUnit);
      if (!compatible) {
        throw new YieldSampleApplicationError(
          'MATERIAL_UNIT_INCOMPATIBLE',
          `Unit ${input.unit} cannot be normalized for material ${material.id} with base unit ${material.baseUnit}.`,
          { sampleId: sample.id, materialId: material.id },
        );
      }
    }
  }
}
