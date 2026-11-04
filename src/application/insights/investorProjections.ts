import {
  validateInvestorProposalSnapshot, type BusinessReport, type ForecastScenario,
  type InvestmentBaseline, type InvestorProjectionBasis, type InvestorProposalDraft,
  type InvestorProposalSnapshot, type InvestorScenarioAssumption, type InvestorScenarioId,
} from '../../domain/businessInsights';
import { addMoney, cents } from './businessReports';
import { forecastBusiness } from './businessForecast';

export const INVESTOR_SCENARIO_LABELS: Record<InvestorScenarioId, string> = {
  conservative: 'Conservative', moderate: 'Moderate', optimistic: 'Optimistic',
};
export const INVESTOR_CONDITIONS = 'All earnings and recovery dates are estimates, not guaranteed payments. Payments depend on actual distributable profit, available cash, and a separate written agreement. Losses within the modeled term are recovered before reserves and investor distributions resume. No payment is projected in a loss-making month. The payout cap includes capital recovery and gain; there is no additional automatic refund of the original investment. Unrecovered capital remains at risk at the end of the term. An investor profit share is not a stated ownership percentage. Tax treatment, approval of accounts, termination and any other rights must be agreed separately. Saving or generating this proposal records no capital contribution, expense, investor balance or payment.';
export const INVESTOR_MODEL_NOTES = 'Reserve is set aside first from positive profit after any earlier modeled losses are recovered. The investor receives the configured percentage of the remainder, limited by the remaining cumulative payout cap. The business retains the reserve, its remaining share, recovered losses, and any entitlement above the cap. Monthly payments are modeled at month end; annual figures are consecutive 12-month blocks from the start month. The last block may contain fewer than 12 months. Average monthly payout is the total divided by the entire term, including months with no payment. Investment capital is not counted as sales or profit, and retained reserves do not automatically create additional sales. Any effect of funding on production or demand must be entered in the assumptions. This proposal models one investor independently; existing losses and other investor obligations are not imported automatically.';

export interface InvestorMonth {
  month: string; number: number; sales: number; productCost: number; operatingExpenses: number;
  profit: number; lossOffset: number; lossCarryForward: number; reserve: number;
  distributableProfit: number; investorPayout: number; businessShare: number;
  retainedByBusiness: number; cumulativePayout: number;
}
export interface InvestorYear { year: number; from: string; to: string; months: number; profit: number; reserve: number; investorPayout: number; retainedByBusiness: number }
export interface InvestorScenarioProjection {
  id: InvestorScenarioId; name: string; rows: InvestorMonth[]; years: InvestorYear[];
  totalPayout: number; averageMonthlyPayout: number; firstMonthPayout: number; firstYearPayout: number;
  netGain: number; gainPercent: number; recoveredCapital: number; unrecoveredCapital: number;
  recoveryMonths: number | null; recoveryMonth: string | null; capReachedMonths: number | null;
  totalReserve: number; totalBusinessRetained: number; totalProfit: number; capacityConstrained: boolean;
}

