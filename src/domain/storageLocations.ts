export const STORAGE_LOCATION_TYPES = ['rack', 'shelf', 'bin'] as const;

export type StorageLocationType = (typeof STORAGE_LOCATION_TYPES)[number];

export interface StorageLocation {
  id: string;
  name: string;
  type: StorageLocationType;
  parentId?: string;
  notes?: string;
  isActive: boolean;
}

export type StorageLocationContractErrorCode =
  | 'INVALID_ID'
  | 'INVALID_NAME'
  | 'INVALID_TYPE'
  | 'INVALID_PARENT_ID'
  | 'INVALID_ACTIVE_STATE';

export class StorageLocationContractError extends Error {
  readonly code: StorageLocationContractErrorCode;
  readonly input?: unknown;

  constructor(code: StorageLocationContractErrorCode, message: string, input?: unknown) {
    super(message);
    this.name = 'StorageLocationContractError';
    this.code = code;
    this.input = input;
  }
}

export function isStorageLocationType(value: unknown): value is StorageLocationType {
  return typeof value === 'string' && STORAGE_LOCATION_TYPES.includes(value as StorageLocationType);
}

export function cloneStorageLocation(location: StorageLocation): StorageLocation {
  return { ...location };
}

export function validateStorageLocationContract(location: StorageLocation): void {
  if (!location.id.trim()) {
    throw new StorageLocationContractError('INVALID_ID', 'Storage location ID is required.', location.id);
  }
  if (!location.name.trim()) {
    throw new StorageLocationContractError('INVALID_NAME', 'Storage location name is required.', location.name);
  }
  if (!isStorageLocationType(location.type)) {
    throw new StorageLocationContractError(
      'INVALID_TYPE',
      `Unsupported storage location type: ${String(location.type)}.`,
      location.type,
    );
  }
  if (location.parentId !== undefined && !location.parentId.trim()) {
    throw new StorageLocationContractError(
      'INVALID_PARENT_ID',
      'Storage parent ID cannot be blank when provided.',
      location.parentId,
    );
  }
  if (typeof location.isActive !== 'boolean') {
    throw new StorageLocationContractError(
      'INVALID_ACTIVE_STATE',
      'Storage location active state must be a boolean.',
      location.isActive,
    );
  }
}
