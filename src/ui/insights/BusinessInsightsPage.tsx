import { useCallback, useEffect, useRef, useState } from 'react';
import { productService } from '../../application/session';
import { businessDay, emptyBusinessWorkspace, emptyInvestorProposal, validateBusinessDocument, validateBusinessWorkspace, type BusinessDocument, type BusinessReport, type BusinessSnapshot, type BusinessWorkspace } from '../../domain/businessInsights';
import type { Product } from '../../domain/products';
import { getProductPhotos } from '../../domain/productPhotos';
import { loadBusinessHistory, loadBusinessReport, loadBusinessWorkspace, saveBusinessWorkspace, type BusinessHistorySnapshot } from '../../application/insights/businessInsightsStore';
import { renderBusinessDocument } from '../../application/insights/businessDocuments';
import { registerBusinessFlush } from '../../application/insights/businessWorkingCopy';
import { BusinessOverview } from './BusinessOverview';
import { BusinessProfileForm } from './BusinessProfileForm';
import { BusinessForecastPanel } from './BusinessForecastPanel';
import { BusinessLedgerPanel } from './BusinessLedgerPanel';
import { BusinessProposalForm } from './BusinessProposalForm';
import { BusinessDocumentsPanel } from './BusinessDocumentsPanel';
import { InvestorProposalPanel } from './InvestorProposalPanel';
import { createInvestorSnapshot, projectInvestorProposal } from '../../application/insights/investorProjections';
import './businessInsights.css';

