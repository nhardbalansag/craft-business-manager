import type { MixPreset } from '../../domain/mixPresets';

/** Persistence boundary for mix-preset application services. */
export interface MixPresetRepository {
  list(): Promise<MixPreset[]>;
  findById(id: string): Promise<MixPreset | null>;
  insert(preset: MixPreset): Promise<void>;
  replace(preset: MixPreset): Promise<void>;
}
