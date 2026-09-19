export interface CollectionReplacementPort<T> {
  replaceAll(records: readonly T[]): Promise<void>;
}
