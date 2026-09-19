import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AppIcon } from '../icons/AppIcon';
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

type HistoryOrder = 'newest' | 'oldest';

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

function recordTime(record: MaterialCalibrationEvidence): number {
  const parsed = Date.parse(record.recordedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyOrder, setHistoryOrder] = useState<HistoryOrder>('newest');
  const [busy, setBusy] = useState(false);
  const contextRequestRef = useRef(0);
  const submissionRef = useRef(false);

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

  const previewComparison = useMemo(() => {
    if (!preview || !effective || effective.gramsPerCup <= 0) return null;
    const percent = ((preview.gramsPerCup - effective.gramsPerCup) / effective.gramsPerCup) * 100;
    if (Math.abs(percent) < 0.05) return 'Matches the current effective calibration.';
    return `${formatNumber(Math.abs(percent), 1)}% ${percent > 0 ? 'higher' : 'lower'} than the current effective calibration.`;
  }, [effective, preview]);

  const orderedRecords = useMemo(() => {
    return [...records].sort((left, right) => {
      const comparison = recordTime(right) - recordTime(left);
      return historyOrder === 'newest' ? comparison : -comparison;
    });
  }, [historyOrder, records]);

  const visibleRecords = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase();
    if (!query) return orderedRecords;
    return orderedRecords.filter((record) =>
      [
        record.id,
        record.notes ?? '',
        `${record.measuredVolume} ${record.volumeUnit}`,
        `${record.knownWeight} ${record.weightUnit}`,
      ].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [historyQuery, orderedRecords]);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((left, right) => recordTime(right) - recordTime(left))[0];
  }, [records]);

  const loadWorkspace = useCallback(async (preferredMaterialId?: string) => {
    const requestId = ++contextRequestRef.current;
    setLoading(true);
    setLoadError(null);
    setError(null);
    try {
      const activeMaterials = (await materialService.listMaterials({ active: true })).filter(
        (material) => material.baseUnit === 'g',
      );
      const selectedId =
        (preferredMaterialId && activeMaterials.some((material) => material.id === preferredMaterialId)
          ? preferredMaterialId
          : activeMaterials[0]?.id) ?? '';
      const [nextRecords, nextEffective] = selectedId
        ? await Promise.all([
            calibrationService.listCalibrations(selectedId),
            calibrationService.getEffectiveCalibration(selectedId),
          ])
        : [[], null] as const;

      if (requestId !== contextRequestRef.current) return;
      setMaterials(activeMaterials);
      setRecords([...nextRecords]);
      setEffective(nextEffective);
      setForm((current) => current.materialId === selectedId ? current : emptyForm(selectedId));
    } catch (caught) {
      if (requestId !== contextRequestRef.current) return;
      setLoadError(errorMessage(caught));
    } finally {
      if (requestId === contextRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function refreshMaterialContext(materialId: string) {
    const [nextRecords, nextEffective] = await Promise.all([
      calibrationService.listCalibrations(materialId),
      calibrationService.getEffectiveCalibration(materialId),
    ]);
    setRecords(nextRecords);
    setEffective(nextEffective);
  }

  async function chooseMaterial(materialId: string) {
    const requestId = ++contextRequestRef.current;
    setForm(emptyForm(materialId));
    setRecords([]);
    setEffective(null);
    setError(null);
    setMessage(null);
    setHistoryQuery('');
    setHistoryLoading(true);
    try {
      if (!materialId) return;
      const [nextRecords, nextEffective] = await Promise.all([
        calibrationService.listCalibrations(materialId),
        calibrationService.getEffectiveCalibration(materialId),
      ]);
      if (requestId !== contextRequestRef.current) return;
      setRecords(nextRecords);
      setEffective(nextEffective);
    } catch (caught) {
      if (requestId === contextRequestRef.current) setError(errorMessage(caught));
    } finally {
      if (requestId === contextRequestRef.current) setHistoryLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMaterial || !preview || submissionRef.current) return;

    submissionRef.current = true;
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
      setMessage(`Saved ${created.evidence.id}: ${formatNumber(created.gramsPerCup)} g/cup is now the latest valid sample.`);
      setForm(emptyForm(selectedMaterial.id));
      try {
        await refreshMaterialContext(selectedMaterial.id);
      } catch (caught) {
        setError(`The sample was saved, but the history could not refresh. ${errorMessage(caught)}`);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  }

  async function removeCalibration(record: MaterialCalibrationEvidence) {
    if (submissionRef.current) return;
    if (!window.confirm(`Delete calibration ${record.id}? This removes only this measurement evidence and may change which sample is effective.`)) return;
    submissionRef.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await calibrationService.deleteCalibration(record.id);
      setMessage(`Deleted ${record.id}. The effective calibration has been recalculated from the remaining evidence.`);
      await refreshMaterialContext(record.materialId);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  }

  function resetSample() {
    if (!selectedMaterial) return;
    setForm(emptyForm(selectedMaterial.id));
    setError(null);
    setMessage(null);
  }

  return (
    <section className="materials-workspace calibration-workspace" aria-labelledby="calibration-heading">
      <div className="page-heading-row calibration-page-heading">
        <div>
          <p className="eyebrow">MATERIAL CALIBRATION</p>
          <h1 id="calibration-heading">Calibration</h1>
          <p className="page-lead">
            Teach the system how much a measured volume of a specific material weighs. Use a real sample from the
            same material you purchase so cup-based quantities can be costed and normalized accurately in grams.
          </p>
        </div>
        <div
          className="session-badge"
          title="Calibration evidence is part of the authoritative workbook source dataset when you export or save a workbook copy."
        >
          <span className="status-dot" aria-hidden="true" />
          Included in workbook exports
        </div>
      </div>

      <ol className="calibration-guide panel" aria-label="Calibration workflow">
        <li>
          <span className="calibration-step-number">1</span>
          <div><strong>Choose the material</strong><small>Calibration is material-specific; plaster and pigment can weigh differently by cup.</small></div>
        </li>
        <li>
          <span className="calibration-step-number">2</span>
          <div><strong>Measure a known volume</strong><small>Use a consistent measuring cup or volume unit and avoid compacting the sample.</small></div>
        </li>
        <li>
          <span className="calibration-step-number">3</span>
          <div><strong>Weigh that same sample</strong><small>Enter the scale reading. The app derives grams per cup and keeps your evidence.</small></div>
        </li>
      </ol>

      {loading ? (
        <div className="panel calibration-state-panel" role="status" aria-live="polite">
          <div className="calibration-state-icon" aria-hidden="true"><AppIcon name="calibration" size={26} /></div>
          <div><h2>Loading calibration workspace</h2><p>Checking eligible materials and their saved measurement evidence…</p></div>
        </div>
      ) : loadError ? (
        <div className="panel calibration-state-panel calibration-state-error" role="alert">
          <div className="calibration-state-icon" aria-hidden="true"><AppIcon name="alert" size={25} /></div>
          <div>
            <h2>Calibration unavailable</h2>
            <p>{loadError}</p>
            <button className="button button-quiet" type="button" onClick={() => void loadWorkspace(form.materialId)}>Retry loading</button>
          </div>
        </div>
      ) : materials.length === 0 ? (
        <div className="panel calibration-state-panel calibration-empty">
          <div className="calibration-state-icon" aria-hidden="true"><AppIcon name="scale" size={25} /></div>
          <div>
            <h2>Add a weight-based material first</h2>
            <p>Calibration becomes available after an active material with canonical base unit <strong>g</strong> exists.</p>
          </div>
        </div>
      ) : (
        <div className="materials-layout calibration-layout">
          <form className="material-form panel calibration-form" aria-label="Calibration sample" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">NEW MEASUREMENT</p>
                <h2>Record a sample</h2>
                <p className="calibration-panel-lead">Measure once, review the derived result, then save the evidence.</p>
              </div>
            </div>

            <fieldset className="calibration-form-fieldset" disabled={busy || historyLoading}>
              <div className="form-grid">
                <label className="field field-wide calibration-material-field">
                  <span>Material</span>
                  <select value={form.materialId} onChange={(event) => void chooseMaterial(event.target.value)}>
                    {materials.map((material) => (
                      <option value={material.id} key={material.id}>{material.name} ({material.id})</option>
                    ))}
                  </select>
                  <small>Only active materials whose canonical base unit is grams are eligible.</small>
                </label>

                <div className="field-wide calibration-context" aria-label="Selected material calibration summary">
                  <div>
                    <span>Selected material</span>
                    <strong>{selectedMaterial?.name ?? '—'}</strong>
                    <small>{selectedMaterial?.id ?? ''} · canonical base unit g</small>
                  </div>
                  <div>
                    <span>Current calibration</span>
                    <strong>{historyLoading ? 'Loading…' : effective ? `${formatNumber(effective.gramsPerCup)} g/cup` : 'Not calibrated'}</strong>
                    <small>{effective ? 'Latest valid sample' : 'Your first saved sample will establish it'}</small>
                  </div>
                  <div>
                    <span>Evidence</span>
                    <strong>{historyLoading ? '—' : records.length}</strong>
                    <small>{records.length === 1 ? 'saved sample' : 'saved samples'}</small>
                  </div>
                </div>

                <section className="field-wide calibration-measurement-card" aria-labelledby="volume-step-heading">
                  <div className="calibration-measurement-heading">
                    <span className="calibration-mini-step">1</span>
                    <div><strong id="volume-step-heading">Measure the sample by volume</strong><small>Use the amount you actually scoop or pour during production.</small></div>
                  </div>
                  <div className="calibration-input-pair">
                    <label className="field">
                      <span>Volume quantity</span>
                      <input required min="0.000001" step="any" inputMode="decimal" type="number" value={form.measuredVolume} onChange={(event) => setForm((current) => ({ ...current, measuredVolume: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Volume unit</span>
                      <select value={form.volumeUnit} onChange={(event) => setForm((current) => ({ ...current, volumeUnit: event.target.value as VolumeUnit }))}>
                        {VOLUME_UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="field-wide calibration-measurement-card" aria-labelledby="weight-step-heading">
                  <div className="calibration-measurement-heading">
                    <span className="calibration-mini-step">2</span>
                    <div><strong id="weight-step-heading">Weigh the exact same sample</strong><small>Tare the container first, then enter only the material’s weight.</small></div>
                  </div>
                  <div className="calibration-input-pair">
                    <label className="field">
                      <span>Weight quantity</span>
                      <input required min="0.000001" step="any" inputMode="decimal" type="number" value={form.knownWeight} onChange={(event) => setForm((current) => ({ ...current, knownWeight: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Weight unit</span>
                      <select value={form.weightUnit} onChange={(event) => setForm((current) => ({ ...current, weightUnit: event.target.value as WeightUnit }))}>
                        {WEIGHT_UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <div className="field field-wide cost-preview calibration-preview" aria-live="polite">
                  <div className="cost-preview-heading calibration-preview-heading">
                    <div>
                      <span>Live calibration result</span>
                      <small>Preview only. The measurement evidence remains the source of truth.</small>
                    </div>
                    <span className={`calibration-readiness ${preview ? 'is-ready' : ''}`}>{preview ? 'Ready to save' : 'Waiting for weight'}</span>
                  </div>
                  {preview ? (
                    <>
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
                      {previewComparison && <p className="calibration-comparison">{previewComparison}</p>}
                    </>
                  ) : (
                    <div className="cost-preview-empty">Enter a positive weight for the measured volume to see the derived grams-per-cup value.</div>
                  )}
                </div>

                <details className="field-wide calibration-sample-details">
                  <summary>
                    <span>Sample details</span>
                    <small>ID, timestamp and optional measurement notes</small>
                  </summary>
                  <div className="calibration-detail-grid">
                    <label className="field field-wide">
                      <span>Calibration ID</span>
                      <input required value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} />
                      <small>Auto-generated, but editable when you need a lab/batch reference.</small>
                    </label>
                    <label className="field field-wide">
                      <span>Measured at</span>
                      <input required type="datetime-local" value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} />
                    </label>
                    <label className="field field-wide">
                      <span>Notes</span>
                      <textarea rows={3} value={form.notes} placeholder="Brand or batch, level cup, measuring method, scale used, etc." onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                  </div>
                </details>
              </div>

              <div className="calibration-form-actions">
                <button className="button button-quiet" type="button" onClick={resetSample}>Reset sample</button>
                <button className="button button-primary" disabled={!preview} type="submit">
                  {busy ? 'Saving…' : 'Save sample & use as latest'}
                </button>
              </div>
            </fieldset>

            {error && <div className="feedback feedback-error" role="alert" tabIndex={-1}>{error}</div>}
            {message && <div className="feedback feedback-success" role="status">{message}</div>}
          </form>

          <div className="material-list panel calibration-history" aria-label="Calibration history">
            <div className="panel-heading list-heading calibration-history-heading">
              <div>
                <p className="panel-kicker">CALIBRATION HISTORY</p>
                <h2>{selectedMaterial?.name ?? 'Material'}</h2>
                <p>Review the evidence behind the value used by costing and unit conversion.</p>
              </div>
              <div className="material-count">
                <strong>{records.length}</strong><span>{records.length === 1 ? 'sample' : 'samples'}</span>
              </div>
            </div>

            <div className="calibration-summary-grid" aria-label="Calibration evidence summary">
              <div className="effective-calibration">
                <span>Effective calibration</span>
                {historyLoading ? (
                  <><strong>Loading…</strong><small>Reading saved evidence</small></>
                ) : effective ? (
                  <>
                    <strong>{formatNumber(effective.gramsPerCup)} g/cup</strong>
                    <small>{effective.evidence.id} · latest valid sample</small>
                  </>
                ) : (
                  <><strong>Not calibrated</strong><small>Save the first measurement sample.</small></>
                )}
              </div>
              <div className="calibration-summary-card">
                <span>Saved evidence</span>
                <strong>{historyLoading ? '—' : records.length}</strong>
                <small>{records.length === 1 ? 'measurement sample' : 'measurement samples'}</small>
              </div>
              <div className="calibration-summary-card">
                <span>Latest measurement</span>
                <strong>{historyLoading ? 'Loading…' : latestRecord ? formatDate(latestRecord.recordedAt) : 'No sample yet'}</strong>
                <small>{latestRecord?.notes || 'Keep notes when batches or methods differ.'}</small>
              </div>
            </div>

            <div className="calibration-history-toolbar">
              <label className="field search-field">
                <span className="sr-only">Search calibration history</span>
                <input
                  aria-label="Search calibration history"
                  type="search"
                  placeholder="Search sample ID, notes or measurement…"
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                />
              </label>
              <label className="field calibration-sort-field">
                <span className="sr-only">Sort calibration history</span>
                <select aria-label="Sort calibration history" value={historyOrder} onChange={(event) => setHistoryOrder(event.target.value as HistoryOrder)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>

            <div className="table-wrap calibration-table-wrap">
              {historyLoading ? (
                <div className="empty-state calibration-history-state" role="status"><div className="empty-icon" aria-hidden="true"><AppIcon name="loader" size={28} className="is-spinning" /></div><h3>Loading calibration history</h3><p>Reading the selected material’s evidence and effective conversion.</p></div>
              ) : (
                <>
                  <table role="table" className="responsive-table materials-table calibration-table">
                    <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Sample</th><th role="columnheader" scope="col">Measured</th><th role="columnheader" scope="col">Derived</th><th role="columnheader" scope="col">Recorded</th><th role="columnheader" scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody role="rowgroup">
                      {visibleRecords.map((record) => {
                        const material = materials.find((candidate) => candidate.id.toLocaleLowerCase() === record.materialId.toLocaleLowerCase());
                        if (!material) return null;
                        const derived = deriveMaterialCupWeightCalibration(material, record);
                        const isEffective = effective?.evidence.id.toLocaleLowerCase() === record.id.toLocaleLowerCase();
                        return (
                          <tr role="row" key={record.id} className={isEffective ? 'effective-row' : undefined}>
                            <td role="cell" data-label="Sample"><strong>{record.id}</strong>{isEffective && <span className="group-pill">Effective</span>}</td>
                            <td role="cell" data-label="Measured">{record.measuredVolume} {record.volumeUnit}<span className="cost-detail">{record.knownWeight} {record.weightUnit}</span></td>
                            <td role="cell" data-label="Derived"><strong>{formatNumber(derived.gramsPerCup)} g/cup</strong><span className="cost-detail">{formatNumber(derived.measuredCups)} cup · {formatNumber(derived.knownWeightGrams)} g</span></td>
                            <td role="cell" data-label="Recorded">{formatDate(record.recordedAt)}{record.notes && <span className="cost-detail">{record.notes}</span>}</td>
                            <td role="cell" data-label="Actions" className="row-actions"><button className="text-button danger" type="button" disabled={busy} onClick={() => void removeCalibration(record)}>Delete</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {records.length === 0 && (
                    <div className="empty-state"><div className="empty-icon" aria-hidden="true"><AppIcon name="calibration" size={28} /></div><h3>No calibration samples yet</h3><p>Record a known volume and the weight of that same sample to establish this material’s grams-per-cup relationship.</p></div>
                  )}
                  {records.length > 0 && visibleRecords.length === 0 && (
                    <div className="empty-state"><div className="empty-icon" aria-hidden="true"><AppIcon name="search" size={28} /></div><h3>No matching samples</h3><p>Try a different sample ID, note, quantity or unit.</p></div>
                  )}
                </>
              )}
            </div>
            <footer className="list-footer"><span>Latest valid sample is used automatically</span><span>Calibration evidence is included in workbook exports</span></footer>
          </div>
        </div>
      )}
    </section>
  );
}
