import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calibrationService, materialService } from '../../application/session';
import { MaterialApplicationError } from '../../application/materials/MaterialService';
import { nextSequentialId } from '../../domain/identifiers';
import { MaterialCalibrationError, type MaterialCalibrationEvidence } from '../../domain/materialCalibration';
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
import { SUPPORTED_UNITS, getUnitDimension, type BaseUnit, type Unit } from '../../domain/units';
import { MaterialCatalog } from './MaterialCatalog';
import { inventoryOverview, materialInventoryRow, type MaterialStockFilter } from './materialInventoryView';
import './materialCosting.css';

const BASE_UNITS: BaseUnit[] = ['g', 'mL', 'pc'];

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
  vendorName: string;
  sourceDetail: string;
  purchaseLink: string;
  contactNumber: string;
  socialPage: string;
  sourceNotes: string;
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
  vendorName: '',
  sourceDetail: '',
  purchaseLink: '',
  contactNumber: '',
  socialPage: '',
  sourceNotes: '',
  notes: '',
};

function compatibleStandardUnits(baseUnit: BaseUnit): Unit[] {
  return SUPPORTED_UNITS.filter((unit) => getUnitDimension(unit) === getUnitDimension(baseUnit));
}

function purchaseUnitOptions(baseUnit: BaseUnit): MaterialPurchaseUnit[] {
  const standard = compatibleStandardUnits(baseUnit);
  const calibrationBridge: MaterialPurchaseUnit[] = baseUnit === 'g' ? ['cup'] : [];
  return [...standard, ...calibrationBridge, ...MATERIAL_PACKAGE_UNITS];
}

function onHandUnitOptions(baseUnit: BaseUnit, purchaseUnit: MaterialPurchaseUnit): MaterialPurchaseUnit[] {
  const standard = compatibleStandardUnits(baseUnit);
  const calibrationBridge: MaterialPurchaseUnit[] = baseUnit === 'g' ? ['cup'] : [];
  const packageOption: MaterialPurchaseUnit[] = isMaterialPackageUnit(purchaseUnit) ? [purchaseUnit] : [];
  return [...standard, ...calibrationBridge, ...packageOption];
}

function defaultPurchaseUnit(baseUnit: BaseUnit): MaterialPurchaseUnit {
  if (baseUnit === 'g') return 'kg';
  if (baseUnit === 'mL') return 'L';
  return 'pc';
}

