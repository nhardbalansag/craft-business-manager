import { memo } from 'react';
import type { ProposalLine } from '../../domain/businessInsights';

interface ItemActions { update: (line: ProposalLine) => void; remove: (id: string) => void }
const ProposalItemRow = memo(function ProposalItemRow({ line, update, remove }: ItemActions & { line: ProposalLine }) {
  return <tr><td><strong>{line.name}</strong><small>{line.productId}</small></td>
    <td><input aria-label={`Quantity for ${line.name}`} type="number" min="1" max="1000000" step="1" value={line.quantity} onChange={e => update({ ...line, quantity: Number(e.target.value), unitPrice: null, priceSource: 'Quantity changed; confirm selling price' })} /></td>
    <td><input aria-label={`Unit price for ${line.name}`} type="number" min="0" max="1000000000" step="0.01" value={line.unitPrice ?? ''} placeholder="Required" onChange={e => update({ ...line, unitPrice: e.target.value === '' ? null : Number(e.target.value), priceSource: 'Manually entered selling price', tierId: '' })} /></td>
    <td><small>{line.priceSource}</small></td><td><button type="button" className="button button-secondary" aria-label={`Unselect ${line.name}`} onClick={() => remove(line.productId)}>Remove</button></td></tr>;
});

/** Editing terms leaves this table alone; editing one price leaves the other rows alone. */
export const BusinessProposalItems = memo(function BusinessProposalItems({ items, update, remove }: ItemActions & { items: ProposalLine[] }) {
  return <div className="insights-table-wrap"><table><thead><tr><th>Product / code</th><th>Quantity</th><th>Unit price (PHP)</th><th>Price source</th><th>Action</th></tr></thead>
    <tbody>{items.map(line => <ProposalItemRow key={line.productId} line={line} update={update} remove={remove} />)}</tbody></table></div>;
});
