import { describe, expect, it } from 'vitest';
import {
  yieldMoldFormulaSourceRepository,
  yieldMoldFormulaSourceService,
} from '../session';
import { InMemoryYieldMoldFormulaSourceRepository } from './InMemoryYieldMoldFormulaSourceRepository';
import { YieldMoldFormulaSourceService } from './YieldMoldFormulaSourceService';

describe('YRS2A shared provenance session wiring', () => {
  it('exposes one shared repository/service over the application graph', () => {
    expect(yieldMoldFormulaSourceRepository).toBeInstanceOf(
      InMemoryYieldMoldFormulaSourceRepository,
    );
    expect(yieldMoldFormulaSourceService).toBeInstanceOf(
      YieldMoldFormulaSourceService,
    );
  });
});
