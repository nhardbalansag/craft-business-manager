// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YieldRecipeSourceSelector } from './YieldRecipeSourceSelector';

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

function radio(kind: string): HTMLInputElement {
  return container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${kind}"]`,
  )!;
}

describe('YRS3A YieldRecipeSourceSelector', () => {
  it('exposes only Manual and Mold Formula as recordable recipe-source choices', async () => {
    await act(async () =>
      root.render(
        <YieldRecipeSourceSelector
          value="manual"
          onChange={() => undefined}
        />,
      ),
    );

    expect(
      container.querySelector('[aria-label="Recipe source"]'),
    ).not.toBeNull();
    expect(radio('mold-formula').checked).toBe(false);
    expect(radio('manual').checked).toBe(true);
    expect(radio('mix-preset')).toBeNull();
  });

  it('reports the selected source kind without owning source-specific fields', async () => {
    const onChange = vi.fn();

    await act(async () =>
      root.render(
        <YieldRecipeSourceSelector
          value="manual"
          onChange={onChange}
        />,
      ),
    );

    await act(async () => radio('mold-formula').click());

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('mold-formula');
  });

  it('disables every source choice when the Yield draft is not editable', async () => {
    await act(async () =>
      root.render(
        <YieldRecipeSourceSelector
          value="manual"
          disabled
          onChange={() => undefined}
        />,
      ),
    );

    const group = container.querySelector<HTMLFieldSetElement>(
      '[aria-label="Recipe source"]',
    )!;
    expect(group.disabled).toBe(true);
  });
});
