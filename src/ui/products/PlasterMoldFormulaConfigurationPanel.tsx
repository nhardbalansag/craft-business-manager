import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  materialService,
  plasterMoldYieldCalculatorService,
  plasterMoldYieldProfileService,
} from '../../application/session';
import type { PlasterMoldYieldCalculatorResult } from '../../application/plasterMoldYieldProfiles/PlasterMoldYieldCalculatorService';
import { nextSequentialId } from '../../domain/identifiers';
import type { Material } from '../../domain/materials';
import type { Mold } from '../../domain/molds';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import './plasterMoldFormulaConfiguration.css';

type ProfileFormState = {
  waterMaterialId: string;
  plasterMaterialId: string;
  glueMaterialId: string;
  waterFillWeightGrams: string;
  waterAdjustmentPercent: string;
  plasterFactor: string;
  glueFactor: string;
  piecesPerPour: string;
  notes: string;
};

const EMPTY_FORM: ProfileFormState = {
  waterMaterialId: '',
  plasterMaterialId: '',
  glueMaterialId: '',
  waterFillWeightGrams: '',
  waterAdjustmentPercent: '30',
  plasterFactor: '0.75',
  glueFactor: '0.05',
  piecesPerPour: '1',
  notes: '',
};

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The mold formula profile could not be saved.';
}

