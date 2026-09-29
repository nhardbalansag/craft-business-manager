import { useEffect, useMemo, useState } from 'react';
import {
  moldService,
  plasterMoldOperationalPreviewService,
  plasterMoldYieldProfileService,
} from '../../application/session';
import type { PlasterMoldOperationalPreviewResult } from '../../application/plasterMoldYieldProfiles/PlasterMoldOperationalPreviewService';
import type { Mold } from '../../domain/molds';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import './plasterMoldProductionPreview.css';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

function number(value: number, maximumFractionDigits = 4): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The Mold Formula operational estimate could not be calculated.';
}

function feasibilityLabel(
  value: PlasterMoldOperationalPreviewResult['feasibility'],
): string {
  if (value === 'within-current-stock') return 'Within current formula stock';
  if (value === 'insufficient-current-stock') return 'Formula stock shortfall';
  return 'Formula capacity unresolved';
}

export function PlasterMoldProductionPreview({
  productId,
  productName,
  plannedQuantity,
  authoritativeYieldSampleId,
}: {
  productId: string;
  productName: string;
  plannedQuantity: number | null;
  authoritativeYieldSampleId: string | null;
}) {
  const [molds, setMolds] = useState<Mold[]>([]);
  const [profiles, setProfiles] = useState<PlasterMoldYieldProfile[]>([]);
  const [selectedMoldId, setSelectedMoldId] = useState('');
  const [preview, setPreview] =
    useState<PlasterMoldOperationalPreviewResult | null>(null);
  const [loadingSources, setLoadingSources] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingSources(true);
      setPreview(null);
      setFailure(null);
      try {
        const [nextMolds, nextProfiles] = await Promise.all([
          moldService.listMolds({ productId, active: true }),
          plasterMoldYieldProfileService.listProfiles({ active: true }),
        ]);
        if (cancelled) return;
        setMolds(nextMolds);
        setProfiles(nextProfiles);
      } catch (error) {
        if (!cancelled) setFailure(message(error));
      } finally {
        if (!cancelled) setLoadingSources(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

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
  }, [eligibleMolds, selectedMoldId]);

  useEffect(() => {
    let cancelled = false;

    async function calculate() {
      setPreview(null);
      setFailure(null);

      if (!selectedMoldId || plannedQuantity === null) return;

      setCalculating(true);
      try {
        const result = await plasterMoldOperationalPreviewService.preview(
          selectedMoldId,
          plannedQuantity,
        );
        if (!cancelled) setPreview(result);
      } catch (error) {
        if (!cancelled) setFailure(message(error));
      } finally {
        if (!cancelled) setCalculating(false);
      }
    }

    void calculate();
    return () => {
      cancelled = true;
    };
  }, [plannedQuantity, selectedMoldId]);

  if (loadingSources) {
    return (
      <section
        className="panel mold-production-preview mold-production-preview-state"
        aria-label="Mold Formula operational preview"
        role="status"
      >
        Checking configured Mold Formulas for {productName}…
      </section>
    );
  }

  if (eligibleMolds.length === 0 && !failure) return null;

  return (
    <section
      className="panel mold-production-preview"
      aria-label="Mold Formula operational preview"
      aria-busy={calculating}
    >
      <div className="mold-production-preview-heading">
        <div>
          <p className="panel-kicker">MOLD FORMULA ESTIMATE</p>
          <h2>Formula cost &amp; stock preview</h2>
          <p>
            Parallel theoretical view for the configured plaster Mold. It does
            not replace the Product/Yield production plan above.
          </p>
        </div>
        <span className="mold-production-preview-boundary">
          No safety waste · planning only
        </span>
      </div>

      {authoritativeYieldSampleId ? (
        <p className="mold-production-authority-note">
          Current Production requirements use Yield sample{' '}
          <strong>{authoritativeYieldSampleId}</strong>. This Mold Formula is
          shown only for comparison and pre-production estimation.
        </p>
      ) : (
        <p className="mold-production-authority-note">
          This is an explicitly theoretical Mold Formula estimate. It does not
          become authoritative Yield learning until a real batch is recorded.
        </p>
      )}

      <div className="mold-production-preview-controls">
        <label className="field">
          <span>Configured Mold</span>
          <select
            aria-label="Production formula Mold"
            value={selectedMoldId}
            onChange={(event) => setSelectedMoldId(event.target.value)}
          >
            {eligibleMolds.map((mold) => (
              <option key={mold.id} value={mold.id}>
                {mold.name} · {mold.id}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span>Target</span>
          <strong>
            {plannedQuantity === null
              ? 'Invalid quantity'
              : `${plannedQuantity} finished piece${plannedQuantity === 1 ? '' : 's'}`}
          </strong>
          <small>
            Formula uses complete Mold pours; extra cavity capacity is shown
            separately.
          </small>
        </div>
      </div>

      {failure && (
        <div className="feedback feedback-error" role="alert">
          {failure}
        </div>
      )}

      {calculating ? (
        <div className="mold-production-preview-state" role="status">
          Calculating formula cost and current-stock capacity…
        </div>
      ) : preview ? (
        <>
          <div className="mold-production-preview-summary">
            <article>
              <span>Formula material cost / pour</span>
              <strong>
                {preview.estimatedMaterialCostPerPour === null
                  ? 'Unpriced'
                  : peso.format(preview.estimatedMaterialCostPerPour)}
              </strong>
              <small>
                {preview.formula.piecesPerPour} piece
                {preview.formula.piecesPerPour === 1 ? '' : 's'} / complete pour
              </small>
            </article>
            <article>
              <span>Formula material cost / piece</span>
              <strong>
                {preview.estimatedMaterialCostPerPiece === null
                  ? 'Unpriced'
                  : peso.format(preview.estimatedMaterialCostPerPiece)}
              </strong>
              <small>Theoretical formula materials only</small>
            </article>
            <article>
              <span>Target formula material cost</span>
              <strong>
                {preview.estimatedTargetBatchMaterialCost === null
                  ? 'Unpriced'
                  : peso.format(preview.estimatedTargetBatchMaterialCost)}
              </strong>
              <small>
                {preview.requiredPours} complete pour
                {preview.requiredPours === 1 ? '' : 's'}
              </small>
            </article>
            <article>
              <span>Formula stock capacity</span>
              <strong>
                {preview.maxProducedPiecesFromCurrentStock === null
                  ? 'Unresolved'
                  : `${number(preview.maxProducedPiecesFromCurrentStock)} pc`}
              </strong>
              <small>
                {preview.maxCompletePoursFromCurrentStock === null
                  ? 'Check Material inventory units'
                  : `${preview.maxCompletePoursFromCurrentStock} complete pours`}
              </small>
            </article>
          </div>

          <div
            className={`mold-production-feasibility ${preview.feasibility}`}
          >
            <strong>{feasibilityLabel(preview.feasibility)}</strong>
            <span>
              Target requires {preview.requiredPours} complete pour
              {preview.requiredPours === 1 ? '' : 's'} and produces{' '}
              {preview.producedCapacityPieces} Mold-capacity pieces
              {preview.extraCapacityPieces > 0
                ? ` (${preview.extraCapacityPieces} extra capacity)`
                : ''}
              .
            </span>
          </div>

          <div
            className="table-wrap mold-production-material-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Mold Formula material operational preview"
          >
            <table className="responsive-table materials-table mold-production-material-table">
              <thead>
                <tr>
                  <th scope="col">Formula material</th>
                  <th scope="col">Per pour</th>
                  <th scope="col">Target batch</th>
                  <th scope="col">Current stock</th>
                  <th scope="col">Shortfall</th>
                  <th scope="col">Formula capacity</th>
                  <th scope="col">Target cost</th>
                </tr>
              </thead>
              <tbody>
                {preview.materials.map((line) => (
                  <tr
                    key={line.materialId}
                    className={line.isLimiting ? 'limiting-row' : ''}
                  >
                    <td data-label="Formula material">
                      <strong>{line.materialName}</strong>
                      <span className="material-id">
                        {line.role} · {line.materialId}
                      </span>
                      {line.isLimiting && (
                        <span className="capacity-limiter">Formula limiter</span>
                      )}
                    </td>
                    <td data-label="Per pour">
                      <strong>{number(line.perPourGrams)} g</strong>
                    </td>
                    <td data-label="Target batch">
                      <strong>{number(line.targetBatchGrams)} g</strong>
                    </td>
                    <td data-label="Current stock">
                      <strong>
                        {line.normalizedOnHandGrams === null
                          ? 'Unresolved'
                          : `${number(line.normalizedOnHandGrams)} g`}
                      </strong>
                    </td>
                    <td data-label="Shortfall">
                      {line.targetShortfallGrams === null ? (
                        <span className="stock-check">Check stock</span>
                      ) : line.targetShortfallGrams > 0 ? (
                        <span className="stock-shortfall">
                          {number(line.targetShortfallGrams)} g short
                        </span>
                      ) : (
                        <span className="stock-covered">Covered</span>
                      )}
                    </td>
                    <td data-label="Formula capacity">
                      <strong>
                        {line.producedPieceCapacity === null
                          ? '—'
                          : `${number(line.producedPieceCapacity)} pc`}
                      </strong>
                      <span className="material-id">
                        {line.completePourCapacity === null
                          ? 'unresolved'
                          : `${line.completePourCapacity} pours`}
                      </span>
                    </td>
                    <td data-label="Target cost">
                      <strong>
                        {line.targetBatchCost === null
                          ? 'Unpriced'
                          : peso.format(line.targetBatchCost)}
                      </strong>
                      {line.issues[0] && (
                        <span className="component-row-issue">
                          {line.issues[0].message}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mold-production-preview-footer">
            <span>
              Formula cost includes Water, Plaster, and Glue only. It excludes
              Product safety waste, components, labor, overhead, selling price,
              and profit.
            </span>
            <span>
              Current stock is read-only here; this preview never reserves or
              deducts inventory.
            </span>
          </div>
        </>
      ) : plannedQuantity === null ? (
        <div className="mold-production-preview-state">
          Enter a valid Production quantity to calculate the Mold Formula
          operational preview.
        </div>
      ) : null}
    </section>
  );
}
