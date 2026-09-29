// @ts-expect-error Vitest runs in Node while the app tsconfig intentionally omits Node ambient types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const formulaCss = readFileSync(
  new URL('./plasterMoldFormulaConfiguration.css', import.meta.url),
  'utf8',
);
const responsiveCss = readFileSync(
  new URL('../../responsive.css', import.meta.url),
  'utf8',
);

describe('MY5C mold formula responsive/accessibility regression', () => {
  it('retains the application-wide touch target and mobile form baseline', () => {
    expect(responsiveCss).toContain('@media (max-width: 760px), (pointer: coarse)');
    expect(responsiveCss).toContain('min-height: 44px;');
    expect(responsiveCss).toContain('.app-shell :is(input, select, textarea) { font-size: 16px; }');
  });

  it('collapses formula editing and estimate content safely on narrow screens', () => {
    expect(formulaCss).toContain('/* MY5C — mold formula responsive/accessibility completion */');
    expect(formulaCss).toContain('.plaster-formula-layout {');
    expect(formulaCss).toContain('grid-template-columns: minmax(340px, 1.05fr) minmax(320px, .95fr);');
    expect(formulaCss).toContain('@media (max-width: 980px)');
    expect(formulaCss).toContain('@media (max-width: 720px)');
    expect(formulaCss).toContain('@media (max-width: 480px)');
    expect(formulaCss).toContain('grid-template-columns: 1fr;');
  });

  it('keeps Material selectors and estimate metrics shrink-safe', () => {
    expect(formulaCss).toContain('.plaster-formula-material-grid {');
    expect(formulaCss).toContain('.plaster-formula-number-grid {');
    expect(formulaCss).toContain('.plaster-formula-metrics {');
    expect(formulaCss).toContain('min-width: 0;');
    expect(formulaCss).toContain('overflow-wrap: anywhere;');
  });
});
