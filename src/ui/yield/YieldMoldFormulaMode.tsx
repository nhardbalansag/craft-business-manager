import type { PlasterMoldYieldDraft } from './plasterMoldYieldDraft';

export interface YieldMoldFormulaModeProps {
  draft: PlasterMoldYieldDraft | null;
  selectedProductId: string;
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * YRS3C Mold Formula source mode.
 *
 * This mode owns source/provenance presentation only. The existing MY6 formula
 * assistant, theoretical quantity preview/planned-pieces workflow, and actual
 * measurement confirmation remain separate until YRS4A-YRS4C.
 */
export function YieldMoldFormulaMode({
  draft,
  selectedProductId,
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
            Use MOLD FORMULA ASSIST above to choose a saved Mold Formula and
            copy its theoretical quantities into this batch draft.
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
              The recorded Yield sample will not carry a Mix preset reference.
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
