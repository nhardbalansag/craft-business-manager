import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import { CalibrationPage } from './ui/calibration/CalibrationPage';

describe('Phase 1 React workspace smoke validation', () => {
  it('renders the Materials workspace with the completed Phase 1 inputs and derived sections', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Craft Business Manager');
    expect(html).toContain('Add a material');
    expect(html).toContain('Calculated purchase costing');
    expect(html).toContain('Normalized stock &amp; valuation');
    expect(html).toContain('Supplier / source');
  });

  it('renders the Calibration workspace without requiring browser-side effects', () => {
    const html = renderToStaticMarkup(<CalibrationPage />);

    expect(html).toContain('Calibration');
    expect(html).toContain('Session-only calibration history');
    expect(html).toContain('Add a weight-based material first');
  });
});
