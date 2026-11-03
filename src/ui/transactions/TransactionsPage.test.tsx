// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/mobile-transactions.json';
import * as portable from './portableTransactions';
import { TransactionsPage } from './TransactionsPage';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
function button(text: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (node) => node.textContent === text
  )!;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function value(label: string, value: string) {
  const field = Array.from(container.querySelectorAll('label'))
    .find((node) => node.querySelector('span')?.textContent === label)!
    .querySelector('input,select,textarea') as HTMLInputElement;
  await act(async () => {
    const proto =
      field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field.dispatchEvent(
      new Event(field instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      })
    );
  });
}
it('reviews append counts, filters dates and edits debit/credit without rewriting original receipts', async () => {
  const archive = await portable.validatePortableTransactions(fixture);
  const load = vi.fn(async () => ({
    revision: 0,
    archive: portable.emptyTransactionArchive(),
  }));
  const save = vi.fn(
    async (next: portable.PortableTransactionArchive, revision: number) => ({
      revision: revision + 1,
      archive: next,
    })
  );
  vi.spyOn(portable, 'readPortableTransactions').mockResolvedValue(archive);
  await act(async () => {
    root.render(<TransactionsPage load={load} save={save} />);
  });
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [new File(['fixture'], 'mobile.json')],
  });
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true }))
  );
  expect(container.textContent).toContain('1 new receipts');
  expect(save).not.toHaveBeenCalled();
  await click('Append imported history');
  expect(save).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('CR-INTEROP-1');
  await value('From date', '2026-11-01');
  await value('To date', '2026-11-01');
  expect(container.textContent).toContain('No history matches');
  await click('All dates');
  await click('Financial view / Manage CR-INTEROP-1');
  await value('Direction', 'debit');
  await value('Movement amount (PHP)', '9.50');
  await value('Movement date', '2026-11-01');
  await value('Management notes', 'Refund correction');
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  );
  const saved = save.mock.calls.at(-1)![0];
  expect(saved.transactionEntries![0]).toMatchObject({
    direction: 'debit',
    amount: 9.5,
    date: '2026-11-01',
    notes: 'Refund correction',
  });
  expect(saved.customerReceipts[0]).toEqual(archive.customerReceipts[0]);
  expect(container.textContent).toContain('PHP -9.50');
  expect(container.textContent).toContain('Original items');
});
