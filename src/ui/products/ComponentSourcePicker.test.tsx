// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentSourcePicker } from './ComponentSourcePicker';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const sources = Array.from({ length: 500 }, (_, i) => ({ id: `CODE-${i}`, name: i === 420 ? 'Star P (1pcs)' : `Product ${i}`, isActive: true }));
async function search(value: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Component source discovery', () => {
  it('limits rendered choices, finds names and codes, and keeps a selected source outside the visible results', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(<ComponentSourcePicker sources={sources} value="CODE-499" onChange={onChange}
      label="Product source" searchLabel="Search component sources" placeholder="Select product" />));
    const select = container.querySelector('select')!;
    expect(select.options.length).toBeLessThanOrEqual(42);
    expect(select.value).toBe('CODE-499');
    await act(async () => container.querySelector('button')!.click());
    expect(select.options.length).toBeLessThanOrEqual(82);
    await search('p (1PCS)');
    expect(select.options.length).toBe(3);
    expect(select.textContent).toContain('Star P (1pcs)');
    expect(select.value).toBe('CODE-499');
    await act(async () => { select.value = 'CODE-420'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith('CODE-420');
    await search('code-215');
    expect(select.textContent).toContain('Product 215');
    await search('no-such-source');
    expect(container.textContent).toContain('No matching sources');
    expect(select.value).toBe('CODE-499');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears the search when a saved selection resets for the next component', async () => {
    const onChange = vi.fn();
    const render = (value: string) => root.render(<ComponentSourcePicker sources={sources} value={value} onChange={onChange}
      label="Material source" searchLabel="Search component sources" placeholder="Select material" />);
    await act(async () => render('CODE-420'));
    await search('Star');
    await act(async () => render(''));
    expect(container.querySelector('input')!.value).toBe('');
    expect(container.querySelector('select')!.value).toBe('');
    expect(container.querySelector('select')!.options.length).toBe(41);
  });
});
