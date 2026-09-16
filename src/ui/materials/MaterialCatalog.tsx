import { useMemo, useState, type Ref } from 'react';
import { MATERIAL_GROUPS, type Material, type MaterialGroup } from '../../domain/materials';
import { matchesMaterialSearch, type MaterialInventoryRow, type MaterialStockFilter } from './materialInventoryView';

interface MaterialCatalogProps {
  headingRef: Ref<HTMLHeadingElement>;
  rows: readonly MaterialInventoryRow[];
  loading: boolean;
  loadFailed: boolean;
  disabled: boolean;
  stockFilter: MaterialStockFilter;
  onStockFilter: (filter: MaterialStockFilter) => void;
  onEdit: (material: Material) => void;
  onNew: () => void;
  onToggleActive: (material: Material) => void;
}

const money = (value: number) =>
  `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });
const groupLabel = (group: string) => group[0].toUpperCase() + group.slice(1);

export function MaterialCatalog({
  headingRef,
  rows,
  loading,
  loadFailed,
  disabled,
  stockFilter,
  onStockFilter,
  onEdit,
  onNew,
  onToggleActive,
}: MaterialCatalogProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MaterialGroup | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [sort, setSort] = useState<'name' | 'value'>('name');
  const visible = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (status === 'all' || row.material.isActive === (status === 'active')) &&
            (group === 'all' || row.material.group === group) &&
            (stockFilter === 'all' || row.stockState === stockFilter) &&
            matchesMaterialSearch(row.material, query),
        )
        .sort((a, b) => {
          if (sort === 'value') {
            if (a.valuation === null && b.valuation !== null) return 1;
            if (b.valuation === null && a.valuation !== null) return -1;
            const difference = (b.valuation?.inventoryValue ?? 0) - (a.valuation?.inventoryValue ?? 0);
            if (difference !== 0) return difference;
          }
          return (
            a.material.name.localeCompare(b.material.name, undefined, { sensitivity: 'base' }) ||
            a.material.id.localeCompare(b.material.id)
          );
        }),
    [rows, status, group, stockFilter, query, sort],
  );
  const filtered = query !== '' || group !== 'all' || status !== 'active' || stockFilter !== 'all';
  function clearFilters() {
    setQuery('');
    setGroup('all');
    setStatus('active');
    onStockFilter('all');
  }

  return (
    <section className="panel material-inventory-catalog" aria-label="Material inventory" aria-busy={loading}>
      <div className="panel-heading list-heading">
        <div>
          <p className="panel-kicker">YOUR SUPPLIES</p>
          <h2 ref={headingRef} tabIndex={-1}>
            Material inventory
          </h2>
        </div>
        <button type="button" className="button button-primary" disabled={disabled} onClick={onNew}>
          + New material
        </button>
      </div>
      <div className="material-inventory-filters">
        <label className="field material-search">
          <span className="sr-only">Search materials</span>
          <input
            type="search"
            placeholder="Search material, supplier, source, or notes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Group</span>
          <select value={group} onChange={(event) => setGroup(event.target.value as typeof group)}>
            <option value="all">All groups</option>
            {MATERIAL_GROUPS.map((value) => (
              <option key={value} value={value}>
                {groupLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <label className="field">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="name">Name A to Z</option>
            <option value="value">Stock value: highest first</option>
          </select>
        </label>
      </div>
      <div className="material-stock-filters" role="group" aria-label="Stock filters">
        {(
          [
            { id: 'all', label: 'All stock' },
            { id: 'in-stock', label: 'In stock' },
            { id: 'out-of-stock', label: 'Out of stock' },
            { id: 'needs-attention', label: 'Check conversions' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={stockFilter === item.id}
            onClick={() => onStockFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        {filtered && (
          <button type="button" className="text-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      <p className="material-results" role="status">
        {loadFailed
          ? 'Inventory could not be refreshed'
          : loading
            ? 'Loading your materials...'
            : `${visible.length} of ${rows.length} materials shown`}
      </p>
      {loadFailed ? (
        <div className="empty-state">
          <h3>Inventory unavailable</h3>
          <p>Use Retry loading above to refresh materials and calibrations.</p>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <p>Loading materials and conversions...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>Start with your first supply</h3>
          <p>Record what you buy and what you have on hand. Unit costs and stock value are calculated for you.</p>
          <button className="button button-quiet" type="button" disabled={disabled} onClick={onNew}>
            Add your first material
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <h3>No matching materials</h3>
          <p>Try another search, group, status, or stock filter.</p>
          <button className="button button-quiet" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="table-wrap" role="region" aria-label="Scrollable material inventory" tabIndex={0}>
          <table className="materials-table material-inventory-table">
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">On hand</th>
                <th scope="col">Unit cost</th>
                <th scope="col">Stock value</th>
                <th scope="col">Supplier</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const { material, costing, stock, valuation } = row;
                return (
                  <tr key={material.id}>
                    <td>
                      <strong>{material.name}</strong>
                      <span className="material-id">{material.id}</span>
                      <span className="material-group-tag">{groupLabel(material.group)}</span>
                      {!material.isActive && <span className="material-stock-badge stock-archived">Archived</span>}
                    </td>
                    <td>
                      <strong>
                        {stock ? `${number(stock.normalizedBaseQuantity)} ${material.baseUnit}` : 'Unavailable'}
                      </strong>
                      <small className="material-fact">
                        Entered {number(material.onHandQuantity)} {material.onHandUnit}
                      </small>
                      <span className={`material-stock-badge stock-${row.stockState}`}>
                        {row.stockState === 'needs-attention'
                          ? 'Check conversion'
                          : row.stockState === 'out-of-stock'
                            ? 'Out of stock'
                            : 'In stock'}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {costing ? `${money(costing.costPerBaseUnit)} / ${material.baseUnit}` : 'Unavailable'}
                      </strong>
                      <small className="material-fact">
                        {money(material.packageCost)} for {number(material.purchaseQuantity)} {material.purchaseUnit}
                      </small>
                      <details>
                        <summary>Conversion details</summary>
                        <p>
                          {costing
                            ? `1 ${material.purchaseUnit} = ${number(costing.effectiveBaseUnitsPerPurchaseUnit)} ${material.baseUnit} (${costing.effectiveConversionSource})`
                            : 'Purchase conversion is unresolved.'}
                        </p>
                        {stock && (
                          <p>
                            Stock uses {stock.conversionSource} conversion
                            {stock.calibrationId ? ` (${stock.calibrationId})` : ''}.
                          </p>
                        )}
                        {row.issues.map((issue) => (
                          <p className="material-conversion-issue" key={issue}>
                            {issue}
                          </p>
                        ))}
                      </details>
                    </td>
                    <td>
                      <strong>{valuation ? money(valuation.inventoryValue) : 'Unavailable'}</strong>
                    </td>
                    <td>
                      <strong>{material.source?.vendorName ?? 'Not recorded'}</strong>
                      {material.source?.source && <small className="material-fact">{material.source.source}</small>}
                      {material.source?.purchaseLink && (
                        <a
                          className="source-link"
                          href={material.source.purchaseLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Re-order ${material.name}`}
                        >
                          Re-order &rarr;
                        </a>
                      )}
                      {(material.source?.contactNumber ||
                        material.source?.socialPage ||
                        material.source?.notes ||
                        material.notes) && (
                        <details>
                          <summary>Contact &amp; notes</summary>
                          {material.source?.contactNumber && <p>{material.source.contactNumber}</p>}
                          {material.source?.socialPage && <p>{material.source.socialPage}</p>}
                          {material.source?.notes && <p>{material.source.notes}</p>}
                          {material.notes && <p>{material.notes}</p>}
                        </details>
                      )}
                    </td>
                    <td>
                      <div className="material-inventory-actions">
                        <button
                          type="button"
                          className="button button-quiet"
                          disabled={disabled}
                          aria-label={`Edit ${material.name}`}
                          onClick={() => onEdit(material)}
                        >
                          Edit material
                        </button>
                        <button
                          type="button"
                          className={`text-button ${material.isActive ? 'danger' : ''}`}
                          disabled={disabled}
                          aria-label={`${material.isActive ? 'Archive' : 'Restore'} ${material.name}`}
                          onClick={() => onToggleActive(material)}
                        >
                          {material.isActive ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <footer className="list-footer">
        <span>Unit costs and stock values use saved purchase data and material calibrations.</span>
        <span>Stock filters use recorded quantities.</span>
      </footer>
    </section>
  );
}
