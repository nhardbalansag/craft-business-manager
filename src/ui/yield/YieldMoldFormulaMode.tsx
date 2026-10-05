import type { ReactNode } from 'react';
import type { PlasterMoldYieldDraft } from './plasterMoldYieldDraft';

export interface YieldMoldFormulaModeProps {
  draft: PlasterMoldYieldDraft | null;
  selectedProductId: string;
  assistant?: ReactNode;
  measurementConfirmed?: boolean;
  measurementDisabled?: boolean;
  onMeasurementConfirmationChange?(confirmed: boolean): void;
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * YRS3C Mold Formula source mode.
 *
 * YRS4A relocates the existing MY6 assistant into this source mode without
 * changing the assistant's calculation or draft-copy behavior. YRS4B integrates
 * planned-piece/formula preview, and YRS4C integrates the actual-batch
 * measurement confirmation while preserving the existing recording gate.
 */
export function YieldMoldFormulaMode({
  draft,
  selectedProductId,
  assistant,
  measurementConfirmed = false,
  measurementDisabled = false,
  onMeasurementConfirmationChange,
}: YieldMoldFormulaModeProps) {
  const belongsToSelectedProduct =
    draft === null ||
    comparable(draft.productId) === comparable(selectedProductId);

  return (
    <section
      className="yield-source-mode yield-mold-formula-mode"
      aria-label="Mold Formula recipe source"
    >
      <div className="yield-source-mode-heading">
        <div>
          <strong>Mold Formula</strong>
          <span>
            Use a saved physical Mold/profile as this batch&apos;s recipe
            provenance.
          </span>
        </div>
        <span className="yield-source-mode-badge">Physical provenance</span>
      </div>

      {draft === null ? (
        <div className="yield-source-mode-state" role="note">
          <strong>No Mold Formula is attached to this draft yet.</strong>
          <span>
            Use Formula setup below to choose a saved Mold Formula, review its
            theoretical production estimate, and copy it into this batch draft.
          </span>
        </div>
      ) : (
        <div
          className={
            belongsToSelectedProduct
              ? 'yield-mold-formula-source-summary'
              : 'yield-mold-formula-source-summary is-invalid'
          }
          aria-label="Selected Mold Formula summary"
        >
          <div>
            <span>Mold</span>
            <strong>{draft.moldName}</strong>
            <small>{draft.moldId}</small>
          </div>
          <div>
            <span>Formula profile</span>
            <strong>{draft.profileId}</strong>
            <small>Saved Plaster Mold Yield Profile</small>
          </div>
          <div>
            <span>Recording behavior</span>
            <strong>Mold + profile provenance</strong>
            <small>
              The recorded Yield sample will keep only its Mold and profile provenance.
            </small>
          </div>

          {!belongsToSelectedProduct && (
            <p className="yield-source-mode-warning" role="alert">
              This Mold Formula belongs to another Product. Choose a formula
              for the currently selected Product before recording.
            </p>
          )}
        </div>
      )}

      {assistant && (
        <div
          className="yield-mold-formula-assist-slot"
          aria-label="Mold Formula assistant"
        >
          {assistant}
        </div>
      )}

      {draft !== null && onMeasurementConfirmationChange && (
        <div
          className={
            measurementConfirmed
              ? 'yield-formula-measurement-confirmation is-confirmed'
              : 'yield-formula-measurement-confirmation'
          }
          aria-label="Actual measurement confirmation"
        >
          <div className="yield-formula-measurement-heading">
            <div>
              <strong>Actual measurement confirmation</strong>
              <span>
                Review the copied Material quantities against the real batch
                before this Formula-assisted draft can become Yield evidence.
              </span>
            </div>
            <span>{measurementConfirmed ? 'Confirmed' : 'Required'}</span>
          </div>

          <label className="yield-formula-draft-confirmation">
            <input
              type="checkbox"
              checked={measurementConfirmed}
              disabled={measurementDisabled || !belongsToSelectedProduct}
              onChange={(event) =>
                onMeasurementConfirmationChange(event.target.checked)
              }
            />
            <span>
              I measured this real batch and replaced or confirmed the Material
              quantities below against the actual consumption.
            </span>
          </label>

          <small>
            Changing, adding, or removing any Material line resets this
            confirmation so the revised evidence must be checked again.
          </small>
        </div>
      )}

      <div className="yield-mold-formula-boundary" role="note">
        <strong>Actual batch evidence stays separate.</strong>
        <span>
          Formula quantities are theoretical draft guidance only. Good pieces,
          rejected pieces, and measured Material quantities still come from the
          real batch.
        </span>
      </div>
    </section>
  );
}
