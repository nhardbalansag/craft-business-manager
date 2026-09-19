import type { YieldSample } from '../../domain/yieldSamples';
import { cloneYieldSample } from '../../domain/yieldSamples';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { YieldSampleRepository } from './YieldSampleRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryYieldSampleRepository
  implements YieldSampleRepository, CollectionReplacementPort<YieldSample>
{
  private samples = new Map<string, YieldSample>();

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

  async delete(id: string): Promise<void> {
    this.samples.delete(key(id));
  }

  async replaceAll(records: readonly YieldSample[]): Promise<void> {
    const next = new Map<string, YieldSample>();
    for (const sample of records) {
      next.set(key(sample.id), cloneYieldSample(sample));
    }
    this.samples = next;
  }
}
