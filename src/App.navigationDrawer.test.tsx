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
  it('renders the primary sections in a left drawer instead of a top header', async () => {
    await mount();

    const drawer = container.querySelector<HTMLElement>('#app-navigation-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('aria-label')).toBe('Application navigation drawer');
    expect(container.querySelector('.app-header')).toBeNull();
    expect(drawer?.querySelector('[aria-label="Application sections"]')).not.toBeNull();
    expect(drawer?.textContent).toContain('Materials');
    expect(drawer?.textContent).toContain('Calibration');
    expect(drawer?.textContent).toContain('Products');
    expect(drawer?.textContent).toContain('Yield');
    expect(drawer?.textContent).toContain('Production');
    expect(drawer?.textContent).toContain('Pricing');
    expect(drawer?.querySelector('[aria-label="Workbook tools"]')).not.toBeNull();
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
    await clickButton('PRProducts');

    const productsButton = Array.from(container.querySelectorAll<HTMLButtonElement>('.app-drawer-nav .nav-item')).find(
      (item) => item.textContent?.includes('Products'),
    );
    expect(productsButton?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('.app-shell-with-drawer')?.classList.contains('is-drawer-open')).toBe(false);
    expect(container.textContent).toContain('Your product workshop');
  });
});
