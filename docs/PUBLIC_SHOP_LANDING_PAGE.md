# Public My Lovely Craft shop landing

## Customer-facing route

The public marketing landing is a **separate static HTML document**:

- Source: `public/shop/index.html`
- Styles: `public/shop/assets/shop.css`
- Optional category filter: `public/shop/assets/shop.js`
- Published path after deployment: `https://mylovelycraft.coresite.pro/shop/`

The existing root (`/`) continues to load the **business manager**, including the workbook and private pricing workflows. The new page deliberately uses **no runtime access** to business repositories, customer records, cost tables, spreadsheet snapshots, receipts, inventory or financial calculations.

This route follows the same static-file hosting convention as the `/privacy-policy/` page. The server must serve `/shop/index.html` for directory requests to `/shop/`; test HTTPS with an incognito browser after deployment.

## What's in the public page

- Responsive branded welcome section, original decorative SVG illustrations.
- Six marketing **collections**, grouped into paintable art, scented and sculptural candles, custom event favors and pots/trays.
- Category filtering that works with keyboard controls and shows **all** products if JavaScript is blocked.
- Facebook inquiry buttons using the existing official page URL.
- Story, event promotion, three-step inquiry guidance and frequently asked questions.
- Search/social metadata and a prominent link to the publicly accessible Privacy Policy.

The illustrations are representative, **not actual product photos**. Product prices, variants, stock and availability are not fabricated; customers are directed to inquire.

## How to publish real promotional products and photos

The first release is a hand-curated public showcase, **not a live synced catalog**. It is intentionally not wired to the private workbook: blindly publishing those records could leak internal material suppliers, unit costs, profits, inventories or personally identifying customer fields.

For future featured campaigns:

1. Pick only customer-approved product names, descriptions, prices (if any) and product photos. Obtain permission for identifiable people or customer event details.
2. Add optimized, properly licensed product image files under `public/shop/assets/`.
3. In `public/shop/index.html`, replace the respective `card-art` illustrative SVG with an accessible `<img>` with meaningful alt text, keeping the descriptive product card and the inquiry link.
4. Add or modify the card's `data-category` to one or more supported filters: `art`, `candles`, `events`, `decor`. If adding more cards, update the initial accessible count text as appropriate.
5. Review content against actual products/pricing and publish a fresh web build. Without deployment, public content will not change. No server-side CMS or automatic workbook publication exists in this PR.

## Release checklist

- Verify `/shop/` and `/privacy-policy/` load over valid HTTPS, publicly, worldwide, without login.
- Confirm customer Facebook link resolves to the intended My Lovely Craft page.
- Check smartphone layout, desktop grid, tab/key navigation, FAQ disclosure, and each category filter.
- Verify metadata/title and links in search/social previews.
- Confirm the business manager at `/` and workbook tools still work independently.
- No mobile app code, mobile scanner integration, production deployment or automatic e-commerce payments are included in this change.
