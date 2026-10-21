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
    expect(icon?.classList.contains('app-icon')).toBe(true);
    expect(icon?.getAttribute('width')).toBe('20');
    expect(icon?.querySelector('path')).not.toBeNull();
  });

  it('supports an accessible label when an icon carries meaning by itself', async () => {
    await act(async () => root.render(<AppIcon name="search" label="Search" />));

    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('role')).toBe('img');
    expect(icon?.getAttribute('aria-label')).toBe('Search');
    expect(icon?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('renders every semantic AppIcon name using the shared React Icons set', async () => {
    const names = [
      'menu', 'close', 'chevron-left', 'chevron-right', 'chevron-down',
      'workbook', 'materials', 'calibration', 'products', 'yield',
      'production', 'pricing', 'search', 'alert', 'refresh', 'scale',
      'check-circle', 'component', 'package', 'inventory', 'plus',
      'plus-circle', 'arrow-left', 'corner-down-right', 'flame', 'jar',
      'palette', 'activity', 'history', 'loader', 'printer', 'edit',
      'archive', 'restore',
    ] as const;

    await act(async () => root.render(
      <div>{names.map((name) => <AppIcon key={name} name={name} />)}</div>,
    ));

    const icons = container.querySelectorAll('svg.app-icon');
    expect(icons).toHaveLength(names.length);
    expect(Array.from(icons).every((icon) => icon.hasAttribute('viewBox'))).toBe(true);
    expect(Array.from(icons).every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('forwards sizing, stroke weight, class and inline style', async () => {
    await act(async () => root.render(
      <AppIcon name="pricing" size={28} strokeWidth={2.3} className="pricing-action" style={{ color: 'purple' }} />,
    ));

    const icon = container.querySelector('svg')!;
    expect(icon.getAttribute('width')).toBe('28');
    expect(icon.getAttribute('height')).toBe('28');
    expect(icon.getAttribute('stroke-width')).toBe('2.3');
    expect(icon.classList.contains('pricing-action')).toBe(true);
    expect(icon.style.color).toBe('purple');
  });
});
