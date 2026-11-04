import { describe, expect, it } from 'vitest';
import { emptyBusinessWorkspace, validateBusinessWorkspace, type BusinessDocument, type BusinessLedgerEntry } from '../../domain/businessInsights';
import type { SavedCustomerReceipt } from '../../ui/transactions/models';
import { calculateBusinessReport } from './businessReports';
import { forecastBusiness } from './businessForecast';
import { businessDocumentCsv, businessDocumentPack, businessDocumentWord, investorReadiness, renderBusinessDocument } from './businessDocuments';
import { unzipSync, strFromU8 } from 'fflate';

const receipt = (change: Partial<SavedCustomerReceipt> = {}): SavedCustomerReceipt => ({
  id: 'sale', reference: 'CR-1', createdAt: '2026-10-31T16:00:00Z', revision: '1', businessName: 'My Lovely Craft', customerName: 'Alex', customerContact: '',
  paymentMethod: 'Cash', notes: '', items: [{ productId: 'P', name: 'Bear P (1pcs)', quantity: 2, unitPrice: 30, amount: 60, sourceLabel: 'Single', totalProductCost: 20 }],
  subtotal: 60, discount: 2, total: 58, amountPaid: 100, balance: 0, change: 42, receipt: { title: 'Receipt', text: 'Saved receipt' }, ...change,
});
const ledger = (id: string, amount: number, kind: BusinessLedgerEntry['kind'] = 'operating-expense', date = '2026-11-01'): BusinessLedgerEntry => ({ id, amount, kind, date, cashDate: date, category: 'Rent', description: id, paid: true, reference: '' });
export function documentFixture(kind: BusinessDocument['kind'] = 'investor-summary'): BusinessDocument {
  const workspace = emptyBusinessWorkspace('2026-11-01');
  return { id: 'document-1', kind, title: 'Business report', generatedAt: '2026-11-04T00:00:00Z', profile: workspace.profile, historyRevision: 1, businessRevision: 2,
    report: calculateBusinessReport([receipt()], [], workspace, '2026-11-01', '2026-11-30'), scenario: kind === 'business-report' ? null : workspace.scenarios[1], proposal: null };
}
describe('Business reporting evidence and currency', () => {
  it('uses SGT sale dates, excludes overpayment/change, and keeps delayed cash separate from sales', () => {
    const workspace = emptyBusinessWorkspace('2026-10-01');
    const sale = receipt();
    const entries = [{ receiptId: sale.id, direction: 'credit' as const, amount: 58, date: '2026-12-01', notes: '', updatedAt: sale.createdAt }];
    const november = calculateBusinessReport([sale], entries, workspace, '2026-11-01', '2026-11-30');
    expect(november.metrics).toMatchObject({ sales: 58, cashIn: 0, cashNet: 0, grossProfit: 38, units: 2 });
    expect(november.sources[0].date).toBe('2026-11-01');
    const december = calculateBusinessReport([sale], entries, workspace, '2026-12-01', '2026-12-31');
    expect(december.metrics).toMatchObject({ sales: 0, cashIn: 58 });
    expect(calculateBusinessReport([sale], [], workspace, '2026-11-01', '2026-11-30').metrics.cashIn).toBe(58);
  });
  it('recognizes unpaid operating expenses while funding, inventory and equipment affect cash only', () => {
    const workspace = emptyBusinessWorkspace('2026-10-01');
    workspace.profile.openingCash = 100;
    workspace.ledger = [ledger('October expense', 10, 'operating-expense', '2026-10-15'), ledger('Rent', 5),
      { ...ledger('Unpaid utilities', 3), paid: false }, ledger('Equipment', 20, 'equipment-purchase'), ledger('Stock', 4, 'inventory-purchase'),
      ledger('Funding', 50, 'funding-in'), ledger('Owner funds', 7, 'owner-in'), ledger('Loan principal', 2, 'funding-out')];
    const report = calculateBusinessReport([receipt()], [], workspace, '2026-11-01', '2026-11-30');
    expect(report.metrics).toMatchObject({ sales: 58, operatingExpenses: 8, grossProfit: 38, indicativeResult: 30, cashIn: 115, cashOut: 31, cashNet: 84, openingCash: 90, closingCash: 174 });
    expect(report.ledgerSources).toHaveLength(7);
  });
  it('uses an independent cash date for a paid invoice and does not backdate its payment', () => {
    const workspace = emptyBusinessWorkspace('2026-10-01');
    workspace.ledger = [{ ...ledger('October rent', 30, 'operating-expense', '2026-10-20'), cashDate: '2026-11-02' }];
    expect(calculateBusinessReport([], [], workspace, '2026-10-01', '2026-10-31').metrics).toMatchObject({ operatingExpenses: 30, cashOut: 0 });
    const later = calculateBusinessReport([], [], workspace, '2026-11-01', '2026-11-30');
    expect(later.metrics).toMatchObject({ operatingExpenses: 0, cashOut: 30 });
    expect(later.ledgerSources).toHaveLength(1);
  });
  it('keeps unknown costs and unavailable comparisons explicit; does not infer a running receivable balance', () => {
    const workspace = emptyBusinessWorkspace('2026-11-01');
    workspace.profile.openingCash = 100;
    const unknown = receipt({ items: [{ ...receipt().items[0], totalProductCost: null }], balance: 20 });
    const result = calculateBusinessReport([unknown], [], workspace, '2026-10-01', '2026-11-30');
    expect(result.metrics).toMatchObject({ savedCost: null, grossProfit: null, indicativeResult: null, unknownCostReceipts: 1, growthPercent: null, openingCash: null, closingCash: null, balanceAtSale: 20 });
    expect(result.products[0].grossProfit).toBeNull();
  });
  it('allocates discounts in exact cents across products, preserving the receipt total', () => {
    const sale = receipt({ subtotal: 3, discount: .01, total: 2.99, items: ['A', 'B', 'C'].map(productId => ({ productId, name: productId, quantity: 1, unitPrice: 1, amount: 1, sourceLabel: '', totalProductCost: 0 })) });
    const report = calculateBusinessReport([sale], [], emptyBusinessWorkspace(), '2026-11-01', '2026-11-30');
    expect(report.products.reduce((sum, p) => sum + Math.round(p.sales * 100), 0)).toBe(299);
    expect(report.metrics.savedCost).toBe(0);
  });
  it('compares an equal-length preceding period, keeps refunds in cash, and includes zero-activity months', () => {
    const workspace = emptyBusinessWorkspace();
    const prior = receipt({ id: 'prior', createdAt: '2026-10-15T00:00:00Z', total: 29 });
    const result = calculateBusinessReport([prior, receipt()], [{ receiptId: 'sale', date: '2026-11-05', direction: 'debit', amount: 12, notes: 'refund', updatedAt: receipt().createdAt }], workspace, '2026-11-01', '2026-11-30');
    expect(result.metrics).toMatchObject({ previousSales: 29, growthPercent: 100, cashIn: 0, cashOut: 12 });
    expect(result.previousFrom).toBe('2026-10-02');
    expect(calculateBusinessReport([], [], workspace, '2026-01-01', '2026-12-31').months).toHaveLength(12);
    expect(() => calculateBusinessReport([], [], workspace, '2026-02-30', '2026-12-31')).toThrow('valid');
    expect(() => calculateBusinessReport([], [], workspace, '2000-01-01', '2026-12-31')).toThrow('10 years');
  });
});
describe('Scenario forecasts', () => {
  it('caps growth to entered capacity, calculates break-even and includes the initial funding gap', () => {
    const scenario = { ...emptyBusinessWorkspace().scenarios[0], startMonth: '2026-11', monthlyUnits: 10, monthlyCapacity: 15, averageUnitPrice: 10, unitVariableCost: 4, monthlyFixedExpenses: 30,
      monthlyGrowthPercent: 100, openingCash: 0, fundingAmount: 20, upfrontInvestment: 100 };
    const f = forecastBusiness(scenario);
    expect(f.rows).toHaveLength(12); expect(f.rows[0]).toMatchObject({ month: '2026-11', units: 10, revenue: 100, operatingResult: 30, cash: -50 });
    expect(f.rows[1].units).toBe(15); expect(f.rows[2].month).toBe('2027-01');
    expect(f).toMatchObject({ breakEvenUnits: 5, capacityConstrained: true, additionalFunding: 80, revenue: 1750, operatingResult: 690, endingCash: 610 });
  });
  it('does not invent a break-even point without positive unit contribution, and rejects unsafe assumptions', () => {
    const s = emptyBusinessWorkspace().scenarios[0];
    expect(forecastBusiness(s).breakEvenUnits).toBeNull();
    expect(forecastBusiness({ ...s, monthlyUnits: 5, monthlyCapacity: 0 }).rows.every(r => r.units === 0)).toBe(true);
    expect(() => forecastBusiness({ ...s, monthlyGrowthPercent: 101 })).toThrow('valid scenario');
    expect(() => forecastBusiness({ ...s, averageUnitPrice: NaN })).toThrow('valid scenario');
    expect(() => forecastBusiness({ ...s, monthlyUnits: 1000000, monthlyCapacity: 1000000, averageUnitPrice: 1e9 })).toThrow('supported range');
  });
});
describe('Business documents and imported source validation', () => {
  it('escapes content, discloses missing evidence, and produces a real editable DOCX package', async () => {
    const d = documentFixture(); d.profile.name = '<script>alert(1)</script>'; d.profile.description = 'Handmade gifts & souvenirs';
    const html = renderBusinessDocument(d);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Preparation gaps');
    expect(html).toContain('not audited net profit'); expect(html).toContain("default-src 'none'");
    const blob = await businessDocumentWord(d), files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(files['word/document.xml']).toBeDefined();
    expect(strFromU8(files['word/document.xml'])).toContain('Handmade gifts &amp; souvenirs');
  });
  it('creates a dated review pack with figures, assumptions and editable documents', async () => {
    const blob = await businessDocumentPack(documentFixture());
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(['README.txt', 'document.docx', 'document.html', 'financial-figures.csv', 'source-snapshot.json']);
    expect(JSON.parse(strFromU8(files['source-snapshot.json'])).document.businessRevision).toBe(2);
  });
  it('prevents spreadsheet formula injection and never exposes internal costs in customer proposals', () => {
    const workspace = emptyBusinessWorkspace();
    const proposal: BusinessDocument = { ...documentFixture(), kind: 'proposal', report: null, scenario: null,
      proposal: { ...workspace.proposal, items: [{ productId: '=HYPERLINK("x")', name: 'Gift', quantity: 3, unitPrice: 5, priceSource: '', tierId: '' }], pictures: {} } };
    expect(businessDocumentCsv(proposal)).toContain("'=HYPERLINK");
    expect(renderBusinessDocument(proposal)).not.toContain('Estimated gross profit');
    expect(renderBusinessDocument(proposal)).not.toContain('saved product cost');
  });
  it('rejects malformed imported records, duplicate entries, invalid dates, and executable image sources', () => {
    const workspace = emptyBusinessWorkspace(); workspace.ledger = [ledger('rent', 1), ledger('rent', 1)];
    expect(() => validateBusinessWorkspace(workspace)).toThrow('ledger');
    workspace.ledger = [{ ...ledger('rent', 1), cashDate: '2026-02-30' }];
    expect(() => validateBusinessWorkspace(workspace)).toThrow('valid dates');
    workspace.ledger = []; workspace.documents = [{ ...documentFixture(), kind: 'proposal', report: null, scenario: null,
      proposal: { ...workspace.proposal, items: [{ productId: 'P', name: 'Product', quantity: 1, unitPrice: 1, priceSource: '', tierId: '' }], pictures: { P: 'javascript:alert(1)' } } }];
    expect(() => validateBusinessWorkspace(workspace)).toThrow('invalid product pictures');
    expect(investorReadiness(workspace.profile, false, 1).length).toBeGreaterThan(5);
  });
});
