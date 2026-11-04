import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyBusinessWorkspace, emptyInvestorProposal, validateBusinessDocument,
  type BusinessDocument, type BusinessReport, type BusinessWorkspace, type InvestorProposalDraft,
} from '../../domain/businessInsights';
import type { TransactionHistorySnapshot } from '../transactions/transactionHistoryStore';
import { loadBusinessReport } from '../../application/insights/businessInsightsStore';
import { createInvestorSnapshot, historicalInvestorBasis, INVESTOR_CONDITIONS, INVESTOR_SCENARIO_LABELS, projectInvestorProposal } from '../../application/insights/investorProjections';
import { businessDocumentWord, businessFilename, businessMoney, downloadBusinessFile, renderBusinessDocument } from '../../application/insights/businessDocuments';
import './investorProposal.css';

export function InvestorProposalPanel({ draft, workspace, history, businessRevision, disabled, onChange, saveDocument, calculate = loadBusinessReport }: {
  draft: InvestorProposalDraft; workspace: BusinessWorkspace; history: TransactionHistorySnapshot; businessRevision: number; disabled: boolean;
  onChange: (draft: InvestorProposalDraft) => void; saveDocument: (document: BusinessDocument) => Promise<BusinessDocument | null>;
  calculate?: typeof loadBusinessReport;
}) {
  const [historyReport, setHistoryReport] = useState<BusinessReport | null>(null), [historyBusy, setHistoryBusy] = useState(false), [historyError, setHistoryError] = useState('');
  const [preview, setPreview] = useState<BusinessDocument | null>(null), [saved, setSaved] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const occupied = useRef(false), mounted = useRef(true), resolvedHistory = useRef<{ ledger: BusinessWorkspace['ledger']; history: TransactionHistorySnapshot; from: string; to: string } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (draft.source !== 'history') return;
    const controller = new AbortController();
    setHistoryBusy(true); setHistoryError(''); resolvedHistory.current = null;
    const timer = setTimeout(() => {
      calculate(history, { ...emptyBusinessWorkspace(), profile: workspace.profile, ledger: workspace.ledger }, draft.historyFrom, draft.historyTo, controller.signal)
        .then(report => { if (!controller.signal.aborted) { setHistoryReport(report); resolvedHistory.current = { ledger: workspace.ledger, history, from: draft.historyFrom, to: draft.historyTo }; } })
        .catch(e => { if (!controller.signal.aborted) { setHistoryReport(null); setHistoryError(e instanceof Error ? e.message : 'Historical records could not be loaded.'); } })
        .finally(() => { if (!controller.signal.aborted) setHistoryBusy(false); });
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [draft.source, draft.historyFrom, draft.historyTo, history, workspace.ledger, calculate]);
  const sourceForecast = workspace.scenarios.find(s => s.id === draft.forecastScenarioId);
  const calculation = useMemo(() => {
    try {
      const snapshot = createInvestorSnapshot(draft, historyReport, workspace.scenarios);
      return { snapshot, cases: projectInvestorProposal(snapshot), error: '' };
    } catch (e) { return { snapshot: null, cases: [], error: e instanceof Error ? e.message : 'Check the projection assumptions.' }; }
  }, [draft, historyReport, workspace.scenarios]);
  const fingerprint = JSON.stringify({ draft, profile: workspace.profile, basis: calculation.snapshot?.basis ?? null, historyRevision: draft.source === 'history' ? history.revision : null });
  useEffect(() => { setPreview(null); setSaved(false); setError(''); }, [fingerprint]);
  const previewHtml = useMemo(() => preview ? renderBusinessDocument(preview) : '', [preview]);
  const locked = disabled || !!busy;
  const historyReady = draft.source !== 'history' || (!historyBusy && !!resolvedHistory.current && resolvedHistory.current.ledger === workspace.ledger && resolvedHistory.current.history === history && resolvedHistory.current.from === draft.historyFrom && resolvedHistory.current.to === draft.historyTo);
  function change<K extends keyof InvestorProposalDraft>(key: K, value: InvestorProposalDraft[K]) { onChange({ ...draft, [key]: value }); }
  function buildPreview() {
    if (!historyReady) throw new Error('Wait for the selected historical inputs to finish loading.');
    if (!calculation.snapshot) throw new Error(calculation.error);
    const document: BusinessDocument = { id: crypto.randomUUID(), kind: 'investor-proposal', title: `Investment proposal for ${draft.investorName.slice(0, 250)}`,
      generatedAt: new Date().toISOString(), profile: structuredClone(workspace.profile), historyRevision: history.revision, businessRevision,
      report: null, scenario: null, proposal: null, investment: structuredClone(calculation.snapshot) };
    validateBusinessDocument(document); renderBusinessDocument(document);
    return document;
  }
  async function action(label: string, fn: () => void | Promise<void>) {
    if (occupied.current) return; occupied.current = true; setBusy(label); setError('');
    try { await fn(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'The proposal could not be generated.'); }
    finally { occupied.current = false; if (mounted.current) setBusy(''); }
  }
  const textField = (key: 'investorName' | 'sourceNotes' | 'purpose' | 'risks' | 'conditions', label: string, multiline = false) => <label className={`field ${multiline ? 'insights-wide' : ''}`} key={key}>
    <span>{label}</span>{multiline ? <textarea aria-label={label} rows={3} maxLength={4000} value={draft[key]} onChange={e => change(key, e.target.value)} /> : <input aria-label={label} maxLength={300} value={draft[key]} onChange={e => change(key, e.target.value)} />}</label>;
  const numbers: [keyof InvestorProposalDraft, string, number, number, string][] = [
    ['investmentAmount', 'Proposed investment (PHP)', 0, 1e9, '.01'], ['investorSharePercent', 'Investor share after reserve (%)', 0, 100, '.01'],
    ['reservePercent', 'Business reserve (%)', 0, 100, '.01'], ['durationMonths', 'Investment duration (months)', 1, 120, '1'], ['maximumPayout', 'Maximum total payout including capital (PHP)', 0, 1e9, '.01'],
  ];
  let historySummary = '';
  if (draft.source === 'history' && historyReport && !historyBusy && !historyError) {
    try { const h = historicalInvestorBasis(historyReport); historySummary = `${h.evidence.receipts} receipts across ${h.evidence.months} complete month(s). Monthly averages: sales ${businessMoney(h.baseline.monthlySales)}, saved product costs ${businessMoney(h.baseline.monthlyProductCost)}, operating expenses ${businessMoney(h.baseline.monthlyOperatingExpenses)}.`; }
    catch (e) { historySummary = e instanceof Error ? e.message : 'Historical inputs are unavailable.'; }
  }
  return <div className="investor-proposal">
    <section className="panel insights-panel" aria-labelledby="investor-proposal-title">
      <p className="panel-kicker">OWNER DOCUMENT TOOL</p><h2 id="investor-proposal-title">Investor Proposal Generator</h2>
      <p>Prepare an investor proposal with three estimated outcomes, a clear profit-sharing calculation, and a payout limit. Generating a proposal does not record an actual investment or payment.</p>
      <fieldset className="insights-fieldset" disabled={locked}><legend>1. Proposed investment terms</legend>
        <div className="insights-form-grid">{textField('investorName', 'Investor name')}
          <label className="field"><span>Proposal date</span><input type="date" value={draft.proposalDate} onChange={e => change('proposalDate', e.target.value)} /></label>
          <label className="field"><span>Projected start month</span><input type="month" min="2000-01" max="2100-12" value={draft.startMonth} onChange={e => change('startMonth', e.target.value)} /></label>
          {numbers.map(([key, label, min, max, step]) => <label className="field" key={key}><span>{label}</span><input aria-label={label} type="number" min={min} max={max} step={step} value={Number(draft[key])} onChange={e => change(key, Number(e.target.value))} /></label>)}
          {textField('purpose', 'Proposed use of investment', true)}
        </div>
        <p className="insights-callout">The business reserve is set aside first. The investor's percentage applies to the remaining profit. Total payouts include recovery of the original capital; there is no extra automatic principal refund. Losses during the modeled term are recovered before profit-sharing resumes.</p>
      </fieldset>
      <fieldset className="insights-fieldset" disabled={locked}><legend>2. Choose the projection source</legend>
        <label className="field"><span>Projection source</span><select aria-label="Projection source" value={draft.source} onChange={e => {
          const source = e.target.value as InvestorProposalDraft['source'];
          onChange({ ...draft, source, scenarios: draft.scenarios.map(s => ({ ...s, monthlyGrowthPercent: source === 'forecast' ? (sourceForecast?.monthlyGrowthPercent ?? 0) : s.monthlyGrowthPercent })) });
        }}><option value="manual">Manual monthly assumptions</option><option value="history">Recorded business history</option><option value="forecast">Existing business forecast</option></select></label>
        {draft.source === 'manual' && <div className="insights-form-grid">{([
          ['monthlySales', 'Assumed monthly sales (PHP)'], ['monthlyProductCost', 'Assumed monthly product costs (PHP)'], ['monthlyOperatingExpenses', 'Assumed monthly operating expenses (PHP)'],
        ] as const).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input aria-label={label} type="number" min="0" max="1000000000" step=".01" value={draft.manual[key]} onChange={e => change('manual', { ...draft.manual, [key]: Number(e.target.value) })} /></label>)}</div>}
        {draft.source === 'history' && <><div className="insights-form-grid"><label className="field"><span>Historical from date</span><input type="date" value={draft.historyFrom} onChange={e => change('historyFrom', e.target.value)} /></label><label className="field"><span>Historical to date</span><input type="date" value={draft.historyTo} onChange={e => change('historyTo', e.target.value)} /></label><button className="button button-secondary" type="button" onClick={() => { const dates = emptyInvestorProposal(draft.proposalDate); onChange({ ...draft, historyFrom: dates.historyFrom, historyTo: dates.historyTo }); }}>Last 3 complete months</button></div>
          <p>Complete months only. The baseline uses saved sales and historical product costs, including zero-activity months. Missing costs are not replaced by current prices or assumed zero.</p>
          {historyBusy && <p role="status">Reviewing historical sales and expenses…</p>}{historySummary && <p className="insights-callout">{historySummary}</p>}{historyError && <p role="alert" className="feedback feedback-error">{historyError}</p>}
          <label className="insights-check"><input type="checkbox" checked={draft.expensesReviewed} onChange={e => change('expensesReviewed', e.target.checked)} />I reviewed expense coverage, including zero-expense months, and checked for labor/overhead already included in product costs.</label>
        </>}
        {draft.source === 'forecast' && <><label className="field"><span>Source business forecast</span><select aria-label="Source business forecast" value={draft.forecastScenarioId} onChange={e => {
          const source = workspace.scenarios.find(s => s.id === e.target.value);
          onChange({ ...draft, forecastScenarioId: e.target.value, scenarios: draft.scenarios.map(s => ({ ...s, monthlyGrowthPercent: source?.monthlyGrowthPercent ?? 0 })) });
        }}><option value="">Choose a saved forecast</option>{workspace.scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <p>Reuses the selected forecast's selling price, variable costs, fixed expenses, and monthly production capacity. Review these inputs in Forecast. The investor scenarios use the proposal's start month and the adjustments below.</p></>}
        <div className="insights-form-grid">{textField('sourceNotes', 'Assumptions and financial record coverage', true)}</div>
      </fieldset>
      <fieldset className="insights-fieldset" disabled={locked}><legend>3. Conservative, moderate and optimistic assumptions</legend>
        <p>Initial volume factors of 80%, 100% and 120% are illustrative planning assumptions. They are editable and are not growth rates inferred from your sales. Product costs scale with volume; operating expenses remain fixed.</p>
        <div className="investor-scenario-inputs">{draft.scenarios.map(s => <section key={s.id} aria-label={`${INVESTOR_SCENARIO_LABELS[s.id]} assumptions`}><h3>{INVESTOR_SCENARIO_LABELS[s.id]}</h3>
          {([['salesPercent', 'Sales-volume factor (%)', 0, 500], ['costPercent', 'Product-cost factor (%)', 0, 500], ['monthlyGrowthPercent', 'Monthly volume growth (%)', -50, 100]] as const).map(([key, label, min, max]) => <label className="field" key={key}><span>{label}</span><input aria-label={`${INVESTOR_SCENARIO_LABELS[s.id]} ${label}`} type="number" min={min} max={max} step=".01" value={s[key]} onChange={e => change('scenarios', draft.scenarios.map(row => row.id === s.id ? { ...row, [key]: Number(e.target.value) } : row))} /></label>)}
        </section>)}</div>
        <div className="insights-form-grid">{textField('risks', 'Risks specific to this proposal', true)}{textField('conditions', 'Additional investment conditions', true)}</div>
      </fieldset>
      <aside className="insights-callout"><strong>Estimated earnings, not guaranteed payments</strong><p>{INVESTOR_CONDITIONS}</p></aside>
    </section>
    <section className="panel insights-panel" aria-labelledby="investor-outcomes-title"><h2 id="investor-outcomes-title">Projected investor payouts &amp; gain</h2>
      {calculation.error ? <p className="insights-callout">{calculation.error}</p> : <>
        <div className="investor-outcomes">{calculation.cases.map(c => <article key={c.id} aria-label={`${c.name} investor projection`}><h3>{c.name}</h3><span>Estimated total payout</span><strong>{businessMoney(c.totalPayout)}</strong><p>Average per month: {businessMoney(c.averageMonthlyPayout)}<br />First {c.years[0].months} months: {businessMoney(c.firstYearPayout)}<br />Net gain after capital: {businessMoney(c.netGain)} ({c.gainPercent.toFixed(1)}%)<br />Capital recovery: {c.recoveryMonths === null ? 'Not within term' : `month ${c.recoveryMonths} · ${c.recoveryMonth}`}<br />Unrecovered capital: {businessMoney(c.unrecoveredCapital)}</p></article>)}</div>
        <p>Average monthly figures include zero-payment months. Once the cumulative cap is reached, projected payouts stop. View the full monthly and annual breakdown in the proposal preview.</p>
      </>}
      <div className="insights-actions"><button type="button" className="button button-primary" disabled={locked || !historyReady || !calculation.snapshot} onClick={() => void action('preview', () => { setPreview(buildPreview()); setSaved(false); })}>Preview investor proposal</button>
        {preview && <button type="button" className="button button-secondary" disabled={locked || !historyReady || saved} onClick={() => void action('save', async () => { const result = await saveDocument(preview); if (result && mounted.current) { setPreview(result); setSaved(true); } })}>{saved ? 'Proposal saved' : 'Save proposal snapshot'}</button>}
      </div>
      {preview && <><div className="insights-actions"><button type="button" className="button button-primary" disabled={locked || !historyReady} onClick={() => void action('pdf', async () => { const { businessDocumentPdf } = await import('../../application/insights/businessDocumentPdf'); downloadBusinessFile(await businessDocumentPdf(preview), `${businessFilename(preview)}.pdf`); })}>Download investor PDF</button>
        <button type="button" className="button button-secondary" disabled={locked || !historyReady} onClick={() => void action('word', async () => downloadBusinessFile(await businessDocumentWord(preview), `${businessFilename(preview)}.docx`))}>Download investor Word (.docx)</button></div>
        <p className="insights-muted">{saved ? 'Saved in SQLite. Reopen this frozen proposal from Documents.' : 'Preview of current inputs. Save a snapshot to retain it in Documents and SQLite backups.'} PDF and Word files can be printed or attached in Messenger or email.</p>
        <iframe title="Investor proposal preview" className="insights-document-preview" sandbox="" srcDoc={previewHtml} />
      </>}
      {busy && <p role="status">{busy === 'pdf' ? 'Preparing downloadable PDF…' : busy === 'word' ? 'Preparing editable Word proposal…' : 'Preparing proposal…'}</p>}{error && <p role="alert" className="feedback feedback-error">{error}</p>}
    </section>
  </div>;
}
