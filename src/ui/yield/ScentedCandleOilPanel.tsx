import { useState } from 'react';
import type { Material } from '../../domain/materials';
import type { InputUnit } from '../../domain/units';
import { estimateEssentialOil } from './scentedCandleOil';
import './scentedCandleOil.css';

interface MaterialInput {
  key: string;
  materialId: string;
  quantity: string;
  unit: InputUnit;
}

const number = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 4 });

export function ScentedCandleOilPanel({
  materials, inputs, disabled, onApply,
}: {
  materials: readonly Material[];
  inputs: readonly MaterialInput[];
  disabled: boolean;
  onApply: (oilMaterialId: string, oilGrams: number) => void;
}) {
  const [selectedWaxKey, setSelectedWaxKey] = useState('');
  const [selectedOilId, setSelectedOilId] = useState('');
  const waxRows = inputs.filter((input) =>
    materials.some((m) => m.isActive && m.group === 'wax' &&
      m.id.toLowerCase() === input.materialId.toLowerCase()));
  const selectedWaxRow = waxRows.find((input) => input.key === selectedWaxKey) ?? waxRows[0];
  const wax = materials.find((m) => m.id.toLowerCase() === selectedWaxRow?.materialId.toLowerCase());
  const oils = materials.filter((m) => m.isActive && m.group === 'fragrance' && m.baseUnit === 'g');
  const selectedOil = oils.find((m) => m.id === selectedOilId) ?? oils[0] ?? null;
  const weight = selectedWaxRow?.quantity.trim() ? Number(selectedWaxRow.quantity) : Number.NaN;
  const estimate = wax && selectedWaxRow
    ? estimateEssentialOil(wax, weight, selectedWaxRow.unit, selectedOil)
    : null;
  const canApply = !disabled && selectedOil !== null && estimate !== null && estimate.oilGrams > 0;

  return (
    <aside className="scented-candle-oil" aria-label="Essential oil calculator">
      <div className="scented-candle-oil-heading">
        <div>
          <span className="yield-column-label">SCENTED CANDLES</span>
          <h4>Essential oil calculator</h4>
          <p>Use the percentage saved on each wax in Materials.</p>
        </div>
      </div>
      {waxRows.length === 0 ? (
        <p className="scented-candle-oil-help">Select a wax material in the batch lines above and enter its weight to calculate the essential oil.</p>
      ) : (
        <>
          <div className="scented-candle-oil-controls">
            {waxRows.length > 1 && (
              <label className="field">
                <span>Wax batch line</span>
                <select aria-label="Wax batch line" value={selectedWaxRow?.key ?? ''}
                  onChange={(event) => setSelectedWaxKey(event.target.value)}>
                  {waxRows.map((line) => (
                    <option key={line.key} value={line.key}>
                      {materials.find((m) => m.id === line.materialId)?.name ?? line.materialId}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Essential oil material</span>
              <select aria-label="Essential oil material" value={selectedOil?.id ?? ''}
                disabled={disabled || oils.length === 0} onChange={(event) => setSelectedOilId(event.target.value)}>
                {oils.length === 0 && <option value="">No fragrance material in grams</option>}
                {oils.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
            </label>
          </div>
          {wax?.essentialOilPercent === undefined ? (
            <p className="scented-candle-oil-help">Set the Essential oil percentage on <strong>{wax?.name}</strong> in Materials → Edit wax before using this calculator.</p>
          ) : estimate === null ? (
            <p className="scented-candle-oil-help">Enter a positive wax weight in g or kg. Volume units need a verified density conversion and cannot be estimated here.</p>
          ) : (
            <>
              <div className="scented-candle-oil-totals" aria-live="polite">
                <div><span>Wax</span><strong>{number(estimate.waxGrams)} g</strong></div>
                <div><span>Saved oil rate</span><strong>{number(estimate.percentage)}%</strong></div>
                <div><span>Essential oil</span><strong>{number(estimate.oilGrams)} g</strong></div>
                <div><span>Wax + oil</span><strong>{number(estimate.totalGrams)} g</strong></div>
              </div>
              <p className="scented-candle-oil-cost">
                {estimate.estimatedMaterialCost === null
                  ? 'Wax + essential oil cost unavailable until both materials have gram-based purchase costing.'
                  : `Estimated wax + oil material cost: ₱${estimate.estimatedMaterialCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </>
          )}
          {oils.length === 0 && <p className="scented-candle-oil-help">Add an essential oil under Materials → Fragrance with a gram base unit to apply this estimate.</p>}
          <button type="button" className="button button-secondary" disabled={!canApply}
            onClick={() => { if (selectedOil && estimate) onApply(selectedOil.id, estimate.oilGrams); }}>
            Apply estimated oil to batch
          </button>
          <p className="scented-candle-oil-disclaimer">Estimate only, based on wax weight rather than final mixture weight. Check your wax supplier's maximum fragrance load and the specific essential oil's candle safety limits. Verify actual quantities before recording Yield evidence.</p>
        </>
      )}
    </aside>
  );
}
