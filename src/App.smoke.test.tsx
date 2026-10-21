import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import type { Material } from './domain/materials';
import type { Product } from './domain/products';
import { PricingPage } from './ui/pricing/PricingPage';
import { ProductComponentsView } from './ui/products/ProductComponentsView';
import { ProductsPage } from './ui/products/ProductsPage';
import { ProductsWorkspacePage } from './ui/products/ProductsWorkspacePage';
import { ProductStockView } from './ui/products/ProductStockView';
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
    expect(html).not.toContain('>Calibration<');
    expect(html).toContain('Products');
    expect(html).not.toContain('>Yield</button>');
    expect(html).toContain('Production');
    const navigation = html.slice(html.indexOf('aria-label="Application sections"'));
    expect(navigation).not.toContain('>Pricing</button>');
  });

  it('renders the Products, Components, and Finished stock workspace without browser-side effects', () => {
    const html = renderToStaticMarkup(<ProductsPage />);

    expect(html).toContain('Your product workshop');
    expect(html).toContain('Add a product');
    expect(html).toContain('Product catalog');
    expect(html).not.toContain('Mix presets');
    expect(html).toContain('Components');
    expect(html).toContain('Finished stock');
    expect(html).toContain('Safety waste (%)');
  });

  it('places Yield and Pricing inside the Product workspace, not in the outer tabs', () => {
    const html = renderToStaticMarkup(<ProductsWorkspacePage />);
    expect(html).toContain('aria-controls="products-view-yield"');
    expect(html).toContain('id="products-view-yield"');
    expect(html).toContain('aria-controls="products-view-pricing"');
    expect(html).toContain('id="products-view-pricing"');
    expect(html).not.toContain('id="products-pricing-area"');
    expect(html).not.toContain('aria-label="Selected pricing Product"');
  });

  it('renders the Product composition editor shell with an active parent Product', () => {
    const product: Product = {
      id: 'GIFT',
      name: 'Gift Box',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: true,
    };
    const material: Material = {
      id: 'JAR',
      name: 'Glass Jar',
      group: 'container',
      baseUnit: 'pc',
      purchaseQuantity: 1,
      purchaseUnit: 'pc',
      packageCost: 10,
      onHandQuantity: 10,
      onHandUnit: 'pc',
      isActive: true,
    };

    const html = renderToStaticMarkup(
      <ProductComponentsView products={[product]} materials={[material]} catalogLoading={false} />,
    );

    expect(html).toContain('Composition editor');
    expect(html).toContain('Component ID');
    expect(html).toContain('Material source');
    expect(html).toContain('Quantity per parent');
    expect(html).toContain('NESTED COMPOSITION PREVIEW');
    expect(html).toContain('Gift Box');
  });

  it('renders the Finished component stock editor shell without browser-side effects', () => {
    const product: Product = {
      id: 'HEART',
      name: 'Mini Heart',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    };

    const html = renderToStaticMarkup(
      <ProductStockView products={[product]} catalogLoading={false} />,
    );

    expect(html).toContain('FINISHED COMPONENT STOCK');
    expect(html).toContain('Set current stock');
    expect(html).toContain('Current finished stock (pc)');
    expect(html).toContain('Whole pieces only. Unit is fixed to pc');
    expect(html).toContain('Loading finished component stock…');
    expect(html).toContain('Missing stock is unresolved; explicit 0 pc is known zero.');
  });

  it('renders the Phase 2 Yield workspace loading guidance without requiring browser-side effects', () => {
    const html = renderToStaticMarkup(<YieldPage />);

    expect(html).toContain('Yield &amp; history');
    expect(html).toContain('Included in workbook exports');
    expect(html).toContain('Choose the product');
    expect(html).toContain('Record the real batch');
    expect(html).toContain('Review effective learning');
    expect(html).toContain('Loading yield workspace');
  });

  it('renders production loading without publishing a ready estimate before effects run', () => {
    const html = renderToStaticMarkup(<ProductionPage onOpenProducts={() => {}} />);
    expect(html).toContain('Plan your next batch');
    expect(html).toContain('Loading products and materials');
    expect(html).not.toContain('Estimate is ready');
    expect(html).not.toContain('Expected profit');
  });

  it('renders a clean Pricing dashboard with optional detailed costs and full modal actions', () => {
    const html = renderToStaticMarkup(<PricingPage />);

    expect(html).not.toContain('PHASE 4 · PRICING');
    expect(html).not.toContain('Pricing &amp; unit economics');
    expect(html).not.toContain('Included in workbook exports');
    expect(html).toContain('YOUR PRODUCT');
    expect(html).toContain('Change product');
    expect(html).toContain('Financial source');
    expect(html).toContain('Set Financial Source');
    expect(html).toContain('Saved pricing result');
    expect(html).toContain('Unit cost');
    expect(html).toContain('Selling price');
    expect(html).toContain('Profit / unit');
    expect(html).toContain('Margin');
    expect(html).toContain('View cost breakdown');
    expect(html).toContain('pricing-cost-details');
    expect(html).toContain('pricing-overview');
    expect(html).toContain('pricing-quick-actions');
    expect(html).toContain('ORDER &amp; QUOTATION');
    expect(html).toContain('BULK &amp; CUSTOM');
    expect(html).toContain('Open Order Price Preview');
    expect(html).toContain('Open Tier Pricing');

    // Details and modals remain in the system, but are not expanded by default.
    expect(html).not.toContain('class="pricing-cost-details" open');
    expect(html).not.toContain('class="pricing-overview" aria-label="Pricing catalog summary" open');
    expect(html).not.toContain('Labor cost per unit (PHP)');
    expect(html).not.toContain('Order quantity (finished units)');
    expect(html).not.toContain('Tier pricing catalog');

    expect(html.indexOf('Financial source')).toBeGreaterThan(html.indexOf('YOUR PRODUCT'));
    expect(html.indexOf('Financial source')).toBeLessThan(html.indexOf('UNIT ECONOMICS'));
    expect(html.indexOf('UNIT ECONOMICS')).toBeLessThan(html.indexOf('ORDER &amp; QUOTATION'));
  });
});
