import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  emptyBusinessWorkspace, emptyInvestorProposal, validateBusinessWorkspace, validateInvestorProposalSnapshot,
  type BusinessDocument, type BusinessReport, type InvestorProposalDraft, type InvestorProposalSnapshot,
} from '../../domain/businessInsights';
import { businessDocumentCsv, businessDocumentWord, renderBusinessDocument } from './businessDocuments';
import { createInvestorSnapshot, historicalInvestorBasis, projectInvestorProposal } from './investorProjections';
import { calculateBusinessReport } from './businessReports';
import { forecastBusiness } from './businessForecast';
import history from '../../ui/transactions/__fixtures__/mobile-transactions.json';

function draft(change: Partial<InvestorProposalDraft> = {}): InvestorProposalDraft {
  return { ...emptyInvestorProposal('2026-11-04'), investorName: 'Alex Santos', investmentAmount: 10000, maximumPayout: 14000,
    sourceNotes: 'Owner assumptions; product costs and operating expenses reviewed.',
    manual: { monthlySales: 20000, monthlyProductCost: 8000, monthlyOperatingExpenses: 2000 }, ...change };
}
function manual(change: Partial<InvestorProposalDraft> = {}): InvestorProposalSnapshot {
  return createInvestorSnapshot(draft(change), null, []);
}
function moderate(snapshot: InvestorProposalSnapshot) { return projectInvestorProposal(snapshot)[1]; }
function document(snapshot = manual()): BusinessDocument {
  return { id: 'investor-doc', kind: 'investor-proposal', title: 'Investment proposal for Alex Santos', generatedAt: '2026-11-04T00:00:00Z',
    profile: emptyBusinessWorkspace().profile, historyRevision: 2, businessRevision: 5, report: null, scenario: null, proposal: null, investment: snapshot };
}
describe('Investor proposal distribution model v1', () => {
  it('sets the reserve aside first, recovers capital from distributions, stops at the cumulative cap and includes zero months in averages', () => {
    const result = moderate(manual());
    expect(result.rows[0]).toMatchObject({ profit: 10000, reserve: 3000, distributableProfit: 7000, investorPayout: 1750, businessShare: 5250, retainedByBusiness: 8250 });
    expect(result).toMatchObject({ totalPayout: 14000, netGain: 4000, gainPercent: 40, recoveredCapital: 10000, unrecoveredCapital: 0,
      recoveryMonths: 6, recoveryMonth: '2027-04', capReachedMonths: 8, averageMonthlyPayout: 583.33, firstYearPayout: 14000 });
    expect(result.rows.slice(8).every(r => r.investorPayout === 0)).toBe(true);
    expect(result.years.map(y => y.investorPayout)).toEqual([14000, 0]);
    expect(result.totalBusinessRetained + result.totalPayout).toBe(result.totalProfit);
  });
  it('clips the final payment exactly and shows different scenario timing without inventing extra payouts', () => {
    const results = projectInvestorProposal(manual());
    expect(results[0]).toMatchObject({ firstMonthPayout: 1330, recoveryMonths: 8, capReachedMonths: 11 });
    expect(results[0].rows[10].investorPayout).toBe(700);
    expect(results[2]).toMatchObject({ firstMonthPayout: 2170, recoveryMonths: 5, capReachedMonths: 7 });
    expect(results[2].rows[6].investorPayout).toBe(980);
    expect(results.every(r => r.totalPayout === 14000)).toBe(true);
  });
  it('reports unrecovered capital and negative net gain at term end rather than promising repayment', () => {
    const results = projectInvestorProposal(manual({ durationMonths: 6 }));
    expect(results[0]).toMatchObject({ totalPayout: 7980, netGain: -2020, unrecoveredCapital: 2020, recoveryMonths: null });
    expect(results[1].totalPayout).toBe(10500);
    expect(results[2].totalPayout).toBe(13020);
    const loss = moderate(manual({ manual: { monthlySales: 100, monthlyProductCost: 90, monthlyOperatingExpenses: 20 } }));
    expect(loss.totalPayout).toBe(0); expect(loss.netGain).toBe(-10000); expect(loss.totalReserve).toBe(0); expect(loss.rows[23].lossCarryForward).toBe(240);
  });
  it('recovers modeled earlier losses before allocating reserves or payouts', () => {
    const s = manual({ durationMonths: 4, investorSharePercent: 100, reservePercent: 0, manual: { monthlySales: 100, monthlyProductCost: 0, monthlyOperatingExpenses: 150 } });
    s.draft.scenarios[1].monthlyGrowthPercent = 100;
    const rows = moderate(s).rows;
    expect(rows.map(r => r.profit)).toEqual([-50, 50, 250, 650]);
    expect(rows[1]).toMatchObject({ lossOffset: 50, lossCarryForward: 0, investorPayout: 0 });
    expect(rows[2].investorPayout).toBe(250);
  });
  it('handles zero/full reserves, zero shares, and an exact capital-only cap', () => {
    expect(moderate(manual({ reservePercent: 100 })).totalPayout).toBe(0);
    expect(moderate(manual({ investorSharePercent: 0 })).recoveryMonths).toBeNull();
    expect(moderate(manual({ maximumPayout: 10000 })).netGain).toBe(0);
    const result = moderate(manual({ reservePercent: 0, investorSharePercent: 100, durationMonths: 1 }));
    expect(result.totalPayout).toBe(10000); expect(result.recoveryMonths).toBe(1); expect(result.rows[0].retainedByBusiness).toBe(0);
  });
  it('rounds fractional percentages in cents and preserves every cent across the cap', () => {
    const result = moderate(manual({ investmentAmount: .01, maximumPayout: .02, durationMonths: 3, reservePercent: 33.33, investorSharePercent: 50,
      manual: { monthlySales: .03, monthlyProductCost: 0, monthlyOperatingExpenses: 0 } }));
    expect(result.rows.map(r => r.investorPayout)).toEqual([.01, .01, 0]);
    expect(result).toMatchObject({ totalPayout: .02, totalReserve: .03, totalBusinessRetained: .07, totalProfit: .09, recoveryMonths: 1 });
  });
  it('groups annual values by contract year and includes partial final years and month-end boundaries', () => {
    const result = moderate(manual({ durationMonths: 13, startMonth: '2026-12' }));
    expect(result.years.map(y => [y.months, y.from, y.to])).toEqual([[12, '2026-12', '2027-11'], [1, '2027-12', '2027-12']]);
    expect(result.rows.reduce((s, r) => s + Math.round(r.investorPayout * 100), 0)).toBe(Math.round(result.totalPayout * 100));
  });
});
describe('Evidence and existing forecasting reuse', () => {
  function report(): BusinessReport {
    const workspace = emptyBusinessWorkspace('2026-08-01');
    workspace.ledger.push({ id: 'rent', date: '2026-09-01', cashDate: '2026-09-01', kind: 'operating-expense', category: 'Rent', description: 'Rent', amount: 3, paid: true, reference: '' });
    return calculateBusinessReport(history.customerReceipts, [], workspace, '2026-08-01', '2026-10-31');
  }
  it('uses saved receipt costs and complete months including months without sales, with explicit expense review', () => {
    const r = report(), basis = historicalInvestorBasis(r);
    expect(basis.baseline).toEqual({ monthlySales: 19.33, monthlyProductCost: 14.67, monthlyOperatingExpenses: 1 });
    expect(basis.evidence).toMatchObject({ months: 3, receipts: 1, sales: 58, savedCost: 44, operatingExpenses: 3 });
    expect(() => createInvestorSnapshot(draft({ source: 'history', expensesReviewed: false }), r, [])).toThrow('review');
    expect(createInvestorSnapshot(draft({ source: 'history', expensesReviewed: true }), r, []).basis).toEqual(basis);
  });
  it('does not fill missing historical costs or annualize partial months, and does not treat quotations as sales', () => {
    expect(() => historicalInvestorBasis({ ...report(), from: '2026-08-02' })).toThrow('complete calendar');
    const missing = report(); missing.metrics.savedCost = null; missing.metrics.unknownCostReceipts = 1;
    expect(() => historicalInvestorBasis(missing)).toThrow('incomplete');
    const empty = calculateBusinessReport([], [], emptyBusinessWorkspace(), '2026-08-01', '2026-10-31');
    expect(() => historicalInvestorBasis(empty)).toThrow('No saved sales');
  });
  it('reuses the existing unit-cost forecast and its capacity limit for the configured investment duration', () => {
    const scenario = { ...emptyBusinessWorkspace().scenarios[1], monthlyUnits: 10, monthlyCapacity: 12, averageUnitPrice: 100, unitVariableCost: 40, monthlyFixedExpenses: 100 };
    const snapshot = createInvestorSnapshot(draft({ source: 'forecast', durationMonths: 24 }), null, [scenario]);
    snapshot.draft.scenarios.forEach(s => { s.salesPercent = 100; s.monthlyGrowthPercent = 100; });
    const expected = forecastBusiness({ ...scenario, startMonth: snapshot.draft.startMonth, monthlyGrowthPercent: 100 }, 24);
    const result = moderate(snapshot);
    expect(result.rows.map(r => r.profit)).toEqual(expected.rows.map(r => r.operatingResult));
    expect(result.capacityConstrained).toBe(true); expect(forecastBusiness(scenario).rows).toHaveLength(12);
  });
});
describe('Document safety, validation and compatibility', () => {
  it('validates terms, rejects unsupported versions and prevents unsafe growth totals', () => {
    for (const change of [{ investmentAmount: 0 }, { maximumPayout: 9999 }, { investorSharePercent: 101 }, { reservePercent: -1 }, { durationMonths: 121 }, { investorName: '' }, { sourceNotes: '' }, { startMonth: '2026-10' }]) {
      expect(() => manual(change)).toThrow();
    }
    expect(() => validateInvestorProposalSnapshot({ ...manual(), modelVersion: 2 })).toThrow('Unsupported');
    const s = manual({ durationMonths: 120 }); s.draft.scenarios[1].monthlyGrowthPercent = 100;
    expect(() => projectInvestorProposal(s)).toThrow('supported range');
  });
  it('accepts pre-feature business backups without creating ledger or transaction entries', () => {
    const workspace = emptyBusinessWorkspace(); delete workspace.investorProposal;
    expect(validateBusinessWorkspace(workspace)).toBe(workspace);
    workspace.investorProposal = draft(); workspace.documents.push(document());
    const before = structuredClone(workspace.ledger);
    validateBusinessWorkspace(workspace); projectInvestorProposal(workspace.documents[0].investment!);
    expect(workspace.ledger).toEqual(before);
  });
  it('renders investor-friendly monthly/annual documents, escapes investor content and exports real Word and CSV files', async () => {
    const d = document(manual({ investorName: '<script>bad</script> María' }));
    const html = renderBusinessDocument(d);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;bad');
    expect(html).toContain('not guaranteed payments'); expect(html).toContain('No investor account'); expect(html).toContain('Monthly estimated payout schedule');
    expect(html).toContain('Annual estimates'); expect(html).toContain('Capital recovery');
    const files = unzipSync(new Uint8Array(await (await businessDocumentWord(d)).arrayBuffer()));
    expect(strFromU8(files['word/document.xml'])).toContain('Maximum total payout');
    expect(businessDocumentCsv(d)).toContain('Prior losses absorbed');
  });
});
