// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount() {
  await act(async () => root.render(<App />));
}

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent?.trim() === label || item.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => button.click());
}

describe('Workbook tools disclosure', () => {
  it('keeps persistence status, import, and export tools collapsed by default', async () => {
    await mount();

    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools');
    const overlay = container.querySelector<HTMLElement>('.workbook-tools-overlay');
    const dialog = container.querySelector<HTMLElement>('#workbook-tools-dialog');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector('.workbook-tools-trigger')?.textContent).toContain('Workbook');
    expect(details?.querySelector('.workbook-tools-trigger')?.textContent).toContain('No workbook imported');
    expect(overlay?.hidden).toBe(true);
    expect(dialog?.textContent).toContain('PERSISTENCE STATUS');
    expect(dialog?.textContent).toContain('DATA FILE');
    expect(dialog?.textContent).toContain('SAVE A COPY');
  });

  it('opens and closes the workbook tools from the sidebar trigger', async () => {
    await mount();

    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools');
    const summary = details?.querySelector<HTMLElement>('summary.workbook-tools-trigger');
    const overlay = container.querySelector<HTMLElement>('.workbook-tools-overlay');
    if (!details || !summary || !overlay) throw new Error('Missing workbook tools UI.');

    expect(details.open).toBe(false);
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.hidden).toBe(true);

    await act(async () => summary.click());
    expect(details.open).toBe(true);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(overlay.hidden).toBe(false);

    await act(async () => summary.click());
    expect(details.open).toBe(false);
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.hidden).toBe(true);
  });

  it('renders the workbook sheet outside the sidebar positioning context', async () => {
    await mount();

    const drawer = container.querySelector<HTMLElement>('#app-navigation-drawer')!;
    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools')!;
    const dialog = container.querySelector<HTMLElement>('#workbook-tools-dialog')!;
    const overlay = container.querySelector<HTMLElement>('.workbook-tools-overlay')!;

    expect(drawer.contains(dialog)).toBe(false);
    expect(details.contains(dialog)).toBe(false);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    await clickButton('Open navigation menu');
    expect(container.querySelector('.app-shell-with-drawer')?.classList.contains('is-drawer-open')).toBe(true);

    const summary = details.querySelector<HTMLElement>('summary.workbook-tools-trigger')!;
    await act(async () => summary.click());

    expect(overlay.hidden).toBe(false);
    expect(container.querySelector('.app-shell-with-drawer')?.classList.contains('is-drawer-open')).toBe(false);
  });

  it('closes from its button, backdrop, or Escape and returns keyboard focus to the trigger', async () => {
    await mount();
    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools')!;
    const summary = details.querySelector<HTMLElement>('summary')!;
    const close = container.querySelector<HTMLButtonElement>('.workbook-tools-close-row button')!;
    const backdrop = container.querySelector<HTMLButtonElement>('.workbook-tools-backdrop')!;
    const dialog = container.querySelector<HTMLElement>('#workbook-tools-dialog')!;
    expect(summary.getAttribute('aria-label')).toBe('Workbook tools');

    await act(async () => summary.click());
    expect(document.activeElement).toBe(close);
    await act(async () => close.click());
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);

    await act(async () => summary.click());
    await act(async () => backdrop.click());
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);

    await act(async () => summary.click());
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it('closes workbook tools before hiding the desktop sidebar', async () => {
    await mount();
    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools')!;
    const summary = details.querySelector<HTMLElement>('summary')!;
    const overlay = container.querySelector<HTMLElement>('.workbook-tools-overlay')!;

    await act(async () => summary.click());
    expect(details.open).toBe(true);
    expect(overlay.hidden).toBe(false);

    await clickButton('Hide navigation sidebar');
    expect(details.open).toBe(false);
    expect(overlay.hidden).toBe(true);
    expect(container.querySelector('.app-shell-with-drawer')?.classList.contains('is-sidebar-hidden')).toBe(true);
  });

  it('announces the active section when navigating between workspaces', async () => {
    await mount();
    const nav = container.querySelector('nav[aria-label="Application sections"]')!;
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Materials');
    const products = Array.from(nav.querySelectorAll('button')).find((button) => button.textContent === 'Products')!;
    await act(async () => products.click());
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Products');
  });
});
