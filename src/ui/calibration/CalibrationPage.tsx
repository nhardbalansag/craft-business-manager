import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalibrationApplicationError,
} from '../../application/calibrations/CalibrationService';
import { calibrationService, materialService } from '../../application/session';
import {
  MaterialCalibrationError,
  deriveMaterialCupWeightCalibration,
  type MaterialCalibrationEvidence,
  type MaterialCupWeightCalibration,
} from '../../domain/materialCalibration';
import type { Material } from '../../domain/materials';
import {
  SUPPORTED_UNITS,
  getUnitDimension,
  type VolumeUnit,
  type WeightUnit,
} from '../../domain/units';
import './calibration.css';

const VOLUME_UNITS = SUPPORTED_UNITS.filter(
  (unit): unit is VolumeUnit => getUnitDimension(unit) === 'volume',
);
const WEIGHT_UNITS = SUPPORTED_UNITS.filter(
  (unit): unit is WeightUnit => getUnitDimension(unit) === 'weight',
);

type CalibrationFormState = {
  id: string;
  materialId: string;
  measuredVolume: string;
  volumeUnit: VolumeUnit;
  knownWeight: string;
  weightUnit: WeightUnit;
  recordedAt: string;
  notes: string;
};

function localDateTimeInputValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function suggestedId(materialId: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return materialId ? `CAL-${materialId.replace(/^MAT-/i, '')}-${stamp}` : '';
}

function emptyForm(materialId = ''): CalibrationFormState {
  return {
    id: suggestedId(materialId),
    materialId,
    measuredVolume: '1',
    volumeUnit: 'cup',
    knownWeight: '',
    weightUnit: 'g',
    recordedAt: localDateTimeInputValue(),
    notes: '',
  };
}

function formatNumber(value: number, maximumFractionDigits = 6): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function errorMessage(error: unknown): string {
  if (error instanceof CalibrationApplicationError || error instanceof MaterialCalibrationError) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong while updating calibration records.';
}

