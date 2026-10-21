import { useEffect, useMemo, useState } from 'react';
import {
  moldService,
  plasterMoldYieldCalculatorService,
  plasterMoldYieldProfileService,
} from '../../application/session';
import type { Mold } from '../../domain/molds';
import type { Product } from '../../domain/products';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import {
  buildPlasterMoldYieldDraft,
  type PlasterMoldYieldDraft,
} from './plasterMoldYieldDraft';
import './plasterMoldYieldDraftAssist.css';

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatGrams(value: number): string {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value)} g`;
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The Mold Formula estimate could not be loaded.';
}

export function PlasterMoldYieldDraftAssist({
  product,
  disabled = false,
  onUseDraft,
}: {
  product: Product;
  disabled?: boolean;
  onUseDraft: (draft: PlasterMoldYieldDraft) => void;
}) {
  const [molds, setMolds] = useState<Mold[]>([]);
  const [profiles, setProfiles] = useState<PlasterMoldYieldProfile[]>([]);
  const [selectedMoldId, setSelectedMoldId] = useState('');
  const [plannedPieces, setPlannedPieces] = useState('');
  const [estimate, setEstimate] = useState<Awaited<
    ReturnType<typeof plasterMoldYieldCalculatorService.calculateForMold>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setEstimate(null);
      setEstimateError(null);
      try {
        const [nextMolds, nextProfiles] = await Promise.all([
          moldService.listMolds({ productId: product.id, active: true }),
          plasterMoldYieldProfileService.listProfiles({ active: true }),
        ]);
        if (cancelled) return;
        setMolds(nextMolds);
        setProfiles(nextProfiles);
      } catch (error) {
        if (!cancelled) setEstimateError(message(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const profileByMold = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [comparable(profile.moldId), profile]),
      ),
    [profiles],
  );

  const eligibleMolds = useMemo(
    () =>
      molds.filter((mold) => profileByMold.has(comparable(mold.id))),
    [molds, profileByMold],
  );

  useEffect(() => {
    if (
      selectedMoldId &&
      eligibleMolds.some(
        (mold) => comparable(mold.id) === comparable(selectedMoldId),
      )
    ) {
      return;
    }
    setSelectedMoldId(eligibleMolds[0]?.id ?? '');
    setPlannedPieces('');
  }, [eligibleMolds, selectedMoldId]);

  useEffect(() => {
    let cancelled = false;

    async function calculate() {
      if (!selectedMoldId) {
        setEstimate(null);
        setEstimateError(null);
        return;
      }

      const raw = plannedPieces.trim();
      let requestedQuantity: number | undefined;
      if (raw) {
        requestedQuantity = Number(raw);
        if (
          !Number.isInteger(requestedQuantity) ||
          requestedQuantity <= 0
        ) {
          setEstimate(null);
          setEstimateError('Planned pieces must be a positive whole number.');
          return;
        }
      }

      try {
        const next = await plasterMoldYieldCalculatorService.calculateForMold(
          selectedMoldId,
          requestedQuantity,
        );
        if (!cancelled) {
          setEstimate(next);
          setEstimateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setEstimate(null);
          setEstimateError(message(error));
        }
      }
    }

    void calculate();

    return () => {
      cancelled = true;
    };
  }, [plannedPieces, selectedMoldId]);

  const selectedMold = selectedMoldId
    ? eligibleMolds.find(
        (mold) => comparable(mold.id) === comparable(selectedMoldId),
      )
    : undefined;
  const selectedProfile = selectedMoldId
    ? profileByMold.get(comparable(selectedMoldId))
    : undefined;
  const requested = estimate?.formula.requestedQuantityEstimate;
  const previewLabel = requested
    ? `${requested.requestedQuantity} planned piece${requested.requestedQuantity === 1 ? '' : 's'}`
    : 'One-pour baseline';

  return (
    <section
      className="yield-formula-assist"
      aria-label="Mold Formula Yield draft assistant"
    >
      <div className="yield-formula-assist-heading">
        <div>
          <p className="panel-kicker">FORMULA SETUP</p>
          <h3>Choose a Mold Formula and production target</h3>
          <p>
            Planned pieces scale the theoretical Water, Plaster, and Glue
            estimate before you copy it into the editable batch evidence.
          </p>
        </div>
        <span>Theoretical only</span>
      </div>

      {loading ? (
        <div className="yield-formula-assist-state" role="status">
          Checking configured Molds…
        </div>
      ) : estimateError && eligibleMolds.length === 0 ? (
        <div className="feedback feedback-error" role="alert">
          {estimateError}
        </div>
      ) : eligibleMolds.length === 0 ? (
        <div className="yield-formula-assist-state">
          <strong>No configured plaster Mold for {product.name}.</strong>
          <span>
            Add an active Mold Formula profile in Products → Molds &amp; storage
            before using formula-assisted Yield drafts.
          </span>
        </div>
      ) : (
        <>
          <div className="yield-formula-assist-controls">
            <label className="field">
              <span>Mold Formula</span>
              <select
                aria-label="Yield formula Mold"
                value={selectedMoldId}
                disabled={disabled}
                onChange={(event) => setSelectedMoldId(event.target.value)}
              >
                {eligibleMolds.map((mold) => (
                  <option key={mold.id} value={mold.id}>
                    {mold.name} · {mold.id}
                  </option>
                ))}
              </select>
              <small>
                The saved profile defines the theoretical material formula.
              </small>
            </label>

            <label className="field">
              <span>Planned pieces</span>
              <input
                aria-label="Formula planned pieces"
                type="number"
                min="1"
                step="1"
                value={plannedPieces}
                disabled={disabled}
                onChange={(event) => setPlannedPieces(event.target.value)}
                placeholder="Optional"
              />
              <small>
                Leave blank for one pour; enter a target to scale required pours
                and formula quantities.
              </small>
            </label>
          </div>

          <div
            className="yield-formula-source-context"
            aria-label="Formula source context"
          >
            <div>
              <span>Mold</span>
              <strong>{selectedMold?.name ?? '—'}</strong>
              <small>{selectedMold?.id ?? '—'}</small>
            </div>
            <div>
              <span>Profile</span>
              <strong>{selectedProfile?.id ?? '—'}</strong>
              <small>
                {selectedProfile
                  ? `${selectedProfile.piecesPerPour} piece${selectedProfile.piecesPerPour === 1 ? '' : 's'} per pour`
                  : 'No saved profile'}
              </small>
            </div>
          </div>

          {estimateError ? (
            <div className="feedback feedback-error" role="alert">
              {estimateError}
            </div>
          ) : estimate ? (
            <div
              className="yield-formula-preview"
              aria-label="Theoretical Mold Formula preview"
            >
              <div className="yield-formula-preview-heading">
                <div>
                  <strong>Theoretical formula preview</strong>
                  <span>
                    Use this as planning guidance, then verify the real batch.
                  </span>
                </div>
                <span>{previewLabel}</span>
              </div>

              <div className="yield-formula-assist-metrics">
                <div>
                  <span>Water</span>
                  <strong>
                    {formatGrams(
                      requested?.totals.adjustedWaterGrams ??
                        estimate.formula.perPour.adjustedWaterGrams,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Plaster</span>
                  <strong>
                    {formatGrams(
                      requested?.totals.plasterGrams ??
                        estimate.formula.perPour.plasterGrams,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Glue</span>
                  <strong>
                    {formatGrams(
                      requested?.totals.glueGrams ??
                        estimate.formula.perPour.glueGrams,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Total mix</span>
                  <strong>
                    {formatGrams(
                      requested?.totals.totalMixtureGrams ??
                        estimate.formula.perPour.totalMixtureGrams,
                    )}
                  </strong>
                </div>
              </div>

              <div
                className="yield-formula-capacity-preview"
                aria-label="Formula production capacity preview"
              >
                <div>
                  <span>Required pours</span>
                  <strong>{requested?.requiredPours ?? 1}</strong>
                </div>
                <div>
                  <span>Capacity</span>
                  <strong>
                    {requested?.producedCapacityPieces ??
                      estimate.formula.piecesPerPour}
                  </strong>
                  <small>pieces</small>
                </div>
                <div>
                  <span>Extra capacity</span>
                  <strong>{requested?.extraCapacityPieces ?? 0}</strong>
                  <small>pieces</small>
                </div>
              </div>

              <div className="yield-formula-assist-action">
                <div>
                  <strong>Ready to use as a draft?</strong>
                  <span>
                    Copy these theoretical quantities into Materials actually
                    consumed; they remain editable and are not evidence yet.
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={disabled}
                  onClick={() =>
                    onUseDraft(buildPlasterMoldYieldDraft(estimate))
                  }
                >
                  Use as Yield Sample Draft
                </button>
              </div>

              <p className="yield-formula-assist-warning">
                This action does not record Yield evidence and does not set good
                or rejected pieces. Actual batch measurements remain required.
              </p>
            </div>
          ) : (
            <div className="yield-formula-assist-state" role="status">
              Calculating saved Mold Formula…
            </div>
          )}
        </>
      )}
    </section>
  );
}
