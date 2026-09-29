import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YieldRecipeSourceSelector } from './YieldRecipeSourceSelector';

describe('YRS3A YieldRecipeSourceSelector', () => {
  it('exposes the three authoritative recipe-source choices as one radio group', () => {
    render(
      <YieldRecipeSourceSelector value="manual" onChange={() => undefined} />,
    );

    expect(
      screen.getByRole('group', { name: 'Recipe source' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Mix preset/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Mold formula/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Manual/i }),
    ).toBeChecked();
  });

  it('reports the selected source kind without owning source-specific fields', () => {
    const onChange = vi.fn();

    render(
      <YieldRecipeSourceSelector
        value="mix-preset"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Mold formula/i }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('mold-formula');
  });

  it('disables every source choice when the Yield draft is not editable', () => {
    render(
      <YieldRecipeSourceSelector
        value="mix-preset"
        disabled
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('radio', { name: /Mix preset/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Mold formula/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Manual/i })).toBeDisabled();
  });
});
