// Reuse collation tables instead of constructing them for every sort comparison.
export const catalogNameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });
export const naturalNameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
