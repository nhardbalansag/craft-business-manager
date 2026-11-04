import type { BusinessDocument } from '../../domain/businessInsights';
import type { BusinessDocumentBlock } from './businessDocuments';
import { INVESTOR_CONDITIONS, INVESTOR_MODEL_NOTES, projectInvestorProposal } from './investorProjections';

export function investorDocumentBlocks(document: BusinessDocument, money: (n: number | null) => string): BusinessDocumentBlock[] {
  const snapshot = document.investment!, d = snapshot.draft, basis = snapshot.basis;
  const cases = projectInvestorProposal(snapshot);
  const text = (value: string, heading = false): BusinessDocumentBlock => ({ kind: 'text', text: value, heading });
  const table = (headers: string[], rows: string[][]): BusinessDocumentBlock => ({ kind: 'table', headers, rows });
  const blocks: BusinessDocumentBlock[] = [
    text(`Prepared for ${d.investorName} · Proposal date ${d.proposalDate} · PHP`),
    text('Proposed investment', true),
    text(document.profile.description || 'Business overview: please refer to the owner for details.'),
    table(['Capital contribution', 'Proposed term', 'Maximum total payout'], [[money(d.investmentAmount), `${d.durationMonths} months from ${d.startMonth}`, money(d.maximumPayout)]]),
    text(`Investor share: ${d.investorSharePercent}% of distributable profit after the ${d.reservePercent}% business reserve. The total payout cap includes capital recovery and gain. The maximum possible net gain under this cap is ${money(d.maximumPayout - d.investmentAmount)}; reaching it is not assured.`),
    text(`Use of proposed investment: ${d.purpose || 'To be agreed with the owner before investing.'}`),
    text('Estimated outcomes · not guaranteed', true),
    table(['Scenario', 'Average monthly payout', 'First year payout', 'Total term payout', 'Net gain after capital', 'Capital recovery'], cases.map(c => [c.name,
      money(c.averageMonthlyPayout), `${money(c.firstYearPayout)}\n${c.years[0].months} months`, money(c.totalPayout), money(c.netGain), c.recoveryMonths === null ? 'Not recovered within term' : `Month ${c.recoveryMonths}\n${c.recoveryMonth}`])),
    text('Payouts include recovery of the original contribution. Net gain equals total investor payouts minus the original investment and may be negative. Average monthly payouts are not a fixed monthly entitlement. The full schedule shows when payments stop at the cap or during losses.'),
    text('Where the figures come from', true),
  ];
  if (basis.kind === 'history') {
    const e = basis.evidence;
    blocks.push(text(`Historical inputs: ${e.from} to ${e.to}, covering ${e.months} complete calendar month(s), ${e.receipts} saved receipts and ${e.ledgerEntries} expense/cash entries. Sales: ${money(e.sales)}; saved product costs: ${money(e.savedCost)}; recorded operating expenses: ${money(e.operatingExpenses)}. Zero-activity months within the period are included in the average.`));
    if (e.months < 3) blocks.push(text('Limited history: fewer than three complete months support this estimate. Seasonal demand and future performance may differ significantly.'));
  } else if (basis.kind === 'forecast') {
    const s = basis.scenario;
    blocks.push(text(`Owner-entered business forecast: ${s.name}. Starting demand ${s.monthlyUnits} units/month; selling price ${money(s.averageUnitPrice)}/unit; variable cost ${money(s.unitVariableCost)}/unit; fixed expenses ${money(s.monthlyFixedExpenses)}/month; capacity ${s.monthlyCapacity} units/month. These are planning inputs, not recorded sales. The proposal uses its own start month and scenario adjustments.`));
  } else blocks.push(text('Manual assumptions supplied by the owner because business history is insufficient or a different operating plan is proposed.'));
  if (basis.kind !== 'forecast') blocks.push(table(['Baseline monthly sales', 'Baseline monthly product costs', 'Monthly operating expenses'], [[money(basis.baseline.monthlySales), money(basis.baseline.monthlyProductCost), money(basis.baseline.monthlyOperatingExpenses)]]),
    text('Sales-volume factors scale sales and product costs together. Product-cost factors change cost per equivalent volume. Operating expenses remain fixed; the entered monthly growth compounds volume. No production-capacity limit is assumed in this model; confirm that the projected orders can be fulfilled.'));
  blocks.push(text(`Owner assumptions and record coverage: ${d.sourceNotes}`),
    table(['Scenario', 'Sales-volume factor', 'Product-cost factor', 'Monthly volume growth'], d.scenarios.map(s => [s.id[0].toUpperCase() + s.id.slice(1), `${s.salesPercent}%`, `${s.costPercent}%`, `${s.monthlyGrowthPercent}%`])),
    text('These scenario factors are illustrative owner assumptions, not probabilities or growth rates inferred automatically from historical sales. Product costs captured on receipts may include allocated labor and overhead; avoid counting the same expense twice. The model uses profit after entered costs and does not verify audited or legally distributable profit, taxes or available cash.'),
    text('How profit is shared', true), text(INVESTOR_MODEL_NOTES),
    text('Risks and important conditions', true), text(d.risks || document.profile.risks || 'Demand may fall, costs may rise, production may be delayed, collections may be late, and some or all capital may remain unrecovered.'),
    text(INVESTOR_CONDITIONS),
    text(`Additional proposed conditions: ${d.conditions || 'To be confirmed in a separate written agreement.'}`));
  for (const c of cases) {
    const firstPositive = c.rows.find(r => r.distributableProfit > 0);
    blocks.push({ kind: 'page-break' }, text(`${document.profile.name} · ${c.name} scenario`, true),
      text(`Estimated total payouts ${money(c.totalPayout)} · Capital recovered ${money(c.recoveredCapital)} · Unrecovered capital ${money(c.unrecoveredCapital)} · Net gain ${money(c.netGain)} (${c.gainPercent.toFixed(1)}% of original capital).`),
      text(c.capReachedMonths === null ? 'The payout cap is not reached within the modeled term.' : `The payout cap is reached in month ${c.capReachedMonths}. Subsequent projected investor payouts are zero.`),
      ...(c.capacityConstrained ? [text('Projected volume is capped by the production capacity entered in the source forecast.')] : []),
      ...(firstPositive ? [text(`Calculation example (${firstPositive.month}): sales ${money(firstPositive.sales)} − product costs ${money(firstPositive.productCost)} − operating expenses ${money(firstPositive.operatingExpenses)} = estimated profit ${money(firstPositive.profit)}. Prior modeled losses absorbed: ${money(firstPositive.lossOffset)}. Reserve: ${money(firstPositive.reserve)}. Remaining distributable profit: ${money(firstPositive.distributableProfit)}. Investor payout after applying the share and remaining cap: ${money(firstPositive.investorPayout)}. Business share after reserve: ${money(firstPositive.businessShare)}.`)] : [text('There is no positive distributable profit in this scenario, so no investor payment is projected.')]),
      text('Annual estimates · years counted from the start month', true),
      table(['Term year / period', 'Estimated business profit', 'Business reserve', 'Investor payout', 'Retained by business'], c.years.map(y => [`Year ${y.year} · ${y.months} months\n${y.from} to ${y.to}`, money(y.profit), money(y.reserve), money(y.investorPayout), money(y.retainedByBusiness)])),
      text('Monthly estimated payout schedule', true),
      table(['Month', 'Business profit', 'Reserve', 'Investor payout', 'Cumulative payout', 'Retained by business'], c.rows.map(r => [`${r.number} · ${r.month}`, money(r.profit), money(r.reserve), money(r.investorPayout), money(r.cumulativePayout), money(r.retainedByBusiness)])),
      text(`Total modeled business profit: ${money(c.totalProfit)}. Total reserve retained: ${money(c.totalReserve)}. Total retained by the business after investor payouts: ${money(c.totalBusinessRetained)}. Retained amounts include the reserve and recovered losses; they are not added twice. Negative retained amounts represent business losses.`),
      text('All figures are estimates. No investor account or payment obligation is created by this document.'));
  }
  return blocks;
}
