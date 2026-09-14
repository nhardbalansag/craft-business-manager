import type { YieldSample } from '../../domain/yieldSamples';

/** Persistence boundary for immutable production/yield evidence. */
export interface YieldSampleRepository {
  list(): Promise<YieldSample[]>;
  findById(id: string): Promise<YieldSample | null>;
  insert(sample: YieldSample): Promise<void>;
}