const loadProducts = () => productService.listProducts();
const message = (e: unknown) => e instanceof Error ? e.message : 'The business operation failed. Unsaved changes remain in this tab.';
type Tab = 'overview' | 'ledger' | 'forecast' | 'proposals' | 'investor' | 'documents' | 'profile';
const tabs: [Tab, string][] = [['overview', 'Overview'], ['ledger', 'Expenses & cash'], ['forecast', 'Forecast'], ['proposals', 'Proposals'], ['investor', 'Investor proposals'], ['documents', 'Documents'], ['profile', 'Business profile']];
function initialPeriod() {
  const to = businessDay(), date = new Date(`${to}T00:00:00Z`);
  return { from: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 11, 1)).toISOString().slice(0, 10), to };
}
export interface BusinessInsightsPageProps {
  load?: typeof loadBusinessWorkspace; save?: typeof saveBusinessWorkspace;
  historyLoad?: typeof loadBusinessHistory; productsLoad?: typeof loadProducts; calculate?: typeof loadBusinessReport;
  active?: boolean;
}
export default function BusinessInsightsPage({ load = loadBusinessWorkspace, save = saveBusinessWorkspace, historyLoad = loadBusinessHistory, productsLoad = loadProducts, calculate = loadBusinessReport, active = true }: BusinessInsightsPageProps) {
  const [snapshot, setSnapshot] = useState<BusinessSnapshot>(() => ({ revision: 0, workspace: emptyBusinessWorkspace() }));
  const [workspace, setWorkspace] = useState(snapshot.workspace), [history, setHistory] = useState<BusinessHistorySnapshot>({ revision: 0, archive: { customerReceipts: [], transactionEntries: [] } }), [products, setProducts] = useState<Product[]>([]);
  const [initialInvestorDraft] = useState(emptyInvestorProposal);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [blocking, setBlocking] = useState(false), [error, setError] = useState(''), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('overview'), [period, setPeriod] = useState(initialPeriod), [report, setReport] = useState<BusinessReport | null>(null), [reportError, setReportError] = useState(''), [calculating, setCalculating] = useState(false);
  const mounted = useRef(true), occupied = useRef(false), snapshotRef = useRef(snapshot), workspaceRef = useRef(workspace), wasActive = useRef(active);
  const inFlightSave = useRef<Promise<void> | null>(null);
  const reportSources = useRef<{ ledger: BusinessWorkspace['ledger']; history: BusinessHistorySnapshot; from: string; to: string; openingCash: number | null; cashAsOf: string } | null>(null);
  snapshotRef.current = snapshot; workspaceRef.current = workspace;
  const dirty = workspace !== snapshot.workspace;
  useEffect(() => {
    mounted.current = true;
    Promise.all([load(), historyLoad(), productsLoad()]).then(([s, h, p]) => {
      if (!mounted.current) return;
      setSnapshot(s); setWorkspace(s.workspace); setHistory(h); setProducts(p); setReady(true);
    }).catch(e => { if (mounted.current) setError(message(e)); });
    return () => { mounted.current = false; };
  }, [load, historyLoad, productsLoad]);
  // Refresh source sales/catalog when returning from another workshop, retaining any working forms.
  useEffect(() => {
    const returning = active && !wasActive.current; wasActive.current = active;
    if (!returning || !ready) return;
    let cancelled = false;
    Promise.all([historyLoad(), productsLoad()]).then(([h, p]) => { if (!cancelled) { setHistory(current => current.revision === h.revision ? current : h); setProducts(p); } }).catch(e => { if (!cancelled) setError(message(e)); });
    return () => { cancelled = true; };
  }, [active, ready, historyLoad, productsLoad]);
  const persist = useCallback(async (next: BusinessWorkspace, expectedHistoryRevision?: number, block = false): Promise<BusinessSnapshot | null> => {
    if (occupied.current) return null;
    const workingAtStart = workspaceRef.current;
    occupied.current = true; setBusy(true); setBlocking(block); setSaveError(''); setError('');
    let complete!: () => void;
    inFlightSave.current = new Promise<void>(resolve => { complete = resolve; });
    try {
      // Authoritative validation happens in the SQLite worker. Avoid walking every saved document on the input thread.
      const receipt = await save(next, snapshotRef.current.revision, expectedHistoryRevision, snapshotRef.current.workspace);
      const saved = { revision: receipt.revision, workspace: next };
      snapshotRef.current = saved;
      if (workspaceRef.current === workingAtStart || workspaceRef.current === next) workspaceRef.current = saved.workspace;
      if (mounted.current) { setSnapshot(saved); setWorkspace(current => current === workingAtStart || current === next ? saved.workspace : current); setNotice('Saved to SQLite.'); }
      return saved;
    } catch (e) { if (mounted.current) setSaveError(message(e)); return null; }
    finally { occupied.current = false; inFlightSave.current = null; complete(); if (mounted.current) { setBusy(false); setBlocking(false); } }
  }, [save]);
  useEffect(() => {
    if (!ready) return;
    return registerBusinessFlush(async () => {
      while (inFlightSave.current || workspaceRef.current !== snapshotRef.current.workspace) {
        if (inFlightSave.current) { await inFlightSave.current; continue; }
        if (!await persist(workspaceRef.current)) throw new Error('Business changes could not be saved. Correct the Business insights inputs before downloading a backup.');
      }
    });
  }, [ready, persist]);
  useEffect(() => {
    if (!ready || !dirty || busy || saveError) return;
    const timer = setTimeout(() => { void persist(workspace); }, 1000);
    return () => clearTimeout(timer);
  }, [ready, dirty, busy, workspace, persist, saveError]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  const needsReport = tab === 'overview' || tab === 'documents';
  useEffect(() => {
    if (!ready || !active || !needsReport) { setCalculating(false); return; }
    const source = reportSources.current;
    if (source && source.ledger === workspace.ledger && source.history === history && source.from === period.from && source.to === period.to && source.openingCash === workspace.profile.openingCash && source.cashAsOf === workspace.profile.cashAsOf) return;
    const controller = new AbortController();
    reportSources.current = null; setReport(null); setReportError(''); setCalculating(true);
    const timer = setTimeout(() => {
      calculate(history, { ...emptyBusinessWorkspace(), profile: workspace.profile, ledger: workspace.ledger }, period.from, period.to, controller.signal)
        .then(value => { if (!controller.signal.aborted) { reportSources.current = { ledger: workspace.ledger, history, from: period.from, to: period.to, openingCash: workspace.profile.openingCash, cashAsOf: workspace.profile.cashAsOf }; setReport(value); } })
        .catch(e => { if (!controller.signal.aborted) setReportError(message(e)); })
        .finally(() => { if (!controller.signal.aborted) setCalculating(false); });
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ready, active, needsReport, history, workspace.ledger, workspace.profile.openingCash, workspace.profile.cashAsOf, period, calculate]);
  function update<K extends keyof BusinessWorkspace>(key: K, value: BusinessWorkspace[K]) {
    setSaveError(''); setNotice('');
    const next = { ...workspaceRef.current, [key]: value }; workspaceRef.current = next; setWorkspace(next);
  }
  async function saveLedger(ledger: BusinessWorkspace['ledger']) {
    const next = { ...workspaceRef.current, ledger };
    const saved = await persist(next, undefined, true);
    if (saved && mounted.current) setWorkspace(saved.workspace);
    return !!saved;
  }
  async function removeDocument(id: string) {
    const saved = await persist({ ...workspaceRef.current, documents: workspaceRef.current.documents.filter(d => d.id !== id) }, undefined, true);
    if (saved && mounted.current) setWorkspace(saved.workspace);
    return !!saved;
  }
  async function generate(kind: BusinessDocument['kind'], title: string, scenarioId: string): Promise<BusinessDocument | null> {
    if (occupied.current) return null;
    setError('');
    try {
      if (kind === 'investor-proposal') throw new Error('Use Investor proposals to configure the investment terms and all three scenarios.');
      const source = structuredClone(workspaceRef.current); validateBusinessWorkspace(source);
      const scenario = source.scenarios.find(s => s.id === scenarioId) ?? source.scenarios[0];
      const evidence = reportSources.current;
      if (kind !== 'proposal' && (!report || calculating || !evidence || evidence.ledger !== workspaceRef.current.ledger || evidence.history !== history || evidence.from !== period.from || evidence.to !== period.to || evidence.openingCash !== source.profile.openingCash || evidence.cashAsOf !== source.profile.cashAsOf)) throw new Error('Wait for a valid report calculation before generating.');
      if (kind === 'proposal' && (!source.proposal.recipient.trim() || !source.proposal.items.length || source.proposal.items.some(i => i.unitPrice === null))) throw new Error('Add a recipient, select products, and confirm every selling price in Proposals.');
      if (kind === 'proposal' && source.proposal.items.some(i => !products.some(p => p.id === i.productId && p.isActive))) throw new Error('Some proposal products are no longer active in the catalog. Review the product selection before generating.');
      const pictures: Record<string, string> = Object.create(null);
      if (kind === 'proposal' && source.proposal.includePictures) {
        const selected = new Set(source.proposal.items.map(i => i.productId));
        products.forEach(p => { const photo = getProductPhotos(p).thumbnail; if (selected.has(p.id) && photo) pictures[p.id] = photo; });
      }
      const document: BusinessDocument = { id: crypto.randomUUID(), kind, title, generatedAt: new Date().toISOString(), profile: structuredClone(source.profile),
        historyRevision: history.revision, businessRevision: snapshotRef.current.revision + 1,
        report: kind === 'proposal' ? null : structuredClone(report), scenario: ['investor-summary', 'business-plan'].includes(kind) ? scenario : null,
        proposal: kind === 'proposal' ? { ...source.proposal, pictures } : null };
      validateBusinessDocument(document); renderBusinessDocument(document);
      const next = { ...source, documents: [document, ...source.documents] };
      const saved = await persist(next, undefined, true);
      if (!saved) return null;
      if (mounted.current) { setWorkspace(saved.workspace); setNotice('Document snapshot saved to SQLite.'); }
      return document;
    } catch (e) { setError(message(e)); return null; }
  }
  async function saveInvestorDocument(document: BusinessDocument): Promise<BusinessDocument | null> {
    if (occupied.current) return null;
    const current = workspaceRef.current, revision = snapshotRef.current.revision;
    const draft = current.investorProposal ?? initialInvestorDraft;
    if (document.kind !== 'investor-proposal' || !document.investment) throw new Error('Choose a valid investor proposal.');
    if (JSON.stringify(document.investment.draft) !== JSON.stringify(draft) || JSON.stringify(document.profile) !== JSON.stringify(current.profile)) throw new Error('Proposal details changed. Preview the current inputs before saving.');
    const sourceReport = draft.source === 'history' ? await calculate(history, current, draft.historyFrom, draft.historyTo, new AbortController().signal) : null;
    const checked = createInvestorSnapshot(draft, sourceReport, current.scenarios);
    if (JSON.stringify(checked.basis) !== JSON.stringify(document.investment.basis) || workspaceRef.current !== current || snapshotRef.current.revision !== revision) throw new Error('Business inputs changed while preparing the proposal. Preview the current inputs again.');
    projectInvestorProposal(checked);
    const frozen: BusinessDocument = { ...document, investment: checked, historyRevision: history.revision, businessRevision: revision + 1 };
    validateBusinessDocument(frozen);
    const saved = await persist({ ...current, investorProposal: draft, documents: [frozen, ...current.documents] }, draft.source === 'history' ? history.revision : undefined, true);
    if (saved && mounted.current) { setWorkspace(saved.workspace); setNotice('Investor proposal snapshot saved. No investment or payment was recorded.'); }
    return saved ? frozen : null;
  }
  function quickPeriod(mode: 'month' | 'quarter' | 'year' | '12months') {
    const to = businessDay(), date = new Date(`${to}T00:00:00Z`), year = date.getUTCFullYear(), month = date.getUTCMonth();
    const start = mode === 'month' ? month : mode === 'quarter' ? Math.floor(month / 3) * 3 : mode === 'year' ? 0 : month - 11;
    setPeriod({ from: new Date(Date.UTC(year, start, 1)).toISOString().slice(0, 10), to });
  }
  async function refreshSources() {
    if (occupied.current) return;
    setError('');
    try { const [h, p] = await Promise.all([historyLoad(), productsLoad()]); if (mounted.current) { setHistory(current => current.revision === h.revision ? current : h); setProducts(p); setNotice('Sales and catalog sources refreshed.'); } }
    catch (e) { if (mounted.current) setError(message(e)); }
  }
  return <div className="business-insights" aria-busy={!ready || blocking}>
    <header className="insights-page-heading"><div><p className="panel-kicker">BUSINESS INSIGHTS &amp; PROPOSALS</p><h1>Plan your next chapter.</h1><p className="page-lead">Understand your performance, test growth plans, and prepare documents from your business records.</p></div><div className="insights-save-status"><span role="status">{!ready ? 'Loading SQLite records…' : busy ? 'Saving to SQLite…' : saveError ? 'Changes need attention' : dirty ? 'Changes waiting to save…' : 'Saved in SQLite'}</span>{ready && dirty && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void persist(workspace)}>Save changes now</button>}</div></header>
    {(error || saveError) && <p role="alert" className="feedback feedback-error">{error || saveError}{saveError && ' Your working changes remain in this tab. Correct the inputs or retry saving.'}</p>}
    {notice && <p role="status" className="insights-muted">{notice}</p>}
    {!ready && error && <button type="button" className="button button-secondary" onClick={() => window.location.reload()}>Retry loading</button>}
    {ready && <>
      <nav className="insights-tabs" aria-label="Business insights sections">{tabs.map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <section className="panel insights-period" aria-label="Business report period"><div><strong>Report period</strong><small>Sales and cash use their own dates · SGT · PHP</small></div><label className="field"><span>Report from date</span><input type="date" value={period.from} onChange={e => setPeriod({ ...period, from: e.target.value })} /></label><label className="field"><span>Report to date</span><input type="date" value={period.to} onChange={e => setPeriod({ ...period, to: e.target.value })} /></label><div className="insights-actions"><button className="button button-secondary" type="button" onClick={() => quickPeriod('month')}>This month</button><button className="button button-secondary" type="button" onClick={() => quickPeriod('quarter')}>This quarter</button><button className="button button-secondary" type="button" onClick={() => quickPeriod('year')}>This year</button><button className="button button-secondary" type="button" onClick={() => quickPeriod('12months')}>Last 12 months</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => void refreshSources()}>Refresh sales &amp; catalog</button></div></section>
      {reportError && <p role="alert" className="feedback feedback-error">{reportError}</p>}
      {tab === 'overview' && (report ? <BusinessOverview report={report} products={products} /> : <p role="status">{calculating ? 'Calculating business trends…' : 'Choose a valid report period.'}</p>)}
      {tab === 'ledger' && <BusinessLedgerPanel ledger={workspace.ledger} save={saveLedger} disabled={busy} />}
      {tab === 'forecast' && <BusinessForecastPanel scenarios={workspace.scenarios} onChange={s => update('scenarios', s)} disabled={blocking} />}
      {tab === 'profile' && <BusinessProfileForm profile={workspace.profile} onChange={p => update('profile', p)} disabled={blocking} />}
      {tab === 'proposals' && <BusinessProposalForm draft={workspace.proposal} products={products} onChange={p => update('proposal', p)} disabled={blocking} />}
      {tab === 'investor' && <InvestorProposalPanel draft={workspace.investorProposal ?? initialInvestorDraft} workspace={workspace} history={history} businessRevision={snapshot.revision} disabled={blocking} saveDisabled={busy} onChange={draft => update('investorProposal', draft)} saveDocument={saveInvestorDocument} calculate={calculate} />}
      {tab === 'documents' && <BusinessDocumentsPanel workspace={workspace} report={report} disabled={busy} generate={generate} remove={removeDocument} />}
    </>}
  </div>;
}
