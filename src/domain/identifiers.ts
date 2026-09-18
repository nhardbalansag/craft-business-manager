function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function nextSequentialId(
  existingIds: readonly string[],
  prefix: string,
  minimumDigits = 4,
): string {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) throw new Error('ID prefix is required.');
  if (!Number.isInteger(minimumDigits) || minimumDigits < 1)
    throw new Error('ID minimum digit width must be a positive integer.');

  const matcher = new RegExp(`^${escapeRegExp(normalizedPrefix)}-(\\d+)$`, 'i');
  const occupied = new Set(existingIds.map((id) => id.trim().toLocaleLowerCase()));
  let highest = 0;

  for (const id of existingIds) {
    const match = matcher.exec(id.trim());
    if (!match) continue;
    const numeric = Number(match[1]);
    if (Number.isSafeInteger(numeric) && numeric > highest) highest = numeric;
  }

  let next = highest + 1;
  while (Number.isSafeInteger(next)) {
    const candidate = `${normalizedPrefix}-${String(next).padStart(minimumDigits, '0')}`;
    if (!occupied.has(candidate.toLocaleLowerCase())) return candidate;
    next += 1;
  }

  throw new Error(`Could not generate the next ${normalizedPrefix} ID.`);
}