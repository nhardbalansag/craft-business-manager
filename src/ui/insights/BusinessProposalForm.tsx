import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ProposalDraft, ProposalLine } from '../../domain/businessInsights';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product } from '../../domain/products';
import { businessMoney } from '../../application/insights/businessDocuments';
import { productPriceResolutionService } from '../../application/session';
import { isValidProductImageDataUrl } from '../../domain/productImage';
import { BusinessProposalItems } from './BusinessProposalItems';

const proposalTitles = { corporate: 'Corporate gifting proposal', event: 'Event souvenir proposal', reseller: 'Reseller and wholesale proposal' };

export async function resolveProposalPrices(items: ProposalLine[]): Promise<ProposalLine[]> {
  const rows: ProposalLine[] = [];
  for (let i = 0; i < items.length; i += 20) {
    const batch = items.slice(i, i + 20);
    const prices = await productPriceResolutionService.resolveMany(batch.map(p => ({ productId: p.productId, quantity: p.quantity })));
    batch.forEach((line, j) => {
      const price = prices[j];
      rows.push({ ...line, unitPrice: price?.status === 'ready' && price.unitSellingPrice !== null ? Math.round(price.unitSellingPrice * 100) / 100 : null,
        priceSource: price?.status === 'ready' ? 'Saved default pricing at selected quantity' : 'Saved pricing is unavailable; enter a unit price', tierId: '' });
    });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return rows;
}
export function BusinessProposalForm({ draft, products, onChange, disabled, resolvePrices = resolveProposalPrices }: {
  draft: ProposalDraft; products: Product[]; onChange: (p: ProposalDraft) => void; disabled: boolean;
  resolvePrices?: typeof resolveProposalPrices;
}) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [pictures, setPictures] = useState('all'), [limit, setLimit] = useState(25);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(true);
  const current = useRef({ draft, onChange }); current.current = { draft, onChange };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const search = query.trim().replace(/\s+/g, ' ').toLowerCase(), deferred = useDeferredValue(search);
  const selected = useMemo(() => new Set(draft.items.map(i => i.productId)), [draft.items]);
  const catalog = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const choices = useMemo(() => products.filter(p => p.isActive).map(p => ({ product: p, search: `${p.name} ${p.id}`.toLowerCase().replace(/\s+/g, ' ') }))
    .sort((a, b) => a.product.name.localeCompare(b.product.name)), [products]);
  const pictureFlags = useMemo(() => new Map<Product, boolean>(), [products]);
  const filtered = useMemo(() => {
    const hasPicture = (product: Product) => {
      let found = pictureFlags.get(product);
      if (found === undefined) { found = isValidProductImageDataUrl(product.imageDataUrl); pictureFlags.set(product, found); }
      return found;
    };
    return choices.filter(c => c.search.includes(deferred) && (category === 'all' || c.product.category === category) &&
      (pictures === 'all' || hasPicture(c.product) === (pictures === 'with'))).map(c => c.product);
  }, [choices, deferred, category, pictures, pictureFlags]);
  const locked = disabled || busy;
  function select(ids: Set<string>) {
    if (ids.size > 100) { setError('Select up to 100 products per proposal. Narrow your search or category.'); return; }
    setError(''); const old = new Map(draft.items.map(i => [i.productId, i]));
    onChange({ ...draft, items: [...ids].map(id => {
      const existing = old.get(id); if (existing) return existing;
      const p = catalog.get(id)!;
      return { productId: p.id, name: p.name, quantity: 1, unitPrice: null, priceSource: 'Choose a saved or manual price', tierId: '' };
    }) });
  }
  const update = useCallback((line: ProposalLine) => {
    const { draft, onChange } = current.current; onChange({ ...draft, items: draft.items.map(i => i.productId === line.productId ? line : i) });
  }, []);
  const remove = useCallback((id: string) => {
    const { draft, onChange } = current.current; setError(''); onChange({ ...draft, items: draft.items.filter(i => i.productId !== id) });
  }, []);
  const field = (key: 'title' | 'recipient' | 'introduction' | 'leadTime' | 'delivery' | 'paymentTerms' | 'notes', label: string, multiline = false) => <label className={`field ${multiline ? 'insights-wide' : ''}`} key={key}><span>{label}</span>{multiline ? <textarea maxLength={4000} rows={3} value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })} /> : <input maxLength={4000} value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })} />}</label>;
  async function pricing() {
    setBusy(true); setError('');
    try { const items = await resolvePrices(draft.items); if (mounted.current) onChange({ ...draft, items }); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Saved prices could not be loaded.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="panel insights-panel" aria-labelledby="proposal-title"><h2 id="proposal-title">Corporate, event &amp; reseller proposals</h2><p className="insights-muted">Choose products and quantities, confirm selling prices, and add your delivery and payment terms. Customer documents contain selling prices and your written terms.</p>
    <fieldset disabled={locked} className="insights-fieldset"><legend>Proposal details</legend><div className="insights-form-grid">
      <label className="field"><span>Proposal type</span><select value={draft.type} onChange={e => { const type = e.target.value as ProposalDraft['type']; onChange({ ...draft, type, title: Object.values(proposalTitles).includes(draft.title) ? proposalTitles[type] : draft.title }); }}><option value="corporate">Corporate gifting</option><option value="event">Event souvenirs</option><option value="reseller">Reseller / wholesale</option></select></label>
      {field('title', 'Proposal title')}{field('recipient', 'Prepared for')}{field('introduction', 'Proposal introduction', true)}
      {field('leadTime', 'Production lead time')}{field('delivery', 'Delivery details')}{field('paymentTerms', 'Payment terms')}
      <label className="field"><span>Proposal valid until</span><input type="date" value={draft.validUntil} onChange={e => onChange({ ...draft, validUntil: e.target.value })} /></label>
      {field('notes', 'Customization, inclusions, taxes and other terms', true)}
      <label className="insights-check insights-wide"><input type="checkbox" checked={draft.includePictures} onChange={e => onChange({ ...draft, includePictures: e.target.checked })} />Include product pictures</label>
    </div>
    <h3>Choose products</h3><div className="insights-form-grid"><label className="field"><span>Search proposal products</span><input type="search" placeholder="e.g. P (1pcs)" value={query} onChange={e => { setQuery(e.target.value); setLimit(25); }} /></label>
      <label className="field"><span>Proposal product category</span><select value={category} onChange={e => { setCategory(e.target.value); setLimit(25); }}><option value="all">All categories</option>{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{PRODUCT_CATEGORY_RULES[c].label}</option>)}</select></label>
      <label className="field"><span>Product pictures</span><select value={pictures} onChange={e => { setPictures(e.target.value); setLimit(25); }}><option value="all">With or without pictures</option><option value="with">With pictures</option><option value="without">Without pictures</option></select></label>
    </div><div className="insights-actions"><button type="button" className="button button-secondary" disabled={!filtered.length || search !== deferred} onClick={() => select(new Set([...selected, ...filtered.map(p => p.id)]))}>Select all matching ({filtered.length})</button><button type="button" className="button button-secondary" disabled={!selected.size} onClick={() => select(new Set())}>Clear selection</button><span>{selected.size} selected</span></div>
    <div className="insights-product-picker">{filtered.slice(0, limit).map(p => <label className="insights-product-choice" key={p.id}><input type="checkbox" checked={selected.has(p.id)} onChange={() => { const ids = new Set(selected); ids.has(p.id) ? ids.delete(p.id) : ids.add(p.id); select(ids); }} /><span><strong>{p.name}</strong><small>{p.id} · {PRODUCT_CATEGORY_RULES[p.category].label}</small></span></label>)}</div>
    {!filtered.length && <p>No active products match your search.</p>}{filtered.length > limit && <button type="button" className="button button-secondary" onClick={() => setLimit(limit + 25)}>Show more choices</button>}
    <h3>Selected products &amp; selling prices</h3><button type="button" className="button button-secondary" disabled={!draft.items.length} onClick={() => void pricing()}>Use saved default prices</button><p className="insights-muted">Saved default pricing is resolved for each quantity. Enter a negotiated wholesale or package unit price manually when needed. Changing a quantity clears its saved price for review.</p>
    <BusinessProposalItems items={draft.items} update={update} remove={remove} />
    <p>{draft.items.some(i => i.unitPrice === null) ? 'Confirm every selected unit price before generating a proposal.' : `Proposal total: ${businessMoney(draft.items.reduce((sum, i) => sum + Math.round((i.unitPrice ?? 0) * 100) * i.quantity, 0) / 100)}`}</p>
    </fieldset>{busy && <p role="status">Resolving saved prices…</p>}{error && <p role="alert" className="feedback feedback-error">{error}</p>}
  </section>;
}
