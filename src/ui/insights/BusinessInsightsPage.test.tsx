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

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
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
