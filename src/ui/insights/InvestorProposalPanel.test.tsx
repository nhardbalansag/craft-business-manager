// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyBusinessWorkspace, emptyInvestorProposal, type BusinessDocument, type BusinessReport, type InvestorProposalDraft } from '../../domain/businessInsights';
import { emptyTransactionArchive } from '../transactions/portableTransactions';
import { InvestorProposalPanel } from './InvestorProposalPanel';
import { calculateBusinessReport } from '../../application/insights/businessReports';
import fixture from '../transactions/__fixtures__/mobile-transactions.json';

let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const button = (text: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === text)!;
const draft = (): InvestorProposalDraft => ({ ...emptyInvestorProposal('2026-11-04'), investorName: 'María Santos', investmentAmount: 10000, maximumPayout: 14000,
  manual: { monthlySales: 20000, monthlyProductCost: 8000, monthlyOperatingExpenses: 2000 }, sourceNotes: 'Owner reviewed assumptions and expense coverage.' });
async function click(text: string) { await act(async () => button(text).click()); }
async function input(label: string, value: string) {
  const node = Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')).find(n => n.getAttribute('aria-label') === label || n.closest('label')?.querySelector('span')?.textContent === label)!;
  await act(async () => {
    const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value); node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
it('previews and saves a proposal snapshot without altering sales or the expense ledger', async () => {
  const workspace = emptyBusinessWorkspace(), history = { revision: 0, archive: emptyTransactionArchive() };
  let latest = draft();
  const saved = vi.fn(async (d: BusinessDocument) => ({ ...d, businessRevision: 1 }));
  function Harness() { const [value, setValue] = useState(latest); return <InvestorProposalPanel draft={value} workspace={workspace} history={history} businessRevision={0} disabled={false} onChange={d => { latest = d; setValue(d); }} saveDocument={saved} />; }
  await act(async () => root.render(<Harness />));
  expect(container.textContent).toContain('Capital recovery: month 6');
  await click('Preview investor proposal');
  const html = container.querySelector('iframe')!.getAttribute('srcdoc')!;
  expect(html).toContain('Prepared for María Santos'); expect(html).toContain('not guaranteed payments');
  await click('Save proposal snapshot');
  expect(saved).toHaveBeenCalledOnce(); expect(saved.mock.calls[0][0].kind).toBe('investor-proposal');
  expect(workspace.ledger).toEqual([]); expect(history.archive.customerReceipts).toEqual([]);
  await input('Maximum total payout including capital (PHP)', '9000');
  expect(container.querySelector('iframe')).toBeNull(); expect(button('Preview investor proposal').disabled).toBe(true);
  expect(container.textContent).toContain('at least equal to capital');
});
it('keeps a preview through equivalent autosave clones and invalidates it when proposal content changes', async () => {
  const workspace = emptyBusinessWorkspace(), history = { revision: 0, archive: emptyTransactionArchive() }, value = draft();
  const props = { draft: value, workspace, history, businessRevision: 0, disabled: false, onChange: vi.fn(), saveDocument: vi.fn() };
  await act(async () => root.render(<InvestorProposalPanel {...props} />)); await click('Preview investor proposal');
  await act(async () => root.render(<InvestorProposalPanel {...props} workspace={structuredClone(workspace)} draft={structuredClone(value)} businessRevision={1} />));
  expect(container.querySelector('iframe')).not.toBeNull();
  await act(async () => root.render(<InvestorProposalPanel {...props} draft={{ ...value, investorName: 'Another investor' }} />));
  expect(container.querySelector('iframe')).toBeNull();
});
it('requires complete historical cost evidence and an owner expense review instead of fabricating a profit baseline', async () => {
  const workspace = emptyBusinessWorkspace(), history = { revision: 1, archive: emptyTransactionArchive() };
  const report = calculateBusinessReport(fixture.customerReceipts, [], workspace, '2026-08-01', '2026-10-31');
  let evidence: BusinessReport = { ...report, metrics: { ...report.metrics, savedCost: null, unknownCostReceipts: 1 } };
  const calculate = vi.fn(async () => evidence);
  function Harness() { const [value, setValue] = useState<InvestorProposalDraft>({ ...draft(), source: 'history' }); return <InvestorProposalPanel draft={value} workspace={workspace} history={history} businessRevision={1} disabled={false} onChange={setValue} saveDocument={vi.fn()} calculate={calculate} />; }
  await act(async () => root.render(<Harness />)); await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(container.textContent).toContain('Historical sale costs are incomplete'); expect(button('Preview investor proposal').disabled).toBe(true);
  evidence = report;
  await input('Historical from date', '2026-09-01'); await input('Historical from date', '2026-08-01');
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(container.textContent).toContain('review of operating expenses');
  await act(async () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  expect(button('Preview investor proposal').disabled).toBe(false);
});
