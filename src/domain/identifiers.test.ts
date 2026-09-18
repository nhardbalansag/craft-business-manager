import { describe, expect, it } from 'vitest';
import { nextSequentialId } from './identifiers';

describe('nextSequentialId', () => {
  it('starts a new sequence without changing legacy identifiers', () => {
    const legacy = ['MAT-PLASTER', 'PLASTER-OLD'];
    expect(nextSequentialId(legacy, 'MAT')).toBe('MAT-0001');
    expect(legacy).toEqual(['MAT-PLASTER', 'PLASTER-OLD']);
  });

  it('continues after the highest matching numeric identifier case-insensitively', () => {
    expect(nextSequentialId(['MAT-0002', 'mat-0010', 'MAT-PLASTER'], 'MAT')).toBe('MAT-0011');
  });

  it('keeps independent prefixes separate', () => {
    expect(nextSequentialId(['LOC-RACK-0007', 'LOC-BIN-0012'], 'LOC-BIN')).toBe('LOC-BIN-0013');
    expect(nextSequentialId(['LOC-RACK-0007', 'LOC-BIN-0012'], 'LOC-SHELF')).toBe('LOC-SHELF-0001');
  });

  it('grows beyond the minimum width without truncation', () => {
    expect(nextSequentialId(['PROD-9999'], 'PROD')).toBe('PROD-10000');
  });

  it('validates generation inputs', () => {
    expect(() => nextSequentialId([], '')).toThrow('ID prefix is required.');
    expect(() => nextSequentialId([], 'MAT', 0)).toThrow('positive integer');
  });
});