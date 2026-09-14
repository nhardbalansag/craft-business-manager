import type { MixPreset } from '../../domain/mixPresets';
import { cloneMixPreset } from '../../domain/mixPresets';
import type { MixPresetRepository } from './MixPresetRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryMixPresetRepository implements MixPresetRepository {
  private readonly presets = new Map<string, MixPreset>();

  constructor(seed: MixPreset[] = []) {
    for (const preset of seed) {
      this.presets.set(key(preset.id), cloneMixPreset(preset));
    }
  }

  async list(): Promise<MixPreset[]> {
    return [...this.presets.values()].map(cloneMixPreset);
  }

  async findById(id: string): Promise<MixPreset | null> {
    const preset = this.presets.get(key(id));
    return preset ? cloneMixPreset(preset) : null;
  }

  async insert(preset: MixPreset): Promise<void> {
    this.presets.set(key(preset.id), cloneMixPreset(preset));
  }

  async replace(preset: MixPreset): Promise<void> {
    this.presets.set(key(preset.id), cloneMixPreset(preset));
  }
}
