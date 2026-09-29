import type { YieldRecipeSourceKind } from '../../domain/yieldRecipeSource';

export interface YieldRecipeSourceSelectorProps {
  value: YieldRecipeSourceKind;
  disabled?: boolean;
  onChange(kind: YieldRecipeSourceKind): void;
}

const OPTIONS: readonly {
  kind: YieldRecipeSourceKind;
  label: string;
  description: string;
}[] = [
  {
    kind: 'mix-preset',
    label: 'Mix preset',
    description: 'Reference an active compatible saved preset.',
  },
  {
    kind: 'mold-formula',
    label: 'Mold formula',
    description: 'Start from a saved Mold Formula; actual batch measurements stay authoritative.',
  },
  {
    kind: 'manual',
    label: 'Manual',
    description: 'Record the measured batch without a saved recipe reference.',
  },
];

/**
 * YRS3A controlled source selector.
 *
 * Source-specific controls stay owned by the parent Yield workflow so later
 * YRS3 subphases can move each mode independently without changing the
 * selector contract.
 */
export function YieldRecipeSourceSelector({
  value,
  disabled = false,
  onChange,
}: YieldRecipeSourceSelectorProps) {
  return (
    <fieldset
      className="yield-recipe-source-selector"
      aria-label="Recipe source"
      disabled={disabled}
    >
      <legend>Recipe source</legend>
      <p>
        Choose what guided this batch. Actual material quantities and piece
        counts remain the saved Yield evidence.
      </p>
      <div className="yield-recipe-source-options">
        {OPTIONS.map((option) => (
          <label
            key={option.kind}
            className={
              option.kind === value
                ? 'yield-recipe-source-option is-selected'
                : 'yield-recipe-source-option'
            }
          >
            <input
              type="radio"
              name="yield-recipe-source"
              value={option.kind}
              checked={option.kind === value}
              onChange={() => onChange(option.kind)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
