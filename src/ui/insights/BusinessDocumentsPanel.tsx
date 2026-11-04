import { useMemo, useState } from 'react';
import type { BusinessDocument, BusinessWorkspace } from '../../domain/businessInsights';
import { businessDocumentCsv, businessDocumentPack, businessDocumentWord, businessFilename, downloadBusinessFile, investorReadiness, printBusinessDocument, renderBusinessDocument } from '../../application/insights/businessDocuments';
import type { BusinessReport } from '../../domain/businessInsights';

export function BusinessDocumentsPanel({ workspace, report, disabled, generate, remove }: {
  workspace: BusinessWorkspace; report: BusinessReport | null; disabled: boolean;
  generate: (kind: BusinessDocument['kind'], title: string, scenarioId: string) => Promise<BusinessDocument | null>;
  remove: (id: string) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<BusinessDocument['kind']>('business-report'), [title, setTitle] = useState('Business performance report');
  const [scenarioId, setScenarioId] = useState(workspace.scenarios[1]?.id ?? workspace.scenarios[0].id);
  const [selectedId, setSelectedId] = useState(workspace.documents[0]?.id ?? ''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [removing, setRemoving] = useState(false);
  const selected = workspace.documents.find(d => d.id === selectedId) ?? workspace.documents[0];
  const preview = useMemo(() => { try { return { html: selected ? renderBusinessDocument(selected) : '', error: '' }; } catch (e) { return { html: '', error: e instanceof Error ? e.message : 'Could not render document' }; } }, [selected]);
  const gaps = useMemo(() => {
    try { return investorReadiness(workspace.profile, !!report?.metrics.orders, report?.metrics.unknownCostReceipts ?? 0); }
    catch { return ['Complete valid business profile amounts.']; }
  }, [workspace.profile, report]);
  async function action(name: string, fn: () => void | Promise<void>) {
    if (busy) return; setBusy(name); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'The document operation failed.'); }
    finally { setBusy(''); }
  }
  async function create() {
    const doc = await generate(kind, title, scenarioId);
    if (doc) { setSelectedId(doc.id); setRemoving(false); }
  }
  return <>
    <section className="panel insights-panel" aria-labelledby="documents-title"><h2 id="documents-title">Reports, investor documents &amp; proposals</h2><p className="insights-muted">Generate a frozen snapshot from the selected report period, saved business profile, and your chosen forecast. Review it before sharing.</p>
      <div className="insights-form-grid"><label className="field"><span>Document type</span><select disabled={disabled || !!busy} value={kind} onChange={e => { const k = e.target.value as BusinessDocument['kind']; setKind(k); setTitle(k === 'proposal' ? workspace.proposal.title : k === 'investor-summary' ? 'Investor summary' : k === 'business-plan' ? 'Business and growth plan' : 'Business performance report'); }}><option value="business-report">Business performance report</option><option value="investor-summary">Investor summary</option><option value="business-plan">Business and growth plan</option><option value="proposal">Corporate / event / reseller proposal</option></select></label>
        <label className="field"><span>Document title</span><input maxLength={300} value={title} disabled={disabled || !!busy} onChange={e => setTitle(e.target.value)} /></label>
        {kind !== 'business-report' && kind !== 'proposal' && <label className="field"><span>Document forecast scenario</span><select value={scenarioId} disabled={disabled || !!busy} onChange={e => setScenarioId(e.target.value)}>{workspace.scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      </div>
      {kind === 'proposal' ? <p>Uses the products, prices, pictures, recipient, and terms configured in the Proposals tab.</p> : <p>Period: {report ? `${report.from} to ${report.to} (SGT)` : 'Choose valid report dates above.'}</p>}
      {['investor-summary', 'business-plan'].includes(kind) && gaps.length > 0 && <details className="insights-callout" open><summary>Preparation checklist · {gaps.length} items</summary><ul>{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul><small>Documents include these gaps until the underlying information is completed.</small></details>}
      <button type="button" className="button button-primary" disabled={disabled || !!busy || (!report && kind !== 'proposal')} onClick={() => void action('generate', create)}>Generate &amp; save document</button>
    </section>
    <section className="panel insights-panel" aria-labelledby="saved-documents-title"><h2 id="saved-documents-title">Saved document snapshots</h2><p className="insights-muted">Snapshots preserve their figures, written content, and selected pictures even when your business records change. Up to 40 documents are retained in SQLite and included in backups.</p>
      {!workspace.documents.length ? <p>No documents yet. Generate your first report or proposal above.</p> : <>
        <label className="field"><span>Saved document</span><select value={selected?.id ?? ''} onChange={e => { setSelectedId(e.target.value); setRemoving(false); setError(''); }}>{workspace.documents.map(d => <option key={d.id} value={d.id}>{d.title} · {d.generatedAt.slice(0, 10)}</option>)}</select></label>
        {selected && <><div className="insights-actions">
          <button type="button" className="button button-primary" disabled={!!busy || !!preview.error} onClick={() => { setError(''); try { printBusinessDocument(selected); } catch (e) { setError(e instanceof Error ? e.message : 'Print failed'); } }}>Print / Save PDF</button>
          {selected.kind === 'investor-proposal' && <button type="button" className="button button-primary" disabled={!!busy || !!preview.error} onClick={() => void action('pdf', async () => { const { businessDocumentPdf } = await import('../../application/insights/businessDocumentPdf'); downloadBusinessFile(await businessDocumentPdf(selected), `${businessFilename(selected)}.pdf`); })}>Download investor PDF</button>}
          <button type="button" className="button button-secondary" disabled={!!busy || !!preview.error} onClick={() => void action('word', async () => downloadBusinessFile(await businessDocumentWord(selected), `${businessFilename(selected)}.docx`))}>Download Word (.docx)</button>
          <button type="button" className="button button-secondary" disabled={!!busy || !!preview.error} onClick={() => void action('pack', async () => downloadBusinessFile(await businessDocumentPack(selected), `${businessFilename(selected)}-pack.zip`))}>Download document pack (.zip)</button>
          <button type="button" className="button button-secondary" disabled={!!busy || !!preview.error} onClick={() => void action('csv', () => downloadBusinessFile(new Blob([businessDocumentCsv(selected)], { type: 'text/csv;charset=utf-8' }), `${businessFilename(selected)}.csv`))}>Download figures (.csv)</button>
          <button type="button" className="button button-secondary" disabled={!!busy || !!preview.error} onClick={() => downloadBusinessFile(new Blob([preview.html], { type: 'text/html;charset=utf-8' }), `${businessFilename(selected)}.html`)}>Download HTML</button>
          <button type="button" className="button button-secondary" disabled={disabled || !!busy} onClick={() => setRemoving(true)}>Remove snapshot</button>
        </div>{removing && <div className="insights-callout"><p>Remove this saved snapshot? Download it first if you want to keep a copy.</p><div className="insights-actions"><button type="button" className="button button-secondary" disabled={disabled || !!busy} onClick={() => void action('remove', async () => { if (await remove(selected.id)) { setSelectedId(''); setRemoving(false); } })}>Confirm snapshot removal</button><button type="button" className="button button-secondary" onClick={() => setRemoving(false)}>Keep snapshot</button></div></div>}
          <p className="insights-muted">Generated {new Date(selected.generatedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT · Sales revision {selected.historyRevision} · Business revision {selected.businessRevision}</p>
          {preview.html && <iframe title="Business document preview" className="insights-document-preview" sandbox="" srcDoc={preview.html} />}
        </>}
      </>}
      {!!busy && <p role="status">{busy === 'word' ? 'Preparing editable Word document…' : 'Preparing document…'}</p>}{(error || preview.error) && <p role="alert" className="feedback feedback-error">{error || preview.error}</p>}
    </section>
  </>;
}
