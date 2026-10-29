// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkbookSizeLimitMiB } from '../../application/persistence/workbookImportPreferences';
import { WorkbookImportSizeSettings } from './WorkbookImportSizeSettings';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function mount(disabled = false) {
  await act(async () => root.render(<WorkbookImportSizeSettings disabled={disabled} />));
}

async function edit(value: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function save() {
  await act(async () => container.querySelector('form')!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  ));
}

describe('WorkbookImportSizeSettings', () => {
  it('saves increases/decreases, restores them on remount, and resets to the default', async () => {
    await mount();
    expect(container.textContent).toContain('Active limit: 96 MiB');
    await edit('128');
    await save();
    expect(getWorkbookSizeLimitMiB()).toBe(128);
    await act(async () => root.render(null));
    await mount();
    expect(container.querySelector('input')!.value).toBe('128');
    await edit('48');
    await save();
    expect(getWorkbookSizeLimitMiB()).toBe(48);
    await act(async () => Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Reset size limit')!.click());
    expect(getWorkbookSizeLimitMiB()).toBe(96);
    expect(container.querySelector('input')!.value).toBe('96');
  });

  it.each(['', '0', '-1', '1.5', '1025'])('rejects invalid input %s without replacing the active limit', async (value) => {
    await mount();
    await edit(value);
    await save();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Enter a whole number');
    expect(getWorkbookSizeLimitMiB()).toBe(96);
    expect(container.textContent).toContain('Active limit: 96 MiB');
  });

  it('reports failed storage writes without showing a false saved limit', async () => {
    await mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await edit('128');
    await save();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be saved');
    expect(container.textContent).toContain('Active limit: 96 MiB');
    expect(getWorkbookSizeLimitMiB()).toBe(96);
  });

  it('disables changes during a read/import', async () => {
    await mount(true);
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);
    await save();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
