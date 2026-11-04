// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BusinessInsightsPage from './BusinessInsightsPage';
import { BusinessProposalForm } from './BusinessProposalForm';
import { emptyBusinessWorkspace, type BusinessWorkspace, type ProposalDraft } from '../../domain/businessInsights';
import { emptyTransactionArchive } from '../transactions/portableTransactions';
import type { Product } from '../../domain/products';
import { flushBusinessChanges } from '../../application/insights/businessWorkingCopy';
import { calculateBusinessReport } from '../../application/insights/businessReports';
import * as productImages from '../../domain/productImage';

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const button = (label: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === label)!;
async function click(label: string) { await act(async () => button(label).click()); }
async function input(label: string, value: string) {
  const node = Array.from(container.querySelectorAll('label')).find(l => l.querySelector('span')?.textContent === label)!.querySelector('input,textarea,select')!;
  await act(async () => {
    const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
it('keeps working changes after a failed SQLite write and retries with the same revision', async () => {
  const initial = emptyBusinessWorkspace();
  const save = vi.fn(async (workspace: BusinessWorkspace, expectedRevision: number) => ({ revision: expectedRevision + 1, workspace: structuredClone(workspace) }));
  save.mockRejectedValueOnce(new Error('Storage full'));
  await act(async () => root.render(<BusinessInsightsPage load={async () => ({ revision: 4, workspace: initial })} save={save} historyLoad={async () => ({ revision: 0, archive: emptyTransactionArchive() })} productsLoad={async () => []} />));
  await click('Business profile'); await input('Business description', 'Handmade gifts');
  await click('Save changes now');
  expect(container.textContent).toContain('Storage full');
  expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Handmade gifts');
  await click('Save changes now');
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls.every(call => call[1] === 4)).toBe(true);
  expect(container.textContent).toContain('Saved in SQLite');
  expect(container.querySelector('[role=alert]')).toBeNull();
});
it('selects all matching codes across bounded pages and requires a price review when quantities change', async () => {
  const products: Product[] = Array.from({ length: 60 }, (_, i) => ({ id: `P-${i}`, name: i < 55 ? `Bear P (1pcs) ${i}` : `Candle ${i}`, category: 'paintable-art', isActive: true, safetyWasteRate: 0 }));
  let latest: ProposalDraft = emptyBusinessWorkspace().proposal;
  function Harness() {
    const [draft, setDraft] = useState(latest);
    return <BusinessProposalForm draft={draft} products={products} disabled={false} onChange={value => { latest = value; setDraft(value); }}
      resolvePrices={async items => items.map(i => ({ ...i, unitPrice: 25, priceSource: 'Saved default' }))} />;
  }
  await act(async () => root.render(<Harness />));
  await input('Search proposal products', 'P (1pcs)');
  expect(container.querySelectorAll('.insights-product-choice')).toHaveLength(25);
  await click('Select all matching (55)'); expect(latest.items).toHaveLength(55);
  await click('Use saved default prices'); expect(latest.items.every(i => i.unitPrice === 25)).toBe(true);
  const quantity = container.querySelector<HTMLInputElement>('input[aria-label^="Quantity for"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(quantity, '10'); quantity.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(latest.items[0]).toMatchObject({ quantity: 10, unitPrice: null });
  expect(container.textContent).toContain('Confirm every selected unit price');
});
it('indexes product names once instead of rescanning and sorting the catalog on every search keystroke', async () => {
  let nameReads = 0;
  const distant: Product = { id: 'far', name: 'Unused distant product', category: 'candle', isActive: true, safetyWasteRate: 0 };
  Object.defineProperty(distant, 'name', { get: () => { nameReads++; return 'Unused distant product'; } });
  const products: Product[] = [...Array.from({ length: 60 }, (_, i) => ({ id: `P-${i}`, name: `Bear P (1pcs) ${i}`, category: 'paintable-art' as const, isActive: true, safetyWasteRate: 0 })), distant];
  await act(async () => root.render(<BusinessProposalForm draft={emptyBusinessWorkspace().proposal} products={products} disabled={false} onChange={vi.fn()} />));
  const indexedReads = nameReads; expect(indexedReads).toBeGreaterThan(0);
  await input('Search proposal products', 'P (1pcs)'); await input('Search proposal products', 'No match');
  expect(nameReads).toBe(indexedReads); expect(container.querySelectorAll('.insights-product-choice')).toHaveLength(0);
});
it('validates thumbnail availability lazily once per product when filtering pictures', async () => {
  const validate = vi.spyOn(productImages, 'isValidProductImageDataUrl');
  const products: Product[] = [1, 2].map(n => ({ id: `P-${n}`, name: `Product ${n} P (1pcs)`, category: 'paintable-art', isActive: true, safetyWasteRate: 0,
    ...(n === 1 ? { imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' } : {}) }));
  await act(async () => root.render(<BusinessProposalForm draft={emptyBusinessWorkspace().proposal} products={products} disabled={false} onChange={vi.fn()} />));
  expect(validate).not.toHaveBeenCalled(); await input('Product pictures', 'with');
  expect(validate).toHaveBeenCalledTimes(2); expect(container.querySelectorAll('.insights-product-choice')).toHaveLength(1);
  await input('Search proposal products', 'P (1pcs)'); await input('Product pictures', 'without');
  expect(validate).toHaveBeenCalledTimes(2); expect(container.querySelectorAll('.insights-product-choice')).toHaveLength(1);
});
it('does not rerender neighboring selected products when changing terms or one quantity', async () => {
  let neighboringReads = 0;
  const initial = emptyBusinessWorkspace().proposal;
  initial.items = [1, 2].map(n => ({ productId: `P-${n}`, name: `Product ${n}`, quantity: 1, unitPrice: 25, priceSource: 'Manual', tierId: '' }));
  Object.defineProperty(initial.items[1], 'name', { get: () => { neighboringReads++; return 'Product 2'; } });
  const products: Product[] = [];
  function Harness() { const [draft, setDraft] = useState(initial); return <BusinessProposalForm draft={draft} products={products} disabled={false} onChange={setDraft} />; }
  await act(async () => root.render(<Harness />)); const firstRenderReads = neighboringReads;
  await input('Prepared for', 'New terms recipient'); expect(neighboringReads).toBe(firstRenderReads);
  const quantity = container.querySelector<HTMLInputElement>('input[aria-label="Quantity for Product 1"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(quantity, '5'); quantity.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(neighboringReads).toBe(firstRenderReads); expect(container.textContent).toContain('Confirm every selected unit price');
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Unselect Product 2"]')!.click());
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
});
it('flushes working edits into a database backup before the autosave timer has fired', async () => {
  const initial = emptyBusinessWorkspace();
  const save = vi.fn(async (workspace: BusinessWorkspace, expectedRevision: number) => ({ revision: expectedRevision + 1, workspace: structuredClone(workspace) }));
  await act(async () => root.render(<BusinessInsightsPage load={async () => ({ revision: 0, workspace: initial })} save={save} historyLoad={async () => ({ revision: 0, archive: emptyTransactionArchive() })} productsLoad={async () => []} />));
  await click('Business profile'); await input('Business description', 'Include my latest edit');
  expect(save).not.toHaveBeenCalled();
  await act(async () => flushBusinessChanges());
  expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0][0].profile.description).toBe('Include my latest edit');
  expect(container.textContent).toContain('Saved in SQLite');
});
it('keeps both proposal forms editable during autosave, preserves newer edits, and avoids duplicate source loads or report recalculation', async () => {
  const initial = emptyBusinessWorkspace();
  const historyLoad = vi.fn(async () => ({ revision: 0, archive: emptyTransactionArchive() })), productsLoad = vi.fn(async () => []);
  const calculate = vi.fn(async () => calculateBusinessReport([], [], initial, '2026-01-01', '2026-11-04'));
  let finish!: (value: { revision: number; workspace: BusinessWorkspace }) => void;
  const save = vi.fn(async (workspace: BusinessWorkspace, revision: number) => ({ revision: revision + 1, workspace: structuredClone(workspace) }));
  save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<BusinessInsightsPage load={async () => ({ revision: 0, workspace: initial })} save={save} historyLoad={historyLoad} productsLoad={productsLoad} calculate={calculate} />));
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(historyLoad).toHaveBeenCalledOnce(); expect(productsLoad).toHaveBeenCalledOnce(); expect(calculate).toHaveBeenCalledOnce();
  await click('Proposals'); await input('Prepared for', 'First edit');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(container.textContent).toContain('Saving to SQLite');
  expect(container.querySelector('fieldset')!.disabled).toBe(false);
  await input('Prepared for', 'More typing during save'); await click('Investor proposals');
  expect(container.querySelector('fieldset')!.disabled).toBe(false); await input('Investor name', 'Keep this new investor');
  await act(async () => finish({ revision: 1, workspace: structuredClone(save.mock.calls[0][0]) }));
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Investor name"]')!.value).toBe('Keep this new investor');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1][1]).toBe(1);
  expect(save.mock.calls[1][0].proposal.recipient).toBe('More typing during save');
  expect(save.mock.calls[1][0].investorProposal!.investorName).toBe('Keep this new investor');
  await click('Overview'); await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(calculate).toHaveBeenCalledOnce();
});
it('flushes edits made during an in-flight autosave before completing a SQLite backup', async () => {
  const initial = emptyBusinessWorkspace(); let finish!: (value: { revision: number; workspace: BusinessWorkspace }) => void;
  const save = vi.fn(async (workspace: BusinessWorkspace, revision: number) => ({ revision: revision + 1, workspace: structuredClone(workspace) }));
  save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<BusinessInsightsPage load={async () => ({ revision: 0, workspace: initial })} save={save} historyLoad={async () => ({ revision: 0, archive: emptyTransactionArchive() })} productsLoad={async () => []} />));
  await click('Proposals'); await input('Prepared for', 'Before save');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await input('Prepared for', 'Newest draft for the backup');
  let flushing!: Promise<void>; await act(async () => { flushing = flushBusinessChanges(); });
  await act(async () => { finish({ revision: 1, workspace: structuredClone(save.mock.calls[0][0]) }); await flushing; });
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1][0].proposal.recipient).toBe('Newest draft for the backup');
  expect(container.textContent).toContain('Saved in SQLite');
});
