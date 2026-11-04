import { businessDay, validBusinessDay, type BusinessReport, type BusinessWorkspace } from '../../domain/businessInsights';
import type { SavedCustomerReceipt } from '../../ui/transactions/models';
import type { TransactionEntry } from '../../ui/transactions/transactions';

export function cents(value: number): number {
  const n = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(n)) throw new Error('Financial amounts exceed the supported range.');
  return n;
}
export function addMoney(a: number, b: number): number {
  const n = a + b;
  if (!Number.isSafeInteger(n)) throw new Error('Financial totals exceed the supported range. Narrow the report dates.');
  return n;
}
const between = (day: string, from: string, to: string) => day >= from && day <= to;
export const ledgerCashSign = (kind: string) => ['funding-in', 'owner-in'].includes(kind) ? 1 : -1;
export function reportDates(from: string, to: string) {
  if (!validBusinessDay(from) || !validBusinessDay(to) || from > to) throw new Error('Choose valid From and To dates in order.');
  const first = new Date(`${from}T00:00:00Z`), last = new Date(`${to}T00:00:00Z`);
  const monthCount = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1;
  if (monthCount > 120) throw new Error('Choose a report period of 10 years or less.');
  const days = (last.getTime() - first.getTime()) / 86400000 + 1;
  return { previousFrom: new Date(first.getTime() - days * 86400000).toISOString().slice(0, 10),
    previousTo: new Date(first.getTime() - 86400000).toISOString().slice(0, 10), first, monthCount };
}

