/** Durable source records for owner reporting. All money is PHP, with two decimal places. */
export const LEDGER_KINDS = ['operating-expense', 'inventory-purchase', 'equipment-purchase', 'funding-in', 'funding-out', 'owner-in', 'owner-out'] as const;
export type LedgerKind = typeof LEDGER_KINDS[number];
export const LEDGER_LABELS: Record<LedgerKind, string> = {
  'operating-expense': 'Operating expense', 'inventory-purchase': 'Inventory purchase',
  'equipment-purchase': 'Equipment purchase', 'funding-in': 'Funding received',
  'funding-out': 'Loan repayment', 'owner-in': 'Owner contribution', 'owner-out': 'Owner withdrawal',
};
export interface BusinessLedgerEntry {
  id: string; date: string; kind: LedgerKind; category: string; description: string;
  amount: number; paid: boolean; cashDate: string; reference: string;
}
export interface BusinessProfile {
  name: string; description: string; contact: string; website: string; market: string;
  advantage: string; traction: string; team: string; milestones: string; risks: string;
  financialNotes: string; fundingAmount: number; fundingUses: { purpose: string; amount: number }[];
  openingCash: number | null; cashAsOf: string;
}
export interface ForecastScenario {
  id: string; name: string; startMonth: string; monthlyUnits: number; averageUnitPrice: number;
  unitVariableCost: number; monthlyFixedExpenses: number; monthlyGrowthPercent: number;
  monthlyCapacity: number; openingCash: number; upfrontInvestment: number; fundingAmount: number;
}
export interface ProposalLine {
  productId: string; name: string; quantity: number; unitPrice: number | null;
  priceSource: string; tierId: string;
}
export interface ProposalDraft {
  type: 'corporate' | 'event' | 'reseller'; title: string; recipient: string; introduction: string;
  leadTime: string; delivery: string; paymentTerms: string; validUntil: string; notes: string;
  includePictures: boolean; items: ProposalLine[];
}
export interface ReportMetrics {
  sales: number; orders: number; units: number; averageOrder: number; previousSales: number;
  growthPercent: number | null; savedCost: number | null; knownCost: number; unknownCostReceipts: number;
  grossProfit: number | null; marginPercent: number | null; operatingExpenses: number;
  indicativeResult: number | null; cashIn: number; cashOut: number; cashNet: number;
  openingCash: number | null; closingCash: number | null; balanceAtSale: number;
  repeatCustomers: number; identifiedCustomers: number; ledgerEntries: number;
}
export interface BusinessReport {
  from: string; to: string; previousFrom: string; previousTo: string;
  metrics: ReportMetrics;
  months: { month: string; sales: number; orders: number; expenses: number; cashNet: number }[];
  products: { productId: string; name: string; units: number; sales: number; savedCost: number | null; grossProfit: number | null }[];
  sources: { id: string; reference: string; date: string }[];
  ledgerSources: BusinessLedgerEntry[];
}
export interface ForecastRow { month: string; units: number; revenue: number; variableCost: number; fixedCost: number; operatingResult: number; cash: number }
export interface ForecastResult {
  rows: ForecastRow[]; revenue: number; operatingResult: number; endingCash: number;
  minimumCash: number; additionalFunding: number; breakEvenUnits: number | null; capacityConstrained: boolean;
}
export type BusinessDocument = {
  id: string; kind: 'business-report' | 'investor-summary' | 'business-plan' | 'proposal'; title: string;
  generatedAt: string; profile: BusinessProfile; historyRevision: number; businessRevision: number;
  report: BusinessReport | null; scenario: ForecastScenario | null;
  proposal: (ProposalDraft & { pictures: Record<string, string> }) | null;
};
export interface BusinessWorkspace {
  version: 1; profile: BusinessProfile; ledger: BusinessLedgerEntry[];
  scenarios: ForecastScenario[]; proposal: ProposalDraft; documents: BusinessDocument[];
}
export interface BusinessSnapshot { revision: number; workspace: BusinessWorkspace }

