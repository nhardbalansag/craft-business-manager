// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YieldManualMode } from './YieldManualMode';

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('YRS3D YieldManualMode', () => {
  it('states that Manual has no saved recipe or physical provenance', async () => {
    await act(async () => root.render(<YieldManualMode />));

    const mode = container.querySelector(
      '[aria-label="Manual recipe source"]',
    )!;

    expect(mode).not.toBeNull();
    expect(mode.textContent).toContain('Manual');
    expect(mode.textContent).toContain('No saved recipe');
    expect(mode.textContent).toContain('No saved recipe reference is linked');
    expect(mode.textContent).toContain(
      'No Mold Formula or profile source is linked',
    );
  });

  it('keeps actual batch measurements as the Manual evidence source', async () => {
    await act(async () => root.render(<YieldManualMode />));

    expect(container.textContent).toContain('Actual batch measurements');
    expect(container.textContent).toContain(
      'Materials actually consumed',
    );
    expect(container.textContent).toContain('real good/rejected pieces');
    expect(container.textContent).toContain(
      'Manual does not bypass Yield evidence rules.',
    );
  });

  it('does not introduce source-specific inputs or confirmation controls', async () => {
    await act(async () => root.render(<YieldManualMode />));

    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
