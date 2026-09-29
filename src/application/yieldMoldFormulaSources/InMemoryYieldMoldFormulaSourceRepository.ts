import {
  cloneYieldMoldFormulaSource,
  type YieldMoldFormulaSource,
} from '../../domain/yieldMoldFormulaSource';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { YieldMoldFormulaSourceRepository } from './YieldMoldFormulaSourceRepository';

function key(yieldSampleId: string): string {
  return yieldSampleId.trim().toLocaleLowerCase();
}

export class InMemoryYieldMoldFormulaSourceRepository
  implements
    YieldMoldFormulaSourceRepository,
    CollectionReplacementPort<YieldMoldFormulaSource>
{
  private sources = new Map<string, YieldMoldFormulaSource>();

  constructor(seed: YieldMoldFormulaSource[] = []) {
    for (const source of seed) {
      this.sources.set(
        key(source.yieldSampleId),
        cloneYieldMoldFormulaSource(source),
      );
    }
  }

  async list(): Promise<YieldMoldFormulaSource[]> {
    return [...this.sources.values()].map(cloneYieldMoldFormulaSource);
  }

  async findByYieldSampleId(
    yieldSampleId: string,
  ): Promise<YieldMoldFormulaSource | null> {
    const source = this.sources.get(key(yieldSampleId));
    return source ? cloneYieldMoldFormulaSource(source) : null;
  }

  async insert(source: YieldMoldFormulaSource): Promise<void> {
    this.sources.set(
      key(source.yieldSampleId),
      cloneYieldMoldFormulaSource(source),
    );
  }

  async delete(yieldSampleId: string): Promise<void> {
    this.sources.delete(key(yieldSampleId));
  }

  async replaceAll(
    records: readonly YieldMoldFormulaSource[],
  ): Promise<void> {
    const next = new Map<string, YieldMoldFormulaSource>();
    for (const source of records) {
      next.set(
        key(source.yieldSampleId),
        cloneYieldMoldFormulaSource(source),
      );
    }
    this.sources = next;
  }
}