export function businessDay(iso = new Date().toISOString()): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) throw new Error('Invalid business date.');
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10);
}
export function validBusinessDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function emptyBusinessWorkspace(day = businessDay()): BusinessWorkspace {
  return {
    version: 1,
    profile: { name: 'My Lovely Craft', description: '', contact: '', website: '', market: '', advantage: '',
      traction: '', team: '', milestones: '', risks: '', financialNotes: '', fundingAmount: 0, fundingUses: [], openingCash: null, cashAsOf: day },
    ledger: [],
    scenarios: ['Conservative', 'Expected', 'Optimistic'].map((name, index) => ({
      id: `scenario-${index}`, name, startMonth: day.slice(0, 7), monthlyUnits: 0, averageUnitPrice: 0,
      unitVariableCost: 0, monthlyFixedExpenses: 0, monthlyGrowthPercent: 0, monthlyCapacity: 0,
      openingCash: 0, upfrontInvestment: 0, fundingAmount: 0,
    })),
    proposal: { type: 'corporate', title: 'Corporate gifting proposal', recipient: '', introduction: '',
      leadTime: '', delivery: '', paymentTerms: '', validUntil: '', notes: '', includePictures: true, items: [] },
    documents: [],
  };
}

// Validate imported extensions before use; never execute saved document HTML or external image URLs.
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, limit = 4000): v is string => typeof v === 'string' && v.length <= limit;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 && Math.abs(v * 100 - Math.round(v * 100)) < 0.0001;
const integer = (v: unknown, max = 1000000): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max;
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function unique(rows: { id: string }[]) { return new Set(rows.map(row => row.id)).size === rows.length; }
function ledgerValid(e: unknown): e is BusinessLedgerEntry {
  return obj(e) && str(e.id, 150) && !!e.id && validBusinessDay(e.date) && LEDGER_KINDS.includes(e.kind) &&
    str(e.category, 100) && str(e.description, 1000) && !!e.description.trim() && amount(e.amount) && e.amount > 0 && typeof e.paid === 'boolean' && validBusinessDay(e.cashDate) && str(e.reference, 300);
}
function profileValid(p: unknown): p is BusinessProfile {
  return obj(p) && ['name', 'description', 'contact', 'website', 'market', 'advantage', 'traction', 'team', 'milestones', 'risks', 'financialNotes'].every(k => str(p[k])) &&
    p.name.trim().length > 0 && amount(p.fundingAmount) && (p.openingCash === null || amount(p.openingCash)) && validBusinessDay(p.cashAsOf) &&
    Array.isArray(p.fundingUses) && p.fundingUses.length <= 30 && p.fundingUses.every(u => obj(u) && str(u.purpose, 500) && amount(u.amount));
}
export function validateScenario(s: unknown): asserts s is ForecastScenario {
  check(obj(s) && str(s.id, 150) && s.id.length > 0 && str(s.name, 100) && s.name.trim() &&
    validBusinessDay(`${s.startMonth}-01`) && Number(s.startMonth.slice(0, 4)) >= 2000 && Number(s.startMonth.slice(0, 4)) <= 2100 &&
    integer(s.monthlyUnits) && integer(s.monthlyCapacity) &&
    ['averageUnitPrice', 'unitVariableCost', 'monthlyFixedExpenses', 'openingCash', 'upfrontInvestment', 'fundingAmount'].every(k => amount(s[k])) &&
    Number.isFinite(s.monthlyGrowthPercent) && s.monthlyGrowthPercent >= -50 && s.monthlyGrowthPercent <= 100,
  'Enter valid scenario inputs: non-negative PHP amounts, whole units, and growth between -50% and 100%.');
}
export function validateProposal(p: unknown): asserts p is ProposalDraft {
  check(obj(p) && ['corporate', 'event', 'reseller'].includes(p.type) &&
    ['title', 'recipient', 'introduction', 'leadTime', 'delivery', 'paymentTerms', 'notes'].every(k => str(p[k])) &&
    (p.validUntil === '' || validBusinessDay(p.validUntil)) && typeof p.includePictures === 'boolean' &&
    Array.isArray(p.items) && p.items.length <= 100 && new Set(p.items.map(i => i?.productId)).size === p.items.length &&
    p.items.every(i => obj(i) && str(i.productId, 300) && i.productId.length > 0 && str(i.name) && integer(i.quantity) && i.quantity > 0 &&
      (i.unitPrice === null || amount(i.unitPrice)) && str(i.priceSource, 500) && str(i.tierId, 300)),
  'A proposal supports up to 100 different products, positive whole quantities, and valid PHP unit prices.');
  let total = 0;
  p.items.forEach(i => { total += Math.round((i.unitPrice ?? 0) * 100) * i.quantity; });
  check(Number.isSafeInteger(total), 'The proposal total exceeds the supported range. Reduce quantities or unit prices.');
}
function reportValid(r: unknown): r is BusinessReport {
  if (!obj(r) || ![r.from, r.to, r.previousFrom, r.previousTo].every(validBusinessDay) || r.from > r.to || !obj(r.metrics)) return false;
  const keys: (keyof ReportMetrics)[] = ['sales', 'orders', 'units', 'averageOrder', 'previousSales', 'growthPercent', 'savedCost', 'knownCost', 'unknownCostReceipts', 'grossProfit', 'marginPercent', 'operatingExpenses', 'indicativeResult', 'cashIn', 'cashOut', 'cashNet', 'openingCash', 'closingCash', 'balanceAtSale', 'repeatCustomers', 'identifiedCustomers', 'ledgerEntries'];
  const nullable = new Set(['growthPercent', 'savedCost', 'grossProfit', 'marginPercent', 'indicativeResult', 'openingCash', 'closingCash']);
  if (!keys.every(k => (r.metrics[k] === null && nullable.has(k)) || (typeof r.metrics[k] === 'number' && Number.isFinite(r.metrics[k]) && Math.abs(r.metrics[k]) <= 1e14))) return false;
  return Array.isArray(r.months) && r.months.length <= 120 && r.months.every(m => obj(m) && validBusinessDay(`${m.month}-01`) && ['sales', 'orders', 'expenses', 'cashNet'].every(k => typeof m[k] === 'number' && Number.isFinite(m[k]) && Math.abs(m[k]) <= 1e14)) &&
    Array.isArray(r.products) && r.products.length <= 10000 && r.products.every(p => obj(p) && str(p.productId, 300) && str(p.name) && ['units', 'sales', 'savedCost', 'grossProfit'].every(k => (p[k] === null && ['savedCost', 'grossProfit'].includes(k)) || (typeof p[k] === 'number' && Number.isFinite(p[k]) && Math.abs(p[k]) <= 1e14))) &&
    Array.isArray(r.sources) && r.sources.length <= 100000 && r.sources.every(s => obj(s) && str(s.id, 300) && str(s.reference, 500) && validBusinessDay(s.date)) &&
    Array.isArray(r.ledgerSources) && r.ledgerSources.length <= 50000 && r.ledgerSources.every(ledgerValid);
}
export function validateBusinessDocument(d: unknown): asserts d is BusinessDocument {
  check(obj(d) && str(d.id, 150) && d.id && ['business-report', 'investor-summary', 'business-plan', 'proposal'].includes(d.kind) &&
    str(d.title, 300) && d.title.trim() && str(d.generatedAt, 100) && Number.isFinite(Date.parse(d.generatedAt)) &&
    integer(d.historyRevision, Number.MAX_SAFE_INTEGER) && integer(d.businessRevision, Number.MAX_SAFE_INTEGER) && profileValid(d.profile), 'The saved business document has invalid metadata.');
  if (d.kind === 'proposal') {
    validateProposal(d.proposal);
    const proposal: ProposalDraft = d.proposal;
    const pictures = (proposal as ProposalDraft & { pictures: unknown }).pictures;
    check(d.report === null && d.scenario === null && obj(pictures) && Object.keys(pictures).length <= 100 &&
      Object.entries(pictures).every(([id, photo]) => proposal.items.some(i => i.productId === id) && typeof photo === 'string' && photo.length <= 25000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)), 'The proposal has invalid product pictures.');
  } else {
    check(reportValid(d.report) && d.proposal === null, 'The saved business report is invalid.');
    if (d.scenario !== null) validateScenario(d.scenario);
    check(d.kind === 'business-report' || d.scenario !== null, 'Choose a forecast scenario for this document.');
  }
}
export function validateBusinessWorkspace(value: unknown): BusinessWorkspace {
  check(obj(value) && value.version === 1 && profileValid(value.profile), 'The business workspace profile is invalid.');
  check(Array.isArray(value.ledger) && value.ledger.length <= 50000 && value.ledger.every(ledgerValid) && unique(value.ledger), 'Enter a description, valid dates, and positive PHP amount for each ledger entry.');
  check(Array.isArray(value.scenarios) && value.scenarios.length >= 1 && value.scenarios.length <= 12 && unique(value.scenarios), 'Keep between 1 and 12 unique forecast scenarios.');
  value.scenarios.forEach(validateScenario); validateProposal(value.proposal);
  check(Array.isArray(value.documents) && value.documents.length <= 40 && unique(value.documents), 'Keep up to 40 saved documents. Download or remove older documents to make room.');
  value.documents.forEach(validateBusinessDocument);
  check(new TextEncoder().encode(JSON.stringify(value)).length <= 16 * 1024 * 1024, 'Business records exceed 16 MB. Download or remove older document snapshots.');
  return value as BusinessWorkspace;
}
