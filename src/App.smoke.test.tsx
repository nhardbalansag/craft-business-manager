import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import { CalibrationPage } from './ui/calibration/CalibrationPage';
import { ProductsPage } from './ui/products/ProductsPage';

describe('React workspace smoke validation', () => {
  it('renders the Materials workspace with the completed Phase 1 inputs and derived sections', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Craft Business Manager');
    expect(html).toContain('Add a material');
    expect(html).toContain('Calculated purchase costing');
    expect(html).toContain('Normalized stock &amp; valuation');
    expect(html).toContain('Supplier / source');
    expect(html).toContain('Products');
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
});
