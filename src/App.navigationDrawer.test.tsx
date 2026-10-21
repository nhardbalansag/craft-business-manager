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
  vi.unstubAllGlobals();
});

async function mount() {
  await act(async () => root.render(<App />));
}

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === label || item.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => button.click());
}

describe('application navigation drawer', () => {
  it('shows My Lovely Craft and the supplied botanical brand mark', async () => {
    await mount();
    const drawer = container.querySelector('#app-navigation-drawer')!;
    expect(drawer.textContent).toContain('My Lovely Craft');
    expect(drawer.textContent).toContain('Crafted with love');
    expect(drawer.querySelector<HTMLImageElement>('.brand-mark img')?.getAttribute('src')).toBe('/brand/mlc-mark.webp');
  });

  it('switches appearance and remembers Light, Dark and System choices', async () => {
    await mount();
    const group = container.querySelector('[aria-label="Appearance theme"]')!;
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('System');
    await clickButton('Dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('craft-business-manager.appearance')).toBe('dark');
    await clickButton('Light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('craft-business-manager.appearance')).toBe('light');
    await clickButton('System');
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('System');
  });

  it('restores a saved appearance preference at launch', async () => {
    window.localStorage.setItem('craft-business-manager.appearance', 'dark');
    await mount();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(container.querySelector('[aria-label="Appearance theme"] [aria-pressed="true"]')?.textContent).toBe('Dark');
  });

  it('renders the primary sections in a left drawer instead of a top header', async () => {
    await mount();

    const drawer = container.querySelector<HTMLElement>('#app-navigation-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('aria-label')).toBe('Application navigation drawer');
    expect(container.querySelector('.app-header')).toBeNull();
    expect(drawer?.querySelector('[aria-label="Application sections"]')).not.toBeNull();
    expect(drawer?.textContent).toContain('Materials');
    expect(drawer?.textContent).not.toContain('Calibration');
    expect(drawer?.textContent).toContain('Products');
    expect(drawer?.textContent).not.toContain('Yield');
    expect(drawer?.textContent).toContain('Production');
    expect(Array.from(drawer!.querySelectorAll('.app-drawer-nav button')).map((button) => button.textContent?.trim()))
      .toEqual(['Materials', 'Products', 'Production']);
    expect(drawer?.querySelector('[aria-label="Workbook tools"]')).not.toBeNull();
  });

  it('hides and shows the desktop sidebar while remembering the preference', async () => {
    await mount();

    const shell = container.querySelector<HTMLElement>('.app-shell-with-drawer')!;
    const toggle = container.querySelector<HTMLButtonElement>('.app-sidebar-toggle')!;

    expect(toggle.getAttribute('aria-label')).toBe('Hide navigation sidebar');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(shell.classList.contains('is-sidebar-hidden')).toBe(false);
    expect(window.localStorage.getItem('craft-business-manager.sidebar-visible')).toBe('visible');

    await clickButton('Hide navigation sidebar');
    expect(toggle.getAttribute('aria-label')).toBe('Show navigation sidebar');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(shell.classList.contains('is-sidebar-hidden')).toBe(true);
    expect(window.localStorage.getItem('craft-business-manager.sidebar-visible')).toBe('hidden');

    await clickButton('Show navigation sidebar');
    expect(toggle.getAttribute('aria-label')).toBe('Hide navigation sidebar');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(shell.classList.contains('is-sidebar-hidden')).toBe(false);
    expect(window.localStorage.getItem('craft-business-manager.sidebar-visible')).toBe('visible');
  });

  it('restores a previously hidden desktop sidebar preference', async () => {
    window.localStorage.setItem('craft-business-manager.sidebar-visible', 'hidden');
    await mount();

    const shell = container.querySelector<HTMLElement>('.app-shell-with-drawer')!;
    const toggle = container.querySelector<HTMLButtonElement>('.app-sidebar-toggle')!;
    expect(shell.classList.contains('is-sidebar-hidden')).toBe(true);
    expect(toggle.getAttribute('aria-label')).toBe('Show navigation sidebar');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens and closes the responsive drawer with the menu control', async () => {
    await mount();

    const shell = container.querySelector<HTMLElement>('.app-shell-with-drawer')!;
    const toggle = container.querySelector<HTMLButtonElement>('.app-drawer-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(shell.classList.contains('is-drawer-open')).toBe(false);

    await clickButton('Open navigation menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(shell.classList.contains('is-drawer-open')).toBe(true);
    expect(container.querySelector('.app-drawer-backdrop')).not.toBeNull();

    await clickButton('Close navigation menu');
    expect(shell.classList.contains('is-drawer-open')).toBe(false);
    expect(container.querySelector('.app-drawer-backdrop')).toBeNull();
  });

  it('switches workspace sections and closes the mobile drawer after selection', async () => {
    await mount();
    await clickButton('Open navigation menu');
    const productsButton = Array.from(container.querySelectorAll<HTMLButtonElement>('.app-drawer-nav .nav-item')).find(
      (item) => item.textContent?.includes('Products'),
    );
    expect(productsButton).toBeDefined();
    await act(async () => productsButton!.click());

    expect(productsButton?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('.app-shell-with-drawer')?.classList.contains('is-drawer-open')).toBe(false);
    expect(container.textContent).toContain('Your product workshop');
    const productsTabs = container.querySelector('[aria-label="Product workspace views"]')!;
    expect(productsTabs.textContent).toContain('Pricing');
    await act(async () => productsTabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    expect(container.querySelector('[aria-label="Selected pricing Product"]')).not.toBeNull();
    expect(productsButton?.getAttribute('aria-current')).toBe('page');
    expect(drawerPricingEntries()).toHaveLength(0);
  });
});

function drawerPricingEntries() {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('.app-drawer-nav button'))
    .filter((button) => button.textContent?.trim() === 'Pricing');
}
