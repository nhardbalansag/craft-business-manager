import { describe, expect, it } from 'vitest';
import { plasterMoldYieldCalculatorService } from '../session';
import { PlasterMoldYieldCalculatorService } from './PlasterMoldYieldCalculatorService';

describe('MY4 shared calculator session wiring', () => {
  it('exposes one calculator service over the shared Mold/Material/profile graph', () => {
    expect(plasterMoldYieldCalculatorService).toBeInstanceOf(
      PlasterMoldYieldCalculatorService,
    );
  });
});
