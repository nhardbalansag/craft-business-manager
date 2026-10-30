type Listener = () => void;

/** Session composition helper; domain repositories remain storage-agnostic. */
export class WorkspaceChangeTracker {
  revision = 0;
  activeOperations = 0;
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  async batch<T>(operation: () => Promise<T>, mutation = false): Promise<T> {
    this.activeOperations += 1;
    this.notify();
    try {
      const result = await operation();
      if (mutation) this.revision += 1;
      return result;
    } finally {
      this.activeOperations -= 1;
      this.notify();
    }
  }

  observeRepository<T extends object>(repository: T): T {
    return this.observeOperations(repository,
      ['insert', 'replace', 'replaceAll', 'delete', 'upsert'].filter((key) => key in repository) as (keyof T)[],
      true);
  }

  /** Batch multi-collection operations, including rollback, into one autosave. */
  observeOperations<T extends object>(target: T, methods: readonly (keyof T)[], mutation = false): T {
    for (const key of methods) {
      const method = target[key];
      if (typeof method !== 'function') throw new TypeError(`Expected method ${String(key)}.`);
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) => this.batch(() => Reflect.apply(method, target, args), mutation),
      });
    }
    return target;
  }
}
