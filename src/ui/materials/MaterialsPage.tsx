import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  MATERIAL_GROUPS,
  MATERIAL_PACKAGE_UNITS,
  MaterialContractError,
  isMaterialPackageUnit,
  type Material,
  type MaterialGroup,
  type MaterialPurchaseUnit,
} from '../../domain/materials';
import {
  MaterialCostingError,
  calculateMaterialPackageCosting,
  type MaterialPackageCosting,
} from '../../domain/materialCosting';
import {
  MaterialInventoryError,
  calculateMaterialInventoryValuation,
  normalizeMaterialOnHand,
  type MaterialInventoryValuation,
  type MaterialOnHandNormalization,
} from '../../domain/materialInventory';
import {
  SUPPORTED_UNITS,
  getUnitDimension,
  type BaseUnit,
  type Unit,
} from '../../domain/units';
import {
  MaterialApplicationError,
  MaterialService,
  type MaterialListFilter,
} from '../../application/materials/MaterialService';
import { InMemoryMaterialRepository } from '../../application/materials/InMemoryMaterialRepository';
import './materialCosting.css';

const materialRepository = new InMemoryMaterialRepository();
const materialService = new MaterialService(materialRepository);

const BASE_UNITS: BaseUnit[] = ['g', 'mL', 'pc'];

type ActiveFilter = 'active' | 'archived' | 'all';

type MaterialFormState = {
  id: string;
  name: string;
  group: MaterialGroup;
  baseUnit: BaseUnit;
  purchaseQuantity: string;
  purchaseUnit: MaterialPurchaseUnit;
  packageCost: string;
  manualBaseUnitsPerPurchaseUnit: string;
  onHandQuantity: string;
  onHandUnit: MaterialPurchaseUnit;
  notes: string;
};

const EMPTY_FORM: MaterialFormState = {
  id: '',
  name: '',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: '1',
  purchaseUnit: 'kg',
  packageCost: '0',
  manualBaseUnitsPerPurchaseUnit: '',
  onHandQuantity: '0',
  onHandUnit: 'g',
  notes: '',
};

function compatibleStandardUnits(baseUnit: BaseUnit): Unit[] {
  return SUPPORTED_UNITS.filter((unit) => getUnitDimension(unit) === getUnitDimension(baseUnit));
}

function purchaseUnitOptions(baseUnit: BaseUnit): MaterialPurchaseUnit[] {
  return [...compatibleStandardUnits(baseUnit), ...MATERIAL_PACKAGE_UNITS];
}

function onHandUnitOptions(baseUnit: BaseUnit, purchaseUnit: MaterialPurchaseUnit): MaterialPurchaseUnit[] {
  const standard = compatibleStandardUnits(baseUnit);
  return isMaterialPackageUnit(purchaseUnit) ? [...standard, purchaseUnit] : standard;
}

function defaultPurchaseUnit(baseUnit: BaseUnit): MaterialPurchaseUnit {
  switch (baseUnit) {
    case 'g':
      return 'kg';
    case 'mL':
      return 'L';
    case 'pc':
      return 'pc';
  }
}

