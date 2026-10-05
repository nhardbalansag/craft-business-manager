/**
 * YRS3D Manual source mode.
 *
 * Manual means no saved recipe source and no Mold Formula provenance. The batch is
 * recorded only from the measured Material quantities and actual piece counts
 * already owned by the Yield form.
 */
export function YieldManualMode() {
  return (
    <section
      className="yield-source-mode yield-manual-mode"
      aria-label="Manual recipe source"
    >
      <div className="yield-source-mode-heading">
        <div>
          <strong>Manual</strong>
          <span>
            Record this batch directly from its real measured consumption and
            actual piece counts.
          </span>
        </div>
        <span className="yield-source-mode-badge">No saved recipe</span>
      </div>

      <div className="yield-manual-mode-summary">
        <div>
          <span>Recipe reference</span>
          <strong>None</strong>
          <small>No saved recipe reference is linked to this Yield sample.</small>
        </div>
        <div>
          <span>Physical provenance</span>
          <strong>None</strong>
          <small>No Mold Formula or profile source is linked.</small>
        </div>
        <div>
          <span>Evidence source</span>
          <strong>Actual batch measurements</strong>
          <small>
            Enter the Materials actually consumed and the real good/rejected
            pieces below.
          </small>
        </div>
      </div>

      <div className="yield-manual-mode-guidance" role="note">
        <strong>Manual does not bypass Yield evidence rules.</strong>
        <span>
          Material quantities must still use active compatible Materials, and
          piece counts must still describe the real batch before recording.
        </span>
      </div>
    </section>
  );
}
