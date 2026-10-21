import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';

/** Persistence boundary for authoritative plaster mold yield profile sources. */
export interface PlasterMoldYieldProfileRepository {
  list(): Promise<PlasterMoldYieldProfile[]>;
  findById(id: string): Promise<PlasterMoldYieldProfile | null>;
  insert(profile: PlasterMoldYieldProfile): Promise<void>;
  replace(profile: PlasterMoldYieldProfile): Promise<void>;
}
