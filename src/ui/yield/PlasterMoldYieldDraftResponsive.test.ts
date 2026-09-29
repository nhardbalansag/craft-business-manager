// @ts-expect-error Vitest runs in Node while the app tsconfig intentionally omits Node ambient types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const assistCss = readFileSync(
  new URL('./plasterMoldYieldDraftAssist.css', import.meta.url),
  'utf8',
);
const responsiveCss = readFileSync(
  new URL('../../responsive.css', import.meta.url),
  'utf8',
);

describe('MY6C Yield Formula draft responsive/accessibility regression', () => {
  it('retains the application-wide touch target and mobile input baseline', () => {
    expect(responsiveCss).toContain('@media (max-width: 760px), (pointer: coarse)');
    expect(responsiveCss).toContain('min-height: 44px;');
    expect(responsiveCss).toContain('.app-shell :is(input, select, textarea) { font-size: 16px; }');
  });

  it('collapses the formula assistant safely for tablet and phone widths', () => {
    expect(assistCss).toContain('/* MY6C — Yield Formula draft responsive/accessibility completion */');
    expect(assistCss).toContain('.yield-formula-assist-controls {');
    expect(assistCss).toContain('.yield-formula-assist-metrics {');
    expect(assistCss).toContain('@media (max-width: 780px)');
    expect(assistCss).toContain('@media (max-width: 520px)');
    expect(assistCss).toContain('grid-template-columns: 1fr;');
  });

  it('keeps draft confirmation and estimate content shrink-safe', () => {
    expect(assistCss).toContain('.yield-formula-measurement-confirmation {');
    expect(assistCss).toContain('.yield-formula-measurement-heading {');
    expect(assistCss).toContain('.yield-formula-draft-confirmation {');
    expect(assistCss).toContain('min-width: 0;');
    expect(assistCss).toContain('overflow-wrap: anywhere;');
  });
});