export function CalibrationPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [records, setRecords] = useState<MaterialCalibrationEvidence[]>([]);
  const [effective, setEffective] = useState<MaterialCupWeightCalibration | null>(null);
  const [form, setForm] = useState<CalibrationFormState>(() => emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === form.materialId) ?? null,
    [form.materialId, materials],
  );

  const preview = useMemo(() => {
    if (!selectedMaterial || !form.measuredVolume || !form.knownWeight || !form.recordedAt) return null;
    try {
      return deriveMaterialCupWeightCalibration(selectedMaterial, {
        id: form.id || 'PREVIEW',
        materialId: selectedMaterial.id,
        measuredVolume: Number(form.measuredVolume),
        volumeUnit: form.volumeUnit,
        knownWeight: Number(form.knownWeight),
        weightUnit: form.weightUnit,
        recordedAt: new Date(form.recordedAt).toISOString(),
        notes: form.notes,
      });
    } catch {
      return null;
    }
  }, [form, selectedMaterial]);

  const refresh = useCallback(async (materialId?: string) => {
    const activeMaterials = (await materialService.listMaterials({ active: true })).filter(
      (material) => material.baseUnit === 'g',
    );
    setMaterials(activeMaterials);

    const selectedId = materialId ?? form.materialId ?? activeMaterials[0]?.id ?? '';
    if (!selectedId) {
      setRecords([]);
      setEffective(null);
      return;
    }

    setRecords(await calibrationService.listCalibrations(selectedId));
    setEffective(await calibrationService.getEffectiveCalibration(selectedId));
  }, [form.materialId]);

  useEffect(() => {
    void (async () => {
      const activeMaterials = (await materialService.listMaterials({ active: true })).filter(
        (material) => material.baseUnit === 'g',
      );
      setMaterials(activeMaterials);
      const initialId = form.materialId || activeMaterials[0]?.id || '';
      if (initialId && form.materialId !== initialId) setForm(emptyForm(initialId));
      if (initialId) {
        setRecords(await calibrationService.listCalibrations(initialId));
        setEffective(await calibrationService.getEffectiveCalibration(initialId));
      }
    })();
    // Initial session load only; tab remounts when revisited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chooseMaterial(materialId: string) {
    setForm(emptyForm(materialId));
    setError(null);
    setMessage(null);
    setRecords(materialId ? await calibrationService.listCalibrations(materialId) : []);
    setEffective(materialId ? await calibrationService.getEffectiveCalibration(materialId) : null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMaterial) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await calibrationService.createCalibration({
        id: form.id,
        materialId: selectedMaterial.id,
        measuredVolume: Number(form.measuredVolume),
        volumeUnit: form.volumeUnit,
        knownWeight: Number(form.knownWeight),
        weightUnit: form.weightUnit,
        recordedAt: new Date(form.recordedAt).toISOString(),
        notes: form.notes,
      });
      setMessage(`Saved ${created.evidence.id}: ${formatNumber(created.gramsPerCup)} g/cup.`);
      setForm(emptyForm(selectedMaterial.id));
      await refresh(selectedMaterial.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function removeCalibration(record: MaterialCalibrationEvidence) {
    if (!window.confirm(`Delete calibration ${record.id}? This removes only this measurement evidence.`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await calibrationService.deleteCalibration(record.id);
      setMessage(`Deleted ${record.id}.`);
      await refresh(record.materialId);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="materials-workspace calibration-workspace" aria-labelledby="calibration-heading">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">MATERIAL CALIBRATION</p>
          <h1 id="calibration-heading">Calibration</h1>
          <p className="page-lead">
            Measure a specific dry material by volume and known weight. The system keeps the evidence and derives
            grams per cup without changing the universal unit rules.
          </p>
        </div>
        <div className="session-badge" title="Excel persistence is planned for a later phase">
          <span className="status-dot" aria-hidden="true" />
          Session-only calibration history
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="panel calibration-empty">
          <h2>Add a weight-based material first</h2>
          <p>Calibration becomes available after an active material with base unit <strong>g</strong> exists.</p>
        </div>
      ) : (
        <div className="materials-layout calibration-layout">
          <form className="material-form panel" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">NEW SAMPLE</p>
                <h2>Record calibration</h2>
              </div>
            </div>

            <div className="form-grid">
              <label className="field field-wide">
                <span>Material</span>
                <select value={form.materialId} onChange={(event) => void chooseMaterial(event.target.value)}>
                  {materials.map((material) => (
                    <option value={material.id} key={material.id}>{material.name} ({material.id})</option>
                  ))}
                </select>
                <small>Only active materials with canonical base unit g are eligible.</small>
              </label>

              <label className="field field-wide">
                <span>Calibration ID</span>
                <input required value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} />
              </label>

              <div className="field-group-title">Measured volume</div>
              <label className="field">
                <span>Quantity</span>
                <input required min="0.000001" step="any" type="number" value={form.measuredVolume} onChange={(event) => setForm((current) => ({ ...current, measuredVolume: event.target.value }))} />
              </label>
              <label className="field">
                <span>Volume unit</span>
                <select value={form.volumeUnit} onChange={(event) => setForm((current) => ({ ...current, volumeUnit: event.target.value as VolumeUnit }))}>
                  {VOLUME_UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                </select>
              </label>

              <div className="field-group-title">Known weight</div>
              <label className="field">
                <span>Quantity</span>
                <input required min="0.000001" step="any" type="number" value={form.knownWeight} onChange={(event) => setForm((current) => ({ ...current, knownWeight: event.target.value }))} />
              </label>
              <label className="field">
                <span>Weight unit</span>
                <select value={form.weightUnit} onChange={(event) => setForm((current) => ({ ...current, weightUnit: event.target.value as WeightUnit }))}>
                  {WEIGHT_UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                </select>
              </label>

              <label className="field field-wide">
                <span>Measured at</span>
                <input required type="datetime-local" value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} />
              </label>

              <label className="field field-wide">
                <span>Notes</span>
                <textarea rows={3} value={form.notes} placeholder="Brand/batch, level cups, measuring method, etc." onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>

              <div className="field field-wide cost-preview calibration-preview" aria-live="polite">
                <div className="cost-preview-heading">
                  <span>Derived calibration</span>
                  <small>Calculated from this measurement; not stored as an independent source value.</small>
                </div>
                {preview ? (
                  <div className="cost-metrics">
                    <div className="cost-metric">
                      <span>Normalized volume</span>
                      <strong>{formatNumber(preview.measuredCups)} cup</strong>
                    </div>
                    <div className="cost-metric">
                      <span>Normalized weight</span>
                      <strong>{formatNumber(preview.knownWeightGrams)} g</strong>
                    </div>
                    <div className="cost-metric cost-metric-emphasis calibration-result">
                      <span>Grams per cup</span>
                      <strong>{formatNumber(preview.gramsPerCup)} g/cup</strong>
                    </div>
                  </div>
                ) : (
                  <div className="cost-preview-empty">Enter positive volume and weight values to preview grams per cup.</div>
                )}
              </div>
            </div>

            {error && <div className="feedback feedback-error" role="alert">{error}</div>}
            {message && <div className="feedback feedback-success" role="status">{message}</div>}
            <button className="button button-primary button-full" disabled={busy || !preview} type="submit">
              {busy ? 'Saving…' : 'Save calibration sample'}
            </button>
          </form>

          <div className="material-list panel calibration-history">
            <div className="panel-heading list-heading">
              <div>
                <p className="panel-kicker">CALIBRATION HISTORY</p>
                <h2>{selectedMaterial?.name ?? 'Material'}</h2>
              </div>
              <div className="material-count">
                <strong>{records.length}</strong><span>samples</span>
              </div>
            </div>

            <div className="effective-calibration">
              <span>Effective calibration</span>
              {effective ? (
                <>
                  <strong>{formatNumber(effective.gramsPerCup)} g/cup</strong>
                  <small>{effective.evidence.id} · latest valid sample</small>
                </>
              ) : (
                <><strong>Not calibrated</strong><small>Save the first measurement sample.</small></>
              )}
            </div>

            <div className="table-wrap">
              <table className="materials-table calibration-table">
                <thead><tr><th>Sample</th><th>Measured</th><th>Derived</th><th>Recorded</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {records.map((record) => {
                    const material = materials.find((candidate) => candidate.id.toLocaleLowerCase() === record.materialId.toLocaleLowerCase());
                    if (!material) return null;
                    const derived = deriveMaterialCupWeightCalibration(material, record);
                    const isEffective = effective?.evidence.id.toLocaleLowerCase() === record.id.toLocaleLowerCase();
                    return (
                      <tr key={record.id} className={isEffective ? 'effective-row' : undefined}>
                        <td><strong>{record.id}</strong>{isEffective && <span className="group-pill">Effective</span>}</td>
                        <td>{record.measuredVolume} {record.volumeUnit}<span className="cost-detail">{record.knownWeight} {record.weightUnit}</span></td>
                        <td><strong>{formatNumber(derived.gramsPerCup)} g/cup</strong><span className="cost-detail">{formatNumber(derived.measuredCups)} cup · {formatNumber(derived.knownWeightGrams)} g</span></td>
                        <td>{formatDate(record.recordedAt)}{record.notes && <span className="cost-detail">{record.notes}</span>}</td>
                        <td className="row-actions"><button className="text-button danger" type="button" disabled={busy} onClick={() => void removeCalibration(record)}>Delete</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {records.length === 0 && (
                <div className="empty-state"><div className="empty-icon" aria-hidden="true">↔</div><h3>No calibration samples yet</h3><p>Record a known volume and weight to establish this material’s grams-per-cup relationship.</p></div>
              )}
            </div>
            <footer className="list-footer"><span>Latest valid sample is used automatically</span><span>Excel save/load arrives in Phase 5</span></footer>
          </div>
        </div>
      )}
    </section>
  );
}
