import { DEFAULT_WORKBOOK_RESOURCE_LIMITS } from '../../storage/workbookResourceLimits';

export const MEBIBYTE = 1024 * 1024;
export const WORKBOOK_SIZE_PREFERENCE_KEY = 'craft-business-manager.workbook-size-limit-mib';
export const DEFAULT_WORKBOOK_SIZE_MIB = DEFAULT_WORKBOOK_RESOURCE_LIMITS.maxWorkbookBytes / MEBIBYTE;
export const MAX_WORKBOOK_SIZE_MIB = 1024;

export function isValidWorkbookSizeMiB(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_WORKBOOK_SIZE_MIB;
}

/** A device/browser preference, never part of the authoritative business workbook. */
export function getWorkbookSizeLimitMiB(): number {
  try {
    const value = Number(window.localStorage.getItem(WORKBOOK_SIZE_PREFERENCE_KEY));
    return isValidWorkbookSizeMiB(value) ? value : DEFAULT_WORKBOOK_SIZE_MIB;
  } catch {
    return DEFAULT_WORKBOOK_SIZE_MIB;
  }
}

export function getWorkbookImportMaxBytes(): number {
  return getWorkbookSizeLimitMiB() * MEBIBYTE;
}

export function saveWorkbookSizeLimitMiB(value: number): void {
  if (!isValidWorkbookSizeMiB(value)) {
    throw new RangeError(`Enter a whole number from 1 to ${MAX_WORKBOOK_SIZE_MIB} MiB.`);
  }
  // Let the UI report failure rather than claim that an unsaved limit is active.
  window.localStorage.setItem(WORKBOOK_SIZE_PREFERENCE_KEY, String(value));
}