function monthName(start: string, index: number) {
  const [year, month] = start.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + index, 1)).toISOString().slice(0, 7);
}
/** Round percentages in cents using integers, including the final partial capped payment. */
function percentageOf(amount: number, percent: number) {
  const basisPoints = Math.round(percent * 100);
  const result = Number((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n);
  return addMoney(0, result);
}
export function historicalInvestorBasis(report: BusinessReport): Extract<InvestorProjectionBasis, { kind: 'history' }> {
  if (!report.from.endsWith('-01') || new Date(Date.parse(`${report.to}T00:00:00Z`) + 86400000).getUTCDate() !== 1) {
    throw new Error('Choose complete calendar months for a historical baseline. Partial months are not annualized automatically.');
  }
  if (!report.metrics.orders) throw new Error('No saved sales exist in this historical period. Choose another period or enter manual assumptions.');
  if (report.metrics.savedCost === null || report.metrics.unknownCostReceipts) throw new Error('Historical sale costs are incomplete. Use reviewed manual assumptions or another period with complete saved cost evidence.');
  const months = report.months.length;
  return { kind: 'history', baseline: {
    monthlySales: Math.round(cents(report.metrics.sales) / months) / 100,
    monthlyProductCost: Math.round(cents(report.metrics.savedCost) / months) / 100,
    monthlyOperatingExpenses: Math.round(cents(report.metrics.operatingExpenses) / months) / 100,
  }, evidence: { from: report.from, to: report.to, months, receipts: report.metrics.orders, ledgerEntries: report.metrics.ledgerEntries,
    sales: report.metrics.sales, savedCost: report.metrics.savedCost, operatingExpenses: report.metrics.operatingExpenses } };
}
export function createInvestorSnapshot(draft: InvestorProposalDraft, report: BusinessReport | null, scenarios: ForecastScenario[]): InvestorProposalSnapshot {
  let basis: InvestorProjectionBasis;
  if (draft.source === 'history') {
    if (!report || report.from !== draft.historyFrom || report.to !== draft.historyTo) throw new Error('Wait for the selected historical period to finish loading.');
    basis = historicalInvestorBasis(report);
  } else if (draft.source === 'forecast') {
    const scenario = scenarios.find(s => s.id === draft.forecastScenarioId);
    if (!scenario) throw new Error('Choose an existing business forecast scenario.');
    basis = { kind: 'forecast', scenario: structuredClone(scenario) };
  } else basis = { kind: 'manual', baseline: { ...draft.manual } };
  const snapshot: InvestorProposalSnapshot = { modelVersion: 1, draft: structuredClone(draft), basis };
  validateInvestorProposalSnapshot(snapshot);
  return snapshot;
}

function sourceRows(snapshot: InvestorProposalSnapshot, assumption: InvestorScenarioAssumption) {
  const { draft, basis } = snapshot;
  if (basis.kind === 'forecast') {
    const forecast = forecastBusiness({ ...basis.scenario, startMonth: draft.startMonth,
      monthlyUnits: Math.round(basis.scenario.monthlyUnits * assumption.salesPercent / 100),
      unitVariableCost: percentageOf(cents(basis.scenario.unitVariableCost), assumption.costPercent) / 100,
      monthlyGrowthPercent: assumption.monthlyGrowthPercent,
    }, draft.durationMonths);
    return { constrained: forecast.capacityConstrained, rows: forecast.rows.map(row => ({ month: row.month,
      sales: cents(row.revenue), productCost: cents(row.variableCost), operatingExpenses: cents(row.fixedCost), profit: cents(row.operatingResult) })) };
  }
  const b: InvestmentBaseline = basis.baseline;
  const initialSales = percentageOf(cents(b.monthlySales), assumption.salesPercent);
  const initialCost = percentageOf(percentageOf(cents(b.monthlyProductCost), assumption.salesPercent), assumption.costPercent);
  const operatingExpenses = cents(b.monthlyOperatingExpenses);
  const rows = Array.from({ length: draft.durationMonths }, (_, index) => {
    const growth = Math.pow(1 + assumption.monthlyGrowthPercent / 100, index);
    const sales = addMoney(0, Math.round(initialSales * growth)), productCost = addMoney(0, Math.round(initialCost * growth));
    return { month: monthName(draft.startMonth, index), sales, productCost, operatingExpenses, profit: addMoney(sales - productCost, -operatingExpenses) };
  });
  return { constrained: false, rows };
}

/** Model version 1: reserve first, prior modeled losses recovered, capped monthly distributions. No ledger writes. */
export function projectInvestorProposal(snapshot: InvestorProposalSnapshot): InvestorScenarioProjection[] {
  validateInvestorProposalSnapshot(snapshot);
  const d = snapshot.draft, investment = cents(d.investmentAmount), cap = cents(d.maximumPayout);
  return d.scenarios.map(assumption => {
    const source = sourceRows(snapshot, assumption), rows: InvestorMonth[] = [], years: InvestorYear[] = [];
    let lossCarry = 0, cumulative = 0, totalReserve = 0, businessRetained = 0, totalProfit = 0;
    let recoveryMonths: number | null = null, capReachedMonths: number | null = null;
    source.rows.forEach((row, index) => {
      let eligible = 0, lossOffset = 0;
      if (row.profit < 0) lossCarry = addMoney(lossCarry, -row.profit);
      else { lossOffset = Math.min(lossCarry, row.profit); lossCarry -= lossOffset; eligible = row.profit - lossOffset; }
      const reserve = percentageOf(eligible, d.reservePercent), distributable = eligible - reserve;
      const investorPayout = Math.min(percentageOf(distributable, d.investorSharePercent), cap - cumulative);
      const retained = addMoney(row.profit, -investorPayout);
      cumulative = addMoney(cumulative, investorPayout); totalReserve = addMoney(totalReserve, reserve);
      businessRetained = addMoney(businessRetained, retained); totalProfit = addMoney(totalProfit, row.profit);
      if (recoveryMonths === null && cumulative >= investment) recoveryMonths = index + 1;
      if (capReachedMonths === null && cumulative >= cap) capReachedMonths = index + 1;
      rows.push({ month: row.month, number: index + 1, sales: row.sales / 100, productCost: row.productCost / 100, operatingExpenses: row.operatingExpenses / 100,
        profit: row.profit / 100, lossOffset: lossOffset / 100, lossCarryForward: lossCarry / 100, reserve: reserve / 100,
        distributableProfit: distributable / 100, investorPayout: investorPayout / 100, businessShare: (distributable - investorPayout) / 100,
        retainedByBusiness: retained / 100, cumulativePayout: cumulative / 100 });
    });
    for (let start = 0; start < rows.length; start += 12) {
      const yearRows = rows.slice(start, start + 12);
      const sum = (key: 'profit' | 'reserve' | 'investorPayout' | 'retainedByBusiness') => yearRows.reduce((total, row) => addMoney(total, cents(row[key])), 0) / 100;
      years.push({ year: start / 12 + 1, from: yearRows[0].month, to: yearRows[yearRows.length - 1].month, months: yearRows.length,
        profit: sum('profit'), reserve: sum('reserve'), investorPayout: sum('investorPayout'), retainedByBusiness: sum('retainedByBusiness') });
    }
    return { id: assumption.id, name: INVESTOR_SCENARIO_LABELS[assumption.id], rows, years,
      totalPayout: cumulative / 100, averageMonthlyPayout: Math.round(cumulative / d.durationMonths) / 100,
      firstMonthPayout: rows[0].investorPayout, firstYearPayout: years[0].investorPayout,
      netGain: (cumulative - investment) / 100, gainPercent: (cumulative - investment) / investment * 100,
      recoveredCapital: Math.min(investment, cumulative) / 100, unrecoveredCapital: Math.max(0, investment - cumulative) / 100,
      recoveryMonths, recoveryMonth: recoveryMonths === null ? null : rows[recoveryMonths - 1].month, capReachedMonths,
      totalReserve: totalReserve / 100, totalBusinessRetained: businessRetained / 100, totalProfit: totalProfit / 100,
      capacityConstrained: source.constrained };
  });
}
