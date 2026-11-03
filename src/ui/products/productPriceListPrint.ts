import { isValidBrochureImageDataUrl } from '../../domain/productBrochureImage';
import { isValidProductImageDataUrl } from '../../domain/productImage';
import { priceListMoney, priceListPriceLabel, priceListPrices, type ProductPriceListView } from './productPriceList';

type PriceListPrintWindow = Pick<Window, 'document' | 'focus' | 'print'>;

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export function renderProductPriceListHtml(view: ProductPriceListView): string {
  const rows = view.rows.map((row) => {
    const photo = view.includePictures && (isValidBrochureImageDataUrl(row.imageDataUrl) || isValidProductImageDataUrl(row.imageDataUrl))
      ? `<img src="${escapeHtml(row.imageDataUrl)}" alt="Product photo">` : '<span class="muted">No picture</span>';
    const prices = priceListPrices(row, view.includePackages);
    return `<tr>${view.includePictures ? `<td class="photo">${photo}</td>` : ''}
      <td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.productId)}</small></td>
      <td>${escapeHtml(row.categoryLabel)}</td>
      <td>${prices.length ? prices.map((price) => `<div class="price"><strong>${escapeHtml(priceListMoney(price.unitPrice))}</strong><small>${escapeHtml(priceListPriceLabel(price))}</small></div>`).join('') : '<span class="muted">Contact us for pricing</span>'}</td></tr>`;
  }).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>My Lovely Craft — Product price list</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #513328; background: white; font: 10pt/1.45 Arial, sans-serif; }
  main { max-width: 186mm; margin: 0 auto; }
  header { padding: 0 0 6mm; border-bottom: 2px solid #be8c83; margin-bottom: 5mm; }
  .brand { margin: 0; font: bold 11pt Georgia, serif; letter-spacing: .16em; }
  h1 { margin: 3mm 0 1mm; font: 26pt Georgia, serif; }
  p { margin: 1mm 0; }
  .muted, small { color: #7d6e64; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  th { text-align: left; background: #f6eeea; color: #67453b; font-size: 9pt; }
  th, td { padding: 3mm 2.5mm; border-bottom: 1px solid #e5d9d1; vertical-align: middle; overflow-wrap: anywhere; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .picture-column { width: 22mm; }
  .category-column { width: 29mm; }
  .price-column { width: 51mm; }
  small { display: block; font-size: 8pt; margin-top: 1mm; }
  .photo img { display: block; width: 18mm; height: 18mm; object-fit: contain; }
  .photo span { font-size: 8pt; }
  .price + .price { margin-top: 2.5mm; }
  footer { margin-top: 6mm; padding-top: 3mm; border-top: 1px solid #e5d9d1; font-size: 8pt; color: #7d6e64; }
  .screen-note { padding: 12px; margin: 12px auto 20px; max-width: 186mm; background: #f6eeea; }
  @media screen { body { padding: 24px; } }
  @media print { .screen-note { display: none; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>
<aside class="screen-note">Choose Print → Save as PDF to download this price list. Use A4 portrait and turn off browser headers and footers.</aside>
<main><header><p class="brand">MY LOVELY CRAFT</p><h1>Product price list</h1>
<p>${view.rows.length} product${view.rows.length === 1 ? '' : 's'} · Prices in PHP per piece${view.includePackages ? ' · Package minimums apply' : ' · Single / default prices'}</p></header>
<table><thead><tr>${view.includePictures ? '<th class="picture-column">Picture</th>' : ''}<th>Product / code</th><th class="category-column">Category</th><th class="price-column">Selling price / piece</th></tr></thead><tbody>${rows}</tbody></table>
<footer>MY LOVELY CRAFT · mylovelycraft.coresite.pro · Contact us for custom orders.</footer></main></body></html>`;
}

export function printProductPriceList(
  view: ProductPriceListView,
  openWindow: () => PriceListPrintWindow | null = () => window.open('', '_blank', 'width=980,height=950'),
): void {
  const popup = openWindow();
  if (!popup) throw new Error('Your browser blocked the price list window. Allow pop-ups and try again.');
  popup.document.open();
  popup.document.write(renderProductPriceListHtml(view));
  popup.document.close();
  const print = () => { popup.focus(); popup.print(); };
  const images = Array.from(popup.document.images ?? []).filter((image) => !image.complete);
  if (!images.length) { print(); return; }
  void Promise.all(images.map((image) => new Promise<void>((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
    if (image.complete) resolve();
  }))).then(print);
}
