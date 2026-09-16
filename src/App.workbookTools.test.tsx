// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Workbook tools disclosure', () => {
  it('keeps persistence status, import, and export tools collapsed by default', async () => {
    await act(async () => root.render(<App />));

    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector('.workbook-tools-trigger')?.textContent).toContain('Workbook');
    expect(details?.querySelector('.workbook-tools-trigger')?.textContent).toContain('No workbook imported');

    const popover = details?.querySelector('.workbook-tools-popover');
    expect(popover?.textContent).toContain('PERSISTENCE STATUS');
    expect(popover?.textContent).toContain('DATA FILE');
    expect(popover?.textContent).toContain('SAVE A COPY');
  });

  it('opens and closes the workbook tools from the compact header summary', async () => {
    await act(async () => root.render(<App />));

    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools');
    const summary = details?.querySelector<HTMLElement>('summary.workbook-tools-trigger');
    if (!details || !summary) throw new Error('Missing workbook tools disclosure.');

    expect(details.open).toBe(false);

    await act(async () => summary.click());
    expect(details.open).toBe(true);

    await act(async () => summary.click());
    expect(details.open).toBe(false);
  });
});
