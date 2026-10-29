// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKBOOK_SIZE_MIB, MEBIBYTE, WORKBOOK_SIZE_PREFERENCE_KEY,
  getWorkbookImportMaxBytes, getWorkbookSizeLimitMiB, saveWorkbookSizeLimitMiB,
} from './workbookImportPreferences';

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('workbook size preferences', () => {
  it('defaults to 96 MiB and persists increases and decreases', () => {
    expect(getWorkbookSizeLimitMiB()).toBe(96);
    saveWorkbookSizeLimitMiB(128);
    expect(getWorkbookImportMaxBytes()).toBe(128 * MEBIBYTE);
    saveWorkbookSizeLimitMiB(48);
    expect(getWorkbookImportMaxBytes()).toBe(48 * MEBIBYTE);
    saveWorkbookSizeLimitMiB(DEFAULT_WORKBOOK_SIZE_MIB);
    expect(getWorkbookSizeLimitMiB()).toBe(96);
  });

  it.each(['', 'broken', '0', '-1', '1.5', 'Infinity', '1025'])('falls back for invalid stored value %s', (value) => {
    window.localStorage.setItem(WORKBOOK_SIZE_PREFERENCE_KEY, value);
    expect(getWorkbookSizeLimitMiB()).toBe(DEFAULT_WORKBOOK_SIZE_MIB);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 1025])('rejects invalid saves without changing the limit: %s', (value) => {
    saveWorkbookSizeLimitMiB(64);
    expect(() => saveWorkbookSizeLimitMiB(value)).toThrow(RangeError);
    expect(getWorkbookSizeLimitMiB()).toBe(64);
  });

  it('keeps defaults usable when storage is unavailable and reports failed writes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getWorkbookSizeLimitMiB()).toBe(96);
    expect(() => saveWorkbookSizeLimitMiB(128)).toThrow('blocked');
  });
});