function formatGroup(group: MaterialGroup): string {
  return group.replace(/(^|-)([a-z])/g, (_, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`);
}

function formatUnit(unit: MaterialPurchaseUnit): string {
  const labels: Partial<Record<MaterialPurchaseUnit, string>> = {
    g: 'g',
    kg: 'kg',
    oz: 'oz',
    lb: 'lb',
    mL: 'mL',
    L: 'L',
    cup: 'cup',
    tbsp: 'tbsp',
    tsp: 'tsp',
    'fl-oz': 'US fl oz',
    pc: 'pc',
  };
  return labels[unit] ?? unit;
}

function formatNumber(value: number, maximumFractionDigits = 6): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatMoney(value: number, maximumFractionDigits = 6): string {
  return `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })}`;
}

function materialToForm(material: Material): MaterialFormState {
  return {
    id: material.id,
    name: material.name,
    group: material.group,
    baseUnit: material.baseUnit,
    purchaseQuantity: String(material.purchaseQuantity),
    purchaseUnit: material.purchaseUnit,
    packageCost: String(material.packageCost),
    manualBaseUnitsPerPurchaseUnit: material.manualBaseUnitsPerPurchaseUnit === undefined
      ? ''
      : String(material.manualBaseUnitsPerPurchaseUnit),
    onHandQuantity: String(material.onHandQuantity),
    onHandUnit: material.onHandUnit,
    notes: material.notes ?? '',
  };
}

function formToMaterial(form: MaterialFormState, isActive: boolean): Material {
  return {
    id: form.id,
    name: form.name,
    group: form.group,
    baseUnit: form.baseUnit,
    purchaseQuantity: Number(form.purchaseQuantity),
    purchaseUnit: form.purchaseUnit,
    packageCost: Number(form.packageCost),
    manualBaseUnitsPerPurchaseUnit:
      form.manualBaseUnitsPerPurchaseUnit.trim() === ''
        ? undefined
        : Number(form.manualBaseUnitsPerPurchaseUnit),
    onHandQuantity: Number(form.onHandQuantity),
    onHandUnit: form.onHandUnit,
    notes: form.notes,
    isActive,
  };
}

function packageCostingOrNull(material: Material): MaterialPackageCosting | null {
  try {
    return calculateMaterialPackageCosting(material);
  } catch {
    return null;
  }
}

function onHandNormalizationOrNull(material: Material): MaterialOnHandNormalization | null {
  try {
    return normalizeMaterialOnHand(material);
  } catch {
    return null;
  }
}

function inventoryValuationOrNull(material: Material): MaterialInventoryValuation | null {
  try {
    return calculateMaterialInventoryValuation(material);
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (
    error instanceof MaterialApplicationError ||
    error instanceof MaterialContractError ||
    error instanceof MaterialCostingError ||
    error instanceof MaterialInventoryError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong while updating materials.';
}

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState<MaterialFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<MaterialGroup | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const purchaseOptions = useMemo(() => purchaseUnitOptions(form.baseUnit), [form.baseUnit]);
  const stockOptions = useMemo(
    () => onHandUnitOptions(form.baseUnit, form.purchaseUnit),
    [form.baseUnit, form.purchaseUnit],
  );
  const previewMaterial = useMemo(() => formToMaterial(form, true), [form]);
  const costingPreview = useMemo(() => packageCostingOrNull(previewMaterial), [previewMaterial]);
  const stockPreview = useMemo(() => onHandNormalizationOrNull(previewMaterial), [previewMaterial]);
  const inventoryPreview = useMemo(() => inventoryValuationOrNull(previewMaterial), [previewMaterial]);
  const manualIsRequired = MATERIAL_PACKAGE_UNITS.includes(form.purchaseUnit as (typeof MATERIAL_PACKAGE_UNITS)[number]);

  const refresh = useCallback(async () => {
    const filter: MaterialListFilter = {
      query: query.trim() || undefined,
      group: groupFilter === 'all' ? undefined : groupFilter,
      active: activeFilter === 'all' ? undefined : activeFilter === 'active',
    };
    setMaterials(await materialService.listMaterials(filter));
  }, [activeFilter, groupFilter, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  }

  function updateBaseUnit(baseUnit: BaseUnit) {
    const nextDefault = defaultPurchaseUnit(baseUnit);
    setForm((current) => ({
      ...current,
      baseUnit,
      purchaseUnit: nextDefault,
      onHandUnit: baseUnit,
      manualBaseUnitsPerPurchaseUnit: '',
    }));
  }

  function updatePurchaseUnit(purchaseUnit: MaterialPurchaseUnit) {
    setForm((current) => ({
      ...current,
      purchaseUnit,
      onHandUnit: isMaterialPackageUnit(current.onHandUnit)
        ? isMaterialPackageUnit(purchaseUnit)
          ? purchaseUnit
          : current.baseUnit
        : current.onHandUnit,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const existing = editingId ? await materialService.getMaterial(editingId) : null;
      const candidate = formToMaterial(form, existing?.isActive ?? true);
      if (editingId) {
        const { id: _ignored, ...changes } = candidate;
        await materialService.updateMaterial(editingId, changes);
        setMessage(`Updated ${candidate.name}.`);
      } else {
        await materialService.createMaterial(candidate);
        setMessage(`Added ${candidate.name}.`);
      }
      resetForm();
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function editMaterial(material: Material) {
    setEditingId(material.id);
    setForm(materialToForm(material));
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function archiveMaterial(material: Material) {
    if (!window.confirm(`Archive ${material.name}? It will remain available in archived records.`)) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await materialService.archiveMaterial(material.id);
      if (editingId?.toLocaleLowerCase() === material.id.toLocaleLowerCase()) resetForm();
      setMessage(`Archived ${material.name}.`);
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const activeCount = materials.filter((material) => material.isActive).length;

  return (
    <section className="materials-workspace" aria-labelledby="materials-heading">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">MATERIAL MASTER</p>
          <h1 id="materials-heading">Materials</h1>
          <p className="page-lead">
            Record purchase and stock source data. Package costing, normalized on-hand stock, and current
            inventory value are calculated automatically.
          </p>
        </div>
        <div className="session-badge" title="Excel persistence is planned for a later phase">
          <span className="status-dot" aria-hidden="true" />
          Session-only storage
        </div>
      </div>

      <div className="materials-layout">
        <form className="material-form panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{editingId ? 'EDIT MATERIAL' : 'NEW MATERIAL'}</p>
              <h2>{editingId ? form.name || editingId : 'Add a material'}</h2>
            </div>
            {editingId && (
              <button className="button button-quiet" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Material ID</span>
              <input
                required
                value={form.id}
                disabled={Boolean(editingId)}
                placeholder="MAT-PLASTER"
                onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
              />
              <small>Stable ID used by future recipes and inventory records.</small>
            </label>

            <label className="field">
              <span>Material name</span>
              <input
                required
                value={form.name}
                placeholder="Plaster of Paris"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Group</span>
              <select
                value={form.group}
                onChange={(event) => setForm((current) => ({ ...current, group: event.target.value as MaterialGroup }))}
              >
                {MATERIAL_GROUPS.map((group) => (
                  <option value={group} key={group}>{formatGroup(group)}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Base unit</span>
              <select value={form.baseUnit} onChange={(event) => updateBaseUnit(event.target.value as BaseUnit)}>
                {BASE_UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
              </select>
              <small>Canonical unit used internally for this material.</small>
            </label>

            <div className="field-group-title">Purchase package</div>

            <label className="field">
              <span>Purchase quantity</span>
              <input
                required
                min="0.000001"
                step="any"
                type="number"
                value={form.purchaseQuantity}
                onChange={(event) => setForm((current) => ({ ...current, purchaseQuantity: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Purchase unit</span>
              <select
                value={form.purchaseUnit}
                onChange={(event) => updatePurchaseUnit(event.target.value as MaterialPurchaseUnit)}
              >
                {purchaseOptions.map((unit) => <option value={unit} key={unit}>{formatUnit(unit)}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Package cost (₱)</span>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={form.packageCost}
                onChange={(event) => setForm((current) => ({ ...current, packageCost: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Manual conversion {manualIsRequired ? '(required)' : '(optional override)'}</span>
              <input
                min="0.000001"
                step="any"
                type="number"
                value={form.manualBaseUnitsPerPurchaseUnit}
                placeholder={`${form.baseUnit} per ${formatUnit(form.purchaseUnit)}`}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  manualBaseUnitsPerPurchaseUnit: event.target.value,
                }))}
              />
              <small>
                {manualIsRequired
                  ? `Enter how many ${form.baseUnit} are in 1 ${formatUnit(form.purchaseUnit)}.`
                  : 'Leave blank to use the standard conversion. A value here overrides it.'}
              </small>
            </label>

            <div className="field field-wide cost-preview" aria-live="polite">
              <div className="cost-preview-heading">
                <span>Calculated purchase costing</span>
                <small>Derived only — these values are not stored as source data.</small>
              </div>
              {costingPreview ? (
                <div className="cost-metrics">
                  <div className="cost-metric">
                    <span>Standard conversion</span>
                    <strong>
                      {costingPreview.standardBaseUnitsPerPurchaseUnit === null
                        ? 'N/A'
                        : `1 ${formatUnit(form.purchaseUnit)} = ${formatNumber(costingPreview.standardBaseUnitsPerPurchaseUnit)} ${form.baseUnit}`}
                    </strong>
                  </div>
                  <div className="cost-metric">
                    <span>Manual conversion</span>
                    <strong>
                      {costingPreview.manualBaseUnitsPerPurchaseUnit === null
                        ? 'Not set'
                        : `1 ${formatUnit(form.purchaseUnit)} = ${formatNumber(costingPreview.manualBaseUnitsPerPurchaseUnit)} ${form.baseUnit}`}
                    </strong>
                  </div>
                  <div className="cost-metric cost-metric-emphasis">
                    <span>Effective conversion</span>
                    <strong>
                      1 {formatUnit(form.purchaseUnit)} = {formatNumber(costingPreview.effectiveBaseUnitsPerPurchaseUnit)} {form.baseUnit}
                    </strong>
                    <small>{costingPreview.effectiveConversionSource} conversion used</small>
                  </div>
                  <div className="cost-metric cost-metric-emphasis">
                    <span>Cost per {form.baseUnit}</span>
                    <strong>{formatMoney(costingPreview.costPerBaseUnit)} / {form.baseUnit}</strong>
                    <small>{formatNumber(costingPreview.packageBaseQuantity)} {form.baseUnit} in this purchase</small>
                  </div>
                </div>
              ) : (
                <div className="cost-preview-empty">
                  Enter a positive purchase quantity and a valid conversion to calculate package cost per {form.baseUnit}.
                </div>
              )}
            </div>

            <div className="field-group-title">Current stock</div>

            <label className="field">
              <span>On-hand quantity</span>
              <input
                required
                min="0"
                step="any"
                type="number"
                value={form.onHandQuantity}
                onChange={(event) => setForm((current) => ({ ...current, onHandQuantity: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>On-hand unit</span>
              <select
                value={form.onHandUnit}
                onChange={(event) => setForm((current) => ({ ...current, onHandUnit: event.target.value as MaterialPurchaseUnit }))}
              >
                {stockOptions.map((unit) => <option value={unit} key={unit}>{formatUnit(unit)}</option>)}
              </select>
              <small>Use a compatible measurement unit or the configured purchase package.</small>
            </label>

            <div className="field field-wide cost-preview" aria-live="polite">
              <div className="cost-preview-heading">
                <span>Normalized stock & valuation</span>
                <small>Canonical quantity and current inventory value derived from your source entries.</small>
              </div>
              {stockPreview ? (
                <div className="cost-metrics">
                  <div className="cost-metric">
                    <span>Entered stock</span>
                    <strong>{formatNumber(stockPreview.enteredQuantity)} {formatUnit(stockPreview.enteredUnit)}</strong>
                  </div>
                  <div className="cost-metric">
                    <span>Stock conversion</span>
                    <strong>
                      1 {formatUnit(stockPreview.enteredUnit)} = {formatNumber(stockPreview.baseUnitsPerOnHandUnit)} {stockPreview.baseUnit}
                    </strong>
                    <small>{stockPreview.conversionSource === 'standard' ? 'standard unit conversion' : 'configured purchase-package conversion'}</small>
                  </div>
                  <div className="cost-metric cost-metric-emphasis">
                    <span>Normalized on hand</span>
                    <strong>{formatNumber(stockPreview.normalizedBaseQuantity)} {stockPreview.baseUnit}</strong>
                    <small>Derived — source entry remains {formatNumber(stockPreview.enteredQuantity)} {formatUnit(stockPreview.enteredUnit)}</small>
                  </div>
                  <div className="cost-metric cost-metric-emphasis">
                    <span>Inventory value</span>
                    <strong>{inventoryPreview ? formatMoney(inventoryPreview.inventoryValue, 2) : 'Unavailable'}</strong>
                    <small>
                      {inventoryPreview
                        ? `${formatNumber(inventoryPreview.normalizedBaseQuantity)} ${inventoryPreview.baseUnit} × ${formatMoney(inventoryPreview.costPerBaseUnit)} / ${inventoryPreview.baseUnit}`
                        : 'Requires valid non-negative stock and purchase costing.'}
                    </small>
                  </div>
                </div>
              ) : (
                <div className="cost-preview-empty">
                  Enter a finite stock quantity in a compatible unit or the configured purchase package.
                </div>
              )}
            </div>

            <label className="field field-wide">
              <span>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                placeholder="Brand, size, color, buying notes, or other details"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>

          {error && <div className="feedback feedback-error" role="alert">{error}</div>}
          {message && <div className="feedback feedback-success" role="status">{message}</div>}

          <button className="button button-primary button-full" disabled={busy} type="submit">
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add material'}
          </button>
        </form>

        <div className="material-list panel">
          <div className="panel-heading list-heading">
            <div>
              <p className="panel-kicker">INVENTORY SOURCE DATA</p>
              <h2>Material list</h2>
            </div>
            <div className="material-count">
              <strong>{materials.length}</strong>
              <span>{activeFilter === 'active' ? 'shown' : 'records'}</span>
            </div>
          </div>

          <div className="filters" aria-label="Material filters">
            <label className="search-field">
              <span className="sr-only">Search materials</span>
              <input
                type="search"
                value={query}
                placeholder="Search ID, name, or notes…"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="Filter by material group"
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value as MaterialGroup | 'all')}
            >
              <option value="all">All groups</option>
              {MATERIAL_GROUPS.map((group) => <option value={group} key={group}>{formatGroup(group)}</option>)}
            </select>
            <select
              aria-label="Filter by material status"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="materials-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Group</th>
                  <th>Purchased</th>
                  <th>On hand</th>
                  <th>Cost</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => {
                  const costing = packageCostingOrNull(material);
                  const stock = onHandNormalizationOrNull(material);
                  const inventory = inventoryValuationOrNull(material);
                  return (
                    <tr key={material.id} className={material.isActive ? undefined : 'archived-row'}>
                      <td>
                        <strong>{material.name}</strong>
                        <span className="material-id">{material.id}</span>
                      </td>
                      <td><span className="group-pill">{formatGroup(material.group)}</span></td>
                      <td>{material.purchaseQuantity} {formatUnit(material.purchaseUnit)}</td>
                      <td>
                        <strong>{material.onHandQuantity} {formatUnit(material.onHandUnit)}</strong>
                        <span className="cost-detail">
                          {stock ? `${formatNumber(stock.normalizedBaseQuantity)} ${material.baseUnit} normalized` : 'Normalization required'}
                        </span>
                        <span className="cost-detail">
                          {inventory ? `Inventory value ${formatMoney(inventory.inventoryValue, 2)}` : 'Valuation unavailable'}
                        </span>
                      </td>
                      <td>
                        <strong>{formatMoney(material.packageCost, 2)}</strong>
                        <span className="cost-detail">
                          {costing ? `${formatMoney(costing.costPerBaseUnit)} / ${material.baseUnit}` : 'Conversion required'}
                        </span>
                      </td>
                      <td className="row-actions">
                        <button className="text-button" type="button" onClick={() => editMaterial(material)}>Edit</button>
                        {material.isActive && (
                          <button className="text-button danger" disabled={busy} type="button" onClick={() => void archiveMaterial(material)}>
                            Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {materials.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">+</div>
                <h3>No materials found</h3>
                <p>
                  {query || groupFilter !== 'all' || activeFilter !== 'active'
                    ? 'Try changing your filters, or add a new material.'
                    : 'Add your first material using the form. Nothing is pre-filled with fake inventory data.'}
                </p>
              </div>
            )}
          </div>

          <footer className="list-footer">
            <span>{activeCount} active record{activeCount === 1 ? '' : 's'} in the current result</span>
            <span>Excel save/load arrives in Phase 5</span>
          </footer>
        </div>
      </div>
    </section>
  );
}
