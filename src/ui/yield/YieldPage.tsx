import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  materialService,
  mixPresetService,
  productService,
  yieldHistoryService,
  yieldSampleEvidenceService,
} from '../../application/session';
import {
  type EffectiveYieldSelection,
  YieldHistoryServiceError,
} from '../../application/yieldSamples/YieldHistoryService';
import type { Material } from '../../domain/materials';
import { isMaterialCupWeightBridge } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import { isMixPresetCompatibleWithCategory } from '../../domain/mixPresets';
import type { Product } from '../../domain/products';
import { PRODUCT_CATEGORY_RULES } from '../../domain/products';
import {
  SUPPORTED_UNITS,
  areUnitsCompatible,
  type InputUnit,
} from '../../domain/units';
import type { YieldSample } from '../../domain/yieldSamples';
import './yield.css';

type YieldInputForm = {
  key: string;
  materialId: string;
  quantity: string;
  unit: InputUnit;
};

type YieldFormState = {
  id: string;
  mixPresetId: string;
  goodPieces: string;
  rejectedPieces: string;
  recordedAt: string;
  notes: string;
  materialInputs: YieldInputForm[];
};

let inputSequence = 0;

function localDateTimeValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function newInput(unit: InputUnit = 'g'): YieldInputForm {
  inputSequence += 1;
  return {
    key: `yield-input-${inputSequence}`,
    materialId: '',
    quantity: '',
    unit,
  };
}

