import type { YieldSample } from '../../domain/yieldSamples';
import { cloneYieldSample } from '../../domain/yieldSamples';
import type { YieldSampleRepository } from './YieldSampleRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryYieldSampleRepository implements YieldSampleRepository {
  private readonly samples = new Map<string, YieldSample>();

  constructor(seed: YieldSample[] = []) {
    for (const sample of seed) {
      this.samples.set(key(sample.id), cloneYieldSample(sample));
    }
  }

  async list(): Promise<YieldSample[]> {
    return [...this.samples.values()].map(cloneYieldSample);
  }

  async findById(id: string): Promise<YieldSample | null> {
    const sample = this.samples.get(key(id));
    return sample ? cloneYieldSample(sample) : null;
  }

  async insert(sample: YieldSample): Promise<void> {
    this.samples.set(key(sample.id), cloneYieldSample(sample));
  }
}
