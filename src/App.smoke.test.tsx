import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import { CalibrationPage } from './ui/calibration/CalibrationPage';
import { ProductsPage } from './ui/products/ProductsPage';
import { ProductionPage } from './ui/production/ProductionPage';
import { YieldPage } from './ui/yield/YieldPage';

describe('React workspace smoke validation', () => {
  it('renders the Materials workspace with the completed Phase 1 inputs and derived sections', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Craft Business Manager');
    expect(html).toContain('Add a material');
    expect(html).toContain('Calculated purchase costing');
    expect(html).toContain('Normalized stock &amp; valuation');
    expect(html).toContain('Supplier / source');
    expect(html).toContain('Products');
    expect(html).toContain('Yield');
    expect(html).toContain('Production');
  });

  it('renders the Calibration workspace without requiring browser-side effects', () => {
    const html = renderToStaticMarkup(<CalibrationPage />);

    expect(html).toContain('Calibration');
    expect(html).toContain('Session-only calibration history');
    expect(html).toContain('Add a weight-based material first');
  });

  it('renders the Phase 2 Products and Mix Presets workspace without browser-side effects', () => {
    const html = renderToStaticMarkup(<ProductsPage />);

    expect(html).toContain('Products &amp; mixes');
    expect(html).toContain('Add a product');
    expect(html).toContain('Sellable products');
    expect(html).toContain('Mix presets');
    expect(html).toContain('Safety waste (%)');
  });

  it('renders the Phase 2 Yield recording and history workspace without browser-side effects', () => {
    const html = renderToStaticMarkup(<YieldPage />);

    expect(html).toContain('Yield &amp; history');
    expect(html).toContain('Record a yield sample');
    expect(html).toContain('Materials actually consumed');
    expect(html).toContain('EFFECTIVE LEARNING');
    expect(html).toContain('Recorded batches');
  });

  it('renders the Phase 2 Production estimate workspace without browser-side effects', () => {
    const html = renderToStaticMarkup(<ProductionPage />);

    expect(html).toContain('Production estimate');
    expect(html).toContain('Planned finished pieces');
    expect(html).toContain('Producible now');
    expect(html).toContain('Materials to prepare');
    expect(html).toContain('Direct material preview');
    expect(html).toContain('Issues to resolve');
  });
});
