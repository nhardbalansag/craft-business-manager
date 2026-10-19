/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import productsStyles from './products.css?raw';
import brandStyles from '../../brandingTheme.css?raw';

describe('Products tab brand colors', () => {
  it('uses the shared botanical leaf brand tokens rather than a black selected tab', () => {
    const activeRule = productsStyles.match(/\.workspace-switcher button\.active\s*\{([^}]+)\}/)?.[1];
    expect(activeRule).toBeDefined();
    expect(activeRule).toContain('background: var(--mlc-leaf-soft');
    expect(activeRule).toContain('color: var(--mlc-leaf');
    expect(activeRule).toContain('box-shadow:');
    expect(activeRule).not.toContain('#2d2924');
  });

  it('defines both light and dark theme leaf colors from the shared My Lovely Craft palette', () => {
    expect(brandStyles).toContain('--mlc-leaf: #596f4a;');
    expect(brandStyles).toContain('--mlc-leaf-soft: #e8eee0;');
    expect(brandStyles).toContain('--mlc-leaf: #bacba0;');
    expect(brandStyles).toContain('--mlc-leaf-soft: #344332;');
  });
});
