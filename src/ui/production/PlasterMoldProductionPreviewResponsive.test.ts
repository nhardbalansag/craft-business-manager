// @ts-expect-error Vitest runs in Node while the app tsconfig intentionally omits Node ambient types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const previewCss = readFileSync(
  new URL('./plasterMoldProductionPreview.css', import.meta.url),
  'utf8',
);
const responsiveCss = readFileSync(
  new URL('../../responsive.css', import.meta.url),
  'utf8',
);

describe('MY7C Mold Formula Production preview responsive/accessibility regression', () => {
  it('retains the application-wide mobile touch/input baseline', () => {
    expect(responsiveCss).toContain('@media (max-width: 760px), (pointer: coarse)');
    expect(responsiveCss).toContain('min-height: 44px;');
    expect(responsiveCss).toContain('.app-shell :is(input, select, textarea) { font-size: 16px; }');
  });

  it('collapses formula operational summaries safely across tablet and phone widths', () => {
    expect(previewCss).toContain('/* MY7C — Mold Formula Production preview responsive/accessibility completion */');
    expect(previewCss).toContain('.mold-production-preview-summary {');
    expect(previewCss).toContain('@media (max-width: 1050px)');
    expect(previewCss).toContain('@media (max-width: 760px)');
    expect(previewCss).toContain('@media (max-width: 520px)');
    expect(previewCss).toContain('grid-template-columns: 1fr;');
  });

  it('keeps long cost/capacity values and table content shrink-safe', () => {
    expect(previewCss).toContain('min-width: 0;');
    expect(previewCss).toContain('overflow-wrap: anywhere;');
    expect(previewCss).toContain('.mold-production-material-table');
  });
});
