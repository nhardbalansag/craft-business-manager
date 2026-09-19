// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppIcon } from './AppIcon';

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

describe('AppIcon', () => {
  it('renders decorative icons without adding text to surrounding controls', async () => {
    await act(async () => root.render(
      <button type="button"><AppIcon name="products" />Products</button>,
    ));

    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('button')?.textContent).toBe('Products');
  });

  it('supports an accessible label when an icon carries meaning by itself', async () => {
    await act(async () => root.render(<AppIcon name="search" label="Search" />));

    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('role')).toBe('img');
    expect(icon?.getAttribute('aria-label')).toBe('Search');
    expect(icon?.hasAttribute('aria-hidden')).toBe(false);
  });
});
