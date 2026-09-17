import type { Mold } from '../../domain/molds';

export interface MoldRepository {
  list(): Promise<Mold[]>;
  findById(id: string): Promise<Mold | null>;
  insert(mold: Mold): Promise<void>;
  replace(mold: Mold): Promise<void>;
}
