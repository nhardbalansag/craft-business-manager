import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';

export interface YieldMixPresetModeProps {
  presets: readonly MixPreset[];
  materials: readonly Material[];
  selectedPresetId: string;
  selectedPreset?: MixPreset;
  disabled?: boolean;
  onChange(presetId: string): void;
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatBasis(value: MixPreset['basis']): string {
  return value === 'weight' ? 'Weight ratio' : 'Volume ratio';
}

/**
 * YRS3B Mix preset source controls.
 *
 * A preset is provenance/reference only. It never overwrites the actual
 * measured material evidence in the Yield draft.
 */
export function YieldMixPresetMode({
  presets,
  materials,
  selectedPresetId,
  selectedPreset,
  disabled = false,
  onChange,
}: YieldMixPresetModeProps) {
  const materialById = new Map(
    materials.map((material) => [comparable(material.id), material]),
  );
  const selected =
    presets.find(
      (preset) => comparable(preset.id) === comparable(selectedPresetId),
    ) ??
    (selectedPreset &&
    comparable(selectedPreset.id) === comparable(selectedPresetId)
      ? selectedPreset
      : undefined);
  const selectedIsAvailable = Boolean(
    selected &&
      selected.isActive &&
      presets.some(
        (preset) => comparable(preset.id) === comparable(selected.id),
      ),
  );
  const hasAvailablePresets = presets.length > 0;

  return (
    <section
      className="yield-source-mode yield-mix-preset-mode"
      aria-label="Mix preset recipe source"
    >
      <div className="yield-source-mode-heading">
        <div>
          <strong>Mix preset</strong>
          <span>
            Choose the saved ratio used as this batch&apos;s recipe reference.
          </span>
        </div>
        <span className="yield-source-mode-badge">Reference only</span>
      </div>

      <label className="field">
        <span>Mix preset</span>
        <select
          aria-label="Yield Mix preset"
          value={selectedPresetId}
          disabled={disabled || !hasAvailablePresets}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {hasAvailablePresets
              ? 'Select mix preset'
              : 'No active compatible presets'}
          </option>
          {selectedPresetId && selected && !selectedIsAvailable && (
            <option value={selected.id}>
              {selected.name} ({selected.id}) · unavailable
            </option>
          )}
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} · {preset.id}
            </option>
          ))}
        </select>
        <small>
          Actual material quantities below remain authoritative and are not
          replaced by the preset ratio.
        </small>
      </label>

      {!hasAvailablePresets && !selected ? (
        <div className="yield-source-mode-state" role="note">
          <strong>No active compatible Mix preset is available.</strong>
          <span>
            Create or reactivate a compatible preset, or choose Manual or Mold
            formula for this batch.
          </span>
        </div>
      ) : selected ? (
        <div
          className={
            selectedIsAvailable
              ? 'yield-mix-preset-preview'
              : 'yield-mix-preset-preview is-unavailable'
          }
          aria-label="Selected Mix preset summary"
        >
          <div className="yield-mix-preset-preview-heading">
            <div>
              <strong>{selected.name}</strong>
              <span>{selected.id}</span>
            </div>
            <span>{formatBasis(selected.basis)}</span>
          </div>

          <div className="yield-mix-preset-lines">
            {selected.lines.map((line) => {
              const material = materialById.get(comparable(line.materialId));
              return (
                <div key={line.materialId}>
                  <span>
                    {material?.name ?? line.materialId}
                    {!material?.isActive && material ? ' · archived' : ''}
                  </span>
                  <strong>{line.parts} part{line.parts === 1 ? '' : 's'}</strong>
                  <small>{line.role}</small>
                </div>
              );
            })}
          </div>

          {selected.notes && (
            <p className="yield-mix-preset-notes">{selected.notes}</p>
          )}

          {!selectedIsAvailable && (
            <p className="yield-source-mode-warning" role="alert">
              This copied preset is unavailable for new evidence. Select an
              active compatible preset before recording.
            </p>
          )}
        </div>
      ) : (
        <div className="yield-source-mode-state">
          <span>Select a preset to inspect its saved ratio.</span>
        </div>
      )}
    </section>
  );
}
