export interface Mold {
  id: string;
  productId: string;
  name: string;
  storageLocationId?: string;
  notes?: string;
  isActive: boolean;
}

export type MoldContractErrorCode =
  | 'INVALID_ID'
  | 'INVALID_PRODUCT_ID'
  | 'INVALID_NAME'
  | 'INVALID_STORAGE_LOCATION_ID'
  | 'INVALID_ACTIVE_STATE';

export class MoldContractError extends Error {
  readonly code: MoldContractErrorCode;
  readonly input?: unknown;

  constructor(code: MoldContractErrorCode, message: string, input?: unknown) {
    super(message);
    this.name = 'MoldContractError';
    this.code = code;
    this.input = input;
  }
}

export function cloneMold(mold: Mold): Mold {
  return { ...mold };
}

export function validateMoldContract(mold: Mold): void {
  if (!mold.id.trim()) throw new MoldContractError('INVALID_ID', 'Mold ID is required.', mold.id);
  if (!mold.productId.trim()) {
    throw new MoldContractError('INVALID_PRODUCT_ID', 'Mold product ID is required.', mold.productId);
  }
  if (!mold.name.trim()) throw new MoldContractError('INVALID_NAME', 'Mold name is required.', mold.name);
  if (mold.storageLocationId !== undefined && !mold.storageLocationId.trim()) {
    throw new MoldContractError(
      'INVALID_STORAGE_LOCATION_ID',
      'Mold storage location ID cannot be blank when provided.',
      mold.storageLocationId,
    );
  }
  if (typeof mold.isActive !== 'boolean') {
    throw new MoldContractError('INVALID_ACTIVE_STATE', 'Mold active state must be a boolean.', mold.isActive);
  }
}
