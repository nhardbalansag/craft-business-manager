import type { YieldMoldFormulaSource } from '../../domain/yieldMoldFormulaSource';

/**
 * Persistence boundary for immutable Yield Sample → Mold Formula provenance.
 *
 * Application code creates provenance once and reads it thereafter. delete is
 * retained as an infrastructure seam for coordinated correction/rollback work
 * in YRS2B. replaceAll is supplied by the in-memory implementation through the
 * shared CollectionReplacementPort for future YRS2C hydration.
 */
export interface YieldMoldFormulaSourceRepository {
  list(): Promise<YieldMoldFormulaSource[]>;
  findByYieldSampleId(
    yieldSampleId: string,
  ): Promise<YieldMoldFormulaSource | null>;
  insert(source: YieldMoldFormulaSource): Promise<void>;
  delete(yieldSampleId: string): Promise<void>;
}
