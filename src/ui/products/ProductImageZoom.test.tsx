// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductImageZoom } from './ProductImageZoom';

const thumbnail = 'data:image/jpeg;base64,/9j/AAAA';
const brochure = 'data:image/jpeg;base64,/9j/BBBB';
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

function viewer() {
  return document.body.querySelector<HTMLElement>('.product-image-zoom-dialog');
}

describe('ProductImageZoom', () => {
  it('opens the brochure-quality image from a thumbnail, traps focus, closes with Escape and restores focus', async () => {
    await act(async () => root.render(
      <ProductImageZoom product={{ name: 'Rose Candle', imageDataUrl: thumbnail, brochureImageDataUrl: brochure }} imageClassName="sample-photo" />,
    ));
    const trigger = container.querySelector<HTMLButtonElement>('button.product-image-zoom-trigger')!;
    expect(trigger).not.toBeNull();
    expect(trigger.querySelector('img.sample-photo')?.getAttribute('src')).toBe(thumbnail);
    expect(trigger.getAttribute('aria-label')).toBe('View full-size image of Rose Candle');
    expect(viewer()).toBeNull();

    await act(async () => trigger.click());
    expect(viewer()?.getAttribute('aria-modal')).toBe('true');
    expect(viewer()?.querySelector<HTMLImageElement>('.product-image-zoom-canvas img')?.getAttribute('src')).toBe(brochure);
    expect(viewer()?.textContent).toContain('high-resolution brochure image');
    expect(document.body.style.overflow).toBe('hidden');
    const close = document.body.querySelector<HTMLButtonElement>('[aria-label="Close enlarged product image"]')!;
    expect(document.activeElement).toBe(close);
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(close);

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(viewer()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes with the visible button or backdrop without changing the original product', async () => {
    await act(async () => root.render(
      <ProductImageZoom product={{ name: 'Paintable Star', imageDataUrl: thumbnail }} />,
    ));
    const trigger = container.querySelector<HTMLButtonElement>('button')!;
    await act(async () => trigger.click());
    expect(viewer()?.querySelector('img')?.getAttribute('src')).toBe(thumbnail);
    expect(viewer()?.textContent).toContain('Reupload the original image');
    await act(async () => document.body.querySelector<HTMLButtonElement>('[aria-label="Close enlarged product image"]')!.click());
    expect(viewer()).toBeNull();
    await act(async () => trigger.click());
    await act(async () => document.body.querySelector<HTMLElement>('.product-image-zoom-backdrop')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(viewer()).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('falls back to brochure image if there is no thumbnail, and never renders invalid or missing images', async () => {
    await act(async () => root.render(
      <ProductImageZoom product={{ name: 'Gift', brochureImageDataUrl: brochure }} />,
    ));
    expect(container.querySelector('img')?.getAttribute('src')).toBe(brochure);
    await act(async () => root.render(
      <ProductImageZoom product={{ name: 'Gift', imageDataUrl: 'javascript:alert(1)', brochureImageDataUrl: 'data:image/svg+xml;base64,AAA' }} />,
    ));
    expect(container.querySelector('button')).toBeNull();
  });
});