/** One pass through saved sales and an independent pass through cash dates. Quotations never enter actuals. */
export function calculateBusinessReport(receipts: readonly SavedCustomerReceipt[], entries: readonly TransactionEntry[],
  workspace: Pick<BusinessWorkspace, 'ledger' | 'profile'>, from: string, to: string): BusinessReport {
  const dates = reportDates(from, to);
  const months = new Map<string, { month: string; sales: number; orders: number; expenses: number; cashNet: number }>();
  for (let i = 0; i < dates.monthCount; i++) {
    const month = new Date(Date.UTC(dates.first.getUTCFullYear(), dates.first.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    months.set(month, { month, sales: 0, orders: 0, expenses: 0, cashNet: 0 });
  }
  let sales = 0, previousSales = 0, orders = 0, units = 0, knownCost = 0, unknownCostReceipts = 0, balanceAtSale = 0;
  let expenses = 0, cashIn = 0, cashOut = 0, beforeCash = 0, ledgerEntries = 0;
  const anchor = workspace.profile.openingCash !== null && workspace.profile.cashAsOf <= from ? workspace.profile.cashAsOf : null;
  const products = new Map<string, { productId: string; name: string; units: number; sales: number; knownCost: number; missing: boolean }>();
  const customers = new Map<string, number>();
  const movements = new Map(entries.map(e => [e.receiptId, e]));
  const sources: BusinessReport['sources'] = [];
  const ledgerSources: BusinessReport['ledgerSources'] = [];
  function cash(date: string, signed: number) {
    if (anchor && date >= anchor && date < from) beforeCash = addMoney(beforeCash, signed);
    if (!between(date, from, to)) return;
    if (signed >= 0) cashIn = addMoney(cashIn, signed); else cashOut = addMoney(cashOut, -signed);
    const month = months.get(date.slice(0, 7))!; month.cashNet = addMoney(month.cashNet, signed);
  }
  for (const receipt of receipts) {
    const date = businessDay(receipt.createdAt);
    const movement = movements.get(receipt.id);
    cash(movement?.date ?? date, movement ? cents(movement.amount) * (movement.direction === 'credit' ? 1 : -1) : cents(Math.min(receipt.total, receipt.amountPaid)));
    const total = cents(receipt.total);
    if (between(date, dates.previousFrom, dates.previousTo)) previousSales = addMoney(previousSales, total);
    if (!between(date, from, to)) continue;
    sales = addMoney(sales, total); orders++; balanceAtSale = addMoney(balanceAtSale, cents(receipt.balance));
    sources.push({ id: receipt.id, reference: receipt.reference, date });
    const month = months.get(date.slice(0, 7))!; month.sales = addMoney(month.sales, total); month.orders++;
    const identity = (receipt.customerContact.trim() || receipt.customerName.trim()).toLowerCase().replace(/\s+/g, ' ');
    if (identity) customers.set(identity, (customers.get(identity) ?? 0) + 1);
    if (receipt.items.some(i => i.totalProductCost == null)) unknownCostReceipts++;
    // Allocate the receipt's discounted total to item sales, preserving its exact cents.
    const weights = receipt.items.map(i => cents(i.amount));
    const weightTotal = weights.reduce((a, b) => addMoney(a, b), 0);
    let allocated = 0;
    receipt.items.forEach((item, index) => {
      const itemSales = index === receipt.items.length - 1 ? total - allocated : (weightTotal ? Math.floor(total * (weights[index] / weightTotal)) : 0);
      allocated = addMoney(allocated, itemSales); units += item.quantity;
      if (!Number.isSafeInteger(units)) throw new Error('Too many units for one report.');
      const cost = item.totalProductCost == null ? null : cents(item.totalProductCost);
      if (cost !== null) knownCost = addMoney(knownCost, cost);
      const product = products.get(item.productId) ?? { productId: item.productId, name: item.name, units: 0, sales: 0, knownCost: 0, missing: false };
      product.units += item.quantity; product.sales = addMoney(product.sales, itemSales);
      product.knownCost = addMoney(product.knownCost, cost ?? 0); product.missing ||= cost === null;
      products.set(item.productId, product);
    });
  }
  for (const entry of workspace.ledger) {
    if (entry.paid) cash(entry.cashDate, cents(entry.amount) * ledgerCashSign(entry.kind));
    if (between(entry.date, from, to) || (entry.paid && between(entry.cashDate, from, to))) { ledgerSources.push({ ...entry }); ledgerEntries++; }
    if (!between(entry.date, from, to)) continue;
    if (entry.kind === 'operating-expense') {
      expenses = addMoney(expenses, cents(entry.amount));
      const month = months.get(entry.date.slice(0, 7))!; month.expenses = addMoney(month.expenses, cents(entry.amount));
    }
  }
  const hasCost = orders > 0 && unknownCostReceipts === 0;
  const grossProfit = hasCost ? sales - knownCost : null;
  const openingCash = anchor ? addMoney(cents(workspace.profile.openingCash!), beforeCash) : null;
  return { from, to, previousFrom: dates.previousFrom, previousTo: dates.previousTo,
    metrics: { sales: sales / 100, orders, units, averageOrder: orders ? Math.round(sales / orders) / 100 : 0,
      previousSales: previousSales / 100, growthPercent: previousSales > 0 ? (sales - previousSales) / previousSales * 100 : null,
      savedCost: hasCost ? knownCost / 100 : null, knownCost: knownCost / 100, unknownCostReceipts,
      grossProfit: grossProfit === null ? null : grossProfit / 100, marginPercent: grossProfit !== null && sales > 0 ? grossProfit / sales * 100 : null,
      operatingExpenses: expenses / 100, indicativeResult: grossProfit === null ? null : (grossProfit - expenses) / 100,
      cashIn: cashIn / 100, cashOut: cashOut / 100, cashNet: (cashIn - cashOut) / 100,
      openingCash: openingCash === null ? null : openingCash / 100,
      closingCash: openingCash === null ? null : addMoney(openingCash, cashIn - cashOut) / 100,
      balanceAtSale: balanceAtSale / 100, repeatCustomers: [...customers.values()].filter(n => n > 1).length,
      identifiedCustomers: customers.size, ledgerEntries },
    months: [...months.values()].map(m => ({ ...m, sales: m.sales / 100, expenses: m.expenses / 100, cashNet: m.cashNet / 100 })),
    products: [...products.values()].map(p => ({ productId: p.productId, name: p.name, units: p.units, sales: p.sales / 100,
      savedCost: p.missing ? null : p.knownCost / 100, grossProfit: p.missing ? null : (p.sales - p.knownCost) / 100 })).sort((a, b) => b.sales - a.sales || a.productId.localeCompare(b.productId)),
    sources, ledgerSources,
  };
}
