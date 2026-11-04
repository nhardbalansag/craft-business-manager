import type { BusinessProfile } from '../../domain/businessInsights';
import { businessMoney, fundingAllocated } from '../../application/insights/businessDocuments';

export function BusinessProfileForm({ profile, onChange, disabled }: { profile: BusinessProfile; onChange: (p: BusinessProfile) => void; disabled: boolean }) {
  let allocated: number | null = null;
  try { allocated = fundingAllocated(profile); } catch { /* Invalid working input is reported by persistence validation. */ }
  const field = (key: keyof BusinessProfile, label: string, multiline = false, hint?: string) => <label className={`field ${multiline ? 'insights-wide' : ''}`} key={key}><span>{label}</span>
    {multiline ? <textarea aria-label={label} aria-describedby={hint ? `business-profile-${key}-hint` : undefined} rows={3} maxLength={4000} value={String(profile[key])} disabled={disabled} onChange={e => onChange({ ...profile, [key]: e.target.value })} /> :
      <input aria-label={label} aria-describedby={hint ? `business-profile-${key}-hint` : undefined} value={String(profile[key])} maxLength={4000} disabled={disabled} onChange={e => onChange({ ...profile, [key]: e.target.value })} />}
    {hint && <small id={`business-profile-${key}-hint`}>{hint}</small>}</label>;
  return <section className="panel insights-panel" aria-labelledby="business-profile-title"><h2 id="business-profile-title">Business profile &amp; funding</h2>
    <p className="insights-muted">These details populate your investor summary, business plan, and customer proposals. Changes save automatically.</p>
    <div className="insights-form-grid">
      {field('name', 'Business name')}{field('contact', 'Business contact')}{field('website', 'Website')}
      {field('description', 'Business description', true)}{field('market', 'Target market and evidence', true, 'Include the source and date of external market statistics.')}
      {field('advantage', 'Competitive advantage', true)}{field('traction', 'Traction and achievements', true, 'Founder-reported claims appear separately from recorded sales.')}
      {field('team', 'Founder / team background', true)}{field('milestones', 'Growth milestones', true)}{field('risks', 'Risks and mitigation', true)}
      {field('financialNotes', 'Financial record coverage and assumptions', true, 'Explain the periods covered, missing expenses, and any allocated labor or overhead in saved product costs.')}
    </div>
    <h3>Funding request</h3><div className="insights-form-grid">
      <label className="field"><span>Requested funding (PHP)</span><input type="number" min="0" max="1000000000" step="0.01" value={profile.fundingAmount} disabled={disabled} onChange={e => onChange({ ...profile, fundingAmount: Number(e.target.value) })} /></label>
      <p>Allocated: <strong>{businessMoney(allocated)}</strong> / {businessMoney(profile.fundingAmount)}{allocated !== profile.fundingAmount && <small className="insights-warning"> Allocate the full funding request before sharing.</small>}</p>
    </div>
    {profile.fundingUses.map((use, index) => <div className="insights-funding-row" key={index}>
      <label className="field"><span>Use of funds {index + 1}</span><input value={use.purpose} maxLength={500} disabled={disabled} onChange={e => onChange({ ...profile, fundingUses: profile.fundingUses.map((u, i) => i === index ? { ...u, purpose: e.target.value } : u) })} /></label>
      <label className="field"><span>Allocation {index + 1} (PHP)</span><input type="number" min="0" max="1000000000" step="0.01" value={use.amount} disabled={disabled} onChange={e => onChange({ ...profile, fundingUses: profile.fundingUses.map((u, i) => i === index ? { ...u, amount: Number(e.target.value) } : u) })} /></label>
      <button className="button button-secondary" type="button" disabled={disabled} aria-label={`Remove funding use ${index + 1}`} onClick={() => onChange({ ...profile, fundingUses: profile.fundingUses.filter((_, i) => i !== index) })}>Remove</button>
    </div>)}
    <button type="button" className="button button-secondary" disabled={disabled || profile.fundingUses.length >= 30} onClick={() => onChange({ ...profile, fundingUses: [...profile.fundingUses, { purpose: '', amount: 0 }] })}>Add use of funds</button>
    <h3>Cash starting point</h3><p className="insights-muted">Optional cash balance at the start of the date below. Tracked balances include only saved customer movements and paid ledger entries from that date.</p>
    <div className="insights-form-grid">
      <label className="field"><span>Opening cash (PHP, optional)</span><input type="number" min="0" max="1000000000" step="0.01" value={profile.openingCash ?? ''} disabled={disabled} placeholder="Not recorded" onChange={e => onChange({ ...profile, openingCash: e.target.value === '' ? null : Number(e.target.value) })} /></label>
      <label className="field"><span>Opening cash date (SGT)</span><input type="date" value={profile.cashAsOf} disabled={disabled} onChange={e => onChange({ ...profile, cashAsOf: e.target.value })} /></label>
    </div>
  </section>;
}
