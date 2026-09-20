// @ts-expect-error Vitest runs in Node while the app tsconfig intentionally omits Node ambient types.\nimport { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pricingCss = readFileSync(new URL('./pricing.css', import.meta.url), 'utf8');
const responsiveCss = readFileSync(new URL('../../responsive.css', import.meta.url), 'utf8');

describe('TP6D tier pricing responsive regression', () => {
  it('retains the application-wide touch target and mobile input baseline', () => {
    expect(responsiveCss).toContain('@media (max-width: 760px), (pointer: coarse)');
    expect(responsiveCss).toContain('min-height: 44px;');
    expect(responsiveCss).toContain('min-width: 44px;');
    expect(responsiveCss).toContain('.app-shell :is(input, select, textarea) { font-size: 16px; }');
  });

  it('keeps tier actions and content shrink-safe on phone layouts', () => {
    expect(pricingCss).toContain('/* TP6D — tier pricing responsive/accessibility completion */');
    expect(pricingCss).toContain('.tier-catalog-card-actions > button,');
    expect(pricingCss).toContain('.tier-editor-actions > button {');
    expect(pricingCss).toContain('width: 100%;');
    expect(pricingCss).toContain('overflow-wrap: anywhere;');
    expect(pricingCss).toContain('@media (max-width: 420px)');
    expect(pricingCss).toContain('.tier-catalog-card,');
  });
});
