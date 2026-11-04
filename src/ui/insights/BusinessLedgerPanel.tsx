import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import { businessDay, LEDGER_KINDS, LEDGER_LABELS, type BusinessLedgerEntry } from '../../domain/businessInsights';
import { businessMoney } from '../../application/insights/businessDocuments';

const blank = (): BusinessLedgerEntry => ({ id: crypto.randomUUID(), date: businessDay(), cashDate: businessDay(), kind: 'operating-expense', category: '', description: '', amount: 0, paid: true, reference: '' });
export function BusinessLedgerPanel({ ledger, save, disabled }: { ledger: BusinessLedgerEntry[]; save: (entries: BusinessLedgerEntry[]) => Promise<boolean>; disabled: boolean }) {
  const [draft, setDraft] = useState(blank), [editing, setEditing] = useState(false), [query, setQuery] = useState('');
  const [kind, setKind] = useState('all'), [from, setFrom] = useState(''), [to, setTo] = useState(''), [limit, setLimit] = useState(25), [removing, setRemoving] = useState<string | null>(null);
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const rows = useMemo(() => ledger.filter(e => (!from || e.date >= from) && (!to || e.date <= to) && (kind === 'all' || e.kind === kind) &&
    `${e.description} ${e.category} ${e.reference}`.toLowerCase().includes(deferred)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), [ledger, from, to, kind, deferred]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await save([draft, ...ledger.filter(row => row.id !== draft.id)])) { setDraft(blank()); setEditing(false); }
  }
  return <>
    <section className="panel insights-panel" aria-labelledby="expense-title"><h2 id="expense-title">Expenses &amp; cash ledger</h2>
      <p className="insights-muted">Operating expenses affect the indicative result. Inventory, equipment, funding, and owner movements affect cash only. Record each movement once; avoid duplicating costs already included in saved product costs or transaction adjustments.</p>
      <form onSubmit={e => void submit(e)}><fieldset disabled={disabled} className="insights-fieldset"><legend>{editing ? 'Edit ledger entry' : 'Add a ledger entry'}</legend><div className="insights-form-grid">
        <label className="field"><span>Entry type</span><select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as BusinessLedgerEntry['kind'] })}>{LEDGER_KINDS.map(k => <option key={k} value={k}>{LEDGER_LABELS[k]}</option>)}</select></label>
        <label className="field"><span>Entry date (SGT)</span><input type="date" value={draft.date} required onChange={e => setDraft({ ...draft, date: e.target.value, cashDate: draft.cashDate === draft.date ? e.target.value : draft.cashDate })} /></label>
        <label className="field"><span>Amount (PHP)</span><input type="number" min="0.01" max="1000000000" step="0.01" required value={draft.amount || ''} onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
        <label className="field"><span>Description</span><input value={draft.description} maxLength={1000} required onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="e.g. November studio rent" /></label>
        <label className="field"><span>Expense category / tag</span><input list="business-expense-categories" value={draft.category} maxLength={100} onChange={e => setDraft({ ...draft, category: e.target.value })} /><datalist id="business-expense-categories">{['Rent', 'Utilities', 'Marketing', 'Delivery', 'Wages', 'Fees', 'Other'].map(v => <option key={v} value={v} />)}</datalist></label>
        <label className="field"><span>Reference / invoice number</span><input value={draft.reference} maxLength={300} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label>
        <label className="insights-check insights-wide"><input type="checkbox" checked={draft.paid} onChange={e => setDraft({ ...draft, paid: e.target.checked })} />Money has moved (paid / received)</label>
        {draft.paid && <label className="field"><span>Cash movement date (SGT)</span><input type="date" value={draft.cashDate} required onChange={e => setDraft({ ...draft, cashDate: e.target.value })} /></label>}
      </div><div className="insights-actions"><button type="submit" className="button button-primary">Save ledger entry</button>{editing && <button type="button" className="button button-secondary" onClick={() => { setDraft(blank()); setEditing(false); }}>Cancel editing</button>}</div></fieldset></form>
    </section>
    <section className="panel insights-panel" aria-labelledby="ledger-records-title"><h2 id="ledger-records-title">Saved ledger entries</h2><div className="insights-form-grid">
      <label className="field"><span>Search ledger</span><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(25); }} /></label>
      <label className="field"><span>Ledger entry type</span><select value={kind} onChange={e => { setKind(e.target.value); setLimit(25); }}><option value="all">All entry types</option>{LEDGER_KINDS.map(k => <option key={k} value={k}>{LEDGER_LABELS[k]}</option>)}</select></label>
      <label className="field"><span>Ledger from date</span><input type="date" value={from} onChange={e => { setFrom(e.target.value); setLimit(25); }} /></label><label className="field"><span>Ledger to date</span><input type="date" value={to} onChange={e => { setTo(e.target.value); setLimit(25); }} /></label>
    </div><div className="insights-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type / category</th><th>Amount</th><th>Cash status</th><th>Actions</th></tr></thead><tbody>{rows.slice(0, limit).map(entry => <tr key={entry.id}>
      <td>{entry.date}</td><td><strong>{entry.description}</strong><small>{entry.reference}</small></td><td>{LEDGER_LABELS[entry.kind]}<small>{entry.category}</small></td><td>{businessMoney(entry.amount)}</td><td>{entry.paid ? `Paid / received ${entry.cashDate}` : 'No cash movement yet'}</td>
      <td><div className="insights-actions"><button type="button" className="button button-secondary" disabled={disabled} aria-label={`Edit ${entry.description}`} onClick={() => { setDraft({ ...entry }); setEditing(true); }}>Edit</button>
        {removing === entry.id ? <><button type="button" className="button button-secondary" disabled={disabled} onClick={async () => { if (await save(ledger.filter(e => e.id !== entry.id))) setRemoving(null); }}>Confirm removal</button><button type="button" className="button button-secondary" onClick={() => setRemoving(null)}>Keep entry</button></> : <button type="button" className="button button-secondary" disabled={disabled} aria-label={`Remove ${entry.description}`} onClick={() => setRemoving(entry.id)}>Remove</button>}</div></td>
    </tr>)}</tbody></table></div>{!rows.length && <p>No ledger entries match. Add an expense or adjust the filters.</p>}{rows.length > limit && <button type="button" className="button button-secondary" onClick={() => setLimit(limit + 25)}>Show more entries</button>}<small>{rows.length} matching entries</small>
    </section>
  </>;
}
