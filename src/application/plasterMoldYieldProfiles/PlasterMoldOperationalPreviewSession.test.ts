import { describe, expect, it } from 'vitest';
import {
  plasterMoldOperationalPreviewService,
  plasterMoldYieldCalculatorService,
} from '../session';
import { PlasterMoldOperationalPreviewService } from './PlasterMoldOperationalPreviewService';

describe('MY7 shared operational preview session wiring', () => {
  it('exposes one formula operational preview over the shared calculator graph', () => {
    expect(plasterMoldOperationalPreviewService).toBeInstanceOf(
      PlasterMoldOperationalPreviewService,
    );
    expect(plasterMoldYieldCalculatorService).toBeDefined();
  });
});
