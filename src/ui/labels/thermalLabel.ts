export const THERMAL_LABEL_SIZE_PRESETS = [
  { id: '40x30', label: '40 × 30 mm', widthMm: 40, heightMm: 30 },
  { id: '50x30', label: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { id: '50x25', label: '50 × 25 mm', widthMm: 50, heightMm: 25 },
  { id: '60x40', label: '60 × 40 mm', widthMm: 60, heightMm: 40 },
] as const;

export type ThermalLabelSizeId = (typeof THERMAL_LABEL_SIZE_PRESETS)[number]['id'];
export type ThermalLabelSizePreset = (typeof THERMAL_LABEL_SIZE_PRESETS)[number];

export const DEFAULT_THERMAL_LABEL_SIZE_ID: ThermalLabelSizeId = '40x30';
export const THERMAL_LABEL_MIN_COPIES = 1;
export const THERMAL_LABEL_MAX_COPIES = 50;

export function getThermalLabelSizePreset(sizeId: ThermalLabelSizeId): ThermalLabelSizePreset {
  return THERMAL_LABEL_SIZE_PRESETS.find((preset) => preset.id === sizeId) ?? THERMAL_LABEL_SIZE_PRESETS[0];
}

export function normalizeThermalLabelCopies(value: number): number {
  if (!Number.isFinite(value)) return THERMAL_LABEL_MIN_COPIES;
  return Math.min(
    THERMAL_LABEL_MAX_COPIES,
    Math.max(THERMAL_LABEL_MIN_COPIES, Math.trunc(value)),
  );
}