function emptyForm(mixPresetId = ''): YieldFormState {
  return {
    id: '',
    mixPresetId,
    goodPieces: '1',
    rejectedPieces: '0',
    recordedAt: localDateTimeValue(),
    notes: '',
    materialInputs: [newInput()],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please check the evidence and try again.';
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

function formatNumber(value: number, maximumFractionDigits = 6): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function defectRate(sample: YieldSample): number {
  const total = sample.goodPieces + sample.rejectedPieces;
  return total === 0 ? 0 : sample.rejectedPieces / total;
}

export function YieldPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [mixPresets, setMixPresets] = useState<MixPreset[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [history, setHistory] = useState<YieldSample[]>([]);
  const [effective, setEffective] = useState<EffectiveYieldSelection | null>(null);
  const [effectiveNotice, setEffectiveNotice] = useState('Select a product to inspect yield history.');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState<YieldFormState>(() => emptyForm());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const activeMaterials = useMemo(
    () => materials.filter((material) => material.isActive),
    [materials],
  );

  const compatibleMixes = useMemo(() => {
    if (!selectedProduct) return [];
    return mixPresets.filter(
      (preset) => preset.isActive && isMixPresetCompatibleWithCategory(preset, selectedProduct.category),
    );
  }, [mixPresets, selectedProduct]);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id.toLocaleLowerCase(), material])),
    [materials],
  );

  const mixById = useMemo(
    () => new Map(mixPresets.map((preset) => [preset.id.toLocaleLowerCase(), preset])),
    [mixPresets],
  );

  const loadHistory = useCallback(async (productId: string) => {
    if (!productId) {
      setHistory([]);
      setEffective(null);
      setEffectiveNotice('Select a product to inspect yield history.');
      return;
    }

    setHistoryLoading(true);
    try {
      const nextHistory = await yieldHistoryService.listHistory(productId);
      setHistory(nextHistory);
      try {
        const nextEffective = await yieldHistoryService.getEffective(productId);
        setEffective(nextEffective);
        setEffectiveNotice(
          nextEffective.skippedInvalidSampleIds.length > 0
            ? `${nextEffective.skippedInvalidSampleIds.length} newer sample(s) were skipped because they cannot currently be derived.`
            : 'The newest currently derivable sample is effective.',
        );
      } catch (error) {
        setEffective(null);
        if (error instanceof YieldHistoryServiceError && error.code === 'NO_SAMPLES') {
          setEffectiveNotice('No yield samples have been recorded for this product yet.');
        } else if (error instanceof YieldHistoryServiceError && error.code === 'NO_VALID_SAMPLES') {
          setEffectiveNotice('Yield history exists, but no sample can currently produce learned requirements. Check material calibration and references.');
        } else {
          throw error;
        }
      }
    } catch (error) {
      setHistory([]);
      setEffective(null);
      setEffectiveNotice(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadMasters = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProducts, nextMaterials, nextMixes] = await Promise.all([
        productService.listProducts(),
        materialService.listMaterials(),
        mixPresetService.listMixPresets(),
      ]);
      setProducts(nextProducts);
      setMaterials(nextMaterials);
      setMixPresets(nextMixes);
      setSelectedProductId((current) => {
        if (current && nextProducts.some((product) => product.id === current)) return current;
        return nextProducts.find((product) => product.isActive)?.id ?? nextProducts[0]?.id ?? '';
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    void loadHistory(selectedProductId);
    const product = products.find((item) => item.id === selectedProductId);
    setForm(emptyForm(product?.mixPresetId ?? ''));
    setFeedback(null);
  }, [loadHistory, products, selectedProductId]);

  function unitOptions(materialId: string): InputUnit[] {
    const material = materialById.get(materialId.toLocaleLowerCase());
    if (!material) return [...SUPPORTED_UNITS];
    return SUPPORTED_UNITS.filter(
      (unit) =>
        areUnitsCompatible(unit, material.baseUnit) ||
        isMaterialCupWeightBridge(unit, material.baseUnit),
    );
  }

  function updateMaterialInput(key: string, changes: Partial<Omit<YieldInputForm, 'key'>>) {
    setForm((current) => ({
      ...current,
      materialInputs: current.materialInputs.map((input) =>
        input.key === key ? { ...input, ...changes } : input,
      ),
    }));
  }

  function changeMaterial(key: string, materialId: string) {
    const material = materialById.get(materialId.toLocaleLowerCase());
    updateMaterialInput(key, {
      materialId,
      unit: (material?.baseUnit ?? 'g') as InputUnit,
    });
  }

  function addMaterialInput() {
    setForm((current) => ({
      ...current,
      materialInputs: [...current.materialInputs, newInput()],
    }));
  }

  function removeMaterialInput(key: string) {
    setForm((current) => ({
      ...current,
      materialInputs: current.materialInputs.filter((input) => input.key !== key),
    }));
  }

  async function submitSample(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    if (!selectedProduct) {
      setFeedback({ type: 'error', message: 'Select a product first.' });
      return;
    }

    try {
      const recordedAt = new Date(form.recordedAt);
      await yieldSampleEvidenceService.recordSample({
        id: form.id,
        productId: selectedProduct.id,
        mixPresetId: form.mixPresetId.trim() || undefined,
        materialInputs: form.materialInputs.map((input) => ({
          materialId: input.materialId,
          quantity: Number(input.quantity),
          unit: input.unit,
        })),
        goodPieces: Number(form.goodPieces),
        rejectedPieces: Number(form.rejectedPieces),
        recordedAt: Number.isFinite(recordedAt.getTime()) ? recordedAt.toISOString() : form.recordedAt,
        notes: form.notes,
      });

      setForm(emptyForm(selectedProduct.mixPresetId ?? ''));
      setFeedback({ type: 'success', message: 'Yield sample recorded. History and effective learning have been refreshed.' });
      await loadHistory(selectedProduct.id);
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  async function deleteSample(sample: YieldSample) {
    setFeedback(null);
    try {
      await yieldHistoryService.deleteSample(sample.id);
      setFeedback({ type: 'success', message: `Yield sample ${sample.id} deleted as a correction.` });
      await loadHistory(sample.productId);
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  const effectiveId = effective?.sample.id ?? null;
  const skippedIds = new Set(effective?.skippedInvalidSampleIds ?? []);

  return (
    <section className="materials-workspace yield-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">PHASE 2 · REAL PRODUCTION EVIDENCE</p>
          <h1>Yield & history</h1>
          <p className="page-lead">
            Record what a real batch consumed and how many good/rejected pieces it produced. The latest currently derivable sample becomes the effective learning source.
          </p>
        </div>
        <div className="session-badge"><span className="status-dot" />Session workspace</div>
      </div>

      <div className="yield-product-bar panel">
        <label className="field">
          <span>Product</span>
          <select
            value={selectedProductId}
            disabled={loading || products.length === 0}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            {products.length === 0 && <option value="">No products available</option>}
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {PRODUCT_CATEGORY_RULES[product.category].label}{product.isActive ? '' : ' · archived'}
              </option>
            ))}
          </select>
        </label>
        <div className="yield-product-context">
          <strong>{selectedProduct?.name ?? 'Create a product first'}</strong>
          <span>
            {selectedProduct
              ? `${PRODUCT_CATEGORY_RULES[selectedProduct.category].productionStyle} · ${selectedProduct.isActive ? 'active for new evidence' : 'historical view only'}`
              : 'Yield evidence belongs to a product.'}
          </span>
        </div>
      </div>

      <div className="materials-layout yield-layout">
        <form className="panel material-form yield-form" onSubmit={submitSample}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">BATCH EVIDENCE</p>
              <h2>Record a yield sample</h2>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Sample ID</span>
              <input
                value={form.id}
                disabled={!selectedProduct?.isActive}
                onChange={(event) => setForm({ ...form, id: event.target.value })}
                placeholder="YS-ART-001-001"
              />
            </label>
            <label className="field">
              <span>Recorded at</span>
              <input
                type="datetime-local"
                value={form.recordedAt}
                disabled={!selectedProduct?.isActive}
                onChange={(event) => setForm({ ...form, recordedAt: event.target.value })}
              />
            </label>
            <label className="field field-wide">
              <span>Mix preset used</span>
              <select
                value={form.mixPresetId}
                disabled={!selectedProduct?.isActive}
                onChange={(event) => setForm({ ...form, mixPresetId: event.target.value })}
              >
                <option value="">No preset / manual batch</option>
                {compatibleMixes.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
              <small>Optional evidence reference. The actual material quantities below remain authoritative.</small>
            </label>

            <div className="field field-wide">
              <span>Materials actually consumed</span>
              <div className="yield-inputs">
                {form.materialInputs.map((input, index) => (
                  <div className="yield-input-row" key={input.key}>
                    <select
                      aria-label={`Yield material ${index + 1}`}
                      value={input.materialId}
                      disabled={!selectedProduct?.isActive}
                      onChange={(event) => changeMaterial(input.key, event.target.value)}
                    >
                      <option value="">Select material</option>
                      {activeMaterials.map((material) => (
                        <option key={material.id} value={material.id}>{material.name} · {material.baseUnit}</option>
                      ))}
                    </select>
                    <input
                      aria-label={`Yield quantity ${index + 1}`}
                      type="number"
                      min="0.000001"
                      step="any"
                      value={input.quantity}
                      disabled={!selectedProduct?.isActive}
                      onChange={(event) => updateMaterialInput(input.key, { quantity: event.target.value })}
                      placeholder="quantity"
                    />
                    <select
                      aria-label={`Yield unit ${index + 1}`}
                      value={input.unit}
                      disabled={!selectedProduct?.isActive || !input.materialId}
                      onChange={(event) => updateMaterialInput(input.key, { unit: event.target.value as InputUnit })}
                    >
                      {unitOptions(input.materialId).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <button
                      type="button"
                      className="text-button danger"
                      disabled={!selectedProduct?.isActive || form.materialInputs.length === 1}
                      onClick={() => removeMaterialInput(input.key)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="button button-quiet add-line-button"
                disabled={!selectedProduct?.isActive}
                onClick={addMaterialInput}
              >
                + Add material
              </button>
              <small>Enter the actual measured batch consumption, including material consumed by rejected pieces.</small>
            </div>

            <label className="field">
              <span>Good pieces</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.goodPieces}
                disabled={!selectedProduct?.isActive}
                onChange={(event) => setForm({ ...form, goodPieces: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Rejected pieces</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.rejectedPieces}
                disabled={!selectedProduct?.isActive}
                onChange={(event) => setForm({ ...form, rejectedPieces: event.target.value })}
              />
            </label>
            <label className="field field-wide">
              <span>Notes</span>
              <textarea
                value={form.notes}
                disabled={!selectedProduct?.isActive}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Mold, curing time, spills, batch observation..."
              />
            </label>
          </div>

          <button className="button button-primary button-full" type="submit" disabled={!selectedProduct?.isActive}>
            Record yield sample
          </button>
          {selectedProduct && !selectedProduct.isActive && (
            <div className="feedback">Archived products keep their history, but new yield evidence cannot be recorded.</div>
          )}
          {feedback && <div className={`feedback feedback-${feedback.type}`}>{feedback.message}</div>}
        </form>

        <div className="yield-history-stack">
          <section className="panel effective-yield-card">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">EFFECTIVE LEARNING</p>
                <h2>{effective ? `Sample ${effective.sample.id}` : 'No effective sample'}</h2>
              </div>
              {effective && <span className="status-pill status-active">Effective</span>}
            </div>
            <p className="yield-notice">{effectiveNotice}</p>
            {effective && (
              <>
                <div className="yield-metrics">
                  <div><span>Good</span><strong>{effective.learning.goodPieces}</strong></div>
                  <div><span>Rejected</span><strong>{effective.learning.rejectedPieces}</strong></div>
                  <div><span>Defect rate</span><strong>{formatNumber(effective.learning.defectRate * 100, 2)}%</strong></div>
                </div>
                <div className="learned-requirements">
                  {effective.learning.materialRequirements.map((requirement) => (
                    <div key={requirement.materialId}>
                      <span>{materialById.get(requirement.materialId.toLocaleLowerCase())?.name ?? requirement.materialId}</span>
                      <strong>{formatNumber(requirement.baseQuantityPerGoodPiece)} {requirement.baseUnit} / good piece</strong>
                      <small>{requirement.conversionSource}{requirement.calibrationId ? ` · ${requirement.calibrationId}` : ''}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="panel material-list yield-history-panel">
            <div className="panel-heading list-heading">
              <div>
                <p className="panel-kicker">IMMUTABLE HISTORY</p>
                <h2>Recorded batches</h2>
              </div>
              <div className="material-count"><strong>{history.length}</strong><span>samples</span></div>
            </div>

            <div className="yield-history-list">
              {historyLoading ? (
                <div className="empty-state"><p>Loading yield history…</p></div>
              ) : history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">◎</div>
                  <h3>No yield history yet</h3>
                  <p>Record a real sample batch to start learning material consumption per good piece.</p>
                </div>
              ) : history.map((sample) => {
                const sampleIsEffective = sample.id === effectiveId;
                const skippedInvalid = skippedIds.has(sample.id);
                return (
                  <article className={`yield-history-item ${sampleIsEffective ? 'effective-history-item' : ''}`} key={sample.id}>
                    <div className="yield-history-heading">
                      <div>
                        <strong>{sample.id}</strong>
                        <span>{formatDate(sample.recordedAt)}</span>
                      </div>
                      <div className="history-badges">
                        {sampleIsEffective && <span className="status-pill status-active">Effective</span>}
                        {skippedInvalid && <span className="status-pill status-warning">Skipped invalid</span>}
                      </div>
                    </div>
                    <div className="history-summary">
                      <span>{sample.goodPieces} good</span>
                      <span>{sample.rejectedPieces} rejected</span>
                      <span>{formatNumber(defectRate(sample) * 100, 2)}% defect</span>
                      <span>{sample.mixPresetId ? (mixById.get(sample.mixPresetId.toLocaleLowerCase())?.name ?? sample.mixPresetId) : 'No mix preset'}</span>
                    </div>
                    <div className="history-materials">
                      {sample.materialInputs.map((input) => (
                        <span key={input.materialId}>
                          {materialById.get(input.materialId.toLocaleLowerCase())?.name ?? input.materialId}: {formatNumber(input.quantity)} {input.unit}
                        </span>
                      ))}
                    </div>
                    {sample.notes && <p className="history-notes">{sample.notes}</p>}
                    <div className="history-actions">
                      <button type="button" className="text-button danger" onClick={() => void deleteSample(sample)}>
                        Delete correction
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="list-footer">
              <span>Samples are immutable evidence; delete is an explicit correction and protected for active products.</span>
              <span>{effectiveId ? `Effective: ${effectiveId}` : 'No effective sample'}</span>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
