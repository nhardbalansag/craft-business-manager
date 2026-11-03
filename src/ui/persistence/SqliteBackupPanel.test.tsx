// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteBackupPanel } from './SqliteBackupPanel';
import type { SqliteBackupReview } from '../../application/persistence/SqliteBackupService';

let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const details: SqliteBackupReview = { hasCatalog: true, dataset: null, products: 5, materials: 3, images: 2, receipts: 4, quotations: 1, savedAt: '2026-11-04T00:00:00.000Z' };
function button(label: string) { return Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)!; }
async function selectFile() {
  const file = new File(['sqlite'], 'portable.sqlite'); Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2]).buffer });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
describe('SQLite backup and restore controls', () => {
  it('downloads a mobile-compatible backup and requires a reviewed explicit restore action', async () => {
    const bytes = new Uint8Array([1, 2]), download = vi.fn(), onRestored = vi.fn();
    const service = { exportBackup: vi.fn(async () => bytes), inspect: vi.fn(async () => details), restore: vi.fn(async () => {}) };
    await act(async () => root.render(<SqliteBackupPanel service={service} download={download} onRestored={onRestored} />));
    await act(async () => button('Download SQLite backup').click()); expect(download).toHaveBeenCalledWith(bytes);
    await selectFile(); expect(container.textContent).toContain('5 products'); expect(container.textContent).toContain('4 receipts');
    expect(service.restore).not.toHaveBeenCalled();
    await act(async () => button('Restore this SQLite backup').click());
    expect(service.restore).toHaveBeenCalledWith(bytes, undefined); expect(onRestored).toHaveBeenCalledOnce();
  });

  it('does not offer restore when verification fails, and retains a review after a failed commit', async () => {
    const service = { exportBackup: vi.fn(), inspect: vi.fn().mockRejectedValueOnce(new Error('checksum invalid')).mockResolvedValue(details), restore: vi.fn().mockRejectedValue(new Error('Storage full')) };
    const onRestored = vi.fn(); await act(async () => root.render(<SqliteBackupPanel service={service} onRestored={onRestored} />));
    await selectFile(); expect(container.textContent).toContain('checksum invalid'); expect(button('Restore this SQLite backup')).toBeUndefined();
    await selectFile(); await act(async () => button('Restore this SQLite backup').click());
    expect(container.textContent).toContain('Storage full'); expect(onRestored).not.toHaveBeenCalled();
    expect(button('Restore this SQLite backup').disabled).toBe(false);
  });
});
