import {
  clonePlasterMoldYieldProfile,
  type PlasterMoldYieldProfile,
} from '../../domain/plasterMoldYieldProfiles';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { PlasterMoldYieldProfileRepository } from './PlasterMoldYieldProfileRepository';

function key(id: string): string {
  return id.trim().toLocaleLowerCase();
}

export class InMemoryPlasterMoldYieldProfileRepository
  implements
    PlasterMoldYieldProfileRepository,
    CollectionReplacementPort<PlasterMoldYieldProfile>
{
  private profiles = new Map<string, PlasterMoldYieldProfile>();

  constructor(seed: PlasterMoldYieldProfile[] = []) {
    for (const profile of seed) {
      this.profiles.set(key(profile.id), clonePlasterMoldYieldProfile(profile));
    }
  }

  async list(): Promise<PlasterMoldYieldProfile[]> {
    return [...this.profiles.values()].map(clonePlasterMoldYieldProfile);
  }

  async findById(id: string): Promise<PlasterMoldYieldProfile | null> {
    const profile = this.profiles.get(key(id));
    return profile ? clonePlasterMoldYieldProfile(profile) : null;
  }

  async insert(profile: PlasterMoldYieldProfile): Promise<void> {
    this.profiles.set(key(profile.id), clonePlasterMoldYieldProfile(profile));
  }

  async replace(profile: PlasterMoldYieldProfile): Promise<void> {
    this.profiles.set(key(profile.id), clonePlasterMoldYieldProfile(profile));
  }

  async replaceAll(records: readonly PlasterMoldYieldProfile[]): Promise<void> {
    const next = new Map<string, PlasterMoldYieldProfile>();
    for (const profile of records) {
      next.set(key(profile.id), clonePlasterMoldYieldProfile(profile));
    }
    this.profiles = next;
  }
}
