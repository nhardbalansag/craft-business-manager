export interface MaterialSourceMetadata {
  /** Store, vendor, seller, or supplier name as shown to the user. */
  vendorName?: string;
  /** Free-form source detail such as branch, marketplace shop, contact person, or platform. */
  source?: string;
  /** Direct re-order/product URL when available. */
  purchaseLink?: string;
  /** Supplier/contact phone or messaging number. Kept free-form for international formats. */
  contactNumber?: string;
  /** Social page URL, handle, or page name used to find the seller again. */
  socialPage?: string;
  /** Buying notes such as preferred variant, minimum order, landmark, or delivery detail. */
  notes?: string;
}

export type MaterialSourceField = keyof MaterialSourceMetadata;

const SOURCE_FIELDS: readonly MaterialSourceField[] = [
  'vendorName',
  'source',
  'purchaseLink',
  'contactNumber',
  'socialPage',
  'notes',
];

export type MaterialSourceContractErrorCode =
  | 'INVALID_SOURCE_METADATA'
  | 'INVALID_SOURCE_FIELD'
  | 'EMPTY_SOURCE_METADATA'
  | 'INVALID_PURCHASE_LINK';

export class MaterialSourceContractError extends Error {
  readonly code: MaterialSourceContractErrorCode;
  readonly field?: MaterialSourceField;
  readonly input?: unknown;

  constructor(
    code: MaterialSourceContractErrorCode,
    message: string,
    context: { field?: MaterialSourceField; input?: unknown } = {},
  ) {
    super(message);
    this.name = 'MaterialSourceContractError';
    this.code = code;
    this.field = context.field;
    this.input = context.input;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function hasMaterialSourceMetadata(metadata: MaterialSourceMetadata | undefined): boolean {
  if (!metadata) return false;
  return SOURCE_FIELDS.some((field) => metadata[field]?.trim());
}

/**
 * Runtime validation for supplier/source metadata entering through UI/import boundaries.
 *
 * Contact numbers and social-page references intentionally remain free-form. Supplier
 * formats vary by country/platform and should not be coupled to costing behavior.
 */
export function validateMaterialSourceMetadata(
  metadata: unknown,
): asserts metadata is MaterialSourceMetadata {
  if (!isRecord(metadata)) {
    throw new MaterialSourceContractError(
      'INVALID_SOURCE_METADATA',
      'Material source metadata must be an object.',
      { input: metadata },
    );
  }

  for (const field of SOURCE_FIELDS) {
    const value = metadata[field];
    if (value !== undefined && typeof value !== 'string') {
      throw new MaterialSourceContractError(
        'INVALID_SOURCE_FIELD',
        `Material source field ${field} must be text when supplied.`,
        { field, input: value },
      );
    }
  }

  if (!SOURCE_FIELDS.some((field) => (metadata[field] as string | undefined)?.trim())) {
    throw new MaterialSourceContractError(
      'EMPTY_SOURCE_METADATA',
      'Material source metadata must contain at least one non-empty source detail.',
      { input: metadata },
    );
  }

  const purchaseLink = metadata.purchaseLink;
  if (typeof purchaseLink === 'string' && purchaseLink.trim() && !isHttpUrl(purchaseLink.trim())) {
    throw new MaterialSourceContractError(
      'INVALID_PURCHASE_LINK',
      'Purchase link must be a valid http or https URL.',
      { field: 'purchaseLink', input: purchaseLink },
    );
  }
}

/**
 * Trims source metadata and removes blank optional values. Undefined stays undefined.
 */
export function normalizeMaterialSourceMetadata(
  metadata: MaterialSourceMetadata | undefined,
): MaterialSourceMetadata | undefined {
  if (!metadata) return undefined;

  const normalized: MaterialSourceMetadata = {};
  for (const field of SOURCE_FIELDS) {
    const value = metadata[field]?.trim();
    if (value) normalized[field] = value;
  }

  if (!hasMaterialSourceMetadata(normalized)) return undefined;
  validateMaterialSourceMetadata(normalized);
  return normalized;
}