function formatGrams(value: number): string {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value)} g`;
}

function profileToForm(profile: PlasterMoldYieldProfile): ProfileFormState {
  return {
    waterMaterialId: profile.waterMaterialId,
    plasterMaterialId: profile.plasterMaterialId,
    glueMaterialId: profile.glueMaterialId,
    waterFillWeightGrams: String(profile.waterFillWeightGrams),
    waterAdjustmentPercent: String(profile.waterAdjustmentRate * 100),
    plasterFactor: String(profile.plasterFactor),
    glueFactor: String(profile.glueFactor),
    piecesPerPour: String(profile.piecesPerPour),
    notes: profile.notes ?? '',
  };
}

function materialOptionLabel(material: Material): string {
  return `${material.name} · ${material.id}`;
}

export function PlasterMoldFormulaConfigurationPanel({
  molds,
  onProfilesChanged,
}: {
  molds: readonly Mold[];
  onProfilesChanged?: () => void;
}) {
  const [profiles, setProfiles] = useState<PlasterMoldYieldProfile[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMoldId, setSelectedMoldId] = useState('');
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [estimate, setEstimate] =
    useState<PlasterMoldYieldCalculatorResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const activeMolds = useMemo(
    () => molds.filter((mold) => mold.isActive),
    [molds],
  );

  const reloadSources = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProfiles, nextMaterials] = await Promise.all([
        plasterMoldYieldProfileService.listProfiles(),
        materialService.listMaterials(),
      ]);
      setProfiles(nextProfiles);
      setMaterials(nextMaterials);
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSources();
  }, [reloadSources]);

  useEffect(() => {
    if (activeMolds.length === 0) {
      setSelectedMoldId('');
      return;
    }

    if (
      !selectedMoldId ||
      !activeMolds.some(
        (mold) => comparable(mold.id) === comparable(selectedMoldId),
      )
    ) {
      setSelectedMoldId(activeMolds[0].id);
    }
  }, [activeMolds, selectedMoldId]);

  const selectedMold = useMemo(
    () =>
      activeMolds.find(
        (mold) => comparable(mold.id) === comparable(selectedMoldId),
      ) ?? null,
    [activeMolds, selectedMoldId],
  );

  const moldProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          comparable(profile.moldId) === comparable(selectedMoldId),
      ),
    [profiles, selectedMoldId],
  );

  const activeProfile = useMemo(
    () => moldProfiles.find((profile) => profile.isActive) ?? null,
    [moldProfiles],
  );

  const archivedProfiles = useMemo(
    () => moldProfiles.filter((profile) => !profile.isActive),
    [moldProfiles],
  );

  const weightMaterials = useMemo(
    () => materials.filter((material) => material.isActive && material.baseUnit === 'g'),
    [materials],
  );

  const generatedProfileId = useMemo(
    () => nextSequentialId(profiles.map((profile) => profile.id), 'PMYP'),
    [profiles],
  );

  useEffect(() => {
    if (activeProfile) {
      setForm(profileToForm(activeProfile));
    } else {
      setForm(EMPTY_FORM);
    }
    setRequestedQuantity('');
    setFeedback(null);
  }, [activeProfile?.id, selectedMoldId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshEstimate() {
      if (!selectedMold || !activeProfile) {
        setEstimate(null);
        setEstimateError(null);
        return;
      }

      const raw = requestedQuantity.trim();
      let quantity: number | undefined;
      if (raw) {
        quantity = Number(raw);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          setEstimate(null);
          setEstimateError('Requested quantity must be a positive whole number.');
          return;
        }
      }

      try {
        const result = await plasterMoldYieldCalculatorService.calculateForMold(
          selectedMold.id,
          quantity,
        );
        if (!cancelled) {
          setEstimate(result);
          setEstimateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setEstimate(null);
          setEstimateError(errorMessage(error));
        }
      }
    }

    void refreshEstimate();

    return () => {
      cancelled = true;
    };
  }, [activeProfile, requestedQuantity, selectedMold]);

  function updateForm<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (busy || !selectedMold) return;

    setBusy(true);
    setFeedback(null);

    const input = {
      moldId: selectedMold.id,
      waterMaterialId: form.waterMaterialId,
      plasterMaterialId: form.plasterMaterialId,
      glueMaterialId: form.glueMaterialId,
      waterFillWeightGrams: Number(form.waterFillWeightGrams),
      waterAdjustmentRate: Number(form.waterAdjustmentPercent) / 100,
      plasterFactor: Number(form.plasterFactor),
      glueFactor: Number(form.glueFactor),
      piecesPerPour: Number(form.piecesPerPour),
      notes: form.notes,
    };

    try {
      if (activeProfile) {
        await plasterMoldYieldProfileService.updateProfile(
          activeProfile.id,
          input,
        );
        setFeedback({
          type: 'success',
          message: `Formula profile ${activeProfile.id} updated.`,
        });
      } else {
        await plasterMoldYieldProfileService.createProfile({
          id: generatedProfileId,
          ...input,
          isActive: true,
        });
        setFeedback({
          type: 'success',
          message: `Formula profile ${generatedProfileId} created.`,
        });
      }

      await reloadSources();
      onProfilesChanged?.();
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function archiveActiveProfile() {
    if (!activeProfile || busy) return;

    setBusy(true);
    setFeedback(null);
    try {
      await plasterMoldYieldProfileService.archiveProfile(activeProfile.id);
      await reloadSources();
      onProfilesChanged?.();
      setFeedback({
        type: 'success',
        message: `Formula profile ${activeProfile.id} archived.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function restoreProfile(profile: PlasterMoldYieldProfile) {
    if (busy || activeProfile) return;

    setBusy(true);
    setFeedback(null);
    try {
      await plasterMoldYieldProfileService.restoreProfile(profile.id);
      await reloadSources();
      onProfilesChanged?.();
      setFeedback({
        type: 'success',
        message: `Formula profile ${profile.id} restored.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="plaster-formula-config panel"
      aria-label="Plaster mold formula configuration"
    >
      <div className="plaster-formula-heading">
        <div>
          <p className="panel-kicker">MOLD FORMULA</p>
          <h3>Plaster yield setup</h3>
          <p>
            Configure the measured water-fill recipe for one physical Mold.
            Estimates stay theoretical until actual Yield evidence is recorded.
          </p>
        </div>
        <span className="plaster-formula-boundary">
          No safety waste · No Yield write
        </span>
      </div>

      {activeMolds.length === 0 ? (
        <div className="empty-state plaster-formula-empty">
          <strong>Add an active Mold first.</strong>
          <p>
            Formula setup becomes available when the physical Mold record exists.
          </p>
        </div>
      ) : (
        <>
          <div className="plaster-formula-selector">
            <label className="field">
              <span>Mold</span>
              <select
                value={selectedMoldId}
                onChange={(event) => setSelectedMoldId(event.target.value)}
                aria-label="Formula Mold"
              >
                {activeMolds.map((mold) => (
                  <option key={mold.id} value={mold.id}>
                    {mold.name} · {mold.id}
                  </option>
                ))}
              </select>
            </label>

            <div className="plaster-formula-status" aria-live="polite">
              <span>Formula status</span>
              <strong className={activeProfile ? 'ready' : 'missing'}>
                {activeProfile
                  ? `Active · ${activeProfile.id}`
                  : 'Not configured'}
              </strong>
              <small>
                {activeProfile
                  ? 'The MY4 calculator uses this saved profile.'
                  : 'Create a profile to enable theoretical estimates.'}
              </small>
            </div>
          </div>

          {feedback && (
            <div
              className={`feedback ${feedback.type}`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.message}
            </div>
          )}

          <div className="plaster-formula-layout">
            <form
              className="plaster-formula-form"
              onSubmit={submitProfile}
              aria-label="Mold formula profile form"
            >
              <div className="plaster-formula-form-heading">
                <div>
                  <span>Profile</span>
                  <strong>
                    {activeProfile ? activeProfile.id : generatedProfileId}
                  </strong>
                </div>
                {activeProfile && (
                  <button
                    type="button"
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void archiveActiveProfile()}
                  >
                    Archive profile
                  </button>
                )}
              </div>

              <div className="plaster-formula-material-grid">
                <label className="field">
                  <span>Water material</span>
                  <select
                    required
                    value={form.waterMaterialId}
                    onChange={(event) =>
                      updateForm('waterMaterialId', event.target.value)
                    }
                  >
                    <option value="">Select water material</option>
                    {weightMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {materialOptionLabel(material)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Plaster material</span>
                  <select
                    required
                    value={form.plasterMaterialId}
                    onChange={(event) =>
                      updateForm('plasterMaterialId', event.target.value)
                    }
                  >
                    <option value="">Select plaster material</option>
                    {weightMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {materialOptionLabel(material)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Glue material</span>
                  <select
                    required
                    value={form.glueMaterialId}
                    onChange={(event) =>
                      updateForm('glueMaterialId', event.target.value)
                    }
                  >
                    <option value="">Select glue material</option>
                    {weightMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {materialOptionLabel(material)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="plaster-formula-material-help">
                Only active Materials with base unit <strong>g</strong> are shown.
                Water, plaster, and glue must be different Materials.
              </p>

              <div className="plaster-formula-number-grid">
                <label className="field">
                  <span>Mold water fill (g)</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.waterFillWeightGrams}
                    onChange={(event) =>
                      updateForm('waterFillWeightGrams', event.target.value)
                    }
                    placeholder="50"
                  />
                  <small>Measured by filling this Mold with water and weighing it.</small>
                </label>

                <label className="field">
                  <span>Water adjustment (%)</span>
                  <input
                    required
                    type="number"
                    min="0"
                    max="99.9999"
                    step="any"
                    value={form.waterAdjustmentPercent}
                    onChange={(event) =>
                      updateForm('waterAdjustmentPercent', event.target.value)
                    }
                    placeholder="30"
                  />
                  <small>30 means the recipe keeps 70% of measured mold water.</small>
                </label>

                <label className="field">
                  <span>Plaster factor</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.plasterFactor}
                    onChange={(event) =>
                      updateForm('plasterFactor', event.target.value)
                    }
                    placeholder="0.75"
                  />
                </label>

                <label className="field">
                  <span>Glue factor</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.glueFactor}
                    onChange={(event) =>
                      updateForm('glueFactor', event.target.value)
                    }
                    placeholder="0.05"
                  />
                </label>

                <label className="field">
                  <span>Pieces per pour</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.piecesPerPour}
                    onChange={(event) =>
                      updateForm('piecesPerPour', event.target.value)
                    }
                    placeholder="1"
                  />
                  <small>Use the total cavity count filled by one complete pour.</small>
                </label>
              </div>

              <label className="field">
                <span>Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  placeholder="Mold condition, measurement notes, or recipe context"
                />
              </label>

              <button
                className="button button-primary plaster-formula-save"
                disabled={busy || loading || !selectedMold}
              >
                {activeProfile ? 'Save formula changes' : 'Create formula profile'}
              </button>
            </form>

            <div className="plaster-formula-preview">
              <div className="plaster-formula-preview-heading">
                <div>
                  <span>THEORETICAL ESTIMATE</span>
                  <strong>
                    {activeProfile ? 'Saved formula preview' : 'Save a profile first'}
                  </strong>
                </div>
                {activeProfile && (
                  <label>
                    <span>Requested pieces</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={requestedQuantity}
                      onChange={(event) =>
                        setRequestedQuantity(event.target.value)
                      }
                      placeholder="Optional"
                      aria-label="Requested pieces"
                    />
                  </label>
                )}
              </div>

              {estimateError && (
                <div className="feedback error" role="alert">
                  {estimateError}
                </div>
              )}

              {!activeProfile ? (
                <div className="empty-state plaster-formula-preview-empty">
                  <strong>No active formula yet.</strong>
                  <p>
                    Save this Mold's configuration to calculate water, plaster,
                    glue, per-piece amounts, and required pours.
                  </p>
                </div>
              ) : estimate ? (
                <>
                  <div className="plaster-formula-metrics">
                    <div>
                      <span>Per pour</span>
                      <strong>{formatGrams(estimate.formula.perPour.totalMixtureGrams)}</strong>
                      <small>{estimate.formula.piecesPerPour} piece capacity</small>
                    </div>
                    <div>
                      <span>Per piece</span>
                      <strong>{formatGrams(estimate.formula.perPiece.totalMixtureGrams)}</strong>
                      <small>Theoretical mixture</small>
                    </div>
                    <div>
                      <span>Water</span>
                      <strong>{formatGrams(estimate.formula.perPour.adjustedWaterGrams)}</strong>
                      <small>Adjusted per pour</small>
                    </div>
                    <div>
                      <span>Plaster</span>
                      <strong>{formatGrams(estimate.formula.perPour.plasterGrams)}</strong>
                      <small>Per pour</small>
                    </div>
                    <div>
                      <span>Glue</span>
                      <strong>{formatGrams(estimate.formula.perPour.glueGrams)}</strong>
                      <small>Additional per pour</small>
                    </div>
                  </div>

                  {estimate.formula.requestedQuantityEstimate && (
                    <div className="plaster-formula-requested">
                      <div>
                        <span>Required pours</span>
                        <strong>
                          {estimate.formula.requestedQuantityEstimate.requiredPours}
                        </strong>
                      </div>
                      <div>
                        <span>Produced capacity</span>
                        <strong>
                          {estimate.formula.requestedQuantityEstimate.producedCapacityPieces}
                        </strong>
                      </div>
                      <div>
                        <span>Extra capacity</span>
                        <strong>
                          {estimate.formula.requestedQuantityEstimate.extraCapacityPieces}
                        </strong>
                      </div>
                      <div>
                        <span>Total mixture</span>
                        <strong>
                          {formatGrams(
                            estimate.formula.requestedQuantityEstimate.totals
                              .totalMixtureGrams,
                          )}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="plaster-formula-material-breakdown">
                    <span>
                      {estimate.materials.water.materialName}: {' '}
                      <strong>{formatGrams(estimate.formula.perPour.adjustedWaterGrams)}</strong>
                    </span>
                    <span>
                      {estimate.materials.plaster.materialName}: {' '}
                      <strong>{formatGrams(estimate.formula.perPour.plasterGrams)}</strong>
                    </span>
                    <span>
                      {estimate.materials.glue.materialName}: {' '}
                      <strong>{formatGrams(estimate.formula.perPour.glueGrams)}</strong>
                    </span>
                  </div>

                  <p className="plaster-formula-disclaimer">
                    Mold Formula Estimate only. Product safety waste is not applied,
                    and this does not create Yield evidence.
                  </p>
                </>
              ) : (
                <div className="empty-state plaster-formula-preview-empty">
                  <strong>Calculating saved formula…</strong>
                </div>
              )}
            </div>
          </div>

          <div className="plaster-formula-history">
            <div>
              <span>Profile history</span>
              <strong>
                {archivedProfiles.length} archived for this Mold
              </strong>
            </div>
            {archivedProfiles.length === 0 ? (
              <p>No archived formula profiles for this Mold.</p>
            ) : (
              <div className="plaster-formula-history-list">
                {archivedProfiles.map((profile) => (
                  <article key={profile.id}>
                    <div>
                      <strong>{profile.id}</strong>
                      <small>
                        {profile.waterFillWeightGrams} g fill · {' '}
                        {profile.piecesPerPour} piece{profile.piecesPerPour === 1 ? '' : 's'} / pour
                      </small>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || Boolean(activeProfile)}
                      title={
                        activeProfile
                          ? 'Archive the current active profile before restoring another.'
                          : undefined
                      }
                      onClick={() => void restoreProfile(profile)}
                    >
                      Restore
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
