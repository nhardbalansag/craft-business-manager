import type { YieldSample } from '../../domain/yieldSamples';

/** Persistence boundary for immutable production/yield evidence. */
export interface YieldSampleRepository {
  list(): Promise<YieldSample[]>;
  findById(id: string): Promise<YieldSample | null>;
  insert(sample: YieldSample): Promise<void>;
  /**
   * Removes an evidence record only when the application history service has
   * already approved the correction/deletion. Evidence remains immutable;
   * there is intentionally no replace/update operation.
   */
  delete(id: string): Promise<void>;
}
