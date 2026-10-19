import { isValidProductImageDataUrl } from '../../domain/productImage';
import { isValidBrochureImageDataUrl } from '../../domain/productBrochureImage';
import type { BrochurePriceOption } from './productBrochurePricing';

export interface ProductBrochureView {
  productId: string;
  name: string;
  categoryLabel: string;
  description: string;
  imageDataUrl: string | null;
  prices: BrochurePriceOption[];
}

export type ProductBrochurePrintWindow = Pick<Window, 'document' | 'focus' | 'print'>;
export type ProductBrochureWindowOpener = () => ProductBrochurePrintWindow | null;

export class ProductBrochurePrintError extends Error {
  readonly code = 'POPUP_BLOCKED';
  constructor(message: string) {
    super(message);
    this.name = 'ProductBrochurePrintError';
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** A single portrait A4 print document, following the My Lovely Craft sample brochure. */
export function renderProductBrochureHtml(
  view: ProductBrochureView,
  brandMarkUrl = '/brand/mlc-mark.webp',
): string {
  const photo = (isValidBrochureImageDataUrl(view.imageDataUrl) ||
    isValidProductImageDataUrl(view.imageDataUrl))
    ? `<img class="hero-photo" alt="Product photo" src="${escapeHtml(view.imageDataUrl)}">`
    : '<div class="hero-placeholder">Product photo not yet available</div>';
  const prices = view.prices.slice(0, 3).filter((item) =>
    Number.isFinite(item.unitPrice) && item.unitPrice >= 0);
  const pricing = prices.length > 0
    ? `<section class="pricing">
        <h3>PRICE &amp; PACKAGES</h3>
        <div class="price-grid">${prices.map((item) => `
          <div class="price-card">
            <span class="price-label">${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(money(item.unitPrice))}</strong>
            <span class="price-unit">per piece</span>
          </div>`).join('')}</div>
      </section>`
    : '<p class="price-inquiry">CONTACT US FOR PRICING &amp; CUSTOM ORDERS</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(view.name)} — My Lovely Craft Brochure</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html { background: #f2efed; }
    body { margin: 0; color: #513328; font-family: Georgia, 'Times New Roman', serif; }
    .screen-note { max-width: 210mm; margin: 12px auto; padding: 12px 18px; background: #fff5e7; font: 13px Arial, sans-serif; color: #6f5440; }
    .sheet { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto 14mm; padding: 10mm 13mm 12mm; background: #fff; display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden; box-shadow: 0 2mm 10mm rgba(0,0,0,.08); }
    header { width: 100%; text-align: center; }
    .brand-icon { display: block; width: 28mm; height: 18mm; object-fit: contain; margin: 0 auto 1.2mm; }
    .brand-name { margin: 0; color: #6b361f; font: bold 15pt Georgia, serif; letter-spacing: .20em; text-transform: uppercase; }
    .brand-services { color: #b37879; font: 8pt Arial, sans-serif; letter-spacing: .15em; text-transform: uppercase; margin: 1mm 0 2.5mm; }
    .rule { width: 100%; border-bottom: 1px solid #dfb8b8; }
    .category { margin: 4mm 0 0; color: #b07883; font: 9pt Arial, sans-serif; letter-spacing: .18em; text-transform: uppercase; }
    .photo-area { display: flex; justify-content: center; align-items: center; width: 100%; height: 127mm; flex: 0 0 127mm; margin-top: 3mm; }
    .hero-photo { display: block; width: 100%; height: 100%; object-fit: contain; }
    .hero-placeholder { display: grid; place-items: center; width: 100%; height: 95%; background: #faf6f3; color: #997b77; font: 11pt Arial, sans-serif; }
    .product-copy { width: 100%; }
    .product-name { margin: 2mm 0 1.5mm; color: #553327; font-size: 22pt; line-height: 1.15; font-weight: normal; overflow-wrap: anywhere; }
    .description { margin: 0 auto; max-width: 155mm; min-height: 9mm; color: #83716b; font: italic 10.5pt/1.4 Georgia, serif; white-space: pre-wrap; overflow-wrap: anywhere; }
    .pricing { width: 100%; margin-top: 5mm; }
    .pricing h3 { margin: 0 0 3mm; color: #b77883; font: 9pt Arial, sans-serif; letter-spacing: .12em; }
    .price-grid { display: grid; grid-template-columns: repeat(${prices.length}, minmax(0, 1fr)); background: #fbefef; }
    .price-card { min-width: 0; padding: 3.5mm 2mm 3mm; display: flex; flex-direction: column; align-items: center; gap: 1.5mm; }
    .price-label { font: 8pt Arial, sans-serif; color: #8f7272; letter-spacing: .075em; overflow-wrap: anywhere; }
    .price-card strong { color: #bd7d85; font: bold 15pt Georgia, serif; }
    .price-unit { font: 7pt Arial, sans-serif; color: #9e8c8a; }
    .price-inquiry { width: 100%; color: #bd7d85; font: 9pt Arial, sans-serif; letter-spacing: .10em; padding: 4mm 0; margin: 5mm 0; background: #fbefef; }
    .product-code { margin: 4mm 0 0; color: #987d76; font: 8pt Arial, sans-serif; letter-spacing: .09em; overflow-wrap: anywhere; }
    footer { width: 100%; margin-top: auto; padding-top: 8mm; color: #b8828d; font: 7.5pt Arial, sans-serif; letter-spacing: .10em; }
    @media print {
      html { background: #fff; }
      .screen-note { display: none; }
      .sheet { margin: 0; box-shadow: none; }
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <aside class="screen-note">To create a PDF, choose Print → Save as PDF. Use A4 portrait, no margins, and turn off browser headers and footers.</aside>
  <main class="sheet">
    <header>
      <img class="brand-icon" src="${escapeHtml(brandMarkUrl)}" alt="">
      <h1 class="brand-name">My Lovely Craft</h1>
      <p class="brand-services">CANDLES · PLASTER PAINT · GIFTS</p>
      <div class="rule"></div>
      <p class="category">${escapeHtml(view.categoryLabel)}</p>
    </header>
    <div class="photo-area">${photo}</div>
    <div class="product-copy">
      <h2 class="product-name">${escapeHtml(view.name)}</h2>
      <p class="description">${escapeHtml(view.description.trim() || 'Handcrafted with love for your special moments.')}</p>
    </div>
    ${pricing}
    <p class="product-code">PRODUCT CODE ${escapeHtml(view.productId)} &nbsp; · &nbsp; CUSTOM ORDERS WELCOME</p>
    <footer>CRAFTED WITH LOVE &nbsp; · &nbsp; mylovelycraft.coresite.pro</footer>
  </main>
</body>
</html>`;
}

/** Opens the browser's Print / Save as PDF screen, waiting for embedded images. */
export function printProductBrochure(
  view: ProductBrochureView,
  openWindow: ProductBrochureWindowOpener = () => window.open('', '_blank', 'width=980,height=950'),
): void {
  const popup = openWindow();
  if (!popup) throw new ProductBrochurePrintError(
    'Your browser blocked the brochure window. Allow pop-ups and try again.',
  );
  const logoUrl = typeof window === 'undefined'
    ? '/brand/mlc-mark.webp'
    : new URL('/brand/mlc-mark.webp', window.location.href).href;
  popup.document.open();
  popup.document.write(renderProductBrochureHtml(view, logoUrl));
  popup.document.close();

  const images = Array.from(popup.document.images ?? []).filter((image) => !image.complete);
  if (!images.length) {
    popup.focus();
    popup.print();
    return;
  }
  void Promise.all(images.map((image) => new Promise<void>((resolve) => {
    const done = () => resolve();
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
    if (image.complete) resolve();
  }))).then(() => {
    popup.focus();
    popup.print();
  });
}
