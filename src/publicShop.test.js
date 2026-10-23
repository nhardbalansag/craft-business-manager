import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../public/shop/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/shop/assets/shop.css', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/shop/assets/shop.js', import.meta.url), 'utf8');

describe('public My Lovely Craft product showcase', () => {
  it('is static, indexable public HTML with SEO and separate from the business manager app', () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>My Lovely Craft | Handmade Candles, Paintable Art & Custom Gifts</title>');
    expect(html).toContain('<link rel="canonical" href="https://mylovelycraft.coresite.pro/shop/">');
    expect(html).toContain('<meta name="robots" content="index, follow">');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('href="/privacy-policy/"');
    expect(html).not.toContain('/src/main.tsx');
    expect(html).not.toContain('window.localStorage');
    expect(html).not.toContain('published-workbook');
    expect(html).not.toContain('fullyLoadedUnitCost');
    expect(html).not.toContain('grossProfit');
    expect(html).not.toContain('costPerUnit');
  });

  it('promotes six illustrated craft collections and reaches the official Facebook page', () => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const cards = Array.from(document.querySelectorAll('.product-card[data-category]'));
    expect(cards).toHaveLength(6);
    const types = cards.flatMap((card) => card.getAttribute('data-category').split(/\s+/));
    for (const type of ['art', 'candles', 'events', 'decor']) expect(types).toContain(type);
    expect(document.querySelector('h1')?.textContent).toContain('handmade');
    expect(document.getElementById('collections')).not.toBeNull();
    expect(document.getElementById('events')).not.toBeNull();
    expect(document.getElementById('how-to-order')).not.toBeNull();
    expect(document.getElementById('faqs')).not.toBeNull();
    expect(html).toContain('Illustrations are representative of our craft categories');
    for (const card of cards) {
      expect(card.querySelector('svg[role="img"]')).not.toBeNull();
      const inquiry = card.querySelector('a.product-inquiry');
      expect(inquiry?.getAttribute('href')).toBe('https://www.facebook.com/profile.php?id=100066725041959');
      expect(inquiry?.getAttribute('rel')).toContain('noopener');
    }
    expect(html).not.toContain('https://source.unsplash.com');
  });

  it('works without JS, and filters product categories accessibly when JS is enabled', () => {
    const dom = new JSDOM(html, {
      url: 'https://mylovelycraft.coresite.pro/shop/',
      runScripts: 'outside-only',
    });
    const document = dom.window.document;
    expect(document.querySelectorAll('.product-card:not([hidden])')).toHaveLength(6);
    expect(css).toContain('.has-js .collection-filters { display: flex; }');
    dom.window.eval(script);
    expect(document.documentElement.classList.contains('has-js')).toBe(true);
    const events = document.querySelector('button[data-filter="events"]');
    events.click();
    expect(events.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('button[data-filter="all"]').getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelectorAll('.product-card:not([hidden])')).toHaveLength(2);
    expect(document.getElementById('filter-status').textContent).toContain('2 collections');
    document.querySelector('button[data-filter="decor"]').click();
    expect(document.querySelectorAll('.product-card:not([hidden])')).toHaveLength(1);
    document.querySelector('button[data-filter="all"]').click();
    expect(document.querySelectorAll('.product-card:not([hidden])')).toHaveLength(6);
  });

  it('includes mobile layout, keyboard focus, reduced motion, and works without third-party assets', () => {
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelector('.skip-link')?.getAttribute('href')).toBe('#main');
    expect(doc.querySelector('nav[aria-label="Main navigation"]')).not.toBeNull();
    expect(doc.querySelectorAll('.faq-items details')).toHaveLength(4);
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(':focus-visible');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('cdn.');
    expect(script).not.toContain('fetch(');
  });
});