function formatGroup(group: MaterialGroup): string {
  return group.replace(
    /(^|-)([a-z])/g,
    (_, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`,
  );
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
    manualBaseUnitsPerPurchaseUnit:
      material.manualBaseUnitsPerPurchaseUnit === undefined ? '' : String(material.manualBaseUnitsPerPurchaseUnit),
    onHandQuantity: String(material.onHandQuantity),
    onHandUnit: material.onHandUnit,
    vendorName: material.source?.vendorName ?? '',
    sourceDetail: material.source?.source ?? '',
    purchaseLink: material.source?.purchaseLink ?? '',
    contactNumber: material.source?.contactNumber ?? '',
    socialPage: material.source?.socialPage ?? '',
    sourceNotes: material.source?.notes ?? '',
    notes: material.notes ?? '',
  };
}

function formToMaterial(form: MaterialFormState, isActive: boolean): Material {
  return {
    id: form.id,
    name: form.name,
    group: form.group,
    baseUnit: form.baseUnit,
    purchaseQuantity: form.purchaseQuantity.trim() === '' ? Number.NaN : Number(form.purchaseQuantity),
    purchaseUnit: form.purchaseUnit,
    packageCost: form.packageCost.trim() === '' ? Number.NaN : Number(form.packageCost),
    manualBaseUnitsPerPurchaseUnit:
      form.manualBaseUnitsPerPurchaseUnit.trim() === '' ? undefined : Number(form.manualBaseUnitsPerPurchaseUnit),
    onHandQuantity: form.onHandQuantity.trim() === '' ? Number.NaN : Number(form.onHandQuantity),
    onHandUnit: form.onHandUnit,
    source: {
      vendorName: form.vendorName,
      source: form.sourceDetail,
      purchaseLink: form.purchaseLink,
      contactNumber: form.contactNumber,
      socialPage: form.socialPage,
      notes: form.sourceNotes,
    },
    notes: form.notes,
    isActive,
  };
}

function packageCostingOrNull(
  material: Material,
  evidence: readonly MaterialCalibrationEvidence[],
): MaterialPackageCosting | null {
  try {
    return calculateMaterialPackageCosting(material, evidence);
  } catch {
    return null;
  }
}

function onHandNormalizationOrNull(
  material: Material,
  evidence: readonly MaterialCalibrationEvidence[],
): MaterialOnHandNormalization | null {
  try {
    return normalizeMaterialOnHand(material, evidence);
  } catch {
    return null;
  }
}

function inventoryValuationOrNull(
  material: Material,
  evidence: readonly MaterialCalibrationEvidence[],
): MaterialInventoryValuation | null {
  try {
    return calculateMaterialInventoryValuation(material, evidence);
  } catch {
    return null;
  }
}

function conversionSourceLabel(stock: MaterialOnHandNormalization): string {
  if (stock.conversionSource === 'calibration') {
    return `material calibration${stock.calibrationId ? ` (${stock.calibrationId})` : ''}`;
  }
  if (stock.conversionSource === 'manual') return 'manual g/cup fallback';
  if (stock.conversionSource === 'purchase-package') {
    return `purchase-package conversion${
      stock.purchasePackageConversionSource ? ` (${stock.purchasePackageConversionSource})` : ''
    }`;
  }
  return 'standard unit conversion';
}

function errorMessage(error: unknown): string {
  if (
    error instanceof MaterialApplicationError ||
    error instanceof MaterialContractError ||
    error instanceof MaterialCostingError ||
    error instanceof MaterialInventoryError ||
    error instanceof MaterialCalibrationError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong while updating materials.';
}

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [calibrations, setCalibrations] = useState<MaterialCalibrationEvidence[]>([]);
  const [form, setForm] = useState<MaterialFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'inventory' | 'editor'>('inventory');
  const [stockFilter, setStockFilter] = useState<MaterialStockFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const loadVersion = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const errorFeedback = useRef<HTMLDivElement>(null);
  const inventoryHeading = useRef<HTMLHeadingElement>(null);
  const focusInventoryAfterSave = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const calibrationMap = useMemo(() => {
    const map = new Map<string, MaterialCalibrationEvidence[]>();
    for (const record of calibrations) {
      const key = record.materialId.trim().toLocaleLowerCase();
      map.set(key, [...(map.get(key) ?? []), record]);
    }
    return map;
  }, [calibrations]);

  const evidenceFor = useCallback(
    (materialId: string) => calibrationMap.get(materialId.trim().toLocaleLowerCase()) ?? [],
    [calibrationMap],
  );

  const generatedMaterialId = useMemo(() => nextSequentialId(materials.map((material) => material.id), 'MAT'), [materials]);
  const purchaseOptions = useMemo(() => purchaseUnitOptions(form.baseUnit), [form.baseUnit]);
  const stockOptions = useMemo(
    () => onHandUnitOptions(form.baseUnit, form.purchaseUnit),
    [form.baseUnit, form.purchaseUnit],
  );
  const previewMaterial = useMemo(
    () => formToMaterial(editingId ? form : { ...form, id: generatedMaterialId }, true),
    [editingId, form, generatedMaterialId],
  );
  const previewEvidence = useMemo(() => evidenceFor(previewMaterial.id), [evidenceFor, previewMaterial.id]);
  const costingPreview = useMemo(
    () => packageCostingOrNull(previewMaterial, previewEvidence),
    [previewMaterial, previewEvidence],
  );
  const stockPreview = useMemo(
    () => onHandNormalizationOrNull(previewMaterial, previewEvidence),
    [previewMaterial, previewEvidence],
  );
  const inventoryPreview = useMemo(
    () => inventoryValuationOrNull(previewMaterial, previewEvidence),
    [previewMaterial, previewEvidence],
  );
  const hasCalibration = previewEvidence.length > 0;
  const dryCupPurchase = form.baseUnit === 'g' && form.purchaseUnit === 'cup';
  const manualIsRequired = isMaterialPackageUnit(form.purchaseUnit) || (dryCupPurchase && !hasCalibration);

  const refresh = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [nextMaterials, nextCalibrations] = await Promise.all([
        materialService.listMaterials(),
        calibrationService.listCalibrations(),
      ]);
      if (loadVersion.current !== version) return;
      setMaterials(nextMaterials);
      setCalibrations(nextCalibrations);
    } catch (caught) {
      if (loadVersion.current === version) setLoadError(errorMessage(caught));
    } finally {
      if (loadVersion.current === version) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      loadVersion.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (view === 'editor') nameInput.current?.focus();
  }, [view, editingId]);

  useEffect(() => {
    if (!busy && error) errorFeedback.current?.focus();
    if (!busy && view === 'inventory' && focusInventoryAfterSave.current) {
      inventoryHeading.current?.focus();
      focusInventoryAfterSave.current = false;
    }
  }, [error, busy, view]);

  const inventoryRows = useMemo(
    () => materials.map((material) => materialInventoryRow(material, evidenceFor(material.id))),
    [materials, evidenceFor],
  );
  const overview = useMemo(() => inventoryOverview(inventoryRows), [inventoryRows]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  }

  function updateBaseUnit(baseUnit: BaseUnit) {
    setForm((current) => ({
      ...current,
      baseUnit,
      purchaseUnit: defaultPurchaseUnit(baseUnit),
      onHandUnit: baseUnit,
      manualBaseUnitsPerPurchaseUnit: '',
    }));
  }

  function updatePurchaseUnit(purchaseUnit: MaterialPurchaseUnit) {
    setForm((current) => ({
      ...current,
      purchaseUnit,
      manualBaseUnitsPerPurchaseUnit:
        current.purchaseUnit === purchaseUnit ? current.manualBaseUnitsPerPurchaseUnit : '',
      onHandUnit: isMaterialPackageUnit(current.onHandUnit)
        ? isMaterialPackageUnit(purchaseUnit)
          ? purchaseUnit
          : current.baseUnit
        : current.onHandUnit,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlight.current || loading || loadError) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if ([form.purchaseQuantity, form.packageCost, form.onHandQuantity].some((value) => value.trim() === '')) {
        throw new Error(
          'Enter purchase quantity, package cost, and stock quantity. Use 0 for a known zero cost or stock count.',
        );
      }
      const existing = editingId ? await materialService.getMaterial(editingId) : null;
      const candidate = formToMaterial(
        editingId ? form : { ...form, id: generatedMaterialId },
        existing?.isActive ?? true,
      );

      if (editingId) {
        const { id: _ignored, ...changes } = candidate;
        await materialService.updateMaterial(editingId, changes);
        setMessage(`Updated ${candidate.name}.`);
      } else {
        await materialService.createMaterial(candidate);
        setMessage(`Added ${candidate.name}.`);
      }

      resetForm();
      focusInventoryAfterSave.current = true;
      setView('inventory');
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  function editMaterial(material: Material) {
    setEditingId(material.id);
    setForm(materialToForm(material));
    setError(null);
    setMessage(null);
    setView('editor');
  }

  async function archiveMaterial(material: Material) {
    if (mutationInFlight.current || loading || loadError) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (material.isActive) await materialService.archiveMaterial(material.id);
      else await materialService.updateMaterial(material.id, { isActive: true });
      if (editingId?.toLocaleLowerCase() === material.id.toLocaleLowerCase()) resetForm();
      setMessage(`${material.isActive ? 'Archived' : 'Restored'} ${material.name}.`);
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="materials-workspace material-workshop" aria-labelledby="materials-heading">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">WORKSHOP / MATERIALS</p>
          <h1 id="materials-heading">Your materials shelf</h1>
          <p className="page-lead">Know what you have, what it costs, and where to get more.</p>
        </div>
        <div className="session-badge">Materials &amp; inventory</div>
      </div>

      <div className="material-workshop-overview" aria-label="Active inventory summary">
        <article className="panel">
          <span>Active materials</span>
          <strong>{loading || loadError ? '-' : overview.activeCount}</strong>
          <small>Across all groups</small>
        </article>
        <article className="panel">
          <span>Out of stock</span>
          <strong>{loading || loadError ? '-' : overview.outOfStock}</strong>
          <small>Active materials with a known zero balance</small>
        </article>
        <article className="panel">
          <span>{overview.unvalued ? 'Known stock value' : 'Active stock value'}</span>
          <strong>
            {loading || loadError || overview.knownValue === null ? 'Unavailable' : formatMoney(overview.knownValue, 2)}
          </strong>
          <small>
            {loading || loadError
              ? 'Waiting for inventory data'
              : overview.unvalued
                ? `${overview.unvalued} unvalued materials excluded`
                : 'Based on saved purchase costs'}
          </small>
        </article>
        <article className="panel">
          <span>Check conversions</span>
          <strong>{loading || loadError ? '-' : overview.needsAttention}</strong>
          <small>Active materials with unresolved costing or stock</small>
        </article>
      </div>
      <nav className="material-view-nav" aria-label="Material workspace views">
        <button
          type="button"
          disabled={busy}
          aria-pressed={view === 'inventory'}
          aria-controls="material-inventory-view"
          onClick={() => setView('inventory')}
        >
          Inventory <span>Browse your supplies</span>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={view === 'editor'}
          aria-controls="material-editor-view"
          onClick={() => setView('editor')}
        >
          {editingId ? 'Edit material' : 'Material editor'}{' '}
          <span>{editingId ?? 'Purchase, stock & supplier details'}</span>
        </button>
      </nav>
      {loadError && (
        <div className="feedback feedback-error" role="alert">
          Could not refresh materials: {loadError}{' '}
          <button type="button" className="text-button" disabled={busy || loading} onClick={() => void refresh()}>
            Retry loading
          </button>
        </div>
      )}
      {error && (
        <div ref={errorFeedback} tabIndex={-1} className="feedback feedback-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="feedback feedback-success" role="status">
          {message}
        </div>
      )}
      <div id="material-inventory-view" hidden={view !== 'inventory'}>
        <MaterialCatalog
          headingRef={inventoryHeading}
          rows={inventoryRows}
          loading={loading}
          loadFailed={Boolean(loadError)}
          disabled={busy || loading || Boolean(loadError)}
          stockFilter={stockFilter}
          onStockFilter={setStockFilter}
          onEdit={editMaterial}
          onNew={() => {
            resetForm();
            setMessage(null);
            setView('editor');
          }}
          onToggleActive={(material) => void archiveMaterial(material)}
        />
      </div>
      <div id="material-editor-view" hidden={view !== 'editor'}>
        <form
          className="material-form panel material-workshop-editor"
          aria-label="Material details"
          onSubmit={handleSubmit}
          aria-busy={busy}
        >
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{editingId ? 'EDIT MATERIAL' : 'NEW MATERIAL'}</p>
              <h2>{editingId ? form.name || editingId : 'Add a material'}</h2>
            </div>
            {editingId && (
              <button className="button button-quiet" type="button" disabled={busy} onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>

          <div className="material-editor-overview" aria-label="Live material preview">
            <div>
              <span>Cost / {form.baseUnit}</span>
              <strong>{costingPreview ? formatMoney(costingPreview.costPerBaseUnit) : 'Unavailable'}</strong>
            </div>
            <div>
              <span>On hand ({form.baseUnit})</span>
              <strong>{stockPreview ? formatNumber(stockPreview.normalizedBaseQuantity) : 'Unavailable'}</strong>
            </div>
            <div>
              <span>Stock value</span>
              <strong>{inventoryPreview ? formatMoney(inventoryPreview.inventoryValue, 2) : 'Unavailable'}</strong>
            </div>
          </div>
          <p className="material-editor-help">
            Changes below are a preview until you save. Purchase units describe what you buy; the base unit is what you
            use in recipes.
          </p>
          <fieldset className="material-editor-fields" disabled={busy || loading || Boolean(loadError)}>
            <div className="form-grid">
              <label className="field">
                <span>Material ID</span>
                <input
                  value={editingId ? form.id : generatedMaterialId}
                  readOnly
                  aria-readonly="true"
                />
                <small>{editingId ? 'Existing Material ID is preserved permanently.' : 'Assigned automatically when you create this material. Existing records are never renumbered.'}</small>
              </label>

              <label className="field">
                <span>Material name</span>
                <input
                  required
                  ref={nameInput}
                  value={form.name}
                  placeholder="Plaster of Paris"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Group</span>
                <select
                  value={form.group}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, group: event.target.value as MaterialGroup }))
                  }
                >
                  {MATERIAL_GROUPS.map((group) => (
                    <option value={group} key={group}>
                      {formatGroup(group)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Base unit</span>
                <select value={form.baseUnit} onChange={(event) => updateBaseUnit(event.target.value as BaseUnit)}>
                  {BASE_UNITS.map((unit) => (
                    <option value={unit} key={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                <small>Unit used for recipes and comparing stock quantities.</small>
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
                  {purchaseOptions.map((unit) => (
                    <option value={unit} key={unit}>
                      {formatUnit(unit)}
                    </option>
                  ))}
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
                <span>Manual conversion {manualIsRequired ? '(required)' : '(optional fallback/override)'}</span>
                <input
                  min="0.000001"
                  step="any"
                  type="number"
                  required={manualIsRequired}
                  value={form.manualBaseUnitsPerPurchaseUnit}
                  placeholder={`${form.baseUnit} per ${formatUnit(form.purchaseUnit)}`}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      manualBaseUnitsPerPurchaseUnit: event.target.value,
                    }))
                  }
                />
                <small>
                  {dryCupPurchase
                    ? hasCalibration
                      ? 'Saved calibration takes precedence. This value is only a fallback.'
                      : `Create a calibration first or enter an explicit ${form.baseUnit}/cup fallback.`
                    : manualIsRequired
                      ? `Enter how many ${form.baseUnit} are in 1 ${formatUnit(form.purchaseUnit)}.`
                      : 'Leave blank to use standard conversion; a value here overrides it.'}{' '}
                  Changing the purchase unit clears this value so you can enter the correct conversion.
                </small>
              </label>

              <details className="field-wide cost-preview">
                <summary>Calculated purchase costing</summary>
                <div className="cost-preview-heading">
                  <span>Purchase conversion detail</span>
                  <small>Updates as you edit.</small>
                </div>
                {costingPreview ? (
                  <div className="cost-metrics">
                    <div className="cost-metric">
                      <span>Standard conversion</span>
                      <strong>
                        {costingPreview.standardBaseUnitsPerPurchaseUnit === null
                          ? 'N/A'
                          : `1 ${formatUnit(form.purchaseUnit)} = ${formatNumber(
                              costingPreview.standardBaseUnitsPerPurchaseUnit,
                            )} ${form.baseUnit}`}
                      </strong>
                    </div>
                    <div className="cost-metric">
                      <span>Calibration</span>
                      <strong>
                        {costingPreview.calibrationBaseUnitsPerPurchaseUnit === null
                          ? 'Not used'
                          : `${formatNumber(costingPreview.calibrationBaseUnitsPerPurchaseUnit)} ${form.baseUnit}/cup`}
                      </strong>
                      {costingPreview.effectiveCalibrationId && <small>{costingPreview.effectiveCalibrationId}</small>}
                    </div>
                    <div className="cost-metric cost-metric-emphasis">
                      <span>Effective conversion</span>
                      <strong>
                        1 {formatUnit(form.purchaseUnit)} ={' '}
                        {formatNumber(costingPreview.effectiveBaseUnitsPerPurchaseUnit)} {form.baseUnit}
                      </strong>
                      <small>{costingPreview.effectiveConversionSource} conversion used</small>
                    </div>
                    <div className="cost-metric cost-metric-emphasis">
                      <span>Cost per {form.baseUnit}</span>
                      <strong>
                        {formatMoney(costingPreview.costPerBaseUnit)} / {form.baseUnit}
                      </strong>
                      <small>
                        {formatNumber(costingPreview.packageBaseQuantity)} {form.baseUnit} in this purchase
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="cost-preview-empty">
                    Enter valid package data and, for dry cups, create a calibration or manual g/cup fallback.
                  </div>
                )}
              </details>

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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      onHandUnit: event.target.value as MaterialPurchaseUnit,
                    }))
                  }
                >
                  {stockOptions.map((unit) => (
                    <option value={unit} key={unit}>
                      {formatUnit(unit)}
                    </option>
                  ))}
                </select>
                <small>Gram-based materials may use cup after calibration.</small>
              </label>

              <details className="field-wide cost-preview">
                <summary>Normalized stock &amp; valuation</summary>
                <div className="cost-preview-heading">
                  <span>Stock conversion detail</span>
                  <small>See how entered stock becomes recipe units and value.</small>
                </div>
                {stockPreview ? (
                  <div className="cost-metrics">
                    <div className="cost-metric">
                      <span>Entered stock</span>
                      <strong>
                        {formatNumber(stockPreview.enteredQuantity)} {formatUnit(stockPreview.enteredUnit)}
                      </strong>
                    </div>
                    <div className="cost-metric">
                      <span>Stock conversion</span>
                      <strong>
                        1 {formatUnit(stockPreview.enteredUnit)} = {formatNumber(stockPreview.baseUnitsPerOnHandUnit)}{' '}
                        {stockPreview.baseUnit}
                      </strong>
                      <small>{conversionSourceLabel(stockPreview)}</small>
                    </div>
                    <div className="cost-metric cost-metric-emphasis">
                      <span>Normalized on hand</span>
                      <strong>
                        {formatNumber(stockPreview.normalizedBaseQuantity)} {stockPreview.baseUnit}
                      </strong>
                    </div>
                    <div className="cost-metric cost-metric-emphasis">
                      <span>Inventory value</span>
                      <strong>
                        {inventoryPreview ? formatMoney(inventoryPreview.inventoryValue, 2) : 'Unavailable'}
                      </strong>
                      <small>
                        {inventoryPreview
                          ? `${formatNumber(inventoryPreview.normalizedBaseQuantity)} ${
                              inventoryPreview.baseUnit
                            } × ${formatMoney(inventoryPreview.costPerBaseUnit)} / ${inventoryPreview.baseUnit}`
                          : 'Requires valid stock and purchase costing.'}
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="cost-preview-empty">
                    Enter stock in a compatible unit. Cup-to-gram stock requires saved calibration or an eligible manual
                    fallback.
                  </div>
                )}
              </details>

              <details className="field-wide material-supplier-details">
                <summary>
                  Supplier / source &amp; notes <span>Optional</span>
                </summary>
                <div className="form-grid">
                  <label className="field">
                    <span>Vendor / supplier</span>
                    <input
                      value={form.vendorName}
                      placeholder="Store or seller name"
                      onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>Source / branch / platform</span>
                    <input
                      value={form.sourceDetail}
                      placeholder="168 Mall, Shopee store, contact person…"
                      onChange={(event) => setForm((current) => ({ ...current, sourceDetail: event.target.value }))}
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Purchase / re-order link</span>
                    <input
                      type="url"
                      value={form.purchaseLink}
                      placeholder="https://…"
                      onChange={(event) => setForm((current) => ({ ...current, purchaseLink: event.target.value }))}
                    />
                    <small>Optional. Only valid http/https links are accepted.</small>
                  </label>

                  <label className="field">
                    <span>Contact number</span>
                    <input
                      type="tel"
                      value={form.contactNumber}
                      placeholder="Phone, Viber, WhatsApp…"
                      onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>Social page / handle</span>
                    <input
                      value={form.socialPage}
                      placeholder="Facebook page, @seller…"
                      onChange={(event) => setForm((current) => ({ ...current, socialPage: event.target.value }))}
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Source notes</span>
                    <textarea
                      rows={2}
                      value={form.sourceNotes}
                      placeholder="Wholesale price, preferred variant, delivery notes, landmark…"
                      onChange={(event) => setForm((current) => ({ ...current, sourceNotes: event.target.value }))}
                    />
                    <small>Supplier metadata is informational and never changes material costing.</small>
                  </label>

                  <div className="field-group-title">Material notes</div>

                  <label className="field field-wide">
                    <span>Notes</span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      placeholder="Brand, size, color, handling notes, or other material details"
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                </div>
              </details>
            </div>

            <button className="button button-primary button-full" disabled={busy} type="submit">
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add material'}
            </button>
          </fieldset>
        </form>
      </div>
    </section>
  );
}
